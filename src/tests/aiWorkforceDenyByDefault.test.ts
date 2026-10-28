import { describe, expect, it } from 'vitest';
import { CANONICAL_AGENTS } from '../ai/registry';
import { CANONICAL_ARCHITECTURE, findArchitectureMapping, hasUnmappedAgentAuthority } from '../ai/architectureMapping';

// Workforce-wide fail-closed regression. Only A00, A10 and A34 carry bounded compatibility (each further constrained
// in evaluateGovernancePolicy); every other registered agent has no approved per-ID mapping and must stay denied,
// with no stage, read, proposal or execution authority, whatever its registry status becomes.
const BOUNDED = ['A00', 'A10', 'A34'];

describe('AI workforce: deny by default', () => {
  it('exactly the three bounded agents are mapped; the remaining 58 are UNMAPPED_DENIED', () => {
    expect(CANONICAL_ARCHITECTURE).toHaveLength(61);
    expect(CANONICAL_ARCHITECTURE.filter(r => r.mapping_state !== 'UNMAPPED_DENIED').map(r => r.agent_id)).toEqual(BOUNDED);
    expect(CANONICAL_ARCHITECTURE.filter(r => r.mapping_state === 'UNMAPPED_DENIED')).toHaveLength(58);
  });

  it.each(CANONICAL_AGENTS.filter(a => !BOUNDED.includes(a.agent_id)).map(a => a.agent_id))('%s has no authority of any kind', id => {
    const mapping = findArchitectureMapping(id);
    expect(hasUnmappedAgentAuthority(id)).toBe(true);
    expect(mapping.allowed_workflow_stages).toEqual([]);
    expect(mapping.allowed_read_capabilities).toEqual([]);
    expect(mapping.allowed_proposal_capabilities).toEqual([]);
    expect(mapping.allowed_execution_capabilities).toEqual([]);
    expect(mapping.human_review_required).toBe(true);
  });

  it('every registered agent is DRAFT with no model, prompt or budget', () => {
    for (const a of CANONICAL_AGENTS) {
      expect(a.status, a.agent_id).toBe('DRAFT');
      expect([a.default_model, a.prompt_id, a.token_budget, a.cost_budget], a.agent_id).toEqual([null, null, 0, 0]);
    }
  });

  it('the bounded agents never gain execution authority', () => {
    for (const id of BOUNDED) expect(findArchitectureMapping(id).allowed_execution_capabilities, id).toEqual([]);
  });
});
