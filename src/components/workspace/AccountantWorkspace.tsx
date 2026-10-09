import { AccountantDashboard } from './AccountantDashboard';
export interface AssignedCase {
  caseId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  activeStage: number;
  stageName: string;
  status: string;
  unreviewedDocsCount: number;
  unresolvedExceptionsCount: number;
  dueDate?: string;
  isDueToday?: boolean;
  isOverdue?: boolean;
  isWaitingOnClient?: boolean;
  isSignatureBlocked?: boolean;
  isFilingBlocked?: boolean;
  hasRejection?: boolean;
  rejectionNotice?: string;
  hasNotice?: boolean;
  noticeReference?: string;
  updatedAt: string;
}

export type OperationalQueueId =
  | 'all'
  | 'needs_attention'
  | 'due_today'
  | 'overdue'
  | 'waiting_on_client'
  | 'documents_received'
  | 'ready_for_validation'
  | 'ready_for_preparation'
  | 'ready_for_review'
  | 'ready_for_approval'
  | 'signature_blocked'
  | 'filing_blocked'
  | 'government_rejections'
  | 'notices'
  | 'upcoming_deadlines';

interface QueueDefinition {
  id: OperationalQueueId;
  label: string;
  description: string;
  badgeClass: string;
}

export const OPERATIONAL_QUEUES: QueueDefinition[] = [
  { id: 'all', label: 'All Dossiers', description: 'Complete portfolio of active tax engagements', badgeClass: 'bg-slate-800 text-slate-300' },
  { id: 'needs_attention', label: 'Needs Attention', description: 'Cases with exceptions, notices, or blocked dependencies', badgeClass: 'bg-red-950 text-red-300 border border-red-500/30' },
  { id: 'due_today', label: 'Due Today', description: 'Statutory or client commitment deadlines due today', badgeClass: 'bg-amber-950 text-amber-300 border border-amber-500/30' },
  { id: 'overdue', label: 'Overdue', description: 'Past-due filing or compliance action milestones', badgeClass: 'bg-rose-950 text-rose-300 border border-rose-500/30 font-bold' },
  { id: 'waiting_on_client', label: 'Waiting on Client', description: 'Open RFI questionnaires or missing document requests', badgeClass: 'bg-blue-950 text-blue-300 border border-blue-500/30' },
  { id: 'documents_received', label: 'Documents Received', description: 'New evidence uploaded and awaiting intake verification', badgeClass: 'bg-emerald-950 text-emerald-300 border border-emerald-500/30' },
  { id: 'ready_for_validation', label: 'Ready for Validation', description: 'Stage 03: Primary evidence inspection & OCR tie-out', badgeClass: 'bg-indigo-950 text-indigo-300 border border-indigo-500/30' },
  { id: 'ready_for_preparation', label: 'Ready for Preparation', description: 'Stage 04–09: Verified records ready for Form 1040 prep', badgeClass: 'bg-purple-950 text-purple-300 border border-purple-500/30' },
  { id: 'ready_for_review', label: 'Ready for Review', description: 'Stage 06 & 10: Senior CPA quality control review queue', badgeClass: 'bg-amber-950 text-amber-300 border border-amber-500/30' },
  { id: 'ready_for_approval', label: 'Ready for Approval', description: 'Stage 10: Client draft approval pending', badgeClass: 'bg-cyan-950 text-cyan-300 border border-cyan-500/30' },
  { id: 'signature_blocked', label: 'Signature Blocked', description: 'Stage 11: Form 8879 awaiting taxpayer e-signature', badgeClass: 'bg-orange-950 text-orange-300 border border-orange-500/30' },
  { id: 'filing_blocked', label: 'Filing Blocked', description: 'Stage 12: Transmitter gateway fail-closed / awaiting auth', badgeClass: 'bg-red-950 text-red-300 border border-red-500/30' },
  { id: 'government_rejections', label: 'Government Rejections', description: 'Stage 13/14: IRS or SCDOR reject notices requiring cure', badgeClass: 'bg-rose-950 text-rose-300 border border-rose-500/30' },
  { id: 'notices', label: 'Notices', description: 'Stage 14: Agency correspondence (CP2000, 5071C, etc.)', badgeClass: 'bg-amber-950 text-amber-300 border border-amber-500/30' },
  { id: 'upcoming_deadlines', label: 'Upcoming Deadlines', description: 'Statutory filing or estimated payment deadlines < 14 days', badgeClass: 'bg-slate-800 text-slate-200 border border-slate-700' }
];


export const AccountantWorkspace = AccountantDashboard;
