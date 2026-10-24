-- PROPOSAL (Phase 14, billing). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposal 028 (billing) and the core tenants table.
--
-- Refund recording (proposal 028, taxguard_bill_refund) had two defects:
--   * no idempotency: a retried or double-submitted request recorded the refund twice (bounded only
--     by the payment amount);
--   * the required reason was validated and then discarded: neither a record nor the audit kept it.
-- This proposal adds an immutable refund ledger (one row per recorded refund, with its reason, actor
-- and idempotency key) and taxguard_bill_refund_keyed, which replays the original result for the same
-- key and refuses a key reused for a different refund. The unkeyed function is revoked from
-- service_role so the keyed path is the only entry point. Refunds remain RECORDS of money returned
-- outside TaxGuard: no payment provider is called and nothing is claimed as processed.
-- Rollback (development): drop the function and table; re-grant taxguard_bill_refund to service_role.

CREATE TABLE IF NOT EXISTS public.taxguard_invoice_refunds (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_tenants(id) ON DELETE RESTRICT,
  client_id VARCHAR(64) NOT NULL,
  invoice_id VARCHAR(128) NOT NULL,
  payment_id VARCHAR(128) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason VARCHAR(500) NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 500),
  recorded_by VARCHAR(128) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9_.:-]{8,128}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_invoice_refund_key ON public.taxguard_invoice_refunds(tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_taxguard_invoice_refunds_payment ON public.taxguard_invoice_refunds(tenant_id, client_id, payment_id);
ALTER TABLE public.taxguard_invoice_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxguard_invoice_refunds FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_invoice_refunds_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN RAISE EXCEPTION 'BILLING_REFUND_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_invoice_refunds_immutable ON public.taxguard_invoice_refunds;
CREATE TRIGGER trg_taxguard_invoice_refunds_immutable BEFORE UPDATE OR DELETE ON public.taxguard_invoice_refunds
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_invoice_refunds_immutable();
REVOKE ALL ON FUNCTION public.taxguard_invoice_refunds_immutable() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_bill_refund_keyed(p_tenant text, p_client text, p_actor text, p_payment text, p_amount numeric, p_reason text, p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; p record; i public.taxguard_invoices; prior public.taxguard_invoice_refunds; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF length(reason) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_bill_money(p_amount, false);
  -- Serialize concurrent requests for the same key before looking for a prior result.
  PERFORM pg_advisory_xact_lock(hashtext('taxguard:refund:' || p_tenant || ':' || p_key));
  SELECT * INTO prior FROM public.taxguard_invoice_refunds WHERE tenant_id = p_tenant AND idempotency_key = p_key;
  IF FOUND THEN
    IF prior.client_id <> p_client OR prior.payment_id <> p_payment OR prior.amount <> p_amount THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
    END IF;
    RETURN public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, prior.invoice_id, false)) || jsonb_build_object('refundId', prior.id, 'replayed', true);
  END IF;
  SELECT * INTO p FROM public.taxguard_invoice_payments WHERE id = p_payment AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p.refunded_amount + p_amount > p.amount THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT' USING ERRCODE = 'P0001'; END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p.invoice_id, true);
  UPDATE public.taxguard_invoice_payments SET refunded_amount = refunded_amount + p_amount, status = CASE WHEN refunded_amount + p_amount = amount THEN 'REFUNDED' ELSE status END WHERE id = p.id;
  UPDATE public.taxguard_invoices SET amount_paid = amount_paid - p_amount, balance_due = total - (amount_paid - p_amount),
    status = CASE WHEN amount_paid - p_amount = 0 THEN 'ISSUED' ELSE 'PARTIALLY_PAID' END, row_version = row_version + 1, updated_at = now() WHERE id = i.id;
  INSERT INTO public.taxguard_invoice_refunds(id, tenant_id, client_id, invoice_id, payment_id, amount, reason, recorded_by, idempotency_key)
    VALUES (gen_random_uuid(), p_tenant, p_client, i.id, p.id, p_amount, reason, p_actor, p_key) RETURNING * INTO prior;
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_PAYMENT_REFUNDED',
    jsonb_build_object('invoiceId', i.id, 'paymentId', p.id, 'refundId', prior.id, 'amount', p_amount, 'reason', reason));
  RETURN public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false)) || jsonb_build_object('refundId', prior.id, 'replayed', false);
END $$;

REVOKE ALL ON FUNCTION public.taxguard_bill_refund_keyed(text,text,text,text,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_refund_keyed(text,text,text,text,numeric,text,text) TO service_role;
-- The unkeyed function stays defined for history but is no longer callable by the service role.
REVOKE ALL ON FUNCTION public.taxguard_bill_refund(text,text,text,text,numeric,text) FROM PUBLIC, anon, authenticated, service_role;
