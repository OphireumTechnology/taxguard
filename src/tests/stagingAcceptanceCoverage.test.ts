import { expect, it } from 'vitest';
import { stagingAcceptancePlan as plan } from '../../qa/staging-acceptance-plan.mjs';
import { STAGE_NAMES } from '../server/taxguard/persistence.types';
it('keeps all 18 staged acceptance identities synchronized with persisted canonical stages', () => {
  const stages = plan.scenarios.filter(scenario => scenario.id.startsWith('STAGE-'));
  expect(stages).toHaveLength(18);
  for (const scenario of stages) {
    expect(scenario.workflow).toBe(STAGE_NAMES[scenario.stage]);
    expect(scenario.workflowVersion).toBe('LEGACY_18_V1');
  }
});
it('includes all established role workflows and mandatory boundaries without claiming execution', () => {
  const ids = new Set(plan.scenarios.map(scenario => scenario.id));
  for (const id of ['CLIENT-AUTH', 'CLIENT-DOCUMENTS', 'BOOKKEEPER', 'ACCOUNTANT', 'REVIEWER', 'PRACTICE-MANAGER', 'CLIENT-SERVICE', 'ADMIN', 'CONSENT', 'SESSION', 'ACCESSIBILITY']) expect(ids.has(id)).toBe(true);
  expect(ids.size).toBe(plan.scenarios.length);
  expect(plan.scenarios.every(scenario => scenario.browserStatus === 'NOT VERIFIED')).toBe(true);
  expect(plan.releaseRecommendation).toBe('NO-GO');
});
it('requires actual browser evidence and preserves negative fixtures and protected-action prohibitions', () => {
  expect(plan.evidenceRequired).toContain('Browser engine/version and actual viewport');
  expect(plan.requiredFixtures).toContain('Missing/revoked consent');
  expect(plan.prohibitions).toContain('No AI-16 material writes');
  expect(Object.isFrozen(plan.scenarios[0])).toBe(true);
});
