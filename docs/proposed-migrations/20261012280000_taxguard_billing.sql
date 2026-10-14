-- PROPOSAL 028 ONLY. NOT APPLIED. Requires the actual core schema and proposals 025 and 027 (actor helper).
-- Billing on the EXISTING taxguard_service_catalog, taxguard_invoices, taxguard_invoice_lines and
-- taxguard_invoice_payments tables (exact NUMERIC(15,2) money), plus append-only price history,
-- credit requests and per-tenant/year invoice numbering. No payment is processed here: payments
-- are recorded from a sandbox adapter or manual entry; no live provider exists.
--
-- Invoice lifecycle: DRAFT -> PENDING_APPROVAL -> ISSUED (number assigned) -> PARTIALLY_PAID / PAID;
-- PENDING_APPROVAL -> DRAFT (returned); DRAFT / ISSUED without payments -> VOID (reason).
-- Maker-checker: the approver of an invoice or a credit is a manager different from its preparer.
-- Totals are recomputed in SQL from lines; balance_due = total - amount_paid (existing CHECK).
-- Rollback (development): drop taxguard_bill_* functions, the three new tables, added columns.

CREATE TABLE IF NOT EXISTS public.taxguard_invoice_counters (
  tenant_id VARCHAR(128) NOT NULL, year INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100), next_number INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (tenant_id, year)
);
CREATE TABLE IF NOT EXISTS public.taxguard_service_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(128) NOT NULL, service_code VARCHAR(64) NOT NULL,
  previous_fee NUMERIC(15,2), new_fee NUMERIC(15,2) NOT NULL CHECK (new_fee >= 0), changed_by VARCHAR(128) NOT NULL, reason VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.taxguard_invoice_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id VARCHAR(128) NOT NULL, invoice_id VARCHAR(128) NOT NULL REFERENCES public.taxguard_invoices(id) ON DELETE RESTRICT,
  client_id VARCHAR(64) NOT NULL, amount NUMERIC(15,2) NOT NULL CHECK (amount > 0), reason VARCHAR(500) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPLIED','REJECTED')),
  requested_by VARCHAR(128) NOT NULL, decided_by VARCHAR(128), decided_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decided_by IS NULL OR decided_by <> requested_by)
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_invoice_counters','taxguard_service_price_history','taxguard_invoice_credits'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.taxguard_bill_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'BILLING_HISTORY_IMMUTABLE' USING ERRCODE = 'P0001'; END $$;
DROP TRIGGER IF EXISTS trg_taxguard_price_history_append_only ON public.taxguard_service_price_history;
CREATE TRIGGER trg_taxguard_price_history_append_only BEFORE UPDATE OR DELETE ON public.taxguard_service_price_history FOR EACH ROW EXECUTE FUNCTION public.taxguard_bill_append_only();

ALTER TABLE public.taxguard_invoices ADD COLUMN IF NOT EXISTS prepared_by VARCHAR(128);
ALTER TABLE public.taxguard_invoices ADD COLUMN IF NOT EXISTS approved_by VARCHAR(128);
ALTER TABLE public.taxguard_invoices ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.taxguard_invoices ADD COLUMN IF NOT EXISTS review_note VARCHAR(500);
ALTER TABLE public.taxguard_invoices ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
ALTER TABLE public.taxguard_invoices ADD COLUMN IF NOT EXISTS credits_applied NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.taxguard_invoices ADD COLUMN IF NOT EXISTS row_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.taxguard_invoice_lines ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(128);
ALTER TABLE public.taxguard_invoice_lines ADD COLUMN IF NOT EXISTS line_no INTEGER;
ALTER TABLE public.taxguard_invoice_lines ADD COLUMN IF NOT EXISTS rate_override_reason VARCHAR(500);
ALTER TABLE public.taxguard_invoice_payments ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.taxguard_invoice_payments ADD COLUMN IF NOT EXISTS provider VARCHAR(32);
DO $$ BEGIN
  ALTER TABLE public.taxguard_invoices ADD CONSTRAINT chk_taxguard_invoice_status CHECK (status IN ('DRAFT','PENDING_APPROVAL','ISSUED','PARTIALLY_PAID','PAID','PAST_DUE','VOID')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.taxguard_invoices ADD CONSTRAINT chk_taxguard_invoice_approver CHECK (approved_by IS NULL OR approved_by <> prepared_by) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.taxguard_invoice_payments ADD CONSTRAINT chk_taxguard_payment_amounts CHECK (amount > 0 AND refunded_amount >= 0 AND refunded_amount <= amount) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_invoice_idempotency ON public.taxguard_invoices(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_payment_idempotency ON public.taxguard_invoice_payments(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_payment_provider_txn ON public.taxguard_invoice_payments(tenant_id, provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_taxguard_invoices_client ON public.taxguard_invoices(tenant_id, client_id, status, due_date);

-- ------------------------------------------------------------------------------------------
-- Helpers (internal)
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_bill_text(p numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT COALESCE(p, 0)::numeric(15,2)::text $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_money(p numeric, p_allow_zero boolean) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p IS NULL OR p <> round(p, 2) OR p < 0 OR (p = 0 AND NOT p_allow_zero) OR p > 10000000000 THEN RAISE EXCEPTION 'BILLING_AMOUNT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN p;
END $$;

-- 'manager' (practice managers / administrators), 'staff' (assigned), or 'client' (own client).
CREATE OR REPLACE FUNCTION public.taxguard_bill_actor(p_tenant text, p_client text, p_actor text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_doc_actor(p_tenant, p_client, p_actor);
  IF r = 'client' THEN RETURN 'client'; END IF;
  RETURN CASE WHEN public.taxguard_practice_is_manager(r) THEN 'manager' ELSE 'staff' END;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_audit(p_tenant text, p_client text, p_actor text, p_kind text, p_action text, p_meta jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_action, p_actor, p_kind, jsonb_build_object('clientId', p_client) || COALESCE(p_meta, '{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_recompute(p_invoice text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE sub numeric;
BEGIN
  SELECT COALESCE(sum(amount), 0) INTO sub FROM public.taxguard_invoice_lines WHERE invoice_id = p_invoice;
  UPDATE public.taxguard_invoices SET subtotal = sub, total = sub + adjustments + tax - credits_applied, balance_due = sub + adjustments + tax - credits_applied - amount_paid,
    updated_at = now(), row_version = row_version + 1 WHERE id = p_invoice;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_invoice_json(i public.taxguard_invoices) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('invoiceId', i.id, 'invoiceNumber', CASE WHEN i.status IN ('DRAFT','PENDING_APPROVAL') THEN NULL ELSE i.invoice_number END, 'clientId', i.client_id,
    'engagementId', i.engagement_id, 'status', i.status, 'subtotal', public.taxguard_bill_text(i.subtotal), 'creditsApplied', public.taxguard_bill_text(i.credits_applied), 'total', public.taxguard_bill_text(i.total),
    'amountPaid', public.taxguard_bill_text(i.amount_paid), 'balanceDue', public.taxguard_bill_text(i.balance_due), 'currency', i.currency, 'dueDate', i.due_date, 'issueDate', i.issue_date, 'preparedBy', i.prepared_by, 'approvedBy', i.approved_by,
    'reviewNote', i.review_note, 'voidReason', i.void_reason, 'rowVersion', i.row_version, 'createdAt', i.created_at,
    'lines', (SELECT COALESCE(jsonb_agg(jsonb_build_object('lineNo', l.line_no, 'serviceCode', l.service_code, 'description', l.description, 'quantity', public.taxguard_bill_text(l.quantity),
      'unitRate', public.taxguard_bill_text(l.unit_rate), 'amount', public.taxguard_bill_text(l.amount), 'rateOverrideReason', l.rate_override_reason) ORDER BY l.line_no), '[]'::jsonb) FROM public.taxguard_invoice_lines l WHERE l.invoice_id = i.id),
    'payments', (SELECT COALESCE(jsonb_agg(jsonb_build_object('paymentId', p.id, 'amount', public.taxguard_bill_text(p.amount), 'refundedAmount', public.taxguard_bill_text(p.refunded_amount), 'method', p.payment_method,
      'status', p.status, 'provider', p.provider, 'createdAt', p.created_at) ORDER BY p.created_at), '[]'::jsonb) FROM public.taxguard_invoice_payments p WHERE p.invoice_id = i.id),
    'credits', (SELECT COALESCE(jsonb_agg(jsonb_build_object('creditId', c.id, 'amount', public.taxguard_bill_text(c.amount), 'reason', c.reason, 'status', c.status, 'requestedBy', c.requested_by,
      'decidedBy', c.decided_by) ORDER BY c.created_at), '[]'::jsonb) FROM public.taxguard_invoice_credits c WHERE c.invoice_id = i.id)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_load(p_tenant text, p_client text, p_invoice text, p_lock boolean) RETURNS public.taxguard_invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE i public.taxguard_invoices;
BEGIN
  IF p_lock THEN SELECT * INTO i FROM public.taxguard_invoices WHERE id = p_invoice AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  ELSE SELECT * INTO i FROM public.taxguard_invoices WHERE id = p_invoice AND tenant_id = p_tenant AND client_id = p_client; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  RETURN i;
END $$;

-- ------------------------------------------------------------------------------------------
-- Service catalog
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_bill_upsert_service(p_tenant text, p_actor text, p_code text, p_name text, p_category text, p_method text, p_fee numeric, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; existing record; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  IF NOT public.taxguard_practice_is_manager(r) THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_code IS NULL OR p_code !~ '^[A-Z0-9_-]{2,64}$' OR length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 255
     OR p_category NOT IN ('INDIVIDUAL_TAX','BUSINESS_TAX','BOOKKEEPING','ADVISORY','AUDIT_RESOLUTION') OR p_method NOT IN ('FLAT_FEE','HOURLY','SUBSCRIPTION') THEN
    RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.taxguard_bill_money(p_fee, true);
  SELECT * INTO existing FROM public.taxguard_service_catalog WHERE tenant_id = p_tenant AND service_code = p_code FOR UPDATE;
  IF FOUND AND existing.base_fee <> p_fee AND length(reason) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'PRICE_CHANGE_REASON_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_service_catalog(id, tenant_id, service_code, name, category, billing_method, base_fee)
    VALUES ('svc_' || p_tenant || '_' || p_code, p_tenant, p_code, btrim(p_name), p_category, p_method, p_fee)
    ON CONFLICT (tenant_id, service_code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, billing_method = EXCLUDED.billing_method,
      base_fee = EXCLUDED.base_fee, is_active = true, updated_at = now();
  IF NOT FOUND OR existing.base_fee IS DISTINCT FROM p_fee THEN
    INSERT INTO public.taxguard_service_price_history(tenant_id, service_code, previous_fee, new_fee, changed_by, reason)
      VALUES (p_tenant, p_code, existing.base_fee, p_fee, p_actor, COALESCE(NULLIF(reason, ''), 'Initial price'));
  END IF;
  PERFORM public.taxguard_bill_audit(p_tenant, NULL, p_actor, r, 'BILLING_SERVICE_PRICED', jsonb_build_object('serviceCode', p_code, 'fee', p_fee));
  RETURN jsonb_build_object('serviceCode', p_code, 'baseFee', public.taxguard_bill_text(p_fee));
END $$;

-- ------------------------------------------------------------------------------------------
-- Invoices
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_bill_create_invoice(p_tenant text, p_client text, p_actor text, p_key text, p_engagement text, p_due date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; existing record; id text;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k = 'client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' OR p_due IS NULL THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO existing FROM public.taxguard_invoices WHERE tenant_id = p_tenant AND idempotency_key = p_key;
  IF FOUND THEN
    IF existing.client_id = p_client AND existing.prepared_by = p_actor THEN RETURN jsonb_build_object('invoiceId', existing.id, 'created', false); END IF;
    RAISE EXCEPTION 'BILLING_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  IF p_engagement IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_engagements WHERE tenant_id = p_tenant AND client_id = p_client AND engagement_id = p_engagement) THEN
    RAISE EXCEPTION 'ENGAGEMENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  id := 'inv_' || encode(sha256(convert_to(p_tenant || '|' || p_key, 'UTF8')), 'hex');
  INSERT INTO public.taxguard_invoices(id, tenant_id, client_id, engagement_id, invoice_number, status, due_date, created_by, prepared_by, idempotency_key)
    VALUES (left(id, 68), p_tenant, p_client, p_engagement, 'DRAFT-' || left(id, 24), 'DRAFT', p_due, p_actor, p_actor, p_key);
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_INVOICE_DRAFTED', jsonb_build_object('invoiceId', left(id, 68)));
  RETURN jsonb_build_object('invoiceId', left(id, 68), 'created', true);
END $$;

-- Lines use the active catalog price; a different rate requires a recorded reason.
CREATE OR REPLACE FUNCTION public.taxguard_bill_add_line(p_tenant text, p_client text, p_actor text, p_invoice text, p_service text, p_quantity numeric, p_rate numeric, p_description text, p_override_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; i public.taxguard_invoices; svc record; rate numeric; n integer; amt numeric; reason text := NULLIF(btrim(COALESCE(p_override_reason, '')), '');
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k = 'client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p_invoice, true);
  IF i.status <> 'DRAFT' THEN RAISE EXCEPTION 'INVOICE_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO svc FROM public.taxguard_service_catalog WHERE tenant_id = p_tenant AND service_code = p_service AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 10000 OR p_quantity <> round(p_quantity, 2) THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  rate := public.taxguard_bill_money(COALESCE(p_rate, svc.base_fee), true);
  IF rate <> svc.base_fee AND (reason IS NULL OR length(reason) NOT BETWEEN 5 AND 500) THEN RAISE EXCEPTION 'RATE_OVERRIDE_REASON_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  amt := round(rate * p_quantity, 2);
  SELECT COALESCE(max(line_no), 0) + 1 INTO n FROM public.taxguard_invoice_lines WHERE invoice_id = i.id;
  INSERT INTO public.taxguard_invoice_lines(invoice_id, tenant_id, line_no, service_code, description, quantity, unit_rate, amount, rate_override_reason)
    VALUES (i.id, p_tenant, n, p_service, left(COALESCE(NULLIF(btrim(p_description), ''), svc.name), 255), p_quantity, rate, amt, CASE WHEN rate <> svc.base_fee THEN reason END);
  PERFORM public.taxguard_bill_recompute(i.id);
  RETURN public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_remove_line(p_tenant text, p_client text, p_actor text, p_invoice text, p_line integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; i public.taxguard_invoices;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k = 'client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p_invoice, true);
  IF i.status <> 'DRAFT' THEN RAISE EXCEPTION 'INVOICE_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  DELETE FROM public.taxguard_invoice_lines WHERE invoice_id = i.id AND line_no = p_line;
  IF NOT FOUND THEN RAISE EXCEPTION 'LINE_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_bill_recompute(i.id);
  RETURN public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false));
END $$;

-- submit (preparer), approve / return (a different manager), void (manager, no payments).
CREATE OR REPLACE FUNCTION public.taxguard_bill_transition(p_tenant text, p_client text, p_actor text, p_invoice text, p_action text, p_row_version integer, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; i public.taxguard_invoices; note text := NULLIF(btrim(COALESCE(p_note, '')), ''); yr integer; n integer; num text;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k = 'client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p_invoice, true);
  IF p_row_version IS NULL OR i.row_version <> p_row_version THEN RAISE EXCEPTION 'INVOICE_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF p_action = 'submit' THEN
    IF i.status <> 'DRAFT' THEN RAISE EXCEPTION 'INVOICE_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF i.total <= 0 THEN RAISE EXCEPTION 'INVOICE_EMPTY' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.taxguard_invoices SET status = 'PENDING_APPROVAL', review_note = NULL, row_version = row_version + 1, updated_at = now() WHERE id = i.id;
  ELSIF p_action IN ('approve','return') THEN
    IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF i.status <> 'PENDING_APPROVAL' THEN RAISE EXCEPTION 'INVOICE_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF i.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'return' THEN
      IF note IS NULL OR length(note) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
      UPDATE public.taxguard_invoices SET status = 'DRAFT', review_note = note, row_version = row_version + 1, updated_at = now() WHERE id = i.id;
    ELSE
      yr := extract(year FROM current_date)::integer;
      INSERT INTO public.taxguard_invoice_counters(tenant_id, year) VALUES (p_tenant, yr) ON CONFLICT DO NOTHING;
      UPDATE public.taxguard_invoice_counters SET next_number = next_number + 1 WHERE tenant_id = p_tenant AND year = yr RETURNING next_number - 1 INTO n;
      num := 'INV-' || yr || '-' || lpad(n::text, 6, '0');
      UPDATE public.taxguard_invoices SET status = 'ISSUED', invoice_number = num, issue_date = current_date, issued_by = p_actor, approved_by = p_actor, approved_at = now(),
        row_version = row_version + 1, updated_at = now() WHERE id = i.id;
    END IF;
  ELSIF p_action = 'void' THEN
    IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF i.status NOT IN ('DRAFT','PENDING_APPROVAL','ISSUED') OR i.amount_paid > 0 THEN RAISE EXCEPTION 'INVOICE_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF note IS NULL OR length(note) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.taxguard_invoices SET status = 'VOID', void_reason = note, voided_at = now(), voided_by = p_actor, balance_due = 0, total = amount_paid,
      row_version = row_version + 1, updated_at = now() WHERE id = i.id;
  ELSE
    RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_INVOICE_' || upper(p_action), jsonb_build_object('invoiceId', i.id));
  RETURN public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false));
END $$;

-- Payments: idempotent by key; a provider transaction is recorded once; no overpayment.
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
    IF existing.invoice_id = p_invoice AND existing.amount = p_amount THEN RETURN jsonb_build_object('paymentId', existing.id, 'replayed', true); END IF;
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
  RETURN jsonb_build_object('paymentId', left(pid, 68), 'replayed', false, 'invoice', public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false)));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_refund(p_tenant text, p_client text, p_actor text, p_payment text, p_amount numeric, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; p record; i public.taxguard_invoices; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF length(reason) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO p FROM public.taxguard_invoice_payments WHERE id = p_payment AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_bill_money(p_amount, false);
  IF p.refunded_amount + p_amount > p.amount THEN RAISE EXCEPTION 'REFUND_EXCEEDS_PAYMENT' USING ERRCODE = 'P0001'; END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p.invoice_id, true);
  UPDATE public.taxguard_invoice_payments SET refunded_amount = refunded_amount + p_amount, status = CASE WHEN refunded_amount + p_amount = amount THEN 'REFUNDED' ELSE status END WHERE id = p.id;
  UPDATE public.taxguard_invoices SET amount_paid = amount_paid - p_amount, balance_due = total - (amount_paid - p_amount),
    status = CASE WHEN amount_paid - p_amount = 0 THEN 'ISSUED' ELSE 'PARTIALLY_PAID' END, row_version = row_version + 1, updated_at = now() WHERE id = i.id;
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_PAYMENT_REFUNDED', jsonb_build_object('invoiceId', i.id, 'paymentId', p.id, 'amount', p_amount));
  RETURN public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false));
END $$;

-- Credits on issued invoices: requested by staff, applied or rejected by a different manager.
CREATE OR REPLACE FUNCTION public.taxguard_bill_request_credit(p_tenant text, p_client text, p_actor text, p_invoice text, p_amount numeric, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; i public.taxguard_invoices; id uuid; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k = 'client' THEN RAISE EXCEPTION 'BILLING_STAFF_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF length(reason) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'BILLING_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, p_invoice, false);
  IF i.status NOT IN ('ISSUED','PARTIALLY_PAID','PAST_DUE') THEN RAISE EXCEPTION 'INVOICE_NOT_CREDITABLE' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_bill_money(p_amount, false);
  IF p_amount > i.balance_due THEN RAISE EXCEPTION 'CREDIT_EXCEEDS_BALANCE' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_invoice_credits(tenant_id, invoice_id, client_id, amount, reason, requested_by) VALUES (p_tenant, i.id, p_client, p_amount, reason, p_actor) RETURNING taxguard_invoice_credits.id INTO id;
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_CREDIT_REQUESTED', jsonb_build_object('invoiceId', i.id, 'creditId', id, 'amount', p_amount));
  RETURN jsonb_build_object('creditId', id, 'status', 'REQUESTED');
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_decide_credit(p_tenant text, p_client text, p_actor text, p_credit uuid, p_apply boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; c record; i public.taxguard_invoices;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  IF k <> 'manager' THEN RAISE EXCEPTION 'BILLING_MANAGER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO c FROM public.taxguard_invoice_credits WHERE id = p_credit AND tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CREDIT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF c.status <> 'REQUESTED' THEN RAISE EXCEPTION 'CREDIT_ALREADY_DECIDED' USING ERRCODE = 'P0001'; END IF;
  IF c.requested_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  i := public.taxguard_bill_load(p_tenant, p_client, c.invoice_id, true);
  IF p_apply THEN
    IF c.amount > i.balance_due THEN RAISE EXCEPTION 'CREDIT_EXCEEDS_BALANCE' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.taxguard_invoices SET credits_applied = credits_applied + c.amount, total = total - c.amount, balance_due = balance_due - c.amount,
      status = CASE WHEN balance_due - c.amount = 0 THEN 'PAID' ELSE status END, row_version = row_version + 1, updated_at = now() WHERE id = i.id;
  END IF;
  UPDATE public.taxguard_invoice_credits SET status = CASE WHEN p_apply THEN 'APPLIED' ELSE 'REJECTED' END, decided_by = p_actor, decided_at = now() WHERE id = c.id;
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, CASE WHEN p_apply THEN 'BILLING_CREDIT_APPLIED' ELSE 'BILLING_CREDIT_REJECTED' END,
    jsonb_build_object('invoiceId', i.id, 'creditId', c.id, 'amount', c.amount));
  RETURN public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false));
END $$;

-- ------------------------------------------------------------------------------------------
-- Reads
-- ------------------------------------------------------------------------------------------
-- Clients see only issued (non-draft) invoices of their own client.
CREATE OR REPLACE FUNCTION public.taxguard_bill_list(p_tenant text, p_client text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text;
BEGIN
  k := public.taxguard_bill_actor(p_tenant, p_client, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(public.taxguard_bill_invoice_json(i) ORDER BY i.created_at DESC), '[]'::jsonb) FROM public.taxguard_invoices i
    WHERE i.tenant_id = p_tenant AND i.client_id = p_client AND (k <> 'client' OR i.status NOT IN ('DRAFT','PENDING_APPROVAL')));
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_bill_catalog(p_tenant text, p_actor text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('serviceCode', service_code, 'name', name, 'category', category, 'billingMethod', billing_method, 'baseFee', public.taxguard_bill_text(base_fee),
    'isActive', is_active) ORDER BY service_code), '[]'::jsonb) FROM public.taxguard_service_catalog WHERE tenant_id = p_tenant);
END $$;

-- Accounts receivable: managers see all tenant clients, other staff their assigned clients.
-- Buckets by days past due as of p_as_of (current = not yet due).
CREATE OR REPLACE FUNCTION public.taxguard_bill_ar_aging(p_tenant text, p_actor text, p_as_of date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; as_of date := COALESCE(p_as_of, current_date);
BEGIN
  r := public.taxguard_practice_actor(p_tenant, p_actor);
  RETURN jsonb_build_object('asOf', as_of, 'pendingApproval', (SELECT count(*) FROM public.taxguard_invoices i WHERE i.tenant_id = p_tenant AND i.status = 'PENDING_APPROVAL'
      AND public.taxguard_practice_can_see(p_tenant, i.client_id, p_actor, r)),
    'clients', (SELECT COALESCE(jsonb_agg(row_data ORDER BY total_due DESC, client_id), '[]'::jsonb) FROM (
      SELECT i.client_id, sum(i.balance_due) AS total_due, jsonb_build_object('clientId', i.client_id, 'clientName', max(c.name), 'totalDue', public.taxguard_bill_text(sum(i.balance_due)),
        'current', public.taxguard_bill_text(sum(i.balance_due) FILTER (WHERE as_of <= i.due_date)),
        'days1to30', public.taxguard_bill_text(sum(i.balance_due) FILTER (WHERE as_of - i.due_date BETWEEN 1 AND 30)),
        'days31to60', public.taxguard_bill_text(sum(i.balance_due) FILTER (WHERE as_of - i.due_date BETWEEN 31 AND 60)),
        'days61to90', public.taxguard_bill_text(sum(i.balance_due) FILTER (WHERE as_of - i.due_date BETWEEN 61 AND 90)),
        'over90', public.taxguard_bill_text(sum(i.balance_due) FILTER (WHERE as_of - i.due_date > 90)),
        'openInvoices', count(*)) AS row_data
      FROM public.taxguard_invoices i JOIN public.taxguard_clients c ON c.tenant_id = i.tenant_id AND c.client_id = i.client_id
      WHERE i.tenant_id = p_tenant AND i.status IN ('ISSUED','PARTIALLY_PAID','PAST_DUE') AND i.balance_due > 0 AND public.taxguard_practice_can_see(p_tenant, i.client_id, p_actor, r)
      GROUP BY i.client_id) a));
END $$;

DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_bill\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_bill_upsert_service','taxguard_bill_create_invoice','taxguard_bill_add_line','taxguard_bill_remove_line','taxguard_bill_transition',
        'taxguard_bill_record_payment','taxguard_bill_refund','taxguard_bill_request_credit','taxguard_bill_decide_credit','taxguard_bill_list','taxguard_bill_catalog',
        'taxguard_bill_ar_aging') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
