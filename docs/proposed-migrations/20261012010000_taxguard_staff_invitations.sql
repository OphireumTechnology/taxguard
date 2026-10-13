-- TaxGuard: durable staff invitations, activation approval and membership lifecycle.
--
-- NOT APPLIED. Requires separate production approval. Apply after
-- 20261012000000_taxguard_staff_session_assurance.sql and BEFORE releasing the server build
-- that serves /api/staff-access (the build fails closed with 503 when this table is missing).
--
-- Security model:
--   * Only a SHA-256 hash of each one-time invitation token is stored.
--   * At most one pending invitation per tenant and e-mail address.
--   * Accepted invitations create a membership in status 'pending_approval'; a different
--     administrator must approve activation (maker-checker).
--   * Row level security: service role only. The browser never reads these tables directly.

CREATE TABLE IF NOT EXISTS taxguard_staff_invitations (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(128) NOT NULL REFERENCES taxguard_tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(64) NOT NULL,
  legal_first_name VARCHAR(128) NOT NULL,
  legal_last_name VARCHAR(128) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  invited_by VARCHAR(128) NOT NULL,
  accepted_uid VARCHAR(128),
  accepted_at TIMESTAMPTZ,
  revoked_by VARCHAR(128),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_taxguard_invitation_role CHECK (role IN ('accountant', 'reviewer', 'senior_reviewer', 'bookkeeper', 'practice_manager', 'operations', 'admin'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_taxguard_pending_staff_invitation
  ON taxguard_staff_invitations (tenant_id, lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_taxguard_staff_invitations_tenant
  ON taxguard_staff_invitations (tenant_id, status, created_at DESC);

ALTER TABLE taxguard_staff_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_role_all_staff_invitations ON taxguard_staff_invitations;
CREATE POLICY service_role_all_staff_invitations ON taxguard_staff_invitations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Membership lifecycle metadata (status values used: active, pending_approval, suspended, deactivated).
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS invited_by VARCHAR(128);
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS approved_by VARCHAR(128);
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS status_changed_by VARCHAR(128);
ALTER TABLE taxguard_members ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
