import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HumanReviewBridge } from '../taxguard/intelligence/review/HumanReviewBridge';
import type { EvidencePackage } from '../taxguard/intelligence/types';
import { StageThreeValidationService } from '../services/stageThreeValidationService';

/**
 * TG-CORE-004 — Human Review Bridge
 *
 * Verifies that TaxGuard Intelligence Core evidence is routed into
 * the authoritative Stage 03 human-review workflow without creating
 * an alternate approval, certification, or gate-clearing path.
 */

describe('TG-CORE-004 Human Review Bridge', () => {
  const BASE_PACKAGE: EvidencePackage = {
    evidencePackageId: 'EVP-TG-CORE-004-001',

    clientId: 'CLIENT-TG-001',
    engagementId: 'ENG-TG-001',
    taxYear: 2026,

    knowledgeSourceIds: ['KS-IRS-001'],
    ruleEvaluationIds: ['RULE-EVAL-001'],
    findingIds: ['FINDING-001'],
    aiProposalIds: ['AI-PROPOSAL-001'],

    requiresHumanReview: true,

    createdAt: '2026-09-22T00:00:00.000Z',

    correlationId: 'CORR-TG-CORE-004-001',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a valid evidence package to the Stage 03 human-review queue', () => {
    const enqueueSpy = vi
      .spyOn(StageThreeValidationService, 'enqueueHumanReview')
      .mockReturnValue({
        queueItemId: 'HRQ-001',
        reviewItemId: 'HRQ-001',

        clientId: BASE_PACKAGE.clientId,
        engagementId: BASE_PACKAGE.engagementId,
        taxYear: BASE_PACKAGE.taxYear,

        itemType: 'INSUFFICIENT_EVIDENCE',
        referenceId: BASE_PACKAGE.evidencePackageId,

        title: 'TaxGuard Intelligence Review',
        description: 'Human review required.',

        severity: 'MEDIUM',
        riskLevel: 'material',

        blockingStatus: false,

        assignedRole: 'reviewer',
        assignedReviewer: 'UNASSIGNED',

        proposedId: null,

        sourceDocumentIds: [],
        validationRuleIds: [],
        exceptionIds: [],

        createdAt: '2026-09-22T00:00:00.000Z',
        updatedAt: '2026-09-22T00:00:00.000Z',

        status: 'PENDING_REVIEW',

        auditReferences: [
          BASE_PACKAGE.correlationId,
        ],
      } as ReturnType<
        typeof StageThreeValidationService.enqueueHumanReview
      >);

    const result = HumanReviewBridge.submit({
      evidencePackage: BASE_PACKAGE,
    });

    expect(enqueueSpy).toHaveBeenCalledTimes(1);

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: BASE_PACKAGE.clientId,
        engagementId: BASE_PACKAGE.engagementId,
        taxYear: BASE_PACKAGE.taxYear,

        itemType: 'INSUFFICIENT_EVIDENCE',

        referenceId:
          BASE_PACKAGE.evidencePackageId,

        assignedRole: 'reviewer',

        assignedReviewer: 'UNASSIGNED',

        status: 'PENDING_REVIEW',
      }),
    );

    expect(result.queueItemId).toBe('HRQ-001');

    expect(result.evidencePackageId).toBe(
      BASE_PACKAGE.evidencePackageId,
    );

    expect(result.requiresHumanReview).toBe(true);

    expect(result.clientId).toBe(
      BASE_PACKAGE.clientId,
    );

    expect(result.engagementId).toBe(
      BASE_PACKAGE.engagementId,
    );

    expect(result.taxYear).toBe(
      BASE_PACKAGE.taxYear,
    );
  });

  it('preserves the evidence correlation ID in audit references', () => {
    const enqueueSpy = vi
      .spyOn(StageThreeValidationService, 'enqueueHumanReview')
      .mockReturnValue({
        queueItemId: 'HRQ-002',
        status: 'PENDING_REVIEW',
      } as ReturnType<
        typeof StageThreeValidationService.enqueueHumanReview
      >);

    HumanReviewBridge.submit({
      evidencePackage: BASE_PACKAGE,

      auditReferences: [
        'AUDIT-REFERENCE-001',
      ],
    });

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        auditReferences: expect.arrayContaining([
          BASE_PACKAGE.correlationId,
          'AUDIT-REFERENCE-001',
        ]),
      }),
    );
  });

  it('always routes new intelligence evidence into pending human review', () => {
    const enqueueSpy = vi
      .spyOn(StageThreeValidationService, 'enqueueHumanReview')
      .mockReturnValue({
        queueItemId: 'HRQ-003',
        status: 'PENDING_REVIEW',
      } as ReturnType<
        typeof StageThreeValidationService.enqueueHumanReview
      >);

    HumanReviewBridge.submit({
      evidencePackage: BASE_PACKAGE,
    });

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'PENDING_REVIEW',
      }),
    );
  });

  it('does not expose an approve method', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        HumanReviewBridge,
        'approve',
      ),
    ).toBe(false);
  });

  it('does not expose a certify method', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        HumanReviewBridge,
        'certify',
      ),
    ).toBe(false);
  });

  it('does not expose a clearStageThree method', () => {
    expect(
      Object.prototype.hasOwnProperty.call(
        HumanReviewBridge,
        'clearStageThree',
      ),
    ).toBe(false);
  });

  it('rejects evidence that does not require human review', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,

      requiresHumanReview: false as true,
    };

    expect(() =>
      HumanReviewBridge.submit({
        evidencePackage: invalidPackage,
      }),
    ).toThrow(
      'EvidencePackage must require human review.',
    );
  });

  it('rejects a missing evidence package ID', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,

      evidencePackageId: '',
    };

    expect(() =>
      HumanReviewBridge.submit({
        evidencePackage: invalidPackage,
      }),
    ).toThrow(
      'EvidencePackage requires evidencePackageId.',
    );
  });

  it('rejects a missing client ID', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,

      clientId: '',
    };

    expect(() =>
      HumanReviewBridge.submit({
        evidencePackage: invalidPackage,
      }),
    ).toThrow(
      'EvidencePackage requires clientId.',
    );
  });

  it('rejects a missing engagement ID', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,

      engagementId: '',
    };

    expect(() =>
      HumanReviewBridge.submit({
        evidencePackage: invalidPackage,
      }),
    ).toThrow(
      'EvidencePackage requires engagementId.',
    );
  });

  it('rejects an invalid tax year', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,

      taxYear: 0,
    };

    expect(() =>
      HumanReviewBridge.submit({
        evidencePackage: invalidPackage,
      }),
    ).toThrow(
      'EvidencePackage requires a valid taxYear.',
    );
  });

  it('rejects a missing correlation ID', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,

      correlationId: '',
    };

    expect(() =>
      HumanReviewBridge.submit({
        evidencePackage: invalidPackage,
      }),
    ).toThrow(
      'EvidencePackage requires correlationId.',
    );
  });

  it('rejects an evidence package with no traceable evidence references', () => {
    const invalidPackage: EvidencePackage = {
      ...BASE_PACKAGE,

      knowledgeSourceIds: [],
      ruleEvaluationIds: [],
      findingIds: [],
      aiProposalIds: [],
    };

    expect(() =>
      HumanReviewBridge.submit({
        evidencePackage: invalidPackage,
      }),
    ).toThrow(
      'EvidencePackage must contain at least one traceable evidence reference.',
    );
  });

  it('supports authorized reviewer-role routing', () => {
    const enqueueSpy = vi
      .spyOn(StageThreeValidationService, 'enqueueHumanReview')
      .mockReturnValue({
        queueItemId: 'HRQ-004',
        status: 'PENDING_REVIEW',
      } as ReturnType<
        typeof StageThreeValidationService.enqueueHumanReview
      >);

    HumanReviewBridge.submit({
      evidencePackage: BASE_PACKAGE,

      assignedRole: 'cpa',

      assignedReviewer: 'CPA-REVIEWER-001',
    });

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedRole: 'cpa',

        assignedReviewer:
          'CPA-REVIEWER-001',
      }),
    );
  });

  it('preserves explicit severity and risk classification', () => {
    const enqueueSpy = vi
      .spyOn(StageThreeValidationService, 'enqueueHumanReview')
      .mockReturnValue({
        queueItemId: 'HRQ-005',
        status: 'PENDING_REVIEW',
      } as ReturnType<
        typeof StageThreeValidationService.enqueueHumanReview
      >);

    HumanReviewBridge.submit({
      evidencePackage: BASE_PACKAGE,

      severity: 'CRITICAL',

      riskLevel: 'critical',

      itemType: 'PROVENANCE_FAILURE',
    });

    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'CRITICAL',

        riskLevel: 'critical',

        itemType: 'PROVENANCE_FAILURE',
      }),
    );
  });
});