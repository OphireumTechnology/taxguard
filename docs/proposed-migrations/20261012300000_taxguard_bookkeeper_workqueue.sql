-- PROPOSAL 030 ONLY. NOT APPLIED. Requires the actual core schema and proposal 024 (ledger).
-- Read-only bookkeeper work queue for one client and tax year, under the ledger authority rules
-- (active staff with a current assignment, or an administrator). Bookkeeper postings themselves
-- are forced to PREPARED (independent review) by proposal 024's insert function.
-- Rollback (development): DROP FUNCTION public.taxguard_ledger_work_queue(text,text,text,integer).

CREATE OR REPLACE FUNCTION public.taxguard_ledger_work_queue(p_tenant text, p_client text, p_actor text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; y_start date; y_end date;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
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
REVOKE ALL ON FUNCTION public.taxguard_ledger_work_queue(text,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_ledger_work_queue(text,text,text,integer) TO service_role;
