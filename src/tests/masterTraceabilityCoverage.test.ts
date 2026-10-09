import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANONICAL_AGENTS } from '../ai/registry';
const matrix = JSON.parse(fs.readFileSync(path.resolve('docs/taxguard-master-traceability.json'), 'utf8'));
describe('master architecture traceability coverage', () => {
  it('tracks every canonical identity independently without treating registry presence as a built specialist', () => {
    const agents = matrix.requirements.filter((r: any) => r.id.startsWith('AGENT-'));
    expect(agents).toHaveLength(61);
    for (const identity of CANONICAL_AGENTS) {
      const row = agents.find((r: any) => r.id === `AGENT-${identity.agent_id}`);
      expect(row.requirement).toContain(identity.agent_name);
      expect(row.status).not.toBe('IMPLEMENTED AND VALIDATED');
      expect(row.remaining).toMatch(/DRAFT|policy/);
    }
  });
  it('separately tracks bounded gates and complete products for all persisted stage identities', () => {
    for (let stage = 1; stage <= 18; stage++) {
      const prefix = `STAGE-${String(stage).padStart(2, '0')}`;
      const gate = matrix.requirements.find((r: any) => r.id === `${prefix}-GATE`);
      const product = matrix.requirements.find((r: any) => r.id === `${prefix}-PRODUCT`);
      expect(gate.requirement).toContain('LEGACY_18_V1'); expect(product.status).not.toBe('IMPLEMENTED AND VALIDATED');
      expect(product.remaining.length).toBeGreaterThan(20);
    }
  });
  it('keeps every evidence link resolvable and requirement identity unique', () => {
    expect(new Set(matrix.requirements.map((r: any) => r.id)).size).toBe(matrix.requirements.length);
    for (const row of matrix.requirements) {
      expect(matrix.classifications).toContain(row.status);
      for (const file of [...row.implementation, ...row.tests]) expect(fs.existsSync(path.resolve(file)), `${row.id}: ${file}`).toBe(true);
    }
  });
  it('explicitly retains material writes as a governance blocker', () => {
    expect(matrix.requirements.find((r: any) => r.id === 'CONTROL-MATERIAL-WRITE').status).toBe('REQUIRES HUMAN POLICY OR REGULATORY APPROVAL');
    expect(matrix.requirements.find((r: any) => r.id === 'CONTROL-MATERIAL-DRAFT').remaining).toContain('not authorization');
  });
});
