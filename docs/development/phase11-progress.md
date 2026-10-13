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
