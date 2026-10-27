# Public-schema ownership and privilege recovery fingerprint

The existing local fingerprint covered columns, constraints, function definitions/ACLs,
table ACLs/RLS, policies, indexes, default privileges and triggers. It omitted schema
ownership, schema ACLs and effective schema access. The initial regression run reproduced
eight failures among ten scenarios against the old implementation; two canonicalization
controls passed.

## Added representation

Three read-only groups now cover `public`:

- `schemaOwnership`: schema and owner role names.
- `schemaGrants`: grantor, grantee (including PUBLIC), privilege and grant option.
- `schemaPrivileges`: effective USAGE/CREATE and both grant options for each catalog role.

`aclexplode` decodes ACLs; `acldefault` expands null ACLs to equivalent explicit grants.
Role names replace OIDs in output; explicit C-collation ordering stabilizes grants and
roles independently of ACL storage order. `has_schema_privilege` checks effective access,
including immediately inherited, PUBLIC, owner and superuser access according to PostgreSQL
semantics. See the [PostgreSQL 17 catalog-function reference](https://www.postgresql.org/docs/17/functions-info.html).

Only catalog SELECTs were added to the helper. Existing RLS, tenant policies, security-definer
functions, pinned paths and privileges are unchanged. Synthetic tests mutate disposable
fixtures in transactions and verify exact fingerprint restoration after rollback. Catalog
query failures propagate rather than returning a partial fingerprint.

## Scope and compatibility

Scope remains `public`. This detects drift; it does not decide whether a change was approved,
audit all role-membership/SET ROLE paths or other schemas, or prove physical/provider recovery.
Role inventory/names and PostgreSQL version should match source and target; role inventory
changes intentionally affect the hash. No role passwords, taxpayer rows, credentials or
database URLs are recorded.

The new groups intentionally change old digest values. Compare source and target with the
same helper version. Historical digests are not evidence of acceptance of this format.
Existing logical/archive recovery and migration composition callers automatically include
the new groups. No migration, shared manifest or generated traceability artifact changed.

## Validation

```powershell
node --experimental-strip-types scripts/staging/test-schema-fingerprint.mjs
```

All **14 scenarios passed** using in-process PGlite, with none skipped. Node TAP includes
the enclosing test for 15 total passes. Scenarios cover ownership, USAGE/CREATE, PUBLIC,
grant options, inheritance/revocation, grant ordering, implicit/explicit ACL equivalence,
changed role OIDs, catalog errors, tenant filtering, denied SECURITY DEFINER execution,
and rollback parity. These execute SQL except the intentional query-failure scenario.

The same scenarios are registered in the regular unit and disposable PostgreSQL suites:

```powershell
npm.cmd test -- src/tests/schemaFingerprint.test.ts
npm.cmd run test:db -- src/tests-db/schemaFingerprint.db.test.ts
```

Both targeted suites were attempted using the installed Vitest CLI and stopped before
test collection at the existing `spawn EPERM` boundary. Full Vite build was attempted and
also blocked at startup. These are not passing acceptance checks.

Supported checks: typecheck, offline migration manifest/review bundle, 15 prior tax-contract
assertions, whitespace and runner syntax passed. The server bundle also built successfully
by invoking the installed esbuild executable directly from PowerShell with the standard
server build arguments; this does not establish a passing full frontend/server build.
The supplemental secret scan uses the existing scanner patterns with a Git file inventory
obtained directly from PowerShell because the scanner cannot spawn Git in this session.
It passed with 1,455 text files scanned, 108 binary files skipped and zero findings.

PGlite does not replace standalone PostgreSQL, full composition/recovery or archive restore
acceptance. Normal publication remains blocked by the previously documented Git transport
restriction. No proxy, sandbox setting or other developer branch changed. Staging and
production remain NO-GO.

## Ownership (completed during the 2026-10-27 integration)

The fingerprint also records the named owner of every function and relation. A SECURITY DEFINER function runs
with its owner's authority even when its definition is identical, and relation ownership carries authority a
null ACL does not show. Materialized views and foreign tables join tables, partitioned tables, sequences and
views in the relation inventory. Three synthetic scenarios cover table ownership with implicit ACLs and intact
RLS, a SECURITY DEFINER owner change with an identical body, and materialized-view ownership. Digest values change
with this version: the source and restore must use the same helper. It remains a drift detector, not a complete
effective-access audit. Codex wrote this extension in `backend-completion` (uncommitted, 2026-10-18) but could not
run its tests there; `schemaFingerprint.test`, `schemaFingerprint.db`, `backupRestore.db` and the release
candidate pass on the integration branch.
