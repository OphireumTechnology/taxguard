-- PROPOSAL (Block 73, Stage 10 final authorization of a draft return version). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261012340000 (privileged session proof), 20261018090000 (live case actor), 20261019115000 (approval authority),
-- 20261019120000 (return versions), 20261019140000 (verifications), 20261019160000 (risk assessments) and
-- 20261019170000 (quality control and final draft readiness).
--
-- Stage 10 is a protected professional decision, made only by a person:
--   * Authority: the new function RETURN_FINAL_AUTHORIZATION. Its policy must require verified eligibility, a designation
--     and the case-specific assignment. None is seeded: without the owner's policy every authorization is refused.
--   * Assignment: a practice manager assigns one final authorizer to an approved, current version. The authorizer is an
--     active staff member, independent of the version's preparer and reviewer, the case's preparer and reviewer, the live QC
--     assignee, every QC reviewer of record for the version, the manager who assigned QC and the manager making this
--     assignment. Independence is checked again at decision time.
--   * Session: the authorizer's live AAL2 session with a recent sign-in (taxguard_privileged_session), in the same transaction.
--   * Readiness: the Block 72 final draft readiness, recomputed in the same transaction, must report no reasons.
--   * Attestation: the owner's approved attestation text (versioned, approved by someone other than its author). None is
--     seeded and no RPC writes it. The caller must send the version it displayed; a newer version refuses the decision.
--   * Decision: AUTHORIZED or DECLINED (a note is required to decline), with an explicit acknowledgement. Decisions are
--     immutable and audited and pin the readiness inputs they were made on. A decision is current only while those inputs,
--     the forms SHA-256 and the attestation version are unchanged (derived, never stored).
-- Nothing here signs, files, transmits or takes payment: returnUse stays BLOCKED, and an authorized version only reports
-- stage11 CLIENT_SIGNATURE_REQUIRED.
-- Supersedes taxguard_tax_return_final_readiness from 20261019170000 (same checks, moved into
-- taxguard_tax_return_readiness_eval; the assigned final authorizer may also read it; reports the Stage 10 decision).
-- Changes the function-code CHECK of taxguard_tax_approval_policies by a new constraint; 20261019115000 is not edited.
-- Rollback (development): drop the functions, guards and the three tables, then restore the original function-code CHECK.

ALTER TABLE public.taxguard_tax_approval_policies DROP CONSTRAINT IF EXISTS taxguard_tax_approval_policies_function_code_check;
ALTER TABLE public.taxguard_tax_approval_policies DROP CONSTRAINT IF EXISTS taxguard_tax_approval_policies_function_code_v2;
ALTER TABLE public.taxguard_tax_approval_policies ADD CONSTRAINT taxguard_tax_approval_policies_function_code_v2
  CHECK (function_code IN ('RETURN_TEMPLATE_APPROVAL','FORM_RULE_APPROVAL','RETURN_DRAFT_REVIEW','RETURN_QC_REVIEW','RETURN_FINAL_AUTHORIZATION'));
-- Final authorization is a professional act on a specific case: eligibility, designation and the assignment are all required.
ALTER TABLE public.taxguard_tax_approval_policies DROP CONSTRAINT IF EXISTS taxguard_tax_approval_policies_final_authorization;
ALTER TABLE public.taxguard_tax_approval_policies ADD CONSTRAINT taxguard_tax_approval_policies_final_authorization
  CHECK (function_code <> 'RETURN_FINAL_AUTHORIZATION' OR (requires_eligibility AND requires_designation AND requires_case_assignment));

CREATE TABLE IF NOT EXISTS public.taxguard_tax_final_attestations (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  attestation_version INTEGER NOT NULL CHECK (attestation_version BETWEEN 1 AND 1000),
  attestation_text VARCHAR(4000) NOT NULL CHECK (length(btrim(attestation_text)) >= 40),
  rationale VARCHAR(2000) NOT NULL CHECK (length(btrim(rationale)) >= 20),
  created_by VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, attestation_version),
  CHECK (approved_by <> created_by)
);

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_final_assignments (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL DEFAULT gen_random_uuid(),
  return_version_id UUID NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  authorizer_uid VARCHAR(128) NOT NULL,
  assigned_by VARCHAR(128) NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  revoked_by VARCHAR(128),
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(500),
  PRIMARY KEY (tenant_id, assignment_id),
  FOREIGN KEY (tenant_id, return_version_id) REFERENCES public.taxguard_tax_return_versions(tenant_id, return_version_id),
  CHECK (authorizer_uid <> assigned_by),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL) AND (revoked_at IS NULL) = (revoke_reason IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taxguard_tax_return_final_assignments_live ON public.taxguard_tax_return_final_assignments(tenant_id, return_version_id)
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_return_final_assignments_uid ON public.taxguard_tax_return_final_assignments(tenant_id, authorizer_uid)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_final_authorizations (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  authorization_id UUID NOT NULL DEFAULT gen_random_uuid(),
  return_version_id UUID NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  assignment_id UUID NOT NULL,
  forms_sha256 CHAR(64) NOT NULL,
  attestation_version INTEGER NOT NULL,
  verification_id UUID NOT NULL,
  diagnostics_run_at TIMESTAMPTZ NOT NULL,
  risk_assessment_id UUID NOT NULL,
  qc_review_id UUID NOT NULL,
  outcome VARCHAR(12) NOT NULL CHECK (outcome IN ('AUTHORIZED','DECLINED')),
  note VARCHAR(2000),
  authority_basis JSONB NOT NULL CHECK (jsonb_typeof(authority_basis) = 'object'),
  session_auth_time BIGINT NOT NULL,
  decided_by VARCHAR(128) NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, authorization_id),
  FOREIGN KEY (tenant_id, return_version_id) REFERENCES public.taxguard_tax_return_versions(tenant_id, return_version_id),
  FOREIGN KEY (tenant_id, assignment_id) REFERENCES public.taxguard_tax_return_final_assignments(tenant_id, assignment_id),
  FOREIGN KEY (tenant_id, attestation_version) REFERENCES public.taxguard_tax_final_attestations(tenant_id, attestation_version),
  FOREIGN KEY (tenant_id, qc_review_id) REFERENCES public.taxguard_tax_return_qc_reviews(tenant_id, qc_review_id),
  CHECK (outcome = 'AUTHORIZED' OR length(btrim(COALESCE(note, ''))) >= 10)
);
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_return_final_authorizations_version ON public.taxguard_tax_return_final_authorizations(tenant_id, return_version_id, decided_at DESC);

ALTER TABLE public.taxguard_tax_final_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_return_final_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_tax_return_final_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_final_attestations, public.taxguard_tax_return_final_assignments, public.taxguard_tax_return_final_authorizations
  FROM PUBLIC, anon, authenticated, service_role;

-- Attestations and decisions never change; an assignment only gains its revocation, once.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Nested: the assignment columns are referenced only for the assignment table.
  IF TG_TABLE_NAME = 'taxguard_tax_return_final_assignments' AND TG_OP = 'UPDATE' THEN
    IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
       AND (NEW.tenant_id, NEW.assignment_id, NEW.return_version_id, NEW.case_id, NEW.authorizer_uid, NEW.assigned_by, NEW.assigned_at)
         IS NOT DISTINCT FROM (OLD.tenant_id, OLD.assignment_id, OLD.return_version_id, OLD.case_id, OLD.authorizer_uid, OLD.assigned_by, OLD.assigned_at) THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'TAX_RETURN_FINAL_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001';
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_final_attestations','taxguard_tax_return_final_assignments','taxguard_tax_return_final_authorizations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_guard ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_guard BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_return_final_guard()', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_truncate ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_return_final_guard()', t, t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_final_attestation_current(p_tenant text) RETURNS public.taxguard_tax_final_attestations
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT a.* FROM public.taxguard_tax_final_attestations a WHERE a.tenant_id = p_tenant ORDER BY a.attestation_version DESC LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_live(p_tenant text, p_version uuid) RETURNS public.taxguard_tax_return_final_assignments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT * FROM public.taxguard_tax_return_final_assignments WHERE tenant_id = p_tenant AND return_version_id = p_version AND revoked_at IS NULL $$;

-- Everyone who has taken part in the version and so may not give its final authorization.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_excluded(p_tenant text, p_version uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT array_remove(ARRAY[v.prepared_by, v.reviewed_by, c.preparer_uid, c.reviewer_uid]
      || COALESCE((SELECT array_agg(x) FROM (
           SELECT q.qc_uid AS x FROM public.taxguard_tax_return_qc_assignments q WHERE q.tenant_id = p_tenant AND q.return_version_id = p_version AND q.revoked_at IS NULL
           UNION SELECT q.assigned_by FROM public.taxguard_tax_return_qc_assignments q WHERE q.tenant_id = p_tenant AND q.return_version_id = p_version AND q.revoked_at IS NULL
           UNION SELECT r.reviewed_by FROM public.taxguard_tax_return_qc_reviews r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version) u), '{}'), NULL)
  FROM public.taxguard_tax_return_versions v JOIN public.taxguard_cases c ON c.tenant_id = v.tenant_id AND c.case_id = v.case_id
  WHERE v.tenant_id = p_tenant AND v.return_version_id = p_version $$;

-- The version and its case for an actor who may read Stage 10 information: an actor of the case, the live QC assignee or
-- the live final authorizer.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_scope(p_tenant text, p_actor text, p_version uuid,
  OUT v public.taxguard_tax_return_versions, OUT c public.taxguard_cases, OUT actor_role text, OUT is_authorizer boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record;
BEGIN
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  is_authorizer := (public.taxguard_tax_return_final_live(p_tenant, p_version)).authorizer_uid IS NOT DISTINCT FROM p_actor;
  IF is_authorizer THEN
    actor_role := public.taxguard_practice_actor(p_tenant, p_actor);
    SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = v.case_id;
    RETURN;
  END IF;
  SELECT * INTO s FROM public.taxguard_tax_return_qc_scope(p_tenant, p_actor, p_version);
  c := s.c; actor_role := s.actor_role;
END $$;

-- Final draft readiness of a version without an actor check (the Block 72 rules, unchanged), with the inputs it read.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_readiness_eval(p_tenant text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v public.taxguard_tax_return_versions; reasons text[] := '{}'; ver record; last_run timestamptz; open_ integer;
  risk public.taxguard_tax_return_risk_assessments; qc public.taxguard_tax_return_qc_reviews; k public.taxguard_tax_qc_checklists;
BEGIN
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF v.status <> 'APPROVED' THEN reasons := reasons || 'NOT_APPROVED'::text; END IF;
  IF jsonb_array_length(public.taxguard_tax_return_stale(p_tenant, p_version)) > 0 THEN reasons := reasons || 'STALE'::text; END IF;
  SELECT r.verification_id, r.result INTO ver FROM public.taxguard_tax_return_verifications r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version
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
    'formsSha256', v.forms_sha256, 'verificationId', ver.verification_id, 'diagnosticsRunAt', last_run,
    'riskAssessmentId', risk.assessment_id, 'qcReviewId', qc.qc_review_id);
END $$;

-- The latest Stage 10 decision on a version and whether it is still current: {decision, current, reasons}.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_status(p_tenant text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE d public.taxguard_tax_return_final_authorizations; e jsonb; a public.taxguard_tax_final_attestations; reasons text[] := '{}';
BEGIN
  SELECT * INTO d FROM public.taxguard_tax_return_final_authorizations r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version
    ORDER BY r.decided_at DESC, r.authorization_id LIMIT 1;
  IF d.authorization_id IS NULL THEN RETURN jsonb_build_object('decision', NULL, 'current', false, 'reasons', '[]'::jsonb); END IF;
  e := public.taxguard_tax_return_readiness_eval(p_tenant, p_version);
  a := public.taxguard_tax_final_attestation_current(p_tenant);
  IF NOT (e->>'ready')::boolean THEN reasons := reasons || 'NOT_READY'::text; END IF;
  IF e->>'formsSha256' IS DISTINCT FROM d.forms_sha256 THEN reasons := reasons || 'FORMS_CHANGED'::text; END IF;
  IF e->>'verificationId' IS DISTINCT FROM d.verification_id::text THEN reasons := reasons || 'VERIFICATION_CHANGED'::text; END IF;
  IF (e->>'diagnosticsRunAt')::timestamptz IS DISTINCT FROM d.diagnostics_run_at THEN reasons := reasons || 'DIAGNOSTICS_RERUN'::text; END IF;
  IF e->>'riskAssessmentId' IS DISTINCT FROM d.risk_assessment_id::text THEN reasons := reasons || 'RISK_REASSESSED'::text; END IF;
  IF e->>'qcReviewId' IS DISTINCT FROM d.qc_review_id::text THEN reasons := reasons || 'QC_REVIEWED_AGAIN'::text; END IF;
  IF a.attestation_version IS DISTINCT FROM d.attestation_version THEN reasons := reasons || 'ATTESTATION_CHANGED'::text; END IF;
  RETURN jsonb_build_object('decision', jsonb_build_object('authorizationId', d.authorization_id, 'outcome', d.outcome, 'note', d.note,
      'attestationVersion', d.attestation_version, 'decidedBy', d.decided_by, 'decidedAt', d.decided_at),
    'current', cardinality(reasons) = 0, 'reasons', to_jsonb(reasons));
END $$;

-- Supersedes 20261019170000: the same readiness, readable also by the live final authorizer, with the Stage 10 decision.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_readiness(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE e jsonb; st jsonb; authorized boolean;
BEGIN
  PERFORM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  e := public.taxguard_tax_return_readiness_eval(p_tenant, p_version);
  st := public.taxguard_tax_return_final_status(p_tenant, p_version);
  authorized := (st->>'current')::boolean AND st->'decision'->>'outcome' = 'AUTHORIZED';
  RETURN jsonb_build_object('returnVersionId', p_version, 'ready', e->'ready', 'reasons', e->'reasons',
    'riskAssessmentId', e->'riskAssessmentId', 'qcReviewId', e->'qcReviewId', 'finalAuthorization', st,
    'stage10', CASE WHEN authorized THEN 'AUTHORIZED' ELSE 'FINAL_AUTHORIZATION_REQUIRED' END,
    'stage11', CASE WHEN authorized THEN 'CLIENT_SIGNATURE_REQUIRED' ELSE 'NOT_STARTED' END, 'returnUse', 'BLOCKED');
END $$;

-- A practice manager assigns the final authorizer of an approved, current version.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_assign(p_tenant text, p_actor text, p_version uuid, p_authorizer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; stale jsonb; row_ public.taxguard_tax_return_final_assignments;
BEGIN
  IF p_authorizer IS NULL OR p_authorizer !~ '^[A-Za-z0-9_-]{1,128}$' THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  SELECT * INTO s FROM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  IF s.is_authorizer OR NOT public.taxguard_practice_is_manager(s.actor_role) THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_ASSIGNER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF (s.v).status <> 'APPROVED' THEN RAISE EXCEPTION 'TAX_RETURN_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  stale := public.taxguard_tax_return_stale(p_tenant, p_version);
  IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_RETURN_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
  PERFORM 1 FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_authorizer AND status = 'active'
    AND role NOT IN ('client','prospective_client','recruiter');
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_ASSIGNEE_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p_authorizer = p_actor OR p_authorizer = ANY (public.taxguard_tax_return_final_excluded(p_tenant, p_version)) THEN
    RAISE EXCEPTION 'TAX_RETURN_FINAL_NOT_INDEPENDENT' USING ERRCODE = 'P0001';
  END IF;
  IF (public.taxguard_tax_return_final_live(p_tenant, p_version)).assignment_id IS NOT NULL THEN
    RAISE EXCEPTION 'TAX_RETURN_FINAL_ALREADY_ASSIGNED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.taxguard_tax_return_final_assignments(tenant_id, return_version_id, case_id, authorizer_uid, assigned_by)
    VALUES (p_tenant, p_version, (s.v).case_id, p_authorizer, p_actor) RETURNING * INTO row_;
  PERFORM public.taxguard_case_audit(p_tenant, (s.c).client_id, (s.c).case_id, p_actor, s.actor_role, 'TAX_RETURN_FINAL_AUTHORIZER_ASSIGNED',
    jsonb_build_object('assignmentId', row_.assignment_id, 'returnVersionId', p_version, 'authorizerUid', p_authorizer));
  RETURN jsonb_build_object('assignmentId', row_.assignment_id, 'returnVersionId', p_version, 'authorizerUid', row_.authorizer_uid,
    'assignedBy', row_.assigned_by, 'assignedAt', row_.assigned_at);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_unassign(p_tenant text, p_actor text, p_version uuid, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; q public.taxguard_tax_return_final_assignments; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  IF s.is_authorizer OR NOT public.taxguard_practice_is_manager(s.actor_role) THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_ASSIGNER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF length(reason) NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_tax_return_final_assignments SET revoked_by = p_actor, revoked_at = clock_timestamp(), revoke_reason = reason
    WHERE tenant_id = p_tenant AND return_version_id = p_version AND revoked_at IS NULL RETURNING * INTO q;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_NOT_ASSIGNED' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_case_audit(p_tenant, (s.c).client_id, (s.c).case_id, p_actor, s.actor_role, 'TAX_RETURN_FINAL_AUTHORIZER_UNASSIGNED',
    jsonb_build_object('assignmentId', q.assignment_id, 'returnVersionId', p_version, 'authorizerUid', q.authorizer_uid));
  RETURN jsonb_build_object('assignmentId', q.assignment_id, 'returnVersionId', p_version, 'authorizerUid', q.authorizer_uid, 'revokedAt', q.revoked_at);
END $$;

-- The versions assigned to the actor for final authorization, newest assignment first.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_queue(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_practice_actor(p_tenant, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('assignmentId', q.assignment_id, 'returnVersionId', v.return_version_id, 'caseId', v.case_id,
      'taxYear', v.tax_year, 'templateId', v.template_id, 'version', v.version, 'status', v.status, 'assignedAt', q.assigned_at,
      'latestOutcome', (SELECT r.outcome FROM public.taxguard_tax_return_final_authorizations r WHERE r.tenant_id = q.tenant_id AND r.return_version_id = q.return_version_id
        ORDER BY r.decided_at DESC, r.authorization_id LIMIT 1)) ORDER BY q.assigned_at DESC), '[]'::jsonb)
    FROM public.taxguard_tax_return_final_assignments q
    JOIN public.taxguard_tax_return_versions v ON v.tenant_id = q.tenant_id AND v.return_version_id = q.return_version_id
    WHERE q.tenant_id = p_tenant AND q.authorizer_uid = p_actor AND q.revoked_at IS NULL);
END $$;

-- What the authorizer reviews before deciding: the version with its lineage, readiness, the current attestation text and the
-- latest decision.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_context(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a public.taxguard_tax_final_attestations; q public.taxguard_tax_return_final_assignments;
BEGIN
  PERFORM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  a := public.taxguard_tax_final_attestation_current(p_tenant);
  q := public.taxguard_tax_return_final_live(p_tenant, p_version);
  RETURN jsonb_build_object('returnVersion', public.taxguard_tax_return_json(p_tenant, p_version, true),
    'readiness', public.taxguard_tax_return_final_readiness(p_tenant, p_actor, p_version),
    'assignment', CASE WHEN q.assignment_id IS NULL THEN NULL ELSE jsonb_build_object('assignmentId', q.assignment_id, 'authorizerUid', q.authorizer_uid,
      'assignedBy', q.assigned_by, 'assignedAt', q.assigned_at) END,
    'attestation', CASE WHEN a.attestation_version IS NULL THEN NULL ELSE jsonb_build_object('attestationVersion', a.attestation_version,
      'text', a.attestation_text) END,
    'returnUse', 'BLOCKED');
END $$;

-- The live final authorizer's decision. p_input = {outcome: AUTHORIZED|DECLINED, attestationVersion, acknowledged: true, note?}.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_authorize(p_tenant text, p_actor text, p_session_hash text, p_version uuid, p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE sess jsonb; s record; q public.taxguard_tax_return_final_assignments; e jsonb; auth jsonb; a public.taxguard_tax_final_attestations;
  st jsonb; outcome_ text; note_ text; row_ public.taxguard_tax_return_final_authorizations;
BEGIN
  PERFORM 1 FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  BEGIN
    sess := public.taxguard_privileged_session(p_tenant, p_actor, p_session_hash,
      ARRAY['accountant','reviewer','senior_reviewer','bookkeeper','practice_manager','operations','admin']);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'STAFF_ADMIN_REQUIRED' THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_SESSION_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  SELECT * INTO s FROM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  IF NOT s.is_authorizer THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_AUTHORIZER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  q := public.taxguard_tax_return_final_live(p_tenant, p_version);
  -- Independence is checked again at decision time: staffing and QC may have changed since the assignment.
  IF p_actor = q.assigned_by OR p_actor = ANY (public.taxguard_tax_return_final_excluded(p_tenant, p_version)) THEN
    RAISE EXCEPTION 'TAX_RETURN_FINAL_NOT_INDEPENDENT' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_input) x WHERE x NOT IN ('outcome','attestationVersion','acknowledged','note'))
     OR COALESCE(p_input->>'outcome', '') NOT IN ('AUTHORIZED','DECLINED')
     OR p_input->'acknowledged' IS DISTINCT FROM 'true'::jsonb
     OR jsonb_typeof(p_input->'attestationVersion') IS DISTINCT FROM 'number' OR COALESCE(p_input->>'attestationVersion', '') !~ '^[0-9]{1,4}$'
     OR (p_input ? 'note' AND (jsonb_typeof(p_input->'note') <> 'string' OR length(p_input->>'note') > 2000)) THEN
    RAISE EXCEPTION 'TAX_RETURN_FINAL_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  outcome_ := p_input->>'outcome';
  note_ := NULLIF(btrim(COALESCE(p_input->>'note', '')), '');
  IF outcome_ = 'DECLINED' AND length(COALESCE(note_, '')) < 10 THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  e := public.taxguard_tax_return_readiness_eval(p_tenant, p_version);
  IF NOT (e->>'ready')::boolean THEN RAISE EXCEPTION 'TAX_RETURN_NOT_READY' USING ERRCODE = 'P0001', DETAIL = (e->'reasons')::text; END IF;
  auth := public.taxguard_tax_approval_authority(p_tenant, p_actor, 'RETURN_FINAL_AUTHORIZATION',
    (SELECT t.jurisdiction_code FROM public.taxguard_tax_return_templates t WHERE t.tenant_id = p_tenant AND t.template_rule_id = (s.v).template_rule_id), true);
  IF NOT (auth->>'authorized')::boolean THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_AUTHORITY_REQUIRED' USING ERRCODE = 'P0001', DETAIL = auth->>'reason'; END IF;
  a := public.taxguard_tax_final_attestation_current(p_tenant);
  IF a.attestation_version IS NULL THEN RAISE EXCEPTION 'TAX_RETURN_ATTESTATION_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF a.attestation_version <> (p_input->>'attestationVersion')::integer THEN RAISE EXCEPTION 'TAX_RETURN_ATTESTATION_CHANGED' USING ERRCODE = 'P0001'; END IF;
  -- One decision per set of inputs: a new decision needs a changed input (for example a new QC review).
  st := public.taxguard_tax_return_final_status(p_tenant, p_version);
  IF (st->>'current')::boolean THEN RAISE EXCEPTION 'TAX_RETURN_FINAL_ALREADY_DECIDED' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_tax_return_final_authorizations(tenant_id, return_version_id, case_id, assignment_id, forms_sha256, attestation_version,
      verification_id, diagnostics_run_at, risk_assessment_id, qc_review_id, outcome, note, authority_basis, session_auth_time, decided_by)
    VALUES (p_tenant, p_version, (s.v).case_id, q.assignment_id, (s.v).forms_sha256, a.attestation_version, (e->>'verificationId')::uuid,
      (e->>'diagnosticsRunAt')::timestamptz, (e->>'riskAssessmentId')::uuid, (e->>'qcReviewId')::uuid, outcome_, note_,
      (auth->'basis') || jsonb_build_object('authorizerUid', p_actor, 'assignmentId', q.assignment_id), (sess->>'authTime')::bigint, p_actor)
    RETURNING * INTO row_;
  PERFORM public.taxguard_case_audit(p_tenant, (s.c).client_id, (s.c).case_id, p_actor, s.actor_role,
    CASE WHEN outcome_ = 'AUTHORIZED' THEN 'TAX_RETURN_FINAL_AUTHORIZED' ELSE 'TAX_RETURN_FINAL_DECLINED' END,
    jsonb_build_object('authorizationId', row_.authorization_id, 'returnVersionId', p_version, 'attestationVersion', a.attestation_version,
      'qcReviewId', row_.qc_review_id, 'riskAssessmentId', row_.risk_assessment_id, 'authorityBasis', row_.authority_basis));
  RETURN jsonb_build_object('authorizationId', row_.authorization_id, 'returnVersionId', p_version, 'outcome', row_.outcome, 'note', row_.note,
    'attestationVersion', row_.attestation_version, 'decidedBy', row_.decided_by, 'decidedAt', row_.decided_at,
    'stage10', CASE WHEN outcome_ = 'AUTHORIZED' THEN 'AUTHORIZED' ELSE 'FINAL_AUTHORIZATION_REQUIRED' END,
    'stage11', CASE WHEN outcome_ = 'AUTHORIZED' THEN 'CLIENT_SIGNATURE_REQUIRED' ELSE 'NOT_STARTED' END, 'returnUse', 'BLOCKED');
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_final_list(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('authorizationId', r.authorization_id, 'outcome', r.outcome, 'note', r.note,
      'attestationVersion', r.attestation_version, 'qcReviewId', r.qc_review_id, 'riskAssessmentId', r.risk_assessment_id,
      'decidedBy', r.decided_by, 'decidedAt', r.decided_at) ORDER BY r.decided_at DESC, r.authorization_id), '[]'::jsonb)
    FROM public.taxguard_tax_return_final_authorizations r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_return_final_guard','taxguard_tax_final_attestation_current','taxguard_tax_return_final_live',
        'taxguard_tax_return_final_excluded','taxguard_tax_return_final_scope','taxguard_tax_return_readiness_eval','taxguard_tax_return_final_status',
        'taxguard_tax_return_final_readiness','taxguard_tax_return_final_assign','taxguard_tax_return_final_unassign','taxguard_tax_return_final_queue',
        'taxguard_tax_return_final_context','taxguard_tax_return_final_authorize','taxguard_tax_return_final_list') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_return_final_readiness','taxguard_tax_return_final_assign','taxguard_tax_return_final_unassign',
        'taxguard_tax_return_final_queue','taxguard_tax_return_final_context','taxguard_tax_return_final_authorize','taxguard_tax_return_final_list') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
