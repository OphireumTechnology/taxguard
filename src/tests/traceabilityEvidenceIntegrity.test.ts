import fs from 'node:fs';
import { expect, it } from 'vitest';
import { permittedEvidencePath, verifyTraceability } from '../../scripts/traceability-integrity.mjs';
const original = JSON.parse(fs.readFileSync('docs/taxguard-master-traceability.json', 'utf8'));
const clone = () => structuredClone(original);
const read = (file: string) => fs.readFileSync(file);
it('verifies actual requirement source/test and inventory hashes without certifying browser or release', () => {
  expect(verifyTraceability(original, read)).toMatchObject({ status: 'PASS', releaseAuthorized: false, browserAcceptance: 'NOT VERIFIED' });
});
it.each(['../outside', 'docs/../outside', 'C:/private', 'src\\private', 'docs/_hardening_backup/file.md', '.git/config'])('rejects protected or traversal evidence %s', path => expect(permittedEvidencePath(path)).toBe(false));
it('rejects code evidence drift', () => {
  const matrix = clone(); matrix.evidence_versions[matrix.requirements[0].implementation[0]] = '0'.repeat(64);
  expect(() => verifyTraceability(matrix, read)).toThrow('TRACEABILITY_EVIDENCE_DRIFT');
});
it('rejects source inventory drift', () => {
  const matrix = clone(); matrix.source_inventory[0].sha256 = '0'.repeat(64);
  expect(() => verifyTraceability(matrix, read)).toThrow('TRACEABILITY_INVENTORY_DRIFT');
});
it('rejects duplicate or missing architecture coverage', () => {
  const matrix = clone(); matrix.requirements.push(matrix.requirements[0]); expect(() => verifyTraceability(matrix, read)).toThrow('TRACEABILITY_DUPLICATE_ID');
  matrix.requirements.pop(); matrix.requirements.shift(); expect(() => verifyTraceability(matrix, read)).toThrow('TRACEABILITY_AGENT_MISSING');
});
it('refuses invented browser acceptance', () => {
  const matrix = clone(); matrix.requirements[0].browserAcceptance = 'PASS';
  expect(() => verifyTraceability(matrix, read)).toThrow('TRACEABILITY_BROWSER_EVIDENCE_REQUIRED');
});
it('permits only the exact root package manifest while denying private root configuration', () => {
  expect(permittedEvidencePath('package.json')).toBe(true);
  for (const file of ['.npmrc', '.env', '../package.json', 'package.json/../private']) expect(permittedEvidencePath(file)).toBe(false);
});
