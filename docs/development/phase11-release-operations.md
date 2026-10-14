# Phase 11 offline release and recovery preparation

This is an implementation/runbook checkpoint, not deployment authorization. Staging and production are NO-GO. No real project, customer data, live processor, scanner or model is commissioned.

## Hosting boundary

Build the static frontend and Node server with `npm run build`. Serve static assets independently or through the reviewed Node runtime; never publish `build/server.cjs`, source maps, server source or secret files. Existing server build-artifact protection and API-only fallback remain controlling. Pages is insufficient for API hosting.

Use `docs/development/staging.env.template` as field names for a dedicated secret store. Service-role, scanner and model secrets belong only to the API runtime; the frontend receives public configuration only. Validate candidate values offline with `scripts/staging/check-staging-config.ts`. Configuration success never grants release authority. Keep all live payment, tax filing/signature, AI-16, OCR and uncommissioned scanning flags closed. Default proxy trust is zero; approve ingress isolation and overwritten forwarding headers before setting `TAXGUARD_TRUST_PROXY_HOPS`.

The existing `NODE_ENV=production` API boundary intentionally does not mount the development-only practice/ledger/vault/billing workflows. Do not use `NODE_ENV=development` as a staging shortcut: it includes local authentication fixtures. A reviewed production-mode staging runtime cutover, dedicated origins, provider identity and acceptance tests remain prerequisites. CI files added here run validation only and contain no deploy jobs or environment secrets.

## Migration review, upgrade and drift

`migration-execution-order.json` is the explicit dependency DAG; `staging-migration-manifest.json` contains canonical LF SHA-256 file hashes, the execution-plan hash, superseded function declarations, grants and NOT VALID counts. Static references are review aids, not a SQL parser. `migration-order.mjs` rejects cycles, missing dependencies, duplicate/unrecognized paths and incomplete coverage.

Preserve historical 000–011 and 023–046 proposals. Their invalid timestamp prefixes require a separately reviewed CLI conversion with a source-to-bundle checksum mapping. New valid-timestamp proposals 047–052 are unapplied. Real local PostgreSQL tests compose the entire manifest; proposals 023 onward are reapplied and required to produce an identical schema fingerprint. Historical core/early proposal reapplication is not claimed safe for a live database. `schema-fingerprint.ts` includes columns, constraint validation state, function definitions/search paths/ACLs, RLS, indexes, policies and triggers; it excludes rows and credentials. A restored local database can be compared to its own baseline without contacting external projects.

Each SQL file is submitted as one multi-statement PostgreSQL query; failures identify the file and database error. Proposal 051 explicitly wraps its equivalent constraint/index reconstruction in a transaction. Approve maintenance locks and test invalid legacy rows before any future external application. Do not partially proceed after a migration error. No automatic external migration runner is supplied.

For every NOT VALID constraint, inspect synthetic/approved restored data for violations, repair only through an approved data plan, then approve `VALIDATE CONSTRAINT` separately. NOT VALID still enforces new rows. Unscoped historical collection requests remain inaccessible, and are not silently assigned to an engagement/year. Never weaken a constraint to pass an upgrade. Review uniqueness/FKs and raw-table service/browser grants on the composed schema, including superseded overloads.

Rollback should disable the affected APIs/dispatcher and restore the prior reviewed application artifact while preserving outbox, audit, scan jobs, questionnaire revisions, replies and financial history. Do not drop custody tables or restore insecure raw grants. If the previous artifact requires an unbound scanner grant, keep scanning disabled instead. Restore from a verified separate backup when a schema rollback cannot preserve invariants; owner approves destructive restoration. Never run these steps against the protected production project in this task.

## Security-event delivery and retention

Only awaited `recordDurably` acknowledges a committed independent handoff. Caller retries use the same server-owned UUID and immutable event tuple. Finish-hook observations are best-effort until enqueue commits; a process crash before that point may lose them. Database outages reject durable acknowledgment and increment failure counters. Bounded producers reject backpressure, the database caps undelivered rows and ingestion rate, and dispatch retries back off up to eight attempts. Blocked rows are retained, never silently deleted. Delivery and audit insertion commit together; concurrent dispatch uses SKIP LOCKED. UUID deduplication supports idempotent delivery, not an exactly-once transport claim.

Alert on producer failures/drops, dispatch failures, blocked rows and oldest pending age. Protected `/api/operational-metrics` reports process counters; approved non-production outbox mode also queries durable tenant-scoped counts. Process-local counters reset on restart and are not audit custody. Raw credentials, cookies, tokens, IPs, taxpayer fields, MFA factors and free-form event details are excluded from durable ingestion. Unauthenticated refusals use server-configured tenant attribution and no supplied actor identity. Retention/redrive requires owner policy; no purge job is enabled.

## Scanner acceptance

Upload bytes are copied before asynchronous calls; storage is private/write-once and the server verifies MIME signature, size and SHA-256. Persisted jobs bind the exact document row/version/hash/path, request UUID, scanner and issuance time, with a 60-second deadline. Signed transport validates request/digest/timestamp/signature and a monotonic timeout. Competing verdicts serialize and consumption is one-use. Expired, missing, forged, mismatched or replayed verdicts cannot release quarantine. Scan failures remain pending; this version requires a new upload version for rescanning an expired job. Provider redrive is a commissioning dependency.

Local fake detection is not real malware detection. No approved production scanner factory exists; an injected fake CLEAN scanner cannot release production bytes. Staff review, object authorization and download audit remain separate gates. Commission signed authenticated TLS transport and key rotation independently before considering real clean-release acceptance.

## Backup/restore prerequisites and procedure

Discovery checks explicit absolute `TAXGUARD_PG_DUMP_BIN` / `TAXGUARD_PG_RESTORE_BIN`, PATH and existing Windows PostgreSQL installation roots. This workspace's bundled server binaries do not include these tools. Missing tools return `BACKUP_TOOLS_REQUIRED`; no rehearsal, backup duration or recovery claim is fabricated. Compatible PostgreSQL 17 client tools must be supplied/installed through a separately authorized host action. No system-wide installation was attempted.

`npm run staging:backup:local` accepts no target URL and refuses configured Supabase projects or local environment files. It creates its own random-port 127.0.0.1 PostgreSQL server and a separate restore database, passes the random password only through the child environment, and removes the archive afterward. It compares complete synthetic table contents, grants, RLS, function definitions and schema fingerprints (including constraints/policies/triggers), verifies audit immutability, and reports duration only after successful restore. It never reads an external backup. Real recovery must additionally address private vault object versions, provider identity/MFA state, secret rotation, audit custody and approved RPO/RTO.

## Incident response and release acceptance

Public health provides liveness only, with no provider/key/schema details. Diagnostic routes require a verified active administrator AAL2 session before probes. Monitor 4xx/5xx rates, aborted requests and bounded latency buckets without URL, client or query labels. Sanitize operational failures; do not log tokens or provider error bodies. Database/readiness outages return controlled errors. On suspected compromise, restrict ingress, revoke affected sessions through authorized durable identity controls, activate governed kill switches, retain evidence and quarantine documents; do not bypass practitioner gates.

Before staging GO: approved isolated project/host/origins and managed secrets; reviewed migration bundle and constraints; synthetic tenant provisioning; real-provider MFA enrollment/recovery acceptance; private storage and scanner acceptance or explicit quarantine-only scope; monitoring/custody; successful backup/restore including storage/identity; reviewed runtime cutover; independent tenant/object authorization and browser journeys; owner release approval. Before production GO: additionally professional tax rules, lawful retention, capacity/security review and every commissioned material integration. Stages 9–18 and AI-16 stay blocked regardless of staging infrastructure progress.
