-- PROPOSAL (Phase 14, evidence-to-conclusion lineage for calculation runs). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 026 (case workflow), 027 (document vault: taxguard_documents, taxguard_extracted_data and its decision
-- columns), 033 (tax engine foundation: taxguard_tax_calc_runs and the current definition of taxguard_tax_run_record),
-- 20261018060000 (engagement-scoped access) and 20261018090000 (current definition of taxguard_tax_run_review).
--
-- Every calculation input carries evidenceIds, but the database stored them as free text: nothing tied an input to the
-- document or reviewed value it came from, so a reviewer could approve a run whose cited evidence did not exist. Each
-- citation must now name durable evidence of the case's client, engagement and tax year:
--   extraction:<field uuid>  an extracted value staff ACCEPTED or CORRECTED, on the current version of a reviewed
--                            (VERIFIED) document; its decided value must equal the input exactly (numerically).
--   document:<document id>   the current version of a reviewed (VERIFIED), clean document. The value is the preparer's
--                            reading of it and is confirmed by the reviewer's approval, not by the database.
-- Recording a run refuses unresolved citations (TAX_CALC_EVIDENCE_UNRESOLVED, detail factPath|ref|reason). Approval
-- resolves them again, since a document can be superseded or rejected after the run, and records what each citation
-- resolved to in taxguard_tax_calc_input_lineage, which never changes. Rejection records nothing. A replayed run is
-- returned unchanged, as before. Synthetic data only in tests; returnUse stays BLOCKED.
-- FOR OWNER REVIEW: whether document-level citations (value not machine-checked) are acceptable evidence for an input,
-- or only decided extracted values should be.
-- Rollback (development): re-apply the 033 definition of taxguard_tax_run_record and the 20261018090000 definition of
-- taxguard_tax_run_review, then drop taxguard_tax_run_lineage, taxguard_tax_evidence_resolve and the lineage table.

CREATE TABLE IF NOT EXISTS public.taxguard_tax_calc_input_lineage (
  tenant_id VARCHAR(128) NOT NULL,
  run_id UUID NOT NULL,
  fact_path VARCHAR(128) NOT NULL,
  evidence_ref VARCHAR(128) NOT NULL,
  kind VARCHAR(16) NOT NULL CHECK (kind IN ('EXTRACTION','DOCUMENT')),
  resolution JSONB NOT NULL,
  recorded_by VARCHAR(128) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, run_id, fact_path, evidence_ref),
  FOREIGN KEY (tenant_id, run_id) REFERENCES public.taxguard_tax_calc_runs(tenant_id, run_id)
);
ALTER TABLE public.taxguard_tax_calc_input_lineage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_tax_calc_input_lineage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.taxguard_tax_lineage_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'TAX_CALC_LINEAGE_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_tax_lineage_immutable ON public.taxguard_tax_calc_input_lineage;
CREATE TRIGGER trg_taxguard_tax_lineage_immutable BEFORE UPDATE OR DELETE ON public.taxguard_tax_calc_input_lineage
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_tax_lineage_immutable();

-- What one citation resolves to now, for the case's scope. Unresolved citations return {"unresolved": reason}.
CREATE OR REPLACE FUNCTION public.taxguard_tax_evidence_resolve(p_case public.taxguard_cases, p_ref text, p_value text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE c public.taxguard_cases := p_case; e public.taxguard_extracted_data; d public.taxguard_documents; decided text; current_version integer;
BEGIN
  IF p_ref ~ '^extraction:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO e FROM public.taxguard_extracted_data WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND id = substr(p_ref, 12)::uuid;
    IF NOT FOUND THEN RETURN jsonb_build_object('unresolved', 'NOT_FOUND'); END IF;
    SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND document_id = e.document_id AND version = e.document_version;
    IF NOT FOUND OR d.engagement_id IS DISTINCT FROM c.engagement_id OR d.tax_year IS DISTINCT FROM c.tax_year THEN RETURN jsonb_build_object('unresolved', 'OUT_OF_SCOPE'); END IF;
    IF e.decision IS NULL THEN RETURN jsonb_build_object('unresolved', 'NOT_DECIDED'); END IF;
    IF e.decision = 'REJECTED' THEN RETURN jsonb_build_object('unresolved', 'VALUE_REJECTED'); END IF;
  ELSIF p_ref ~ '^document:[A-Za-z0-9_-]{1,119}$' THEN
    SELECT * INTO d FROM public.taxguard_documents WHERE tenant_id = c.tenant_id AND client_id = c.client_id AND document_id = substr(p_ref, 10)
      ORDER BY version DESC LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('unresolved', 'NOT_FOUND'); END IF;
    IF d.engagement_id IS DISTINCT FROM c.engagement_id OR d.tax_year IS DISTINCT FROM c.tax_year THEN RETURN jsonb_build_object('unresolved', 'OUT_OF_SCOPE'); END IF;
  ELSE
    RETURN jsonb_build_object('unresolved', 'UNRECOGNISED_REFERENCE');
  END IF;
  SELECT max(version) INTO current_version FROM public.taxguard_documents WHERE tenant_id = d.tenant_id AND client_id = d.client_id AND document_id = d.document_id;
  IF d.version <> current_version THEN RETURN jsonb_build_object('unresolved', 'DOCUMENT_SUPERSEDED'); END IF;
  IF d.status <> 'VERIFIED' OR d.quarantine_status <> 'CLEAN' THEN RETURN jsonb_build_object('unresolved', 'DOCUMENT_NOT_REVIEWED'); END IF;
  IF e.id IS NULL THEN
    RETURN jsonb_build_object('kind', 'DOCUMENT', 'documentId', d.document_id, 'documentVersion', d.version, 'documentSha256', d.hash);
  END IF;
  decided := e.verified_value #>> '{}';
  IF decided IS NULL OR p_value IS NULL OR decided !~ '^-?[0-9]{1,15}(\.[0-9]{1,10})?$' OR p_value !~ '^-?[0-9]{1,15}(\.[0-9]{1,10})?$'
      OR decided::numeric <> p_value::numeric THEN
    RETURN jsonb_build_object('unresolved', 'VALUE_MISMATCH');
  END IF;
  RETURN jsonb_build_object('kind', 'EXTRACTION', 'fieldId', e.id, 'fieldKey', e.field_key, 'decision', e.decision, 'decidedValue', decided,
    'decidedBy', e.verified_by, 'documentId', d.document_id, 'documentVersion', d.version, 'documentSha256', d.hash);
END $$;

-- Every citation of every input of a run, resolved now: [{factPath, value, ref, resolution}].
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_citations(p_case public.taxguard_cases, p_inputs jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('factPath', i->>'factPath', 'value', i->>'value', 'ref', ref,
      'resolution', public.taxguard_tax_evidence_resolve(p_case, ref, i->>'value')) ORDER BY i->>'factPath' COLLATE "C", ref COLLATE "C"), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_inputs) = 'array' THEN p_inputs ELSE '[]'::jsonb END) i
  CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(i->'evidenceIds') = 'array' THEN i->'evidenceIds' ELSE '[]'::jsonb END) ref $$;

-- factPath|ref|reason for each unresolved citation, or NULL when every input cites resolved evidence.
CREATE OR REPLACE FUNCTION public.taxguard_tax_unresolved_citations(p_citations jsonb) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT string_agg(x->>'factPath' || '|' || (x->>'ref') || '|' || (x->'resolution'->>'unresolved'), ',' ORDER BY x->>'factPath' COLLATE "C", x->>'ref' COLLATE "C")
  FROM jsonb_array_elements(p_citations) x WHERE x->'resolution' ? 'unresolved' $$;

-- Current definition: 20261012330000. Changed: unresolved citations are refused before a new run is recorded.
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_record(p_tenant text, p_actor text, p_case text, p_run jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; c public.taxguard_cases; s public.taxguard_tax_rule_sets; existing public.taxguard_tax_calc_runs; run public.taxguard_tax_calc_runs; unresolved text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = p_case;
  IF NOT FOUND OR NOT (p_actor IN (c.preparer_uid, c.reviewer_uid)) THEN RAISE EXCEPTION 'TAX_CALC_CASE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

-- Current definition: 20261018090000. Changed: approval re-resolves every citation, refuses unresolved ones and records
-- the lineage in the same transaction. Who may review, maker-checker and the note rule are unchanged and checked first.
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_review(p_tenant text, p_actor text, p_run uuid, p_decision text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; run public.taxguard_tax_calc_runs; c public.taxguard_cases; citations jsonb; unresolved text; recorded integer := 0;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO run FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND run_id = p_run FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_CALC_RUN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = run.case_id;
  IF p_actor IS DISTINCT FROM c.reviewer_uid OR NOT public.taxguard_case_slot_live(p_tenant, c.client_id, c.engagement_id, c.tax_year, c.preparer_uid, c.reviewer_uid, p_actor) THEN RAISE EXCEPTION 'TAX_CALC_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_actor = run.requested_by THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF run.status <> 'COMPUTED' THEN RAISE EXCEPTION 'TAX_CALC_ALREADY_REVIEWED' USING ERRCODE = 'P0001'; END IF;
  IF p_decision NOT IN ('approve','reject') OR length(btrim(COALESCE(p_note, ''))) < 10 THEN RAISE EXCEPTION 'TAX_CALC_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p_decision = 'approve' THEN
    citations := public.taxguard_tax_run_citations(c, run.inputs);
    unresolved := public.taxguard_tax_unresolved_citations(citations);
    IF unresolved IS NOT NULL OR jsonb_array_length(citations) = 0 THEN
      RAISE EXCEPTION 'TAX_CALC_EVIDENCE_UNRESOLVED' USING ERRCODE = 'P0001', DETAIL = COALESCE(unresolved, 'no citations');
    END IF;
    INSERT INTO public.taxguard_tax_calc_input_lineage(tenant_id, run_id, fact_path, evidence_ref, kind, resolution, recorded_by)
      SELECT p_tenant, p_run, x->>'factPath', x->>'ref', x->'resolution'->>'kind', x->'resolution', p_actor FROM jsonb_array_elements(citations) x;
    GET DIAGNOSTICS recorded = ROW_COUNT;
  END IF;
  UPDATE public.taxguard_tax_calc_runs SET status = CASE p_decision WHEN 'approve' THEN 'REVIEW_APPROVED' ELSE 'REVIEW_REJECTED' END, reviewed_by = p_actor, reviewed_at = now(),
      review_note = btrim(p_note) WHERE tenant_id = p_tenant AND run_id = p_run RETURNING * INTO run;
  PERFORM public.taxguard_tax_audit(p_tenant, run.client_id, p_actor, r, 'TAX_CALC_' || upper(p_decision) || 'D', jsonb_build_object('runId', p_run, 'caseId', run.case_id,
    'lineageRecorded', recorded));
  RETURN (to_jsonb(run) - 'tenant_id') || jsonb_build_object('returnUse', 'BLOCKED', 'lineageRecorded', recorded);
END $$;

-- The evidence behind each input of a run. Approved runs return the recorded lineage; other runs return what each
-- citation resolves to now. Same readers as taxguard_tax_run_list (the case's preparer and reviewer, and managers).
CREATE OR REPLACE FUNCTION public.taxguard_tax_run_lineage(p_tenant text, p_actor text, p_run uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; run public.taxguard_tax_calc_runs; c public.taxguard_cases; citations jsonb;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  SELECT * INTO run FROM public.taxguard_tax_calc_runs WHERE tenant_id = p_tenant AND run_id = p_run;
  IF NOT FOUND THEN RAISE EXCEPTION 'TAX_CALC_RUN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_cases WHERE tenant_id = p_tenant AND case_id = run.case_id;
  IF NOT FOUND OR NOT (p_actor IN (c.preparer_uid, c.reviewer_uid) OR public.taxguard_practice_is_manager(r)) THEN RAISE EXCEPTION 'TAX_CALC_RUN_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

REVOKE ALL ON FUNCTION public.taxguard_tax_evidence_resolve(public.taxguard_cases, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.taxguard_tax_run_citations(public.taxguard_cases, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.taxguard_tax_unresolved_citations(jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.taxguard_tax_lineage_immutable() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.taxguard_tax_run_record(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.taxguard_tax_run_review(text, text, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.taxguard_tax_run_lineage(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_tax_run_record(text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_tax_run_review(text, text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_tax_run_lineage(text, text, uuid) TO service_role;
