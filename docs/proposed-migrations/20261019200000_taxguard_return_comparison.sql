-- PROPOSAL (Block 75, return comparison: previous version and prior year). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261018090000 (live case actor), 20261019110000 (form values), 20261019120000 (return versions) and
-- 20261019180000 (taxguard_tax_return_final_scope).
--
-- A read-only, deterministic comparison of one return version's mapped values with:
--   * the previous version of the same case and template (what changed since the last preparation), and
--   * the client's prior-year return: the latest version of tax year - 1 approved at Stage 09, for the same jurisdiction
--     and return family, in a case the actor may open. Anything else reports NOT_AVAILABLE (no values, no reason).
-- Lines match only on identical identifiers (form, schedule, line, field; and form version within one tax year). A
-- cross-year line crosswalk is tax content and is not encoded. A key that appears twice on either side, or with
-- different value types, is AMBIGUOUS and carries no values.
-- Variance flags need the owner's approved variance policy (versioned, approved by someone other than its author). None
-- is seeded and no RPC writes one: without it varianceCheck is NOT_CONFIGURED and no line is flagged. With one, a prior-
-- year MONEY line is flagged when its change is at least the policy amount and, unless the prior value is zero, at least
-- the policy share of the prior value. INTEGER lines are never flagged. A flag is information for the reviewer: it gates
-- nothing, changes nothing and is not stored.
-- Rollback (development): drop the functions, the guard and the table.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_variance_policies (
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  policy_version INTEGER NOT NULL CHECK (policy_version BETWEEN 1 AND 1000),
  min_change_amount NUMERIC(17,2) NOT NULL CHECK (min_change_amount > 0),
  min_change_basis_points INTEGER NOT NULL CHECK (min_change_basis_points BETWEEN 1 AND 1000000),
  rationale VARCHAR(2000) NOT NULL CHECK (char_length(rationale) >= 20),
  created_by VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, policy_version),
  CHECK (approved_by <> created_by)
);
ALTER TABLE public.taxguard_tax_variance_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_variance_policies FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_tax_variance_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'TAX_VARIANCE_POLICY_IMMUTABLE' USING ERRCODE = 'P0001';
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_variance_policies_guard ON public.taxguard_tax_variance_policies;
CREATE TRIGGER trg_taxguard_tax_variance_policies_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_variance_policies
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_variance_policy_guard();
DROP TRIGGER IF EXISTS trg_taxguard_tax_variance_policies_no_truncate ON public.taxguard_tax_variance_policies;
CREATE TRIGGER trg_taxguard_tax_variance_policies_no_truncate BEFORE TRUNCATE ON public.taxguard_tax_variance_policies
  FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_tax_variance_policy_guard();

-- The version's mapped values, one row per comparison key, with how many values share it.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_value_rows(p_tenant text, p_version uuid, p_by_form_version boolean)
RETURNS TABLE (k jsonb, form_id text, form_version text, schedule text, line text, field text, value_type text, value numeric, n bigint, types bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_array(fv.form_id, CASE WHEN p_by_form_version THEN fv.form_version END, fv.schedule, fv.line, fv.field),
    min(fv.form_id), min(fv.form_version), min(fv.schedule), min(fv.line), min(fv.field), min(fv.value_type), sum(fv.value), count(*),
    count(DISTINCT fv.value_type)
  FROM public.taxguard_tax_return_versions v, jsonb_array_elements(v.forms) f, public.taxguard_tax_form_values fv
  WHERE v.tenant_id = p_tenant AND v.return_version_id = p_version AND fv.tenant_id = v.tenant_id AND fv.mapping_id = (f.value->>'mappingId')::uuid
  GROUP BY 1 $$;

-- Line-by-line differences from p_base to p_current. p_policy NULL: no line is flagged.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_value_diff(p_tenant text, p_base uuid, p_current uuid, p_by_form_version boolean,
  p_policy public.taxguard_tax_variance_policies) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  WITH b AS (SELECT * FROM public.taxguard_tax_return_value_rows(p_tenant, p_base, p_by_form_version)),
    c AS (SELECT * FROM public.taxguard_tax_return_value_rows(p_tenant, p_current, p_by_form_version)),
    j AS (SELECT COALESCE(c.form_id, b.form_id) AS form_id, b.form_version AS prior_form_version, c.form_version AS form_version,
        COALESCE(c.schedule, b.schedule) AS schedule, COALESCE(c.line, b.line) AS line, COALESCE(c.field, b.field) AS field,
        COALESCE(c.value_type, b.value_type) AS value_type, b.value AS prior_value, c.value AS value,
        CASE WHEN COALESCE(b.n, 0) > 1 OR COALESCE(c.n, 0) > 1 OR COALESCE(b.types, 0) > 1 OR COALESCE(c.types, 0) > 1
               OR (b.k IS NOT NULL AND c.k IS NOT NULL AND b.value_type <> c.value_type) THEN 'AMBIGUOUS'
             WHEN b.k IS NULL THEN 'ADDED' WHEN c.k IS NULL THEN 'REMOVED' WHEN b.value = c.value THEN 'UNCHANGED' ELSE 'CHANGED' END AS kind
      FROM b FULL JOIN c ON b.k = c.k),
    d AS (SELECT j.*, CASE WHEN kind <> 'AMBIGUOUS' THEN COALESCE(value, 0) - COALESCE(prior_value, 0) END AS change FROM j)
  SELECT COALESCE(jsonb_agg(jsonb_build_object('formId', form_id, 'priorFormVersion', prior_form_version, 'formVersion', form_version,
      'schedule', schedule, 'line', line, 'field', field, 'valueType', value_type, 'kind', kind,
      'priorValue', CASE WHEN kind <> 'AMBIGUOUS' THEN to_char(prior_value, 'FM9999999999999990.00') END,
      'value', CASE WHEN kind <> 'AMBIGUOUS' THEN to_char(value, 'FM9999999999999990.00') END,
      'change', to_char(change, 'FM9999999999999990.00'),
      'changeBasisPoints', CASE WHEN kind IN ('CHANGED','UNCHANGED') AND prior_value <> 0 THEN round(change * 10000 / abs(prior_value))::bigint END,
      'variance', CASE WHEN (p_policy).policy_version IS NULL OR value_type <> 'MONEY' OR kind NOT IN ('CHANGED','ADDED','REMOVED') THEN NULL
        ELSE abs(change) >= (p_policy).min_change_amount
          AND (COALESCE(prior_value, 0) = 0 OR abs(change) * 10000 >= (p_policy).min_change_basis_points * abs(prior_value)) END)
    ORDER BY form_id COLLATE "C", schedule COLLATE "C", line COLLATE "C", field COLLATE "C"), '[]'::jsonb) FROM d $$;

-- The comparison of one version, for anyone who may read it (case actor, QC assignee, final authorizer). Reads only.
CREATE OR REPLACE FUNCTION public.taxguard_tax_return_comparison(p_tenant text, p_actor text, p_version uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s record; v public.taxguard_tax_return_versions; t public.taxguard_tax_return_templates; pv public.taxguard_tax_return_versions;
  py public.taxguard_tax_return_versions; pol public.taxguard_tax_variance_policies; prev jsonb; prior jsonb;
BEGIN
  SELECT * INTO s FROM public.taxguard_tax_return_final_scope(p_tenant, p_actor, p_version); v := s.v;
  SELECT * INTO pol FROM public.taxguard_tax_variance_policies WHERE tenant_id = p_tenant ORDER BY policy_version DESC LIMIT 1;
  SELECT * INTO pv FROM public.taxguard_tax_return_versions WHERE tenant_id = p_tenant AND case_id = v.case_id AND template_id = v.template_id
    AND version < v.version ORDER BY version DESC LIMIT 1;
  IF pv.return_version_id IS NOT NULL THEN
    prev := jsonb_build_object('returnVersionId', pv.return_version_id, 'version', pv.version, 'status', pv.status,
      'lines', public.taxguard_tax_return_value_diff(p_tenant, pv.return_version_id, v.return_version_id, true, NULL));
  END IF;
  SELECT * INTO t FROM public.taxguard_tax_return_templates WHERE tenant_id = p_tenant AND template_rule_id = v.template_rule_id;
  SELECT y.* INTO py FROM public.taxguard_tax_return_versions y JOIN public.taxguard_tax_return_templates yt
      ON yt.tenant_id = y.tenant_id AND yt.template_rule_id = y.template_rule_id
    WHERE y.tenant_id = p_tenant AND y.client_id = v.client_id AND y.tax_year = v.tax_year - 1 AND y.status = 'APPROVED'
      AND (yt.jurisdiction, yt.jurisdiction_code, yt.return_family) = (t.jurisdiction, t.jurisdiction_code, t.return_family)
    ORDER BY y.reviewed_at DESC, y.return_version_id LIMIT 1;
  IF py.return_version_id IS NOT NULL THEN
    BEGIN
      PERFORM public.taxguard_case_actor(p_tenant, py.case_id, p_actor);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM IN ('CASE_NOT_FOUND', 'CASE_INPUT_INVALID') THEN py := NULL; ELSE RAISE; END IF;
    END;
  END IF;
  IF py.return_version_id IS NULL THEN
    prior := jsonb_build_object('status', 'NOT_AVAILABLE', 'taxYear', v.tax_year - 1);
  ELSE
    prior := jsonb_build_object('status', 'COMPARED', 'taxYear', py.tax_year, 'returnVersionId', py.return_version_id, 'caseId', py.case_id,
      'templateId', py.template_id, 'version', py.version, 'basis', 'STAGE_09_APPROVED',
      'stale', jsonb_array_length(public.taxguard_tax_return_stale(p_tenant, py.return_version_id)) > 0, 'matching', 'IDENTICAL_LINE_IDENTIFIERS',
      'lines', public.taxguard_tax_return_value_diff(p_tenant, py.return_version_id, v.return_version_id, false, pol));
  END IF;
  RETURN jsonb_build_object('returnVersionId', v.return_version_id, 'caseId', v.case_id, 'taxYear', v.tax_year, 'templateId', v.template_id,
    'version', v.version, 'previousVersion', prev, 'priorYear', prior,
    'varianceCheck', CASE WHEN pol.policy_version IS NULL THEN 'NOT_CONFIGURED' ELSE 'APPLIED' END, 'variancePolicyVersion', pol.policy_version,
    'returnUse', 'BLOCKED');
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_variance_policy_guard','taxguard_tax_return_value_rows',
        'taxguard_tax_return_value_diff','taxguard_tax_return_comparison') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname = 'taxguard_tax_return_comparison' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
