-- REVIEW-ONLY PROPOSAL. Not applied to any hosted database; owner approval and independent SQL review required.
--
-- Risk and materiality, and the confidence + evidence + risk decision gate for one tax case.
--
--   * Materiality thresholds are practice policy. They live in versioned policies approved by someone other than their
--     author; none is seeded, and no RPC writes them (a reviewed database change, like the diagnostic rules).
--   * An assessment is deterministic: it combines the case's readiness diagnostics (evidence), the approved policy's
--     thresholds (materiality), declared position characteristics, and an optional AI confidence. It is persisted with
--     its inputs, the policy version and its reason codes, immutably, and audited.
--   * Outcomes: BLOCKED when a blocking diagnostic exists; HUMAN_REVIEW_REQUIRED for any reason (no approved policy,
--     case not diagnosed, error diagnostics, material amount, unsupported position, confidence below the policy
--     minimum); CONTINUE only when an approved policy explicitly allows automated continuation and no reason exists.
--   * AI confidence is recorded and can add a reason, never remove one: it cannot waive review or clear a block.

CREATE TABLE IF NOT EXISTS public.taxguard_materiality_policies (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE CASCADE,
  policy_version INTEGER NOT NULL CHECK (policy_version >= 1),
  material_amount_cents BIGINT NOT NULL CHECK (material_amount_cents > 0),
  high_risk_amount_cents BIGINT NOT NULL CHECK (high_risk_amount_cents > 0),
  minimum_ai_confidence NUMERIC(4,3) NOT NULL CHECK (minimum_ai_confidence BETWEEN 0 AND 1),
  allow_automated_continuation BOOLEAN NOT NULL DEFAULT false,
  rationale VARCHAR(1000) NOT NULL CHECK (length(btrim(rationale)) >= 10),
  status VARCHAR(10) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','RETIRED')),
  created_by VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128),
  approved_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, policy_version),
  CHECK (high_risk_amount_cents >= material_amount_cents),
  CHECK ((status = 'APPROVED') <= (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK (approved_by IS NULL OR approved_by <> created_by)
);

CREATE TABLE IF NOT EXISTS public.taxguard_case_risk_assessments (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  policy_version INTEGER,
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  unsupported_position BOOLEAN NOT NULL,
  ai_confidence NUMERIC(4,3) CHECK (ai_confidence IS NULL OR ai_confidence BETWEEN 0 AND 1),
  diagnostics JSONB NOT NULL,
  materiality VARCHAR(10) NOT NULL CHECK (materiality IN ('IMMATERIAL','MATERIAL','UNKNOWN')),
  risk_level VARCHAR(8) NOT NULL CHECK (risk_level IN ('LOW','MEDIUM','HIGH','UNKNOWN')),
  outcome VARCHAR(24) NOT NULL CHECK (outcome IN ('CONTINUE','HUMAN_REVIEW_REQUIRED','BLOCKED')),
  reason_codes TEXT[] NOT NULL,
  assessed_by VARCHAR(128) NOT NULL,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, assessment_id),
  CHECK ((outcome = 'CONTINUE') = (cardinality(reason_codes) = 0))
);

ALTER TABLE public.taxguard_materiality_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxguard_case_risk_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_materiality_policies, public.taxguard_case_risk_assessments FROM PUBLIC, anon, authenticated;

-- Assessments are evidence: never changed or deleted, also by the database owner. Approved policies are never edited.
CREATE OR REPLACE FUNCTION public.taxguard_risk_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'taxguard_case_risk_assessments' THEN RAISE EXCEPTION 'RISK_ASSESSMENT_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF TG_OP = 'DELETE' OR OLD.status <> 'DRAFT' AND NOT (OLD.status = 'APPROVED' AND NEW.status = 'RETIRED'
      AND (NEW.material_amount_cents, NEW.high_risk_amount_cents, NEW.minimum_ai_confidence, NEW.allow_automated_continuation, NEW.approved_by)
        IS NOT DISTINCT FROM (OLD.material_amount_cents, OLD.high_risk_amount_cents, OLD.minimum_ai_confidence, OLD.allow_automated_continuation, OLD.approved_by)) THEN
    RAISE EXCEPTION 'MATERIALITY_POLICY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_case_risk_assessments_guard ON public.taxguard_case_risk_assessments;
CREATE TRIGGER trg_taxguard_case_risk_assessments_guard BEFORE UPDATE OR DELETE ON public.taxguard_case_risk_assessments FOR EACH ROW EXECUTE FUNCTION public.taxguard_risk_guard();
DROP TRIGGER IF EXISTS trg_taxguard_materiality_policies_guard ON public.taxguard_materiality_policies;
CREATE TRIGGER trg_taxguard_materiality_policies_guard BEFORE UPDATE OR DELETE ON public.taxguard_materiality_policies FOR EACH ROW EXECUTE FUNCTION public.taxguard_risk_guard();

CREATE OR REPLACE FUNCTION public.taxguard_case_risk_assess(p_tenant text, p_actor text, p_case text, p_signals jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record; c public.taxguard_cases; p public.taxguard_materiality_policies; g jsonb; amount bigint; unsupported boolean; confidence numeric;
  reasons text[] := '{}'; v_materiality text := 'UNKNOWN'; v_risk text := 'UNKNOWN'; v_outcome text; v_row public.taxguard_case_risk_assessments;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  c := a.c;
  IF p_signals IS NULL OR jsonb_typeof(p_signals) <> 'object' OR jsonb_typeof(p_signals->'amountCents') IS DISTINCT FROM 'number'
     OR (p_signals ? 'aiConfidence' AND jsonb_typeof(p_signals->'aiConfidence') NOT IN ('number','null'))
     OR (p_signals ? 'unsupportedPosition' AND jsonb_typeof(p_signals->'unsupportedPosition') <> 'boolean') THEN
    RAISE EXCEPTION 'RISK_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  amount := (p_signals->>'amountCents')::numeric;
  unsupported := COALESCE((p_signals->>'unsupportedPosition')::boolean, false);
  confidence := (p_signals->>'aiConfidence')::numeric;
  IF amount < 0 OR amount <> (p_signals->>'amountCents')::numeric OR (confidence IS NOT NULL AND confidence NOT BETWEEN 0 AND 1) THEN
    RAISE EXCEPTION 'RISK_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- Evidence: the case's readiness diagnostics.
  g := public.taxguard_case_diagnostics_gate(p_tenant, c.case_id);
  IF g->>'diagnosedAt' IS NULL THEN reasons := array_append(reasons, 'DIAGNOSTICS_NOT_RUN'); END IF;
  IF (g->>'blocking')::int > 0 THEN reasons := array_append(reasons, 'DIAGNOSTIC_BLOCKING'); END IF;
  IF (g->>'errors')::int > 0 THEN reasons := array_append(reasons, 'DIAGNOSTIC_ERRORS'); END IF;

  -- Materiality: only an approved practice policy decides; without one, materiality is unknown and a person reviews.
  SELECT * INTO p FROM public.taxguard_materiality_policies WHERE tenant_id = p_tenant AND status = 'APPROVED' ORDER BY policy_version DESC LIMIT 1;
  IF NOT FOUND THEN
    reasons := array_append(reasons, 'NO_APPROVED_MATERIALITY_POLICY');
  ELSE
    v_materiality := CASE WHEN amount >= p.material_amount_cents THEN 'MATERIAL' ELSE 'IMMATERIAL' END;
    v_risk := CASE WHEN amount >= p.high_risk_amount_cents OR unsupported THEN 'HIGH' WHEN v_materiality = 'MATERIAL' THEN 'MEDIUM' ELSE 'LOW' END;
    IF v_materiality = 'MATERIAL' THEN reasons := array_append(reasons, 'AMOUNT_MATERIAL'); END IF;
    -- Confidence can add a reason, never remove one.
    IF confidence IS NOT NULL AND confidence < p.minimum_ai_confidence THEN reasons := array_append(reasons, 'AI_CONFIDENCE_BELOW_POLICY'); END IF;
    IF NOT p.allow_automated_continuation THEN reasons := array_append(reasons, 'POLICY_REQUIRES_HUMAN_REVIEW'); END IF;
  END IF;
  IF unsupported THEN reasons := array_append(reasons, 'UNSUPPORTED_POSITION'); END IF;

  v_outcome := CASE WHEN 'DIAGNOSTIC_BLOCKING' = ANY (reasons) THEN 'BLOCKED' WHEN cardinality(reasons) > 0 THEN 'HUMAN_REVIEW_REQUIRED' ELSE 'CONTINUE' END;
  INSERT INTO public.taxguard_case_risk_assessments(tenant_id, case_id, client_id, tax_year, policy_version, amount_cents, unsupported_position, ai_confidence,
      diagnostics, materiality, risk_level, outcome, reason_codes, assessed_by)
    VALUES (p_tenant, c.case_id, c.client_id, c.tax_year, p.policy_version, amount, unsupported, confidence, g, v_materiality, v_risk, v_outcome, reasons, p_actor)
    RETURNING * INTO v_row;
  PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, a.actor_role, 'CASE_RISK_ASSESSED',
    jsonb_build_object('caseId', c.case_id, 'assessmentId', v_row.assessment_id, 'outcome', v_outcome, 'policyVersion', p.policy_version));
  RETURN (to_jsonb(v_row) - 'tenant_id') || jsonb_build_object('returnUse', 'BLOCKED');
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_case_risk_list(p_tenant text, p_actor text, p_case text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.taxguard_case_actor(p_tenant, p_case, p_actor);
  RETURN COALESCE((SELECT jsonb_agg((to_jsonb(r) - 'tenant_id') ORDER BY r.assessed_at DESC) FROM public.taxguard_case_risk_assessments r
    WHERE r.tenant_id = p_tenant AND r.case_id = (a.c).case_id), '[]'::jsonb);
END $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['taxguard_risk_guard()','taxguard_case_risk_assess(text,text,text,jsonb)','taxguard_case_risk_list(text,text,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['taxguard_case_risk_assess(text,text,text,jsonb)','taxguard_case_risk_list(text,text,text)'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;
