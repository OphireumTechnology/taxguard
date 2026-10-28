import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLOCKED_CAPABILITIES, commissioningMatrix, IMPLEMENTED_HANDLERS, renderCommissioningMatrix } from '../ai/commissioningMatrix';
import { CANONICAL_AGENTS } from '../ai/registry';

// Phase 10 AI commissioning matrix: nothing beyond "locally tested" is claimed for any agent.
const DOC = 'docs/development/ai-commissioning-matrix.md';

describe('AI commissioning matrix', () => {
  it('covers all 61 canonical agents exactly once', () => {
    const rows = commissioningMatrix();
    expect(rows).toHaveLength(61);
    expect(rows.map(r => r.agentId)).toEqual(Array.from({ length: 61 }, (_, i) => 'A' + String(i).padStart(2, '0')));
  });
  it('claims no provider, approval, staging validation or production commissioning', () => {
    for (const r of commissioningMatrix()) {
      expect(r.registered).toBe('YES');
      expect([r.providerConfigured, r.stagingValidated, r.productionCommissioned], r.agentId).toEqual(['NO', 'NO', 'NO']);
      expect(r.humanApproved, r.agentId).toBe('NO');
    }
    expect(CANONICAL_AGENTS.every(a => a.status === 'DRAFT' && a.default_model === null)).toBe(true);
  });
  it('marks handlers only where server code and local tests exist', () => {
    expect(Object.keys(IMPLEMENTED_HANDLERS).sort()).toEqual(['A00', 'A10', 'A34']);
    for (const h of Object.values(IMPLEMENTED_HANDLERS)) {
      expect(existsSync(h.handler), h.handler).toBe(true);
      for (const t of h.tests) expect(existsSync(t), t).toBe(true);
    }
    expect(commissioningMatrix().filter(r => r.handlerImplemented === 'YES').map(r => r.agentId)).toEqual(['A00', 'A10', 'A34']);
  });
  it('keeps AI-16 and every autonomous material action blocked', () => {
    expect(BLOCKED_CAPABILITIES).toEqual(expect.arrayContaining(['AI-16 material-action approval', 'Autonomous electronic filing', 'Client messaging', 'Accounting mutations', 'Payments', 'Tax signatures', 'Document transmission']));
  });
  it('the committed matrix is current', () => {
    if (process.env.TAXGUARD_WRITE_AI_MATRIX === '1') writeFileSync(DOC, renderCommissioningMatrix());
    expect(readFileSync(DOC, 'utf8')).toBe(renderCommissioningMatrix());
  });
});
