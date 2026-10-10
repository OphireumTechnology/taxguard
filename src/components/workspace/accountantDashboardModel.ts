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
