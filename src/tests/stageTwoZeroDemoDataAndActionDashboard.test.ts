/**
 * stageTwoZeroDemoDataAndActionDashboard.test.ts
 *
 * Automated verification for Stage 02 collection and Client Portal requirements:
 * - Section 43: ZERO-DEMO-DATA CLIENT WORKSPACE (newly registered client has 0 uploads, 0 requests, no sample documents or hardcoded baselines)
 * - Section 44: Action-oriented client dashboard in plain language
 * - Section 45: Step-by-step "Your Tax Preparation" home experience (Steps 1-6) with single primary "Continue" action
 * - Section 46: Real-time server-authoritative "What You Need To Do" panel
 * - Section 47: Real-time "Missing Documents" with clear reasons why items are missing and dynamic "Confirm Not Applicable" resolution
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StageTwoCollectionService } from '../services/stageTwoCollectionService';
import { StageTwoCollectionOperationsService } from '../services/stageTwoCollectionOperationsService';
import {
  TaxDocumentRequirementEngine,
  DEFAULT_QUESTIONNAIRE_ANSWERS
} from '../services/taxDocumentRequirementEngine';

describe('Stage 02 Zero-Demo-Data & Action-Oriented Client Experience', () => {
  const newClientId = `cli_test_new_${Date.now()}`;
  const taxYear = 2025;

  beforeEach(() => {
    // Clear any test storage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('Section 43: Zero-Demo-Data Client Workspace', () => {
    it('ensures a newly registered client starts with exactly 0 uploaded documents', () => {
      const uploads = StageTwoCollectionService.getUploadedDocuments(newClientId, taxYear);
      expect(uploads).toBeDefined();
      expect(uploads.length).toBe(0);
    });

    it('ensures a newly registered client starts with 0 unverified document requests unless created by staff', () => {
      const requests = StageTwoCollectionOperationsService.getDocumentRequests(newClientId, taxYear);
      expect(requests).toBeDefined();
      expect(requests.length).toBe(0);
    });

    it('ensures a newly registered client starts with 0 unverified exceptions', () => {
      const exceptions = StageTwoCollectionOperationsService.getExceptions(newClientId, taxYear);
      expect(exceptions).toBeDefined();
      expect(exceptions.length).toBe(0);
    });
  });

  describe('Section 44 & 45: Step-by-Step Experience and Next Action Determination', () => {
    it('evaluates dynamic requirements and identifies missing items without demo mock data', () => {
      // Initialize with default questionnaire answers
      TaxDocumentRequirementEngine.saveQuestionnaire(newClientId, taxYear, {
        ...DEFAULT_QUESTIONNAIRE_ANSWERS,
        hasW2Employment: true,
        hasPriorYearTaxReturn: true,
        residentState: 'SC'
      });

      const uploads = StageTwoCollectionService.getUploadedDocuments(newClientId, taxYear);
      expect(uploads.length).toBe(0);

      const evaluation = TaxDocumentRequirementEngine.evaluateMissingDocuments({
        clientId: newClientId,
        taxYear,
        uploadedDocs: []
      });

      expect(evaluation.totalRequirements).toBeGreaterThan(0);
      expect(evaluation.receivedCount).toBe(0);
      expect(evaluation.missingCount).toBeGreaterThan(0);
      expect(evaluation.missingItems.length).toBe(evaluation.missingCount);
    });
  });

  describe('Section 46 & 47: Real-Time Missing Documents & Confirm Not Applicable', () => {
    it('provides clear reasons why documents are needed', () => {
      TaxDocumentRequirementEngine.saveQuestionnaire(newClientId, taxYear, {
        ...DEFAULT_QUESTIONNAIRE_ANSWERS,
        hasW2Employment: true,
        hasPriorYearTaxReturn: true
      });

      const evaluation = TaxDocumentRequirementEngine.evaluateMissingDocuments({
        clientId: newClientId,
        taxYear,
        uploadedDocs: []
      });

      const w2Req = evaluation.missingItems.find(i => i.requirementId === 'REQ-FED-W2');
      expect(w2Req).toBeDefined();
      expect(w2Req?.requirementReason).toBeDefined();
      expect(w2Req?.requirementReason.length).toBeGreaterThan(10);
      expect(w2Req?.whyDoWeNeedIt).toBeDefined();
    });

    it('dynamically resolves missing requirements in real time when taxpayer confirms Not Applicable', () => {
      TaxDocumentRequirementEngine.saveQuestionnaire(newClientId, taxYear, {
        ...DEFAULT_QUESTIONNAIRE_ANSWERS,
        hasW2Employment: true,
        hasPriorYearTaxReturn: true
      });

      const initialEvaluation = TaxDocumentRequirementEngine.evaluateMissingDocuments({
        clientId: newClientId,
        taxYear,
        uploadedDocs: []
      });

      const targetItem = initialEvaluation.missingItems[0];
      expect(targetItem).toBeDefined();
      const initialMissingCount = initialEvaluation.missingCount;

      // Taxpayer confirms Not Applicable
      TaxDocumentRequirementEngine.markNotApplicable(
        newClientId,
        taxYear,
        targetItem.requirementId,
        'Taxpayer confirmed no applicable transactions for this form in 2025.'
      );

      expect(TaxDocumentRequirementEngine.isNotApplicable(newClientId, taxYear, targetItem.requirementId)).toBe(true);

      // Re-evaluate missing documents
      const updatedEvaluation = TaxDocumentRequirementEngine.evaluateMissingDocuments({
        clientId: newClientId,
        taxYear,
        uploadedDocs: []
      });

      expect(updatedEvaluation.missingCount).toBe(initialMissingCount - 1);
      expect(updatedEvaluation.resolvedItems.some(i => i.requirementId === targetItem.requirementId)).toBe(true);
      expect(updatedEvaluation.missingItems.some(i => i.requirementId === targetItem.requirementId)).toBe(false);
    });

    it('uploads do not automatically mark documents as verified (fail-closed architecture)', async () => {
      // Ingest a document
      const doc = await StageTwoCollectionService.ingestDocumentUpload({
        clientId: newClientId,
        engagementId: `eng_${taxYear}_${newClientId}`,
        taxYear,
        uploadedBy: 'Client Taxpayer',
        originalFileName: '2025_W2_Statement.pdf',
        fileSizeBytes: 2048,
        mimeType: 'application/pdf',
        claimedCategory: 'FORM_W2',
        associatedRequirementId: 'REQ-W2'
      });

      expect(doc.processingStatus).toBe('Received');
      expect(doc.isVerified).toBe(false);
      expect(doc.taxDataVerified).toBe(false);
      expect(doc.humanReviewed).toBe(false);
    });
  });
});
