-- DEVELOPMENT PROPOSAL ONLY. NOT APPLIED TO A HOSTED DATABASE.
-- Depends on billing 028 and access overlay 058. Preserve historical proposals.
-- Serialize first submissions as well as retries; the existing tenant/key unique index remains
-- the durable uniqueness authority. No financial amounts or accounting transitions change.
CREATE OR REPLACE FUNCTION public.taxguard_bill_create_invoice(
  p_tenant text, p_client text, p_actor text, p_key text, p_engagement text, p_due date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; existing public.taxguard_invoices; id text;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k = 'client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' OR p_due IS NULL THEN
    RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  -- JSON framing avoids ambiguity between tenant/key boundaries. Hash collisions only cause
  -- extra serialization: the unique index and full scoped comparisons still decide identity.
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('billing-invoice', p_tenant, p_key)::text, 0));
  -- Recheck current authorization after waiting; possession of a key is never authorization.
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k = 'client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO existing FROM public.taxguard_invoices WHERE tenant_id = p_tenant AND idempotency_key = p_key;
  IF FOUND THEN
    IF existing.client_id = p_client AND existing.prepared_by = p_actor
       AND existing.engagement_id IS NOT DISTINCT FROM p_engagement AND existing.due_date = p_due THEN
      RETURN jsonb_build_object('invoiceId', existing.id, 'created', false);
    END IF;
    RAISE EXCEPTION 'BILLING_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF p_engagement IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.taxguard_engagements
    WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement
  ) THEN RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  id := 'inv_' || encode(sha256(convert_to(jsonb_build_array(p_tenant, p_key)::text, 'UTF8')), 'hex');
  INSERT INTO public.taxguard_invoices(id, tenant_id, client_id, engagement_id, invoice_number, status, due_date, created_by, prepared_by, idempotency_key)
    VALUES (left(id, 68), p_tenant, p_client, p_engagement, 'DRAFT-' || left(id, 24), 'DRAFT', p_due, p_actor, p_actor, p_key);
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_INVOICE_DRAFTED', jsonb_build_object('invoiceId', left(id, 68)));
  RETURN jsonb_build_object('invoiceId', left(id, 68), 'created', true);
END $$;
REVOKE ALL ON FUNCTION public.taxguard_bill_create_invoice(text,text,text,text,text,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_create_invoice(text,text,text,text,text,date) TO service_role;
