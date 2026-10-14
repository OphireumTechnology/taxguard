-- TaxGuard proposal 049: Data API surface lockdown and grant hygiene (Phase 10). REVIEW ONLY; not applied.
--
-- Found by the Phase 10 migration readiness audit (scripts/migrations/migration-audit.mjs), which
-- composes every migration with Supabase's default privileges reproduced:
--  1. Supabase grants ALL on new public tables and functions to anon and authenticated. The core
--     migrations rely on row-level security alone for those tables.
--  2. Seven core bookkeeping tables (20260930) have a permissive `FOR ALL TO public` policy keyed on
--     a top-level `tenant_id` JWT claim. If an access-token hook ever adds that claim, any signed-in
--     user of the tenant — including a client — could read and write the tenant's journal entries,
--     bank transactions, reconciliations, chart of accounts, periods, book-to-tax adjustments and
--     sync state directly through the Data API with the public anon key.
--  3. Fifteen trigger functions and taxguard_privileged_max_age_seconds() are executable by PUBLIC
--     (trigger functions cannot be invoked directly, but the grants are unnecessary).
--  4. taxguard_is_staff_assigned_to_client / _engagement (SECURITY DEFINER) are executable by
--     anon and authenticated, so any caller can ask whether an arbitrary user is assigned to an
--     arbitrary client.
-- The application never reads or writes tables from the browser: every server store uses the
-- service role, and the browser uses Supabase only for authentication. Historical migrations are
-- not modified; this proposal corrects the effective privileges.
--
-- Kept deliberately: authenticated SELECT on taxguard_clients and taxguard_cases, because the
-- vault storage policies (20261004) evaluate them as the signed-in user; their own policies limit a
-- user to rows they own. Whether direct storage reads are retired entirely is an owner decision.
--
-- Depends on: all core migrations. Objects created by later proposals are covered by the default-
-- privilege change; later proposals still revoke explicitly (enforced by the readiness audit).
-- Idempotent: DROP POLICY IF EXISTS / REVOKE.
-- Rollback (development): re-run 20260930 policy statements and the GRANTs of 20261002; Supabase
-- default privileges can be restored with ALTER DEFAULT PRIVILEGES ... GRANT.

-- 2. Remove the tenant-claim policies; the service role bypasses row-level security.
DROP POLICY IF EXISTS rls_taxguard_coa_all ON public.taxguard_chart_of_accounts;
DROP POLICY IF EXISTS rls_taxguard_periods_all ON public.taxguard_accounting_periods;
DROP POLICY IF EXISTS rls_taxguard_je_all ON public.taxguard_journal_entries;
DROP POLICY IF EXISTS rls_taxguard_bank_txns_all ON public.taxguard_bank_transactions;
DROP POLICY IF EXISTS rls_taxguard_recons_all ON public.taxguard_bank_reconciliations;
DROP POLICY IF EXISTS rls_taxguard_b2t_all ON public.taxguard_book_to_tax_adjustments;
DROP POLICY IF EXISTS rls_taxguard_sync_all ON public.taxguard_accounting_sync_states;

DO $$ DECLARE r record; BEGIN
  -- 1. No client-facing role writes any TaxGuard or AI table; reads only where storage needs them.
  FOR r IN SELECT c.oid::regclass AS rel, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m') AND (c.relname LIKE 'taxguard\_%' OR c.relname LIKE 'ai\_%') LOOP
    IF r.relname IN ('taxguard_clients','taxguard_cases') THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON %s FROM PUBLIC, anon, authenticated', r.rel);
      EXECUTE format('REVOKE ALL ON %s FROM anon', r.rel);
    ELSE
      EXECUTE format('REVOKE ALL ON %s FROM PUBLIC, anon, authenticated', r.rel);
    END IF;
  END LOOP;
  FOR r IN SELECT c.oid::regclass AS rel FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'S' AND (c.relname LIKE 'taxguard\_%' OR c.relname LIKE 'ai\_%') LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', r.rel);
  END LOOP;
  -- 3 and 4. Functions: nothing TaxGuard or AI is executable by PUBLIC, anon or authenticated.
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND (p.proname LIKE 'taxguard\_%' OR p.proname LIKE 'ai\_%') LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Objects created later by the migration role are not granted to client-facing roles by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
