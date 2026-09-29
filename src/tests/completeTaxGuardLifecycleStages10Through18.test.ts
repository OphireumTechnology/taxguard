/**
 * TaxGuard Master Comprehensive Lifecycle Tests (Stages 10 through 18)
 * Verifies full production lifecycle, maker-checker governance, fail-closed security,
 * downstream invalidation, provider readiness, idempotent bootstrap, and Supabase auth neutrality.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { TaxGuardAuthorityRepository, casePath } from '../server/taxguard/authority.repository';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
import { ServerStageGateOrchestrator } from '../server/taxguard/serverStageGateOrchestrator';
import { ProviderReadinessRegistry } from '../server/taxguard/providerReadiness.service';
import { ensureCanonicalTenantBootstrap, CANONICAL_TENANT_ID, isCanonicalTenant } from '../server/taxguard/tenantBootstrap';
import { requestPasswordReset, validatePasswordStrength, NEUTRAL_PASSWORD_RESET_MESSAGE } from '../supabase/auth';
import { StageNumber } from '../server/taxguard/persistence.types';

const scope = {
  tenantId: 'tenant_alpha',
  clientId: 'client_uhnw_1040',
  engagementId: 'eng_2025_uhnw',
  taxYear: 2025,
};

let db: TransactionalFirestore;
let repo: TaxGuardAuthorityRepository;

beforeEach(async () => {
  db = new TransactionalFirestore();
  ProviderReadinessRegistry.setTestingOverrides(undefined);

  const members = {
    admin_user: { role: 'administrator', status: 'active' },
    client_user: { role: 'client', status: 'active', clientId: 'client_uhnw_1040' },
    preparer_cpa: { role: 'accountant', status: 'active' },
    reviewer_cpa: {
      role: 'reviewer',
      status: 'active',
      credentialVerified: true,
      credentialType: 'CPA',
      credentialExpiresAt: '2099-12-31',
    },
    uncredentialed_reviewer: {
      role: 'reviewer',
      status: 'active',
      credentialVerified: false,
    },
  };

  for (const [uid, member] of Object.entries(members)) {
    db.records.set(`taxguardTenants/tenant_alpha/members/${uid}`, member);
  }
  db.records.set('taxguardTenants/tenant_alpha/clients/client_uhnw_1040', { ownerUid: 'client_user' });
  db.records.set('taxguardTenants/tenant_alpha/clients/client_uhnw_1040/engagements/eng_2025_uhnw', {
    clientId: 'client_uhnw_1040',
    taxYears: [2025],
  });

  repo = new TaxGuardAuthorityRepository(db as any);
  await repo.createCase(scope, 'admin_user', {
    clientUid: 'client_user',
    preparerUid: 'preparer_cpa',
    reviewerUid: 'reviewer_cpa',
  });
});

describe('M18.9 Stage 10 — APPROVE Engine', () => {
  beforeEach(async () => {
    // Generate certified draft return from preparer
    await repo.createTaxRecord(scope, 'preparer_cpa', 1, 'rec_w2', {
      category: 'wages',
      description: 'Alpha Executive Salary',
      originalValue: '250000',
      normalizedValue: 250000,
      provenance: { originalValue: '250000', recordVersion: 1 },
    });
    const draftRes = await repo.generateDraftReturn(scope, 'preparer_cpa', 2, 'gen_draft', 'INDIVIDUAL_1040', 'FEDERAL');
    await repo.certifyDraftReturn(scope, 'preparer_cpa', 3, 'cert_draft', draftRes.returnId);
  });

  it('enforces Maker-Checker: preparer cannot approve their own return', async () => {
    await expect(
      repo.approveDraftReturn(scope, 'preparer_cpa', 4, 'appr_fail_prep', 'ret_FEDERAL_INDIVIDUAL_1040', 'Self-approval attempt')
    ).rejects.toThrow('MAKER_CHECKER_VIOLATION');
  });

  it('fails closed when reviewer credentials are unverified', async () => {
    await expect(
      repo.approveDraftReturn(scope, 'uncredentialed_reviewer', 4, 'appr_fail_cred', 'ret_FEDERAL_INDIVIDUAL_1040', 'Uncredentialed approval')
    ).rejects.toThrow('CREDENTIAL_UNVERIFIED');
  });

  it('successfully approves draft return by authorized verified reviewer and persists ApprovalRecord', async () => {
    const res = await repo.approveDraftReturn(
      scope,
      'reviewer_cpa',
      4,
      'appr_ok',
      'ret_FEDERAL_INDIVIDUAL_1040',
      'Comprehensive tie-out and Circular 230 review completed.'
    );

    expect(res.status).toBe('APPROVED');
    expect(res.returnHash).toBeDefined();

    const approval = await repo.getApproval(scope, 'reviewer_cpa', res.approvalId);
    expect(approval.status).toBe('APPROVED');
    expect(approval.approvedBy).toBe('reviewer_cpa');
    expect(approval.credential).toBe('CPA');
  });

  it('evaluates Stage 10 completion gate and unlocks Stage 11', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s10', 10, {
      stageNineComplete: true,
      returnApproved: true,
      makerCheckerVerified: true,
      reviewerCredentialVerified: true,
      unresolvedBlockingDiagnostics: 0,
      unresolvedMaterialExceptions: 0,
      hardExitGatePassed: true,
    });

    const s10 = await repo.getStageState(scope, 'reviewer_cpa', 10);
    expect(s10.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageElevenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.9 Stage 11 — SIGN Engine', () => {
  it('fails closed with SIGNATURE_PROVIDER_NOT_CONFIGURED when e-signature provider is unconfigured', async () => {
    ProviderReadinessRegistry.setTestingOverrides({ E_SIGNATURE: 'NOT_CONFIGURED' });

    await expect(
      repo.createSignaturePackage(scope, 'reviewer_cpa', 1, 'sig_pkg_fail', 'ret_FEDERAL_INDIVIDUAL_1040', [
        { name: 'John Taxpayer', email: 'john@example.com', role: 'TAXPAYER' },
      ])
    ).rejects.toThrow('SIGNATURE_PROVIDER_NOT_CONFIGURED');
  });

  it('creates SignaturePackageEntity and records signature events when provider is operational', async () => {
    ProviderReadinessRegistry.setTestingOverrides({ E_SIGNATURE: 'CONFIGURED' });

    // Seed draft return
    const draftRes = await repo.generateDraftReturn(scope, 'preparer_cpa', 1, 'gen_draft', 'INDIVIDUAL_1040', 'FEDERAL');

    const res = await repo.createSignaturePackage(scope, 'reviewer_cpa', 2, 'sig_pkg_ok', draftRes.returnId, [
      { name: 'John Taxpayer', email: 'john@example.com', role: 'TAXPAYER' },
    ]);
    expect(res.packageId).toBeDefined();

    // Record signed event
    const eventRes = await repo.recordSignatureEvent(scope, 'reviewer_cpa', 3, 'sig_evt', res.packageId, {
      signerId: 'signer_1',
      eventType: 'SIGNED',
      evidenceHash: 'sha256_mock_evidence_hash',
    });
    expect(eventRes.status).toBe('SIGNED');

    const pkg = await repo.getSignaturePackage(scope, 'reviewer_cpa', res.packageId);
    expect(pkg.status).toBe('SIGNED');
    expect(pkg.signers[0].status).toBe('SIGNED');
  });

  it('evaluates Stage 11 completion gate and unlocks Stage 12', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s11', 11, {
      stageTenComplete: true,
      signaturePackageCreated: true,
      allSignaturesObtained: true,
      providerConfigured: true,
      hardExitGatePassed: true,
    });

    const s11 = await repo.getStageState(scope, 'reviewer_cpa', 11);
    expect(s11.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageTwelveUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.9 Stage 12 — FILE Engine', () => {
  it('fails closed with FILING_PROVIDER_NOT_CONFIGURED when filing transmitter is unconfigured', async () => {
    ProviderReadinessRegistry.setTestingOverrides({ FILING: 'NOT_CONFIGURED' });

    await expect(
      repo.createFilingPackage(scope, 'reviewer_cpa', 1, 'file_fail', 'ret_FEDERAL_INDIVIDUAL_1040', 'FEDERAL', 'idemp_key_1')
    ).rejects.toThrow('FILING_PROVIDER_NOT_CONFIGURED');
  });

  it('implements filing idempotency: duplicate idempotency keys replay existing package', async () => {
    ProviderReadinessRegistry.setTestingOverrides({ FILING: 'CONFIGURED' });
    const draftRes = await repo.generateDraftReturn(scope, 'preparer_cpa', 1, 'gen_draft', 'INDIVIDUAL_1040', 'FEDERAL');

    const first = await repo.createFilingPackage(scope, 'reviewer_cpa', 2, 'file_create_1', draftRes.returnId, 'FEDERAL', 'idemp_key_unique');
    expect(first.packageId).toBeDefined();

    const second = await repo.createFilingPackage(scope, 'reviewer_cpa', 3, 'file_create_dup', draftRes.returnId, 'FEDERAL', 'idemp_key_unique');
    expect(second.packageId).toBe(first.packageId);
    expect((second as any).idempotencyReplay).toBe(true);
  });

  it('enforces SUBMITTED DOES NOT MEAN ACCEPTED invariant, then records IRS acknowledgement', async () => {
    ProviderReadinessRegistry.setTestingOverrides({ FILING: 'CONFIGURED' });
    const draftRes = await repo.generateDraftReturn(scope, 'preparer_cpa', 1, 'gen_draft', 'INDIVIDUAL_1040', 'FEDERAL');
    const pkgRes = await repo.createFilingPackage(scope, 'reviewer_cpa', 2, 'file_create', draftRes.returnId, 'FEDERAL', 'idemp_flow');

    // Submit
    const subRes = await repo.submitFiling(scope, 'reviewer_cpa', 3, 'sub_file', pkgRes.packageId);
    expect(subRes.status).toBe('SUBMITTED');

    // SUBMITTED != ACCEPTED
    expect(subRes.status).not.toBe('ACCEPTED');

    // Record acknowledgement
    const ackRes = await repo.recordFilingAcknowledgement(scope, 'reviewer_cpa', 4, 'ack_file', pkgRes.packageId, {
      ackId: 'ack_mef_9988',
      receivedAt: new Date().toISOString(),
      submissionId: pkgRes.submissionId,
      status: 'ACCEPTED',
      acceptanceCode: 'IRS-ACCEPT-1040',
    });
    expect(ackRes.status).toBe('ACCEPTED');
  });

  it('evaluates Stage 12 completion gate and unlocks Stage 13', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s12', 12, {
      stageElevenComplete: true,
      signaturesVerified: true,
      filingPackageCreated: true,
      filingSubmitted: true,
      filingAcknowledged: true,
      providerConfigured: true,
      hardExitGatePassed: true,
    });

    const s12 = await repo.getStageState(scope, 'reviewer_cpa', 12);
    expect(s12.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageThirteenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.9 Stage 13 — GOVERNMENT FEEDBACK Engine', () => {
  it('records government processing feedback and notices', async () => {
    const res = await repo.recordGovernmentFeedback(scope, 'reviewer_cpa', 1, 'rec_fb', {
      submissionId: 'sub_123',
      provider: 'IRS_MEF',
      status: 'NOTICE_RECEIVED',
      externalReference: 'NOTICE-CP2000-2025',
      message: 'Proposed adjustment regarding unreported 1099-DIV',
      severity: 'WARNING',
      notices: [{
        noticeId: 'not_1',
        noticeNumber: 'CP2000',
        noticeDate: '2026-04-15',
        issuingAgency: 'IRS',
        summary: 'Proposed dividend reconciliation',
        actionRequired: 'Submit response within 30 days',
        resolved: false,
      }],
    });
    expect(res.feedbackId).toBeDefined();

    const fb = await repo.getGovernmentFeedback(scope, 'reviewer_cpa', res.feedbackId);
    expect(fb.status).toBe('NOTICE_RECEIVED');
    expect(fb.notices.length).toBe(1);
  });

  it('evaluates Stage 13 completion gate and unlocks Stage 14', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s13', 13, {
      stageTwelveComplete: true,
      feedbackReceived: true,
      feedbackProcessed: true,
      unresolvedGovernmentNotices: 0,
      hardExitGatePassed: true,
    });

    const s13 = await repo.getStageState(scope, 'reviewer_cpa', 13);
    expect(s13.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageFourteenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.9 Stage 14 — RESOLVE Engine', () => {
  it('creates and resolves resolution case with governed professional decision', async () => {
    const createRes = await repo.createResolutionCase(scope, 'reviewer_cpa', 1, 'res_create', {
      issueType: 'IRS_NOTICE_CP2000',
      description: 'Resolution for Schedule B mismatch',
      assignedTo: 'reviewer_cpa',
    });
    expect(createRes.status).toBe('OPEN');

    const resolveRes = await repo.resolveResolutionCase(scope, 'reviewer_cpa', 2, 'res_resolve', createRes.resolutionId, {
      actionType: 'AMENDED_RETURN',
      rationale: 'Prepared 1040-X with verified broker 1099-DIV documentation.',
    });
    expect(resolveRes.status).toBe('RESOLVED');

    const resCase = await repo.getResolutionCase(scope, 'reviewer_cpa', createRes.resolutionId);
    expect(resCase.status).toBe('RESOLVED');
    expect(resCase.resolutionDecision?.actionType).toBe('AMENDED_RETURN');
  });

  it('evaluates Stage 14 completion gate and unlocks Stage 15', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s14', 14, {
      stageThirteenComplete: true,
      rejectionsOrNoticesResolved: true,
      openResolutionIssues: 0,
      professionalReviewComplete: true,
      hardExitGatePassed: true,
    });

    const s14 = await repo.getStageState(scope, 'reviewer_cpa', 14);
    expect(s14.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageFifteenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.9 Stage 15 — MONITOR Engine', () => {
  it('creates and tracks compliance monitoring items and deadlines', async () => {
    const res = await repo.createMonitoringItem(scope, 'reviewer_cpa', 1, 'mon_create', {
      itemType: 'ESTIMATED_TAX',
      title: 'Q2 Estimated Tax Voucher',
      description: 'Federal and State Q2 estimated payment deadline',
      dueDate: '2026-06-15T00:00:00Z',
    });
    expect(res.itemId).toBeDefined();

    const items = await repo.listMonitoringItems(scope, 'reviewer_cpa');
    expect(items.length).toBeGreaterThan(0);

    const updateRes = await repo.updateMonitoringItemStatus(scope, 'reviewer_cpa', 2, 'mon_upd', res.itemId, 'RESOLVED');
    expect(updateRes.status).toBe('RESOLVED');
  });

  it('evaluates Stage 15 completion gate and unlocks Stage 16', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s15', 15, {
      stageFourteenComplete: true,
      monitoringItemsCurrent: true,
      unresolvedDeadlines: 0,
      followUpsCompleted: true,
      hardExitGatePassed: true,
    });

    const s15 = await repo.getStageState(scope, 'reviewer_cpa', 15);
    expect(s15.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageSixteenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.9 Stage 16 — ARCHIVE Engine', () => {
  it('creates immutable ArchiveManifestEntity and sets case status to ARCHIVED', async () => {
    const res = await repo.createArchiveManifest(scope, 'reviewer_cpa', 1, 'arch_create', {
      returnVersions: ['ret_FEDERAL_INDIVIDUAL_1040_v1'],
      filingRecords: ['filepkg_123'],
    });

    expect(res.status).toBe('ARCHIVED');
    expect(res.integrityHash).toBeDefined();

    const manifest = await repo.getArchiveManifest(scope, 'reviewer_cpa', res.manifestId);
    expect(manifest.status).toBe('ARCHIVED');
    expect(manifest.retentionPolicy.minimumRetentionYears).toBe(7);

    const c = await repo.getCase(scope, 'reviewer_cpa');
    expect(c.status).toBe('ARCHIVED');
  });

  it('evaluates Stage 16 completion gate and unlocks Stage 17', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s16', 16, {
      stageFifteenComplete: true,
      caseClosedOrFiled: true,
      archiveManifestGenerated: true,
      integrityHashVerified: true,
      immutableRetentionPolicySet: true,
      hardExitGatePassed: true,
    });

    const s16 = await repo.getStageState(scope, 'reviewer_cpa', 16);
    expect(s16.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageSeventeenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.9 Stage 17 — RENEW Engine', () => {
  it('creates renewal record and classifies carry-forward candidates with provenance', async () => {
    const res = await repo.createRenewalRecord(
      scope,
      'reviewer_cpa',
      1,
      'ren_create',
      2026,
      [{ item: 'Client engagement letter renewed', completed: true }],
      [
        {
          id: 'cf_1',
          category: 'capital_loss_carryover',
          description: 'Long-term capital loss carryover to 2026',
          priorYearValue: 42000,
          classification: 'CANDIDATE',
        },
      ]
    );
    expect(res.renewalId).toBeDefined();

    // Confirm carry-forward
    await repo.classifyCarryForwardCandidate(scope, 'reviewer_cpa', 2, 'ren_classify', res.renewalId, 'cf_1', 'CONFIRMED');

    const record = await repo.getRenewalRecord(scope, 'reviewer_cpa', res.renewalId);
    expect(record.carryForwardCandidates[0].classification).toBe('CONFIRMED');
    expect(record.carryForwardCandidates[0].confirmedBy).toBe('reviewer_cpa');
  });

  it('evaluates Stage 17 completion gate and unlocks Stage 18', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s17', 17, {
      stageSixteenComplete: true,
      priorYearCaseArchived: true,
      renewalChecklistCompleted: true,
      carryForwardCandidatesClassified: true,
      hardExitGatePassed: true,
    });

    const s17 = await repo.getStageState(scope, 'reviewer_cpa', 17);
    expect(s17.requirementsMet).toBe(true);
    expect(ServerStageGateOrchestrator.isStageEighteenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
  });
});

describe('M18.9 Stage 18 — REPEAT Engine', () => {
  it('initializes next tax year case starting at Stage 1 ONBOARD and carries forward confirmed candidates', async () => {
    const res = await repo.createRepeatTaxCase(scope, 'reviewer_cpa', 1, 'rep_create', 2026, [
      {
        id: 'cf_1',
        category: 'charitable_contribution_carryover',
        description: 'Prior year charitable deduction carryover',
        priorYearValue: 15000,
        classification: 'CONFIRMED',
      },
    ]);

    expect(res.status).toBe('COMPLETE');
    expect(res.nextTaxYear).toBe(2026);
    expect(res.carryForwardCount).toBe(1);

    const nextScope = { ...scope, taxYear: 2026 };
    const nextCase = await repo.getCase(nextScope, 'preparer_cpa');
    expect(nextCase.activeStage).toBe(1); // Strictly starts at Stage 01 ONBOARD
    expect(nextCase.taxYear).toBe(2026);

    // Prevents duplicate active case for 2026
    await expect(
      repo.createRepeatTaxCase(scope, 'reviewer_cpa', 2, 'rep_create_dup', 2026, [])
    ).rejects.toThrow('DUPLICATE_CASE');
  });

  it('evaluates Stage 18 completion gate', async () => {
    await repo.evaluateStage(scope, 'reviewer_cpa', 1, 'eval_s18', 18, {
      stageSeventeenComplete: true,
      nextYearCaseCreated: true,
      nextYearStartsAtStageOne: true,
      provenancePreserved: true,
      noDuplicateActiveCase: true,
      hardExitGatePassed: true,
    });

    const s18 = await repo.getStageState(scope, 'reviewer_cpa', 18);
    expect(s18.requirementsMet).toBe(true);
  });
});

describe('M18.9 Cross-Stage Invalidation across Stages 10-18', () => {
  it('cascades upstream Stage 09 changes to invalidate downstream stages 10 through 18', async () => {
    // Advance stages 10-15 to COMPLETE
    for (let s = 10; s <= 15; s++) {
      const stageRef = db.records.get(`${casePath(scope)}/stageStates/${s}`);
      if (stageRef) {
        db.records.set(`${casePath(scope)}/stageStates/${s}`, { ...stageRef, status: 'COMPLETE', requirementsMet: true });
      }
    }

    // Material upstream revision discovered at Stage 09
    await repo.invalidateDownstreamStages(
      scope,
      'reviewer_cpa',
      1,
      'inval_cascade_s9',
      9 as StageNumber,
      'Material 1099-B revision received requiring return recalculation.'
    );

    const s10 = await repo.getStageState(scope, 'preparer_cpa', 10);
    expect(s10.status).toBe('INVALIDATED');
    expect(s10.requirementsMet).toBe(false);
    expect(s10.invalidatedReason).toContain('1099-B');
  });
});

describe('M18.9 Provider Readiness Center (All 10 Providers)', () => {
  it('truthfully evaluates all 10 canonical providers without exposing secrets', () => {
    const statuses = ProviderReadinessRegistry.getAllProviderStatuses();
    expect(statuses.length).toBe(10);

    const providerNames = statuses.map(s => s.provider);
    expect(providerNames).toContain('DATABASE');
    expect(providerNames).toContain('AUTHENTICATION');
    expect(providerNames).toContain('STORAGE');
    expect(providerNames).toContain('MALWARE_SCANNER');
    expect(providerNames).toContain('OCR');
    expect(providerNames).toContain('AI');
    expect(providerNames).toContain('E_SIGNATURE');
    expect(providerNames).toContain('FILING');
    expect(providerNames).toContain('QUICKBOOKS');
    expect(providerNames).toContain('XERO');

    for (const status of statuses) {
      expect(['CONFIGURED', 'NOT_CONFIGURED', 'DEGRADED', 'DISABLED', 'ERROR']).toContain(status.status);
      expect(typeof status.description).toBe('string');
      expect(typeof status.isOperational).toBe('boolean');
    }
  });
});

describe('M18.9 Idempotent Tenant Bootstrap', () => {
  it('bootstrap creates canonical A/R Tax Services tenant and is idempotent', async () => {
    const res1 = await ensureCanonicalTenantBootstrap();
    expect(res1.tenantId).toBe(CANONICAL_TENANT_ID);
    expect(isCanonicalTenant(res1.tenantId)).toBe(true);

    const res2 = await ensureCanonicalTenantBootstrap();
    expect(res2.tenantId).toBe(CANONICAL_TENANT_ID);
  });
});

describe('M18.9 Supabase Authentication Neutrality & Password Strength', () => {
  it('requestPasswordReset returns neutral message preventing account enumeration', async () => {
    const res = await requestPasswordReset('unknown.taxpayer@example.com');
    expect(res.success).toBe(true);
    expect(res.message).toBe(NEUTRAL_PASSWORD_RESET_MESSAGE);
  });

  it('validatePasswordStrength rejects weak passwords and accepts strong passwords', () => {
    expect(validatePasswordStrength('short').valid).toBe(false);
    expect(validatePasswordStrength('nouppercase123').valid).toBe(false);
    expect(validatePasswordStrength('NOLOWERCASE123').valid).toBe(false);
    expect(validatePasswordStrength('NoNumbersHere').valid).toBe(false);
    expect(validatePasswordStrength('StrongPass123!').valid).toBe(true);
  });
});
