-- PROPOSAL 051 ONLY. NOT APPLIED. Depends on proposals 034 and 036.
-- Canonical final constraint after historical ALTER COLUMN status TYPE varchar(32).
-- Reapplication of 034 changes implicit cast representation; recreate the same invariant
-- at the final type in one transaction. Existing invalid rows abort the entire proposal.
-- No data edits, weaker invariants, extra privileges or provider actions.
-- Rollback: retain this equivalent constraint; do not remove MFA lifecycle enforcement.
BEGIN;
ALTER TABLE public.taxguard_mfa_reset_jobs DROP CONSTRAINT IF EXISTS chk_taxguard_mfa_reset_job_lifecycle;
ALTER TABLE public.taxguard_mfa_reset_jobs ADD CONSTRAINT chk_taxguard_mfa_reset_job_lifecycle CHECK (
 status IN ('pending','leased','reset_verified','enrollment_verified','completed','failed') AND attempts>=0 AND fence>=0
 AND ((status='leased')=(lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL))
 AND ((status IN ('reset_verified','enrollment_verified','completed'))=(reset_at IS NOT NULL))
 AND ((status IN ('enrollment_verified','completed'))=(enrolled_factor_hash IS NOT NULL AND enrollment_verified_at IS NOT NULL))
 AND ((status='completed')=(completed_at IS NOT NULL))
 AND (enrolled_factor_hash IS NULL OR NOT(enrolled_factor_hash=ANY(removed_factor_hashes))));
-- The same historical type alteration also rewrites this predicate's casts.
-- Rebuild within the maintenance transaction; schedule the table lock before approval.
DROP INDEX IF EXISTS public.idx_taxguard_mfa_reset_jobs_runnable;
CREATE INDEX idx_taxguard_mfa_reset_jobs_runnable ON public.taxguard_mfa_reset_jobs(next_attempt_at) WHERE status IN('pending','leased');
-- Proposal 036 introduced trigger helpers after 023's broad revocation. Pin their
-- private ACL on first application as well as reapplication; no direct callers.
REVOKE ALL ON FUNCTION public.taxguard_tax_rule_test_runs_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.taxguard_tax_rule_tests_guard() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
