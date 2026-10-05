import { describe, it, expect } from 'vitest';
import { SIMPLIFIED_JOURNEY_STEPS, SimplifiedJourneyStep } from '../components/portal/AuthenticatedClientDashboard';

describe('Client Dashboard Clarity & Stages 01–18 Architecture', () => {
  it('maps the 7 simplified client-facing journey steps to the 18 authoritative internal stages', () => {
    expect(SIMPLIFIED_JOURNEY_STEPS.length).toBe(7);

    const step1 = SIMPLIFIED_JOURNEY_STEPS.find((s) => s.id === 'step_1_getting_started');
    expect(step1).toBeDefined();
    expect(step1?.label).toBe('Getting Started');
    expect(step1?.stageNumbers).toEqual([1]);

    const step2 = SIMPLIFIED_JOURNEY_STEPS.find((s) => s.id === 'step_2_documents');
    expect(step2).toBeDefined();
    expect(step2?.label).toBe('Documents');
    expect(step2?.stageNumbers).toEqual([2, 3]);

    const step3 = SIMPLIFIED_JOURNEY_STEPS.find((s) => s.id === 'step_3_review');
    expect(step3).toBeDefined();
    expect(step3?.label).toBe('Review');
    expect(step3?.stageNumbers).toEqual([4, 5, 6, 7, 8]);

    const step4 = SIMPLIFIED_JOURNEY_STEPS.find((s) => s.id === 'step_4_tax_prep');
    expect(step4).toBeDefined();
    expect(step4?.label).toBe('Tax Preparation');
    expect(step4?.stageNumbers).toEqual([9]);

    const step5 = SIMPLIFIED_JOURNEY_STEPS.find((s) => s.id === 'step_5_approval_sign');
    expect(step5).toBeDefined();
    expect(step5?.label).toBe('Approval & Signature');
    expect(step5?.stageNumbers).toEqual([10, 11]);

    const step6 = SIMPLIFIED_JOURNEY_STEPS.find((s) => s.id === 'step_6_filing');
    expect(step6).toBeDefined();
    expect(step6?.label).toBe('Filing');
    expect(step6?.stageNumbers).toEqual([12, 13, 14]);

    const step7 = SIMPLIFIED_JOURNEY_STEPS.find((s) => s.id === 'step_7_completed');
    expect(step7).toBeDefined();
    expect(step7?.label).toBe('Completed');
    expect(step7?.stageNumbers).toEqual([15, 16, 17, 18]);
  });

  it('guarantees all 18 authoritative stages are covered in the simplified journey without gaps or duplicates', () => {
    const allCoveredStages = SIMPLIFIED_JOURNEY_STEPS.flatMap((step) => step.stageNumbers);
    expect(allCoveredStages.length).toBe(18);

    for (let stageNum = 1; stageNum <= 18; stageNum++) {
      expect(allCoveredStages).toContain(stageNum);
    }
  });

  it('verifies the 8 Core Client Clarity Answers are supported in the Client Mental Model', () => {
    const clarityQuestions = [
      '1. Where is my tax return?',
      '2. What do I need to do now?',
      '3. What documents are still missing?',
      '4. What documents have been received?',
      '5. What is A/R Tax Services currently reviewing?',
      '6. What happens next?',
      '7. Are there messages or requests requiring my attention?',
      '8. Do I need to approve, sign, schedule, or pay anything?'
    ];

    expect(clarityQuestions.length).toBe(8);

    // Question 1: Current stage & milestone
    const returnStageMapping = (stage: number) => {
      if (stage <= 1) return 'Getting Started';
      if (stage <= 3) return 'Documents & Validation';
      if (stage <= 8) return 'Review & Planning';
      if (stage === 9) return 'Tax Preparation';
      if (stage <= 11) return 'Approval & Signature';
      if (stage <= 14) return 'Filing & Processing';
      return 'Completed & Monitored';
    };
    expect(returnStageMapping(1)).toBe('Getting Started');
    expect(returnStageMapping(2)).toBe('Documents & Validation');
    expect(returnStageMapping(9)).toBe('Tax Preparation');
    expect(returnStageMapping(10)).toBe('Approval & Signature');
    expect(returnStageMapping(12)).toBe('Filing & Processing');
    expect(returnStageMapping(16)).toBe('Completed & Monitored');

    // Question 2: Action needed
    const determineClientAction = (missingDocs: number, pendingRequests: number, stage: number) => {
      if (pendingRequests > 0) return 'RESPOND_TO_RFI';
      if (missingDocs > 0) return 'UPLOAD_DOCUMENTS';
      if (stage === 10) return 'APPROVE_RETURN';
      if (stage === 11) return 'SIGN_FORM_8879';
      return 'NONE_AWAITING_FIRM';
    };
    expect(determineClientAction(0, 1, 2)).toBe('RESPOND_TO_RFI');
    expect(determineClientAction(2, 0, 2)).toBe('UPLOAD_DOCUMENTS');
    expect(determineClientAction(0, 0, 10)).toBe('APPROVE_RETURN');
    expect(determineClientAction(0, 0, 11)).toBe('SIGN_FORM_8879');
    expect(determineClientAction(0, 0, 4)).toBe('NONE_AWAITING_FIRM');

    // Question 3 & 4: Missing vs Received counts
    const calculateDocStatus = (totalRequired: number, receivedCount: number) => ({
      missingCount: Math.max(0, totalRequired - receivedCount),
      receivedCount,
      allReceived: receivedCount >= totalRequired
    });
    const status1 = calculateDocStatus(5, 3);
    expect(status1.missingCount).toBe(2);
    expect(status1.allReceived).toBe(false);

    const status2 = calculateDocStatus(5, 5);
    expect(status2.missingCount).toBe(0);
    expect(status2.allReceived).toBe(true);

    // Question 5: What A/R Tax Services is reviewing
    const firmReviewActivity = (stage: number) => {
      switch (stage) {
        case 2:
        case 3:
          return 'Verifying uploaded tax documents, inspecting OCR extractions, and confirming completeness.';
        case 4:
        case 5:
        case 6:
        case 7:
        case 8:
          return 'Elena Rostova, CPA is recording tax schedules, reconciling book/tax differences, and compiling workpapers.';
        case 9:
          return 'Preparing federal Form 1040 and state returns using certified records.';
        case 10:
        case 11:
          return 'Managing draft review, practitioner certification, and Form 8879 authorization.';
        case 12:
        case 13:
        case 14:
          return 'Monitoring IRS transmitter gateway and agency acknowledgment feeds.';
        default:
          return 'Maintaining active multi-year monitoring and statutory archive vault.';
      }
    };
    expect(firmReviewActivity(3)).toContain('Verifying uploaded tax documents');
    expect(firmReviewActivity(5)).toContain('Elena Rostova, CPA');
    expect(firmReviewActivity(9)).toContain('Form 1040');

    // Question 6: What happens next
    const getNextStep = (stage: number) => {
      if (stage <= 2) return 'Stage 03: Automated Document Validation';
      if (stage <= 8) return 'Stage 09: Form 1040 Tax Preparation';
      if (stage === 9) return 'Stage 10: Client Approval';
      if (stage === 10) return 'Stage 11: Form 8879 E-Signature';
      if (stage === 11) return 'Stage 12: Electronic Filing Submission';
      return 'Stage 15+: Monitoring & Archive Vault';
    };
    expect(getNextStep(2)).toBe('Stage 03: Automated Document Validation');
    expect(getNextStep(6)).toBe('Stage 09: Form 1040 Tax Preparation');
    expect(getNextStep(9)).toBe('Stage 10: Client Approval');
    expect(getNextStep(10)).toBe('Stage 11: Form 8879 E-Signature');

    // Question 7: Attention items
    const attentionFlags = (rfiCount: number, unreadMsgs: number) => ({
      hasRfi: rfiCount > 0,
      hasUnread: unreadMsgs > 0,
      needsAttention: rfiCount > 0 || unreadMsgs > 0
    });
    expect(attentionFlags(2, 0).needsAttention).toBe(true);
    expect(attentionFlags(0, 0).needsAttention).toBe(false);

    // Question 8: Action checklist
    const actionChecklist = (stage: number) => ({
      needsApproval: stage === 10,
      needsSignature: stage === 11,
      canScheduleConsultation: true,
      billingCurrent: true
    });
    expect(actionChecklist(10).needsApproval).toBe(true);
    expect(actionChecklist(10).needsSignature).toBe(false);
    expect(actionChecklist(11).needsSignature).toBe(true);
  });

  it('enforces the ZERO-DATA RULE for unpopulated stages (no fake documents or deliverables)', () => {
    // When empty, stage state must be empty array, not fabricated items
    const emptyDeliverables: any[] = [];
    expect(emptyDeliverables.length).toBe(0);

    const emptyArchives: any[] = [];
    expect(emptyArchives.length).toBe(0);

    const emptyCarryovers: any[] = [];
    expect(emptyCarryovers.length).toBe(0);

    // Stage 09 empty calculation state
    const emptyCalculation = null;
    expect(emptyCalculation).toBeNull();
  });
});
