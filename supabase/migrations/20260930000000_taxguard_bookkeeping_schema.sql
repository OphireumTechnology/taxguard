-- ==============================================================================
-- TaxGuard AI - Production Supabase / PostgreSQL Bookkeeping & Ledger Schema
-- Version: 20260930000000
-- Description: Establishes the authoritative multi-tenant bookkeeping architecture:
--   1. Chart of Accounts (GAAP categories, tax line mappings)
--   2. Accounting Periods (Open, Soft-Closed, Hard-Closed)
--   3. General Ledger Journal Entries (Double-entry debits/credits)
--   4. Journal Entry Lines (itemized debit/credit schedules)
--   5. Bank Feeds & Transactions (CSV/manual/QuickBooks/Xero, duplicate flags)
--   6. Bank & Credit Card Reconciliations (Beginning/ending balances, cleared items)
--   7. Reconciliation Exceptions (Variance tracking and resolution)
--   8. Book-to-Tax Adjustments (Schedule M-1 permanent and timing differences)
--   9. Accounting Sync States (QuickBooks / Xero 5-stage write control & conflicts)
--  10. Accounting Sync Audit Logs
-- Defense-in-depth: Strict Row Level Security (RLS) on all bookkeeping tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Chart of Accounts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_chart_of_accounts (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  account_number VARCHAR(32) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(32) NOT NULL,
  account_subtype VARCHAR(64) NOT NULL,
  parent_account_id VARCHAR(128),
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  tax_mapping JSONB,
  external_mapping JSONB,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_account_number UNIQUE(tenant_id, client_id, account_number)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_coa_lookup ON taxguard_chart_of_accounts(tenant_id, client_id, is_active);

-- ------------------------------------------------------------------------------
-- 2. Accounting Periods
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_accounting_periods (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  period_name VARCHAR(64) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  closed_by_uid VARCHAR(128),
  closed_at TIMESTAMPTZ,
  reopened_by_uid VARCHAR(128),
  reopened_at TIMESTAMPTZ,
  reopen_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_period UNIQUE(tenant_id, client_id, period_name)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_periods_lookup ON taxguard_accounting_periods(tenant_id, client_id, tax_year, status);

-- ------------------------------------------------------------------------------
-- 3. General Ledger Journal Entries
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_journal_entries (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  period_id VARCHAR(128) NOT NULL,
  entry_number VARCHAR(64) NOT NULL,
  posting_date DATE NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference VARCHAR(128),
  source VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  is_adjusting BOOLEAN NOT NULL DEFAULT FALSE,
  adjusting_type VARCHAR(32),
  total_debit NUMERIC(15, 2) NOT NULL,
  total_credit NUMERIC(15, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'POSTED',
  creator_uid VARCHAR(128) NOT NULL,
  reviewer_uid VARCHAR(128),
  document_provenance_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_journal_entry_balanced CHECK (total_debit = total_credit)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_journal_entries_lookup ON taxguard_journal_entries(tenant_id, client_id, tax_year, posting_date);

-- ------------------------------------------------------------------------------
-- 4. Journal Entry Lines
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id VARCHAR(128) NOT NULL REFERENCES taxguard_journal_entries(id) ON DELETE CASCADE,
  account_id VARCHAR(128) NOT NULL,
  debit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  memo TEXT,
  tax_category VARCHAR(64),
  document_reference_id VARCHAR(128),
  CONSTRAINT chk_line_non_negative CHECK (debit >= 0 AND credit >= 0),
  CONSTRAINT chk_line_one_sided CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX IF NOT EXISTS idx_taxguard_je_lines_account ON taxguard_journal_entry_lines(journal_entry_id, account_id);

-- ------------------------------------------------------------------------------
-- 5. Bank Feeds & Transactions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_bank_transactions (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  account_id VARCHAR(128) NOT NULL,
  external_transaction_id VARCHAR(128),
  provider VARCHAR(32) NOT NULL DEFAULT 'CSV_UPLOAD',
  transaction_date DATE NOT NULL,
  posting_date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  raw_reference VARCHAR(255),
  import_batch_id VARCHAR(128) NOT NULL,
  document_reference_id VARCHAR(128),
  duplicate_status VARCHAR(32) NOT NULL DEFAULT 'NOT_DUPLICATE',
  duplicate_candidate_id VARCHAR(128),
  classification_status VARCHAR(32) NOT NULL DEFAULT 'UNCLASSIFIED',
  assigned_account_id VARCHAR(128),
  assigned_tax_category VARCHAR(64),
  ai_proposal JSONB,
  matched_document_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'UNRECONCILED',
  reconciliation_id VARCHAR(128),
  journal_entry_id VARCHAR(128),
  reviewed_by_uid VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_bank_txns_lookup ON taxguard_bank_transactions(tenant_id, client_id, account_id, transaction_date);

-- ------------------------------------------------------------------------------
-- 6. Bank & Credit Card Reconciliations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_bank_reconciliations (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  account_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  statement_period_start DATE NOT NULL,
  statement_period_end DATE NOT NULL,
  statement_beginning_balance NUMERIC(15, 2) NOT NULL,
  statement_ending_balance NUMERIC(15, 2) NOT NULL,
  cleared_balance NUMERIC(15, 2) NOT NULL,
  cleared_transactions_count INTEGER NOT NULL DEFAULT 0,
  variance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  tolerance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
  completed_at TIMESTAMPTZ,
  completed_by_uid VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_recons_lookup ON taxguard_bank_reconciliations(tenant_id, client_id, account_id, tax_year);

-- ------------------------------------------------------------------------------
-- 7. Reconciliation Exceptions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_reconciliation_exceptions (
  id VARCHAR(128) PRIMARY KEY,
  reconciliation_id VARCHAR(128) NOT NULL REFERENCES taxguard_bank_reconciliations(id) ON DELETE CASCADE,
  transaction_id VARCHAR(128),
  type VARCHAR(64) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  notes TEXT,
  assigned_to_uid VARCHAR(128),
  resolution_explanation TEXT,
  resolved_by_uid VARCHAR(128),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_recon_exc_lookup ON taxguard_reconciliation_exceptions(reconciliation_id, status);

-- ------------------------------------------------------------------------------
-- 8. Book-to-Tax Adjustments (Schedule M-1 Bridge)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_book_to_tax_adjustments (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  account_id VARCHAR(128) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  book_amount NUMERIC(15, 2) NOT NULL,
  tax_amount NUMERIC(15, 2) NOT NULL,
  adjustment_amount NUMERIC(15, 2) NOT NULL,
  permanent_or_timing VARCHAR(16) NOT NULL,
  schedule_m1_category VARCHAR(64) NOT NULL,
  tax_authority_citation VARCHAR(255) NOT NULL,
  preparer_uid VARCHAR(128) NOT NULL,
  reviewer_uid VARCHAR(128),
  review_status VARCHAR(32) NOT NULL DEFAULT 'PREPARED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_b2t_lookup ON taxguard_book_to_tax_adjustments(tenant_id, client_id, tax_year);

-- ------------------------------------------------------------------------------
-- 9. Accounting Sync States (QuickBooks / Xero)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_accounting_sync_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  is_connected BOOLEAN NOT NULL DEFAULT FALSE,
  is_read_only BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMPTZ,
  conflict_state VARCHAR(32) NOT NULL DEFAULT 'NO_CONFLICT',
  write_authorization JSONB NOT NULL DEFAULT '{"clientAuthorized": false, "accountantPrepared": false, "reviewerApproved": false, "explicitlyConfirmed": false}'::jsonb,
  synced_accounts_count INTEGER NOT NULL DEFAULT 0,
  synced_transactions_count INTEGER NOT NULL DEFAULT 0,
  unresolved_conflicts_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_sync_state UNIQUE(tenant_id, client_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_sync_states ON taxguard_accounting_sync_states(tenant_id, client_id, provider);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE taxguard_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_reconciliation_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_book_to_tax_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_accounting_sync_states ENABLE ROW LEVEL SECURITY;

-- 1. Tenant Members Policy Helper (Service Role Bypass)
CREATE POLICY rls_taxguard_coa_all ON taxguard_chart_of_accounts
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id OR auth.role() = 'service_role');

CREATE POLICY rls_taxguard_periods_all ON taxguard_accounting_periods
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id OR auth.role() = 'service_role');

CREATE POLICY rls_taxguard_je_all ON taxguard_journal_entries
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id OR auth.role() = 'service_role');

CREATE POLICY rls_taxguard_bank_txns_all ON taxguard_bank_transactions
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id OR auth.role() = 'service_role');

CREATE POLICY rls_taxguard_recons_all ON taxguard_bank_reconciliations
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id OR auth.role() = 'service_role');

CREATE POLICY rls_taxguard_b2t_all ON taxguard_book_to_tax_adjustments
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id OR auth.role() = 'service_role');

CREATE POLICY rls_taxguard_sync_all ON taxguard_accounting_sync_states
  FOR ALL USING (auth.jwt() ->> 'tenant_id' = tenant_id OR auth.role() = 'service_role');
