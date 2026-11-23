# Fresh Supabase install: immutable legacy migration compatibility

**Review-only.** This is a fresh-project bootstrap exception, not a production migration or an authorization to change the historical SQL.

## Why normal `db push` cannot succeed

The immutable `20261002000000_taxguard_storage_and_assignment_governance.sql` tries to create/alter Supabase-owned `storage` objects and fails with SQLSTATE 42501 on hosted Supabase. A later corrective migration cannot run until that migration is accounted for. Never grant the migration role elevated access to `storage`, disable the integration guard, or edit historical migration bytes.

## Proposed reproducible bootstrap (requires independent review)

1. Target a **new, empty, isolated** Supabase project. Confirm project ref, no real users/data, private storage, and database backup/rollback plan. Never run this procedure on production or an existing customer database.
2. Verify the immutable file's SHA-256 against the reviewed main-branch file. Generate a *temporary, untracked* compatibility SQL script from that exact file by removing **only** the contiguous sections 1–2 (the managed Storage DDL); fail if section markers or expected checksum differ. Do not change sections 3–5 or the original tracked file.
3. Apply baseline migrations through `20261001000000` in source order, then execute the generated compatibility SQL in a transaction. Check both assignment RPCs and application RLS policies exist.
4. **Only after** the compatibility SQL succeeds, mark `20261002000000` as applied using the supported Supabase CLI `migration repair --status applied` workflow for the isolated project. Record the SHA-256, exact SQL diff, target project ref, operator and verification evidence. The repaired history must explicitly note that the managed Storage DDL was intentionally omitted; do not misrepresent it as having executed.
5. Provision `taxguard-vault` via the Supabase Storage API/dashboard, with `public=false`, 26214400-byte file limit and PDF/JPEG/PNG/XLSX/CSV MIME allowlist. No public or blanket authenticated access.
6. Apply `20261004000000` and subsequent migrations, including `20261123000000_taxguard_assignment_rpc_hardening.sql`, in order. Note that the October 4 migration itself creates policies on `storage.objects`; validate that the project's migration role has required privileges. If not, STOP and prepare a separately reviewed supported Storage-policy provisioning step; do not grant blanket schema privileges.
7. Verify anonymous RPC EXECUTE is denied, authenticated RPCs cannot inspect another user/tenant, unauthenticated vault access is denied, cross-tenant object access is denied, legitimate scoped client read succeeds, direct authenticated writes are denied, and service-role operations are audited.
8. Capture CI, SQL and Storage API evidence in PR #83. Merge only after explicit owner approval.

**No acceptance claim** until a *fresh* project has completed this procedure. Current staging `kypaordrnbziagfuxnet` is not clean because earlier migrations were already applied.

## Non-negotiable

Never alter historical migration bytes, bypass `MIGRATION_IMMUTABLE`, rewrite production migration history, copy production data, or test recovery email/MFA under PR #83.
