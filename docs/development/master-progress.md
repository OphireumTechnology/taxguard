# TaxGuard AI — Master Progress Log

**PRODUCTION STATUS: NO-GO.** Plan: [master-completion-plan.md](master-completion-plan.md).

## Handoff state

| Field | Value |
| --- | --- |
| Branch | `sync/taxguard-development-20261011` |
| Last pushed commit at plan creation | `d6be0e5` |
| Open owner issue | Owner's personal local Super Administrator sign-in: UNVERIFIED |
| Current item | Backlog #1 — durable staff invitation, activation and MFA enrolment |

## Log

| Date | Item | Result | Commit |
| --- | --- | --- | --- |
| 2026-10-12 | Audit and plan | Baseline recorded; backlog ordered | (this commit) |

## Continuation — 2026-10-12

Preserved the unfinished Claude launch configuration and invitation schema proposal. All work remains on sync/taxguard-development-20261011. No remote operations, PR changes, deployments, production access, or migrations performed.

Implemented this development slice:
- Browser TOTP enrollment panel and provider helpers. No TaxGuard session is issued by enrollment. AAL2 is checked after verification; cancellation removes only an unverified factor.
- Staff sign-in retains only the provider session when the server requires enrollment, clears application identity/data, and exposes the setup panel.
- Production client provisioning checks tenant-scoped invitation history and fails closed if its schema is absent.
- Invitation acceptance service requires confirmed provider email, enrolled MFA and AAL2, hashes the one-time token, and calls an atomic service-role RPC.
- New unapplied acceptance/activation SQL proposal uses row locks, UID serialization, pending approval, independent administrator activation, and transactional audit writes. No API route is released for it yet.
- Added MFA, acceptance, provisioning, and SQL security regression tests; extended the production session fixture.

Validation and blockers:
- TypeScript passed with zero diagnostics after updating the login result contract.
- Shell launches intermittently fail before execution with helper_unknown_error / sandbox setup refresh errors. The sandbox was left enabled. PowerShell blocks npm.ps1; the normal npm.cmd entry point runs without changing execution policy.
- Initial in-process PGlite attempt failed to fetch its WASM runtime. This did not contact Supabase or apply any migration.
- Full Vitest run eventually launched; results and traceability regeneration are being reviewed.

Next work: validate SQL and full suite, complete bounded invitation creation/revocation/lookup API, replace the legacy invitation UI, add approval/admin lifecycle UI and suspension/reactivation with session revocation, then implement approved MFA recovery. Acceptance and approval SQL require review and non-production integration before release. Staff identity provisioning and client auto-provisioning still need a shared database concurrency boundary before invitations can be described as complete.

### Validation results and next slice

- Fixed invitation-query support in existing Supabase fixtures after the first full run (3,935 passed / 32 failed).
- Second full run: **208 files / 3,967 tests passed**. Includes MFA enrollment, acceptance service, provisioning guard and isolated SQL acceptance/activation tests.
- TypeScript: passed. Vite frontend and esbuild server build: passed. No deployment performed.
- Added server-side administrator activation wrapper and its authorization tests after that full run; final validation pending.
- Regenerated offline traceability hashes without changing release authorization.
- No commits or remote writes so far. PR #10 draft state was left untouched.

The next development slice is invitation creation/revocation/lookup, durable HTTP integration, then activation/lifecycle UI. Existing legacy staff acceptance remains development-only. MFA recovery and factor replacement remain unimplemented; an approved reset must suspend staff access and revoke sessions before provider factor replacement. No automatic recovery bypass was introduced.

### Final validation for this slice

- Final full Vitest run: **209 test files passed; 3,972 tests passed** (97.55 seconds), including the administrator activation service tests.
- TypeScript and frontend/server build passed. Offline traceability verification: PASS, browserAcceptance NOT VERIFIED, releaseAuthorized false.
- git diff --check passed. All changes remain local and uncommitted on the requested branch. Existing Claude configuration and the original invitation migration proposal were preserved. No remote PR mutation, production migration, deployment, or main merge occurred.
- Backlog #1 remains partially implemented: HTTP/UI invitation integration, issuance/rate limits, lifecycle controls, and the shared transaction with client provisioning are still required. Backlog #2 (MFA recovery) has documented boundaries and remains unimplemented.

## Master-instruction continuation — 2026-10-12

Re-audited current branch sync/taxguard-development-20261011, origin https://github.com/OphireumTechnology/taxguard.git, HEAD d6be0e5998ed1862888f79ebe7238b844410c95c, and preserved the dirty identity work and unfinished Claude files. Expanded the persistent plan to all eleven roles, federal form families, all state/DC jurisdictions, the canonical 18 stages, documents, accounting, AI, integrations and release evidence. Ordinary role architecture is now authorized; tax/legal/external commissioning and production gates remain.

Security corrections:
- Durable sessions reject inactive, unknown-status and pending memberships in every environment, even when identity data still says active.
- Stage 02 snapshot/reconcile enforce client/assigned-staff and tenant scope. Production requests fail closed before the legacy tenant-unaware, volatile adapter (which also mutates caches on reads).
- TOTP cancellation no longer deletes factors. Pending TOTP setup resumes from the provider all-factor inventory without accumulating factors; lost setup material requires approved recovery. Supabase documents that verified-factor removal requires AAL2, but a list-then-delete UI check is not an atomic safety guarantee: https://supabase.com/docs/reference/javascript/auth-mfa-unenroll.

Invitation implementation:
- Added strict administrator/AAL2/tenant policy and normalized invitation input.
- Issuance returns a random 32-byte secret once to the administrator; only its SHA-256 hash enters storage/RPC arguments, never audit. No automatic email or paid service invoked.
- New unapplied SQL proposal performs issuance, expiry replacement, per-administrator hourly limits, revocation and audit atomically.
- Added confirmed-email-bound POST lookup and provider-verified acceptance; activation requires an application administrator session.
- New /api/staff-access router is development-only, disabled by default, requires explicit non-production enablement/configuration and rejects the protected Supabase project. It is not mounted in createProductionApp. No production connection was made.
- Added bounded local abuse limiter, service tests, real-core-schema SQL tests, and synthetic HTTP tests.

Validation milestone: TypeScript passed before the last MFA SDK correction; first expanded full run **214 files / 4,100 tests passed**, including session lifecycle, reconciliation authority and invitation-management SQL/service/rate-limit cases. Final MFA and new HTTP tests await the final run below. All work remains local; shared client/invitation concurrency and incomplete invitation UI keep release NO-GO.

### Invitation UI and lifecycle continuation

Replaced the legacy invitation screen/password-to-in-memory-session path with provider-only signup/signin, confirmed-email lookup, TOTP enrollment/challenge, and pending independent approval. Invitation codes never enter URLs, persistent browser storage, audit or telemetry. Browser onboarding requires an explicit development build flag and refuses the protected project before provider operations. Provider auth events and bootstrap are suppressed during onboarding; cleanup waits for tracked signup/signin and child MFA requests, signs out, then releases suppression (failed signout remains fail closed).

Added suspension/deactivation/independent reactivation with reason, atomic member/identity update, audit and durable session revocation. Reactivation cannot restore old sessions or clear the future MFA-reenrollment-required gate. Epoch checks use primary authentication timestamps from the presented verified JWT, not mutable account last_sign_in_at or refresh iat. Missing/stale proof denies sign-in after a lifecycle epoch. Token claim reference: https://supabase.com/docs/guides/auth/jwt-fields. Strict durable development mode no longer imports demonstration identity/session or onboarding cache data. Canonical administrator aliases now work with the same AAL2/tenant checks.

Validation: UI/lifecycle snapshot reached **219 test files passing / 4,190 tests passing**, with one outdated invitation label-association expectation failing. Updated expectation to the four new labeled fields without reducing accessibility assertions. Final current-source validation follows. Typecheck and lint/build had passed before the last review hardening. No production/provider connection or remote write occurred.

### Checkpoint review limits

Independent local reviews found no new tenant/AAL2 bypass after token-bound epoch and invitation cleanup fixes. Provider-only cleanup now tracks child enrollment requests too. Both recipient signup and new authenticator enrollment require the development browser flag and a non-protected project before provider operations. Production builds cannot activate this new onboarding path. The new server API remains disabled by default and absent from createProductionApp.

Scoped secret scan inspected 853 source/development/proposal files at the first checkpoint. One pre-existing 60-character PEM fixture marker in taxGuardGeminiIntegration.test.ts was flagged; crypto parsing rejected it, so it is not a usable private key. No finding value was printed. Refresh scan after subsequent changes before Git checkpoint. Production Pages workflow is manual-only/main-gated; sync branch pushes run development CI. Nevertheless, unresolved shared identity provisioning concurrency keeps this work local.

The next coherent development slice is a durable paginated staff/invitation directory and the existing Practice Staff & Roles administrator tab, then shared identity transactions and recovery. Directory reads must omit token hashes, reset/proof metadata and raw secrets; mutations retain AAL2/tenant/maker-checker enforcement.

Validation checkpoint: **222 files / 4,238 tests passed**; final approved-development enrollment guard regression added afterward and is included in the frozen-source rerun. Typecheck passed. Commit/push remain pending local checkpoint and risk review; never bypass Git/sandbox permissions.

### Frozen-source validation result

- **222 test files passed / 4,239 tests passed** (112.73 seconds). Includes invitation HTTP/services/UI adapter, real-core composed SQL proposals, lifecycle/session epochs, verified token proof, cleanup races, MFA disabled-provider checks and reconciliation authority.
- Typecheck, lint and frontend/server build passed. Diff formatting check passed.
- Isolated synthetic browser fixture build passed; browser execution was BLOCKED by PLAYWRIGHT_PACKAGE_MISSING. No package download, provider or production request was attempted. Browser acceptance remains NOT VERIFIED.
- Refreshed high-confidence source/development/proposal secret scan: 865 files, only the unchanged, non-parseable PEM test fixture marker; no new usable credential finding. No secret values printed.
- Public read-only PR lookup returned cache miss; current remote draft status cannot be independently confirmed here. No PR mutation was performed.
- Next: Git checkpoint if sandbox permits, then paginated administrator staff management; identity shared transaction and MFA recovery remain release blockers. Entire application remains incomplete and production NO-GO.

Git checkpoint blocker: both normal git add attempts were rejected before process creation with helper_unknown_error / setup refresh errors. No commit or push could be created; no alternate tool, index write, sandbox change or escalation was attempted. Validated changes remain in the working tree on sync/taxguard-development-20261011. Continue safe application work; do not treat Git blockage as a reason to stop the backlog.

## Administrator staff management continuation — 2026-10-12

Previous goal turn classified as progress: validated identity/security work changed authoritative source and completed 4,239 tests. Re-audited current working tree: requested branch and d6be0e5 HEAD unchanged; all unfinished Claude/identity files preserved.

Implemented next slice:
- Shared staff directory DTOs and active AAL2 administrator/tenant-scoped member and invitation reads.
- New unapplied directory SQL proposal composes with existing identity proposals, enforces service-only execution, rechecks active administrator, strips all token/factor/provider private fields, and uses bounded keyset pagination with microsecond timestamps and explicit C collation for deterministic ID ties.
- Default page25, maximum50 plus one overfetch; cursors bind tenant/filter/kind and cannot grant authority. Invalid calendar dates are refused.
- New GET /api/staff-access/members and /invitations remain behind the existing development-only gate and absent from createProductionApp.
- API client refuses disabled development sessions and protected public API destinations before transport; all responses retain token-change rejection and no-store behavior.
- Administrator Practice Staff & Roles tab now uses the real staff management panel: directory filters/pagination, invitation issuance with once-only memory token, revocation, approval and reasoned lifecycle changes with server confirmation.
- Sensitive forms/actions/reasons/secrets are session keyed and synchronously hidden on identity changes; stale responses/actions are rejected. Confirmation is an accurately labelled inline region with focus handling.
- Canonical administrator/super_administrator aliases now pass the existing provider-readiness presentation gate without loosening server authority.

Focused tests: backend35, composed SQL20 and UI/session38 passed; root full current-snapshot validation pending. No production connection, migration, deployment, paid service or remote write performed. Shared identity transaction and MFA recovery remain open.

Directory validation update: first expanded full run 227 files / 4,354 tests passed; two HTTP fixture cases failed because the shared20-request limiter window was exhausted by the expanded suite. Added an injected test clock advancing the window between cases; application limiter and abuse tests unchanged. Root typecheck/lint/build passed. Current snapshot rerun follows; targeted command was blocked before process creation by the recurring helper setup refresh error.

Directory frozen-source rerun: **228 test files / 4,356 tests passed** (111.74 seconds), including the corrected HTTP limiter fixture. Typecheck, lint and frontend/server build passed. Browser acceptance remains NOT VERIFIED (Playwright unavailable). Directory is locally implemented and tested; durable provider commissioning and proposed migrations remain unapplied.

### Atomic client identity work in progress

Added a service-only transaction proposal and server adapter to allocate the global permanent client ID and write identity/member/client/audit together. Confirmed provider email is mandatory; browser role/clientId metadata is excluded. Replay preserves stored onboarding progress; partial/cross-tenant/staff mappings and invitation history are denied. Counter corruption, collision, missing commissioned counter, namespace exhaustion and failed audit roll back the transaction. Proposed common global email-to-UID lock ordering synchronizes invitation issuance/acceptance with client creation. Adapter focused tests47 and composed SQL tests31 passed in synthetic fixtures; session integration and full-suite validation are still pending. No production operations or Git writes performed.

Atomic integration diagnostic: first expanded snapshot231files /4,430passed /9failed (seven direct client fixtures omitted confirmed email, two traceability hashes stale); next snapshot232files /4,446passed /3failed. The latter exposed obsolete tests describing a process-local production onboarding hierarchy as durable. Corrected the security boundary rather than restoring that unsafe behaviour: durable session bridge skips the adapter, production/configured onboarding routes return503 DURABLE_ONBOARDING_PROVIDER_REQUIRED, and historical workflow scenarios are explicitly isolated demonstration tests. Production HTTP regressions separately assert the unavailable boundary. Strict existing-client resumes now use the same RPC whitelist/coherence checks; provider display-name changes cannot overwrite the stored profile on retry. Default configured nonproduction sessions also use strict authority and require tenant configuration. Cache publication follows successful session persistence. Frozen-source checks remain pending after review changes.

Next independent development slice begun: durable client intake drafts under an existing real engagement/tax-year scope, with optimistic revisions, scoped exact request replay, submission validation and transactional audit. Intake does not create professionals/cases or complete stages. Proposal007 and service adapter are unmounted/unapplied until validated and commissioned; canonical18 materialization remains separate.

### Frozen-source identity/intake checkpoint

**236 test files / 4,589 tests passed** (108.65seconds), including atomic identity service+composed SQL+session replay, durable onboarding boundaries, intake draft SQL/service, and provider identity-change privacy tests. Typecheck, lint, frontend/server build and diff formatting checks passed. Offline traceability PASS; browserAcceptance NOT VERIFIED; releaseAuthorized false. Scoped high-confidence credential scan890files found no high-confidence matches; no secret values printed.

Final demonstration fixture corrections: isolated route harness rather than productionApp, unique synthetic identity/email/client namespace per case, and valid effective assignment dates. No application authorization or MFA rule weakened. Previous intermediate failures remain recorded as diagnostic snapshots, not current evidence.

Atomic identity and intake application-side contracts are locally implemented/tested, awaiting actual nonproduction database/provider integration. Intake remains unmounted and requires real existing engagement/year records. All SQL proposals remain unapplied. Durable hierarchy and profile/session mutation defects remain open; MFA recovery still plan-only.

Started official IRS source-page register for all eight mandatory core families in federal-form-source-register.md. Current About pages/reference purposes verified; exact tax-year artifacts, eligibility/calculations/output/e-file and other federal/state forms remain unverified. No tax readiness claimed.

Git checkpoint retry after passing validation: normal git add (excluding .claude) was rejected before process creation by helper_unknown_error / setup refresh errors. No staging, commit, push or alternate Git/index write performed. Validated source remains local on the requested development branch. Continue safe backlog work; no sandbox bypass or permission escalation.

## Durable session/profile continuation — 2026-10-12

Previous goal turn was progress (source changes and4,589verifiedtests). Re-read .git/HEAD and branch ref via permitted filesystem reads after normal Git launch failed: branch sync/taxguard-development-20261011, HEAD d6be0e5998ed1862888f79ebe7238b844410c95c unchanged. Unfinished .claude files and dirty development work preserved.

Implemented strict atomic session mint/audit and tenant-scoped idempotent revoke/audit through new service-only proposal008. SQL rechecks active durable authority, staff AAL2/factor proof/reenrollment gate and primary epoch under locks; suspension cannot race a later mint. Audit failure rolls back the session operation. Logout now reports503 on failure instead of swallowing it. No raw bearer tokens enter RPC/audit.

Implemented proposal009 and strict ordinary profile updates for phone/companyName: tenant/member/identity/owned-client coherence, closed bounded patches, immutable authority/progress, atomic client+identity+audit, cache publication only after validated persistence. Name/amendments/dossier/onboarding remain unsupported here. Production/configured seven-section profile/amendment prototype routes now return explicit503; ordinary contact PATCH works through the transaction adapter. Legacy demonstration harnesses stay separate. Historic contact JSON/column mismatches fail closed pending independent reconciliation; no backfill or repair invented.

Review caught and fixed proposal008 dollar-quote syntax and contact fields disappearing on006 client-login replay. Added actual SQL/helper Unicode/replay coverage; saved contacts now survive login without broad JSON spreading. Final integrated session/profile snapshot: **241 files /4,755 tests passed** (115.94 seconds), typecheck/lint/build passed.

Next security slice: development browser and server configuration refuse known protected production Supabase/public API destinations before provider transport/cached client use. URL credentials also rejected in browser configuration. Actual blocked SDK fetch regression uses synthetic data and verifies no network call. **242 files /4,773 tests passed** (111.78 seconds); typecheck passed. Production build behaviour is not activated/deployed.

### MFA recovery foundation in progress

Added proposed010 and server request/approval helper: independent maker/checker, active AAL2 admin, current durable actor-session hash recheck inside SQL (revocation/expiry/tenant/UID/epoch), known nonplatform staff target, atomic suspension/reenrollment gate/epoch/all target session revocation/audit/pending reset job. NOWAIT locks make contention an explicit retryable409. Raw bearer, factor IDs, setup keys and codes are absent from structured recovery/job records and audit. Jobs cannot leave pending; provider reset is explicitly unavailable. HTTP/UI, job fencing/execution, provider replacement, enrollment proof, final gate clearing/activation, cancellation/retention remain unimplemented. No MFA bypass added.

Recovery diagnostic:243 files /4,847 tests passed, with one stale traceability inventory hash failure after proof hardening. Added malformed primary-proof cases and typed raw SQL fixture results; current frozen-source validation follows. Actual provider and multi-connection PostgreSQL integration remain unverified; proposed migrations are not applied.

### Frozen-source recovery/security checkpoint

**244 testfiles /4,853 tests passed** (120.48 seconds). Includes proposed010 actual-core composed SQL recovery proof/approval/outbox, helper tests, malformed/stale/missing actor identity/session cases and cached-browser-client guard. Current-source typecheck passed; lint/build passed (last source changes afterward were proposed SQL plus typed SQL regression cases). Diff formatting passed. Scoped source/development/proposal/GitHub/Claude configuration scan910files: no high-confidence AWS/GitHub/payment/private-key/AI/Google/Slack credential pattern findings. No credential values printed. Browser acceptance remains NOT VERIFIED (Playwright missing); real provider and multi-connection PostgreSQL commissioning not performed.

Recovery request/approval is a tested local FOUNDATION, not end-to-end recovery. No HTTP/UI, factor-reset adapter/worker, enrollment proof or gate-clearing/final activation exists. All jobs remain pending/unavailable. No production operation, migration application, real identity/data processing, paid integration or deployment performed.

Normal Git staging retry and read-only gh PR10 metadata query were both rejected before process creation with helper_unknown_error / setup refresh errors. No commit, push, remote PR mutation or alternate index/process bypass occurred. PR10 draft status remains policy and cannot be independently confirmed here. Keep all changes local pending security/integration review. Goal remains active; this turn is progress, not an impasse or application completion.

## Claude worktree — staff session management (2026-10-12)

Isolated worktree `123-claude`, branch `claude/taxguard-dev-20261012` from `37506f9` (Codex active in `123`). Baseline re-verified: 248 files / 4,939 tests, typecheck PASS. Added proposal 023 (unapplied) and development-only own-session list/revoke, sign out other sessions, and administrator member-session revocation with 15-minute step-up re-authentication; UI in Practice Staff & Roles. Validation: **251 files / 4,990 tests passed**, typecheck, build, diff check and traceability PASS. Details: [staff-session-management.md](staff-session-management.md). Production NO-GO.

## Claude worktree — ledger integrity and period close (2026-10-12)

Fixed cross-client approval/mutation by ID on the production-mounted bookkeeping router, date-based period locking, cent-exact balancing, chart-of-accounts validation, double posting and close/reopen controls; added reversing entries, period routes and a UI panel. Engine remains in-memory (not durable). Details: [ledger-integrity-and-period-close.md](ledger-integrity-and-period-close.md). Production NO-GO.
