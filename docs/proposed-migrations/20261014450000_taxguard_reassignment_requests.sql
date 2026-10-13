-- PROPOSAL 045 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025 and 027.
-- Durable client reassignment requests, replacing the in-memory /api/assignments
-- request-reassignment / reassignment-requests workflow (legacy AssignmentGovernanceTab).
--
-- The legacy business rules are kept exactly:
--   * a client asks for a different advisor with a reason of at least 10 characters and an optional
--     preferred specialization; the request starts PENDING;
--   * practice leadership reviews it: APPROVED or REJECTED with an optional note (<= 2000
--     characters, shown to the client); review authority is the durable assignment authority
--     (taxguard_practice_is_manager: admins and practice managers);
--   * approval does NOT change any assignment by itself: reassignment stays the separate, audited
--     taxguard_practice_assign / unassign action (proposal 025).
-- Added for durability: tenant / client scope via taxguard_doc_actor, idempotent creation and
-- review, versions, append-only events, audit entries without the reason text.
-- Not decided by the product and therefore not added: limits on concurrent requests and whether
-- the reviewer must be independent of the current advisor (documented for the owner).
-- Rollback (development): drop the taxguard_rar_* functions, triggers and two tables.

CREATE TABLE IF NOT EXISTS public.taxguard_reassignment_requests (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id),
  request_id VARCHAR(40) NOT NULL CHECK (request_id ~ '^rar_[a-f0-9]{32}$'),
  client_id VARCHAR(64) NOT NULL,
  reason VARCHAR(2000) NOT NULL CHECK (length(btrim(reason)) >= 10),
  preferred_specialization VARCHAR(200),
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  review_note VARCHAR(2000),
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  PRIMARY KEY (tenant_id, request_id),
  CHECK ((status = 'PENDING') = (reviewed_by IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_taxguard_rar_status ON public.taxguard_reassignment_requests(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_taxguard_rar_client ON public.taxguard_reassignment_requests(tenant_id, client_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.taxguard_reassignment_request_events (
  tenant_id VARCHAR(128) NOT NULL,
  request_id VARCHAR(40) NOT NULL,
  seq INTEGER NOT NULL CHECK (seq > 0),
  action VARCHAR(32) NOT NULL,
  actor_uid VARCHAR(128) NOT NULL,
  request_key VARCHAR(80) NOT NULL,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, request_id, seq),
  UNIQUE (tenant_id, request_id, request_key),
  FOREIGN KEY (tenant_id, request_id) REFERENCES public.taxguard_reassignment_requests(tenant_id, request_id)
);
ALTER TABLE public.taxguard_reassignment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_reassignment_request_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_reassignment_requests, public.taxguard_reassignment_request_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_rar_append_only() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RAISE EXCEPTION 'REASSIGNMENT_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_rar_events_append_only ON public.taxguard_reassignment_request_events;
CREATE TRIGGER trg_taxguard_rar_events_append_only BEFORE UPDATE OR DELETE ON public.taxguard_reassignment_request_events FOR EACH ROW EXECUTE FUNCTION public.taxguard_rar_append_only();

CREATE OR REPLACE FUNCTION public.taxguard_rar_guard() RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'REASSIGNMENT_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.preferred_specialization IS DISTINCT FROM OLD.preferred_specialization OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.version <> OLD.version + 1 OR OLD.status <> 'PENDING' THEN
    RAISE EXCEPTION 'REASSIGNMENT_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_rar_guard ON public.taxguard_reassignment_requests;
CREATE TRIGGER trg_taxguard_rar_guard BEFORE UPDATE OR DELETE ON public.taxguard_reassignment_requests FOR EACH ROW EXECUTE FUNCTION public.taxguard_rar_guard();

CREATE OR REPLACE FUNCTION public.taxguard_rar_fail(p_code text) RETURNS void LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp AS $$ BEGIN RAISE EXCEPTION '%', p_code USING ERRCODE = 'P0001'; END $$;

CREATE OR REPLACE FUNCTION public.taxguard_rar_json(q public.taxguard_reassignment_requests, p_staff boolean) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('requestId', q.request_id, 'clientId', q.client_id, 'reason', q.reason, 'preferredSpecialization', q.preferred_specialization,
    'status', q.status, 'reviewNote', q.review_note, 'reviewedAt', q.reviewed_at, 'createdAt', q.created_at, 'version', q.version)
  || CASE WHEN p_staff THEN jsonb_build_object('reviewedBy', q.reviewed_by, 'createdBy', q.created_by,
    'currentTeam', (SELECT COALESCE(jsonb_agg(jsonb_build_object('role', a.role, 'userId', a.user_id) ORDER BY a.role, a.user_id), '[]'::jsonb)
      FROM public.taxguard_staff_assignments a WHERE a.tenant_id = q.tenant_id AND a.client_id = q.client_id AND a.status = 'ACTIVE')) ELSE '{}'::jsonb END $$;

CREATE OR REPLACE FUNCTION public.taxguard_rar_event(q public.taxguard_reassignment_requests, p_action text, p_actor text, p_role text, p_key text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_reassignment_request_events(tenant_id, request_id, seq, action, actor_uid, request_key)
  VALUES (q.tenant_id, q.request_id, (SELECT COALESCE(max(seq), 0) + 1 FROM public.taxguard_reassignment_request_events WHERE tenant_id = q.tenant_id AND request_id = q.request_id),
    p_action, p_actor, p_key);
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (q.tenant_id, 'REASSIGNMENT_' || p_action, p_actor, p_role, jsonb_build_object('clientId', q.client_id, 'requestId', q.request_id, 'status', q.status)) $$;

-- Client request: {reason, preferredSpecialization?}
CREATE OR REPLACE FUNCTION public.taxguard_rar_create(p_tenant text, p_client text, p_actor text, p_id text, p_key text, p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_reassignment_requests;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r <> 'client' THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_CLIENT_ONLY'); END IF;
  IF p_id IS NULL OR p_id !~ '^rar_[a-f0-9]{32}$' OR p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,80}$' OR p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    PERFORM public.taxguard_rar_fail('REASSIGNMENT_INPUT_INVALID');
  END IF;
  SELECT * INTO q FROM public.taxguard_reassignment_requests WHERE tenant_id = p_tenant AND request_id = p_id;
  IF FOUND THEN
    IF q.client_id <> p_client OR q.created_by <> p_actor OR q.reason <> btrim(COALESCE(p_input->>'reason', '')) THEN PERFORM public.taxguard_rar_fail('IDEMPOTENCY_KEY_REUSED'); END IF;
    RETURN public.taxguard_rar_json(q, false) || jsonb_build_object('replayed', true);
  END IF;
  BEGIN
    INSERT INTO public.taxguard_reassignment_requests(tenant_id, request_id, client_id, reason, preferred_specialization, created_by)
    VALUES (p_tenant, p_id, p_client, btrim(COALESCE(p_input->>'reason', '')), NULLIF(btrim(COALESCE(p_input->>'preferredSpecialization', '')), ''), p_actor) RETURNING * INTO q;
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_INPUT_INVALID');
  END;
  PERFORM public.taxguard_rar_event(q, 'REQUESTED', p_actor, r, p_key);
  RETURN public.taxguard_rar_json(q, false) || jsonb_build_object('replayed', false);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_rar_list_client(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_rar_json(q, r <> 'client') ORDER BY q.created_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.taxguard_reassignment_requests WHERE tenant_id = p_tenant AND client_id = p_client ORDER BY created_at DESC LIMIT 100) q);
END $$;

-- Review queue for practice leadership.
CREATE OR REPLACE FUNCTION public.taxguard_rar_queue(p_tenant text, p_actor text, p_status text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; lim integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_REVIEWER_REQUIRED'); END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('PENDING','APPROVED','REJECTED') THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_INPUT_INVALID'); END IF;
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_rar_json(q, true) || jsonb_build_object('clientName', c.name) ORDER BY q.created_at DESC), '[]'::jsonb)
    FROM (SELECT * FROM public.taxguard_reassignment_requests WHERE tenant_id = p_tenant AND (p_status IS NULL OR status = p_status) ORDER BY created_at DESC LIMIT lim) q
    LEFT JOIN public.taxguard_clients c ON c.tenant_id = q.tenant_id AND c.client_id = q.client_id);
END $$;

-- Review: decision approve | reject, optional note (<= 2000, shown to the client).
CREATE OR REPLACE FUNCTION public.taxguard_rar_review(p_tenant text, p_actor text, p_request text, p_version integer, p_key text, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; q public.taxguard_reassignment_requests; target text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_REVIEWER_REQUIRED'); END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,80}$' THEN PERFORM public.taxguard_rar_fail('IDEMPOTENCY_KEY_REQUIRED'); END IF;
  SELECT * INTO q FROM public.taxguard_reassignment_requests WHERE tenant_id = p_tenant AND request_id = p_request FOR UPDATE;
  IF NOT FOUND THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_NOT_FOUND'); END IF;
  IF EXISTS (SELECT 1 FROM public.taxguard_reassignment_request_events WHERE tenant_id = p_tenant AND request_id = p_request AND request_key = p_key) THEN
    RETURN public.taxguard_rar_json(q, true) || jsonb_build_object('replayed', true);
  END IF;
  IF q.version <> p_version THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_VERSION_CONFLICT'); END IF;
  IF q.status <> 'PENDING' THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_ALREADY_REVIEWED'); END IF;
  target := CASE p_decision WHEN 'approve' THEN 'APPROVED' WHEN 'reject' THEN 'REJECTED' END;
  IF target IS NULL OR length(COALESCE(p_note, '')) > 2000 THEN PERFORM public.taxguard_rar_fail('REASSIGNMENT_INPUT_INVALID'); END IF;
  UPDATE public.taxguard_reassignment_requests SET status = target, review_note = NULLIF(btrim(COALESCE(p_note, '')), ''), reviewed_by = p_actor, reviewed_at = now(),
    version = version + 1 WHERE tenant_id = p_tenant AND request_id = p_request RETURNING * INTO q;
  PERFORM public.taxguard_rar_event(q, target, p_actor, r, p_key);
  RETURN public.taxguard_rar_json(q, true) || jsonb_build_object('replayed', false);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_rar\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_rar_create','taxguard_rar_list_client','taxguard_rar_queue','taxguard_rar_review') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
