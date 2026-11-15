-- ==============================================================================
-- TaxGuard AI - Production Supabase / PostgreSQL Practice Operations Schema
-- Version: 20261001000000
-- Description: Establishes the authoritative practice operations architecture:
--   1. Durable Background Job Queue & Dead-Letter Store (safe concurrency & bounded retries)
--   2. Durable Write Idempotency (cross-server replay prevention & mutation fingerprinting)
--   3. Practice Task Engine & Authoritative Dependency Gates
--   4. Staff Assignments, Historical Caseload & Reassignment Governance
--   5. Deadlines, Statutory Calendars & Escalation Engine
--   6. Client Communication Threads & Messages (CLIENT_VISIBLE vs INTERNAL_ONLY)
--   7. Client Request Center (Unified documents, clarifications, signatures, payments)
--   8. Notification Orchestrator, Delivery Receipts & User Preferences
--   9. Service Catalog & Engagement Scope Controls
--  10. Invoicing, Deterministic Line Items & Payment Allocations
--  11. Data Retention Classifications, Legal Holds & Archive Integrity Manifests
-- Defense-in-depth: Strict Row Level Security (RLS) on all practice operations tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Durable Write Idempotency Store
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_mutation_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  operation VARCHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  idempotency_key VARCHAR(256) NOT NULL,
  request_fingerprint VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING', -- PROCESSING, COMPLETED, FAILED
  result_reference JSONB,
  audit_event_id VARCHAR(128),
  error_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  CONSTRAINT uq_taxguard_mutation_idempotency UNIQUE(tenant_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_idempotency_lookup 
  ON taxguard_mutation_idempotency(tenant_id, operation, idempotency_key);

-- ------------------------------------------------------------------------------
-- 2. Durable Background Job Queue & Dead-Letter Store
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_durable_jobs (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  case_id VARCHAR(128),
  job_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING', 
  -- PENDING, CLAIMED, RUNNING, RETRY_SCHEDULED, COMPLETED, FAILED, DEAD_LETTER, CANCELLED
  priority INTEGER NOT NULL DEFAULT 5, -- 1 (highest) to 10 (lowest)
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by VARCHAR(128),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  last_error_code VARCHAR(64),
  last_error_message TEXT,
  retry_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key VARCHAR(256),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_jobs_claim 
  ON taxguard_durable_jobs(status, available_at, priority, tenant_id);
CREATE INDEX IF NOT EXISTS idx_taxguard_jobs_client 
  ON taxguard_durable_jobs(tenant_id, client_id, status);

-- ------------------------------------------------------------------------------
-- 3. Practice Task Engine & Dependencies
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_practice_tasks (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  engagement_id VARCHAR(128),
  tax_year INTEGER,
  case_id VARCHAR(128),
  stage INTEGER,
  task_type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH, URGENT
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  -- OPEN, IN_PROGRESS, WAITING_ON_CLIENT, WAITING_ON_PROVIDER, READY_FOR_REVIEW, BLOCKED, COMPLETED, CANCELLED
  assigned_user_id VARCHAR(128),
  assigned_role VARCHAR(64),
  created_by VARCHAR(128) NOT NULL,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by VARCHAR(128),
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of task IDs
  related_resource JSONB, -- { type: 'document'|'transaction'|'request', id: '...' }
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_tasks_lookup 
  ON taxguard_practice_tasks(tenant_id, client_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_taxguard_tasks_assignee 
  ON taxguard_practice_tasks(tenant_id, assigned_user_id, status);

-- ------------------------------------------------------------------------------
-- 4. Staff Assignments & Historical Caseload
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_staff_assignments (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128),
  tax_year INTEGER,
  role VARCHAR(64) NOT NULL, -- preparer, accountant, reviewer, cpa_ea, admin, case_owner
  user_id VARCHAR(128) NOT NULL,
  assigned_by VARCHAR(128) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REASSIGNED, REVOKED
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_active_role_assignment UNIQUE(tenant_id, client_id, role, status)
);

CREATE TABLE IF NOT EXISTS taxguard_assignment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  role VARCHAR(64) NOT NULL,
  previous_user_id VARCHAR(128),
  new_user_id VARCHAR(128) NOT NULL,
  changed_by VARCHAR(128) NOT NULL,
  reassignment_reason TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_assignments_user 
  ON taxguard_staff_assignments(tenant_id, user_id, status);

-- ------------------------------------------------------------------------------
-- 5. Deadlines, Statutory Calendars & Escalation
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_deadlines (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64),
  case_id VARCHAR(128),
  tax_year INTEGER,
  category VARCHAR(64) NOT NULL,
  -- client_request, internal_prep, review, signature, filing, estimated_payment, extension, notice_response, bookkeeping_close, renewal
  title VARCHAR(255) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  authority_type VARCHAR(32) NOT NULL DEFAULT 'INTERNAL',
  -- STATUTORY, PROVIDER, CLIENT_COMMITMENT, INTERNAL, ESTIMATED, MANUAL
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, MET, OVERDUE, WAIVED
  escalation_level INTEGER NOT NULL DEFAULT 0, -- 0 (normal), 1 (approaching), 2 (due_soon), 3 (overdue), 4 (critical)
  last_escalated_at TIMESTAMPTZ,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_deadlines_eval 
  ON taxguard_deadlines(tenant_id, status, due_date, escalation_level);

-- ------------------------------------------------------------------------------
-- 6. Client Communication Threads & Messages
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_communication_threads (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128),
  case_id VARCHAR(128),
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'GENERAL', -- GENERAL, TAX_QUESTION, DOCUMENT_QUERY, INVOICING, ADVISORY
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RESOLVED, ARCHIVED
  created_by VARCHAR(128) NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taxguard_communication_messages (
  id VARCHAR(128) PRIMARY KEY,
  thread_id VARCHAR(128) NOT NULL REFERENCES taxguard_communication_threads(id) ON DELETE CASCADE,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  sender_id VARCHAR(128) NOT NULL,
  sender_role VARCHAR(64) NOT NULL,
  visibility VARCHAR(32) NOT NULL DEFAULT 'CLIENT_VISIBLE', -- CLIENT_VISIBLE, INTERNAL_ONLY
  content TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_comm_thread_lookup 
  ON taxguard_communication_threads(tenant_id, client_id, status);
CREATE INDEX IF NOT EXISTS idx_taxguard_comm_messages_lookup 
  ON taxguard_communication_messages(thread_id, visibility, created_at);

-- ------------------------------------------------------------------------------
-- 7. Unified Client Request Center
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_client_requests (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128),
  case_id VARCHAR(128),
  request_type VARCHAR(64) NOT NULL,
  -- DOCUMENT, QUESTIONNAIRE, TRANSACTION_CLARIFICATION, BUSINESS_PURPOSE, MISSING_RECEIPT, SIGNATURE, PAYMENT, GENERAL_INFORMATION
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  -- OPEN, VIEWED, RESPONDED, UNDER_REVIEW, RESOLVED, CLOSED
  priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
  due_date TIMESTAMPTZ,
  created_by VARCHAR(128) NOT NULL,
  assigned_to_client_id VARCHAR(64) NOT NULL,
  response_text TEXT,
  response_data JSONB,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_requests_lookup 
  ON taxguard_client_requests(tenant_id, client_id, status, due_date);

-- ------------------------------------------------------------------------------
-- 8. Centralized Notification Orchestration & Delivery Receipts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_notifications (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  recipient_id VARCHAR(128) NOT NULL,
  recipient_role VARCHAR(64) NOT NULL,
  client_id VARCHAR(64),
  template_type VARCHAR(64) NOT NULL,
  channel VARCHAR(32) NOT NULL, -- IN_APP, EMAIL, SMS
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_mandatory_security BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(32) NOT NULL DEFAULT 'QUEUED', -- QUEUED, SENT, DELIVERED, NOT_CONFIGURED, FAILED
  provider_reference VARCHAR(128),
  failure_code VARCHAR(64),
  failure_message TEXT,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taxguard_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL,
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sms_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_user_notification_prefs UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_notifications_recipient 
  ON taxguard_notifications(tenant_id, recipient_id, status, created_at);

-- ------------------------------------------------------------------------------
-- 9. Service Catalog & Engagement Scope Dossiers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_service_catalog (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  service_code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL, -- INDIVIDUAL_TAX, BUSINESS_TAX, BOOKKEEPING, ADVISORY, AUDIT_RESOLUTION
  billing_method VARCHAR(32) NOT NULL DEFAULT 'FLAT_FEE', -- FLAT_FEE, HOURLY, SUBSCRIPTION, CONTINGENCY
  base_fee NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_service_code UNIQUE(tenant_id, service_code)
);

CREATE TABLE IF NOT EXISTS taxguard_engagement_dossiers (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_code VARCHAR(64) NOT NULL,
  tax_year INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', 
  -- DRAFT, PROPOSED, ACTIVE, ON_HOLD, COMPLETED, TERMINATED, RENEWAL_DUE
  authorized_services JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of service codes
  responsible_accountant_id VARCHAR(128),
  responsible_reviewer_id VARCHAR(128),
  terms_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  terms_agreed_at TIMESTAMPTZ,
  terms_hash VARCHAR(128),
  consents JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_contract_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_client_year_engagement UNIQUE(tenant_id, client_id, tax_year, engagement_code)
);

CREATE INDEX IF NOT EXISTS idx_taxguard_engagements_scope 
  ON taxguard_engagement_dossiers(tenant_id, client_id, status);

-- ------------------------------------------------------------------------------
-- 10. Invoicing, Deterministic Line Items & Payment Allocations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_invoices (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  engagement_id VARCHAR(128),
  invoice_number VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  -- DRAFT, ISSUED, PARTIALLY_PAID, PAID, PAST_DUE, VOID
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  adjustments NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  balance_due NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  due_date DATE NOT NULL,
  issue_date DATE,
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  voided_by VARCHAR(128),
  created_by VARCHAR(128) NOT NULL,
  issued_by VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_invoice_num UNIQUE(tenant_id, invoice_number),
  CONSTRAINT chk_invoice_balance CHECK (balance_due = total - amount_paid)
);

CREATE TABLE IF NOT EXISTS taxguard_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id VARCHAR(128) NOT NULL REFERENCES taxguard_invoices(id) ON DELETE CASCADE,
  service_code VARCHAR(64) NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
  unit_rate NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taxguard_invoice_payments (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  invoice_id VARCHAR(128) NOT NULL REFERENCES taxguard_invoices(id) ON DELETE CASCADE,
  client_id VARCHAR(64) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  payment_method VARCHAR(32) NOT NULL, -- STRIPE, ACH, CHECK, WIRE, MANUAL_ADJUSTMENT
  status VARCHAR(32) NOT NULL DEFAULT 'SETTLED', -- PENDING, SETTLED, FAILED, REFUNDED
  provider_transaction_id VARCHAR(128),
  idempotency_key VARCHAR(256),
  recorded_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taxguard_invoices_client 
  ON taxguard_invoices(tenant_id, client_id, status);

-- ------------------------------------------------------------------------------
-- 11. Data Retention Classifications & Archive Integrity Manifests
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS taxguard_retention_policies (
  id VARCHAR(128) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  record_category VARCHAR(64) NOT NULL, -- TAX_RETURN, WORKPAPERS, COMMUNICATIONS, AUDIT_LOGS, INVOICES
  retention_years INTEGER NOT NULL DEFAULT 7,
  legal_hold_active BOOLEAN NOT NULL DEFAULT FALSE,
  hold_reason TEXT,
  hold_placed_by VARCHAR(128),
  hold_placed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_taxguard_retention_cat UNIQUE(tenant_id, record_category)
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE taxguard_mutation_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_durable_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_practice_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_client_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_engagement_dossiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxguard_retention_policies ENABLE ROW LEVEL SECURITY;

-- Service Role Policy (Authority Bypass for privileged backend orchestration)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_practice_operations_access') THEN
    CREATE POLICY service_role_practice_operations_access ON taxguard_durable_jobs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
