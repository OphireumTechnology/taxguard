-- PROPOSAL 036 ONLY. NOT APPLIED. Requires proposal 033.
-- Tax-rule implementation infrastructure: source-cited verification cases. TaxGuard ships no tax
-- rules and no cases; both are entered by the firm from verified sources.
--
--   taxguard_tax_rule_set_tests      worked cases for a rule set: inputs (exact decimal strings), the
--                                    expected outputs and the VERIFIED source (with pinpoint citation,
--                                    e.g. a published worksheet example) the expectation comes from.
--                                    Added or removed only while the rule set is a DRAFT.
--   taxguard_tax_rule_set_test_runs  immutable results of running every case with the deterministic
--                                    engine, pinned to the rule-set content hash, the case-set hash and
--                                    the engine version.
-- Submitting and approving a rule set (superseded 033 transition) now also require at least one case
-- and a recorded run, for the CURRENT content and case set, in which every case passed. Approval is
-- still by a reviewer other than the preparer; stages 9-18 remain blocked.
-- Rollback (development): drop the two tables and functions; restore the 033 transition definition.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_rule_set_tests (
  tenant_id VARCHAR(128) NOT NULL,
  rule_set_id UUID NOT NULL,
  test_id UUID NOT NULL DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL CHECK (length(btrim(name)) >= 3),
  filing_status VARCHAR(40) CHECK (filing_status IS NULL OR filing_status ~ '^[a-z_]{2,40}$'),
  inputs JSONB NOT NULL CHECK (jsonb_typeof(inputs) = 'array'),
  expected JSONB NOT NULL CHECK (jsonb_typeof(expected) = 'object'),
  source_id VARCHAR(80) NOT NULL,
  citation VARCHAR(300) NOT NULL CHECK (length(btrim(citation)) >= 3),
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, rule_set_id, test_id),
  FOREIGN KEY (tenant_id, rule_set_id) REFERENCES public.taxguard_tax_rule_sets(tenant_id, rule_set_id),
  FOREIGN KEY (tenant_id, source_id) REFERENCES public.taxguard_tax_sources(tenant_id, source_id)
);
CREATE TABLE IF NOT EXISTS public.taxguard_tax_rule_set_test_runs (
  tenant_id VARCHAR(128) NOT NULL,
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL,
  content_sha256 CHAR(64) NOT NULL,
  tests_sha256 CHAR(64) NOT NULL,
  engine_version VARCHAR(40) NOT NULL,
  test_count INTEGER NOT NULL CHECK (test_count >= 0),
  passed_count INTEGER NOT NULL CHECK (passed_count BETWEEN 0 AND test_count),
  all_passed BOOLEAN GENERATED ALWAYS AS (test_count > 0 AND passed_count = test_count) STORED,
  results JSONB NOT NULL,
  run_by VARCHAR(128) NOT NULL,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, run_id),
  FOREIGN KEY (tenant_id, rule_set_id) REFERENCES public.taxguard_tax_rule_sets(tenant_id, rule_set_id)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_tax_rule_set_tests','taxguard_tax_rule_set_test_runs'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Cases change only while the rule set is a draft; runs never change.
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_tests_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st text;
BEGIN
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'TAX_RULE_TEST_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  SELECT status INTO st FROM public.taxguard_tax_rule_sets WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) AND rule_set_id = COALESCE(NEW.rule_set_id, OLD.rule_set_id);
  IF st IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_rule_tests_guard ON public.taxguard_tax_rule_set_tests;
CREATE TRIGGER trg_taxguard_tax_rule_tests_guard BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_tax_rule_set_tests FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_rule_tests_guard();
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_test_runs_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'TAX_RULE_TEST_RUN_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_rule_test_runs_guard ON public.taxguard_tax_rule_set_test_runs;
CREATE TRIGGER trg_taxguard_tax_rule_test_runs_guard BEFORE UPDATE OR DELETE ON public.taxguard_tax_rule_set_test_runs FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_rule_test_runs_guard();

-- Canonical hash of a rule set's current case set (order-independent).
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_tests_hash(p_tenant text, p_rule_set uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT encode(sha256(convert_to(COALESCE(string_agg(t.test_id::text || ':' || md5(t.inputs::text || '|' || t.expected::text || '|' || COALESCE(t.filing_status, '')), ',' ORDER BY t.test_id), ''), 'UTF8')), 'hex')
  FROM public.taxguard_tax_rule_set_tests t WHERE t.tenant_id = p_tenant AND t.rule_set_id = p_rule_set $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_require_passing_tests(p_tenant text, s public.taxguard_tax_rule_sets) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE h text := public.taxguard_tax_rule_tests_hash(p_tenant, s.rule_set_id); latest public.taxguard_tax_rule_set_test_runs;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.taxguard_tax_rule_set_tests WHERE tenant_id = p_tenant AND rule_set_id = s.rule_set_id) THEN
    RAISE EXCEPTION 'TAX_RULE_SET_TESTS_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO latest FROM public.taxguard_tax_rule_set_test_runs WHERE tenant_id = p_tenant AND rule_set_id = s.rule_set_id
    AND content_sha256 = s.content_sha256 AND tests_sha256 = h ORDER BY run_at DESC, run_id DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_TESTS_NOT_RUN' USING ERRCODE = 'P0001'; END IF;
  IF NOT latest.all_passed THEN RAISE EXCEPTION 'TAX_RULE_SET_TESTS_FAILING' USING ERRCODE = 'P0001'; END IF;
END $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_test_add(p_tenant text, p_actor text, p_rule_set uuid, p_test jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_tax_rule_sets; t public.taxguard_tax_rule_set_tests; yr integer;
BEGIN
  r := public.taxguard_tax_actor(p_tenant, p_actor, 'maintain');
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF s.status <> 'DRAFT' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
  -- The expectation must come from a source verified for this tax year.
  IF cardinality(public.taxguard_tax_unverified_sources(p_tenant, ARRAY[p_test->>'sourceId'], s.tax_year)) > 0 THEN
    RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = p_test->>'sourceId';
  END IF;
  BEGIN
    INSERT INTO public.taxguard_tax_rule_set_tests(tenant_id, rule_set_id, name, filing_status, inputs, expected, source_id, citation, created_by)
    VALUES (p_tenant, p_rule_set, btrim(p_test->>'name'), NULLIF(p_test->>'filingStatus', ''), p_test->'inputs', p_test->'expected', p_test->>'sourceId', btrim(p_test->>'citation'), p_actor)
    RETURNING * INTO t;
  EXCEPTION WHEN check_violation OR not_null_violation OR string_data_right_truncation OR foreign_key_violation THEN
    RAISE EXCEPTION 'TAX_RULE_TEST_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, r, 'TAX_RULE_TEST_ADDED', jsonb_build_object('ruleSetId', p_rule_set, 'testId', t.test_id, 'sourceId', t.source_id));
  RETURN jsonb_build_object('testId', t.test_id, 'name', t.name, 'testsSha256', public.taxguard_tax_rule_tests_hash(p_tenant, p_rule_set));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_test_remove(p_tenant text, p_actor text, p_rule_set uuid, p_test uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_tax_actor(p_tenant, p_actor, 'maintain');
  DELETE FROM public.taxguard_tax_rule_set_tests WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set AND test_id = p_test;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_TEST_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, r, 'TAX_RULE_TEST_REMOVED', jsonb_build_object('ruleSetId', p_rule_set, 'testId', p_test));
  RETURN jsonb_build_object('testId', p_test, 'removed', true);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_test_list(p_tenant text, p_actor text, p_rule_set uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  PERFORM public.taxguard_tax_actor(p_tenant, p_actor, 'read');
  RETURN jsonb_build_object('testsSha256', public.taxguard_tax_rule_tests_hash(p_tenant, p_rule_set),
    'tests', (SELECT COALESCE(jsonb_agg(jsonb_build_object('testId', t.test_id, 'name', t.name, 'filingStatus', t.filing_status, 'inputs', t.inputs, 'expected', t.expected,
      'sourceId', t.source_id, 'citation', t.citation, 'createdBy', t.created_by) ORDER BY t.created_at, t.test_id), '[]'::jsonb)
      FROM public.taxguard_tax_rule_set_tests t WHERE t.tenant_id = p_tenant AND t.rule_set_id = p_rule_set),
    'latestRun', (SELECT jsonb_build_object('runId', x.run_id, 'contentSha256', x.content_sha256, 'testsSha256', x.tests_sha256, 'engineVersion', x.engine_version,
      'testCount', x.test_count, 'passedCount', x.passed_count, 'allPassed', x.all_passed, 'results', x.results, 'runBy', x.run_by, 'runAt', x.run_at)
      FROM public.taxguard_tax_rule_set_test_runs x WHERE x.tenant_id = p_tenant AND x.rule_set_id = p_rule_set ORDER BY x.run_at DESC, x.run_id DESC LIMIT 1));
END $$;

-- Records the server's run of every case. The case-set hash is recomputed here and must match the
-- hash the server ran against, so a run can never be attributed to a different case set.
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_test_run_record(p_tenant text, p_actor text, p_rule_set uuid, p_run jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_tax_rule_sets; h text; run public.taxguard_tax_rule_set_test_runs; n integer;
BEGIN
  r := public.taxguard_tax_actor(p_tenant, p_actor, 'maintain');
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  h := public.taxguard_tax_rule_tests_hash(p_tenant, p_rule_set);
  SELECT count(*) INTO n FROM public.taxguard_tax_rule_set_tests WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set;
  IF p_run->>'contentSha256' IS DISTINCT FROM s.content_sha256 THEN RAISE EXCEPTION 'TAX_RULE_SET_INTEGRITY' USING ERRCODE = 'P0001'; END IF;
  IF p_run->>'testsSha256' IS DISTINCT FROM h OR (p_run->>'testCount')::integer IS DISTINCT FROM n THEN RAISE EXCEPTION 'TAX_RULE_TESTS_CHANGED' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_tax_rule_set_test_runs(tenant_id, rule_set_id, content_sha256, tests_sha256, engine_version, test_count, passed_count, results, run_by)
    VALUES (p_tenant, p_rule_set, s.content_sha256, h, p_run->>'engineVersion', n, (p_run->>'passedCount')::integer, p_run->'results', p_actor) RETURNING * INTO run;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, r, 'TAX_RULE_TESTS_RUN', jsonb_build_object('ruleSetId', p_rule_set, 'runId', run.run_id,
    'testCount', run.test_count, 'passedCount', run.passed_count, 'allPassed', run.all_passed));
  RETURN jsonb_build_object('runId', run.run_id, 'testCount', run.test_count, 'passedCount', run.passed_count, 'allPassed', run.all_passed);
END $$;
-- ------------------------------------------------------------------------------------------
-- Superseding definition of the proposal 033 transition (generated with anchored patches): submit and
-- approve additionally require a recorded, all-passing verification run for the current content.
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_tax_rule_set_transition(p_tenant text, p_actor text, p_rule_set uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_tax_rule_sets; missing text[];
BEGIN
  r := public.taxguard_tax_actor(p_tenant, p_actor, CASE WHEN p_action = 'submit' THEN 'maintain' ELSE 'review' END);
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  missing := public.taxguard_tax_unverified_sources(p_tenant, s.source_ids, s.tax_year);
  IF p_action = 'submit' THEN
    IF s.status <> 'DRAFT' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_DRAFT' USING ERRCODE = 'P0001'; END IF;
    IF s.prepared_by <> p_actor AND NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'TAX_CONTENT_ROLE_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
    PERFORM public.taxguard_tax_require_passing_tests(p_tenant, s);
    UPDATE public.taxguard_tax_rule_sets SET status = 'PENDING_REVIEW', submitted_at = now() WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set RETURNING * INTO s;
  ELSIF p_action IN ('approve','reject') THEN
    IF s.status <> 'PENDING_REVIEW' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_PENDING' USING ERRCODE = 'P0001'; END IF;
    IF s.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'reject' AND length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'TAX_RULE_SET_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'approve' THEN
      IF cardinality(missing) > 0 THEN RAISE EXCEPTION 'TAX_SOURCE_NOT_VERIFIED' USING ERRCODE = 'P0001', DETAIL = array_to_string(missing, ','); END IF;
      PERFORM public.taxguard_tax_require_passing_tests(p_tenant, s);
      UPDATE public.taxguard_tax_rule_sets SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND jurisdiction = s.jurisdiction AND jurisdiction_code = s.jurisdiction_code
        AND return_family = s.return_family AND tax_year = s.tax_year AND status = 'APPROVED';
    END IF;
    UPDATE public.taxguard_tax_rule_sets SET status = CASE p_action WHEN 'approve' THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(),
      review_note = NULLIF(btrim(COALESCE(p_note, '')), '') WHERE tenant_id = p_tenant AND rule_set_id = p_rule_set RETURNING * INTO s;
  ELSE RAISE EXCEPTION 'TAX_RULE_SET_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.taxguard_tax_audit(p_tenant, NULL, p_actor, r, 'TAX_RULE_SET_' || upper(p_action) || CASE WHEN p_action = 'submit' THEN 'TED' ELSE 'D' END,
    jsonb_build_object('ruleSetId', p_rule_set, 'version', s.version, 'sha256', s.content_sha256));
  RETURN public.taxguard_tax_rule_set_json(s, false);
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_tax_rule_tests_hash','taxguard_tax_require_passing_tests','taxguard_tax_rule_test_add',
        'taxguard_tax_rule_test_remove','taxguard_tax_rule_test_list','taxguard_tax_rule_test_run_record','taxguard_tax_rule_set_transition') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_tax_rule_test_add','taxguard_tax_rule_test_remove','taxguard_tax_rule_test_list','taxguard_tax_rule_test_run_record','taxguard_tax_rule_set_transition') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
