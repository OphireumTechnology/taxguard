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
  'TAXGUARD_FINAL_RELEASE_MANIFEST.txt',
  '.env.example',
  'server.ts',
  'src/server/taxguard/providerReadiness.service.ts',
  'src/server/taxguard/operations/dataRetentionRecovery.service.ts',
  'scripts/production-smoke-test.mjs',
  'scripts/verify-post-restore.mjs',
  'docs/DISASTER_RECOVERY.md',
  'docs/PRODUCTION_DEPLOYMENT.md',
  'docs/PRODUCTION_SECURITY.md',
  'docs/PROVIDER_COMMISSIONING.md',
  'docs/RELEASE_CHECKLIST.md',
  'src/tests/productionReleaseHardeningSuite.test.ts'
];

// Validate all files exist
for (const f of filesToInclude) {
  if (!fs.existsSync(path.join(process.cwd(), f))) {
    console.error(`ERROR: File listed for transfer does not exist: ${f}`);
    process.exit(1);
  }
}

const fileEntries = filesToInclude.map(f => ({
  relativePath: f,
  content: fs.readFileSync(path.join(process.cwd(), f))
}));

const zipBuffer = createZip(fileEntries, 'taxguard-final-release-transfer.zip');
if (fs.existsSync('public')) {
  fs.copyFileSync('taxguard-final-release-transfer.zip', 'public/taxguard-final-release-transfer.zip');
}

const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
console.log(`ZIP created successfully: taxguard-final-release-transfer.zip`);
console.log(`Files count: ${filesToInclude.length}`);
console.log(`SHA-256: ${hash}`);
