import { INITIAL_USERS, INITIAL_ENGAGEMENTS } from '../data/mockData';

export const DEADLINE_AUTHORITIES = ['IRS', 'STATE_DOR', 'COURT', 'INTERNAL'] as const;
export const DEADLINE_CATEGORIES = ['STATUTORY_RETURN', 'ESTIMATED_PAYMENT', 'EXTENSION_REQUEST', 'NOTICE_RESPONSE'] as const;

export const ENGAGEMENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['SUSPENDED', 'COMPLETED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: []
};

export function newPracticeKey(): string {
  return 'prac_key_' + Math.random().toString(36).slice(2) + '_' + Date.now();
}

export class PracticeRequestError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'PracticeRequestError';
    this.status = status;
  }
}

export function practiceMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Practice operation error';
}

export interface MyWorkCase {
  id?: string;
  caseId: string;
  clientId: string;
  clientName?: string;
  taxYear: number;
  stage?: number;
  activeStage: number;
  status: string;
  myRole: string;
  evidence?: string;
  awaitingMe: boolean;
  [key: string]: any;
}

export interface MyWorkDocument {
  id?: string;
  documentId: string;
  version: number | string;
  fileName: string;
  clientId: string;
  taxYear: number;
  clientName?: string;
  [key: string]: any;
}

export interface MyWorkRequest {
  requestId: string;
  title: string;
  clientId: string;
  taxYear: number;
  overdue?: boolean;
  [key: string]: any;
}

export interface MyWorkEntry {
  entryId: string;
  entryNumber: string;
  description: string;
  clientId: string;
  [key: string]: any;
}

export interface MyWork {
  cases: MyWorkCase[];
  documentsToReview: MyWorkDocument[];
  reconciliationTasks: Array<{ id: string; description: string; [key: string]: any }>;
  tasks: Array<{ id: string; title: string; [key: string]: any }>;
  requestsOutstanding: MyWorkRequest[];
  entriesAwaitingMyReview: any[];
  entriesReturnedToMe: MyWorkEntry[];
  bookToTaxAwaitingReview: number;
  definitions: {
    cases: string;
    documentsToReview: string;
    reconciliationTasks?: string;
    tasks?: string;
    requestsOutstanding: string;
    entriesAwaitingMyReview: string;
    entriesReturnedToMe: string;
    bookToTaxAwaitingReview: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export type EscalationLevelName = 'INFO' | 'WARNING' | 'CRITICAL' | 'URGENT' | string;
export type DeadlineEscalations = any;
export type PracticeSearch = any;
export type StaffNotifications = any;
export type PracticeSummary = any;

export interface PracticeClientRow {
  clientId: string;
  name: string;
  companyName: string;
  status: string;
  activeEngagements?: number;
  clientType?: string;
  engagements?: any[];
  team?: any[];
  openTasks?: number;
  nextDeadline?: string;
  [key: string]: any;
}

export interface PracticeClientDetail {
  client: { clientId: string; name: string; companyName: string; status: string; clientType?: string; [key: string]: any };
  engagements: any[];
  team: Array<{ userId: string; name: string; role: string; assignmentId?: string; engagementId?: string; taxYear?: number; [key: string]: any }>;
  tasks: any[];
  deadlines: any[];
  notes: any[];
  activity?: any[];
  [key: string]: any;
}

export interface Workload {
  userId?: string;
  role: string;
  openTasks: number;
  overdueTasks: number;
  byStatus: Record<string, number>;
  assignedClients: number;
  assignedEngagements: number;
  clientWideAssignments: number;
  definitions?: any;
  [key: string]: any;
}

export const practiceService = {
  myWork: async (): Promise<MyWork> => ({
    cases: INITIAL_ENGAGEMENTS.map(e => ({
      id: e.id,
      caseId: e.id,
      clientId: e.clientId || 'client_001',
      clientName: e.clientName,
      taxYear: e.taxYear || 2025,
      stage: 3,
      activeStage: 3,
      status: e.status || 'ACTIVE',
      myRole: 'preparer',
      evidence: 'VERIFIED',
      awaitingMe: true
    })),
    documentsToReview: [],
    reconciliationTasks: [],
    tasks: [],
    requestsOutstanding: [],
    entriesAwaitingMyReview: [],
    entriesReturnedToMe: [],
    bookToTaxAwaitingReview: 0,
    definitions: {
      cases: 'Tax preparation cases assigned to current staff',
      documentsToReview: 'Uploaded documents pending preparer review',
      reconciliationTasks: 'Bookkeeping reconciliation items',
      tasks: 'Operational action items',
      requestsOutstanding: 'Document requests pending client response',
      entriesAwaitingMyReview: 'Accounting ledger entries awaiting review',
      entriesReturnedToMe: 'Entries returned for correction',
      bookToTaxAwaitingReview: 'Book-to-tax reconciliation items awaiting review'
    }
  }),
  summary: async (taxYear?: number) => ({
    activeClientsCount: 42,
    openEngagementsCount: 28,
    unassignedCasesCount: 2,
    onTrackRate: 94,
    byRole: { accountant: 12, reviewer: 4, bookkeeper: 3 },
    staffCaseCounts: [
      { userId: 'usr_staff_desmond', activeCases: 6 },
      { userId: 'usr_staff_elena', activeCases: 4 }
    ]
  }),
  getClients: async () => INITIAL_USERS.filter(u => u.role === 'client'),
  listClients: async (_filter?: any): Promise<{ items: PracticeClientRow[]; next: string | null; nextCursor: string | null }> => ({
    items: INITIAL_USERS.filter(u => u.role === 'client').map(c => ({
      clientId: c.id,
      name: c.name,
      companyName: c.companyName || '',
      status: c.status,
      clientType: 'entity',
      engagements: [],
      team: [],
      openTasks: 0,
      nextDeadline: '2026-04-15'
    })),
    next: null,
    nextCursor: null
  }),
  clientDetail: async (clientId: string): Promise<PracticeClientDetail> => ({
    client: { clientId, name: 'Michael Perotti', companyName: 'Perotti Holdings', status: 'ACTIVE', clientType: 'entity' },
    engagements: [],
    team: [{ userId: 'usr_staff_desmond', name: 'Desmond Hinds', role: 'accountant', assignmentId: 'asg_1', engagementId: 'eng_001', taxYear: 2025 }],
    tasks: [],
    deadlines: [],
    notes: [],
    activity: []
  }),
  workload: async (userId?: string): Promise<Workload> => ({
    userId,
    role: 'accountant',
    openTasks: 4,
    overdueTasks: 1,
    byStatus: {
      READY_FOR_REVIEW: 2,
      WAITING_ON_CLIENT: 1
    },
    assignedClients: 8,
    assignedEngagements: 12,
    clientWideAssignments: 2
  }),
  deadlineEscalations: async (minLevel?: number) => [],
  notifications: async () => [],
  markNotificationRead: async (id: string) => ({ success: true }),
  search: async (query: string, limit?: number) => [],
  setEngagementStatus: async (...args: any[]) => ({ success: true }),
  addTaxYear: async (...args: any[]) => ({ success: true }),
  createEngagement: async (...args: any[]) => ({ success: true }),
  assign: async (...args: any[]) => ({ success: true }),
  setTaskStatus: async (...args: any[]) => ({ success: true }),
  reassignTask: async (...args: any[]) => ({ success: true }),
  createTask: async (...args: any[]) => ({ success: true }),
  resolveDeadline: async (...args: any[]) => ({ success: true }),
  addDeadline: async (...args: any[]) => ({ success: true }),
  addNote: async (...args: any[]) => ({ success: true }),
  setClientStatus: async (...args: any[]) => ({ success: true })
};
