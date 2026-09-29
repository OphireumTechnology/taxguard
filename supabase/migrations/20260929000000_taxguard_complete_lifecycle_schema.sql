-- ==============================================================================
-- TaxGuard AI - Production Supabase / PostgreSQL Complete Lifecycle Schema
-- Version: 20260929000000
-- Description: Extends the authoritative multi-tenant architecture for Stages 10–18:
--   10. Approvals (Maker-checker, verified credentials, exact return hash)
--   11. Signatures (Signature packages, requests, events, authorizations)
--   12. Filings (Filing packages, attempts, acknowledgements, idempotency)
--   13. Government Feedback (Acknowledgements, acceptances, rejections, notices)
--   14. Resolutions (Resolution cases, issues, evidence, professional decisions)
--   15. Monitoring (Deadlines, follow-ups, escalation rules)
--   16. Archive (Read-only manifests, retention policies, cryptographic hash)
--   17. Renewal (Checklists, carry-forward candidates, classifications)
--   18. Repeat (Next tax year cases, Stage 1 initialization, duplicate prevention)
-- Defense-in-depth: Strict Row Level Security (RLS) on all lifecycle tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Approvals (Stage 10)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  return_version_id VARCHAR(128) NOT NULL,
  return_hash VARCHAR(64) NOT NULL,
  prepared_by VARCHAR(128) NOT NULL,
  reviewed_by VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128) NOT NULL,
  credential VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  rationale TEXT NOT NULL,
  diagnostics_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  exception_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_approval UNIQUE(tenant_id, case_id, approval_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_approvals_case ON taxguard_approvals(tenant_id, case_id, status);

-- ------------------------------------------------------------------------------
-- 2. Signature Packages (Stage 11)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_signature_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  return_version_id VARCHAR(128) NOT NULL,
  return_hash VARCHAR(64) NOT NULL,
  signers JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'NOT_READY',
  provider VARCHAR(64) NOT NULL,
  provider_envelope_id VARCHAR(255),
  completed_at TIMESTAMPTZ,
  authorization JSONB,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_sig_package UNIQUE(tenant_id, case_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_sig_packages_case ON taxguard_signature_packages(tenant_id, case_id);

-- ------------------------------------------------------------------------------
-- 3. Filing Packages & Submissions (Stage 12)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_filing_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id VARCHAR(128) NOT NULL,
  submission_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  return_version_id VARCHAR(128) NOT NULL,
  return_hash VARCHAR(64) NOT NULL,
  jurisdiction VARCHAR(64) NOT NULL DEFAULT 'FEDERAL',
  status VARCHAR(32) NOT NULL DEFAULT 'NOT_READY',
  idempotency_key VARCHAR(128) NOT NULL,
  signature_authorization_id VARCHAR(128) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  submitted_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  attempts JSONB NOT NULL DEFAULT '[]'::jsonb,
  acknowledgement JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_filing_package UNIQUE(tenant_id, case_id, package_id),
  CONSTRAINT uq_taxguard_filing_idempotency UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_filings_case ON taxguard_filing_packages(tenant_id, case_id, status);

-- ------------------------------------------------------------------------------
-- 4. Government Feedback & Notices (Stage 13)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_government_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  submission_id VARCHAR(128) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  jurisdiction VARCHAR(64) NOT NULL DEFAULT 'FEDERAL',
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
  external_reference VARCHAR(255),
  received_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_hash VARCHAR(64) NOT NULL,
  normalized_code VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'INFO',
  required_action TEXT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  notices JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_gov_feedback UNIQUE(tenant_id, case_id, feedback_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_gov_feedback_case ON taxguard_government_feedback(tenant_id, case_id);

-- ------------------------------------------------------------------------------
-- 5. Resolution Cases (Stage 14)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_resolution_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  originating_feedback_id VARCHAR(128),
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  issue_type VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  actions_taken JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_ids TEXT[] NOT NULL DEFAULT '{}',
  assigned_to VARCHAR(128) NOT NULL,
  resolution_decision JSONB,
  resolved_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_resolution UNIQUE(tenant_id, case_id, resolution_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_resolutions_case ON taxguard_resolution_cases(tenant_id, case_id, status);

-- ------------------------------------------------------------------------------
-- 6. Monitoring Items (Stage 15)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_monitoring_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  item_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  follow_up_date TIMESTAMPTZ,
  assigned_to VARCHAR(128) NOT NULL,
  resolved_at TIMESTAMPTZ,
  escalation_count INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_monitoring UNIQUE(tenant_id, case_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_monitoring_case ON taxguard_monitoring_items(tenant_id, case_id, status);

-- ------------------------------------------------------------------------------
-- 7. Archive Manifests (Stage 16)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_archive_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL,
  return_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  filing_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  government_feedback JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolution_status VARCHAR(64) NOT NULL DEFAULT 'CLOSED',
  document_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
  retention_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  integrity_hash VARCHAR(128) NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by VARCHAR(128) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_archive UNIQUE(tenant_id, case_id, manifest_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_archive_case ON taxguard_archive_manifests(tenant_id, case_id);

-- ------------------------------------------------------------------------------
-- 8. Renewal Records (Stage 17)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_renewal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  renewal_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  case_id VARCHAR(128) NOT NULL,
  prior_tax_year INTEGER NOT NULL,
  next_tax_year INTEGER NOT NULL,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  carry_forward_candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_renewal UNIQUE(tenant_id, case_id, renewal_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_renewal_case ON taxguard_renewal_records(tenant_id, case_id);

-- ------------------------------------------------------------------------------
-- 9. Repeat Cases (Stage 18)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_repeat_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repeat_id VARCHAR(128) NOT NULL,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  previous_case_id VARCHAR(128) NOT NULL,
  next_case_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  prior_tax_year INTEGER NOT NULL,
  next_tax_year INTEGER NOT NULL,
  carry_forward_count INTEGER NOT NULL DEFAULT 0,
  initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_repeat UNIQUE(tenant_id, repeat_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_repeat_prev ON taxguard_repeat_cases(tenant_id, previous_case_id);
CREATE INDEX IF NOT EXISTS idx_taxguard_repeat_next ON taxguard_repeat_cases(tenant_id, next_case_id);

-- ------------------------------------------------------------------------------
-- 10. Idempotency Records
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_idempotency_records (
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  idempotency_key VARCHAR(128) PRIMARY KEY,
  operation_type VARCHAR(64) NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR STAGES 10–18
-- ==============================================================================

ALTER TABLE taxguard_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_signature_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_filing_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_government_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_resolution_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_monitoring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_archive_manifests ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_renewal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_repeat_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_idempotency_records ENABLE ROW LEVEL SECURITY;

-- Service Role full authority
CREATE POLICY service_role_all_approvals ON taxguard_approvals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_sig_packages ON taxguard_signature_packages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_filings ON taxguard_filing_packages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_gov_feedback ON taxguard_government_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_resolutions ON taxguard_resolution_cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_monitoring ON taxguard_monitoring_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_archives ON taxguard_archive_manifests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_renewals ON taxguard_renewal_records FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_repeats ON taxguard_repeat_cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY service_role_all_idempotency ON taxguard_idempotency_records FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated Users: isolated by case association
CREATE POLICY tenant_isolation_approvals ON taxguard_approvals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_approvals.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_sig_packages ON taxguard_signature_packages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_signature_packages.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_filings ON taxguard_filing_packages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_filing_packages.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_gov_feedback ON taxguard_government_feedback FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_government_feedback.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_resolutions ON taxguard_resolution_cases FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_resolution_cases.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_monitoring ON taxguard_monitoring_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_monitoring_items.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_archives ON taxguard_archive_manifests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_archive_manifests.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_renewals ON taxguard_renewal_records FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_renewal_records.case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );

CREATE POLICY tenant_isolation_repeats ON taxguard_repeat_cases FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM taxguard_cases c
      WHERE c.case_id = taxguard_repeat_cases.previous_case_id
      AND (c.client_uid = auth.uid() OR c.preparer_uid = auth.uid() OR c.reviewer_uid = auth.uid())
    )
  );
