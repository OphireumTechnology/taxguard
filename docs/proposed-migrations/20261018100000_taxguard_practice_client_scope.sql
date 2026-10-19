-- PROPOSAL (Phase 14, practice client detail confidentiality). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 20261012250000 (practice management), which holds the current definitions below,
-- 20261012260000 (case workflow) and 20261018070000 (taxguard_ledger_event_year).
--
-- Owner decision 2026-10-19: a staff member assigned to one engagement and tax year reaches that client's records
-- for that engagement and year only, unless independently authorized (a client-wide assignment, a practice manager
-- or an administrator). The practice client detail and its write paths decided access per client
-- (taxguard_practice_client_access: any active assignment to the client), so an engagement-year assignee received
-- every engagement's internal notes, tasks and deadlines, the whole team and assignment history, and the client's
-- case and ledger activity of every year (the latter bypassing the 20261018070000 ledger history filter); and could
-- add notes, tasks and deadlines to, and resolve deadlines of, any engagement and year.
--
-- Scope of a record follows the dimensions it carries (taxguard_staff_record_scope):
--   engagement and year -> an assignment covering both; engagement only (notes) -> any year of that engagement;
--   year only (deadlines without a case, ledger events) -> any assignment covering that year;
--   neither (client-level records, assignment history) -> a whole-client assignment.
--   A record linked to a case takes the case's engagement and year (taxguard_practice_item_scope).
-- Managers and administrators are unchanged. A task assigned to, or created by, the actor stays visible to them.
-- The detail's shape is unchanged; out-of-scope items are omitted. Write refusals reuse ENGAGEMENT_NOT_FOUND,
-- CASE_NOT_FOUND and DEADLINE_NOT_FOUND, so an out-of-scope target is indistinguishable from a missing one; a
-- replayed task key is checked against the existing task's scope first, so a replay never confirms an
-- out-of-scope task. A refused write inserts nothing and writes no audit row.
-- Each function below is identical to its current definition except for the change named above it.
-- Rollback (development): re-apply proposal 20261012250000's definitions and drop the four helpers.

CREATE OR REPLACE FUNCTION public.taxguard_practice_year(p_value text) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_value ~ '^[0-9]{4}$' THEN p_value::integer END $$;
REVOKE ALL ON FUNCTION public.taxguard_practice_year(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_staff_record_scope(p_tenant text, p_client text, p_actor text, p_role text, p_engagement text, p_year integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(public.taxguard_practice_is_manager(p_role), false) OR EXISTS (SELECT 1 FROM public.taxguard_staff_assignments a
    WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.user_id = p_actor AND a.status = 'ACTIVE'
      AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())
      AND CASE WHEN p_engagement IS NOT NULL AND p_year IS NOT NULL
                 THEN (a.engagement_id IS NULL OR a.engagement_id = p_engagement) AND (a.tax_year IS NULL OR a.tax_year = p_year)
               WHEN p_engagement IS NOT NULL THEN a.engagement_id IS NULL OR a.engagement_id = p_engagement
               WHEN p_year IS NOT NULL THEN a.tax_year IS NULL OR a.tax_year = p_year
               ELSE a.engagement_id IS NULL AND a.tax_year IS NULL END) $$;
REVOKE ALL ON FUNCTION public.taxguard_staff_record_scope(text,text,text,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;

-- A task or deadline linked to a case is scoped by the case's engagement and year; an unknown case is out of scope.
CREATE OR REPLACE FUNCTION public.taxguard_practice_item_scope(p_tenant text, p_client text, p_actor text, p_role text, p_case text, p_engagement text, p_year integer)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN p_case IS NOT NULL THEN COALESCE((SELECT public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, p_role, c.engagement_id, c.tax_year)
      FROM public.taxguard_cases c WHERE c.tenant_id = p_tenant AND c.client_id = p_client AND c.case_id = p_case), false)
    ELSE public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, p_role, p_engagement, p_year) END $$;
REVOKE ALL ON FUNCTION public.taxguard_practice_item_scope(text,text,text,text,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;

-- Activity events: ledger events by the year of the record they refer to, case events by their case, practice
-- events by the engagement and year in their metadata. An event with nothing to scope it is whole-client only.
CREATE OR REPLACE FUNCTION public.taxguard_practice_event_scope(p_tenant text, p_client text, p_actor text, p_role text, p_action text, p_case text, p_meta jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN p_action LIKE 'LEDGER\_%'
      THEN public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, p_role, NULL, public.taxguard_ledger_event_year(p_tenant, p_client, p_meta))
    WHEN p_case IS NOT NULL THEN public.taxguard_practice_item_scope(p_tenant, p_client, p_actor, p_role, p_case, NULL, NULL)
    ELSE public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, p_role, NULLIF(p_meta->>'engagementId', ''), public.taxguard_practice_year(p_meta->>'taxYear')) END $$;
REVOKE ALL ON FUNCTION public.taxguard_practice_event_scope(text,text,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Current definition: 20261012250000. Changed: each section is limited to records in the actor's scope; assignment history is whole-client only.
CREATE OR REPLACE FUNCTION public.taxguard_practice_client_detail(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; whole boolean;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
  whole := public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, NULL, NULL);
  RETURN (SELECT jsonb_build_object(
    'client', jsonb_build_object('clientId', c.client_id, 'name', c.name, 'email', c.email, 'phone', c.phone, 'clientType', c.client_type, 'status', c.status,
      'statusReason', c.status_reason, 'statusChangedBy', c.status_changed_by, 'statusChangedAt', c.status_changed_at, 'createdAt', c.created_at),
    'engagements', (SELECT COALESCE(jsonb_agg(jsonb_build_object('engagementId', e.engagement_id, 'title', e.title, 'type', e.type, 'status', e.status,
        'description', e.description, 'version', e.version, 'createdBy', e.created_by, 'createdAt', e.created_at, 'statusChangedAt', e.status_changed_at,
        'taxYears', (SELECT COALESCE(jsonb_agg(jsonb_build_object('taxYear', y.tax_year, 'status', y.status) ORDER BY y.tax_year), '[]'::jsonb)
          FROM public.taxguard_tax_years y WHERE y.tenant_id = e.tenant_id AND y.client_id = e.client_id AND y.engagement_id = e.engagement_id
            AND public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, y.engagement_id, y.tax_year))) ORDER BY e.created_at), '[]'::jsonb)
      FROM public.taxguard_engagements e WHERE e.tenant_id = c.tenant_id AND e.client_id = c.client_id
        AND public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, e.engagement_id, NULL)),
    'team', (SELECT COALESCE(jsonb_agg(jsonb_build_object('assignmentId', s.id, 'role', s.role, 'userId', s.user_id, 'engagementId', s.engagement_id, 'taxYear', s.tax_year,
        'assignedBy', s.assigned_by, 'effectiveFrom', s.effective_from) ORDER BY s.engagement_id, s.tax_year, s.role), '[]'::jsonb)
      FROM public.taxguard_staff_assignments s WHERE s.tenant_id = c.tenant_id AND s.client_id = c.client_id AND s.status = 'ACTIVE'
        AND (s.user_id = p_actor OR public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, s.engagement_id, s.tax_year))),
    'assignmentHistory', (SELECT COALESCE(jsonb_agg(jsonb_build_object('role', h.role, 'previousUserId', h.previous_user_id, 'newUserId', h.new_user_id,
        'changedBy', h.changed_by, 'reason', h.reassignment_reason, 'at', h.timestamp) ORDER BY h.timestamp DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_assignment_history WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND whole ORDER BY timestamp DESC LIMIT 100) h),
    'tasks', (SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', t.id, 'title', t.title, 'description', t.description, 'taskType', t.task_type, 'priority', t.priority,
        'status', t.status, 'assignedUserId', t.assigned_user_id, 'dueDate', t.due_date, 'dependencies', t.dependencies, 'engagementId', t.engagement_id, 'taxYear', t.tax_year,
        'caseId', t.case_id, 'createdBy', t.created_by, 'completedBy', t.completed_by, 'completedAt', t.completed_at, 'version', t.version) ORDER BY t.due_date NULLS LAST, t.id), '[]'::jsonb)
      FROM public.taxguard_practice_tasks t WHERE t.tenant_id = c.tenant_id AND t.client_id = c.client_id
        AND (whole OR t.assigned_user_id = p_actor OR t.created_by = p_actor OR public.taxguard_practice_item_scope(p_tenant, p_client, p_actor, r, t.case_id, t.engagement_id, t.tax_year))),
    'deadlines', (SELECT COALESCE(jsonb_agg(jsonb_build_object('deadlineId', d.id, 'title', d.title, 'category', d.category, 'dueDate', d.due_date, 'authorityType', d.authority_type,
        'status', d.status, 'caseId', d.case_id, 'taxYear', d.tax_year, 'provenance', d.provenance) ORDER BY d.due_date), '[]'::jsonb)
      FROM public.taxguard_deadlines d WHERE d.tenant_id = c.tenant_id AND d.client_id = c.client_id
        AND (whole OR public.taxguard_practice_item_scope(p_tenant, p_client, p_actor, r, d.case_id, NULL, d.tax_year))),
    'notes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('noteId', n.note_id, 'engagementId', n.engagement_id, 'body', n.body, 'authorUid', n.author_uid,
        'authorRole', n.author_role, 'createdAt', n.created_at) ORDER BY n.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_engagement_notes WHERE tenant_id = c.tenant_id AND client_id = c.client_id
        AND (whole OR public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, engagement_id, NULL)) ORDER BY created_at DESC LIMIT 100) n),
    'activity', (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', a.action, 'actorUid', a.actor_uid, 'actorRole', a.actor_role, 'metadata', a.metadata - 'clientId', 'at', a.timestamp)
        ORDER BY a.timestamp DESC), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_audit_log WHERE tenant_id = c.tenant_id AND metadata->>'clientId' = c.client_id
        AND (action LIKE 'PRACTICE\_%' OR action LIKE 'CASE\_%' OR action LIKE 'LEDGER\_%')
        AND (whole OR public.taxguard_practice_event_scope(p_tenant, p_client, p_actor, r, action, case_id, metadata)) ORDER BY timestamp DESC LIMIT 100) a))
  FROM public.taxguard_clients c WHERE c.tenant_id = p_tenant AND c.client_id = p_client);
END $$;

-- Current definition: 20261012250000. Added: the note's engagement must be in scope; a client-level note needs whole-client access (otherwise ENGAGEMENT_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_practice_add_note(p_tenant text, p_client text, p_actor text, p_engagement text, p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; id uuid;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
  IF NOT public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, NULLIF(p_engagement, ''), NULL) THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    INSERT INTO public.taxguard_engagement_notes(tenant_id, client_id, engagement_id, body, author_uid, author_role)
      VALUES (p_tenant, p_client, NULLIF(p_engagement, ''), public.taxguard_practice_text(p_body, 1, 4000, 'NOTE_INVALID'), p_actor, r) RETURNING note_id INTO id;
  EXCEPTION WHEN foreign_key_violation THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_practice_audit(p_tenant, p_client, p_actor, r, 'PRACTICE_NOTE_ADDED', jsonb_build_object('noteId', id, 'engagementId', NULLIF(p_engagement, '')));
  RETURN jsonb_build_object('noteId', id);
END $$;

-- Current definition: 20261012250000. Added: a replayed task, and a linked case (otherwise CASE_NOT_FOUND) or else the task's engagement and year, must be in scope (otherwise ENGAGEMENT_NOT_FOUND).
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
  IF FOUND AND NOT (existing.created_by = p_actor OR public.taxguard_practice_item_scope(p_tenant, p_client, p_actor, r, existing.case_id, existing.engagement_id, existing.tax_year)) THEN
    RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
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
  IF NULLIF(p_body->>'caseId', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND case_id = p_body->>'caseId'
      AND public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, engagement_id, tax_year)) THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(p_body->>'caseId', '') IS NULL AND NOT public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, eng, public.taxguard_practice_year(p_body->>'taxYear')) THEN
    RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
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

-- Current definition: 20261012250000. Added: a linked case (otherwise CASE_NOT_FOUND), or else the deadline's tax year (otherwise ENGAGEMENT_NOT_FOUND), must be in scope.
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
  IF NULLIF(p_body->>'caseId', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND case_id = p_body->>'caseId'
      AND public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, engagement_id, tax_year)) THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NULLIF(p_body->>'caseId', '') IS NULL AND NOT public.taxguard_staff_record_scope(p_tenant, p_client, p_actor, r, NULL, public.taxguard_practice_year(p_body->>'taxYear')) THEN
    RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
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

-- Current definition: 20261012250000. Added: the deadline must be in scope (otherwise DEADLINE_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_practice_resolve_deadline(p_tenant text, p_client text, p_actor text, p_deadline text, p_status text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; d record; reason text;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false, false);
  IF p_status NOT IN ('MET','WAIVED') THEN RAISE EXCEPTION 'PRACTICE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO d FROM public.taxguard_deadlines WHERE id = p_deadline AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_practice_item_scope(p_tenant, p_client, p_actor, r, d.case_id, NULL, d.tax_year) THEN RAISE EXCEPTION 'DEADLINE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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
