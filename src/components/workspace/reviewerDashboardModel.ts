import type { ReviewScope, ReviewerQueueCase, ReviewerReturn, ReviewerSnapshot } from '../../types/reviewerDashboard';
export { ACCOUNTANT_STAGES as REVIEWER_STAGES } from './accountantDashboardModel';
export const REVIEW_FILTERS = ['All Assigned','Ready for Review','High Risk','Exceptions','Returned','Awaiting Approval','Due Today','Overdue'];
export const REVIEW_TABS = ['Overview','Client Information','Documents','Accounting','Tax Return','Workpapers','Federal Forms','State Forms','AI Findings','Exceptions','Review Notes','Approval','Audit / History'];
export function recordedExtractionConfidence(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? `${value} (provider value; human review required)` : 'Not reported';
}
export function reviewerAccess(user: { role: string; status: string; tenantId?: string } | null, auth: string) {
  return auth === 'AUTHENTICATED' && user?.status === 'active' && ['reviewer','senior_reviewer'].includes(user.role) && Boolean(user.tenantId);
}
export function sameReviewScope(a: ReviewScope, b: ReviewScope) {
  return a.tenantId === b.tenantId && a.clientId === b.clientId && a.engagementId === b.engagementId && a.taxYear === b.taxYear;
}
export function safeReviewQueue(rows: ReviewerQueueCase[], tenantId: string, reviewerUid: string) {
  return rows.filter(r => r.scope?.tenantId === tenantId && r.reviewerUid === reviewerUid &&
    Boolean(r.id && r.scope.clientId && r.scope.engagementId) && Number.isInteger(r.scope.taxYear) && r.scope.taxYear >= 2022 &&
    Number.isInteger(r.activeStage) && r.activeStage >= 1 && r.activeStage <= 18);
}
export function reviewFilter(row: ReviewerQueueCase, filter: string, today: string) {
  const terminal = ['CLOSED','ARCHIVED'].includes(row.caseStatus);
  switch (filter) {
    case 'Ready for Review': return ['Ready for Review','Awaiting Approval'].includes(row.reviewStatus);
    case 'High Risk': return row.highRisk;
    case 'Exceptions': return row.openExceptions > 0;
    case 'Returned': case 'Awaiting Approval': return row.reviewStatus === filter;
    case 'Due Today': return !terminal && row.dueDate?.slice(0,10) === today;
    case 'Overdue': return !terminal && Boolean(row.dueDate && row.dueDate.slice(0,10) < today);
    default: return true;
  }
}
export function reviewerDecisionBlock(snapshot: ReviewerSnapshot, ret: ReviewerReturn | undefined, decision: 'APPROVE' | 'RETURN') {
  if (!ret) return 'Select a recorded return.';
  if (!sameReviewScope(ret, snapshot.scope)) return 'Return scope does not match this case.';
  if (!snapshot.decisionsAvailable) return 'Durable reviewer decision storage is unavailable. Production decisions remain blocked.';
  if (!snapshot.independentReviewer) return 'Independent, assigned reviewer with valid professional credentials required.';
  if (ret.createdBy === snapshot.case.reviewerUid) return 'Maker-checker prevents reviewing your own return artifact.';
  if (snapshot.case.status !== 'ACTIVE' && !(decision === 'RETURN' && snapshot.case.status === 'BLOCKED')) return 'Case is not open for this decision.';
  if (decision === 'RETURN') return [6,9,10].includes(snapshot.case.activeStage) && ['DRAFT','DIAGNOSTIC_FAILED','READY_FOR_PREPARER_REVIEW','PREPARER_CERTIFIED'].includes(ret.status) ? '' : 'This return cannot be returned at its current stage/status.';
  if (snapshot.case.activeStage !== 10 || ret.status !== 'PREPARER_CERTIFIED' || ret.preparerCertifiedBy !== snapshot.case.preparerUid) return 'Approval requires Stage 10 and the assigned preparer’s certification.';
  if (snapshot.case.openExceptions > 0) return 'Unresolved exceptions block approval.';
  if (ret.diagnostics?.some(d => d.severity === 'CRITICAL_BLOCKING' && !d.resolved)) return 'Unresolved critical diagnostics block approval.';
  return '';
}
