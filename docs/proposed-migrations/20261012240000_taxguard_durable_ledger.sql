-- PROPOSAL 024 ONLY. NOT APPLIED. Requires the actual core schema (supabase/migrations) only.
-- Durable, tenant- and client-isolated general ledger: chart of accounts, periods, journal
-- entries and lines, bank transactions, reconciliations, per-client counters and audit.
--
-- Money is stored as BIGINT cents. Every row carries (tenant_id, client_id) and every
-- reference is a composite foreign key within that pair, so a row can never point at another
-- client's account, entry or period. Mutations go through SECURITY DEFINER functions
-- executable by service_role only; tables are not readable by anon/authenticated.
--
-- Database-level guarantees (independent of the API):
--   * Each journal entry has >= 2 lines and balances exactly (deferred constraint trigger).
--   * Lines are immutable; entries change only through permitted status transitions.
--   * No entry may be inserted or posted on a date covered by a HARD_CLOSED period; a
--     SOFT_CLOSED period accepts only reviewed (adjusting / reversing) entries. Posting takes
--     a share lock on covering periods; closing takes an update lock, so they serialize.
--   * Periods of a client never overlap; closing requires no PREPARED entry in the period.
--   * A bank transaction posts at most once (unique journal_entry_id) and is cleared into at
--     most one reconciliation; closed reconciliations are immutable.
--   * Idempotency keys: same key + same request hash replays; a different hash conflicts.
--
-- Rollback (development only, before any production data exists):
--   DROP FUNCTION ... for every taxguard_ledger_* function below, then
--   DROP TABLE taxguard_ledger_reconciliation_items, taxguard_ledger_reconciliations,
--     taxguard_ledger_bank_transactions, taxguard_ledger_lines, taxguard_ledger_entries,
--     taxguard_ledger_periods, taxguard_ledger_accounts, taxguard_ledger_counters CASCADE;
--   Audit rows written to taxguard_audit_log are retained deliberately.

-- ------------------------------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.taxguard_ledger_counters (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  next_entry_number BIGINT NOT NULL DEFAULT 1 CHECK (next_entry_number > 0),
  PRIMARY KEY (tenant_id, client_id),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.taxguard_ledger_accounts (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  account_id VARCHAR(160) NOT NULL,
  account_number VARCHAR(16) NOT NULL CHECK (account_number ~ '^[0-9A-Za-z.-]{1,16}$'),
  account_name VARCHAR(160) NOT NULL CHECK (length(btrim(account_name)) > 0),
  account_type VARCHAR(16) NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','COGS','EXPENSE','OTHER_INCOME','OTHER_EXPENSE')),
  account_subtype VARCHAR(48) NOT NULL CHECK (account_subtype ~ '^[A-Z_]{1,48}$'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  tax_mapping JSONB CHECK (tax_mapping IS NULL OR jsonb_typeof(tax_mapping) = 'object'),
  source VARCHAR(32) NOT NULL DEFAULT 'MANUAL_ACCOUNTANT' CHECK (source IN ('SYSTEM_BOOTSTRAP','MANUAL_ACCOUNTANT','QUICKBOOKS_IMPORT','XERO_IMPORT')),
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, account_id),
  UNIQUE (tenant_id, client_id, account_number),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.taxguard_ledger_periods (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  period_id VARCHAR(160) NOT NULL,
  period_name VARCHAR(32) NOT NULL CHECK (period_name ~ '^[A-Za-z0-9_-]{1,32}$'),
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  start_date DATE NOT NULL, end_date DATE NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','SOFT_CLOSED','HARD_CLOSED')),
  closed_by VARCHAR(128), closed_at TIMESTAMPTZ,
  reopened_by VARCHAR(128), reopened_at TIMESTAMPTZ, reopen_reason TEXT,
  created_by VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, period_id),
  UNIQUE (tenant_id, client_id, period_name),
  CHECK (start_date <= end_date AND extract(year FROM start_date) = tax_year AND extract(year FROM end_date) = tax_year),
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_taxguard_ledger_periods_dates ON public.taxguard_ledger_periods(tenant_id, client_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS public.taxguard_ledger_entries (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  entry_id UUID NOT NULL DEFAULT gen_random_uuid(),
  entry_number VARCHAR(16) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  period_id VARCHAR(160),
  posting_date DATE NOT NULL, transaction_date DATE NOT NULL,
  description VARCHAR(500) NOT NULL CHECK (length(btrim(description)) > 0),
  reference VARCHAR(128),
  source VARCHAR(16) NOT NULL CHECK (source IN ('MANUAL','BANK_FEED','QUICKBOOKS','XERO','ADJUSTING','CLOSING')),
  is_adjusting BOOLEAN NOT NULL DEFAULT false,
  adjusting_type VARCHAR(16) CHECK (adjusting_type IS NULL OR adjusting_type IN ('ACCRUAL','PREPAYMENT','DEPRECIATION','AMORTIZATION','RECLASSIFICATION','TAX_M1')),
  status VARCHAR(24) NOT NULL CHECK (status IN ('PREPARED','POSTED','REJECTED','CORRECTION_REQUIRED')),
  total_cents BIGINT NOT NULL CHECK (total_cents > 0),
  creator_uid VARCHAR(128) NOT NULL,
  reviewer_uid VARCHAR(128), review_note VARCHAR(500), reviewed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  reversal_of_entry_id UUID, reversed_by_entry_id UUID, replaces_entry_id UUID,
  document_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(document_ids) = 'array'),
  idempotency_key VARCHAR(128) NOT NULL, request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, entry_id),
  UNIQUE (tenant_id, client_id, entry_number),
  UNIQUE (tenant_id, client_id, idempotency_key),
  CHECK ((status = 'POSTED') = (posted_at IS NOT NULL)),
  CHECK (reviewer_uid IS NULL OR reviewer_uid <> creator_uid),
  FOREIGN KEY (tenant_id, client_id, period_id) REFERENCES public.taxguard_ledger_periods(tenant_id, client_id, period_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id, reversal_of_entry_id) REFERENCES public.taxguard_ledger_entries(tenant_id, client_id, entry_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id, reversed_by_entry_id) REFERENCES public.taxguard_ledger_entries(tenant_id, client_id, entry_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id, client_id, replaces_entry_id) REFERENCES public.taxguard_ledger_entries(tenant_id, client_id, entry_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id) REFERENCES public.taxguard_clients(tenant_id, client_id) ON DELETE RESTRICT
);
-- At most one live (prepared or posted) reversal per entry; a rejected reversal may be retried.
CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_ledger_live_reversal ON public.taxguard_ledger_entries(tenant_id, client_id, reversal_of_entry_id)
  WHERE reversal_of_entry_id IS NOT NULL AND status IN ('PREPARED','POSTED');
CREATE INDEX IF NOT EXISTS idx_taxguard_ledger_entries_date ON public.taxguard_ledger_entries(tenant_id, client_id, posting_date, entry_id);
CREATE INDEX IF NOT EXISTS idx_taxguard_ledger_entries_status ON public.taxguard_ledger_entries(tenant_id, client_id, status, posting_date);

CREATE TABLE IF NOT EXISTS public.taxguard_ledger_lines (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  entry_id UUID NOT NULL, line_no SMALLINT NOT NULL CHECK (line_no BETWEEN 1 AND 500),
  account_id VARCHAR(160) NOT NULL,
  debit_cents BIGINT NOT NULL DEFAULT 0 CHECK (debit_cents >= 0),
  credit_cents BIGINT NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  memo VARCHAR(500), tax_category VARCHAR(64),
  PRIMARY KEY (tenant_id, client_id, entry_id, line_no),
  CHECK ((debit_cents > 0) <> (credit_cents > 0)),
  FOREIGN KEY (tenant_id, client_id, entry_id) REFERENCES public.taxguard_ledger_entries(tenant_id, client_id, entry_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id, account_id) REFERENCES public.taxguard_ledger_accounts(tenant_id, client_id, account_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_taxguard_ledger_lines_account ON public.taxguard_ledger_lines(tenant_id, client_id, account_id);

CREATE TABLE IF NOT EXISTS public.taxguard_ledger_bank_transactions (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  transaction_id UUID NOT NULL DEFAULT gen_random_uuid(),
  account_id VARCHAR(160) NOT NULL,
  external_id VARCHAR(128),
  fingerprint CHAR(64) NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  provider VARCHAR(16) NOT NULL CHECK (provider IN ('CSV_UPLOAD','MANUAL_ENTRY','QUICKBOOKS','XERO')),
  import_batch_id VARCHAR(128) NOT NULL,
  transaction_date DATE NOT NULL, posting_date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents <> 0),
  duplicate_status VARCHAR(24) NOT NULL DEFAULT 'NOT_DUPLICATE' CHECK (duplicate_status IN ('NOT_DUPLICATE','POSSIBLE_DUPLICATE')),
  duplicate_of UUID,
  classification_status VARCHAR(32) NOT NULL DEFAULT 'UNCLASSIFIED' CHECK (classification_status IN ('UNCLASSIFIED','POSTED')),
  assigned_account_id VARCHAR(160), journal_entry_id UUID,
  reviewed_by VARCHAR(128), reviewed_at TIMESTAMPTZ,
  created_by VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, transaction_id),
  UNIQUE (tenant_id, client_id, account_id, external_id),
  UNIQUE (tenant_id, client_id, journal_entry_id),
  CHECK ((classification_status = 'POSTED') = (journal_entry_id IS NOT NULL)),
  FOREIGN KEY (tenant_id, client_id, account_id) REFERENCES public.taxguard_ledger_accounts(tenant_id, client_id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id, assigned_account_id) REFERENCES public.taxguard_ledger_accounts(tenant_id, client_id, account_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id, journal_entry_id) REFERENCES public.taxguard_ledger_entries(tenant_id, client_id, entry_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_taxguard_ledger_bank_fingerprint ON public.taxguard_ledger_bank_transactions(tenant_id, client_id, account_id, fingerprint);

CREATE TABLE IF NOT EXISTS public.taxguard_ledger_reconciliations (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  reconciliation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  account_id VARCHAR(160) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  statement_start DATE NOT NULL, statement_end DATE NOT NULL CHECK (statement_start <= statement_end),
  beginning_cents BIGINT NOT NULL, ending_cents BIGINT NOT NULL,
  tolerance_cents BIGINT NOT NULL DEFAULT 0 CHECK (tolerance_cents BETWEEN 0 AND 100000),
  status VARCHAR(16) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS','CLOSED')),
  created_by VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_by VARCHAR(128), completed_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, client_id, reconciliation_id),
  CHECK ((status = 'CLOSED') = (completed_at IS NOT NULL)),
  FOREIGN KEY (tenant_id, client_id, account_id) REFERENCES public.taxguard_ledger_accounts(tenant_id, client_id, account_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.taxguard_ledger_reconciliation_items (
  tenant_id VARCHAR(128) NOT NULL, client_id VARCHAR(64) NOT NULL,
  reconciliation_id UUID NOT NULL, transaction_id UUID NOT NULL,
  cleared_by VARCHAR(128) NOT NULL, cleared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, client_id, reconciliation_id, transaction_id),
  UNIQUE (tenant_id, client_id, transaction_id),
  FOREIGN KEY (tenant_id, client_id, reconciliation_id) REFERENCES public.taxguard_ledger_reconciliations(tenant_id, client_id, reconciliation_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, client_id, transaction_id) REFERENCES public.taxguard_ledger_bank_transactions(tenant_id, client_id, transaction_id) ON DELETE RESTRICT
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['taxguard_ledger_counters','taxguard_ledger_accounts','taxguard_ledger_periods','taxguard_ledger_entries',
    'taxguard_ledger_lines','taxguard_ledger_bank_transactions','taxguard_ledger_reconciliations','taxguard_ledger_reconciliation_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------------------
-- Integrity triggers
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_ledger_assert_balanced() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r record; e record;
BEGIN
  SELECT tenant_id, client_id, entry_id INTO e FROM (SELECT NEW.tenant_id, NEW.client_id, NEW.entry_id) x(tenant_id, client_id, entry_id);
  SELECT count(*) AS n, COALESCE(sum(debit_cents),0) AS d, COALESCE(sum(credit_cents),0) AS c INTO r
    FROM public.taxguard_ledger_lines WHERE tenant_id = e.tenant_id AND client_id = e.client_id AND entry_id = e.entry_id;
  IF r.n < 2 OR r.d <> r.c OR r.d <> (SELECT total_cents FROM public.taxguard_ledger_entries WHERE tenant_id = e.tenant_id AND client_id = e.client_id AND entry_id = e.entry_id) THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_UNBALANCED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_ledger_entry_balanced ON public.taxguard_ledger_entries;
CREATE CONSTRAINT TRIGGER trg_taxguard_ledger_entry_balanced AFTER INSERT ON public.taxguard_ledger_entries
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.taxguard_ledger_assert_balanced();
DROP TRIGGER IF EXISTS trg_taxguard_ledger_line_balanced ON public.taxguard_ledger_lines;
CREATE CONSTRAINT TRIGGER trg_taxguard_ledger_line_balanced AFTER INSERT ON public.taxguard_ledger_lines
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.taxguard_ledger_assert_balanced();

-- Lines are written once, together with their entry, and never changed or removed.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_lines_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.taxguard_ledger_entries WHERE tenant_id = NEW.tenant_id AND client_id = NEW.client_id
        AND entry_id = NEW.entry_id AND created_at = now()) THEN
      RAISE EXCEPTION 'LEDGER_ENTRY_IMMUTABLE' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'LEDGER_ENTRY_IMMUTABLE' USING ERRCODE = 'P0001';
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_ledger_lines_immutable ON public.taxguard_ledger_lines;
CREATE TRIGGER trg_taxguard_ledger_lines_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_ledger_lines
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_ledger_lines_immutable();

-- Period lock by posting date. Reviewed entries (adjusting / reversing / replacements) may
-- enter a soft-closed period; nothing may enter or be posted into a hard-closed period.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_assert_period_open(p_tenant text, p_client text, p_date date, p_reviewed boolean)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE p record;
BEGIN
  FOR p IN SELECT status, period_name FROM public.taxguard_ledger_periods WHERE tenant_id = p_tenant AND client_id = p_client
      AND p_date BETWEEN start_date AND end_date FOR SHARE LOOP
    IF p.status = 'HARD_CLOSED' THEN RAISE EXCEPTION 'PERIOD_HARD_CLOSED' USING ERRCODE = 'P0001'; END IF;
    IF p.status = 'SOFT_CLOSED' AND NOT p_reviewed THEN RAISE EXCEPTION 'PERIOD_SOFT_CLOSED' USING ERRCODE = 'P0001'; END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_entries_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE reviewed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'LEDGER_ENTRY_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  reviewed := NEW.is_adjusting OR NEW.reversal_of_entry_id IS NOT NULL OR NEW.replaces_entry_id IS NOT NULL;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('PREPARED','POSTED') OR (reviewed AND NEW.status <> 'PREPARED') OR NEW.version <> 1 THEN
      RAISE EXCEPTION 'LEDGER_STATUS_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM public.taxguard_ledger_assert_period_open(NEW.tenant_id, NEW.client_id, NEW.posting_date, reviewed);
    RETURN NEW;
  END IF;
  -- UPDATE: everything except review/posting/reversal-link fields is frozen.
  IF (NEW.tenant_id, NEW.client_id, NEW.entry_id, NEW.entry_number, NEW.tax_year, NEW.period_id, NEW.posting_date, NEW.transaction_date,
      NEW.description, NEW.reference, NEW.source, NEW.is_adjusting, NEW.adjusting_type, NEW.total_cents, NEW.creator_uid,
      NEW.reversal_of_entry_id, NEW.replaces_entry_id, NEW.document_ids, NEW.idempotency_key, NEW.request_hash, NEW.created_at)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.client_id, OLD.entry_id, OLD.entry_number, OLD.tax_year, OLD.period_id, OLD.posting_date, OLD.transaction_date,
      OLD.description, OLD.reference, OLD.source, OLD.is_adjusting, OLD.adjusting_type, OLD.total_cents, OLD.creator_uid,
      OLD.reversal_of_entry_id, OLD.replaces_entry_id, OLD.document_ids, OLD.idempotency_key, OLD.request_hash, OLD.created_at) THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF OLD.reversed_by_entry_id IS NOT NULL AND NEW.reversed_by_entry_id IS DISTINCT FROM OLD.reversed_by_entry_id THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.status <> OLD.status THEN
    IF OLD.status <> 'PREPARED' OR NEW.status NOT IN ('POSTED','REJECTED','CORRECTION_REQUIRED') OR NEW.reviewer_uid IS NULL THEN
      RAISE EXCEPTION 'LEDGER_STATUS_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status = 'POSTED' THEN PERFORM public.taxguard_ledger_assert_period_open(NEW.tenant_id, NEW.client_id, NEW.posting_date, true); END IF;
  ELSIF (NEW.reviewer_uid, NEW.review_note, NEW.reviewed_at, NEW.posted_at) IS DISTINCT FROM (OLD.reviewer_uid, OLD.review_note, OLD.reviewed_at, OLD.posted_at) THEN
    RAISE EXCEPTION 'LEDGER_ENTRY_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.reversed_by_entry_id IS NOT NULL AND OLD.reversed_by_entry_id IS NULL AND NEW.status <> 'POSTED' THEN
    RAISE EXCEPTION 'LEDGER_STATUS_INVALID' USING ERRCODE = 'P0001';
  END IF;
  NEW.version := OLD.version + 1;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_ledger_entries_guard ON public.taxguard_ledger_entries;
CREATE TRIGGER trg_taxguard_ledger_entries_guard BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_ledger_entries_guard();

CREATE OR REPLACE FUNCTION public.taxguard_ledger_periods_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'PERIOD_IMMUTABLE' USING ERRCODE = 'P0001'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.tenant_id, NEW.client_id, NEW.period_id, NEW.period_name, NEW.tax_year, NEW.start_date, NEW.end_date)
      IS DISTINCT FROM (OLD.tenant_id, OLD.client_id, OLD.period_id, OLD.period_name, OLD.tax_year, OLD.start_date, OLD.end_date) THEN
    RAISE EXCEPTION 'PERIOD_IMMUTABLE' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.taxguard_ledger_periods WHERE tenant_id = NEW.tenant_id AND client_id = NEW.client_id
      AND period_id <> NEW.period_id AND NEW.start_date <= end_date AND NEW.end_date >= start_date) THEN
    RAISE EXCEPTION 'PERIOD_CONFLICT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_ledger_periods_guard ON public.taxguard_ledger_periods;
CREATE TRIGGER trg_taxguard_ledger_periods_guard BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_ledger_periods
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_ledger_periods_guard();

CREATE OR REPLACE FUNCTION public.taxguard_ledger_reconciliation_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE target_status text;
BEGIN
  SELECT status INTO target_status FROM public.taxguard_ledger_reconciliations
    WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id) AND client_id = COALESCE(NEW.client_id, OLD.client_id)
      AND reconciliation_id = COALESCE(NEW.reconciliation_id, OLD.reconciliation_id);
  IF target_status = 'CLOSED' THEN RAISE EXCEPTION 'RECONCILIATION_ALREADY_CLOSED' USING ERRCODE = 'P0001'; END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_taxguard_ledger_reconciliation_items_guard ON public.taxguard_ledger_reconciliation_items;
CREATE TRIGGER trg_taxguard_ledger_reconciliation_items_guard BEFORE INSERT OR UPDATE OR DELETE ON public.taxguard_ledger_reconciliation_items
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_ledger_reconciliation_guard();

-- ------------------------------------------------------------------------------------------
-- Authority and helpers (internal; no API role may execute them)
-- ------------------------------------------------------------------------------------------
-- The acting user must be an active staff member of the tenant and either an administrator
-- or hold a currently effective ACTIVE assignment for the client. The client must be active.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_actor(p_tenant text, p_client text, p_actor text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE actor_role text;
BEGIN
  IF p_tenant IS NULL OR p_tenant !~ '^[A-Za-z0-9_-]{1,128}$' OR p_client IS NULL OR p_client !~ '^[A-Za-z0-9_-]{1,64}$' OR
     p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' THEN
    RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_tenants WHERE id = p_tenant AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_ACCESS_DENIED' USING ERRCODE = 'P0001'; END IF;
  PERFORM 1 FROM public.taxguard_clients WHERE tenant_id = p_tenant AND client_id = p_client AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_ACCESS_DENIED' USING ERRCODE = 'P0001'; END IF;
  SELECT role INTO actor_role FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND status = 'active'
    AND role NOT IN ('client','prospective_client','recruiter');
  IF NOT FOUND THEN RAISE EXCEPTION 'LEDGER_ACCESS_DENIED' USING ERRCODE = 'P0001'; END IF;
  IF actor_role NOT IN ('admin','administrator','super_admin','super_administrator') AND NOT EXISTS (
      SELECT 1 FROM public.taxguard_staff_assignments WHERE tenant_id = p_tenant AND client_id = p_client AND user_id = p_actor
        AND upper(status) = 'ACTIVE' AND effective_from <= now() AND (effective_to IS NULL OR effective_to > now())) THEN
    RAISE EXCEPTION 'LEDGER_ACCESS_DENIED' USING ERRCODE = 'P0001';
  END IF;
  RETURN actor_role;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_is_reviewer(p_role text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_role IN ('reviewer','senior_reviewer','admin','administrator','super_admin','super_administrator') $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_audit(p_tenant text, p_client text, p_actor text, p_role text, p_action text, p_meta jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  INSERT INTO public.taxguard_audit_log(tenant_id, action, actor_uid, actor_role, metadata)
  VALUES (p_tenant, p_action, p_actor, p_role, jsonb_build_object('clientId', p_client) || COALESCE(p_meta, '{}'::jsonb)) $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_cents(p_value jsonb, p_allow_zero boolean) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE n numeric;
BEGIN
  IF p_value IS NULL OR jsonb_typeof(p_value) <> 'number' THEN RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'P0001'; END IF;
  n := p_value::text::numeric;
  IF n <> trunc(n) OR n < 0 OR n > 100000000000000 OR (n = 0 AND NOT p_allow_zero) THEN RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'P0001'; END IF;
  RETURN n::bigint;
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_entry_json(p_tenant text, p_client text, p_entry uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('entryId', e.entry_id, 'entryNumber', e.entry_number, 'taxYear', e.tax_year, 'periodId', e.period_id,
    'postingDate', e.posting_date, 'transactionDate', e.transaction_date, 'description', e.description, 'reference', e.reference,
    'source', e.source, 'isAdjusting', e.is_adjusting, 'adjustingType', e.adjusting_type, 'status', e.status, 'totalCents', e.total_cents,
    'creatorUid', e.creator_uid, 'reviewerUid', e.reviewer_uid, 'reviewNote', e.review_note, 'reviewedAt', e.reviewed_at, 'postedAt', e.posted_at,
    'reversalOfEntryId', e.reversal_of_entry_id, 'reversedByEntryId', e.reversed_by_entry_id, 'replacesEntryId', e.replaces_entry_id,
    'documentIds', e.document_ids, 'version', e.version, 'createdAt', e.created_at,
    'lines', (SELECT COALESCE(jsonb_agg(jsonb_build_object('lineNo', l.line_no, 'accountId', l.account_id, 'accountNumber', a.account_number,
        'accountName', a.account_name, 'debitCents', l.debit_cents, 'creditCents', l.credit_cents, 'memo', l.memo, 'taxCategory', l.tax_category) ORDER BY l.line_no), '[]'::jsonb)
      FROM public.taxguard_ledger_lines l JOIN public.taxguard_ledger_accounts a ON a.tenant_id = l.tenant_id AND a.client_id = l.client_id AND a.account_id = l.account_id
      WHERE l.tenant_id = e.tenant_id AND l.client_id = e.client_id AND l.entry_id = e.entry_id))
  FROM public.taxguard_ledger_entries e WHERE e.tenant_id = p_tenant AND e.client_id = p_client AND e.entry_id = p_entry $$;

-- Core insert used by posting, categorization and reversal. Caller has verified authority.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_insert_entry(p_tenant text, p_client text, p_actor text, p_key text, p_hash text, p_entry jsonb,
  p_reversal_of uuid, p_replaces uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE existing record; new_id uuid := gen_random_uuid(); n bigint; total bigint := 0; line jsonb; i integer := 0; d bigint; c bigint;
  posting date; reviewed boolean; period text; acct text; credit_total bigint := 0;
BEGIN
  IF p_key IS NULL OR p_key !~ '^[A-Za-z0-9_.:-]{8,128}$' OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' OR
     p_entry IS NULL OR jsonb_typeof(p_entry) <> 'object' OR jsonb_typeof(p_entry->'lines') <> 'array' OR
     jsonb_array_length(p_entry->'lines') NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT entry_id, request_hash INTO existing FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client AND idempotency_key = p_key;
  IF FOUND THEN
    IF existing.request_hash <> p_hash THEN RAISE EXCEPTION 'LEDGER_IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0001'; END IF;
    RETURN existing.entry_id;
  END IF;
  BEGIN posting := (p_entry->>'postingDate')::date; EXCEPTION WHEN others THEN RAISE EXCEPTION 'INVALID_POSTING_DATE' USING ERRCODE = 'P0001'; END;
  IF posting IS NULL OR p_entry->>'postingDate' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'INVALID_POSTING_DATE' USING ERRCODE = 'P0001'; END IF;
  period := NULLIF(p_entry->>'periodId', '');
  IF period IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.taxguard_ledger_periods WHERE tenant_id = p_tenant AND client_id = p_client
      AND period_id = period AND posting BETWEEN start_date AND end_date AND tax_year = (p_entry->>'taxYear')::integer) THEN
    RAISE EXCEPTION 'PERIOD_MISMATCH' USING ERRCODE = 'P0001';
  END IF;
  -- Entries created by bookkeepers (journal or bank categorization) always await independent review.
  reviewed := COALESCE((p_entry->>'isAdjusting')::boolean, false) OR p_reversal_of IS NOT NULL OR p_replaces IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.taxguard_members WHERE tenant_id = p_tenant AND uid = p_actor AND role = 'bookkeeper');
  INSERT INTO public.taxguard_ledger_counters(tenant_id, client_id) VALUES (p_tenant, p_client) ON CONFLICT DO NOTHING;
  UPDATE public.taxguard_ledger_counters SET next_entry_number = next_entry_number + 1 WHERE tenant_id = p_tenant AND client_id = p_client
    RETURNING next_entry_number - 1 INTO n;
  FOR line IN SELECT value FROM jsonb_array_elements(p_entry->'lines') LOOP
    d := public.taxguard_ledger_cents(COALESCE(line->'debitCents', '0'::jsonb), true);
    c := public.taxguard_ledger_cents(COALESCE(line->'creditCents', '0'::jsonb), true);
    total := total + d; credit_total := credit_total + c;
  END LOOP;
  IF total <> credit_total THEN RAISE EXCEPTION 'UNBALANCED_JOURNAL_ENTRY' USING ERRCODE = 'P0001'; END IF;
  INSERT INTO public.taxguard_ledger_entries(tenant_id, client_id, entry_id, entry_number, tax_year, period_id, posting_date, transaction_date, description,
      reference, source, is_adjusting, adjusting_type, status, total_cents, creator_uid, posted_at, reversal_of_entry_id, replaces_entry_id, document_ids,
      idempotency_key, request_hash)
    VALUES (p_tenant, p_client, new_id, 'JE-' || lpad(n::text, 6, '0'), (p_entry->>'taxYear')::integer, period, posting,
      COALESCE(NULLIF(p_entry->>'transactionDate','')::date, posting), p_entry->>'description', NULLIF(p_entry->>'reference',''),
      COALESCE(p_entry->>'source', 'MANUAL'), COALESCE((p_entry->>'isAdjusting')::boolean, false), NULLIF(p_entry->>'adjustingType',''),
      CASE WHEN reviewed THEN 'PREPARED' ELSE 'POSTED' END, total, p_actor, CASE WHEN reviewed THEN NULL ELSE now() END,
      p_reversal_of, p_replaces, COALESCE(p_entry->'documentIds', '[]'::jsonb), p_key, p_hash);
  FOR line IN SELECT value FROM jsonb_array_elements(p_entry->'lines') LOOP
    i := i + 1;
    acct := line->>'accountId';
    PERFORM 1 FROM public.taxguard_ledger_accounts WHERE tenant_id = p_tenant AND client_id = p_client AND account_id = acct AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_IN_CHART' USING ERRCODE = 'P0001'; END IF;
    INSERT INTO public.taxguard_ledger_lines(tenant_id, client_id, entry_id, line_no, account_id, debit_cents, credit_cents, memo, tax_category)
      VALUES (p_tenant, p_client, new_id, i, acct, public.taxguard_ledger_cents(COALESCE(line->'debitCents','0'::jsonb), true),
        public.taxguard_ledger_cents(COALESCE(line->'creditCents','0'::jsonb), true), NULLIF(line->>'memo',''), NULLIF(line->>'taxCategory',''));
  END LOOP;
  RETURN new_id;
EXCEPTION
  WHEN check_violation THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  WHEN not_null_violation THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  WHEN invalid_text_representation THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  WHEN invalid_datetime_format THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  WHEN datetime_field_overflow THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  WHEN unique_violation THEN RAISE EXCEPTION 'LEDGER_CONCURRENT_UPDATE' USING ERRCODE = 'P0001';
END $$;

-- ------------------------------------------------------------------------------------------
-- Service RPCs
-- ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.taxguard_ledger_create_accounts(p_tenant text, p_client text, p_actor text, p_accounts jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; a jsonb; created integer := 0;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF p_accounts IS NULL OR jsonb_typeof(p_accounts) <> 'array' OR jsonb_array_length(p_accounts) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    FOR a IN SELECT value FROM jsonb_array_elements(p_accounts) LOOP
      INSERT INTO public.taxguard_ledger_accounts(tenant_id, client_id, account_id, account_number, account_name, account_type, account_subtype, tax_mapping, source, created_by)
        VALUES (p_tenant, p_client, a->>'accountId', a->>'accountNumber', a->>'accountName', a->>'accountType', a->>'accountSubtype',
          CASE WHEN jsonb_typeof(a->'taxMapping') = 'object' THEN a->'taxMapping' END, COALESCE(a->>'source', 'MANUAL_ACCOUNTANT'), p_actor)
        ON CONFLICT (tenant_id, client_id, account_number) DO NOTHING;
      IF FOUND THEN created := created + 1; END IF;
    END LOOP;
  EXCEPTION WHEN check_violation OR not_null_violation THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
    WHEN unique_violation THEN RAISE EXCEPTION 'ACCOUNT_CONFLICT' USING ERRCODE = 'P0001';
  END;
  IF created > 0 THEN PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_ACCOUNTS_CREATED', jsonb_build_object('created', created)); END IF;
  RETURN jsonb_build_object('created', created);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_set_account_active(p_tenant text, p_client text, p_actor text, p_account text, p_active boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF p_active IS NULL THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_ledger_accounts SET is_active = p_active, updated_at = now() WHERE tenant_id = p_tenant AND client_id = p_client AND account_id = p_account;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_ACCOUNT_STATUS_CHANGED', jsonb_build_object('accountId', p_account, 'active', p_active));
  RETURN jsonb_build_object('accountId', p_account, 'isActive', p_active);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_open_period(p_tenant text, p_client text, p_actor text, p_name text, p_tax_year integer, p_start date, p_end date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; pid text := 'period_' || p_client || '_' || p_name; existing record;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
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

CREATE OR REPLACE FUNCTION public.taxguard_ledger_close_period(p_tenant text, p_client text, p_actor text, p_period text, p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; p record; pending integer;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'LEDGER_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO p FROM public.taxguard_ledger_periods WHERE tenant_id = p_tenant AND client_id = p_client AND period_id = p_period FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

CREATE OR REPLACE FUNCTION public.taxguard_ledger_reopen_period(p_tenant text, p_client text, p_actor text, p_period text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; p record; reason text := btrim(COALESCE(p_reason, ''));
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF NOT public.taxguard_ledger_is_reviewer(r) THEN RAISE EXCEPTION 'LEDGER_REVIEWER_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  IF length(reason) NOT BETWEEN 5 AND 500 OR reason ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'REOPEN_REASON_REQUIRED' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO p FROM public.taxguard_ledger_periods WHERE tenant_id = p_tenant AND client_id = p_client AND period_id = p_period FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PERIOD_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF p.status = 'OPEN' THEN RAISE EXCEPTION 'PERIOD_STATUS_TRANSITION_INVALID' USING ERRCODE = 'P0001'; END IF;
  IF p.status = 'HARD_CLOSED' AND p.closed_by = p_actor THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_ledger_periods SET status = 'OPEN', reopened_by = p_actor, reopened_at = now(), reopen_reason = reason
    WHERE tenant_id = p_tenant AND client_id = p_client AND period_id = p_period;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_PERIOD_REOPENED', jsonb_build_object('periodId', p_period, 'from', p.status));
  RETURN jsonb_build_object('periodId', p_period, 'status', 'OPEN');
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_post_entry(p_tenant text, p_client text, p_actor text, p_key text, p_hash text, p_entry jsonb, p_replaces uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; id uuid; replaced record; replay boolean;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF p_replaces IS NOT NULL THEN
    SELECT status INTO replaced FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client AND entry_id = p_replaces FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ENTRY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    IF replaced.status <> 'CORRECTION_REQUIRED' THEN RAISE EXCEPTION 'ENTRY_NOT_CORRECTABLE' USING ERRCODE = 'P0001'; END IF;
    IF EXISTS (SELECT 1 FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client AND replaces_entry_id = p_replaces AND idempotency_key <> p_key) THEN
      RAISE EXCEPTION 'ENTRY_ALREADY_CORRECTED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  replay := EXISTS (SELECT 1 FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client AND idempotency_key = p_key);
  id := public.taxguard_ledger_insert_entry(p_tenant, p_client, p_actor, p_key, p_hash, p_entry, NULL, p_replaces);
  IF NOT replay THEN PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_ENTRY_CREATED', jsonb_build_object('entryId', id)); END IF;
  RETURN public.taxguard_ledger_entry_json(p_tenant, p_client, id) || jsonb_build_object('replayed', replay);
END $$;

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
  IF NOT FOUND THEN RAISE EXCEPTION 'ENTRY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

-- A reversal is a new PREPARED entry with debits and credits swapped; it links back to the
-- original only once approved (reversed_by_entry_id). One reversal per entry (unique index).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_reverse_entry(p_tenant text, p_client text, p_actor text, p_key text, p_hash text, p_entry uuid,
  p_posting_date date, p_period text, p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; e record; reason text := btrim(COALESCE(p_reason, '')); body jsonb; id uuid; replay boolean;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  replay := EXISTS (SELECT 1 FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client AND idempotency_key = p_key);
  SELECT * INTO e FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client AND entry_id = p_entry FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ENTRY_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF NOT replay THEN
    IF e.status <> 'POSTED' THEN RAISE EXCEPTION 'ENTRY_NOT_POSTED' USING ERRCODE = 'P0001'; END IF;
    IF e.reversal_of_entry_id IS NOT NULL THEN RAISE EXCEPTION 'REVERSAL_NOT_REVERSIBLE' USING ERRCODE = 'P0001'; END IF;
    IF e.reversed_by_entry_id IS NOT NULL OR EXISTS (SELECT 1 FROM public.taxguard_ledger_entries WHERE tenant_id = p_tenant AND client_id = p_client
        AND reversal_of_entry_id = p_entry AND status IN ('PREPARED','POSTED')) THEN
      RAISE EXCEPTION 'ENTRY_ALREADY_REVERSED' USING ERRCODE = 'P0001';
    END IF;
    IF length(reason) NOT BETWEEN 5 AND 500 OR reason ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'REVERSAL_REASON_REQUIRED' USING ERRCODE = 'P0001'; END IF;
    IF p_posting_date IS NULL OR p_posting_date < e.posting_date THEN RAISE EXCEPTION 'INVALID_POSTING_DATE' USING ERRCODE = 'P0001'; END IF;
  END IF;
  body := jsonb_build_object('taxYear', extract(year FROM p_posting_date)::integer, 'periodId', p_period, 'postingDate', to_char(p_posting_date, 'YYYY-MM-DD'),
    'description', left('Reversal of ' || e.entry_number || ': ' || reason, 500), 'reference', e.entry_number, 'source', e.source, 'documentIds', e.document_ids,
    'lines', (SELECT jsonb_agg(jsonb_build_object('accountId', account_id, 'debitCents', credit_cents, 'creditCents', debit_cents, 'memo', memo, 'taxCategory', tax_category) ORDER BY line_no)
      FROM public.taxguard_ledger_lines WHERE tenant_id = p_tenant AND client_id = p_client AND entry_id = p_entry));
  BEGIN
    id := public.taxguard_ledger_insert_entry(p_tenant, p_client, p_actor, p_key, p_hash, body, p_entry, NULL);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'LEDGER_CONCURRENT_UPDATE' THEN RAISE EXCEPTION 'ENTRY_ALREADY_REVERSED' USING ERRCODE = 'P0001'; END IF;
    RAISE;
  END;
  IF NOT replay THEN PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_ENTRY_REVERSAL_PREPARED', jsonb_build_object('entryId', id, 'reversalOf', p_entry)); END IF;
  RETURN public.taxguard_ledger_entry_json(p_tenant, p_client, id) || jsonb_build_object('replayed', replay);
END $$;

-- Bank feed ingestion. External IDs are unique per account; rows without one are flagged
-- POSSIBLE_DUPLICATE when an earlier row of the account has the same fingerprint.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_ingest_transactions(p_tenant text, p_client text, p_actor text, p_account text, p_provider text, p_batch text, p_rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; row_data jsonb; fp text; dup uuid; inserted integer := 0; skipped integer := 0; flagged integer := 0; amount bigint;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 1000 OR p_batch IS NULL OR p_batch !~ '^[A-Za-z0-9_.:-]{1,128}$' THEN
    RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.taxguard_ledger_accounts WHERE tenant_id = p_tenant AND client_id = p_client AND account_id = p_account AND is_active
    AND account_type IN ('ASSET','LIABILITY') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BANK_ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  BEGIN
    FOR row_data IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
      IF jsonb_typeof(row_data->'amountCents') <> 'number' OR (row_data->>'amountCents')::numeric <> trunc((row_data->>'amountCents')::numeric) THEN
        RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = 'P0001';
      END IF;
      amount := (row_data->>'amountCents')::bigint;
      fp := encode(sha256(convert_to(p_account || '|' || (row_data->>'transactionDate') || '|' || amount || '|' || lower(btrim(row_data->>'description')), 'UTF8')), 'hex');
      IF NULLIF(row_data->>'externalId','') IS NOT NULL AND EXISTS (SELECT 1 FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = p_tenant
          AND client_id = p_client AND account_id = p_account AND external_id = row_data->>'externalId') THEN
        skipped := skipped + 1; CONTINUE;
      END IF;
      SELECT transaction_id INTO dup FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = p_tenant AND client_id = p_client AND account_id = p_account AND fingerprint = fp LIMIT 1;
      INSERT INTO public.taxguard_ledger_bank_transactions(tenant_id, client_id, account_id, external_id, fingerprint, provider, import_batch_id, transaction_date,
          posting_date, description, amount_cents, duplicate_status, duplicate_of, created_by)
        VALUES (p_tenant, p_client, p_account, NULLIF(row_data->>'externalId',''), fp, p_provider, p_batch, (row_data->>'transactionDate')::date,
          COALESCE(NULLIF(row_data->>'postingDate','')::date, (row_data->>'transactionDate')::date), left(btrim(row_data->>'description'), 500), amount,
          CASE WHEN dup IS NULL THEN 'NOT_DUPLICATE' ELSE 'POSSIBLE_DUPLICATE' END, dup, p_actor);
      inserted := inserted + 1;
      IF dup IS NOT NULL THEN flagged := flagged + 1; END IF;
    END LOOP;
  EXCEPTION WHEN check_violation OR not_null_violation OR invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
    RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001';
  WHEN unique_violation THEN RAISE EXCEPTION 'LEDGER_CONCURRENT_UPDATE' USING ERRCODE = 'P0001';
  END;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_BANK_TRANSACTIONS_INGESTED',
    jsonb_build_object('accountId', p_account, 'batchId', p_batch, 'inserted', inserted, 'skipped', skipped, 'possibleDuplicates', flagged));
  RETURN jsonb_build_object('inserted', inserted, 'skippedExisting', skipped, 'possibleDuplicates', flagged);
END $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_categorize_transaction(p_tenant text, p_client text, p_actor text, p_txn uuid, p_account text, p_period text, p_tax_year integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; t record; body jsonb; id uuid; amt bigint;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO t FROM public.taxguard_ledger_bank_transactions WHERE tenant_id = p_tenant AND client_id = p_client AND transaction_id = p_txn FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSACTION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

CREATE OR REPLACE FUNCTION public.taxguard_ledger_start_reconciliation(p_tenant text, p_client text, p_actor text, p_account text, p_tax_year integer,
  p_start date, p_end date, p_beginning bigint, p_ending bigint, p_tolerance bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; id uuid;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
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

CREATE OR REPLACE FUNCTION public.taxguard_ledger_set_cleared(p_tenant text, p_client text, p_actor text, p_recon uuid, p_txn uuid, p_cleared boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; rec record;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO rec FROM public.taxguard_ledger_reconciliations WHERE tenant_id = p_tenant AND client_id = p_client AND reconciliation_id = p_recon FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECONCILIATION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
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

CREATE OR REPLACE FUNCTION public.taxguard_ledger_reconciliation_json(p_tenant text, p_client text, p_recon uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT jsonb_build_object('reconciliationId', r.reconciliation_id, 'accountId', r.account_id, 'taxYear', r.tax_year,
    'statementStart', r.statement_start, 'statementEnd', r.statement_end, 'beginningCents', r.beginning_cents, 'endingCents', r.ending_cents,
    'toleranceCents', r.tolerance_cents, 'status', r.status, 'createdBy', r.created_by, 'completedBy', r.completed_by, 'completedAt', r.completed_at,
    'clearedCount', count(i.transaction_id), 'clearedCents', r.beginning_cents + COALESCE(sum(t.amount_cents), 0),
    'varianceCents', r.beginning_cents + COALESCE(sum(t.amount_cents), 0) - r.ending_cents,
    'clearedTransactionIds', COALESCE(jsonb_agg(i.transaction_id ORDER BY i.transaction_id) FILTER (WHERE i.transaction_id IS NOT NULL), '[]'::jsonb))
  FROM public.taxguard_ledger_reconciliations r
  LEFT JOIN public.taxguard_ledger_reconciliation_items i ON i.tenant_id = r.tenant_id AND i.client_id = r.client_id AND i.reconciliation_id = r.reconciliation_id
  LEFT JOIN public.taxguard_ledger_bank_transactions t ON t.tenant_id = i.tenant_id AND t.client_id = i.client_id AND t.transaction_id = i.transaction_id
  WHERE r.tenant_id = p_tenant AND r.client_id = p_client AND r.reconciliation_id = p_recon
  GROUP BY r.tenant_id, r.client_id, r.reconciliation_id $$;

CREATE OR REPLACE FUNCTION public.taxguard_ledger_finalize_reconciliation(p_tenant text, p_client text, p_actor text, p_recon uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; rec record; state jsonb;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  SELECT * INTO rec FROM public.taxguard_ledger_reconciliations WHERE tenant_id = p_tenant AND client_id = p_client AND reconciliation_id = p_recon FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'RECONCILIATION_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
  IF rec.status = 'CLOSED' THEN RAISE EXCEPTION 'RECONCILIATION_ALREADY_CLOSED' USING ERRCODE = 'P0001'; END IF;
  state := public.taxguard_ledger_reconciliation_json(p_tenant, p_client, p_recon);
  IF abs((state->>'varianceCents')::bigint) > rec.tolerance_cents THEN RAISE EXCEPTION 'RECONCILIATION_VARIANCE_UNRESOLVED' USING ERRCODE = 'P0001'; END IF;
  UPDATE public.taxguard_ledger_reconciliations SET status = 'CLOSED', completed_by = p_actor, completed_at = now()
    WHERE tenant_id = p_tenant AND client_id = p_client AND reconciliation_id = p_recon;
  PERFORM public.taxguard_ledger_audit(p_tenant, p_client, p_actor, r, 'LEDGER_RECONCILIATION_FINALIZED', jsonb_build_object('reconciliationId', p_recon, 'clearedCount', state->'clearedCount'));
  RETURN public.taxguard_ledger_reconciliation_json(p_tenant, p_client, p_recon);
END $$;

-- Bounded, filtered read of one client's ledger. Filters: fromDate, toDate, status, accountId,
-- text (description / reference / entry number, case-insensitive), limit (1-500).
CREATE OR REPLACE FUNCTION public.taxguard_ledger_read(p_tenant text, p_client text, p_actor text, p_tax_year integer, p_filter jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; f jsonb := COALESCE(p_filter, '{}'::jsonb); lim integer; q text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
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

-- Posted activity per account in exact cents. Beginning balances are posted activity before
-- the tax year; period activity is posted activity in the tax year up to p_as_of.
CREATE OR REPLACE FUNCTION public.taxguard_ledger_trial_balance(p_tenant text, p_client text, p_actor text, p_tax_year integer, p_as_of date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text; start_date date := make_date(p_tax_year, 1, 1); end_date date := COALESCE(p_as_of, make_date(p_tax_year, 12, 31));
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
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

CREATE OR REPLACE FUNCTION public.taxguard_ledger_history(p_tenant text, p_client text, p_actor text, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r text;
BEGIN
  r := public.taxguard_ledger_actor(p_tenant, p_client, p_actor);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'LEDGER_INPUT_INVALID' USING ERRCODE = 'P0001'; END IF;
  RETURN (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', action, 'actorUid', actor_uid, 'actorRole', actor_role, 'metadata', metadata - 'clientId', 'at', timestamp)
      ORDER BY timestamp DESC, id), '[]'::jsonb) FROM (
    SELECT * FROM public.taxguard_audit_log WHERE tenant_id = p_tenant AND metadata->>'clientId' = p_client AND action LIKE 'LEDGER\_%'
    ORDER BY timestamp DESC, id LIMIT p_limit) h);
END $$;

-- ------------------------------------------------------------------------------------------
-- Privileges: helpers are internal; RPCs are service_role only.
-- ------------------------------------------------------------------------------------------
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT p.oid::regprocedure AS sig, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname LIKE 'taxguard\_ledger\_%' LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.sig);
    IF f.proname IN ('taxguard_ledger_create_accounts','taxguard_ledger_set_account_active','taxguard_ledger_open_period','taxguard_ledger_close_period',
        'taxguard_ledger_reopen_period','taxguard_ledger_post_entry','taxguard_ledger_review_entry','taxguard_ledger_reverse_entry',
        'taxguard_ledger_ingest_transactions','taxguard_ledger_categorize_transaction','taxguard_ledger_start_reconciliation','taxguard_ledger_set_cleared',
        'taxguard_ledger_finalize_reconciliation','taxguard_ledger_read','taxguard_ledger_trial_balance','taxguard_ledger_history') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    END IF;
  END LOOP;
END $$;
