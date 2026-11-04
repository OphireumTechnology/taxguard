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

export interface MyWork {
  cases: Array<{ id: string; clientName: string; stage: number; awaitingMe: boolean }>;
  documentsToReview: Array<{ id: string; fileName: string; clientName: string }>;
  reconciliationTasks: Array<{ id: string; description: string }>;
  tasks: Array<{ id: string; title: string }>;
  definitions: {
    cases: string;
    documentsToReview: string;
    reconciliationTasks: string;
    tasks: string;
  };
}

export interface PracticeClientRow {
  clientId: string;
  name: string;
  companyName: string;
  status: string;
  activeEngagements?: number;
}

export interface PracticeClientDetail {
  client: { clientId: string; name: string; companyName: string; status: string };
  engagements: any[];
  team: Array<{ userId: string; name: string; role: string }>;
  tasks: any[];
  deadlines: any[];
  notes: any[];
}

export const practiceService = {
  myWork: async (): Promise<MyWork> => ({
    cases: INITIAL_ENGAGEMENTS.map(e => ({ id: e.id, clientName: e.clientName, stage: 3, awaitingMe: true })),
    documentsToReview: [],
    reconciliationTasks: [],
    tasks: [],
    definitions: {
      cases: 'Tax preparation cases assigned to current staff',
      documentsToReview: 'Uploaded documents pending preparer review',
      reconciliationTasks: 'Bookkeeping reconciliation items',
      tasks: 'Operational action items'
    }
  }),
  summary: async (taxYear?: number) => ({
    activeClientsCount: 42,
    openEngagementsCount: 28,
    unassignedCasesCount: 2,
    onTrackRate: 94,
    byRole: { accountant: 12, reviewer: 4, bookkeeper: 3 }
  }),
  getClients: async () => INITIAL_USERS.filter(u => u.role === 'client'),
  listClients: async (filter?: any): Promise<{ items: PracticeClientRow[]; next: string | null }> => ({
    items: INITIAL_USERS.filter(u => u.role === 'client').map(c => ({
      clientId: c.id,
      name: c.name,
      companyName: c.companyName || '',
      status: c.status
    })),
    next: null
  }),
  clientDetail: async (clientId: string): Promise<PracticeClientDetail> => ({
    client: { clientId, name: 'Michael Perotti', companyName: 'Perotti Holdings', status: 'ACTIVE' },
    engagements: [],
    team: [{ userId: 'usr_staff_desmond', name: 'Desmond Hinds', role: 'accountant' }],
    tasks: [],
    deadlines: [],
    notes: []
  }),
  workload: async (userId?: string) => ({
    activeCases: 6,
    openTasks: 4,
    dueThisWeek: 2
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
