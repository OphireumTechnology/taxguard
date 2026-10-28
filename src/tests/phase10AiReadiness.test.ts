import fs from 'node:fs';
import { expect, it } from 'vitest';
import { CANONICAL_AGENTS } from '../ai/registry';
import { SECURITY_CATEGORIES } from '../components/admin/AuditCenterPanel';

it('accounts for all 61 uncommissioned agents and preserves material and tax-stage denials', () => {
  const matrix = JSON.parse(fs.readFileSync('docs/development/phase10-ai-readiness.json', 'utf8'));
  expect(matrix.agents.map((a: any) => a.id)).toEqual(CANONICAL_AGENTS.map(a => a.agent_id));
  expect(matrix.materialActionsEnabled).toBe(false);
  expect(matrix.taxEngine.stages9Through18).toBe('BLOCKED');
  for (const agent of matrix.agents) expect(agent).toMatchObject({ status: 'DRAFT', model: null, tokenBudget: 0, costBudget: 0, commissioned: false });
  for (const path of [...Object.values(matrix.controls), ...matrix.taxEngine.evidence]) expect(fs.existsSync(path as string)).toBe(true);
  expect(SECURITY_CATEGORIES).toContain('SECURITY');
});
