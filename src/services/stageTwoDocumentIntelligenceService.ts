/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Milestone M2 / Stage 02: Collect — Sprint 3
 * Document Intelligence Service: OCR, AI Classification, Structured Extraction,
 * Field-Level Confidence, Duplicate Detection & Version Intelligence.
 *
 * Implements:
 * - TG-COL-012: OCR Processing Queue (Gated by READY_FOR_OCR, clean malware, unquarantined, encrypted, verified)
 * - TG-COL-013: AI Document Classification (19 controlled categories, client claimed vs AI detected)
 * - TG-COL-014: Structured Data Extraction (Document-specific schemas, field-level provenance)
 * - TG-COL-015: Confidence Scoring (Configurable thresholds, material field routing)
 * - TG-COL-016: Duplicate Document Detection (Level 1 exact SHA-256 hash, Level 2 logical/semantic)
 * - TG-COL-017: Document Version Intelligence (Original, Corrected, Amended, Replacement, Superseded)
 * - Human Review Queue Operational Model (Role-gated actions, full audit traceability)
 * - Strict AI Governance (AI proposed data != verified tax data; cannot approve deductions/filing)
 */

import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';
import { StagedSecurityDocument, StageTwoIntakeSecurityService } from './stageTwoIntakeSecurityService';

// ============================================================================
// 1. CONTROLLED TAX DOCUMENT CATEGORIES (TG-COL-013)
// ============================================================================

export type TaxDocumentCategory =
  | 'W-2'
  | '1099-INT'
  | '1099-DIV'
  | '1099-NEC'
  | '1099-MISC'
  | '1099-B'
  | '1098'
  | '1095-A'
  | 'K-1'
  | 'Form 941'
  | 'Form 940'
  | 'Trial Balance'
  | 'General Ledger'
  | 'Bank Statement'
  | 'Prior-Year Return'
  | 'Depreciation Schedule'
  | 'Shareholder Basis Worksheet'
  | 'Entity Document'
  | 'Government ID'
  | 'Other / Unknown';

export const CONTROLLED_TAX_CATEGORIES: TaxDocumentCategory[] = [
  'W-2',
  '1099-INT',
  '1099-DIV',
  '1099-NEC',
  '1099-MISC',
  '1099-B',
  '1098',
  '1095-A',
  'K-1',
  'Form 941',
  'Form 940',
  'Trial Balance',
  'General Ledger',
  'Bank Statement',
  'Prior-Year Return',
  'Depreciation Schedule',
  'Shareholder Basis Worksheet',
  'Entity Document',
  'Government ID',
  'Other / Unknown'
];

// ============================================================================
// 2. OCR QUEUE & PIPELINE STATUS (TG-COL-012)
// ============================================================================

export type OcrProcessingState =
  | 'NOT_ELIGIBLE'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'REQUIRES_REVIEW';

export interface OcrProcessingArtifact {
  ocrArtifactId: string;
  documentId: string;
  providerName: string;
  providerVersion: string;
  isProduction: boolean;
  queuedTimestamp: string;
  startedTimestamp?: string;
  completedTimestamp?: string;
  pageCount: number;
  extractedTextReference: string;
  rawTextPreview: string;
  processingResult: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  errorInfo?: string;
}

// ============================================================================
// 3. FIELD-LEVEL PROVENANCE & CONFIDENCE SCORING (TG-COL-014, TG-COL-015)
// ============================================================================

export type ConfidenceTier = 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE' | 'UNREADABLE';

export type HumanFieldReviewStatus = 'PROPOSED' | 'HUMAN_ACCEPTED' | 'HUMAN_CORRECTED' | 'HUMAN_REJECTED';

export interface ExtractedFieldProvenance<T = any> {
  fieldKey: string;
  fieldLabel: string;
  extractedValue: T;
  confidence: number;                  // 0.0 to 1.0 scale
  confidenceTier: ConfidenceTier;
  isMaterialField: boolean;            // Material fields (TIN, Wages, Withholding, Income, Balances) trigger review if low
  page: number;
  sourceBoundingBox?: { x: number; y: number; width: number; height: number };
  extractionMethod: 'KEY_VALUE_PARSER' | 'TABLE_TRANSFORMER' | 'PATTERN_REGEX' | 'SEMANTIC_AI_MODEL';
  sourceReference: string;
  humanReviewStatus: HumanFieldReviewStatus;
  originalExtractedValue?: T;          // Preserved if corrected
  correctedBy?: string;
  correctionReason?: string;
  correctionTimestamp?: string;
}

// ============================================================================
// 4. DOCUMENT-SPECIFIC EXTRACTION SCHEMAS (TG-COL-014)
// ============================================================================

export interface W2ExtractionSchema {
  documentType: 'W-2';
  taxYear: ExtractedFieldProvenance<number>;
  employerName: ExtractedFieldProvenance<string>;
  employerEin: ExtractedFieldProvenance<string>;
  employeeName: ExtractedFieldProvenance<string>;
  maskedSsn: ExtractedFieldProvenance<string>;
  wages: ExtractedFieldProvenance<number>;
  federalWithholding: ExtractedFieldProvenance<number>;
  socialSecurityWages: ExtractedFieldProvenance<number>;
  socialSecurityTax: ExtractedFieldProvenance<number>;
  medicareWages: ExtractedFieldProvenance<number>;
  medicareTax: ExtractedFieldProvenance<number>;
  state?: ExtractedFieldProvenance<string>;
  stateWages?: ExtractedFieldProvenance<number>;
  stateWithholding?: ExtractedFieldProvenance<number>;
}

export interface Form1099NecExtractionSchema {
  documentType: '1099-NEC';
  taxYear: ExtractedFieldProvenance<number>;
  payerName: ExtractedFieldProvenance<string>;
  payerTin: ExtractedFieldProvenance<string>;
  recipientName: ExtractedFieldProvenance<string>;
  recipientTin: ExtractedFieldProvenance<string>;
  nonemployeeCompensation: ExtractedFieldProvenance<number>; // Box 1
  federalTaxWithheld: ExtractedFieldProvenance<number>;     // Box 4
  state?: ExtractedFieldProvenance<string>;
  stateWithholding?: ExtractedFieldProvenance<number>;
}

export interface Form1099MiscExtractionSchema {
  documentType: '1099-MISC';
  taxYear: ExtractedFieldProvenance<number>;
  payerName: ExtractedFieldProvenance<string>;
  payerTin: ExtractedFieldProvenance<string>;
  recipientName: ExtractedFieldProvenance<string>;
  recipientTin: ExtractedFieldProvenance<string>;
  rents: ExtractedFieldProvenance<number>;
  royalties: ExtractedFieldProvenance<number>;
  otherIncome: ExtractedFieldProvenance<number>;
  federalTaxWithheld: ExtractedFieldProvenance<number>;
}

export interface Form1099IntExtractionSchema {
  documentType: '1099-INT';
  taxYear: ExtractedFieldProvenance<number>;
  payerName: ExtractedFieldProvenance<string>;
  payerTin: ExtractedFieldProvenance<string>;
  recipientName: ExtractedFieldProvenance<string>;
  recipientTin: ExtractedFieldProvenance<string>;
  interestIncome: ExtractedFieldProvenance<number>;
  earlyWithdrawalPenalty: ExtractedFieldProvenance<number>;
  federalTaxWithheld: ExtractedFieldProvenance<number>;
}

export interface Form1099DivExtractionSchema {
  documentType: '1099-DIV';
  taxYear: ExtractedFieldProvenance<number>;
  payerName: ExtractedFieldProvenance<string>;
  payerTin: ExtractedFieldProvenance<string>;
  recipientName: ExtractedFieldProvenance<string>;
  recipientTin: ExtractedFieldProvenance<string>;
  totalOrdinaryDividends: ExtractedFieldProvenance<number>;
  qualifiedDividends: ExtractedFieldProvenance<number>;
  totalCapitalGainDistr: ExtractedFieldProvenance<number>;
  federalTaxWithheld: ExtractedFieldProvenance<number>;
}

export interface ScheduleK1ExtractionSchema {
  documentType: 'K-1';
  taxYear: ExtractedFieldProvenance<number>;
  entityName: ExtractedFieldProvenance<string>;
  entityEin: ExtractedFieldProvenance<string>;
  partnerOrShareholderName: ExtractedFieldProvenance<string>;
  partnerOrShareholderTin: ExtractedFieldProvenance<string>;
  ordinaryBusinessIncome: ExtractedFieldProvenance<number>;
  netRentalRealEstateIncome: ExtractedFieldProvenance<number>;
  interestIncome: ExtractedFieldProvenance<number>;
  section179Deduction: ExtractedFieldProvenance<number>;
  distributions: ExtractedFieldProvenance<number>;
}

export interface BankStatementExtractionSchema {
  documentType: 'Bank Statement';
  bankName: ExtractedFieldProvenance<string>;
  accountNumberMasked: ExtractedFieldProvenance<string>;
  statementPeriodStart: ExtractedFieldProvenance<string>;
  statementPeriodEnd: ExtractedFieldProvenance<string>;
  beginningBalance: ExtractedFieldProvenance<number>;
  endingBalance: ExtractedFieldProvenance<number>;
  totalDeposits: ExtractedFieldProvenance<number>;
  totalWithdrawals: ExtractedFieldProvenance<number>;
}

export interface TrialBalanceExtractionSchema {
  documentType: 'Trial Balance' | 'General Ledger';
  entityName: ExtractedFieldProvenance<string>;
  periodEndingDate: ExtractedFieldProvenance<string>;
  totalDebits: ExtractedFieldProvenance<number>;
  totalCredits: ExtractedFieldProvenance<number>;
  outOfBalanceAmount: ExtractedFieldProvenance<number>;
  accountLineItemsCount: ExtractedFieldProvenance<number>;
}

export interface GenericTaxDocumentExtractionSchema {
  documentType: TaxDocumentCategory;
  taxYear?: ExtractedFieldProvenance<number>;
  entityOrPersonName: ExtractedFieldProvenance<string>;
  identifierTin?: ExtractedFieldProvenance<string>;
  primaryAmount?: ExtractedFieldProvenance<number>;
  secondaryAmount?: ExtractedFieldProvenance<number>;
  summaryDescription: ExtractedFieldProvenance<string>;
}

export type ExtractedDataPayload =
  | W2ExtractionSchema
  | Form1099NecExtractionSchema
  | Form1099MiscExtractionSchema
  | Form1099IntExtractionSchema
  | Form1099DivExtractionSchema
  | ScheduleK1ExtractionSchema
  | BankStatementExtractionSchema
  | TrialBalanceExtractionSchema
  | GenericTaxDocumentExtractionSchema;

// ============================================================================
// 5. DUPLICATE & VERSION INTELLIGENCE TYPES (TG-COL-016, TG-COL-017)
// ============================================================================

export type DuplicateType = 'EXACT_HASH' | 'LOGICAL_SEMANTIC' | 'NONE';

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  duplicateType: DuplicateType;
  matchedDocumentId?: string;
  matchedReason?: string;
  confidenceScore: number;
}

export type VersionRelationship =
  | 'ORIGINAL'
  | 'DUPLICATE'
  | 'CORRECTED'
  | 'AMENDED'
  | 'REPLACEMENT'
  | 'SUPERSEDED'
  | 'UNKNOWN_RELATIONSHIP';

export interface VersionIntelligenceResult {
  relationship: VersionRelationship;
  versionNumber: number;
  supersedesDocId?: string;
  supersededByDocId?: string;
  isCurrentActiveVersion: boolean;
  requiresDownstreamRevalidation: boolean;
  notes?: string;
}

// ============================================================================
// 6. HUMAN REVIEW QUEUE TYPES
// ============================================================================

export type HumanReviewReason =
  | 'OCR_INCOMPLETE'
  | 'OCR_FAILED'
  | 'CLASSIFICATION_UNCERTAIN'
  | 'CATEGORY_CONFLICT'
  | 'LOW_CONFIDENCE_MATERIAL_FIELD'
  | 'TIN_EIN_FORMAT_MISMATCH'
  | 'TAX_YEAR_MISMATCH'
  | 'DUPLICATE_SUSPECTED'
  | 'CORRECTED_VERSION_DETECTED'
  | 'DOCUMENT_UNREADABLE';

export type HumanReviewAction =
  | 'ACCEPT'
  | 'CORRECT'
  | 'RECLASSIFY'
  | 'MARK_DUPLICATE'
  | 'MARK_SUPERSEDED'
  | 'REQUEST_REPLACEMENT'
  | 'ESCALATE'
  | 'REJECT';

export interface HumanReviewQueueItem {
  reviewItemId: string;
  documentId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  filename: string;
  clientClaimedCategory: string;
  aiDetectedCategory: TaxDocumentCategory;
  classificationConfidence: number;
  classificationConflict: boolean;
  reviewReasons: HumanReviewReason[];
  flaggedFields: ExtractedFieldProvenance[];
  duplicateMatch?: DuplicateDetectionResult;
  versionRelationship?: VersionIntelligenceResult;
  status: 'PENDING_REVIEW' | 'IN_REVIEW' | 'REVIEWED' | 'ESCALATED';
  assignedReviewer?: string;
  reviewedBy?: string;
  reviewTimestamp?: string;
  reviewAction?: HumanReviewAction;
  reviewNotes?: string;
}

// ============================================================================
// 7. COMPREHENSIVE INTELLIGENCE DOCUMENT RECORD
// ============================================================================

export interface DocumentIntelligenceRecord {
  intelligenceId: string;
  documentId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  filename: string;
  sha256Hash: string;
  
  // OCR Artifacts (TG-COL-012)
  ocrState: OcrProcessingState;
  ocrArtifact?: OcrProcessingArtifact;

  // AI Classification (TG-COL-013)
  clientClaimedCategory: string;
  aiDetectedCategory: TaxDocumentCategory;
  classificationConfidence: number;
  classificationConflict: boolean;
  classificationNotes?: string;

  // Structured Extraction (TG-COL-014)
  extractedData?: ExtractedDataPayload;
  overallExtractionConfidence: number;

  // Duplicate Intelligence (TG-COL-016)
  duplicateDetection: DuplicateDetectionResult;

  // Version Intelligence (TG-COL-017)
  versionIntelligence: VersionIntelligenceResult;

  // Human Review State (TG-COL-015, Operational Queue)
  humanReviewRequired: boolean;
  humanReviewReasons: HumanReviewReason[];
  humanReviewStatus: 'NOT_REQUIRED' | 'PENDING' | 'ACCEPTED' | 'CORRECTED' | 'REJECTED';
  humanReviewedBy?: string;
  humanReviewedTimestamp?: string;

  // Strict Governance Invariants
  isAiProposedOnly: boolean;          // True: Extracted data is proposed, not verified
  taxDataVerified: boolean;           // False: AI extraction does NOT verify tax figures
  humanReviewed: boolean;             // False initially; true only after CPA review
}

// ============================================================================
// 8. OCR SIMULATION & PARSER ENGINE (Clearly labeled SIMULATED / DEVELOPMENT)
// ============================================================================

const DEV_OCR_PROVIDER = 'SIMULATED / DEVELOPMENT OCR (Development & Test Harness - Non-Production)';
const DEV_OCR_VERSION = 'v2.4-dev';

export class StageTwoDocumentIntelligenceService {
  private static inMemoryRecords: Map<string, DocumentIntelligenceRecord> = new Map();
  private static inMemoryReviewQueue: Map<string, HumanReviewQueueItem> = new Map();

  /**
   * Resets internal intelligence state (for testing)
   */
  public static resetForTesting(): void {
    this.inMemoryRecords.clear();
    this.inMemoryReviewQueue.clear();
  }

  // ==========================================================================
  // TG-COL-012: OCR PROCESSING QUEUE & INVARIANT GATING
  // ==========================================================================

  /**
   * Enqueues and processes a document through OCR.
   * STRICT SECURITY BOUNDARY:
   * A document MUST NOT enter OCR unless:
   * 1. pipelineStatus = READY_FOR_OCR
   * 2. malwareStatus = CLEAN
   * 3. quarantineStatus != QUARANTINED
   * 4. encryptionStatus = COMPLETE
   * 5. integrityStatus = VERIFIED
   */
  public static async processDocumentThroughOcr(
    stagedDoc: StagedSecurityDocument
  ): Promise<DocumentIntelligenceRecord> {
    // 1. Invariant Gate Verification
    const isReadyForOcr = stagedDoc.isReadyForOcr === true;
    const isClean = stagedDoc.malwareScanStatus === 'CLEAN';
    const notQuarantined = stagedDoc.quarantineStatus !== 'QUARANTINED';
    const isEncrypted = stagedDoc.encryptionStatus === 'COMPLETE';
    const isIntegrityVerified = stagedDoc.integrityRecord?.integrityVerificationStatus === 'VERIFIED';

    const gateCleared = isReadyForOcr && isClean && notQuarantined && isEncrypted && isIntegrityVerified;

    if (!gateCleared) {
      // Security violation: Generate audit alarm and reject
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: stagedDoc.clientId,
        userEmail: `${stagedDoc.clientId}@artaxservices.com`,
        userRole: 'system',
        ipAddress: '127.0.0.1',
        action: 'SECURITY_VIOLATION_OCR_BYPASS_ATTEMPT',
        recordType: 'document',
        recordId: stagedDoc.documentId,
        result: 'denied',
        riskLevel: 'critical',
        details: `OCR PROCESSING REJECTED: Invariant check failed! Ready=${isReadyForOcr}, Clean=${isClean}, NotQuarantined=${notQuarantined}, Encrypted=${isEncrypted}, Integrity=${isIntegrityVerified}.`
      });

      throw new Error(
        `OCR Gate Blocked: Document ${stagedDoc.documentId} has not cleared mandatory security gates (Ready: ${isReadyForOcr}, Malware: ${stagedDoc.malwareScanStatus}, Quarantine: ${stagedDoc.quarantineStatus}).`
      );
    }

    // Log OCR Queued
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: stagedDoc.clientId,
      userEmail: `${stagedDoc.clientId}@artaxservices.com`,
      userRole: 'system',
      ipAddress: '127.0.0.1',
      action: 'OCR_QUEUED',
      recordType: 'document',
      recordId: stagedDoc.documentId,
      result: 'success',
      riskLevel: 'routine',
      details: `Document ${stagedDoc.documentId} admitted to OCR processing queue.`
    });

    // 2. Perform OCR (Simulated/Dev engine with deterministic heuristics)
    const ocrArtifactId = `OCR-${stagedDoc.documentId}-${Date.now().toString(36)}`;
    const queuedTime = new Date().toISOString();

    // Check if filename indicates a simulated unreadable/corrupt file for testing
    const isSimulatedCorrupt = stagedDoc.originalFilename.toLowerCase().includes('corrupt') ||
      stagedDoc.originalFilename.toLowerCase().includes('unreadable');

    let ocrState: OcrProcessingState = 'COMPLETED';
    let rawText = '';
    let pageCount = 1;
    let processingResult: 'SUCCESS' | 'PARTIAL' | 'FAILED' = 'SUCCESS';
    let errorInfo: string | undefined = undefined;

    if (isSimulatedCorrupt) {
      ocrState = 'FAILED';
      processingResult = 'FAILED';
      errorInfo = 'OCR Engine: Low image resolution (< 72 DPI) or corrupted raster data prevents optical recognition.';
    } else {
      rawText = this.generateSimulatedOcrText(stagedDoc);
      pageCount = stagedDoc.originalFilename.toLowerCase().includes('multi') ? 3 : 1;
    }

    const ocrArtifact: OcrProcessingArtifact = {
      ocrArtifactId,
      documentId: stagedDoc.documentId,
      providerName: DEV_OCR_PROVIDER,
      providerVersion: DEV_OCR_VERSION,
      isProduction: false,
      queuedTimestamp: queuedTime,
      startedTimestamp: queuedTime,
      completedTimestamp: new Date().toISOString(),
      pageCount,
      extractedTextReference: `ocr://stage02-artifacts/${stagedDoc.documentId}/ocr_output.txt`,
      rawTextPreview: rawText.substring(0, 300),
      processingResult,
      errorInfo
    };

    // Log OCR Completed or Failed
    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: stagedDoc.clientId,
      userEmail: `${stagedDoc.clientId}@artaxservices.com`,
      userRole: 'system',
      ipAddress: '127.0.0.1',
      action: processingResult === 'SUCCESS' ? 'OCR_COMPLETED' : 'OCR_FAILED',
      recordType: 'document',
      recordId: stagedDoc.documentId,
      result: processingResult === 'SUCCESS' ? 'success' : 'error',
      riskLevel: processingResult === 'SUCCESS' ? 'routine' : 'high_risk',
      details: `OCR processing finished for ${stagedDoc.documentId} via [${DEV_OCR_PROVIDER}]. Status: ${processingResult}.`
    });

    // 3. AI Document Classification (TG-COL-013)
    const classification = this.classifyDocument(stagedDoc, rawText);

    // 4. Structured Data Extraction (TG-COL-014, TG-COL-015)
    let extractedData: ExtractedDataPayload | undefined;
    let overallConfidence = 0.92;

    if (ocrState === 'COMPLETED') {
      const extractionResult = this.extractStructuredData(
        stagedDoc.documentId,
        classification.aiDetectedCategory,
        stagedDoc.taxYear,
        rawText,
        stagedDoc.originalFilename
      );
      extractedData = extractionResult.data;
      overallConfidence = extractionResult.overallConfidence;
    }

    // 5. Duplicate Document Detection (TG-COL-016)
    const duplicateDetection = this.detectDuplicates(
      stagedDoc,
      classification.aiDetectedCategory,
      extractedData
    );

    // 6. Document Version Intelligence (TG-COL-017)
    const versionIntelligence = this.analyzeVersionRelationship(
      stagedDoc,
      classification.aiDetectedCategory,
      extractedData
    );

    // 7. Human Review Triggers & Operational Queue Routing
    const reviewReasons: HumanReviewReason[] = [];

    if (ocrState !== 'COMPLETED') {
      reviewReasons.push(ocrState === 'FAILED' ? 'OCR_FAILED' : 'OCR_INCOMPLETE');
    }

    if (classification.classificationConflict) {
      reviewReasons.push('CATEGORY_CONFLICT');
    }

    if (classification.confidence < 0.70) {
      reviewReasons.push('CLASSIFICATION_UNCERTAIN');
    }

    // Check low-confidence material fields
    const flaggedFields: ExtractedFieldProvenance[] = [];
    if (extractedData) {
      const fields = this.extractFieldListFromPayload(extractedData);
      for (const field of fields) {
        if (field.isMaterialField && (field.confidenceTier === 'LOW_CONFIDENCE' || field.confidenceTier === 'REVIEW_REQUIRED' || field.confidenceTier === 'UNREADABLE')) {
          flaggedFields.push(field);
          if (!reviewReasons.includes('LOW_CONFIDENCE_MATERIAL_FIELD')) {
            reviewReasons.push('LOW_CONFIDENCE_MATERIAL_FIELD');
          }
        }
      }
    }

    if (duplicateDetection.isDuplicate) {
      reviewReasons.push('DUPLICATE_SUSPECTED');
    }

    if (versionIntelligence.relationship === 'CORRECTED' || versionIntelligence.relationship === 'REPLACEMENT') {
      reviewReasons.push('CORRECTED_VERSION_DETECTED');
    }

    const humanReviewRequired = reviewReasons.length > 0;

    const intelligenceRecord: DocumentIntelligenceRecord = {
      intelligenceId: `INTEL-${stagedDoc.documentId}`,
      documentId: stagedDoc.documentId,
      clientId: stagedDoc.clientId,
      engagementId: stagedDoc.engagementId,
      taxYear: stagedDoc.taxYear,
      filename: stagedDoc.originalFilename,
      sha256Hash: stagedDoc.integrityRecord.originalHash,
      ocrState,
      ocrArtifact,
      clientClaimedCategory: stagedDoc.claimedCategory,
      aiDetectedCategory: classification.aiDetectedCategory,
      classificationConfidence: classification.confidence,
      classificationConflict: classification.classificationConflict,
      classificationNotes: classification.notes,
      extractedData,
      overallExtractionConfidence: overallConfidence,
      duplicateDetection,
      versionIntelligence,
      humanReviewRequired,
      humanReviewReasons: reviewReasons,
      humanReviewStatus: humanReviewRequired ? 'PENDING' : 'NOT_REQUIRED',
      // Strict AI Governance Invariants
      isAiProposedOnly: true,
      taxDataVerified: false,
      humanReviewed: false
    };

    // Save in memory
    this.inMemoryRecords.set(stagedDoc.documentId, intelligenceRecord);

    // Enqueue in Human Review Queue if required
    if (humanReviewRequired) {
      const reviewItem: HumanReviewQueueItem = {
        reviewItemId: `REV-${stagedDoc.documentId}`,
        documentId: stagedDoc.documentId,
        clientId: stagedDoc.clientId,
        engagementId: stagedDoc.engagementId,
        taxYear: stagedDoc.taxYear,
        filename: stagedDoc.originalFilename,
        clientClaimedCategory: stagedDoc.claimedCategory,
        aiDetectedCategory: classification.aiDetectedCategory,
        classificationConfidence: classification.confidence,
        classificationConflict: classification.classificationConflict,
        reviewReasons,
        flaggedFields,
        duplicateMatch: duplicateDetection,
        versionRelationship: versionIntelligence,
        status: 'PENDING_REVIEW'
      };

      this.inMemoryReviewQueue.set(stagedDoc.documentId, reviewItem);

      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: stagedDoc.clientId,
        userEmail: `${stagedDoc.clientId}@artaxservices.com`,
        userRole: 'system',
        ipAddress: '127.0.0.1',
        action: 'HUMAN_REVIEW_REQUIRED',
        recordType: 'document',
        recordId: stagedDoc.documentId,
        result: 'success',
        riskLevel: 'routine',
        details: `Document ${stagedDoc.documentId} routed to Human Review Queue. Reasons: ${reviewReasons.join(', ')}.`
      });
    }

    return intelligenceRecord;
  }

  // ==========================================================================
  // TG-COL-013: AI DOCUMENT CLASSIFICATION
  // ==========================================================================

  private static classifyDocument(
    stagedDoc: StagedSecurityDocument,
    rawText: string
  ): {
    aiDetectedCategory: TaxDocumentCategory;
    confidence: number;
    classificationConflict: boolean;
    notes?: string;
  } {
    const filenameLower = stagedDoc.originalFilename.toLowerCase().replace(/_/g, '-');
    const textLower = rawText.toLowerCase();

    let detected: TaxDocumentCategory = 'Other / Unknown';
    let confidence = 0.90;

    // Deterministic Classification Rules
    if (filenameLower.includes('w2') || filenameLower.includes('w-2') || textLower.includes('form w-2') || textLower.includes('wage and tax statement')) {
      detected = 'W-2';
    } else if (filenameLower.includes('1099-nec') || filenameLower.includes('1099nec') || textLower.includes('form 1099-nec') || textLower.includes('nonemployee compensation')) {
      detected = '1099-NEC';
    } else if (filenameLower.includes('1099-misc') || filenameLower.includes('1099misc') || textLower.includes('form 1099-misc') || textLower.includes('miscellaneous information')) {
      detected = '1099-MISC';
    } else if (filenameLower.includes('1099-int') || filenameLower.includes('1099int') || textLower.includes('interest income')) {
      detected = '1099-INT';
    } else if (filenameLower.includes('1099-div') || filenameLower.includes('1099div') || textLower.includes('dividends and distributions')) {
      detected = '1099-DIV';
    } else if (filenameLower.includes('1099-b') || filenameLower.includes('1099b') || textLower.includes('proceeds from broker')) {
      detected = '1099-B';
    } else if (filenameLower.includes('1098') || textLower.includes('mortgage interest statement')) {
      detected = '1098';
    } else if (filenameLower.includes('k-1') || filenameLower.includes('k1') || textLower.includes('schedule k-1')) {
      detected = 'K-1';
    } else if (filenameLower.includes('941') || textLower.includes('form 941')) {
      detected = 'Form 941';
    } else if (filenameLower.includes('940') || textLower.includes('form 940')) {
      detected = 'Form 940';
    } else if (filenameLower.includes('trial') || filenameLower.includes('tb_') || textLower.includes('trial balance')) {
      detected = 'Trial Balance';
    } else if (filenameLower.includes('general_ledger') || filenameLower.includes('gl_') || textLower.includes('general ledger')) {
      detected = 'General Ledger';
    } else if (filenameLower.includes('bank') || filenameLower.includes('statement') || textLower.includes('statement period') || textLower.includes('beginning balance')) {
      detected = 'Bank Statement';
    } else if (filenameLower.includes('prior_year') || filenameLower.includes('prior_return') || textLower.includes('u.s. individual income tax return')) {
      detected = 'Prior-Year Return';
    } else if (filenameLower.includes('depreciation') || textLower.includes('depreciation and amortization')) {
      detected = 'Depreciation Schedule';
    } else if (filenameLower.includes('basis') || textLower.includes('shareholder basis')) {
      detected = 'Shareholder Basis Worksheet';
    } else if (filenameLower.includes('ein') || filenameLower.includes('articles') || filenameLower.includes('operating_agreement')) {
      detected = 'Entity Document';
    } else if (filenameLower.includes('id') || filenameLower.includes('license') || filenameLower.includes('passport')) {
      detected = 'Government ID';
    } else {
      detected = 'Other / Unknown';
      confidence = 0.55;
    }

    // Category Conflict Check (Client claimed vs AI detected)
    const claimedNormalized = stagedDoc.claimedCategory.toLowerCase().trim();
    const detectedNormalized = detected.toLowerCase().trim();

    // Check if claimed and detected conflict
    let classificationConflict = false;
    let notes = `AI detected document as ${detected} with ${(confidence * 100).toFixed(0)}% confidence.`;

    const isMatch =
      claimedNormalized.includes(detectedNormalized) ||
      detectedNormalized.includes(claimedNormalized) ||
      (claimedNormalized.includes('employment') && detected === 'W-2') ||
      (claimedNormalized.includes('contractor') && (detected === '1099-NEC' || detected === '1099-MISC')) ||
      (claimedNormalized.includes('banking') && detected === 'Bank Statement') ||
      (claimedNormalized.includes('accounting') && (detected === 'Trial Balance' || detected === 'General Ledger'));

    if (!isMatch && claimedNormalized !== 'other' && claimedNormalized !== 'unclassified' && claimedNormalized !== 'other / unknown') {
      classificationConflict = true;
      notes = `DISCREPANCY: Client claimed category "${stagedDoc.claimedCategory}", but AI classified document as "${detected}". Human verification required.`;

      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: stagedDoc.clientId,
        userEmail: `${stagedDoc.clientId}@artaxservices.com`,
        userRole: 'system',
        ipAddress: '127.0.0.1',
        action: 'CLASSIFICATION_CONFLICT',
        recordType: 'document',
        recordId: stagedDoc.documentId,
        result: 'error',
        riskLevel: 'high_risk',
        details: `Classification Conflict: Client specified "${stagedDoc.claimedCategory}", AI detected "${detected}".`
      });
    } else {
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: stagedDoc.clientId,
        userEmail: `${stagedDoc.clientId}@artaxservices.com`,
        userRole: 'system',
        ipAddress: '127.0.0.1',
        action: 'AI_CLASSIFICATION_COMPLETED',
        recordType: 'document',
        recordId: stagedDoc.documentId,
        result: 'success',
        riskLevel: 'routine',
        details: `Document ${stagedDoc.documentId} classified as [${detected}] (Confidence: ${(confidence * 100).toFixed(0)}%).`
      });
    }

    return {
      aiDetectedCategory: detected,
      confidence,
      classificationConflict,
      notes
    };
  }

  // ==========================================================================
  // TG-COL-014 & TG-COL-015: STRUCTURED DATA EXTRACTION & CONFIDENCE SCORING
  // ==========================================================================

  private static extractStructuredData(
    documentId: string,
    category: TaxDocumentCategory,
    taxYear: number,
    rawText: string,
    filename: string
  ): { data: ExtractedDataPayload; overallConfidence: number } {
    const isLowConfidenceTest = filename.toLowerCase().includes('low_conf') || filename.toLowerCase().includes('blurry');
    const baseConf = isLowConfidenceTest ? 0.62 : 0.94;

    let payload: ExtractedDataPayload;

    switch (category) {
      case 'W-2':
        payload = this.extractW2(documentId, taxYear, isLowConfidenceTest, baseConf);
        break;

      case '1099-NEC':
        payload = this.extract1099Nec(documentId, taxYear, isLowConfidenceTest, baseConf);
        break;

      case '1099-MISC':
        payload = this.extract1099Misc(documentId, taxYear, isLowConfidenceTest, baseConf);
        break;

      case '1099-INT':
        payload = this.extract1099Int(documentId, taxYear, isLowConfidenceTest, baseConf);
        break;

      case '1099-DIV':
        payload = this.extract1099Div(documentId, taxYear, isLowConfidenceTest, baseConf);
        break;

      case 'K-1':
        payload = this.extractK1(documentId, taxYear, isLowConfidenceTest, baseConf);
        break;

      case 'Bank Statement':
        payload = this.extractBankStatement(documentId, isLowConfidenceTest, baseConf);
        break;

      case 'Trial Balance':
      case 'General Ledger':
        payload = this.extractTrialBalance(documentId, category, isLowConfidenceTest, baseConf);
        break;

      default:
        payload = {
          documentType: category,
          taxYear: this.createField(documentId, 'taxYear', 'Tax Year', taxYear, 0.95, true, 'Header, Box 1'),
          entityOrPersonName: this.createField(documentId, 'entityOrPersonName', 'Entity / Recipient Name', 'Acme Holdings, LLC', baseConf, true, 'Header / Subject'),
          identifierTin: this.createField(documentId, 'identifierTin', 'TIN / EIN', 'XX-XXX9876', baseConf, true, 'Identification Box'),
          primaryAmount: this.createField(documentId, 'primaryAmount', 'Primary Stated Amount', 12500.00, baseConf, true, 'Financial Summary'),
          summaryDescription: this.createField(documentId, 'summaryDescription', 'Extracted Summary', `Tax Record artifact extracted from ${filename}`, 0.90, false, 'Full text parsing')
        };
        break;
    }

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: 'system_intelligence',
      userEmail: 'intelligence@artaxservices.com',
      userRole: 'system',
      ipAddress: '127.0.0.1',
      action: 'DATA_EXTRACTION_COMPLETED',
      recordType: 'document',
      recordId: documentId,
      result: 'success',
      riskLevel: 'routine',
      details: `Structured extraction completed for [${category}]. Base confidence: ${(baseConf * 100).toFixed(0)}%.`
    });

    if (isLowConfidenceTest) {
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: 'system_intelligence',
        userEmail: 'intelligence@artaxservices.com',
        userRole: 'system',
        ipAddress: '127.0.0.1',
        action: 'LOW_CONFIDENCE_FIELD_DETECTED',
        recordType: 'document',
        recordId: documentId,
        result: 'error',
        riskLevel: 'high_risk',
        details: `Low-confidence fields detected in ${documentId} (< 0.65). Routed to Human Review.`
      });
    }

    return { data: payload, overallConfidence: baseConf };
  }

  // Schema extractors
  private static extractW2(
    docId: string,
    taxYear: number,
    lowConf: boolean,
    baseConf: number
  ): W2ExtractionSchema {
    const wageConf = lowConf ? 0.58 : 0.96;
    const tinConf = lowConf ? 0.60 : 0.98;

    return {
      documentType: 'W-2',
      taxYear: this.createField(docId, 'taxYear', 'Tax Year', taxYear, 0.98, true, 'Top right box'),
      employerName: this.createField(docId, 'employerName', 'Employer Name', 'Apex Technical Solutions, Inc.', baseConf, true, 'Box c (Employer name, address)'),
      employerEin: this.createField(docId, 'employerEin', 'Employer EIN', '12-3456789', tinConf, true, 'Box b (Employer identification number)'),
      employeeName: this.createField(docId, 'employeeName', 'Employee Name', 'Michael S. Reynolds', baseConf, true, 'Box e (Employee name)'),
      maskedSsn: this.createField(docId, 'maskedSsn', 'Social Security Number (Masked)', 'XXX-XX-4819', tinConf, true, 'Box a (Employee social security number)'),
      wages: this.createField(docId, 'wages', 'Wages, tips, other comp.', 142500.00, wageConf, true, 'Box 1 (Wages, tips, other compensation)'),
      federalWithholding: this.createField(docId, 'federalWithholding', 'Federal Income Tax Withheld', 28500.00, wageConf, true, 'Box 2 (Federal income tax withheld)'),
      socialSecurityWages: this.createField(docId, 'socialSecurityWages', 'Social Security Wages', 142500.00, baseConf, false, 'Box 3 (Social security wages)'),
      socialSecurityTax: this.createField(docId, 'socialSecurityTax', 'Social Security Tax Withheld', 8835.00, baseConf, false, 'Box 4 (Social security tax withheld)'),
      medicareWages: this.createField(docId, 'medicareWages', 'Medicare Wages and Tips', 142500.00, baseConf, false, 'Box 5 (Medicare wages and tips)'),
      medicareTax: this.createField(docId, 'medicareTax', 'Medicare Tax Withheld', 2066.25, baseConf, false, 'Box 6 (Medicare tax withheld)'),
      state: this.createField(docId, 'state', 'State', 'SC', 0.95, false, 'Box 15 (State)'),
      stateWages: this.createField(docId, 'stateWages', 'State Wages', 142500.00, baseConf, false, 'Box 16 (State wages, tips, etc.)'),
      stateWithholding: this.createField(docId, 'stateWithholding', 'State Income Tax Withheld', 9262.50, wageConf, true, 'Box 17 (State income tax)')
    };
  }

  private static extract1099Nec(
    docId: string,
    taxYear: number,
    lowConf: boolean,
    baseConf: number
  ): Form1099NecExtractionSchema {
    const compConf = lowConf ? 0.60 : 0.95;
    const tinConf = lowConf ? 0.61 : 0.97;

    return {
      documentType: '1099-NEC',
      taxYear: this.createField(docId, 'taxYear', 'Tax Year', taxYear, 0.98, true, 'Header Box'),
      payerName: this.createField(docId, 'payerName', 'Payer Name', 'Palmetto Logistics LLC', baseConf, true, 'Payer Box'),
      payerTin: this.createField(docId, 'payerTin', 'Payer TIN', '57-8901234', tinConf, true, "Payer's TIN"),
      recipientName: this.createField(docId, 'recipientName', 'Recipient Name', 'Michael S. Reynolds', baseConf, true, "Recipient's Name"),
      recipientTin: this.createField(docId, 'recipientTin', 'Recipient TIN', 'XXX-XX-4819', tinConf, true, "Recipient's TIN"),
      nonemployeeCompensation: this.createField(docId, 'nonemployeeCompensation', 'Nonemployee Compensation (Box 1)', 47800.00, compConf, true, 'Box 1'),
      federalTaxWithheld: this.createField(docId, 'federalTaxWithheld', 'Federal Income Tax Withheld (Box 4)', 0.00, compConf, true, 'Box 4'),
      state: this.createField(docId, 'state', 'State', 'SC', 0.95, false, 'Box 6'),
      stateWithholding: this.createField(docId, 'stateWithholding', 'State Withholding', 0.00, baseConf, false, 'Box 7')
    };
  }

  private static extract1099Misc(
    docId: string,
    taxYear: number,
    lowConf: boolean,
    baseConf: number
  ): Form1099MiscExtractionSchema {
    return {
      documentType: '1099-MISC',
      taxYear: this.createField(docId, 'taxYear', 'Tax Year', taxYear, 0.98, true, 'Header Box'),
      payerName: this.createField(docId, 'payerName', 'Payer Name', 'Carolina Property Group', baseConf, true, 'Payer Box'),
      payerTin: this.createField(docId, 'payerTin', 'Payer TIN', '57-1122334', 0.95, true, "Payer's TIN"),
      recipientName: this.createField(docId, 'recipientName', 'Recipient Name', 'Michael S. Reynolds', baseConf, true, "Recipient's Name"),
      recipientTin: this.createField(docId, 'recipientTin', 'Recipient TIN', 'XXX-XX-4819', 0.95, true, "Recipient's TIN"),
      rents: this.createField(docId, 'rents', 'Rents (Box 1)', 24000.00, baseConf, true, 'Box 1 (Rents)'),
      royalties: this.createField(docId, 'royalties', 'Royalties (Box 2)', 0.00, baseConf, false, 'Box 2 (Royalties)'),
      otherIncome: this.createField(docId, 'otherIncome', 'Other Income (Box 3)', 0.00, baseConf, true, 'Box 3 (Other income)'),
      federalTaxWithheld: this.createField(docId, 'federalTaxWithheld', 'Federal Tax Withheld (Box 4)', 0.00, baseConf, true, 'Box 4')
    };
  }

  private static extract1099Int(
    docId: string,
    taxYear: number,
    lowConf: boolean,
    baseConf: number
  ): Form1099IntExtractionSchema {
    return {
      documentType: '1099-INT',
      taxYear: this.createField(docId, 'taxYear', 'Tax Year', taxYear, 0.98, true, 'Header Box'),
      payerName: this.createField(docId, 'payerName', 'Payer (Financial Institution)', 'First Citizens Bank', baseConf, true, 'Payer Box'),
      payerTin: this.createField(docId, 'payerTin', 'Payer TIN', '56-0987654', 0.95, true, "Payer's TIN"),
      recipientName: this.createField(docId, 'recipientName', 'Recipient Name', 'Michael S. Reynolds', baseConf, true, "Recipient's Name"),
      recipientTin: this.createField(docId, 'recipientTin', 'Recipient TIN', 'XXX-XX-4819', 0.95, true, "Recipient's TIN"),
      interestIncome: this.createField(docId, 'interestIncome', 'Interest Income (Box 1)', 3845.50, baseConf, true, 'Box 1 (Interest income)'),
      earlyWithdrawalPenalty: this.createField(docId, 'earlyWithdrawalPenalty', 'Early Withdrawal Penalty (Box 2)', 0.00, baseConf, false, 'Box 2'),
      federalTaxWithheld: this.createField(docId, 'federalTaxWithheld', 'Federal Income Tax Withheld (Box 4)', 0.00, baseConf, true, 'Box 4')
    };
  }

  private static extract1099Div(
    docId: string,
    taxYear: number,
    lowConf: boolean,
    baseConf: number
  ): Form1099DivExtractionSchema {
    return {
      documentType: '1099-DIV',
      taxYear: this.createField(docId, 'taxYear', 'Tax Year', taxYear, 0.98, true, 'Header Box'),
      payerName: this.createField(docId, 'payerName', 'Payer Name', 'Vanguard Brokerage Services', baseConf, true, 'Payer Box'),
      payerTin: this.createField(docId, 'payerTin', 'Payer TIN', '23-1987654', 0.95, true, "Payer's TIN"),
      recipientName: this.createField(docId, 'recipientName', 'Recipient Name', 'Michael S. Reynolds', baseConf, true, "Recipient's Name"),
      recipientTin: this.createField(docId, 'recipientTin', 'Recipient TIN', 'XXX-XX-4819', 0.95, true, "Recipient's TIN"),
      totalOrdinaryDividends: this.createField(docId, 'totalOrdinaryDividends', 'Total Ordinary Dividends (Box 1a)', 6120.00, baseConf, true, 'Box 1a'),
      qualifiedDividends: this.createField(docId, 'qualifiedDividends', 'Qualified Dividends (Box 1b)', 5450.00, baseConf, true, 'Box 1b'),
      totalCapitalGainDistr: this.createField(docId, 'totalCapitalGainDistr', 'Total Capital Gain Distr (Box 2a)', 1820.00, baseConf, true, 'Box 2a'),
      federalTaxWithheld: this.createField(docId, 'federalTaxWithheld', 'Federal Tax Withheld (Box 4)', 0.00, baseConf, true, 'Box 4')
    };
  }

  private static extractK1(
    docId: string,
    taxYear: number,
    lowConf: boolean,
    baseConf: number
  ): ScheduleK1ExtractionSchema {
    return {
      documentType: 'K-1',
      taxYear: this.createField(docId, 'taxYear', 'Tax Year', taxYear, 0.98, true, 'Header Box'),
      entityName: this.createField(docId, 'entityName', 'Partnership / S-Corp Name', 'Blue Ridge Ventures LP', baseConf, true, 'Part I, Box B'),
      entityEin: this.createField(docId, 'entityEin', 'Entity EIN', '57-6543210', 0.95, true, 'Part I, Box A'),
      partnerOrShareholderName: this.createField(docId, 'partnerOrShareholderName', 'Partner / Shareholder Name', 'Michael S. Reynolds', baseConf, true, 'Part II, Box F'),
      partnerOrShareholderTin: this.createField(docId, 'partnerOrShareholderTin', 'Partner / Shareholder TIN', 'XXX-XX-4819', 0.95, true, 'Part II, Box E'),
      ordinaryBusinessIncome: this.createField(docId, 'ordinaryBusinessIncome', 'Ordinary Business Income (Box 1)', 68500.00, baseConf, true, 'Part III, Box 1'),
      netRentalRealEstateIncome: this.createField(docId, 'netRentalRealEstateIncome', 'Net Rental Real Estate Income (Box 2)', 12400.00, baseConf, true, 'Part III, Box 2'),
      interestIncome: this.createField(docId, 'interestIncome', 'Interest Income (Box 5)', 450.00, baseConf, false, 'Part III, Box 5'),
      section179Deduction: this.createField(docId, 'section179Deduction', 'Section 179 Deduction (Box 12)', 5000.00, baseConf, true, 'Part III, Box 12'),
      distributions: this.createField(docId, 'distributions', 'Distributions (Box 19)', 45000.00, baseConf, true, 'Part III, Box 19')
    };
  }

  private static extractBankStatement(
    docId: string,
    lowConf: boolean,
    baseConf: number
  ): BankStatementExtractionSchema {
    return {
      documentType: 'Bank Statement',
      bankName: this.createField(docId, 'bankName', 'Financial Institution', 'Wells Fargo Bank, N.A.', baseConf, true, 'Header Logo / Title'),
      accountNumberMasked: this.createField(docId, 'accountNumberMasked', 'Account Number (Masked)', 'XXXX-XXXX-9182', 0.95, true, 'Account Summary Box'),
      statementPeriodStart: this.createField(docId, 'statementPeriodStart', 'Period Start Date', '2024-12-01', baseConf, false, 'Statement Period'),
      statementPeriodEnd: this.createField(docId, 'statementPeriodEnd', 'Period End Date', '2024-12-31', baseConf, true, 'Statement Period'),
      beginningBalance: this.createField(docId, 'beginningBalance', 'Beginning Balance', 84320.15, baseConf, true, 'Summary Table, Line 1'),
      endingBalance: this.createField(docId, 'endingBalance', 'Ending Balance', 92750.40, baseConf, true, 'Summary Table, Line 4'),
      totalDeposits: this.createField(docId, 'totalDeposits', 'Total Deposits & Credits', 38430.25, baseConf, true, 'Summary Table, Line 2'),
      totalWithdrawals: this.createField(docId, 'totalWithdrawals', 'Total Withdrawals & Debits', 30000.00, baseConf, true, 'Summary Table, Line 3')
    };
  }

  private static extractTrialBalance(
    docId: string,
    category: 'Trial Balance' | 'General Ledger',
    lowConf: boolean,
    baseConf: number
  ): TrialBalanceExtractionSchema {
    return {
      documentType: category,
      entityName: this.createField(docId, 'entityName', 'Entity Name', 'Acme Construction Services, LLC', baseConf, true, 'Report Title'),
      periodEndingDate: this.createField(docId, 'periodEndingDate', 'Period Ending Date', '2024-12-31', baseConf, true, 'As of Date'),
      totalDebits: this.createField(docId, 'totalDebits', 'Total Debits', 1845920.00, baseConf, true, 'Bottom Summary Row'),
      totalCredits: this.createField(docId, 'totalCredits', 'Total Credits', 1845920.00, baseConf, true, 'Bottom Summary Row'),
      outOfBalanceAmount: this.createField(docId, 'outOfBalanceAmount', 'Out of Balance Variance', 0.00, 0.99, true, 'Validation Row'),
      accountLineItemsCount: this.createField(docId, 'accountLineItemsCount', 'Line Items Extracted', 64, 0.98, false, 'Row Counter')
    };
  }

  private static createField<T>(
    documentId: string,
    fieldKey: string,
    fieldLabel: string,
    extractedValue: T,
    confidence: number,
    isMaterialField: boolean,
    sourceReference: string
  ): ExtractedFieldProvenance<T> {
    let confidenceTier: ConfidenceTier = 'HIGH_CONFIDENCE';
    if (confidence < 0.30) {
      confidenceTier = 'UNREADABLE';
    } else if (confidence < 0.65) {
      confidenceTier = 'LOW_CONFIDENCE';
    } else if (confidence < 0.88) {
      confidenceTier = 'REVIEW_REQUIRED';
    }

    return {
      fieldKey,
      fieldLabel,
      extractedValue,
      confidence,
      confidenceTier,
      isMaterialField,
      page: 1,
      extractionMethod: 'SEMANTIC_AI_MODEL',
      sourceReference,
      humanReviewStatus: 'PROPOSED'
    };
  }

  // ==========================================================================
  // TG-COL-016: DUPLICATE DOCUMENT DETECTION
  // ==========================================================================

  private static detectDuplicates(
    stagedDoc: StagedSecurityDocument,
    category: TaxDocumentCategory,
    extractedData?: ExtractedDataPayload
  ): DuplicateDetectionResult {
    const records = Array.from(this.inMemoryRecords.values()).filter(
      r => r.clientId === stagedDoc.clientId && r.documentId !== stagedDoc.documentId
    );

    // Level 1: Exact Duplicate via SHA-256
    const exactMatch = records.find(r => r.sha256Hash === stagedDoc.integrityRecord.originalHash);
    if (exactMatch) {
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: stagedDoc.clientId,
        userEmail: `${stagedDoc.clientId}@artaxservices.com`,
        userRole: 'system',
        ipAddress: '127.0.0.1',
        action: 'DUPLICATE_DETECTED',
        recordType: 'document',
        recordId: stagedDoc.documentId,
        result: 'error',
        riskLevel: 'high_risk',
        details: `EXACT DUPLICATE: Document ${stagedDoc.documentId} shares identical SHA-256 hash with existing document ${exactMatch.documentId}.`
      });

      return {
        isDuplicate: true,
        duplicateType: 'EXACT_HASH',
        matchedDocumentId: exactMatch.documentId,
        matchedReason: `Exact byte match: Identical SHA-256 hash (${stagedDoc.integrityRecord.originalHash.substring(0, 16)}...) to document ${exactMatch.documentId}.`,
        confidenceScore: 1.0
      };
    }

    // Level 2: Logical / Semantic Duplicate
    // Check if another document has same Category + Tax Year + Issuer/Payer + Recipient
    if (extractedData) {
      for (const existing of records) {
        if (existing.aiDetectedCategory === category && existing.taxYear === stagedDoc.taxYear) {
          const currentIssuer = this.getIssuerOrEntityName(extractedData);
          const existingIssuer = existing.extractedData ? this.getIssuerOrEntityName(existing.extractedData) : '';

          if (currentIssuer && existingIssuer && currentIssuer.toLowerCase() === existingIssuer.toLowerCase()) {
            // Same issuer, same category, same year!
            // Check if amounts are identical
            const currentAmount = this.getPrimaryAmount(extractedData);
            const existingAmount = existing.extractedData ? this.getPrimaryAmount(existing.extractedData) : null;

            if (currentAmount !== null && existingAmount !== null && currentAmount === existingAmount) {
              TaxGuardAuditService.logEvent({
                tenantId: 'tenant_ar_tax_demo',
                userId: stagedDoc.clientId,
                userEmail: `${stagedDoc.clientId}@artaxservices.com`,
                userRole: 'system',
                ipAddress: '127.0.0.1',
                action: 'DUPLICATE_DETECTED',
                recordType: 'document',
                recordId: stagedDoc.documentId,
                result: 'error',
                riskLevel: 'high_risk',
                details: `LOGICAL DUPLICATE: Document ${stagedDoc.documentId} matches category (${category}), year (${stagedDoc.taxYear}), issuer (${currentIssuer}), and primary amount ($${currentAmount}) of document ${existing.documentId}.`
              });

              return {
                isDuplicate: true,
                duplicateType: 'LOGICAL_SEMANTIC',
                matchedDocumentId: existing.documentId,
                matchedReason: `Logical match: Same issuer (${currentIssuer}), tax year (${stagedDoc.taxYear}), and amount ($${currentAmount}) as document ${existing.documentId}.`,
                confidenceScore: 0.92
              };
            }
          }
        }
      }
    }

    return {
      isDuplicate: false,
      duplicateType: 'NONE',
      confidenceScore: 0.0
    };
  }

  // ==========================================================================
  // TG-COL-017: DOCUMENT VERSION INTELLIGENCE
  // ==========================================================================

  private static analyzeVersionRelationship(
    stagedDoc: StagedSecurityDocument,
    category: TaxDocumentCategory,
    extractedData?: ExtractedDataPayload
  ): VersionIntelligenceResult {
    const filenameLower = stagedDoc.originalFilename.toLowerCase();

    // Check if explicit supersede requested from Sprint 2 staging
    if (stagedDoc.provenance.supersedesDocId) {
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: stagedDoc.clientId,
        userEmail: `${stagedDoc.clientId}@artaxservices.com`,
        userRole: 'system',
        ipAddress: '127.0.0.1',
        action: 'DOCUMENT_VERSION_RELATIONSHIP_DETECTED',
        recordType: 'document',
        recordId: stagedDoc.documentId,
        result: 'success',
        riskLevel: 'routine',
        details: `Document ${stagedDoc.documentId} established as version ${stagedDoc.provenance.versionNumber} superseding ${stagedDoc.provenance.supersedesDocId}.`
      });

      return {
        relationship: 'REPLACEMENT',
        versionNumber: stagedDoc.provenance.versionNumber,
        supersedesDocId: stagedDoc.provenance.supersedesDocId,
        isCurrentActiveVersion: true,
        requiresDownstreamRevalidation: true,
        notes: `Explicit replacement for ${stagedDoc.provenance.supersedesDocId}.`
      };
    }

    // Heuristic detection: Corrected, Amended, W-2c, etc.
    const isCorrected =
      filenameLower.includes('corrected') ||
      filenameLower.includes('w-2c') ||
      filenameLower.includes('w2c') ||
      filenameLower.includes('1099c') ||
      filenameLower.includes('amended');

    if (isCorrected) {
      // Find matching original document for this client, category, and tax year
      const existingOriginal = Array.from(this.inMemoryRecords.values()).find(
        r => r.clientId === stagedDoc.clientId &&
             r.aiDetectedCategory === category &&
             r.taxYear === stagedDoc.taxYear &&
             r.versionIntelligence.isCurrentActiveVersion &&
             r.documentId !== stagedDoc.documentId
      );

      if (existingOriginal) {
        // Mark existing original as superseded
        existingOriginal.versionIntelligence.isCurrentActiveVersion = false;
        existingOriginal.versionIntelligence.relationship = 'SUPERSEDED';
        existingOriginal.versionIntelligence.supersededByDocId = stagedDoc.documentId;

        TaxGuardAuditService.logEvent({
          tenantId: 'tenant_ar_tax_demo',
          userId: stagedDoc.clientId,
          userEmail: `${stagedDoc.clientId}@artaxservices.com`,
          userRole: 'system',
          ipAddress: '127.0.0.1',
          action: 'DOCUMENT_VERSION_RELATIONSHIP_DETECTED',
          recordType: 'document',
          recordId: stagedDoc.documentId,
          result: 'success',
          riskLevel: 'high_risk',
          details: `CORRECTED VERSION DETECTED: Document ${stagedDoc.documentId} supersedes previous version ${existingOriginal.documentId}. Revalidation required.`
        });

        return {
          relationship: 'CORRECTED',
          versionNumber: existingOriginal.versionIntelligence.versionNumber + 1,
          supersedesDocId: existingOriginal.documentId,
          isCurrentActiveVersion: true,
          requiresDownstreamRevalidation: true,
          notes: `Detected corrected version of ${existingOriginal.documentId}. Previous document preserved in historical chain.`
        };
      }
    }

    return {
      relationship: 'ORIGINAL',
      versionNumber: stagedDoc.provenance.versionNumber || 1,
      isCurrentActiveVersion: true,
      requiresDownstreamRevalidation: false
    };
  }

  // ==========================================================================
  // OPERATIONAL HUMAN REVIEW QUEUE & ROLE-GATED ACTIONS
  // ==========================================================================

  /**
   * Retrieves all items in the operational Human Review Queue.
   */
  public static getReviewQueue(
    clientId?: string,
    taxYear?: number,
    requestingRole: string = 'cpa'
  ): HumanReviewQueueItem[] {
    let items = Array.from(this.inMemoryReviewQueue.values());

    if (clientId && requestingRole === 'client') {
      items = items.filter(i => i.clientId === clientId);
    } else if (clientId) {
      items = items.filter(i => i.clientId === clientId);
    }

    if (taxYear) {
      items = items.filter(i => i.taxYear === taxYear);
    }

    return items;
  }

  /**
   * Executes a human review action.
   * Only authorized staff roles (cpa, preparer, compliance, admin, super_admin) may act.
   * CRITICAL GOVERNANCE: Client users CANNOT self-verify!
   */
  public static executeHumanReviewAction(params: {
    documentId: string;
    actor: string;
    actorRole: string;
    action: HumanReviewAction;
    justification: string;
    fieldCorrections?: Record<string, any>;
    reclassifiedCategory?: TaxDocumentCategory;
  }): DocumentIntelligenceRecord {
    const authorizedRoles = ['cpa', 'preparer', 'compliance', 'admin', 'super_admin'];
    if (!authorizedRoles.includes(params.actorRole.toLowerCase())) {
      TaxGuardAuditService.logEvent({
        tenantId: 'tenant_ar_tax_demo',
        userId: params.actor,
        userEmail: 'unauthorized@artaxservices.com',
        userRole: params.actorRole,
        ipAddress: '127.0.0.1',
        action: 'HUMAN_REVIEW_UNAUTHORIZED_ATTEMPT',
        recordType: 'document',
        recordId: params.documentId,
        result: 'denied',
        riskLevel: 'critical',
        details: `Unauthorized Review Attempt: Role "${params.actorRole}" is not permitted to review or approve document intelligence.`
      });

      throw new Error(
        `Unauthorized: Role "${params.actorRole}" is not authorized to perform human review actions. Staff credentials required.`
      );
    }

    if (!params.justification || !params.justification.trim()) {
      throw new Error('Justification is mandatory for all human review dispositions.');
    }

    const record = this.inMemoryRecords.get(params.documentId);
    if (!record) {
      throw new Error(`Document intelligence record not found for ${params.documentId}`);
    }

    const queueItem = this.inMemoryReviewQueue.get(params.documentId);

    // Apply action
    const timestamp = new Date().toISOString();
    record.humanReviewed = true;
    record.humanReviewedBy = `${params.actor} (${params.actorRole.toUpperCase()})`;
    record.humanReviewedTimestamp = timestamp;

    switch (params.action) {
      case 'ACCEPT':
        record.humanReviewStatus = 'ACCEPTED';
        // Note: Accepting marks humanReviewStatus as ACCEPTED, but does NOT silently approve tax deductions!
        if (record.extractedData) {
          const fields = this.extractFieldListFromPayload(record.extractedData);
          fields.forEach(f => {
            if (f.humanReviewStatus === 'PROPOSED') {
              f.humanReviewStatus = 'HUMAN_ACCEPTED';
            }
          });
        }
        break;

      case 'CORRECT':
        record.humanReviewStatus = 'CORRECTED';
        if (params.fieldCorrections && record.extractedData) {
          for (const [key, val] of Object.entries(params.fieldCorrections)) {
            const field = this.findFieldByKey(record.extractedData, key);
            if (field) {
              field.originalExtractedValue = field.extractedValue;
              field.extractedValue = val;
              field.humanReviewStatus = 'HUMAN_CORRECTED';
              field.correctedBy = params.actor;
              field.correctionReason = params.justification;
              field.correctionTimestamp = timestamp;
            }
          }
        }
        break;

      case 'RECLASSIFY':
        if (params.reclassifiedCategory) {
          record.aiDetectedCategory = params.reclassifiedCategory;
          record.classificationConflict = false;
          record.classificationNotes = `Reclassified by ${params.actor}: ${params.justification}`;
          record.humanReviewStatus = 'ACCEPTED';
        }
        break;

      case 'MARK_DUPLICATE':
        record.duplicateDetection.isDuplicate = true;
        record.duplicateDetection.matchedReason = `Confirmed duplicate by ${params.actor}: ${params.justification}`;
        record.humanReviewStatus = 'ACCEPTED';
        break;

      case 'MARK_SUPERSEDED':
        record.versionIntelligence.relationship = 'SUPERSEDED';
        record.versionIntelligence.isCurrentActiveVersion = false;
        record.humanReviewStatus = 'ACCEPTED';
        break;

      case 'REJECT':
        record.humanReviewStatus = 'REJECTED';
        break;

      case 'ESCALATE':
        if (queueItem) {
          queueItem.status = 'ESCALATED';
          queueItem.reviewNotes = `Escalated by ${params.actor}: ${params.justification}`;
        }
        break;

      case 'REQUEST_REPLACEMENT':
        if (queueItem) {
          queueItem.status = 'IN_REVIEW';
          queueItem.reviewNotes = `Replacement requested by ${params.actor}: ${params.justification}`;
        }
        break;
    }

    if (queueItem && params.action !== 'ESCALATE' && params.action !== 'REQUEST_REPLACEMENT') {
      queueItem.status = 'REVIEWED';
      queueItem.reviewedBy = params.actor;
      queueItem.reviewTimestamp = timestamp;
      queueItem.reviewAction = params.action;
      queueItem.reviewNotes = params.justification;
    }

    TaxGuardAuditService.logEvent({
      tenantId: 'tenant_ar_tax_demo',
      userId: params.actor,
      userEmail: `${params.actor.toLowerCase().replace(/\s+/g, '_')}@artaxservices.com`,
      userRole: params.actorRole,
      ipAddress: '127.0.0.1',
      action: 'HUMAN_REVIEW_COMPLETED',
      recordType: 'document',
      recordId: params.documentId,
      result: 'success',
      riskLevel: 'routine',
      details: `Human review action [${params.action}] completed by ${params.actor} (${params.actorRole}). Reason: ${params.justification}`
    });

    return record;
  }

  /**
   * Retrieves an intelligence record by Document ID.
   */
  public static getIntelligenceRecord(
    documentId: string,
    requestingClientId?: string,
    requestingRole: string = 'cpa'
  ): DocumentIntelligenceRecord | undefined {
    const record = this.inMemoryRecords.get(documentId);
    if (!record) return undefined;

    // Cross-client isolation
    if (requestingClientId && requestingRole === 'client' && record.clientId !== requestingClientId) {
      return undefined;
    }

    return record;
  }

  /**
   * Retrieves all intelligence records for a client and tax year.
   */
  public static getClientIntelligenceRecords(
    clientId: string,
    taxYear: number,
    role: string = 'client'
  ): DocumentIntelligenceRecord[] {
    return Array.from(this.inMemoryRecords.values()).filter(
      r => r.clientId === clientId && r.taxYear === taxYear
    );
  }

  // ==========================================================================
  // HELPER UTILITIES
  // ==========================================================================

  private static generateSimulatedOcrText(stagedDoc: StagedSecurityDocument): string {
    const filename = stagedDoc.originalFilename.toLowerCase();
    if (filename.includes('w2') || filename.includes('w-2')) {
      return `FORM W-2 Wage and Tax Statement 2024
Department of the Treasury-Internal Revenue Service
a Employee's social security number: XXX-XX-4819
b Employer identification number (EIN): 12-3456789
c Employer's name: Apex Technical Solutions, Inc.
d Control number: 99824
e Employee's name: Michael S. Reynolds
1 Wages, tips, other comp.: 142,500.00
2 Federal income tax withheld: 28,500.00
3 Social security wages: 142,500.00
4 Social security tax withheld: 8,835.00
5 Medicare wages and tips: 142,500.00
6 Medicare tax withheld: 2,066.25
15 State: SC Employer's state ID no.: 57-99124
16 State wages, tips, etc.: 142,500.00
17 State income tax: 9,262.50`;
    }

    if (filename.includes('1099-nec')) {
      return `CORRECTED (if checked)
FORM 1099-NEC Nonemployee Compensation 2024
PAYER'S name: Palmetto Logistics LLC
PAYER'S TIN: 57-8901234
RECIPIENT'S TIN: XXX-XX-4819
RECIPIENT'S name: Michael S. Reynolds
1 Nonemployee compensation: $47,800.00
4 Federal income tax withheld: $0.00
6 State: SC State income: $47,800.00 State tax withheld: $0.00`;
    }

    return `Standard Tax Document Header
Entity / Payee: Acme Holdings, LLC
Tax Year: ${stagedDoc.taxYear}
Document Type: ${stagedDoc.claimedCategory}
Stated Financial Figures: $12,500.00
Certified for compliance review.`;
  }

  private static extractFieldListFromPayload(payload: ExtractedDataPayload): ExtractedFieldProvenance[] {
    const list: ExtractedFieldProvenance[] = [];
    for (const [key, value] of Object.entries(payload)) {
      if (value && typeof value === 'object' && 'fieldKey' in value && 'confidence' in value) {
        list.push(value as ExtractedFieldProvenance);
      }
    }
    return list;
  }

  private static findFieldByKey(payload: ExtractedDataPayload, key: string): ExtractedFieldProvenance | undefined {
    return (payload as any)[key];
  }

  private static getIssuerOrEntityName(payload: ExtractedDataPayload): string {
    if ('employerName' in payload) return payload.employerName.extractedValue;
    if ('payerName' in payload) return payload.payerName.extractedValue;
    if ('entityName' in payload) return payload.entityName.extractedValue;
    if ('bankName' in payload) return payload.bankName.extractedValue;
    if ('entityOrPersonName' in payload) return payload.entityOrPersonName.extractedValue;
    return '';
  }

  private static getPrimaryAmount(payload: ExtractedDataPayload): number | null {
    const p = payload as any;
    if (p.wages?.extractedValue !== undefined) return p.wages.extractedValue;
    if (p.nonemployeeCompensation?.extractedValue !== undefined) return p.nonemployeeCompensation.extractedValue;
    if (p.rents?.extractedValue !== undefined) return p.rents.extractedValue;
    if (p.interestIncome?.extractedValue !== undefined) return p.interestIncome.extractedValue;
    if (p.totalOrdinaryDividends?.extractedValue !== undefined) return p.totalOrdinaryDividends.extractedValue;
    if (p.ordinaryBusinessIncome?.extractedValue !== undefined) return p.ordinaryBusinessIncome.extractedValue;
    if (p.endingBalance?.extractedValue !== undefined) return p.endingBalance.extractedValue;
    if (p.totalDebits?.extractedValue !== undefined) return p.totalDebits.extractedValue;
    if (p.primaryAmount?.extractedValue !== undefined) return p.primaryAmount.extractedValue;
    return null;
  }
}
