# C9 — Client document review metadata confidentiality

## Defect and enforcement

The original shared SQL serializer returned `reviewedBy`, `reviewNote`, staff uploader
identity, review/scan timestamps and document hashes to clients. Document detail also
returned internal audit actor identities. Hiding these fields in React did not protect
HTTP responses or direct database RPC results.

The new additive review-only proposal uses a closed client document projection in both
list and detail. The database resolves the canonical member/ownership/assignment with
`taxguard_doc_actor`; there is no caller-selected staff projection flag. Clients receive
document identifiers, version, engagement/year/category, file metadata, public status,
created time and row version. Internal history and OCR proposals are empty arrays.
Pending registrations and another uploader's malware-blocked versions are excluded from
client detail consistently with list. Staff retain the full serializer and custody order.

The HTTP router independently allows only the same scalar fields, with empty history
and extraction arrays. It protects clients even against an older database response or
an accidentally expanded serializer, including nested unexpected values. Session role
comes from authenticated middleware; query role/actor/field flags cannot enable metadata.

Existing lockdown denies browser roles direct tables, raw serializers and actor-argument
RPCs. New helper execution is revoked from PUBLIC, anon, authenticated and service_role;
only owner-called definer readers invoke the pure SECURITY INVOKER helper. Reader and
review RPCs are service-only, retain pinned search paths, and recheck canonical authority.
The server-only service credential remains part of the trusted boundary; no permission
is granted to browser roles to impersonate an actor.

## Client-facing reasons

`client_reason` / `clientReason` is explicit staff-authorized outward text for rejected
or replacement-requested versions. The staff UI labels separate internal and client
fields, requiring a client reason for either negative decision. The new review RPC
validates reason length/status and delegates existing maker/checker, version, quarantine
and status checks in one transaction. Client list/detail retain each historical version's
authorized reason, and React displays only that field. Approval notes remain private.

Historical `review_note` has no reliable audience marker. It is never automatically
copied to a public field, even on rejected documents. The legacy service-only RPC remains
private-note only. Before any external application, the owner must review historical
negative decisions and explicitly authorize outward reasons; ambiguous notes cannot be
treated as public. Existing document-request instructions and waiver/replacement workflows
are unchanged. No hosted data was read or migrated to classify historical text.

## Regression evidence and rollout limit

- Direct HTTP tests use a deliberately leaking store, malicious query flags, client and
  prospective-client sessions, nested internal data and authorized staff responses.
- Database-backed HTTP tests prove a public replacement reason survives while notes,
  reviewer identities and internal history do not.
- Actual disposable PostgreSQL tests call list/detail under service_role for the canonical
  client actor, test each negative reason and all historical versions, preserve staff
  visibility, reject client/tenant/assignment/membership bypasses, deny browser table/raw
  serializer/forged-actor RPC access and check catalog function ACLs/search paths.
- Browser regression enters separate internal/public text through staff review and checks
  raw client list/detail responses and visible public reason.

Migration generated with `supabase migration new`, moved into proposed-migrations and
ordered after the custody/lockdown overlays in the explicit DAG. Historical migration SQL
is unchanged. Regenerated review packet and catalog audits remain review-only, NOT_APPLIED.
Validation uses synthetic loopback PostgreSQL and an emulated scanner only. The local
catalog ACL/RLS checks are used instead of a hosted Supabase advisor; no hosted project
or production Supabase is contacted. This is not a deployment or migration authorization.

PR #18's reconciliation commit is `035913de5a315fd52c5c70fcf45bd5cb79c16adb`;
[its CI passed](https://github.com/OphireumTechnology/taxguard/actions/runs/38673645361).
The C9 security commit follows on that development branch. PR #20 remains conditional on
authorized integration of #18; its frontend recovery must preserve `clientReason` when
reconciled. Claude's original worktree is untouched.

## Final local validation — 2026-10-15

- Full unit/frontend/security suite: 329 files / 5,581 tests passed.
- Actual PostgreSQL suite: 16 files / 58 tests passed, including seven C9 tests.
- Full browser suite: 13 default-profile files / 70 tests and one provider-emulator
  file / eight tests passed on the final schema. No real provider was contacted.
- TypeScript/lint and frontend/server build passed.
- Migration manifest and review bundle: 62 entries; 37 replay-safe proposals passed.
  Canonical and review-packet schema fingerprint:
  `843967e677322978c00bf30d0b03ff0f6082d7bde82f6928493c6a106b8ecf47`.
  Checked catalog invariants: zero public tables without RLS, zero TaxGuard definer
  functions without pinned paths; 13 existing NOT VALID constraints remain explicit.
- Logical recovery: 141 tables / 7,193 synthetic rows; restore, restart persistence,
  billing projection, tenant isolation and audit immutability passed. Physical utilities
  and hosted recovery were not exercised by this command.
- Secret scan: 1,445 files scanned, 108 binary files skipped, no findings.
- Traceability: 215 requirements / 61 agents / 18 stages verified. AI readiness remains
  zero commissioned identities and material actions disabled.

Initial browser fixture URL/queue refresh issues and stale generated-artifact expectations
were corrected before clean full reruns. No final assertions were skipped or weakened.
GitHub CI is recorded on PR #18 after pushing. External application and release remain
unauthorized; historical review-note audience classification remains an owner review item.
