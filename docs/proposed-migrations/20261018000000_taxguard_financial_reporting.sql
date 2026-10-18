-- Phase 15 additive financial reporting proposal. Development only; no hosted execution authorized.
-- Depends on proposal 024. Historical proposal bytes remain unchanged.

-- Complete balances and bounded per-account detail share one database snapshot. The
-- display limit is applied only AFTER integer-cent totals and running sums.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_general_ledger(p_tenant text, p_client text, p_actor text, p_tax_year integer, p_account text, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; lo date; hi date; lim integer;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF p_tax_year IS NULL OR p_tax_year NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  lo := COALESCE((p_filter->>'fromDate')::date, make_date(p_tax_year, 1, 1));
  hi := COALESCE((p_filter->>'toDate')::date, make_date(p_tax_year, 12, 31));
  lim := COALESCE((p_filter->>'limit')::integer, 500);
  IF lo < make_date(p_tax_year, 1, 1) OR hi > make_date(p_tax_year, 12, 31) OR hi < lo OR lim NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  RETURN (
    WITH activity AS MATERIALIZED (
      SELECT l.account_id, l.line_no, l.debit_cents, l.credit_cents, e.entry_id, e.entry_number, e.posting_date, e.description
      FROM public.taxguard_ledger_lines l JOIN public.taxguard_ledger_entries e
        ON e.tenant_id = l.tenant_id AND e.client_id = l.client_id AND e.entry_id = l.entry_id
      WHERE l.tenant_id = p_tenant AND l.client_id = p_client AND (p_account IS NULL OR l.account_id = p_account)
        AND e.status = 'POSTED' AND e.posting_date <= hi
    ), totals AS (
      SELECT account_id, COALESCE(sum(debit_cents-credit_cents) FILTER (WHERE posting_date < lo), 0) AS opening,
        sum(debit_cents-credit_cents) AS ending, count(*) FILTER (WHERE posting_date >= lo) AS line_count
      FROM activity GROUP BY account_id
    ), running AS (
      SELECT *, sum(debit_cents-credit_cents) OVER (PARTITION BY account_id ORDER BY posting_date, entry_number, line_no ROWS UNBOUNDED PRECEDING) AS balance
      FROM activity
    ), ranked AS (
      SELECT *, row_number() OVER (PARTITION BY account_id ORDER BY posting_date DESC, entry_number DESC, line_no DESC) AS rn
      FROM running WHERE posting_date >= lo
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('accountId', a.account_id, 'accountNumber', a.account_number,
      'accountName', a.account_name, 'accountType', a.account_type, 'openingCents', COALESCE(t.opening, 0),
      'endingCents', COALESCE(t.ending, 0), 'totalLineCount', COALESCE(t.line_count, 0),
      'lines', COALESCE((SELECT jsonb_agg(jsonb_build_object('entryId', d.entry_id, 'entryNumber', d.entry_number,
        'postingDate', d.posting_date, 'description', d.description, 'debitCents', d.debit_cents,
        'creditCents', d.credit_cents, 'runningCents', d.balance) ORDER BY d.posting_date, d.entry_number, d.line_no)
        FROM ranked d WHERE d.account_id = a.account_id AND d.rn <= lim), '[]'::jsonb)) ORDER BY a.account_number), '[]'::jsonb)
    FROM public.taxguard_ledger_accounts a LEFT JOIN totals t ON t.account_id = a.account_id
    WHERE a.tenant_id = p_tenant AND a.client_id = p_client AND (p_account IS NULL OR a.account_id = p_account)
      AND (p_account IS NOT NULL OR t.account_id IS NOT NULL)
  );
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation OR numeric_value_out_of_range THEN
  RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
END $$;

REVOKE ALL ON FUNCTION public.taxguard_ledger_general_ledger(text,text,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_ledger_general_ledger(text,text,text,integer,text,jsonb) TO service_role;
