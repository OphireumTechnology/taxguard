import { describe, expect, it } from 'vitest';

import {
  IntelligenceGovernanceBoundary,
  type IntelligenceGovernanceContext,
} from '../taxguard/intelligence/governance/IntelligenceGovernanceBoundary';

import type {
  AiReasoningProposal,
  EvidencePackage,
  IntelligenceFinding,
  KnowledgeSource,
  RuleEvaluation,
} from '../taxguard/intelligence/types';

const CLIENT_ID = 'client-001';
const ENGAGEMENT_ID = 'engagement-001';
const TAX_YEAR = 2025;
const CORRELATION_ID = 'corr-001';

const knowledgeSource: KnowledgeSource = {
  sourceId: 'source-001',
  sourceType: 'IRC',
  title: 'Internal Revenue Code authority',
  citation: 'IRC test authority',
  jurisdiction: 'US',
  taxYear: TAX_YEAR,
  authority: 'PRIMARY_AUTHORITY',
  version: '1.0',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ruleEvaluation: RuleEvaluation = {
  evaluationId: 'evaluation-001',
  clientId: CLIENT_ID,
  engagementId: ENGAGEMENT_ID,
  taxYear: TAX_YEAR,
  ruleId: 'rule-001',
  result: 'PASS',
  explanation: 'Deterministic rule evaluation completed.',
  authoritySourceIds: [knowledgeSource.sourceId],
  evaluatedFacts: {
    amount: 1000,
  },
  evaluatedAt: '2026-01-01T00:00:00.000Z',
  correlationId: CORRELATION_ID,
};

const finding: IntelligenceFinding = {
  findingId: 'finding-001',
  clientId: CLIENT_ID,
  engagementId: ENGAGEMENT_ID,
  taxYear: TAX_YEAR,
  origin: 'RULE_ENGINE',
  title: 'Deterministic finding',
  description: 'Finding generated from deterministic evidence.',
  confidence: 'HIGH_CONFIDENCE',
  status: 'REVIEW_REQUIRED',
  knowledgeSourceIds: [knowledgeSource.sourceId],
  ruleEvaluationIds: [ruleEvaluation.evaluationId],
  requiresHumanReview: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'rule-engine',
  correlationId: CORRELATION_ID,
};

const aiProposal: AiReasoningProposal = {
  proposalId: 'proposal-001',
  clientId: CLIENT_ID,
  engagementId: ENGAGEMENT_ID,
  taxYear: TAX_YEAR,
  promptPurpose: 'Identify potential tax issues.',
  explanation: 'AI-generated proposed reasoning.',
  issueSpots: ['Potential issue requires professional review.'],
  recommendations: ['Review supporting authority and evidence.'],
  knowledgeSourceIds: [knowledgeSource.sourceId],
  ruleEvaluationIds: [ruleEvaluation.evaluationId],
  confidence: 'MEDIUM_CONFIDENCE',
  isAiProposedOnly: true,
  status: 'REVIEW_REQUIRED',
  createdAt: '2026-01-01T00:00:00.000Z',
  correlationId: CORRELATION_ID,
};

const evidencePackage: EvidencePackage = {
  evidencePackageId: 'package-001',
  clientId: CLIENT_ID,
  engagementId: ENGAGEMENT_ID,
  taxYear: TAX_YEAR,
  knowledgeSourceIds: [knowledgeSource.sourceId],
  ruleEvaluationIds: [ruleEvaluation.evaluationId],
  findingIds: [finding.findingId],
  aiProposalIds: [aiProposal.proposalId],
  requiresHumanReview: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  correlationId: CORRELATION_ID,
};

function createContext(
  overrides: Partial<IntelligenceGovernanceContext> = {},
): IntelligenceGovernanceContext {
  return {
    clientId: CLIENT_ID,
    engagementId: ENGAGEMENT_ID,
    taxYear: TAX_YEAR,
    correlationId: CORRELATION_ID,
    knowledgeSources: [{ ...knowledgeSource }],
    ruleEvaluations: [{ ...ruleEvaluation }],
    findings: [{ ...finding }],
    aiProposals: [{ ...aiProposal }],
    ...overrides,
  };
}

describe('TG-CORE-008 Intelligence Governance Boundary', () => {
  it('allows a valid evidence package to proceed only to human review', () => {
    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext(),
      );

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe('REQUIRE_HUMAN_REVIEW');
    expect(result.requiresHumanReview).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('never converts a valid evidence package into an approved result', () => {
    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext(),
      );

    expect(result.decision).not.toBe('ALLOW_FOR_REVIEW');
    expect(result.requiresHumanReview).toBe(true);
  });

  it('preserves the AI proposed-only governance invariant', () => {
    const result =
      IntelligenceGovernanceBoundary.evaluateAiProposal(
        { ...aiProposal },
        createContext(),
      );

    expect(result.allowed).toBe(true);
    expect(result.decision).toBe('REQUIRE_HUMAN_REVIEW');
    expect(result.requiresHumanReview).toBe(true);
  });

  it('blocks an AI proposal that is not proposed-only at runtime', () => {
    const invalidProposal = {
      ...aiProposal,
      isAiProposedOnly: false,
    } as unknown as AiReasoningProposal;

    const result =
      IntelligenceGovernanceBoundary.evaluateAiProposal(
        invalidProposal,
        createContext(),
      );

    expect(result.allowed).toBe(false);
    expect(result.decision).toBe('BLOCK');

    expect(
      result.violations.some(
        violation => violation.code === 'AI_NOT_PROPOSED_ONLY',
      ),
    ).toBe(true);
  });

  it('blocks a prohibited AI status received from runtime data', () => {
    const invalidProposal = {
      ...aiProposal,
      status: 'VERIFIED',
    } as unknown as AiReasoningProposal;

    const result =
      IntelligenceGovernanceBoundary.evaluateAiProposal(
        invalidProposal,
        createContext(),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'INVALID_AI_STATUS',
      ),
    ).toBe(true);
  });

  it('blocks cross-client evidence references', () => {
    const invalidEvaluation: RuleEvaluation = {
      ...ruleEvaluation,
      clientId: 'different-client',
    };

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          ruleEvaluations: [invalidEvaluation],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'CROSS_CLIENT_REFERENCE',
      ),
    ).toBe(true);
  });

  it('blocks cross-engagement evidence references', () => {
    const invalidEvaluation: RuleEvaluation = {
      ...ruleEvaluation,
      engagementId: 'different-engagement',
    };

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          ruleEvaluations: [invalidEvaluation],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation =>
          violation.code === 'CROSS_ENGAGEMENT_REFERENCE',
      ),
    ).toBe(true);
  });

  it('blocks cross-tax-year evidence references', () => {
    const invalidEvaluation: RuleEvaluation = {
      ...ruleEvaluation,
      taxYear: 2024,
    };

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          ruleEvaluations: [invalidEvaluation],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'CROSS_TAX_YEAR_REFERENCE',
      ),
    ).toBe(true);
  });

  it('blocks correlation-chain mismatches', () => {
    const invalidEvaluation: RuleEvaluation = {
      ...ruleEvaluation,
      correlationId: 'different-correlation',
    };

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          ruleEvaluations: [invalidEvaluation],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'CORRELATION_MISMATCH',
      ),
    ).toBe(true);
  });

  it('blocks missing knowledge-source provenance', () => {
    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          knowledgeSources: [],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation =>
          violation.code === 'MISSING_KNOWLEDGE_SOURCE',
      ),
    ).toBe(true);
  });

  it('blocks inactive knowledge authority', () => {
    const inactiveSource: KnowledgeSource = {
      ...knowledgeSource,
      isActive: false,
    };

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          knowledgeSources: [inactiveSource],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation =>
          violation.code === 'INACTIVE_KNOWLEDGE_SOURCE',
      ),
    ).toBe(true);
  });

  it('blocks missing deterministic rule provenance', () => {
    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          ruleEvaluations: [],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation =>
          violation.code === 'MISSING_RULE_EVALUATION',
      ),
    ).toBe(true);
  });

  it('blocks a missing finding referenced by the evidence package', () => {
    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          findings: [],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'MISSING_FINDING',
      ),
    ).toBe(true);
  });

  it('blocks a missing AI proposal referenced by the evidence package', () => {
    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          aiProposals: [],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'MISSING_AI_PROPOSAL',
      ),
    ).toBe(true);
  });

  it('blocks stale findings', () => {
    const staleFinding: IntelligenceFinding = {
      ...finding,
      status: 'STALE',
    };

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          findings: [staleFinding],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'STALE_ARTIFACT',
      ),
    ).toBe(true);
  });

  it('blocks rejected findings', () => {
    const rejectedFinding: IntelligenceFinding = {
      ...finding,
      status: 'REJECTED',
    };

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          findings: [rejectedFinding],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'REJECTED_ARTIFACT',
      ),
    ).toBe(true);
  });

  it('blocks superseded findings', () => {
    const supersededFinding: IntelligenceFinding = {
      ...finding,
      status: 'SUPERSEDED',
    };

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          findings: [supersededFinding],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation => violation.code === 'SUPERSEDED_ARTIFACT',
      ),
    ).toBe(true);
  });

  it('requires AI-derived findings to remain human-review gated', () => {
    const invalidFinding = {
      ...finding,
      origin: 'AI_REASONING',
      requiresHumanReview: false,
    } as IntelligenceFinding;

    const result =
      IntelligenceGovernanceBoundary.evaluateEvidencePackage(
        { ...evidencePackage },
        createContext({
          findings: [invalidFinding],
        }),
      );

    expect(result.allowed).toBe(false);

    expect(
      result.violations.some(
        violation =>
          violation.code === 'UNVERIFIED_AI_DERIVED_FINDING',
      ),
    ).toBe(true);
  });

  it('provides a fail-closed boolean review boundary', () => {
    const allowed =
      IntelligenceGovernanceBoundary.canProceedToHumanReview(
        { ...evidencePackage },
        createContext(),
      );

    expect(allowed).toBe(true);

    const blocked =
      IntelligenceGovernanceBoundary.canProceedToHumanReview(
        { ...evidencePackage },
        createContext({
          knowledgeSources: [],
        }),
      );

    expect(blocked).toBe(false);
  });

  it('does not expose an approval method', () => {
    expect(
      'approve' in IntelligenceGovernanceBoundary,
    ).toBe(false);

    expect(
      'approveDecision' in IntelligenceGovernanceBoundary,
    ).toBe(false);
  });

  it('does not expose a certification method', () => {
    expect(
      'certify' in IntelligenceGovernanceBoundary,
    ).toBe(false);

    expect(
      'certifyValidation' in IntelligenceGovernanceBoundary,
    ).toBe(false);
  });

  it('does not expose a Stage 03 gate-clearing method', () => {
    expect(
      'clearGate' in IntelligenceGovernanceBoundary,
    ).toBe(false);

    expect(
      'executeExitGate' in IntelligenceGovernanceBoundary,
    ).toBe(false);

    expect(
      'executeStageThreeExitGate' in IntelligenceGovernanceBoundary,
    ).toBe(false);
  });

  it('does not expose tax-return filing authority', () => {
    expect(
      'fileReturn' in IntelligenceGovernanceBoundary,
    ).toBe(false);

    expect(
      'submitReturn' in IntelligenceGovernanceBoundary,
    ).toBe(false);

    expect(
      'transmitReturn' in IntelligenceGovernanceBoundary,
    ).toBe(false);
  });
});