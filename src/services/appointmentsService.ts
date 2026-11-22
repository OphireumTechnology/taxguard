import { api } from './api';

export type AppointmentCategory =
  | 'consultation'
  | 'tax_planning'
  | 'return_review'
  | 'bookkeeping'
  | 'audit_support'
  | string;

export type AppointmentMode = 'video' | 'phone' | 'in_person' | string;

export type RoomState = 'scheduled' | 'waiting' | 'active' | 'ended' | 'unavailable' | string;

export interface Appointment {
  id: string;
  clientId?: string;
  staffId?: string;
  title?: string;
  category: AppointmentCategory;
  mode: AppointmentMode;
  status: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  notes?: string;
  [key: string]: any;
}

export interface ConsultationRoom {
  id: string;
  appointmentId: string;
  state: RoomState;
  joinUrl?: string;
  participants?: any[];
  [key: string]: any;
}

export const CATEGORY_LABEL: Record<string, string> = {
  consultation: 'Initial Consultation',
  tax_planning: 'Tax Planning',
  return_review: 'Return Review',
  bookkeeping: 'Bookkeeping Review',
  audit_support: 'Audit Representation',
};

export const MODE_LABEL: Record<string, string> = {
  video: 'Video Conference',
  phone: 'Phone Call',
  in_person: 'In-Office (Columbia, SC)',
};

export const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
  pending: 'Pending',
};

export function newAppointmentKey(): string {
  return `appt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatAppointmentTime(
  isoOrRecord?: string | Appointment | ConsultationRoom | null,
  _tz?: string
): string {
  const iso =
    typeof isoOrRecord === 'string'
      ? isoOrRecord
      : isoOrRecord && typeof isoOrRecord === 'object'
        ? (isoOrRecord as any).startsAt || (isoOrRecord as any).scheduledStart || (isoOrRecord as any).startTime
        : undefined;
  if (!iso) return 'Not scheduled';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

export function zonedLocalToIso(dateStr: string, timeStr: string): string {
  const combined = new Date(`${dateStr}T${timeStr || '09:00'}:00`);
  return Number.isNaN(combined.getTime()) ? new Date().toISOString() : combined.toISOString();
}

export function appointmentErrorText(err: unknown, fallback = 'Scheduling service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export type AppointmentCreateDraft = {
  title?: string;
  category?: AppointmentCategory;
  mode?: AppointmentMode;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  agenda?: string;
  staffUid?: string;
  meetingUrl?: string;
  location?: string;
  internalNote?: string;
  confirm?: boolean;
  [key: string]: any;
};

export const appointmentsService: {
  create: (clientId: string, draft: AppointmentCreateDraft, idempotencyKey?: string) => Promise<any>;
  [key: string]: (...args: any[]) => Promise<any>;
} = new Proxy(
  {
    list: (query?: Record<string, any>, signal?: AbortSignal): Promise<any> =>
      api.request('/api/scheduling', { query, signal }),
    listForClient: (clientId: string, signal?: AbortSignal): Promise<any> =>
      api.request('/api/scheduling', { query: { clientId }, signal }),
    create: (clientId: string, draft: AppointmentCreateDraft, idempotencyKey?: string): Promise<any> =>
      api.request('/api/scheduling', {
        method: 'POST',
        body: JSON.stringify({ clientId, ...(draft || {}), idempotencyKey }),
      }),
    cancel: (id: string, reason?: string): Promise<any> =>
      api.request(`/api/scheduling/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    room: (appointmentId: string, clientId?: string, signal?: AbortSignal): Promise<any> =>
      api.request(`/api/scheduling/${encodeURIComponent(appointmentId)}/room`, {
        query: { clientId },
        signal,
      }),
    roomEvent: (appointmentId: string, event: string, payload?: Record<string, any>): Promise<any> =>
      api.request(`/api/scheduling/${encodeURIComponent(appointmentId)}/room/events`, {
        method: 'POST',
        body: JSON.stringify({ event, ...(payload || {}) }),
      }),
    listConsultations: (query?: Record<string, any>, signal?: AbortSignal): Promise<any> =>
      api.request('/api/consultations', { query, signal }),
    updateConsultation: (id: string, payload: Record<string, any>): Promise<any> =>
      api.request(`/api/consultations/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  } as {
    create: (clientId: string, draft: AppointmentCreateDraft, idempotencyKey?: string) => Promise<any>;
    [key: string]: (...args: any[]) => Promise<any>;
  },
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: any[]): Promise<any> =>
        api.request(`/api/scheduling/${encodeURIComponent(prop)}`, {
          method: args.length > 1 ? 'POST' : 'GET',
          ...(args.length > 1 ? { body: JSON.stringify({ args }) } : {}),
        });
    },
  }
);
