# TaxGuard development cycle — 2026-10-11 (e) — production session authorization, document intake validation, cross-tenant document access

Production recommendation: **NO-GO** (unchanged). Matrix: [taxguard-master-development-requirements-matrix-20261011.md](taxguard-master-development-requirements-matrix-20261011.md) (rows SEC-09, SEC-10, DOC-01).

## 1. Starting state

| Item | Result |
| --- | --- |
| Branch / HEAD | `sync/taxguard-development-20261011` at `846bbc1`, pushed and verified equal to `origin` (cycle d commits `317ad5c`, `191f51c`, `846bbc1`) |
| `origin/main` | Unchanged at `fc36cac`; Supabase vs Firebase conflict still unresolved |
| Baseline | 185 files / 3,429 tests PASS |

## 2. Defects found and fixed

| ID | Severity | Defect | Fix | Evidence |
| --- | --- | --- | --- | --- |
| D-1 | High (availability; fail-closed) | `getAuthorizedClientIds` selected assignment columns without `status`, then filtered with `isAssignmentCurrentlyEffective`, which requires `status === 'active'`. In production every assignment was discarded, so accountants, reviewers, bookkeepers, practice managers and operations staff had **no authorized clients**. | Select `status` (`supabase-db.ts`) | Production-path test reproduced `[]`, now `['clientA','clientB']`. The test stand-in now projects selected columns like PostgREST. |
| D-2 | High (availability; fail-closed) | Same omission in `POST /accountant/verify-evidence` (`stage-two-three.routes.ts`): properly assigned staff always got 404 when Supabase was configured | Select `status` | New configured-path tests: 200 for valid assignments; 404 for wrong client, revoked, expired, future, other staff, other engagement or year, cross-tenant, owner missing; 503 on store failures |
| D-3 | High (confidentiality) | `resolveAuthorizedClientContext` never checked that a staff or admin-selected client belongs to the caller's tenant. Outside production, another tenant's administrator could `GET /api/documents/:id`, obtain a signed download URL, and `PATCH` review or `POST` withdraw. | Deny when the selected client's record is in another tenant (non-production; production is single-tenant-pinned and staff are limited to tenant-scoped `authorizedClientIds`) | Cross-tenant tests: 403 and no signed token minted, no status change; same-tenant control allowed |
| D-4 | Medium | Upload type check skippable by omitting `fileType` (defaulted to PDF); 25 MB limit defined but never enforced; size defaulted to an invented `'1.2 MB'`; no filename or extension-vs-MIME checks; invalid tax year silently became 2025; batch silently skipped bad files while reporting success; 500 echoed internal error text | New `documentUploadValidation.ts` used by `/upload` and `/upload-batch`; batch reports rejected entries by index and code, rejects an all-invalid batch, caps batches at 20 | 50+ validator and route tests |
| D-5 | Medium | `PATCH /:id/review` crashed on a missing `status` (`toUpperCase` of undefined) and accepted any status (for example `archived` or `delivered`) | Review decisions limited to review states; notes and corrected fields bounded | Route tests |

**Behaviour change (intentional):** an administrator selecting another tenant's client in `GET /api/documents?clientId=` now receives **403 `CLIENT_ACCESS_DENIED`** instead of an empty 200. One existing assertion was updated to this stricter expectation; it still asserts that nothing is returned.

**Rejected approach (recorded):** an initial rule requiring administrators to target a client present in `db.users` broke 7 `caseAuthorityHttp` tests. Those routes use clients held only in the durable repository, which enforces tenant scope itself. The rule was narrowed to deny only on positive evidence of another tenant; no test was weakened.

## 3. Files changed (uncommitted)

| File | Change |
| --- | --- |
| `src/server/supabase-db.ts` | D-1 |
| `src/server/routes/stage-two-three.routes.ts` | D-2 |
| `src/server/auth.ts` | D-3 |
| `src/server/documentUploadValidation.ts` | **New** (D-4) |
| `src/server/routes/documents.routes.ts` | D-4, D-5; removed unused `ALLOWED_MIME_TYPES` / `MAX_FILE_SIZE_BYTES` |
| `src/tests/durableSessionRevocation.test.ts` | Column-projecting stand-in with error injection; +10 production-path tests |
| `src/tests/stageTwoThreeVerifyEvidenceAuthorization.test.ts` | +16 configured-path tests |
| `src/tests/documentUploadValidation.test.ts` | **New** |
| `src/tests/documentListAuthorizationAndUploadSecurity.test.ts` | One assertion made stricter (403) |
| `docs/taxguard-master-traceability.json` | Regenerated; hash delta only `src/server/auth.ts` |
| Matrix, this report | Updated / new |

Pre-edit copies: `docs/checkpoints/20261011e-assignment-select-preedit/` (git-ignored).

## 4. Validation

| Check | Result |
| --- | --- |
| Lint / typecheck | PASS / PASS |
| Full suite | **186 files / 3,517 tests PASS** (+1 file, +88 tests vs. 3,429; 0 failures) |
| Intermediate runs | 7 `caseAuthorityHttp` failures from an over-broad first rule (narrowed, see §2); 1 list assertion updated to the stricter 403; 2 traceability-hash failures from the legitimate `auth.ts` change, resolved via `scripts/build-local-traceability.mjs` |
| Build | PASS |
| `git diff --check` | PASS |
| Browser / deployed database | NOT VERIFIED (E06, E01) |
| API cost | No external AI, provider or Supabase calls; not measurable |

## 5. Security review

| Area | Impact |
| --- | --- |
| Authentication | Unchanged; production session verification now grants staff their real assignment scope |
| Authorization / tenant isolation | Strengthened: cross-tenant document access by administrators closed in multi-tenant environments; assignment scope evaluated correctly |
| Data handling | Upload metadata validated server-side; suspicious file names logged without echoing them; no internal errors returned. Content scanning remains uncommissioned (E02), and production intake stays 503. |
| Residual | Production admin cross-client selection relies on single-tenant pinning plus repository tenant filters. The signed-download route still streams simulated content (legacy) and remains outside the durable vault (E02). |

## 6. Next cycle

1. Apply the same "deny on positive cross-tenant evidence" check to other legacy routes that accept a client selection outside `resolveAuthorizedClientContext`. Audit by searching for `db.documents.get(` and `clientId` usage in `accountant.routes.ts`.
2. Accountant deliverable upload (`/accountant/documents/upload-deliverable`): apply `validateDocumentUpload`.
3. On H06: Security / Compliance workspace.
