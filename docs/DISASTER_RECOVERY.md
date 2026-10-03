# TaxGuard AI — Disaster Recovery & Continuity Plan
**Firm:** A/R Tax Services, LLC  
**Application:** TaxGuard AI Operations Engine  
**Classification:** Confidential — Internal Practice Operations Only  

---

## 1. Overview & Objectives
This Disaster Recovery Plan establishes authoritative protocols for mitigating, isolating, and recovering from infrastructure outages, provider degradations, and operational failures without sacrificing taxpayer data integrity, auditability, or regulatory compliance.

**Key Operating Principles:**
- **Fail Closed:** If security boundaries, authorization, or identity verification are uncertain, all mutations are rejected.
- **Data Preservation Over Speed:** Financial, accounting, and legal records are never purged or forcibly rolled back without certified forensic verification.
- **Provider Isolation:** External provider outages never corrupt internal ledgers or advance unverified tax workflow stages.

---

## 2. Infrastructure Incident Protocols

### 2.1 Relational Database Outage (PostgreSQL / Supabase)
- **Impact:** Authentication, case state retrieval, and General Ledger writes are unavailable.
- **Response:**
  1. Automated health check (`/api/readiness`) transitions to `503 Service Unavailable` with `schema: DATABASE_UNAVAILABLE`.
  2. Public website continues serving static informational assets.
  3. Active background workers halt job claiming immediately.
  4. Point-in-time recovery (PITR) initiated via Supabase management console.
  5. Post-restore verification script executed: `node scripts/verify-post-restore.mjs`.

### 2.2 Storage Outage (Encrypted Document Vault)
- **Impact:** Client document uploads and workpaper downloads fail.
- **Response:**
  1. Document ingestion pipeline rejects new uploads with `STORAGE_UNAVAILABLE` rather than storing unencrypted or temporary files.
  2. In-flight OCR extraction waits for vault reconnection.
  3. Read-only cached document metadata remains accessible in the client portal.

### 2.3 Application Server Crash / Outage (Render / Node.js)
- **Impact:** Web and API requests fail.
- **Response:**
  1. Render automated health check restarts the container.
  2. `server.ts` graceful startup initializes tenant bootstrap idempotently without duplicating seed records.
  3. Worker leases that expired during container downtime are reclaimed by the recovered process.

### 2.4 Failed Deployment / Corrupted Build
- **Impact:** New code fails health checks or introduces runtime regressions.
- **Response:**
  1. Rollback immediately to the previous immutable release bundle or Git commit tag.
  2. Do not run ad-hoc shell commands on live production.
  3. Execute `node scripts/production-smoke-test.mjs` against the rolled-back deployment.

### 2.5 Bad Database Migration
- **Impact:** Migration script introduced schema discrepancy or locked tables.
- **Response:**
  1. Never run destructive `DROP TABLE` or `ROLLBACK` on live data.
  2. Author a forward-fixing migration (e.g., `20261002000000_fix_*.sql`) ensuring idempotent, backward-compatible DDL.
  3. Apply forward migration through approved release pipeline.

### 2.6 Background Worker Crash & Stale Leases
- **Impact:** Worker crashes mid-execution while holding a job claim.
- **Response:**
  1. The `DurableJobQueueService` maintains a 300-second lease window (`lockedAt`).
  2. After 300 seconds, the expired lease allows peer workers or restart instances to claim the job automatically.
  3. Crash recovery is bounded by `maxAttempts` (default: 5) to prevent infinite poison-pill execution.

### 2.7 Job Backlog Congestion
- **Impact:** Heavy document OCR or bulk transaction categorizations delay queue processing.
- **Response:**
  1. Jobs are prioritized: Priority 1 (interactive client documents) processes before Priority 5 (nightly batch reconciliation).
  2. Admin inspection via `getDeadLetterJobs(tenantId)` isolates stalled tasks.

---

## 3. External Integration Outage Protocols

| Provider / Channel | Failure State | System Behavior | Recovery Action |
| :--- | :--- | :--- | :--- |
| **OpenAI AI Reasoning** | Outage / 429 / 5xx | AI proposal features return `TAXGUARD_AI_UNAVAILABLE`. Deterministic tax engines and human review workflows operate normally. | No failover to unapproved LLMs. Human preparers manually prepare checklists. |
| **Malware Scanner** | Daemon offline | Document ingestion marks files as `QUARANTINED` / `SECURITY_REVIEW_REQUIRED`. Clean status is NEVER fabricated. | Preparer awaits scanner recovery or routes to secure quarantine bucket. |
| **Document OCR** | Vision API down | Documents remain saved in quarantine vault; OCR status remains `PENDING_RETRY`. | Background job retries OCR with exponential backoff and jitter. |
| **QuickBooks Online** | Intuit API outage | Sync state flagged as `SYNC_FAILED`. Client and preparer workspaces display last successful sync timestamp. | Rescheduled sync via durable queue; zero unverified write-backs. |
| **Xero Accounting** | Xero API 503 | Sync state flagged as `SYNC_FAILED`. | Exponential retry with durable idempotency key. |
| **Stripe / Payments** | Webhook timeout | Invoices remain in `UNPAID` or `PENDING_CONFIRMATION` state. Browser redirect is NEVER treated as payment proof. | Stripe webhook replay will idempotently mark invoice `PAID` upon signature verification. |
| **Email / SMS** | SendGrid / Twilio down | Notifications logged to database `taxguard_notifications` and visible in in-app notification center. | External delivery marked `DISPATCH_PENDING`; retried when gateway returns. |
| **E-Signature Provider** | DocuSign offline | Stage 11 remains locked in `WAITING_FOR_SIGNATURES`. No signature is fabricated. | Manual Form 8879 wet ink upload accepted through Stage 02/03 verified pipeline. |
| **IRS MeF / State Filing** | MeF Gateway offline | Stage 12 remains blocked in `TRANSMISSION_QUEUED`. | Transmission holds until official MeF transmitter gateway issues submission ID and timestamp. |

---

## 4. Disaster Recovery Team Roles
- **Incident Commander:** Senior Managing Partner (Desmond Hinds)
- **Lead System Engineer:** Practice DevOps / System Architect
- **Quality & Compliance Reviewer:** Elena Rostova, CPA
- **Client Communications Officer:** Practice Operations Director
