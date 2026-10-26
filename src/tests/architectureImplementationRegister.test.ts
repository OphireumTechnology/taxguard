import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// The architecture register is evidence, not a claim: every cited file must exist, statuses come from the fixed
// vocabulary, blocked items name their blocker, and nothing is production-ready while staging and production are NO-GO.
const register = JSON.parse(fs.readFileSync('docs/development/architecture-implementation-register.json', 'utf8'));
type Component = { id: string; status: string; implementation: string[]; tests: string[]; blocker?: string; remainingGap: string };
const components: Component[] = register.components;

describe('architecture implementation register', () => {
  it('uses unique ids and only the declared status vocabulary', () => {
    const ids = components.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of components) expect(register.statusVocabulary, c.id).toContain(c.status);
  });
  it('cites only files that exist', () => {
    const missing = components.flatMap(c => [...c.implementation, ...c.tests].filter(p => !fs.existsSync(p)).map(p => `${c.id}: ${p}`));
    expect(missing).toEqual([]);
  });
  it('requires tests for every verified status and a blocker for every blocked one', () => {
    for (const c of components) {
      if (/_VERIFIED$/.test(c.status)) expect(c.tests.length, c.id).toBeGreaterThan(0);
      if (c.status === 'BROWSER_VERIFIED') expect(c.tests.some(t => t.startsWith('src/tests-e2e/')), c.id).toBe(true);
      if (c.status === 'PROVIDER_VERIFIED') expect(c.tests.some(t => t.startsWith('src/tests-e2e/provider/')), c.id).toBe(true);
      if (c.status.startsWith('BLOCKED_')) expect(c.blocker?.trim().length, c.id).toBeGreaterThan(10);
      expect(c.remainingGap.trim().length, c.id).toBeGreaterThan(5);
    }
  });
  it('claims nothing production-ready while the release is NO-GO', () => {
    expect(register.releaseStatus).toMatch(/production NO-GO/);
    expect(components.filter(c => c.status === 'PRODUCTION_READY').map(c => c.id)).toEqual([]);
  });
  it('does not present AI specialists as built or commissioned', () => {
    const specialists = components.find(c => c.id === 'AI-AGENTS-SPECIALISTS')!;
    expect(specialists.status).toBe('BLOCKED_BY_POLICY');
    expect(components.find(c => c.id === 'AI-REGISTRY')!.remainingGap).toMatch(/DRAFT/);
  });
});
