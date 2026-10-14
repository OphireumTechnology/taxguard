# Phase 11 execution checkpoint

Baseline `origin/main`: `49369c393d6391c9de9e3ecd869bf79736c6990c`.
Phase 10 PR #15 remains open/draft; commit `f0549efc4ac67d97258402f51af589772bd0a412`
is preserved. Phase 11 branch `codex/taxguard-phase11-completion` depends on that commit;
no automatic merge, rebase, force push, deployment or external database operation.

Slice 1: proposal 047 adds committed security-event handoff, protected immutable envelopes,
bounded pending and per-minute ingestion, idempotent delivery, SKIP LOCKED concurrent dispatch,
bounded retries and retained blocked records. Runtime uses outbox mode only in the existing
approved non-production boundary. Awaited `recordDurably` is acknowledged after the independent
RPC commits. Delivery and completion occur together in a database transaction. HTTP finish-hook
observations remain best-effort before enqueue acknowledgement; database outages reject durable
acknowledgement and increment failure metrics. No exactly-once delivery claim. Previously
acknowledged rows survive producer/database restart and are not deleted by retry or business rollback.

PGlite focused recorder/outbox: two files, nine tests PASS. Real PostgreSQL: ten files, 33 tests
PASS, including fsync-on restart and multi-session validation. PostgreSQL instances are disposable and bind only to 127.0.0.1.
Tax stages 9–18, AI-16 and all external commissioning remain blocked.
# Slice 2: migration integrity, collection authority and vault jobs

Added proposals 048–052 without rewriting historical migrations. The explicit dependency plan and normalized SHA-256 manifest cover every file; schema fingerprints detect grant/constraint drift and require exact reapplication equivalence. Proposal 051 normalizes the historical MFA type-alteration casts and removes default public execution from two tax-rule trigger helpers. Its constraint/index rebuild requires a scheduled table lock; all proposal application remains local-only.

Billing pages preserve allowlisted client fields and exact total balances. Browser reads pin the session across bounded pages and reject duplicates or incomplete responses. Intake drafts, waiver claims and human clarification/amendment requests now persist with engagement/year scope, immutable history and optimistic revisions. Waiver claims never waive a requirement or advance a stage. Ambiguous engagement scope returns a controlled error rather than inventing an engagement.

Scanner jobs persist one-use correlation, deadline, hash, object path and version. Signed adapters bind request IDs; old unbound service execution is revoked. Expired, forged, mismatched or competing verdicts cannot release quarantine. Fake scanners cannot release production uploads. Diagnostics now require an active administrator session with verified AAL2 before any probe; public liveness reveals no provider configuration. HTTP counters contain no request labels or payloads.

Focused evidence: collection 4 tests; document/scanner 31 tests; billing/dashboard/manifest 15 tests; protected metrics/security/production 21 tests; real PostgreSQL composition/concurrency/Phase 11 boundaries 3 files, 20 tests. Typecheck passed before the final observability additions; full validation remains pending. Backup discovery found neither pg_dump nor pg_restore in PATH, installed PostgreSQL directories or bundled binaries; no restore rehearsal is claimed. Tool discovery and safe failure are tested.
