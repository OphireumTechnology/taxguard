# TaxGuard controlled deployment preparation

Date: 2026-09-28. Local preparation only. No commit, push, deployment, production Firebase change, DNS change, credential change, or migration was performed. Previous dirty work and local diagnostic inventories were preserved.

## Architecture decision

Keep React/Vite on GitHub Pages at artaxserv.com. Host the production Express API in the existing Firebase Functions codebase as the second-generation HTTPS function `taxguardApi`, Node 22, us-central1. Confirm the region against the actual Firestore/Storage residency before approving deployment. No additional hosting provider or DNS change is needed.

Browser -> HTTPS function -> existing Firebase Admin authentication and DurableSessions -> canonical Firestore tenant/client/engagement/tax-year repositories. The scoped case API uses the existing AIReasoningGateway/OpenAI provider, proposed-only human-review bridge, evidence binding, maker-checker, gate evaluations, and audit/provenance writes. Storage remains in Firebase but real document intake/release remains disabled.

`src/server/productionApp.ts` composes the existing auth and case-authority routers; it is shared with the standalone Node entry point. It does not listen on a port or serve static assets. The Functions adapter loads a bundled copy of this same application. Dependencies other than firebase-admin are bundled from the root lockfile; the deployed Admin SDK comes from the existing Functions lockfile. Both root and Functions dependencies must be installed before building. Functions build runs TypeScript then esbuild. The bundle was loaded locally successfully; this is not a substitute for an emulator or deployed-runtime test.

Only `/api/health`, `/api/auth`, and `/api/case-authority` are released. Unfinished legacy APIs return 503 API_NOT_RELEASED. This intentionally prevents old in-memory onboarding, document, payment, assignment, and workflow routes from becoming production authority. Authentication may work while those workspace features remain unavailable. Existing development routes remain available in development. The scoped workflow frontend still needs canonical engagement routing.

Official references: https://firebase.google.com/docs/functions/http-events (Express apps and function URL prefixes), https://firebase.google.com/docs/functions/manage-functions (Node 22 and runtime controls).

## Exact HTTP 405 resolution

Confirmed earlier: POST https://artaxserv.com/api/auth/firebase-session reaches GitHub Pages and returns 405. The deployed frontend had an empty API base. GitHub Pages cannot execute Express.

After operator approval, deploy `taxguardApi`, take its actual HTTPS function URL from Firebase, and configure the GitHub repository variable VITE_API_BASE_URL to that URL including the function-name prefix. The resulting request must be `https://<region>-<project>.cloudfunctions.net/taxguardApi/api/auth/firebase-session`, never artaxserv.com/api. Run the manual Pages workflow after verifying the backend. No function is assumed already deployed.

The resolver now accepts a validated single function-name prefix for cloudfunctions.net and HTTPS root origins for other API hosts. It rejects artaxserv.com, www.artaxserv.com, github.io hosts, credentials, query strings, fragments, and arbitrary path prefixes. Missing production configuration fails closed. A same-origin override cannot circumvent the known Pages host prohibition. CI validates the target before building; ordinary local production builds can still be inspected without configuring live services, but their API calls fail closed.

The Pages workflow is now manual-only, so a push does not trigger this workflow's deployment. Operators should still check external workflows/settings before pushing. Node server output moved from dist to build. Pages asserts there are no cjs or map files anywhere in dist; Firebase Hosting exclusions remain. The previous milestone observed publicly served server.cjs and server.cjs.map on the live site. This local work has not removed those remote artifacts; an approved clean frontend release must remove them and verify both URLs no longer return source content.

## Authentication status and evidence

- Signup: Firebase Email/Password registration and verification email; production browser no longer writes identity/organization records. Verified Firebase identity is sent to the backend, which assigns the client role, canonical ID, membership, hashed session and audit records transactionally. Phone/company onboarding persistence is separate unfinished workflow work. Existing legacy client IDs require an explicitly reviewed migration; no blind reassignment.
- Login: Firebase credentials -> ID token -> existing server verification -> durable session -> `/api/auth/me`. Caller-supplied roles are ignored. HTTP tests cover this chain with mocked Firebase verification and a transactional Firestore test adapter.
- Persistence: browser Firebase auth restoration re-establishes a backend session. Backend survives process replacement because session hashes/identities are durable; earlier repository tests cover reconstructing the service. Browser bearer-token storage remains readable by JavaScript; a future HttpOnly-cookie/BFF or stronger XSS design is a security hardening item, not implemented here.
- Sign out: backend revoke is persistent and tested, alongside Firebase sign-out. During backend/network failure the UI clears local state but server revocation may fail; the existing two-hour expiry bounds a retained token. Do not claim guaranteed remote revocation during outages.
- Expired/unauthorized sessions: backend returns 401; API client removes stored tokens and emits an expiry event; AppContext clears taxpayer/user state and routes to the client login page. Temporary 503 does not silently erase the token.
- Protected routes: existing UI route checks preserved; auth and scoped case HTTP endpoints independently require verified server sessions. Protected HTTP denial is tested. No browser role is an authorization source.
- Forgot/reset: defaults to Firebase's hosted email action handler with no arbitrary ActionCodeSettings continuation. Optional continuation must be the authorized canonical client-login hash URL. SDK reset confirmation/expired-code handling is tested. No custom reset handler is installed at stage_one_onboard; prior hash-routing corrections remain. The unauthorized-continue-uri error indicates unauthorized continuation configuration; actual Console domains/templates remain unverified.
- No live customer signup, email delivery, browser end-to-end, production authentication, or rules emulator test was performed. These remain release gates.

## Required configuration (variable names only)

Frontend build: VITE_API_BASE_URL. Optional: VITE_PASSWORD_RESET_CONTINUE_URL. VITE_API_SAME_ORIGIN is not appropriate for this Pages topology. These are public configuration only.

Functions runtime: NODE_ENV, TAXGUARD_TENANT_ID. Optional AI configuration: OPENAI_MODEL, TAXGUARD_OPENAI_CASES_ENABLED. Secret Manager binding: OPENAI_API_KEY. The function declares that secret; an approved operator must provision and grant access before deployment, even while AI is disabled. AI remains disabled by default. TAXGUARD_DOCUMENT_RELEASE_ENABLED must remain disabled.

Managed Google runtime provides application-default identity/project context. Do not upload service-account JSON or set VITE secret variables. Existing standalone/local compatibility names are GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY, FIREBASE_FIRESTORE_DATABASE_ID, PORT. These are not a recommendation to place FIREBASE-prefixed variables in a Functions dotenv file (Firebase reserves that prefix). The selected Functions deployment uses the default database and managed project identity; a non-default database requires an explicit reviewed configuration change. No variable values or credentials are included here.

## Manual Firebase and release gates

1. Review billing eligibility, Node 22/Functions v2 support, region/data residency, runtime service-account IAM, quotas and Secret Manager access. Validate the bundled Admin SDK in the emulator/staging runtime; root Admin SDK and Functions Admin SDK major versions differ. Do not change all legacy Functions or upgrade dependencies blindly.
2. Verify Email/Password provider is enabled. Confirm production authorized domains (apex and www as needed), verification/reset templates, Firebase-hosted action handler and optional continuation domain. Do not point a password action handler at the onboarding page. Test delivered action links with a synthetic account.
3. Review and emulator-test local Firestore/Storage rules before publishing. Canonical repositories are server-only; Admin SDK bypasses rules, so scoped application authorization must remain. Review remaining legacy flat collections and callable role assignment separately. No production rules have been changed.
4. Provision canonical tenant memberships and migrate existing identities/engagements using a separately reviewed, backed-up process. New public users cannot grant professional or administrator roles. Existing assignUserRole writes legacy claims/profiles, not the new tenant-authoritative membership; do not treat it as a canonical role migration tool.
5. SECURITY: public bootstrapFirstAdmin is now unconditionally disabled. Previously the first authenticated caller could become admin and a fallback bootstrap key existed. If deployed previously, disable/update that function through an approved security release and audit prior privilege grants. The new local fix has not affected production.
6. With explicit approval, deploy only the reviewed API and bootstrap security update, not an indiscriminate all-functions release. Before changing production, prefer an isolated Firebase staging project with matching IAM/rules and synthetic data. Test registration, login, reload, logout, disabled/revoked identity, expiry, CORS/preflight, cross-client denial, reset email and action completion.
7. Verify the backend health/auth URLs, then set the public Pages API target and run the manual frontend workflow with approval. Confirm the browser POST reaches the function and returns an application response, not GitHub 405. Verify old server artifact URLs no longer serve source. No DNS change is required.
8. Keep AI and document release disabled pending their independent acceptance checks. Define monitoring, error-rate/latency alerts, abuse controls/session creation throttling, Firestore backup/restore drills and an operator rollback plan. Rollback must never restore a vulnerable bootstrap or publish server artifacts.

## Document/security blockers

Real taxpayer documents must NOT be accepted. A trusted upload/quarantine and malware-scanning pipeline, content-signature validation, generation-bound attestation, tenant-scoped object authorization, durable key management/rotation, retention/deletion, backup/restore, reliable OCR/classification, PII redaction and approved AI disclosure boundaries still need end-to-end implementation/verification. Existing local encryption uses an ephemeral development key. Prior milestone fail-closed upload/download rules and code remain. No simulated scan/OCR/encryption feature is represented as production-ready.

Public auth still needs staging abuse/load assessment and production monitoring. Existing client storage and legacy role/rules surfaces require further review. No secret values were printed or embedded. OpenAI remains server-only and AI can neither approve nor bypass human review/gates. No new database or provider was introduced.

## Changes in this milestone

New: src/server/productionApp.ts; functions/src/taxguardApi.ts; scripts/build-function-api.mjs; scripts/verify-production-config.ts; src/tests/productionApiHttp.test.ts; src/tests/firebaseAuthFlows.test.ts; src/tests/adminBootstrapRelease.test.ts; src/tests/apiSessionExpiry.test.ts; this report.

Updated: server.ts; src/config/apiEndpoint.ts; src/context/AppContext.tsx; src/services/api.ts; src/firebase/auth.ts; src/tests/productionAuthConfiguration.test.ts; package.json (server output path); functions/package.json and package-lock.json (Node engine/build); functions/src/index.ts; functions/src/roles.ts; .github/workflows/deploy-pages.yml; .gitignore. Functions build refreshed already tracked functions/lib outputs (documents/index/roles and maps; some additional files have line-ending-only status changes). New generated outputs are ignored and rebuilt by predeploy. Earlier milestone files and the pre-existing root dependency lock changes remain uncommitted.

## Verification and disposition

Baseline preserved: 839 -> 872 passing tests, 58 -> 62 test files, 33 added cases. Tests cover function-prefixed/static-host URL selection, production signup/login/reset SDK boundaries, HTTP durable sessions, expiry/logout/CORS, malformed JSON, unreleased API blocking, denied public admin bootstrap and client expiry handling. Firebase SDK/server account verification is mocked in these tests; the transactional repository adapter is not Firestore emulator proof.

TypeScript/root lint passed; Functions lint and bundle build passed; frontend/Node production build passed with the existing large-chunk warning. Frontend artifact inspection found no cjs/map files. Function bundle load passed. git diff --check passed (line-ending notices only).

Safe to commit: the reviewed source changes are candidates after explicit human approval and selective staging; do not blanket-add local inventories, diagnostics or credentials. No commit was made. Safe to push: only a reviewed commit after explicit approval and remote CI/workflow review; no push was made. Safe to deploy now: NO, until the manual configuration, staging/emulator and security gates above are completed. Safe to accept real taxpayer documents: NO.
