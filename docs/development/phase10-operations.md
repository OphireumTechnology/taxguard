# Phase 10 operational preparation

Local preparation only. Staging is NOT VALIDATED and production remains NO-GO. No external
database, deployment, live filing, payments or document transmission is authorized by these files.

## Migration review and rollback

`node scripts/staging/migration-manifest.mjs` verifies the checked-in canonical manifest; `--write`
regenerates it after reviewed SQL changes. All 13 core files and 36 proposal files are included.
Hashes use canonical LF text to preserve reviewed content identity across Windows and Linux.
The conservative dependency chain is the actual composed execution order, not arbitrary timestamp
sorting across directories. Static object references, replaced function names, grants/revocations,
NOT VALID constraints and rollback headers are review aids. Real PostgreSQL composition verifies
effective final function privileges and search paths. Proposal prefixes 024–046 are logical ordering
identifiers, not valid Supabase CLI timestamps. They must be converted with official migration tooling
after review; do not copy them directly into CLI history. Do not alter historical migration identities.

Before an owner applies anything externally: review every SQL file and final privileges, approve
authorization scope, take a backup, test a restored copy, validate historical NOT VALID constraints,
and record canonical source hashes. The separate `docs/sql/taxguard-audit-append-only.proposal.sql`
is excluded from composition; general audit immutability still needs owner-reviewed migration.
Phase 10 protects SECURITY rows against UPDATE/DELETE and blocks audit truncation in proposal 046.

Rollback is a service shutdown plus restored backup or a reviewed forward corrective migration.
Do not blindly run proposal 028 or 041 over later changes: replacing a function may undo security
fixes. Billing confidentiality must remain enforced; if rollback cannot preserve it, disable billing.
For security ingestion, stop the producer first. Preserve audit rows and custody; dropping the
ingestion function alone must not drop immutable triggers or delete events. Data-bearing tables
are never automatically dropped. Owners must approve retention and legal hold policies.

## Backup/restore rehearsal

`scripts/staging/backup-rehearsal.ts` creates its own synthetic disposable PostgreSQL server, dumps
it, restores into a second database on the same loopback server, compares all public table content
hashes, RLS/ACL metadata and function definitions/grants, checks durable audit metadata and verifies restored immutability. It never
accepts an external target. PostgreSQL 17+ `pg_dump` and `pg_restore` binaries are prerequisites:
set `TAXGUARD_PG_DUMP_BIN` and `TAXGUARD_PG_RESTORE_BIN` to absolute executable paths, then run
`node node_modules/tsx/dist/cli.mjs scripts/staging/backup-rehearsal.ts`. The bundled embedded server
does not include these two utilities; absent tools produce a refusal, not a fake backup PASS.

An eventual staging rehearsal also needs storage-object backup, identity-provider recovery,
secret-store recovery, independent custody, encryption, RPO/RTO decisions and measured recovery
timing. This local SQL rehearsal does not establish those provider guarantees.

## Runtime and observability

Offline configuration assessment refuses the protected project, mixed project URLs, shared public
and private keys, client secrets, live-action flags and uncommissioned AI/scanning flags. Run
`check-staging-config.ts` without loading `.env`; output contains field codes only. The synthetic seed
generator remains offline and uses `example.test` accounts; its SQL is tested only locally.

`TAXGUARD_LEGACY_ROUTES=retired` closes replaced legacy endpoints with HTTP 410. Durable development
mode retires them automatically. Stage two/three, careers, integration commissioning, calendar and
other unfinished features remain preserved. Existing production routing remains closed to new
development-only features. A production-mode staging deployment therefore still requires a reviewed
runtime integration decision; setting environment flags does not make these routes commissioned.

`TAXGUARD_SECURITY_EVENTS=durable` activates the legacy denial bridge only under the approved
non-production durable boundary. The database accepts service-role ingestion only, validates the
tenant and actor, permits seven event categories, deduplicates server UUIDs and limits each tenant
to 1,200 ingested events per minute. The queue holds at most 100 pending writes. Pending events are
volatile; abrupt process termination or a database/network outage may lose events. Counters distinguish
persisted/failed/dropped/pending and must alert on any failure/drop or sustained pending growth.
Administrative material actions retain their existing transactional audit writes. Successful ingestion
is durable; this bridge is not a transactional outbox or a claim of complete security-event custody.

Ship sanitized counters and stable codes, never raw request bodies, IPs, credentials, TOTP factors,
provider payloads or taxpayer documents. Alert on 5xx, denied-access spikes, ingestion failure/drop,
quarantine backlog and scanner timeouts. Restrict detailed metrics to administrators. Define retention,
legal holds, archival custody and on-call escalation before commissioning; do not add automatic deletion.

## Scanner commissioning and MFA

The authenticated adapter requires a 32-byte secret, one random nonce per request, SHA-256 document
binding, domain-separated HMAC request/verdict signatures, exact nonce/hash/time matching, bounded
timeouts and cancellation. Unknown, forged, stale, replayed, failed or timed-out verdicts never mark a
document CLEAN. Fake transports are local tests only. A real transport must use authenticated TLS,
honor AbortSignal, protect key custody, meet privacy/retention requirements and be approved separately.
No adapter is automatically attached to an external scanner; uploads remain quarantined by default.

The existing MFA provider validator remains target-guarded and requires dedicated non-production
credentials plus explicit confirmation. Its execution mutates an external synthetic account, so it
is not run in Phase 10. Use only the loopback provider-emulator tests in this development run.

## Release checklist

1. Local unit, PostgreSQL, default/provider browser, typecheck/lint, build, traceability and secret checks pass.
2. Independent review approves final SQL, security boundaries and proposal conversion.
3. Owner provisions isolated staging and manages secrets; protected production remains excluded.
4. Owner approves external migration, storage/scanner, MFA validation and backup/restore activities.
5. Staging-only acceptance and operational evidence satisfy defined recovery and monitoring criteria.
6. Human review, AI-16 denial, zero commissioned agents and blocked tax stages 9–18 remain enforced.
7. Owner separately approves any staging deployment. Production commissioning is a later decision.
