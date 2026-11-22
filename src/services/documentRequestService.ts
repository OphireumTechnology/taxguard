import { api } from './api';

export interface DocumentRequestItem {
  id: string;
  clientId?: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  dueDate?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  items: any[];
  [key: string]: any;
}

export interface ClientNotification {
  id: string;
  title?: string;
  message: string;
  type?: string;
  read: boolean;
  createdAt: string;
  [key: string]: any;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  documentReminders: boolean;
  statusUpdates: boolean;
  appointmentReminders: boolean;
  [key: string]: any;
}

export function requestStatusText(status: string): string {
  return (status || 'pending').replace(/_/g, ' ');
}

export function requestMessage(err: unknown, fallback = 'Document request service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const documentRequestService: any = {
  list: (query?: Record<string, any>, signal?: AbortSignal) =>
    api.request('/api/vault/requests', { query, signal }),
  create: (payload: Record<string, any>) =>
    api.request('/api/vault/requests', { method: 'POST', body: JSON.stringify(payload) }),
  listTemplates: (signal?: AbortSignal) => api.request('/api/vault/checklist-templates', { signal }),
  listNotifications: (signal?: AbortSignal) => api.request('/api/client-portal/notifications', { signal }),
  markNotificationRead: (id: string) =>
    api.request(`/api/client-portal/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' }),
  getPreferences: (signal?: AbortSignal) =>
    api.request('/api/client-portal/notification-preferences', { signal }),
  updatePreferences: (prefs: NotificationPreferences) =>
    api.request('/api/client-portal/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify(prefs),
    }),
};
