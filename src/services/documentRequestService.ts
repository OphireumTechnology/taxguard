import { apiRequest } from './api';

export interface DocumentRequestItem {
  id: string;
  clientId?: string;
  title: string;
  category?: string;
  status: string;
  dueDate?: string;
  notes?: string;
  [key: string]: any;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  items: Array<{ title: string; category?: string; required?: boolean }>;
  [key: string]: any;
}

export interface ClientNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  createdAt: string;
  [key: string]: any;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled?: boolean;
  documentAlerts?: boolean;
  appointmentReminders?: boolean;
  billingAlerts?: boolean;
  [key: string]: any;
}

export function requestMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unable to load document requests right now.';
}

export function requestStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending Upload',
    requested: 'Requested',
    submitted: 'Submitted',
    approved: 'Verified',
    rejected: 'Needs Replacement',
    waived: 'Not Applicable',
  };
  return map[status] || status;
}

export const documentRequestService: any = new Proxy(
  {
    list: (clientId?: string) =>
      apiRequest(`/api/documents/requests${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    create: (payload: any) =>
      apiRequest('/api/documents/requests', { method: 'POST', body: JSON.stringify(payload) }),
    listNotifications: () => apiRequest('/api/client-portal/notifications'),
    getPreferences: () => apiRequest('/api/client-portal/notification-preferences'),
    updatePreferences: (prefs: NotificationPreferences) =>
      apiRequest('/api/client-portal/notification-preferences', {
        method: 'PUT',
        body: JSON.stringify(prefs),
      }),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/documents/${prop}`);
    },
  }
);
