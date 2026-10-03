import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

// Standard PKZIP CRC-32 table
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

    // Local file header (30 bytes + name)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed: 2.0
    localHeader.writeUInt16LE(0, 6);          // General purpose bit flag
    localHeader.writeUInt16LE(8, 8);          // Compression method: deflate
    localHeader.writeUInt16LE(0, 10);         // Last mod file time
    localHeader.writeUInt16LE(0, 12);         // Last mod file date
    localHeader.writeUInt32LE(fileCrc, 14);    // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);         // Extra field length

    parts.push(localHeader, nameBuf, compressed);

    // Central directory header (46 bytes + name)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);    // Central dir signature
    cdHeader.writeUInt16LE(20, 4);            // Version made by: 2.0
    cdHeader.writeUInt16LE(20, 6);            // Version needed: 2.0
    cdHeader.writeUInt16LE(0, 8);             // General purpose bit flag
    cdHeader.writeUInt16LE(8, 10);            // Compression method: deflate
    cdHeader.writeUInt16LE(0, 12);            // Last mod file time
    cdHeader.writeUInt16LE(0, 14);            // Last mod file date
    cdHeader.writeUInt32LE(fileCrc, 16);       // CRC-32
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);            // Extra field length
    cdHeader.writeUInt16LE(0, 32);            // File comment length
    cdHeader.writeUInt16LE(0, 34);            // Disk number start
    cdHeader.writeUInt16LE(0, 36);            // Internal file attributes
    cdHeader.writeUInt32LE(0, 38);            // External file attributes
    cdHeader.writeUInt32LE(offset, 42);       // Relative offset of local header

    centralDirs.push(cdHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const part of centralDirs) {
    centralDirSize += part.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);          // EOCD signature
  eocd.writeUInt16LE(0, 4);                   // Number of this disk
  eocd.writeUInt16LE(0, 6);                   // Disk where central directory starts
  eocd.writeUInt16LE(files.length, 8);        // Number of central directory records on this disk
  eocd.writeUInt16LE(files.length, 10);       // Total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12);     // Size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16);   // Offset of start of central directory
  eocd.writeUInt16LE(0, 20);                  // Comment length

  const fullZip = Buffer.concat([...parts, ...centralDirs, eocd]);
  fs.writeFileSync(outputPath, fullZip);
  return fullZip;
}

const filesToInclude = [
  'TAXGUARD_FINAL_DEVELOPMENT_MANIFEST.txt',
  'scripts/create-transfer-archive.mjs',
  'server.ts',
  'tests/monitoring.test.ts',
  'metadata.json',
  '.env.example'
];

const fileEntries = filesToInclude.map(f => ({
  relativePath: f,
  content: fs.readFileSync(path.join(process.cwd(), f))
}));

const zipBuffer = createZip(fileEntries, 'taxguard-final-development-transfer.zip');
fs.copyFileSync('taxguard-final-development-transfer.zip', 'public/taxguard-final-development-transfer.zip');

const hash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
console.log(`ZIP created successfully: taxguard-final-development-transfer.zip`);
console.log(`Public mirror: public/taxguard-final-development-transfer.zip`);
console.log(`SHA-256: ${hash}`);
