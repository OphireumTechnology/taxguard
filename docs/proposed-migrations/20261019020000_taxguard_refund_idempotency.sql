-- DEVELOPMENT PROPOSAL ONLY. NOT APPLIED. Depends on billing access overlay 058.
-- Recording only: no processor calls or real money movement. Existing refund caps/roles remain.
-- Rollback: disable refunds pending review; retain receipts and audit evidence.
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_payment_refund_scope
  ON public.taxguard_invoice_payments(tenant_id,client_id,invoice_id,id);
CREATE TABLE IF NOT EXISTS public.taxguard_invoice_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL,
  invoice_id varchar(128) NOT NULL, payment_id varchar(128) NOT NULL,
  idempotency_key varchar(128) NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_.:-]{8,128}$'),
  amount numeric(15,2) NOT NULL CHECK (amount > 0), reason varchar(500) NOT NULL,
  recorded_by varchar(128) NOT NULL, result jsonb NOT NULL CHECK (jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id,idempotency_key),
  FOREIGN KEY(tenant_id,client_id,invoice_id,payment_id)
    REFERENCES public.taxguard_invoice_payments(tenant_id,client_id,invoice_id,id) ON DELETE RESTRICT
);
ALTER TABLE public.taxguard_invoice_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_invoice_refunds FROM PUBLIC,anon,authenticated,service_role;

-- Keep the legacy signature as a fail-closed compatibility boundary. A keyless partial refund
-- cannot safely be inferred from amount/reason: separate intentional refunds may be identical.
CREATE OR REPLACE FUNCTION public.taxguard_bill_refund(p_tenant text,p_client text,p_actor text,p_payment text,p_amount numeric,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF public.taxguard_bill_actor(p_tenant,p_client,p_actor) <> 'manager' THEN
    RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE='P0001'; END IF;
  RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='P0001';
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_refund(p_tenant text,p_client text,p_actor text,p_payment text,p_amount numeric,p_reason text,p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE k text; p public.taxguard_invoice_payments; i public.taxguard_invoices;
  existing public.taxguard_invoice_refunds; reason text:=btrim(COALESCE(p_reason,'')); rid uuid; outcome jsonb;
BEGIN
  k:=public.taxguard_bill_actor(p_tenant,p_client,p_actor);
  IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE='P0001'; END IF;
  IF length(reason) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE='P0001'; END IF;
  PERFORM public.taxguard_bill_money(p_amount,false);
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('billing-refund',p_tenant,p_key)::text,0));
  k:=public.taxguard_bill_actor(p_tenant,p_client,p_actor);
  IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE='P0001'; END IF;
  SELECT * INTO existing FROM public.taxguard_invoice_refunds WHERE tenant_id=p_tenant AND idempotency_key=p_key;
  IF FOUND THEN
    IF (existing.client_id,existing.payment_id,existing.amount,existing.reason,existing.recorded_by)
      IS NOT DISTINCT FROM (p_client,p_payment,p_amount,reason,p_actor) THEN RETURN existing.result; END IF;
    RAISE EXCEPTION 'BILLING_IDEMPOTENCY_CONFLICT' USING ERRCODE='P0001';
  END IF;
  SELECT * INTO p FROM public.taxguard_invoice_payments WHERE id=p_payment AND tenant_id=p_tenant AND client_id=p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE='P0001'; END IF;
  IF p.refunded_amount+p_amount > p.amount THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT' USING ERRCODE='P0001'; END IF;
  i:=public.taxguard_bill_load(p_tenant,p_client,p.invoice_id,true);
  UPDATE public.taxguard_invoice_payments SET refunded_amount=refunded_amount+p_amount,
    status=CASE WHEN refunded_amount+p_amount=amount THEN 'REFUNDED' ELSE status END WHERE id=p.id;
  UPDATE public.taxguard_invoices SET amount_paid=amount_paid-p_amount,balance_due=total-(amount_paid-p_amount),
    status=CASE WHEN amount_paid-p_amount=0 THEN 'ISSUED' ELSE 'PARTIALLY_PAID' END,row_version=row_version+1,updated_at=now() WHERE id=i.id;
  outcome:=public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant,p_client,i.id,false));
  INSERT INTO public.taxguard_invoice_refunds(tenant_id,client_id,invoice_id,payment_id,idempotency_key,amount,reason,recorded_by,result)
    VALUES(p_tenant,p_client,i.id,p.id,p_key,p_amount,reason,p_actor,outcome) RETURNING id INTO rid;
  PERFORM public.taxguard_bill_audit(p_tenant,p_client,p_actor,k,'BILLING_PAYMENT_REFUNDED',jsonb_build_object(
    'invoiceId',i.id,'paymentId',p.id,'refundId',rid,'amount',public.taxguard_bill_text(p_amount),
    'before',jsonb_build_object('amountPaid',public.taxguard_bill_text(i.amount_paid),'balanceDue',public.taxguard_bill_text(i.balance_due),'refundedAmount',public.taxguard_bill_text(p.refunded_amount)),
    'after',jsonb_build_object('amountPaid',outcome->>'amountPaid','balanceDue',outcome->>'balanceDue','refundedAmount',public.taxguard_bill_text(p.refunded_amount+p_amount))));
  RETURN outcome;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_bill_refund(text,text,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.taxguard_bill_refund(text,text,text,text,numeric,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_refund(text,text,text,text,numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_refund(text,text,text,text,numeric,text,text) TO service_role;
