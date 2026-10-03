# TaxGuard AI — Production Deployment Runbook
**Firm:** A/R Tax Services, LLC  
**Application:** TaxGuard AI Operations Engine  
**Target Environment:** Render Web Service (Node.js 22 LTS) + Supabase Enterprise (PostgreSQL 16)  

---

## 1. Pre-Deployment Verification

### 1.1 Source Integrity Check
- Ensure working directory is clean of uncommitted debug code or mock test overrides.
- Confirm baseline test suite status:
  ```bash
  npm run typecheck
  npx vitest run
  ```
  *Requirement:* 0 TypeScript errors, 100% test pass rate (>= 1,065 tests).

### 1.2 Migration Chain Review
- Inspect `/supabase/migrations/` in chronological order:
  - `20260928000000_taxguard_core_schema.sql` (Stages 01–09, sessions, audit, RLS)
  - `20260929000000_taxguard_complete_lifecycle_schema.sql` (Stages 10–18, archives, rollover)
  - `20260930000000_taxguard_bookkeeping_schema.sql` (COA, double-entry GL, bank recs)
  - `20261001000000_taxguard_practice_operations_schema.sql` (Jobs, idempotency, tasks, billing)
- Confirm all migrations are forward-compatible and non-destructive.

### 1.3 Environment Contract Validation
- Verify production environment variables against `.env.example`:
  - `NODE_ENV=production`
  - `PORT=3000`
  - `JWT_SECRET` (Cryptographically random, >= 256 bits)
  - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`
  - `TAXGUARD_TENANT_ID=ar-tax-services`
  - `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`
- Run local environment target resolution check:
  ```bash
  npx tsx scripts/verify-production-config.ts
  ```

---

## 2. Build & Packaging Procedure

1. Clean build directory and run production bundling:
   ```bash
   npm run build
   ```
2. Verify build artifacts:
   - Frontend bundle: `dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`
   - Production server: `build/server.cjs`, `build/server.cjs.map`

---

## 3. Database Migration Execution

1. Apply pending SQL migrations to production Supabase project via Supabase CLI or management console:
   ```bash
   supabase db push
   ```
2. Validate post-restore/post-migration schema state:
   ```bash
   node scripts/verify-post-restore.mjs
   ```
   *Requirement:* State must report `DATABASE_READY` with all core tables verified.

---

## 4. Production Service Deployment

1. Deploy the immutable release bundle to Render.
2. Confirm server startup log output:
   - `[A/R Tax Services] Server successfully initialized on port 3000`
   - `[Tenant Bootstrap] Canonical tenant 'ar-tax-services' verified`

---

## 5. Post-Deployment Verification Gate

Execute the non-destructive smoke test suite against the live production URL:
```bash
node scripts/production-smoke-test.mjs https://artaxserv.com
```

### 5.1 Verification Checklist
- [ ] **Public Site:** Homepage, About, Services, Founder bio, and disclaimers render correctly.
- [ ] **Portal Routing:** Clean `/portal` and `#/portals` load the designated Portal Directory.
- [ ] **Health Endpoint:** `GET /api/health` returns `200 OK` with firm metadata.
- [ ] **Readiness Endpoint:** `GET /api/readiness` returns `200 OK` with database and schema `DATABASE_READY`.
- [ ] **Provider Readiness:** `GET /api/provider-readiness` truthfully reports uncommissioned vs active providers.
- [ ] **Auth Boundary:** Protected routes reject unauthenticated requests with `401 Unauthorized`.
- [ ] **Error Redaction:** Arbitrary invalid URLs return structured error responses without leaking stack traces or SQL.

---

## 6. Rollback Decision & Protocol

If any of the following occur during the 30-minute post-deployment monitoring window:
- Server `/api/readiness` fails or reports `503 Service Unavailable`.
- Database queries fail due to unexpected locks or missing relations.
- Client authentication errors spike (> 1%).

### Rollback Steps:
1. Re-deploy the previously verified immutable container build in Render.
2. If forward database schema was added, leave new tables intact (they are non-breaking); do NOT drop tables.
3. Notify the Senior Managing Partner and Lead Engineer.
4. Rerun `node scripts/production-smoke-test.mjs` to confirm successful rollback.
