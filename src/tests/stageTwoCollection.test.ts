/**
 * A/R Tax Services, LLC - Automated Test Suite
 * Milestone M2 / Stage 02: Collect — Sprint 1
 *
 * Verification of:
 * - TG-COL-001: Centralized Tax-Year Collection Workspace Context (Client ID + Engagement + Tax Year + Entity/Return Type)
 * - TG-COL-002: Dynamic Rules-Driven Required Document Checklist with Stable IDs & 10 Document Requirement Statuses
 * - TG-COL-003: Secure Upload Center Integration with Unique Document IDs, SHA-256 Hashing, & Audit Logging
 * - Strict Security Invariant: Documents are NEVER treated as verified simply because upload succeeded (isVerified === false)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StageTwoCollectionService,
  CollectionDocumentStatus,
  EntityReturnType
} from '../services/stageTwoCollectionService';
import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';

describe('Milestone M2 / Stage 02: Collect — Sprint 1 Verification', () => {
  beforeEach(() => {
    StageTwoCollectionService.resetCollectionForTesting();
  });

  describe('TG-COL-001: Tax-Year Collection Workspace', () => {
    it('initializes centralized workspace organized around Client ID + Engagement + Tax Year + Entity/Return Type', () => {
      const context = StageTwoCollectionService.getWorkspaceContext('cli_perotti', 2025);

      expect(context).toBeDefined();
      expect(context.clientId).toBe('cli_perotti');
      expect(context.taxYear).toBe(2025);
      expect(context.engagementId).toBeDefined();
      expect(context.entityType).toBeDefined();
      expect(context.returnType).toBeDefined();
      expect(context.entityName).toBeDefined();
      expect(Array.isArray(context.jurisdictions)).toBe(true);
      expect(context.jurisdictions.length).toBeGreaterThan(0);
    });

    it('adapts context dynamically when tax year changes', () => {
      const context2024 = StageTwoCollectionService.getWorkspaceContext('cli_perotti', 2024);
      const context2025 = StageTwoCollectionService.getWorkspaceContext('cli_perotti', 2025);

      expect(context2024.taxYear).toBe(2024);
      expect(context2025.taxYear).toBe(2025);
    });

    it('correctly maps return types based on entity classification', () => {
      // S-Corp
      const scorpReqs = StageTwoCollectionService.generateRulesDrivenRequirements(
        'CLT-SCORP-01',
        2025,
        's_corp',
        'SC'
      );
      expect(scorpReqs.some(r => r.formNumber.includes('1120-S'))).toBe(true);

      // C-Corp
      const ccorpReqs = StageTwoCollectionService.generateRulesDrivenRequirements(
        'CLT-CCORP-01',
        2025,
        'c_corp',
        'SC'
      );
      expect(ccorpReqs.some(r => r.formNumber.includes('1120'))).toBe(true);

      // Partnership
      const partReqs = StageTwoCollectionService.generateRulesDrivenRequirements(
        'CLT-PART-01',
        2025,
        'partnership',
        'SC'
      );
      expect(partReqs.some(r => r.formNumber.includes('1065'))).toBe(true);
    });
  });

  describe('TG-COL-002: Dynamic Required Document Checklist', () => {
    it('generates requirements with stable requirement IDs linked to Client ID and Tax Year', () => {
      const reqs = StageTwoCollectionService.getRequirements('cli_test_indiv', 2025);

      expect(reqs.length).toBeGreaterThan(0);
      reqs.forEach(r => {
        expect(r.requirementId).toBeDefined();
        expect(r.requirementId.startsWith('REQ-2025-')).toBe(true);
        expect(r.clientId).toBe('cli_test_indiv');
        expect(r.taxYear).toBe(2025);
        expect(r.title).toBeDefined();
        expect(r.category).toBeDefined();
        expect(r.status).toBe('Required');
      });
    });

    it('enforces S-Corporation specific compliance requirements', () => {
      const scorpReqs = StageTwoCollectionService.generateRulesDrivenRequirements(
        'CLT-SCORP-TEST',
        2025,
        's_corp',
        'SC'
      );

      // Must include Prior Year Return
      expect(scorpReqs.some(r => r.requirementId.includes('PY-RETURN'))).toBe(true);
      // Must include Trial Balance / General Ledger
      expect(scorpReqs.some(r => r.requirementId.includes('TB-GL'))).toBe(true);
      // Must include Bank Reconciliations
      expect(scorpReqs.some(r => r.requirementId.includes('BANK-RECON'))).toBe(true);
      // Must include Payroll Reports (Form 941/940) for Shareholder Reasonable Comp
      expect(scorpReqs.some(r => r.requirementId.includes('PAYROLL-941'))).toBe(true);
      // Must include Shareholder Basis Worksheets
      expect(scorpReqs.some(r => r.requirementId.includes('SHAREHOLDER-BASIS'))).toBe(true);
      // Must include South Carolina State Depreciation Decoupling
      expect(scorpReqs.some(r => r.requirementId.includes('SC-DEPR-DECOUPLE'))).toBe(true);
    });

    it('supports all 10 standard document requirement statuses', () => {
      const allStatuses: CollectionDocumentStatus[] = [
        'Required',
        'Requested',
        'Received',
        'Processing',
        'Under Review',
        'Accepted',
        'Rejected',
        'Missing',
        'Superseded',
        'Not Applicable'
      ];

      const reqs = StageTwoCollectionService.getRequirements('cli_status_test', 2025);
      const testReq = reqs[0];

      allStatuses.forEach(status => {
        const updated = StageTwoCollectionService.updateRequirementStatus(
          'cli_status_test',
          2025,
          testReq.requirementId,
          status,
          'accountant',
          `Testing status ${status}`
        );
        expect(updated).toBeDefined();
        expect(updated?.status).toBe(status);
      });
    });
  });

  describe('TG-COL-003: Secure Upload Center Integration', () => {
    it('generates a unique Document ID formatted as DOC-YYYY-XXXXX on upload', async () => {
      const uploaded = await StageTwoCollectionService.ingestDocumentUpload({
        clientId: 'cli_perotti',
        engagementId: 'ENG-2025-001',
        taxYear: 2025,
        uploadedBy: 'Client User',
        originalFileName: '2025_W2_Statement.pdf',
        fileSizeBytes: 1048576,
        mimeType: 'application/pdf',
        claimedCategory: 'Employment'
      });

      expect(uploaded.documentId).toMatch(/^DOC-2025-\d{5}$/);
      expect(uploaded.originalFileName).toBe('2025_W2_Statement.pdf');
      expect(uploaded.fileSizeBytes).toBe(1048576);
      expect(uploaded.claimedCategory).toBe('Employment');
      expect(uploaded.uploadTimestamp).toBeDefined();
    });

    it('STRICT SECURITY INVARIANT: uploaded documents are NEVER treated as verified simply because upload succeeded', async () => {
      const uploaded = await StageTwoCollectionService.ingestDocumentUpload({
        clientId: 'cli_perotti',
        engagementId: 'ENG-2025-001',
        taxYear: 2025,
        uploadedBy: 'Client User',
        originalFileName: 'bank_statement_december.pdf',
        fileSizeBytes: 524288,
        mimeType: 'application/pdf',
        claimedCategory: 'Banking & Cash'
      });

      // Spec Requirement: isVerified MUST be false
      expect(uploaded.isVerified).toBe(false);
      // Status is Received, not Accepted
      expect(uploaded.processingStatus).toBe('Received');
    });

    it('records valid SHA-256 hash and logs an immutable audit event', async () => {
      const initialLogsCount = TaxGuardAuditService.getLogs().length;

      const uploaded = await StageTwoCollectionService.ingestDocumentUpload({
        clientId: 'cli_audit_test',
        engagementId: 'ENG-2025-AUDIT',
        taxYear: 2025,
        uploadedBy: 'Audited Taxpayer',
        originalFileName: '1099_DIV_Fidelity.pdf',
        fileSizeBytes: 245000,
        mimeType: 'application/pdf',
        claimedCategory: 'Dividends',
        sha256Hash: 'a6c5f4b23d91789c629810fed9372138a4bc10982341908234abcedf87654321'
      });

      expect(uploaded.sha256Hash).toBe('a6c5f4b23d91789c629810fed9372138a4bc10982341908234abcedf87654321');

      // Check audit log
      const logs = TaxGuardAuditService.getLogs();
      expect(logs.length).toBeGreaterThan(initialLogsCount);
      const docLog = logs.find(l => l.recordId === uploaded.documentId && l.action === 'DOCUMENT_UPLOAD_INGESTED');
      expect(docLog).toBeDefined();
      expect(docLog?.action).toBe('DOCUMENT_UPLOAD_INGESTED');
      expect(docLog?.recordType).toBe('document');
      expect(docLog?.result).toBe('success');
    });

    it('associates uploaded document with a requirement and updates requirement status to Received', async () => {
      const reqs = StageTwoCollectionService.getRequirements('cli_assoc_test', 2025);
      const targetReq = reqs[0];
      expect(targetReq.status).toBe('Required');

      const uploaded = await StageTwoCollectionService.ingestDocumentUpload({
        clientId: 'cli_assoc_test',
        engagementId: 'ENG-2025-001',
        taxYear: 2025,
        uploadedBy: 'Client User',
        originalFileName: 'w2_associated.pdf',
        fileSizeBytes: 120000,
        mimeType: 'application/pdf',
        claimedCategory: targetReq.category,
        associatedRequirementId: targetReq.requirementId
      });

      expect(uploaded.associatedRequirementId).toBe(targetReq.requirementId);

      const refreshedReqs = StageTwoCollectionService.getRequirements('cli_assoc_test', 2025);
      const updatedReq = refreshedReqs.find(r => r.requirementId === targetReq.requirementId);
      expect(updatedReq?.status).toBe('Received');
      expect(updatedReq?.associatedDocumentId).toBe(uploaded.documentId);
    });
  });

  describe('Collection Readiness & Exit Gate Evaluation', () => {
    it('evaluates readiness scorecard and identifies blocking items for Stage 02 gate', () => {
      const readiness = StageTwoCollectionService.evaluateCollectionReadiness('cli_readiness_test', 2025);

      expect(readiness.totalRequirements).toBeGreaterThan(0);
      expect(readiness.requiredCount).toBeGreaterThan(0);
      expect(readiness.readinessScore).toBeGreaterThanOrEqual(0);
      expect(readiness.readinessScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(readiness.blockingItems)).toBe(true);
      expect(readiness.stageTwoGateStatus).toBeDefined();
    });
  });
});
