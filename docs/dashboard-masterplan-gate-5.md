# TaxGuard Dashboard Masterplan — Gate 5

Reviewer / Senior only. Bookkeeper is Gate 6 and has not been started.

**Material limitation:** the existing `globalAuthorityDatabase` adapter is in-memory. Production approve/return operations now fail closed with `DURABLE_REVIEW_DECISION_PROVIDER_REQUIRED` until a server adapter establishes durable persistence. The UI displays this limitation. Development/test transactions exercise the decision contracts; no production service or production data was used for validation.

## A. Reviewer dashboard implementation summary

Replaced the live reviewer's sample taxpayers, fabricated return hashes/amounts, local-only approval/return success and unchecked accounting action success with an authenticated, scoped quality-control dashboard. The Gate 2 shell and Gate 3 client functionality remain intact. Gate 4 workpaper presentation was extracted for shared accountant/reviewer reuse.

## B. Masterplan sections implemented

- Six operational KPI positions: Ready for Review, High Risk, Returned, Awaiting Approval, Due Today, Overdue.
- Dense review queue with verified client identifier/name, tax year, stage, preparer, diagnostic risk/recorded priority, review status and recorded deadline.
- Queue filters, authorized case search and filtering among actual accessible tax years.
- Selected-case tabs: Overview, Client Information, Documents, Accounting, Tax Return, Workpapers, Federal Forms, State Forms, AI Findings, Exceptions, Review Notes, Approval, Audit / History.
- Recorded quality evidence, reconciliation states, return figures/form fields, exceptions/diagnostics, source links, stored AI proposals and actual audit/review events.
- Independent approval/return controls with native confirmation dialog, review reason and return correction instructions.
- Navy/gold identity, compact light case surfaces, right information rail, responsive grids, scrolling queue/tabs, native dialog focus handling, focus outlines, arrow/Home/End tab navigation and 18-stage footer.

Unavailable evidence and integrations are disclosed. No image is embedded in the UI; no successful check is inferred from the screenshot or artifact existence.

## C. Existing components reused

DashboardApplicationShell, shared notification/profile/help/drawer, useApp authenticated session, centralized API transport with token-change rejection, canonical role routing, Gate 4 stage labels and extracted workpaper renderer. Backend uses the existing TaxGuardAuthorityRepository, case/assignment access checks, credential/maker-checker validator, transactional mutation/idempotency/audit infrastructure, return approval and review-action implementations.

## D. New components / modules

- `src/components/workspace/ReviewerDashboard.tsx`
- `src/components/workspace/ReviewerCasePanels.tsx`
- `src/components/workspace/CaseWorkpaperList.tsx` — shared with Gate 4.
- `src/components/workspace/reviewerDashboardModel.ts`
- `src/components/workspace/reviewerDashboard.css`
- `src/hooks/useReviewerDashboardData.ts`
- `src/types/reviewerDashboard.ts`

## E. Files modified / added by Gate 5

Modified existing Gate 2–4/application files:

- `src/components/workspace/ReviewerWorkspace.tsx` — live entry point; removed sample/local-only dashboard.
- `src/components/workspace/AccountantDashboard.tsx` — reuses CaseWorkpaperList; other Gate 4 behavior preserved.
- `src/services/api.ts` — authenticated reviewer reads and decision transport.
- `src/server/routes/case-authority.routes.ts` — reviewer read/decision routes and legacy public decision-route protection.
- `src/server/taxguard/authority.repository.ts` — scoped read models, guarded decision wrapper, scope/idempotency checks and stored confirmation evidence.

Added the seven implementation files above, four test files listed under M, and this report. Earlier uncommitted gate files were retained; the complete Git status includes those earlier changes.

## F. APIs / data integrations

All routes use the existing `/api/case-authority` boundary, already mounted in both server runtimes:

- GET `/reviewer/dashboard` — session-tenant case discovery; active reviewer member plus exact canonical case assignment. Production also intersects current session authorized-client grants before returning metadata and checks the configured tenant.
- GET `/:tenantId/:clientId/:engagementId/:taxYear/reviewer-workspace` — one authorized scoped snapshot of stored document metadata, returns, workpapers, tax records, reconciliations, exceptions/resolutions, AI proposals, stage states, extracted fields, provenance and audit/review history.
- POST the same scoped prefix + `/reviewer-decision` — confirms actual approve/return acknowledgement through existing transactional services where the provider permits it.

The existing public `/approvals` and return-target `/reviews/action` routes now use the same decision gate, preventing a route-level bypass. Generic workpaper/record/reconciliation review retains its existing path.

No new workflow engine, database, frontend production mocks, public document URLs, migration or external AI call was introduced. The current in-memory adapter's persistence/hydration gap is explicitly retained as a blocked production dependency rather than replaced with fake durable data.

## G. Review queue / KPI derivation

Cases must pass the actual case scope, active assignment and reviewer identity checks. Queue rows do not include arbitrary `under_review` engagements from shared frontend context.

| KPI / filter | Recorded derivation |
| --- | --- |
| Ready for Review | Stage 06 or a recorded READY_FOR_PREPARER_REVIEW return; includes awaiting-approval cases in the UI filter. |
| High Risk | At least one unresolved CRITICAL_BLOCKING diagnostic on a current return. This is a diagnostic flag, not a fabricated client risk score. |
| Returned | Current non-stale/non-superseded return with recorded REJECTED status. |
| Awaiting Approval | Stage 10 plus a recorded PREPARER_CERTIFIED return. |
| Exceptions | Authoritative case openExceptions greater than zero. |
| Due Today / Overdue | Recorded year-specific engagement commitment; closed/archived cases excluded. |

No statutory deadline or SLA is inferred. Multi-year engagements require an explicit per-year deadline or a matching recorded tax year. Missing deadlines are shown as not recorded. Loading/error KPIs show unknown values rather than invented zero counts.

## H. Stage 01–18 mapping

The persisted implementation, rather than the image's numbering, remains controlling:

01 Onboard → 02 Collect → 03 Validate → 04 Record → 05 Reconcile → 06 Review → 07 Report → 08 Plan → 09 Prepare Taxes → 10 Approve → 11 Sign → 12 File → 13 Government Feedback → 14 Resolve → 15 Monitor → 16 Archive → 17 Renew → 18 Repeat.

Reviewer presentation identifies Stage 06 workpaper review, Stage 09 prepared returns, Stage 10 approval, Stage 11 signature and Stage 12 filing. The footer displays all existing stage names without renumbering or moving states. Approve/return records a decision without advancing stages, signing or filing.

## I. Maker-checker enforcement

Server checks are controlling: active tenant member, active exact case assignment, assigned reviewer UID, reviewer/senior role, separation from the case preparer and artifact creator, verified CPA/EA/Attorney credential and unexpired credentials. Frontend eligibility explains restrictions but does not grant authority.

Artifact scope mismatches are rejected or omitted, and rationale/notes plus guarded-path identity are bound into idempotency hashes. Changing the rationale under the same operation ID conflicts. Optimistic version checking and atomic audit writes remain in the existing transaction runner.

## J. Approval / return controls

Both decisions require explicit confirmation and a review reason of at least 20 characters. Return additionally requires correction instructions of at least 20 characters. No local queue mutation is treated as successful acknowledgement.

Approval requires an active Stage 10 case, the exact recorded return ID, the assigned preparer's certification, independent reviewer credentials, no open exceptions and no unresolved critical diagnostics. Return is constrained to eligible return statuses in Stage 06/09/10 and cannot reject an already approved return at downstream stages.

Approval stores reviewer identity, rationale, return hash, confirmation and audit evidence. Return stores reviewer identity, reason, correction instructions, confirmation and audit evidence. A lost/failed acknowledgement is reported as unconfirmed, not as a fabricated success. Production is blocked until durable provider capability is established; no browser or request-body flag can establish that capability.

## K. AI / human boundaries

Only stored scoped AI proposals are displayed; they explicitly require human review and disallow external submission. No assistant/agent execution, autonomous approval/rejection, taxpayer signature, filing or tax-record edit is simulated or issued.

Extraction confidence preserves the actual provider numeric value because existing extraction records use fractional values. It is not silently relabeled as a percentage and is accompanied by human-review language. Source lineage is shown only where actual document/field/record references exist. Missing calculation-to-form-field lineage is disclosed.

## L. Security / isolation validation

Tests cover role/session rejection, current production client-grant revocation, canonical case assignments, tenant/client/year scope, independent reviewer/credential enforcement, private document metadata boundaries, sensitive identification extraction omission, blocked AI authority, audit evidence, transaction rollback and downstream workflow separation.

Queue/snapshot reads abort or discard obsolete responses when session/selection/refresh changes. The visible workspace is keyed to the authorized selection; there is no first-case fallback. Existing Supabase authentication, RLS/storage configurations and secret handling were not modified. Validation does not constitute an independent audit of deployed RLS policies or provider durability.

## M. Tests added / updated

67 new regression tests in:

- `src/tests/reviewerDashboardAuthority.test.ts`
- `src/tests/reviewerDashboardHttp.test.ts`
- `src/tests/reviewerDashboardMasterplan.test.tsx`
- `src/tests/reviewerDashboardReadStates.test.tsx`

They exercise actual repository transactions and HTTP role/client-context middleware with clearly isolated local authentication/data fixtures, rendered role boundaries, all 18 stage labels, KPI derivation, confidence units, controls and loading/empty/error presentations. Every existing passing test is retained.

## N–R. Validation results

- **N. Full configured suite:** 107 files / 1,592 tests passed.
- **O. Type checking:** passed (`tsc --noEmit`).
- **P. Configured lint:** passed; the repository lint command is also `tsc --noEmit`.
- **Q. Production build:** frontend Vite build and esbuild server bundle passed.
- **R. `git diff --check`:** passed.

Existing nonfatal build warnings remain: LiveCalendarModule mixed static/dynamic imports and the main JavaScript chunk exceeding the configured 850 kB warning threshold.

## S. Git status

Branch remains `feature/dashboard-masterplan`. Origin was verified and fetched before work. Local main and branch HEAD remain at the fetched origin/main baseline, with 0/0 divergence. The dirty tree contains the preserved Gate 2–4 changes plus Gate 5 implementation/tests/report; no work was discarded or synchronized by merge/rebase.

`design-reference/` and `_hardening_backup_20261002-021908/` remain untracked. The backup was not opened or modified. No commit, push, merge/rebase, deployment, production migration or production-data operation occurred.

## T. Known integration gaps

1. **Production decisions are blocked:** the existing authority adapter is volatile. A verified durable adapter and authoritative case hydration/discovery integration are needed before production approve/return can be enabled. No environment/browser flag was added to bypass this boundary.
2. Year-specific client profile fields, comprehensive required-document completeness, general-ledger/financial-statement integration, SLA policy and broader human risk classification are not present in this case contract. Controlled states are used.
3. Full original-file preview and complete source → extracted field → tax value → calculation → form-field lineage require additional verified integrations. Metadata, existing source references, workpapers, return figures and form fields are inspectable now.
4. A scoped conversational AI assistant is not integrated. Existing stored proposals are presented as advisory findings only.
5. Browser pointer/keyboard, screenshot fidelity and tablet/mobile interaction QA were not performed in an authenticated session. Responsive CSS, native dialogs and keyboard tab behavior are implemented; tests cover server rendering and boundaries.

## U. Remaining Gate 6 — Bookkeeper Dashboard

Transaction categorization, reconciliation, general ledger, period status, financial reports, document-to-transaction matching, missing evidence and adjustments, using verified scoped bookkeeping services. Gate 6 requires explicit user approval and has not been started.
