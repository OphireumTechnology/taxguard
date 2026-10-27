# TaxGuard AI — Master Production Release Gate Checklist
**Firm:** A/R Tax Services, LLC  
**Application:** TaxGuard AI Operations Engine  
**Classification:** Authoritative Release Sign-Off  
**Revised:** 2026-10-27 (Phase 14). Supersedes the 1.0.0-RC1 checklist, which no longer described the code.

**Current status: staging NO-GO, production NO-GO.** Every box below is open. Evidence and blockers:
`docs/development/production-readiness-assessment.md`; the staging order of work: `docs/development/staging-readiness.md`.
A box is ticked only with a recorded result (command output, report file or a named approver and date), never on the
basis of a local synthetic test alone. Staging is accepted before any production box is attempted.

---

## 1. Source and repository
- [ ] The release commit is on `main`, reached through a reviewed pull request; the working tree is clean.
- [ ] `npm run security:secrets` reports `PASS` with no findings; no `.env` file is tracked.
- [ ] `docs/development/architecture-implementation-register.json` and `docs/taxguard-master-traceability.json` are
  rebuilt for the release commit (`node scripts/build-local-traceability.mjs`) and their tests pass.

## 2. Database and migrations
- [ ] The owner has approved every file in `docs/development/migration-execution-manifest.json` (13 core migrations,
  73 proposals and the separate append-only audit proposal), in manifest order, with Codex review of the Phase 14
  scoping proposals (`phase14-proposal-review-dossier.md`).
- [ ] `npm run staging:migration:release-candidate` reports `PASS` on disposable loopback PostgreSQL for the release commit.
- [ ] `npm run staging:not-valid:review -- --check` passes, and the owner has set a validation window for each of the
  13 NOT VALID constraints (`not-valid-constraint-review.md`).
- [ ] Migrations were applied to staging first, restore-first and one transaction per file, and the staging schema
  fingerprint matches the release candidate.
- [ ] The protected production project `cvrlhixxczerytiocxid` is changed only after staging acceptance and with the
  owner's explicit approval for that step.

## 3. Environment and configuration
- [ ] `scripts/staging/check-staging-config.ts --config-file <file>` reports `READY_FOR_OWNER_REVIEW` for the target
  environment, and the owner confirmed its MANUAL areas (storage, monitoring, backup).
- [ ] Secrets live in a managed store per environment; no value is shared between staging and production.
- [ ] No development shortcut is active: no in-memory authority, no local AI-governance database, no test handlers,
  no sandbox-only setting outside sandbox.

## 4. Automated verification for the release commit
- [ ] `npm run typecheck` and `npm run lint`: 0 errors.
- [ ] `npx vitest run`: every file passes, nothing skipped (6051 tests in 369 files at the Phase 14 checkpoint).
- [ ] `npm run test:db`: every file passes on disposable PostgreSQL.
- [ ] `npm run test:e2e` with `E2E_PROFILES=default` and `E2E_PROFILES=provider`: every suite passes.
- [ ] `npm run build` produces `dist/` and `build/server.cjs`.
- [ ] CI is green on the release commit.

## 5. Security and isolation
- [ ] Tenant, client, engagement and tax-year isolation is re-run against staging with a second synthetic tenant.
- [ ] Staff MFA (AAL2), recovery and recent sign-in are validated against the real identity provider in staging.
- [ ] A header-capable edge sends HSTS and framing protection (open item in `production-route-parity.md`).
- [ ] A malware scanner is commissioned; an EICAR sample stays quarantined; nothing is released unscanned.
- [ ] Staff-access rate limits and the reverse-proxy hop count are set by owner decision.

## 6. Professional, legal and policy approvals
- [ ] IRC § 7216 consent wording approved by counsel or a qualified practitioner; the approved version is recorded.
- [ ] A materiality policy is approved by someone other than its author, or the owner confirms that every case goes to
  human review.
- [ ] Approved federal and state rule content exists, with practitioner verification cases, for each stage the practice
  will use (stages 09-18 stay blocked otherwise).
- [ ] Retention schedules (consultation, security events, audit custody) are approved.
- [ ] Live payments, e-signature, e-filing and each AI agent stay disabled unless separately approved; no agent is
  commissioned without a per-agent responsibility matrix and a passed evaluation.

## 7. Operations
- [ ] `GET /api/health` liveness and readiness respond; administrator diagnostics require authentication.
- [ ] Log shipping and alerts (5xx, refused-access spikes, kill-switch changes) are live and tested.
- [ ] Provider backups with point-in-time recovery are on; the RPO and RTO are approved; a restore and the rollback of
  the latest migration were rehearsed on staging (`backup-restore-runbook.md`).
- [ ] The non-destructive smoke test passes against the target: `node scripts/production-smoke-test.mjs <TARGET_URL>`.

---

## 8. Human Release Authorization Sign-Off
- **Lead DevOps Engineer:** ____________________  Date: ____________
- **Principal Reviewer (Elena Rostova, CPA):** ____________________  Date: ____________
- **Founder & CEO (Desmond Hinds):** ____________________  Date: ____________
