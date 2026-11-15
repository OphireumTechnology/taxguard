import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyTraceability } from './traceability-integrity.mjs';
const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const matrix = JSON.parse(fs.readFileSync(path.join(root, 'docs/taxguard-master-traceability.json'), 'utf8'));
try {
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
