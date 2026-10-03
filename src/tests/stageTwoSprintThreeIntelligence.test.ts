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

  // ==========================================================================
  // TG-COL-OCR-PROD: PRODUCTION CLOUD DOCUMENT INTELLIGENCE & IMAGE TESTS
  // ==========================================================================
  describe('TG-COL-OCR-PROD: Production Cloud Document Intelligence & Image Tests', () => {
    it('processes a real image-based scanned W-2 without searchable text via Cloud Document AI', async () => {
      StageTwoDocumentIntelligenceService.setProviderMode('CLOUD');

      // Configure mock Cloud Document AI transport handler representing cloud extraction
      StageTwoDocumentIntelligenceService.setCloudTransportHandler(async ({ documentId, processor }) => {
        expect(processor).toBeDefined();
        return {
          text: `
            Form W-2 Wage and Tax Statement 2025
            Employer: Apex Technical Solutions, Inc. EIN: 12-3456789
            Employee: Michael S. Reynolds SSN: XXX-XX-4819
            Box 1 Wages: 142500.00 Box 2 Federal Withholding: 28500.00
            Box 15 State: SC State wages: 142500.00 State tax: 9262.50
          `,
          pageCount: 1,
          entities: [
            { type: 'employer_name', mentionText: 'Apex Technical Solutions, Inc.', confidence: 0.98, page: 1, boundingBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 } },
            { type: 'wages', mentionText: '142500.00', confidence: 0.97, page: 1, boundingBox: { x: 0.5, y: 0.3, width: 0.2, height: 0.04 } }
          ],
          confidenceAverage: 0.96,
          orientationDegrees: 0,
          dpi: 300
        };
      });

      // Pure raster bytes simulating non-searchable image-only PDF
      const rasterBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x00, 0xff, 0xd8, 0xff, 0xe0, 0x00]);

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'scanned_image_w2_no_text.pdf',
        fileBytes: rasterBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });

      const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      expect(intel.ocrState).toBe('COMPLETED');
      expect(intel.providerMode).toBe('CLOUD');
      expect(intel.ocrArtifact?.providerName).toBe('Google Cloud Document AI');
      expect(intel.ocrArtifact?.isProduction).toBe(true);
      expect(intel.ocrArtifact?.processingResult).toBe('SUCCESS');
      expect(intel.ocrArtifact?.boundingBoxCount).toBeGreaterThanOrEqual(2);
      expect(intel.aiDetectedCategory).toBe('W-2');

      const w2Data = intel.extractedData as any;
      expect(w2Data.employerName.extractedValue).toBe('Apex Technical Solutions, Inc.');
      expect(w2Data.wages.extractedValue).toBe(142500.00);
      expect(w2Data.wages.confidenceTier).toBe('HIGH_CONFIDENCE');
      expect(w2Data.wages.provider).toBe('Google Cloud Document AI');
    });

    it('routes low-confidence or partially obscured scanned image to human review', async () => {
      StageTwoDocumentIntelligenceService.setProviderMode('CLOUD');

      StageTwoDocumentIntelligenceService.setCloudTransportHandler(async () => ({
        text: 'W-2 Wage Statement ... [obscured]',
        pageCount: 1,
        entities: [],
        confidenceAverage: 0.52, // Below 0.65 threshold
        isObscured: true,
        orientationDegrees: 90
      }));

      const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'blurry_rotated_photo_w2.png',
        fileBytes: imageBytes,
        claimedMimeType: 'image/png',
        claimedCategory: 'W-2'
      });

      const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      expect(intel.ocrState).toBe('REQUIRES_REVIEW');
      expect(intel.humanReviewRequired).toBe(true);
      expect(intel.staffReviewRequired).toBe(true);
      expect(intel.ocrArtifact?.processingResult).toBe('PARTIAL');
      expect(intel.ocrArtifact?.errorInfo).toContain('Low visual confidence or partially obscured');
    });

    it('enforces OCR_SERVICE_UNAVAILABLE and RETRY_PENDING without silent local fallback when cloud is unavailable', async () => {
      StageTwoDocumentIntelligenceService.setProviderMode('CLOUD');
      StageTwoDocumentIntelligenceService.setCloudTransportHandler(undefined); // No cloud credentials/transport

      const pdfBytes = new TextEncoder().encode('%PDF-1.7 image document');
      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'scanned_1099.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: '1099-NEC'
      });

      const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      // Must NOT silently fallback to LOCAL in production CLOUD mode
      expect(intel.ocrState).toBe('OCR_SERVICE_UNAVAILABLE');
      expect(intel.ocrArtifact?.processingResult).toBe('SERVICE_UNAVAILABLE');
      expect(intel.ocrArtifact?.retryState).toBe('RETRY_PENDING');
      expect(intel.ocrArtifact?.staffReviewRequired).toBe(true);
      expect(intel.ocrArtifact?.retryCount).toBe(1);
      expect(intel.ocrArtifact?.nextRetryTimestamp).toBeDefined();
      expect(intel.humanReviewRequired).toBe(true);
    });

    it('supports FAIL_SAFE mode with mandatory human review for business continuity', async () => {
      StageTwoDocumentIntelligenceService.setProviderMode('FAIL_SAFE');

      const pdfBytes = new TextEncoder().encode('%PDF-1.7 standard w2');
      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploader: 'Client User',
        originalFilename: 'w2_failsafe.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });

      const intel = await StageTwoDocumentIntelligenceService.processDocumentThroughOcr(stagedDoc);

      expect(intel.ocrState).toBe('REQUIRES_REVIEW');
      expect(intel.ocrArtifact?.providerName).toBe('TaxGuard Document Fail-Safe OCR');
      expect(intel.ocrArtifact?.staffReviewRequired).toBe(true);
      expect(intel.humanReviewRequired).toBe(true);
    });
  });
});
