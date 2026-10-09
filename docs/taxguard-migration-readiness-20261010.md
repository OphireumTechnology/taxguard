# Database and migration readiness — isolated preparation only

Current revalidation: full 164-file / 3,105-test suite PASS, exit 0, includes the existing disposable sequence/proposal tests. No migration/proposal definitions or grants changed. Ordering, 61 DRAFT agents, core RLS, direct AI-history denial, append-only mutation/rollback and schema proposal rollback remain locally validated. Shared installation and platform/independent custody acceptance remain BLOCKED / NOT VERIFIED; see the [current gate report](taxguard-staging-verification-20261010.md).

**Shared/production migration: NOT AUTHORIZED and NOT EXECUTED.** Disposable PGlite results do not establish deployed PostgreSQL/Supabase grants, extensions, RLS, storage configuration or production readiness. Supabase CLI is unavailable; no fabricated timestamped official migration was added.

## Ordered reviewed definitions

| Order | Migration | Purpose |
| --- | --- | --- |
| 1 | 20260928000000_taxguard_core_schema.sql | Core tax entities, scope, audit and RLS |
| 2 | 20260929000000_taxguard_complete_lifecycle_schema.sql | Full lifecycle definitions |
| 3 | 20260930000000_taxguard_bookkeeping_schema.sql | Bookkeeping definitions |
| 4 | 20261001000000_taxguard_practice_operations_schema.sql | Practice operations definitions |
| 5 | 20261002000000_taxguard_storage_and_assignment_governance.sql | Storage/assignment governance |
| 6 | 20261004000000_taxguard_private_storage_client_scope.sql | Private scoped storage |
| 7 | 20261008000000_taxguard_ai_registry_foundation.sql | Default-denied AI registry |
| 8 | 20261008010000_taxguard_ai_governance_decisions.sql | Governance decision history |
| 9 | 20261008020000_taxguard_ai_orchestration_history.sql | Root/child orchestration history |
| 10 | 20261008030000_taxguard_ai_gateway_admission.sql | Gateway admission |
| 11 | 20261008040000_taxguard_ai_capability_execution.sql | Capability admission/events |
| 12 | 20261008050000_taxguard_ai_execution_ledger.sql | Immutable correlated ledger |
| 13 | 20261008060000_taxguard_ai_document_advisory_routing.sql | Bounded advisory routing |

The full sequence is applied only inside fresh disposable fixtures. Extension statements are removed for the existing PGlite harness; real platform extensions and role privileges remain a separate acceptance item. File identities/order/uniqueness, scoped joins, immutable AI history, defaults, constraints, RLS-enabled core tables and all 61 DRAFT agents are exercised locally. SHA-256 inventories and source/test evidence hashes are in the traceability JSON.

## Audit append-only proposal

`docs/sql/taxguard-audit-append-only.proposal.sql` remains outside migrations. Statement triggers reject UPDATE, DELETE and TRUNCATE CASCADE with stable sanitized errors; INSERT remains allowed. Tests use both owner and deliberately privileged synthetic service role, verify unchanged history and transaction rollback. A separate proposal rollback test confirms the existing schema lacks the guard and reverts its disposable installation without changing baseline migration state.

The guard is defense in depth, not external tamper-proof custody: owners/superusers can disable/drop triggers. It does not create tenant/year scope columns, certify audit evidence or change reader grants. Existing actor-UID audit read policy needs intended tenant/client/year/role review. No broad grants from synthetic tests belong in a migration.

## Authorized DBA/release next steps

1. Independently review all 13 checksums, dependencies, grants, default-deny policies, foreign keys, indexes and source associations in an authorized isolated platform database. Exercise anon/authenticated/service roles and cross-tenant/client/year negatives using real platform claims.
2. Use the required Supabase CLI to create an official migration for the reviewed audit proposal, with collision checks and change-control evidence. Do not replace the proposal with a guessed filename or silently amend completed migrations.
3. Define durable source/history reconciliation, legal holds, audit custody and compatibility criteria. No Map/import fallback establishes trusted durable authority.
4. Record database/vault backups and independently verify isolated restores, permissions, hashes and history. Obtain RTO/RPO and retention policy rather than inventing them.
5. Prepare additive/forward-only installation and previous-application-artifact rollback. Preserve audit/history and compatible schema; never use destructive down migrations or drop history to recover.
6. Obtain separate operator, DBA, security and release approval for installation/cutover. Leave all signoffs blank until actual review. No execution command against shared/production is supplied as authorized work here.
