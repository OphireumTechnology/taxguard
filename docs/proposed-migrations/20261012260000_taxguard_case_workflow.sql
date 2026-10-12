-- PROPOSAL 026 ONLY. NOT APPLIED. Requires the actual core schema and proposals 024 (ledger)
-- and 025 (practice management).
-- Durable case creation and the canonical LEGACY_18_V1 workflow on the EXISTING tables
-- taxguard_cases, taxguard_case_assignments and taxguard_stage_states, plus an append-only
-- stage-event history. Stage identities are unchanged (01 Onboard ... 18 Repeat).
--
-- Stage evidence policy (single place; owner confirmation required, see decision register):
--   SYSTEM_VERIFIED (computed here from durable data, never supplied by the caller)
--     01 Onboard   client active, engagement active, tax year active, independent preparer and reviewer assigned
--     04 Record    >= 1 posted ledger entry in the tax year, no prepared entry awaiting review, ledger balanced
--     05 Reconcile >= 1 closed reconciliation, none in progress, every bank transaction of the year posted
--   HUMAN_ATTESTED (the case reviewer, never the preparer, confirms every checklist item)
--     02 Collect, 03 Validate, 06 Review (also requires no prepared ledger entry), 07 Report, 08 Plan
--   BLOCKED (no transition: required systems are not verified or not authorized)
--     09 Prepare Taxes (verified tax engine, H07) and every later stage: 10 Approve, 11 Sign (E04),
--     12 File (filing not authorized), 13-18.
-- Transitions are sequential (no skipping), versioned, refused while the case is on hold, and
-- recorded in taxguard_case_stage_events. Reviewers (or managers) may return a case to an
-- earlier stage with a reason. AI actors cannot call these functions (service role only and
-- the actor must be an active human member).
--
-- Rollback (development): drop taxguard_case_* functions, taxguard_case_stage_events, the
-- added columns and indexes.

ALTER TABLE public.taxguard_cases ADD COLUMN IF NOT EXISTS return_family VARCHAR(8);
ALTER TABLE public.taxguard_cases ADD COLUMN IF NOT EXISTS hold_reason VARCHAR(500);
DO $$ BEGIN
  ALTER TABLE public.taxguard_cases ADD CONSTRAINT chk_taxguard_case_return_family
    CHECK (return_family IS NULL OR return_family IN ('1040','1041','1065','1120','1120S','990','706','709'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.taxguard_cases ADD CONSTRAINT chk_taxguard_case_status CHECK (status IN ('ACTIVE','ON_HOLD','CLOSED','CANCELLED')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.taxguard_cases ADD CONSTRAINT uq_taxguard_case_id UNIQUE (tenant_id, case_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_taxguard_cases_queue ON public.taxguard_cases(tenant_id, status, active_stage);
CREATE INDEX IF NOT EXISTS idx_taxguard_stage_states_case ON public.taxguard_stage_states(tenant_id, case_id, stage_number);
ALTER TABLE public.taxguard_engagement_notes ADD COLUMN IF NOT EXISTS case_id VARCHAR(128);

CREATE TABLE IF NOT EXISTS public.taxguard_case_stage_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL, case_id VARCHAR(128) NOT NULL,
  action VARCHAR(16) NOT NULL CHECK (action IN ('CREATED','ADVANCED','RETURNED','HELD','RESUMED')),
  from_stage SMALLINT CHECK (from_stage BETWEEN 1 AND 18), to_stage SMALLINT NOT NULL CHECK (to_stage BETWEEN 1 AND 18),
  evidence_type VARCHAR(16) CHECK (evidence_type IN ('SYSTEM_VERIFIED','HUMAN_ATTESTED')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason VARCHAR(500),
  actor_uid VARCHAR(128) NOT NULL, actor_role VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, case_id) REFERENCES public.taxguard_cases(tenant_id, case_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_taxguard_case_stage_events ON public.taxguard_case_stage_events(tenant_id, case_id, created_at);
ALTER TABLE public.taxguard_case_stage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_case_stage_events FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.taxguard_case_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CASE_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_case_stage_events_append_only ON public.taxguard_case_stage_events;
CREATE TRIGGER trg_taxguard_case_stage_events_append_only BEFORE UPDATE OR DELETE ON public.taxguard_case_stage_events
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_case_events_append_only();

-- ------------------------------------------------------------------------------------------
-- Stage policy (internal)
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_case_stage_policy(p_stage integer) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_stage IN (1, 4, 5) THEN jsonb_build_object('evidence', 'SYSTEM_VERIFIED')
    WHEN p_stage = 2 THEN jsonb_build_object('evidence', 'HUMAN_ATTESTED', 'checklist', jsonb_build_array('documents_received_or_waived', 'documents_in_private_storage'))
    WHEN p_stage = 3 THEN jsonb_build_object('evidence', 'HUMAN_ATTESTED', 'checklist', jsonb_build_array('documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved'))
    WHEN p_stage = 6 THEN jsonb_build_object('evidence', 'HUMAN_ATTESTED', 'checklist', jsonb_build_array('workpapers_reviewed', 'no_unresolved_blocking_exceptions'))
    WHEN p_stage = 7 THEN jsonb_build_object('evidence', 'HUMAN_ATTESTED', 'checklist', jsonb_build_array('reports_reviewed_for_release'))
    WHEN p_stage = 8 THEN jsonb_build_object('evidence', 'HUMAN_ATTESTED', 'checklist', jsonb_build_array('planning_considerations_documented'))
    WHEN p_stage = 9 THEN jsonb_build_object('evidence', 'BLOCKED', 'dependency', 'VERIFIED_TAX_ENGINE_REQUIRED')
    WHEN p_stage = 11 THEN jsonb_build_object('evidence', 'BLOCKED', 'dependency', 'E_SIGNATURE_INTEGRATION_REQUIRED')
    WHEN p_stage = 12 THEN jsonb_build_object('evidence', 'BLOCKED', 'dependency', 'FILING_NOT_AUTHORIZED')
    ELSE jsonb_build_object('evidence', 'BLOCKED', 'dependency', 'UPSTREAM_STAGES_BLOCKED') END $$;

CREATE OR REPLACE FUNCTION public.taxguard_case_actor(p_tenant text, p_case text, p_actor text, OUT actor_role text, OUT c public.taxguard_cases)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  actor_role := public.taxguard_practice_actor(p_tenant, p_actor);
  IF p_case IS NULL OR p_case !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case;
  IF NOT FOUND OR NOT (public.taxguard_practice_is_manager(actor_role) OR c.preparer_uid = p_actor OR c.reviewer_uid = p_actor) THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_case_audit(p_tenant text, p_client text, p_case text, p_actor text, p_role text, p_action text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, case_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_case, p_action, p_actor, p_role, jsonb_build_object('clientId', p_client) || COALESCE(p_meta, '{}'::jsonb)) $$;

-- System checks for stages 1, 4 and 5, computed from durable records.
CREATE OR REPLACE FUNCTION public.taxguard_case_system_checks(p_case public.taxguard_cases) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; y_start date := make_date(p_case.tax_year, 1, 1); y_end date := make_date(p_case.tax_year, 12, 31);
  posted integer; prepared integer; debits bigint; credits bigint; closed integer; open_recons integer; unposted integer;
BEGIN
  IF c.active_stage = 1 THEN
    RETURN jsonb_build_object(
      'clientActive', EXISTS (SELECT 1 FROM public.taxguard_clients WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND status = 'active'),
      'engagementActive', EXISTS (SELECT 1 FROM public.taxguard_engagements WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id AND status = 'active'),
      'taxYearActive', EXISTS (SELECT 1 FROM public.taxguard_tax_years WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id AND tax_year = c.tax_year AND status = 'active'),
      'preparerAssigned', EXISTS (SELECT 1 FROM public.taxguard_staff_assignments WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
        AND tax_year = c.tax_year AND role = 'preparer' AND user_id = c.preparer_uid AND status = 'ACTIVE'),
      'reviewerAssigned', EXISTS (SELECT 1 FROM public.taxguard_staff_assignments WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND engagement_id = c.engagement_id
        AND tax_year = c.tax_year AND role = 'reviewer' AND user_id = c.reviewer_uid AND status = 'ACTIVE'),
      'independentReviewer', c.preparer_uid <> c.reviewer_uid);
  END IF;
  SELECT count(*) FILTER (WHERE status = 'POSTED'), count(*) FILTER (WHERE status = 'PREPARED') INTO posted, prepared
    FROM public.taxguard_ledger_entries WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND posting_date BETWEEN y_start AND y_end;
  SELECT COALESCE(sum(l.debit_cents), 0), COALESCE(sum(l.credit_cents), 0) INTO debits, credits FROM public.taxguard_ledger_lines l
    JOIN public.taxguard_ledger_entries e ON e.tenant_id = l.tenant_id AND e.client_id = l.client_id AND e.entry_id = l.entry_id
    WHERE l.tenant_id = c.tenant_id AND l.client_id = c.client_id AND e.status = 'POSTED' AND e.posting_date BETWEEN y_start AND y_end;
  IF c.active_stage = 4 THEN
    RETURN jsonb_build_object('postedEntries', posted > 0, 'noEntriesAwaitingReview', prepared = 0, 'ledgerBalanced', debits = credits);
  END IF;
  SELECT count(*) FILTER (WHERE status = 'CLOSED'), count(*) FILTER (WHERE status = 'IN_PROGRESS') INTO closed, open_recons
    FROM public.taxguard_ledger_reconciliations WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND tax_year = c.tax_year;
  SELECT count(*) INTO unposted FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = c.tenant_id AND client_id = c.client_id
    AND transaction_date BETWEEN y_start AND y_end AND journal_entry_id IS NULL;
  RETURN jsonb_build_object('closedReconciliation', closed > 0, 'noReconciliationInProgress', open_recons = 0, 'allBankTransactionsPosted', unposted = 0,
    'noEntriesAwaitingReview', prepared = 0);
END $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs
-- ------------------------------------------------------------------------------------------
-- Creates the case for an engagement year from its ACTIVE preparer and reviewer assignments.
-- Managers or the assigned preparer may create it. One case per (client, engagement, year).
CREATE OR REPLACE FUNCTION public.taxguard_case_create(p_tenant text, p_client text, p_actor text, p_engagement text, p_year integer, p_case text, p_family text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; prep text; rev text; owner_uid text; existing record; s integer;
BEGIN
  r := public.taxguard_practice_client_access(p_tenant, p_client, p_actor, false);
  IF p_case IS NULL OR p_case !~ '^[A-Za-z0-9_-]{8,128}$' OR p_year IS NULL OR p_family NOT IN ('1040','1041','1065','1120','1120S','990','706','709') THEN
    RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO existing FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND tax_year = p_year;
  IF FOUND THEN
    IF existing.case_id = p_case THEN RETURN jsonb_build_object('caseId', p_case, 'created', false); END IF;
    RAISE EXCEPTION 'CASE_ALREADY_EXISTS' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_ACTIVE' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_tax_years WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement AND tax_year = p_year AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_YEAR_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT user_id INTO prep FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement
    AND tax_year = p_year AND role = 'preparer' AND status = 'ACTIVE' FOR SHARE;
  SELECT user_id INTO rev FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement
    AND tax_year = p_year AND role = 'reviewer' AND status = 'ACTIVE' FOR SHARE;
  IF prep IS NULL OR rev IS NULL THEN RAISE EXCEPTION 'CASE_TEAM_INCOMPLETE' USING ERRCODE = 'P0001'; END IF;
  IF prep = rev THEN RAISE EXCEPTION 'ASSIGNMENT_SEGREGATION_OF_DUTIES' USING ERRCODE = 'P0001'; END IF;
  IF NOT public.taxguard_practice_is_manager(r) AND p_actor <> prep THEN RAISE EXCEPTION 'CASE_CREATE_NOT_AUTHORIZED' USING ERRCODE = 'P0001'; END IF;
  SELECT c.owner_uid INTO owner_uid FROM public.taxguard_clients c WHERE c.tenant_id = p_tenant AND c.client_id = p_client;
  BEGIN
    INSERT INTO public.taxguard_cases(case_id, tenant_id, client_id, engagement_id, tax_year, status, active_stage, client_uid, preparer_uid, reviewer_uid, return_family, created_by, updated_by)
      VALUES (p_case, p_tenant, p_client, p_engagement, p_year, 'ACTIVE', 1, owner_uid, prep, rev, p_family, p_actor, p_actor);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'CASE_ALREADY_EXISTS' USING ERRCODE = 'P0001';
  END;
  INSERT INTO public.taxguard_case_assignments(case_id, tenant_id, uid, role, assigned_by) VALUES (p_case, p_tenant, prep, 'preparer', p_actor), (p_case, p_tenant, rev, 'reviewer', p_actor);
  FOR s IN 1..18 LOOP
    INSERT INTO public.taxguard_stage_states(case_id, tenant_id, stage_number, status) VALUES (p_case, p_tenant, s, CASE WHEN s = 1 THEN 'IN_PROGRESS' ELSE 'LOCKED' END);
  END LOOP;
  INSERT INTO public.taxguard_case_stage_events(tenant_id, case_id, action, to_stage, actor_uid, actor_role) VALUES (p_tenant, p_case, 'CREATED', 1, p_actor, r);
  PERFORM public.taxguard_case_audit(p_tenant, p_client, p_case, p_actor, r, 'CASE_CREATED', jsonb_build_object('engagementId', p_engagement, 'taxYear', p_year, 'returnFamily', p_family));
  RETURN jsonb_build_object('caseId', p_case, 'created', true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_case_advance(p_tenant text, p_case text, p_actor text, p_from_stage integer, p_version integer, p_attestation jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; policy jsonb; checks jsonb; failed jsonb; item text; evidence_type text;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case FOR UPDATE;
  IF p_version IS NULL OR c.version <> p_version THEN RAISE EXCEPTION 'CASE_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF c.status <> 'ACTIVE' THEN RAISE EXCEPTION 'CASE_NOT_ACTIVE' USING ERRCODE = 'P0001'; END IF;
  IF p_from_stage IS NULL OR p_from_stage <> c.active_stage THEN RAISE EXCEPTION 'STAGE_SEQUENCE_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF c.active_stage >= 18 THEN RAISE EXCEPTION 'STAGE_SEQUENCE_INVALID' USING ERRCODE = 'P0001'; END IF;
  policy := public.taxguard_case_stage_policy(c.active_stage);
  evidence_type := policy->>'evidence';
  IF evidence_type = 'BLOCKED' THEN RAISE EXCEPTION 'STAGE_BLOCKED_%', policy->>'dependency' USING ERRCODE = 'P0001'; END IF;
  IF evidence_type = 'SYSTEM_VERIFIED' THEN
    IF NOT (a.actor_role IN ('admin','administrator','super_admin','super_administrator','practice_manager') OR p_actor IN (c.preparer_uid, c.reviewer_uid)) THEN
      RAISE EXCEPTION 'STAGE_ACTION_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
    END IF;
    checks := public.taxguard_case_system_checks(c);
  ELSE
    -- Attestations are professional judgments: only the case's independent reviewer may give them.
    IF p_actor <> c.reviewer_uid OR p_actor = c.preparer_uid THEN RAISE EXCEPTION 'STAGE_ATTESTATION_REQUIRES_REVIEWER' USING ERRCODE = 'P0001'; END IF;
    IF p_attestation IS NULL OR jsonb_typeof(p_attestation) <> 'object' OR jsonb_typeof(p_attestation->'confirmed') <> 'array'
       OR length(btrim(COALESCE(p_attestation->>'statement', ''))) NOT BETWEEN 10 AND 1000 THEN
      RAISE EXCEPTION 'STAGE_ATTESTATION_INCOMPLETE' USING ERRCODE = 'P0001';
    END IF;
    checks := '{}'::jsonb;
    FOR item IN SELECT value FROM jsonb_array_elements_text(policy->'checklist') LOOP
      checks := checks || jsonb_build_object(item, (p_attestation->'confirmed') ? item);
    END LOOP;
    IF c.active_stage = 6 THEN
      checks := checks || jsonb_build_object('noEntriesAwaitingReview', NOT EXISTS (SELECT 1 FROM public.taxguard_ledger_entries WHERE tenant_id = c.tenant_id
        AND client_id = c.client_id AND status = 'PREPARED' AND posting_date BETWEEN make_date(c.tax_year, 1, 1) AND make_date(c.tax_year, 12, 31)));
    END IF;
  END IF;
  SELECT COALESCE(jsonb_agg(key), '[]'::jsonb) INTO failed FROM jsonb_each(checks) WHERE value <> 'true'::jsonb;
  IF jsonb_array_length(failed) > 0 THEN
    RAISE EXCEPTION 'STAGE_GATE_NOT_MET' USING ERRCODE = 'P0001', DETAIL = failed::text;
  END IF;
  UPDATE public.taxguard_stage_states SET status = 'COMPLETED', approved_by = p_actor, approved_at = now(), updated_at = now(), version = version + 1,
      gate_evidence = jsonb_build_object('type', evidence_type, 'checks', checks, 'statement', p_attestation->>'statement')
    WHERE tenant_id = p_tenant AND case_id = p_case AND stage_number = c.active_stage;
  UPDATE public.taxguard_stage_states SET status = 'IN_PROGRESS', updated_at = now(), version = version + 1
    WHERE tenant_id = p_tenant AND case_id = p_case AND stage_number = c.active_stage + 1;
  UPDATE public.taxguard_cases SET active_stage = active_stage + 1, version = version + 1, updated_at = now(), updated_by = p_actor WHERE tenant_id = p_tenant AND case_id = p_case;
  INSERT INTO public.taxguard_case_stage_events(tenant_id, case_id, action, from_stage, to_stage, evidence_type, evidence, actor_uid, actor_role)
    VALUES (p_tenant, p_case, 'ADVANCED', c.active_stage, c.active_stage + 1, evidence_type, jsonb_build_object('checks', checks, 'statement', p_attestation->>'statement'), p_actor, a.actor_role);
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, p_case, p_actor, a.actor_role, 'CASE_STAGE_ADVANCED',
    jsonb_build_object('fromStage', c.active_stage, 'toStage', c.active_stage + 1, 'evidenceType', evidence_type));
  RETURN jsonb_build_object('caseId', p_case, 'activeStage', c.active_stage + 1, 'version', c.version + 1, 'evidenceType', evidence_type);
END $$;

-- Rejection path: the reviewer or a manager returns the case to an earlier stage; stages from
-- the target onward reopen (target IN_PROGRESS, later ones LOCKED). The preparer cannot.
CREATE OR REPLACE FUNCTION public.taxguard_case_return(p_tenant text, p_case text, p_actor text, p_to_stage integer, p_version integer, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; reason text;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case FOR UPDATE;
  IF p_version IS NULL OR c.version <> p_version THEN RAISE EXCEPTION 'CASE_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF c.status NOT IN ('ACTIVE','ON_HOLD') THEN RAISE EXCEPTION 'CASE_NOT_ACTIVE' USING ERRCODE = 'P0001'; END IF;
  IF NOT (p_actor = c.reviewer_uid OR public.taxguard_practice_is_manager(a.actor_role)) OR p_actor = c.preparer_uid THEN
    RAISE EXCEPTION 'STAGE_RETURN_REQUIRES_REVIEWER' USING ERRCODE = 'P0001';
  END IF;
  IF p_to_stage IS NULL OR p_to_stage < 1 OR p_to_stage >= c.active_stage THEN RAISE EXCEPTION 'STAGE_SEQUENCE_INVALID' USING ERRCODE = 'P0001'; END IF;
  reason := public.taxguard_practice_text(p_reason, 10, 500, 'RETURN_REASON_REQUIRED');
  UPDATE public.taxguard_stage_states SET status = CASE WHEN stage_number = p_to_stage THEN 'IN_PROGRESS' ELSE 'LOCKED' END,
      approved_by = NULL, approved_at = NULL, updated_at = now(), version = version + 1
    WHERE tenant_id = p_tenant AND case_id = p_case AND stage_number BETWEEN p_to_stage AND c.active_stage;
  UPDATE public.taxguard_cases SET active_stage = p_to_stage, version = version + 1, updated_at = now(), updated_by = p_actor WHERE tenant_id = p_tenant AND case_id = p_case;
  INSERT INTO public.taxguard_case_stage_events(tenant_id, case_id, action, from_stage, to_stage, reason, actor_uid, actor_role)
    VALUES (p_tenant, p_case, 'RETURNED', c.active_stage, p_to_stage, reason, p_actor, a.actor_role);
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, p_case, p_actor, a.actor_role, 'CASE_STAGE_RETURNED', jsonb_build_object('fromStage', c.active_stage, 'toStage', p_to_stage));
  RETURN jsonb_build_object('caseId', p_case, 'activeStage', p_to_stage, 'version', c.version + 1);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_case_set_hold(p_tenant text, p_case text, p_actor text, p_hold boolean, p_version integer, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; reason text;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case FOR UPDATE;
  IF p_version IS NULL OR c.version <> p_version THEN RAISE EXCEPTION 'CASE_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF p_hold IS NULL OR (p_hold AND c.status <> 'ACTIVE') OR (NOT p_hold AND c.status <> 'ON_HOLD') THEN RAISE EXCEPTION 'CASE_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  reason := public.taxguard_practice_text(p_reason, 5, 500, 'STATUS_REASON_REQUIRED');
  UPDATE public.taxguard_cases SET status = CASE WHEN p_hold THEN 'ON_HOLD' ELSE 'ACTIVE' END, hold_reason = CASE WHEN p_hold THEN reason END,
      version = version + 1, updated_at = now(), updated_by = p_actor WHERE tenant_id = p_tenant AND case_id = p_case;
  INSERT INTO public.taxguard_case_stage_events(tenant_id, case_id, action, from_stage, to_stage, reason, actor_uid, actor_role)
    VALUES (p_tenant, p_case, CASE WHEN p_hold THEN 'HELD' ELSE 'RESUMED' END, c.active_stage, c.active_stage, reason, p_actor, a.actor_role);
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, p_case, p_actor, a.actor_role, CASE WHEN p_hold THEN 'CASE_HELD' ELSE 'CASE_RESUMED' END, '{}'::jsonb);
  RETURN jsonb_build_object('caseId', p_case, 'status', CASE WHEN p_hold THEN 'ON_HOLD' ELSE 'ACTIVE' END, 'version', c.version + 1);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_case_detail(p_tenant text, p_case text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  c := a.c;
  RETURN jsonb_build_object(
    'case', jsonb_build_object('caseId', c.case_id, 'clientId', c.client_id, 'engagementId', c.engagement_id, 'taxYear', c.tax_year, 'returnFamily', c.return_family,
      'status', c.status, 'holdReason', c.hold_reason, 'activeStage', c.active_stage, 'preparerUid', c.preparer_uid, 'reviewerUid', c.reviewer_uid, 'version', c.version,
      'createdAt', c.created_at, 'updatedAt', c.updated_at),
    'stagePolicy', public.taxguard_case_stage_policy(c.active_stage),
    'pendingChecks', CASE WHEN public.taxguard_case_stage_policy(c.active_stage)->>'evidence' = 'SYSTEM_VERIFIED' THEN public.taxguard_case_system_checks(c) END,
    'stages', (SELECT jsonb_agg(jsonb_build_object('stage', s.stage_number, 'status', s.status, 'approvedBy', s.approved_by, 'approvedAt', s.approved_at,
        'evidenceType', s.gate_evidence->>'type') ORDER BY s.stage_number) FROM public.taxguard_stage_states s WHERE s.tenant_id = c.tenant_id AND s.case_id = c.case_id),
    'events', (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', e.action, 'fromStage', e.from_stage, 'toStage', e.to_stage, 'evidenceType', e.evidence_type,
        'evidence', e.evidence, 'reason', e.reason, 'actorUid', e.actor_uid, 'actorRole', e.actor_role, 'at', e.created_at) ORDER BY e.created_at, e.event_id), '[]'::jsonb)
      FROM public.taxguard_case_stage_events e WHERE e.tenant_id = c.tenant_id AND e.case_id = c.case_id),
    'tasks', (SELECT COALESCE(jsonb_agg(jsonb_build_object('taskId', t.id, 'title', t.title, 'status', t.status, 'assignedUserId', t.assigned_user_id, 'dueDate', t.due_date,
        'dependencies', t.dependencies, 'version', t.version) ORDER BY t.due_date NULLS LAST, t.id), '[]'::jsonb)
      FROM public.taxguard_practice_tasks t WHERE t.tenant_id = c.tenant_id AND t.client_id = c.client_id AND t.case_id = c.case_id),
    'deadlines', (SELECT COALESCE(jsonb_agg(jsonb_build_object('deadlineId', d.id, 'title', d.title, 'category', d.category, 'dueDate', d.due_date, 'status', d.status,
        'authorityType', d.authority_type) ORDER BY d.due_date), '[]'::jsonb)
      FROM public.taxguard_deadlines d WHERE d.tenant_id = c.tenant_id AND d.client_id = c.client_id AND d.case_id = c.case_id),
    'notes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('noteId', n.note_id, 'body', n.body, 'authorUid', n.author_uid, 'createdAt', n.created_at) ORDER BY n.created_at DESC), '[]'::jsonb)
      FROM public.taxguard_engagement_notes n WHERE n.tenant_id = c.tenant_id AND n.client_id = c.client_id AND n.case_id = c.case_id));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_case_add_note(p_tenant text, p_case text, p_actor text, p_body text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; id uuid;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  INSERT INTO public.taxguard_engagement_notes(tenant_id, client_id, engagement_id, case_id, body, author_uid, author_role)
    VALUES (p_tenant, (a.c).client_id, (a.c).engagement_id, p_case, public.taxguard_practice_text(p_body, 1, 4000, 'NOTE_INVALID'), p_actor, a.actor_role) RETURNING note_id INTO id;
  PERFORM public.taxguard_case_audit(p_tenant, (a.c).client_id, p_case, p_actor, a.actor_role, 'CASE_NOTE_ADDED', jsonb_build_object('noteId', id));
  RETURN jsonb_build_object('noteId', id);
END $$;

-- Work queue: managers see every case; preparers and reviewers see their cases. Filters:
-- role (preparer | reviewer), stage, status, taxYear; keyset pagination by case_id.
CREATE OR REPLACE FUNCTION public.taxguard_case_queue(p_tenant text, p_actor text, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; f jsonb := COALESCE(p_filter, '{}'::jsonb); lim integer; manager boolean;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  manager := public.taxguard_practice_is_manager(r);
  lim := COALESCE((f->>'limit')::integer, 50);
  IF lim NOT BETWEEN 1 AND 200 OR (f->>'role' IS NOT NULL AND f->>'role' NOT IN ('preparer','reviewer')) THEN RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(row_data ORDER BY cid COLLATE "C"), '[]'::jsonb) FROM (
    SELECT c.case_id AS cid, jsonb_build_object('caseId', c.case_id, 'clientId', c.client_id, 'clientName', cl.name, 'engagementId', c.engagement_id, 'taxYear', c.tax_year,
      'returnFamily', c.return_family, 'status', c.status, 'activeStage', c.active_stage, 'preparerUid', c.preparer_uid, 'reviewerUid', c.reviewer_uid, 'version', c.version,
      'myRole', CASE WHEN c.preparer_uid = p_actor THEN 'preparer' WHEN c.reviewer_uid = p_actor THEN 'reviewer' ELSE 'manager' END,
      'awaitingReviewer', public.taxguard_case_stage_policy(c.active_stage)->>'evidence' = 'HUMAN_ATTESTED',
      'blockedDependency', public.taxguard_case_stage_policy(c.active_stage)->>'dependency',
      'nextDeadline', (SELECT min(d.due_date) FROM public.taxguard_deadlines d WHERE d.tenant_id = c.tenant_id AND d.case_id = c.case_id AND d.status = 'PENDING'),
      'openTasks', (SELECT count(*) FROM public.taxguard_practice_tasks t WHERE t.tenant_id = c.tenant_id AND t.case_id = c.case_id AND t.status NOT IN ('COMPLETED','CANCELLED'))) AS row_data
    FROM public.taxguard_cases c JOIN public.taxguard_clients cl ON cl.tenant_id = c.tenant_id AND cl.client_id = c.client_id
    WHERE c.tenant_id = p_tenant AND (manager OR c.preparer_uid = p_actor OR c.reviewer_uid = p_actor)
      AND (f->>'role' IS NULL OR (f->>'role' = 'preparer' AND c.preparer_uid = p_actor) OR (f->>'role' = 'reviewer' AND c.reviewer_uid = p_actor))
      AND (f->>'stage' IS NULL OR c.active_stage = (f->>'stage')::integer) AND (f->>'status' IS NULL OR c.status = f->>'status')
      AND (f->>'taxYear' IS NULL OR c.tax_year = (f->>'taxYear')::integer) AND (f->>'after' IS NULL OR c.case_id COLLATE "C" > (f->>'after') COLLATE "C")
    ORDER BY c.case_id COLLATE "C" LIMIT lim) q);
EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION 'CASE_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_case_status_report(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; manager boolean;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  manager := public.taxguard_practice_is_manager(r);
  RETURN jsonb_build_object(
    'byStage', (SELECT COALESCE(jsonb_object_agg(active_stage::text, n), '{}'::jsonb) FROM (SELECT active_stage, count(*) n FROM public.taxguard_cases
      WHERE tenant_id = p_tenant AND status IN ('ACTIVE','ON_HOLD') AND (manager OR preparer_uid = p_actor OR reviewer_uid = p_actor) GROUP BY active_stage) s),
    'byStatus', (SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb) FROM (SELECT status, count(*) n FROM public.taxguard_cases
      WHERE tenant_id = p_tenant AND (manager OR preparer_uid = p_actor OR reviewer_uid = p_actor) GROUP BY status) s));
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_case\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_case_create','taxguard_case_advance','taxguard_case_return','taxguard_case_set_hold','taxguard_case_detail',
        'taxguard_case_add_note','taxguard_case_queue','taxguard_case_status_report') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
