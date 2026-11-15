import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { permittedEvidencePath, verifyTraceability } from './traceability-integrity.mjs';
const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'docs/taxguard-master-traceability.json'), 'utf8'));
try {
  // Inventory missing files in one CI run without weakening hash or path checks.
  // The canonical verifier below still performs all security and integrity checks.
  const evidencePaths = [
    ...matrix.requirements.flatMap(row => [...row.implementation, ...row.tests]),
    ...matrix.source_inventory.map(source => source.file),
  ];
  const missing = [...new Set(evidencePaths)].filter(file => {
    if (!permittedEvidencePath(file)) return false; // canonical verifier rejects it
    try {
      const resolved = fs.realpathSync(path.join(root, file));
      return !resolved.startsWith(root + path.sep) || !fs.statSync(resolved).isFile();
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return true;
      throw error;
    }
  });
  if (missing.length) {
    console.error(JSON.stringify({
      status: 'TRACEABILITY_MISSING_EVIDENCE',
      missingCount: missing.length,
      files: missing,
      releaseAuthorized: false,
    }));
  }
  console.log(JSON.stringify(verifyTraceability(matrix, file => {
    const resolved = fs.realpathSync(path.join(root, file));
    if (!resolved.startsWith(root + path.sep)) throw new Error('TRACEABILITY_PATH_DENIED');
    return fs.readFileSync(resolved);
  })));
} catch (error) {
  // Preserve the integrity gate. Surface the actual failing path/error rather
  // than hiding it behind a generic CI failure message.
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ status: 'TRACEABILITY_VERIFICATION_FAILED', code,
    detail: message, releaseAuthorized: false }));
  process.exitCode = 1;
}
