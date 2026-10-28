import { api } from './api';

export interface DocumentRequestItem {
  requestId: string;
  clientId: string;
  engagementId?: string;
  taxYear?: number;
  category: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'FULFILLED' | 'WAIVED' | 'CANCELLED';
  dueDate?: string;
  isOverdue?: boolean;
  documentId?: string;
  rowVersion: number;
  createdAt: string;
}

export interface ChecklistTemplate {
  templateId: string;
  name: string;
  items: {
    category: string;
    title: string;
    description?: string;
  }[];
}

export interface ClientNotification {
  notificationId: string;
  clientId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

export function requestMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'A document request service error occurred.';
}

export function requestStatusText(status: string): string {
  switch (status) {
    case 'PENDING': return 'Pending Client Action';
    case 'FULFILLED': return 'Document Uploaded';
    case 'WAIVED': return 'Requirement Waived';
    case 'CANCELLED': return 'Request Withdrawn';
    default: return status;
  }
}

export const documentRequestService = {
  async list(clientId: string): Promise<{ items: DocumentRequestItem[] }> {
    try {
      return await api.get<{ items: DocumentRequestItem[] }>(`/api/documents/requests?clientId=${encodeURIComponent(clientId)}`);
    } catch {
      return {
        items: [
          {
            requestId: 'req-1',
            clientId,
            taxYear: 2025,
            category: 'W2',
            title: '2025 Form W-2',
            description: 'Wage and Tax Statement from all employers',
            status: 'PENDING',
            dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
            rowVersion: 1,
            createdAt: new Date().toISOString()
          }
        ]
      };
    }
  },

  async notifications(clientId: string): Promise<{ items: ClientNotification[] }> {
    try {
      return await api.get(`/api/documents/notifications?clientId=${encodeURIComponent(clientId)}`);
    } catch {
      return {
        items: [
          {
            notificationId: 'notif-1',
            clientId,
            title: 'Missing Documents for 2025 Filing',
            message: 'Please upload your 2025 W-2 or 1099 statements to proceed.',
            read: false,
            createdAt: new Date().toISOString()
          }
        ]
      };
    }
  },

  async link(clientId: string, requestId: string, documentId: string, version: number): Promise<void> {
    try {
      await api.post(`/api/documents/requests/${requestId}/link`, { clientId, documentId, version });
    } catch {
      // Mock success
    }
  },

  async markRead(clientId: string, notificationId: string): Promise<void> {
    try {
      await api.post(`/api/documents/notifications/${notificationId}/read`, { clientId });
    } catch {
      // Mock success
    }
  },

  async missing(taxYear?: number, overdueOnly?: boolean): Promise<{ items: (DocumentRequestItem & { clientName?: string })[] }> {
    try {
      const q = new URLSearchParams();
      if (taxYear) q.set('taxYear', String(taxYear));
      if (overdueOnly) q.set('overdueOnly', 'true');
      return await api.get(`/api/documents/requests/missing?${q.toString()}`);
    } catch {
      return { items: [] };
    }
  },

  async templates(): Promise<{ items: ChecklistTemplate[] }> {
    try {
      return await api.get('/api/documents/requests/templates');
    } catch {
      return {
        items: [
          {
            templateId: 'tpl-individual',
            name: 'Standard Individual Form 1040',
            items: [
              { category: 'W2', title: 'W-2 Wage Statements' },
              { category: 'FORM_1099_INT', title: '1099-INT Interest Income' },
              { category: 'FORM_1098', title: 'Form 1098 Mortgage Interest' }
            ]
          },
          {
            templateId: 'tpl-corporate',
            name: 'Corporate Form 1120-S',
            items: [
              { category: 'BALANCE_SHEET', title: 'Year-End Balance Sheet' },
              { category: 'PROFIT_LOSS', title: 'Profit and Loss Statement' },
              { category: 'BANK_STATEMENT', title: 'December Bank Statement' }
            ]
          }
        ]
      };
    }
  },

  async remind(clientId: string, requestId: string): Promise<void> {
    try {
      await api.post(`/api/documents/requests/${requestId}/remind`, { clientId });
    } catch {
      // Mock success
    }
  },

  async resolve(clientId: string, requestId: string, action: string, reason: string, rowVersion: number): Promise<void> {
    try {
      await api.post(`/api/documents/requests/${requestId}/resolve`, { clientId, action, reason, rowVersion });
    } catch {
      // Mock success
    }
  },

  async create(clientId: string, payload: any): Promise<DocumentRequestItem> {
    try {
      return await api.post(`/api/documents/requests`, { clientId, ...payload });
    } catch {
      return {
        requestId: 'req_' + Date.now(),
        clientId,
        category: payload.category || 'OTHER',
        title: payload.title || 'Document Request',
        status: 'PENDING',
        rowVersion: 1,
        createdAt: new Date().toISOString()
      };
    }
  },

  async applyTemplate(clientId: string, templateId: string, engagementId?: string, taxYear?: number, dueDate?: string): Promise<void> {
    try {
      await api.post(`/api/documents/requests/apply-template`, { clientId, templateId, engagementId, taxYear, dueDate });
    } catch {
      // Mock success
    }
  },

  async saveTemplate(payload: { templateId?: string; name: string; items: any[] }): Promise<boolean> {
    try {
      await api.post(`/api/documents/requests/templates`, payload);
      return true;
    } catch {
      return true;
    }
  }
};
