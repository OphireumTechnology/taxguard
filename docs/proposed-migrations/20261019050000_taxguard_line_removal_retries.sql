-- DEVELOPMENT PROPOSAL ONLY. NOT APPLIED. Depends on keyed billing writes 20261019030000.
-- A delayed retry must not delete a new line which reused the removed line's number.
-- Rollback: disable line removal pending review; preserve receipts and audit history.
ALTER TABLE public.taxguard_billing_write_receipts DROP CONSTRAINT IF EXISTS taxguard_billing_write_receipts_operation_check;
ALTER TABLE public.taxguard_billing_write_receipts ADD CONSTRAINT taxguard_billing_write_receipts_operation_check
  CHECK(operation IN('ADD_LINE','CREDIT_REQUEST','REMOVE_LINE'));
CREATE OR REPLACE FUNCTION public.taxguard_bill_retry_result(p_tenant text,p_client text,p_actor text,p_operation text,p_key text,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE prior public.taxguard_billing_write_receipts;
BEGIN
  IF public.taxguard_bill_actor(p_tenant,p_client,p_actor)='client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF p_operation NOT IN('ADD_LINE','CREDIT_REQUEST','REMOVE_LINE') THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('billing-write',p_tenant,p_operation,p_key)::text,0));
  IF public.taxguard_bill_actor(p_tenant,p_client,p_actor)='client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO prior FROM public.taxguard_billing_write_receipts WHERE tenant_id=p_tenant AND operation=p_operation AND idempotency_key=p_key;
  IF FOUND THEN
    IF (prior.client_id,prior.actor_uid,prior.request) IS NOT DISTINCT FROM (p_client,p_actor,p_request) THEN RETURN prior.result; END IF;
    RAISE EXCEPTION 'BILLING_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001';
  END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_bill_remove_line_once(p_tenant text,p_client text,p_actor text,p_invoice text,p_line integer,p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE request jsonb; result jsonb; receipt uuid; before public.taxguard_invoices; k text;
BEGIN
  request:=jsonb_build_object('invoiceId',p_invoice,'lineNo',p_line);
  result:=public.taxguard_bill_retry_result(p_tenant,p_client,p_actor,'REMOVE_LINE',p_key,request);
  IF result IS NOT NULL THEN RETURN result; END IF;
  before:=public.taxguard_bill_load(p_tenant,p_client,p_invoice,true);
  result:=public.taxguard_bill_remove_line(p_tenant,p_client,p_actor,p_invoice,p_line);
  receipt:=public.taxguard_bill_retry_save(p_tenant,p_client,p_actor,'REMOVE_LINE',p_key,request,result);
  k:=public.taxguard_bill_actor(p_tenant,p_client,p_actor);
  PERFORM public.taxguard_bill_audit(p_tenant,p_client,p_actor,k,'BILLING_INVOICE_LINE_REMOVED',jsonb_build_object(
    'invoiceId',p_invoice,'lineNo',p_line,'operationReceiptId',receipt,
    'before',jsonb_build_object('subtotal',public.taxguard_bill_text(before.subtotal),'total',public.taxguard_bill_text(before.total)),
    'after',jsonb_build_object('subtotal',result->>'subtotal','total',result->>'total')));
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_bill_retry_result(text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_bill_remove_line(text,text,text,text,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_bill_remove_line_once(text,text,text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_remove_line_once(text,text,text,text,integer,text) TO service_role;
