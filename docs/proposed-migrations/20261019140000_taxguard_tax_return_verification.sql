-- PROPOSAL (Block 69, independent calculation verification of a draft return). REVIEW ONLY; NOT APPLIED anywhere.
-- Requires 033 (calculation runs, rule sets), 20261018090000 (live case actor), 20261019110000 (form mapping) and
-- 20261019120000 (return versions).
--
-- Before a draft return version is approved at Stage 09, the case's independent reviewer (never its preparer) has the
-- server re-execute every calculation run that a value of the version relies on, with the same deterministic engine
-- and the run's pinned rule set, after the server re-checks the rule-set hash. The database then records the result
-- and itself checks: the recomputed output hash equals the recorded one (RECALCULATION_MISMATCH), the engine version
-- is unchanged (ENGINE_VERSION_CHANGED), the run's rule set is still the approved version (RULE_SET_NOT_CURRENT) with
-- the hash the run was pinned to (RULE_SET_INTEGRITY), and every mapped value equals the sum of the source values it
-- cites (VALUE_SOURCE_MISMATCH). No findings: VERIFIED; otherwise DISCREPANCY with the findings. Nothing is corrected
-- or recalculated into the return. Verifications are immutable and audited; approval needs the latest one recorded
-- after submission to be VERIFIED. Nothing here is a Stage 10 authorization.
-- Current definition after this file: taxguard_tax_return_transition (previously 20261019120000).
-- Rollback (development): restore taxguard_tax_return_transition from 20261019120000, drop the functions and table.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_verifications (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  verification_id UUID NOT NULL DEFAULT gen_random_uuid(),
  return_version_id UUID NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  forms_sha256 CHAR(64) NOT NULL,
  result VARCHAR(12) NOT NULL CHECK (result IN ('VERIFIED','DISCREPANCY')),
  runs JSONB NOT NULL CHECK (jsonb_typeof(runs) = 'array' AND jsonb_array_length(runs) >= 1),
  findings JSONB NOT NULL CHECK (jsonb_typeof(findings) = 'array'),
  engine_version VARCHAR(40) NOT NULL,
  verified_by VARCHAR(128) NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, verification_id),
  FOREIGN KEY (tenant_id, return_version_id) REFERENCES public.taxguard_tax_return_versions(tenant_id, return_version_id),
  CHECK ((result = 'VERIFIED') = (jsonb_array_length(findings) = 0))
);
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_return_verifications_version ON public.taxguard_tax_return_verifications(tenant_id, return_version_id, verified_at DESC);

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_verification_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TAX_RETURN_VERIFICATION_IMMUTABLE' USING ERRCODE = 'P0001';
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_return_verifications_guard ON public.taxguard_tax_return_verifications;
CREATE TRIGGER trg_taxguard_tax_return_verifications_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_return_verifications
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_return_verification_guard();
DROP TRIGGER IF EXISTS trg_taxguard_tax_return_verifications_no_truncate ON public.taxguard_tax_return_verifications;
CREATE TRIGGER trg_taxguard_tax_return_verifications_no_truncate BEFORE TRUNCATE ON public.taxguard_tax_return_verifications
  FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_return_verification_guard();
ALTER TABLE public.taxguard_tax_return_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_return_verifications FROM PUBLIC, anon, authenticated, service_role;

-- The calculation runs a return version relies on: every run cited by a value of its form mappings.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_verification_runs(p_tenant text, p_version uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(DISTINCT jsonb_build_object('runId', r.run_id, 'ruleSetId', r.rule_set_id, 'ruleSetSha256', r.rule_set_sha256,
      'engineVersion', r.engine_version, 'outputSha256', r.output_sha256, 'filingStatus', r.filing_status, 'inputs', r.inputs)), '[]'::jsonb)
  FROM public.taxguard_tax_return_versions v, jsonb_array_elements(v.forms) f, public.taxguard_tax_form_values fv, jsonb_array_elements(fv.sources) s,
    public.taxguard_tax_calc_runs r
  WHERE v.tenant_id = p_tenant AND v.return_version_id = p_version AND fv.tenant_id = v.tenant_id AND fv.mapping_id = (f.value->>'mappingId')::uuid
    AND r.tenant_id = v.tenant_id AND r.case_id = v.case_id AND r.run_id = (s.value->>'runId')::uuid $$;

-- What the server needs to re-execute the runs of a version, for the case's live reviewer only.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_verification_inputs(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v public.taxguard_tax_return_versions; a record; c public.taxguard_cases;
BEGIN
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, v.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  c := a.c;
  IF p_actor IS DISTINCT FROM c.reviewer_uid OR p_actor = v.prepared_by
     OR NOT public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) THEN
    RAISE EXCEPTION 'TAX_RETURN_VERIFIER_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('returnVersionId', v.return_version_id, 'formsSha256', v.forms_sha256, 'runs', public.taxguard_tax_return_verification_runs(p_tenant, p_version));
END $$;

-- Records a verification from the server's re-execution: p_runs = [{runId, recomputedOutputSha256}] covering exactly the
-- version's runs. The checks and the result are the database's own; only the recomputed hashes come from the engine.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_verify(p_tenant text, p_actor text, p_version uuid, p_runs jsonb, p_engine_version text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v public.taxguard_tax_return_versions; a record; expected jsonb; e jsonb; offered text; rs public.taxguard_tax_rule_sets;
  findings jsonb := '[]'::jsonb; stale jsonb; id uuid := gen_random_uuid(); result_ text; runs_out jsonb := '[]'::jsonb; bad record;
BEGIN
  IF jsonb_typeof(p_runs) IS DISTINCT FROM 'array' OR COALESCE(p_engine_version, '') !~ '^[A-Za-z0-9_.-]{1,40}$' THEN
    RAISE EXCEPTION 'TAX_RETURN_VERIFICATION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_tax_return_verification_inputs(p_tenant, p_actor, p_version);
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, v.case_id, p_actor);
  IF v.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'TAX_RETURN_NOT_SUBMITTED' USING ERRCODE = 'P0001'; END IF;
  stale := public.taxguard_tax_return_stale(p_tenant, p_version);
  IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_RETURN_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
  expected := public.taxguard_tax_return_verification_runs(p_tenant, p_version);
  IF jsonb_array_length(expected) = 0
     OR (SELECT count(*) FROM jsonb_array_elements(p_runs)) <> jsonb_array_length(expected)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(expected) x WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_runs) y
          WHERE y.value->>'runId' = x.value->>'runId' AND COALESCE(y.value->>'recomputedOutputSha256', '') ~ '^[a-f0-9]{64}$')) THEN
    RAISE EXCEPTION 'TAX_RETURN_VERIFICATION_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(expected) ORDER BY value->>'runId' LOOP
    SELECT y.value->>'recomputedOutputSha256' INTO offered FROM jsonb_array_elements(p_runs) y WHERE y.value->>'runId' = e->>'runId';
    SELECT * INTO rs FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = (e->>'ruleSetId')::uuid;
    IF offered <> e->>'outputSha256' THEN findings := findings || jsonb_build_object('runId', e->>'runId', 'reason', 'RECALCULATION_MISMATCH'); END IF;
    IF p_engine_version <> e->>'engineVersion' THEN findings := findings || jsonb_build_object('runId', e->>'runId', 'reason', 'ENGINE_VERSION_CHANGED'); END IF;
    IF rs.status IS DISTINCT FROM 'APPROVED' THEN findings := findings || jsonb_build_object('runId', e->>'runId', 'reason', 'RULE_SET_NOT_CURRENT'); END IF;
    IF rs.content_sha256 IS DISTINCT FROM e->>'ruleSetSha256' THEN findings := findings || jsonb_build_object('runId', e->>'runId', 'reason', 'RULE_SET_INTEGRITY'); END IF;
    runs_out := runs_out || jsonb_build_object('runId', e->>'runId', 'ruleSetId', e->>'ruleSetId', 'ruleSetSha256', e->>'ruleSetSha256',
      'recordedOutputSha256', e->>'outputSha256', 'recomputedOutputSha256', offered);
  END LOOP;
  FOR bad IN SELECT f.value->>'formId' AS form_id, fv.line, fv.field FROM jsonb_array_elements(v.forms) f, public.taxguard_tax_form_values fv
      WHERE fv.tenant_id = v.tenant_id AND fv.mapping_id = (f.value->>'mappingId')::uuid
        AND fv.value <> (SELECT COALESCE(sum((s.value->>'value')::numeric), 0) FROM jsonb_array_elements(fv.sources) s)
      ORDER BY 1, 2, 3 LOOP
    findings := findings || jsonb_build_object('formId', bad.form_id, 'line', bad.line, 'field', bad.field, 'reason', 'VALUE_SOURCE_MISMATCH');
  END LOOP;
  result_ := CASE WHEN jsonb_array_length(findings) = 0 THEN 'VERIFIED' ELSE 'DISCREPANCY' END;
  INSERT INTO public.taxguard_tax_return_verifications(tenant_id, verification_id, return_version_id, case_id, forms_sha256, result, runs, findings, engine_version, verified_by)
    VALUES (p_tenant, id, v.return_version_id, v.case_id, v.forms_sha256, result_, runs_out, findings, p_engine_version, p_actor);
  PERFORM public.taxguard_case_audit(p_tenant, v.client_id, v.case_id, p_actor, a.actor_role, 'TAX_RETURN_VERIFIED',
    jsonb_build_object('verificationId', id, 'returnVersionId', v.return_version_id, 'result', result_, 'runs', jsonb_array_length(runs_out),
      'findings', jsonb_array_length(findings), 'engineVersion', p_engine_version));
  RETURN (SELECT jsonb_build_object('verificationId', x.verification_id, 'returnVersionId', x.return_version_id, 'result', x.result, 'runs', x.runs,
    'findings', x.findings, 'engineVersion', x.engine_version, 'verifiedBy', x.verified_by, 'verifiedAt', x.verified_at)
    FROM public.taxguard_tax_return_verifications x WHERE x.tenant_id = p_tenant AND x.verification_id = id);
END $$;

-- The verifications of a version, newest first, for an actor of its case.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_verification_list(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v public.taxguard_tax_return_versions;
BEGIN
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    PERFORM public.taxguard_case_actor(p_tenant, v.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('verificationId', x.verification_id, 'result', x.result, 'runs', x.runs, 'findings', x.findings,
      'engineVersion', x.engine_version, 'verifiedBy', x.verified_by, 'verifiedAt', x.verified_at) ORDER BY x.verified_at DESC, x.verification_id), '[]'::jsonb)
    FROM public.taxguard_tax_return_verifications x WHERE x.tenant_id = p_tenant AND x.return_version_id = p_version);
END $$;

-- submit (the case's preparer), approve / return (the case's live reviewer, never the preparer). Approving also needs
-- the RETURN_DRAFT_REVIEW authority (owner-approved policy; eligibility and designation if the policy requires them)
-- for the return's jurisdiction, and records its basis. A stale version can be neither submitted nor approved;
-- returning needs a note. This is the Stage 09 draft review, never the Stage 10 final authorization.
-- As 20261019120000, plus (Block 69): approving needs the version's latest calculation verification, recorded after
-- submission, to be VERIFIED (TAX_RETURN_VERIFICATION_REQUIRED, DETAIL NONE or DISCREPANCY).
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_transition(p_tenant text, p_actor text, p_version uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; v public.taxguard_tax_return_versions; stale jsonb; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  auth jsonb; basis jsonb; ver public.taxguard_tax_return_verifications;
BEGIN
  IF p_action NOT IN ('submit','approve','return') THEN RAISE EXCEPTION 'TAX_RETURN_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, v.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  c := a.c;
  stale := public.taxguard_tax_return_stale(p_tenant, p_version);
  IF p_action = 'submit' THEN
    IF p_actor IS DISTINCT FROM c.preparer_uid THEN RAISE EXCEPTION 'TAX_RETURN_PREPARER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF v.status <> 'DRAFT' THEN RAISE EXCEPTION 'TAX_RETURN_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
    IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_RETURN_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
    UPDATE public.taxguard_tax_return_versions SET status = 'SUBMITTED', submitted_at = now() WHERE tenant_id = p_tenant AND return_version_id = p_version RETURNING * INTO v;
  ELSE
    IF p_actor IS DISTINCT FROM c.reviewer_uid OR NOT public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) THEN
      RAISE EXCEPTION 'TAX_RETURN_REVIEWER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    IF p_actor = v.prepared_by THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF v.status <> 'SUBMITTED' THEN RAISE EXCEPTION 'TAX_RETURN_NOT_SUBMITTED' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'return' AND length(COALESCE(note, '')) < 10 THEN RAISE EXCEPTION 'TAX_RETURN_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'approve' THEN
      auth := public.taxguard_tax_approval_authority(p_tenant, p_actor, 'RETURN_DRAFT_REVIEW',
        (SELECT t.jurisdiction_code FROM public.taxguard_tax_return_templates t WHERE t.tenant_id = p_tenant AND t.template_rule_id = v.template_rule_id), true);
      IF NOT (auth->>'authorized')::boolean THEN RAISE EXCEPTION 'TAX_RETURN_REVIEW_AUTHORITY_REQUIRED' USING ERRCODE = 'P0001', DETAIL = auth->>'reason'; END IF;
      IF jsonb_array_length(stale) > 0 THEN RAISE EXCEPTION 'TAX_RETURN_STALE' USING ERRCODE = 'P0001', DETAIL = stale::text; END IF;
      SELECT * INTO ver FROM public.taxguard_tax_return_verifications WHERE tenant_id = p_tenant AND return_version_id = p_version
        AND verified_at >= v.submitted_at ORDER BY verified_at DESC, verification_id LIMIT 1;
      IF NOT FOUND OR ver.result <> 'VERIFIED' THEN
        RAISE EXCEPTION 'TAX_RETURN_VERIFICATION_REQUIRED' USING ERRCODE = 'P0001', DETAIL = COALESCE(ver.result, 'NONE');
      END IF;
      basis := (auth->'basis') || jsonb_build_object('approverUid', p_actor, 'formsSha256', v.forms_sha256, 'verificationId', ver.verification_id,
        'approvedAt', now());
    END IF;
    UPDATE public.taxguard_tax_return_versions SET status = CASE p_action WHEN 'approve' THEN 'APPROVED' ELSE 'RETURNED' END, reviewed_by = p_actor,
      reviewed_at = now(), review_note = note, approval_basis = basis WHERE tenant_id = p_tenant AND return_version_id = p_version RETURNING * INTO v;
  END IF;
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, c.case_id, p_actor, a.actor_role,
    'TAX_RETURN_' || CASE p_action WHEN 'submit' THEN 'SUBMITTED' WHEN 'approve' THEN 'APPROVED' ELSE 'RETURNED' END,
    jsonb_build_object('returnVersionId', p_version, 'templateId', v.template_id, 'version', v.version, 'formsSha256', v.forms_sha256)
    || CASE WHEN basis IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('approvalBasis', basis) END);
  RETURN public.taxguard_tax_return_json(p_tenant, p_version, false);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_return_verification_guard','taxguard_tax_return_verification_runs',
        'taxguard_tax_return_verification_inputs','taxguard_tax_return_verify','taxguard_tax_return_verification_list') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_return_verification_inputs','taxguard_tax_return_verify','taxguard_tax_return_verification_list') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
