-- PROPOSAL 058 ONLY. NOT APPLIED. Depends on 028/047/049.
-- Additive correction: raw billing table denial and fully bound scoped retries.
-- Preserves main 047 client allowlist, balances and sandbox restrictions. No live payments.
-- Rollback: disable billing mutations; never restore confidential raw grants.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['taxguard_service_catalog','taxguard_invoices','taxguard_invoice_lines','taxguard_invoice_payments','taxguard_invoice_counters','taxguard_service_price_history','taxguard_invoice_credits'] LOOP EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t); END LOOP; END $$;
CREATE OR REPLACE FUNCTION public.taxguard_bill_record_payment(p_tenant text, p_client text, p_actor text, p_invoice text, p_amount numeric, p_method text,
  p_key text, p_provider text, p_provider_txn text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; i public.taxguard_invoices; existing record; pid text; paid numeric;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF p_method NOT IN ('ACH','CHECK','WIRE','CARD_SANDBOX','MANUAL_ADJUSTMENT') OR p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' THEN
    RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  -- Clients may only pay through the sandbox provider; manual methods are recorded by managers.
  IF (k = 'client' AND p_method <> 'CARD_SANDBOX') OR (k = 'staff') OR (p_method = 'CARD_SANDBOX' AND (p_provider IS DISTINCT FROM 'sandbox' OR p_provider_txn IS NULL)) THEN
    RAISE EXCEPTION 'PAYMENT_NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p_invoice, true);
  SELECT * INTO existing FROM public.taxguard_invoice_payments WHERE tenant_id = p_tenant AND idempotency_key = p_key;
  IF FOUND THEN
    IF existing.invoice_id = i.id AND existing.client_id = p_client AND existing.amount = p_amount AND existing.recorded_by = p_actor AND existing.payment_method = p_method AND existing.provider IS NOT DISTINCT FROM p_provider AND existing.provider_transaction_id IS NOT DISTINCT FROM p_provider_txn THEN RETURN jsonb_build_object('paymentId', existing.id, 'replayed', true); END IF;
    RAISE EXCEPTION 'BILLING_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF i.status NOT IN ('ISSUED','PARTIALLY_PAID','PAST_DUE') THEN RAISE EXCEPTION 'INVOICE_NOT_PAYABLE' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_bill_money(p_amount, false);
  IF p_amount > i.balance_due THEN RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE' USING ERRCODE = 'P0001'; END IF;
  pid := 'pay_' || encode(sha256(convert_to(p_tenant || '|' || p_key, 'UTF8')), 'hex');
  BEGIN
    INSERT INTO public.taxguard_invoice_payments(id, tenant_id, invoice_id, client_id, amount, payment_method, status, provider, provider_transaction_id, idempotency_key, recorded_by)
      VALUES (left(pid, 68), p_tenant, i.id, p_client, p_amount, p_method, 'SETTLED', p_provider, p_provider_txn, p_key, p_actor);
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'DUPLICATE_PAYMENT' USING ERRCODE = 'P0001';
  END;
  paid := i.amount_paid + p_amount;
  UPDATE public.taxguard_invoices SET amount_paid = paid, balance_due = total - paid, status = CASE WHEN total - paid = 0 THEN 'PAID' ELSE 'PARTIALLY_PAID' END,
    row_version = row_version + 1, updated_at = now() WHERE id = i.id;
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_PAYMENT_RECORDED', jsonb_build_object('invoiceId', i.id, 'paymentId', left(pid, 68), 'amount', p_amount, 'method', p_method));
  RETURN jsonb_build_object('paymentId', left(pid, 68), 'replayed', false, 'invoice', public.taxguard_bill_view(k, public.taxguard_bill_load(p_tenant, p_client, i.id, false)));
END $$;
REVOKE ALL ON FUNCTION public.taxguard_bill_record_payment(text,text,text,text,numeric,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_record_payment(text,text,text,text,numeric,text,text,text,text) TO service_role;
-- No unissued void draft is client-visible; proposal 052 later adds bounded page reads.
CREATE OR REPLACE FUNCTION public.taxguard_bill_list(p_tenant text,p_client text,p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE k text;
BEGIN
 k:=public.taxguard_bill_actor(p_tenant,p_client,p_actor);
 RETURN(SELECT COALESCE(jsonb_agg(public.taxguard_bill_view(k,i) ORDER BY i.created_at DESC),'[]'::jsonb) FROM public.taxguard_invoices i
  WHERE i.tenant_id=p_tenant AND i.client_id=p_client AND(k<>'client' OR(i.approved_at IS NOT NULL AND i.status IN('ISSUED','PARTIALLY_PAID','PAID','PAST_DUE','VOID'))));
END $$;
REVOKE ALL ON FUNCTION public.taxguard_bill_list(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_list(text,text,text) TO service_role;
