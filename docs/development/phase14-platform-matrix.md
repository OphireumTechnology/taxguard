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

- **Stage 03 evidence (Block 9, Priority 3).** Proposal `20261018000000_taxguard_case_validate_replacement_evidence.sql`
  (not applied) adds the server-derived check `noOutstandingReplacementRequests` to stage 03 (Validate): a case could
  previously move to Record while the latest version of a document for the engagement year was
  `REPLACEMENT_REQUESTED`. Only the latest version per document counts (an uploaded replacement clears it once
  reviewed); rejected documents are final and do not block. The function stays closed to every API role. The
  existing stage 02/03 test exposed the defect (a requested replacement was never uploaded, yet Validate passed) and
  now uploads and reviews the replacement before stage 03 passes. Included in execution order, manifests,
  composition and idempotent re-apply checks. The browser case suite (03) now proves the gate on the real server:
  when an earlier suite leaves a requested replacement outstanding, Validate is refused with
  `noOutstandingReplacementRequests`; the client uploads the replacement, it is scanned CLEAN and reviewed, and
  Validate then passes.
  SQL boundary tests (`caseValidateReplacementEvidence.test.ts`, 6): an uploaded replacement alone does not clear
  Validate (it must be scanned, then reviewed; a refused replacement keeps it blocked); superseded versions and final
  rejections do not block; another client, engagement or tax year neither blocks nor unlocks the case (including a
  same-ID later version under another client); stage 2 and other stages are unchanged; no API role may call the
  function. Removing the client match from the later-version lookup fails them.
- **Journey H in the browser (Block 19).** `provider/12-staff-invitation-journey.e2e.test.ts` (5): an administrator
  issues a one-time invitation in Practice Staff & Roles (token shown for hand-off, nothing sent); a provider sign-in
  for the invited e-mail is refused client auto-provisioning (`STAFF_INVITATION_ACCEPTANCE_REQUIRED`); the invitee
  accepts on the staff portal with mandatory TOTP enrolment and receives no TaxGuard session (no session-bridge call,
  no stored token, single-use invitation); the inviting administrator's activation is refused
  (`STAFF_ACTIVATION_DENIED`); an independent administrator activates in the browser; the new staff member signs in
  with the new authenticator and receives an active accountant session. Before this, invitation acceptance had no
  browser coverage.

- **Refund records (Blocks 8 and B, Priority A).** The proposal-028 refund function had no idempotency (a retried or
  double-submitted request recorded the refund twice, up to the payment amount) and discarded the required reason.
  Proposal `20261018010000_taxguard_billing_refund_records.sql` (not applied) adds an immutable, RLS-enabled
  `taxguard_invoice_refunds` ledger (amount, reason, recorder, idempotency key) and `taxguard_bill_refund_keyed`: the
  same key replays the recorded result, a key reused for a different refund is refused (`IDEMPOTENCY_KEY_REUSED`),
  a missing key is refused, the reason is kept in the record and the audit. The unkeyed function is revoked from
  `service_role`. Refunds remain records of money returned outside TaxGuard; no provider is called. The staff billing
  workspace gained a per-payment "Record refund" control for managers (amount, reason, retry-safe key; the form stays
  open on failure). Tests: HTTP over the real store (replay, key reuse, missing key, stored reason, immutability,
  client refused; removing the replay lookup fails them) and a browser step (manager records the refund in the UI,
  accountant refused, client projection shows the refunded amount but never the reason). The browser test also caught
  a stripped regex escape in the new control before commit.
  Follow-up hardening: the UI key now identifies the refund operation (created when the form opens and reused for its
  retries) rather than the payment/amount/reason combination, so two separately entered identical refunds are two
  operations, while a refused attempt (which records nothing) can be corrected and resubmitted. Real-PostgreSQL tests
  (`src/tests-db/billingRefunds.db.test.ts`, 5): identical separate operations both recorded; retry replays; key reused
  with a different amount refused; four connections submitting one operation produce one record and one result; six
  concurrent distinct operations never exceed the payment (exactly the affordable ones succeed); other tenant, other
  client, accountant and client refused; refund records immutable; audit rows carry the reason and the service role
  cannot update, delete or truncate the audit log; the unkeyed function is closed to the service role. The advisory
  lock is covered behaviourally (the same-key race); a source mutation could not be run because the harness refuses a
  proposal whose checksum no longer matches the review packet. Owner-level append-only enforcement for every audit
  row remains the separate `docs/sql/taxguard-audit-append-only.proposal.sql` decision. Browser: a refused refund keeps
  the form and its values and records nothing; the corrected request for the same operation succeeds.

- **Accounting integrity review (Priority A).** Re-checked the durable ledger SQL (proposal 024): approval re-checks the
  period at posting time (hard-closed refused, soft-closed only through review), closing refuses unapproved entries and
  approval holds a share lock on the period so a concurrent close waits, one reversal per entry (unique index), frozen
  posted fields, maker-checker, idempotent posting and balance enforcement are all in place with HTTP and concurrency
  database tests. No defect found; nothing changed.
- **Journey N on the real server (Block 19).** The production governance wiring only accepted `NODE_ENV=production`
  with a TLS `DATABASE_URL`, so no development environment could compose it. `governanceDatabaseTarget` adds a
  development-only mode: outside production, an explicit loopback `TAXGUARD_AI_GOVERNANCE_LOCAL_DATABASE_URL` (no TLS)
  selects the same SQL store and durable-session verification; production behaviour is unchanged and ignores the local
  setting; remote hosts and other protocols are refused (`governanceDatabaseTarget.test.ts`). The provider E2E profile
  composes it on its own disposable PostgreSQL and seeds one synthetic case assigned to the durable accountant (no
  agent, model, prompt, grant or approval policy). Suite `provider/13-ai-governance-journey` (6): uncommissioned A34 and
  unmapped A11 refused with `AI_AGENT_INACTIVE` on the assigned case; an unassigned case or year refused with
  `AI_CASE_ACCESS_DENIED`; another tenant `AI_TENANT_DENIED`; forged approval/identity fields refused by the schema;
  anonymous and provider tokens refused; an administrator activates an agent kill switch (the accountant cannot,
  `AI_KILL_SWITCH_ROLE_DENIED`) and the agent reports `STOPPED`; the administrator reads exactly the seven policy
  refusals, all `DENIED`, none executed, attributed to the accountant; all 61 agents remain DRAFT or STOPPED with
  material actions BLOCKED. Limits: the kill switch's effect on evaluation is not isolated (inactive agents are
  refused first); a permitted advisory run requires commissioning and is covered only with synthetic state in unit
  suites. A first attempt was discarded because its requests failed schema validation (`AI_INVALID_REQUEST`) and so
  proved nothing about policy; the suite now asserts that no refusal is a schema or availability refusal.

- **Staff accessibility automation (Block 18, Priority 1).** `src/tests-e2e/a11yAudit.ts` is a dependency-free DOM audit
  (unnamed controls, unlabelled fields, duplicate IDs, images without alt text, positive tabindex). Suite
  `16-staff-accessibility` (8, default profile): a self-test proves each rule fires on a synthetic page with planted
  defects and ignores hidden content; practice manager (8 modules), bookkeeper (2), administrator (audit log),
  accountant and reviewer workspaces report no findings; the refund form opens and cancels by keyboard with focus moved
  to the amount field and returned to its trigger (new focus management in the billing workspace); at 375 px the
  modal navigation drawer receives focus, closes on Escape and returns focus to its opener, and the billing workspace
  has no horizontal page scroll. Client navigation and named client controls are covered by PR #20's suite and were not
  duplicated. Automated checks only: **no WCAG conformance is claimed**; manual assistive-technology testing remains.
- **Journeys F and K: rework and billing adjustments (Block 19, Priority 2).** Mapping A–O against the browser suites
  showed that A (12), C (02, 05), D (10, 14), E and L (03, 15), G (02, 03, 12), H (provider 12), I (08, provider 09),
  J (provider 11), M (14, 15), N (provider 13) and O (04, plus refusals in each suite) were covered, but nothing
  exercised a reviewer *returning* work or a billing *adjustment*. Suite `17-billing-rework-credits` (4): a manager
  cannot return a submitted invoice without a note; the return puts it back to draft with the note, and the client
  sees neither the invoice nor the note. The preparer revises it (a rate override with a reason); a stale version is
  refused (`INVOICE_VERSION_CONFLICT`); the preparer cannot approve; a manager approves and it is numbered with both
  lines. A manager requests a credit in the Billing UI and is refused on applying it (`A different manager must approve
  this.`). The preparer cannot decide it; a second manager applies it in the UI, giving total and balance 500.00. A
  second decision, an over-balance credit and a client-requested credit are all refused. The client API and portal show
  the adjusted total, balance and credit amount only, with no reasons, notes or staff identities (journey B is
  covered in the next entry). The client's invoice
  PDF from the real server shows the same subtotal, credit, total and balance and no staff detail (Priority 4: the
  refund path already checks amounts against the ledger fields in suite 02 and `billingRefunds.db`, so no other
  regression was added and no billing code changed).
- **Journey B: new client → identity → onboarding → engagement (Block 20).** Built on the approved durable
  contracts only; no staff client-creation operation was added. A verified provider sign-in with no invitation is
  provisioned as a client by `taxguard_provision_client_identity`. Two defects found and fixed:
  1. *No client could ever self-register on a freshly migrated database.* No migration created the `'primary'`
     row of `taxguard_client_id_sequence`, and the provisioning function (deliberately) refuses a missing counter
     (`CLIENT_COUNTER_CORRUPT`), so the portal showed "authentication service unavailable". Unit fixtures had
     inserted the row by hand. Proposal `20261018020000_taxguard_client_id_sequence_initialize` creates the row
     once and only moves the counter forward to the highest numeric ID already issued; the function's fail-closed
     behaviour for a later-missing or corrupt counter is unchanged (`clientIdSequence.db`, 3). **Backend/PostgreSQL
     change for Codex review**, review-only like every proposal; whether the hosted database already has the row
     is unknown (not accessed).
  2. *The portal collected identity data it could not record.* In durable deployments every Stage 01 onboarding
     route returns `DURABLE_ONBOARDING_PROVIDER_REQUIRED`, yet a new client was shown the full identity wizard
     (TIN, addresses, consent) as a "live" workspace; entries went only to browser storage and submission failed.
     The wizard now asks the server first and, when onboarding is unavailable, shows an explicit notice with no
     form fields and stores no dossier (completed clients keep their read-only review).
  3. *A staff sign-in could create a client account.* Once self-registration worked, an account with no
     membership in this tenant (for example a former employee whose membership row was removed) signing in at the
     **staff** portal was provisioned as a client. Provider suite 09 had only passed because provisioning was
     broken. Owner decision (2026-10-18): self-registration is allowed from the client portal only. The staff page
     now sends `portal: 'staff'` and the server never creates a client for it (`STAFF_MEMBERSHIP_REQUIRED`); the
     value can only restrict, an unknown value is refused (`PORTAL_INVALID`), and existing clients are unaffected.
     Suite 09 keeps its refusal and now also proves no client record is created; a route unit test covers the rest.
  4. *Restoring a provider session on a staff page created a client.* The reload and provider-event restore paths
     sent no portal value. With a provider session still in the browser (for example an interrupted client-portal
     sign-in), opening the staff sign-in page provisioned a client and moved the person into the client portal.
     The restore now carries staff intent on any `/staff` page (`restoredSessionPortal`), so it is refused there
     with no client created. Existing clients still restore, and self-registration from client and public pages
     (including e-mail verification) is unchanged. Reproduced first by a failing provider test.
  Regression cases added after the self-review: `clientProvisioningConcurrency.db` (3) covers eight simultaneous
  first sign-ins of one identity (one client, replay resumes it, no other tenant), 24 concurrent registrations
  with the proposal replayed mid-flight (no shared ID, counter equals the highest issued), and a database with an
  issued client but no counter row (refused until initialized, then resumes after the highest ID; replay is a
  no-op). Provider suite `15-session-restore-intent` (4) covers six simultaneous first sign-ins through the real
  server and two failed provider sign-outs followed by reload: a refused staff sign-in leaves no session and no
  client, and a signed-out client stays signed out with the old session revoked. The installed provider library
  clears its local session even when the network sign-out fails. The suite also covers the restore intent above,
  with negative and positive cases. The counter proposal still needs Codex's independent review and owner
  approval.
  Provider suite `14-new-client-journey` (3): first sign-in provisions exactly one client (server-issued ID), a
  later sign-in resumes it, the client cannot use practice management; Stage 01 stays unavailable and cannot be
  completed with forged gate fields (onboarding status remains `NOT_STARTED`); the portal shows the notice, no
  inputs and no stored dossier; a durable practice manager finds the new client and opens and activates an
  engagement in the UI; the client cannot create one; another tenant's administrator gets no access.
  The local (non-durable) Stage 01 route accepts gate booleans supplied by the browser. It is unreachable on
  durable deployments (503 above) and was not used for the durable design below.
- **Durable Stage 01 onboarding, consent-gated (Block 21, owner decision 2026-10-18).** Proposal
  `20261018030000_taxguard_client_onboarding` (review only) adds a per-client onboarding record and an
  owner-managed table of approved consent versions. No application role, including `service_role`, can read or
  write either table directly.
  - **What the client records:** taxpayer type, legal name, address, a representative for entities, and the TIN
    type with its last four digits only. A full TIN, forged readiness flags and unknown fields are refused.
  - **Submission** requires every section and an IRC § 7216 consent against an approved consent version. The
    consent text fingerprint and the signer are recorded.
  - **Approval** is a practice manager or administrator decision, never the client's. It requires a vault
    `identity` document VERIFIED by staff, a server-computed duplicate check (same last four and legal name)
    that needs an explicit override with a reason, and the consent version still approved.
  - **Approval effect:** it sets the identity's onboarding status to COMPLETED, which the collection API now
    requires before any Stage 02 request from a client (`STAGE_01_NOT_APPROVED`, fail-closed). Seeded E2E
    clients are marked as already onboarded.
  - **Change requests** carry a client-safe reason; internal notes, decider identities and duplicate details
    never reach the client view.
  - **Integrity:** every write is versioned and audited (`ONBOARDING_SUBMITTED`, `_CHANGES_REQUESTED`,
    `_APPROVED`).
  - **UI:** a durable Stage 01 panel in the client portal and an *Onboarding Review* module for managers. The
    capability list opens only those three review endpoints.
  - **Tests:**
    - `clientOnboarding.db` (10): isolation and authorization, full-TIN and flag refusal, the consent gate, the
      identity-document gate, change requests, duplicate override, a retired consent, concurrent decisions and
      saves, and table privileges;
    - `onboardingDurableRouter` (6): API boundary and the Stage 02 gate;
    - provider suite 14 (6): the browser journey to Stage 02 with a SYNTHETIC consent version recorded by a
      keyed test control.

  **Decision notices (Block 24).** A change request or an approval now leaves an in-portal client notice
  (`ONBOARDING_CHANGES_REQUESTED`, `ONBOARDING_APPROVED`; in-app only, no e-mail or SMS). The notice carries a
  generic title only; the reason stays in the onboarding view, and staff identities are never projected. The
  proposal widens the notification kind list without narrowing it, so every existing kind and row stays valid.
  The database test checks exactly one notice per decision, none for other clients, none from the losing
  concurrent decision, and that unknown kinds are still refused. Provider suite 14 checks that the API and the
  portal's notifications list show both notices in plain language without the reason.

  **Case continuity, Stage 01 to Stage 03 (Block 26).** The case workflow's own *Onboard* stage checked only
  client, engagement, year and staffing, so a fully staffed case advanced past Onboard for a client whose Stage
  01 onboarding the practice had never approved. That defect was shown first by `caseOnboardingGate.db`.
  Proposal `20261018030000` now replaces `taxguard_case_system_checks` with proposal 026's function plus one
  Stage 1 check, `clientOnboardingCompleted` (server-recorded completion). All other stages are unchanged, and
  clients see only booleans for Stages 4–8. Provider suite 14 (8) now covers the whole path:
  1. Before approval, a staffed case is refused at Onboard with exactly `clientOnboardingCompleted`.
  2. After approval, the durable preparer completes Onboard.
  3. The client saves a Stage 02 questionnaire in the browser collection workspace.
  4. The preparer cannot attest collection; the independent durable reviewer does.
  5. The reviewer validates Stage 03 and the case reaches Stage 04.

  **Stages 04-08 for the self-registered client (Block 27).** Provider suite 14 (9) now carries journey B to the
  Stage 09 block on durable staff, refusing each gate before its evidence exists:
  - **Record (04):** refused with no posted entry, and again while the bookkeeper's browser entry awaits review.
    The bookkeeper cannot approve; the independent reviewer approves, then Record completes.
  - **Reconcile (05):** refused with no closed reconciliation, and again while one is in progress. Then a
    categorized bank transaction is reviewed and a zero-variance reconciliation is finalized in the browser.
  - **Review (06):** refused without an approved workpaper. The book-to-tax mapping set and workpaper each need
    the reviewer's approval (the preparer cannot approve the workpaper), then the reviewer attests.
  - **Report (07) and Plan (08):** the preparer cannot attest, and an empty checklist is refused.
  - **Stage 09:** stays `STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED`.
  - **Afterwards:** the manager sees stages 1–8 completed. The client's case-stage view shows Stage 09 with no
    figures, staff identities or attestation text.

  Two defects were fixed along the way, both failing first:
  1. *Review could be attested with no workpaper at all.* Proposal `20261018050000_taxguard_case_workpaper_evidence`
     (review only) makes Stage 06 also require an APPROVED book-to-tax workpaper for the case's client, tax year
     and return family; the extension point is `taxguard_case_evidence_checks`. Who attests is unchanged.
     `caseWorkpaperEvidence.db` (3) also checks that draft, rejected and other-year, other-family or
     other-client workpapers are refused. **For owner review:** this adds a recorded-evidence precondition to an
     existing attestation.
  2. *Staff staffed per engagement could not use the durable ledger.* Durable sessions built the client list only
     from client-wide assignments, while practice staffing creates engagement and tax-year assignments. The
     general ledger path also consulted legacy in-memory bindings, so bookkeepers (`BOOKKEEPER_SCOPE_DENIED`) and
     reviewers were refused for a durable client. Owner decision (2026-10-19): an active engagement and year
     assignment grants that client for that tax year only.
     - Durable sessions now attach separate, non-enumerable, frozen scoped grants (`staffScopedGrants.ts`).
     - The bookkeeping routes accept a whole-client grant, or a scoped grant for exactly the explicit requested
       client and tax year. There is no default year.
     - `authorizedClientIds` is never widened. Other routes are unchanged, and the database re-checks every call.
     - `staffScopedGrants.test` (6) covers this, including refusals for another year, no year or another client.
  Not changed, recorded: the practice-manager capability list does not include book-to-tax category setup.
  Firm-wide categories are configured by an administrator, as in suite 03; the suite asserts the manager is
  refused. Other durable routes that rely only on `authorizedClientIds` would refuse per-engagement staff in
  production in the same way. They should adopt `hasClientYearAccess` route by route, with tests.

  **Still blocked:** no consent wording is approved, so no real client can submit. Counsel or a practitioner must
  approve the §7216 wording, purposes, recipients, duration and revocation (`phase11-owner-decisions.md`). The
  owner then records the version in `taxguard_onb_consent_versions` through a reviewed change.
- **Staging validator: local governance database (Block 19, Priority 3).** The development-only
  `TAXGUARD_AI_GOVERNANCE_LOCAL_DATABASE_URL` added for journey N is listed in the staging template's
  development-shortcut section. The offline staging validator refuses it (`DEVELOPMENT_SHORTCUT_DENIED`), with a unit
  case, so a staging configuration cannot carry a loopback governance database even though production code ignores it.

- **C9 client-safe API sweep (Block 22).** Suite `18-client-confidentiality-sweep` (5, default profile) runs
  last, after every other suite has recorded staff-only data: document review notes, internal message notes,
  invoice rework notes, credit and refund reasons, and preparer, approver and decider identities.
  - **What it reads:** with the client's own session it calls every client-reachable read directly:
    - identity and Stage 01;
    - vault documents, including details with `includeInternal=true`, requests, notifications, preferences and
      upload targets;
    - message threads and messages;
    - appointments and rooms;
    - legal matters and portal engagements, case stages and consultations;
    - reassignment requests;
    - invoices, invoice pages and issued invoice PDFs;
    - Stage 02 questionnaire, requirements and requests.
  - **What it scans for:** staff-only field names, staff identities, the planted private texts and
    other-tenant or other-client identifiers.
  - **Proof that it works:** a self-test plants each leak class and checks the scanner catches it. A contrast
    test shows staff sessions do see those notes and identities, so the client result proves withholding rather
    than absence.
  - **Isolation and portal:** other clients, other tenants and staff-only endpoints are refused, and the portal
    views render none of the private text.
  - **Result:** **no leak found.** The existing audience projections hold: document confidentiality (proposal
    20261015030851 and PR #20), the client billing view, the appointment and messaging projections, and Stage 01.
    No projection code was changed, because no defect was demonstrated.
- **Staff sign-out destination (Block 23).** Sign-out chose the return page from a hard-coded role list that
  omitted `practice_manager`, `bookkeeper` and `recruiter`, so a practice manager or bookkeeper signing out of
  the staff workspace landed on the *client* sign-in page. The existing sign-out test used a reviewer and
  accepted any non-staff page, so it could not see this. The rule is now role-agnostic: every non-client account
  returns to `/staff/login`, and client accounts return to `/portal/login`. Suite 01 now signs out the manager,
  bookkeeper, accountant and administrator and checks the exact page and the server-side revocation; the manager
  and bookkeeper cases failed before the fix. The client case is covered by provider suite 15.
- **Invoice transition audit completeness (Block 25).** Every invoice transition was audited with the invoice
  id only. A reviewer's return note lives on the invoice until the preparer resubmits, and submit clears it by
  design, so the reason a checker sent an invoice back for rework was lost entirely. The void reason existed
  only on the mutable row. Proposal `20261018040000_taxguard_billing_transition_audit` (review only) replaces
  `taxguard_bill_transition` with a function identical to proposal 028's except for the audit call. That call
  now records the prior and new status, the note for return and void, and the issued number for approve.
  Authorization, maker-checker, state rules, numbering and projections are unchanged. No Phase 15 branch
  redefines this function. `billingTransitionAudit.db` (3) failed first on the return and void cases. It also
  checks that refused transitions write no audit row and that the client projection carries neither reason.
- **Integration with PR #20 (2026-10-18).** PR #20 merged into `main` (6e31a40). `main` was merged into this
  branch normally (no rebase, no force-push), keeping every Phase 14 commit through 9a11fb6. The only conflict
  was the generated `docs/taxguard-master-traceability.json`, regenerated with the canonical generator.
  `src/services/api.ts` merged automatically: it differs from `main` only by the session `portal` field. PR #20's
  client document, notification and session-isolation changes are kept unchanged. `main` changed no migration, so
  the manifests stayed current.

## 4. Live staff sign-in (Block 3), from authorized read-only sources

The public site at artaxserv.com is served by the manual `deploy-pages.yml` workflow. Its last successful run
(#94) deployed `8e4735f` (2026-10-07), **124 commits behind current main**, before staff MFA (AAL2), the hardened
Supabase session bridge, durable staff identity and Phases 12–13. The latest attempt (#96, PR #5 merge,
2026-10-10) failed. The live site therefore cannot exercise current source, and the API host was last observed
unresponsive (2026-10-12). Prerequisites for a working staff sign-in, all requiring authorization: a fresh build
of current main with the `VITE_*` variables; a running API host; the identity proposals applied to the target
database; staff identities with verified TOTP factors. No credential was used and no production system touched.

## 5. Outstanding owner decisions

**Phase 14 / Phase 15 refund overlap (integration blocker).** Phase 14's `20261018010000` and Codex's Phase 15
`20261019020000` both create `taxguard_invoice_refunds`. Composed together, every Phase 15 keyed refund fails
(`column "result" ... does not exist`), as shown by a disposable PostgreSQL probe. The recommendation is to make
the Phase 15 mechanism canonical and carry the Phase 14 regressions over as its acceptance tests. Evidence and
options are in `phase14-phase15-billing-overlap.md`. Both proposals stay review only, and the branches must not
both merge as they are.

**Audit append-only enforcement (for review, not incorporated).** Within the canonical migration plan only
`SECURITY_*` audit rows are append-only at the database level (proposal 20261015060000); the service role has no
`UPDATE`, `DELETE` or `TRUNCATE` on `taxguard_audit_log` (verified on PostgreSQL), but a database owner can still
change other audit rows. The standalone proposal `docs/sql/taxguard-audit-append-only.proposal.sql` would make every
audit row append-only for the owner as well. It is deliberately not added to the migration plan here: it affects
retention and correction procedures and several test fixtures that clean audit rows, so it needs an owner decision
and its own review.

Per-agent AI responsibilities and permissions; migration approval and NOT VALID validation windows; backup-tool
installation; staging infrastructure (isolated Supabase project, API/frontend hosts, secrets); provider
commissioning (identity/MFA, storage, scanner, e-mail/SMS, calendar/video, payments, signature, filing);
retention, consent and legal-referral policies; tax rule-set and practitioner approvals; PR #20 review.
