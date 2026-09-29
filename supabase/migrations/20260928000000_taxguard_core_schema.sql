-- ==============================================================================
-- TaxGuard AI - Production Supabase / PostgreSQL Core Schema Migration
-- Version: 20260928000000
-- Description: Establishes the authoritative multi-tenant tax architecture:
--   Tenant -> Client -> Engagement -> Tax Year -> Tax Case -> Stage State ->
--   Documents -> Extracted Data -> Tax Records -> Reconciliation ->
--   Exceptions -> Reviews -> Reports -> Planning -> Draft Returns -> Audit -> Sessions
-- Defense-in-depth: Strict Row Level Security (RLS) enabled on all sensitive tables.
-- ==============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Tenants
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_tenants (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Tenant Members & Practitioner Governance
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  uid VARCHAR(128) NOT NULL,
  role VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  client_id VARCHAR(64),
  credential_verified BOOLEAN DEFAULT FALSE,
  credential_type VARCHAR(32),
  credential_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_member UNIQUE(tenant_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_members_lookup ON taxguard_members(tenant_id, uid, status);

-- ------------------------------------------------------------------------------
-- 3. Clients
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  owner_uid VARCHAR(128) NOT NULL,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(64),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_client UNIQUE(tenant_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_clients_owner ON taxguard_clients(tenant_id, owner_uid);

-- ------------------------------------------------------------------------------
-- 4. Engagements
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  title VARCHAR(255),
  type VARCHAR(64) NOT NULL DEFAULT 'tax_preparation',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_engagement UNIQUE(tenant_id, client_id, engagement_id)
);

-- ------------------------------------------------------------------------------
-- 5. Tax Years
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_tax_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2200),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_tax_year UNIQUE(tenant_id, client_id, engagement_id, tax_year)
);

-- ------------------------------------------------------------------------------
-- 6. Authoritative Tax Cases (Single active case per year enforced)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2200),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  active_stage INTEGER NOT NULL DEFAULT 1 CHECK (active_stage BETWEEN 1 AND 18),
  client_uid VARCHAR(128) NOT NULL,
  preparer_uid VARCHAR(128) NOT NULL,
  reviewer_uid VARCHAR(128) NOT NULL,
  open_exceptions INTEGER NOT NULL DEFAULT 0,
  external_submission_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(128) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(128) NOT NULL,
  CONSTRAINT uq_taxguard_active_case UNIQUE(tenant_id, client_id, engagement_id, tax_year)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_cases_scope ON taxguard_cases(tenant_id, client_id, engagement_id, tax_year);
CREATE INDEX IF NOT EXISTS idx_taxguard_cases_preparer ON taxguard_cases(tenant_id, preparer_uid);
CREATE INDEX IF NOT EXISTS idx_taxguard_cases_reviewer ON taxguard_cases(tenant_id, reviewer_uid);

-- ------------------------------------------------------------------------------
-- 7. Case Assignments (Separation of duties & maker-checker enforcement)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_case_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  uid VARCHAR(128) NOT NULL,
  role VARCHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by VARCHAR(128),
  CONSTRAINT uq_case_assignment UNIQUE(case_id, uid)
);

-- ------------------------------------------------------------------------------
-- 8. Stage States (Lifecycle Stages 01–18)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_stage_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL CHECK (stage_number BETWEEN 1 AND 18),
  status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
  gate_evidence JSONB,
  ai_proposal JSONB,
  approved_by VARCHAR(128),
  approved_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_case_stage UNIQUE(case_id, stage_number)
);

-- ------------------------------------------------------------------------------
-- 9. Evidence & Document Vault
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  hash VARCHAR(64) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'REQUESTED',
  provenance JSONB,
  storage_path VARCHAR(512),
  file_name VARCHAR(255),
  file_size_bytes BIGINT,
  quarantine_status VARCHAR(32) NOT NULL DEFAULT 'QUARANTINED',
  scanned_at TIMESTAMPTZ,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_case_document UNIQUE(case_id, document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_documents_case ON taxguard_documents(case_id, status);

-- ------------------------------------------------------------------------------
-- 10. Extracted Field Data (AI Proposed vs Verified)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_extracted_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  field_key VARCHAR(128) NOT NULL,
  field_value JSONB NOT NULL,
  confidence NUMERIC(5,4),
  provenance JSONB NOT NULL,
  is_ai_proposed_only BOOLEAN NOT NULL DEFAULT TRUE,
  verified_by VARCHAR(128),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. Tax Records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_tax_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL,
  record_type VARCHAR(64) NOT NULL,
  data JSONB NOT NULL,
  amount NUMERIC(15,2),
  source_document_ids TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. Reconciliation Records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  category VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  discrepancies JSONB,
  reconciled_by VARCHAR(128),
  reconciled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. Exceptions & Gate Blockers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'WARNING',
  code VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by VARCHAR(128),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 14. Professional Reviews (Circular 230 Human Review Bridge)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  actor_uid VARCHAR(128) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 15. Reports & Deliverables
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  report_type VARCHAR(64) NOT NULL,
  content JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by VARCHAR(128) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 16. Planning Scenarios
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_planning_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  scenario_name VARCHAR(255) NOT NULL,
  parameters JSONB NOT NULL,
  projected_savings NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 17. Draft Returns & Calculations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_draft_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  tax_year INTEGER NOT NULL,
  return_type VARCHAR(64) NOT NULL DEFAULT '1040',
  calculation_data JSONB NOT NULL,
  diagnostics JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 18. Durable Sessions (Encrypted & Hashed)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash VARCHAR(64) NOT NULL UNIQUE,
  uid VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  auth_time BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_sessions_lookup ON taxguard_sessions(session_token_hash, revoked, expires_at);

-- ------------------------------------------------------------------------------
-- 19. Authoritative Identities
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid VARCHAR(128) NOT NULL UNIQUE,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  user_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 20. Atomic Client ID Sequence Counter
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_client_id_sequence (
  id VARCHAR(64) PRIMARY KEY DEFAULT 'primary',
  current_sequence BIGINT NOT NULL DEFAULT 0,
  last_issued_client_id VARCHAR(64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 21. Audit Trail (Immutable & Append-Only)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128),
  action VARCHAR(128) NOT NULL,
  actor_uid VARCHAR(128) NOT NULL,
  actor_role VARCHAR(64),
  metadata JSONB,
  ip_address VARCHAR(64),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_audit_tenant ON taxguard_audit_log(tenant_id, timestamp DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Defense-in-depth: Even if server authorization is bypassed, database denies cross-tenant access
-- ==============================================================================

ALTER TABLE taxguard_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_tax_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_case_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_stage_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_extracted_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_tax_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_planning_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_draft_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_audit_log ENABLE ROW LEVEL SECURITY;

-- Service Role has full administrative authority for server operations
CREATE POLICY service_role_all_tenants ON taxguard_tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_members ON taxguard_members FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_clients ON taxguard_clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_engagements ON taxguard_engagements FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_tax_years ON taxguard_tax_years FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_cases ON taxguard_cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_assignments ON taxguard_case_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_stages ON taxguard_stage_states FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_documents ON taxguard_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_extracted ON taxguard_extracted_data FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_tax_records ON taxguard_tax_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_reconciliations ON taxguard_reconciliations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_exceptions ON taxguard_exceptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_reviews ON taxguard_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_reports ON taxguard_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_planning ON taxguard_planning_scenarios FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_drafts ON taxguard_draft_returns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_sessions ON taxguard_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_identities ON taxguard_identities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_audit ON taxguard_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated Users: strictly isolated by tenant_id and UID matching
CREATE POLICY tenant_isolation_members ON taxguard_members FOR SELECT TO authenticated
  USING (uid = auth.uid());

CREATE POLICY tenant_isolation_clients ON taxguard_clients FOR SELECT TO authenticated
  USING (owner_uid = auth.uid());

CREATE POLICY tenant_isolation_cases ON taxguard_cases FOR SELECT TO authenticated
  USING (
    client_uid = auth.uid() OR
    preparer_uid = auth.uid() OR
    reviewer_uid = auth.uid()
  );

CREATE POLICY tenant_isolation_documents ON taxguard_documents FOR SELECT TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_documents.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_audit_read ON taxguard_audit_log FOR SELECT TO authenticated
  USING (actor_uid = auth.uid());
