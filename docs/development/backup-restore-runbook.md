# Backup, restore, rollback and recovery runbook (Phase 10)

**Status:** procedures written and rehearsed on **disposable local PostgreSQL only**. No hosted project
has been backed up, restored or reset. Never reset or restore a real Supabase project without the
owner's written authorization; never touch the protected production project `cvrlhixxczerytiocxid`.

## What is rehearsed locally (and how)

| Capability | Tool | Evidence |
|---|---|---|
| Environment recreation from the migration manifest | `src/tests-db/harness.ts` composes a fresh server in manifest order | every `src/tests-db` suite |
| Logical backup with per-table row counts and SHA-256 checksums | `scripts/backup/logical-backup.mjs` (`exportDatabase`) | `backupRestore.db.test.ts` |
| Backup integrity verification (tampering, truncation) | `verifyBackupIntegrity` | same |
| Restore into a recreated schema, then verification | `restoreDatabase` (loopback + `disposable: true` only), `compareWithManifest` | same |
| Refusal of a corrupt backup or a mismatched schema, target unchanged | same | same |
| Migration rollback and re-apply (047, 048, 050), data unchanged | `docs/proposed-migrations/rollback/*.rollback.sql` | same |

Measured locally (synthetic volume, 136 tables): export ≈ 0.3 s, restore ≈ 1.1 s. These numbers say
nothing about a hosted project; they only show the procedure works end to end.

The library refuses non-loopback connections (`BACKUP_REHEARSAL_LOOPBACK_ONLY`) and refuses to restore
unless the caller declares the target disposable. It never prints row contents.

## Phase 12 offline recovery acceptance

Run `npm run staging:recovery:local` without arguments. The command creates two disposable
loopback PostgreSQL servers with durability enabled, seeds an independently approved synthetic
invoice and security audit, restores all rows into the second server, then stops and restarts
that server. It checks table counts/checksums and schema parity after restart, the exact
`251.00` issued invoice client projection, cross-tenant denial and security audit immutability.
The command runs in both development PR CI and the manual Windows offline-readiness workflow.
It retains no archive and reports only aggregate measurements.

Both this command and `npm run staging:backup:local` reject target arguments, ambient Supabase,
database URL and libpq variables (including service/pass files), and custom test database
directories before importing the database harness. Existing `.env` files are also refused.
Explicit `TAXGUARD_PG_DUMP_BIN` / `TAXGUARD_PG_RESTORE_BIN` utility paths remain supported by
the physical utility rehearsal. Neither command loads a hosted project or grants restore authority.

Logical recovery does not test physical `pg_dump`/`pg_restore`, hosted point-in-time recovery,
document bucket recovery, disaster recovery objectives or real identity/provider continuity.
Those remain separate, unvalidated commissioning gates.

## Hosted backups (staging; owner actions)

1. **Provider backups.** Enable daily backups and, if the plan allows, point-in-time recovery (PITR) on
   the staging project. Record the retention period. The application does not implement its own
   hosted backup.
2. **Document storage.** Supabase Storage objects are *not* included in database backups. The vault is
   write-once (no overwrite: `upsert: false`; every version has its own path), so recovery means copying
   the bucket. Schedule a bucket copy to separate storage owned by the practice, with the same retention.
   Object paths are recorded in `taxguard_documents.storage_path` with their SHA-256, so a restored
   bucket can be verified against the database (count and digest per object).
3. **Audit log.** `taxguard_audit_log` is part of the database backup. Apply the append-only audit
   proposal before relying on it for evidence.

## Proposed recovery objectives (owner to approve)

| Objective | Proposal | Basis |
|---|---|---|
| RPO (database) | ≤ 24 h with daily backups; ≤ 5 min with PITR | provider capability |
| RPO (document storage) | ≤ 24 h | daily bucket copy |
| RTO (staging) | ≤ 4 h | restore + verification + smoke tests |

## Restore procedure (staging)

1. Declare an incident; freeze deployments; record who authorized the restore.
2. Restore the database into a **new** project (never overwrite in place); keep the damaged one for analysis.
3. Apply any migrations newer than the backup, in manifest order (`migration-execution-manifest.md`).
4. Verify: `/api/health/ready` is 200; table row counts and spot checks against the last known
   manifest; `taxguard_documents` paths exist in storage with matching SHA-256.
5. Rotate every credential of the old project (below), then switch the staging secret store to the
   new project; run `check-staging-config.ts` and the E2E suites against staging with synthetic users.

## Migration rollback

- Prefer **roll forward** (a corrective proposal). Roll back only a proposal that has just been applied
  and has no dependants.
- 047, 048, 050: run the matching file in `docs/proposed-migrations/rollback/` inside a transaction;
  data is preserved (rehearsed). Each proposal's header documents its rollback.
- 049: no automatic rollback (it would restore the Data API exposure); any change is a reviewed proposal.
- Historical non-re-runnable files (manifest section) are never re-applied by hand.

## Credential rotation

Rotate on any suspected exposure, on staff departure with access, and after a restore:
`SUPABASE_SERVICE_ROLE_KEY` and anon key (project settings), database password, `TAXGUARD_CONSULTATION_FINGERPRINT_SALT`,
`TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET` (rotating it breaks correlation of older fingerprints —
expected), `TAXGUARD_MALWARE_SCANNER_CALLBACK_SECRET` (coordinate with the scanner provider), Stripe
sandbox keys. Update the staging secret store only; never commit values; re-run the configuration check.

## Incident response (summary)

1. Contain: revoke sessions (staff session management), activate AI kill switches, disable the affected
   route via configuration, rotate exposed credentials.
2. Preserve: keep audit rows and server logs; take a backup before any repair.
3. Assess: the audit center security view (category SECURITY) and `/api/health/diagnostics`.
4. Recover: roll forward, or restore as above.
5. Report: record the timeline and decisions; notify as required by the practice's obligations.
