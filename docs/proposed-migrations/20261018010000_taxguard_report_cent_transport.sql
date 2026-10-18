-- Phase 15 exact report transport. Development proposal; no hosted execution authorized.
-- Keep historical RPCs unchanged. Cast numeric aggregates to text BEFORE a JSON client parses them.
-- Invoker wrappers retain the existing underlying RPC actor/tenant/client authorization.

CREATE OR REPLACE FUNCTION public.taxguard_ledger_trial_balance_exact(p_tenant text, p_client text, p_actor text, p_tax_year integer, p_as_of date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(r || jsonb_build_object(
    'beginningDebitCents', r->>'beginningDebitCents', 'beginningCreditCents', r->>'beginningCreditCents',
    'periodDebitCents', r->>'periodDebitCents', 'periodCreditCents', r->>'periodCreditCents') ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(public.taxguard_ledger_trial_balance(p_tenant,p_client,p_actor,p_tax_year,p_as_of)) WITH ORDINALITY AS a(r,ord);
$$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_general_ledger_exact(p_tenant text, p_client text, p_actor text, p_tax_year integer, p_account text, p_filter jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT COALESCE(jsonb_agg(r || jsonb_build_object('openingCents', r->>'openingCents', 'endingCents', r->>'endingCents',
    'lines', (SELECT COALESCE(jsonb_agg(l || jsonb_build_object('debitCents', l->>'debitCents',
      'creditCents', l->>'creditCents', 'runningCents', l->>'runningCents') ORDER BY line_ord), '[]'::jsonb)
      FROM jsonb_array_elements(r->'lines') WITH ORDINALITY AS d(l,line_ord))) ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(public.taxguard_ledger_general_ledger(p_tenant,p_client,p_actor,p_tax_year,p_account,p_filter)) WITH ORDINALITY AS a(r,ord);
$$;

REVOKE ALL ON FUNCTION public.taxguard_ledger_trial_balance_exact(text,text,text,integer,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.taxguard_ledger_general_ledger_exact(text,text,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.taxguard_ledger_trial_balance_exact(text,text,text,integer,date) TO service_role;
GRANT EXECUTE ON FUNCTION public.taxguard_ledger_general_ledger_exact(text,text,text,integer,text,jsonb) TO service_role;
