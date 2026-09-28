# Durable server authority and production authentication milestone

Date: 2026-09-28. Starting baseline: 53 test files / 765 passing tests. All changes in this milestone are local. No production Firestore writes, migrations, configuration changes, password-reset emails, real AI requests, commits, pushes, or deployments were performed.

## Production findings: reproduced, not inferred from filenames

`https://artaxserv.com/` returned HTTP 200 with `Server: GitHub.com`. The deployed entry script was `/assets/index-C-uzk2ez.js`. Inspection showed its API base compiled to an empty string and `firebaseSession` POSTing to `/api/auth/firebase-session`.

A credential-free POST with an empty JSON body to `https://artaxserv.com/api/auth/firebase-session` returned **405 Method Not Allowed**, with Varnish/Fastly edge headers. This reproduces the reported failure at the Firebase-to-TaxGuard session bridge: the frontend calls the static Pages origin instead of Express. No real login or taxpayer credentials were submitted. The local Pages workflow builds and publishes dist but does not run Node.

**Production source exposure also confirmed:** HEAD requests to `/server.cjs` and `/server.cjs.map` returned HTTP 200 (430,141 and 792,088 bytes respectively). Contents were not fetched. The local Pages workflow now excludes these two build artifacts; Firebase Hosting configuration excludes CJS and source-map files. The previous Express protection cannot protect files hosted by Pages. A reviewed frontend deployment is required to remove the currently published files; consider incident review of the published build, without assuming credentials were embedded.

[GitHub documents Pages as static hosting](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages). Changing a route name or bypassing the Express session verification would not fix the architecture.

## Production topology selected for the handoff

| Component | Location and boundary |
|---|---|
| Frontend | Vite static output on artaxserv.com. GitHub Pages can remain the frontend host. Only public assets are published. |
| Backend | Existing Node 22 Express application on a managed Node/container host; Cloud Run is the recommended Firebase-aligned target. A dedicated HTTPS API origin such as api.artaxserv.com is a proposed DNS name, not a verified deployed endpoint. Build with `npm ci` and `npm run build`, run `NODE_ENV=production npm start`. Current server imports Vite, so do not omit development dependencies from the runtime install without changing that import first. |
| Browser API routing | Configure GitHub Actions repository variable `VITE_API_BASE_URL` to the actual backend HTTPS origin and rebuild. Empty production configuration now fails before network transmission. `VITE_API_SAME_ORIGIN=true` is only for a real same-origin Express/reverse-proxy deployment, not Pages. |
| Authentication | Firebase client SDK proves identity; Express verifies the ID token and revocation. Production issues a random opaque, expiring session backed by Firestore. Only the token hash is persisted. No seed-password or in-memory token login is accepted in production. |
| Firestore | Firebase Admin service identity on the backend. Browser writes to authority records are denied. Existing configured project is `taxguard2026`, database `(default)`; deployment must explicitly confirm these against the intended production project. |
| Documents | Private Cloud Storage with a server-controlled quarantine/scanner/release pipeline. This pipeline is not commissioned; legacy upload paths are now blocked in local production code/rules. |
| OpenAI | Backend only, `OPENAI_API_KEY` and an approved `OPENAI_MODEL` from the host's secret/config store. The case endpoint additionally requires `TAXGUARD_OPENAI_CASES_ENABLED=true`; default is disabled. No document bytes or taxpayer identifiers are sent by the counts-only adapter. |
| Audit/provenance | Case-scoped Firestore create-only event records committed with the business mutation. IAM, log export, retention, backups and immutable external retention still require operations configuration. |

CORS allows the two production frontend origins and now includes PATCH. It is not authorization. All new case access checks stored server membership and assignment. Managed Cloud Run/Functions application-default credentials are supported without adding private keys to browser code.

## Durable persistence implemented

New namespace:

`taxguardTenants/{tenantId}/clients/{clientId}/engagements/{engagementId}/years/{taxYear}`

Canonical Firebase UID, permanent client ID and engagement ID are separate identifiers. IDs are validated; user-supplied path fragments cannot escape the scope. Existing `taxguard_live_cases/{clientId}__{taxYear}` documents are not silently copied or treated as tenant-scoped authority.

| Requirement | Implementation |
|---|---|
| Case evidence | Immutable `evidence` documents with package bindings and server-recorded preparer. Incoming evidence remains UNVERIFIED and human-review-required. A supplied hash is provenance metadata, not proof the server scanned the source bytes. |
| Evidence provenance | `provenance` links source-document IDs, source hash, package, scope and recorder. No AI-supplied authority verification. |
| User/case assignments | Tenant `members` plus case `assignments`; case creation requires tenant administrator and pre-existing client/engagement anchors, active members and distinct client/preparer/reviewer. No browser assignment-writing endpoint exists. |
| Professional reviews | Append-only `reviews`, with credential type and verified/unexpired credential checks from stored membership. |
| Maker-checker approvals | `approvals` use the stored evidence preparer; clients, preparers, administrators and AI cannot approve. Open exceptions block approval. |
| AI decision traces | `decisionTraces` bind package/proposal and carry proposed-only/no-decision-authority markers. |
| AI provider provenance | `aiProviderProvenance` records provider, configured model and prompt version in the same transaction as proposal and pending review. |
| Stage decisions | `stageGateDecisions`, with current approval revision and sequential stage checks. Existing deterministic stage 1–3 evaluators have scoped persistence adapters; their check results are retained. No HTTP endpoint accepts a caller's `passed:true`. |
| Validation exceptions | Immutable `exceptions` and separate independent-professional `exceptionResolutions`; unresolved count is transacted. |
| Audit | Per-case `audit` documents written atomically with mutations. Idempotency operations reject conflicting reuse and stale revisions. Authentication has separate tenant `authAudit` events. |

Access to the new namespace does not inherit the legacy super-admin override. Assigned professionals can inspect provenance, reviews, proposals and traces through allowlisted artifact endpoints; clients cannot read those internal artifacts. Case state reads are authorized separately.

Routes under `/api/case-authority/{tenant}/{client}/{engagement}/{year}` provide case/evidence/artifact reads, evidence submission, professional reviews, exceptions/resolutions, and the disabled-by-default AI review operation. Actor UID comes from authentication, not the request body.

The durable OpenAI flow authorizes first, reserves a request transactionally, enforces a case quota of 20 attempts/hour, calls the existing AIReasoningGateway, then commits proposal/provenance/trace/pending-review/audit together. Replaying an already started request never calls the provider again and returns a conflict for reconciliation. Failures retain a durable start record and attempt to create a review-required failure record. A concurrent case revision change prevents stale result persistence. There is no automatic retry or filing authority.

## Production authentication changes

`DurableSessions` stores canonical identities under `taxguardIdentities/{uid}` and hashed opaque sessions under `taxguardSessions/{hash}`. New client ID allocation, canonical identity, membership, client anchor, session and auth audit are committed together. Concurrent logins cannot allocate two IDs for one new identity.

Sessions survive a backend process restart. Verification checks expiry, revocation, Firebase account disablement/password-reset token revocation, canonical status, tenant and current membership. Logout revokes the persistent session and records audit atomically. Production legacy auth routes return an explicit Firebase-required error.

**Migration guard:** an existing legacy permanent client ID or staff profile without a canonical identity produces `IDENTITY_MIGRATION_REQUIRED`. This intentionally requires reconciliation before production activation. Staff roles/credentials are not inferred from user-editable profiles or self-selected roles. New client identities do not automatically receive case engagements or professional assignments.

The old `/api/live-workflow` production path is gated with `SCOPED_WORKFLOW_MIGRATION_REQUIRED`: it lacks tenant/engagement scope. Its development behavior and tests remain. The existing frontend still needs a selected canonical engagement and migration to scoped case APIs; this milestone does not claim that all older portal screens now use durable authority. Existing browser session token storage also remains a future XSS-hardening concern; sessions are bounded to two hours and checked server-side.

## Firebase password reset

The deployed code called `sendPasswordResetEmail` with `ActionCodeSettings.url = window.location.origin + '/#/login'`. Firebase's `auth/unauthorized-continue-uri` identifies an unauthorized continuation domain for the configured Auth project. The code-level trigger is verified; the actual authorized-domain list and email action template were not accessible and were not changed.

Default behavior now omits ActionCodeSettings and uses Firebase's hosted reset handler. An optional `VITE_PASSWORD_RESET_CONTINUE_URL` must be exactly an HTTPS artaxserv.com or www.artaxserv.com root URL with `#/client/login`; arbitrary origins, onboarding paths and incorrect login aliases are rejected. A successful send message does not disclose whether an account exists.

Why the Reset Password form appeared under `/stage_one_onboard`: session restoration explicitly replaced browser history with that path; an unauthenticated onboarding route rendered ClientLoginPage without changing the URL; Reset Password is a local mode of that same component. Login fallback now normalizes to `/#/client/login`, and restored workflow navigation uses hash routes compatible with static hosting.

Required human Firebase Console checks in project `taxguard2026`:

1. Authentication → Settings → Authorized domains: verify `artaxserv.com`, `www.artaxserv.com`, and the configured Firebase Auth hosting domain. Add only intended hosts if absent.
2. Authentication → Templates → Password reset: verify the hosted action handler remains the intended Firebase handler (`taxguard2026.firebaseapp.com/__/auth/action`) unless a separately implemented custom handler is commissioned. `/stage_one_onboard` is not an action-code handler.
3. If enabling an optional continuation, authorize its host first and use `https://artaxserv.com/#/client/login`.
4. Test an approved test account's reset, expired/reused link, post-reset session invalidation and return-to-login after deployment. No reset email was sent during this task.

[Firebase requires continuation domains to be authorized](https://firebase.google.com/docs/auth/web/passing-state-in-email-actions). Console values cannot be established from the local error string alone.

## Document pipeline readiness for real taxpayer data

**Overall: NOT READY. Do not enable taxpayer intake yet.**

| Capability | Readiness | Evidence / required work |
|---|---|---|
| Upload | BLOCKED | Legacy Express upload processes metadata/sample text, not a verified durable binary pipeline. Firebase client upload and stage-two production ingestion are gated; local Storage/Firestore rules disallow legacy browser writes. |
| Malware scanning | SIMULATED | Filename heuristics and simulated scanner outcomes exist. Need actual quarantined-object scanning, signed results and fail-closed release. |
| File signature verification | PARTIAL | Signature checks exist in stage-two security service; they are not a verified server-enforced gate for every storage path. |
| Encryption at rest | PARTIAL | Authenticated local AES-GCM exists; cloud bucket configuration has not been verified. Never treat metadata `isEncrypted:true` as proof. |
| Key persistence/rotation | NOT READY | Local development keys are ephemeral. Need managed durable key lifecycle, recovery, rotation and access policy. |
| OCR | SIMULATED/PARTIAL | Stage-two OCR generates synthetic text; separate Gemini extraction handles provided samples. No verified real document OCR pipeline commissioned. |
| Classification | PARTIAL | Heuristics/provider outputs and review logic exist; real-file accuracy, privacy and failure behavior need validation. |
| Evidence storage | PARTIAL | New scoped durable evidence/provenance is implemented; trusted binary ingestion, digest generation and scanner binding remain. |
| Tenant isolation | PARTIAL | New server authority is fully scoped. Legacy Storage granted all accountants access; local rules now remove that permission. Legacy flat schemas still need migration and real rules tests. |
| Retention/deletion | NOT READY | No verified retention schedules, legal hold, immutable retention or authorized deletion pipeline. |
| Backup/recovery | NOT VERIFIED | No backup configuration or successful restore exercise verified. |
| Audit logging | PARTIAL | New case/auth transactions persist audit. Old localStorage/in-memory audit, document-access export and retention remain. |
| PII redaction | PARTIAL | OpenAI counts-only input excludes source documents/IDs. This is not a universal PII detector for other extraction paths. |
| AI disclosure boundary | PARTIAL | OpenAI is server-only and proposed-only. Legacy Gemini extraction needs a separate disclosure/consent and data-minimization review before use with taxpayer documents. |

The legacy signed-download function is disabled unless the server-only `TAXGUARD_DOCUMENT_RELEASE_ENABLED` flag is explicitly enabled after migration review. It additionally requires a clean scan, a source hash, owner-matching storage path and an exact storage generation; pending or unbound objects cannot be released. It no longer exposes raw provider error details. Direct legacy Storage reads and writes are denied in the local rules: old client-writable metadata cannot be trusted as a scan attestation. There is still no trusted scanner producing new release attestations. Staff document delivery should be implemented through the scoped backend, not by reinstating broad accountant Storage access.

## Remaining in-memory or unmigrated components

- `src/server/db.ts` business records, seed/demo sessions outside production, onboarding state and many legacy portal endpoints.
- Domain registries and legacy review queues, DecisionTraceLedger maps, old AI audit sink and browser TaxGuardAuditService. The new durable AI path does not depend on these sinks for authority.
- Legacy client/tax-year workflow records and audit writes; retained for explicit migration, gated from production use.
- Browser stage-two/stage-three state, demo financial/report/signature/filing components, and frontend selection of canonical engagement context.
- Authority/rule content verification, a complete supported tax-form catalog, real external filing/signature/acknowledgement integrations.

## Security and validation limits

Firestore Admin SDK bypasses browser rules, so the new repository independently enforces all scope and role checks in transactions. [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions) atomically commit business records and audit, and may retry their callbacks; provider calls are intentionally outside those callbacks.

New tests use the real repository/service code with an atomic transactional test adapter and local Express HTTP requests. They test rollback, immutable creates, cross-scope denial, membership revocation, credential checks, self-approval, exceptions, gate outcomes, AI persistence and replay behavior, session durability, revocation, and reset/API configuration. **They are not Firestore emulator or security-rules integration tests.** Existing `tests/security-rules.test.ts` also models rules in JavaScript rather than exercising deployed rules. Java and firebase-tools were unavailable here; actual emulator/rules verification is a release blocker. No claim of deployed-rule validation is made.

Cloud Functions dependencies were installed locally from their existing lockfile with scripts disabled to typecheck the modified function. The package still targets Node 20 while this workspace runs Node 22; npm emitted an engine warning and transitive dependency deprecation notices. No dependency manifests/lockfiles were changed in this milestone. Root package/lock changes remain pre-existing.

Firestore and Storage rule changes are intentionally restrictive and require compatibility review before a production rules deployment. Some legacy tenantless authorization rules outside documents/messages remain broader than the new repository and must not be assumed safe for new tenant-scoped records. New authority namespaces are explicitly denied to browser SDKs.

## Changed files in this milestone

New:
- `src/server/taxguard/authority.repository.ts`
- `src/server/durableSessions.ts`
- `src/server/routes/case-authority.routes.ts`
- `src/config/apiEndpoint.ts`
- `src/firebase/passwordResetPolicy.ts`
- `functions/src/documentReleasePolicy.ts`
- `src/tests/helpers/transactionalFirestore.ts`
- `src/tests/durableAuthority.test.ts`
- `src/tests/durableSessions.test.ts`
- `src/tests/productionAuthConfiguration.test.ts`
- `src/tests/caseAuthorityHttp.test.ts`
- `src/tests/documentReleasePolicy.test.ts`
- This document.

Updated:
- `server.ts`, `src/server/auth.ts`, `src/server/firebase-admin.ts`
- `src/server/routes/auth.routes.ts`, `documents.routes.ts`, `live-workflow.routes.ts`
- `src/server/ai/TaxGuardOpenAIService.ts`, `src/server/taxguard/serverStageGateOrchestrator.ts`
- `src/config/apiEndpoint.ts` consumers: `src/services/api.ts`, `src/services/liveWorkflowApi.ts`
- `src/firebase/auth.ts`, `src/firebase/storage.ts`, `src/components/auth/AuthPages.tsx`, `src/context/AppContext.tsx`
- `src/services/stageTwoCollectionService.ts`, `functions/src/documents.ts`
- `.env.example`, `.github/workflows/deploy-pages.yml`, `firebase.json`, `firestore.rules`, `storage.rules`

Prior milestone changes and untracked diagnostics remain intact.

Final quality gate:
- `npm.cmd run lint`: passed (TypeScript noEmit).
- `npm.cmd test -- --run`: **58 test files / 839 passing tests**, 74 new tests above the 765 baseline; no existing tests weakened.
- `npm.cmd run build`: passed; existing large frontend chunk warning remains (~2.32 MB minified).
- `npm.cmd --prefix functions run lint`: passed independently for Cloud Functions.
- `git diff --check`: passed; final `git status --short` reviewed.
- Diff/security review completed; no OpenAI key/API URL references found in built frontend assets. No production emulator/Console configuration or real-provider integration verification is claimed.

## Production/irreversible stopping gate and next milestone

Before any real taxpayer documents are accepted:

1. Review and explicitly approve backend hosting, DNS, service identity/IAM, secrets, and frontend deployment. Remove exposed server artifacts from the live static site.
2. Confirm Firebase Auth authorized domains and action template, and test reset on an approved test identity.
3. Run Firestore/Storage emulator authorization tests; review/deploy rules only with approval. Configure backups, restore verification, audit retention and operational monitoring.
4. Reconcile legacy UID → permanent client → tenant → engagement → tax-year mappings without issuing replacement IDs. Prepare a reviewed migration manifest, dry run and rollback plan. Provision canonical staff membership/credentials/assignments. No production migration was performed.
5. Connect existing UI and authoritative gate snapshot loaders to scoped case APIs. Do not switch the old tenantless workflow back on to hide migration errors.
6. Implement and validate real quarantine/scanning, binary storage/digests, generation-bound release, managed keys, OCR, disclosure controls and retention. Keep intake blocked until these are proven.
7. Enable the OpenAI case endpoint only after model approval and staging validation; use synthetic evidence first. It remains a checklist proposal service, never a filing/approval engine.
