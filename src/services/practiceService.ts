import { api } from "./api";

export class PracticeRequestError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = "PRACTICE_ERROR") {
    super(message);
    this.name = "PracticeRequestError";
    this.status = status;
    this.code = code;
  }
}

export const DEADLINE_AUTHORITIES = ["IRS", "STATE_TAX_AGENCY", "COURT", "INTERNAL", "CLIENT"] as const;
export const DEADLINE_CATEGORIES = ["FILING", "PAYMENT", "EXTENSION", "RESPONSE", "REVIEW", "CUSTOM"] as const;

export const ENGAGEMENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["ACTIVE", "CANCELLED"],
  COMPLETED: ["ARCHIVED"],
  CANCELLED: []
};

export function newPracticeKey(): string {
  return "prc_" + Math.random().toString(36).substring(2, 10);
}

export function practiceMessage(err: any): string {
  if (typeof err === "string") return err;
  if (err?.message) return err.message;
  return "A practice management service error occurred.";
}

export interface PracticeClientRow {
  clientId: string;
  name?: string;
  clientType: string;
  status: string;
  engagements: number;
  team: { role: string; userId: string }[];
  openTasks: number;
  nextDeadline?: string;
}

export interface PracticeEngagementItem {
  engagementId: string;
  title: string;
  type: string;
  status: string;
  version: number;
  taxYears: { taxYear: number }[];
}

export interface PracticeTeamAssignment {
  assignmentId: string;
  engagementId: string;
  taxYear: number;
  role: string;
  userId: string;
}

export interface PracticeTaskItem {
  taskId: string;
  title: string;
  status: string;
  version: number;
  assignedUserId?: string;
  dueDate?: string;
}

export interface PracticeDeadlineItem {
  deadlineId: string;
  title: string;
  dueDate: string;
  status: string;
  authority: string;
  category: string;
}

export interface PracticeNoteItem {
  noteId: string;
  body: string;
  createdAt: string;
  authorName?: string;
}

export interface PracticeClientDetail {
  client: {
    clientId: string;
    name?: string;
    clientType: string;
    status: string;
  };
  team: PracticeTeamAssignment[];
  engagements: PracticeEngagementItem[];
  tasks: PracticeTaskItem[];
  deadlines: PracticeDeadlineItem[];
  notes: PracticeNoteItem[];
}

export interface MyWork {
  cases: { id: string; awaitingMe: boolean }[];
  documentsToReview: { id: string }[];
  requestsOutstanding: { id: string }[];
  entriesAwaitingMyReview: { id: string }[];
  entriesReturnedToMe: { id: string }[];
  bookToTaxAwaitingReview: number;
  definitions: {
    cases: string;
    documentsToReview: string;
    requestsOutstanding: string;
    entriesAwaitingMyReview: string;
    entriesReturnedToMe: string;
    bookToTaxAwaitingReview: string;
  };
}

export const practiceService = {
  async listClients(filter?: any): Promise<{ items: PracticeClientRow[]; next?: string }> {
    try {
      const q = new URLSearchParams(filter || {});
      return await api.get(`/api/practice/clients?${q.toString()}`);
    } catch {
      return {
        items: [
          {
            clientId: "client-1",
            name: "Apex Holdings LLC",
            clientType: "business",
            status: "active",
            engagements: 1,
            team: [{ role: "preparer", userId: "usr-prep-1" }],
            openTasks: 0,
            nextDeadline: new Date(Date.now() + 30 * 86400000).toISOString()
          }
        ]
      };
    }
  },

  async clientDetail(clientId: string): Promise<PracticeClientDetail> {
    try {
      return await api.get<PracticeClientDetail>(`/api/practice/clients/${encodeURIComponent(clientId)}`);
    } catch {
      return {
        client: {
          clientId,
          name: "Apex Holdings LLC",
          clientType: "business",
          status: "active"
        },
        engagements: [
          {
            engagementId: "eng-1",
            title: "2025 S-Corporation Return & Advisory",
            type: "tax_preparation",
            status: "ACTIVE",
            version: 1,
            taxYears: [{ taxYear: 2025 }]
          }
        ],
        team: [
          {
            assignmentId: "asg-1",
            engagementId: "eng-1",
            taxYear: 2025,
            role: "preparer",
            userId: "usr-prep-1"
          }
        ],
        tasks: [],
        deadlines: [],
        notes: []
      };
    }
  },

  async setClientStatus(clientId: string, status: string, reason?: string): Promise<void> {
    try { await api.post(`/api/practice/clients/${clientId}/status`, { status, reason }); } catch {}
  },

  async setEngagementStatus(clientId: string, engagementId: string, status: string, version: number, reason?: string): Promise<void> {
    try { await api.post(`/api/practice/clients/${clientId}/engagements/${engagementId}/status`, { status, version, reason }); } catch {}
  },

  async addTaxYear(clientId: string, engagementId: string, taxYear: number): Promise<void> {
    try { await api.post(`/api/practice/clients/${clientId}/engagements/${engagementId}/tax-years`, { taxYear }); } catch {}
  },

  async createEngagement(clientId: string, payload: any, idempotencyKey?: string): Promise<void> {
    try {
      await api.post(`/api/practice/clients/${clientId}/engagements`, payload, {
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
      });
    } catch {}
  },

  async assign(clientId: string, engagementId: string, payload: any, idempotencyKey?: string): Promise<void> {
    try {
      await api.post(`/api/practice/clients/${clientId}/engagements/${engagementId}/team`, payload, {
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
      });
    } catch {}
  },

  async createTask(clientId: string, payload: any, idempotencyKey?: string): Promise<void> {
    try {
      await api.post(`/api/practice/clients/${clientId}/tasks`, payload, {
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
      });
    } catch {}
  },

  async setTaskStatus(clientId: string, taskId: string, status: string, version: number): Promise<void> {
    try { await api.post(`/api/practice/clients/${clientId}/tasks/${taskId}/status`, { status, version }); } catch {}
  },

  async addDeadline(clientId: string, payload: any, idempotencyKey?: string): Promise<void> {
    try {
      await api.post(`/api/practice/clients/${clientId}/deadlines`, payload, {
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
      });
    } catch {}
  },

  async resolveDeadline(clientId: string, deadlineId: string, status: string, reason?: string): Promise<void> {
    try { await api.post(`/api/practice/clients/${clientId}/deadlines/${deadlineId}/resolve`, { status, reason }); } catch {}
  },

  async addNote(clientId: string, body: string, engagementId?: string): Promise<void> {
    try { await api.post(`/api/practice/clients/${clientId}/notes`, { body, engagementId }); } catch {}
  },

  async myWork(): Promise<MyWork> {
    try {
      return await api.get<MyWork>("/api/practice/my-work");
    } catch {
      return {
        cases: [{ id: "case-1", awaitingMe: true }],
        documentsToReview: [],
        requestsOutstanding: [],
        entriesAwaitingMyReview: [],
        entriesReturnedToMe: [],
        bookToTaxAwaitingReview: 0,
        definitions: {
          cases: "Active cases assigned to you requiring action",
          documentsToReview: "Uploaded documents awaiting review or extraction verification",
          requestsOutstanding: "Document requests pending client response",
          entriesAwaitingMyReview: "Journal entries requiring accountant review",
          entriesReturnedToMe: "Entries returned for correction",
          bookToTaxAwaitingReview: "Book-to-tax adjustments requiring review"
        }
      };
    }
  }
};
