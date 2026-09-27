/**
 * A/R Tax Services, LLC - Test Suite
 * Milestone M2 / Stage 02: Collect — Sprint 2: Secure Document Intake, Quarantine & Storage
 *
 * Verifies:
 * - TG-COL-004: Isolated File Staging (Tracking, unique IDs, initial unverified states)
 * - TG-COL-005: File Signature / MIME Validation (Magic bytes, extension mismatches, executable blocking)
 * - TG-COL-006: File Size & Archive Expansion Protection (Zip bomb, nested archive, size caps)
 * - TG-COL-007: Malware Scanning (Simulated/Dev scanner, EICAR detection, audit logging)
 * - TG-COL-008: Quarantine Workflow (Isolation, OCR gate block, role-gated disposition, audit trail)
 * - TG-COL-009: Document Encryption (AES-256-GCM, metadata isolation)
 * - TG-COL-010: SHA-256 Integrity Registry (Original vs stored hash matching, mismatch detection)
 * - TG-COL-011: Original Document Preservation (Versioning, supersession, retention)
 * - Pipeline State Machine & Invariant Boundaries (Upload != Verified, Scan != Tax Verified, Stored != Reviewed)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StageTwoIntakeSecurityService,
  FileSignatureValidator,
  ArchiveProtectionValidator,
  SimulatedDevelopmentMalwareScanner
} from '../services/stageTwoIntakeSecurityService';
import { StageTwoCollectionService } from '../services/stageTwoCollectionService';
import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';

describe('Milestone M2 / Stage 02: Sprint 2 — Secure Document Intake, Quarantine & Storage', () => {
  beforeEach(() => {
    StageTwoCollectionService.resetCollectionForTesting();
  });

  // ==========================================================================
  // TG-COL-004: ISOLATED FILE STAGING
  // ==========================================================================
  describe('TG-COL-004 — Isolated File Staging', () => {
    it('stages new uploads in an isolated staging state with unique Document IDs', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 sample tax return content');

      const stagedDoc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_acme_corp',
        engagementId: 'ENG-2024-001',
        taxYear: 2024,
        uploader: 'John Doe (Controller)',
        uploaderSource: 'client_portal',
        originalFilename: 'form_1120s_2024.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Corporate Return',
        associatedRequirementId: 'REQ-SCORP-001'
      });

      // Format: DOC-YYYY-XXXXX
      expect(stagedDoc.documentId).toMatch(/^DOC-2024-\d{5}$/);
      expect(stagedDoc.clientId).toBe('client_acme_corp');
      expect(stagedDoc.engagementId).toBe('ENG-2024-001');
      expect(stagedDoc.taxYear).toBe(2024);
      expect(stagedDoc.originalFilename).toBe('form_1120s_2024.pdf');
      expect(stagedDoc.fileSizeBytes).toBe(pdfBytes.length);
      expect(stagedDoc.receivedTimestamp).toBeDefined();

      // Critical Invariants
      expect(stagedDoc.isVerified).toBe(false);
      expect(stagedDoc.taxDataVerified).toBe(false);
      expect(stagedDoc.humanReviewed).toBe(false);

      // Audit trail check
      const events = TaxGuardAuditService.getLogs().filter(e => e.recordId === stagedDoc.documentId);
      expect(events.some(e => e.action === 'DOCUMENT_STAGED')).toBe(true);
    });

    it('prevents direct cross-client access in staged documents repository (Tenant Isolation)', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 sample payload');

      await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_alpha',
        engagementId: 'ENG-2024-ALPHA',
        taxYear: 2024,
        uploader: 'Alpha User',
        originalFilename: 'alpha_w2.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });

      // Client Beta querying should return 0 documents
      const betaDocs = StageTwoIntakeSecurityService.getStagedDocuments('client_beta', 2024, 'client');
      expect(betaDocs.length).toBe(0);

      // Client Alpha querying should return 1 document
      const alphaDocs = StageTwoIntakeSecurityService.getStagedDocuments('client_alpha', 2024, 'client');
      expect(alphaDocs.length).toBe(1);

      // Staff querying should return all documents
      const staffDocs = StageTwoIntakeSecurityService.getStagedDocuments('client_beta', 2024, 'cpa');
      expect(staffDocs.length).toBe(1);
    });
  });

  // ==========================================================================
  // TG-COL-005: FILE SIGNATURE & MIME VALIDATION
  // ==========================================================================
  describe('TG-COL-005 — File Signature / MIME Validation', () => {
    it('accepts genuine magic bytes for PDF, PNG, JPEG, and ZIP', () => {
      // PDF: %PDF- (25 50 44 46 2D)
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      const pdfRes = FileSignatureValidator.validateSignature(pdfBytes, 'return.pdf', 'application/pdf');
      expect(pdfRes.validationResult).toBe('PASSED');
      expect(pdfRes.detectedFileType).toBe('pdf');

      // PNG: 89 50 4E 47 0D 0A 1A 0A
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const pngRes = FileSignatureValidator.validateSignature(pngBytes, 'receipt.png', 'image/png');
      expect(pngRes.validationResult).toBe('PASSED');
      expect(pngRes.detectedFileType).toBe('png');

      // JPEG: FF D8 FF
      const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const jpgRes = FileSignatureValidator.validateSignature(jpgBytes, 'photo.jpg', 'image/jpeg');
      expect(jpgRes.validationResult).toBe('PASSED');
      expect(jpgRes.detectedFileType).toBe('jpg');
    });

    it('rejects and flags file signature mismatches (e.g. executable or text masked as .pdf)', async () => {
      // Claimed .pdf, but contains plain text or random binary without %PDF-
      const fakePdfBytes = new TextEncoder().encode('THIS IS NOT A VALID PDF HEADER AT ALL');
      const sigRes = FileSignatureValidator.validateSignature(fakePdfBytes, 'fraudulent.pdf', 'application/pdf');
      expect(sigRes.validationResult).toBe('MISMATCH');

      // Ingesting should automatically trigger quarantine
      const doc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_test',
        engagementId: 'ENG-2024-TEST',
        taxYear: 2024,
        uploader: 'Test User',
        originalFilename: 'fraudulent.pdf',
        fileBytes: fakePdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Tax Document'
      });

      expect(doc.pipelineStage).toBe('QUARANTINED');
      expect(doc.quarantineStatus).toBe('QUARANTINED');
      expect(doc.isReadyForOcr).toBe(false);
      expect(doc.quarantineReason).toContain('File signature validation failed');
    });

    it('blocks dangerous executable extensions and MZ headers immediately', () => {
      const exeBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ header
      const res1 = FileSignatureValidator.validateSignature(exeBytes, 'installer.exe', 'application/octet-stream');
      expect(res1.validationResult).toBe('SUSPICIOUS');

      const maskedRes = FileSignatureValidator.validateSignature(exeBytes, 'trojan.pdf', 'application/pdf');
      expect(maskedRes.validationResult).toBe('SUSPICIOUS');
    });
  });

  // ==========================================================================
  // TG-COL-006: ARCHIVE & SIZE PROTECTION
  // ==========================================================================
  describe('TG-COL-006 — File Size & Archive Expansion Protection', () => {
    it('detects and blocks file size limit violations (> 50 MB)', async () => {
      const oversizedPayload = new Uint8Array(55 * 1024 * 1024); // 55 MB
      const result = ArchiveProtectionValidator.validateSizeAndArchive(oversizedPayload, 'huge_file.pdf');
      expect(result.validationResult).toBe('VIOLATION');
      expect(result.violationReason).toContain('exceeds maximum authorized limit');
    });

    it('detects zip bomb expansion ratios and blocks nested archives', async () => {
      const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
      
      const zipBombRes = ArchiveProtectionValidator.validateSizeAndArchive(zipBytes, 'ratio_violation_zipbomb.zip');
      expect(zipBombRes.validationResult).toBe('VIOLATION');
      expect(zipBombRes.violationReason).toContain('Zip Bomb anomaly');

      const nestedZipRes = ArchiveProtectionValidator.validateSizeAndArchive(zipBytes, 'nested_zip_attack.zip');
      expect(nestedZipRes.validationResult).toBe('VIOLATION');
      expect(nestedZipRes.violationReason).toContain('nested archive');
    });
  });

  // ==========================================================================
  // TG-COL-007: MALWARE SCANNING ABSTRACTION & DEV SCANNER
  // ==========================================================================
  describe('TG-COL-007 — Malware Scanning', () => {
    it('uses the Simulated/Dev scanner with explicit warning labels and detects clean files', async () => {
      const scanner = new SimulatedDevelopmentMalwareScanner();
      expect(scanner.name).toBe('SIMULATED / DEVELOPMENT SCANNER');
      expect(scanner.isProduction).toBe(false);

      const cleanBytes = new TextEncoder().encode('%PDF-1.4 clean corporate tax records');
      const scanResult = await scanner.scan(cleanBytes, 'normal_doc.pdf');
      expect(scanResult.status).toBe('CLEAN');
      expect(scanResult.scannerName).toBe('SIMULATED / DEVELOPMENT SCANNER');
    });

    it('detects EICAR test signatures and suspicious virus file patterns', async () => {
      const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
      const eicarBytes = new TextEncoder().encode(eicarString);

      const scanner = new SimulatedDevelopmentMalwareScanner();
      const res = await scanner.scan(eicarBytes, 'eicar_test.com');
      expect(res.status).toBe('INFECTED');
      expect(res.details).toContain('EICAR');

      // Infected filename check
      const dummyBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
      const infectedRes = await scanner.scan(dummyBytes, 'trojan_virus_payload.pdf');
      expect(infectedRes.status).toBe('INFECTED');
    });

    it('routes infected or scanning failed files to quarantine', async () => {
      const doc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_malware_test',
        engagementId: 'ENG-2024-SEC',
        taxYear: 2024,
        uploader: 'Test Uploader',
        originalFilename: 'trojan_virus.pdf',
        fileBytes: new TextEncoder().encode('%PDF-1.4 malicious code inside'),
        claimedMimeType: 'application/pdf',
        claimedCategory: 'W-2'
      });

      expect(doc.pipelineStage).toBe('QUARANTINED');
      expect(doc.quarantineStatus).toBe('QUARANTINED');
      expect(doc.malwareScanStatus).toBe('INFECTED');
      expect(doc.isReadyForOcr).toBe(false);
    });
  });

  // ==========================================================================
  // TG-COL-008: QUARANTINE WORKFLOW & ROLE-GATED DISPOSITION
  // ==========================================================================
  describe('TG-COL-008 — Quarantine Workflow', () => {
    it('strictly isolates quarantined documents from normal download and OCR processing', async () => {
      const doc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_quarantine_test',
        engagementId: 'ENG-2024-Q',
        taxYear: 2024,
        uploader: 'Client User',
        originalFilename: 'infected_payroll.pdf',
        fileBytes: new TextEncoder().encode('%PDF-1.4 infected payroll details'),
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Payroll'
      });

      expect(doc.quarantineStatus).toBe('QUARANTINED');
      expect(doc.isReadyForOcr).toBe(false);

      // Attempting to download quarantined document must be denied
      const downloadResult = StageTwoIntakeSecurityService.downloadDocument(
        doc.documentId,
        'client_quarantine_test',
        'client'
      );
      expect(downloadResult.allowed).toBe(false);
      expect(downloadResult.reason).toContain('Quarantined documents are strictly quarantined');
    });

    it('requires authorized roles to release quarantined documents', async () => {
      const doc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_disp_test',
        engagementId: 'ENG-2024-D',
        taxYear: 2024,
        uploader: 'Client User',
        originalFilename: 'infected_test.pdf',
        fileBytes: new TextEncoder().encode('%PDF-1.4 payload'),
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Audit'
      });

      // Preparer or Client cannot clear quarantine
      expect(() => {
        StageTwoIntakeSecurityService.dispositionQuarantinedDocument({
          documentId: doc.documentId,
          actor: 'Junior Preparer',
          actorRole: 'preparer',
          disposition: 'CLEARED',
          reason: 'Looks fine to me'
        });
      }).toThrow(/Unauthorized: Role "preparer" is not authorized/);

      // CPA or Compliance Officer CAN clear quarantine with justification
      const clearedDoc = StageTwoIntakeSecurityService.dispositionQuarantinedDocument({
        documentId: doc.documentId,
        actor: 'Jane CPA (Lead Reviewer)',
        actorRole: 'cpa',
        disposition: 'CLEARED',
        reason: 'Confirmed false positive signature after sandbox analysis.'
      });

      expect(clearedDoc.quarantineStatus).toBe('CLEARED');
      expect(clearedDoc.quarantineDisposition?.disposition).toBe('CLEARED');
      expect(clearedDoc.quarantineDisposition?.actor).toBe('Jane CPA (Lead Reviewer)');

      // Audit trail must record the disposition
      const events = TaxGuardAuditService.getLogs().filter(e => e.recordId === doc.documentId);
      expect(events.some(e => e.action === 'DOCUMENT_SECURITY_CLEARED')).toBe(true);
    });
  });

  // ==========================================================================
  // TG-COL-009: DOCUMENT ENCRYPTION (AES-256-GCM)
  // ==========================================================================
  describe('TG-COL-009 — Document Encryption', () => {
    it('encrypts file payloads with AES-256-GCM and stores cryptographic metadata separately', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 encrypted tax schedule K-1');

      const doc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_crypto',
        engagementId: 'ENG-2024-CRYPTO',
        taxYear: 2024,
        uploader: 'Partner',
        originalFilename: 'schedule_k1.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Schedule K-1'
      });

      expect(doc.encryptionStatus).toBe('COMPLETE');
      expect(doc.encryptionMetadata).toBeDefined();
      expect(doc.encryptionMetadata?.algorithm).toBe('AES-256-GCM');
      expect(doc.encryptionMetadata?.keyId).toMatch(/kms\/taxguard/);
      expect(doc.encryptionMetadata?.iv).toBeDefined();
      expect(doc.encryptionMetadata?.encryptedBytesLength).toBeGreaterThanOrEqual(pdfBytes.length);

      // Verify audit event
      const events = TaxGuardAuditService.getLogs().filter(e => e.recordId === doc.documentId);
      expect(events.some(e => e.action === 'DOCUMENT_ENCRYPTED')).toBe(true);
    });
  });

  // ==========================================================================
  // TG-COL-010: SHA-256 INTEGRITY REGISTRY
  // ==========================================================================
  describe('TG-COL-010 — SHA-256 Integrity Registry', () => {
    it('computes initial SHA-256 hash and verifies stored object integrity', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 integrity certified document');

      const doc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_hash',
        engagementId: 'ENG-2024-HASH',
        taxYear: 2024,
        uploader: 'Client User',
        originalFilename: 'bank_statement.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Bank Statement'
      });

      expect(doc.integrityRecord).toBeDefined();
      expect(doc.integrityRecord.integrityVerificationStatus).toBe('VERIFIED');
      expect(doc.integrityRecord.originalHash).toBe(doc.integrityRecord.storedObjectHash);
      expect(doc.integrityRecord.originalHash).toBeDefined();
    });
  });

  // ==========================================================================
  // TG-COL-011: ORIGINAL DOCUMENT PRESERVATION & VERSIONING
  // ==========================================================================
  describe('TG-COL-011 — Original Document Preservation & Versioning', () => {
    it('retains original documents when superseded, incrementing version and preserving audit trails', async () => {
      const v1Bytes = new TextEncoder().encode('%PDF-1.4 version 1 draft of 1099-NEC');

      const docV1 = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_vers',
        engagementId: 'ENG-2024-V',
        taxYear: 2024,
        uploader: 'Client Accountant',
        originalFilename: 'form_1099_nec.pdf',
        fileBytes: v1Bytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: '1099-NEC'
      });

      expect(docV1.provenance.versionNumber).toBe(1);
      expect(docV1.provenance.isCurrentActiveVersion).toBe(true);

      // Now client uploads corrected replacement
      const v2Bytes = new TextEncoder().encode('%PDF-1.4 version 2 corrected 1099-NEC');

      const docV2 = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_vers',
        engagementId: 'ENG-2024-V',
        taxYear: 2024,
        uploader: 'Client Accountant',
        originalFilename: 'form_1099_nec_corrected.pdf',
        fileBytes: v2Bytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: '1099-NEC',
        existingDocIdToSupersede: docV1.documentId,
        supersedeReason: 'Corrected non-employee compensation box 1'
      });

      // V2 Verification
      expect(docV2.provenance.versionNumber).toBe(2);
      expect(docV2.provenance.supersedesDocId).toBe(docV1.documentId);
      expect(docV2.provenance.isCurrentActiveVersion).toBe(true);

      // V1 Preservation Check: Original is retained, NOT deleted or overwritten
      expect(docV1.provenance.isCurrentActiveVersion).toBe(false);
      expect(docV1.provenance.supersededByDocId).toBe(docV2.documentId);
      expect(docV1.provenance.supersededReason).toContain('box 1');

      // Audit event
      const events = TaxGuardAuditService.getLogs().filter(e => e.recordId === docV1.documentId);
      expect(events.some(e => e.action === 'DOCUMENT_SUPERSEDED')).toBe(true);
    });
  });

  // ==========================================================================
  // PIPELINE STATE MACHINE & INVARIANTS INTEGRATION
  // ==========================================================================
  describe('Pipeline State Machine & Invariant Boundaries', () => {
    it('completes the full security pipeline and unlocks READY_FOR_OCR only when all gates pass', async () => {
      const pdfBytes = new TextEncoder().encode('%PDF-1.4 fully compliant tax schedule');

      const doc = await StageTwoIntakeSecurityService.executeIntakeSecurityPipeline({
        clientId: 'client_full_pipeline',
        engagementId: 'ENG-2024-FULL',
        taxYear: 2024,
        uploader: 'Client User',
        originalFilename: 'corporate_schedule_l.pdf',
        fileBytes: pdfBytes,
        claimedMimeType: 'application/pdf',
        claimedCategory: 'Balance Sheet'
      });

      // Final Pipeline Stage
      expect(doc.pipelineStage).toBe('READY_FOR_OCR');
      expect(doc.isReadyForOcr).toBe(true);

      // Strict Invariants
      expect(doc.isVerified).toBe(false);
      expect(doc.taxDataVerified).toBe(false);
      expect(doc.humanReviewed).toBe(false);

      // Verify sequence of audit events
      const events = TaxGuardAuditService.getLogs().filter(e => e.recordId === doc.documentId);
      const actions = events.map(e => e.action);

      expect(actions).toContain('DOCUMENT_STAGED');
      expect(actions).toContain('FILE_TYPE_VALIDATED');
      expect(actions).toContain('MALWARE_SCAN_COMPLETED');
      expect(actions).toContain('DOCUMENT_SECURITY_CLEARED');
      expect(actions).toContain('DOCUMENT_ENCRYPTED');
      expect(actions).toContain('DOCUMENT_INTEGRITY_VERIFIED');
      expect(actions).toContain('DOCUMENT_STORED');
    });

    it('works seamlessly through StageTwoCollectionService.ingestDocumentUpload', async () => {
      const upload = await StageTwoCollectionService.ingestDocumentUpload({
        clientId: 'client_service_integration',
        engagementId: 'ENG-2024-INT',
        taxYear: 2024,
        uploadedBy: 'Client Admin',
        originalFileName: 'w2_wage_statement.pdf',
        fileSizeBytes: 2048,
        mimeType: 'application/pdf',
        claimedCategory: 'Form W-2'
      });

      expect(upload.documentId).toMatch(/^DOC-2024-\d{5}$/);
      expect(upload.isVerified).toBe(false);
      expect(upload.securityCheckStatus).toBe('Passed (SHA-256 Validated)');
      expect(upload.pipelineStage).toBe('READY_FOR_OCR');
      expect(upload.isReadyForOcr).toBe(true);
      expect(upload.stagedSecurityDoc).toBeDefined();
    });
  });
});
