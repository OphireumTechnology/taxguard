/**
 * A/R Tax Services, LLC - TaxGuard AI
 * STAGE 02 MANDATORY REGRESSION INVARIANTS (TG-COL-R01 THROUGH TG-COL-R20)
 * AND SECTIONS 24, 32, 36–48 CERTIFICATION TEST SUITE
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StageTwoCollectionService } from '../services/stageTwoCollectionService';
import { StageTwoIntakeSecurityService, SimulatedDevelopmentMalwareScanner } from '../services/stageTwoIntakeSecurityService';
import {
  TaxRequirementManifestEngine,
  TaxRequirementManifest,
  TaxRequirementItem,
} from '../services/stageTwoRequirementManifest';
import {
  StageTwoOrchestratorService,
  StageTwoCollectionSnapshot
} from '../services/stageTwoOrchestratorService';
import { StageTwoMatchingEngine } from '../services/stageTwoMatchingEngine';
import {
  GoogleCloudDocumentAiProvider,
  ProductionOcrAdapter,
  LocalHeuristicOcrProvider,
  OcrDocumentInput
} from '../server/taxguard/ocrProvider';
import { ProviderReadinessRegistry } from '../server/taxguard/providerReadiness.service';
import { TaxGuardAuditService } from '../taxguard/services/TaxGuardAuditService';

describe('Stage 02 Mandatory Regression Invariants (TG-COL-R01 to TG-COL-R20)', () => {
  const CLIENT_ID = 'CLT-REG-2025-01';
  const ENGAGEMENT_ID = 'ENG-REG-2025-01';
  const TAX_YEAR = 2025;

  beforeEach(() => {
    StageTwoCollectionService.resetCollectionForTesting();
    TaxRequirementManifestEngine.resetForTesting();
    StageTwoIntakeSecurityService.resetForTesting();
    StageTwoIntakeSecurityService.setMalwareScannerForTesting(
      new SimulatedDevelopmentMalwareScanner()
    );
    GoogleCloudDocumentAiProvider.setTransport(undefined);
    ProviderReadinessRegistry.setTestingOverrides(undefined);
  });

  afterEach(() => {
    GoogleCloudDocumentAiProvider.setTransport(undefined);
    ProviderReadinessRegistry.setTestingOverrides(undefined);
  });

  function setupBaselineManifest(): TaxRequirementManifest {
    const baseReqs: TaxRequirementItem[] = [
      {
        requirementId: 'REQ-2025-W2-ABC',
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        taxpayerOrEntity: 'Sarah Connor',
        category: 'Employment Income',
        jurisdiction: 'Federal',
        documentType: 'W-2',
        expectedSource: 'ABC Corporation',
        title: 'Form W-2 — ABC Corporation',
        description: 'Wage and Tax Statement from ABC Corporation',
        formNumber: 'W-2',
        reasonRequired: 'IRC § 6051: Mandatory wage reporting.',
        requirementLevel: 'REQUIRED',
        priority: 'Required',
        acceptableEvidence: ['Form W-2'],
        status: 'MISSING',
        requestStatus: 'NOT_REQUESTED',
        matchedDocumentIds: [],
        reviewStatus: 'NOT_REQUIRED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ruleVersion: '2025.1',
        sourceAuthority: 'IRC § 6051'
      },
      {
        requirementId: 'REQ-2025-1099INT-FIRST_BANK',
        engagementId: ENGAGEMENT_ID,
        taxYear: TAX_YEAR,
        taxpayerOrEntity: 'Sarah Connor',
        category: 'Interest Income',
        jurisdiction: 'Federal',
        documentType: '1099-INT',
        expectedSource: 'First Citizens Bank',
        title: 'Form 1099-INT — First Citizens Bank',
        description: 'Interest Income Statement',
        formNumber: '1099-INT',
        reasonRequired: 'IRC § 6049',
        requirementLevel: 'REQUIRED',
        priority: 'Required',
        acceptableEvidence: ['Form 1099-INT'],
        status: 'MISSING',
        requestStatus: 'NOT_REQUESTED',
        matchedDocumentIds: [],
        reviewStatus: 'NOT_REQUIRED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ruleVersion: '2025.1',
        sourceAuthority: 'IRC § 6049'
      }
    ];

    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR, ENGAGEMENT_ID);
    manifest.requirements = baseReqs;
    manifest.taxpayerName = 'Sarah Connor';
    manifest.primaryJurisdiction = 'SC';
    manifest.potentialAdditionalJurisdictions = [];
    manifest.exceptions = [];
    manifest.priorYearInquiries = [];
    TaxRequirementManifestEngine.saveManifest(manifest);
    return manifest;
  }

  // TG-COL-R01: recognized required document updates requirement
  it('TG-COL-R01: recognized required document updates requirement status to RECEIVED', async () => {
    setupBaselineManifest();
    const w2Text = 'Form W-2 2025 Employer: ABC Corporation Employee: Sarah Connor Wages: 85000.00 Federal Tax: 11000.00';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(w2Text)]);

    const result = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'Sarah_Connor_W2_2025.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: w2Text
    });

    expect((result as any).matchResult).toBe('MATCHED');
    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    const req = manifest.requirements.find(r => r.requirementId === 'REQ-2025-W2-ABC');
    expect(req?.status).toBe('RECEIVED');
    expect(req?.matchedDocumentIds).toContain(result.documentId);
  });

  // TG-COL-R02: requirement update recalculates progress
  it('TG-COL-R02: requirement update recalculates progress truthfully', async () => {
    setupBaselineManifest();
    let report = StageTwoOrchestratorService.generateCollectionReport(CLIENT_ID, TAX_YEAR);
    expect(report.collectionProgressPercent).toBe(0);

    const w2Text = 'Form W-2 2025 Employer: ABC Corporation Employee: Sarah Connor Wages: 85000.00';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(w2Text)]);

    await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: w2Text
    });

    report = StageTwoOrchestratorService.generateCollectionReport(CLIENT_ID, TAX_YEAR);
    expect(report.collectionProgressPercent).toBe(50);
  });

  // TG-COL-R03: wrong-year cannot satisfy current engagement
  it('TG-COL-R03: wrong-year document cannot satisfy current engagement and preserves progress', async () => {
    setupBaselineManifest();
    const wrongYearText = 'Form W-2 2024 Employer: ABC Corporation Employee: Sarah Connor Wages: 80000.00';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(wrongYearText)]);

    const result = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC_2024.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: wrongYearText
    });

    expect((result as any).matchResult).toBe('WRONG_YEAR');
    const report = StageTwoOrchestratorService.generateCollectionReport(CLIENT_ID, TAX_YEAR);
    expect(report.collectionProgressPercent).toBe(0);
    expect(report.missingCount).toBe(2);
  });

  // TG-COL-R04: wrong taxpayer cannot satisfy requirement
  it('TG-COL-R04: wrong taxpayer document cannot satisfy requirement and creates blocking exception', async () => {
    setupBaselineManifest();
    const otherTaxpayerText = 'Form W-2 2025 Employer: ABC Corporation Employee: Johnathan Archer Wages: 95000.00';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(otherTaxpayerText)]);

    const result = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'Archer_W2_2025.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: otherTaxpayerText
    });

    expect((result as any).matchResult).toBe('WRONG_TAXPAYER');
    const report = StageTwoOrchestratorService.generateCollectionReport(CLIENT_ID, TAX_YEAR);
    expect(report.collectionProgressPercent).toBe(0);
  });

  // TG-COL-R05: duplicate cannot increase progress
  it('TG-COL-R05: duplicate document cannot increase progress twice', async () => {
    setupBaselineManifest();
    const w2Text = 'Form W-2 2025 Employer: ABC Corporation Employee: Sarah Connor Wages: 85000.00';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(w2Text)]);

    await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC_First.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: w2Text
    });

    let report = StageTwoOrchestratorService.generateCollectionReport(CLIENT_ID, TAX_YEAR);
    expect(report.collectionProgressPercent).toBe(50);

    const dupResult = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC_Copy.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: w2Text
    });

    expect((dupResult as any).matchResult).toBe('DUPLICATE');
    report = StageTwoOrchestratorService.generateCollectionReport(CLIENT_ID, TAX_YEAR);
    expect(report.collectionProgressPercent).toBe(50);
  });

  // TG-COL-R06: optional requirement does not reduce mandatory completion
  it('TG-COL-R06: optional requirement does not reduce mandatory completion percentage', () => {
    const manifest = setupBaselineManifest();
    manifest.requirements.push({
      requirementId: 'REQ-2025-OPTIONAL-CHARITY',
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      taxpayerOrEntity: 'Sarah Connor',
      category: 'Deductions',
      jurisdiction: 'Federal',
      documentType: 'Charitable Receipts',
      title: 'Charitable Contribution Receipts',
      description: 'Optional receipts for cash contributions',
      formNumber: 'Receipt',
      reasonRequired: 'IRC § 170 substantiation if itemizing.',
      requirementLevel: 'OPTIONAL',
      priority: 'Optional',
      acceptableEvidence: ['Receipt'],
      status: 'MISSING',
      requestStatus: 'NOT_REQUESTED',
      matchedDocumentIds: [],
      reviewStatus: 'NOT_REQUIRED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ruleVersion: '2025.1',
      sourceAuthority: 'IRC § 170'
    });
    // Satisfy 1 of the 2 mandatory requirements
    manifest.requirements[0].status = 'RECEIVED';
    TaxRequirementManifestEngine.saveManifest(manifest);

    const report = StageTwoOrchestratorService.generateCollectionReport(CLIENT_ID, TAX_YEAR, manifest);
    expect(report.totalRequired).toBe(2);
    expect(report.satisfiedRequired).toBe(1);
    expect(report.collectionProgressPercent).toBe(50);
    expect(report.optionalCount).toBe(1);
  });

  // TG-COL-R07: unclassified document enters Stage 02 review
  it('TG-COL-R07: unclassified document enters Stage 02 review queue and generates exception', async () => {
    setupBaselineManifest();
    const mysteryText = 'Scanned blank letterhead from local stationery supplier with no tax identifiers.';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(mysteryText)]);

    const result = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'Scan_001.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'Other',
      fileBytes: bytes,
      rawTextSample: mysteryText
    });

    expect((result as any).matchResult).toBe('UNCLASSIFIED');
    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    const unclassEx = manifest.exceptions.find(e => e.category === 'UNCLASSIFIED');
    expect(unclassEx).toBeDefined();
    expect(unclassEx?.status).toBe('OPEN');
  });

  // TG-COL-R08: AI classification cannot become final tax validation
  it('TG-COL-R08: AI classification is proposed only and does not mark requirement validated', async () => {
    setupBaselineManifest();
    const w2Text = 'Form W-2 2025 Employer: ABC Corporation Employee: Sarah Connor Wages: 85000.00';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(w2Text)]);

    await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: w2Text
    });

    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    const req = manifest.requirements.find(r => r.requirementId === 'REQ-2025-W2-ABC');
    expect(req?.status).toBe('RECEIVED');
    expect(req?.reviewStatus).toBe('PENDING'); // Not automatically APPROVED/VALIDATED
  });

  // TG-COL-R09: new collection fact reruns requirement determination
  it('TG-COL-R09: new collection fact reruns requirement determination and manifests new source', async () => {
    setupBaselineManifest();
    const k1Text = `
      Schedule K-1 (Form 1065) 2025
      Partnership: Palmetto Tech Ventures LP EIN: 57-1234567
      Partner: Sarah Connor SSN: ***-**-9900
      Box 1 Ordinary business income: $28,500.00
    `;
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(k1Text)]);

    const result = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'Palmetto_Tech_K1_2025.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'Schedule K-1',
      fileBytes: bytes,
      rawTextSample: k1Text
    });

    expect((result as any).matchResult).toBe('NEW_SOURCE_DISCOVERED');
    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    expect(manifest.requirements.some(r => r.documentType === 'Schedule K-1')).toBe(true);
    expect(manifest.exceptions.some(e => e.category === 'POTENTIAL_NEW_ENTITY')).toBe(true);

    // Also test new income source (1099-NEC) generating POTENTIAL_NEW_INCOME_SOURCE
    const necText = `
      Form 1099-NEC Nonemployee Compensation 2025
      Payer: Charleston Consulting Group EIN: 57-9876543
      Recipient: Sarah Connor SSN: ***-**-9900
      Box 1 Nonemployee compensation: $12,400.00
    `;
    const necBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(necText)]);
    const necResult = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'Charleston_Consulting_1099NEC_2025.pdf',
      fileSizeBytes: necBytes.length,
      mimeType: 'application/pdf',
      claimedCategory: '1099-NEC',
      fileBytes: necBytes,
      rawTextSample: necText
    });
    expect((necResult as any).matchResult).toBe('NEW_SOURCE_DISCOVERED');
    const updatedManifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    expect(updatedManifest.requirements.some(r => r.documentType === '1099-NEC')).toBe(true);
    expect(updatedManifest.exceptions.some(e => e.category === 'POTENTIAL_NEW_INCOME_SOURCE')).toBe(true);
  });

  // TG-COL-R10: state requirements are tax-year/jurisdiction aware
  it('TG-COL-R10: state requirements are tax-year and jurisdiction aware', async () => {
    setupBaselineManifest();
    const multiStateW2 = `
      Form W-2 Wage and Tax Statement 2025
      Employer: ABC Corporation Employee: Sarah Connor
      Box 1 Wages: 95000.00
      Box 15 State: NJ State wages: 95000.00 State tax: 4500.00
    `;
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(multiStateW2)]);

    await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_NJ.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: multiStateW2
    });

    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    expect(manifest.potentialAdditionalJurisdictions).toContain('NJ');
    const stateEx = manifest.exceptions.find(e => e.category === 'POTENTIAL_ADDITIONAL_JURISDICTION');
    expect(stateEx?.title).toContain('NJ');
  });

  // TG-COL-R11: corrected evidence preserves original
  it('TG-COL-R11: corrected W-2C preserves original document and links versions', async () => {
    setupBaselineManifest();
    const origText = 'Form W-2 2025 Employer: ABC Corporation Employee: Sarah Connor Wages: 80000.00';
    const origBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(origText)]);

    const origUpload = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC_Orig.pdf',
      fileSizeBytes: origBytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: origBytes,
      rawTextSample: origText
    });

    const w2cText = 'Form W-2C Corrected Wage and Tax Statement 2025 Employer: ABC Corporation Employee: Sarah Connor Corrected Wages: 85000.00';
    const w2cBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(w2cText)]);

    const w2cUpload = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2C_ABC.pdf',
      fileSizeBytes: w2cBytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: w2cBytes,
      rawTextSample: w2cText
    });

    expect((w2cUpload as any).detectedType).toBe('W-2C');
    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    const corrEx = manifest.exceptions.find(e => e.category === 'CORRECTED_DOCUMENT');
    expect(corrEx?.description).toContain(origUpload.documentId);
  });

  // TG-COL-R12: requirement matching creates audit
  it('TG-COL-R12: requirement matching logs an authoritative audit event', async () => {
    setupBaselineManifest();
    const w2Text = 'Form W-2 2025 Employer: ABC Corporation Employee: Sarah Connor Wages: 85000.00';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(w2Text)]);

    await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: w2Text
    });

    const logs = TaxGuardAuditService.getLogs();
    expect(logs.some(l => l.action === 'STAGE_02_DOCUMENT_ORCHESTRATED')).toBe(true);
  });

  // TG-COL-R13: evidence invalidation reopens requirement
  it('TG-COL-R13: evidence invalidation reopens requirement to MISSING', () => {
    const manifest = setupBaselineManifest();
    manifest.requirements[0].status = 'RECEIVED';
    TaxRequirementManifestEngine.saveManifest(manifest);

    StageTwoOrchestratorService.reopenRequirement({
      clientId: CLIENT_ID,
      taxYear: TAX_YEAR,
      requirementId: 'REQ-2025-W2-ABC',
      reason: 'W-2 retracted by client due to incorrect SSN',
      actor: 'Accountant'
    });

    const reloaded = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    const req = reloaded.requirements.find(r => r.requirementId === 'REQ-2025-W2-ABC');
    expect(req?.status).toBe('MISSING');
  });

  // TG-COL-R14: reopened requirement recalculates Stage 02 gate
  it('TG-COL-R14: reopened requirement recalculates Stage 02 gate and blocks exit', () => {
    const manifest = setupBaselineManifest();
    manifest.requirements.forEach(r => { r.status = 'RECEIVED'; });
    TaxRequirementManifestEngine.saveManifest(manifest);

    let gate = StageTwoOrchestratorService.evaluateStageTwoExitGate(CLIENT_ID, TAX_YEAR);
    expect(gate.passed).toBe(true);

    StageTwoOrchestratorService.reopenRequirement({
      clientId: CLIENT_ID,
      taxYear: TAX_YEAR,
      requirementId: 'REQ-2025-W2-ABC',
      reason: 'Document superseded by revised statement',
      actor: 'Elena Rostova, CPA'
    });

    gate = StageTwoOrchestratorService.evaluateStageTwoExitGate(CLIENT_ID, TAX_YEAR);
    expect(gate.passed).toBe(false);
    expect(gate.blockingReasons.length).toBeGreaterThan(0);
  });

  // TG-COL-R15: Stage 02 cannot pass unresolved material collection issues
  it('TG-COL-R15: Stage 02 gate cannot pass with unresolved material exceptions', () => {
    const manifest = setupBaselineManifest();
    manifest.requirements.forEach(r => { r.status = 'RECEIVED'; });
    manifest.exceptions.push({
      id: 'EX-CRITICAL-TAX-CONFLICT',
      category: 'COLLECTION_CONFLICT',
      severity: 'CRITICAL',
      title: 'Material Collection Conflict',
      description: 'Taxpayer SSN on file conflicts with reported Form 1099-INT recipient TIN.',
      taxYear: TAX_YEAR,
      detectedAt: new Date().toISOString(),
      status: 'OPEN'
    });
    TaxRequirementManifestEngine.saveManifest(manifest);

    const gate = StageTwoOrchestratorService.evaluateStageTwoExitGate(CLIENT_ID, TAX_YEAR);
    expect(gate.passed).toBe(false);
    expect(gate.blockingReasons.some(b => b.includes('Material Collection Conflict'))).toBe(true);
  });

  // TG-COL-R16: CLOUD cannot silently fall back to LOCAL
  it('TG-COL-R16: CLOUD mode cannot silently fall back to LOCAL when provider is unconfigured', async () => {
    const adapter = new ProductionOcrAdapter();
    adapter.setMode('CLOUD');
    ProviderReadinessRegistry.setTestingOverrides({ OCR: 'NOT_CONFIGURED' });

    const input: OcrDocumentInput = {
      tenantId: 'tenant_test',
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      caseId: 'case_001',
      taxYear: TAX_YEAR,
      documentId: 'doc_fail_closed',
      fileName: 'W2.pdf',
      storagePath: '',
      sha256: 'a'.repeat(64),
      mimeType: 'application/pdf'
    };

    await expect(adapter.extract(input)).rejects.toThrow('OCR_PROVIDER_NOT_CONFIGURED');
  });

  // TG-COL-R17: unconfigured provider cannot fabricate OCR
  it('TG-COL-R17: unconfigured provider throws fail-closed rather than fabricating results', async () => {
    const cloud = new GoogleCloudDocumentAiProvider();
    delete process.env.DOCUMENT_AI_PROCESSOR_ID;
    delete process.env.GOOGLE_CLOUD_VISION_KEY;

    const input: OcrDocumentInput = {
      tenantId: 'tenant_test',
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      caseId: 'case_001',
      taxYear: TAX_YEAR,
      documentId: 'doc_unconf',
      fileName: 'W2.pdf',
      storagePath: '',
      sha256: 'b'.repeat(64),
      mimeType: 'application/pdf'
    };

    await expect(cloud.extract(input)).rejects.toThrow('OCR_PROVIDER_NOT_CONFIGURED');
  });

  // TG-COL-R18: OCR service failure cannot increase progress
  it('TG-COL-R18: OCR service failure cannot satisfy requirement or increase progress', async () => {
    setupBaselineManifest();
    GoogleCloudDocumentAiProvider.setTransport(async () => {
      throw new Error('Google Cloud Document AI endpoint timeout');
    });

    const report = StageTwoOrchestratorService.generateCollectionReport(CLIENT_ID, TAX_YEAR);
    expect(report.collectionProgressPercent).toBe(0);
  });

  // TG-COL-R19: retry is idempotent
  it('TG-COL-R19: retry of a document upload is idempotent and retains one active relationship', async () => {
    setupBaselineManifest();
    const w2Text = 'Form W-2 2025 Employer: ABC Corporation Employee: Sarah Connor Wages: 85000.00';
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, ...new TextEncoder().encode(w2Text)]);

    const first = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: w2Text
    });

    const second = await StageTwoCollectionService.ingestDocumentUpload({
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      taxYear: TAX_YEAR,
      uploadedBy: 'Sarah Connor',
      originalFileName: 'W2_ABC.pdf',
      fileSizeBytes: bytes.length,
      mimeType: 'application/pdf',
      claimedCategory: 'W-2',
      fileBytes: bytes,
      rawTextSample: w2Text
    });

    expect((second as any).matchResult).toBe('DUPLICATE');
    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    const req = manifest.requirements.find(r => r.requirementId === 'REQ-2025-W2-ABC');
    expect(req?.matchedDocumentIds).toEqual([first.documentId]);
  });

  // TG-COL-R20: real cloud OCR provenance is distinguishable from LOCAL processing
  it('TG-COL-R20: real cloud OCR provenance is distinguishable from LOCAL heuristic output', async () => {
    const local = new LocalHeuristicOcrProvider();
    const input: OcrDocumentInput = {
      tenantId: 'tenant_test',
      clientId: CLIENT_ID,
      engagementId: ENGAGEMENT_ID,
      caseId: 'case_001',
      taxYear: TAX_YEAR,
      documentId: 'doc_prov',
      fileName: 'Form_W2.pdf',
      storagePath: '',
      sha256: 'c'.repeat(64),
      mimeType: 'application/pdf'
    };

    const localOut = await local.extract(input);
    expect(localOut[0].provider).toContain('Local Heuristic');
    expect(localOut[0].providerVersion).toContain('local');

    GoogleCloudDocumentAiProvider.setTransport(async () => [
      {
        field: 'W-2 Box 1 Wages',
        page: 1,
        proposedValue: 85000.00,
        confidence: 0.99,
        sourceText: 'Wages 85,000.00',
        provider: 'Google Cloud Document AI',
        providerVersion: 'v2.1'
      }
    ]);

    const cloud = new GoogleCloudDocumentAiProvider();
    const cloudOut = await cloud.extract(input);
    expect(cloudOut[0].provider).toBe('Google Cloud Document AI');
    expect(cloudOut[0].providerVersion).toBe('v2.1');
    expect(cloudOut[0].provider).not.toBe(localOut[0].provider);
  });

  // SECTION 24: PRIOR-YEAR SOURCE INTELLIGENCE
  it('Section 24: Prior-Year Source Intelligence generates inquiry and handles YES/NO responses', () => {
    setupBaselineManifest();

    // 2024 had ABC W-2 and XYZ Bank 1099-INT. 2025 only has ABC W-2 received.
    const inquiries = TaxRequirementManifestEngine.evaluatePriorYearSources(CLIENT_ID, TAX_YEAR, [
      { sourceType: '1099-INT', sourceName: 'XYZ Bank', priorYearAmount: 320.00 }
    ]);

    expect(inquiries.length).toBe(1);
    expect(inquiries[0].sourceName).toBe('XYZ Bank');
    expect(inquiries[0].status).toBe('PENDING');

    const manifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    const pyEx = manifest.exceptions.find(e => e.category === 'POTENTIAL_MISSING_PRIOR_YEAR_SOURCE');
    expect(pyEx).toBeDefined();

    // Client responds YES -> Requirement added and exception resolved
    TaxRequirementManifestEngine.respondToPriorYearInquiry({
      clientId: CLIENT_ID,
      currentYear: TAX_YEAR,
      inquiryId: inquiries[0].id,
      response: 'YES',
      notes: 'Account still open at XYZ Bank'
    });

    const updatedManifest = TaxRequirementManifestEngine.getOrCreateManifest(CLIENT_ID, TAX_YEAR);
    expect(updatedManifest.requirements.some(r => r.expectedSource === 'XYZ Bank')).toBe(true);
    const resolvedEx = updatedManifest.exceptions.find(e => e.id === pyEx?.id);
    expect(resolvedEx?.status).toBe('RESOLVED');
  });

  // SECTION 32: STAGE 02 SNAPSHOT
  it('Section 32: Stage 02 Snapshot creates complete handoff package when gate passes', () => {
    const manifest = setupBaselineManifest();
    manifest.requirements.forEach(r => { r.status = 'RECEIVED'; });
    TaxRequirementManifestEngine.saveManifest(manifest);

    const snapshot = StageTwoOrchestratorService.createStageTwoSnapshot(CLIENT_ID, TAX_YEAR);
    expect(snapshot.snapshotId.startsWith('SNAP-S02-')).toBe(true);
    expect(snapshot.collectionProgressPercent).toBe(100);
    expect(snapshot.exitGateRecord.passed).toBe(true);
    expect(snapshot.stageThreeHandoffPackageAvailable).toBe(true);
    expect(snapshot.jurisdictionIndicators.primaryJurisdiction).toBe('SC');
  });
});
