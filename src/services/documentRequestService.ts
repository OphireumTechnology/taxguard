export function requestMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Document request operation failed.';
}

export function requestStatusText(status: string): string {
  switch (status) {
    case 'FULFILLED': return 'Fulfilled';
    case 'SUBMITTED': return 'Submitted';
    case 'OPEN': return 'Open';
    case 'WAIVED': return 'Waived by Preparer';
    case 'CANCELLED': return 'Cancelled';
    default: return 'Pending Upload';
  }
}

export interface ChecklistTemplate {
  templateId: string;
  name: string;
  status: string;
  version: number;
  items: Array<{ title: string; category: string; required: boolean }>;
  lines?: Array<{ title: string; category: string; required: boolean }>;
}

export interface DocumentRequestItem {
  requestId: string;
  clientId: string;
  clientName?: string;
  engagementId: string;
  taxYear: number;
  title: string;
  category: string;
  status: string;
  required: boolean;
  overdue?: boolean;
  dueDate?: string;
  instructions?: string;
  acceptedTypes: string[];
  documents: Array<{ documentId: string; version: number }>;
  resolutionReason?: string;
  rowVersion: number;
  fulfilledDocumentId?: string;
}

export interface ClientNotification {
  notificationId: string;
  title: string;
  kind: string;
  createdAt: string;
  readAt: string | null;
  requestId: string | null;
}

export interface NotificationPreferences {
  categories: Array<{
    category: string;
    inApp: boolean;
    mandatory: boolean;
    version: number;
  }>;
  channels: Record<string, string>;
}

export const documentRequestService = {
  missing: async (_taxYear?: number, _overdueOnly?: boolean): Promise<{ items: DocumentRequestItem[]; overdueCount: number }> => ({
    items: [],
    overdueCount: 0
  }),
  list: async (_clientId: string): Promise<{ items: DocumentRequestItem[] }> => ({
    items: []
  }),
  targets: async (_clientId: string) => [],
  templates: async (): Promise<{ items: ChecklistTemplate[] }> => ({
    items: [
      {
        templateId: 'tpl_1040',
        name: 'Standard 1040 Checklist',
        status: 'ACTIVE',
        version: 1,
        items: [{ title: 'W-2', category: 'tax_form_w2', required: true }]
      }
    ]
  }),
  create: async (_clientId: string, _data?: any) => ({ success: true }),
  applyTemplate: async (
    _clientId: string,
    _templateId: string,
    _engagementId: string,
    _taxYear: number,
    _dueDate?: string
  ) => ({ success: true }),
  saveTemplate: async (_data: any) => ({ success: true }),
  link: async (_clientId: string, _requestId: string, _documentId: string, _version?: number) => ({ success: true }),
  remind: async (_clientId: string, _requestId: string) => ({ success: true }),
  resolve: async (
    _clientId: string,
    _requestId: string,
    _action: 'waive' | 'cancel',
    _reason: string,
    _rowVersion?: number
  ) => ({ success: true }),
  notifications: async (_clientId: string): Promise<{ unread: number; items: ClientNotification[] }> => ({
    unread: 0,
    items: []
  }),
  markRead: async (_clientId: string, _notificationId: string): Promise<{ read: boolean }> => ({ read: true }),
  preferences: async (_clientId: string): Promise<NotificationPreferences> => ({
    categories: [
      { category: 'DOCUMENT_REQUESTS', inApp: true, mandatory: true, version: 1 },
      { category: 'DOCUMENT_REMINDERS', inApp: true, mandatory: false, version: 1 },
      { category: 'ACCOUNT_SECURITY_LEGAL', inApp: true, mandatory: true, version: 1 }
    ],
    channels: { IN_APP: 'AVAILABLE', EMAIL: 'UNAVAILABLE', SMS: 'UNAVAILABLE' }
  }),
  hiddenCount: async (_clientId: string): Promise<number> => 0,
  setPreference: async (_clientId: string, _category: string, _enabled: boolean, _version: number) => ({ success: true }),
  waive: async (_id: string, _reason: string) => ({ success: true }),
  cancel: async (_id: string, _reason: string) => ({ success: true }),
  getRequests: async (_clientId?: string): Promise<DocumentRequestItem[]> => [],
  createRequest: async (_req: Partial<DocumentRequestItem>): Promise<{ success: boolean }> => ({ success: true }),
  fulfillRequest: async (_id: string, _docId: string): Promise<{ success: boolean }> => ({ success: true })
};
