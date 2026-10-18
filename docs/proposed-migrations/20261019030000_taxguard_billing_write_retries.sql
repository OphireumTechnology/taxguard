-- DEVELOPMENT PROPOSAL ONLY. NOT APPLIED. Depends on 028/058.
-- Existing business functions remain unchanged but become internal to keyed wrappers.
-- Rollback: disable affected writes; retain operation receipts for review/recovery.
CREATE TABLE IF NOT EXISTS public.taxguard_billing_write_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL,
  actor_uid varchar(128) NOT NULL, operation text NOT NULL CHECK(operation IN('ADD_LINE','CREDIT_REQUEST')),
  idempotency_key varchar(128) NOT NULL CHECK(idempotency_key ~ '^[A-Za-z0-9_.:-]{8,128}$'),
  request jsonb NOT NULL CHECK(jsonb_typeof(request)='object'), result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,operation,idempotency_key),
  FOREIGN KEY(tenant_id,client_id) REFERENCES public.taxguard_clients(tenant_id,client_id) ON DELETE RESTRICT
);
ALTER TABLE public.taxguard_billing_write_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_billing_write_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.taxguard_bill_retry_result(p_tenant text,p_client text,p_actor text,p_operation text,p_key text,p_request jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE prior public.taxguard_billing_write_receipts;
BEGIN
  IF public.taxguard_bill_actor(p_tenant,p_client,p_actor)='client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF p_operation NOT IN('ADD_LINE','CREDIT_REQUEST') THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('billing-write',p_tenant,p_operation,p_key)::text,0));
  IF public.taxguard_bill_actor(p_tenant,p_client,p_actor)='client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO prior FROM public.taxguard_billing_write_receipts WHERE tenant_id=p_tenant AND operation=p_operation AND idempotency_key=p_key;
  IF FOUND THEN
    IF (prior.client_id,prior.actor_uid,prior.request) IS NOT DISTINCT FROM (p_client,p_actor,p_request) THEN RETURN prior.result; END IF;
    RAISE EXCEPTION 'BILLING_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001';
  END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_bill_retry_save(p_tenant text,p_client text,p_actor text,p_operation text,p_key text,p_request jsonb,p_result jsonb) RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  INSERT INTO public.taxguard_billing_write_receipts(tenant_id,client_id,actor_uid,operation,idempotency_key,request,result)
    VALUES(p_tenant,p_client,p_actor,p_operation,p_key,p_request,p_result) RETURNING id
$$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_add_line_once(p_tenant text,p_client text,p_actor text,p_invoice text,p_service text,p_quantity numeric,p_rate numeric,p_description text,p_override_reason text,p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE request jsonb; result jsonb; receipt uuid; before public.taxguard_invoices; k text;
BEGIN
  request:=jsonb_build_object('invoiceId',p_invoice,'serviceCode',p_service,'quantity',p_quantity,'rate',p_rate,'description',p_description,'overrideReason',p_override_reason);
  result:=public.taxguard_bill_retry_result(p_tenant,p_client,p_actor,'ADD_LINE',p_key,request);
  IF result IS NOT NULL THEN RETURN result; END IF;
  before:=public.taxguard_bill_load(p_tenant,p_client,p_invoice,true);
  result:=public.taxguard_bill_add_line(p_tenant,p_client,p_actor,p_invoice,p_service,p_quantity,p_rate,p_description,p_override_reason);
  receipt:=public.taxguard_bill_retry_save(p_tenant,p_client,p_actor,'ADD_LINE',p_key,request,result);
  k:=public.taxguard_bill_actor(p_tenant,p_client,p_actor);
  PERFORM public.taxguard_bill_audit(p_tenant,p_client,p_actor,k,'BILLING_INVOICE_LINE_ADDED',jsonb_build_object('invoiceId',p_invoice,'operationReceiptId',receipt,
    'before',jsonb_build_object('subtotal',public.taxguard_bill_text(before.subtotal),'total',public.taxguard_bill_text(before.total)),
    'after',jsonb_build_object('subtotal',result->>'subtotal','total',result->>'total')));
  RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_bill_request_credit_once(p_tenant text,p_client text,p_actor text,p_invoice text,p_amount numeric,p_reason text,p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE request jsonb; result jsonb; receipt uuid; k text;
BEGIN
  request:=jsonb_build_object('invoiceId',p_invoice,'amount',p_amount,'reason',btrim(COALESCE(p_reason,'')));
  result:=public.taxguard_bill_retry_result(p_tenant,p_client,p_actor,'CREDIT_REQUEST',p_key,request);
  IF result IS NOT NULL THEN RETURN result; END IF;
  PERFORM public.taxguard_bill_load(p_tenant,p_client,p_invoice,true);
  result:=public.taxguard_bill_request_credit(p_tenant,p_client,p_actor,p_invoice,p_amount,p_reason);
  receipt:=public.taxguard_bill_retry_save(p_tenant,p_client,p_actor,'CREDIT_REQUEST',p_key,request,result);
  k:=public.taxguard_bill_actor(p_tenant,p_client,p_actor);
  PERFORM public.taxguard_bill_audit(p_tenant,p_client,p_actor,k,'BILLING_CREDIT_REQUEST_RECEIPTED',
    jsonb_build_object('invoiceId',p_invoice,'creditId',result->>'creditId','operationReceiptId',receipt));
  RETURN result;
END $$;
-- The legacy implementations are callable only by the definer, never directly by API roles.
REVOKE ALL ON FUNCTION public.taxguard_bill_add_line(text,text,text,text,text,numeric,numeric,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_bill_request_credit(text,text,text,text,numeric,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_bill_retry_result(text,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_bill_retry_save(text,text,text,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_bill_add_line_once(text,text,text,text,text,numeric,numeric,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.taxguard_bill_request_credit_once(text,text,text,text,numeric,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_add_line_once(text,text,text,text,text,numeric,numeric,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_request_credit_once(text,text,text,text,numeric,text,text) TO service_role;
