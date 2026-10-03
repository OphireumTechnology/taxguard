import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

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

  const cdOffset = offset;
  let cdSize = 0;
  for (const b of centralDirs) cdSize += b.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const finalZip = Buffer.concat([...parts, ...centralDirs, eocd]);
  fs.writeFileSync(outputPath, finalZip);
}

const fileList = [
  'TAXGUARD_PRACTICE_OPERATIONS_TRANSFER_MANIFEST.txt',
  'supabase/migrations/20261001000000_taxguard_practice_operations_schema.sql',
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
  'src/server/routes/practice-operations.routes.ts',
  'src/tests/taxGuardPracticeOperations.test.ts',
  'server.ts',
  'src/server/taxguard/bookkeeping/accountingSync.service.ts',
  'src/components/admin/PracticeAdminWorkspace.tsx',
  'src/tests/supabaseProductionInfrastructure.test.ts'
];

const zipEntries = fileList.map((relPath) => {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error('Missing file for transfer zip: ' + relPath);
  }
  return {
    relativePath: relPath,
    content: fs.readFileSync(fullPath),
  };
});

createZip(zipEntries, path.resolve('taxguard-practice-operations-transfer.zip'));
console.log('SUCCESS: Generated taxguard-practice-operations-transfer.zip (' + zipEntries.length + ' files)');
