-- TaxGuard proposal 047: database-enforced client billing projection (Phase 10). REVIEW ONLY; not applied.
--
-- Problem: taxguard_bill_invoice_json (028) returns staff-only details — preparer and approver,
-- the maker-checker review note, the void reason, rate-override reasons, credit reasons and their
-- requester / decider, and the payment provider. The two billing functions a client may call
-- (taxguard_bill_list and the sandbox path of taxguard_bill_record_payment) returned that JSON
-- to clients; only the HTTP router's allow-list (clientBillingView.ts) removed the fields.
--
-- Change: a client-safe projection with an explicit allow-list (the same keys as
-- clientBillingView.ts), and taxguard_bill_view choosing it for client actors. taxguard_bill_list
-- and taxguard_bill_record_payment are superseded so a client never receives staff-only fields
-- from the database, whatever the caller. Every other billing function already refuses clients
-- (BILLING_STAFF_REQUIRED / BILLING_MANAGER_REQUIRED) and is unchanged. Staff responses are
-- unchanged. Tenant and client scoping are unchanged (taxguard_bill_actor -> taxguard_doc_actor:
-- a client only for their own client; staff assigned or managers; other tenants refused).
--
-- Depends on: 025 (practice), 027 (taxguard_doc_actor), 028 (billing).
-- Idempotent: CREATE OR REPLACE only; no table or data change.
-- Rollback: re-apply the two functions from 028 and drop taxguard_bill_client_invoice_json and
-- taxguard_bill_view (the HTTP allow-list still protects clients after a rollback).

CREATE OR REPLACE FUNCTION public.taxguard_bill_client_invoice_json(i public.taxguard_invoices) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('invoiceId', i.id, 'invoiceNumber', CASE WHEN i.status IN ('DRAFT','PENDING_APPROVAL') THEN NULL ELSE i.invoice_number END, 'clientId', i.client_id,
    'engagementId', i.engagement_id, 'status', i.status, 'subtotal', public.taxguard_bill_text(i.subtotal), 'creditsApplied', public.taxguard_bill_text(i.credits_applied),
    'total', public.taxguard_bill_text(i.total), 'amountPaid', public.taxguard_bill_text(i.amount_paid), 'balanceDue', public.taxguard_bill_text(i.balance_due), 'currency', i.currency,
    'dueDate', i.due_date, 'issueDate', i.issue_date, 'createdAt', i.created_at, 'rowVersion', i.row_version,
    'lines', (SELECT COALESCE(jsonb_agg(jsonb_build_object('lineNo', l.line_no, 'serviceCode', l.service_code, 'description', l.description, 'quantity', public.taxguard_bill_text(l.quantity),
      'unitRate', public.taxguard_bill_text(l.unit_rate), 'amount', public.taxguard_bill_text(l.amount)) ORDER BY l.line_no), '[]'::jsonb) FROM public.taxguard_invoice_lines l WHERE l.invoice_id = i.id),
    'payments', (SELECT COALESCE(jsonb_agg(jsonb_build_object('paymentId', p.id, 'amount', public.taxguard_bill_text(p.amount), 'refundedAmount', public.taxguard_bill_text(p.refunded_amount),
      'method', p.payment_method, 'status', p.status, 'createdAt', p.created_at) ORDER BY p.created_at), '[]'::jsonb) FROM public.taxguard_invoice_payments p WHERE p.invoice_id = i.id),
    -- Only applied credits change what the client owes; requested and rejected credits are internal.
    'credits', (SELECT COALESCE(jsonb_agg(jsonb_build_object('creditId', c.id, 'amount', public.taxguard_bill_text(c.amount), 'status', c.status) ORDER BY c.created_at), '[]'::jsonb)
      FROM public.taxguard_invoice_credits c WHERE c.invoice_id = i.id AND c.status = 'APPLIED')) $$;

-- The projection for an actor kind from taxguard_bill_actor: anything other than staff or manager
-- (including NULL) gets the client projection, so an unexpected kind fails closed.
CREATE OR REPLACE FUNCTION public.taxguard_bill_view(p_kind text, i public.taxguard_invoices) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT CASE WHEN p_kind IN ('staff','manager') THEN public.taxguard_bill_invoice_json(i) ELSE public.taxguard_bill_client_invoice_json(i) END $$;

-- Supersedes 028: clients receive the client projection.
CREATE OR REPLACE FUNCTION public.taxguard_bill_list(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_bill_view(k, i) ORDER BY i.created_at DESC), '[]'::jsonb) FROM public.taxguard_invoices i
    WHERE i.tenant_id = p_tenant AND i.client_id = p_client AND (k IN ('staff','manager') OR i.status NOT IN ('DRAFT','PENDING_APPROVAL')));
END $$;

-- Supersedes 028: identical rules; the returned invoice uses the actor's projection.
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
  SELECT * INTO existing FROM public.taxguard_invoice_payments WHERE tenant_id = p_tenant AND idempotency_key = p_key;
  IF FOUND THEN
    IF existing.invoice_id = p_invoice AND existing.amount = p_amount AND existing.client_id = p_client THEN RETURN jsonb_build_object('paymentId', existing.id, 'replayed', true); END IF;
    RAISE EXCEPTION 'BILLING_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p_invoice, true);
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

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname IN ('taxguard_bill_client_invoice_json','taxguard_bill_view','taxguard_bill_list','taxguard_bill_record_payment') LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_bill_list','taxguard_bill_record_payment') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig); END IF;
  END LOOP;
END $$;
