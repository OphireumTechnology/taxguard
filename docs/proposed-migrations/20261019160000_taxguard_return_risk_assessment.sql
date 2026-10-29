-- PROPOSAL (Block 71, risk and materiality of a draft return version). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261018150000 (research memos), 20261018160000 (case diagnostics), 20261018170000 (materiality policies),
-- 20261019120000 (return versions), 20261019140000 (verifications) and 20261019150000 (return-level diagnostics).
--
-- A deterministic, immutable, audited risk assessment of one draft return version. Every signal except the amount at
-- stake is read from the database, never from the caller:
--   * integrity: the version no longer matches its sources (RETURN_VERSION_STALE), or its latest calculation verification
--     after submission found a discrepancy (RETURN_VERIFICATION_DISCREPANCY); no verification yet is RETURN_NOT_VERIFIED;
--   * readiness diagnostics of the case and of this version: not run since the version was prepared
--     (DIAGNOSTICS_NOT_CURRENT), blocking (DIAGNOSTIC_BLOCKING), errors (DIAGNOSTIC_ERRORS), open warnings
--     (DIAGNOSTIC_WARNINGS_OPEN);
--   * research positions of the case: memos still a draft or awaiting review (RESEARCH_UNRESOLVED), open memos without an
--     authoritative citation (RESEARCH_POSITION_UNSUPPORTED), memos supported only by AI inference (RESEARCH_AI_INFERENCE_ONLY);
--   * materiality: only the practice's approved materiality policy (20261018170000; none is seeded) classifies the amount a
--     person states (AMOUNT_MATERIAL); without one, NO_APPROVED_MATERIALITY_POLICY. No threshold is defined here.
-- Which mapped lines make up the amount at stake is a professional criterion the owner has not defined, so a person states
-- the amount, as for the case assessment. No AI confidence is accepted: no governed AI run supplies one.
-- Outcomes are BLOCKED (any integrity or blocking reason) or HUMAN_REVIEW_REQUIRED. There is no CONTINUE: owner decision
-- OV-09 is that every return has human review, so every assessment carries RETURN_HUMAN_REVIEW_REQUIRED. An assessment
-- changes nothing about the return; it is an input to quality control and final readiness (Block 72).
-- No existing function is superseded by this file.
-- Rollback (development): drop the two functions, the guard and the table.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_return_risk_assessments (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  assessment_id UUID NOT NULL DEFAULT gen_random_uuid(),
  return_version_id UUID NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  version_status VARCHAR(16) NOT NULL,
  forms_sha256 CHAR(64) NOT NULL,
  policy_version INTEGER,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  signals JSONB NOT NULL CHECK (jsonb_typeof(signals) = 'object'),
  materiality VARCHAR(10) NOT NULL CHECK (materiality IN ('IMMATERIAL','MATERIAL','UNKNOWN')),
  risk_level VARCHAR(8) NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH','UNKNOWN')),
  outcome VARCHAR(24) NOT NULL CHECK (outcome IN ('HUMAN_REVIEW_REQUIRED','BLOCKED')),
  reason_codes TEXT[] NOT NULL,
  assessed_by VARCHAR(128) NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (tenant_id, assessment_id),
  FOREIGN KEY (tenant_id, return_version_id) REFERENCES public.taxguard_tax_return_versions(tenant_id, return_version_id),
  CHECK ('RETURN_HUMAN_REVIEW_REQUIRED' = ANY (reason_codes)),
  CHECK ((outcome = 'BLOCKED') = (reason_codes && ARRAY['RETURN_VERSION_STALE','RETURN_VERIFICATION_DISCREPANCY','DIAGNOSTIC_BLOCKING']::text[]))
);
CREATE INDEX IF NOT EXISTS idx_taxguard_tax_return_risk_version ON public.taxguard_tax_return_risk_assessments(tenant_id, return_version_id, assessed_at DESC);

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_risk_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TAX_RETURN_RISK_ASSESSMENT_IMMUTABLE' USING ERRCODE = 'P0001';
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_return_risk_guard ON public.taxguard_tax_return_risk_assessments;
CREATE TRIGGER trg_taxguard_tax_return_risk_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_return_risk_assessments
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_return_risk_guard();
DROP TRIGGER IF EXISTS trg_taxguard_tax_return_risk_no_truncate ON public.taxguard_tax_return_risk_assessments;
CREATE TRIGGER trg_taxguard_tax_return_risk_no_truncate BEFORE TRUNCATE ON public.taxguard_tax_return_risk_assessments
  FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_return_risk_guard();
ALTER TABLE public.taxguard_tax_return_risk_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_return_risk_assessments FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_tax_return_risk_json(r public.taxguard_tax_return_risk_assessments) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('assessmentId', r.assessment_id, 'returnVersionId', r.return_version_id, 'caseId', r.case_id, 'taxYear', r.tax_year,
    'versionStatus', r.version_status, 'formsSha256', r.forms_sha256, 'policyVersion', r.policy_version, 'amountCents', r.amount_cents,
    'signals', r.signals, 'materiality', r.materiality, 'riskLevel', r.risk_level, 'outcome', r.outcome, 'reasonCodes', to_jsonb(r.reason_codes),
    'assessedBy', r.assessed_by, 'assessedAt', r.assessed_at) $$;

-- Assesses one open (not superseded) return version for an actor of its case. p_signals = {amountCents} only.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_risk_assess(p_tenant text, p_actor text, p_version uuid, p_signals jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE v public.taxguard_tax_return_versions; a record; c public.taxguard_cases; p public.taxguard_materiality_policies; n numeric; amount bigint;
  stale jsonb; ver record; last_run timestamptz; blocking_ integer; errors_ integer; warnings_ integer; unresolved_ integer; unsupported_ integer; ai_only integer;
  reasons text[] := ARRAY['RETURN_HUMAN_REVIEW_REQUIRED']; v_materiality text := 'UNKNOWN'; v_risk text := 'UNKNOWN'; v_outcome text; signals_ jsonb;
  v_row public.taxguard_tax_return_risk_assessments;
BEGIN
  IF p_signals IS NULL OR jsonb_typeof(p_signals) <> 'object' OR jsonb_typeof(p_signals->'amountCents') IS DISTINCT FROM 'number'
     OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_signals) k WHERE k <> 'amountCents') THEN
    RAISE EXCEPTION 'RISK_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  n := (p_signals->>'amountCents')::numeric;
  IF n < 0 OR n <> trunc(n) OR n > 9007199254740991 THEN RAISE EXCEPTION 'RISK_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  amount := n::bigint;
  SELECT * INTO v FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND return_version_id = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, v.case_id, p_actor);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN RAISE EXCEPTION 'TAX_RETURN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  c := a.c;
  IF v.status = 'SUPERSEDED' THEN RAISE EXCEPTION 'TAX_RETURN_SUPERSEDED' USING ERRCODE = 'P0001'; END IF;

  -- Integrity of the version.
  stale := public.taxguard_tax_return_stale(p_tenant, p_version);
  IF jsonb_array_length(stale) > 0 THEN reasons := reasons || 'RETURN_VERSION_STALE'::text; END IF;
  SELECT r.verification_id, r.result INTO ver FROM public.taxguard_tax_return_verifications r
    WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version AND v.submitted_at IS NOT NULL AND r.verified_at >= v.submitted_at
    ORDER BY r.verified_at DESC, r.verification_id LIMIT 1;
  IF ver.result IS NULL THEN reasons := reasons || 'RETURN_NOT_VERIFIED'::text;
  ELSIF ver.result = 'DISCREPANCY' THEN reasons := reasons || 'RETURN_VERIFICATION_DISCREPANCY'::text; END IF;

  -- Readiness diagnostics: case-level findings and this version's return-level findings, from the latest governed run.
  SELECT max(run_at) INTO last_run FROM public.taxguard_case_diagnostic_runs WHERE tenant_id = p_tenant AND case_id = c.case_id;
  IF last_run IS NULL OR last_run < v.created_at THEN reasons := reasons || 'DIAGNOSTICS_NOT_CURRENT'::text; END IF;
  SELECT count(*) FILTER (WHERE d.severity = 'BLOCKING'), count(*) FILTER (WHERE d.severity = 'ERROR'),
         count(*) FILTER (WHERE d.severity = 'WARNING' AND d.status = 'OPEN')
    INTO blocking_, errors_, warnings_ FROM public.taxguard_case_diagnostics d
    WHERE d.tenant_id = p_tenant AND d.case_id = c.case_id AND d.status <> 'CLEARED'
      AND (d.affected_type <> 'RETURN_VERSION' OR d.affected_id = p_version::text);
  IF blocking_ > 0 THEN reasons := reasons || 'DIAGNOSTIC_BLOCKING'::text; END IF;
  IF errors_ > 0 THEN reasons := reasons || 'DIAGNOSTIC_ERRORS'::text; END IF;
  IF warnings_ > 0 THEN reasons := reasons || 'DIAGNOSTIC_WARNINGS_OPEN'::text; END IF;

  -- Research positions of the case. An approved memo always has an authoritative citation; a rejected memo supports nothing.
  SELECT count(*) FILTER (WHERE m.status IN ('DRAFT','SUBMITTED')),
         count(*) FILTER (WHERE m.status IN ('DRAFT','SUBMITTED') AND NOT EXISTS (SELECT 1 FROM public.taxguard_tax_research_citations x
           WHERE x.tenant_id = m.tenant_id AND x.memo_id = m.memo_id AND x.authority_level = 'AUTHORITATIVE')),
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.taxguard_tax_research_citations x
             WHERE x.tenant_id = m.tenant_id AND x.memo_id = m.memo_id AND x.authority_level = 'AI_INFERENCE')
           AND NOT EXISTS (SELECT 1 FROM public.taxguard_tax_research_citations x
             WHERE x.tenant_id = m.tenant_id AND x.memo_id = m.memo_id AND x.authority_level <> 'AI_INFERENCE'))
    INTO unresolved_, unsupported_, ai_only FROM public.taxguard_tax_research_memos m
    WHERE m.tenant_id = p_tenant AND m.case_id = c.case_id AND m.status <> 'REJECTED';
  IF unresolved_ > 0 THEN reasons := reasons || 'RESEARCH_UNRESOLVED'::text; END IF;
  IF unsupported_ > 0 THEN reasons := reasons || 'RESEARCH_POSITION_UNSUPPORTED'::text; END IF;
  IF ai_only > 0 THEN reasons := reasons || 'RESEARCH_AI_INFERENCE_ONLY'::text; END IF;

  -- Materiality: only an approved practice policy decides; without one, materiality and risk level stay unknown.
  SELECT * INTO p FROM public.taxguard_materiality_policies WHERE tenant_id = p_tenant AND status = 'APPROVED' ORDER BY policy_version DESC LIMIT 1;
  IF NOT FOUND THEN
    reasons := reasons || 'NO_APPROVED_MATERIALITY_POLICY'::text;
  ELSE
    v_materiality := CASE WHEN amount >= p.material_amount_cents THEN 'MATERIAL' ELSE 'IMMATERIAL' END;
    v_risk := CASE WHEN amount >= p.high_risk_amount_cents OR unsupported_ > 0 OR ai_only > 0 THEN 'HIGH' WHEN v_materiality = 'MATERIAL' THEN 'MEDIUM' ELSE 'LOW' END;
    IF v_materiality = 'MATERIAL' THEN reasons := reasons || 'AMOUNT_MATERIAL'::text; END IF;
  END IF;

  v_outcome := CASE WHEN reasons && ARRAY['RETURN_VERSION_STALE','RETURN_VERIFICATION_DISCREPANCY','DIAGNOSTIC_BLOCKING']::text[] THEN 'BLOCKED'
    ELSE 'HUMAN_REVIEW_REQUIRED' END;
  signals_ := jsonb_build_object('stale', stale, 'verification', CASE WHEN ver.result IS NULL THEN NULL
      ELSE jsonb_build_object('verificationId', ver.verification_id, 'result', ver.result) END,
    'diagnostics', jsonb_build_object('lastRunAt', last_run, 'blocking', blocking_, 'errors', errors_, 'openWarnings', warnings_),
    'research', jsonb_build_object('unresolved', unresolved_, 'unsupported', unsupported_, 'aiInferenceOnly', ai_only));
  INSERT INTO public.taxguard_tax_return_risk_assessments(tenant_id, return_version_id, case_id, client_id, tax_year, version_status, forms_sha256,
      policy_version, amount_cents, signals, materiality, risk_level, outcome, reason_codes, assessed_by)
    VALUES (p_tenant, v.return_version_id, c.case_id, c.client_id, c.tax_year, v.status, v.forms_sha256, p.policy_version, amount, signals_,
      v_materiality, v_risk, v_outcome, reasons, p_actor)
    RETURNING * INTO v_row;
  PERFORM public.taxguard_case_audit(p_tenant, c.client_id, c.case_id, p_actor, a.actor_role, 'TAX_RETURN_RISK_ASSESSED',
    jsonb_build_object('assessmentId', v_row.assessment_id, 'returnVersionId', v.return_version_id, 'outcome', v_outcome,
      'policyVersion', p.policy_version, 'reasonCodes', to_jsonb(reasons)));
  RETURN public.taxguard_tax_return_risk_json(v_row) || jsonb_build_object('returnUse', 'BLOCKED');
END $$;

-- The risk assessments of a version, newest first, for an actor of its case.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_risk_list(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
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
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_tax_return_risk_json(r) ORDER BY r.assessed_at DESC, r.assessment_id), '[]'::jsonb)
    FROM public.taxguard_tax_return_risk_assessments r WHERE r.tenant_id = p_tenant AND r.return_version_id = p_version);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_return_risk_guard','taxguard_tax_return_risk_json',
        'taxguard_tax_return_risk_assess','taxguard_tax_return_risk_list') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_return_risk_assess','taxguard_tax_return_risk_list') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
