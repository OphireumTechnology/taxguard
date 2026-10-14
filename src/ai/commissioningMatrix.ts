/**
 * AI commissioning readiness matrix (Phase 10). Derived from the canonical registry, never from a
 * database: every agent is Registered; only agents with a server handler and a local test are marked
 * so; no model provider is configured, nothing is human-approved for execution, nothing is
 * validated in staging and nothing is commissioned in production. AI-16 (material-action
 * approval) stays BLOCKED and no agent may act autonomously.
 */
import { CANONICAL_AGENTS } from './registry';

export type Gate = 'YES' | 'NO' | 'PARTIAL';
export interface CommissioningRow {
  agentId: string; name: string; category: string; status: string;
  registered: Gate; handlerImplemented: Gate; locallyTested: Gate; providerConfigured: Gate; humanApproved: Gate; stagingValidated: Gate; productionCommissioned: Gate;
  scope: string;
}

/** Server-side handlers that exist today (advisory, read-only, test-injected providers only). */
export const IMPLEMENTED_HANDLERS: Readonly<Record<string, { scope: string; handler: string; tests: string[] }>> = Object.freeze({
  A00: { scope: 'Orchestration planning boundary: routes the two mapped advisory tasks; no autonomous action', handler: 'src/server/ai/orchestration/canonicalRouting.ts',
    tests: ['src/tests/aiA00Orchestration.test.ts'] },
  A10: { scope: 'Document duplicate check (read-only advisory)', handler: 'src/server/ai/documents/DocumentDuplicateAdvisory.ts', tests: ['src/tests/aiDocumentDuplicateAdvisory.test.ts'] },
  A34: { scope: 'Workflow read: review questions and evidence completeness (read-only advisory)', handler: 'src/server/ai/orchestration/canonicalRouting.ts',
    tests: ['src/tests/aiA00Orchestration.test.ts', 'src/tests/aiGovernedCapabilities.test.ts'] },
});

/** Capabilities that stay blocked regardless of agent state (owner decisions required). */
export const BLOCKED_CAPABILITIES = Object.freeze([
  'AI-16 material-action approval', 'Autonomous electronic filing', 'Client messaging', 'Accounting mutations', 'Payments', 'Tax signatures', 'Document transmission',
]);

export function commissioningMatrix(): CommissioningRow[] {
  return CANONICAL_AGENTS.map(a => {
    const h = IMPLEMENTED_HANDLERS[a.agent_id];
    return {
      agentId: a.agent_id, name: a.agent_name, category: a.category, status: a.status,
      registered: 'YES', handlerImplemented: h ? 'YES' : 'NO', locallyTested: h ? 'YES' : 'NO',
      // No model provider is selected or configured; DRAFT agents have no execution approval.
      providerConfigured: 'NO', humanApproved: a.status === 'ACTIVE' ? 'PARTIAL' : 'NO', stagingValidated: 'NO', productionCommissioned: 'NO',
      scope: h?.scope ?? 'Registry metadata only; no handler; no execution authority',
    };
  });
}

export function renderCommissioningMatrix(): string {
  const rows = commissioningMatrix();
  const count = (k: keyof CommissioningRow) => rows.filter(r => r[k] === 'YES').length;
  return [
    '# AI commissioning readiness matrix',
    '',
    '> Generated from `src/ai/registry.ts` by `src/ai/commissioningMatrix.ts`; `src/tests/aiCommissioningMatrix.test.ts` fails when this file is stale.',
    '> No live model provider is configured or approved. No agent is staging-validated or production-commissioned.',
    '',
    `Agents: ${rows.length}. Registered ${count('registered')} · handler implemented ${count('handlerImplemented')} · locally tested ${count('locallyTested')} · provider configured ${count('providerConfigured')} · human-approved ${count('humanApproved')} · staging validated ${count('stagingValidated')} · production commissioned ${count('productionCommissioned')}.`,
    '',
    `Blocked regardless of agent state: ${BLOCKED_CAPABILITIES.join('; ')}.`,
    '',
    '| Agent | Name | Category | Registry status | Registered | Handler implemented | Locally tested | Provider configured | Human-approved | Staging validated | Production commissioned | Scope |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(r => `| ${r.agentId} | ${r.name} | ${r.category} | ${r.status} | ${r.registered} | ${r.handlerImplemented} | ${r.locallyTested} | ${r.providerConfigured} | ${r.humanApproved} | ${r.stagingValidated} | ${r.productionCommissioned} | ${r.scope} |`),
    '',
  ].join('\n');
}
