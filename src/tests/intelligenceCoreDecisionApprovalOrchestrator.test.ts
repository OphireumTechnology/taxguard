import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DecisionApprovalOrchestrator } from '../taxguard/intelligence/decisions/DecisionApprovalOrchestrator';
import { StageThreeValidationService } from '../services/stageThreeValidationService';

const CLIENT_ID = 'CLIENT-TG-CORE-006';
const ENGAGEMENT_ID = 'ENG-TG-CORE-006';
const TAX_YEAR = 2025;
const QUEUE_ITEM_ID = 'QUEUE-TG-CORE-006';

describe('TG-CORE-006 Decision & Approval Orchestrator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes the decision and approval orchestration boundary', () => {
    expect(DecisionApprovalOrchestrator).toBeDefined();
  });

  it('does not expose an AI self-approval method', () => {
    expect(
      (DecisionApprovalOrchestrator as any).approveByAI,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).autoApprove,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).selfApprove,
    ).toBeUndefined();
  });

  it('does not expose an independent Stage 03 certification method', () => {
    expect(
      (DecisionApprovalOrchestrator as any).certifyValidation,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).certifyStageThree,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).certify,
    ).toBeUndefined();
  });

  it('does not expose an independent Stage 03 exit-gate clearing method', () => {
    expect(
      (DecisionApprovalOrchestrator as any).clearStageThree,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).clearExitGate,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).approveExitGate,
    ).toBeUndefined();
  });

  it('preserves StageThreeValidationService as the authoritative approval boundary', () => {
    expect(
      typeof StageThreeValidationService.recordReviewDisposition,
    ).toBe('function');

    expect(
      typeof StageThreeValidationService.reopenReviewItem,
    ).toBe('function');

    expect(
      typeof StageThreeValidationService.certifyValidation,
    ).toBe('function');
  });

  it('requires an authenticated human actor for Stage 03 review resolution', () => {
    expect(() =>
      StageThreeValidationService.recordReviewDisposition({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: QUEUE_ITEM_ID,
        actor: '',
        actorRole: 'cpa',
        action: 'RESOLVE_CONFLICT',
        justification: 'Human-reviewed disposition.',
      }),
    ).toThrow(/authenticated reviewer identity is required/i);
  });

  it('requires a written human justification for Stage 03 review resolution', () => {
    expect(() =>
      StageThreeValidationService.recordReviewDisposition({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: QUEUE_ITEM_ID,
        actor: 'reviewer-001',
        actorRole: 'cpa',
        action: 'RESOLVE_CONFLICT',
        justification: '',
      }),
    ).toThrow(/written rationale is required/i);
  });

  it('rejects unauthorized roles from Stage 03 review assignment', () => {
    expect(() =>
      StageThreeValidationService.assignReviewItem({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: QUEUE_ITEM_ID,
        assignedReviewer: 'unauthorized-user',
        assignedRole: 'client',
        assignerId: 'admin-001',
        assignerRole: 'admin',
      }),
    ).toThrow(/unauthorized assignment/i);
  });

  it('rejects AI identity from professional Stage 03 certification', () => {
    expect(() =>
      StageThreeValidationService.certifyValidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        reviewerId: 'ai-model-001',
        reviewerRole: 'cpa',
        preparerId: 'preparer-001',
        certificationStatement:
          'I certify that the validation evidence has been professionally reviewed.',
      }),
    ).toThrow(/AI output remains PROPOSED ONLY|cannot self-certify/i);
  });

  it('rejects unauthorized roles from professional Stage 03 certification', () => {
    expect(() =>
      StageThreeValidationService.certifyValidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        reviewerId: 'client-001',
        reviewerRole: 'client',
        preparerId: 'preparer-001',
        certificationStatement:
          'Attempted certification by an unauthorized role.',
      }),
    ).toThrow(/unauthorized certification/i);
  });

  it('preserves maker-checker separation for professional certification', () => {
    expect(() =>
      StageThreeValidationService.certifyValidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        reviewerId: 'professional-001',
        reviewerRole: 'cpa',
        preparerId: 'professional-001',
        certificationStatement:
          'Attempted self-certification.',
      }),
    ).toThrow(/maker-checker|cannot self-certify/i);
  });

  it('requires written rationale when reopening a human-review item', () => {
    expect(() =>
      StageThreeValidationService.reopenReviewItem({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: QUEUE_ITEM_ID,
        reopenedBy: 'reviewer-001',
        reopenedByRole: 'cpa',
        rationale: '',
      }),
    ).toThrow(/written rationale is required/i);
  });

  it('does not expose a direct tax-return filing method', () => {
    expect(
      (DecisionApprovalOrchestrator as any).fileReturn,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).submitReturn,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).transmitReturn,
    ).toBeUndefined();
  });

  it('does not expose a direct tax calculation mutation method', () => {
    expect(
      (DecisionApprovalOrchestrator as any).modifyTaxCalculation,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).overrideCalculation,
    ).toBeUndefined();

    expect(
      (DecisionApprovalOrchestrator as any).changeTaxResult,
    ).toBeUndefined();
  });

  it('keeps AI reasoning separate from final human approval authority', () => {
    const forbiddenMethods = [
      'approveByAI',
      'autoApprove',
      'selfApprove',
      'certify',
      'certifyValidation',
      'certifyStageThree',
      'clearStageThree',
      'clearExitGate',
      'approveExitGate',
      'fileReturn',
      'submitReturn',
      'transmitReturn',
    ];

    for (const method of forbiddenMethods) {
      expect(
        (DecisionApprovalOrchestrator as any)[method],
      ).toBeUndefined();
    }
  });
});
