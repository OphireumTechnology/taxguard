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

  const replaySafeFiles = new Set([
    '20261012230000_taxguard_session_management.sql',
    '20261012240000_taxguard_durable_ledger.sql',
    '20261012250000_taxguard_practice_management.sql',
    '20261012260000_taxguard_case_workflow.sql',
    '20261012270000_taxguard_document_vault.sql',
    '20261012280000_taxguard_billing.sql',
    '20261012290000_taxguard_book_to_tax.sql',
    '20261012300000_taxguard_bookkeeper_workqueue.sql',
    '20261012310000_taxguard_document_requests.sql',
    '20261012320000_taxguard_role_dashboards.sql',
    '20261012330000_taxguard_tax_engine_foundation.sql',
    '20261012340000_taxguard_mfa_recovery_completion.sql',
    '20261012350000_taxguard_staff_access_hardening.sql',
    '20261012360000_taxguard_tax_rule_verification_cases.sql',
    '20261012370000_taxguard_mfa_recovery_history.sql',
    '20261012380000_taxguard_tax_rule_coverage.sql',
    '20261013390000_taxguard_client_messaging.sql',
    '20261014400000_taxguard_appointments.sql',
    '20261014410000_taxguard_audit_center.sql',
    '20261014420000_taxguard_legal_coordination.sql',
    '20261014430000_taxguard_consultation_requests.sql',
    '20261014440000_taxguard_client_portal_reads.sql',
    '20261014450000_taxguard_reassignment_requests.sql',
    '20261014460000_taxguard_audit_security_view.sql',
    '20261014470000_taxguard_billing_client_projection.sql',
    '20261014480000_taxguard_security_events.sql',
    '20261014490000_taxguard_data_api_lockdown.sql',
    '20261014500000_taxguard_document_scan_requests.sql',
    '20261015060000_taxguard_audit_custody_overlay.sql',
    '20261015000000_taxguard_security_event_outbox.sql',
    '20261015070000_taxguard_billing_access_overlay.sql',
    '20261015010000_taxguard_billing_pages.sql',
    '20261015020000_taxguard_collection_questionnaires.sql',
    '20261015030000_taxguard_collection_requests.sql',
    '20261015040000_taxguard_mfa_lifecycle_canonical.sql',
    '20261015050000_taxguard_document_scan_jobs.sql',
    '20261015030851_taxguard_document_client_confidentiality.sql',
    '20261016000000_taxguard_portal_case_stages.sql',
    '20261016010000_taxguard_portal_consultations.sql',
    '20261016020000_taxguard_staff_onboarding_status.sql',
    '20261016030000_taxguard_appointment_rooms.sql',
    '20261016040000_taxguard_notification_preferences.sql',
    '20261016050000_taxguard_contact_intake.sql'
  ]);

  let canonical: Awaited<ReturnType<typeof startDatabase>> | undefined;
  let reviewPacket: Awaited<ReturnType<typeof startDatabase>> | undefined;
  try {
    // startDatabase composes the complete canonical DAG against its own random-port loopback
    // PostgreSQL cluster. A second independent cluster composes the valid-name review packet.
    canonical = await startDatabase({ verifyReplayFiles: [...replaySafeFiles] });
    const initialFingerprint = await schemaFingerprint(canonical.pool);
    const checks = await smokeChecks(canonical);
    if (checks.some(check => !check.passed)) throw new Error('MIGRATION_CANDIDATE_SECURITY_SMOKE_FAILED');

    // Replay safety is verified by the database harness immediately after each migration
    // is first applied in canonical DAG order. This avoids replaying an older migration after
    // later overlays have intentionally replaced its functions or privileges.

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
      replaySafeProposalsVerified: replaySafeFiles.size,
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
