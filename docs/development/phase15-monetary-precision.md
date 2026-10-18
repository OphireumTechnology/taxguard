# Phase 15 monetary precision

Branch: `codex/taxguard-phase15-monetary-precision`, based on reporting integration commit `b1ce7d6` (draft PR #25). Development only; staging and production remain NO-GO.

## Reproduction

The disposable PostgreSQL fixture posts 91 accepted $1,000,000,000,000 entries and one $0.01 entry. SQL `sum(debit_cents-credit_cents)::text` returns `9100000000000001`. Before this package, general ledger, trial balance and financial statements all returned success with the final cent lost. The three refusal regressions failed with `RESOLVED_UNSAFE`; this was an executed failure, not a prediction.

## Correction and compatibility

New additive proposal `20261018010000_taxguard_report_cent_transport.sql` provides exact report RPC wrappers. PostgreSQL converts aggregate and running cents to text before JSON leaves the database; converting a JavaScript number back to a string would already be too late. Ordered arrays preserve the underlying report ordering. The invoker wrappers remain service-only and call the existing authorized, tenant/client-scoped RPCs. Historical SQL and existing RPC definitions are unchanged.

The store consumes the exact RPCs. `reportMoney.ts` parses integer-cent text to bigint. Trial balance, financial statements and the shared general-ledger calculation use bigint for all intermediate arithmetic. No floating-point addition or rounding is used to derive monetary results.

The dollar-number API remains compatible for amounts it can represent exactly as decimal JSON. Conversion refuses cents outside the safe-integer envelope and also checks the serialized dollar number's decimal round-trip. The second check matters: even a safe integer cent count such as `9007199254740991` loses a cent when serialized as dollars. Unrepresentable results produce HTTP **422** with `LEDGER_REPORT_AMOUNT_OUT_OF_RANGE`, with no partial report. Even exactly representable amounts above the conservative safe-integer envelope are refused. Supporting those values through a new decimal-string API is separate work; this package never silently rounds them.

## Regression evidence

- The real PostgreSQL fixture confirms exact positive and negative JSON cent strings, including `9100000000000001` and `-9100000000000001`, and verifies service-only grants and unknown-actor denial.
- The three report APIs refuse the unsafe January cutoff. After 21 independently approved February reversals, a one-line general ledger reports the exact safe close `70000000000000.01`. Historical January still refuses. Same-year trial balance still refuses its unsafe gross turnover; next-year opening totals and financial statements report the exact safe net and remain balanced.
- Unit fixtures bracket safe-integer and dollar-serialization boundaries, both signs, malformed input, cross-account totals and large cancellation to one cent. Three HTTP regressions assert the coded 422 body.
- One intermediate fixture run had four passed and one failed because its refusal assertion ran after reversals made the statement safely representable. Explicit historical cutoffs corrected that fixture; no implementation weakening was needed.

## Commands and results

- `npm.cmd run test:db -- src/tests-db/phase15Precision.db.test.ts`: initial 3 failed before correction; final 5 passed (12.55 seconds).
- `npm.cmd test -- src/tests/reportMoneyPrecision.test.ts src/tests/ledgerMemoryWorkflows.test.ts src/tests/phase15Reporting.test.ts src/tests/durableLedgerSql.test.ts src/tests/durableLedgerHttp.test.ts`: 62 passed before adding the three HTTP cases.
- `npm.cmd test -- src/tests/reportMoneyPrecision.test.ts src/tests/durableLedgerHttp.test.ts`: 34 passed after adding those cases.
- `node scripts/staging/migration-manifest.mjs --write`, `node scripts/staging/migration-review-bundle.mjs --write`, `node scripts/migrations/build-migration-manifest.mjs`: offline artifacts regenerated; 71 executable/review entries and 72 audit entries including the separate draft.
- `npm.cmd run staging:migration:release-candidate`: PASS, 71 canonical/review entries, 46 replay-safe proposals, matching fingerprint `40008fe32fc37d52669afc3e12bfd88659f56e404bb7a49a9976df2478fbd29a`. Both databases passed RLS/search-path smoke checks; 13 historical NOT VALID constraints remain reported.
- `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/03-ledger-b2t-cases.e2e.test.ts`: 4 passed (26.98 seconds), installed Edge with synthetic users and loopback PostgreSQL.
- `npm.cmd run security:secrets`: PASS at the validation checkpoint, 1,464 text files, 108 binary skips, zero findings.
- `node scripts/verify-local-traceability.mjs`: PASS; 230 requirements, no release authorization or full browser acceptance.

- `npm.cmd test`: 5,748 passed across 347 files, zero failures (339.89 seconds).
- `npm.cmd run test:db`: 66 passed across 18 files, zero failures (338.42 seconds).
- `npm.cmd run typecheck` and `npm.cmd run build`: passed, including client and server build outputs.
- Complete staged diff reviewed; `git diff --cached --check`: passed.

## Limits and gates

No hosted database, deployment, financial transaction, credentials, security policy or tax policy was changed. Both Phase 15 proposals require separately approved application and server sequencing. This package covers the three canonical ledger reports and their shared calculation functions; other monetary domains and legacy engine paths are not certified. A report that must display an unrepresentable historical running balance is refused even if its latest closing balance is safe; a bounded report containing only safe output values can succeed. Whole-product/provider browser acceptance and large-history performance remain unverified. All original untracked paths remain preserved.
