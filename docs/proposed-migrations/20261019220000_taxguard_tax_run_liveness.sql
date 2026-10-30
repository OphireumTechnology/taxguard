-- PROPOSAL (Block 79, live assignment for calculation runs). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires 20261018090000 (taxguard_case_slot_live) and 20261018190000, which holds the current definitions below.
--
-- Regression found by the function access inventory (src/tests-db/functionAccessInventory.db.test.ts):
-- 20261018090000 made taxguard_tax_run_record require the live preparer or reviewer assignment. 20261018190000 then
-- redefined it from the older 033 definition, which trusted the name recorded on the case, so the liveness check was
-- lost; its new taxguard_tax_run_lineage trusted the recorded name as well. A preparer or reviewer whose assignment was
-- revoked or had expired, but who was still named on the case, could therefore record a calculation run on the case
-- and read a run's evidence lineage (input values and the documents they cite).
--
-- What changes: both functions require taxguard_case_slot_live, as taxguard_tax_run_list and taxguard_tax_run_review
-- already do. Refusals keep the existing not-found codes (TAX_CALC_CASE_NOT_FOUND, TAX_CALC_RUN_NOT_FOUND), so an
-- out-of-scope case or run stays indistinguishable from a missing one. Practice managers keep lineage access.
-- Each function below is identical to its current definition except for that check.
-- Rollback (development): re-apply the 20261018190000 definitions.

-- Current definition: 20261018190000. Changed: the named preparer or reviewer needs the live assignment.
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_record(p_tenant text, p_actor text, p_case text, p_run jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases; s public.taxguard_tax_rule_sets; existing public.taxguard_tax_calc_runs; run public.taxguard_tax_calc_runs; unresolved text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case;
  IF NOT FOUND OR NOT public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) THEN
    RAISE EXCEPTION 'TAX_CALC_CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO s FROM public.taxguard_tax_rule_sets WHERE tenant_id = p_tenant AND rule_set_id = (p_run->>'ruleSetId')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF s.status <> 'APPROVED' THEN RAISE EXCEPTION 'TAX_RULE_SET_NOT_APPROVED' USING ERRCODE = 'P0001'; END IF;
  IF s.content_sha256 <> p_run->>'ruleSetSha256' THEN RAISE EXCEPTION 'TAX_RULE_SET_INTEGRITY' USING ERRCODE = 'P0001'; END IF;
  IF s.tax_year <> c.tax_year THEN RAISE EXCEPTION 'TAX_CALC_TAX_YEAR_MISMATCH' USING ERRCODE = 'P0001'; END IF;
  IF COALESCE(p_run->>'inputSha256', '') !~ '^[a-f0-9]{64}$' OR COALESCE(p_run->>'outputSha256', '') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'TAX_CALC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO existing FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND case_id = p_case AND rule_set_id = s.rule_set_id AND input_sha256 = p_run->>'inputSha256';
  IF FOUND THEN
    IF existing.output_sha256 <> p_run->>'outputSha256' OR existing.engine_version <> p_run->>'engineVersion' THEN
      -- Returned (not raised) so the refusal's audit row is committed; nothing else changes.
      PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, r, 'TAX_CALC_NONDETERMINISM_REFUSED', jsonb_build_object('runId', existing.run_id, 'caseId', p_case,
        'recordedOutputSha256', existing.output_sha256, 'offeredOutputSha256', p_run->>'outputSha256'));
      RETURN jsonb_build_object('refused', 'TAX_ENGINE_NONDETERMINISM', 'runId', existing.run_id);
    END IF;
    RETURN (to_jsonb(existing) - 'tenant_id') || jsonb_build_object('replayed', true, 'returnUse', 'BLOCKED');
  END IF;
  unresolved := public.taxguard_tax_unresolved_citations(public.taxguard_tax_run_citations(c, p_run->'inputs'));
  IF unresolved IS NOT NULL THEN RAISE EXCEPTION 'TAX_CALC_EVIDENCE_UNRESOLVED' USING ERRCODE = 'P0001', DETAIL = unresolved; END IF;
  INSERT INTO public.taxguard_tax_calc_runs(tenant_id, client_id, case_id, tax_year, rule_set_id, rule_set_sha256, engine_version, input_sha256, output_sha256, filing_status,
      inputs, outputs, trace, synthetic, requested_by)
    VALUES (p_tenant, c.client_id, p_case, c.tax_year, s.rule_set_id, s.content_sha256, p_run->>'engineVersion', p_run->>'inputSha256', p_run->>'outputSha256',
      NULLIF(p_run->>'filingStatus', ''), p_run->'inputs', p_run->'outputs', p_run->'trace', s.synthetic, p_actor) RETURNING * INTO run;
  PERFORM public.taxguard_tax_audit(p_tenant, c.client_id, p_actor, r, 'TAX_CALC_RECORDED', jsonb_build_object('runId', run.run_id, 'caseId', p_case,
    'ruleSetId', s.rule_set_id, 'ruleSetVersion', s.version, 'inputSha256', run.input_sha256, 'outputSha256', run.output_sha256, 'synthetic', s.synthetic));
  RETURN (to_jsonb(run) - 'tenant_id') || jsonb_build_object('replayed', false, 'returnUse', 'BLOCKED');
END $$;

-- Current definition: 20261018190000. Changed: the named preparer or reviewer needs the live assignment.
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_lineage(p_tenant text, p_actor text, p_run uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; run public.taxguard_tax_calc_runs; c public.taxguard_cases; citations jsonb;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO run FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND run_id = p_run;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_CALC_RUN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = run.case_id;
  IF NOT FOUND OR NOT (public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor)
      OR public.taxguard_practice_is_manager(r)) THEN
    RAISE EXCEPTION 'TAX_CALC_RUN_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF run.status = 'REVIEW_APPROVED' THEN
    citations := (SELECT COALESCE(jsonb_agg(jsonb_build_object('factPath', l.fact_path, 'value', (SELECT i->>'value' FROM jsonb_array_elements(run.inputs) i WHERE i->>'factPath' = l.fact_path LIMIT 1),
        'ref', l.evidence_ref, 'resolution', l.resolution, 'recordedBy', l.recorded_by, 'recordedAt', l.recorded_at) ORDER BY l.fact_path COLLATE "C", l.evidence_ref COLLATE "C"), '[]'::jsonb)
      FROM public.taxguard_tax_calc_input_lineage l WHERE l.tenant_id = p_tenant AND l.run_id = p_run);
  ELSE
    citations := public.taxguard_tax_run_citations(c, run.inputs);
  END IF;
  RETURN jsonb_build_object('runId', run.run_id, 'status', run.status, 'recorded', run.status = 'REVIEW_APPROVED',
    'complete', public.taxguard_tax_unresolved_citations(citations) IS NULL AND jsonb_array_length(citations) > 0, 'citations', citations, 'returnUse', 'BLOCKED');
END $$;

REVOKE ALL ON FUNCTION public.taxguard_tax_run_record(text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_tax_run_record(text,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_tax_run_lineage(text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_tax_run_lineage(text,text,uuid) TO service_role;
