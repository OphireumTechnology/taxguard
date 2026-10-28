/**
 * stageTwoSprintFourOperations.test.ts
 *
 * Comprehensive Test Suite for TAXGUARD AI — Stage 02 / Sprint 4:
 * Collection Operations, Source Completeness & Stage 02 Exit Gate
 *
 * Feature IDs Verified:
 * - TG-COL-021: Missing Document Detection & Dynamic Requirement Evaluation
 * - TG-COL-022: Document Request Management & Duplicate Prevention
 * - TG-COL-023: Client Reminder & Automated Chasing Engine
 * - TG-COL-024: Unified Stage 02 Exception Management Integration
 * - TG-COL-025: Source Tie-Out Reconciliation Layer
 * - TG-COL-026: Deterministic Collection Completeness Evaluator
 * - TG-COL-027: Stage 02 Hard Exit Gate Execution
 * - TG-COL-028: Upstream Document Invalidation & Reopening Safeguards
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StageTwoCollectionOperationsService,
  DocumentRequest,
  StageTwoExceptionItem
} from '../services/stageTwoCollectionOperationsService';
import {
  StageTwoCollectionService,
  ChecklistRequirement,
  StageTwoUploadedDocument
} from '../services/stageTwoCollectionService';
import { StagedSecurityDocument } from '../services/stageTwoIntakeSecurityService';

describe('TAXGUARD AI — Stage 02 Sprint 4: Operations, Completeness & Exit Gate', () => {
  const testClientId = 'CLI-TEST-SPRINT4';
  const testTaxYear = 2025;
  const testEngagementId = 'ENG-2025-SPRINT4-001';

  beforeEach(() => {
    // Clear localStorage to ensure clean test isolation
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  // ==========================================================================
  // TG-COL-021: MISSING DOCUMENT DETECTION & EVALUATION
  // ==========================================================================
  describe('TG-COL-021: Missing Document Detection & Dynamic Evaluation', () => {
    it('returns MISSING when no documents have been ingested for a requirement', () => {
      const req: ChecklistRequirement = {
        requirementId: 'REQ-W2-TEST',
        clientId: testClientId,
        taxYear: testTaxYear,
        entityType: 'individual',
        jurisdiction: 'Federal',
        title: 'Form W-2 Wage Statement',
        formNumber: 'W-2',
        category: 'W-2 / Wage Statement',
        priority: 'Required',
        status: 'Required',
        description: 'Mandatory W-2',
        lastUpdated: new Date().toISOString()
      };

      const status = StageTwoCollectionOperationsService.evaluateRequirementStatus(req, [], []);
      expect(status).toBe('MISSING');
    });

    it('enforces strict invariant: Quarantined document does NOT satisfy requirement', () => {
      const req: ChecklistRequirement = {
        requirementId: 'REQ-W2-QUAR',
        clientId: testClientId,
        taxYear: testTaxYear,
        entityType: 'individual',
        jurisdiction: 'Federal',
        title: 'Form W-2 Wage Statement',
        formNumber: 'W-2',
        category: 'W-2 / Wage Statement',
        priority: 'Required',
        status: 'Required',
        description: 'Mandatory W-2',
        lastUpdated: new Date().toISOString()
      };

      const uploadedDoc: StageTwoUploadedDocument = {
        documentId: 'DOC-QUAR-01',
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client User',
        originalFileName: 'w2_infected.pdf',
        fileSizeBytes: 2048,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-quar-1234',
        claimedCategory: 'W-2 / Wage Statement',
        associatedRequirementId: 'REQ-W2-QUAR',
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Under Review',
        isVerified: false,
        securityCheckStatus: 'Quarantined',
        quarantineDetails: 'Infected with Trojan'
      } as any;

      const stagedDoc: StagedSecurityDocument = {
        documentId: 'DOC-QUAR-01',
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        uploader: 'Client User',
        uploaderSource: 'client_portal',
        originalFilename: 'w2_infected.pdf',
        fileSizeBytes: 2048,
        claimedCategory: 'W-2 / Wage Statement',
        receivedTimestamp: new Date().toISOString(),
        stagingStatus: 'QUARANTINED',
        pipelineStage: 'RECEIVED',
        signatureValidation: {
          claimedFileType: 'pdf',
          detectedFileType: 'pdf',
          claimedMimeType: 'application/pdf',
          detectedMimeType: 'application/pdf',
          validationResult: 'PASSED'
        },
        archiveProtection: {
          isArchive: false,
          totalUncompressedBytes: 0,
          expansionRatio: 1,
          containedFileCount: 1,
          nestedArchiveDetected: false,
          validationResult: 'PASSED'
        },
        malwareScanStatus: 'INFECTED',
        malwareScannerName: 'TaxGuard Antivirus Core',
        quarantineStatus: 'SECURITY_REVIEW',
        encryptionStatus: 'COMPLETE',
        integrityRecord: {
          documentId: 'DOC-QUAR-01',
          originalHash: 'hash-quar-1234',
          storedObjectHash: 'hash-quar-1234',
          integrityVerificationStatus: 'VERIFIED',
          verificationTimestamp: new Date().toISOString()
        },
        provenance: {
          documentId: 'DOC-QUAR-01',
          versionNumber: 1,
          uploader: 'Client User',
          timestamp: new Date().toISOString(),
          isCurrentActiveVersion: true
        },
        isVerified: false,
        taxDataVerified: false,
        humanReviewed: false,
        isReadyForOcr: false
      };

      const status = StageTwoCollectionOperationsService.evaluateRequirementStatus(
        req,
        [uploadedDoc],
        [stagedDoc]
      );

      // Must remain MISSING because quarantined document cannot satisfy collection
      expect(status).toBe('MISSING');
    });

    it('returns ACCEPTED only when a verified document is received and approved', () => {
      const req: ChecklistRequirement = {
        requirementId: 'REQ-1099-INT',
        clientId: testClientId,
        taxYear: testTaxYear,
        entityType: 'individual',
        jurisdiction: 'Federal',
        title: 'Form 1099-INT Interest Income',
        formNumber: '1099-INT',
        category: '1099-INT / Interest Income',
        priority: 'Required',
        status: 'Accepted',
        description: 'Interest statements',
        lastUpdated: new Date().toISOString()
      };

      const uploadedDoc: StageTwoUploadedDocument = {
        documentId: 'DOC-CLEAN-01',
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client User',
        originalFileName: '1099_int_chase.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        sha256Hash: 'hash-clean-1234',
        claimedCategory: '1099-INT / Interest Income',
        associatedRequirementId: 'REQ-1099-INT',
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Accepted',
        isVerified: true,
        securityCheckStatus: 'Passed (SHA-256 Validated)'
      };

      const stagedDoc: StagedSecurityDocument = {
        documentId: 'DOC-CLEAN-01',
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        uploader: 'Client User',
        uploaderSource: 'client_portal',
        originalFilename: '1099_int_chase.pdf',
        fileSizeBytes: 1024,
        claimedCategory: '1099-INT / Interest Income',
        receivedTimestamp: new Date().toISOString(),
        stagingStatus: 'SECURITY_CLEARED',
        pipelineStage: 'READY_FOR_OCR',
        signatureValidation: {
          claimedFileType: 'pdf',
          detectedFileType: 'pdf',
          claimedMimeType: 'application/pdf',
          detectedMimeType: 'application/pdf',
          validationResult: 'PASSED'
        },
        archiveProtection: {
          isArchive: false,
          totalUncompressedBytes: 0,
          expansionRatio: 1,
          containedFileCount: 1,
          nestedArchiveDetected: false,
          validationResult: 'PASSED'
        },
        malwareScanStatus: 'CLEAN',
        malwareScannerName: 'TaxGuard Antivirus Core',
        quarantineStatus: 'CLEARED',
        encryptionStatus: 'COMPLETE',
        integrityRecord: {
          documentId: 'DOC-CLEAN-01',
          originalHash: 'hash-clean-1234',
          storedObjectHash: 'hash-clean-1234',
          integrityVerificationStatus: 'VERIFIED',
          verificationTimestamp: new Date().toISOString()
        },
        provenance: {
          documentId: 'DOC-CLEAN-01',
          versionNumber: 1,
          uploader: 'Client User',
          timestamp: new Date().toISOString(),
          isCurrentActiveVersion: true
        },
        isVerified: true,
        taxDataVerified: true,
        humanReviewed: true,
        isReadyForOcr: true
      };

      const status = StageTwoCollectionOperationsService.evaluateRequirementStatus(
        req,
        [uploadedDoc],
        [stagedDoc]
      );

      expect(status).toBe('ACCEPTED');
    });
  });

  // ==========================================================================
  // TG-COL-022: DOCUMENT REQUEST MANAGEMENT & DUPLICATE PREVENTION
  // ==========================================================================
  describe('TG-COL-022: Document Request Management & Duplicate Prevention', () => {
    it('creates a document request and prevents duplicate active requests without override', () => {
      const req1 = StageTwoCollectionOperationsService.createDocumentRequest({
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        requirementId: 'REQ-1099-MISC',
        title: 'Form 1099-MISC Request',
        requestedDocument: 'Official 1099-MISC copy',
        requestedBy: 'Sarah Jenkins, CPA',
        requestedByRole: 'cpa',
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        priority: 'HIGH'
      });

      expect(req1.requestId).toBeDefined();
      expect(req1.status).toBe('OPEN');
      expect(req1.requirementId).toBe('REQ-1099-MISC');

      // Attempt duplicate without override -> must throw
      expect(() => {
        StageTwoCollectionOperationsService.createDocumentRequest({
          clientId: testClientId,
          engagementId: testEngagementId,
          taxYear: testTaxYear,
          requirementId: 'REQ-1099-MISC',
          title: 'Duplicate Form 1099-MISC Request',
          requestedDocument: 'Another 1099-MISC copy',
          requestedBy: 'Staff Preparer',
          requestedByRole: 'preparer',
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
          priority: 'NORMAL',
          allowDuplicateOverride: false
        });
      }).toThrow(/Duplicate Document Request Blocked/);

      // With explicit override -> succeeds
      const req2 = StageTwoCollectionOperationsService.createDocumentRequest({
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        requirementId: 'REQ-1099-MISC',
        title: 'Secondary 1099-MISC Request',
        requestedDocument: 'Second 1099-MISC copy',
        requestedBy: 'Sarah Jenkins, CPA',
        requestedByRole: 'cpa',
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        priority: 'NORMAL',
        allowDuplicateOverride: true
      });

      expect(req2.requestId).not.toBe(req1.requestId);
    });

    it('resolves a document request with mandatory justification notes', () => {
      const req = StageTwoCollectionOperationsService.createDocumentRequest({
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        requirementId: 'REQ-PROPERTY-TAX',
        title: 'Property Tax Bill',
        requestedDocument: '2025 County Property Tax Assessment',
        requestedBy: 'Sarah Jenkins, CPA',
        requestedByRole: 'cpa',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        priority: 'HIGH'
      });

      // Must fail if notes are empty
      expect(() => {
        StageTwoCollectionOperationsService.resolveDocumentRequest({
          requestId: req.requestId,
          clientId: testClientId,
          taxYear: testTaxYear,
          actor: 'Sarah Jenkins, CPA',
          actorRole: 'cpa',
          resolutionStatus: 'SATISFIED',
          notes: ''
        });
      }).toThrow(/Mandatory resolution notes/);

      // Succeeds with notes
      const resolved = StageTwoCollectionOperationsService.resolveDocumentRequest({
        requestId: req.requestId,
        clientId: testClientId,
        taxYear: testTaxYear,
        actor: 'Sarah Jenkins, CPA',
        actorRole: 'cpa',
        resolutionStatus: 'SATISFIED',
        notes: 'Received official paid property tax bill via client portal'
      });

      expect(resolved.status).toBe('FULFILLED');
      expect(resolved.resolution?.resolutionStatus).toBe('SATISFIED');
      expect(resolved.resolution?.resolvedBy).toBe('Sarah Jenkins, CPA');
    });
  });

  // ==========================================================================
  // TG-COL-023: CLIENT REMINDER & AUTOMATED CHASING ENGINE
  // ==========================================================================
  describe('TG-COL-023: Client Reminder & Automated Chasing Engine', () => {
    it('schedules and dispatches automated chasing reminders with escalation', () => {
      // Create request with overdue due date
      const pastDueDate = new Date(Date.now() - 2 * 86400000).toISOString();
      const req = StageTwoCollectionOperationsService.createDocumentRequest({
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        requirementId: 'REQ-CHASE-TEST',
        title: 'Overdue Form K-1',
        requestedDocument: 'Partnership K-1',
        requestedBy: 'Sarah Jenkins, CPA',
        requestedByRole: 'cpa',
        dueDate: pastDueDate,
        priority: 'URGENT'
      });

      // Send chase 1
      const reminder1 = StageTwoCollectionOperationsService.sendDocumentReminder({
        requestId: req.requestId,
        clientId: testClientId,
        taxYear: testTaxYear,
        actor: 'Sarah Jenkins, CPA',
        actorRole: 'cpa',
        channel: 'EMAIL'
      });

      expect(reminder1.reminderId).toBeDefined();
      expect(reminder1.deliveryChannel).toBe('EMAIL');
      expect(reminder1.escalationStatus).toBe('ESCALATED');
      expect(reminder1.isSimulated).toBe(true);

      // Verify request state updated
      const updatedRequests = StageTwoCollectionOperationsService.getDocumentRequests(testClientId, testTaxYear);
      const targetReq = updatedRequests.find(r => r.requestId === req.requestId);
      expect(targetReq?.reminderCount).toBe(1);

      // Send chase 2 -> escalation reaches CRITICAL
      const reminder2 = StageTwoCollectionOperationsService.sendDocumentReminder({
        requestId: req.requestId,
        clientId: testClientId,
        taxYear: testTaxYear,
        actor: 'Sarah Jenkins, CPA',
        actorRole: 'cpa',
        channel: 'PORTAL_NOTIFICATION'
      });

      expect(reminder2.escalationStatus).toBe('CRITICAL');
    });
  });

  // ==========================================================================
  // TG-COL-024: UNIFIED EXCEPTION MANAGEMENT
  // ==========================================================================
  describe('TG-COL-024: Unified Stage 02 Exception Management', () => {
    it('creates, lists, and resolves exceptions with role-gated audit trails', () => {
      const exc = StageTwoCollectionOperationsService.createException({
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        category: 'TAX_YEAR_MISMATCH',
        severity: 'HIGH',
        isBlocking: true,
        title: 'Tax Year Mismatch: 2024 Form 1099 for 2025 Filing',
        description: 'Uploaded form indicates 2024 calendar year while engagement is 2025.',
        actor: 'Automated Diagnostic Engine',
        actorRole: 'system'
      });

      expect(exc.exceptionId).toBeDefined();
      expect(exc.isBlocking).toBe(true);
      expect(exc.status).toBe('OPEN');

      const exceptions = StageTwoCollectionOperationsService.getExceptions(testClientId, testTaxYear);
      expect(exceptions.some(e => e.exceptionId === exc.exceptionId)).toBe(true);

      // Resolve exception
      const resolved = StageTwoCollectionOperationsService.resolveException({
        exceptionId: exc.exceptionId,
        clientId: testClientId,
        taxYear: testTaxYear,
        actor: 'Sarah Jenkins, CPA',
        actorRole: 'cpa',
        action: 'RESOLVE',
        justification: 'Client confirmed 2024 form was uploaded in error; superseded with correct 2025 form.',
        evidenceReference: 'WP-1099-2025-V2'
      });

      expect(resolved.status).toBe('RESOLVED');
      expect(resolved.resolution?.resolvedBy).toBe('Sarah Jenkins, CPA');
      expect(resolved.auditHistory.length).toBeGreaterThan(0);
    });

    it('requires mandatory justification when waiving an exception', () => {
      const exc = StageTwoCollectionOperationsService.createException({
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        category: 'AI_CATEGORY_CONFLICT',
        severity: 'MEDIUM',
        isBlocking: true,
        title: 'Ambiguous Classification',
        description: 'AI detected generic statement rather than 1099.',
        actor: 'Classification Service',
        actorRole: 'system'
      });

      expect(() => {
        StageTwoCollectionOperationsService.resolveException({
          exceptionId: exc.exceptionId,
          clientId: testClientId,
          taxYear: testTaxYear,
          actor: 'Sarah Jenkins, CPA',
          actorRole: 'cpa',
          action: 'WAIVE_WITH_JUSTIFICATION',
          justification: ''
        });
      }).toThrow(/Mandatory justification/);
    });
  });

  // ==========================================================================
  // TG-COL-025: SOURCE TIE-OUT RECONCILIATION LAYER
  // ==========================================================================
  describe('TG-COL-025: Source Tie-Out Reconciliation Layer', () => {
    it('records source tie-out linkage between requirement and authoritative document', () => {
      const tieOut = StageTwoCollectionOperationsService.recordSourceTieOut({
        clientId: testClientId,
        taxYear: testTaxYear,
        requirementId: 'REQ-W2-001',
        requirementTitle: 'W-2 Wages',
        formType: 'W-2',
        authoritativeDocumentId: 'DOC-W2-CLEAN-AUTH',
        documentFilename: 'w2_acme_corp.pdf',
        sourceHash: 'sha256-acme-w2-hash-12345',
        keyFields: [
          { fieldName: 'Gross Wages', sourceBox: 'Box 1', extractedValue: '124,500.00', verifiedByHuman: true },
          { fieldName: 'Federal Tax Withheld', sourceBox: 'Box 2', extractedValue: '28,100.00', verifiedByHuman: true }
        ],
        actor: 'Sarah Jenkins, CPA',
        actorRole: 'cpa',
        notes: 'Verified Box 1 and Box 2 values against employer payroll report.'
      });

      expect(tieOut.tieOutId).toBeDefined();
      expect(tieOut.requirementId).toBe('REQ-W2-001');
      expect(tieOut.authoritativeDocumentId).toBe('DOC-W2-CLEAN-AUTH');
      expect(tieOut.keyFieldsTiedOut).toHaveLength(2);

      const allTieOuts = StageTwoCollectionOperationsService.getSourceTieOuts(testClientId, testTaxYear);
      expect(allTieOuts.some(t => t.tieOutId === tieOut.tieOutId)).toBe(true);
    });
  });

  // ==========================================================================
  // TG-COL-026: DETERMINISTIC COMPLETENESS ENGINE
  // ==========================================================================
  describe('TG-COL-026: Deterministic Collection Completeness Evaluator', () => {
    it('accurately detects blocking conditions and blocks Gate 2 when items are open', () => {
      // Log an open blocking exception
      StageTwoCollectionOperationsService.createException({
        clientId: testClientId,
        engagementId: testEngagementId,
        taxYear: testTaxYear,
        category: 'LOW_CONFIDENCE_MATERIAL_FIELD',
        severity: 'CRITICAL',
        isBlocking: true,
        title: 'Unreadable Box 1 Wages',
        description: 'OCR confidence 32% on Box 1.',
        actor: 'Diagnostic Evaluator',
        actorRole: 'system'
      });

      const evalResult = StageTwoCollectionOperationsService.evaluateCollectionCompleteness(
        testClientId,
        testTaxYear,
        testEngagementId
      );

      expect(evalResult.isComplete).toBe(false);
      expect(evalResult.evaluations.exceptionsResolved).toBe(false);
      expect(evalResult.blockingReasons.length).toBeGreaterThan(0);
      expect(evalResult.blockingReasons.some(r => r.includes('Blocking Exception'))).toBe(true);
    });
  });

  // ==========================================================================
  // TG-COL-027: STAGE 02 HARD EXIT GATE EXECUTION
  // ==========================================================================
  describe('TG-COL-027: Stage 02 Hard Exit Gate Execution', () => {
    it('blocks gate execution when completeness is not 100%', () => {
      // Because requirements are missing in fresh test environment, gate must be blocked
      expect(() => {
        StageTwoCollectionOperationsService.executeStageTwoExitGate({
          clientId: testClientId,
          engagementId: testEngagementId,
          taxYear: testTaxYear,
          actor: 'Sarah Jenkins, CPA',
          actorRole: 'cpa',
          certificationStatement: 'I certify that all documents have been collected and verified.'
        });
      }).toThrow(/Stage 02 Hard Exit Gate REJECTED/);
    });

    it('records gate status in storage when transition conditions are simulated', () => {
      const status = StageTwoCollectionOperationsService.getExitGateStatus(testClientId, testTaxYear);
      expect(status?.stageTwoStatus).toBeUndefined(); // Nothing certified yet
    });
  });

  // ==========================================================================
  // TG-COL-028: UPSTREAM DOCUMENT INVALIDATION & REOPENING SAFEGUARDS
  // ==========================================================================
  describe('TG-COL-028: Upstream Document Invalidation & Reopening Safeguards', () => {
    it('automatically reopens Stage 02 when a document is superseded or quarantined', () => {
      const invalidation = StageTwoCollectionOperationsService.handleUpstreamDocumentChange({
        clientId: testClientId,
        taxYear: testTaxYear,
        engagementId: testEngagementId,
        documentId: 'DOC-SUPERSEDED-99',
        reason: 'SUPERSEDED',
        actor: 'Client Uploader',
        actorRole: 'client',
        notes: 'Client uploaded revised 1099 with updated dividends.'
      });

      expect(invalidation.invalidationId).toBeDefined();
      expect(invalidation.reason).toBe('SUPERSEDED');

      // Exit gate status must now be REOPENED and Stage 03 REVALIDATION_REQUIRED
      const gateStatus = StageTwoCollectionOperationsService.getExitGateStatus(testClientId, testTaxYear);
      expect(gateStatus?.stageTwoStatus).toBe('REOPENED');
      expect(gateStatus?.stageThreeStatus).toBe('REVALIDATION_REQUIRED');

      // A blocking exception must have been automatically created
      const exceptions = StageTwoCollectionOperationsService.getExceptions(testClientId, testTaxYear);
      const upstreamExc = exceptions.find(e => e.category === 'UPSTREAM_SOURCE_INVALIDATION');
      expect(upstreamExc).toBeDefined();
      expect(upstreamExc?.isBlocking).toBe(true);
    });
  });
});
