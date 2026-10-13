-- PROPOSAL 025 ONLY. NOT APPLIED. Requires the actual core schema (supabase/migrations).
-- Client and engagement management on the EXISTING tables (taxguard_clients, _engagements,
-- _tax_years, _staff_assignments, _assignment_history, _practice_tasks, _deadlines) plus one
-- new append-only table for engagement notes. No client records are created here: client
-- identity provisioning (permanent client ID, owner identity) remains with proposal 006.
--
-- Schema changes to existing tables:
--   * taxguard_staff_assignments: the UNIQUE(tenant_id, client_id, role, status) constraint
--     allowed only one REASSIGNED / REVOKED row per role (history broke on the second change)
--     and one ACTIVE preparer per client across all engagements and years. It is replaced by a
--     partial unique index over ACTIVE rows per (tenant, client, engagement, tax year, role).
--   * Lifecycle / provenance columns on engagements, clients and tasks; version columns for
--     optimistic concurrency. New foreign keys are added NOT VALID so existing rows are not
--     rewritten; validate after data review.
-- Roles: practice managers = admin, administrator, super_admin, super_administrator,
-- practice_manager. Other staff act only on clients they hold an ACTIVE assignment for.
--
-- Rollback (development): drop the taxguard_practice_* functions and taxguard_engagement_notes;
-- drop added columns / indexes; restore uq_taxguard_active_role_assignment only if no
-- duplicate (tenant, client, role, status) rows exist.

ALTER TABLE public.taxguard_staff_assignments DROP CONSTRAINT IF EXISTS uq_taxguard_active_role_assignment;
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_staff_assignment_active ON public.taxguard_staff_assignments
  (tenant_id, client_id, COALESCE(engagement_id, ''), COALESCE(tax_year, 0), role) WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_taxguard_staff_assignments_user ON public.taxguard_staff_assignments(tenant_id, user_id, status);

ALTER TABLE public.taxguard_clients ADD COLUMN IF NOT EXISTS client_type VARCHAR(16) NOT NULL DEFAULT 'individual';
ALTER TABLE public.taxguard_clients ADD COLUMN IF NOT EXISTS status_reason VARCHAR(500);
ALTER TABLE public.taxguard_clients ADD COLUMN IF NOT EXISTS status_changed_by VARCHAR(128);
ALTER TABLE public.taxguard_clients ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
DO $$ BEGIN
  ALTER TABLE public.taxguard_clients ADD CONSTRAINT chk_taxguard_client_type CHECK (client_type IN ('individual','business','trust','estate','nonprofit'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.taxguard_engagements ADD COLUMN IF NOT EXISTS description VARCHAR(2000);
ALTER TABLE public.taxguard_engagements ADD COLUMN IF NOT EXISTS created_by VARCHAR(128);
ALTER TABLE public.taxguard_engagements ADD COLUMN IF NOT EXISTS status_changed_by VARCHAR(128);
ALTER TABLE public.taxguard_engagements ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
ALTER TABLE public.taxguard_engagements ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
DO $$ BEGIN
  ALTER TABLE public.taxguard_engagements ADD CONSTRAINT fk_taxguard_engagement_client FOREIGN KEY (tenant_id, client_id)
    REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.taxguard_practice_tasks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS public.taxguard_engagement_notes (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  note_id UUID NOT NULL DEFAULT gen_random_uuid(),
  engagement_id VARCHAR(128),
  body VARCHAR(4000) NOT NULL CHECK (length(btrim(body)) > 0),
  author_uid VARCHAR(128) NOT NULL, author_role VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, note_id),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id, engagement_id) REFERENCES public.taxguard_engagements(tenant_id, client_id, engagement_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_taxguard_engagement_notes ON public.taxguard_engagement_notes(tenant_id, client_id, created_at DESC);
ALTER TABLE public.taxguard_engagement_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_engagement_notes FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.taxguard_practice_notes_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'NOTE_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_engagement_notes_append_only ON public.taxguard_engagement_notes;
CREATE TRIGGER trg_taxguard_engagement_notes_append_only BEFORE UPDATE OR DELETE ON public.taxguard_engagement_notes
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_practice_notes_append_only();

-- ------------------------------------------------------------------------------------------
-- Authority helpers (internal)
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_practice_is_manager(p_role text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_role IN ('admin','administrator','super_admin','super_administrator','practice_manager') $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_actor(p_tenant text, p_actor text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'PRACTICE_ACCESS_DENIED' USING ERRCODE = 'P0001'; END IF;
  SELECT role INTO r FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active'
    AND role NOT IN ('client','prospective_client','recruiter');
  IF NOT FOUND THEN RAISE EXCEPTION 'PRACTICE_ACCESS_DENIED' USING ERRCODE = 'P0001'; END IF;
  RETURN r;
END $$;

-- Managers see every client of the tenant; other staff only clients with a current ACTIVE assignment.
CREATE OR REPLACE FUNCTION public.taxguard_practice_can_see(p_tenant text, p_client text, p_actor text, p_role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.taxguard_practice_is_manager(p_role) OR EXISTS (SELECT 1 FROM public.taxguard_staff_assignments
    WHERE tenant_id = p_tenant AND client_id = p_client AND user_id = p_actor AND status = 'ACTIVE'
      AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())) $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_client_access(p_tenant text, p_client text, p_actor text, p_manage boolean, p_require_active boolean DEFAULT true) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; client_status text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_client IS NULL OR p_client !~ '^[A-Za-z0-9_-]{1,64}$' THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT status INTO client_status FROM public.taxguard_clients WHERE tenant_id = p_tenant AND client_id = p_client;
  IF NOT FOUND OR NOT public.taxguard_practice_can_see(p_tenant, p_client, p_actor, r) THEN RAISE EXCEPTION 'CLIENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_manage AND NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'PRACTICE_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_require_active AND client_status <> 'active' THEN RAISE EXCEPTION 'CLIENT_NOT_ACTIVE' USING ERRCODE = 'P0001'; END IF;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_audit(p_tenant text, p_client text, p_actor text, p_role text, p_action text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_action, p_actor, p_role, jsonb_build_object('clientId', p_client) || COALESCE(p_meta, '{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_text(p_value text, p_min integer, p_max integer, p_code text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v text := btrim(COALESCE(p_value, ''));
BEGIN
  IF length(v) < p_min OR length(v) > p_max OR v ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN RAISE EXCEPTION '%', p_code USING ERRCODE = 'P0001'; END IF;
  RETURN NULLIF(v, '');
END $$;

-- ------------------------------------------------------------------------------------------
-- Client directory and lifecycle
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_practice_list_clients(p_tenant text, p_actor text, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; f jsonb := COALESCE(p_filter, '{}'::jsonb); lim integer; q text; after text; st text; ty text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  lim := COALESCE((f->>'limit')::integer, 25); q := NULLIF(lower(btrim(f->>'q')), ''); after := NULLIF(f->>'after', '');
  st := NULLIF(f->>'status', ''); ty := NULLIF(f->>'clientType', '');
  IF lim NOT BETWEEN 1 AND 100 OR length(COALESCE(q, '')) > 100 OR (st IS NOT NULL AND st NOT IN ('active','archived')) THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  RETURN (SELECT COALESCE(jsonb_agg(row_data ORDER BY cid COLLATE "C"), '[]'::jsonb) FROM (
    SELECT c.client_id AS cid, jsonb_build_object('clientId', c.client_id, 'name', c.name, 'email', c.email, 'clientType', c.client_type, 'status', c.status,
      'engagements', (SELECT count(*) FROM public.taxguard_engagements e WHERE e.tenant_id = c.tenant_id AND e.client_id = c.client_id AND e.status IN ('draft','active','on_hold')),
      'team', (SELECT COALESCE(jsonb_agg(jsonb_build_object('role', s.role, 'userId', s.user_id, 'engagementId', s.engagement_id, 'taxYear', s.tax_year) ORDER BY s.role, s.user_id), '[]'::jsonb)
        FROM public.taxguard_staff_assignments s WHERE s.tenant_id = c.tenant_id AND s.client_id = c.client_id AND s.status = 'ACTIVE'),
      'openTasks', (SELECT count(*) FROM public.taxguard_practice_tasks t WHERE t.tenant_id = c.tenant_id AND t.client_id = c.client_id AND t.status NOT IN ('COMPLETED','CANCELLED')),
      'nextDeadline', (SELECT min(d.due_date) FROM public.taxguard_deadlines d WHERE d.tenant_id = c.tenant_id AND d.client_id = c.client_id AND d.status = 'PENDING')) AS row_data
    FROM public.taxguard_clients c
    WHERE c.tenant_id = p_tenant AND public.taxguard_practice_can_see(p_tenant, c.client_id, p_actor, r)
      AND (st IS NULL OR c.status = st) AND (ty IS NULL OR c.client_type = ty)
      AND (q IS NULL OR position(q IN lower(c.client_id || ' ' || COALESCE(c.name, '') || ' ' || COALESCE(c.email, ''))) > 0)
      AND (after IS NULL OR c.client_id COLLATE "C" > after COLLATE "C")
    ORDER BY c.client_id COLLATE "C" LIMIT lim) page);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_client_detail(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
  RETURN (SELECT jsonb_build_object(
    'client', jsonb_build_object('clientId', c.client_id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'clientType', c.client_type, 'status', c.status,
      'statusReason', c.status_reason, 'statusChangedBy', c.status_changed_by, 'statusChangedAt', c.status_changed_at, 'createdAt', c.created_at),
    'engagements', (SELECT COALESCE(jsonb_agg(jsonb_build_object('engagementId', e.engagement_id, 'title', e.title, 'type', e.type, 'status', e.status,
        'description', e.description, 'version', e.version, 'createdBy', e.created_by, 'createdAt', e.created_at, 'statusChangedAt', e.status_changed_at,
        'taxYears', (SELECT COALESCE(jsonb_agg(jsonb_build_object('taxYear', y.tax_year, 'status', y.status) ORDER BY y.tax_year), '[]'::jsonb)
          FROM public.taxguard_tax_years y WHERE y.tenant_id = e.tenant_id AND y.client_id = e.client_id AND y.engagement_id = e.engagement_id)) ORDER BY e.created_at), '[]'::jsonb)
      FROM public.taxguard_engagements e WHERE e.tenant_id = c.tenant_id AND e.client_id = c.client_id),
    'team', (SELECT COALESCE(jsonb_agg(jsonb_build_object('assignmentId', s.id, 'role', s.role, 'userId', s.user_id, 'engagementId', s.engagement_id, 'taxYear', s.tax_year,
        'assignedBy', s.assigned_by, 'effectiveFrom', s.effective_from) ORDER BY s.engagement_id, s.tax_year, s.role), '[]'::jsonb)
      FROM public.taxguard_staff_assignments s WHERE s.tenant_id = c.tenant_id AND s.client_id = c.client_id AND s.status = 'ACTIVE'),
    'assignmentHistory', (SELECT COALESCE(jsonb_agg(jsonb_build_object('role', h.role, 'previousUserId', h.previous_user_id, 'newUserId', h.new_user_id,
        'changedBy', h.changed_by, 'reason', h.reassignment_reason, 'at', h.timestamp) ORDER BY h.timestamp DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_assignment_history WHERE tenant_id = c.tenant_id AND client_id = c.client_id ORDER BY timestamp DESC LIMIT 100) h),
    'tasks', (SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', t.id, 'title', t.title, 'description', t.description, 'taskType', t.task_type, 'priority', t.priority,
        'status', t.status, 'assignedUserId', t.assigned_user_id, 'dueDate', t.due_date, 'dependencies', t.dependencies, 'engagementId', t.engagement_id, 'taxYear', t.tax_year,
        'caseId', t.case_id, 'createdBy', t.created_by, 'completedBy', t.completed_by, 'completedAt', t.completed_at, 'version', t.version) ORDER BY t.due_date NULLS LAST, t.id), '[]'::jsonb)
      FROM public.taxguard_practice_tasks t WHERE t.tenant_id = c.tenant_id AND t.client_id = c.client_id),
    'deadlines', (SELECT COALESCE(jsonb_agg(jsonb_build_object('deadlineId', d.id, 'title', d.title, 'category', d.category, 'dueDate', d.due_date, 'authorityType', d.authority_type,
        'status', d.status, 'caseId', d.case_id, 'taxYear', d.tax_year, 'provenance', d.provenance) ORDER BY d.due_date), '[]'::jsonb)
      FROM public.taxguard_deadlines d WHERE d.tenant_id = c.tenant_id AND d.client_id = c.client_id),
    'notes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('noteId', n.note_id, 'engagementId', n.engagement_id, 'body', n.body, 'authorUid', n.author_uid,
        'authorRole', n.author_role, 'createdAt', n.created_at) ORDER BY n.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_engagement_notes WHERE tenant_id = c.tenant_id AND client_id = c.client_id ORDER BY created_at DESC LIMIT 100) n),
    'activity', (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', a.action, 'actorUid', a.actor_uid, 'actorRole', a.actor_role, 'metadata', a.metadata - 'clientId', 'at', a.timestamp)
        ORDER BY a.timestamp DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_audit_log WHERE tenant_id = c.tenant_id AND metadata->>'clientId' = c.client_id
        AND (action LIKE 'PRACTICE\_%' OR action LIKE 'CASE\_%' OR action LIKE 'LEDGER\_%') ORDER BY timestamp DESC LIMIT 100) a))
  FROM public.taxguard_clients c WHERE c.tenant_id = p_tenant AND c.client_id = p_client);
END $$;

-- Archival blocks new work (and, through proposal 006/008 session checks, client sign-in);
-- history is kept. Reactivation restores active status. Both require a reason.
CREATE OR REPLACE FUNCTION public.taxguard_practice_set_client_status(p_tenant text, p_client text, p_actor text, p_status text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; reason text; current_status text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true, false);
  IF p_status NOT IN ('active','archived') THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  reason := public.taxguard_practice_text(p_reason, 5, 500, 'STATUS_REASON_REQUIRED');
  SELECT status INTO current_status FROM public.taxguard_clients WHERE tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF current_status = p_status THEN RAISE EXCEPTION 'CLIENT_STATUS_UNCHANGED' USING ERRCODE = 'P0001'; END IF;
  IF current_status NOT IN ('active','archived') THEN RAISE EXCEPTION 'CLIENT_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p_status = 'archived' AND EXISTS (SELECT 1 FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND status IN ('draft','active','on_hold')) THEN
    RAISE EXCEPTION 'CLIENT_HAS_OPEN_ENGAGEMENTS' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_clients SET status = p_status, status_reason = reason, status_changed_by = p_actor, status_changed_at = now(), updated_at = now()
    WHERE tenant_id = p_tenant AND client_id = p_client;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, CASE WHEN p_status = 'archived' THEN 'PRACTICE_CLIENT_ARCHIVED' ELSE 'PRACTICE_CLIENT_REACTIVATED' END,
    jsonb_build_object('from', current_status));
  RETURN jsonb_build_object('clientId', p_client, 'status', p_status);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_set_client_type(p_tenant text, p_client text, p_actor text, p_type text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true);
  BEGIN UPDATE public.taxguard_clients SET client_type = p_type, updated_at = now() WHERE tenant_id = p_tenant AND client_id = p_client;
  EXCEPTION WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_CLIENT_TYPE_SET', jsonb_build_object('clientType', p_type));
  RETURN jsonb_build_object('clientId', p_client, 'clientType', p_type);
END $$;

-- ------------------------------------------------------------------------------------------
-- Engagements and tax years
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_practice_create_engagement(p_tenant text, p_client text, p_actor text, p_engagement text, p_title text, p_type text,
  p_description text, p_tax_years integer[]) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; existing record; y integer; title text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true);
  IF p_engagement IS NULL OR p_engagement !~ '^[A-Za-z0-9_-]{8,128}$' OR p_type NOT IN ('tax_preparation','bookkeeping','tax_planning','advisory','representation','payroll')
     OR p_tax_years IS NULL OR cardinality(p_tax_years) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  title := public.taxguard_practice_text(p_title, 3, 255, 'PRACTICE_INPUT_INVALID');
  SELECT * INTO existing FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement;
  IF FOUND THEN
    IF existing.title = title AND existing.type = p_type THEN RETURN jsonb_build_object('engagementId', p_engagement, 'created', false); END IF;
    RAISE EXCEPTION 'PRACTICE_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.taxguard_engagements(tenant_id, client_id, engagement_id, title, type, status, description, created_by)
    VALUES (p_tenant, p_client, p_engagement, title, p_type, 'draft', public.taxguard_practice_text(p_description, 0, 2000, 'PRACTICE_INPUT_INVALID'), p_actor);
  FOREACH y IN ARRAY p_tax_years LOOP
    IF y IS NULL OR y NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.taxguard_tax_years(tenant_id, client_id, engagement_id, tax_year, status) VALUES (p_tenant, p_client, p_engagement, y, 'active') ON CONFLICT DO NOTHING;
  END LOOP;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_ENGAGEMENT_CREATED', jsonb_build_object('engagementId', p_engagement, 'type', p_type, 'taxYears', to_jsonb(p_tax_years)));
  RETURN jsonb_build_object('engagementId', p_engagement, 'created', true);
END $$;

-- draft -> active | cancelled; active -> on_hold | completed | cancelled; on_hold -> active | cancelled.
CREATE OR REPLACE FUNCTION public.taxguard_practice_set_engagement_status(p_tenant text, p_client text, p_actor text, p_engagement text, p_status text, p_version integer, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; e record; reason text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true);
  SELECT * INTO e FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_version IS NULL OR e.version <> p_version THEN RAISE EXCEPTION 'PRACTICE_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF NOT ((e.status = 'draft' AND p_status IN ('active','cancelled')) OR (e.status = 'active' AND p_status IN ('on_hold','completed','cancelled'))
      OR (e.status = 'on_hold' AND p_status IN ('active','cancelled'))) THEN
    RAISE EXCEPTION 'ENGAGEMENT_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001';
  END IF;
  reason := public.taxguard_practice_text(p_reason, CASE WHEN p_status IN ('cancelled','on_hold') THEN 5 ELSE 0 END, 500, 'STATUS_REASON_REQUIRED');
  IF p_status = 'completed' AND EXISTS (SELECT 1 FROM public.taxguard_practice_tasks WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement
      AND status NOT IN ('COMPLETED','CANCELLED')) THEN
    RAISE EXCEPTION 'ENGAGEMENT_HAS_OPEN_TASKS' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_engagements SET status = p_status, status_changed_by = p_actor, status_changed_at = now(), updated_at = now(), version = version + 1
    WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_ENGAGEMENT_STATUS_CHANGED',
    jsonb_build_object('engagementId', p_engagement, 'from', e.status, 'to', p_status) || CASE WHEN reason IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('reasonRecorded', true) END);
  RETURN jsonb_build_object('engagementId', p_engagement, 'status', p_status, 'version', e.version + 1);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_add_tax_year(p_tenant text, p_client text, p_actor text, p_engagement text, p_year integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; st text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true);
  SELECT status INTO st FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF st NOT IN ('draft','active','on_hold') THEN RAISE EXCEPTION 'ENGAGEMENT_CLOSED' USING ERRCODE = 'P0001'; END IF;
  IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_tax_years(tenant_id, client_id, engagement_id, tax_year, status) VALUES (p_tenant, p_client, p_engagement, p_year, 'active') ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_YEAR_EXISTS' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_TAX_YEAR_ADDED', jsonb_build_object('engagementId', p_engagement, 'taxYear', p_year));
  RETURN jsonb_build_object('engagementId', p_engagement, 'taxYear', p_year);
END $$;

-- ------------------------------------------------------------------------------------------
-- Team assignments (engagement + tax year scoped, as case reads require)
-- ------------------------------------------------------------------------------------------
-- preparer <- accountant; reviewer <- reviewer / senior_reviewer; bookkeeper <- bookkeeper;
-- case_owner <- practice_manager / accountant / senior_reviewer. A reviewer may never be the
-- active preparer of the same engagement year (and vice versa).
CREATE OR REPLACE FUNCTION public.taxguard_practice_assign(p_tenant text, p_client text, p_actor text, p_engagement text, p_year integer, p_role text,
  p_user text, p_reason text, p_assignment text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; target_role text; prior record; prior_user text; reason text; st text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true);
  reason := public.taxguard_practice_text(p_reason, 5, 500, 'ASSIGNMENT_REASON_REQUIRED');
  IF p_role NOT IN ('preparer','reviewer','bookkeeper','case_owner') OR p_user IS NULL OR p_user !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_assignment IS NULL OR p_assignment !~ '^[A-Za-z0-9_-]{8,128}$' THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT status INTO st FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF st NOT IN ('draft','active','on_hold') THEN RAISE EXCEPTION 'ENGAGEMENT_CLOSED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_tax_years WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND tax_year = p_year;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_YEAR_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT role INTO target_role FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_user AND status = 'active';
  IF NOT FOUND OR NOT ((p_role = 'preparer' AND target_role = 'accountant') OR (p_role = 'reviewer' AND target_role IN ('reviewer','senior_reviewer'))
      OR (p_role = 'bookkeeper' AND target_role = 'bookkeeper') OR (p_role = 'case_owner' AND target_role IN ('practice_manager','accountant','senior_reviewer'))) THEN
    RAISE EXCEPTION 'ASSIGNEE_ROLE_INCOMPATIBLE' USING ERRCODE = 'P0001';
  END IF;
  IF p_role IN ('preparer','reviewer') AND EXISTS (SELECT 1 FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client
      AND engagement_id = p_engagement AND tax_year = p_year AND status = 'ACTIVE' AND user_id = p_user
      AND role = CASE p_role WHEN 'preparer' THEN 'reviewer' ELSE 'preparer' END) THEN
    RAISE EXCEPTION 'ASSIGNMENT_SEGREGATION_OF_DUTIES' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO prior FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement
    AND tax_year = p_year AND role = p_role AND status = 'ACTIVE' FOR UPDATE;
  IF FOUND THEN
    prior_user := prior.user_id;
    IF prior_user = p_user THEN RAISE EXCEPTION 'ASSIGNMENT_UNCHANGED' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.taxguard_staff_assignments SET status = 'REASSIGNED', effective_to = now(), updated_at = now() WHERE id = prior.id;
  END IF;
  BEGIN
    INSERT INTO public.taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, effective_from, status)
      VALUES (p_assignment, p_tenant, p_client, p_engagement, p_year, p_role, p_user, p_actor, now(), 'ACTIVE');
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'PRACTICE_CONCURRENT_UPDATE' USING ERRCODE = 'P0001';
  END;
  INSERT INTO public.taxguard_assignment_history(tenant_id, client_id, role, previous_user_id, new_user_id, changed_by, reassignment_reason)
    VALUES (p_tenant, p_client, p_role, prior_user, p_user, p_actor, reason);
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_TEAM_ASSIGNED',
    jsonb_build_object('engagementId', p_engagement, 'taxYear', p_year, 'role', p_role, 'userId', p_user, 'previousUserId', prior_user));
  RETURN jsonb_build_object('assignmentId', p_assignment, 'role', p_role, 'userId', p_user, 'previousUserId', prior_user);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_unassign(p_tenant text, p_client text, p_actor text, p_assignment text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; a record; reason text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, true, false);
  reason := public.taxguard_practice_text(p_reason, 5, 500, 'ASSIGNMENT_REASON_REQUIRED');
  SELECT * INTO a FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client AND id = p_assignment AND status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ASSIGNMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_staff_assignments SET status = 'REVOKED', effective_to = now(), updated_at = now() WHERE id = a.id;
  INSERT INTO public.taxguard_assignment_history(tenant_id, client_id, role, previous_user_id, new_user_id, changed_by, reassignment_reason)
    VALUES (p_tenant, p_client, a.role, a.user_id, '(unassigned)', p_actor, reason);
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_TEAM_UNASSIGNED', jsonb_build_object('assignmentId', a.id, 'role', a.role, 'userId', a.user_id));
  RETURN jsonb_build_object('assignmentId', a.id, 'status', 'REVOKED');
END $$;

-- ------------------------------------------------------------------------------------------
-- Notes, tasks and deadlines
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_practice_add_note(p_tenant text, p_client text, p_actor text, p_engagement text, p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; id uuid;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
  BEGIN
    INSERT INTO public.taxguard_engagement_notes(tenant_id, client_id, engagement_id, body, author_uid, author_role)
      VALUES (p_tenant, p_client, NULLIF(p_engagement, ''), public.taxguard_practice_text(p_body, 1, 4000, 'NOTE_INVALID'), p_actor, r) RETURNING note_id INTO id;
  EXCEPTION WHEN foreign_key_violation THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_NOTE_ADDED', jsonb_build_object('noteId', id, 'engagementId', NULLIF(p_engagement, '')));
  RETURN jsonb_build_object('noteId', id);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_create_task(p_tenant text, p_client text, p_actor text, p_task text, p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; assignee text; dep text; existing record; eng text; due timestamptz;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false);
  IF p_task IS NULL OR p_task !~ '^[A-Za-z0-9_-]{8,128}$' OR p_body IS NULL OR jsonb_typeof(p_body) <> 'object'
     OR COALESCE(p_body->>'priority', 'MEDIUM') NOT IN ('LOW','MEDIUM','HIGH','URGENT')
     OR (p_body ? 'dependencies' AND jsonb_typeof(p_body->'dependencies') <> 'array') OR jsonb_array_length(COALESCE(p_body->'dependencies', '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO existing FROM public.taxguard_practice_tasks WHERE id = p_task;
  IF FOUND THEN
    IF existing.tenant_id = p_tenant AND existing.client_id = p_client AND existing.title = btrim(p_body->>'title') THEN RETURN jsonb_build_object('taskId', p_task, 'created', false); END IF;
    RAISE EXCEPTION 'PRACTICE_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  assignee := NULLIF(p_body->>'assignedUserId', '');
  IF assignee IS NOT NULL THEN
    PERFORM 1 FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = assignee AND status = 'active' AND role NOT IN ('client','prospective_client','recruiter')
      AND public.taxguard_practice_can_see(p_tenant, p_client, assignee, role);
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK_ASSIGNEE_NOT_AUTHORIZED' USING ERRCODE = 'P0001'; END IF;
  END IF;
  eng := NULLIF(p_body->>'engagementId', '');
  IF eng IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = eng) THEN
    RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(p_body->>'caseId', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND case_id = p_body->>'caseId') THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  FOR dep IN SELECT value FROM jsonb_array_elements_text(COALESCE(p_body->'dependencies', '[]'::jsonb)) LOOP
    PERFORM 1 FROM public.taxguard_practice_tasks WHERE id = dep AND tenant_id = p_tenant AND client_id = p_client;
    IF NOT FOUND THEN RAISE EXCEPTION 'TASK_DEPENDENCY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  END LOOP;
  BEGIN due := NULLIF(p_body->>'dueDate', '')::timestamptz; EXCEPTION WHEN others THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  INSERT INTO public.taxguard_practice_tasks(id, tenant_id, client_id, engagement_id, tax_year, case_id, task_type, title, description, priority, status, assigned_user_id,
      created_by, due_date, dependencies)
    VALUES (p_task, p_tenant, p_client, eng, NULLIF(p_body->>'taxYear', '')::integer, NULLIF(p_body->>'caseId', ''),
      COALESCE(NULLIF(p_body->>'taskType', ''), 'GENERAL'), public.taxguard_practice_text(p_body->>'title', 3, 255, 'PRACTICE_INPUT_INVALID'),
      public.taxguard_practice_text(p_body->>'description', 0, 2000, 'PRACTICE_INPUT_INVALID'), COALESCE(p_body->>'priority', 'MEDIUM'), 'OPEN', assignee, p_actor, due,
      COALESCE(p_body->'dependencies', '[]'::jsonb));
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_TASK_CREATED', jsonb_build_object('taskId', p_task, 'assignedUserId', assignee));
  RETURN jsonb_build_object('taskId', p_task, 'created', true);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

-- Task status: the assignee, the creator or a manager may change it. COMPLETED requires every
-- dependency to be COMPLETED. COMPLETED and CANCELLED are terminal.
CREATE OR REPLACE FUNCTION public.taxguard_practice_set_task_status(p_tenant text, p_client text, p_actor text, p_task text, p_status text, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t record;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
  IF p_status NOT IN ('OPEN','IN_PROGRESS','WAITING_ON_CLIENT','WAITING_ON_PROVIDER','READY_FOR_REVIEW','BLOCKED','COMPLETED','CANCELLED') THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO t FROM public.taxguard_practice_tasks WHERE id = p_task AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TASK_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_version IS NULL OR t.version <> p_version THEN RAISE EXCEPTION 'PRACTICE_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF NOT public.taxguard_practice_is_manager(r) AND p_actor IS DISTINCT FROM t.assigned_user_id AND p_actor <> t.created_by THEN
    RAISE EXCEPTION 'TASK_ACTION_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF t.status IN ('COMPLETED','CANCELLED') THEN RAISE EXCEPTION 'TASK_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p_status = 'COMPLETED' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(t.dependencies) d(id) JOIN public.taxguard_practice_tasks x ON x.id = d.id
      WHERE x.status <> 'COMPLETED') THEN
    RAISE EXCEPTION 'TASK_DEPENDENCIES_OPEN' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.taxguard_practice_tasks SET status = p_status, version = version + 1, updated_at = now(),
      completed_at = CASE WHEN p_status = 'COMPLETED' THEN now() END, completed_by = CASE WHEN p_status = 'COMPLETED' THEN p_actor END
    WHERE id = p_task;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_TASK_STATUS_CHANGED', jsonb_build_object('taskId', p_task, 'from', t.status, 'to', p_status));
  RETURN jsonb_build_object('taskId', p_task, 'status', p_status, 'version', t.version + 1);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_add_deadline(p_tenant text, p_client text, p_actor text, p_deadline text, p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; due timestamptz;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false);
  -- STATUTORY deadlines must cite their source; TaxGuard does not invent statutory dates.
  IF p_deadline IS NULL OR p_deadline !~ '^[A-Za-z0-9_-]{8,128}$' OR p_body IS NULL
     OR p_body->>'category' NOT IN ('client_request','internal_prep','review','signature','filing','estimated_payment','extension','notice_response','bookkeeping_close','renewal')
     OR COALESCE(p_body->>'authorityType', 'INTERNAL') NOT IN ('STATUTORY','PROVIDER','CLIENT_COMMITMENT','INTERNAL','ESTIMATED','MANUAL')
     OR (COALESCE(p_body->>'authorityType', 'INTERNAL') = 'STATUTORY' AND length(btrim(COALESCE(p_body->>'sourceCitation', ''))) < 5) THEN
    RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  BEGIN due := (p_body->>'dueDate')::timestamptz; EXCEPTION WHEN others THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  IF NULLIF(p_body->>'caseId', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND case_id = p_body->>'caseId') THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF due IS NULL THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_deadlines(id, tenant_id, client_id, case_id, tax_year, category, title, due_date, authority_type, status, provenance)
    VALUES (p_deadline, p_tenant, p_client, NULLIF(p_body->>'caseId', ''), NULLIF(p_body->>'taxYear', '')::integer, p_body->>'category',
      public.taxguard_practice_text(p_body->>'title', 3, 255, 'PRACTICE_INPUT_INVALID'), due, COALESCE(p_body->>'authorityType', 'INTERNAL'), 'PENDING',
      jsonb_build_object('createdBy', p_actor, 'sourceCitation', NULLIF(btrim(COALESCE(p_body->>'sourceCitation', '')), '')))
    ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.taxguard_deadlines WHERE id = p_deadline AND tenant_id = p_tenant AND client_id = p_client) THEN RETURN jsonb_build_object('deadlineId', p_deadline, 'created', false); END IF;
    RAISE EXCEPTION 'PRACTICE_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_DEADLINE_ADDED', jsonb_build_object('deadlineId', p_deadline, 'category', p_body->>'category'));
  RETURN jsonb_build_object('deadlineId', p_deadline, 'created', true);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_practice_resolve_deadline(p_tenant text, p_client text, p_actor text, p_deadline text, p_status text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; d record; reason text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
  IF p_status NOT IN ('MET','WAIVED') THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO d FROM public.taxguard_deadlines WHERE id = p_deadline AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEADLINE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF d.status NOT IN ('PENDING','OVERDUE') THEN RAISE EXCEPTION 'DEADLINE_ALREADY_RESOLVED' USING ERRCODE = 'P0001'; END IF;
  -- Waiving is a manager decision with a recorded reason; statutory deadlines cannot be waived here.
  IF p_status = 'WAIVED' AND (NOT public.taxguard_practice_is_manager(r) OR d.authority_type = 'STATUTORY') THEN
    RAISE EXCEPTION 'DEADLINE_WAIVER_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  reason := public.taxguard_practice_text(p_reason, CASE WHEN p_status = 'WAIVED' THEN 5 ELSE 0 END, 500, 'STATUS_REASON_REQUIRED');
  UPDATE public.taxguard_deadlines SET status = p_status, updated_at = now(),
      provenance = provenance || jsonb_build_object('resolvedBy', p_actor, 'resolvedAt', now(), 'resolution', reason)
    WHERE id = p_deadline;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_DEADLINE_RESOLVED', jsonb_build_object('deadlineId', p_deadline, 'status', p_status));
  RETURN jsonb_build_object('deadlineId', p_deadline, 'status', p_status);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_practice\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_practice_list_clients','taxguard_practice_client_detail','taxguard_practice_set_client_status','taxguard_practice_set_client_type',
        'taxguard_practice_create_engagement','taxguard_practice_set_engagement_status','taxguard_practice_add_tax_year','taxguard_practice_assign',
        'taxguard_practice_unassign','taxguard_practice_add_note','taxguard_practice_create_task','taxguard_practice_set_task_status',
        'taxguard_practice_add_deadline','taxguard_practice_resolve_deadline') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
