import fs from 'node:fs';
import { CANONICAL_AGENTS } from '../../src/ai/registry';

// Offline source inventory, never commissioning. No provider or environment credentials read.
const matrix = {
  releaseAuthorized: false, materialActionsEnabled: false,
  controls: {
    gateway: 'src/server/ai/governance/GovernanceControlPlane.ts',
    killSwitches: 'src/server/ai/governance/KillSwitchService.ts',
    humanReview: 'src/server/ai/review/HumanProposalReviewService.ts',
    executionLedger: 'src/server/ai/governance/SqlGovernanceStore.ts',
    orchestration: 'src/server/ai/orchestration/A00Orchestrator.ts',
  },
  agents: CANONICAL_AGENTS.map(agent => ({ id: agent.agent_id, name: agent.agent_name, status: agent.status,
    model: agent.default_model, tokenBudget: agent.token_budget, costBudget: agent.cost_budget,
    humanReviewThreshold: agent.human_review_threshold, commissioned: false,
    localScope: agent.agent_id === 'A00' ? 'bounded advisory orchestration tests' : agent.agent_id === 'A10' ? 'duplicate-byte advisory tests'
      : agent.agent_id === 'A34' ? 'workflow-read and human return/reject proposal tests' : 'metadata and denial controls only',
    blockingDependencies: ['approved specialist authority and mapping', 'provider commissioning', 'environment governance and independent acceptance'],
  })),
  taxEngine: { stages9Through18: 'BLOCKED', realRulesApproved: false, efiling: false, signatures: false,
    evidence: ['src/tests/taxEngineHttp.test.ts', 'src/tests/taxRuleCoverage.test.ts', 'src/tests/taxRuleVerificationCases.test.ts'] },
};
if (matrix.agents.length !== 61 || matrix.agents.some((a, i) => a.id !== `A${String(i).padStart(2, '0')}` || a.status !== 'DRAFT' || a.model !== null || a.tokenBudget !== 0 || a.costBudget !== 0)) throw new Error('AI_READINESS_INVARIANT_FAILED');
const target = 'docs/development/phase10-ai-readiness.json';
const text = JSON.stringify(matrix, null, 2) + '\n';
if (process.argv.includes('--write')) fs.writeFileSync(target, text);
else if (fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== text) throw new Error('AI_READINESS_MATRIX_STALE');
console.log(JSON.stringify({ agents: matrix.agents.length, commissioned: 0, materialActionsEnabled: false }));
