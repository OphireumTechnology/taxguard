-- PROPOSAL (Phase 14, billing audit completeness). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposal 028 (20261012280000, billing).
--
-- taxguard_bill_transition audited every invoice transition with the invoice id only. A reviewer's return note
-- is kept on the invoice only until the preparer resubmits (submit clears review_note by design), so the reason
-- a checker sent an invoice back for rework was lost entirely, and void reasons existed only on the mutable row.
-- This replacement is identical to proposal 028's function except for the audit call. That call now records
-- the prior and new status, the note for 'return' and 'void', and the issued invoice number for 'approve'.
-- Authorization, maker-checker, state rules, numbering and the returned projection are unchanged. Audit rows are
-- staff-only (administrator audit center); the client projection never includes notes or reasons.
-- CREATE OR REPLACE keeps the existing grants (service_role only).
-- Rollback (development): re-run the function definition from proposal 028.

CREATE OR REPLACE FUNCTION public.taxguard_bill_transition(p_tenant text, p_client text, p_actor text, p_invoice text, p_action text, p_row_version integer, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE k text; i public.taxguard_invoices; note text := NULLIF(btrim(COALESCE(p_note, '')), ''); yr integer; n integer; num text; after_status text;
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
  SELECT status INTO after_status FROM public.taxguard_invoices WHERE id = i.id;
  -- i holds the row as it was before this transition.
  PERFORM public.taxguard_bill_audit(p_tenant, p_client, p_actor, k, 'BILLING_INVOICE_' || upper(p_action),
    jsonb_build_object('invoiceId', i.id, 'fromStatus', i.status, 'toStatus', after_status)
    || CASE WHEN p_action IN ('return','void') THEN jsonb_build_object('note', note) ELSE '{}'::jsonb END
    || CASE WHEN p_action = 'approve' THEN jsonb_build_object('invoiceNumber', num) ELSE '{}'::jsonb END);
  RETURN public.taxguard_bill_invoice_json(public.taxguard_bill_load(p_tenant, p_client, i.id, false));
END $$;
