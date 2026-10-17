# Phase 14 — platform matrix and release-candidate status

**STAGING: NO-GO. PRODUCTION: NO-GO.** Branch `claude/taxguard-phase14-full-platform-development` from
`origin/main` `f638a79` (PR #18 and PR #21 merged; PR #20 open, not merged and not copied here). Nothing was
deployed, no migration was applied anywhere external, and production Supabase was not accessed.

Status columns: **SRC** implemented in source · **LOCAL** locally validated (synthetic data, disposable
PostgreSQL, browser E2E) · **STG** staging validated · **PROD** production commissioned. No row is STG or PROD.

## 1. Audit method

Evidence-based, not a re-inventory: the Phase 12 feature-gap matrix (`phase12-feature-gap-matrix.md`), the
Phase 13A contract register, the Phase 13B report and the frontend reachability audit
(`scripts/frontend/reachability-audit.mjs`) on current main, with targeted source checks of every finding that
could mean "the UI claims something the backend cannot deliver".

| Reachability finding (current main) | Result |
| --- | --- |
| 9 `BUTTON_WITHOUT_HANDLER` | All are implicit submit buttons inside forms with `onSubmit` handlers (audit false positives). No dead controls |
| 32 `LEGACY_IN_MEMORY_API` | Legacy onboarding/documents/integrations/careers/admin calls. Checked the two riskiest: accounting `connect` records `pending_auth` only and `sync` answers 503 (no fabricated QuickBooks/Xero connection); `impersonate` is refused and audited. Production (`productionApp.ts`) does not mount these routes |
| 24 `RANDOM_VALUE` | Idempotency keys and request IDs, not fabricated data |
| 93 `HARDCODED_PERSON` | Public marketing/founder content and intake seed fixtures |

## 2. Module matrix

| # | Module | SRC | LOCAL | Boundary / blocker |
| --- | --- | --- | --- | --- |
| 1 | Public website | YES | YES | Live site is the 2026-10-07 build (see §4) |
| 2–3 | Client / staff authentication, MFA, sessions, recovery | YES | YES (unit, PostgreSQL, provider-emulator E2E) | Real non-production provider commissioning (E03) |
| 4–5 | Client / staff onboarding | YES (durable status; dossier deferred) | YES | Provider commissioning |
| 6–11 | Client dashboard; manager, accountant, reviewer, bookkeeper, administrator workspaces | YES | YES | PR #20 (session isolation, notices, replacement UX) pending review |
| 12–14 | Consultation intake, appointments, rooms | YES (no video/calendar provider) | YES | Calendar/video commissioning; retention policy |
| 15–16 | Messaging, notifications, preferences | YES (in-app only) | YES | E-mail/SMS commissioning |
| 17–18 | Clients, engagements | YES | YES | — |
| 19–20 | Document vault, requests, review, C9 redaction | YES | YES | Private storage and malware scanner commissioning; retention policy |
| 21–22 | Ledger, period controls, reconciliation, book-to-tax | YES (exact decimal) | YES (incl. concurrency DB tests) | No bank/accounting feed commissioned |
| 23 | Billing and receivables | YES (sandbox-only payments) | YES | Live processor, sales-tax, delivery and refund policies |
| 24 | Legal coordination | YES (tracking only) | YES | Referral authority decision |
| 25 | Tax case workflow | Stages 01–08 gated; 09–18 blocked | YES | Approved rule content, practitioner authority, signature/filing providers |
| 26 | Tax engine | Framework only; no tax content | YES | Professional approval of any rule set |
| 27–28 | AI Control Center / orchestration | YES (A00, A10, A34 bounded, read-only) | YES | All 61 agents uncommissioned; AI-16 blocked |
| 29 | Security and auditing | YES | YES | External log/alert custody |
| 30 | Migration and recovery tooling | YES | YES (logical); physical NOT RUN (§3) | Owner migration approval; `pg_dump`/`pg_restore` tools |
| 31 | External providers | Adapters fail closed | YES | Every provider uncommissioned |
| 32 | Hosted operations | Offline preparation | n/a | Isolated staging project, hosts, secrets, approval |

## 3. Work delivered in Phase 14

- **NOT VALID constraint review (Block 15).** `scripts/staging/not-valid-review.mjs` turns each catalog
  constraint definition into a read-only violation-count query (CHECK: rows where the expression is FALSE;
  composite FOREIGN KEY: MATCH SIMPLE anti-join). `npm run staging:not-valid:review` composes the canonical plan
  on a disposable loopback server, proves every query runs, and writes
  [`not-valid-constraint-review.md`](not-valid-constraint-review.md) with the exact query, the approval steps
  and the `VALIDATE CONSTRAINT` statement for each of the **13** constraints; `--check` fails on drift. It accepts
  no target, refuses ambient Supabase/libpq settings and exits non-zero on failure. Tests
  (`src/tests-db/notValidReview.db.test.ts`) prove the counts equal PostgreSQL's own `VALIDATE` verdict on
  synthetic violating rows and that the committed sheet matches the composed schema.
- **Physical backup (Block 16).** `npm run staging:backup:local` correctly refuses with
  `BACKUP_TOOLS_REQUIRED` (exit 2): the bundled PostgreSQL 17 contains the server only, not `pg_dump` or
  `pg_restore`. Physical restore acceptance is **NOT RUN**. Prerequisite: install PostgreSQL 17 client tools and
  set `TAXGUARD_PG_DUMP_BIN` / `TAXGUARD_PG_RESTORE_BIN` (owner approval needed to download software). Logical
  recovery passes (145 tables, 7,193 synthetic rows).
- **AI workforce (Block 11).** No agent newly mapped. The canonical architecture records that named
  responsibilities do not establish executable scope; per-agent stages, tools and data permissions are undefined
  for every agent except A00, A10 and A34. Defining them is an owner decision.

- **Error confidentiality (Block 14).** The production-mounted stage workflow API
  (`/api/stage-two-three`, `/api/stage-workflow`) returned `err.message` for every caught error, including
  unexpected 500s, so database, provider or engine exception text could reach any authenticated caller. Authority
  refusals now keep their code and status; other errors return `STAGE_WORKFLOW_UNAVAILABLE` and are logged by error
  class only. A regression test fails against the previous handlers. Other production routers were checked: the
  durable ledger, billing and identity stores already map database errors to fixed codes. The
  `/gates/stage-{2,3}/evaluate` endpoints are stateless calculators over caller-supplied booleans with no persistence
  and no frontend consumer; real transitions evaluate server-derived snapshots (`serverStageGateOrchestrator.ts`).
  They are recorded as removal candidates, not changed.
- **Session-bridge abuse throttling (Block 14).** `POST /api/auth/supabase-session` (production) made an
  outbound identity-provider call for every request with no limit and accepted any token length. Failed
  verifications are now counted per client address (`AuthFailureLimiter`, 20 per minute, bounded memory; client
  address comes from the configured proxy hops). Once blocked, the address receives 429 with `Retry-After` before
  any provider call; successful sign-ins never count, so ordinary sign-in bursts are unaffected. Tokens over 16 KiB
  are refused without a provider call. In-process only: a multi-instance deployment additionally needs an edge or
  shared limiter (recorded as a staging requirement). Tests: `sessionVerificationThrottle.test.ts` (removing the
  pre-provider block fails two of them).

- **Invoice documents (Block 8, Priority 2).** `GET /api/billing/clients/:clientId/invoices/:invoiceId/document`
  returns a PDF for an issued invoice (ISSUED, PARTIALLY_PAID, PAID, PAST_DUE; VOID marked "not payable"); drafts
  and pending invoices are refused (`INVOICE_DOCUMENT_NOT_ISSUED`). It reuses the authorized invoice list (client
  ownership and tenant checks) and renders only the client allow-listed fields for every caller, so preparer,
  approver and internal review notes never appear even in a staff download. Amounts must be exact two-decimal
  strings (no rounding); text is restricted to printable ASCII and escaped. The PDF is generated on request, never
  stored, e-mailed or delivered, and states that it is not a receipt. Client Invoices and the staff billing
  workspace gained download actions. Self-contained PDF 1.4 writer (`invoiceDocument.ts`, no new dependency).
  Tests: renderer unit tests (escaping, refusals, pagination with verified cross-reference offsets), HTTP tests
  over the real billing store (authorized client and staff, draft refused, other client / other tenant / malformed
  id refused, no staff-only text; removing the issued-status gate fails them), browser download of the paid invoice.

## 4. Live staff sign-in (Block 3), from authorized read-only sources

The public site at artaxserv.com is served by the manual `deploy-pages.yml` workflow. Its last successful run
(#94) deployed `8e4735f` (2026-10-07), **124 commits behind current main**, before staff MFA (AAL2), the hardened
Supabase session bridge, durable staff identity and Phases 12–13. The latest attempt (#96, PR #5 merge,
2026-10-10) failed. The live site therefore cannot exercise current source, and the API host was last observed
unresponsive (2026-10-12). Prerequisites for a working staff sign-in, all requiring authorization: a fresh build
of current main with the `VITE_*` variables; a running API host; the identity proposals applied to the target
database; staff identities with verified TOTP factors. No credential was used and no production system touched.

## 5. Outstanding owner decisions

Per-agent AI responsibilities and permissions; migration approval and NOT VALID validation windows; backup-tool
installation; staging infrastructure (isolated Supabase project, API/frontend hosts, secrets); provider
commissioning (identity/MFA, storage, scanner, e-mail/SMS, calendar/video, payments, signature, filing);
retention, consent and legal-referral policies; tax rule-set and practitioner approvals; PR #20 review.
