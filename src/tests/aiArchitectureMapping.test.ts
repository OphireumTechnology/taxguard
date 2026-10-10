import { describe, expect, it } from 'vitest';
import { CANONICAL_AGENTS } from '../ai/registry';
import { CANONICAL_ARCHITECTURE, findArchitectureMapping, hasUnmappedClientServiceAuthority } from '../ai/architectureMapping';

describe('canonical architecture authority', () => {
  it('preserves exactly 61 canonical identities and names without activation', () => {
    expect(CANONICAL_ARCHITECTURE).toHaveLength(61);
    expect(new Set(CANONICAL_ARCHITECTURE.map(row => row.agent_id)).size).toBe(61);
    for (const agent of CANONICAL_AGENTS) {
      const mapping = findArchitectureMapping(agent.agent_id);
      expect(mapping.canonical_name).toBe(agent.agent_name);
      expect(mapping.category).toBe(agent.category);
      expect(agent.status).toBe('DRAFT');
      expect(Object.isFrozen(mapping)).toBe(true);
      expect(mapping.allowed_execution_capabilities).toEqual([]);
    }
  });
  it.each(['A01', 'A02', 'A03', 'A04'])('denies unresolved %s instead of copying A34 authority', id => {
    const mapping = findArchitectureMapping(id);
    expect(hasUnmappedClientServiceAuthority(id)).toBe(true);
    expect(mapping.mapping_state).toBe('UNMAPPED_DENIED');
    expect(mapping.allowed_workflow_stages).toEqual([]);
    expect(mapping.allowed_read_capabilities).toEqual([]);
    expect(mapping.allowed_proposal_capabilities).toEqual([]);
    expect(mapping.human_review_required).toBe(true);
  });
  it.each(['A61', 'A1', 'a01', 'A00;DROP TABLE ai_agents'])('rejects forged identity %s', id => {
    expect(() => findArchitectureMapping(id)).toThrow('UNKNOWN_AI_AGENT');
  });
  it('preserves the established bounded A00/A34 compatibility classifications', () => {
    expect(findArchitectureMapping('A00').mapping_state).toBe('BOUNDED_COMPATIBILITY');
    expect(findArchitectureMapping('A34').mapping_state).toBe('BOUNDED_COMPATIBILITY');
    expect(hasUnmappedClientServiceAuthority('A34')).toBe(false);
  });
});
