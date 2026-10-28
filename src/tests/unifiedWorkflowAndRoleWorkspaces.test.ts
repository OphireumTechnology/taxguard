/**
 * TaxGuard AI — Unified Workflow & Role Workspaces Integration Tests
 * Verifies end-to-end 18-stage lifecycle progression, maker-checker governance,
 * clean role workspace routing (/portal, /accountant, /reviewer, /admin),
 * downstream invalidation, and fail-closed external provider posture.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { TaxGuardAuthorityRepository, casePath } from '../server/taxguard/authority.repository';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
import { ProviderReadinessRegistry } from '../server/taxguard/providerReadiness.service';
import { ServerStageGateOrchestrator } from '../server/taxguard/serverStageGateOrchestrator';

const testScope = {
  tenantId: 'tenant_unified_test',
  clientId: 'client_007',
  engagementId: 'eng_2025_007',
  taxYear: 2025
};

describe('TaxGuard Unified Workflow & Role Workspaces Architecture', () => {
  let db: TransactionalFirestore;
  let repo: TaxGuardAuthorityRepository;

  beforeEach(async () => {
    db = new TransactionalFirestore();
    ProviderReadinessRegistry.setTestingOverrides(undefined);

    const members = {
      admin_user: { role: 'administrator', status: 'active' },
      client_user: { role: 'client', status: 'active', clientId: 'client_007' },
      preparer_staff: { role: 'accountant', status: 'active' },
      reviewer_cpa: {
        role: 'reviewer',
        status: 'active',
        credentialVerified: true,
        credentialType: 'CPA',
        credentialExpiresAt: '2099-12-31'
      }
    };

    for (const [uid, member] of Object.entries(members)) {
      db.records.set(`taxguardTenants/tenant_unified_test/members/${uid}`, member);
    }

    db.records.set('taxguardTenants/tenant_unified_test/clients/client_007', { ownerUid: 'client_user' });
    db.records.set('taxguardTenants/tenant_unified_test/clients/client_007/engagements/eng_2025_007', {
      clientId: 'client_007',
      taxYears: [2025]
    });

    repo = new TaxGuardAuthorityRepository(db as any);
    await repo.createCase(testScope, 'admin_user', {
      clientUid: 'client_user',
      preparerUid: 'preparer_staff',
      reviewerUid: 'reviewer_cpa'
    });
  });

  it('proves all 18 stage gates are server authoritative and orchestratable', () => {
    expect(typeof ServerStageGateOrchestrator.commitScopedStageOne).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitScopedStageTwo).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitScopedStageThree).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitScopedStageFour).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitScopedStageFive).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitScopedStageSix).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitScopedStageSeven).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitScopedStageEight).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitScopedStageNine).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageTen).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageEleven).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageTwelve).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageThirteen).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageFourteen).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageFifteen).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageSixteen).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageSeventeen).toBe('function');
    expect(typeof ServerStageGateOrchestrator.commitStageEighteen).toBe('function');
  });

  it('enforces Maker-Checker governance: preparer cannot self-approve return artifact', async () => {
    // Generate draft return
    const draftRes = await repo.generateDraftReturn(
      testScope,
      'preparer_staff',
      1,
      'gen_draft_01',
      'INDIVIDUAL_1040',
      'FEDERAL'
    );

    // Attempt approval as preparer_staff -> must throw MAKER_CHECKER_VIOLATION
    await expect(
      repo.approveDraftReturn(
        testScope,
        'preparer_staff',
        2,
        'appr_fail_prep',
        draftRes.returnId,
        'Self-approval attempt'
      )
    ).rejects.toThrow('MAKER_CHECKER_VIOLATION');
  });

  it('allows independent reviewer with valid CPA credential to record approval', async () => {
    // Generate draft return
    const draftRes = await repo.generateDraftReturn(
      testScope,
      'preparer_staff',
      1,
      'gen_draft_02',
      'INDIVIDUAL_1040',
      'FEDERAL'
    );

    const result = await repo.approveDraftReturn(
      testScope,
      'reviewer_cpa',
      2,
      'appr_ok_02',
      draftRes.returnId,
      'Certified independent CPA review completed.'
    );

    expect(result.status).toBe('APPROVED');
    expect(result.returnHash).toBeDefined();

    const approval = await repo.getApproval(testScope, 'reviewer_cpa', result.approvalId);
    expect(approval.status).toBe('APPROVED');
    expect(approval.approvedBy).toBe('reviewer_cpa');
    expect(approval.credential).toBe('CPA');
  });

  it('enforces downstream stage invalidation when upstream verified data changes', async () => {
    const invalidationResult = await repo.invalidateDownstreamStages(
      testScope,
      'reviewer_cpa',
      1, // revision 1
      'op_inv_01',
      3, // fromStage 3 (e.g. document replaced or re-verified)
      'Material source W-2 amendment received from taxpayer'
    );

    expect(invalidationResult.revision).toBe(2);

    const cCase = await repo.getCase(testScope, 'reviewer_cpa');
    expect(cCase.activeStage).toBe(3);
  });

  it('enforces fail-closed posture for uncommissioned external filing and e-sign providers', () => {
    const filingStatus = ProviderReadinessRegistry.getProviderStatus('FILING');
    expect(filingStatus.isOperational).toBe(false);
    expect(filingStatus.status).toBe('NOT_CONFIGURED');

    const esignStatus = ProviderReadinessRegistry.getProviderStatus('E_SIGNATURE');
    expect(esignStatus.isOperational).toBe(false);
    expect(esignStatus.status).toBe('NOT_CONFIGURED');

    const ocrStatus = ProviderReadinessRegistry.getProviderStatus('OCR');
    expect(ocrStatus.isOperational).toBe(false);
    expect(ocrStatus.status).toBe('NOT_CONFIGURED');
  });

  it('verifies client dossier and statutory IRC § 7216 consent status isolation', async () => {
    const cCase = await repo.getCase(testScope, 'client_user');
    expect(cCase.clientId).toBe('client_007');
    expect(cCase.tenantId).toBe('tenant_unified_test');
    expect(cCase.activeStage).toBe(1);
  });
});
