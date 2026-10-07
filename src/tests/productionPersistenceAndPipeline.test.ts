import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxGuardAuthorityRepository, casePath, type VerifiedMalwareScanResult } from '../server/taxguard/authority.repository';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
import { ProviderReadinessRegistry } from '../server/taxguard/providerReadiness.service';
import { ProductionOcrAdapter, TaxGuardOcrProvider, validateProvenance } from '../server/taxguard/ocrProvider';
import { ServerStageGateOrchestrator } from '../server/taxguard/serverStageGateOrchestrator';
import { StageNumber } from '../server/taxguard/persistence.types';

const scope = {
  tenantId: 'tenant_alpha',
  clientId: 'client_001',
  engagementId: 'eng_2025',
  taxYear: 2025,
};

let db: TransactionalFirestore;
let repo: TaxGuardAuthorityRepository;

beforeEach(async () => {
  ProviderReadinessRegistry.setTestingOverrides(undefined);
  db = new TransactionalFirestore();

  const members = {
    admin: { role: 'administrator', status: 'active' },
    client_user: { role: 'client', status: 'active', clientId: 'client_001' },
    preparer: { role: 'accountant', status: 'active' },
    reviewer: {
      role: 'reviewer',
      status: 'active',
      credentialVerified: true,
      credentialType: 'CPA',
      credentialExpiresAt: '2099-12-31',
    },
  };

  for (const [uid, member] of Object.entries(members)) {
    db.records.set(`taxguardTenants/tenant_alpha/members/${uid}`, member);
  }
  db.records.set('taxguardTenants/tenant_alpha/clients/client_001', { ownerUid: 'client_user' });
  db.records.set('taxguardTenants/tenant_alpha/clients/client_001/engagements/eng_2025', {
    clientId: 'client_001',
    taxYears: [2025],
  });

  repo = new TaxGuardAuthorityRepository(db as any);
  await repo.createCase(scope, 'admin', {
    clientUid: 'client_user',
    preparerUid: 'preparer',
    reviewerUid: 'reviewer',
  });
});

describe('M18.4 Production Persistence & Canonical Tax Case', () => {
  it('initializes canonical TaxCase with version 1, active status and all 18 stage states', async () => {
    const taxCase = await repo.getCase(scope, 'client_user');
    expect(taxCase).toMatchObject({
      tenantId: 'tenant_alpha',
      clientId: 'client_001',
      engagementId: 'eng_2025',
      taxYear: 2025,
      status: 'ACTIVE',
      activeStage: 1,
      version: 1,
      openExceptions: 0,
      externalSubmissionEnabled: false,
    });

    const stages = await repo.getCaseStageStates(scope, 'preparer');
    expect(stages).toHaveLength(18);
    expect(stages[0]).toMatchObject({ stage: 1, stageName: 'ONBOARD', status: 'IN_PROGRESS' });
    expect(stages[1]).toMatchObject({ stage: 2, stageName: 'COLLECT', status: 'LOCKED' });
    expect(stages[17]).toMatchObject({ stage: 18, stageName: 'REPEAT', status: 'LOCKED' });
  });

  it('prevents prohibited duplicate active cases for the same tenant, client, engagement, and taxYear', async () => {
    await expect(
      repo.createCase(scope, 'admin', {
        clientUid: 'client_user',
        preparerUid: 'preparer',
        reviewerUid: 'reviewer',
      })
    ).rejects.toThrow('CASE_EXISTS');
  });

  it('enforces multi-tenant, client and engagement isolation', async () => {
    await expect(repo.getCase({ ...scope, tenantId: 'tenant_other' }, 'client_user')).rejects.toThrow('CASE_ACCESS_DENIED');
    await expect(repo.getCase({ ...scope, clientId: 'client_other' }, 'client_user')).rejects.toThrow('CASE_ACCESS_DENIED');
    await expect(repo.getCase({ ...scope, engagementId: 'eng_other' }, 'client_user')).rejects.toThrow('CASE_ACCESS_DENIED');
    await expect(repo.getCase({ ...scope, taxYear: 2024 }, 'client_user')).rejects.toThrow('CASE_ACCESS_DENIED');
  });

  it('enforces optimistic concurrency and rejects stale version updates with VERSION_CONFLICT', async () => {
    // Current version is 1. Updating with version 1 succeeds and moves version to 2.
    await repo.updateCase(scope, 'preparer', 1, 'op_upd_1', { notes: 'Initial intake notes' });
    const updated = await repo.getCase(scope, 'preparer');
    expect(updated.version).toBe(2);

    // Concurrent/stale browser submits outdated version 1 -> Must reject with VERSION_CONFLICT
    await expect(
      repo.updateCase(scope, 'preparer', 1, 'op_upd_stale', { notes: 'Conflicting overwrite' })
    ).rejects.toThrow('VERSION_CONFLICT');
  });

  it('lists active cases for engagement with role and scope enforcement', async () => {
    const cases = await repo.listCases(
      { tenantId: 'tenant_alpha', clientId: 'client_001', engagementId: 'eng_2025' },
      'preparer'
    );
    expect(cases).toHaveLength(1);
    expect(cases[0].taxYear).toBe(2025);
    expect(cases[0].status).toBe('ACTIVE');

    // Denied for wrong client
    await expect(
      repo.listCases(
        { tenantId: 'tenant_alpha', clientId: 'client_other', engagementId: 'eng_2025' },
        'client_user'
      )
    ).rejects.toThrow('CASE_ACCESS_DENIED');
  });

  it('supports canonical case status transitions: block, reopen, archive, activate', async () => {
    // 1. Block case
    await repo.blockCase(scope, 'preparer', 1, 'op_block_case', 'IRS identity verification flag');
    let c = await repo.getCase(scope, 'preparer');
    expect(c.status).toBe('BLOCKED');
    expect(c.version).toBe(2);

    // 2. Reopen case
    await repo.reopenCase(scope, 'preparer', 2, 'op_reopen_case');
    c = await repo.getCase(scope, 'preparer');
    expect(c.status).toBe('ACTIVE');
    expect(c.version).toBe(3);

    // 3. Preparer cannot archive case
    await expect(
      repo.archiveCase(scope, 'preparer', 3, 'op_archive_fail')
    ).rejects.toThrow('AUTHORIZATION_DENIED');

    // Reviewer archives case
    await repo.archiveCase(scope, 'reviewer', 3, 'op_archive_case');
    c = await repo.getCase(scope, 'reviewer');
    expect(c.status).toBe('ARCHIVED');
    expect(c.version).toBe(4);

    // 4. Activate case
    await repo.activateCase(scope, 'reviewer', 4, 'op_activate_case');
    c = await repo.getCase(scope, 'reviewer');
    expect(c.status).toBe('ACTIVE');
    expect(c.version).toBe(5);
  });
});

describe('M18.4 Persistent 18-Stage Engine & Transitions', () => {
  it('evaluates Stage 01 requirements and marks stage passing', async () => {
    await repo.evaluateStage(scope, 'preparer', 1, 'eval_s1', 1, {
      hardExitGatePassed: true,
      identityComplete: true,
      taxProfileComplete: true,
      consentComplete: true,
      reviewComplete: true,
    });

    const s1 = await repo.getStageState(scope, 'preparer', 1);
    expect(s1.requirementsMet).toBe(true);
    expect(s1.status).toBe('READY');
  });

  it('rejects non-sequential stage transition attempts with INVALID_STATE_TRANSITION', async () => {
    // Attempting to jump directly from Stage 1 to Stage 3
    await expect(
      repo.requestStageTransition(scope, 'preparer', 1, 'trans_jump', 1, 3 as StageNumber)
    ).rejects.toThrow('INVALID_STATE_TRANSITION');
  });

  it('prevents stage advancement when open blocking exceptions exist', async () => {
    await repo.recordException(scope, 'preparer', 1, 'ex_block', 'UNVERIFIED_SSN');
    const caseData = await repo.getCase(scope, 'preparer');
    expect(caseData.openExceptions).toBe(1);

    await expect(
      repo.requestStageTransition(scope, 'preparer', 2, 'trans_req_fail', 1, 2)
    ).rejects.toThrow('UNRESOLVED_EXCEPTION');
  });

  it('enforces maker-checker dual signoff on stage transitions', async () => {
    // Preparer evaluates Stage 1
    await repo.evaluateStage(scope, 'preparer', 1, 'eval_s1_pass', 1, {
      hardExitGatePassed: true,
      identityComplete: true,
      taxProfileComplete: true,
      consentComplete: true,
      reviewComplete: true,
    });

    // Record review approval by independent CPA reviewer
    const evidence = {
      evidencePackage: {
        evidencePackageId: 'ev_s1',
        clientId: 'client_001',
        engagementId: 'eng_2025',
        taxYear: 2025,
        knowledgeSourceIds: ['src1'],
        ruleEvaluationIds: ['rule1'],
        findingIds: ['f1'],
        aiProposalIds: [],
        requiresHumanReview: true as const,
        correlationId: 'corr_1',
        createdAt: '2026-01-01',
      },
      sourceSha256: 'c'.repeat(64),
      sourceDocumentIds: ['doc1'],
    };
    await repo.recordEvidence(scope, 'preparer', 2, 'ev_op_1', evidence);
    await repo.recordReview(scope, 'reviewer', 3, 'appr_s1', 'ev_s1', 'APPROVED');

    // Preparer cannot approve the transition
    await expect(
      repo.approveStageTransition(scope, 'preparer', 4, 'appr_illegal', 1, 2, 'appr_s1')
    ).rejects.toThrow('INDEPENDENT_PROFESSIONAL_REQUIRED');

    // Independent CPA reviewer approves transition
    await repo.approveStageTransition(scope, 'reviewer', 4, 'appr_legal', 1, 2, 'appr_s1');

    const s1 = await repo.getStageState(scope, 'preparer', 1);
    const s2 = await repo.getStageState(scope, 'preparer', 2);
    expect(s1.status).toBe('COMPLETE');
    expect(s2.status).toBe('IN_PROGRESS');

    const c = await repo.getCase(scope, 'preparer');
    expect(c.activeStage).toBe(2);
  });

  it('locks Stage 04 until Stage 03 requirements pass', () => {
    expect(ServerStageGateOrchestrator.isStageFourUnlocked({ requirementsMet: false, status: 'IN_PROGRESS' })).toBe(false);
    expect(ServerStageGateOrchestrator.isStageFourUnlocked({ requirementsMet: true, status: 'READY' })).toBe(false);
    expect(ServerStageGateOrchestrator.isStageFourUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });

  it('supports blocking, reopening, and downstream invalidation', async () => {
    // Block stage 1
    await repo.blockStage(scope, 'preparer', 1, 'blk_1', 1, 'Missing identity documentation');
    let s1 = await repo.getStageState(scope, 'preparer', 1);
    expect(s1.status).toBe('BLOCKED');
    expect(s1.blockedReason).toBe('Missing identity documentation');

    // Reopen stage 1
    await repo.reopenStage(scope, 'preparer', 2, 'reopen_1', 1);
    s1 = await repo.getStageState(scope, 'preparer', 1);
    expect(s1.status).toBe('IN_PROGRESS');

    // Invalidate downstream stages
    await repo.invalidateDownstreamStages(scope, 'reviewer', 3, 'inval_1', 1, 'Material prior year tax revision');
    const path = casePath(scope);
    expect(db.records.has(`${path}/invalidations/inval_1`)).toBe(true);
  });
});

describe('M18.5 Secure Production Document Pipeline', () => {
  const sampleDoc = {
    id: 'doc_1040_w2',
    fileName: 'Client_W2_2025.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 102400,
    sha256: 'd'.repeat(64),
  };

  it('registers document into quarantine with PENDING_MALWARE_SCAN status', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_doc_1', sampleDoc);
    const doc = await repo.getDocument(scope, 'preparer', 'doc_1040_w2');
    expect(doc.status).toBe('QUARANTINED');
    expect(doc.quarantineReason).toBe('PENDING_MALWARE_SCAN');
    expect(doc.sha256).toBe('d'.repeat(64));
  });

  it('fails closed when malware scanner is unconfigured and keeps document quarantined', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_doc_2', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'NOT_CONFIGURED' });

    await expect(
      repo.scanDocument(scope, 'preparer', 2, 'scan_fail', 'doc_1040_w2')
    ).rejects.toThrow('SCANNER_UNAVAILABLE');

    const doc = await repo.getDocument(scope, 'preparer', 'doc_1040_w2');
    expect(doc.status).toBe('QUARANTINED');
  });

  it('permits controlled release only after clean malware scan by verified reviewer', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_doc_3', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED' });
    const scanner = {
      scan: vi.fn(async () => ({
        clean: true,
        verified: true,
        scanner: 'INJECTED_TEST_SCANNER',
        scannerVersion: 'test-1',
        scannedAt: new Date().toISOString()
      }))
    };
    repo = new TaxGuardAuthorityRepository(db as any, scanner);

    await repo.scanDocument(scope, 'preparer', 2, 'scan_ok', 'doc_1040_w2');

    // Preparer cannot release document
    await expect(
      repo.releaseDocument(scope, 'preparer', 3, 'rel_illegal', 'doc_1040_w2')
    ).rejects.toThrow('INDEPENDENT_PROFESSIONAL_REQUIRED');

    // CPA Reviewer authorizes release
    await repo.releaseDocument(scope, 'reviewer', 3, 'rel_legal', 'doc_1040_w2');
    const doc = await repo.getDocument(scope, 'reviewer', 'doc_1040_w2');
    expect(doc.status).toBe('RELEASED');
    expect(doc.releaseApprovedBy).toBe('reviewer');
    expect(doc.scanResult).toMatchObject({
      clean: true,
      verified: true,
      scanner: 'INJECTED_TEST_SCANNER',
      scannerVersion: 'test-1'
    });
  });

  it('never releases an unscanned quarantined document', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_unscanned', sampleDoc);
    await expect(
      repo.releaseDocument(scope, 'reviewer', 2, 'release_unscanned', sampleDoc.id)
    ).rejects.toThrow('DOCUMENT_NOT_CLEAN');
    const document = await repo.getDocument(scope, 'reviewer', sampleDoc.id);
    expect(document.status).toBe('QUARANTINED');
    expect(document.scanResult).toBeUndefined();
    expect(document.releaseApprovedBy).toBeUndefined();
  });

  it('fails closed after scanner errors and preserves quarantine status', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_scan_error', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED' });
    repo = new TaxGuardAuthorityRepository(db as any, { scan: vi.fn().mockRejectedValue(new Error('scanner error')) });
    await expect(repo.scanDocument(scope, 'preparer', 2, 'scan_error', sampleDoc.id))
      .rejects.toThrow('SCANNER_FAILED');
    expect((await repo.getDocument(scope, 'preparer', sampleDoc.id)).status).toBe('QUARANTINED');
  });

  it('fails closed after scanner timeouts and preserves quarantine status', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_scan_timeout', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED' });
    repo = new TaxGuardAuthorityRepository(db as any, {
      scan: vi.fn(() => new Promise<VerifiedMalwareScanResult>(() => {}))
    }, 1);
    await expect(repo.scanDocument(scope, 'preparer', 2, 'scan_timeout', sampleDoc.id))
      .rejects.toThrow('SCANNER_FAILED');
    expect((await repo.getDocument(scope, 'preparer', sampleDoc.id)).status).toBe('QUARANTINED');
  });

  it('rejects malformed or unverified scanner responses without changing quarantine', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_scan_invalid', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED' });
    repo = new TaxGuardAuthorityRepository(db as any, {
      scan: vi.fn(async () => ({
        clean: true,
        verified: false,
        scanner: '',
        scannerVersion: '',
        scannedAt: 'invalid'
      }))
    });
    await expect(repo.scanDocument(scope, 'preparer', 2, 'scan_invalid', sampleDoc.id))
      .rejects.toThrow('SCANNER_RESPONSE_INVALID');
    expect((await repo.getDocument(scope, 'preparer', sampleDoc.id)).status).toBe('QUARANTINED');
  });

  it('rejects infected documents and never releases them', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_scan_infected', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED' });
    repo = new TaxGuardAuthorityRepository(db as any, {
      scan: vi.fn(async () => ({
        clean: false,
        verified: true,
        scanner: 'INJECTED_TEST_SCANNER',
        scannerVersion: 'test-1',
        scannedAt: new Date().toISOString()
      }))
    });
    await repo.scanDocument(scope, 'preparer', 2, 'scan_infected', sampleDoc.id);
    expect((await repo.getDocument(scope, 'preparer', sampleDoc.id)).status).toBe('REJECTED');
    await expect(repo.releaseDocument(scope, 'reviewer', 3, 'release_infected', sampleDoc.id))
      .rejects.toThrow('DOCUMENT_NOT_CLEAN');
  });

  it('does not permit production to select an injected or readiness-overridden scanner', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_scan_prod', sampleDoc);
    const scan = vi.fn(async () => ({
      clean: true,
      verified: true,
      scanner: 'INJECTED_TEST_SCANNER',
      scannerVersion: 'test-1',
      scannedAt: new Date().toISOString()
    }));
    repo = new TaxGuardAuthorityRepository(db as any, { scan });
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED' });
    vi.stubEnv('NODE_ENV', 'production');
    await expect(repo.scanDocument(scope, 'preparer', 2, 'scan_prod', sampleDoc.id))
      .rejects.toThrow('SCANNER_UNAVAILABLE');
    expect(scan).not.toHaveBeenCalled();
    expect((await repo.getDocument(scope, 'preparer', sampleDoc.id)).status).toBe('QUARANTINED');
    vi.unstubAllEnvs();
  });
});

describe('M18.6 Production OCR & Human Review', () => {
  const sampleDoc = {
    id: 'doc_ocr_target',
    fileName: 'Form_1099_DIV.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 204800,
    sha256: 'e'.repeat(64),
  };
  const injectCleanScanner = () => {
    repo = new TaxGuardAuthorityRepository(db as any, {
      scan: async () => ({
        clean: true,
        verified: true,
        scanner: 'INJECTED_TEST_SCANNER',
        scannerVersion: 'test-1',
        scannedAt: new Date().toISOString()
      })
    });
  };

  it('enforces OCR admission security gate: denies OCR on unreleased document', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_ocr_doc', sampleDoc);
    // Document is still QUARANTINED
    await expect(
      repo.submitOcrJob(scope, 'preparer', 2, 'ocr_admit_fail', 'doc_ocr_target')
    ).rejects.toThrow('DOCUMENT_NOT_RELEASED');
  });

  it('throws OCR_PROVIDER_NOT_CONFIGURED when OCR is unconfigured rather than fabricating results', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_ocr_doc2', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED', OCR: 'NOT_CONFIGURED' });
    injectCleanScanner();
    await repo.scanDocument(scope, 'preparer', 2, 'scan_ok_2', 'doc_ocr_target');
    await repo.releaseDocument(scope, 'reviewer', 3, 'rel_ok_2', 'doc_ocr_target');

    await expect(
      repo.submitOcrJob(scope, 'preparer', 4, 'ocr_job_fail', 'doc_ocr_target')
    ).rejects.toThrow('OCR_PROVIDER_NOT_CONFIGURED');
  });

  it('never uses local heuristic OCR in production, even when an enable flag is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TAXGUARD_OCR_ENABLED', 'true');
    vi.stubEnv('TAXGUARD_OCR_PROVIDER_MODE', 'LOCAL');
    ProviderReadinessRegistry.setTestingOverrides({ OCR: 'CONFIGURED' });
    try {
      await expect(new ProductionOcrAdapter().extract({
        tenantId: scope.tenantId,
        clientId: scope.clientId,
        engagementId: scope.engagementId,
        caseId: 'case_001',
        taxYear: scope.taxYear,
        documentId: 'doc_001',
        fileName: 'return.pdf',
        storagePath: 'vault/doc_001',
        sha256: 'a'.repeat(64),
        mimeType: 'application/pdf'
      })).rejects.toThrow('OCR_PROVIDER_NOT_CONFIGURED');
    } finally {
      vi.unstubAllEnvs();
      ProviderReadinessRegistry.setTestingOverrides(undefined);
    }
  });

  it('maintains isAiProposedOnly: true and provenance invariant on OCR output', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_ocr_doc3', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED' });
    injectCleanScanner();
    await repo.scanDocument(scope, 'preparer', 2, 'scan_ok_3', 'doc_ocr_target');
    await repo.releaseDocument(scope, 'reviewer', 3, 'rel_ok_3', 'doc_ocr_target');

    const mockOcr: TaxGuardOcrProvider = {
      extract: async () => [
        {
          field: 'Box 1a: Total ordinary dividends',
          page: 1,
          proposedValue: 3450.00,
          confidence: 0.97,
          sourceText: 'Total ordinary dividends 3,450.00',
          provider: 'Document-AI',
          providerVersion: 'v1.0',
        },
      ],
    };

    await repo.submitOcrJob(scope, 'preparer', 4, 'ocr_job_ok', 'doc_ocr_target', mockOcr);

    const field = await repo.getExtractedField(scope, 'preparer', 'ocr_job_ok_field_0');
    expect(field.isAiProposedOnly).toBe(true);
    expect(field.proposedValue).toBe(3450.00);
    expect(field.confidence).toBe(0.97);
    expect(field.provenance).toMatchObject({
      tenantId: 'tenant_alpha',
      caseId: 'case_2025',
      documentId: 'doc_ocr_target',
      source: 'Form_1099_DIV.pdf',
      provider: 'Document-AI',
      recordVersion: 1,
    });
  });

  it('enforces human OCR review with ACCEPT, REJECT, and CORRECT actions and updates provenance', async () => {
    await repo.registerDocument(scope, 'preparer', 1, 'reg_ocr_doc4', sampleDoc);
    ProviderReadinessRegistry.setTestingOverrides({ MALWARE_SCANNER: 'CONFIGURED' });
    injectCleanScanner();
    await repo.scanDocument(scope, 'preparer', 2, 'scan_ok_4', 'doc_ocr_target');
    await repo.releaseDocument(scope, 'reviewer', 3, 'rel_ok_4', 'doc_ocr_target');

    const mockOcr: TaxGuardOcrProvider = {
      extract: async () => [
        {
          field: 'Box 1b: Qualified dividends',
          page: 1,
          proposedValue: 2800.00,
          confidence: 0.88,
          provider: 'Document-AI',
          providerVersion: 'v1.0',
        },
      ],
    };
    await repo.submitOcrJob(scope, 'preparer', 4, 'ocr_job_rev', 'doc_ocr_target', mockOcr);

    // 1. Correct the field
    await repo.reviewOcrField(scope, 'reviewer', 5, 'rev_correct_1', 'ocr_job_rev_field_0', {
      action: 'CORRECT',
      correctedValue: 2900.00,
      reason: '1099-DIV addendum shows $2,900.00 qualified amount.',
    });

    let reviewedField = await repo.getExtractedField(scope, 'reviewer', 'ocr_job_rev_field_0');
    expect(reviewedField.humanDecision).toBe('CORRECTED');
    expect(reviewedField.finalAcceptedValue).toBe(2900.00);
    expect(reviewedField.provenance.recordVersion).toBe(2);
    expect(reviewedField.provenance.reviewer).toBe('reviewer');

    // 2. Accept
    await repo.reviewOcrField(scope, 'reviewer', 6, 'rev_accept_1', 'ocr_job_rev_field_0', {
      action: 'ACCEPT',
    });
    reviewedField = await repo.getExtractedField(scope, 'reviewer', 'ocr_job_rev_field_0');
    expect(reviewedField.humanDecision).toBe('ACCEPTED');
  });

  it('fails with MISSING_PROVENANCE when required provenance fields are absent', () => {
    expect(() => validateProvenance(null)).toThrow('MISSING_PROVENANCE');
    expect(() => validateProvenance({})).toThrow('MISSING_PROVENANCE');
    expect(() =>
      validateProvenance({
        tenantId: 'tenant_alpha',
        caseId: 'case_2025',
        // missing documentId, source, provider, etc.
      })
    ).toThrow('MISSING_PROVENANCE');
  });
});

describe('Provider Readiness Registry', () => {
  it('returns truthful states without exposing secret keys or credentials', () => {
    ProviderReadinessRegistry.setTestingOverrides(undefined);
    const statuses = ProviderReadinessRegistry.getAllProviderStatuses();

    expect(statuses.some(p => p.provider === 'DATABASE')).toBe(true);
    expect(statuses.some(p => p.provider === 'MALWARE_SCANNER')).toBe(true);
    expect(statuses.some(p => p.provider === 'OCR')).toBe(true);

    const json = JSON.stringify(statuses);
    expect(json).not.toContain('sk-');
    expect(json).not.toContain('PRIVATE KEY');
    expect(json).not.toContain('AI_KEY');
  });
});
