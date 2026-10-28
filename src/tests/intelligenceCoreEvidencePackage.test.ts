import { describe, it, expect } from 'vitest';

import { EvidencePackageBuilder } from '../taxguard/intelligence/evidence/EvidencePackageBuilder';

describe('TG-CORE-003 Evidence Package Builder', () => {
  const BASE_INPUT = {
    clientId: 'client-001',
    engagementId: 'engagement-001',
    taxYear: 2026,
    knowledgeSourceIds: ['KS-001'],
    ruleEvaluationIds: ['RE-001'],
    findingIds: ['FIND-001'],
    aiProposalIds: ['AI-001'],
    correlationId: 'CORR-001',
  };

  it('builds a valid evidence package', () => {
    const result = EvidencePackageBuilder.build(BASE_INPUT);

    expect(result.evidencePackageId).toBeTruthy();
    expect(result.evidencePackageId.startsWith('EP-')).toBe(true);

    expect(result.clientId).toBe('client-001');
    expect(result.engagementId).toBe('engagement-001');
    expect(result.taxYear).toBe(2026);

    expect(result.knowledgeSourceIds).toEqual(['KS-001']);
    expect(result.ruleEvaluationIds).toEqual(['RE-001']);
    expect(result.findingIds).toEqual(['FIND-001']);
    expect(result.aiProposalIds).toEqual(['AI-001']);

    expect(result.requiresHumanReview).toBe(true);
    expect(result.createdAt).toBeTruthy();
    expect(result.correlationId).toBe('CORR-001');
  });

  it('always requires human review', () => {
    const result = EvidencePackageBuilder.build(BASE_INPUT);

    expect(result.requiresHumanReview).toBe(true);
  });

  it('preserves evidence provenance identifiers', () => {
    const result = EvidencePackageBuilder.build(BASE_INPUT);

    expect(result.knowledgeSourceIds).toContain('KS-001');
    expect(result.ruleEvaluationIds).toContain('RE-001');
    expect(result.findingIds).toContain('FIND-001');
    expect(result.aiProposalIds).toContain('AI-001');
  });

  it('removes duplicate identifiers', () => {
    const result = EvidencePackageBuilder.build({
      ...BASE_INPUT,

      knowledgeSourceIds: [
        'KS-001',
        'KS-001',
        'KS-002',
      ],

      ruleEvaluationIds: [
        'RE-001',
        'RE-001',
      ],

      findingIds: [
        'FIND-001',
        'FIND-001',
      ],

      aiProposalIds: [
        'AI-001',
        'AI-001',
      ],
    });

    expect(result.knowledgeSourceIds).toEqual([
      'KS-001',
      'KS-002',
    ]);

    expect(result.ruleEvaluationIds).toEqual([
      'RE-001',
    ]);

    expect(result.findingIds).toEqual([
      'FIND-001',
    ]);

    expect(result.aiProposalIds).toEqual([
      'AI-001',
    ]);
  });

  it('removes blank identifiers', () => {
    const result = EvidencePackageBuilder.build({
      ...BASE_INPUT,

      knowledgeSourceIds: [
        'KS-001',
        '',
        '   ',
      ],

      ruleEvaluationIds: [
        'RE-001',
        '',
      ],
    });

    expect(result.knowledgeSourceIds).toEqual([
      'KS-001',
    ]);

    expect(result.ruleEvaluationIds).toEqual([
      'RE-001',
    ]);
  });

  it('trims required identifiers', () => {
    const result = EvidencePackageBuilder.build({
      ...BASE_INPUT,

      clientId: ' client-001 ',
      engagementId: ' engagement-001 ',
      correlationId: ' CORR-001 ',
    });

    expect(result.clientId).toBe('client-001');
    expect(result.engagementId).toBe('engagement-001');
    expect(result.correlationId).toBe('CORR-001');
  });

  it('rejects missing clientId', () => {
    expect(() =>
      EvidencePackageBuilder.build({
        ...BASE_INPUT,
        clientId: '',
      })
    ).toThrow('EvidencePackage requires clientId.');
  });

  it('rejects missing engagementId', () => {
    expect(() =>
      EvidencePackageBuilder.build({
        ...BASE_INPUT,
        engagementId: '',
      })
    ).toThrow('EvidencePackage requires engagementId.');
  });

  it('rejects missing correlationId', () => {
    expect(() =>
      EvidencePackageBuilder.build({
        ...BASE_INPUT,
        correlationId: '',
      })
    ).toThrow('EvidencePackage requires correlationId.');
  });

  it('rejects invalid tax years', () => {
    expect(() =>
      EvidencePackageBuilder.build({
        ...BASE_INPUT,
        taxYear: 0,
      })
    ).toThrow(
      'EvidencePackage requires a valid integer taxYear.'
    );

    expect(() =>
      EvidencePackageBuilder.build({
        ...BASE_INPUT,
        taxYear: 2026.5,
      })
    ).toThrow(
      'EvidencePackage requires a valid integer taxYear.'
    );
  });

  it('rejects packages containing no traceable evidence artifacts', () => {
    expect(() =>
      EvidencePackageBuilder.build({
        clientId: 'client-001',
        engagementId: 'engagement-001',
        taxYear: 2026,

        knowledgeSourceIds: [],
        ruleEvaluationIds: [],
        findingIds: [],
        aiProposalIds: [],

        correlationId: 'CORR-001',
      })
    ).toThrow(
      'EvidencePackage requires at least one traceable evidence artifact.'
    );
  });

  it('keeps packages isolated by client and engagement', () => {
    const first = EvidencePackageBuilder.build({
      ...BASE_INPUT,
      clientId: 'client-A',
      engagementId: 'engagement-A',
    });

    const second = EvidencePackageBuilder.build({
      ...BASE_INPUT,
      clientId: 'client-B',
      engagementId: 'engagement-B',
    });

    expect(first.clientId).toBe('client-A');
    expect(first.engagementId).toBe('engagement-A');

    expect(second.clientId).toBe('client-B');
    expect(second.engagementId).toBe('engagement-B');

    expect(first.evidencePackageId).not.toBe(
      second.evidencePackageId
    );
  });
});