-- PROPOSAL (Phase 14/15 integration, billing refunds). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposal 028 (billing), 20261015070000 (billing access overlay) and 20261018010000 (the canonical refund
-- records table and taxguard_bill_refund_keyed, whose current definition this replaces).
--
-- One refund architecture. Phase 15 (Codex, af34972) proposed a second design under this version: its own
-- taxguard_invoice_refunds shape and a seven-argument taxguard_bill_refund. Composed with 20261018010000, whichever ran
-- first silently defined the table. Owner instruction (2026-10-27): the Phase 14 keyed function stays canonical and
-- Phase 15's missing capabilities are ported into it. This file replaces Codex's version; nothing defines a second
-- refund function or table.
--
-- Ported from Phase 15:
--   * Stable replay: the original result is stored with the refund and returned for a retry, instead of the
--     invoice as it is now (plus replayed: true).
--   * Stricter binding: a key replays only for the same client, payment, amount, reason AND recording manager;
--     anything else is IDEMPOTENCY_KEY_REUSED (Phase 14's code, kept for the API contract).
--   * The manager is re-checked after the per-key lock, so access revoked while waiting is refused.
--   * A 64-bit, delimiter-safe advisory lock key (hashtextextended of a JSON array).
--   * Database-level scope: a refund row must reference a payment of the same tenant, client and invoice.
--   * The audit records before and after amounts (as exact text) in addition to the reason.
--   * TRUNCATE is refused like UPDATE and DELETE.
--   * The six-argument function fails closed even for the table owner, and stays revoked from service_role.
-- Kept from Phase 14: the immutability trigger, the reason check (5-500), the tenant foreign key, the reason in the
-- audit, refundId and replayed in the response.
-- Rollback (development): re-apply the 20261018010000 definitions; the result column and constraint may remain.

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_payment_refund_scope
  ON public.taxguard_invoice_payments(tenant_id, client_id, invoice_id, id);
ALTER TABLE public.taxguard_invoice_refunds ADD COLUMN IF NOT EXISTS result JSONB;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_taxguard_invoice_refunds_result') THEN
    ALTER TABLE public.taxguard_invoice_refunds ADD CONSTRAINT chk_taxguard_invoice_refunds_result CHECK (result IS NULL OR jsonb_typeof(result) = 'object');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_taxguard_invoice_refunds_payment_scope') THEN
    ALTER TABLE public.taxguard_invoice_refunds ADD CONSTRAINT fk_taxguard_invoice_refunds_payment_scope
      FOREIGN KEY (tenant_id, client_id, invoice_id, payment_id) REFERENCES public.taxguard_invoice_payments(tenant_id, client_id, invoice_id, id) ON DELETE RESTRICT;
  END IF;
END $$;

-- TRUNCATE bypasses the row-level immutability trigger of 20261018010000; refuse it at statement level.
DROP TRIGGER IF EXISTS trg_taxguard_invoice_refunds_no_truncate ON public.taxguard_invoice_refunds;
CREATE TRIGGER trg_taxguard_invoice_refunds_no_truncate BEFORE TRUNCATE ON public.taxguard_invoice_refunds
  FOR EACH STATEMENT EXECUTE FUNCTION public.taxguard_invoice_refunds_immutable();

-- Current definition: 20261018010000.
CREATE OR REPLACE FUNCTION public.taxguard_bill_refund_keyed(p_tenant text, p_client text, p_actor text, p_payment text, p_amount numeric, p_reason text, p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; p public.taxguard_invoice_payments; i public.taxguard_invoices; prior public.taxguard_invoice_refunds; reason text := btrim(COALESCE(p_reason, ''));
  rid uuid := gen_random_uuid(); outcome jsonb;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF length(reason) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_bill_money(p_amount, false);
  -- Serialize concurrent requests for the same key, then re-check the actor: access may have ended while waiting.
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('billing-refund', p_tenant, p_key)::text, 0));
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO prior FROM public.taxguard_invoice_refunds WHERE tenant_id = p_tenant AND idempotency_key = p_key;
  IF FOUND THEN
    IF (prior.client_id, prior.payment_id, prior.amount, prior.reason, prior.recorded_by) IS DISTINCT FROM (p_client, p_payment, p_amount, reason, p_actor) THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED' USING ERRCODE = 'P0001';
    END IF;
    RETURN COALESCE(prior.result, public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, prior.invoice_id, false)) || jsonb_build_object('refundId', prior.id))
      || jsonb_build_object('replayed', true);
  END IF;
  SELECT * INTO p FROM public.taxguard_invoice_payments WHERE id = p_payment AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p.refunded_amount + p_amount > p.amount THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT' USING ERRCODE = 'P0001'; END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p.invoice_id, true);
  UPDATE public.taxguard_invoice_payments SET refunded_amount = refunded_amount + p_amount, status = CASE WHEN refunded_amount + p_amount = amount THEN 'REFUNDED' ELSE status END WHERE id = p.id;
  UPDATE public.taxguard_invoices SET amount_paid = amount_paid - p_amount, balance_due = total - (amount_paid - p_amount),
    status = CASE WHEN amount_paid - p_amount = 0 THEN 'ISSUED' ELSE 'PARTIALLY_PAID' END, row_version = row_version + 1, updated_at = now() WHERE id = i.id;
  outcome := public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false)) || jsonb_build_object('refundId', rid);
  INSERT INTO public.taxguard_invoice_refunds(id, tenant_id, client_id, invoice_id, payment_id, amount, reason, recorded_by, idempotency_key, result)
    VALUES (rid, p_tenant, p_client, i.id, p.id, p_amount, reason, p_actor, p_key, outcome);
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_PAYMENT_REFUNDED', jsonb_build_object('invoiceId', i.id, 'paymentId', p.id,
    'refundId', rid, 'amount', public.taxguard_bill_text(p_amount), 'reason', reason,
    'before', jsonb_build_object('amountPaid', public.taxguard_bill_text(i.amount_paid), 'balanceDue', public.taxguard_bill_text(i.balance_due),
      'refundedAmount', public.taxguard_bill_text(p.refunded_amount)),
    'after', jsonb_build_object('amountPaid', outcome->>'amountPaid', 'balanceDue', outcome->>'balanceDue',
      'refundedAmount', public.taxguard_bill_text(p.refunded_amount + p_amount))));
  RETURN outcome || jsonb_build_object('replayed', false);
END $$;

-- The unkeyed function could still record an unbound refund for anyone able to execute it (the table owner, a
-- future grant). It now refuses after the manager check: no refund is recorded without a key.
CREATE OR REPLACE FUNCTION public.taxguard_bill_refund(p_tenant text, p_client text, p_actor text, p_payment text, p_amount numeric, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF public.taxguard_bill_actor(p_tenant, p_client, p_actor) <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING ERRCODE = 'P0001';
END $$;

REVOKE ALL ON FUNCTION public.taxguard_bill_refund_keyed(text,text,text,text,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_bill_refund_keyed(text,text,text,text,numeric,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.taxguard_bill_refund(text,text,text,text,numeric,text) FROM PUBLIC, anon, authenticated, service_role;
