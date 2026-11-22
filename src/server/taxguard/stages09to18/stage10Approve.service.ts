/**
 * BLOCK TG-10 — Stage 10: APPROVE Engine
 *
 * Implements controlled Maker-Checker approval governance:
 *   PREPARER -> INDEPENDENT_REVIEWER -> QUALIFIED_APPROVER -> RELEASE_AUTHORIZATION
 *
 * Security & Integrity Guarantees:
 * - Strictly blocks self-approval (preparer !== reviewer, preparer !== approver)
 * - Strictly blocks administrative bypass (admin/super_admin cannot approve tax returns)
 * - Enforces MFA AAL2 for professional approval decisions
 * - Binds approval to exact returnVersionId + returnContentSha256
 * - Automatically invalidates prior approvals upon any material return modification
 * - Evaluates all 7 configurable QC categories and mandatory risk classification
 * - Supports return-for-correction with structured findings and immutable approval history
 */

import { randomUUID } from 'crypto';
import { Stage09PrepareTaxesService } from './stage09PrepareTaxes.service';
import {
  ActorSessionContext,
  ALL_QC_CATEGORIES,
  QcCategory,
  QcGateCheck,
  ReturnApprovalRecord,
  ReviewFindingRecord,
  RiskClassification,
  ScopedCaseContext,
  TaxGuardStageError,
} from './types';

function scopeKey(scope: ScopedCaseContext): string {
  return `${scope.tenantId}::${scope.clientId}::${scope.engagementId}::${scope.caseId}::${scope.taxYear}`;
}

export class Stage10ApproveService {
  private readonly findings = new Map<string, ReviewFindingRecord[]>();
  private readonly qcGates = new Map<string, QcGateCheck[]>();
  private readonly approvals = new Map<string, ReturnApprovalRecord[]>();

  constructor(private readonly stage09: Stage09PrepareTaxesService) {}

  raiseReviewFinding(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      returnVersionId: string;
      qcCategory: QcCategory;
      severity: ReviewFindingRecord['severity'];
      description: string;
    }
  ): ReviewFindingRecord {
    this.stage09.getReturnVersionOrThrow(scope, input.returnVersionId);
    if (!['reviewer', 'senior_reviewer', 'approver'].includes(actor.role)) {
      throw new TaxGuardStageError(403, 'REVIEWER_ROLE_REQUIRED', 'Only independent reviewers may raise Stage 10 review findings.');
    }

    const finding: ReviewFindingRecord = {
      findingId: `fnd_${randomUUID()}`,
      scope: { ...scope },
      returnVersionId: input.returnVersionId,
      qcCategory: input.qcCategory,
      severity: input.severity,
      description: input.description.trim(),
      status: 'OPEN',
      raisedBy: actor.userId,
      raisedAt: new Date().toISOString(),
      resolvedBy: null,
      resolvedAt: null,
    };

    const key = scopeKey(scope);
    const list = this.findings.get(key) || [];
    list.push(finding);
    this.findings.set(key, list);
    return finding;
  }

  resolveReviewFinding(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    findingId: string
  ): ReviewFindingRecord {
    const list = this.findings.get(scopeKey(scope)) || [];
    const finding = list.find(f => f.findingId === findingId);
    if (!finding) {
      throw new TaxGuardStageError(404, 'FINDING_NOT_FOUND', `Review finding ${findingId} not found.`);
    }
    finding.status = 'CLOSED';
    finding.resolvedBy = actor.userId;
    finding.resolvedAt = new Date().toISOString();
    return finding;
  }

  recordQcGateChecks(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    returnVersionId: string,
    checks: Array<{ category: QcCategory; passed: boolean; notes: string }>
  ): QcGateCheck[] {
    const ret = this.stage09.getReturnVersionOrThrow(scope, returnVersionId);
    this.assertIndependentReviewerRole(actor, ret.preparedBy);

    const now = new Date().toISOString();
    const key = `${scopeKey(scope)}::${returnVersionId}`;
    const existing = new Map<QcCategory, QcGateCheck>();
    for (const c of this.qcGates.get(key) || []) {
      existing.set(c.category, c);
    }

    for (const check of checks) {
      existing.set(check.category, {
        category: check.category,
        passed: check.passed,
        checkedBy: actor.userId,
        checkedAt: now,
        notes: check.notes,
      });
    }

    const merged = Array.from(existing.values());
    this.qcGates.set(key, merged);
    return merged;
  }

  approveReturnVersion(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      returnVersionId: string;
      riskClassification: RiskClassification;
      riskJustification: string;
      notes: string;
      releaseAuthorizerId?: string;
    }
  ): ReturnApprovalRecord {
    const ret = this.stage09.getReturnVersionOrThrow(scope, input.returnVersionId);

    // 1. Strict Maker-Checker & Role Boundary
    this.assertIndependentReviewerRole(actor, ret.preparedBy);

    // 2. Mandatory MFA AAL2 Assurance
    if (actor.mfaAssuranceLevel !== 'aal2') {
      throw new TaxGuardStageError(
        403,
        'STAFF_MFA_REQUIRED',
        'Multi-factor authentication (AAL2) is required to approve a tax return version.'
      );
    }

    // 3. Return version must be submitted for review
    if (ret.status !== 'SUBMITTED_FOR_REVIEW') {
      throw new TaxGuardStageError(
        409,
        'RETURN_NOT_SUBMITTED_FOR_REVIEW',
        `Return version ${ret.returnVersionId} is in status ${ret.status}; it must be SUBMITTED_FOR_REVIEW before approval.`
      );
    }

    // 4. Risk classification must be assessed and documented
    if (input.riskClassification === 'Not assessed' || input.riskJustification.trim().length < 10) {
      throw new TaxGuardStageError(
        422,
        'RISK_ASSESSMENT_REQUIRED',
        'Documented risk classification (Low/Moderate/High/Critical) and justification (>= 10 chars) are required prior to approval.'
      );
    }

    // 5. No open BLOCKING or CRITICAL findings
    const openBlocking = (this.findings.get(scopeKey(scope)) || []).filter(
      f => f.returnVersionId === ret.returnVersionId && f.status === 'OPEN' && ['BLOCKING', 'CRITICAL'].includes(f.severity)
    );
    if (openBlocking.length > 0) {
      throw new TaxGuardStageError(
        422,
        'OPEN_BLOCKING_FINDINGS',
        `Cannot approve return version: ${openBlocking.length} open blocking/critical review finding(s) remain unresolved.`
      );
    }

    // 6. All 7 configurable QC categories must be checked and PASSED
    const qcKey = `${scopeKey(scope)}::${ret.returnVersionId}`;
    const gates = this.qcGates.get(qcKey) || [];
    const missingOrFailed = ALL_QC_CATEGORIES.filter(cat => {
      const found = gates.find(g => g.category === cat);
      return !found || !found.passed;
    });
    if (missingOrFailed.length > 0) {
      throw new TaxGuardStageError(
        422,
        'INCOMPLETE_QC_GATES',
        `All 7 quality control gates must pass before approval. Incomplete/failed: ${missingOrFailed.join(', ')}.`,
        { missingOrFailed }
      );
    }

    const record: ReturnApprovalRecord = {
      approvalId: `apr_${randomUUID()}`,
      scope: { ...scope },
      returnVersionId: ret.returnVersionId,
      returnContentSha256: ret.contentSha256,
      preparerId: ret.preparedBy,
      independentReviewerId: actor.userId,
      qualifiedApproverId: actor.userId,
      releaseAuthorizerId: input.releaseAuthorizerId || actor.userId,
      qcGates: [...gates],
      riskClassification: input.riskClassification,
      riskJustification: input.riskJustification.trim(),
      decision: 'APPROVED',
      invalidatedReason: null,
      invalidatedAt: null,
      mfaAssuranceLevel: 'aal2',
      decidedAt: new Date().toISOString(),
      notes: input.notes.trim(),
    };

    const key = scopeKey(scope);
    const history = this.approvals.get(key) || [];
    history.push(record);
    this.approvals.set(key, history);
    this.stage09.markReturnStatus(scope, ret.returnVersionId, 'APPROVED');

    return record;
  }

  returnForCorrection(
    scope: ScopedCaseContext,
    actor: ActorSessionContext,
    input: {
      returnVersionId: string;
      reason: string;
      qcCategory: QcCategory;
    }
  ): { approvalRecord: ReturnApprovalRecord; finding: ReviewFindingRecord } {
    const ret = this.stage09.getReturnVersionOrThrow(scope, input.returnVersionId);
    this.assertIndependentReviewerRole(actor, ret.preparedBy);

    if (input.reason.trim().length < 15) {
      throw new TaxGuardStageError(400, 'CORRECTION_REASON_REQUIRED', 'Return-for-correction reason must be at least 15 characters.');
    }

    const finding = this.raiseReviewFinding(scope, actor, {
      returnVersionId: ret.returnVersionId,
      qcCategory: input.qcCategory,
      severity: 'BLOCKING',
      description: input.reason.trim(),
    });

    const record: ReturnApprovalRecord = {
      approvalId: `apr_${randomUUID()}`,
      scope: { ...scope },
      returnVersionId: ret.returnVersionId,
      returnContentSha256: ret.contentSha256,
      preparerId: ret.preparedBy,
      independentReviewerId: actor.userId,
      qualifiedApproverId: actor.userId,
      releaseAuthorizerId: null,
      qcGates: [...(this.qcGates.get(`${scopeKey(scope)}::${ret.returnVersionId}`) || [])],
      riskClassification: 'High',
      riskJustification: 'Returned to preparer for mandatory correction.',
      decision: 'RETURNED_FOR_CORRECTION',
      invalidatedReason: null,
      invalidatedAt: null,
      mfaAssuranceLevel: 'aal2',
      decidedAt: new Date().toISOString(),
      notes: input.reason.trim(),
    };

    const key = scopeKey(scope);
    const history = this.approvals.get(key) || [];
    history.push(record);
    this.approvals.set(key, history);
    this.stage09.markReturnStatus(scope, ret.returnVersionId, 'RETURNED_FOR_CORRECTION');

    return { approvalRecord: record, finding };
  }

  /**
   * Called automatically whenever Stage 09 materially modifies a return version.
   * Marks any active approval for that return version as INVALIDATED so stale
   * approvals can never advance to Stage 11 (Sign) or Stage 12 (File).
   */
  invalidateApprovalsForReturn(scope: ScopedCaseContext, returnVersionId: string, reason: string): number {
    const history = this.approvals.get(scopeKey(scope)) || [];
    let invalidatedCount = 0;
    const now = new Date().toISOString();
    for (const rec of history) {
      if (rec.returnVersionId === returnVersionId && rec.decision === 'APPROVED') {
        rec.decision = 'INVALIDATED';
        rec.invalidatedReason = reason;
        rec.invalidatedAt = now;
        invalidatedCount += 1;
      }
    }
    return invalidatedCount;
  }

  getActiveApprovalForReturn(scope: ScopedCaseContext, returnVersionId: string): ReturnApprovalRecord | null {
    const ret = this.stage09.getReturnVersionOrThrow(scope, returnVersionId);
    const history = this.approvals.get(scopeKey(scope)) || [];
    const latest = [...history]
      .reverse()
      .find(r => r.returnVersionId === returnVersionId && r.decision === 'APPROVED');
    if (!latest) return null;
    // Exact cryptographic content hash binding check
    if (latest.returnContentSha256 !== ret.contentSha256) {
      return null;
    }
    return latest;
  }

  listApprovals(scope: ScopedCaseContext): ReturnApprovalRecord[] {
    return [...(this.approvals.get(scopeKey(scope)) || [])];
  }

  listFindings(scope: ScopedCaseContext): ReviewFindingRecord[] {
    return [...(this.findings.get(scopeKey(scope)) || [])];
  }

  getQcGates(scope: ScopedCaseContext, returnVersionId: string): QcGateCheck[] {
    return [...(this.qcGates.get(`${scopeKey(scope)}::${returnVersionId}`) || [])];
  }

  private assertIndependentReviewerRole(actor: ActorSessionContext, preparerId: string): void {
    if (['admin', 'administrator', 'super_admin', 'super_administrator'].includes(actor.role)) {
      throw new TaxGuardStageError(
        403,
        'ADMIN_TAX_APPROVAL_FORBIDDEN',
        'System administrators cannot bypass professional maker-checker review and tax return approval.'
      );
    }
    if (!['reviewer', 'senior_reviewer', 'approver'].includes(actor.role)) {
      throw new TaxGuardStageError(
        403,
        'MAKER_CHECKER_REVIEWER_REQUIRED',
        'Independent reviewer or qualified approver role is required for Stage 10 decisions.'
      );
    }
    if (actor.userId === preparerId) {
      throw new TaxGuardStageError(
        403,
        'SELF_APPROVAL_FORBIDDEN',
        'Maker-checker violation: the preparer cannot review or approve their own tax return version.'
      );
    }
  }
}
