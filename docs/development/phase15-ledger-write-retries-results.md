# Phase 15 ledger posting and reversal retries

Branch: `codex/taxguard-phase15-ledger-write-retries`, based on draft PR 31 plus CI fixture repair `5f4276a`.

## Measured defects and correction

`npm.cmd run test:db -- src/tests-db/ledgerWriteRetries.db.test.ts` initially failed both cases: eight identical posting callers encountered `LEDGER_CONCURRENT_UPDATE`; eight identical reversal callers encountered `ENTRY_ALREADY_REVERSED`. Scoped uniqueness prevented duplicate entries but the replay check raced with first submission.

Unapplied proposal `20261019040000_taxguard_ledger_write_retries.sql` adds coordinated service-only entry points sharing a transaction lock on JSON-framed tenant/client/key. Active authorization is checked before and after waiting, then the original business implementation performs its existing hash, period, integer-cent and review checks. Original uncoordinated entry points and the lock helper become internal, inaccessible to API/service roles. `SqlLedgerStore` uses the coordinated RPCs; its HTTP/API shapes remain unchanged. Identical callers return one entry and one creation audit; conflicting hashes still return 409.

A real service-role commit exposed a separate defect: the deferred balance trigger ran after RPC definer context ended and failed reading `taxguard_ledger_lines`. The proposal gives that private, already path-pinned trigger definer execution without changing its balance logic or granting raw table access. Tests prove balanced service-role commits succeed and an unbalanced 1001/1000-cent fixture is still rejected at COMMIT with `LEDGER_ENTRY_UNBALANCED`, leaving no row. No hosted permission change was executed.

## Validation

| Exact command | Measured result |
| --- | --- |
| `npm.cmd run test:db -- src/tests-db/ledgerWriteRetries.db.test.ts` baseline | 0 passed, 2 failed |
| Same command with expanded service-role coverage before trigger correction | 8 passed, 1 failed: deferred trigger read permission |
| Same command after trigger correction and additional invariant test | 10 passed: duplicate/concurrent conflicts, reversal approval/cutoffs, correction replacement, rollback, scope/revocation, service entry points, deferred unbalanced rejection |
| `npm.cmd test` | 5789 passed, 349 files |
| `npm.cmd test -- migrationReadinessAudit migrationReviewBundle migrationDependencyOrder traceabilityEvidenceIntegrity` after settled SQL metadata | 36 passed, 4 files |
| `npm.cmd run test:db` initial | 105 passed, 2 failed: service commit defect and canonical/review comparison spanning SQL regeneration; final settled rerun recorded before commit |
| `npm.cmd run test:db` final settled rerun | 108 passed, 23 files |
| `npm.cmd run typecheck` | Passed, including final fixture/recovery correction |
| `npm.cmd run build` | Passed |
| `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/03-ledger-b2t-cases.e2e.test.ts` | 4 passed |
| `npm.cmd run staging:migration:release-candidate` after settled proposal | PASS; 76 canonical/review entries, 51 replay-safe proposals; identical fingerprint `01695d8ae779801bf5d882f6411fb28643560f637025677a1c81ff43e7473577`; no external database access |
| `npm.cmd run staging:recovery:local` | LOGICAL_ROW_ROUNDTRIP_PASS; schema/tenant isolation, restart persistence, billing projection and security audit immutability passed; no archive retained |
| `npm.cmd run security:secrets` | PASS, zero findings |
| `node scripts/verify-local-traceability.mjs` | PASS, 230 requirements, release unauthorized |

The recovery rehearsal initially failed in PR 31 CI because its line fixture lacked the newly required billing key. Commit `5f4276a` updates that one fixture and was pushed normally to PR 31 independently of this pending ledger implementation. No ledger files were included in that repair commit. Historical SQL and all original untracked paths remain preserved.

## Limits

Replays retain the original ledger API behavior of returning the current entry state/identity; an approved reversal or correction does not become a second posting. Same-key requests from a currently authorized actor retain existing ledger authorization semantics; no new business ownership rule was invented. Different-key requests remain distinct intents and existing one-live-reversal guards still apply. Lock timeouts/deadlocks retain explicit existing retryable errors; no automatic unbounded retry was added.

Audit custody, owner append-only restrictions and independent anchoring remain review proposals. This package does not commission a tamper-evident archive or alter compliance policy. No hosted migration, deployment, merge or real transaction. Staging/production remain **NO-GO**.
