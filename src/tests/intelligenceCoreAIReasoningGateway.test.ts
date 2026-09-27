import { describe, it, expect } from 'vitest';

import {
  AIReasoningGateway,
  type AiReasoningProvider,
} from '../taxguard/intelligence/ai/AIReasoningGateway';

import type {
  EvidencePackage,
} from '../taxguard/intelligence/types';

const BASE_PACKAGE: EvidencePackage = {
  evidencePackageId: 'EP-TEST-001',

  clientId: 'CLIENT-001',
  engagementId: 'ENG-001',
  taxYear: 2025,

  knowledgeSourceIds: [
    'KS-IRS-001',
    'KS-FIRM-001',
  ],

  ruleEvaluationIds: [
    'RULE-EVAL-001',
    'RULE-EVAL-002',
  ],

  findingIds: [
    'FINDING-001',
  ],

  aiProposalIds: [],

  requiresHumanReview: true,

  createdAt: '2026-09-22T00:00:00.000Z',

  correlationId: 'CORR-TG-CORE-005',
};

describe('TG-CORE-005 AI Reasoning Gateway', () => {
  it('creates an AI proposal from a valid evidence package', () => {
    const proposal = AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose:
        'Explain validation findings for human review.',

      providerResponse: {
        explanation:
          'The evidence package contains items requiring professional review.',

        issueSpots: [
          'Source documents should be reviewed.',
        ],

        recommendations: [
          'Route the package to an authorized reviewer.',
        ],

        confidence: 'MEDIUM_CONFIDENCE',
      },
    });

    expect(proposal.proposalId).toBeTruthy();

    expect(proposal.clientId).toBe(
      BASE_PACKAGE.clientId,
    );

    expect(proposal.engagementId).toBe(
      BASE_PACKAGE.engagementId,
    );

    expect(proposal.taxYear).toBe(
      BASE_PACKAGE.taxYear,
    );

    expect(proposal.isAiProposedOnly).toBe(true);

    expect(proposal.status).toBe(
      'REVIEW_REQUIRED',
    );
  });

  it('always marks AI output as proposed-only', () => {
    const proposal = AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose: 'Identify possible issues.',

      providerResponse: {
        explanation:
          'Potential issue identified for human review.',

        confidence: 'HIGH_CONFIDENCE',
      },
    });

    expect(proposal.isAiProposedOnly).toBe(true);
  });

  it('always requires human review', () => {
    expect(
      AIReasoningGateway.requiresHumanReview(),
    ).toBe(true);

    const proposal = AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose: 'Review evidence.',

      providerResponse: {
        explanation:
          'Review is required before any professional conclusion.',
      },
    });

    expect(proposal.status).toBe(
      'REVIEW_REQUIRED',
    );
  });

  it('cannot approve a tax return', () => {
    expect(
      AIReasoningGateway.canApproveReturn(),
    ).toBe(false);
  });

  it('cannot certify a tax conclusion', () => {
    expect(
      AIReasoningGateway.canCertifyTaxConclusion(),
    ).toBe(false);
  });

  it('cannot clear a TaxGuard gate', () => {
    expect(
      AIReasoningGateway.canClearGate(),
    ).toBe(false);
  });

  it('cannot modify deterministic rule results', () => {
    expect(
      AIReasoningGateway.canModifyDeterministicResult(),
    ).toBe(false);
  });

  it('preserves authoritative knowledge-source traceability', () => {
    const proposal = AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose:
        'Explain evidence using authoritative sources.',

      providerResponse: {
        explanation:
          'Explanation generated for reviewer consideration.',
      },
    });

    expect(proposal.knowledgeSourceIds).toEqual([
      'KS-IRS-001',
      'KS-FIRM-001',
    ]);
  });

  it('preserves deterministic rule-evaluation traceability', () => {
    const proposal = AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose:
        'Explain deterministic validation results.',

      providerResponse: {
        explanation:
          'The deterministic results are preserved.',
      },
    });

    expect(proposal.ruleEvaluationIds).toEqual([
      'RULE-EVAL-001',
      'RULE-EVAL-002',
    ]);
  });

  it('does not allow provider output to replace evidence references', async () => {
    const provider: AiReasoningProvider = {
      async reason() {
        return {
          explanation:
            'Provider explanation for human review.',

          issueSpots: [
            'Possible review issue.',
          ],

          recommendations: [
            'Review supporting evidence.',
          ],

          confidence: 'MEDIUM_CONFIDENCE',

          // Runtime providers could attempt to return
          // additional fields. The gateway must ignore them.
          knowledgeSourceIds: [
            'FAKE-KNOWLEDGE-SOURCE',
          ],

          ruleEvaluationIds: [
            'FAKE-RULE-EVALUATION',
          ],
        } as any;
      },
    };

    const proposal = await AIReasoningGateway.reason(
      provider,
      BASE_PACKAGE,
      'Analyze the evidence package.',
    );

    expect(proposal.knowledgeSourceIds).toEqual(
      BASE_PACKAGE.knowledgeSourceIds,
    );

    expect(proposal.ruleEvaluationIds).toEqual(
      BASE_PACKAGE.ruleEvaluationIds,
    );

    expect(
      proposal.knowledgeSourceIds,
    ).not.toContain('FAKE-KNOWLEDGE-SOURCE');

    expect(
      proposal.ruleEvaluationIds,
    ).not.toContain('FAKE-RULE-EVALUATION');
  });

  it('passes only controlled evidence references to the provider', async () => {
    let capturedRequest:
      | Record<string, unknown>
      | undefined;

    const provider: AiReasoningProvider = {
      async reason(request) {
        capturedRequest =
          request as unknown as Record<string, unknown>;

        return {
          explanation:
            'Controlled reasoning response.',
          confidence: 'LOW_CONFIDENCE',
        };
      },
    };

    await AIReasoningGateway.reason(
      provider,
      BASE_PACKAGE,
      'Perform controlled reasoning.',
    );

    expect(capturedRequest).toBeDefined();

    expect(
      capturedRequest?.evidencePackageId,
    ).toBe('EP-TEST-001');

    expect(
      capturedRequest?.knowledgeSourceIds,
    ).toEqual(BASE_PACKAGE.knowledgeSourceIds);

    expect(
      capturedRequest?.ruleEvaluationIds,
    ).toEqual(BASE_PACKAGE.ruleEvaluationIds);

    expect(
      capturedRequest?.findingIds,
    ).toEqual(BASE_PACKAGE.findingIds);
  });

  it('rejects an evidence package without authoritative knowledge sources', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,
      knowledgeSourceIds: [],
    };

    expect(() =>
      AIReasoningGateway.createProposal({
        evidencePackage: invalidPackage,

        promptPurpose: 'Analyze evidence.',

        providerResponse: {
          explanation: 'Test explanation.',
        },
      }),
    ).toThrow(/knowledge source/i);
  });

  it('rejects an evidence package without deterministic rule evaluations', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,
      ruleEvaluationIds: [],
    };

    expect(() =>
      AIReasoningGateway.createProposal({
        evidencePackage: invalidPackage,

        promptPurpose: 'Analyze evidence.',

        providerResponse: {
          explanation: 'Test explanation.',
        },
      }),
    ).toThrow(/rule evaluation/i);
  });

  it('rejects evidence that is not gated for human review', () => {
    const invalidPackage = {
      ...BASE_PACKAGE,
      requiresHumanReview: false,
    } as unknown as EvidencePackage;

    expect(() =>
      AIReasoningGateway.createProposal({
        evidencePackage: invalidPackage,

        promptPurpose: 'Analyze evidence.',

        providerResponse: {
          explanation: 'Test explanation.',
        },
      }),
    ).toThrow(/human review/i);
  });

  it('rejects a missing prompt purpose', () => {
    expect(() =>
      AIReasoningGateway.createProposal({
        evidencePackage: BASE_PACKAGE,

        promptPurpose: '   ',

        providerResponse: {
          explanation: 'Test explanation.',
        },
      }),
    ).toThrow(/promptPurpose/i);
  });

  it('rejects an empty AI explanation', () => {
    expect(() =>
      AIReasoningGateway.createProposal({
        evidencePackage: BASE_PACKAGE,

        promptPurpose: 'Analyze evidence.',

        providerResponse: {
          explanation: '   ',
        },
      }),
    ).toThrow(/explanation/i);
  });

  it('deduplicates AI issue spots and recommendations', () => {
    const proposal = AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose: 'Identify issues.',

      providerResponse: {
        explanation:
          'Potential issues require review.',

        issueSpots: [
          'Check basis',
          'Check basis',
          ' Review income ',
        ],

        recommendations: [
          'Human review',
          'Human review',
          ' Verify documents ',
        ],
      },
    });

    expect(proposal.issueSpots).toEqual([
      'Check basis',
      'Review income',
    ]);

    expect(proposal.recommendations).toEqual([
      'Human review',
      'Verify documents',
    ]);
  });

  it('defaults missing provider confidence to LOW_CONFIDENCE', () => {
    const proposal = AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose: 'Analyze evidence.',

      providerResponse: {
        explanation:
          'AI response without explicit confidence.',
      },
    });

    expect(proposal.confidence).toBe(
      'LOW_CONFIDENCE',
    );
  });

  it('preserves the evidence-package correlation ID', () => {
    const proposal = AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose: 'Analyze evidence.',

      providerResponse: {
        explanation:
          'Traceable AI reasoning proposal.',
      },
    });

    expect(proposal.correlationId).toBe(
      'CORR-TG-CORE-005',
    );
  });

  it('rejects an invalid AI provider', async () => {
    await expect(
      AIReasoningGateway.reason(
        {} as AiReasoningProvider,
        BASE_PACKAGE,
        'Analyze evidence.',
      ),
    ).rejects.toThrow(/provider/i);
  });

  it('does not mutate the original evidence package', () => {
    const originalKnowledgeSources = [
      ...BASE_PACKAGE.knowledgeSourceIds,
    ];

    const originalRuleEvaluations = [
      ...BASE_PACKAGE.ruleEvaluationIds,
    ];

    AIReasoningGateway.createProposal({
      evidencePackage: BASE_PACKAGE,

      promptPurpose: 'Analyze evidence.',

      providerResponse: {
        explanation:
          'Non-mutating AI reasoning operation.',
      },
    });

    expect(BASE_PACKAGE.knowledgeSourceIds).toEqual(
      originalKnowledgeSources,
    );

    expect(BASE_PACKAGE.ruleEvaluationIds).toEqual(
      originalRuleEvaluations,
    );
  });
});