# TaxGuard AI — Master Production Release Gate Checklist
**Firm:** A/R Tax Services, LLC  
**Application:** TaxGuard AI Operations Engine  
**Release Version:** 1.0.0-RC1  
**Classification:** Authoritative Release Sign-Off  

---

## 1. Source & Repository Checkpoint
- [ ] Working tree clean of uncommitted prototype or test scratch files.
- [ ] No `.env` files or active secrets committed to source control.
- [ ] Git presence checked (Git absent in ephemeral AI Studio sandbox; release package prepared via final transfer archive).

---

## 2. Database & Migration List Verification
- [ ] `20260928000000_taxguard_core_schema.sql` (Verified)
- [ ] `20260929000000_taxguard_complete_lifecycle_schema.sql` (Verified)
- [ ] `20260930000000_taxguard_bookkeeping_schema.sql` (Verified)
- [ ] `20261001000000_taxguard_practice_operations_schema.sql` (Verified)
- [ ] Database Schema Readiness check confirms `DATABASE_READY` via `ProviderReadinessRegistry`.

---

## 3. Environment & Configuration Audit
- [ ] Required production variables present in host configuration:
  - `NODE_ENV=production`
  - `PORT=3000`
  - `JWT_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
  - `TAXGUARD_TENANT_ID=ar-tax-services`
- [ ] No dummy, mock, or development fallbacks active in production mode.
- [ ] Secret scan confirms 0 plaintext API keys, passwords, or tokens in client bundles.

---

## 4. Automated Code & Test Verification Gates
- [ ] **TypeScript Check:** `npm run typecheck` (`tsc --noEmit`) -> 0 errors.
- [ ] **Vitest Test Suite:** `npx vitest run` -> 78 test files, >= 1,065 tests passed, 0 failures, 0 skipped.
- [ ] **Production Build:** `npm run build` -> Clean `dist/` and `build/server.cjs` artifacts produced.

---

## 5. Security & Isolation Controls
- [ ] Multi-tenant isolation verified; cross-tenant data leaks impossible.
- [ ] Server sessions cryptographically hashed with SHA-256 in storage.
- [ ] IDOR / BOLA defenses verified across all 18 lifecycle stages.
- [ ] Double-entry General Ledger debits strictly equal credits.
- [ ] Legal hold unconditionally overrides automated document purging.
- [ ] Centralized PII and log redaction active.
- [ ] Production API errors sanitized with unique correlation IDs.

---

## 6. Operational & Provider Readiness
- [ ] `GET /api/health` verified operational.
- [ ] `GET /api/readiness` reports `DATABASE_READY` when connected.
- [ ] `GET /api/provider-readiness` accurately identifies uncommissioned external services.
- [ ] Backup PITR procedure verified and documented.
- [ ] Rollback procedures documented in `docs/PRODUCTION_DEPLOYMENT.md`.

---

## 7. Non-Destructive Smoke Test
- [ ] Smoke test executed against target deployment:
  ```bash
  node scripts/production-smoke-test.mjs <TARGET_URL>
  ```
- [ ] All 6 non-destructive checks passed.

---

## 8. Human Release Authorization Sign-Off
- **Lead DevOps Engineer:** ____________________  Date: ____________
- **Principal Reviewer (Elena Rostova, CPA):** ____________________  Date: ____________
- **Founder & CEO (Desmond Hinds):** ____________________  Date: ____________
