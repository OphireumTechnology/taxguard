# Human proposal review test lifecycle diagnosis

The reported 20-minute focused-test stall was manually interrupted. Existing work was preserved. No test assertions were weakened, skipped or removed, and no production database/provider was accessed.

## Observed evidence

Before changes, the exact focused file passed all 32 tests and Vitest exited code 0 in 5.8 seconds with verbose and hanging-process reporters. After lifecycle hardening, the focused file plus cleanup regression passed 33 tests and exited code 0 in 6.7 seconds. No hanging-process report or residual Vitest/vite-node process was found. The original long stall is not reproducible from the current tree; its exact historical cause is not established.

Inspected human review test/service, capability fixture, governance store/control plane, model resolver, gateway admission store, orchestration ledger and structured validation. The invoked path uses local PGlite transactions, bounded SQL, synthetic session verification and admission metadata. It does not invoke a provider/gateway transport, network request, recursive coordinator, polling/retry loop or pending mocked transport promise. Transactions await all operations; the scoped governance load inside the review transaction reuses that transaction rather than opening a nested database transaction. afterAll awaits database close. Concurrent-decision tests serialize through PGlite and terminate.

## Confirmed defect and repair

capabilityFixture previously allocated PGlite before migration/seed initialization without cleanup on initialization error. If beforeAll failed before assignment to its owner, afterAll could not access that database. The fixture now closes its allocation on failure and preserves the initialization error; a cleanup failure is reported with both causes. A dedicated test forces initialization rejection on a real PGlite instance and asserts close called exactly once and closed=true. Audit history and successful fixture ownership remain unchanged.

This is a real cleanup defect, but it is not proven to have caused the original stall. No invented deadlock/provider diagnosis is claimed.

The full suite has many SQL/WASM fixtures. vitest.config.ts now limits worker fan-out to two (the already successful full-regression setting); test-level concurrency checks still execute concurrent operations. This is resource budgeting, not a timeout workaround for a security assertion. Focused diagnostic timeouts were finite and all tests completed well within them; suite test/hook deadlines were not enlarged or assertions altered.

## Validation/resume

Related human review/lifecycle/governance/A00/gateway/capability/persistence/ledger tests exited code 0 and left no Vitest process. Complete npm.cmd test passed 129 files / 2,524 tests and exited code 0 in 62 seconds. Typecheck, configured lint, frontend/server build, diff/new-file whitespace checks and final Vitest-process checks passed. Existing chunk/mixed-import build warnings remain. Work resumed at AI-15 human-only review service validation/report; final approval and production cutover remain explicitly unavailable.
