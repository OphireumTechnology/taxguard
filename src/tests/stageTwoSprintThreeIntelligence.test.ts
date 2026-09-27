import { describe, it, expect, beforeEach } from 'vitest';
import {
  StageTwoDocumentIntelligenceService,
  TaxDocumentCategory,
  CONTROLLED_TAX_CATEGORIES,
  HumanReviewAction
} from '../services/stageTwoDocumentIntelligenceService';
import { StageTwoCollectionService } from '../services/stageTwoCollectionService';
import { StageTwoIntakeSecurityService } from '../services/stageTwoIntakeSecurityService';
import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';

describe('Milestone M2 / Stage 02: Collect — Sprint 3 Document Intelligence', () => {
  const CLIENT_ID = 'cli_sprint3_test';
  const ENGAGEMENT_ID = 'ENG-2025-SPRINT3';
  const TAX_YEAR = 2025;

  beforeEach(() => {
    StageTwoDocumentIntelligenceService.resetForTesting();
    StageTwoIntakeSecurityService.resetForTesting();
    StageTwoCollectionService.resetCollectionForTesting();
  });

  describe('TG-COL-012: Document OCR Processing & Artifacts', () => {
    it('generates an OCR processing artifact with text preview and page counts for cleared documents', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.7 standard w2 employee wage statement');

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client Test',
        originalFilename: 'w2_acme_corp.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });

      expect(stagedDoc.isReadyForOcr).toBe(true);

      const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);
      expect(intel).toBeDefined();
      expect(intel.ocrState).toBe('COMPLETED');
      expect(intel.ocrArtifact).toBeDefined();
      expect(intel.ocrArtifact?.processingResult).toBe('SUCCESS');
      expect(intel.ocrArtifact?.pageCount).toBeGreaterThanOrEqual(1);
      expect(intel.ocrArtifact?.rawTextPreview.length).toBeGreaterThan(0);
      expect(intel.ocrArtifact?.providerName).toContain('SIMULATED / DEVELOPMENT');
    });

    it('blocks OCR processing if document has not cleared security gates', async () => {
      const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ executable

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client Test',
        originalFilename: 'invoice.exe',
        fileBytes: exeBytes,
        claimedMimeType: 'application/x-msdownload',
        claimedCategory: 'W-2'
      });

      expect(stagedDoc.isReadyForOcr).toBe(false);

      await expect(
        StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc)
      ).rejects.toThrow(/OCR Gate Blocked/);
    });
  });

  describe('TG-COL-013: AI Document Classification & Conflict Detection', () => {
    it('correctly maps to one of the 20 controlled tax categories', () => {
      expect(CONTROLLED_TAX_CATEGORIES.length).toBe(20);
      expect(CONTROLLED_TAX_CATEGORIES).toContain('W-2');
      expect(CONTROLLED_TAX_CATEGORIES).toContain('1099-NEC');
      expect(CONTROLLED_TAX_CATEGORIES).toContain('1099-MISC');
      expect(CONTROLLED_TAX_CATEGORIES).toContain('1099-INT');
      expect(CONTROLLED_TAX_CATEGORIES).toContain('1099-DIV');
      expect(CONTROLLED_TAX_CATEGORIES).toContain('K-1');
      expect(CONTROLLED_TAX_CATEGORIES).toContain('Bank Statement');
      expect(CONTROLLED_TAX_CATEGORIES).toContain('Trial Balance');
    });

    it('detects category mismatch between client claimed category and AI classification', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 form 1099-int interest income statement');

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: '1099_int_interest_income.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2' // Conflict with 1099-INT
      });

      const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);
      expect(intel.classificationConflict).toBe(true);
      expect(intel.clientClaimedCategory).toBe('W-2');
      expect(intel.aiDetectedCategory).toBe('1099-INT');
      expect(intel.humanReviewRequired).toBe(true);
      expect(intel.humanReviewReasons).toContain('CATEGORY_CONFLICT');
    });
  });

  describe('TG-COL-014 & TG-COL-015: Structured Data Extraction & Low-Confidence Flagging', () => {
    it('extracts normalized schema with provenance, box references, and confidence tiers', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 form w-2 wage and tax statement');

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'w2_form_2025.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });

      const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);
      expect(intel.extractedData).toBeDefined();

      const w2Data = intel.extractedData as any;
      expect(w2Data.documentType).toBe('W-2');
      expect(w2Data.wages).toBeDefined();
      expect(w2Data.wages.confidence).toBeGreaterThanOrEqual(0.0);
      expect(w2Data.wages.confidence).toBeLessThanOrEqual(1.0);
      expect(w2Data.wages.isMaterialField).toBe(true);
      expect(w2Data.wages.sourceReference).toContain('Box 1');
      expect(w2Data.employerEin).toBeDefined();
      expect(w2Data.employerEin.isMaterialField).toBe(true);
    });
  });

  describe('TG-COL-016: Duplicate Document Detection', () => {
    it('detects exact hash duplicates and references the original document ID', async () => {
      const fileBytes = new TextEncoder().encode('%PDF-1.4 exact duplicate test payload content');

      // Upload original
      const doc1 = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'fidelity_1099_div.pdf',
        fileBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: '1099-DIV'
      });
      await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(doc1);

      // Upload identical file again
      const doc2 = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'fidelity_1099_div_copy.pdf',
        fileBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: '1099-DIV'
      });
      const intel2 = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(doc2);

      expect(intel2.duplicateDetection.isDuplicate).toBe(true);
      expect(intel2.duplicateDetection.duplicateType).toBe('EXACT_HASH');
      expect(intel2.duplicateDetection.matchedDocumentId).toBe(doc1.documentId);
      expect(intel2.humanReviewRequired).toBe(true);
      expect(intel2.humanReviewReasons).toContain('DUPLICATE_SUSPECTED');
    });
  });

  describe('TG-COL-017: Version Intelligence & Revision Tracking', () => {
    it('identifies corrected versions, updates version numbers, and flags downstream revalidation', async () => {
      const bytes1 = new TextEncoder().encode('%PDF-1.4 original w2 statement v1');
      const bytes2 = new TextEncoder().encode('%PDF-1.4 corrected w2 statement v2');

      // Upload original W-2
      const doc1 = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'w2_acme_2025.pdf',
        fileBytes: bytes1,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });
      const intel1 = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(doc1);
      expect(intel1.versionIntelligence.versionNumber).toBe(1);
      expect(intel1.versionIntelligence.relationship).toBe('ORIGINAL');

      // Upload corrected W-2 (W-2c) with different bytes
      const doc2 = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'w2_acme_corrected_revised.pdf',
        fileBytes: bytes2,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });
      const intel2 = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(doc2);

      expect(intel2.versionIntelligence.versionNumber).toBe(2);
      expect(intel2.versionIntelligence.relationship).toBe('CORRECTED');
      expect(intel2.versionIntelligence.supersedesDocId).toBe(doc1.documentId);
      expect(intel2.versionIntelligence.requiresDownstreamRevalidation).toBe(true);
      expect(intel2.humanReviewRequired).toBe(true);
      expect(intel2.humanReviewReasons).toContain('CORRECTED_VERSION_DETECTED');
    });
  });

  describe('TG-COL-018: Strict Governance & Boundary Enforcement', () => {
    it('STRICT GOVERNANCE INVARIANT: AI proposed data is NEVER treated as verified tax data', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 schedule k-1 partner income statement');

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'k1_partnership.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'K-1'
      });

      const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      // Invariants: AI proposed only, tax figures unverified
      expect(intel.isAiProposedOnly).toBe(true);
      expect(intel.taxDataVerified).toBe(false);
      expect(intel.humanReviewed).toBe(false);
    });
  });

  describe('TG-COL-019 & TG-COL-020: Operational Human Review Queue & Accountant Dispositions', () => {
    it('adds flagged documents to review queue and allows CPA to execute dispositions with audit trail', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 bank statement chase operating account');

      // Ingest document that triggers category conflict
      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'bank_statement_chase.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: '1099-NEC' // Conflict with Bank Statement
      });

      await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      const queue = StageTwoDocumentIntelligenceService.getReviewQueue(CLIENT_ID, TAX_YEAR, 'cpa');
      expect(queue.length).toBeGreaterThanOrEqual(1);

      const reviewItem = queue.find(q => q.documentId === stagedDoc.documentId);
      expect(reviewItem).toBeDefined();
      expect(reviewItem?.status).toBe('PENDING_REVIEW');
      expect(reviewItem?.reviewReasons).toContain('CATEGORY_CONFLICT');

      // Human CPA executes RECLASSIFY disposition
      const updatedRecord = StageTwoDocumentIntelligenceService.executeHumanReviewAction({
        documentId: stagedDoc.documentId,
        action: 'RECLASSIFY',
        actor: 'usr_cpa_partner',
        actorRole: 'cpa',
        justification: 'Client mistagged bank statement as 1099-NEC. Reclassified to Bank Statement after checking transaction history.',
        reclassifiedCategory: 'Bank Statement'
      });

      expect(updatedRecord).toBeDefined();
      expect(updatedRecord.humanReviewed).toBe(true);
      expect(updatedRecord.aiDetectedCategory).toBe('Bank Statement');
      expect(updatedRecord.classificationConflict).toBe(false);

      // Verify review queue status updated
      const updatedQueue = StageTwoDocumentIntelligenceService.getReviewQueue(CLIENT_ID, TAX_YEAR, 'cpa');
      const updatedQueueItem = updatedQueue.find(q => q.documentId === stagedDoc.documentId);
      expect(updatedQueueItem?.status).toBe('REVIEWED');
      expect(updatedQueueItem?.reviewAction).toBe('RECLASSIFY');

      // Verify immutable audit event was logged
      const logs = TaxGuardAuditService.getLogs();
      const reviewLog = logs.find(l => l.recordId === stagedDoc.documentId && l.action === 'HUMAN_REVIEW_COMPLETED');
      expect(reviewLog).toBeDefined();
      expect(reviewLog?.userId).toBe('usr_cpa_partner');
      expect(reviewLog?.details).toContain('RECLASSIFY');
    });

    it('enforces mandatory justification for review actions', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 other miscellaneous document');

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'ambiguous_form.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Other / Unknown'
      });

      await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      expect(() =>
        StageTwoDocumentIntelligenceService.executeHumanReviewAction({
          documentId: stagedDoc.documentId,
          action: 'ACCEPT',
          actor: 'usr_cpa',
          actorRole: 'cpa',
          justification: '   ' // Blank justification
        })
      ).toThrow(/Justification is mandatory/);
    });

    it('supports field correction with full provenance preservation', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 form w-2 wage and tax statement poor quality scan');

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'w2_with_poor_scan.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });

      await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      // CPA corrects wages figure
      const updatedIntel = StageTwoDocumentIntelligenceService.executeHumanReviewAction({
        documentId: stagedDoc.documentId,
        action: 'CORRECT',
        actor: 'usr_cpa_1',
        actorRole: 'cpa',
        justification: 'Poor scan smudged Box 1 wages. Verified against pay stub #48.',
        fieldCorrections: {
          wages: 92450.00
        }
      });

      const w2Data = updatedIntel.extractedData as any;
      expect(w2Data.wages.extractedValue).toBe(92450.00);
      expect(w2Data.wages.humanReviewStatus).toBe('HUMAN_CORRECTED');
      expect(w2Data.wages.correctedBy).toBe('usr_cpa_1');
    });

    it('blocks client role from self-verifying or executing review actions', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 sample document');

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'document.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Other / Unknown'
      });

      await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      expect(() =>
        StageTwoDocumentIntelligenceService.executeHumanReviewAction({
          documentId: stagedDoc.documentId,
          action: 'ACCEPT',
          actor: 'client_taxpayer',
          actorRole: 'client', // Client cannot self-verify!
          justification: 'I approve my own document'
        })
      ).toThrow(/Unauthorized/);
    });
  });
});
