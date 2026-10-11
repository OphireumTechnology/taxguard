import { createHash } from 'node:crypto';
export function permittedEvidencePath(file) {
  if (file === 'package.json') return true;
  return typeof file === 'string' && /^(?:docs|src|qa|scripts|config|supabase\/migrations)\//.test(file)
    && !file.includes('\\') && !file.split('/').some(part => !part || part.startsWith('.') || /^_hardening_backup/i.test(part));
}
export function verifyTraceability(matrix, read) {
  const ids = new Set(matrix.requirements.map(row => row.id));
  if (ids.size !== matrix.requirements.length) throw new Error('TRACEABILITY_DUPLICATE_ID');
  for (let agent = 0; agent <= 60; agent++) if (!ids.has(`AGENT-A${String(agent).padStart(2, '0')}`)) throw new Error('TRACEABILITY_AGENT_MISSING');
  for (let stage = 1; stage <= 18; stage++) for (const part of ['GATE', 'PRODUCT']) if (!ids.has(`STAGE-${String(stage).padStart(2, '0')}-${part}`)) throw new Error('TRACEABILITY_STAGE_MISSING');
  for (const row of matrix.requirements) {
    if (!matrix.classifications.includes(row.status)) throw new Error('TRACEABILITY_STATUS_INVALID');
    if (row.browserAcceptance !== 'NOT VERIFIED') throw new Error('TRACEABILITY_BROWSER_EVIDENCE_REQUIRED');
    for (const file of [...row.implementation, ...row.tests]) {
      if (!permittedEvidencePath(file)) throw new Error('TRACEABILITY_PATH_DENIED');
      const hash = createHash('sha256').update(read(file).toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
      if (matrix.evidence_versions?.[file] !== hash) throw new Error('TRACEABILITY_EVIDENCE_DRIFT');
    }
  }
  for (const source of matrix.source_inventory) {
    if (!permittedEvidencePath(source.file) || !/^(?:docs\/|supabase\/migrations\/)/.test(source.file)) throw new Error('TRACEABILITY_PATH_DENIED');
    if (createHash('sha256').update(read(source.file).toString('utf8').replace(/\r\n/g, '\n')).digest('hex') !== source.sha256) throw new Error('TRACEABILITY_INVENTORY_DRIFT');
  }
  return { requirements: ids.size, agents: 61, stages: 18, status: 'PASS', browserAcceptance: 'NOT VERIFIED', releaseAuthorized: false };
}
