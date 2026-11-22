-- ============================================================================
-- TAXGUARD AI — STAGES 09–18 ENTERPRISE COMPLETION SCHEMA PROPOSAL
-- File: docs/proposed-migrations/20261122000000_taxguard_stages_09_18_completion.sql
--
-- STATUS: REVIEW ONLY — DO NOT AUTO-APPLY TO PRODUCTION.
-- Requires owner authorization, DBA review, staging rehearsal, and backup
-- verification prior to any database execution.
--
-- Additive migration extending existing 20261012–20261019 proposals without
-- dropping, renaming, or breaking any existing Stages 01–11 tables.
-- Uses exact-decimal NUMERIC(18,2) / NUMERIC(18,6) for all monetary & rate
-- columns (never FLOAT/DOUBLE PRECISION), optimistic concurrency version
-- columns, immutable audit correlation IDs, and fail-closed RLS defaults.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STAGE 09: PREPARE TAXES — Profiles, Versioned Forms, Field Values, Lineage
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_taxpayer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  legal_entity_structure VARCHAR(40) NOT NULL CHECK (
    legal_entity_structure IN (
      'INDIVIDUAL', 'SINGLE_MEMBER_LLC', 'MULTI_MEMBER_LLC', 'CORPORATION',
      'TRUST', 'ESTATE', 'NONPROFIT', 'PARTNERSHIP_GENERAL', 'PARTNERSHIP_LIMITED'
    )
  ),
  federal_tax_classification VARCHAR(40) NOT NULL CHECK (
    federal_tax_classification IN (
      'INDIVIDUAL_1040', 'DISREGARDED_ENTITY', 'PARTNERSHIP_1065',
      'C_CORP_1120', 'S_CORP_1120S', 'FIDUCIARY_1041', 'EXEMPT_990'
    )
  ),
  filing_status VARCHAR(40),
  primary_jurisdiction_code CHAR(2) NOT NULL,
  additional_jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  dependents_count INTEGER NOT NULL DEFAULT 0 CHECK (dependents_count >= 0),
  dependents_metadata JSONB NOT NULL DEFAULT '[]'::jsonb,
  prior_year_case_id VARCHAR(128),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, case_id, tax_year)
);

CREATE TABLE IF NOT EXISTS public.taxguard_form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  form_code VARCHAR(40) NOT NULL,
  form_title VARCHAR(255) NOT NULL,
  jurisdiction VARCHAR(16) NOT NULL CHECK (jurisdiction IN ('FEDERAL', 'STATE', 'LOCAL')),
  jurisdiction_code VARCHAR(8) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  revision_tag VARCHAR(64) NOT NULL,
  support_status VARCHAR(32) NOT NULL CHECK (
    support_status IN ('SUPPORTED_RULE_APPROVED', 'PROTOTYPE_UNAPPROVED', 'PENDING_RULE_APPROVAL', 'NOT_SUPPORTED')
  ),
  rule_pack_id VARCHAR(128),
  schema_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, form_code, jurisdiction_code, tax_year, revision_tag)
);

CREATE TABLE IF NOT EXISTS public.taxguard_form_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  return_version_id VARCHAR(128) NOT NULL,
  form_code VARCHAR(40) NOT NULL,
  line_key VARCHAR(64) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  numeric_value NUMERIC(18, 2),
  rate_value NUMERIC(18, 6),
  text_value TEXT,
  calculation_run_id VARCHAR(128),
  source_lineage_hash CHAR(64) NOT NULL CHECK (source_lineage_hash ~ '^[a-f0-9]{64}$'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, return_version_id, form_code, line_key)
);

CREATE TABLE IF NOT EXISTS public.taxguard_calculation_evidence_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  return_version_id VARCHAR(128) NOT NULL,
  source_document_id VARCHAR(128) NOT NULL,
  verified_fact_id VARCHAR(128) NOT NULL,
  approved_adjustment_id VARCHAR(128),
  calculation_run_id VARCHAR(128) NOT NULL,
  form_code VARCHAR(40) NOT NULL,
  form_line_key VARCHAR(64) NOT NULL,
  evidence_status VARCHAR(24) NOT NULL CHECK (evidence_status IN ('VERIFIED', 'MISSING', 'DISPUTED', 'SUPERSEDED')),
  amount_impact NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  lineage_sha256 CHAR(64) NOT NULL CHECK (lineage_sha256 ~ '^[a-f0-9]{64}$'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taxguard_book_to_tax_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  schedule_type VARCHAR(16) NOT NULL CHECK (schedule_type IN ('M-1', 'M-2', 'M-3', 'BOOK_TO_TAX')),
  book_net_income NUMERIC(18, 2) NOT NULL,
  permanent_differences NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  temporary_differences NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  taxable_income_reconciled NUMERIC(18, 2) NOT NULL,
  reconciliation_variance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  prepared_by VARCHAR(128) NOT NULL,
  approved_by VARCHAR(128),
  approved_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (approved_by IS NULL OR approved_by <> prepared_by)
);

-- ----------------------------------------------------------------------------
-- STAGE 10: APPROVE — Review Findings, Configurable QC Gates, Approval Records
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_return_review_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  return_version_id VARCHAR(128) NOT NULL,
  qc_category VARCHAR(48) NOT NULL CHECK (
    qc_category IN (
      'IDENTITY_AND_FILING_STATUS', 'DOCUMENT_COMPLETENESS', 'FINANCIAL_RECONCILIATION',
      'TAX_COMPUTATION_VERIFICATION', 'REGULATORY_COMPLIANCE', 'FORM_COMPLETENESS', 'FINAL_RELEASE_READINESS'
    )
  ),
  severity VARCHAR(16) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'HIGH', 'CRITICAL', 'BLOCKING')),
  description TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ADDRESSED', 'WAIVED_AUTHORIZED', 'CLOSED')),
  raised_by VARCHAR(128) NOT NULL,
  resolved_by VARCHAR(128),
  resolved_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taxguard_return_approval_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  return_version_id VARCHAR(128) NOT NULL,
  return_content_sha256 CHAR(64) NOT NULL CHECK (return_content_sha256 ~ '^[a-f0-9]{64}$'),
  preparer_id VARCHAR(128) NOT NULL,
  reviewer_id VARCHAR(128) NOT NULL,
  approver_id VARCHAR(128) NOT NULL,
  risk_classification VARCHAR(24) NOT NULL CHECK (
    risk_classification IN ('Low', 'Moderate', 'High', 'Critical', 'Not assessed')
  ),
  risk_justification TEXT NOT NULL,
  decision VARCHAR(32) NOT NULL CHECK (decision IN ('APPROVED', 'RETURNED_FOR_CORRECTION', 'INVALIDATED')),
  invalidated_reason TEXT,
  mfa_assurance_level VARCHAR(16) NOT NULL CHECK (mfa_assurance_level = 'aal2'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reviewer_id <> preparer_id),
  CHECK (approver_id <> preparer_id)
);

-- ----------------------------------------------------------------------------
-- STAGE 11: SIGN — Envelopes, Cryptographic Evidence, Webhook Replay Guards
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_signature_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  return_version_id VARCHAR(128) NOT NULL,
  approval_record_id UUID REFERENCES public.taxguard_return_approval_records(id) ON DELETE RESTRICT,
  document_type VARCHAR(40) NOT NULL CHECK (
    document_type IN (
      'ENGAGEMENT_AGREEMENT', 'CONSENT_7216', 'FORM_8879', 'FORM_8879_PE',
      'FORM_8879_CORP', 'FORM_8879_S', 'FORM_8879_F', 'FORM_8878',
      'ENTITY_AUTHORIZATION', 'REPRESENTATION_AUTHORIZATION'
    )
  ),
  document_sha256 CHAR(64) NOT NULL CHECK (document_sha256 ~ '^[a-f0-9]{64}$'),
  esignature_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  provider_name VARCHAR(64) NOT NULL,
  provider_envelope_id VARCHAR(128),
  status VARCHAR(32) NOT NULL CHECK (
    status IN ('DRAFT', 'READY_FOR_DISPATCH', 'BLOCKED_PROVIDER_UNCONFIGURED', 'SENT', 'SIGNED', 'DECLINED', 'EXPIRED', 'REVOKED')
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  signed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taxguard_signature_webhook_nonces (
  nonce_id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL,
  provider_name VARCHAR(64) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_sha256 CHAR(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$')
);

-- ----------------------------------------------------------------------------
-- STAGE 12: FILE — Filing Transmissions & Acknowledgments
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_filing_transmissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  return_version_id VARCHAR(128) NOT NULL,
  return_content_sha256 CHAR(64) NOT NULL CHECK (return_content_sha256 ~ '^[a-f0-9]{64}$'),
  signature_envelope_id UUID NOT NULL REFERENCES public.taxguard_signature_envelopes(id) ON DELETE RESTRICT,
  jurisdiction VARCHAR(16) NOT NULL,
  jurisdiction_code VARCHAR(8) NOT NULL,
  schema_version VARCHAR(32) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  lifecycle_state VARCHAR(32) NOT NULL CHECK (
    lifecycle_state IN (
      'NOT_READY', 'READY_FOR_REVIEW', 'AUTHORIZED_FOR_TRANSMISSION',
      'TRANSMISSION_PENDING', 'TRANSMITTED', 'ACKNOWLEDGMENT_PENDING',
      'ACCEPTED', 'REJECTED', 'UNKNOWN_OUTCOME', 'CORRECTION_REQUIRED', 'CANCELLED'
    )
  ),
  provider_name VARCHAR(64) NOT NULL,
  provider_submission_id VARCHAR(128),
  auto_retry_prohibited BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_taxguard_filing_no_duplicate_active
  ON public.taxguard_filing_transmissions (tenant_id, case_id, tax_year, jurisdiction_code)
  WHERE lifecycle_state NOT IN ('REJECTED', 'CORRECTION_REQUIRED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS public.taxguard_filing_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  filing_transmission_id UUID NOT NULL REFERENCES public.taxguard_filing_transmissions(id) ON DELETE RESTRICT,
  external_ack_id VARCHAR(128) NOT NULL,
  jurisdiction_code VARCHAR(8) NOT NULL,
  ack_status VARCHAR(24) NOT NULL CHECK (ack_status IN ('ACCEPTED', 'REJECTED', 'PENDING')),
  error_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload_sha256 CHAR(64) NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, external_ack_id)
);

-- ----------------------------------------------------------------------------
-- STAGE 13: GOVERNMENT FEEDBACK — Notices & Transcript Requests
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_government_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  issuing_agency VARCHAR(128) NOT NULL,
  notice_code VARCHAR(64) NOT NULL,
  notice_date DATE NOT NULL,
  response_deadline DATE,
  proposed_amount NUMERIC(18, 2),
  sanitized_summary TEXT NOT NULL,
  ai_advisory_summary TEXT,
  ai_is_authoritative BOOLEAN NOT NULL DEFAULT FALSE CHECK (ai_is_authoritative = FALSE),
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'TRIAGED', 'IN_RESOLUTION', 'CLOSED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taxguard_transcript_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  transcript_type VARCHAR(40) NOT NULL CHECK (transcript_type IN ('ACCOUNT', 'RETURN', 'WAGE_AND_INCOME', 'RECORD_OF_ACCOUNT')),
  taxpayer_consent_verified BOOLEAN NOT NULL DEFAULT FALSE,
  representation_authority_id VARCHAR(128),
  provider_status VARCHAR(32) NOT NULL DEFAULT 'DISABLED',
  status VARCHAR(32) NOT NULL DEFAULT 'BLOCKED_PROVIDER_UNCOMMISSIONED',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- STAGE 14: RESOLVE — Resolution Cases, Actions & Linked Amendments
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_resolution_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  originating_notice_id UUID REFERENCES public.taxguard_government_notices(id) ON DELETE RESTRICT,
  lifecycle_state VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (
    lifecycle_state IN (
      'OPEN', 'TRIAGE', 'INVESTIGATION', 'EVIDENCE_COLLECTION', 'PROPOSED_ACTION',
      'PROFESSIONAL_REVIEW', 'AUTHORIZED_RESPONSE', 'RESPONSE_PENDING',
      'RESOLVED', 'ESCALATED', 'REOPENED', 'CANCELLED'
    )
  ),
  government_confirmation_received BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_owner_id VARCHAR(128) NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (lifecycle_state <> 'RESOLVED' OR government_confirmation_received = TRUE)
);

CREATE TABLE IF NOT EXISTS public.taxguard_return_amendments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  resolution_case_id UUID REFERENCES public.taxguard_resolution_cases(id) ON DELETE RESTRICT,
  original_return_version_id VARCHAR(128) NOT NULL,
  amended_return_version_id VARCHAR(128) NOT NULL,
  amendment_form_code VARCHAR(32) NOT NULL,
  reason_for_amendment TEXT NOT NULL,
  net_tax_delta NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SUPERSEDED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (original_return_version_id <> amended_return_version_id)
);

-- ----------------------------------------------------------------------------
-- STAGE 15: MONITOR — Compliance Obligations, Alerts & Notification Outbox
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_monitoring_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  jurisdiction_code VARCHAR(8) NOT NULL,
  obligation_type VARCHAR(40) NOT NULL CHECK (
    obligation_type IN ('ESTIMATED_TAX', 'EXTENSION_DEADLINE', 'NOTICE_RESPONSE', 'AMENDED_FOLLOWUP', 'ANNUAL_FILING', 'RELIEF_DEADLINE')
  ),
  statutory_due_date DATE NOT NULL,
  adjusted_due_date DATE NOT NULL,
  rule_basis TEXT NOT NULL,
  projected_amount NUMERIC(18, 2),
  status VARCHAR(24) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DUE_SOON', 'OVERDUE', 'ESCALATED', 'COMPLETED', 'CANCELLED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taxguard_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  idempotency_key VARCHAR(128) NOT NULL,
  channel VARCHAR(24) NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS')),
  recipient_ref VARCHAR(128) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  delivery_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (
    delivery_status IN ('PENDING', 'BLOCKED_PROVIDER_UNCOMMISSIONED', 'RETRY_SCHEDULED', 'DEAD_LETTER', 'DELIVERED')
  ),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
  last_error_code VARCHAR(64),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, idempotency_key)
);

-- ----------------------------------------------------------------------------
-- STAGE 16: ARCHIVE — Immutable Packages, Retention Policies & Legal Holds
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_archive_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  document_class VARCHAR(48) NOT NULL,
  jurisdiction_code VARCHAR(8) NOT NULL,
  engagement_type VARCHAR(48) NOT NULL,
  retention_years INTEGER NOT NULL CHECK (retention_years BETWEEN 1 AND 99),
  policy_authority TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, document_class, jurisdiction_code, engagement_type)
);

CREATE TABLE IF NOT EXISTS public.taxguard_archive_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  manifest_json JSONB NOT NULL,
  integrity_sha256 CHAR(64) NOT NULL CHECK (integrity_sha256 ~ '^[a-f0-9]{64}$'),
  retention_policy_id UUID NOT NULL REFERENCES public.taxguard_archive_retention_policies(id) ON DELETE RESTRICT,
  eligible_for_disposition_date DATE NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'SEALED' CHECK (status IN ('SEALED', 'UNDER_LEGAL_HOLD', 'DISPOSED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, case_id, tax_year, integrity_sha256)
);

CREATE TABLE IF NOT EXISTS public.taxguard_legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  archive_package_id UUID NOT NULL REFERENCES public.taxguard_archive_packages(id) ON DELETE RESTRICT,
  hold_reason TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED')),
  placed_by VARCHAR(128) NOT NULL,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_by VARCHAR(128),
  released_at TIMESTAMPTZ,
  release_authorization_note TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guard preventing deletion of any archive package under active legal hold
CREATE OR REPLACE FUNCTION public.taxguard_prevent_legal_hold_deletion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.taxguard_legal_holds lh
    WHERE lh.archive_package_id = OLD.id AND lh.status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'LEGAL_HOLD_ACTIVE_DELETION_BLOCKED' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_taxguard_archive_legal_hold_guard ON public.taxguard_archive_packages;
CREATE TRIGGER trg_taxguard_archive_legal_hold_guard
  BEFORE DELETE ON public.taxguard_archive_packages
  FOR EACH ROW EXECUTE FUNCTION public.taxguard_prevent_legal_hold_deletion();

-- ----------------------------------------------------------------------------
-- STAGE 17: RENEW — Annual Engagement Renewals
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_engagement_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  prior_tax_year INTEGER NOT NULL CHECK (prior_tax_year BETWEEN 2000 AND 2100),
  proposed_fee NUMERIC(18, 2) NOT NULL CHECK (proposed_fee >= 0.00),
  scope_summary TEXT NOT NULL,
  conflict_check_passed BOOLEAN NOT NULL DEFAULT FALSE,
  risk_check_classification VARCHAR(24) NOT NULL DEFAULT 'Not assessed',
  agreement_renewed BOOLEAN NOT NULL DEFAULT FALSE,
  consent_renewed BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(24) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_CLIENT', 'READY_TO_ACTIVATE', 'ACTIVATED', 'DECLINED')),
  activated_by VARCHAR(128),
  activated_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tax_year = prior_tax_year + 1)
);

-- ----------------------------------------------------------------------------
-- STAGE 18: REPEAT — Reviewed Carryforwards & Annual Cycle Generations
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.taxguard_tax_year_carryforwards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  source_tax_year INTEGER NOT NULL CHECK (source_tax_year < tax_year),
  category VARCHAR(48) NOT NULL CHECK (
    category IN (
      'CAPITAL_LOSS', 'NOL', 'PASSIVE_ACTIVITY_LOSS', 'TAX_CREDIT',
      'DEPRECIATION_BASIS', 'SHAREHOLDER_PARTNER_BASIS', 'ESTIMATED_TAX_OVERPAYMENT', 'RECURRING_ITEM'
    )
  ),
  amount NUMERIC(18, 2) NOT NULL,
  eligibility_rule_ref VARCHAR(128) NOT NULL,
  review_status VARCHAR(24) NOT NULL DEFAULT 'CANDIDATE' CHECK (
    review_status IN ('CANDIDATE', 'REVIEWED_APPROVED', 'REJECTED', 'EXPIRED')
  ),
  reviewed_by VARCHAR(128),
  reviewed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taxguard_annual_cycle_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128) NOT NULL,
  case_id VARCHAR(128) NOT NULL,
  tax_year INTEGER NOT NULL CHECK (tax_year BETWEEN 2000 AND 2100),
  prior_case_id VARCHAR(128) NOT NULL,
  prior_tax_year INTEGER NOT NULL,
  renewal_id UUID NOT NULL REFERENCES public.taxguard_engagement_renewals(id) ON DELETE RESTRICT,
  approved_carryforward_count INTEGER NOT NULL DEFAULT 0 CHECK (approved_carryforward_count >= 0),
  intelligence_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  new_case_initial_stage INTEGER NOT NULL DEFAULT 1 CHECK (new_case_initial_stage = 1),
  prior_case_mutated BOOLEAN NOT NULL DEFAULT FALSE CHECK (prior_case_mutated = FALSE),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  audit_correlation_id VARCHAR(128) NOT NULL,
  created_by VARCHAR(128) NOT NULL,
  updated_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, prior_case_id, tax_year),
  CHECK (case_id <> prior_case_id)
);

-- ----------------------------------------------------------------------------
-- FAIL-CLOSED ROW LEVEL SECURITY & ACCESS LOCKDOWN
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'taxguard_taxpayer_profiles',
    'taxguard_form_definitions',
    'taxguard_form_field_values',
    'taxguard_calculation_evidence_lineage',
    'taxguard_book_to_tax_schedules',
    'taxguard_return_review_findings',
    'taxguard_return_approval_records',
    'taxguard_signature_envelopes',
    'taxguard_signature_webhook_nonces',
    'taxguard_filing_transmissions',
    'taxguard_filing_acknowledgments',
    'taxguard_government_notices',
    'taxguard_transcript_requests',
    'taxguard_resolution_cases',
    'taxguard_return_amendments',
    'taxguard_monitoring_obligations',
    'taxguard_notification_outbox',
    'taxguard_archive_retention_policies',
    'taxguard_archive_packages',
    'taxguard_legal_holds',
    'taxguard_engagement_renewals',
    'taxguard_tax_year_carryforwards',
    'taxguard_annual_cycle_generations'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC;', tbl);
  END LOOP;
END $$;

COMMIT;
