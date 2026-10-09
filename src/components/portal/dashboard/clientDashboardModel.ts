import type { Appointment, DocumentItem, Engagement, Invoice, Message, User } from '../../../types';
import type { GeneratedDocumentRequirement, StoredQuestionnaireRecord } from '../../../server/taxguard/taxQuestionnaire';

export interface ClientScope { userId: string; clientId: string; tenantId: string; taxYear: number }
export interface DashboardRequest { id: string; clientId: string; tenantId: string; taxYear: number; title?: string; subject?: string; description?: string; message?: string; status: string; dueDate?: string; createdAt?: string }
export interface DashboardWorkflow { clientId: string; taxYear: number; activeStage: number; environment?: string; [key: string]: unknown }
export interface Resource<T> { status: 'loading' | 'ready' | 'unavailable'; data: T | null }
export interface ClientDashboardData {
  documents: Resource<DocumentItem[]>;
  engagements: Resource<Engagement[]>;
  messages: Resource<Message[]>;
  appointments: Resource<Appointment[]>;
  invoices: Resource<Invoice[]>;
  questionnaire: Resource<StoredQuestionnaireRecord>;
  requirements: Resource<GeneratedDocumentRequirement[]>;
  requests: Resource<DashboardRequest[]>;
}
export const emptyDashboardData = (status: Resource<unknown>['status'] = 'loading'): ClientDashboardData => ({
  documents: { status, data: null }, engagements: { status, data: null }, messages: { status, data: null },
  appointments: { status, data: null }, invoices: { status, data: null }, questionnaire: { status, data: null },
  requirements: { status, data: null }, requests: { status, data: null },
});
export const CLIENT_JOURNEY = [
  { label: 'Getting Started', stages: [1], description: 'Profile and consent' },
  { label: 'Documents', stages: [2, 3], description: 'Collection and validation' },
  { label: 'Review', stages: [4, 5, 6, 7, 8], description: 'Records and professional review' },
  { label: 'Tax Preparation', stages: [9], description: 'Prepare federal and state forms' },
  { label: 'Approval & Signature', stages: [10, 11], description: 'Review and authorized signature' },
  { label: 'Filing', stages: [12, 13, 14], description: 'Filing, feedback and resolution' },
  { label: 'Completed', stages: [15, 16, 17, 18], description: 'Monitoring, records and renewal' },
];
export function validClientScope(user: User | null, clientId: string, taxYear: number, authState: string): user is User {
  return Boolean(user && authState === 'AUTHENTICATED' && user.role === 'client' && user.status === 'active'
    && user.clientId?.trim() === clientId && user.tenantId && Number.isInteger(taxYear) && taxYear >= 2022);
}
export function scopedWorkflow(workflow: DashboardWorkflow | null | undefined, scope: ClientScope): DashboardWorkflow | null {
  return workflow?.clientId === scope.clientId && workflow.taxYear === scope.taxYear && workflow.environment === 'live'
    && Number.isInteger(workflow.activeStage) && workflow.activeStage >= 1 && workflow.activeStage <= 18 ? workflow : null;
}
export function projectClientJourney(workflow: DashboardWorkflow | null | undefined, scope: ClientScope) {
  const verified = scopedWorkflow(workflow, scope);
  return CLIENT_JOURNEY.map(step => ({ ...step, status: !verified ? 'unavailable' : step.stages.includes(verified.activeStage) ? 'current' : Math.max(...step.stages) < verified.activeStage ? 'completed' : 'upcoming' }));
}
const tenantMatches = (record: unknown, scope: ClientScope) => {
  const tenantId = (record as { tenantId?: string }).tenantId;
  return tenantId === undefined || tenantId === scope.tenantId;
};
export function scopeDocuments(rows: DocumentItem[], scope: ClientScope) {
  return rows.filter(row => row.clientId === scope.clientId && tenantMatches(row, scope) && Number.isInteger(row.taxYear) && row.taxYear >= 2022);
}
export function scopeEngagements(rows: Engagement[], scope: ClientScope) {
  return rows.filter(row => row.clientId === scope.clientId && tenantMatches(row, scope) && Number.isInteger(row.taxYear) && row.taxYear >= 2022);
}
export function scopeMessages(rows: Message[], engagements: Engagement[], scope: ClientScope) {
  const validEngagements = new Set(engagements.filter(e => e.taxYear === scope.taxYear).map(e => e.id));
  return rows.filter(row => tenantMatches(row, scope) && !row.isInternalNote && !row.isInternalOnly
    && (!row.clientId || row.clientId === scope.clientId)
    && (row.senderId === scope.userId || row.recipientId === scope.userId)
    && (!row.engagementId || validEngagements.has(row.engagementId)))
    .sort((a, b) => Date.parse(b.createdAt || b.timestamp || '') - Date.parse(a.createdAt || a.timestamp || ''));
}
export function scopeRequirements(rows: GeneratedDocumentRequirement[], scope: ClientScope) {
  return rows.filter(row => row.clientId === scope.clientId && row.tenantId === scope.tenantId && row.taxYear === scope.taxYear);
}
export function scopeRequests(rows: DashboardRequest[], scope: ClientScope) {
  return rows.filter(row => row.clientId === scope.clientId && row.tenantId === scope.tenantId && row.taxYear === scope.taxYear);
}
export function scopeInvoices(rows: Invoice[], scope: ClientScope) {
  return rows.filter(row => [scope.clientId, scope.userId].includes(row.clientId) && tenantMatches(row, scope));
}
export function scopeAppointments(rows: Appointment[], scope: ClientScope) {
  // Email-only matches are not strong enough for dashboard presentation.
  return rows.filter(row => Boolean(row.clientId && [scope.clientId, scope.userId].includes(row.clientId)) && tenantMatches(row, scope));
}
export function requirementLabel(status: string) {
  return ({ Accepted: 'Received', Received: 'Received', Rejected: 'Replacement Required', 'Not Applicable': 'Not Applicable', Requested: 'Missing' } as Record<string, string>)[status] || status;
}
export function deriveNextAction(data: ClientDashboardData, workflow: DashboardWorkflow | null) {
  const open = data.requests.data?.find(r => ['OPEN', 'IN_PROGRESS', 'PENDING', 'REQUESTED', 'AWAITING_CLIENT', 'NEEDS_RESPONSE'].includes(r.status.toUpperCase()));
  if (open) return { title: 'Respond to your advisor’s request', explanation: open.title || open.subject || 'Your advisor needs additional information.', target: 'requests', required: true };
  if (!workflow) return { title: 'Workflow status unavailable', explanation: 'Refresh the workspace to verify the current stage.', target: 'refresh', required: false };
  if (workflow.activeStage === 1) return { title: 'Complete your onboarding', explanation: 'Confirm your profile and required consent in the onboarding workspace.', target: 'stage_01', required: true };
  const missing = data.requirements.data?.find(r => ['Required', 'Missing', 'Requested', 'Rejected'].includes(r.status) && r.priority === 'Required');
  if (missing) return { title: requirementLabel(missing.status) === 'Replacement Required' ? 'Replace a document' : 'Complete your document checklist', explanation: missing.title, target: 'checklist', required: true };
  if (data.questionnaire.status === 'ready' && !data.questionnaire.data && workflow.activeStage <= 3) return { title: 'Complete your questionnaire', explanation: 'Provide your tax-year facts to personalize the document checklist.', target: 'questionnaire', required: true };
  if (data.requests.status !== 'ready' || data.requirements.status !== 'ready') return { title: 'Some action information is unavailable', explanation: 'Open your workspace or refresh to check for outstanding requirements.', target: 'refresh', required: false };
  if ([10, 11].includes(workflow.activeStage)) return { title: 'Open your approval workspace', explanation: 'Check the authorized return review and signature controls. Completion requires the existing approval gates.', target: `stage_${workflow.activeStage}`, required: true };
  return { title: 'Your team is working on your return', explanation: 'No outstanding client request or required checklist item is reported. Human review and filing approval remain required.', target: 'tax_return', required: false };
}
