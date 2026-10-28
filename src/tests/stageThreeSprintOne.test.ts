import { describe, it, expect, beforeEach } from 'vitest';
import {
  StageThreeValidationService,
  CANONICAL_STAGE_THREE_FEATURE_REGISTRY,
  STAGE_THREE_SUB_FEATURE_REGISTRY,
  ValidationSourceRecord,
  SourceIntegrityResult,
  TaxpayerIdentityFinding,
  TinEinValidationFinding,
  TaxYearConsistencyFinding,
  EntityClassificationFinding,
  ControlledTaxFormValidationResult
} from '../services/stageThreeValidationService';
import {
  StageTwoCollectionOperationsService,
  StageTwoExitGateRecord
} from '../services/stageTwoCollectionOperationsService';
import {
  StageTwoCollectionService,
  StageTwoUploadedDocument
} from '../services/stageTwoCollectionService';

describe('Stage 03: Validate — Sprint 1 (TG-VAL-001 through TG-VAL-008)', () => {
  const CLIENT_ID = 'cli_sprint1_verified';
  const TAX_YEAR = 2025;
  const ENGAGEMENT_ID = 'ENG-2025-SPRINT1';

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  // ==========================================================================
  // TG-VAL-001: Stage 02 Certified Intake
  // ==========================================================================
  describe('TG-VAL-001: Stage 02 Certified Intake', () => {
    it('blocks validation intake when no Stage 02 Exit Gate record exists', () => {
      const result = StageThreeValidationService.validateStageTwoHandoff('non_existent_client', 2025);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('BLOCKED_BY_STAGE_02');
      expect(result.gateRecord).toBeNull();
      expect(result.reasons[0]).toContain('No certified Stage 02 Exit Gate record exists');
    });

    it('blocks intake when Stage 02 exit gate has BLOCKED status or unverified documents', () => {
      const blockedGate: StageTwoExitGateRecord = {
        gateId: 'GATE-BLK-001',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        evaluationTimestamp: new Date().toISOString(),
        collectionVersion: 1,
        gateResult: 'BLOCKED',
        stageTwoStatus: 'IN_PROGRESS',
        stageThreeStatus: 'INELIGIBLE',
        evaluatedConditions: { hasUnverifiedDocs: true },
        actor: 'Preparer User',
        actorRole: 'preparer',
        certificationStatement: 'Blocked due to unverified items',
        correlationId: 'CORR-GATE-BLK'
      };

      (StageTwoCollectionOperationsService as any).exitGateStore.set(
        `${CLIENT_ID}_${TAX_YEAR}`,
        blockedGate
      );

      const result = StageThreeValidationService.validateStageTwoHandoff(CLIENT_ID, TAX_YEAR, ENGAGEMENT_ID);
      expect(result.isValid).toBe(false);
      expect(result.status).toBe('BLOCKED_BY_STAGE_02');
      expect(result.reasons.some(r => r.includes("Stage 02 Exit Gate result is 'BLOCKED'"))).toBe(true);
    });

    it('enforces tenant isolation and rejects handoff if client ID or tax year mismatch', () => {
      const validGate: StageTwoExitGateRecord = {
        gateId: 'GATE-CLR-TENANT',
        clientId: 'other_tenant_id',
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        evaluationTimestamp: new Date().toISOString(),
        collectionVersion: 1,
        gateResult: 'CLEARED',
        stageTwoStatus: 'COMPLETED',
        stageThreeStatus: 'ELIGIBLE',
        evaluatedConditions: { allPassed: true },
        actor: 'Desmond Hinds, CPA',
        actorRole: 'cpa',
        certificationStatement: 'Certified for handoff',
        correlationId: 'CORR-GATE-CLR'
      };

      (StageTwoCollectionOperationsService as any).exitGateStore.set(
        `${CLIENT_ID}_${TAX_YEAR}`,
        validGate
      );

      const result = StageThreeValidationService.validateStageTwoHandoff(CLIENT_ID, TAX_YEAR);
      expect(result.isValid).toBe(false);
      expect(result.reasons.some(r => r.includes('Gate client ID mismatch'))).toBe(true);
    });

    it('permits Stage 03 initialization and populates workspace context when Stage 02 gate is CLEARED', () => {
      const clearedGate: StageTwoExitGateRecord = {
        gateId: 'GATE-CERT-2025-001',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        evaluationTimestamp: new Date().toISOString(),
        collectionVersion: 1,
        gateResult: 'CLEARED',
        stageTwoStatus: 'COMPLETED',
        stageThreeStatus: 'ELIGIBLE',
        evaluatedConditions: { allPassed: true },
        actor: 'Desmond Hinds, CPA',
        actorRole: 'cpa',
        certificationStatement: 'Certified clean collection',
        correlationId: 'CORR-CLEARED-01'
      };

      (StageTwoCollectionOperationsService as any).exitGateStore.set(
        `${CLIENT_ID}_${TAX_YEAR}`,
        clearedGate
      );

      const result = StageThreeValidationService.validateStageTwoHandoff(CLIENT_ID, TAX_YEAR, ENGAGEMENT_ID);
      expect(result.isValid).toBe(true);
      expect(result.status).toBe('ELIGIBLE');
      expect(result.gateRecord?.gateId).toBe('GATE-CERT-2025-001');

      const ctx = StageThreeValidationService.getWorkspaceContext(CLIENT_ID, TAX_YEAR, ENGAGEMENT_ID);
      expect(ctx.isHandoffVerified).toBe(true);
      expect(ctx.stageTwoGateId).toBe('GATE-CERT-2025-001');
      expect(ctx.taxYear).toBe(TAX_YEAR);
      expect(ctx.clientId).toBe(CLIENT_ID);
    });
  });

  // ==========================================================================
  // TG-VAL-002: Validation Source Registry
  // ==========================================================================
  describe('TG-VAL-002: Validation Source Registry', () => {
    it('registers validation source records with immutable provenance and enforces isAiProposedOnly: true', () => {
      const record = StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-REG-001',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'Form W-2',
        originalFilename: 'W2_2025_Acme.pdf',
        sourceHash: 'b3f5a8c9e1d2f4a6b8c0e2d4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4',
        OCRArtifactId: 'OCR-ART-W2-01',
        extractionArtifactId: 'EXT-ART-W2-01',
        pageNumber: 1,
        boundingBox: { x: 10, y: 20, width: 100, height: 30 },
        fieldName: 'box1_wages',
        rawExtractedValue: '$98,500.00',
        normalizedValue: '98500.00',
        sourceTier: 'AUTHORITATIVE',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      expect(record.validationSourceId).toMatch(/^VSR-2025-\d+/);
      expect(record.isAiProposedOnly).toBe(true); // Governance invariant
      expect(record.sourceTier).toBe('AUTHORITATIVE');
      expect(record.OCRArtifactId).toBe('OCR-ART-W2-01');
      expect(record.boundingBox?.x).toBe(10);

      const sources = StageThreeValidationService.getValidationSources(CLIENT_ID, TAX_YEAR);
      expect(sources.some(s => s.validationSourceId === record.validationSourceId)).toBe(true);
    });

    it('syncs sources from Stage 02 accepted documents and excludes quarantined or rejected files', () => {
      (StageTwoCollectionService as any).inMemoryUploads.set(`${CLIENT_ID}_${TAX_YEAR}`, [
        {
          documentId: 'DOC-SYNC-CLEARED',
          clientId: CLIENT_ID,
          engagementId: ENGAGEMENT_ID,
          taxYear: TAX_YEAR,
          uploaderSource: 'client_portal',
          uploadedBy: 'Client User',
          originalFileName: 'Bank_Statement_Dec2025.pdf',
          fileSizeBytes: 42000,
          mimeType: 'application/pdf',
          claimedCategory: 'Bank Statements',
          sha256Hash: 'a'.repeat(64),
          uploadTimestamp: new Date().toISOString(),
          processingStatus: 'Accepted',
          isVerified: true,
          securityCheckStatus: 'Passed (SHA-256 Validated)'
        },
        {
          documentId: 'DOC-SYNC-QUARANTINED',
          clientId: CLIENT_ID,
          engagementId: ENGAGEMENT_ID,
          taxYear: TAX_YEAR,
          uploaderSource: 'client_portal',
          uploadedBy: 'Client User',
          originalFileName: 'Suspicious_Payload.pdf',
          fileSizeBytes: 9999,
          mimeType: 'application/pdf',
          claimedCategory: 'Form W-2',
          sha256Hash: 'b'.repeat(64),
          uploadTimestamp: new Date().toISOString(),
          processingStatus: 'Under Review',
          isVerified: false,
          securityCheckStatus: 'Quarantined'
        }
      ]);

      const newlySynced = StageThreeValidationService.syncSourcesFromStageTwo(CLIENT_ID, TAX_YEAR);
      expect(newlySynced.some(s => s.documentId === 'DOC-SYNC-CLEARED')).toBe(true);
      expect(newlySynced.some(s => s.documentId === 'DOC-SYNC-QUARANTINED')).toBe(false);
    });
  });

  // ==========================================================================
  // TG-VAL-003: Source Integrity Verification
  // ==========================================================================
  describe('TG-VAL-003: Source Integrity Verification', () => {
    it('confirms VERIFIED for 64-character SHA-256 hashes with passed security check', () => {
      const validDoc: StageTwoUploadedDocument = {
        documentId: 'DOC-INTEGRITY-PASS',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client User',
        originalFileName: 'Official_W2_2025.pdf',
        fileSizeBytes: 52000,
        mimeType: 'application/pdf',
        claimedCategory: 'Form W-2',
        sha256Hash: 'c4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Accepted',
        isVerified: true,
        securityCheckStatus: 'Passed (SHA-256 Validated)'
      };

      const check = StageThreeValidationService.verifyDocumentIntegrity(validDoc);
      expect(check.integrityStatus).toBe('VERIFIED');
      expect(check.isHashFormatValid).toBe(true);
      expect(check.isQuarantined).toBe(false);
    });

    it('flags TAMPERED_OR_INVALID on corrupted, truncated, or non-hex hash', () => {
      const tamperedDoc: StageTwoUploadedDocument = {
        documentId: 'DOC-CORRUPT-HASH',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client User',
        originalFileName: 'Corrupt_File.pdf',
        fileSizeBytes: 12000,
        mimeType: 'application/pdf',
        claimedCategory: 'Form W-2',
        sha256Hash: 'invalid-hash-short',
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Accepted',
        isVerified: true,
        securityCheckStatus: 'Passed (SHA-256 Validated)'
      };

      const check = StageThreeValidationService.verifyDocumentIntegrity(tamperedDoc);
      expect(check.integrityStatus).toBe('TAMPERED_OR_INVALID');
      expect(check.isHashFormatValid).toBe(false);
      expect(check.details).toContain('Invalid SHA-256 hash structure');
    });

    it('flags QUARANTINED when security check status is Quarantined', () => {
      const quarantinedDoc: StageTwoUploadedDocument = {
        documentId: 'DOC-QUARANTINE-FLAG',
        clientId: CLIENT_ID,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        uploaderSource: 'client_portal',
        uploadedBy: 'Client User',
        originalFileName: 'Malware_Risk.pdf',
        fileSizeBytes: 8000,
        mimeType: 'application/pdf',
        claimedCategory: 'Form W-2',
        sha256Hash: 'd'.repeat(64),
        uploadTimestamp: new Date().toISOString(),
        processingStatus: 'Processing',
        isVerified: false,
        securityCheckStatus: 'Quarantined'
      };

      const check = StageThreeValidationService.verifyDocumentIntegrity(quarantinedDoc);
      expect(check.integrityStatus).toBe('QUARANTINED');
      expect(check.isQuarantined).toBe(true);
    });
  });

  // ==========================================================================
  // TG-VAL-004: Taxpayer Identity Consistency
  // ==========================================================================
  describe('TG-VAL-004: Taxpayer Identity Consistency', () => {
    it('verifies EXACT_MATCH when document names match engagement profile exactly', () => {
      const ID_CLIENT = 'cli_val_id_exact';
      const LEGAL_NAME = 'Apex Global Consulting, LLC';

      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-EXACT-NAME',
        clientId: ID_CLIENT,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'Form W-2',
        originalFilename: 'W2_Apex.pdf',
        sourceHash: 'e'.repeat(64),
        OCRArtifactId: 'OCR-EXACT-1',
        extractionArtifactId: 'EXT-EXACT-1',
        pageNumber: 1,
        fieldName: 'business_name',
        rawExtractedValue: 'Apex Global Consulting, LLC',
        normalizedValue: 'Apex Global Consulting, LLC',
        sourceTier: 'AUTHORITATIVE',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      const findings = StageThreeValidationService.runTaxpayerIdentityValidation(
        ID_CLIENT,
        TAX_YEAR,
        { legalName: LEGAL_NAME }
      );

      expect(findings.length).toBe(1);
      expect(findings[0].matchResult).toBe('EXACT_MATCH');
      expect(findings[0].isBlocking).toBe(false);
    });

    it('detects MISMATCH, marks isBlocking: true, and registers an IDENTITY_MISMATCH conflict', () => {
      const ID_CLIENT = 'cli_val_id_mismatch';
      const LEGAL_NAME = 'Apex Global Consulting, LLC';

      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-MISMATCH-NAME',
        clientId: ID_CLIENT,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'Form 1099-MISC',
        originalFilename: '1099_Foreign_Entity.pdf',
        sourceHash: 'f'.repeat(64),
        OCRArtifactId: 'OCR-MISMATCH-1',
        extractionArtifactId: 'EXT-MISMATCH-1',
        pageNumber: 1,
        fieldName: 'recipient_name',
        rawExtractedValue: 'Zenith Logistics Partners, Inc.',
        normalizedValue: 'Zenith Logistics Partners, Inc.',
        sourceTier: 'AUTHORITATIVE',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'UNREVIEWED',
        validationStatus: 'UNVALIDATED'
      });

      const findings = StageThreeValidationService.runTaxpayerIdentityValidation(
        ID_CLIENT,
        TAX_YEAR,
        { legalName: LEGAL_NAME }
      );

      expect(findings.length).toBe(1);
      expect(findings[0].matchResult).toBe('MISMATCH');
      expect(findings[0].isBlocking).toBe(true);

      const conflicts = StageThreeValidationService.getConflicts(ID_CLIENT, TAX_YEAR);
      expect(conflicts.some(c => c.conflictCategory === 'IDENTITY_MISMATCH')).toBe(true);
    });
  });

  // ==========================================================================
  // TG-VAL-005: TIN/EIN Consistency
  // ==========================================================================
  describe('TG-VAL-005: TIN/EIN Consistency', () => {
    it('validates 9-digit tax ID, masks observed value, and confirms match with master profile', () => {
      const TIN_CLIENT = 'cli_tin_match_test';
      const PROFILE_EIN = '57-1234567';

      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-TIN-PASS',
        clientId: TIN_CLIENT,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'Form 1120-S',
        originalFilename: 'Return_1120S.pdf',
        sourceHash: '1'.repeat(64),
        OCRArtifactId: 'OCR-TIN-PASS',
        extractionArtifactId: 'EXT-TIN-PASS',
        pageNumber: 1,
        fieldName: 'ein',
        rawExtractedValue: '57-1234567',
        normalizedValue: '57-1234567',
        sourceTier: 'AUTHORITATIVE',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'REVIEWED_APPROVED',
        validationStatus: 'VALIDATED'
      });

      const findings = StageThreeValidationService.runTinEinValidation(
        TIN_CLIENT,
        TAX_YEAR,
        { einTin: PROFILE_EIN }
      );

      expect(findings.length).toBe(1);
      expect(findings[0].matchResult).toBe('EXACT_MATCH');
      expect(findings[0].tinType).toBe('EIN');
      expect(findings[0].isFormatValid).toBe(true);
      expect(findings[0].maskedObservedTin).toBe('***-**-4567');
      expect(findings[0].isBlocking).toBe(false);
    });

    it('detects TIN mismatch against profile, sets isBlocking: true, and creates TIN_MISMATCH conflict', () => {
      const TIN_CLIENT = 'cli_tin_fail_test';
      const PROFILE_EIN = '57-1234567';

      StageThreeValidationService.registerValidationSource({
        documentId: 'DOC-TIN-WRONG',
        clientId: TIN_CLIENT,
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        collectionVersion: 1,
        documentVersion: 1,
        documentCategory: 'Form 941',
        originalFilename: 'Quarterly_941.pdf',
        sourceHash: '2'.repeat(64),
        OCRArtifactId: 'OCR-TIN-FAIL',
        extractionArtifactId: 'EXT-TIN-FAIL',
        pageNumber: 1,
        fieldName: 'employer_ein',
        rawExtractedValue: '99-8877665',
        normalizedValue: '99-8877665',
        sourceTier: 'AUTHORITATIVE',
        AIConfidence: 0.99,
        isAiProposedOnly: true,
        humanReviewStatus: 'UNREVIEWED',
        validationStatus: 'UNVALIDATED'
      });

      const findings = StageThreeValidationService.runTinEinValidation(
        TIN_CLIENT,
        TAX_YEAR,
        { einTin: PROFILE_EIN }
      );

      expect(findings.length).toBe(1);
      expect(findings[0].matchResult).toBe('MISMATCH');
      expect(findings[0].isBlocking).toBe(true);

      const conflicts = StageThreeValidationService.getConflicts(TIN_CLIENT, TAX_YEAR);
      expect(conflicts.some(c => c.conflictCategory === 'TIN_MISMATCH')).toBe(true);
    });
  });

  // ==========================================================================
  // TG-VAL-006: Tax-Year Consistency
  // ==========================================================================
  describe('TG-VAL-006: Tax-Year Consistency', () => {
    it('detects prior tax year forms and flags them as blocking TAX_YEAR_MISMATCH conflicts', () => {
      const YEAR_CLIENT = 'cli_val_year_test';

      (StageTwoCollectionService as any).inMemoryUploads.set(`${YEAR_CLIENT}_2025`, [
        {
          documentId: 'DOC-YEAR-2025',
          clientId: YEAR_CLIENT,
          engagementId: ENGAGEMENT_ID,
          taxYear: 2025,
          uploaderSource: 'client_portal',
          uploadedBy: 'Client User',
          originalFileName: 'Payroll_Journal_2025.pdf',
          fileSizeBytes: 25000,
          mimeType: 'application/pdf',
          claimedCategory: 'Payroll Summary',
          sha256Hash: '3'.repeat(64),
          uploadTimestamp: new Date().toISOString(),
          processingStatus: 'Accepted',
          isVerified: true,
          securityCheckStatus: 'Passed (SHA-256 Validated)'
        },
        {
          documentId: 'DOC-YEAR-2022',
          clientId: YEAR_CLIENT,
          engagementId: ENGAGEMENT_ID,
          taxYear: 2025,
          uploaderSource: 'client_portal',
          uploadedBy: 'Client User',
          originalFileName: 'Old_Tax_Return_2022.pdf',
          fileSizeBytes: 30000,
          mimeType: 'application/pdf',
          claimedCategory: 'Prior Year Return',
          sha256Hash: '4'.repeat(64),
          uploadTimestamp: new Date().toISOString(),
          processingStatus: 'Accepted',
          isVerified: true,
          securityCheckStatus: 'Passed (SHA-256 Validated)'
        }
      ]);

      const findings = StageThreeValidationService.runTaxYearConsistencyValidation(YEAR_CLIENT, 2025);
      expect(findings.length).toBe(2);

      const validFinding = findings.find(f => f.documentId === 'DOC-YEAR-2025');
      expect(validFinding?.isCorrectTaxYear).toBe(true);
      expect(validFinding?.isBlocking).toBe(false);

      const priorFinding = findings.find(f => f.documentId === 'DOC-YEAR-2022');
      expect(priorFinding?.isCorrectTaxYear).toBe(false);
      expect(priorFinding?.isPriorYear).toBe(true);
      expect(priorFinding?.isBlocking).toBe(true);

      const conflicts = StageThreeValidationService.getConflicts(YEAR_CLIENT, 2025);
      expect(conflicts.some(c => c.conflictCategory === 'TAX_YEAR_MISMATCH')).toBe(true);
    });
  });

  // ==========================================================================
  // TG-VAL-007: Entity Classification Validation
  // ==========================================================================
  describe('TG-VAL-007: Entity Classification Validation', () => {
    it('verifies compatible returns and raises blocking conflicts on incompatible forms', () => {
      const ENTITY_CLIENT = 'cli_val_entity_scorp';

      (StageTwoCollectionService as any).inMemoryUploads.set(`${ENTITY_CLIENT}_2025`, [
        {
          documentId: 'DOC-SCORP-COMPAT',
          clientId: ENTITY_CLIENT,
          engagementId: ENGAGEMENT_ID,
          taxYear: 2025,
          uploaderSource: 'client_portal',
          uploadedBy: 'Client User',
          originalFileName: '1120S_Workpapers.pdf',
          fileSizeBytes: 40000,
          mimeType: 'application/pdf',
          claimedCategory: 'Form 1120-S',
          sha256Hash: '5'.repeat(64),
          uploadTimestamp: new Date().toISOString(),
          processingStatus: 'Accepted',
          isVerified: true,
          securityCheckStatus: 'Passed (SHA-256 Validated)'
        },
        {
          documentId: 'DOC-PARTNERSHIP-INCOMPAT',
          clientId: ENTITY_CLIENT,
          engagementId: ENGAGEMENT_ID,
          taxYear: 2025,
          uploaderSource: 'client_portal',
          uploadedBy: 'Client User',
          originalFileName: 'Form_1065_Return.pdf',
          fileSizeBytes: 45000,
          mimeType: 'application/pdf',
          claimedCategory: 'Form 1065',
          sha256Hash: '6'.repeat(64),
          uploadTimestamp: new Date().toISOString(),
          processingStatus: 'Accepted',
          isVerified: true,
          securityCheckStatus: 'Passed (SHA-256 Validated)'
        }
      ]);

      const findings = StageThreeValidationService.runEntityClassificationValidation(
        ENTITY_CLIENT,
        2025,
        'S-Corporation'
      );

      const compat = findings.find(f => f.documentId === 'DOC-SCORP-COMPAT');
      expect(compat?.compatibilityStatus).toBe('COMPATIBLE');
      expect(compat?.isBlocking).toBe(false);

      const incompat = findings.find(f => f.documentId === 'DOC-PARTNERSHIP-INCOMPAT');
      expect(incompat?.compatibilityStatus).toBe('INCOMPATIBLE');
      expect(incompat?.isBlocking).toBe(true);

      const conflicts = StageThreeValidationService.getConflicts(ENTITY_CLIENT, 2025);
      expect(conflicts.some(c => c.conflictCategory === 'ENTITY_TYPE_MISMATCH')).toBe(true);
    });
  });

  // ==========================================================================
  // TG-VAL-008: Controlled Tax Form Validation
  // ==========================================================================
  describe('TG-VAL-008: Controlled Tax Form Validation', () => {
    it('validates complete W-2 forms and flags missing mandatory IRS fields with a blocking exception', () => {
      const FORM_CLIENT = 'cli_val_controlled_test';

      (StageTwoCollectionService as any).inMemoryUploads.set(`${FORM_CLIENT}_2025`, [
        {
          documentId: 'DOC-W2-COMPLETE',
          clientId: FORM_CLIENT,
          engagementId: ENGAGEMENT_ID,
          taxYear: 2025,
          uploaderSource: 'client_portal',
          uploadedBy: 'Client User',
          originalFileName: 'Complete_W2.pdf',
          fileSizeBytes: 30000,
          mimeType: 'application/pdf',
          claimedCategory: 'Form W-2',
          sha256Hash: '7'.repeat(64),
          uploadTimestamp: new Date().toISOString(),
          processingStatus: 'Accepted',
          isVerified: true,
          securityCheckStatus: 'Passed (SHA-256 Validated)'
        },
        {
          documentId: 'DOC-W2-MISSING-FIELDS',
          clientId: FORM_CLIENT,
          engagementId: ENGAGEMENT_ID,
          taxYear: 2025,
          uploaderSource: 'client_portal',
          uploadedBy: 'Client User',
          originalFileName: 'Deficient_W2.pdf',
          fileSizeBytes: 28000,
          mimeType: 'application/pdf',
          claimedCategory: 'Form W-2',
          sha256Hash: '8'.repeat(64),
          uploadTimestamp: new Date().toISOString(),
          processingStatus: 'Accepted',
          isVerified: true,
          securityCheckStatus: 'Passed (SHA-256 Validated)'
        }
      ]);

      // Complete W-2 has all 5 mandatory fields
      ['employer_name', 'employer_ein', 'employee_ssn', 'box1_wages', 'box2_fed_withheld'].forEach(field => {
        StageThreeValidationService.registerValidationSource({
          documentId: 'DOC-W2-COMPLETE',
          clientId: FORM_CLIENT,
          engagementId: ENGAGEMENT_ID,
          taxYear: 2025,
          collectionVersion: 1,
          documentVersion: 1,
          documentCategory: 'Form W-2',
          originalFilename: 'Complete_W2.pdf',
          sourceHash: '7'.repeat(64),
          OCRArtifactId: 'OCR-W2-COMPLETE',
          extractionArtifactId: 'EXT-W2-COMPLETE',
          pageNumber: 1,
          fieldName: field,
          rawExtractedValue: 'Value',
          normalizedValue: 'Value',
          sourceTier: 'AUTHORITATIVE',
          AIConfidence: 0.99,
          isAiProposedOnly: true,
          humanReviewStatus: 'REVIEWED_APPROVED',
          validationStatus: 'VALIDATED'
        });
      });

      // Incomplete W-2 only has 2 fields (missing employee_ssn, box1_wages, box2_fed_withheld)
      ['employer_name', 'employer_ein'].forEach(field => {
        StageThreeValidationService.registerValidationSource({
          documentId: 'DOC-W2-MISSING-FIELDS',
          clientId: FORM_CLIENT,
          engagementId: ENGAGEMENT_ID,
          taxYear: 2025,
          collectionVersion: 1,
          documentVersion: 1,
          documentCategory: 'Form W-2',
          originalFilename: 'Deficient_W2.pdf',
          sourceHash: '8'.repeat(64),
          OCRArtifactId: 'OCR-W2-DEFICIENT',
          extractionArtifactId: 'EXT-W2-DEFICIENT',
          pageNumber: 1,
          fieldName: field,
          rawExtractedValue: 'Value',
          normalizedValue: 'Value',
          sourceTier: 'AUTHORITATIVE',
          AIConfidence: 0.95,
          isAiProposedOnly: true,
          humanReviewStatus: 'UNREVIEWED',
          validationStatus: 'UNVALIDATED'
        });
      });

      const results = StageThreeValidationService.runControlledTaxFormValidation(FORM_CLIENT, 2025);
      expect(results.length).toBe(2);

      const completeResult = results.find(r => r.documentId === 'DOC-W2-COMPLETE');
      expect(completeResult?.status).toBe('VALID');
      expect(completeResult?.isBlocking).toBe(false);
      expect(completeResult?.missingFields.length).toBe(0);

      const deficientResult = results.find(r => r.documentId === 'DOC-W2-MISSING-FIELDS');
      expect(deficientResult?.status).toBe('MISSING_MANDATORY_FIELDS');
      expect(deficientResult?.isBlocking).toBe(true);
      expect(deficientResult?.missingFields).toContain('Employee SSN');
      expect(deficientResult?.missingFields).toContain('Box 1 Wages');
      expect(deficientResult?.missingFields).toContain('Box 2 Federal Tax Withheld');

      const exceptions = StageThreeValidationService.getExceptions(FORM_CLIENT, 2025);
      expect(exceptions.some(e => e.category === 'CONTROLLED_FORM_DEFECT')).toBe(true);
    });
  });
});
