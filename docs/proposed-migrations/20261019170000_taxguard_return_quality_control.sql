-- PROPOSAL (Block 72, independent quality control and final draft readiness). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261018090000 (live case actor), 20261018160000 (diagnostics), 20261019115000 (approval authority),
-- 20261019120000 (return versions), 20261019140000 (verifications), 20261019150000 (return-level diagnostics) and
-- 20261019160000 (return risk assessments).
--
-- Quality control of an APPROVED draft return version by a third person, separate from the Stage 09 draft review:
--   * Assignment: a practice manager assigns one QC reviewer to the version. The QC reviewer is an active staff member
--     and is neither the version's preparer or reviewer, nor the case's assigned preparer or reviewer, nor the manager
--     making the assignment. The live QC assignment is the case-specific authorization that the RETURN_QC_REVIEW policy
--     requires (20261019115000 makes case assignment mandatory for that function).
--   * Authority: recording QC needs the RETURN_QC_REVIEW authority for the template's jurisdiction under the owner's
--     approved policy (eligibility and designation if the policy requires them). No policy: refused (fail closed).
--   * Checklist: the owner's approved QC checklist (versioned, approved by someone other than its author). None is
--     seeded and no RPC writes it: without one, QC is refused (TAX_RETURN_QC_CHECKLIST_REQUIRED). No item is defined here.
--   * Result: one PASS or FAIL per checklist item. All PASS is QC_PASSED; any FAIL is QC_RETURNED and needs a note, for the
--     preparer to prepare a corrected version (the approved version itself never changes). Reviews are immutable, audited.
--   * Final draft readiness (read only): approved, not stale, latest verification after submission VERIFIED, diagnostics
--     run since approval with no open BLOCKING or ERROR finding, a risk assessment of the version newer than both approval
--     and the latest diagnostics run and not BLOCKED, and a QC_PASSED review newer than that assessment and that run, under
--     the current checklist. QC is required for every return until the owner decides otherwise. Readiness is only an input to
--     Stage 10, where a separately authorized professional gives final authorization; nothing here signs, files or
--     transmits a return (returnUse stays BLOCKED).
-- No existing function is superseded by this file.
-- Rollback (development): drop the functions, guards and the three tables.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_qc_checklists (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  checklist_version INTEGER NOT NULL CHECK (checklist_version BETWEEN 1 AND 1000),
  items JSONB NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 100),
  rationale VARCHAR(2000) NOT NULL CHECK (length(btrim(rationale)) >= 20),
  created_by VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, checklist_version),
  CHECK (approved_by <> created_by)
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_qc_assignments (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL DEFAULT gen_random_uuid(),
  return_version_id UUID NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  qc_uid VARCHAR(128) NOT NULL,
  assigned_by VARCHAR(128) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  revoked_by VARCHAR(128),
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(500),
  PRIMARY KEY (tenant_id, assignment_id),
  FOREIGN KEY (tenant_id, return_version_id) REFERENCES public.taxguard_tax_return_versions(tenant_id, return_version_id),
  CHECK (qc_uid <> assigned_by),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL) AND (revoked_at IS NULL) = (revoke_reason IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxguard_tax_return_qc_assignments_live ON public.taxguard_tax_return_qc_assignments(tenant_id, return_version_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_return_qc_assignments_uid ON public.taxguard_tax_return_qc_assignments(tenant_id, qc_uid) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_qc_reviews (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  qc_review_id UUID NOT NULL DEFAULT gen_random_uuid(),
  return_version_id UUID NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  assignment_id UUID NOT NULL,
  forms_sha256 CHAR(64) NOT NULL,
  checklist_version INTEGER NOT NULL,
  results JSONB NOT NULL CHECK (jsonb_typeof(results) = 'array' AND jsonb_array_length(results) >= 1),
  outcome VARCHAR(12) NOT NULL CHECK (outcome IN ('QC_PASSED','QC_RETURNED')),
  note VARCHAR(2000),
  authority_basis JSONB NOT NULL CHECK (jsonb_typeof(authority_basis) = 'object'),
  reviewed_by VARCHAR(128) NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, qc_review_id),
  FOREIGN KEY (tenant_id, return_version_id) REFERENCES public.taxguard_tax_return_versions(tenant_id, return_version_id),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES public.taxguard_tax_return_qc_assignments(tenant_id, assignment_id),
  FOREIGN KEY (tenant_id, checklist_version) REFERENCES public.taxguard_tax_qc_checklists(tenant_id, checklist_version),
  CHECK (outcome = 'QC_PASSED' OR length(btrim(COALESCE(note, ''))) >= 10)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_return_qc_reviews_version ON public.taxguard_tax_return_qc_reviews(tenant_id, return_version_id, reviewed_at DESC);

ALTER TABLE public.taxguard_tax_qc_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_return_qc_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_return_qc_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_qc_checklists, public.taxguard_tax_return_qc_assignments, public.taxguard_tax_return_qc_reviews
  FROM PUBLIC, anon, authenticated, service_role;

-- Checklists and reviews never change; an assignment only gains its revocation, once.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Nested: the assignment columns are referenced only for the assignment table.
  IF TG_TABLE_NAME = 'taxguard_tax_return_qc_assignments' AND TG_OP = 'UPDATE' THEN
    IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
       AND (NEW.tenant_id, NEW.assignment_id, NEW.return_version_id, NEW.case_id, NEW.qc_uid, NEW.assigned_by, NEW.assigned_at)
         IS NOT DISTINCT FROM (OLD.tenant_id, OLD.assignment_id, OLD.return_version_id, OLD.case_id, OLD.qc_uid, OLD.assigned_by, OLD.assigned_at) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'TAX_RETURN_QC_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001';
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_qc_checklists','taxguard_tax_return_qc_assignments','taxguard_tax_return_qc_reviews'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_return_qc_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_return_qc_guard()', t, t);
  END LOOP;
END $$;

-- A checklist is usable only when every item has a code and a text, with distinct codes.
CREATE OR REPLACE FUNCTION public.taxguard_tax_qc_checklist_current(p_tenant text) RETURNS public.taxguard_tax_qc_checklists
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT k.* FROM public.taxguard_tax_qc_checklists k WHERE k.tenant_id = p_tenant
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(k.items) i WHERE jsonb_typeof(i.value) <> 'object'
      OR COALESCE(i.value->>'code', '') !~ '^[A-Z0-9_]{2,40}$' OR length(btrim(COALESCE(i.value->>'text', ''))) NOT BETWEEN 10 AND 500)
    AND (SELECT count(DISTINCT i.value->>'code') FROM jsonb_array_elements(k.items) i) = jsonb_array_length(k.items)
  ORDER BY k.checklist_version DESC LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_live(p_tenant text, p_version uuid) RETURNS public.taxguard_tax_return_qc_assignments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT * FROM public.taxguard_tax_return_qc_assignments WHERE tenant_id = p_tenant AND return_version_id = p_version AND revoked_at IS NULL $$;

-- The version and its case for an actor who may read QC information: an actor of the case, or the live QC assignee.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_scope(p_tenant text, p_actor text, p_version uuid,
  OUT v public.taxguard_tax_return_versions, OUT c public.taxguard_cases, OUT actor_role text, OUT is_qc boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; q public.taxguard_tax_return_qc_assignments;
BEGIN
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  actor_role := public.taxguard_practice_actor(p_tenant, p_actor);
  q := public.taxguard_tax_return_qc_live(p_tenant, p_version);
  is_qc := q.qc_uid IS NOT DISTINCT FROM p_actor;
  IF is_qc THEN
    SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = v.case_id;
    RETURN;
  END IF;
  BEGIN
    SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, v.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  c := a.c;
END $$;

-- A practice manager assigns the QC reviewer of an approved, current version.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_assign(p_tenant text, p_actor text, p_version uuid, p_qc_uid text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; stale jsonb; row_ public.taxguard_tax_return_qc_assignments;
BEGIN
  IF p_qc_uid IS NULL OR p_qc_uid !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'TAX_RETURN_QC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  SELECT * INTO s FROM public.taxguard_tax_return_qc_scope(p_tenant, p_actor, p_version);
  IF s.is_qc OR NOT public.taxguard_practice_is_manager(s.actor_role) THEN RAISE EXCEPTION 'TAX_RETURN_QC_ASSIGNER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF (s.v).status <> 'APPROVED' THEN RAISE EXCEPTION 'TAX_RETURN_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  stale := public.taxguard_tax_return_stale(p_tenant, p_version);
  IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_RETURN_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
  PERFORM 1 FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_qc_uid AND status = 'active'
    AND role NOT IN ('client','prospective_client','recruiter');
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_QC_ASSIGNEE_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p_qc_uid = p_actor OR p_qc_uid IN ((s.v).prepared_by, (s.v).reviewed_by, (s.c).preparer_uid, (s.c).reviewer_uid) THEN
    RAISE EXCEPTION 'TAX_RETURN_QC_NOT_INDEPENDENT' USING ERRCODE = 'P0001';
  END IF;
  IF (public.taxguard_tax_return_qc_live(p_tenant, p_version)).assignment_id IS NOT NULL THEN
    RAISE EXCEPTION 'TAX_RETURN_QC_ALREADY_ASSIGNED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.taxguard_tax_return_qc_assignments(tenant_id, return_version_id, case_id, qc_uid, assigned_by)
    VALUES (p_tenant, p_version, (s.v).case_id, p_qc_uid, p_actor) RETURNING * INTO row_;
  PERFORM public.taxguard_case_audit(p_tenant, (s.c).client_id, (s.c).case_id, p_actor, s.actor_role, 'TAX_RETURN_QC_ASSIGNED',
    jsonb_build_object('assignmentId', row_.assignment_id, 'returnVersionId', p_version, 'qcUid', p_qc_uid));
  RETURN jsonb_build_object('assignmentId', row_.assignment_id, 'returnVersionId', p_version, 'qcUid', row_.qc_uid, 'assignedBy', row_.assigned_by,
    'assignedAt', row_.assigned_at);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_unassign(p_tenant text, p_actor text, p_version uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; q public.taxguard_tax_return_qc_assignments; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_return_qc_scope(p_tenant, p_actor, p_version);
  IF s.is_qc OR NOT public.taxguard_practice_is_manager(s.actor_role) THEN RAISE EXCEPTION 'TAX_RETURN_QC_ASSIGNER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF length(reason) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'TAX_RETURN_QC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_tax_return_qc_assignments SET revoked_by = p_actor, revoked_at = clock_timestamp(), revoke_reason = reason
    WHERE tenant_id = p_tenant AND return_version_id = p_version AND revoked_at IS NULL RETURNING * INTO q;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_QC_NOT_ASSIGNED' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_case_audit(p_tenant, (s.c).client_id, (s.c).case_id, p_actor, s.actor_role, 'TAX_RETURN_QC_UNASSIGNED',
    jsonb_build_object('assignmentId', q.assignment_id, 'returnVersionId', p_version, 'qcUid', q.qc_uid));
  RETURN jsonb_build_object('assignmentId', q.assignment_id, 'returnVersionId', p_version, 'qcUid', q.qc_uid, 'revokedAt', q.revoked_at);
END $$;

-- The versions assigned to the actor for QC, newest assignment first.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_queue(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_practice_actor(p_tenant, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('assignmentId', q.assignment_id, 'returnVersionId', v.return_version_id, 'caseId', v.case_id,
      'taxYear', v.tax_year, 'templateId', v.template_id, 'version', v.version, 'status', v.status, 'assignedAt', q.assigned_at,
      'latestOutcome', (SELECT r.outcome FROM public.taxguard_tax_return_qc_reviews r WHERE r.tenant_id = q.tenant_id AND r.return_version_id = q.return_version_id
        ORDER BY r.reviewed_at DESC, r.qc_review_id LIMIT 1)) ORDER BY q.assigned_at DESC), '[]'::jsonb)
    FROM public.taxguard_tax_return_qc_assignments q
    JOIN public.taxguard_tax_return_versions v ON v.tenant_id = q.tenant_id AND v.return_version_id = q.return_version_id
    WHERE q.tenant_id = p_tenant AND q.qc_uid = p_actor AND q.revoked_at IS NULL);
END $$;

-- What the live QC assignee reviews: the version with its line lineage, the current checklist and the latest
-- verification and risk assessment. A case actor gets the same without needing an assignment.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_context(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; k public.taxguard_tax_qc_checklists; q public.taxguard_tax_return_qc_assignments;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_return_qc_scope(p_tenant, p_actor, p_version);
  k := public.taxguard_tax_qc_checklist_current(p_tenant);
  q := public.taxguard_tax_return_qc_live(p_tenant, p_version);
  RETURN jsonb_build_object('returnVersion', public.taxguard_tax_return_json(p_tenant, p_version, true),
    'assignment', CASE WHEN q.assignment_id IS NULL THEN NULL ELSE jsonb_build_object('assignmentId', q.assignment_id, 'qcUid', q.qc_uid,
      'assignedBy', q.assigned_by, 'assignedAt', q.assigned_at) END,
    'checklist', CASE WHEN k.checklist_version IS NULL THEN NULL ELSE jsonb_build_object('checklistVersion', k.checklist_version, 'items', k.items) END,
    'verification', (SELECT jsonb_build_object('verificationId', r.verification_id, 'result', r.result, 'verifiedAt', r.verified_at)
      FROM public.taxguard_tax_return_verifications r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version
      ORDER BY r.verified_at DESC, r.verification_id LIMIT 1),
    'risk', (SELECT public.taxguard_tax_return_risk_json(r) FROM public.taxguard_tax_return_risk_assessments r
      WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version ORDER BY r.assessed_at DESC, r.assessment_id LIMIT 1),
    'returnUse', 'BLOCKED');
END $$;

-- Records the QC review of the live assignee. p_results = [{code, result: PASS|FAIL, note?}] covering every checklist item once.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_record(p_tenant text, p_actor text, p_version uuid, p_results jsonb, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; q public.taxguard_tax_return_qc_assignments; k public.taxguard_tax_qc_checklists; stale jsonb; auth jsonb; outcome_ text;
  note_ text := NULLIF(btrim(COALESCE(p_note, '')), ''); results_ jsonb; row_ public.taxguard_tax_return_qc_reviews;
BEGIN
  PERFORM 1 FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  SELECT * INTO s FROM public.taxguard_tax_return_qc_scope(p_tenant, p_actor, p_version);
  IF NOT s.is_qc THEN RAISE EXCEPTION 'TAX_RETURN_QC_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  q := public.taxguard_tax_return_qc_live(p_tenant, p_version);
  -- Independence is checked again at decision time: staffing may have changed since the assignment.
  IF p_actor IN ((s.v).prepared_by, (s.v).reviewed_by, (s.c).preparer_uid, (s.c).reviewer_uid, q.assigned_by) THEN
    RAISE EXCEPTION 'TAX_RETURN_QC_NOT_INDEPENDENT' USING ERRCODE = 'P0001';
  END IF;
  IF (s.v).status <> 'APPROVED' THEN RAISE EXCEPTION 'TAX_RETURN_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  stale := public.taxguard_tax_return_stale(p_tenant, p_version);
  IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_RETURN_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
  auth := public.taxguard_tax_approval_authority(p_tenant, p_actor, 'RETURN_QC_REVIEW',
    (SELECT t.jurisdiction_code FROM public.taxguard_tax_return_templates t WHERE t.tenant_id = p_tenant AND t.template_rule_id = (s.v).template_rule_id), true);
  IF NOT (auth->>'authorized')::boolean THEN RAISE EXCEPTION 'TAX_RETURN_QC_AUTHORITY_REQUIRED' USING ERRCODE = 'P0001', DETAIL = auth->>'reason'; END IF;
  k := public.taxguard_tax_qc_checklist_current(p_tenant);
  IF k.checklist_version IS NULL THEN RAISE EXCEPTION 'TAX_RETURN_QC_CHECKLIST_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF jsonb_typeof(p_results) IS DISTINCT FROM 'array' OR jsonb_array_length(p_results) <> jsonb_array_length(k.items)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_results) r WHERE jsonb_typeof(r.value) <> 'object'
       OR COALESCE(r.value->>'result', '') NOT IN ('PASS','FAIL')
       OR (r.value ? 'note' AND (jsonb_typeof(r.value->'note') <> 'string' OR length(r.value->>'note') > 1000))
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(r.value) x WHERE x NOT IN ('code','result','note')))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(k.items) i WHERE (SELECT count(*) FROM jsonb_array_elements(p_results) r
       WHERE r.value->>'code' = i.value->>'code') <> 1)
     OR length(COALESCE(note_, '')) > 2000 THEN
    RAISE EXCEPTION 'TAX_RETURN_QC_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  -- Stored in checklist order, with each item's text as it was reviewed.
  SELECT jsonb_agg(jsonb_build_object('code', i.value->>'code', 'text', i.value->>'text', 'result', r.value->>'result')
      || CASE WHEN NULLIF(btrim(COALESCE(r.value->>'note', '')), '') IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('note', btrim(r.value->>'note')) END
      ORDER BY i.ordinality)
    INTO results_ FROM jsonb_array_elements(k.items) WITH ORDINALITY i JOIN jsonb_array_elements(p_results) r ON r.value->>'code' = i.value->>'code';
  outcome_ := CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(results_) r WHERE r.value->>'result' = 'FAIL') THEN 'QC_RETURNED' ELSE 'QC_PASSED' END;
  IF outcome_ = 'QC_RETURNED' AND length(COALESCE(note_, '')) < 10 THEN RAISE EXCEPTION 'TAX_RETURN_QC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_tax_return_qc_reviews(tenant_id, return_version_id, case_id, assignment_id, forms_sha256, checklist_version, results, outcome,
      note, authority_basis, reviewed_by)
    VALUES (p_tenant, p_version, (s.v).case_id, q.assignment_id, (s.v).forms_sha256, k.checklist_version, results_, outcome_, note_,
      (auth->'basis') || jsonb_build_object('qcUid', p_actor, 'assignmentId', q.assignment_id), p_actor)
    RETURNING * INTO row_;
  PERFORM public.taxguard_case_audit(p_tenant, (s.c).client_id, (s.c).case_id, p_actor, s.actor_role, 'TAX_RETURN_QC_RECORDED',
    jsonb_build_object('qcReviewId', row_.qc_review_id, 'returnVersionId', p_version, 'outcome', outcome_, 'checklistVersion', k.checklist_version,
      'authorityBasis', row_.authority_basis));
  RETURN jsonb_build_object('qcReviewId', row_.qc_review_id, 'returnVersionId', p_version, 'checklistVersion', row_.checklist_version,
    'results', row_.results, 'outcome', row_.outcome, 'note', row_.note, 'reviewedBy', row_.reviewed_by, 'reviewedAt', row_.reviewed_at, 'returnUse', 'BLOCKED');
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_qc_list(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_tax_return_qc_scope(p_tenant, p_actor, p_version);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('qcReviewId', r.qc_review_id, 'checklistVersion', r.checklist_version, 'results', r.results,
      'outcome', r.outcome, 'note', r.note, 'reviewedBy', r.reviewed_by, 'reviewedAt', r.reviewed_at) ORDER BY r.reviewed_at DESC, r.qc_review_id), '[]'::jsonb)
    FROM public.taxguard_tax_return_qc_reviews r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version);
END $$;

-- Final draft readiness of a version: {ready, reasons, ...}; ready only when every input is present and current.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_readiness(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; v public.taxguard_tax_return_versions; reasons text[] := '{}'; ver record; last_run timestamptz; open_ integer;
  risk public.taxguard_tax_return_risk_assessments; qc public.taxguard_tax_return_qc_reviews; k public.taxguard_tax_qc_checklists;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_return_qc_scope(p_tenant, p_actor, p_version);
  v := s.v;
  IF v.status <> 'APPROVED' THEN reasons := reasons || 'NOT_APPROVED'::text; END IF;
  IF jsonb_array_length(public.taxguard_tax_return_stale(p_tenant, p_version)) > 0 THEN reasons := reasons || 'STALE'::text; END IF;
  SELECT r.result INTO ver FROM public.taxguard_tax_return_verifications r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version
    AND v.submitted_at IS NOT NULL AND r.verified_at >= v.submitted_at ORDER BY r.verified_at DESC, r.verification_id LIMIT 1;
  IF ver.result IS DISTINCT FROM 'VERIFIED' THEN reasons := reasons || 'NOT_VERIFIED'::text; END IF;
  SELECT max(run_at) INTO last_run FROM public.taxguard_case_diagnostic_runs WHERE tenant_id = p_tenant AND case_id = v.case_id;
  IF last_run IS NULL OR v.reviewed_at IS NULL OR last_run < v.reviewed_at THEN reasons := reasons || 'DIAGNOSTICS_NOT_CURRENT'::text; END IF;
  SELECT count(*) INTO open_ FROM public.taxguard_case_diagnostics d WHERE d.tenant_id = p_tenant AND d.case_id = v.case_id AND d.status <> 'CLEARED'
    AND d.severity IN ('BLOCKING','ERROR') AND (d.affected_type <> 'RETURN_VERSION' OR d.affected_id = p_version::text);
  IF open_ > 0 THEN reasons := reasons || 'DIAGNOSTICS_OPEN'::text; END IF;
  SELECT * INTO risk FROM public.taxguard_tax_return_risk_assessments r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version
    ORDER BY r.assessed_at DESC, r.assessment_id LIMIT 1;
  IF risk.assessment_id IS NULL OR v.reviewed_at IS NULL OR risk.assessed_at < v.reviewed_at OR last_run IS NULL OR risk.assessed_at < last_run
     OR risk.forms_sha256 <> v.forms_sha256 THEN
    reasons := reasons || 'RISK_NOT_CURRENT'::text;
  ELSIF risk.outcome = 'BLOCKED' THEN reasons := reasons || 'RISK_BLOCKED'::text; END IF;
  k := public.taxguard_tax_qc_checklist_current(p_tenant);
  SELECT * INTO qc FROM public.taxguard_tax_return_qc_reviews r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version
    ORDER BY r.reviewed_at DESC, r.qc_review_id LIMIT 1;
  IF qc.qc_review_id IS NULL THEN reasons := reasons || 'QC_NOT_RECORDED'::text;
  ELSIF qc.outcome <> 'QC_PASSED' THEN reasons := reasons || 'QC_RETURNED'::text;
  ELSIF risk.assessment_id IS NULL OR qc.reviewed_at < risk.assessed_at OR last_run IS NULL OR qc.reviewed_at < last_run
     OR qc.checklist_version IS DISTINCT FROM k.checklist_version
     OR qc.forms_sha256 <> v.forms_sha256 THEN reasons := reasons || 'QC_NOT_CURRENT'::text; END IF;
  RETURN jsonb_build_object('returnVersionId', p_version, 'ready', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons),
    'riskAssessmentId', risk.assessment_id, 'qcReviewId', qc.qc_review_id, 'stage10', 'FINAL_AUTHORIZATION_REQUIRED', 'returnUse', 'BLOCKED');
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_return_qc_guard','taxguard_tax_qc_checklist_current','taxguard_tax_return_qc_live',
        'taxguard_tax_return_qc_scope','taxguard_tax_return_qc_assign','taxguard_tax_return_qc_unassign','taxguard_tax_return_qc_queue',
        'taxguard_tax_return_qc_context','taxguard_tax_return_qc_record','taxguard_tax_return_qc_list','taxguard_tax_return_final_readiness') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_return_qc_assign','taxguard_tax_return_qc_unassign','taxguard_tax_return_qc_queue','taxguard_tax_return_qc_context',
        'taxguard_tax_return_qc_record','taxguard_tax_return_qc_list','taxguard_tax_return_final_readiness') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
