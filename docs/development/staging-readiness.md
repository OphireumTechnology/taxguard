# Staging-readiness assessment (2026-10-13)

**Status: NOT READY for staging.** Nothing has been deployed and no migration has been applied
anywhere. Production remains NO-GO. Each item lists what exists and what blocks it.

| Area | State | Blocking items |
|---|---|---|
| Isolated non-production Supabase project | none configured | owner must provision a separate project (never `cvrlhixxczerytiocxid`); guards refuse the protected project everywhere |
| Synthetic-only data | all tests and E2E use generated synthetic users and records; durable deployments no longer load demonstration seed | seed script for a staging tenant with synthetic records |
| Migration review and ordering | 13 core migrations + 29 proposals (000–011, 023–039); composition, idempotent re-apply and security invariants verified on PGlite and real PostgreSQL 15+ | human review and approval of each proposal; 010/011 must precede 034/037 (name order); NOT VALID constraints need validation after data review |
| Staff authentication and MFA | provider AAL2 sessions, recent-sign-in, invitations, recovery — verified against the loopback emulator | real-provider validation run (blocked on the project); rate limit policy decision (20/min per address) |
| Client authentication | local password + TOTP and provider paths exist | provider configuration for clients in the staging project |
| Tenant isolation | enforced in every proposal function; cross-tenant tests in unit, DB and E2E suites | deployment-level single-tenant configuration (`TAXGUARD_TENANT_ID`) per environment |
| Document storage and quarantine | private bucket, write-once objects, scan-required release (027) | real malware scanner transport (none installed; documents stay quarantined) |
| AI provider commissioning | gateway and kill switches; no provider | provider choice, keys in a secret store, budget/pricing approval, AI-16 decision |
| Billing sandbox | invoices, approvals and sandbox-only payments (028) | no live payments by design |
| Observability and audit | `taxguard_audit_log` rows for every material change; health endpoint | log shipping, alerting, durable audit viewer for administrators |
| Rollback and recovery | rollback notes in each proposal (development) | tested backup/restore and rollback runbook on the staging database |
| Deployment configuration | GitHub Pages deploy is `workflow_dispatch` on `main` only; durable routers off unless explicitly configured | separate staging workflow and environment, server hosting for the API |
| Production isolation | protected-project guards in browser config, server, MFA adapter, validation tooling; production refuses development routers | keep until staging is signed off |

Remaining in-memory workflows (appointments, administrator views, legal records, integrations) are
listed in `durable-workflow-inventory.md`; they must be durable or disabled before staging.
