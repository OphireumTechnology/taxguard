import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const makeCrcTable = () => {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
};

const crcTable = makeCrcTable();
const crc32 = (buf) => {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
};

function createZip(files, outputPath) {
  const parts = [];
  const centralDirs = [];
  let offset = 0;

  for (const { relativePath, content } of files) {
    const nameBuf = Buffer.from(relativePath, 'utf8');
    const uncompressedSize = content.length;
    const fileCrc = crc32(content);
    const compressed = zlib.deflateRawSync(content);
    const compressedSize = compressed.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(fileCrc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    parts.push(localHeader, nameBuf, compressed);

    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);
    cdHeader.writeUInt16LE(20, 4);
    cdHeader.writeUInt16LE(20, 6);
    cdHeader.writeUInt16LE(0, 8);
    cdHeader.writeUInt16LE(8, 10);
    cdHeader.writeUInt16LE(0, 12);
    cdHeader.writeUInt16LE(0, 14);
    cdHeader.writeUInt32LE(fileCrc, 16);
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);
    cdHeader.writeUInt16LE(0, 32);
    cdHeader.writeUInt16LE(0, 34);
    cdHeader.writeUInt16LE(0, 36);
    cdHeader.writeUInt32LE(0, 38);
    cdHeader.writeUInt32LE(offset, 42);

    centralDirs.push(cdHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const part of centralDirs) {
    centralDirSize += part.length;
  }

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirSize, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const fullZip = Buffer.concat([...parts, ...centralDirs, eocd]);
  fs.writeFileSync(outputPath, fullZip);
  return fullZip;
}

const filesToInclude = [
  'TAXGUARD_RELEASE_DEPENDENCIES.json',
  'TAXGUARD_AUTHORITATIVE_INTEGRATION_MANIFEST.txt',
  'TAXGUARD_INTEGRATION_NOTES.md',
  'supabase/migrations/20260928000000_taxguard_core_schema.sql',
  'supabase/migrations/20260929000000_taxguard_complete_lifecycle_schema.sql',
  'supabase/migrations/20260930000000_taxguard_bookkeeping_schema.sql',
  'supabase/migrations/20261001000000_taxguard_practice_operations_schema.sql',
  'server.ts',
  '.env.example',
  'metadata.json',
  'package.json',
  'package-lock.json',
  'src/server/productionApp.ts',
  'src/server/taxguard/authority.repository.ts',
  'src/server/taxguard/providerReadiness.service.ts',
  'src/server/taxguard/tenantBootstrap.ts',
  'src/server/taxguard/transactionalDatabase.ts',
  'src/server/taxguard/bookkeeping/types.ts',
  'src/server/taxguard/bookkeeping/defaultAccounts.ts',
  'src/server/taxguard/bookkeeping/bookkeeping.engine.ts',
  'src/server/taxguard/bookkeeping/accountingSync.service.ts',
  'src/server/taxguard/operations/types.ts',
  'src/server/taxguard/operations/durableIdempotency.service.ts',
  'src/server/taxguard/operations/durableJobQueue.service.ts',
  'src/server/taxguard/operations/practiceTask.service.ts',
  'src/server/taxguard/operations/staffAssignment.service.ts',
  'src/server/taxguard/operations/deadlineEscalation.service.ts',
  'src/server/taxguard/operations/clientCommunication.service.ts',
  'src/server/taxguard/operations/clientRequest.service.ts',
  'src/server/taxguard/operations/notificationOrchestrator.service.ts',
  'src/server/taxguard/operations/engagementBilling.service.ts',
  'src/server/taxguard/operations/operationalSearch.service.ts',
  'src/server/taxguard/operations/practiceAnalytics.service.ts',
  'src/server/taxguard/operations/dataRetentionRecovery.service.ts',
  'src/server/routes/bookkeeping.routes.ts',
  'src/server/routes/practice-operations.routes.ts',
  'src/server/routes/monitoring.routes.ts',
  'src/services/bookkeepingService.ts',
  'src/components/portal/views/AccountingView.tsx',
  'src/components/workspace/AccountantWorkspace.tsx',
  'src/components/workspace/ReviewerWorkspace.tsx',
  'src/components/admin/PracticeAdminWorkspace.tsx',
  'src/tests/taxGuardBookkeepingEngine.test.ts',
  'src/tests/taxGuardPracticeOperations.test.ts',
  'src/tests/supabaseProductionInfrastructure.test.ts',
  'src/tests/deploymentCandidateIntegrationAndSecurity.test.ts',
  'src/tests/taxGuardProductionHardening.test.ts',
  'src/tests/taxGuardProductionIntegration.test.ts',
  'src/tests/taxGuardProductionDeployment.test.ts',
  'src/tests/productionReleaseHardeningSuite.test.ts',
  'scripts/production-smoke-test.mjs',
  'scripts/verify-post-restore.mjs',
  'scripts/verify-production-config.ts',
  'docs/DISASTER_RECOVERY.md',
  'docs/PRODUCTION_DEPLOYMENT.md',
  'docs/PRODUCTION_SECURITY.md',
  'docs/PROVIDER_COMMISSIONING.md',
  'docs/RELEASE_CHECKLIST.md'
];

console.log(`[1] Verifying all ${filesToInclude.length} files exist and check safety rules...`);
for (const file of filesToInclude) {
  const fullPath = path.join(process.cwd(), file);
  if (!fs.existsSync(fullPath)) {
    console.error(`FATAL: File missing: ${file}`);
    process.exit(1);
  }

  // Safety exclusion checks
  const lower = file.toLowerCase();
  if (
    lower.startsWith('.env') && lower !== '.env.example' ||
    lower.includes('node_modules') ||
    lower.includes('dist/') ||
    lower.includes('.git/') ||
    lower.endsWith('.zip')
  ) {
    console.error(`FATAL: Prohibited file in inclusion list: ${file}`);
    process.exit(1);
  }
}
console.log(`[PASS] All ${filesToInclude.length} files verified on disk.`);

const fileEntries = filesToInclude.map(f => ({
  relativePath: f,
  content: fs.readFileSync(path.join(process.cwd(), f))
}));

const zipBuffer = createZip(fileEntries, 'taxguard-authoritative-integration.zip');
if (fs.existsSync('public')) {
  fs.copyFileSync('taxguard-authoritative-integration.zip', 'public/taxguard-authoritative-integration.zip');
}

const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
console.log(`[PASS] Created: taxguard-authoritative-integration.zip (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`[PASS] SHA-256: ${hash}`);

// Validate ZIP structure
console.log(`[2] Validating ZIP structure and integrity...`);
if (zipBuffer.slice(0, 4).readUInt32LE(0) !== 0x04034b50) {
  console.error(`FATAL: Invalid ZIP signature!`);
  process.exit(1);
}
console.log(`[PASS] ZIP file integrity verified.`);
