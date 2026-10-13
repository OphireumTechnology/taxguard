-- TaxGuard proposal 038 (development only, NOT applied): verification-case COVERAGE for rule sets.
--
-- Proposal 036 requires at least one passing, source-cited verification case before a rule set is
-- submitted or approved. A single case can leave most of a rule set unchecked, so this proposal adds
-- a purely structural requirement, computed from the stored definition; it adds no tax content:
--   * every declared output key is asserted by at least one case ("expected" contains the key);
--   * every filing-status variant that has its own parameter value is exercised by at least one case
--     with that filing status, and the default path (parameters without a filing status) by at least
--     one case without a filing status.
-- Missing coverage raises TAX_RULE_SET_COVERAGE_INCOMPLETE (DETAIL lists output keys / filing-status
-- codes from the definition only). taxguard_tax_require_passing_tests (036) is superseded with the
-- same signature, so submission and approval both enforce it; its 036 checks are unchanged.
-- Requires proposals 025, 033 and 036. service_role only; pinned search_path.

CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_coverage(p_tenant text, s public.taxguard_tax_rule_sets) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  WITH outputs AS (
    SELECT DISTINCT o->>'key' AS k FROM jsonb_array_elements(COALESCE(s.definition->'outputs', '[]'::jsonb)) o WHERE o->>'key' IS NOT NULL
  ), variants AS (
    SELECT DISTINCT COALESCE(p->>'filingStatus', '') AS fs FROM jsonb_array_elements(COALESCE(s.definition->'parameters', '[]'::jsonb)) p
  ), tests AS (
    SELECT t.filing_status, t.expected FROM public.taxguard_tax_rule_set_tests t WHERE t.tenant_id = p_tenant AND t.rule_set_id = s.rule_set_id
  )
  SELECT jsonb_build_object(
    'missingOutputs', COALESCE((SELECT jsonb_agg(k ORDER BY k) FROM outputs WHERE NOT EXISTS (SELECT 1 FROM tests WHERE tests.expected ? outputs.k)), '[]'::jsonb),
    'missingFilingStatuses', COALESCE((SELECT jsonb_agg(CASE WHEN fs = '' THEN 'default' ELSE fs END ORDER BY fs) FROM variants
      WHERE NOT EXISTS (SELECT 1 FROM tests WHERE COALESCE(tests.filing_status, '') = variants.fs)), '[]'::jsonb)) $$;

-- Superseding definition of the 036 gate (identical except for the coverage check).
CREATE OR REPLACE FUNCTION public.taxguard_tax_require_passing_tests(p_tenant text, s public.taxguard_tax_rule_sets) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE h text := public.taxguard_tax_rule_tests_hash(p_tenant, s.rule_set_id); latest public.taxguard_tax_rule_set_test_runs; cov jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.taxguard_tax_rule_set_tests WHERE tenant_id = p_tenant AND rule_set_id = s.rule_set_id) THEN
    RAISE EXCEPTION 'TAX_RULE_SET_TESTS_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  cov := public.taxguard_tax_rule_coverage(p_tenant, s);
  IF jsonb_array_length(cov->'missingOutputs') > 0 OR jsonb_array_length(cov->'missingFilingStatuses') > 0 THEN
    RAISE EXCEPTION 'TAX_RULE_SET_COVERAGE_INCOMPLETE' USING ERRCODE = 'P0001',
      DETAIL = concat_ws(';', NULLIF('outputs=' || (SELECT string_agg(x, ',') FROM jsonb_array_elements_text(cov->'missingOutputs') x), 'outputs='),
        NULLIF('filingStatuses=' || (SELECT string_agg(x, ',') FROM jsonb_array_elements_text(cov->'missingFilingStatuses') x), 'filingStatuses='));
  END IF;
  SELECT * INTO latest FROM public.taxguard_tax_rule_set_test_runs WHERE tenant_id = p_tenant AND rule_set_id = s.rule_set_id
    AND content_sha256 = s.content_sha256 AND tests_sha256 = h ORDER BY run_at DESC, run_id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_TESTS_NOT_RUN' USING ERRCODE = 'P0001'; END IF;
  IF NOT latest.all_passed THEN RAISE EXCEPTION 'TAX_RULE_SET_TESTS_FAILING' USING ERRCODE = 'P0001'; END IF;
END $$;

-- Coverage report for the preparer and reviewer (tax-content roles; bookkeepers refused by taxguard_tax_actor).
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_coverage_get(p_tenant text, p_actor text, p_rule_set uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE s public.taxguard_tax_rule_sets;
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'maintain');
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN jsonb_build_object('ruleSetId', s.rule_set_id, 'contentSha256', s.content_sha256) || public.taxguard_tax_rule_coverage(p_tenant, s);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_rule_coverage','taxguard_tax_require_passing_tests','taxguard_tax_rule_coverage_get') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname = 'taxguard_tax_rule_coverage_get' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
