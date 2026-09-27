/**
 * Stage 03 Validate — Sprint 3 Comprehensive Test Suite
 * Covers TG-VAL-017 through TG-VAL-025:
 * - TG-VAL-017: Human Validation Review Queue
 * - TG-VAL-018: Reviewer Resolution Controls
 * - TG-VAL-019: Maker-Checker Enforcement
 * - TG-VAL-020: Validation Audit Trail
 * - TG-VAL-021: Validation Completeness Evaluator
 * - TG-VAL-022: Stage 03 Hard Exit Gate
 * - TG-VAL-023: CPA/EA Validation Certification
 * - TG-VAL-024: Upstream Invalidation & Gate Reopening
 * - TG-VAL-025: Downstream Revalidation Signal
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StageThreeValidationService,
  STAGE_THREE_SPRINT_THREE_REGISTRY,
  STAGE_THREE_SUB_FEATURE_REGISTRY,
  AUTHORITATIVE_SOURCE_CLASS_HIERARCHY
} from '../services/stageThreeValidationService';
import { StageTwoCollectionOperationsService } from '../services/stageTwoCollectionOperationsService';
import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';

describe('Stage 03 Sprint 3: Governance, Human Review, Certification & Hard Exit Gate', () => {
  const CLIENT_ID = 'cli_stage3_spr3_test';
  const TAX_YEAR = 2024;
  const ENGAGEMENT_ID = `ENG-${TAX_YEAR}-${CLIENT_ID}`;

  beforeEach(() => {
    StageThreeValidationService.clearAll();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Establish a verified Stage 02 gate baseline for testing
    StageTwoCollectionOperationsService.recordExitGateStatus({
      gateId: `GATE-S2-${CLIENT_ID}-${TAX_YEAR}`,
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      stageTwoStatus: 'COMPLETED',
      stageThreeStatus: 'ELIGIBLE',
      gateResult: 'CLEARED',
      blockingChecklistItemsCount: 0,
      openDiscrepanciesCount: 0,
      timestamp: new Date().toISOString(),
      evaluationSummary: 'All checklist items approved.'
    });
  });

  // ==========================================================================
  // REGISTRY & GOVERNANCE INVARIANTS
  // ==========================================================================
  describe('Canonical Feature ID Governance & Source Hierarchy', () => {
    it('freezes TG-VAL-017 through TG-VAL-025 in Sprint 3 registry without collision', () => {
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-017']).toBe('Human Validation Review Queue');
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-018']).toBe('Reviewer Resolution Controls');
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-019']).toBe('Maker-Checker Enforcement');
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-020']).toBe('Validation Audit Trail');
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-021']).toBe('Validation Completeness Evaluator');
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-022']).toBe('Stage 03 Hard Exit Gate');
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-023']).toBe('CPA/EA Validation Certification');
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-024']).toBe('Upstream Invalidation & Gate Reopening');
      expect(STAGE_THREE_SPRINT_THREE_REGISTRY['TG-VAL-025']).toBe('Downstream Revalidation Signal');

      // Verify all 25 are registered
      for (let i = 1; i <= 25; i++) {
        const id = `TG-VAL-${String(i).padStart(3, '0')}`;
        expect(STAGE_THREE_SUB_FEATURE_REGISTRY[id as keyof typeof STAGE_THREE_SUB_FEATURE_REGISTRY]).toBeDefined();
      }
    });

    it('enforces Authoritative Source Class Hierarchy ranking where AI extracted values never outrank underlying sources', () => {
      expect(AUTHORITATIVE_SOURCE_CLASS_HIERARCHY.GOVERNMENT_ISSUED_TAX_FORMS.rank).toBe(1);
      expect(AUTHORITATIVE_SOURCE_CLASS_HIERARCHY.OFFICIAL_PAYROLL_FILINGS.rank).toBe(2);
      expect(AUTHORITATIVE_SOURCE_CLASS_HIERARCHY.AI_EXTRACTED_VALUES.rank).toBe(7);
      expect(AUTHORITATIVE_SOURCE_CLASS_HIERARCHY.AI_EXTRACTED_VALUES.score).toBeLessThan(
        AUTHORITATIVE_SOURCE_CLASS_HIERARCHY.GOVERNMENT_ISSUED_TAX_FORMS.score
      );
    });
  });

  // ==========================================================================
  // TG-VAL-017: HUMAN VALIDATION REVIEW QUEUE
  // ==========================================================================
  describe('TG-VAL-017: Human Validation Review Queue', () => {
    it('enqueues review items with full audit linkage, risk level, and metadata', () => {
      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'CONFLICT',
        referenceId: 'REF-DOC-101',
        title: 'W-2 vs 1099 Wage Variance',
        description: 'Discrepancy detected between Box 1 wages and general ledger',
        severity: 'HIGH',
        assignedReviewer: 'Senior Reviewer',
        assignedRole: 'cpa',
        preparerId: 'prep_alice'
      });

      expect(item.queueItemId).toBeDefined();
      expect(item.status).toBe('OPEN');
      expect(item.blockingStatus).toBe(true);
      expect(item.preparerId).toBe('prep_alice');

      const queue = StageThreeValidationService.getReviewQueue(CLIENT_ID, TAX_YEAR);
      expect(queue.length).toBe(1);
      expect(queue[0].title).toBe('W-2 vs 1099 Wage Variance');
    });

    it('isolates review queues by client and tax year without cross-tenant contamination', () => {
      StageThreeValidationService.enqueueHumanReview({
        clientId: 'client_A',
        taxYear: 2024,
        itemType: 'LOW_CONFIDENCE',
        referenceId: 'DOC-A',
        title: 'Client A Item',
        description: 'Low OCR confidence',
        severity: 'MEDIUM',
        assignedReviewer: 'Reviewer A'
      });

      StageThreeValidationService.enqueueHumanReview({
        clientId: 'client_B',
        taxYear: 2024,
        itemType: 'LOW_CONFIDENCE',
        referenceId: 'DOC-B',
        title: 'Client B Item',
        description: 'Low OCR confidence',
        severity: 'MEDIUM',
        assignedReviewer: 'Reviewer B'
      });

      const queueA = StageThreeValidationService.getReviewQueue('client_A', 2024);
      const queueB = StageThreeValidationService.getReviewQueue('client_B', 2024);

      expect(queueA.length).toBe(1);
      expect(queueA[0].referenceId).toBe('DOC-A');
      expect(queueB.length).toBe(1);
      expect(queueB[0].referenceId).toBe('DOC-B');
    });

    it('assigns review items to authorized roles and rejects unauthorized roles', () => {
      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'MATHEMATICAL_VARIANCE',
        referenceId: 'DOC-MATH-1',
        title: 'Form 1120 Balance Discrepancy',
        description: 'Schedule M-1 reconciliation does not tie to net income',
        severity: 'HIGH',
        assignedReviewer: 'unassigned'
      });

      // Reject unauthorized role
      expect(() => {
        StageThreeValidationService.assignReviewItem({
          clientId: CLIENT_ID,
          taxYear: TAX_YEAR,
          queueItemId: item.queueItemId,
          assignedReviewer: 'intern_bob',
          assignedRole: 'intern',
          assignerId: 'admin_1',
          assignerRole: 'admin'
        });
      }).toThrow(/Unauthorized assignment/);

      // Successfully assign to licensed CPA
      const assigned = StageThreeValidationService.assignReviewItem({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: item.queueItemId,
        assignedReviewer: 'cpa_sarah',
        assignedRole: 'cpa',
        assignerId: 'admin_1',
        assignerRole: 'admin'
      });

      expect(assigned.status).toBe('ASSIGNED');
      expect(assigned.assignedReviewer).toBe('cpa_sarah');
    });
  });

  // ==========================================================================
  // TG-VAL-018: REVIEWER RESOLUTION CONTROLS
  // ==========================================================================
  describe('TG-VAL-018: Reviewer Resolution Controls', () => {
    it('requires mandatory professional justification for disposition', () => {
      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'CONFLICT',
        referenceId: 'CONF-01',
        title: 'Interest Income Mismatch',
        description: '1099-INT interest variance',
        severity: 'MEDIUM',
        assignedReviewer: 'cpa_jane'
      });

      // Reject empty rationale
      expect(() => {
        StageThreeValidationService.recordReviewDisposition({
          clientId: CLIENT_ID,
          taxYear: TAX_YEAR,
          queueItemId: item.queueItemId,
          actor: 'cpa_jane',
          actorRole: 'cpa',
          action: 'ACCEPT_SOURCE',
          justification: '   '
        });
      }).toThrow(/written rationale is required/);
    });

    it('supports resolution actions and synchronizes linked exceptions', () => {
      // Register an exception
      const exc = StageThreeValidationService.recordException({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        category: 'CROSS_DOCUMENT_DISCREPANCY',
        title: 'W-2 vs 941 Variance',
        description: 'Quarterly totals mismatch Box 1',
        severity: 'HIGH',
        isBlocking: true,
        assignedTo: 'cpa_jane'
      });

      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'CONFLICT',
        referenceId: exc.exceptionId,
        exceptionIds: [exc.exceptionId],
        title: 'Review of W-2 vs 941',
        description: 'Needs professional waiver or correction',
        severity: 'HIGH',
        assignedReviewer: 'cpa_jane'
      });

      const resolved = StageThreeValidationService.recordReviewDisposition({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: item.queueItemId,
        actor: 'cpa_jane',
        actorRole: 'cpa',
        action: 'WAIVE_EXCEPTION',
        justification: 'Immaterial $1.20 rounding variance between quarterly payroll filings.'
      });

      expect(resolved.status).toBe('WAIVED');
      expect(resolved.blockingStatus).toBe(false);

      // Verify linked exception was updated
      const exceptions = StageThreeValidationService.getExceptions(CLIENT_ID, TAX_YEAR);
      const updatedExc = exceptions.find(e => e.exceptionId === exc.exceptionId);
      expect(updatedExc?.status).toBe('WAIVED');
      expect(updatedExc?.resolution?.resolutionAction).toBe('WAIVED_BY_CPA');
    });

    it('supports reopening review items with preserved history and re-enforced blockers', () => {
      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'IDENTITY_MISMATCH',
        referenceId: 'ID-01',
        title: 'EIN Mismatch',
        description: 'Typo in EIN',
        severity: 'HIGH',
        assignedReviewer: 'cpa_jane',
        preparerId: 'prep_dan'
      });

      StageThreeValidationService.recordReviewDisposition({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: item.queueItemId,
        actor: 'cpa_jane',
        actorRole: 'cpa',
        action: 'RESOLVE_CONFLICT',
        justification: 'Confirmed correct EIN against IRS Form SS-4.'
      });

      // Reopen review
      const reopened = StageThreeValidationService.reopenReviewItem({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: item.queueItemId,
        reopenedBy: 'cpa_auditor',
        reopenedByRole: 'cpa',
        rationale: 'SS-4 notice was for a sibling LLC entity; EIN still unverified.'
      });

      expect(reopened.status).toBe('REOPENED');
      expect(reopened.blockingStatus).toBe(true);
      expect(reopened.preparerId).toBe('prep_dan'); // Maker-checker attribution preserved
    });

    it('strictly prevents AI models from self-resolving, self-approving, or self-waiving review items', () => {
      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'LOW_CONFIDENCE',
        referenceId: 'DOC-AI',
        title: 'AI OCR Low Confidence',
        description: 'Confidence 0.45',
        severity: 'HIGH',
        assignedReviewer: 'Senior Reviewer'
      });

      expect(() => {
        StageThreeValidationService.recordReviewDisposition({
          clientId: CLIENT_ID,
          taxYear: TAX_YEAR,
          queueItemId: item.queueItemId,
          actor: 'gemini_ocr_engine',
          actorRole: 'ai_model',
          action: 'ACCEPT_SOURCE',
          justification: 'AI model deems confidence acceptable',
          isAiProposedOnly: true
        });
      }).toThrow(/AI output remains PROPOSED ONLY/);
    });
  });

  // ==========================================================================
  // TG-VAL-019: MAKER-CHECKER ENFORCEMENT
  // ==========================================================================
  describe('TG-VAL-019: Maker-Checker Enforcement', () => {
    it('prevents a preparer from being assigned to review their own work', () => {
      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'CONFLICT',
        referenceId: 'DOC-MK-1',
        title: 'Preparer Review Item',
        description: 'Item created by Alice',
        severity: 'HIGH',
        assignedReviewer: 'unassigned',
        preparerId: 'preparer_alice'
      });

      expect(() => {
        StageThreeValidationService.assignReviewItem({
          clientId: CLIENT_ID,
          taxYear: TAX_YEAR,
          queueItemId: item.queueItemId,
          assignedReviewer: 'preparer_alice',
          assignedRole: 'cpa',
          assignerId: 'admin_1',
          assignerRole: 'admin'
        });
      }).toThrow(/Maker-checker violation: Preparer 'preparer_alice' cannot be assigned to review or approve their own work/);
    });

    it('prevents a preparer from resolving or approving their own work', () => {
      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'CONFLICT',
        referenceId: 'DOC-MK-2',
        title: 'Wage Conflict',
        description: 'Item created by Alice',
        severity: 'HIGH',
        assignedReviewer: 'Senior Reviewer',
        preparerId: 'preparer_alice'
      });

      expect(() => {
        StageThreeValidationService.recordReviewDisposition({
          clientId: CLIENT_ID,
          taxYear: TAX_YEAR,
          queueItemId: item.queueItemId,
          actor: 'preparer_alice',
          actorRole: 'cpa',
          action: 'RESOLVE_CONFLICT',
          justification: 'I reviewed my own calculation and it is fine.'
        });
      }).toThrow(/Maker-checker violation: The preparer who created or modified this item cannot independently approve/);
    });

    it('prevents a preparer from certifying their own work', () => {
      expect(() => {
        StageThreeValidationService.certifyValidation({
          clientId: CLIENT_ID,
          taxYear: TAX_YEAR,
          engagementId: ENGAGEMENT_ID,
          reviewerId: 'preparer_alice',
          reviewerRole: 'cpa',
          preparerId: 'preparer_alice',
          certificationStatement: 'I prepared and now certify this return.'
        });
      }).toThrow(/Maker-checker violation: Preparer cannot certify their own work/);
    });

    it('allows an independent CPA/EA reviewer to review, resolve, and certify', () => {
      // Register valid source
      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-W2-CLEAN',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'W2',
        originalFilename: '2024_w2.pdf',
        sourceHash: 'a'.repeat(64),
        OCRArtifactId: 'OCR-01',
        extractionArtifactId: 'EXT-01',
        pageNumber: 1,
        fieldName: 'wages',
        rawExtractedValue: 100000,
        normalizedValue: 100000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.98,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'CONFLICT',
        referenceId: 'DOC-W2-CLEAN',
        title: 'Check Box 2 Withholding',
        description: 'Verify withholding rate',
        severity: 'MEDIUM',
        assignedReviewer: 'cpa_bob',
        assignedRole: 'cpa',
        preparerId: 'preparer_alice'
      });

      // Bob (independent CPA) resolves Alice's item
      const resolved = StageThreeValidationService.recordReviewDisposition({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: item.queueItemId,
        actor: 'cpa_bob',
        actorRole: 'cpa',
        action: 'RESOLVE_CONFLICT',
        justification: 'Verified Box 2 withholding against tax table.'
      });

      expect(resolved.status).toBe('RESOLVED');

      // Bob certifies the validation
      const cert = StageThreeValidationService.certifyValidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        reviewerId: 'cpa_bob',
        reviewerRole: 'cpa',
        preparerId: 'preparer_alice',
        certificationStatement: 'Independent CPA review complete and verified.'
      });

      expect(cert.status).toBe('ACTIVE');
      expect(cert.reviewerId).toBe('cpa_bob');
    });
  });

  // ==========================================================================
  // TG-VAL-020: VALIDATION AUDIT TRAIL & PRIVACY
  // ==========================================================================
  describe('TG-VAL-020: Validation Audit Trail & Privacy Safeguards', () => {
    it('records structured audit events conforming to TaxGuardAuditEntry contract', () => {
      const item = StageThreeValidationService.enqueueHumanReview({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        itemType: 'IDENTITY_MISMATCH',
        referenceId: 'DOC-ID-AUDIT',
        title: 'Audit Trail Test Item',
        description: 'Verify audit event emission',
        severity: 'HIGH',
        assignedReviewer: 'cpa_sarah',
        assignedRole: 'cpa'
      });

      StageThreeValidationService.recordReviewDisposition({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        queueItemId: item.queueItemId,
        actor: 'cpa_sarah',
        actorRole: 'cpa',
        action: 'ACCEPT_SOURCE',
        justification: 'Reviewed passport and driver license.'
      });

      const auditLog = TaxGuardAuditService.getLogs();
      const reviewEvents = auditLog.filter(e => e.recordId === item.queueItemId);

      expect(reviewEvents.length).toBeGreaterThanOrEqual(1);
      const dispositionEvent = reviewEvents.find(e => e.action === 'VALIDATION_REVIEW_RESOLVED');
      expect(dispositionEvent).toBeDefined();
      expect(dispositionEvent?.userId).toBe('cpa_sarah');
      expect(dispositionEvent?.recordType).toBe('approval');
      expect(dispositionEvent?.result).toBe('success');
    });

    it('never exposes raw unmasked SSN or TIN in logs or exceptions', () => {
      const rawSSN = '123-45-6789';
      const masked = StageThreeValidationService.maskTIN(rawSSN);
      expect(masked).toBe('***-**-6789');

      const exc = StageThreeValidationService.recordException({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        category: 'TIN_EIN_MISMATCH',
        title: 'TIN Mismatch Detected',
        description: `TIN mismatch for taxpayer: ${masked}`,
        severity: 'HIGH',
        isBlocking: true,
        assignedTo: 'cpa_sarah'
      });

      expect(exc.description).not.toContain(rawSSN);
      expect(exc.description).toContain('***-**-6789');
    });
  });

  // ==========================================================================
  // TG-VAL-021: VALIDATION COMPLETENESS EVALUATOR
  // ==========================================================================
  describe('TG-VAL-021: Validation Completeness Evaluator', () => {
    it('evaluates all 18 criteria deterministically and blocks readiness if blocking exceptions exist', () => {
      // Register a source
      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-01',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'W2',
        originalFilename: 'w2.pdf',
        sourceHash: 'b'.repeat(64),
        OCRArtifactId: 'OCR-01',
        extractionArtifactId: 'EXT-01',
        pageNumber: 1,
        fieldName: 'wages',
        rawExtractedValue: 50000,
        normalizedValue: 50000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.95,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      // Inject a blocking exception
      StageThreeValidationService.recordException({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        category: 'MATHEMATICAL_CALCULATION_VARIANCE',
        title: 'Schedule C Gross Receipts Variance',
        description: '1099-K sum exceeds Schedule C gross receipts by $15,000',
        severity: 'CRITICAL',
        isBlocking: true,
        assignedTo: 'cpa_sarah'
      });

      const evaluation = StageThreeValidationService.evaluateValidationCompleteness(CLIENT_ID, TAX_YEAR);

      expect(evaluation.criteriaResults.length).toBe(18);
      expect(evaluation.isReadyForCertification).toBe(false);
      expect(evaluation.isReadyForExit).toBe(false);
      expect(evaluation.blockingReasons.length).toBeGreaterThan(0);
      // High score alone cannot override a hard blocker
      expect(evaluation.readinessScore).toBeLessThanOrEqual(95);
    });

    it('returns ready for certification when all requirements and blockers are resolved', () => {
      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-CLEAN-1040',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: '1040',
        originalFilename: '1040.pdf',
        sourceHash: 'c'.repeat(64),
        OCRArtifactId: 'OCR-02',
        extractionArtifactId: 'EXT-02',
        pageNumber: 1,
        fieldName: 'adjusted_gross_income',
        rawExtractedValue: 120000,
        normalizedValue: 120000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      const evaluation = StageThreeValidationService.evaluateValidationCompleteness(CLIENT_ID, TAX_YEAR);
      expect(evaluation.isReadyForCertification).toBe(true);
      expect(evaluation.blockingReasons.length).toBe(0);
      expect(evaluation.readinessScore).toBe(100);
    });
  });

  // ==========================================================================
  // TG-VAL-022: STAGE 03 HARD EXIT GATE
  // ==========================================================================
  describe('TG-VAL-022: Stage 03 Hard Exit Gate', () => {
    it('blocks exit gate when open blocking exceptions exist', () => {
      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-SRC-1',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'W2',
        originalFilename: 'w2.pdf',
        sourceHash: 'd'.repeat(64),
        OCRArtifactId: 'OCR-1',
        extractionArtifactId: 'EXT-1',
        pageNumber: 1,
        fieldName: 'wages',
        rawExtractedValue: 60000,
        normalizedValue: 60000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.95,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      StageThreeValidationService.recordException({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        category: 'CONTROLLED_FORM_DEFECT',
        title: 'Missing EIN on W-2',
        description: 'Box b is blank',
        severity: 'HIGH',
        isBlocking: true,
        assignedTo: 'cpa_sarah'
      });

      const gateRecord = StageThreeValidationService.executeStageThreeExitGate({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        actor: 'cpa_sarah',
        actorRole: 'cpa'
      });

      expect(gateRecord.gateStatus).toBe('BLOCKED');

      const signal = StageThreeValidationService.getStageFourEligibilitySignal(CLIENT_ID, TAX_YEAR);
      expect(signal.status).toBe('STAGE_04_BLOCKED');
    });

    it('transitions to READY_FOR_CERTIFICATION when requirements pass but professional certification is missing', () => {
      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-SRC-CLEAN',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'W2',
        originalFilename: 'w2.pdf',
        sourceHash: 'e'.repeat(64),
        OCRArtifactId: 'OCR-1',
        extractionArtifactId: 'EXT-1',
        pageNumber: 1,
        fieldName: 'wages',
        rawExtractedValue: 75000,
        normalizedValue: 75000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.98,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      const gate = StageThreeValidationService.evaluateExitGate(CLIENT_ID, TAX_YEAR);
      expect(gate.gateStatus).toBe('READY_FOR_CERTIFICATION');
    });

    it('clears hard exit gate and emits STAGE_04_ELIGIBLE upon professional certification', () => {
      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-SRC-CERTIFIED',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'W2',
        originalFilename: 'w2.pdf',
        sourceHash: 'f'.repeat(64),
        OCRArtifactId: 'OCR-1',
        extractionArtifactId: 'EXT-1',
        pageNumber: 1,
        fieldName: 'wages',
        rawExtractedValue: 80000,
        normalizedValue: 80000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      // Professional certification by CPA
      StageThreeValidationService.certifyValidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        reviewerId: 'cpa_sarah',
        reviewerRole: 'cpa',
        preparerId: 'prep_dan',
        certificationStatement: 'I certify that all validation rules have been executed and verified.'
      });

      const gateRecord = StageThreeValidationService.executeStageThreeExitGate({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        actor: 'cpa_sarah',
        actorRole: 'cpa'
      });

      expect(gateRecord.gateStatus).toBe('CLEARED');
      expect(gateRecord.certifiedBy).toBe('cpa_sarah');

      const signal = StageThreeValidationService.getStageFourEligibilitySignal(CLIENT_ID, TAX_YEAR);
      expect(signal.status).toBe('STAGE_04_ELIGIBLE');
    });
  });

  // ==========================================================================
  // TG-VAL-023: CPA/EA VALIDATION CERTIFICATION
  // ==========================================================================
  describe('TG-VAL-023: CPA/EA Validation Certification', () => {
    it('rejects certification from unauthorized roles', () => {
      expect(() => {
        StageThreeValidationService.certifyValidation({
          clientId: CLIENT_ID,
          taxYear: TAX_YEAR,
          engagementId: ENGAGEMENT_ID,
          reviewerId: 'user_client',
          reviewerRole: 'client',
          certificationStatement: 'I certify my own taxes.'
        });
      }).toThrow(/Unauthorized certification/);
    });

    it('creates cryptographic provenance hashes over sources, exceptions, and review items', () => {
      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-SRC-HASH-1',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'W2',
        originalFilename: 'w2.pdf',
        sourceHash: '1'.repeat(64),
        OCRArtifactId: 'OCR-1',
        extractionArtifactId: 'EXT-1',
        pageNumber: 1,
        fieldName: 'wages',
        rawExtractedValue: 90000,
        normalizedValue: 90000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      const cert = StageThreeValidationService.certifyValidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        reviewerId: 'ea_frank',
        reviewerRole: 'ea',
        preparerId: 'prep_bob',
        certificationStatement: 'Enrolled Agent verification complete.'
      });

      expect(cert.sourceSetHash).toBeDefined();
      expect(cert.exceptionSetHash).toBeDefined();
      expect(cert.reviewSetHash).toBeDefined();
      expect(cert.reviewerRole).toBe('ea');
      expect(cert.status).toBe('ACTIVE');
    });
  });

  // ==========================================================================
  // TG-VAL-024: UPSTREAM INVALIDATION & GATE REOPENING
  // ==========================================================================
  describe('TG-VAL-024: Upstream Invalidation & Gate Reopening', () => {
    it('invalidates certification, reopens exit gate, and marks sources stale upon upstream source correction', () => {
      // 1. Setup clean validated state
      const source = StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-W2-ORIGINAL',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'W2',
        originalFilename: '2024_w2.pdf',
        sourceHash: '2'.repeat(64),
        OCRArtifactId: 'OCR-1',
        extractionArtifactId: 'EXT-1',
        pageNumber: 1,
        fieldName: 'wages',
        rawExtractedValue: 100000,
        normalizedValue: 100000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      // 2. Certify and clear gate
      StageThreeValidationService.certifyValidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        reviewerId: 'cpa_sarah',
        reviewerRole: 'cpa',
        preparerId: 'prep_dan',
        certificationStatement: 'Certified original return.'
      });

      StageThreeValidationService.executeStageThreeExitGate({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        actor: 'cpa_sarah',
        actorRole: 'cpa'
      });

      expect(StageThreeValidationService.getExitGateStatus(CLIENT_ID, TAX_YEAR)?.gateStatus).toBe('CLEARED');

      // 3. Upstream event: Corrected W-2c received in Stage 02
      const result = StageThreeValidationService.handleUpstreamInvalidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        documentId: source.validationSourceId,
        invalidationType: 'CORRECTED_FORM',
        details: 'Corrected W-2c received; Box 1 wages increased by $5,000.',
        actor: 'system_stage2_watcher'
      });

      expect(result.gateReopened).toBe(true);
      expect(result.certificationInvalidated).toBe(true);
      expect(result.affectedSourcesCount).toBeGreaterThan(0);

      // Gate must be REOPENED
      const gateStatus = StageThreeValidationService.getExitGateStatus(CLIENT_ID, TAX_YEAR);
      expect(gateStatus?.gateStatus).toBe('REOPENED');

      // Active cert invalidated while preserving audit history
      const certs = StageThreeValidationService.getCertifications(CLIENT_ID, TAX_YEAR);
      expect(certs.length).toBe(1);
      expect(certs[0].status).toBe('INVALIDATED_BY_UPSTREAM_CHANGE');
      expect(certs[0].invalidationReason).toContain('Corrected W-2c received');

      // Downstream signal must be REVALIDATION_REQUIRED
      const signal = StageThreeValidationService.getStageFourEligibilitySignal(CLIENT_ID, TAX_YEAR);
      expect(signal.status).toBe('REVALIDATION_REQUIRED');
    });

    it('marks sources as STALE when Stage 02 gate record is superseded or reopened', () => {
      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-STALE-TEST',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'W2',
        originalFilename: 'w2.pdf',
        sourceHash: '3'.repeat(64),
        OCRArtifactId: 'OCR-1',
        extractionArtifactId: 'EXT-1',
        pageNumber: 1,
        fieldName: 'wages',
        rawExtractedValue: 70000,
        normalizedValue: 70000,
        sourceTier: 'GOVERNMENT_ISSUED_TAX_FORMS',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      // Stage 02 gate reopened
      StageTwoCollectionOperationsService.recordExitGateStatus({
        gateId: `GATE-S2-${CLIENT_ID}-${TAX_YEAR}`,
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        stageTwoStatus: 'REOPENED',
        stageThreeStatus: 'REVALIDATION_REQUIRED',
        gateResult: 'BLOCKED',
        blockingChecklistItemsCount: 1,
        openDiscrepanciesCount: 1,
        timestamp: new Date().toISOString(),
        evaluationSummary: 'Reopened due to missing K-1.'
      });

      const inv = StageThreeValidationService.checkAndApplyUpstreamInvalidation(CLIENT_ID, TAX_YEAR);
      expect(inv.isInvalidated).toBe(true);

      const sources = StageThreeValidationService.getValidationSources(CLIENT_ID, TAX_YEAR);
      expect(sources[0].validationStatus).toBe('STALE');
    });
  });

  // ==========================================================================
  // TG-VAL-025: DOWNSTREAM REVALIDATION SIGNAL
  // ==========================================================================
  describe('TG-VAL-025: Downstream Revalidation Signal Contract', () => {
    it('returns STAGE_04_BLOCKED when validation is incomplete or un-evaluated', () => {
      const signal = StageThreeValidationService.getStageFourEligibilitySignal('new_client', 2024);
      expect(signal.status).toBe('STAGE_04_BLOCKED');
    });

    it('returns REVALIDATION_REQUIRED when upstream invalidation occurs', () => {
      StageThreeValidationService.handleUpstreamInvalidation({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        documentId: 'DOC-ANY',
        invalidationType: 'SUPERSEDED',
        details: 'Document replaced with higher resolution scan',
        actor: 'user_cpa'
      });

      const signal = StageThreeValidationService.getStageFourEligibilitySignal(CLIENT_ID, TAX_YEAR);
      expect(signal.status).toBe('REVALIDATION_REQUIRED');
    });
  });
});
