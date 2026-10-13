-- TaxGuard: staff session MFA assurance level and accountant case discovery index.
--
-- NOT APPLIED. Requires separate production approval (deployment plan step 3).
-- Deployment order: apply this migration BEFORE releasing the server build that records
-- session assurance levels; the server refuses to report a session as created if the
-- session row cannot be written.
--
-- Effect: every durable session records the authenticator assurance level ('aal1' / 'aal2')
-- of the verified Supabase token it was created from. Staff API requests require 'aal2'.
-- Existing rows default to 'aal1', so existing staff sessions fail closed and staff must
-- sign in again with their authenticator.

ALTER TABLE taxguard_sessions
  ADD COLUMN IF NOT EXISTS aal VARCHAR(8) NOT NULL DEFAULT 'aal1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_taxguard_sessions_aal'
  ) THEN
    ALTER TABLE taxguard_sessions
      ADD CONSTRAINT chk_taxguard_sessions_aal CHECK (aal IN ('aal1', 'aal2'));
  END IF;
END $$;

-- Accountant dashboard discovery: cases where the signed-in user is the recorded preparer.
CREATE INDEX IF NOT EXISTS idx_taxguard_cases_preparer
  ON taxguard_cases(tenant_id, preparer_uid);
