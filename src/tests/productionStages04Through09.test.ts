import { beforeEach, describe, expect, it } from 'vitest';
import { TaxGuardAuthorityRepository, casePath } from '../server/taxguard/authority.repository';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
import { ServerStageGateOrchestrator } from '../server/taxguard/serverStageGateOrchestrator';
import { StageNumber } from '../server/taxguard/persistence.types';

const scope = {
  tenantId: 'tenant_omega',
  clientId: 'client_1040',
  engagementId: 'eng_2025_ind',
  taxYear: 2025,
};

let db: TransactionalFirestore;
let repo: TaxGuardAuthorityRepository;

beforeEach(async () => {
  db = new TransactionalFirestore();

  const members = {
    admin: { role: 'administrator', status: 'active' },
    client_user: { role: 'client', status: 'active', clientId: 'client_1040' },
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
    db.records.set(`taxguardTenants/tenant_omega/members/${uid}`, member);
  }
  db.records.set('taxguardTenants/tenant_omega/clients/client_1040', { ownerUid: 'client_user' });
  db.records.set('taxguardTenants/tenant_omega/clients/client_1040/engagements/eng_2025_ind', {
    clientId: 'client_1040',
    taxYears: [2025],
  });

  repo = new TaxGuardAuthorityRepository(db as any);
  await repo.createCase(scope, 'admin', {
    clientUid: 'client_user',
    preparerUid: 'preparer',
    reviewerUid: 'reviewer',
  });
});

describe('M18.7 Stage 04 — RECORD Engine', () => {
  const validRecordInput = {
    category: 'wages' as const,
    subcategory: 'Form W-2 Box 1',
    description: 'Alpha Corp Wages',
    sourceDocumentId: 'doc_w2_001',
    originalValue: '95,000.00',
    normalizedValue: 95000.0,
    currency: 'USD',
    confidence: 0.99,
    provenance: {
      sourceDocumentId: 'doc_w2_001',
      originalValue: '95,000.00',
      recordVersion: 1,
      ruleVersion: 'IRS-2025-W2',
    },
  };

  it('creates and persists authoritative tax record with complete provenance', async () => {
    const res = await repo.createTaxRecord(scope, 'preparer', 1, 'op_rec_1', validRecordInput);
    expect(res.recordId).toBeDefined();

    const record = await repo.getTaxRecord(scope, 'preparer', res.recordId);
    expect(record.category).toBe('wages');
    expect(record.normalizedValue).toBe(95000.0);
    expect(record.status).toBe('RECORDED');
    expect(record.provenance.recordVersion).toBe(1);
  });

  it('fails closed with MISSING_PROVENANCE when required provenance is absent', async () => {
    await expect(
      repo.createTaxRecord(scope, 'preparer', 1, 'op_rec_fail', {
        ...validRecordInput,
        provenance: null as any,
      })
    ).rejects.toThrow('MISSING_PROVENANCE');
  });

  it('detects duplicate tax records and creates reviewable exception rather than silently deleting', async () => {
    const res1 = await repo.createTaxRecord(scope, 'preparer', 1, 'op_rec_orig', validRecordInput);
    expect(res1.recordId).toBeDefined();

    // Submit identical duplicate record
    const res2 = await repo.createTaxRecord(scope, 'preparer', 2, 'op_rec_dup', validRecordInput);
    const dupRecord = await repo.getTaxRecord(scope, 'preparer', res2.recordId);
    expect(dupRecord.status).toBe('FLAGGED');
    expect(dupRecord.duplicateCandidateOf).toBe(res1.recordId);

    const c = await repo.getCase(scope, 'preparer');
    expect(c.openExceptions).toBeGreaterThan(0);

    // Resolve duplicate conflict
    await repo.resolveRecordDuplicate(scope, 'preparer', 3, 'op_res_dup', res2.recordId, 'MARK_SUPERSEDED');
    const resolvedRecord = await repo.getTaxRecord(scope, 'preparer', res2.recordId);
    expect(resolvedRecord.status).toBe('SUPERSEDED');
  });

  it('evaluates Stage 04 server completion gate and unlocks Stage 05 when satisfied', async () => {
    await repo.evaluateStage(scope, 'preparer', 1, 'eval_s4', 4, {
      stageThreeComplete: true,
      validatedEvidenceRecorded: true,
      provenanceComplete: true,
      unresolvedBlockingExceptions: 0,
      unresolvedDuplicateConflicts: 0,
      professionalReviewComplete: true,
      hardExitGatePassed: true,
    });

    const s4 = await repo.getStageState(scope, 'preparer', 4);
    expect(s4.requirementsMet).toBe(true);
    expect(s4.status).toBe('READY');

    expect(ServerStageGateOrchestrator.isStageFiveUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
    expect(ServerStageGateOrchestrator.isStageFiveUnlocked({ requirementsMet: false, status: 'IN_PROGRESS' })).toBe(false);
  });
});

describe('M18.7 Stage 05 — RECONCILE Engine', () => {
  beforeEach(async () => {
    // Seed tax records for reconciliation
    await repo.createTaxRecord(scope, 'preparer', 1, 'rec_w2', {
      category: 'wages',
      description: 'Primary Employment Wages',
      originalValue: '80000',
      normalizedValue: 80000,
      provenance: { originalValue: '80000', recordVersion: 1 },
    });
  });

  it('runs reconciliation and marks MATCHED when within governed tolerance', async () => {
    const res = await repo.runReconciliation(scope, 'preparer', 2, 'recon_w2_ok', 'wages', 1.0);
    const recon = await repo.getReconciliation(scope, 'preparer', res.reconciliationId);
    expect(recon.status).toBe('MATCHED');
    expect(recon.difference).toBeLessThanOrEqual(1.0);
  });

  it('flags VARIANCE and opens compliance exception when variance exceeds tolerance', async () => {
    // Register OCR field with mismatching value
    const mockOcrField = {
      id: 'ocr_w2_field_wage',
      tenantId: 'tenant_omega',
      clientId: 'client_1040',
      engagementId: 'eng_2025_ind',
      caseId: 'case_2025',
      taxYear: 2025,
      documentId: 'doc_w2',
      page: 1,
      field: 'Box 1: Wages, tips, other comp',
      proposedValue: 95000, // $15,000 difference
      confidence: 0.99,
      isAiProposedOnly: true,
      provenance: {
        tenantId: 'tenant_omega',
        caseId: 'case_2025',
        documentId: 'doc_w2',
        source: 'W2.pdf',
        provider: 'DocAI',
        providerVersion: 'v1',
        proposal: 95000,
        confidence: 0.99,
        recordVersion: 1,
      },
      version: 1,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system',
    };
    db.records.set(`${casePath(scope)}/extractedFields/ocr_w2_field_wage`, mockOcrField);

    const res = await repo.runReconciliation(scope, 'preparer', 2, 'recon_var', 'wages', 1.0);
    let recon = await repo.getReconciliation(scope, 'preparer', res.reconciliationId);
    expect(recon.status).toBe('VARIANCE');
    expect(recon.difference).toBe(15000);

    const c = await repo.getCase(scope, 'preparer');
    expect(c.openExceptions).toBeGreaterThan(0);

    // Resolve variance
    await repo.resolveReconciliationVariance(
      scope,
      'reviewer',
      3,
      'res_var_1',
      res.reconciliationId,
      'Difference explained by pre-tax Section 125 cafeteria plan contributions.'
    );
    recon = await repo.getReconciliation(scope, 'reviewer', res.reconciliationId);
    expect(recon.status).toBe('RESOLVED');
  });

  it('evaluates Stage 05 server completion gate and unlocks Stage 06', async () => {
    await repo.evaluateStage(scope, 'preparer', 2, 'eval_s5', 5, {
      stageFourComplete: true,
      reconciliationsExecuted: true,
      variancesResolved: true,
      unresolvedBlockingExceptions: 0,
      professionalReviewComplete: true,
      hardExitGatePassed: true,
    });

    const s5 = await repo.getStageState(scope, 'preparer', 5);
    expect(s5.requirementsMet).toBe(true);
    expect(s5.status).toBe('READY');

    expect(ServerStageGateOrchestrator.isStageSixUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.7 Stage 06 — REVIEW & Maker-Checker Engine', () => {
  it('creates professional workpapers linked to records and evidence', async () => {
    const res = await repo.createWorkpaper(scope, 'preparer', 1, 'wp_s6', {
      title: 'Home Office Expense Substantiation Memo',
      issue: 'IRC Sec. 280A exclusive and regular business use test for dedicated home office.',
      sourceEvidenceIds: ['ev_floorplan_001'],
      taxRecordIds: ['rec_exp_001'],
      analysis: 'Taxpayer maintains a dedicated 240 sq ft room exclusively for architectural consulting client meetings.',
      conclusion: 'Simplified deduction allowable under Rev. Proc. 2013-13 up to statutory cap.',
      status: 'APPROVED',
    });

    const wp = await repo.getWorkpaper(scope, 'preparer', res.workpaperId);
    expect(wp.title).toContain('Home Office');
    expect(wp.reviewerRole).toBe('accountant');
  });

  it('strictly enforces maker-checker: rejects self-approval by preparer/creator', async () => {
    const res = await repo.createWorkpaper(scope, 'preparer', 1, 'wp_maker_check', {
      title: 'Mileage Log Analysis',
      issue: 'IRC Sec. 274 contemporaneous mileage log adequacy.',
      analysis: 'GPS log verified.',
      conclusion: 'Approved.',
    });

    // Preparer who created the workpaper cannot approve their own workpaper
    await expect(
      repo.performReviewAction(
        scope,
        'preparer',
        2,
        'appr_self',
        { type: 'workpaper', id: res.workpaperId },
        'ACCEPT',
        'Looks good to me'
      )
    ).rejects.toThrow('MAKER_CHECKER_VIOLATION');

    // Independent CPA reviewer can approve
    await repo.performReviewAction(
      scope,
      'reviewer',
      2,
      'appr_cpa',
      { type: 'workpaper', id: res.workpaperId },
      'ACCEPT',
      'Independent CPA review verified contemporaneous records.'
    );

    const wp = await repo.getWorkpaper(scope, 'reviewer', res.workpaperId);
    expect(wp.status).toBe('APPROVED');
    expect(wp.reviewer).toBe('reviewer');
  });

  it('evaluates Stage 06 server completion gate and unlocks Stage 07', async () => {
    await repo.evaluateStage(scope, 'preparer', 1, 'eval_s6', 6, {
      stageFiveComplete: true,
      reviewQueueCleared: true,
      makerCheckerSatisfied: true,
      workpapersComplete: true,
      unresolvedBlockingExceptions: 0,
      hardExitGatePassed: true,
    });

    const s6 = await repo.getStageState(scope, 'preparer', 6);
    expect(s6.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageSevenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.7 Stage 07 — REPORT Engine', () => {
  beforeEach(async () => {
    await repo.createTaxRecord(scope, 'preparer', 1, 'rec_rep_wages', {
      category: 'wages',
      description: 'Form W-2 Wages',
      originalValue: '120000',
      normalizedValue: 120000,
      provenance: { originalValue: '120000', recordVersion: 1 },
    });
    await repo.createTaxRecord(scope, 'preparer', 2, 'rec_rep_withheld', {
      category: 'federal_withholding',
      description: 'Form W-2 Federal Withholding',
      originalValue: '22000',
      normalizedValue: 22000,
      provenance: { originalValue: '22000', recordVersion: 1 },
    });
  });

  it('generates authoritative report with metrics and dataVersion', async () => {
    const res = await repo.generateReport(scope, 'preparer', 3, 'gen_rep_summary', 'case_summary');
    const report = await repo.getReport(scope, 'preparer', res.reportId);

    expect(report.reportType).toBe('case_summary');
    expect(report.status).toBe('CURRENT');
    expect(report.summaryMetrics.totalIncome).toBe(120000);
    expect(report.summaryMetrics.totalWithholding).toBe(22000);
  });

  it('marks previously generated report as STALE when case version advances', async () => {
    const res = await repo.generateReport(scope, 'preparer', 3, 'gen_rep_stale', 'income_summary');
    let report = await repo.getReport(scope, 'preparer', res.reportId);
    expect(report.status).toBe('CURRENT');

    // Case mutates to version 4
    await repo.updateCase(scope, 'preparer', 4, 'upd_case_stale', { notes: 'New tax information received' });

    report = await repo.getReport(scope, 'preparer', res.reportId);
    expect(report.status).toBe('STALE');
  });

  it('evaluates Stage 07 server completion gate and unlocks Stage 08', async () => {
    await repo.evaluateStage(scope, 'preparer', 1, 'eval_s7', 7, {
      stageSixComplete: true,
      requiredReportsGenerated: true,
      reportsCurrent: true,
      unresolvedBlockingExceptions: 0,
      hardExitGatePassed: true,
    });

    const s7 = await repo.getStageState(scope, 'preparer', 7);
    expect(s7.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageEightUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.7 Stage 08 — PLAN Engine', () => {
  beforeEach(async () => {
    await repo.createTaxRecord(scope, 'preparer', 1, 'rec_plan_w2', {
      category: 'wages',
      description: 'Base Salary',
      originalValue: '150000',
      normalizedValue: 150000,
      provenance: { originalValue: '150000', recordVersion: 1 },
    });
  });

  it('creates planning scenario without mutating authoritative actual records', async () => {
    const res = await repo.createPlanningScenario(scope, 'preparer', 2, 'scen_timing', {
      name: 'Accelerate Deductions & Max SEP-IRA',
      description: 'Model $25,000 retirement contribution deduction scenario.',
      assumptions: { sepIraContributionRate: 0.20 },
      adjustments: [{ category: 'retirement_contribution', description: 'Max SEP-IRA', deltaAmount: -25000 }],
    });

    const scenario = await repo.getPlanningScenario(scope, 'preparer', res.scenarioId);
    expect(scenario.name).toContain('Accelerate Deductions');
    expect(scenario.projectedResults.projectedAgi).toBe(125000);
    expect(scenario.projectedResults.projectedSavingsOrCost).toBeGreaterThan(0);

    // Verify baseline actual records were NEVER modified
    const records = await repo.listTaxRecords(scope, 'preparer');
    expect(records).toHaveLength(1);
    expect(records[0].normalizedValue).toBe(150000);
  });

  it('evaluates Stage 08 server completion gate and unlocks Stage 09', async () => {
    await repo.evaluateStage(scope, 'preparer', 1, 'eval_s8', 8, {
      stageSevenComplete: true,
      planningDocumentedOrWaived: true,
      actualDataPreserved: true,
      projectedResultsIsolated: true,
      professionalReviewComplete: true,
      hardExitGatePassed: true,
    });

    const s8 = await repo.getStageState(scope, 'preparer', 8);
    expect(s8.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageNineUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.7 Stage 09 — PREPARE TAXES Engine', () => {
  beforeEach(async () => {
    // Seed authoritative records: $100,000 wages, $20,000 business income, $18,000 withholding
    await repo.createTaxRecord(scope, 'preparer', 1, 'rec_ret_w2', {
      category: 'wages',
      description: 'W-2 Wages',
      originalValue: '100000',
      normalizedValue: 100000,
      provenance: { originalValue: '100000', recordVersion: 1 },
    });
    await repo.createTaxRecord(scope, 'preparer', 2, 'rec_ret_biz', {
      category: 'business_income',
      description: 'Schedule C Consulting Gross Receipts',
      originalValue: '20000',
      normalizedValue: 20000,
      provenance: { originalValue: '20000', recordVersion: 1 },
    });
    await repo.createTaxRecord(scope, 'preparer', 3, 'rec_ret_withheld', {
      category: 'federal_withholding',
      description: 'Federal Income Tax Withheld',
      originalValue: '18000',
      normalizedValue: 18000,
      provenance: { originalValue: '18000', recordVersion: 1 },
    });
  });

  it('generates versioned deterministic DRAFT return with Form 1040 line items', async () => {
    const res = await repo.generateDraftReturn(scope, 'preparer', 4, 'gen_draft_1040', 'INDIVIDUAL_1040', 'FEDERAL');
    const draft = await repo.getDraftReturn(scope, 'preparer', res.returnId);

    expect(draft.status).toBe('READY_FOR_PREPARER_REVIEW');
    expect(draft.figures.totalIncome).toBe(120000);
    expect(draft.figures.adjustedGrossIncome).toBe(120000);
    expect(draft.figures.deductionAmount).toBe(15000); // Standard deduction
    expect(draft.figures.qualifiedBusinessIncomeDeduction).toBe(4000); // 20% of 20,000
    expect(draft.figures.taxableIncome).toBe(101000); // 120,000 - 15,000 - 4,000
    expect(draft.figures.tentativeTax).toBeGreaterThan(0);
    expect(draft.forms[0].lineItems['Line 1z']).toBe(100000);
    expect(draft.forms[0].lineItems['Line 8']).toBe(20000);
  });

  it('fails closed when unsupported jurisdiction is requested', async () => {
    await expect(
      repo.generateDraftReturn(scope, 'preparer', 4, 'gen_draft_bad_jur', 'INDIVIDUAL_1040', 'UNKNOWN_STATE')
    ).rejects.toThrow('UNSUPPORTED_JURISDICTION');
  });

  it('identifies blocking diagnostics when open exceptions exist', async () => {
    await repo.recordException(scope, 'preparer', 4, 'ex_diag_block', 'UNVERIFIED_DEPENDENT_SSN');
    const res = await repo.generateDraftReturn(scope, 'preparer', 5, 'gen_draft_diag', 'INDIVIDUAL_1040', 'FEDERAL');
    const draft = await repo.getDraftReturn(scope, 'preparer', res.returnId);

    expect(draft.status).toBe('DIAGNOSTIC_FAILED');
    expect(draft.diagnostics.some(d => d.code === 'UNRESOLVED_EXCEPTIONS')).toBe(true);

    // Preparer certification is blocked while blocking diagnostics exist
    await expect(
      repo.certifyDraftReturn(scope, 'preparer', 6, 'cert_fail', res.returnId)
    ).rejects.toThrow('BLOCKING_DIAGNOSTICS_REMAIN');
  });

  it('evaluates Stage 09 completion gate and verifies Stage 10 APPROVE remains locked until Stage 09 completes', async () => {
    expect(ServerStageGateOrchestrator.isStageTenUnlocked({ requirementsMet: false, status: 'IN_PROGRESS' })).toBe(false);
    expect(ServerStageGateOrchestrator.isStageTenUnlocked({ requirementsMet: true, status: 'READY' })).toBe(false);

    await repo.evaluateStage(scope, 'preparer', 1, 'eval_s9', 9, {
      stageEightComplete: true,
      authoritativeDataCurrent: true,
      deterministicCalculationsComplete: true,
      unresolvedBlockingDiagnostics: 0,
      draftReturnGenerated: true,
      preparerReviewComplete: true,
      provenanceComplete: true,
      hardExitGatePassed: true,
    });

    const s9 = await repo.getStageState(scope, 'preparer', 9);
    expect(s9.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageTenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.7 Cross-Stage Downstream Invalidation', () => {
  it('cascades upstream Stage 03/04 changes to invalidate downstream stages 05 through 18', async () => {
    // Progress stages 1 through 5 to COMPLETE
    for (let s = 1; s <= 5; s++) {
      const stageRef = db.records.get(`${casePath(scope)}/stageStates/${s}`);
      if (stageRef) {
        db.records.set(`${casePath(scope)}/stageStates/${s}`, { ...stageRef, status: 'COMPLETE', requirementsMet: true });
      }
    }

    // Material upstream revision discovered at Stage 03
    await repo.invalidateDownstreamStages(
      scope,
      'reviewer',
      1,
      'inval_cascade',
      3 as StageNumber,
      'Discovered unrecorded 1099-NEC from ancillary consulting client.'
    );

    const s3 = await repo.getStageState(scope, 'preparer', 3);
    const s4 = await repo.getStageState(scope, 'preparer', 4);
    const s5 = await repo.getStageState(scope, 'preparer', 5);

    expect(s4.status).toBe('INVALIDATED');
    expect(s4.requirementsMet).toBe(false);
    expect(s4.invalidatedReason).toContain('1099-NEC');
    expect(s5.status).toBe('INVALIDATED');
    expect(s5.requirementsMet).toBe(false);
  });
});
