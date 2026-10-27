import fs from 'node:fs';
import { startDatabase } from '../../src/tests-db/harness';
import { buildMigrationManifest, canonicalTextHash } from './migration-manifest.mjs';
import { buildReviewBundle } from './migration-review-bundle.mjs';
import { assertMigrationCandidateInvocation } from './migration-release-candidate-guard';
import { schemaFingerprint } from './schema-fingerprint';

type SmokeCheck = { name: string; passed: boolean; observed: number | string };

async function smokeChecks(database: Awaited<ReturnType<typeof startDatabase>>): Promise<SmokeCheck[]> {
  const rls = await database.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_class
    WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') AND NOT relrowsecurity`);
  const unsecuredDefiners = await database.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef
      AND p.proname LIKE 'taxguard_%' AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) AS setting WHERE setting LIKE 'search_path=%')`);
  const address = await database.pool.query<{ address: string }>('SELECT host(inet_server_addr()) AS address');
  const invalidConstraints = await database.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_constraint
    WHERE connamespace='public'::regnamespace AND NOT convalidated`);
  return [
    { name: 'loopback_only', passed: address.rows[0]?.address === '127.0.0.1', observed: address.rows[0]?.address ?? 'unavailable' },
    { name: 'public_tables_rls_enabled', passed: rls.rows[0].n === 0, observed: rls.rows[0].n },
    { name: 'security_definer_search_paths_pinned', passed: unsecuredDefiners.rows[0].n === 0, observed: unsecuredDefiners.rows[0].n },
    // NOT VALID is a deliberate review state for legacy rows. Report it for the operator instead
    // of pretending constraints have passed historical-data validation.
    { name: 'not_valid_constraints_reported', passed: true, observed: invalidConstraints.rows[0].n },
  ];
}

async function main() {
  assertMigrationCandidateInvocation(process.argv, process.env);
  const manifest = buildMigrationManifest();
  const manifestFile = fs.readFileSync('docs/development/staging-migration-manifest.json', 'utf8').replace(/\r\n/g, '\n');
  if (manifestFile !== JSON.stringify(manifest, null, 2) + '\n') throw new Error('MIGRATION_CANDIDATE_MANIFEST_STALE');
  const review = buildReviewBundle();
  if (review.executionAllowed || review.externalApplicationStatus !== 'NOT_APPLIED')
    throw new Error('MIGRATION_CANDIDATE_REVIEW_AUTHORITY_INVALID');
  for (const entry of review.entries) {
    const sql = fs.readFileSync(entry.source, 'utf8');
    if (canonicalTextHash(sql) !== entry.sourceSha256) throw new Error('MIGRATION_CANDIDATE_SOURCE_CHECKSUM_MISMATCH');
  }

  let canonical: Awaited<ReturnType<typeof startDatabase>> | undefined;
  let reviewPacket: Awaited<ReturnType<typeof startDatabase>> | undefined;
  try {
    // startDatabase composes the complete canonical DAG against its own random-port loopback
    // PostgreSQL cluster. A second independent cluster composes the valid-name review packet.
    canonical = await startDatabase();
    const initialFingerprint = await schemaFingerprint(canonical.pool);
    const checks = await smokeChecks(canonical);
    if (checks.some(check => !check.passed)) throw new Error('MIGRATION_CANDIDATE_SECURITY_SMOKE_FAILED');

    // Reapply only the proposal family already proven replay-safe by the real-PostgreSQL suite.
    // Historical proposals remain reviewable but are not represented as universally idempotent.
    const replayEntries = manifest.entries.filter(entry => entry.kind === 'proposal' &&
      /^202610122[3-9]|^20261012[3-9]|^20261013|^20261014|^20261015|^20261016|^20261017|^20261018|^20261019/.test(entry.file.split('/').at(-1)!));
    for (const entry of replayEntries) await canonical.pool.query(fs.readFileSync(entry.file, 'utf8'));
    const replayFingerprint = await schemaFingerprint(canonical.pool);
    if (replayFingerprint.sha256 !== initialFingerprint.sha256) throw new Error('MIGRATION_CANDIDATE_REPLAY_DRIFT');

    reviewPacket = await startDatabase({ reviewBundle: true });
    const reviewFingerprint = await schemaFingerprint(reviewPacket.pool);
    if (reviewFingerprint.sha256 !== initialFingerprint.sha256) throw new Error('MIGRATION_CANDIDATE_COMPOSITION_MISMATCH');
    const reviewChecks = await smokeChecks(reviewPacket);
    if (reviewChecks.some(check => !check.passed)) throw new Error('MIGRATION_CANDIDATE_REVIEW_SMOKE_FAILED');

    console.log(JSON.stringify({
      status: 'PASS',
      authority: 'REVIEW_ONLY',
      ownerApproval: 'REQUIRED',
      externalApplication: false,
      externalDatabaseAccess: false,
      postgres: 'disposable loopback only',
      manifestEntries: manifest.entries.length,
      reviewPacketEntries: review.entries.length,
      replaySafeProposalsVerified: replayEntries.length,
      schemaFingerprint: initialFingerprint.sha256,
      canonicalChecks: checks,
      reviewPacketChecks: reviewChecks,
    }));
  } finally {
    await Promise.all([canonical?.stop(), reviewPacket?.stop()]);
  }
}

main().catch(error => {
  const value = error as { code?: string; message?: string };
  const report = JSON.stringify({
    status: 'FAIL',
    code: value.code ?? 'MIGRATION_CANDIDATE_FAILED',
    message: value.message ?? 'unknown failure',
    externalApplication: false,
    externalDatabaseAccess: false,
  });
  process.exitCode = 1;
  // embedded-postgres registers async-exit-hook, whose beforeExit handler calls process.exit(0) and
  // would turn this failure into success for CI. Exit explicitly once the report is written.
  process.stderr.write(report + '\n', () => process.exit(1));
});
