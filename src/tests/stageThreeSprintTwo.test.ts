/**
 * Stage 03 Sprint 2 Test Suite
 * TG-VAL-009 through TG-VAL-016
 * Document Intelligence, Cross-Document Validation, Conflict Detection & Exception Foundation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StageThreeValidationService,
  ValidationSourceRecord,
  STAGE_THREE_SPRINT_TWO_REGISTRY
} from '../services/stageThreeValidationService';
import { StageTwoCollectionService } from '../services/stageTwoCollectionService';

describe('Stage 03 Sprint 2 — Validation Engines (TG-VAL-009 through TG-VAL-016)', () => {
  const CLIENT_ID = 'CL-TEST-SPRINT2';
  const ENGAGEMENT_ID = 'ENG-TEST-SPRINT2';
  const TAX_YEAR = 2024;

  const seedStageTwoDoc = (doc: any) => {
    const key = `${doc.clientId}_${doc.taxYear}`;
    const existing = (StageTwoCollectionService as any).inMemoryUploads.get(key) || [];
    (StageTwoCollectionService as any).inMemoryUploads.set(key, [...existing, doc]);
  };

  const createMockSource = (overrides: Partial<ValidationSourceRecord>): ValidationSourceRecord => ({
    validationSourceId: 'VAL-SRC-' + Math.random().toString(36).substring(7),
    documentId: 'DOC-2024-001',
    clientId: CLIENT_ID,
    engagementId: ENGAGEMENT_ID,
    taxYear: TAX_YEAR,
    collectionVersion: 1,
    documentVersion: 1,
    documentCategory: 'Form W-2',
    originalFilename: 'W2_Form.pdf',
    sourceHash: 'a'.repeat(64),
    OCRArtifactId: 'OCR-001',
    extractionArtifactId: 'EXT-001',
    pageNumber: 1,
    boundingBox: { x: 10, y: 10, width: 100, height: 20 },
    fieldName: 'box1_wages',
    rawExtractedValue: '$85,000.00',
    normalizedValue: '85000.00',
    sourceTier: 'AUTHORITATIVE',
    AIConfidence: 0.98,
    isAiProposedOnly: true,
    humanReviewStatus: 'UNREVIEWED',
    validationStatus: 'VALIDATED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    correlationId: 'CORR-001',
    ...overrides
  });

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    StageThreeValidationService.clearAll();
    StageTwoCollectionService.resetCollectionForTesting();
  });

  // ==========================================================================
  // REGISTRY & GOVERNANCE INVARIANTS
  // ==========================================================================
  describe('Governance & Feature Registry', () => {
    it('verifies that Sprint 2 feature registry TG-VAL-009 through TG-VAL-016 are correctly registered', () => {
      expect(STAGE_THREE_SPRINT_TWO_REGISTRY['TG-VAL-009']).toBeDefined();
      expect(STAGE_THREE_SPRINT_TWO_REGISTRY['TG-VAL-010']).toBeDefined();
      expect(STAGE_THREE_SPRINT_TWO_REGISTRY['TG-VAL-011']).toBeDefined();
      expect(STAGE_THREE_SPRINT_TWO_REGISTRY['TG-VAL-012']).toBeDefined();
      expect(STAGE_THREE_SPRINT_TWO_REGISTRY['TG-VAL-013']).toBeDefined();
      expect(STAGE_THREE_SPRINT_TWO_REGISTRY['TG-VAL-014']).toBeDefined();
      expect(STAGE_THREE_SPRINT_TWO_REGISTRY['TG-VAL-015']).toBeDefined();
      expect(STAGE_THREE_SPRINT_TWO_REGISTRY['TG-VAL-016']).toBeDefined();
    });

    it('enforces that AI extracted values retain isAiProposedOnly flag and are never auto-converted to verified', () => {
      const source = createMockSource({
        validationSourceId: 'VAL-SRC-TEST-01',
        isAiProposedOnly: true,
        humanReviewStatus: 'UNREVIEWED'
      });

      StageThreeValidationService.registerValidationSource(source);
      const retrieved = StageThreeValidationService.getValidationSources(CLIENT_ID, TAX_YEAR);
      expect(retrieved.length).toBe(1);
      expect(retrieved[0].isAiProposedOnly).toBe(true);
      expect(retrieved[0].humanReviewStatus).toBe('UNREVIEWED');
    });
  });

  // ==========================================================================
  // TG-VAL-009: OCR-TO-SOURCE PROVENANCE VALIDATION ENGINE
  // ==========================================================================
  describe('TG-VAL-009: OCR-to-Source Provenance Validation', () => {
    it('verifies complete end-to-end lineage from Document to Hash to OCR to Field', () => {
      seedStageTwoDoc({
        documentId: 'DOC-2024-101',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client Admin',
        originalFileName: 'Valid_W2.pdf',
        fileSizeBytes: 204800,
        mimeType: 'application/pdf',
        claimedCategory: 'Income Documents',
        sha256Hash: 'b'.repeat(64),
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Accepted',
        isVerified: false,
        securityCheckStatus: 'Passed (SHA-256 Validated)',
        intelligenceRecord: {
          documentId: 'DOC-2024-101',
          classificationConfidence: 0.96,
          ocrArtifact: {
            ocrArtifactId: 'OCR-DOC-101',
            documentId: 'DOC-2024-101',
            pageCount: 1,
            engine: 'Tesseract',
            extractedText: 'W-2 Form text',
            timestamp: new Date().toISOString()
          },
          extractionStatus: 'SUCCESS'
        }
      });

      const source = createMockSource({
        validationSourceId: 'VAL-SRC-101',
        documentId: 'DOC-2024-101',
        originalFilename: 'Valid_W2.pdf',
        documentCategory: 'Form W-2',
        sourceHash: 'b'.repeat(64),
        OCRArtifactId: 'OCR-DOC-101',
        extractionArtifactId: 'EXT-DOC-101',
        pageNumber: 1,
        fieldName: 'box1_wages',
        rawExtractedValue: '$95,000.00',
        normalizedValue: '95000.00',
        AIConfidence: 0.95
      });

      const result = StageThreeValidationService.validateSingleSourceProvenance(source);
      expect(result.lineageStatus).toBe('VERIFIED');
      expect(result.isBlocking).toBe(false);
      expect(result.hasSha256Hash).toBe(true);
      expect(result.sha256HashValid).toBe(true);
      expect(result.hasOcrArtifact).toBe(true);
      expect(result.hasExtractionArtifact).toBe(true);
    });

    it('rejects evidence from quarantined or rejected documents and raises blocking exception', () => {
      seedStageTwoDoc({
        documentId: 'DOC-2024-QUARANTINED',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client Admin',
        originalFileName: 'Malicious_Document.pdf',
        fileSizeBytes: 1024,
        mimeType: 'application/pdf',
        claimedCategory: 'Income Documents',
        sha256Hash: 'c'.repeat(64),
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Rejected',
        isVerified: false,
        securityCheckStatus: 'Quarantined',
        quarantineStatus: 'QUARANTINED'
      });

      const source = createMockSource({
        validationSourceId: 'VAL-SRC-QUARANTINED',
        documentId: 'DOC-2024-QUARANTINED',
        originalFilename: 'Malicious_Document.pdf',
        documentCategory: 'Form W-2',
        sourceHash: 'c'.repeat(64),
        OCRArtifactId: 'OCR-QUAR',
        extractionArtifactId: 'EXT-QUAR',
        rawExtractedValue: '$50,000.00',
        normalizedValue: '50000.00',
        AIConfidence: 0.90,
        validationStatus: 'UNVALIDATED'
      });

      const result = StageThreeValidationService.validateSingleSourceProvenance(source);
      expect(result.lineageStatus).toBe('QUARANTINED_OR_REJECTED');
      expect(result.isBlocking).toBe(true);

      const exceptions = StageThreeValidationService.getExceptions(CLIENT_ID, TAX_YEAR);
      expect(exceptions.some(e => e.category === 'SOURCE_INTEGRITY_FAILURE' && e.isBlocking)).toBe(true);
    });

    it('flags broken lineage when required SHA-256 or OCR artifact is missing', () => {
      const brokenSource = createMockSource({
        validationSourceId: 'VAL-SRC-BROKEN',
        documentId: 'DOC-2024-BROKEN',
        originalFilename: 'Unverified_Scan.pdf',
        documentCategory: 'Form W-2',
        sourceTier: 'UNVERIFIED',
        sourceHash: '', // Missing hash!
        OCRArtifactId: '', // Missing OCR!
        extractionArtifactId: '',
        pageNumber: 0, // Invalid page!
        rawExtractedValue: '$40,000.00',
        normalizedValue: '40000.00',
        AIConfidence: null,
        validationStatus: 'UNVALIDATED'
      });

      const result = StageThreeValidationService.validateSingleSourceProvenance(brokenSource);
      expect(result.lineageStatus).toBe('MISSING_PROVENANCE');
      expect(result.isBlocking).toBe(true);

      const exceptions = StageThreeValidationService.getExceptions(CLIENT_ID, TAX_YEAR);
      expect(exceptions.some(e => e.category === 'SOURCE_PROVENANCE_MISSING' && e.isBlocking)).toBe(true);
    });
  });

  // ==========================================================================
  // TG-VAL-010: EXTRACTED FIELD VALIDATION ENGINE
  // ==========================================================================
  describe('TG-VAL-010: Extracted Field Validation', () => {
    it('validates currency formatting and flags malformed non-numeric values without silent repair', () => {
      const malformedSource = createMockSource({
        validationSourceId: 'VAL-SRC-MALFORMED',
        documentId: 'DOC-2024-102',
        documentCategory: 'Form 1099-NEC',
        fieldName: 'nonemployee_compensation',
        rawExtractedValue: 'UNKNOWN_OR_GARBLED',
        normalizedValue: 'UNKNOWN_OR_GARBLED',
        AIConfidence: 0.40,
        validationStatus: 'UNVALIDATED'
      });

      const result = StageThreeValidationService.validateSingleExtractedField(malformedSource);
      expect(result.expectedDatatype).toBe('currency');
      expect(result.isValidFormat).toBe(false);
      expect(result.conventionCheck).toBe('MALFORMED');
      expect(result.isBlocking).toBe(true);

      // Verify no silent repair occurred
      expect(result.rawExtractedValue).toBe('UNKNOWN_OR_GARBLED');
    });

    it('detects and flags unexpected negative wage values as structural exceptions', () => {
      const negativeWageSource = createMockSource({
        validationSourceId: 'VAL-SRC-NEG',
        documentId: 'DOC-2024-103',
        documentCategory: 'Form W-2',
        fieldName: 'box1_wages',
        rawExtractedValue: '-$12,500.00',
        normalizedValue: '-12500.00',
        AIConfidence: 0.88,
        validationStatus: 'UNVALIDATED'
      });

      const result = StageThreeValidationService.validateSingleExtractedField(negativeWageSource);
      expect(result.conventionCheck).toBe('UNEXPECTED_NEGATIVE');
      expect(result.isBlocking).toBe(true);

      const exceptions = StageThreeValidationService.getExceptions(CLIENT_ID, TAX_YEAR);
      expect(exceptions.some(e => e.category === 'STRUCTURAL_MISMATCH' && e.isBlocking)).toBe(true);
    });

    it('validates 9-digit EIN/SSN identifiers and rejects malformed lengths', () => {
      const malformedEinSource = createMockSource({
        validationSourceId: 'VAL-SRC-EIN',
        documentId: 'DOC-2024-104',
        documentCategory: 'Form 1099-MISC',
        fieldName: 'payer_ein',
        rawExtractedValue: '12-345', // Only 5 digits!
        normalizedValue: '12345',
        AIConfidence: 0.90,
        validationStatus: 'UNVALIDATED'
      });

      const result = StageThreeValidationService.validateSingleExtractedField(malformedEinSource);
      expect(result.isValidFormat).toBe(false);
      expect(result.conventionCheck).toBe('MALFORMED');
      expect(result.isBlocking).toBe(true);
    });
  });

  // ==========================================================================
  // TG-VAL-011: CONFIDENCE THRESHOLD ENGINE
  // ==========================================================================
  describe('TG-VAL-011: Confidence Threshold Engine', () => {
    it('categorizes high confidence fields (>= 0.90) without requiring blocking exceptions', () => {
      const highConfSource = createMockSource({
        validationSourceId: 'VAL-SRC-HIGH-CONF',
        documentId: 'DOC-2024-105',
        fieldName: 'box1_wages',
        rawExtractedValue: '$120,000.00',
        normalizedValue: '120000.00',
        AIConfidence: 0.96
      });

      const evalResult = StageThreeValidationService.evaluateFieldConfidence(highConfSource, true);
      expect(evalResult.confidenceTier).toBe('HIGH_CONFIDENCE');
      expect(evalResult.requiresHumanReview).toBe(false);
      expect(evalResult.isBlocking).toBe(false);
    });

    it('enforces that null confidence is never replaced with fabricated 0.95 fallback and routes to review', () => {
      const unscoredSource = createMockSource({
        validationSourceId: 'VAL-SRC-NULL-CONF',
        documentId: 'DOC-2024-106',
        fieldName: 'box1_wages',
        rawExtractedValue: '$75,000.00',
        normalizedValue: '75000.00',
        AIConfidence: null, // Critical: Unscored!
        validationStatus: 'UNVALIDATED'
      });

      const evalResult = StageThreeValidationService.evaluateFieldConfidence(unscoredSource, true);
      expect(evalResult.confidenceTier).toBe('MISSING_CONFIDENCE');
      expect(evalResult.rawConfidence).toBeNull();
      expect(evalResult.requiresHumanReview).toBe(true);
      expect(evalResult.isBlocking).toBe(true);

      const exceptions = StageThreeValidationService.getExceptions(CLIENT_ID, TAX_YEAR);
      expect(exceptions.some(e => e.category === 'LOW_CONFIDENCE_MATERIAL_FIELD' && e.isBlocking)).toBe(true);

      const queue = StageThreeValidationService.getReviewQueue(CLIENT_ID, TAX_YEAR);
      expect(queue.some(q => q.itemType === 'LOW_CONFIDENCE')).toBe(true);
    });

    it('enqueues review without blocking for non-critical fields in the review zone (0.75 - 0.90)', () => {
      const reviewZoneSource = createMockSource({
        validationSourceId: 'VAL-SRC-REVIEW-ZONE',
        documentId: 'DOC-2024-107',
        documentCategory: 'Form 1099-MISC',
        sourceTier: 'SUPPORTING',
        fieldName: 'rents',
        rawExtractedValue: '$3,600.00',
        normalizedValue: '3600.00',
        AIConfidence: 0.82,
        validationStatus: 'UNVALIDATED'
      });

      const evalResult = StageThreeValidationService.evaluateFieldConfidence(reviewZoneSource, false);
      expect(evalResult.confidenceTier).toBe('REVIEW_REQUIRED');
      expect(evalResult.requiresHumanReview).toBe(true);
      expect(evalResult.isBlocking).toBe(false);
    });
  });

  // ==========================================================================
  // TG-VAL-012: CROSS-DOCUMENT CONSISTENCY ENGINE
  // ==========================================================================
  describe('TG-VAL-012: Cross-Document Consistency Engine', () => {
    it('verifies exact wage reconciliation between W-2 and Annual Payroll Summary', () => {
      const w2 = createMockSource({
        validationSourceId: 'VAL-W2',
        documentId: 'DOC-W2',
        documentCategory: 'Form W-2',
        fieldName: 'box1_wages',
        rawExtractedValue: '$100,000.00',
        normalizedValue: '100000.00'
      });

      const payroll = createMockSource({
        validationSourceId: 'VAL-PAYROLL',
        documentId: 'DOC-PAYROLL',
        documentCategory: 'Annual Payroll Summary',
        sourceTier: 'SUPPORTING',
        fieldName: 'total_gross_wages',
        rawExtractedValue: '$100,000.00',
        normalizedValue: '100000.00'
      });

      StageThreeValidationService.registerValidationSource(w2);
      StageThreeValidationService.registerValidationSource(payroll);

      const rules = StageThreeValidationService.runCrossDocumentValidation(CLIENT_ID, TAX_YEAR);
      const wageRule = rules.find(r => r.ruleId === 'R-W2-PAYROLL-WAGES');
      expect(wageRule).toBeDefined();
      expect(wageRule?.result).toBe('PASS');
      expect(wageRule?.blockingStatus).toBe(false);
    });

    it('detects cross-document wage mismatch, triggers conflict and blocks progression', () => {
      const w2 = createMockSource({
        validationSourceId: 'VAL-W2-MISMATCH',
        documentId: 'DOC-W2-M',
        documentCategory: 'Form W-2',
        fieldName: 'box1_wages',
        rawExtractedValue: '$100,000.00',
        normalizedValue: '100000.00'
      });

      const payroll = createMockSource({
        validationSourceId: 'VAL-PAYROLL-MISMATCH',
        documentId: 'DOC-PAY-M',
        documentCategory: 'Annual Payroll Summary',
        sourceTier: 'SUPPORTING',
        fieldName: 'total_gross_wages',
        rawExtractedValue: '$108,500.00', // $8,500 difference!
        normalizedValue: '108500.00'
      });

      StageThreeValidationService.registerValidationSource(w2);
      StageThreeValidationService.registerValidationSource(payroll);

      const rules = StageThreeValidationService.runCrossDocumentValidation(CLIENT_ID, TAX_YEAR);
      const wageRule = rules.find(r => r.ruleId === 'R-W2-PAYROLL-WAGES');
      expect(wageRule?.result).toBe('FAIL');
      expect(wageRule?.blockingStatus).toBe(true);

      const conflicts = StageThreeValidationService.getConflicts(CLIENT_ID, TAX_YEAR);
      expect(conflicts.some(c => c.affectedField === 'box1_wages' && c.materiality === 'MATERIAL')).toBe(true);
    });

    it('validates trial balance debit and credit equilibrium and flags out-of-balance condition', () => {
      const debits = createMockSource({
        validationSourceId: 'VAL-TB-DR',
        documentId: 'DOC-TB',
        documentCategory: 'Trial Balance',
        fieldName: 'total_debits',
        rawExtractedValue: '$450,250.00',
        normalizedValue: '450250.00'
      });

      const credits = createMockSource({
        validationSourceId: 'VAL-TB-CR',
        documentId: 'DOC-TB',
        documentCategory: 'Trial Balance',
        fieldName: 'total_credits',
        rawExtractedValue: '$450,200.00', // Out of balance by $50!
        normalizedValue: '450200.00'
      });

      StageThreeValidationService.registerValidationSource(debits);
      StageThreeValidationService.registerValidationSource(credits);

      const rules = StageThreeValidationService.runCrossDocumentValidation(CLIENT_ID, TAX_YEAR);
      const tbRule = rules.find(r => r.ruleId === 'R-TB-DEBIT-CREDIT');
      expect(tbRule?.result).toBe('FAIL');
      expect(tbRule?.severity).toBe('CRITICAL');
      expect(tbRule?.blockingStatus).toBe(true);
    });
  });

  // ==========================================================================
  // TG-VAL-013: MATHEMATICAL & STRUCTURAL VALIDATION ENGINE
  // ==========================================================================
  describe('TG-VAL-013: Mathematical & Structural Validation', () => {
    it('verifies gross minus deductions equals taxable wages arithmetic relationship', () => {
      const gross = createMockSource({
        validationSourceId: 'VAL-M-GROSS',
        documentId: 'DOC-PAY-01',
        fieldName: 'gross_wages',
        rawExtractedValue: '$90,000.00',
        normalizedValue: '90000.00'
      });

      const ded = createMockSource({
        validationSourceId: 'VAL-M-DED',
        documentId: 'DOC-PAY-01',
        fieldName: 'pretax_deductions',
        rawExtractedValue: '$5,000.00',
        normalizedValue: '5000.00'
      });

      const taxWages = createMockSource({
        validationSourceId: 'VAL-M-TAX',
        documentId: 'DOC-PAY-01',
        fieldName: 'box1_wages',
        rawExtractedValue: '$85,000.00',
        normalizedValue: '85000.00'
      });

      StageThreeValidationService.registerValidationSource(gross);
      StageThreeValidationService.registerValidationSource(ded);
      StageThreeValidationService.registerValidationSource(taxWages);

      const mathResults = StageThreeValidationService.runMathematicalValidation(CLIENT_ID, TAX_YEAR);
      const netPayCalc = mathResults.find(m => m.calculationId === 'CALC-NET-PAY-01');
      expect(netPayCalc?.status).toBe('VALID');
      expect(netPayCalc?.computedValue).toBe(85000);
      expect(netPayCalc?.isFabricated).toBe(false);
    });

    it('returns INSUFFICIENT_EVIDENCE when components are missing without fabricating values', () => {
      // No sources registered
      const mathResults = StageThreeValidationService.runMathematicalValidation(CLIENT_ID, TAX_YEAR);
      const netPayCalc = mathResults.find(m => m.calculationId === 'CALC-NET-PAY-01');
      expect(netPayCalc?.status).toBe('INSUFFICIENT_EVIDENCE');
      expect(netPayCalc?.computedValue).toBeNull();
      expect(netPayCalc?.isFabricated).toBe(false);
    });
  });

  // ==========================================================================
  // TG-VAL-014: DUPLICATE & VERSION VALIDATION ENGINE
  // ==========================================================================
  describe('TG-VAL-014: Duplicate & Version Validation Engine', () => {
    it('flags duplicate documents as non-authoritative and raises blocking exception', () => {
      seedStageTwoDoc({
        documentId: 'DOC-DUP-01',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client Admin',
        originalFileName: 'W2_Duplicate.pdf',
        fileSizeBytes: 10240,
        mimeType: 'application/pdf',
        claimedCategory: 'Income Documents',
        sha256Hash: 'a1'.repeat(32),
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Accepted',
        isVerified: false,
        securityCheckStatus: 'Passed (SHA-256 Validated)',
        intelligenceRecord: {
          documentId: 'DOC-DUP-01',
          classificationConfidence: 0.95,
          versionIntelligence: {
            relationship: 'DUPLICATE',
            versionNumber: 1,
            isCurrentActiveVersion: false,
            supersedesDocId: 'DOC-ORIG-01',
            requiresDownstreamRevalidation: false,
            confidence: 0.99,
            notes: 'Exact byte match with prior upload'
          },
          extractionStatus: 'SUCCESS'
        }
      });

      const results = StageThreeValidationService.runDuplicateAndVersionValidation(CLIENT_ID, TAX_YEAR);
      const dup = results.find(r => r.documentId === 'DOC-DUP-01');
      expect(dup?.sourceStatus).toBe('DUPLICATE');
      expect(dup?.isAuthoritativeActive).toBe(false);
      expect(dup?.isBlocking).toBe(true);

      const exceptions = StageThreeValidationService.getExceptions(CLIENT_ID, TAX_YEAR);
      expect(exceptions.some(e => e.category === 'DUPLICATE_SOURCE' && e.isBlocking)).toBe(true);
    });

    it('marks superseded sources as stale and sets downstream revalidation required for corrected documents', () => {
      seedStageTwoDoc({
        documentId: 'DOC-CORRECTED-01',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client Admin',
        originalFileName: 'W2_Corrected_W2c.pdf',
        fileSizeBytes: 15360,
        mimeType: 'application/pdf',
        claimedCategory: 'Income Documents',
        sha256Hash: 'a2'.repeat(32),
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Accepted',
        isVerified: false,
        securityCheckStatus: 'Passed (SHA-256 Validated)',
        intelligenceRecord: {
          documentId: 'DOC-CORRECTED-01',
          classificationConfidence: 0.98,
          versionIntelligence: {
            relationship: 'CORRECTED',
            versionNumber: 2,
            isCurrentActiveVersion: true,
            supersedesDocId: 'DOC-PRIOR-01',
            requiresDownstreamRevalidation: true,
            confidence: 0.95,
            notes: 'Form W-2c corrects Box 1 wages'
          },
          extractionStatus: 'SUCCESS'
        }
      });

      const priorSource = createMockSource({
        validationSourceId: 'VAL-PRIOR-SRC',
        documentId: 'DOC-PRIOR-01',
        fieldName: 'box1_wages',
        rawExtractedValue: '$80,000.00',
        normalizedValue: '80000.00'
      });

      StageThreeValidationService.registerValidationSource(priorSource);

      const results = StageThreeValidationService.runDuplicateAndVersionValidation(CLIENT_ID, TAX_YEAR);
      const corrected = results.find(r => r.documentId === 'DOC-CORRECTED-01');
      expect(corrected?.sourceStatus).toBe('CORRECTED');
      expect(corrected?.requiresRevalidation).toBe(true);

      const sources = StageThreeValidationService.getValidationSources(CLIENT_ID, TAX_YEAR);
      const oldSrc = sources.find(s => s.documentId === 'DOC-PRIOR-01');
      expect(oldSrc?.validationStatus).toBe('REVALIDATION_REQUIRED');
    });
  });

  // ==========================================================================
  // TG-VAL-015: CONFLICT DETECTION & MATERIALITY ENGINE
  // ==========================================================================
  describe('TG-VAL-015: Conflict Detection & Materiality Engine', () => {
    it('distinguishes between immaterial and material variances according to materiality thresholds', () => {
      // 1. Immaterial variance ($0.50 rounding difference on $50,000)
      const immaterialConflict = StageThreeValidationService.createConflict({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        conflictCategory: 'AMOUNT_MISMATCH',
        affectedField: 'box1_wages',
        sourceA: { sourceId: 'S1', documentId: 'D1', documentName: 'W2.pdf', value: 50000.50, sourceTier: 'AUTHORITATIVE' },
        sourceB: { sourceId: 'S2', documentId: 'D2', documentName: 'Payroll.pdf', value: 50000.00, sourceTier: 'SUPPORTING' },
        observedValues: '50000.50 vs 50000.00',
        variance: 0.50,
        materiality: 'IMMATERIAL',
        severity: 'LOW',
        blockingStatus: false
      });

      expect(immaterialConflict.blockingStatus).toBe(false);
      expect(immaterialConflict.materiality).toBe('IMMATERIAL');

      // 2. Material variance ($5,000 difference)
      const materialConflict = StageThreeValidationService.createConflict({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        conflictCategory: 'AMOUNT_MISMATCH',
        affectedField: 'box1_wages',
        sourceA: { sourceId: 'S1', documentId: 'D1', documentName: 'W2.pdf', value: 55000.00, sourceTier: 'AUTHORITATIVE' },
        sourceB: { sourceId: 'S2', documentId: 'D2', documentName: 'Payroll.pdf', value: 50000.00, sourceTier: 'SUPPORTING' },
        observedValues: '55000.00 vs 50000.00',
        variance: 5000.00,
        materiality: 'MATERIAL',
        severity: 'HIGH',
        blockingStatus: true
      });

      expect(materialConflict.blockingStatus).toBe(true);
      expect(materialConflict.materiality).toBe('MATERIAL');
    });

    it('enforces authoritative source hierarchy where AUTHORITATIVE source ranks above AI_EXTRACTED', () => {
      const comparison = StageThreeValidationService.compareSourceAuthority('AUTHORITATIVE', 'AI_EXTRACTED');
      expect(comparison.higherAuthority).toBe('SOURCE_A');
      expect(comparison.scoreA).toBeGreaterThan(comparison.scoreB);
    });
  });

  // ==========================================================================
  // TG-VAL-016: VALIDATION EXCEPTION REGISTRY & PROGRESSION BLOCKER
  // ==========================================================================
  describe('TG-VAL-016: Validation Exception Registry & Downstream Blocker', () => {
    it('creates structured validation exceptions and blocks downstream progression until resolved or waived', () => {
      // Initially not blocked
      let blockStatus = StageThreeValidationService.isValidationBlocked(CLIENT_ID, TAX_YEAR);
      expect(blockStatus.isBlocked).toBe(false);

      // Create a blocking exception
      const ex = StageThreeValidationService.createValidationException({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        category: 'CROSS_DOCUMENT_VARIANCE',
        title: 'Unreconciled Wage Variance',
        description: 'W-2 Box 1 wages differ from payroll summary by $8,500.00',
        severity: 'HIGH',
        materiality: 'MATERIAL',
        isBlocking: true,
        validationRule: 'TG-VAL-012',
        createdBy: 'Cross-Document Consistency Engine',
        assignedTo: 'Lead Reviewer / CPA'
      });

      blockStatus = StageThreeValidationService.isValidationBlocked(CLIENT_ID, TAX_YEAR);
      expect(blockStatus.isBlocked).toBe(true);
      expect(blockStatus.blockingExceptions.length).toBe(1);

      // Resolve the exception
      StageThreeValidationService.resolveValidationException({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        exceptionId: ex.exceptionId,
        resolvedBy: 'Senior CPA Reviewer',
        resolvedByRole: 'cpa',
        action: 'RECONCILED_WITH_CLIENT',
        justification: 'Client provided corrected payroll summary reconciling the variance.'
      });

      blockStatus = StageThreeValidationService.isValidationBlocked(CLIENT_ID, TAX_YEAR);
      expect(blockStatus.isBlocked).toBe(false);
    });

    it('requires formal justification when waiving a blocking exception', () => {
      const ex = StageThreeValidationService.createValidationException({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        engagementId: ENGAGEMENT_ID,
        category: 'CONTROLLED_FORM_DEFECT',
        title: 'Missing State ID on Form 1099',
        description: 'Payer state identification omitted on Form 1099-NEC',
        severity: 'MEDIUM',
        materiality: 'IMMATERIAL',
        isBlocking: true,
        validationRule: 'TG-VAL-008',
        createdBy: 'Controlled Form Validator',
        assignedTo: 'Tax Manager'
      });

      // Waive with justification
      const updated = StageThreeValidationService.waiveValidationException({
        clientId: CLIENT_ID,
        taxYear: TAX_YEAR,
        exceptionId: ex.exceptionId,
        waivedBy: 'Tax Partner',
        waivedByRole: 'cpa',
        justification: 'State withholding is zero and federal form only is required for federal filing.'
      });

      expect(updated.status).toBe('WAIVED');
      expect(updated.resolution?.justification).toContain('State withholding is zero');

      const blockStatus = StageThreeValidationService.isValidationBlocked(CLIENT_ID, TAX_YEAR);
      expect(blockStatus.isBlocked).toBe(false);
    });
  });
});
