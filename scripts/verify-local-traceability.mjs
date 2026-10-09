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
} catch { console.error('TRACEABILITY_VERIFICATION_FAILED: regenerate and review current evidence; no release authorization.'); process.exitCode = 1; }
