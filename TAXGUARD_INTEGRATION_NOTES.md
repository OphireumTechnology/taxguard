# TaxGuard AI — Release Integration & Collision Notes
**Organization:** A/R Tax Services LLC  
**Target Repository:** `OphireumTechnology/taxguard`  
**Release Identifier:** `TAXGUARD-AI-2026.10.02-RELEASE-CANDIDATE`  
**Date:** 2026-10-02  

---

## 1. Executive Integration Overview

This document provides definitive guidance for engineers integrating the cumulative AI Studio milestones (`Bookkeeping Development`, `Practice Operations Development`, `Release Candidate Hardening`, and `Latest Production Hardening`) into the authoritative TaxGuard Git repository (`OphireumTechnology/taxguard`).

The authoritative repository must verify all invariants before merging:
1. `npm run typecheck` (or `tsc --noEmit`) must report 0 diagnostic errors.
2. `npx vitest run` must pass all test files with 0 failures.
3. `npm run build` must build cleanly without bundle breakages.
4. Non-destructive smoke verification (`node scripts/production-smoke-test.mjs`) must verify public and API boundaries without mutating data.

---

## 2. Migration Integration Notes (Exact Chronological Order)

The following database migrations must be reviewed in exact chronological order. Statuses are determined strictly based on evidence within the AI Studio development tree. **No migration is claimed to have been applied to production.**

| Migration Filename | Classification | Subsystem / Purpose | Dependencies |
| :--- | :--- | :--- | :--- |
| `20260928000000_taxguard_core_schema.sql` | `EXISTING_BASELINE` | Core multi-tenant hierarchy (`taxguard_tenants`, `taxguard_members`, `taxguard_clients`, `taxguard_engagements`, `taxguard_cases`, documents, sessions, RLS). | None (Base) |
| `20260929000000_taxguard_complete_lifecycle_schema.sql` | `STATUS_UNKNOWN` | Establishes the 18 canonical lifecycle state tables, stage gates, audit trails, and transition authority. | Relies on `taxguard_cases` and `taxguard_tenants`. |
| `20260930000000_taxguard_bookkeeping_schema.sql` | `NEW_REQUIRED` | Double-entry general ledger, chart of accounts, bank reconciliations, and book-to-tax bridge tables. | Relies on core client and engagement tables. |
| `20261001000000_taxguard_practice_operations_schema.sql` | `NEW_REQUIRED` | Durable job queue, practice tasks, staff assignment, escalations, communications, invoices, and retention policies. | Relies on core tenant and member tables. |

### Migration Execution Directives:
- **Do not rewrite previously applied migrations.**
- Execute migrations sequentially using the Supabase CLI (`supabase db push`) or via migration runner against target database instances.
- Ensure `pgcrypto` and `uuid-ossp` extensions are permitted in the target database.
- Verify RLS policies are enabled on all newly created tables.

---

## 3. High-Risk Collision Files & Merge Guidance

The following files represent high-touch areas where concurrent development or divergent branches may cause merge collisions. For each file, the required current behavior, security invariants, persistence invariants, and protecting test suites are detailed below.

### 1. `server.ts`
- **Required Current Behavior:**
  - Full-stack Express server listening on `process.env.PORT || 3000`.
  - In development (`NODE_ENV !== 'production'`), mounts Vite in middleware mode.
  - In production, serves static assets from `dist/` and handles SPA client routing.
  - Mounts all API route routers: `/api/auth`, `/api/case-authority`, `/api/bookkeeping`, `/api/practice-operations`, `/api/monitoring`.
  - Implements SIGTERM and SIGINT listeners executing bounded (10s) graceful worker drain before closing HTTP listener.
  - Registers centralized API error handling middleware that sanitizes internal database and stack details, attaching correlation IDs.
- **Security Invariants:**
  - Never exposes database connection strings, service role keys, or stack traces in error responses.
  - Never bypasses authentication on protected `/api/*` endpoints.
- **Persistence Invariants:**
  - Durable job worker ceases claiming new work upon shutdown signal, releasing or completing in-flight jobs.
- **Protecting Tests:**
  - `src/tests/productionReleaseHardeningSuite.test.ts`
  - `src/tests/taxGuardProductionHardening.test.ts`
  - `tests/monitoring.test.ts`

### 2. `package.json` & `package-lock.json`
- **Required Current Behavior:**
  - Node.js 22 runtime target with npm package management.
  - Scripts: `"dev": "tsx server.ts"`, `"build": "vite build && esbuild server.ts ..."`, `"test": "vitest run"`, `"lint": "tsc --noEmit"`.
- **Security Invariants:**
  - No vulnerable legacy dependencies.
  - No client-exposed secrets or build-time leakages.
- **Protecting Tests:**
  - `compile_applet` / `npm run build`
  - `lint_applet` / `tsc --noEmit`

### 3. `.env.example`
- **Required Current Behavior:**
  - Organized strictly into categories:
    - `# REQUIRED PRODUCTION CONFIGURATION`
    - `# OPTIONAL / PROVIDER-DEPENDENT`
    - `# LOCAL DEVELOPMENT / TESTING ONLY`
- **Security Invariants:**
  - Strictly zero real secrets or production passwords in the template.
- **Protecting Tests:**
  - `scripts/verify-production-config.ts`
  - `src/tests/productionReleaseHardeningSuite.test.ts`

### 4. `src/server/productionApp.ts`
- **Required Current Behavior:**
  - Configures security headers (Helmet / CSP), JSON body parsing, CORS allowlisting.
  - Stripe webhook raw body handling must occur prior to global JSON body parsing where applicable.
- **Security Invariants:**
  - Disallows unauthorized cross-origin requests on authenticated endpoints.
  - Strips PII from server request logging.
- **Protecting Tests:**
  - `tests/taxguard-compliance-and-security.test.ts`
  - `src/tests/deploymentCandidateIntegrationAndSecurity.test.ts`

### 5. `src/server/taxguard/authority.repository.ts` (Shared Auth & Tenant Scope)
- **Required Current Behavior:**
  - Enforces tenant isolation across all database operations.
  - Sanitizes `tenantId`, `clientId`, and `engagementId` to prevent path traversal and SQL injection.
- **Security Invariants:**
  - Cross-tenant and cross-client access attempts must fail closed (HTTP 401/403).
- **Persistence Invariants:**
  - Operations must be strictly scoped to the active tenant schema/table partitioning.
- **Protecting Tests:**
  - `src/tests/taxGuardProductionHardening.test.ts`
  - `src/tests/liveWorkflowGateAuthority.test.ts`

### 6. `src/server/taxguard/bookkeeping/accountingSync.service.ts` (Accounting Sync & Gate)
- **Required Current Behavior:**
  - Governs external ledger write-backs to QuickBooks Online (QBO) and Xero.
  - Strictly requires explicit `CONFIRM_WRITE_TO_LEDGER` confirmation before initiating sync.
- **Security Invariants:**
  - Provider writes cannot be triggered automatically or by advisory AI.
  - Uncommissioned providers must report `PROVIDER_COMMISSIONING_REQUIRED` rather than mocking success.
- **Protecting Tests:**
  - `src/tests/taxGuardBookkeepingEngine.test.ts`

### 7. `src/components/admin/PracticeAdminWorkspace.tsx`
- **Required Current Behavior:**
  - Practitioner and practice administrative workspace providing live operational tabs: Caseload & Tasks, Billing & Invoicing, Communications, System Health & Readiness, and Retention & Legal Hold.
- **Security Invariants:**
  - UI permissions restricted to authorized practice administrator roles.
  - Sensitive client SSNs/TINs remain masked in the UI.
- **Protecting Tests:**
  - `src/tests/unifiedWorkflowAndRoleWorkspaces.test.ts`
  - `src/tests/taxGuardPracticeOperations.test.ts`

### 8. `src/server/taxguard/operations/dataRetentionRecovery.service.ts`
- **Required Current Behavior:**
  - Policy-driven retention management based on firm configuration and jurisdiction rules rather than rigid hardcoded assumptions.
  - Active legal hold strictly overrides scheduled or automated purging.
  - Legal holds can only be released by authorized compliance officers with audited rationale.
- **Security Invariants:**
  - Tamper-evident checksum validation for archived records.
- **Protecting Tests:**
  - `src/tests/productionReleaseHardeningSuite.test.ts`
  - `src/tests/taxGuardPracticeOperations.test.ts`

---

## 4. Controlled Merge Procedure

1. **Fetch and Branch:**
   ```bash
   git checkout main
   git checkout -b feature/taxguard-release-integration
   ```
2. **Apply Integration Package:**
   Extract `taxguard-authoritative-integration.zip` over the workspace root:
   ```bash
   unzip -o taxguard-authoritative-integration.zip
   ```
3. **Verify Git Status and Diff:**
   ```bash
   git status
   git diff --check
   ```
4. **Execute Verification Gate:**
   ```bash
   npm run typecheck
   npx vitest run
   npm run build
   ```
5. **Run Non-Destructive Smoke Test:**
   ```bash
   node scripts/production-smoke-test.mjs
   ```
6. **Commit & Open Pull Request:**
   Submit PR with the completed `TAXGUARD_FINAL_RELEASE_MANIFEST.txt` attached as the release audit trail.
