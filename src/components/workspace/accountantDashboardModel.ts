import type { DocumentItem } from '../../types';

export interface AccountantCase {
  id: string; tenantId: string; clientId: string; clientName: string;
  engagementId: string; authorityClientId: string; taxYear: number; status: string; priority: string;
  dueDate?: string; serviceTitle: string; documents: DocumentItem[];
  activeStage?: number;
  context?: { filingStatus?: string; state?: string; dependents?: number };
}
export const ACCOUNTANT_STAGES = ['Onboard','Collect','Validate','Record','Reconcile','Review','Report','Plan','Prepare Taxes','Approve','Sign','File','Government Feedback','Resolve','Monitor','Archive','Renew','Repeat'];
// Presentation projections of the persisted engine; never transition workflow.
export const ACCOUNTANT_JOURNEY = [
  { label: 'Review Client Info & Questionnaire', stages: [1] },
  { label: 'Verify & Reconcile Documents', stages: [2,3,4,5] },
  { label: 'AI Prepare Federal Forms', stages: [9] },
  { label: 'AI Prepare State Forms', stages: [9] },
  { label: 'Review, Edit & Approve', stages: [10] },
  { label: 'Client Signs & Approves', stages: [11] },
  { label: 'Senior Review', stages: [6,7,8] },
  { label: 'File to IRS & State', stages: [12] },
  { label: 'Track Status & Close', stages: [13,14,15,16,17,18] },
];
export const KPI_LABELS = ['Assigned Cases','Due Today','Overdue','Waiting on Client','Ready for Review','In Preparation','Client Approval','Ready to File','Filed This Month'];
export function safeCases(rows: AccountantCase[], tenantId: string) {
  return rows.filter(r => r.tenantId === tenantId && Boolean(r.clientId && r.engagementId && r.id) && Number.isInteger(r.taxYear) && r.taxYear >= 2022)
    .map(r => ({ ...r, documents: r.documents.filter(d => d.clientId === r.clientId && d.taxYear === r.taxYear) }));
}
export function matchesQueue(r: AccountantCase, filter: string, today: string) {
  const closed = ['filed','completed','closed','archived'].includes(r.status);
  const overdue = Boolean(r.dueDate && r.dueDate.slice(0,10) < today && !closed);
  switch (filter) {
    case 'Due Today': return !closed && r.dueDate?.slice(0,10) === today;
    case 'Overdue': return overdue;
    case 'Needs Attention': return overdue || r.priority === 'urgent' || r.status === 'client_action_required';
    case 'Waiting on Client': return ['awaiting_client','client_action_required'].includes(r.status);
    case 'Ready for Review': return r.status === 'review_needed';
    case 'In Preparation': return r.status === 'in_preparation';
    case 'Client Approval': return r.activeStage === 10;
    // No filed timestamp or filing readiness certificate in this contract.
    case 'Ready to File': case 'Filed This Month': return false;
    default: return true;
  }
}
export function confidence(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? `${value}% · human review required` : 'Not reported';
}

// ---------------------------------------------------------------------------------------------
// Dashboard presentation helpers (pure). An unavailable metric is never rendered as zero.
// ---------------------------------------------------------------------------------------------
export type DashboardDataState = 'loading' | 'ready' | 'error' | 'inspection';
export type KpiValue =
  | { state: 'value'; count: number }
  | { state: 'loading' }
  | { state: 'unavailable'; reason: string };

export const DASHBOARD_KPIS: ReadonlyArray<{ label: string; hint: string }> = [
  { label: 'Assigned Cases', hint: 'All authorized cases' },
  { label: 'Due Today', hint: 'Recorded due date is today' },
  { label: 'Overdue', hint: 'Past recorded due date' },
  { label: 'Waiting on Client', hint: 'Client action required' },
  { label: 'Ready for Review', hint: 'Marked review needed' },
  { label: 'Client Approval', hint: 'Workflow stage 10' },
  { label: 'Ready to File', hint: 'Filing readiness' },
];

export function kpiValue(label: string, rows: AccountantCase[], today: string, state: DashboardDataState, unavailableFields: readonly string[] = []): KpiValue {
  if (state === 'inspection') return { state: 'unavailable', reason: 'Inspection mode: no case data loaded' };
  if (state === 'loading') return { state: 'loading' };
  if (state === 'error') return { state: 'unavailable', reason: 'Case data could not be loaded' };
  if ((label === 'Due Today' || label === 'Overdue') && unavailableFields.includes('dueDate')) return { state: 'unavailable', reason: 'Due dates are not recorded in the case store' };
  if (label === 'Ready to File') return { state: 'unavailable', reason: 'No verified filing-readiness record' };
  if (label === 'Client Approval') {
    const missing = rows.filter(r => !r.activeStage).length;
    if (missing) return { state: 'unavailable', reason: `Workflow stage not verified for ${missing} case${missing === 1 ? '' : 's'}` };
  }
  return { state: 'value', count: rows.filter(r => matchesQueue(r, label, today)).length };
}

/** Counts per authoritative stage (index 0 = stage 01). Cases without a verified stage are counted separately. */
export function stageCounts(rows: AccountantCase[]): { counts: number[]; unverified: number } {
  const counts = ACCOUNTANT_STAGES.map(() => 0);
  let unverified = 0;
  for (const r of rows) {
    if (r.activeStage && Number.isInteger(r.activeStage) && r.activeStage >= 1 && r.activeStage <= ACCOUNTANT_STAGES.length) counts[r.activeStage - 1] += 1;
    else unverified += 1;
  }
  return { counts, unverified };
}

export type QueueSortKey = 'client' | 'taxYear' | 'stage' | 'priority' | 'dueDate';
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, normal: 2, low: 3 };

/** Stable sort; records without a value (no due date, no verified stage, unknown priority) always sort last. */
export function sortCases(rows: AccountantCase[], key: QueueSortKey, direction: 'asc' | 'desc'): AccountantCase[] {
  const value = (r: AccountantCase): string | number | undefined => {
    switch (key) {
      case 'client': return r.clientName?.toLowerCase();
      case 'taxYear': return r.taxYear;
      case 'stage': return r.activeStage || undefined;
      case 'priority': return r.priority in PRIORITY_RANK ? PRIORITY_RANK[r.priority] : undefined;
      case 'dueDate': return r.dueDate ? r.dueDate.slice(0, 10) : undefined;
    }
  };
  const factor = direction === 'asc' ? 1 : -1;
  return rows.map((r, i) => ({ r, i, v: value(r) })).sort((a, b) => {
    if (a.v === undefined && b.v === undefined) return a.i - b.i;
    if (a.v === undefined) return 1;
    if (b.v === undefined) return -1;
    const c = a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
    return c ? c * factor : a.i - b.i;
  }).map(x => x.r);
}

const CLOSED_STATUSES = ['completed', 'closed', 'archived', 'filed'];
/** Recorded engagement due dates from today onwards, soonest first. Statutory deadlines are not inferred. */
export function upcomingDeadlines(rows: AccountantCase[], today: string, limit = 5): AccountantCase[] {
  return rows.filter(r => r.dueDate && r.dueDate.slice(0, 10) >= today && !CLOSED_STATUSES.includes(r.status))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, limit);
}

/** Whole days from today (YYYY-MM-DD) to a due date, in UTC calendar days. */
export function daysUntil(dueDate: string, today: string): number {
  return Math.round((Date.parse(dueDate.slice(0, 10) + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86_400_000);
}
