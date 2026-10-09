import { CANONICAL_AGENTS, findCanonicalAgent } from './registry';

/** Architecture evidence, not an execution permit. Runtime governance remains authoritative. */
export const CANONICAL_ARCHITECTURE_VERSION = '1.0.0';
export const CANONICAL_ARCHITECTURE = Object.freeze(CANONICAL_AGENTS.map(agent => Object.freeze({
  agent_id: agent.agent_id,
  canonical_name: agent.agent_name,
  category: agent.category,
  deployment_status: 'DRAFT' as const,
  responsibility: agent.description,
  mapping_state: ['A00', 'A10', 'A34'].includes(agent.agent_id)
    ? 'BOUNDED_COMPATIBILITY' as const : 'UNMAPPED_DENIED' as const,
  // No deployment stage/capability grant is inferred from a group label or another agent.
  allowed_workflow_stages: Object.freeze([] as number[]),
  allowed_read_capabilities: Object.freeze([] as string[]),
  allowed_proposal_capabilities: Object.freeze([] as string[]),
  allowed_execution_capabilities: Object.freeze([] as string[]),
  human_review_required: true as const,
  source: 'docs/taxguard-ai-canonical-architecture.md',
})));

export function findArchitectureMapping(agentId: string) {
  findCanonicalAgent(agentId);
  return CANONICAL_ARCHITECTURE.find(mapping => mapping.agent_id === agentId)!;
}

/** Group responsibilities are not per-ID authority; even synthetic ACTIVE cannot bypass this boundary. */
export function hasUnmappedClientServiceAuthority(agentId: string): boolean {
  const mapping = findArchitectureMapping(agentId);
  return mapping.category === 'CLIENT_SERVICES' && mapping.mapping_state === 'UNMAPPED_DENIED';
}

export function hasUnmappedAgentAuthority(agentId: string): boolean {
  return findArchitectureMapping(agentId).mapping_state === 'UNMAPPED_DENIED';
}
