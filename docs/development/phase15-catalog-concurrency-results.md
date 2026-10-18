# Phase 15 catalog first-write concurrency and price history

Branch: `codex/taxguard-phase15-catalog-concurrency`, based on `a8bc4fe` (draft PR 33).

## Measured defect

Baseline `npm.cmd run test:db -- src/tests-db/catalogConcurrency.db.test.ts`: 0 passed, 1 failed. Six concurrent first submissions with different prices all succeeded without a price-change reason. The original missing-row lookup happened before competing insert/upsert statements; a later conflict update could change the price without observing the first committed price.

The fixture uses a local-only BEFORE INSERT barrier and observes all six PostgreSQL sessions waiting on advisory locks before releasing them. It does not depend on an unbounded timing loop. Synthetic data and disposable loopback PostgreSQL only.

## Correction

Unapplied proposal `20261019060000_taxguard_catalog_concurrency.sql` adds a service-only entry point that serializes JSON-framed tenant/service-code natural identity before the original implementation's lookup. The original function rechecks active membership and manager authority after waiting, then performs unchanged price validation, reason requirements, upsert and history creation. The uncoordinated implementation becomes internal; raw table access remains denied. No pricing, rounding or tax rule changes.

The store calls the serialized RPC with the same API arguments and result shape. Existing practice-access denial now maps to HTTP 403 instead of a generic 400. Required request-key arguments for line, removal, refund and credit methods are also required in their TypeScript contracts; runtime validation remains unchanged. This prevents typed callers from silently omitting an already mandatory argument, as the previously repaired recovery fixture did.

## Validation

| Exact command | Measured result |
| --- | --- |
| `npm.cmd run test:db -- src/tests-db/catalogConcurrency.db.test.ts` baseline | 0 passed, 1 failed; six reasonless prices accepted instead of one initial price |
| Same command after correction and expansion | 7 passed: deterministic first-write race, exact prior/new history chain, identical-fee upserts/one history row, role/tenant scope, revocation while waiting, audit-failure rollback/recovery, actual service-role execution/bypass denial and retained history mutation refusal |
| `npm.cmd test` | 5789 passed, 349 files |
| `npm.cmd run test:db` | 119 passed, 24 files |
| `npm.cmd run typecheck` | Passed, including final required-argument contracts |
| `npm.cmd run build` | Passed; final type-only contract edit erases to the same JavaScript |
| `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/02-practice-documents-billing.e2e.test.ts` | 6 passed |
| `npm.cmd run staging:migration:release-candidate` | PASS; 78 canonical/review entries, 53 replay-safe proposals; matching fingerprint `268d02fb14a8419a57dbfa1ad8e82998afc834ce2adbe41215a899df4cc49616`; no external database access |
| `npm.cmd run security:secrets` | PASS, zero findings |
| `node scripts/verify-local-traceability.mjs` | PASS, 230 requirements, release unauthorized |

`git diff --check` and `git diff --cached --check` passed. Historical proposals and original untracked paths remain preserved. PR 33 has green CI and remains draft/unmerged.

## Limits and independent review

Catalog state uses its existing natural tenant/service-code identity. Identical accepted upserts leave one price-history row but retain existing per-request `BILLING_SERVICE_PRICED` audit emission. This package does not invent a rule equating repeated accepted upserts with one financial intent or silently change audit event taxonomy. A reasoned concurrent sequence now records one initial price and five correctly linked prior/new changes.

Uniform request receipts for other lifecycle operations, bank-import intent/provenance contracts, durable cross-device intent recovery, receipt retention, privileged custody and independently anchored audit chains remain explicitly inventoried or review proposals. Owner-level append-only restrictions and retention/legal-hold policy must receive independent review before enforcement or commissioning. Existing UPDATE/DELETE refusal for price history was retained; owner/superuser bypass and truncation are not claimed to be externally detectable.

No hosted migrations, permission changes, deployments, merges or real financial transactions. Staging/production remain **NO-GO**.
