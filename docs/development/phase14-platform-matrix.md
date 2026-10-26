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

  **Engagement-scoped access at the database boundary, documents and Stage 02 (Block 28).** The document vault and
  Stage 02 collection decided staff visibility per client (`taxguard_practice_can_see`: any active assignment to
  the client). A preparer assigned to one engagement for 2025 could therefore list, read, download, review, queue
  and upload into every engagement and year of that client, and open another engagement's collection.
  - **Fix:** proposal `20261018060000_taxguard_engagement_scoped_access` (review only) adds `taxguard_staff_scope`
    and replaces the current definition of each affected function with an identical copy plus a scope check on
    the record's own engagement and year. The functions are list, detail, download, review (and so review with
    reason), review queue, upload targets, begin upload, verify extraction and collection scope.
  - **Scope rule:** managers and administrators keep full access; a client-wide assignment keeps the whole
    client; an empty engagement or year on an assignment is a wildcard.
  - **Refusals:** they reuse the existing "not found" or "access denied" codes, so an out-of-scope record looks
    missing. A refused download writes no audit row.
  - **Tests:** `engagementScopedAccess.db` (6) failed first on five cases. It covers same client with another
    engagement, same engagement with another year, whole-client and manager access, stale, revoked, other-client
    and other-tenant staff, and immediate effect of revocation.
  - **Execution order:** the current definitions were resolved from the migration execution order, not filenames.
    `clientDocumentConfidentiality.db` caught a first draft built on a superseded `doc_detail`.

  **Tax-year scope of the ledger, book-to-tax and work queue at the database boundary (Block 29, Package B).**
  `taxguard_ledger_actor` admits any staff member with any active assignment to the client. A bookkeeper or
  reviewer assigned for 2025 could therefore read, report on, post into, review, close, reconcile and map every
  other year of the client's ledger and book-to-tax.
  - **Fix:** proposal `20261018070000_taxguard_ledger_year_scope` (review only) adds `taxguard_ledger_year_scope`
    and `taxguard_ledger_year_guard`, and replaces 18 current definitions with identical copies plus a year check.
    Copies were generated by script and diffed against the current definitions, which were resolved from the
    execution order.
    - A year passed in the request is refused with `LEDGER_ACCESS_DENIED`. This covers read, trial balance, work
      queue, open period, start reconciliation, categorize, mapping-set open and overview, and workpaper generation.
    - A record addressed by id whose own year is out of scope is refused with that function's existing not-found
      code. This covers close and reopen period, review entry, set cleared, finalize reconciliation, set mapping,
      review set, review adjustment and review workpaper.
    - History shows a year-scoped actor only events whose entry, period or reconciliation is in scope.
  - **Codex's functions:** an insert trigger checks every new journal entry and book-to-tax adjustment against the
    author's year scope. This covers post entry, reverse entry, categorize and prepare adjustment, and Codex's
    Phase 15 replacements of them, without editing those functions. `taxguard_ledger_actor` is unchanged.
  - **Kept client-level by design:** chart of accounts and bank-feed ingestion, which carry no tax year.
  - **Left for Codex** (`phase14-phase15-billing-overlap.md`): idempotent replays, and the Phase 15
    general-ledger and exact trial-balance reports.
  - **Amended:** the trial balance's "as of" date must fall inside the requested year. Without that, a
    2024-only member received 2025 activity by asking for 2024 "as of" a 2025 date. The case failed first.
  - **Tests:** `ledgerYearScope.db` (9) failed first on five cases. The insert-trigger case was shown to fail with
    the triggers disabled. It also covers managers, administrators and client-wide staff (every year), stale,
    revoked and other-tenant staff, and immediate revocation.

  **Engagement-year scope of document requests (Block 29, Package B).** Document requests also decided staff
  visibility per client. An engagement-year assignee could create, list, attach to, waive, cancel and remind the
  requests of every engagement and year, and saw them in the missing-documents and review queues. Template request
  ids are deterministic, so applying a template to another year replayed that year's requests.
  - **Fix:** proposal `20261018080000_taxguard_document_request_scope` (review only) reuses `taxguard_staff_scope`.
    It covers create and apply-template (both the requested year and a replayed id), list, attach, waive and
    cancel, remind, and the missing-documents and review queues. Refusals reuse `ENGAGEMENT_YEAR_NOT_OPEN` and
    `DOC_REQUEST_NOT_FOUND`.
  - **Client projection:** it now omits a document later rejected as malware unless a client user of that client
    uploaded it, matching the vault list. Clients still reach only their own client, never see cancelled requests,
    and receive no staff identities, template ids, resolution notes or reminder times.
  - **Tests:** `documentRequestScope.db` (7) failed first on every case.

  **Case access follows the live assignment (Block 30).** A case records its preparer and reviewer at creation.
  `taxguard_case_actor`, the queue, status counts, dashboard and tax-calculation runs authorized on those recorded
  names only. A revoked or expired preparer or reviewer therefore kept the case: detail, notes, advance (including
  the reviewer's attestations), return, hold, queue, counts and dashboard. A former preparer could still record
  and list tax runs, and a former reviewer could still approve a computed run.
  - **Fix:** proposal `20261018090000_taxguard_case_assignment_liveness` (review only) adds
    `taxguard_case_slot_live`. A recorded name counts only while that person holds an ACTIVE, effective
    assignment of that role for the case's client, engagement and year. Ten functions change, copied from their
    current definitions and diffed.
  - **Unchanged:** managers and administrators, the recorded names, the two-person rule and every stage check.
  - **Tests:** `caseAssignmentRevocation.db` (6) failed first on four cases; the tax-run approval case was shown
    separately. It covers revocation, expiry, another year or engagement, reassignment, the case API, earlier
    notes and the case document, queue, counts and dashboard, managers and administrators, and other clients and
    tenants.
  - **Known consequence:** a replacement assignee is not the recorded preparer or reviewer, and cannot act until
    a reviewed case-team operation exists (next package). A manager can act meanwhile.
  - **Review:** proposals 20261018020000 to 090000 are consolidated for Codex and the owner in
    `phase14-proposal-review-dossier.md`, with the Codex handoff and the remaining-gaps inventory.

  **Practice client detail confidentiality (Block 31).** `taxguard_practice_client_detail` decided access per
  client. An engagement-year assignee received every engagement's internal notes, tasks and deadlines, the whole
  team and assignment history, and the client's case and ledger activity of every year. The ledger activity
  bypassed the Block 29 history filter. The same staff member could also add notes, tasks and deadlines to any
  engagement and year, and resolve its deadlines.
  - **Fix:** proposal `20261018100000_taxguard_practice_client_scope` (review only). A record is scoped by the
    dimensions it carries, and a case-linked item takes its case's engagement and year. Activity is scoped by the
    referenced ledger record's year, the case, or the event's engagement and year. Five functions change, copied
    from their current definitions and diffed.
  - **Refusals and visibility:** refusals reuse `ENGAGEMENT_NOT_FOUND`, `CASE_NOT_FOUND` and
    `DEADLINE_NOT_FOUND`. Client-wide staff, managers and administrators are unchanged. A task assigned to, or
    created by, the actor stays visible to them.
  - **Tests:** `practiceClientDetailScope.db` (8) failed first on six cases. Refused writes leave no rows or audit
    entries, and replaying a manager's out-of-scope task key no longer confirms that the task exists. The
    composition re-apply check
    caught a missing `REVOKE` on a new helper before commit.

  **Case-team restaffing (Block 32).** Proposal `20261018105000_taxguard_case_restaff` (review only), with
  `CaseStore.restaff` and `POST /api/cases/:caseId/team`, lets a practice manager or administrator move a case's
  preparer or reviewer to someone who already holds the live assignment.
  - **Controls:** a reason and the case version are required, segregation of duties is kept, history is untouched,
    and the change is audited.
  - **Tests:** `caseRestaff.db` (7) failed first, including the API cases.
  - **Manager console (Block 33):** Case Workflow has a Case team form for practice managers.
    - It shows the engagement and year, the current holder of each role, and only people who already hold that
      live assignment (`restaffCandidates`).
    - It requires a recorded reason and the case version, and has a Refresh team action.
    - Specific refusal messages; a refused change keeps the selection and reason.
    - Visibility is a hint only; the server decides.
  - **Defect found by the browser test and fixed:** the practice-manager route allowlist (`practiceManagerAccess.ts`)
    did not list `POST /api/cases/:id/team`, so every durable manager was refused before the database. The
    database-level tests mount the router directly and could not see it. The allowlist test failed first.
  - **Browser coverage:** provider suite 14. The manager reassigns the case reviewer through the UI; an assignment
    withdrawn just before submitting is refused with the entries kept; once restored, the change succeeds; the
    former reviewer loses the case and the preparer cannot restaff. Unit coverage: `caseWorkflowPanel.test`
    (restaff request shape, candidate filtering, refusal messages).

  **Tax Rules console (Block 34).** The tax-engine API had no frontend at all: sources of law, versioned rule sets
  with maker-checker approval, and test coverage were reachable only by API. `TaxRulesPanel` (manager module
  "Tax Rules" and the reviewer dashboard), with `taxEngineService`, adds:
  - a sources table with registration;
  - reviewer verification against a 64-character document hash;
  - rule sets by year, with a detail view (parameters with filing status, source and citation; content hash;
    sources; coverage);
  - submit, approve and reject, with a note required to reject.

  Every decision stays on the server: reviewers verify and approve, nobody checks their own work, and approval needs
  passing, covering tests. Refusals have specific messages and keep what was entered. Synthetic content is always
  labelled.
  - **Allowlist:** the practice-manager route allowlist now permits the read-only
    `GET /api/tax-engine/rule-sets/:id/coverage`. The allowlist test failed first.
  - **Tests:** `taxRulesPanel.test` (5): request shapes, refusal messages, hash validation, navigation. Default
    browser suite 07 adds the console journey: the manager registers a source, the manager's verify attempt is
    refused with the hash kept, the reviewer verifies it, and the reviewer reads the approved synthetic rule set
    with full coverage.
  - **Tests and calculation runs (Block 35):**
    - The rule-set detail shows each source-cited test with its expected outputs, its result in the latest
      recorded run (with mismatches), the run summary (flagged when the tests changed since) and a Run tests
      action. The server evaluates and records the run.
    - Case Workflow lists the case's calculation runs, labelled as never used for a return, with Approve or Reject
      and a required note. The server limits decisions to the case's independent reviewer.
    - Default browser suite 07: the preparer's own approval attempt is refused with the note kept, and the reviewer
      approves the run in the UI. `taxRulesPanel.test` (6).

  **Engagement tax years and practice deadlines (Block 36).** The client detail already returned deadlines but never
  showed them, and adding a tax year or a deadline was API-only. Clients & Engagements now has:
  - **Add tax year** on each open engagement;
  - a **Deadlines** table showing authority, citation, tax year and status, with Mark met and, for non-statutory
    deadlines only, Waive (the reason is recorded; the server limits waivers to managers);
  - an **Add a deadline** form, where a statutory deadline cannot be recorded without its source citation.

  Refusals have specific messages. `practiceClientsPanel.test` (6). Provider suite 14 journey: the manager adds 2026,
  records a statutory deadline (blocked until the citation is entered) and an internal one, the preparer's waiver is
  refused, and the manager waives the internal deadline and marks the statutory one met.

  **Security event volume in the audit center (Block 37).** `GET /api/audit-center/security-summary` (proposal 048) had
  no frontend. The audit center's security view now shows recorded and suppressed (rate-limited duplicate) counts per
  category for the selected range. The view is for administrators only, and the 31-day limit has its own message,
  separate from the 92-day event-log limit. Tests: `auditSecurityVolume.test` (2); default browser suite 11 checks
  the view and the over-range message, and that managers are refused the summary.

  **Rule-set authoring in the Tax Rules console (Block 38).** Drafting a rule set and adding or removing its tests
  were API-only, and a rule set cannot be submitted without passing, covering tests. The console now has:
  - **Draft a rule set:** a JSON definition, checked to be an object in the browser and validated, hashed and
    versioned by the server.
  - **Add a source-cited test:** only sources verified for the rule set's year are offered. Inputs and expected
    outputs are entered as "name = amount" lines, refused if malformed or repeated, with one evidence reference
    applied to every input.
  - **Remove** for tests while the rule set is a draft.

  Tests: `taxRulesPanel.test` (8), including the line parser. Default browser suite 07 journey: the manager drafts a
  synthetic rule set, adds two tests, adds and removes a third, runs the tests (2 of 2), submits, and the reviewer
  approves it in the console. Remaining API-only by design: invoice line removal, which overlaps Codex's Phase 15
  line-removal retries.

  **Production refusal of the process-local case authority (Block 39).** `/api/case-authority` is mounted by
  `createProductionApp`, but its adapter, `TransactionalDocumentDatabase`, is an in-memory map that never reports
  durable persistence.
  - **Reviewer paths (Codex audit, 2026-10-19 to 20).** The reviewer queue and reviewer decisions already
    refused in production. Codex's `reviewer-workspace-durability.patch` adds refusals for the selected reviewer
    workspace (503 `DURABLE_REVIEW_WORKSPACE_PROVIDER_REQUIRED`) and for the generic review action (503
    `DURABLE_REVIEW_ACTION_PROVIDER_REQUIRED`), both before the repository is called.
  - **Codex's two additive tests:**
    - an authenticated non-reviewer is refused before the decision repository;
    - a revoked reviewer assignment is rejected before any decision or audit write.
  - **Verification.** Each patch was applied after checking its SHA-256 and preimage blobs, and the resulting
    blobs match Codex's manifest. The workspace and action refusals were independently shown to fail first (3
    failures against the original route). The two additive tests pass on the existing code, so they are
    regressions rather than fixes.
  - **Remaining defect, found in this audit.** Every other scoped case operation still read and acknowledged
    writes in production against that map:
    - the case itself, its stages, documents, evidence and workpapers;
    - returns, reports, signatures, filings (including submit), monitoring, archive and repeat;
    - the `/cases` list.

    A restart or a second instance would silently lose them.
  - **Fix.** The route `handler` and the `/cases` list now refuse in production with 503
    `DURABLE_CASE_AUTHORITY_PROVIDER_REQUIRED` (`requiresHumanReview`, `externalSubmissionAllowed: false`),
    before touching the store. Authentication still comes first. The reviewer decision and legacy `/approvals`
    routes keep their request validation and the repository's specific `DURABLE_REVIEW_DECISION_PROVIDER_REQUIRED`.
    Development behaviour is unchanged.
  - **Tests.** `caseAuthorityProductionDurability.test` (23): 9 reads and 11 writes asserted with no store call
    and no record change; 20 failed first, including 200 responses for PATCH, activate and archive manifest.
  - **Still open.** A durable case-authority provider is a `CONTROL-DURABILITY` cutover item. The browser suites
    run the development server and are unaffected.

  **Production refusal of the Stage 02 accountant document-review store (Block 40).** The production-mounted routes
  below read `serverDocumentReviewStore`, an in-memory map that nothing in production populates:
  - `/api/stage-two-three/accountant/review-queue`;
  - `review-item`;
  - `review-action`;
  - `verify-evidence`.

  Before the fix, the queue answered a false empty 200 and the other routes answered 404.
  - **Fix.** They now answer 503 `DURABLE_DOCUMENT_REVIEW_PROVIDER_REQUIRED` with `no-store`. The queue refuses
    after the role and client-assignment checks. The item, action and verify-evidence routes refuse after the role
    check and before the store lookup, because the store is their only source for the client.
  - **Tests.** `stageTwoDocumentReviewProductionDurability.test` (8): 5 failed first. A development case keeps the
    cross-client 403 for item and action covered.
  - **Changed expectation (deliberate).** `clientDataIsolationSecurity` SEC-CLIENT-023 asserted that production
    served the volatile store (own client 200). It now asserts:
    - the own-client refusal;
    - the unassigned client's 403, ahead of the refusal;
    - no client identifier in the item responses;
    - unchanged store versions.

  **Production refusal of the practice-operations services; audit of the remaining routers (Block 41).**

  *Practice operations.* `/api/operations` is production-mounted, and every service behind it is an in-memory map,
  despite names such as `globalDurableJobQueueService`. The services cover jobs, tasks, assignments, deadlines,
  communications, requests, notifications, engagement billing (invoices and payments), search, analytics,
  retention and legal hold, archive verification and rollover. Only the client-service and practice-manager
  dashboards, which already refused, have a UI consumer. In production the rest answered: job creation 201,
  listings 200, invoice and payment operations, legal hold and rollover.
  - **Fix.** After authentication and the client-context check (a client asking for another client still gets
    403), production answers 503 `DURABLE_OPERATIONS_STORE_REQUIRED` with `no-store`. No service is called.
  - **Payment webhook.** The unauthenticated `POST /api/operations/payments/webhook` answers 503
    `PAYMENT_PROVIDER_NOT_COMMISSIONED` in production; no provider is commissioned.
  - **Tests.** `practiceOperationsProductionDurability.test` (37): 33 routes plus the webhook and the ordering
    check failed first (35). Two development cases carry the job-listing and cancellation scoping.
  - **Changed expectations (deliberate).** `clientDataIsolationSecurity` SEC-CLIENT-021 and 022a asserted that
    production served the volatile job queue (a 200 listing and a 200 cancellation). They now assert the refusal,
    with no job content and unchanged job status. Their scoping assertions moved, unchanged, to the development
    cases. SEC-CLIENT-022 (client widening, 403) is unchanged.
  - **Webhook signature finding.** The development handler verified the signature over re-serialised JSON, compared
    with `!==`, and did not bound the timestamp. Fixed in Block 42.

  *Remaining production routers, audited:*
  - `/api/bookkeeping`: the ledger dispatch's final catch-all already refuses every handler it does not serve
    whenever the ledger is not in memory, which is always in production. That covers book-to-tax, document
    matching and the accounting-sync write authorization and write-back. No defect was found.
    `bookkeepingProductionFallthrough.test` (4) is a regression guard: removing the catch-all makes it fail.
  - `/api/profile`: only `/ordinary` is served in production, through the durable Supabase sessions;
    everything else refuses after the client check.
  - `/api/accountant`: durable and read-only.
  - `/api/tax-forms`: a static catalogue.
  - `/api/ai-governance`: `productionGovernance.ts` uses PostgreSQL over verified TLS (`DATABASE_URL`) or refuses with 503
    `AI_GOVERNANCE_UNAVAILABLE`; it has no in-memory fallback. `/api/auth` uses the Supabase session bridge, and the
    local password and TOTP routes answer 410 in production.

  With this, every router that `createProductionApp` mounts has been checked for process-local state.

  **Automated accessibility audit of the newer staff surfaces (Block 43).** Suite 16 audited the module views, but
  it did not cover the manager's Tax Rules module. Collapsed disclosures and unapplied filters also hid controls
  from it. It now audits:
  - the manager's Tax Rules module;
  - the Register-a-source and Draft-a-rule-set forms, expanded;
  - the administrator's audit-center security view, applied.

  No defect was found, and no source change was needed. The audit's self-test still proves that each defect class
  is detected. Its keyboard and viewport billing cases depend on invoices that suite 02 creates (pre-existing): they
  pass in the full run, and fail when suite 16 runs alone. This automation does not establish WCAG conformance.

  **Phone-width layout of the newer staff surfaces (Block 44).** The 375 px no-horizontal-page-scroll check covered
  only billing. It now also covers, reached through the phone navigation drawer:
  - the Tax Rules console, with both authoring forms expanded;
  - Case Workflow;
  - Clients & Engagements;
  - the audit center's event list and security view.

  All fit, and no source change was needed.

  **Reviewer ledger and book-to-tax review (Block 45).**

  *Gap.* The reviewer is the checker for prepared journal entries and for book-to-tax mappings, adjustments and
  workpapers, and the database enforces that. Yet no reviewer screen offered any of it: `LedgerControlsPanel` (approve,
  return for correction, reject) was mounted only in the unreachable `AccountantBookkeepingSection`. The browser
  journeys therefore approved through the API.

  *Correction.* `ReviewerLedgerReviewPanel` on the reviewer dashboard. The reviewer enters a client identifier and a tax
  year, and the panel reuses `LedgerControlsPanel`, `BookToTaxPanel` and `LedgerReportsPanel` (journal search, general
  ledger and financial audit history). No business logic is duplicated, and the server enforces role, assignment,
  year scope and maker-checker on every request. The panel keeps its controls mounted while it refreshes the same
  client and year, so confirmations and refusals stay visible, and it never shows a previous scope's entries.

  *Defects found and fixed along the way:*
  - **`BookToTaxPanel` stale responses.** The overview and categories had no guard, so a slower response for a
    previously selected family could overwrite the family now in the selector. Its approve and reject buttons would
    then act on that family's records. Each response is now tagged with client, year and family, and a stale one is
    discarded. A deterministic browser regression delays the 1040 response past the switch to 1065; it failed with
    the original panel and passes now.
  - **Phone-width overflow on the reviewer dashboard (pre-existing).** At 375 px the page scrolled 96 px sideways.
    - Shared panels relied on `tg-manager-scroll`, a class whose rule lives only in the practice-manager stylesheet.
    - Four tables in `BookToTaxPanel` and `LedgerReportsPanel` had no scroll container at all.
    - `reviewerDashboard.css` forced every table under `.tg-reviewer` to `min-width:420px` at phone width.

    The shared wrappers are now self-contained (`max-w-full overflow-x-auto`) in `CaseWorkflowPanel`,
    `PracticeClientsPanel`, `TaxRulesPanel`, `DurableMyWorkPanel`, `BookToTaxPanel` and `LedgerReportsPanel`. The
    420 px rule is scoped to `.tg-review-scroll`, the reviewer's own queue table it was written for. The wrappers
    are what removes the page overflow; the overflow check still passes with the original 420 px rule, which is
    scoped for correctness, not to make the check pass.

  *Browser evidence (suite 03, real UI; API used only for maker-side setup):*
  - **The reviewer, in their own dashboard:**
    - approves a bookkeeper's entry, which posts with `reviewerUid`;
    - returns another for correction with a recorded note;
    - is refused approving an adjusting entry they prepared themselves (`MAKER_CHECKER_VIOLATION` shown, entry stays
      `PREPARED`).
  - **The correction cycle.** The bookkeeper prepares the replacement; after a reload the reviewer sees the server's
    state and approves it.
  - **Audit evidence in the UI.** The financial audit history lists "Entry posted" and "Entry correction required"
    by `e2e-rev (senior_reviewer)` and "Entry created" by `e2e-bk (bookkeeper)`.
  - **Repeated approval.** Approving the same version again is refused, and the entry posts once.
  - **Book-to-tax.**
    - The preparer is refused approval (`B2T_REVIEWER_REQUIRED`) for both the mapping and the workpaper.
    - The reviewer approves the submitted mapping in the UI.
    - The workpaper is generated in `DRAFT`, and the reviewer approves it in the UI.
    - After reloading, it shows as approved and reconciled, and no approve control remains.
  - **Refusals.** The reviewer is refused another client (`UNASSIGNED_CLIENT`), a foreign tenant's client and the
    unstaffed 2026 ledger: an alert, no entries and no approve controls. A direct approval attempt with the
    reviewer's own token through each of those scopes is refused, and the entry is unchanged.
  - **Phone width.** At 375 px the reviewer dashboard, ledger review, workpapers and history do not scroll the page,
    and the approve control is within the viewport.

  *Recorded for the owner (not changed).* Under proposal 024 an ordinary journal entry by a non-bookkeeper member,
  including a reviewer, posts immediately. Only bookkeeper, adjusting, reversing and replacement entries wait for
  independent review. Whether professional staff entries should also require a second person is a maker-checker
  policy decision.

  *Next (Block 47).* `BookkeeperLedgerWorkspace` had the same unguarded pattern; it is fixed in Block 47.

  **Bookkeeper ledger workspace scope isolation (Block 47).** The dashboard re-renders `BookkeeperLedgerWorkspace` with a
  new client or year without remounting it. Its work queue, chart of accounts and trial-balance reads had no guard.
  - **The defect, demonstrated.** A deterministic browser regression (suite 03) delays every 2025 ledger request past
    a switch to 2026, which the server refuses for the 2025-only bookkeeper. The late 2025 work queue then appeared
    under the 2026 heading.
  - **The fix.** Each response is tagged with client and year, and a stale one is discarded. A change of scope also
    clears the previous queue, totals, notice, category choices, and the entry and reconciliation drafts, and issues
    a fresh entry idempotency key. A draft can then never be submitted to the newly selected client or year.

  **AI emergency stop through the UI (Block 48).** Journey N (provider profile) proved the kill switch only through the
  API. It now also covers the UI:
  - the administrator opens AI Emergency Stop, chooses one agent (A10), enters a recorded reason and engages the stop
    through the confirmation step, which names the exact target;
  - the confirmation and the recorded-stops table show it, attributed to the administrator;
  - the server lists it, and A10's commissioning state becomes STOPPED;
  - no lift control exists;
  - the accountant's workspace has no emergency-stop control (the API refusal is covered by the existing case).
  - **audit:** a CRITICAL `KILL_SWITCH` governance security event attributed to the administrator, with the operation
    (`ACTIVATE`), scope, target, switch id and a hash of the reason;
  - a new evaluation for A10 is refused. A10 was already inactive, so the code alone cannot isolate the stop; the
    recorded stop is the evidence;
  - nothing is erased: the earlier decisions and the earlier A34 stop are still readable;
  - an accountant's attempt to engage a **global** stop is refused by the server (`AI_KILL_SWITCH_ROLE_DENIED`), and no
    global stop is recorded.

  **Risk, materiality and the decision gate (Block 54, database layer).** Proposal `20261018170000_taxguard_risk_materiality`
  (review only):
  - **Materiality policies** are versioned and approved by someone other than their author. None is seeded and no RPC
    writes them: thresholds are owner policy and a reviewed database change.
  - **An assessment** of a case is deterministic. It combines:
    - the diagnostics gate (evidence);
    - the approved policy's thresholds (materiality and risk level);
    - a declared unsupported-position flag;
    - an optional AI confidence.

    It is persisted immutably with its inputs, the policy version and its reason codes, and audited.
  - **Outcomes:**
    - BLOCKED when a blocking diagnostic exists;
    - HUMAN_REVIEW_REQUIRED for any reason: no approved policy, not diagnosed, error diagnostics, a material amount,
      an unsupported position, confidence below the policy minimum, or a policy that requires review;
    - CONTINUE only when an approved policy explicitly allows automated continuation and no reason exists.
  - **AI confidence** can add a reason, never remove one.

  Tests: `caseRiskMateriality.db.test` (6, real PostgreSQL). They show that a confidence of 0.99 still goes to a
  person without a policy, a blocking diagnostic is not lifted by amount or confidence, draft and self-approved
  policies are ignored or refused, and the material, high-risk, low-confidence and unsupported paths behave as above.
  CONTINUE appears only under an approved policy that allows it. Input validation, scope, immutability and audit are
  covered too. Two first-draft defects were fixed: an untyped `text[] || literal` (now `array_append`), and a test
  parameter of conflicting type.

  **Owner decision:** no materiality policy exists, so every case goes to a person until the practice approves
  thresholds.

  **Case readiness diagnostics (Block 53, database layer), published as `1ac5a95`.** No return exists yet (stages 9-18 are blocked), so diagnostics
  start from what does exist. Proposal `20261018160000_taxguard_return_diagnostics` (review only) runs deterministic
  checks over a case's durable records:
  - **Rules and severities.** Severities come from a governed, versioned rule table; no RPC writes it, so changing a
    severity is a reviewed database change:
    - BLOCKING: case on hold; no approved calculation run;
    - ERROR: journal entries awaiting review; no approved book-to-tax workpaper for the case year and return family;
    - WARNING: calculation run awaiting review; the ledger changed after the latest approved run (stale); research
      awaiting review;
    - INFO: draft research.
  - **History.** Each run records its detections. A finding stays OPEN while detected and is CLEARED by the run that no
    longer detects it. Diagnostics and runs are immutable, also to the database owner. Runs and acknowledgements are
    audited.
  - **Waivers.** Only INFO and WARNING may be acknowledged, by the case reviewer or a manager, with a note. ERROR and
    BLOCKING are not waivable (`DIAGNOSTIC_NOT_WAIVABLE`) and clear only when the data changes.
  - **Gate.** `taxguard_case_diagnostics_gate` reports blocking and error counts for future finalization steps; it is
    granted to no client role.
  - **Access** follows the case's live assignment.

  Tests: `caseDiagnostics.db.test` (5, real PostgreSQL). It covers a new case's findings, an unreviewed entry clearing
  once approved with its history kept, waiver limits, a hold, access refusals and immutability. Writing it found three
  defects in the first draft, all fixed:
  - a rule-code check that rejected digits (`B2T_`);
  - a loop variable named `found` that shadowed PL/pgSQL's `FOUND`;
  - a `NOT ... = ANY` clause, rewritten as `<> ALL`.

  The calculation-run review and staleness rules are not yet exercised (they need an approved rule set). No store,
  route or UI yet.

  **Tax research workspace (Block 52), published as `5536e68`.** `CaseResearchPanel` is mounted per case, keyed by case id, in Case Workflow for the
  preparer, the reviewer and the manager. It sits on the existing development-only tax-engine router (`/cases/:caseId/research`,
  `/research/:memoId/(citations|submit|approve|reject)`) and `TaxEngineStore`, with structured codes mapped to statuses.
  Managers may open, cite and submit; research decisions stay closed to them in the route allowlist.
  - **What the panel shows.** Each citation shows its authority level as text: authoritative citations with the
    registry's citation, title, authority type, jurisdiction, years and verification state, and AI inference labelled
    "AI inference — not tax authority". Only verified sources covering the case year are offered as authoritative.
  - **Return use** is shown as BLOCKED on every memo.
  - **Browser evidence (suite 07):**
    - the preparer opens a memo, cites a verified source and an AI inference, and submits;
    - the preparer's own approval attempt is refused by the server (case reviewer required), and the memo stays
      submitted;
    - the case reviewer approves; after a reload the memo is approved, attributed to both people, return use BLOCKED,
      and no action remains;
    - the decision appears in the audit center (`TAX_RESEARCH_APPROVED`);
    - on a separate 2026 engagement the preparer opens a memo, the manager revokes the assignment, and the still-open
      page's next action is refused ("not available to you") with the memo unchanged;
    - the panel fits 375 px.
  - **Corrected in the proposal:** a comment claimed synthetic sources were excluded from authoritative support; they
    are not. That is now stated as a point for SQL review.
  - **No correction-request state** exists in the research domain: a rejected memo is final, and a new memo is opened.

  **Tax research memos (Block 51, database layer), published as `e21b4d0`, CI green from `d6b6222`.** Proposal `20261018150000_taxguard_tax_research` (review only)
  makes research professional support for one tax case:
  - **Scope.** A memo is reachable only through the case's existing access rule (`taxguard_case_actor`: a manager,
    or a member with a live assignment to the case). Another client's, year's or tenant's memo reads as
    `RESEARCH_MEMO_NOT_FOUND`.
  - **Authority levels.** Every citation states one:
    - AUTHORITATIVE: a VERIFIED source that covers the case year;
    - SECONDARY or INTERNAL_GUIDANCE: a reference;
    - AI_INFERENCE: no source and no reference.

    Supplying the wrong kind of support is refused (`RESEARCH_INPUT_INVALID`), never silently dropped.
  - **Approval** needs the case's reviewer, with a live assignment and not the preparer. It needs at least one
    authoritative citation; AI inference and secondary support never suffice (`RESEARCH_AUTHORITY_REQUIRED`). It
    changes no return (`returnUse: BLOCKED`).
  - **Immutability and audit.** Decided memos and their citations are immutable, also to the database owner, and
    every transition is audited.

  - **Live assignment.** Access ends with it: once the preparer's assignment is revoked, the memo reads as not found
    to them, while the record stays intact and the case's live reviewer still reaches it.

  Tests: `taxResearch.db.test` (7, real PostgreSQL). Two defects in the first draft were found and fixed:
  - an AI-inference citation naming a source was accepted with the source dropped;
  - the migration readiness audit found the trigger function executable by `anon` and `authenticated`.

  Every function is now revoked from `PUBLIC`, `anon` and `authenticated`. Next (Block 52): store, route, the research panel in
  Case Workflow, and a browser journey.

  **Agent evaluation and the activation gate (Block 50), published as `a94dbcb`.** In the core AI schema an agent version could be set ACTIVE
  with no evaluation at all; the governance fixtures do exactly that. Proposal `20261018140000_taxguard_ai_agent_evaluation`
  (review only) adds:
  - **Ten registered evaluation dimensions:** correctness, evidence grounding, hallucination, authorization, tool use,
    stage compliance, prompt-injection resistance, deterministic boundary, structured output and failure behaviour.
  - **Suites** per agent, listing the required dimensions and a minimum number of cases. A suite takes effect only
    once approved by a member other than its author.
  - **Runs** pinned to the exact agent, model and prompt versions.
  - **Append-only case results**, each with an evidence hash and latency.
  - **Derived outcomes.** A run's PASS or FAIL is computed only by `ai_evaluation_complete` from the recorded
    results: any failure fails the run, and too few cases fail it. No caller can create or update a run as passed.
  - **The activation gate.** A trigger on `ai_agent_versions` refuses ACTIVE (`AI_EVALUATION_REQUIRED`) unless a
    passing run exists for those exact versions, against an approved suite that requires every registered dimension.
    A model or prompt change on an active version needs a new evaluation.

  Tests: `aiAgentEvaluation.test` (9, PGlite over every core migration), including that the fixtures' direct
  activation shortcut is now refused and that applying the proposal changes no agent's status. Every A00-A60 version
  stays DRAFT, no model is commissioned, and no evaluation runner executes real agent cases.
  The existing migration readiness audit caught the first draft: its three trigger functions were executable by `anon`
  and `authenticated`. Every function and table is now revoked from `PUBLIC`, `anon` and `authenticated`.

  **Book-to-tax maker-checker coverage (Block 49), published as `56cbdbf`.** All three book-to-tax approvals refuse self-approval in SQL, but
  only the mapping set was tested. Two cases are added to `bookToTaxHttp.test`:
  - a reviewer who prepared an adjustment is refused approving it (`MAKER_CHECKER_VIOLATION`);
  - a reviewer who generated a workpaper is refused approving it.

  In both, the record stays unapproved with its preparer recorded, no approval audit row is written, and an
  accountant is still refused for role. Removing either SQL check makes its case fail.

  `bookToTaxMakerCheckerDefinitions.test` locates the current definition of each review function in the manifest's
  execution order, today in `20261018070000`, and requires both the self-approval refusal and the reviewer-role
  check. Removing the check from that proposal alone fails it. No proposal was changed.

  No source change was needed. The architecture register now records the kill switch as `PROVIDER_VERIFIED` and the AI
  Control Center as `BROWSER_VERIFIED` (suites 14 and 15 already drove its UI; the register had understated it).

  **Payment webhook signature verification (Block 42).** This is the development handler behind
  `/api/operations/payments/webhook`; production refuses it, and no provider is commissioned. It now:
  - verifies the exact bytes received (`rawBody`, captured by `server.ts`). It refuses with 400
    `WEBHOOK_RAW_BODY_REQUIRED` rather than verify a re-serialised body.
  - refuses a timestamp more than 300 seconds from the server clock (`STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE`).
  - refuses a non-numeric timestamp (`INVALID_STRIPE_SIGNATURE_HEADER`).
  - accepts any one of several `v1` signatures, for secret rotation.
  - compares in constant time on decoded 32-byte digests; malformed signatures are refused as
    `STRIPE_SIGNATURE_VERIFICATION_FAILED`.

  Tests: `stripeWebhookSignature.test` (10); 5 failed first (stale, future, rotation, non-numeric timestamp and raw
  bytes). The existing replay and bad-signature cases in `taxGuardPracticeOperations.test` pass unchanged.

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
