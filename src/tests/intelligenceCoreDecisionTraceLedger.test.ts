import { beforeEach, describe, expect, it } from 'vitest';

import {
  DecisionTraceLedger,
  type DecisionTraceInput,
} from '../taxguard/intelligence/trace/DecisionTraceLedger';

describe('TG-CORE-007 Decision Trace & Explainability Ledger', () => {
  const baseInput = (): DecisionTraceInput => ({
    traceId: 'TRACE-001',
    clientId: 'CLIENT-001',
    engagementId: 'ENG-001',
    taxYear: 2025,

    stage: 'EVIDENCE_PACKAGE',

    actorId: 'reviewer-001',
    actorRole: 'reviewer',

    summary:
      'Evidence package prepared for controlled human review.',

    knowledgeSourceIds: ['KS-001'],
    ruleEvaluationIds: ['RULE-001'],
    evidencePackageIds: ['PKG-001'],

    correlationId: 'CORR-001',
    createdAt: '2026-09-22T00:00:00.000Z',
  });

  beforeEach(() => {
    DecisionTraceLedger.clearAll();
  });

  it('records a deterministic trace entry', () => {
    const trace = DecisionTraceLedger.append(baseInput());

    expect(trace.traceId).toBe('TRACE-001');
    expect(trace.clientId).toBe('CLIENT-001');
    expect(trace.engagementId).toBe('ENG-001');
    expect(trace.taxYear).toBe(2025);

    expect(trace.stage).toBe('EVIDENCE_PACKAGE');

    expect(trace.correlationId).toBe('CORR-001');

    expect(trace.hasDecisionAuthority).toBe(false);
  });

  it('preserves authoritative knowledge-source references', () => {
    const trace = DecisionTraceLedger.append(baseInput());

    expect(trace.knowledgeSourceIds).toEqual(['KS-001']);

    expect(trace.sourceReferences).toContainEqual({
      sourceType: 'KNOWLEDGE_SOURCE',
      sourceId: 'KS-001',
    });
  });

  it('preserves deterministic rule-evaluation references', () => {
    const trace = DecisionTraceLedger.append(baseInput());

    expect(trace.ruleEvaluationIds).toEqual(['RULE-001']);

    expect(trace.sourceReferences).toContainEqual({
      sourceType: 'RULE_EVALUATION',
      sourceId: 'RULE-001',
    });
  });

  it('preserves evidence-package provenance', () => {
    const trace = DecisionTraceLedger.append(baseInput());

    expect(trace.evidencePackageIds).toEqual(['PKG-001']);

    expect(trace.sourceReferences).toContainEqual({
      sourceType: 'EVIDENCE_PACKAGE',
      sourceId: 'PKG-001',
    });
  });

  it('preserves AI proposal references without converting them into approved facts', () => {
    const input: DecisionTraceInput = {
      ...baseInput(),

      traceId: 'TRACE-AI-001',

      stage: 'AI_PROPOSAL',

      actorId: 'taxguard-ai',
      actorRole: 'ai_model',

      aiProposalIds: ['AI-001'],

      isAiProposedOnly: true,

      summary:
        'AI-generated reasoning proposal awaiting authorized human review.',
    };

    const trace = DecisionTraceLedger.append(input);

    expect(trace.aiProposalIds).toEqual(['AI-001']);

    expect(trace.isAiProposedOnly).toBe(true);
    expect(trace.requiresHumanReview).toBe(true);

    expect(trace.hasDecisionAuthority).toBe(false);

    expect(trace.sourceReferences).toContainEqual({
      sourceType: 'AI_PROPOSAL',
      sourceId: 'AI-001',
    });
  });

  it('forces AI proposal traces to remain proposed-only', () => {
    const input: DecisionTraceInput = {
      ...baseInput(),

      traceId: 'TRACE-AI-002',

      stage: 'AI_PROPOSAL',

      actorId: 'taxguard-ai',
      actorRole: 'ai_model',

      aiProposalIds: ['AI-002'],

      summary:
        'AI proposal requiring human review.',
    };

    const trace = DecisionTraceLedger.append(input);

    expect(trace.isAiProposedOnly).toBe(true);
    expect(trace.requiresHumanReview).toBe(true);
  });

  it('rejects an attempt to mark AI reasoning as independently approved', () => {
    const input: DecisionTraceInput = {
      ...baseInput(),

      traceId: 'TRACE-AI-003',

      stage: 'AI_PROPOSAL',

      actorId: 'taxguard-ai',
      actorRole: 'ai_model',

      aiProposalIds: ['AI-003'],

      isAiProposedOnly: false,
    };

    expect(() =>
      DecisionTraceLedger.append(input),
    ).toThrow(/proposed-only/i);
  });

  it('preserves human-review references', () => {
    const input: DecisionTraceInput = {
      ...baseInput(),

      traceId: 'TRACE-REVIEW-001',

      stage: 'HUMAN_REVIEW',

      humanReviewIds: ['REVIEW-001'],

      actorId: 'reviewer-001',
      actorRole: 'cpa',

      summary:
        'CPA review performed through the authorized Stage 03 workflow.',
    };

    const trace = DecisionTraceLedger.append(input);

    expect(trace.humanReviewIds).toEqual(['REVIEW-001']);

    expect(trace.sourceReferences).toContainEqual({
      sourceType: 'HUMAN_REVIEW',
      sourceId: 'REVIEW-001',
    });

    expect(trace.requiresHumanReview).toBe(true);
  });

  it('preserves authorized decision references without becoming the approval authority', () => {
    const input: DecisionTraceInput = {
      ...baseInput(),

      traceId: 'TRACE-DECISION-001',

      stage: 'AUTHORIZED_DECISION',

      actorId: 'cpa-001',
      actorRole: 'cpa',

      decisionIds: ['DECISION-001'],

      summary:
        'Reference to an authorized human decision recorded by the decision orchestration boundary.',
    };

    const trace = DecisionTraceLedger.append(input);

    expect(trace.decisionIds).toEqual(['DECISION-001']);

    expect(trace.sourceReferences).toContainEqual({
      sourceType: 'DECISION',
      sourceId: 'DECISION-001',
    });

    expect(trace.hasDecisionAuthority).toBe(false);
  });

  it('preserves audit references', () => {
    const input: DecisionTraceInput = {
      ...baseInput(),

      traceId: 'TRACE-AUDIT-001',

      auditReferences: [
        'AUDIT-001',
        'AUDIT-002',
      ],
    };

    const trace = DecisionTraceLedger.append(input);

    expect(trace.auditReferences).toEqual([
      'AUDIT-001',
      'AUDIT-002',
    ]);

    expect(trace.sourceReferences).toContainEqual({
      sourceType: 'AUDIT_EVENT',
      sourceId: 'AUDIT-001',
    });

    expect(trace.sourceReferences).toContainEqual({
      sourceType: 'AUDIT_EVENT',
      sourceId: 'AUDIT-002',
    });
  });

  it('deduplicates repeated source identifiers', () => {
    const input: DecisionTraceInput = {
      ...baseInput(),

      traceId: 'TRACE-DEDUPE-001',

      knowledgeSourceIds: [
        'KS-001',
        'KS-001',
        'KS-002',
      ],

      evidencePackageIds: [
        'PKG-001',
        'PKG-001',
      ],
    };

    const trace = DecisionTraceLedger.append(input);

    expect(trace.knowledgeSourceIds).toEqual([
      'KS-001',
      'KS-002',
    ]);

    expect(trace.evidencePackageIds).toEqual([
      'PKG-001',
    ]);
  });

  it('does not permit an existing trace ID to be overwritten', () => {
    DecisionTraceLedger.append(baseInput());

    expect(() =>
      DecisionTraceLedger.append({
        ...baseInput(),

        summary:
          'Attempted replacement of an existing trace.',
      }),
    ).toThrow(/append-only/i);

    const original =
      DecisionTraceLedger.getById('TRACE-001');

    expect(original?.summary).toBe(
      'Evidence package prepared for controlled human review.',
    );
  });

  it('protects stored trace data from mutation through returned objects', () => {
    const trace = DecisionTraceLedger.append(baseInput());

    trace.knowledgeSourceIds.push('MUTATED-KS');

    trace.sourceReferences.push({
      sourceType: 'AUDIT_EVENT',
      sourceId: 'MUTATED-AUDIT',
    });

    const stored =
      DecisionTraceLedger.getById('TRACE-001');

    expect(stored?.knowledgeSourceIds).toEqual([
      'KS-001',
    ]);

    expect(
      stored?.sourceReferences.some(
        ref => ref.sourceId === 'MUTATED-AUDIT',
      ),
    ).toBe(false);
  });

  it('isolates trace queries by client and tax year', () => {
    DecisionTraceLedger.append(baseInput());

    DecisionTraceLedger.append({
      ...baseInput(),

      traceId: 'TRACE-CLIENT-002',

      clientId: 'CLIENT-002',

      correlationId: 'CORR-002',
    });

    DecisionTraceLedger.append({
      ...baseInput(),

      traceId: 'TRACE-YEAR-2024',

      taxYear: 2024,

      correlationId: 'CORR-003',
    });

    const result = DecisionTraceLedger.query({
      clientId: 'CLIENT-001',
      taxYear: 2025,
    });

    expect(result).toHaveLength(1);
    expect(result[0].traceId).toBe('TRACE-001');
  });

  it('supports engagement-level trace isolation', () => {
    DecisionTraceLedger.append(baseInput());

    DecisionTraceLedger.append({
      ...baseInput(),

      traceId: 'TRACE-ENG-002',

      engagementId: 'ENG-002',

      correlationId: 'CORR-002',
    });

    const result = DecisionTraceLedger.query({
      clientId: 'CLIENT-001',
      taxYear: 2025,
      engagementId: 'ENG-001',
    });

    expect(result).toHaveLength(1);

    expect(result[0].engagementId).toBe(
      'ENG-001',
    );
  });

  it('supports correlation-ID trace retrieval', () => {
    DecisionTraceLedger.append(baseInput());

    DecisionTraceLedger.append({
      ...baseInput(),

      traceId: 'TRACE-CORR-002',

      correlationId: 'CORR-002',
    });

    const result = DecisionTraceLedger.query({
      clientId: 'CLIENT-001',
      taxYear: 2025,
      correlationId: 'CORR-002',
    });

    expect(result).toHaveLength(1);

    expect(result[0].traceId).toBe(
      'TRACE-CORR-002',
    );
  });

  it('produces a deterministic human-readable explanation', () => {
    DecisionTraceLedger.append(baseInput());

    const explanation =
      DecisionTraceLedger.explain('TRACE-001');

    expect(explanation).toContain(
      'Trace TRACE-001',
    );

    expect(explanation).toContain(
      'Stage: EVIDENCE_PACKAGE',
    );

    expect(explanation).toContain(
      'KNOWLEDGE_SOURCE:KS-001',
    );

    expect(explanation).toContain(
      'RULE_EVALUATION:RULE-001',
    );

    expect(explanation).toContain(
      'EVIDENCE_PACKAGE:PKG-001',
    );

    expect(explanation).toContain(
      'Decision Authority: false',
    );
  });

  it('rejects missing client identity', () => {
    expect(() =>
      DecisionTraceLedger.append({
        ...baseInput(),
        traceId: 'TRACE-BAD-CLIENT',
        clientId: '',
      }),
    ).toThrow(/clientId/i);
  });

  it('rejects missing engagement identity', () => {
    expect(() =>
      DecisionTraceLedger.append({
        ...baseInput(),
        traceId: 'TRACE-BAD-ENGAGEMENT',
        engagementId: '',
      }),
    ).toThrow(/engagementId/i);
  });

  it('rejects invalid tax years', () => {
    expect(() =>
      DecisionTraceLedger.append({
        ...baseInput(),
        traceId: 'TRACE-BAD-YEAR',
        taxYear: 0,
      }),
    ).toThrow(/tax year/i);
  });

  it('rejects missing actor identity', () => {
    expect(() =>
      DecisionTraceLedger.append({
        ...baseInput(),
        traceId: 'TRACE-BAD-ACTOR',
        actorId: '',
      }),
    ).toThrow(/actorId/i);
  });

  it('rejects missing trace summaries', () => {
    expect(() =>
      DecisionTraceLedger.append({
        ...baseInput(),
        traceId: 'TRACE-BAD-SUMMARY',
        summary: '',
      }),
    ).toThrow(/summary/i);
  });

  it('rejects missing correlation IDs', () => {
    expect(() =>
      DecisionTraceLedger.append({
        ...baseInput(),
        traceId: 'TRACE-BAD-CORRELATION',
        correlationId: '',
      }),
    ).toThrow(/correlationId/i);
  });

  it('does not expose an approval method', () => {
    expect(
      'approve' in DecisionTraceLedger,
    ).toBe(false);

    expect(
      'approveDecision' in DecisionTraceLedger,
    ).toBe(false);
  });

  it('does not expose a certification method', () => {
    expect(
      'certify' in DecisionTraceLedger,
    ).toBe(false);

    expect(
      'certifyValidation' in DecisionTraceLedger,
    ).toBe(false);
  });

  it('does not expose a gate-clearing method', () => {
    expect(
      'clearGate' in DecisionTraceLedger,
    ).toBe(false);

    expect(
      'executeExitGate' in DecisionTraceLedger,
    ).toBe(false);
  });

  it('does not expose tax-return filing authority', () => {
    expect(
      'fileReturn' in DecisionTraceLedger,
    ).toBe(false);

    expect(
      'transmitReturn' in DecisionTraceLedger,
    ).toBe(false);
  });
});