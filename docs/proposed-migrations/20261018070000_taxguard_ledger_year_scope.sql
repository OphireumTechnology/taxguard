-- PROPOSAL (Phase 14, Package B: tax-year scope of the durable ledger and book-to-tax). REVIEW ONLY; NOT APPLIED anywhere external.
-- Requires proposals 20261012240000 (durable ledger), 20261012250000 (practice management: staff assignments),
-- 20261012290000 (book-to-tax) and 20261012300000 (bookkeeper work queue), which hold the current definitions below.
--
-- Owner decision 2026-10-19: a staff member assigned for one tax year reaches that client's records for that year
-- only, unless independently authorized (a client-wide assignment, a practice manager or an administrator).
-- taxguard_ledger_actor admits any staff member with any active assignment to the client, so a bookkeeper or
-- reviewer assigned for 2025 could read, report on, post into, review, close, reconcile and map every other year of
-- the client's ledger and book-to-tax. taxguard_ledger_actor itself is unchanged: making it stricter would also
-- refuse year-scoped staff on Codex's Phase 15 functions, which are not modified here.
--
-- What changes:
--   * Functions taking a tax year refuse a year out of scope with LEDGER_ACCESS_DENIED.
--   * Functions addressing a record by id refuse a record whose own tax year is out of scope with that function's
--     existing not-found code, so an out-of-scope record is indistinguishable from a missing one.
--   * Every new journal entry and book-to-tax adjustment is checked against its own tax year by an insert trigger,
--     whichever function writes it. This covers taxguard_ledger_post_entry, taxguard_ledger_reverse_entry and
--     taxguard_b2t_prepare_adjustment (and Codex's Phase 15 replacements of them) without editing them.
--   * Ledger history is filtered, for a year-scoped actor, to events whose entry, period or reconciliation is in scope.
-- Each function below is identical to its current definition except for the change named above it.
-- Kept client-level by design: chart of accounts (create_accounts, set_account_active) and bank-feed ingestion
-- (ingest_transactions), which have no tax year; categorizing an ingested transaction is year-scoped.
-- Not changed (handoff, see docs/development/phase14-phase15-billing-overlap.md): an idempotent replay of
-- post_entry, reverse_entry or prepare_adjustment returns the existing record without inserting, and Codex's
-- general_ledger(_exact) and trial_balance_exact reports; their year checks belong in Codex's definitions.
-- Assignment scope: tax_year NULL means every year of the client; otherwise it must match.
-- Rollback (development): re-apply the listed proposals' definitions, drop the two triggers and the four helpers.

CREATE OR REPLACE FUNCTION public.taxguard_ledger_year_scope(p_tenant text, p_client text, p_actor text, p_role text, p_year integer) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(p_role IN ('admin','administrator','super_admin','super_administrator','practice_manager'), false) OR EXISTS (
    SELECT 1 FROM public.taxguard_staff_assignments a WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.user_id = p_actor
      AND upper(a.status) = 'ACTIVE' AND a.effective_from <= now() AND (a.effective_to IS NULL OR a.effective_to > now())
      AND (a.tax_year IS NULL OR (p_year IS NOT NULL AND a.tax_year = p_year))) $$;
REVOKE ALL ON FUNCTION public.taxguard_ledger_year_scope(text,text,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_year_guard(p_tenant text, p_client text, p_actor text, p_role text, p_year integer) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, p_role, p_year) THEN
    RAISE EXCEPTION 'LEDGER_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_ledger_year_guard(text,text,text,text,integer) FROM PUBLIC, anon, authenticated, service_role;

-- The tax year of the record a ledger audit event refers to (NULL for client-level events such as account changes).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_event_year(p_tenant text, p_client text, p_meta jsonb) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT e.tax_year FROM public.taxguard_ledger_entries e WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND e.entry_id::text = p_meta->>'entryId'),
    (SELECT p.tax_year FROM public.taxguard_ledger_periods p WHERE p.tenant_id = p_tenant AND p.client_id = p_client AND p.period_id = p_meta->>'periodId'),
    (SELECT c.tax_year FROM public.taxguard_ledger_reconciliations c WHERE c.tenant_id = p_tenant AND c.client_id = p_client
      AND c.reconciliation_id::text = p_meta->>'reconciliationId')) $$;
REVOKE ALL ON FUNCTION public.taxguard_ledger_event_year(text,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- Insert guard: the row's author (column named by the trigger argument) must have the row's tax year in scope.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_year_insert_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE author text := to_jsonb(NEW)->>TG_ARGV[0]; author_role text;
BEGIN
  SELECT role INTO author_role FROM public.taxguard_members WHERE tenant_id = NEW.tenant_id AND uid = author AND status = 'active';
  IF author IS NULL OR NOT public.taxguard_ledger_year_scope(NEW.tenant_id, NEW.client_id, author, author_role, NEW.tax_year) THEN
    RAISE EXCEPTION 'LEDGER_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.taxguard_ledger_year_insert_guard() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS trg_taxguard_ledger_entries_year_scope ON public.taxguard_ledger_entries;
CREATE TRIGGER trg_taxguard_ledger_entries_year_scope BEFORE INSERT ON public.taxguard_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_ledger_year_insert_guard('creator_uid');
DROP TRIGGER IF EXISTS trg_taxguard_b2t_adjustments_year_scope ON public.taxguard_b2t_adjustments;
CREATE TRIGGER trg_taxguard_b2t_adjustments_year_scope BEFORE INSERT ON public.taxguard_b2t_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_ledger_year_insert_guard('prepared_by');

-- Current definition: 20261012240000. Added: the requested tax year must be in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_read(p_tenant text, p_client text, p_actor text, p_tax_year integer, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; f jsonb := COALESCE(p_filter, '{}'::jsonb); lim integer; q text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_tax_year);
  lim := COALESCE((f->>'limit')::integer, 200);
  IF lim NOT BETWEEN 1 AND 500 OR p_tax_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  q := NULLIF(lower(btrim(f->>'text')), '');
  RETURN jsonb_build_object(
    'accounts', (SELECT COALESCE(jsonb_agg(jsonb_build_object('accountId', account_id, 'accountNumber', account_number, 'accountName', account_name,
        'accountType', account_type, 'accountSubtype', account_subtype, 'isActive', is_active, 'taxMapping', tax_mapping, 'source', source,
        'createdBy', created_by, 'createdAt', created_at, 'updatedAt', updated_at) ORDER BY account_number), '[]'::jsonb)
      FROM public.taxguard_ledger_accounts WHERE tenant_id = p_tenant AND client_id = p_client),
    'periods', (SELECT COALESCE(jsonb_agg(jsonb_build_object('periodId', period_id, 'periodName', period_name, 'taxYear', tax_year, 'startDate', start_date,
        'endDate', end_date, 'status', status, 'closedBy', closed_by, 'closedAt', closed_at, 'reopenedBy', reopened_by, 'reopenedAt', reopened_at,
        'reopenReason', reopen_reason) ORDER BY start_date), '[]'::jsonb)
      FROM public.taxguard_ledger_periods WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_tax_year),
    'entries', (SELECT COALESCE(jsonb_agg(public.taxguard_ledger_entry_json(p_tenant, p_client, x.entry_id) ORDER BY x.posting_date DESC, x.entry_number DESC), '[]'::jsonb) FROM (
      SELECT e.entry_id, e.posting_date, e.entry_number FROM public.taxguard_ledger_entries e
      WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND e.tax_year = p_tax_year
        AND (f->>'status' IS NULL OR e.status = f->>'status')
        AND (f->>'fromDate' IS NULL OR e.posting_date >= (f->>'fromDate')::date) AND (f->>'toDate' IS NULL OR e.posting_date <= (f->>'toDate')::date)
        AND (f->>'accountId' IS NULL OR EXISTS (SELECT 1 FROM public.taxguard_ledger_lines l WHERE l.tenant_id = e.tenant_id AND l.client_id = e.client_id AND l.entry_id = e.entry_id AND l.account_id = f->>'accountId'))
        AND (q IS NULL OR position(q IN lower(e.description || ' ' || COALESCE(e.reference, '') || ' ' || e.entry_number)) > 0)
      ORDER BY e.posting_date DESC, e.entry_number DESC LIMIT lim) x),
    'transactions', (SELECT COALESCE(jsonb_agg(row_data ORDER BY d DESC, id), '[]'::jsonb) FROM (
      SELECT t.transaction_date AS d, t.transaction_id AS id, jsonb_build_object('transactionId', t.transaction_id, 'accountId', t.account_id, 'externalId', t.external_id,
        'provider', t.provider, 'importBatchId', t.import_batch_id, 'transactionDate', t.transaction_date, 'postingDate', t.posting_date, 'description', t.description,
        'amountCents', t.amount_cents, 'duplicateStatus', t.duplicate_status, 'duplicateOf', t.duplicate_of, 'classificationStatus', t.classification_status,
        'assignedAccountId', t.assigned_account_id, 'journalEntryId', t.journal_entry_id, 'reviewedBy', t.reviewed_by, 'reviewedAt', t.reviewed_at,
        'reconciliationId', (SELECT reconciliation_id FROM public.taxguard_ledger_reconciliation_items i WHERE i.tenant_id = t.tenant_id AND i.client_id = t.client_id AND i.transaction_id = t.transaction_id)) AS row_data
      FROM public.taxguard_ledger_bank_transactions t WHERE t.tenant_id = p_tenant AND t.client_id = p_client AND extract(year FROM t.transaction_date) = p_tax_year
        AND (q IS NULL OR position(q IN lower(t.description)) > 0)
      ORDER BY t.transaction_date DESC, t.transaction_id LIMIT lim) tx),
    'reconciliations', (SELECT COALESCE(jsonb_agg(public.taxguard_ledger_reconciliation_json(p_tenant, p_client, reconciliation_id) ORDER BY created_at DESC), '[]'::jsonb)
      FROM public.taxguard_ledger_reconciliations WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_tax_year));
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

-- Current definition: 20261012240000. Added: the requested tax year must be in the actor's scope, and an "as of" date must fall inside that year (otherwise later years' activity was summed into the period).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_trial_balance(p_tenant text, p_client text, p_actor text, p_tax_year integer, p_as_of date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; start_date date := make_date(p_tax_year, 1, 1); end_date date := COALESCE(p_as_of, make_date(p_tax_year, 12, 31));
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_tax_year);
  IF p_as_of IS NOT NULL AND (p_as_of < start_date OR p_as_of > make_date(p_tax_year, 12, 31)) THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('accountId', t.account_id, 'accountNumber', t.account_number, 'accountName', t.account_name,
      'accountType', t.account_type, 'accountSubtype', t.account_subtype, 'beginningDebitCents', t.bd, 'beginningCreditCents', t.bc,
      'periodDebitCents', t.pd, 'periodCreditCents', t.pc) ORDER BY t.account_number), '[]'::jsonb)
    FROM (SELECT a.account_id, a.account_number, a.account_name, a.account_type, a.account_subtype,
        COALESCE(sum(l.debit_cents) FILTER (WHERE e.posting_date < start_date), 0) AS bd,
        COALESCE(sum(l.credit_cents) FILTER (WHERE e.posting_date < start_date), 0) AS bc,
        COALESCE(sum(l.debit_cents) FILTER (WHERE e.posting_date BETWEEN start_date AND end_date), 0) AS pd,
        COALESCE(sum(l.credit_cents) FILTER (WHERE e.posting_date BETWEEN start_date AND end_date), 0) AS pc
      FROM public.taxguard_ledger_accounts a
      LEFT JOIN public.taxguard_ledger_lines l ON l.tenant_id = a.tenant_id AND l.client_id = a.client_id AND l.account_id = a.account_id
      LEFT JOIN public.taxguard_ledger_entries e ON e.tenant_id = l.tenant_id AND e.client_id = l.client_id AND e.entry_id = l.entry_id AND e.status = 'POSTED' AND e.posting_date <= end_date
      WHERE a.tenant_id = p_tenant AND a.client_id = p_client
      GROUP BY a.account_id, a.account_number, a.account_name, a.account_type, a.account_subtype) t);
END $$;

-- Current definition: 20261012300000. Added: the requested tax year must be in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_work_queue(p_tenant text, p_client text, p_actor text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; y_start date; y_end date;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_tax_year);
  IF p_tax_year IS NULL OR p_tax_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  y_start := make_date(p_tax_year, 1, 1); y_end := make_date(p_tax_year, 12, 31);
  RETURN jsonb_build_object(
    'actorRole', r,
    'uncategorized', (SELECT COALESCE(jsonb_agg(jsonb_build_object('transactionId', t.transaction_id, 'accountId', t.account_id, 'transactionDate', t.transaction_date,
        'description', t.description, 'amountCents', t.amount_cents, 'duplicateStatus', t.duplicate_status) ORDER BY t.transaction_date, t.transaction_id), '[]'::jsonb)
      FROM (SELECT * FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = p_tenant AND client_id = p_client AND journal_entry_id IS NULL
        AND transaction_date BETWEEN y_start AND y_end ORDER BY transaction_date LIMIT 200) t),
    'possibleDuplicates', (SELECT count(*) FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = p_tenant AND client_id = p_client
      AND duplicate_status = 'POSSIBLE_DUPLICATE' AND journal_entry_id IS NULL AND transaction_date BETWEEN y_start AND y_end),
    'awaitingReview', (SELECT COALESCE(jsonb_agg(jsonb_build_object('entryId', e.entry_id, 'entryNumber', e.entry_number, 'postingDate', e.posting_date, 'description', e.description,
        'totalCents', e.total_cents, 'creatorUid', e.creator_uid, 'version', e.version) ORDER BY e.posting_date, e.entry_number), '[]'::jsonb)
      FROM public.taxguard_ledger_entries e WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND e.status = 'PREPARED' AND e.posting_date BETWEEN y_start AND y_end),
    'returnedToMe', (SELECT COALESCE(jsonb_agg(jsonb_build_object('entryId', e.entry_id, 'entryNumber', e.entry_number, 'description', e.description, 'reviewNote', e.review_note)
        ORDER BY e.entry_number), '[]'::jsonb)
      FROM public.taxguard_ledger_entries e WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND e.status = 'CORRECTION_REQUIRED' AND e.creator_uid = p_actor
        AND NOT EXISTS (SELECT 1 FROM public.taxguard_ledger_entries x WHERE x.tenant_id = e.tenant_id AND x.client_id = e.client_id AND x.replaces_entry_id = e.entry_id)),
    'openReconciliations', (SELECT COALESCE(jsonb_agg(public.taxguard_ledger_reconciliation_json(p_tenant, p_client, rc.reconciliation_id) ORDER BY rc.created_at), '[]'::jsonb)
      FROM public.taxguard_ledger_reconciliations rc WHERE rc.tenant_id = p_tenant AND rc.client_id = p_client AND rc.tax_year = p_tax_year AND rc.status = 'IN_PROGRESS'),
    'periods', (SELECT COALESCE(jsonb_agg(jsonb_build_object('periodId', p.period_id, 'periodName', p.period_name, 'startDate', p.start_date, 'endDate', p.end_date, 'status', p.status,
        'preparedEntries', (SELECT count(*) FROM public.taxguard_ledger_entries e WHERE e.tenant_id = p.tenant_id AND e.client_id = p.client_id AND e.status = 'PREPARED'
          AND e.posting_date BETWEEN p.start_date AND p.end_date),
        'uncategorizedTransactions', (SELECT count(*) FROM public.taxguard_ledger_bank_transactions t WHERE t.tenant_id = p.tenant_id AND t.client_id = p.client_id
          AND t.journal_entry_id IS NULL AND t.transaction_date BETWEEN p.start_date AND p.end_date)) ORDER BY p.start_date), '[]'::jsonb)
      FROM public.taxguard_ledger_periods p WHERE p.tenant_id = p_tenant AND p.client_id = p_client AND p.tax_year = p_tax_year));
END $$;

-- Current definition: 20261012240000. Added: the period's tax year must be in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_open_period(p_tenant text, p_client text, p_actor text, p_name text, p_tax_year integer, p_start date, p_end date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; pid text := 'period_' || p_client || '_' || p_name; existing record;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_tax_year);
  IF p_name IS NULL OR p_name !~ '^[A-Za-z0-9_-]{1,32}$' OR p_start IS NULL OR p_end IS NULL OR p_tax_year IS NULL THEN RAISE EXCEPTION 'PERIOD_INVALID' USING ERRCODE = 'P0001'; END IF;
  -- Serialize period creation per client so overlap checks cannot race.
  PERFORM 1 FROM public.taxguard_clients WHERE tenant_id = p_tenant AND client_id = p_client FOR UPDATE;
  SELECT * INTO existing FROM public.taxguard_ledger_periods WHERE tenant_id = p_tenant AND client_id = p_client AND period_name = p_name;
  IF FOUND THEN
    IF existing.tax_year = p_tax_year AND existing.start_date = p_start AND existing.end_date = p_end THEN RETURN jsonb_build_object('periodId', existing.period_id, 'created', false); END IF;
    RAISE EXCEPTION 'PERIOD_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    INSERT INTO public.taxguard_ledger_periods(tenant_id, client_id, period_id, period_name, tax_year, start_date, end_date, created_by)
      VALUES (p_tenant, p_client, pid, p_name, p_tax_year, p_start, p_end, p_actor);
  EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'PERIOD_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_PERIOD_OPENED', jsonb_build_object('periodId', pid, 'start', p_start, 'end', p_end));
  RETURN jsonb_build_object('periodId', pid, 'created', true);
END $$;

-- Current definition: 20261012240000. Added: the period's own tax year must be in scope (otherwise PERIOD_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_close_period(p_tenant text, p_client text, p_actor text, p_period text, p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; p record; pending integer;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'LEDGER_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO p FROM public.taxguard_ledger_periods WHERE tenant_id = p_tenant AND client_id = p_client AND period_id = p_period FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, p.tax_year) THEN RAISE EXCEPTION 'PERIOD_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_status NOT IN ('SOFT_CLOSED','HARD_CLOSED') OR p.status = 'HARD_CLOSED' OR p.status = p_status THEN
    RAISE EXCEPTION 'PERIOD_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO pending FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client AND status = 'PREPARED'
    AND (period_id = p_period OR posting_date BETWEEN p.start_date AND p.end_date);
  IF pending > 0 THEN RAISE EXCEPTION 'PERIOD_HAS_UNAPPROVED_ENTRIES' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_ledger_periods SET status = p_status, closed_by = p_actor, closed_at = now() WHERE tenant_id = p_tenant AND client_id = p_client AND period_id = p_period;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_PERIOD_CLOSED', jsonb_build_object('periodId', p_period, 'status', p_status));
  RETURN jsonb_build_object('periodId', p_period, 'status', p_status);
END $$;

-- Current definition: 20261012240000. Added: the period's own tax year must be in scope (otherwise PERIOD_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_reopen_period(p_tenant text, p_client text, p_actor text, p_period text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; p record; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'LEDGER_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF length(reason) NOT BETWEEN 5 AND 500 OR reason ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'REOPEN_REASON_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO p FROM public.taxguard_ledger_periods WHERE tenant_id = p_tenant AND client_id = p_client AND period_id = p_period FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, p.tax_year) THEN RAISE EXCEPTION 'PERIOD_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p.status = 'OPEN' THEN RAISE EXCEPTION 'PERIOD_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p.status = 'HARD_CLOSED' AND p.closed_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_ledger_periods SET status = 'OPEN', reopened_by = p_actor, reopened_at = now(), reopen_reason = reason
    WHERE tenant_id = p_tenant AND client_id = p_client AND period_id = p_period;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_PERIOD_REOPENED', jsonb_build_object('periodId', p_period, 'from', p.status));
  RETURN jsonb_build_object('periodId', p_period, 'status', 'OPEN');
END $$;

-- Current definition: 20261012240000. Added: the entry's own tax year must be in scope (otherwise ENTRY_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_review_entry(p_tenant text, p_client text, p_actor text, p_entry uuid, p_decision text, p_note text, p_version integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; e record; note text := NULLIF(btrim(COALESCE(p_note, '')), ''); target text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'LEDGER_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  target := CASE p_decision WHEN 'approve' THEN 'POSTED' WHEN 'reject' THEN 'REJECTED' WHEN 'request_correction' THEN 'CORRECTION_REQUIRED' END;
  IF target IS NULL OR p_version IS NULL OR (target <> 'POSTED' AND (note IS NULL OR length(note) NOT BETWEEN 5 AND 500)) OR length(COALESCE(note,'')) > 500 THEN
    RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO e FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client AND entry_id = p_entry FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, e.tax_year) THEN RAISE EXCEPTION 'ENTRY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF e.version <> p_version THEN RAISE EXCEPTION 'LEDGER_VERSION_CONFLICT' USING ERRCODE = 'P0001'; END IF;
  IF e.status <> 'PREPARED' THEN RAISE EXCEPTION 'ENTRY_NOT_PENDING_REVIEW' USING ERRCODE = 'P0001'; END IF;
  IF e.creator_uid = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_ledger_entries SET status = target, reviewer_uid = p_actor, review_note = note, reviewed_at = now(),
      posted_at = CASE WHEN target = 'POSTED' THEN now() END
    WHERE tenant_id = p_tenant AND client_id = p_client AND entry_id = p_entry;
  IF target = 'POSTED' AND e.reversal_of_entry_id IS NOT NULL THEN
    UPDATE public.taxguard_ledger_entries SET reversed_by_entry_id = p_entry WHERE tenant_id = p_tenant AND client_id = p_client AND entry_id = e.reversal_of_entry_id;
  END IF;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_ENTRY_' || target, jsonb_build_object('entryId', p_entry));
  RETURN public.taxguard_ledger_entry_json(p_tenant, p_client, p_entry);
END $$;

-- Current definition: 20261012240000. Added: the target tax year, and the bank transaction's own year (otherwise TRANSACTION_NOT_FOUND), must be in scope.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_categorize_transaction(p_tenant text, p_client text, p_actor text, p_txn uuid, p_account text, p_period text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t record; body jsonb; id uuid; amt bigint;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_tax_year);
  SELECT * INTO t FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = p_tenant AND client_id = p_client AND transaction_id = p_txn FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, extract(year FROM t.transaction_date)::integer) THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF t.journal_entry_id IS NOT NULL THEN RAISE EXCEPTION 'TRANSACTION_ALREADY_POSTED' USING ERRCODE = 'P0001'; END IF;
  IF p_account = t.account_id THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  amt := abs(t.amount_cents);
  body := jsonb_build_object('taxYear', p_tax_year, 'periodId', p_period, 'postingDate', to_char(t.posting_date, 'YYYY-MM-DD'), 'transactionDate', to_char(t.transaction_date, 'YYYY-MM-DD'),
    'description', left('Bank Feed: ' || t.description, 500), 'reference', t.external_id, 'source', 'BANK_FEED',
    'lines', CASE WHEN t.amount_cents < 0
      THEN jsonb_build_array(jsonb_build_object('accountId', p_account, 'debitCents', amt, 'memo', t.description), jsonb_build_object('accountId', t.account_id, 'creditCents', amt))
      ELSE jsonb_build_array(jsonb_build_object('accountId', t.account_id, 'debitCents', amt), jsonb_build_object('accountId', p_account, 'creditCents', amt, 'memo', t.description)) END);
  id := public.taxguard_ledger_insert_entry(p_tenant, p_client, p_actor, 'bank-' || p_txn::text, encode(sha256(convert_to(body::text, 'UTF8')), 'hex'), body, NULL, NULL);
  UPDATE public.taxguard_ledger_bank_transactions SET classification_status = 'POSTED', assigned_account_id = p_account, journal_entry_id = id,
      reviewed_by = p_actor, reviewed_at = now()
    WHERE tenant_id = p_tenant AND client_id = p_client AND transaction_id = p_txn;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_TRANSACTION_CATEGORIZED', jsonb_build_object('transactionId', p_txn, 'entryId', id));
  RETURN jsonb_build_object('transactionId', p_txn, 'entry', public.taxguard_ledger_entry_json(p_tenant, p_client, id));
END $$;

-- Current definition: 20261012240000. Added: the reconciliation's tax year must be in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_start_reconciliation(p_tenant text, p_client text, p_actor text, p_account text, p_tax_year integer,
  p_start date, p_end date, p_beginning bigint, p_ending bigint, p_tolerance bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; id uuid;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_tax_year);
  PERFORM 1 FROM public.taxguard_ledger_accounts WHERE tenant_id = p_tenant AND client_id = p_client AND account_id = p_account AND account_type IN ('ASSET','LIABILITY');
  IF NOT FOUND THEN RAISE EXCEPTION 'BANK_ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    INSERT INTO public.taxguard_ledger_reconciliations(tenant_id, client_id, account_id, tax_year, statement_start, statement_end, beginning_cents, ending_cents, tolerance_cents, created_by)
      VALUES (p_tenant, p_client, p_account, p_tax_year, p_start, p_end, p_beginning, p_ending, COALESCE(p_tolerance, 0), p_actor) RETURNING reconciliation_id INTO id;
  EXCEPTION WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_RECONCILIATION_STARTED', jsonb_build_object('reconciliationId', id, 'accountId', p_account));
  RETURN jsonb_build_object('reconciliationId', id);
END $$;

-- Current definition: 20261012240000. Added: the reconciliation's own tax year must be in scope (otherwise RECONCILIATION_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_set_cleared(p_tenant text, p_client text, p_actor text, p_recon uuid, p_txn uuid, p_cleared boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; rec record;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO rec FROM public.taxguard_ledger_reconciliations WHERE tenant_id = p_tenant AND client_id = p_client AND reconciliation_id = p_recon FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, rec.tax_year) THEN RAISE EXCEPTION 'RECONCILIATION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF rec.status = 'CLOSED' THEN RAISE EXCEPTION 'RECONCILIATION_ALREADY_CLOSED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = p_tenant AND client_id = p_client AND transaction_id = p_txn AND account_id = rec.account_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_cleared THEN
    BEGIN
      INSERT INTO public.taxguard_ledger_reconciliation_items(tenant_id, client_id, reconciliation_id, transaction_id, cleared_by)
        VALUES (p_tenant, p_client, p_recon, p_txn, p_actor) ON CONFLICT (tenant_id, client_id, reconciliation_id, transaction_id) DO NOTHING;
    EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'TRANSACTION_ALREADY_RECONCILED' USING ERRCODE = 'P0001';
    END;
  ELSE
    DELETE FROM public.taxguard_ledger_reconciliation_items WHERE tenant_id = p_tenant AND client_id = p_client AND reconciliation_id = p_recon AND transaction_id = p_txn;
  END IF;
  RETURN public.taxguard_ledger_reconciliation_json(p_tenant, p_client, p_recon);
END $$;

-- Current definition: 20261012240000. Added: the reconciliation's own tax year must be in scope (otherwise RECONCILIATION_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_finalize_reconciliation(p_tenant text, p_client text, p_actor text, p_recon uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; rec record; state jsonb;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO rec FROM public.taxguard_ledger_reconciliations WHERE tenant_id = p_tenant AND client_id = p_client AND reconciliation_id = p_recon FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, rec.tax_year) THEN RAISE EXCEPTION 'RECONCILIATION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF rec.status = 'CLOSED' THEN RAISE EXCEPTION 'RECONCILIATION_ALREADY_CLOSED' USING ERRCODE = 'P0001'; END IF;
  state := public.taxguard_ledger_reconciliation_json(p_tenant, p_client, p_recon);
  IF abs((state->>'varianceCents')::bigint) > rec.tolerance_cents THEN RAISE EXCEPTION 'RECONCILIATION_VARIANCE_UNRESOLVED' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_ledger_reconciliations SET status = 'CLOSED', completed_by = p_actor, completed_at = now()
    WHERE tenant_id = p_tenant AND client_id = p_client AND reconciliation_id = p_recon;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_RECONCILIATION_FINALIZED', jsonb_build_object('reconciliationId', p_recon, 'clearedCount', state->'clearedCount'));
  RETURN public.taxguard_ledger_reconciliation_json(p_tenant, p_client, p_recon);
END $$;

-- Current definition: 20261012240000. Added: a year-scoped actor sees only events whose record (entry, period or reconciliation) is in a year in scope.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_history(p_tenant text, p_client text, p_actor text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; whole boolean;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  whole := public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, NULL);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', action, 'actorUid', actor_uid, 'actorRole', actor_role, 'metadata', metadata - 'clientId', 'at', timestamp)
      ORDER BY timestamp DESC, id), '[]'::jsonb) FROM (
    SELECT * FROM public.taxguard_audit_log WHERE tenant_id = p_tenant AND metadata->>'clientId' = p_client AND action LIKE 'LEDGER\_%'
      AND (whole OR public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, public.taxguard_ledger_event_year(p_tenant, p_client, metadata)))
    ORDER BY timestamp DESC, id LIMIT p_limit) h);
END $$;

-- Current definition: 20261012290000. Added: the requested tax year must be in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_b2t_open_set(p_tenant text, p_client text, p_actor text, p_year integer, p_family text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; v integer; prior uuid; sid uuid; s public.taxguard_b2t_mapping_sets;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_year);
  PERFORM public.taxguard_b2t_family(p_family);
  IF p_year IS NULL OR p_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year AND return_family = p_family AND status IN ('DRAFT','PENDING_REVIEW');
  IF FOUND THEN RETURN public.taxguard_b2t_set_json(s); END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year AND return_family = p_family;
  SELECT set_id INTO prior FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year AND return_family = p_family AND status = 'APPROVED';
  BEGIN
    INSERT INTO public.taxguard_b2t_mapping_sets(tenant_id, client_id, tax_year, return_family, version, prepared_by) VALUES (p_tenant, p_client, p_year, p_family, v, p_actor) RETURNING set_id INTO sid;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'B2T_CONCURRENT_UPDATE' USING ERRCODE = 'P0001';
  END;
  IF prior IS NOT NULL THEN
    INSERT INTO public.taxguard_b2t_mappings(tenant_id, client_id, set_id, account_id, return_family, category_code)
      SELECT tenant_id, client_id, sid, account_id, return_family, category_code FROM public.taxguard_b2t_mappings WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = prior;
  END IF;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, 'B2T_MAPPING_SET_OPENED', jsonb_build_object('setId', sid, 'taxYear', p_year, 'version', v));
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = sid;
  RETURN public.taxguard_b2t_set_json(s);
END $$;

-- Current definition: 20261012290000. Added: the requested tax year must be in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_b2t_overview(p_tenant text, p_client text, p_actor text, p_year integer, p_family text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_year);
  PERFORM public.taxguard_b2t_family(p_family);
  RETURN jsonb_build_object(
    'mappingSets', (SELECT COALESCE(jsonb_agg(public.taxguard_b2t_set_json(s) ORDER BY s.version DESC), '[]'::jsonb) FROM public.taxguard_b2t_mapping_sets s
      WHERE s.tenant_id = p_tenant AND s.client_id = p_client AND s.tax_year = p_year AND s.return_family = p_family),
    'adjustments', (SELECT COALESCE(jsonb_agg(jsonb_build_object('adjustmentId', a.adjustment_id, 'categoryCode', a.category_code, 'amountCents', a.amount_cents, 'adjustmentType', a.adjustment_type,
        'description', a.description, 'evidenceDocumentId', a.evidence_document_id, 'status', a.status, 'preparedBy', a.prepared_by, 'reviewedBy', a.reviewed_by, 'reviewNote', a.review_note)
        ORDER BY a.created_at), '[]'::jsonb) FROM public.taxguard_b2t_adjustments a WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND a.tax_year = p_year AND a.return_family = p_family),
    'workpapers', (SELECT COALESCE(jsonb_agg(jsonb_build_object('workpaperId', w.workpaper_id, 'status', w.status, 'reconciled', w.reconciled, 'unmappedAccounts', w.unmapped_accounts,
        'caseId', w.case_id, 'generatedBy', w.generated_by, 'reviewedBy', w.reviewed_by, 'snapshotSha256', w.snapshot_sha256, 'snapshot', w.snapshot, 'createdAt', w.created_at) ORDER BY w.created_at DESC), '[]'::jsonb)
      FROM public.taxguard_b2t_workpapers w WHERE w.tenant_id = p_tenant AND w.client_id = p_client AND w.tax_year = p_year AND w.return_family = p_family));
END $$;

-- Current definition: 20261012290000. Added: the requested tax year must be in the actor's scope.
CREATE OR REPLACE FUNCTION public.taxguard_b2t_generate_workpaper(p_tenant text, p_client text, p_actor text, p_year integer, p_family text, p_case text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_b2t_mapping_sets; snap jsonb; total bigint; mapped bigint; unmapped_amt bigint; unmapped_n integer; id uuid; recon boolean;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  PERFORM public.taxguard_ledger_year_guard(p_tenant, p_client, p_actor, r, p_year);
  PERFORM public.taxguard_b2t_family(p_family);
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year AND return_family = p_family AND status = 'APPROVED';
  IF NOT FOUND THEN RAISE EXCEPTION 'APPROVED_MAPPING_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF p_case IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_cases WHERE tenant_id = p_tenant AND client_id = p_client AND case_id = p_case AND tax_year = p_year) THEN
    RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  WITH activity AS (
    SELECT l.account_id, sum(l.debit_cents - l.credit_cents) AS net FROM public.taxguard_ledger_lines l
      JOIN public.taxguard_ledger_entries e ON e.tenant_id = l.tenant_id AND e.client_id = l.client_id AND e.entry_id = l.entry_id
      WHERE l.tenant_id = p_tenant AND l.client_id = p_client AND e.status = 'POSTED' AND e.posting_date BETWEEN make_date(p_year, 1, 1) AND make_date(p_year, 12, 31)
      GROUP BY l.account_id),
  mapped_rows AS (SELECT m.category_code, a.account_id, a.net FROM activity a JOIN public.taxguard_b2t_mappings m ON m.tenant_id = p_tenant AND m.client_id = p_client AND m.set_id = s.set_id AND m.account_id = a.account_id),
  adj AS (SELECT category_code, sum(amount_cents) AS amt FROM public.taxguard_b2t_adjustments WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = p_year
      AND return_family = p_family AND status = 'APPROVED' GROUP BY category_code),
  cats AS (SELECT c.category_code, c.label, c.reference_text, COALESCE((SELECT sum(net) FROM mapped_rows mr WHERE mr.category_code = c.category_code), 0) AS book,
      COALESCE((SELECT amt FROM adj WHERE adj.category_code = c.category_code), 0) AS adjustments
    FROM public.taxguard_b2t_categories c WHERE c.tenant_id = p_tenant AND c.return_family = p_family)
  SELECT jsonb_build_object('categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('categoryCode', category_code, 'label', label, 'referenceText', reference_text,
        'bookCents', book, 'adjustmentCents', adjustments, 'taxBasisCents', book + adjustments) ORDER BY category_code) FROM cats WHERE book <> 0 OR adjustments <> 0), '[]'::jsonb),
      'unmapped', COALESCE((SELECT jsonb_agg(jsonb_build_object('accountId', a.account_id, 'accountNumber', la.account_number, 'accountName', la.account_name, 'netCents', a.net) ORDER BY la.account_number)
        FROM activity a JOIN public.taxguard_ledger_accounts la ON la.tenant_id = p_tenant AND la.client_id = p_client AND la.account_id = a.account_id
        WHERE a.net <> 0 AND NOT EXISTS (SELECT 1 FROM mapped_rows mr WHERE mr.account_id = a.account_id)), '[]'::jsonb)),
    COALESCE((SELECT sum(net) FROM activity), 0), COALESCE((SELECT sum(net) FROM mapped_rows), 0)
    INTO snap, total, mapped;
  SELECT COALESCE(sum((u->>'netCents')::bigint), 0), count(*) INTO unmapped_amt, unmapped_n FROM jsonb_array_elements(snap->'unmapped') u;
  recon := mapped + unmapped_amt = total;
  snap := snap || jsonb_build_object('taxYear', p_year, 'returnFamily', p_family, 'mappingSetId', s.set_id, 'mappingVersion', s.version,
    'reconciliation', jsonb_build_object('ledgerActivityCents', total, 'mappedCents', mapped, 'unmappedCents', unmapped_amt, 'differenceCents', total - mapped - unmapped_amt),
    'notice', 'Workpaper groupings and adjustments for professional review. TaxGuard computes no tax and asserts no form line or rule.');
  INSERT INTO public.taxguard_b2t_workpapers(tenant_id, client_id, tax_year, return_family, set_id, case_id, snapshot, snapshot_sha256, reconciled, unmapped_accounts, generated_by)
    VALUES (p_tenant, p_client, p_year, p_family, s.set_id, p_case, snap, encode(sha256(convert_to(snap::text, 'UTF8')), 'hex'), recon, unmapped_n, p_actor) RETURNING workpaper_id INTO id;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, 'B2T_WORKPAPER_GENERATED', jsonb_build_object('workpaperId', id, 'taxYear', p_year, 'caseId', p_case));
  RETURN jsonb_build_object('workpaperId', id, 'reconciled', recon, 'unmappedAccounts', unmapped_n, 'snapshot', snap);
END $$;

-- Current definition: 20261012290000. Added: the mapping set's own tax year must be in scope (otherwise MAPPING_SET_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_b2t_set_mapping(p_tenant text, p_client text, p_actor text, p_set uuid, p_account text, p_category text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_b2t_mapping_sets;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = p_set FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, s.tax_year) THEN RAISE EXCEPTION 'MAPPING_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF s.status <> 'DRAFT' THEN RAISE EXCEPTION 'MAPPING_SET_NOT_EDITABLE' USING ERRCODE = 'P0001'; END IF;
  IF p_category IS NULL THEN
    DELETE FROM public.taxguard_b2t_mappings WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = p_set AND account_id = p_account;
  ELSE
    PERFORM 1 FROM public.taxguard_b2t_categories WHERE tenant_id = p_tenant AND return_family = s.return_family AND category_code = p_category AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'CATEGORY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    PERFORM 1 FROM public.taxguard_ledger_accounts WHERE tenant_id = p_tenant AND client_id = p_client AND account_id = p_account;
    IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.taxguard_b2t_mappings(tenant_id, client_id, set_id, account_id, return_family, category_code) VALUES (p_tenant, p_client, p_set, p_account, s.return_family, p_category)
      ON CONFLICT (tenant_id, client_id, set_id, account_id) DO UPDATE SET category_code = EXCLUDED.category_code;
  END IF;
  RETURN public.taxguard_b2t_set_json(s);
END $$;

-- Current definition: 20261012290000. Added: the mapping set's own tax year must be in scope (otherwise MAPPING_SET_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_b2t_review_set(p_tenant text, p_client text, p_actor text, p_set uuid, p_action text, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; s public.taxguard_b2t_mapping_sets; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = p_set FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, s.tax_year) THEN RAISE EXCEPTION 'MAPPING_SET_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p_action = 'submit' THEN
    IF s.status <> 'DRAFT' THEN RAISE EXCEPTION 'B2T_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
    UPDATE public.taxguard_b2t_mapping_sets SET status = 'PENDING_REVIEW' WHERE set_id = s.set_id AND tenant_id = p_tenant;
  ELSIF p_action IN ('approve','reject') THEN
    IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'B2T_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF s.status <> 'PENDING_REVIEW' THEN RAISE EXCEPTION 'B2T_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF s.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'reject' AND (note IS NULL OR length(note) NOT BETWEEN 5 AND 500) THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
    IF p_action = 'approve' THEN
      UPDATE public.taxguard_b2t_mapping_sets SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = s.tax_year AND return_family = s.return_family AND status = 'APPROVED';
    END IF;
    UPDATE public.taxguard_b2t_mapping_sets SET status = CASE WHEN p_action = 'approve' THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(), review_note = note
      WHERE set_id = s.set_id AND tenant_id = p_tenant;
  ELSE RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, 'B2T_MAPPING_SET_' || upper(p_action), jsonb_build_object('setId', s.set_id, 'version', s.version));
  SELECT * INTO s FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = p_set;
  RETURN public.taxguard_b2t_set_json(s);
END $$;

-- Current definition: 20261012290000. Added: the adjustment's own tax year must be in scope (otherwise ADJUSTMENT_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_b2t_review_adjustment(p_tenant text, p_client text, p_actor text, p_adjustment uuid, p_approve boolean, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; a record; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'B2T_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO a FROM public.taxguard_b2t_adjustments WHERE tenant_id = p_tenant AND client_id = p_client AND adjustment_id = p_adjustment FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, a.tax_year) THEN RAISE EXCEPTION 'ADJUSTMENT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF a.status <> 'PREPARED' THEN RAISE EXCEPTION 'B2T_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF a.prepared_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF NOT p_approve AND (note IS NULL OR length(note) NOT BETWEEN 5 AND 500) THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_b2t_adjustments SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(), review_note = note
    WHERE tenant_id = p_tenant AND client_id = p_client AND adjustment_id = p_adjustment;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, CASE WHEN p_approve THEN 'B2T_ADJUSTMENT_APPROVED' ELSE 'B2T_ADJUSTMENT_REJECTED' END, jsonb_build_object('adjustmentId', p_adjustment));
  RETURN jsonb_build_object('adjustmentId', p_adjustment, 'status', CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END);
END $$;

-- Current definition: 20261012290000. Added: the workpaper's own tax year must be in scope (otherwise WORKPAPER_NOT_FOUND).
CREATE OR REPLACE FUNCTION public.taxguard_b2t_review_workpaper(p_tenant text, p_client text, p_actor text, p_workpaper uuid, p_approve boolean, p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; w record; note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'B2T_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO w FROM public.taxguard_b2t_workpapers WHERE tenant_id = p_tenant AND client_id = p_client AND workpaper_id = p_workpaper FOR UPDATE;
  IF NOT FOUND OR NOT public.taxguard_ledger_year_scope(p_tenant, p_client, p_actor, r, w.tax_year) THEN RAISE EXCEPTION 'WORKPAPER_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF w.status <> 'DRAFT' THEN RAISE EXCEPTION 'B2T_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF w.generated_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  IF p_approve AND (NOT w.reconciled OR w.unmapped_accounts > 0) THEN RAISE EXCEPTION 'WORKPAPER_NOT_RECONCILED' USING ERRCODE = 'P0001'; END IF;
  IF NOT p_approve AND (note IS NULL OR length(note) NOT BETWEEN 5 AND 500) THEN RAISE EXCEPTION 'B2T_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  -- The mapping set must still be the approved one (a newer approval makes this workpaper stale).
  IF p_approve AND NOT EXISTS (SELECT 1 FROM public.taxguard_b2t_mapping_sets WHERE tenant_id = p_tenant AND client_id = p_client AND set_id = w.set_id AND status = 'APPROVED') THEN
    RAISE EXCEPTION 'WORKPAPER_STALE' USING ERRCODE = 'P0001';
  END IF;
  IF p_approve THEN
    UPDATE public.taxguard_b2t_workpapers SET status = 'SUPERSEDED' WHERE tenant_id = p_tenant AND client_id = p_client AND tax_year = w.tax_year AND return_family = w.return_family AND status = 'APPROVED';
  END IF;
  UPDATE public.taxguard_b2t_workpapers SET status = CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END, reviewed_by = p_actor, reviewed_at = now(), review_note = note
    WHERE tenant_id = p_tenant AND client_id = p_client AND workpaper_id = p_workpaper;
  PERFORM public.taxguard_b2t_audit(p_tenant, p_client, p_actor, r, CASE WHEN p_approve THEN 'B2T_WORKPAPER_APPROVED' ELSE 'B2T_WORKPAPER_REJECTED' END, jsonb_build_object('workpaperId', p_workpaper));
  RETURN jsonb_build_object('workpaperId', p_workpaper, 'status', CASE WHEN p_approve THEN 'APPROVED' ELSE 'REJECTED' END);
END $$;
