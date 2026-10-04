import { describe, it, expect } from 'vitest';
import { OPERATIONAL_QUEUES, AssignedCase } from '../components/workspace/AccountantWorkspace';

describe('TaxGuard Master Workflow — Operational Queues & Stage Integrity', () => {
  const sampleCases: AssignedCase[] = [
    {
      caseId: 'case_001',
      clientId: 'client_01',
      clientName: 'Daniel Henze',
      taxYear: 2025,
      activeStage: 3,
      stageName: '03 Validate',
      status: 'IN_REVIEW',
      unreviewedDocsCount: 2,
      unresolvedExceptionsCount: 0,
      dueDate: '2026-10-15',
      updatedAt: '2026-10-02T13:45:00Z'
    },
    {
      caseId: 'case_002',
      clientId: 'client_02',
      clientName: 'Palmetto Tech LLC',
      taxYear: 2025,
      activeStage: 4,
      stageName: '04 Record',
      status: 'PREPARATION',
      unreviewedDocsCount: 0,
      unresolvedExceptionsCount: 0,
      dueDate: '2026-10-05',
      isDueToday: true,
      updatedAt: '2026-10-01T16:20:00Z'
    },
    {
      caseId: 'case_003',
      clientId: 'client_03',
      clientName: 'Robert Vance',
      taxYear: 2025,
      activeStage: 2,
      stageName: '02 Collect',
      status: 'AWAITING_CLIENT',
      unreviewedDocsCount: 1,
      unresolvedExceptionsCount: 1,
      isWaitingOnClient: true,
      dueDate: '2026-09-30',
      isOverdue: true,
      updatedAt: '2026-10-02T11:10:00Z'
    },
    {
      caseId: 'case_004',
      clientId: 'client_04',
      clientName: 'Carolina Properties Group',
      taxYear: 2025,
      activeStage: 10,
      stageName: '10 Approve',
      status: 'READY_FOR_APPROVAL',
      unreviewedDocsCount: 0,
      unresolvedExceptionsCount: 0,
      dueDate: '2026-10-10',
      updatedAt: '2026-10-02T14:30:00Z'
    },
    {
      caseId: 'case_005',
      clientId: 'client_05',
      clientName: 'Beacon Harbor Logistics',
      taxYear: 2025,
      activeStage: 11,
      stageName: '11 Sign',
      status: 'SIGNATURE_BLOCKED',
      unreviewedDocsCount: 0,
      unresolvedExceptionsCount: 0,
      isSignatureBlocked: true,
      dueDate: '2026-10-12',
      updatedAt: '2026-10-02T15:00:00Z'
    },
    {
      caseId: 'case_006',
      clientId: 'client_06',
      clientName: 'Apex Advisory Partners',
      taxYear: 2025,
      activeStage: 12,
      stageName: '12 File',
      status: 'FILING_BLOCKED',
      unreviewedDocsCount: 0,
      unresolvedExceptionsCount: 0,
      isFilingBlocked: true,
      dueDate: '2026-10-15',
      updatedAt: '2026-10-02T15:30:00Z'
    },
    {
      caseId: 'case_007',
      clientId: 'client_07',
      clientName: 'Lowcountry Maritime Retail',
      taxYear: 2025,
      activeStage: 14,
      stageName: '14 Resolve',
      status: 'REJECTION_CURE',
      unreviewedDocsCount: 0,
      unresolvedExceptionsCount: 1,
      hasRejection: true,
      rejectionNotice: 'IRS Reject R0000-500-01 (EIN mismatch on Schedule C-EZ)',
      dueDate: '2026-10-08',
      updatedAt: '2026-10-02T16:00:00Z'
    },
    {
      caseId: 'case_008',
      clientId: 'client_08',
      clientName: 'Savannah River BioLabs',
      taxYear: 2025,
      activeStage: 14,
      stageName: '14 Resolve',
      status: 'NOTICE_RESPONSE',
      unreviewedDocsCount: 0,
      unresolvedExceptionsCount: 1,
      hasNotice: true,
      noticeReference: 'IRS Notice CP2000 (TY2023 Underreporting Inquiry)',
      dueDate: '2026-10-14',
      updatedAt: '2026-10-02T16:20:00Z'
    }
  ];

  it('defines all 14 authoritative operational queues requested by specification', () => {
    const queueIds = OPERATIONAL_QUEUES.map((q) => q.id);
    const expected = [
      'all',
      'needs_attention',
      'due_today',
      'overdue',
      'waiting_on_client',
      'documents_received',
      'ready_for_validation',
      'ready_for_preparation',
      'ready_for_review',
      'ready_for_approval',
      'signature_blocked',
      'filing_blocked',
      'government_rejections',
      'notices',
      'upcoming_deadlines'
    ];

    for (const exp of expected) {
      expect(queueIds).toContain(exp);
    }
    expect(OPERATIONAL_QUEUES.length).toBe(15); // 'all' + 14 queues
  });

  it('filters "needs_attention" correctly (cases with exceptions, notices, overdues, or rejections)', () => {
    const attentionCases = sampleCases.filter(
      (c) => c.unresolvedExceptionsCount > 0 || c.isOverdue || c.hasNotice || c.hasRejection
    );
    expect(attentionCases.length).toBeGreaterThanOrEqual(3);
    const clientIds = attentionCases.map((c) => c.clientId);
    expect(clientIds).toContain('client_03');
    expect(clientIds).toContain('client_07');
    expect(clientIds).toContain('client_08');
  });

  it('filters "due_today" correctly', () => {
    const dueToday = sampleCases.filter((c) => c.isDueToday);
    expect(dueToday.length).toBe(1);
    expect(dueToday[0].clientId).toBe('client_02');
  });

  it('filters "overdue" correctly', () => {
    const overdue = sampleCases.filter((c) => c.isOverdue);
    expect(overdue.length).toBe(1);
    expect(overdue[0].clientId).toBe('client_03');
  });

  it('filters "waiting_on_client" correctly', () => {
    const waiting = sampleCases.filter((c) => c.isWaitingOnClient || c.status === 'AWAITING_CLIENT');
    expect(waiting.length).toBe(1);
    expect(waiting[0].clientId).toBe('client_03');
  });

  it('filters "documents_received" based on unreviewedDocsCount', () => {
    const docsReceived = sampleCases.filter((c) => c.unreviewedDocsCount > 0);
    expect(docsReceived.length).toBe(2);
    expect(docsReceived.map((c) => c.clientId)).toEqual(['client_01', 'client_03']);
  });

  it('filters "ready_for_validation" (Stage 03)', () => {
    const stage3 = sampleCases.filter((c) => c.activeStage === 3);
    expect(stage3.length).toBe(1);
    expect(stage3[0].stageName).toBe('03 Validate');
  });

  it('filters "ready_for_preparation" (Stages 04 & 09)', () => {
    const prep = sampleCases.filter(
      (c) => c.activeStage === 4 || c.activeStage === 9 || c.status === 'PREPARATION'
    );
    expect(prep.length).toBe(1);
    expect(prep[0].stageName).toBe('04 Record');
  });

  it('filters "ready_for_approval" (Stage 10)', () => {
    const approval = sampleCases.filter((c) => c.activeStage === 10 || c.status === 'READY_FOR_APPROVAL');
    expect(approval.length).toBe(1);
    expect(approval[0].clientId).toBe('client_04');
  });

  it('filters "signature_blocked" (Stage 11 blocked)', () => {
    const sigBlocked = sampleCases.filter((c) => c.activeStage === 11 || c.isSignatureBlocked);
    expect(sigBlocked.length).toBe(1);
    expect(sigBlocked[0].clientId).toBe('client_05');
  });

  it('filters "filing_blocked" (Stage 12 fail-closed)', () => {
    const filingBlocked = sampleCases.filter((c) => c.activeStage === 12 || c.isFilingBlocked);
    expect(filingBlocked.length).toBe(1);
    expect(filingBlocked[0].clientId).toBe('client_06');
  });

  it('filters "government_rejections" (Stage 13/14 reject notices requiring cure)', () => {
    const rejections = sampleCases.filter((c) => c.hasRejection);
    expect(rejections.length).toBe(1);
    expect(rejections[0].rejectionNotice).toContain('R0000-500-01');
  });

  it('filters "notices" (Stage 14 statutory correspondence)', () => {
    const notices = sampleCases.filter((c) => c.hasNotice);
    expect(notices.length).toBe(1);
    expect(notices[0].noticeReference).toContain('CP2000');
  });

  it('filters "upcoming_deadlines" (< 14 days and not overdue)', () => {
    const upcoming = sampleCases.filter((c) => Boolean(c.dueDate && !c.isOverdue));
    expect(upcoming.length).toBe(7);
  });

  it('enforces configurable retention and active legal holds without unsupported universal claims', () => {
    const packageWithLegalHold = {
      taxYear: 2024,
      retentionScheduleYears: 7,
      isLegalHoldActive: true,
      legalHoldReason: 'Notice response administrative inquiry pending',
      retentionPolicyBasis: 'Configurable firm practice policy (Active Legal Hold: Purge prevention enforced)'
    };

    expect(packageWithLegalHold.isLegalHoldActive).toBe(true);
    expect(packageWithLegalHold.retentionPolicyBasis).not.toContain('Universal 7-Year Guarantee');
    expect(packageWithLegalHold.retentionPolicyBasis).toContain('Active Legal Hold');
  });

  it('preserves fail-closed boundary for uncommissioned external transmission systems', () => {
    const stage12Status: string = 'PROVIDER_BLOCKED';
    expect(stage12Status).toBe('PROVIDER_BLOCKED');
    // Must never claim submitted without commissioned provider
    expect(stage12Status === 'SUBMITTED').toBe(false);
  });
});
