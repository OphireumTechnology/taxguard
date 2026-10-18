-- DEVELOPMENT PROPOSAL ONLY. NOT APPLIED. Depends on book-to-tax proposal 029.
-- Preserve scoped uniqueness, exact integer cents, evidence verification and maker-checker.
-- Rollback: disable adjustment creation pending review; do not restore unbound retries.
CREATE OR REPLACE FUNCTION public.taxguard_b2t_prepare_adjustment(p_tenant text, p_client text, p_actor text, p_key text, p_body jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; fam text; yr integer; amt bigint; existing public.taxguard_b2t_adjustments; id uuid; doc text; descr text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' OR p_body IS NULL OR jsonb_typeof(p_body) <> 'object'
     OR jsonb_typeof(p_body->'amountCents') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  fam := public.taxguard_b2t_family(p_body->>'returnFamily');
  BEGIN yr := (p_body->>'taxYear')::integer; amt := (p_body->>'amountCents')::bigint;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END;
  descr := btrim(COALESCE(p_body->>'description', ''));
  IF yr IS NULL OR (p_body->>'amountCents')::numeric <> amt OR amt = 0 OR amt NOT BETWEEN -100000000000000 AND 100000000000000
     OR length(descr) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  doc := NULLIF(p_body->>'evidenceDocumentId', '');
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('b2t-adjustment', p_tenant, p_client, p_key)::text, 0));
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO existing FROM public.taxguard_b2t_adjustments
    WHERE tenant_id = p_tenant AND client_id = p_client AND idempotency_key = p_key;
  IF FOUND THEN
    IF (existing.prepared_by, existing.tax_year, existing.return_family, existing.category_code, existing.amount_cents,
        existing.adjustment_type, existing.description, existing.evidence_document_id)
       IS NOT DISTINCT FROM
       (p_actor, yr, fam, p_body->>'categoryCode', amt, p_body->>'adjustmentType', descr, doc) THEN
      RETURN jsonb_build_object('adjustmentId', existing.adjustment_id, 'replayed', true);
    END IF;
    RAISE EXCEPTION 'B2T_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF doc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_documents
      WHERE tenant_id = p_tenant AND client_id = p_client AND document_id = doc AND status = 'VERIFIED' AND quarantine_status = 'CLEAN') THEN
    RAISE EXCEPTION 'EVIDENCE_DOCUMENT_NOT_VERIFIED' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    INSERT INTO public.taxguard_b2t_adjustments(tenant_id, client_id, tax_year, return_family, category_code, amount_cents,
      adjustment_type, description, evidence_document_id, prepared_by, idempotency_key)
      VALUES (p_tenant, p_client, yr, fam, p_body->>'categoryCode', amt, p_body->>'adjustmentType', descr, doc, p_actor, p_key)
      RETURNING adjustment_id INTO id;
  EXCEPTION WHEN foreign_key_violation THEN RAISE EXCEPTION 'CATEGORY_NOT_FOUND' USING ERRCODE = 'P0001';
    WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, 'B2T_ADJUSTMENT_PREPARED',
    jsonb_build_object('adjustmentId', id, 'categoryCode', p_body->>'categoryCode'));
  RETURN jsonb_build_object('adjustmentId', id, 'replayed', false);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_b2t_prepare_adjustment(text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_b2t_prepare_adjustment(text,text,text,text,jsonb) TO service_role;
