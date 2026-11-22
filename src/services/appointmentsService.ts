import { apiRequest } from './api';

export type AppointmentCategory =
  | 'CONSULTATION'
  | 'TAX_PLANNING'
  | 'RETURN_REVIEW'
  | 'AUDIT_DEFENSE'
  | 'BUSINESS_ADVISORY'
  | 'initial_consultation'
  | 'tax_planning'
  | 'return_review'
  | 'audit_defense'
  | 'business_advisory'
  | string;

export type AppointmentMode = 'REMOTE' | 'IN_PERSON' | 'PHONE' | 'video' | 'phone' | 'in_person' | string;
export type RoomState = 'waiting' | 'ready' | 'live' | 'ended' | 'unavailable' | string;

export interface Appointment {
  id?: string;
  appointmentId: string;
  clientId?: string;
  staffId?: string;
  staffUid?: string;
  title?: string;
  category: AppointmentCategory;
  mode: AppointmentMode;
  status: string;
  startsAt: string;
  endsAt?: string;
  timezone?: string;
  agenda?: string;
  internalNote?: string;
  meetingUrl?: string;
  location?: string;
  notes?: string;
  version?: number;
  [key: string]: any;
}

export interface AppointmentCreateInput {
  title: string;
  category: AppointmentCategory;
  mode: AppointmentMode;
  startsAt: string;
  endsAt: string;
  timezone: string;
  agenda?: string;
  staffUid?: string;
  internalNote?: string;
  meetingUrl?: string;
  location?: string;
  confirm?: boolean;
  [key: string]: any;
}

export interface ConsultationRoom {
  id?: string;
  appointmentId?: string;
  state: RoomState;
  joinUrl?: string;
  participants?: any[];
  [key: string]: any;
}

export const CATEGORY_LABEL: Record<string, string> = {
  CONSULTATION: 'Initial Consultation',
  TAX_PLANNING: 'Tax Strategy & Planning',
  RETURN_REVIEW: 'Tax Return Review',
  AUDIT_DEFENSE: 'Audit & IRS Resolution',
  BUSINESS_ADVISORY: 'Business Advisory',
  initial_consultation: 'Initial Consultation',
  tax_planning: 'Tax Strategy & Planning',
  return_review: 'Tax Return Review',
  audit_defense: 'Audit & IRS Resolution',
  business_advisory: 'Business Advisory',
};

export const MODE_LABEL: Record<string, string> = {
  REMOTE: 'Secure Video Conference',
  PHONE: 'Phone Consultation',
  IN_PERSON: 'Columbia, SC Office',
  video: 'Secure Video Conference',
  phone: 'Phone Consultation',
  in_person: 'Columbia, SC Office',
};

export const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Requested',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
  requested: 'Requested',
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

export function newAppointmentKey(prefix = 'appt'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatAppointmentTime(isoOrObj: string | Record<string, any>, timezone?: string): string {
  const iso = typeof isoOrObj === 'string' ? isoOrObj : isoOrObj?.startsAt || isoOrObj?.scheduledAt || '';
  const tz = timezone || (typeof isoOrObj === 'object' ? isoOrObj?.timezone : undefined);
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...(tz ? { timeZone: tz } : {}),
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
}

export function zonedLocalToIso(localDateTime: string, _timezone?: string): string | null {
  if (!localDateTime) return null;
  const date = new Date(localDateTime);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function appointmentErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unable to process appointment request right now.';
}

export const appointmentsService = {
  list: (clientId?: string, signal?: AbortSignal): Promise<Appointment[]> =>
    apiRequest<Appointment[]>(
      `/api/scheduling/appointments${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`,
      { signal }
    ),
  listForClient: (clientId: string, signal?: AbortSignal): Promise<Appointment[]> =>
    apiRequest<Appointment[]>(`/api/scheduling/clients/${encodeURIComponent(clientId)}/appointments`, { signal }),
  listForStaff: (from?: string | number, to?: string | number, signal?: AbortSignal): Promise<Appointment[]> =>
    apiRequest<Appointment[]>(
      `/api/scheduling/staff/appointments?from=${encodeURIComponent(String(from ?? ''))}&to=${encodeURIComponent(String(to ?? ''))}`,
      { signal }
    ),
  listForPractice: (
    from?: string | number,
    to?: string | number,
    staffUid?: string,
    signal?: AbortSignal
  ): Promise<Appointment[]> =>
    apiRequest<Appointment[]>(
      `/api/scheduling/practice/appointments?from=${encodeURIComponent(String(from ?? ''))}&to=${encodeURIComponent(String(to ?? ''))}${staffUid ? `&staffUid=${encodeURIComponent(staffUid)}` : ''}`,
      { signal }
    ),
  schedule: (...args: any[]): Promise<Appointment[]> =>
    apiRequest<Appointment[]>('/api/scheduling/appointments', {
      signal: args.find((a) => typeof AbortSignal !== 'undefined' && a instanceof AbortSignal),
    }),
  get: (clientId: string, appointmentId: string, signal?: AbortSignal): Promise<Appointment> =>
    apiRequest<Appointment>(
      `/api/scheduling/clients/${encodeURIComponent(clientId)}/appointments/${encodeURIComponent(appointmentId)}`,
      { signal }
    ),
  create: (clientId: string, draft: AppointmentCreateInput, idempotencyKey?: string): Promise<Appointment> =>
    apiRequest<Appointment>(`/api/scheduling/clients/${encodeURIComponent(clientId)}/appointments`, {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(draft),
    }),
  transition: (
    clientId: string,
    appointmentId: string,
    version: number | undefined,
    action: string,
    idempotencyKey?: string,
    reason?: string
  ): Promise<Appointment> =>
    apiRequest<Appointment>(
      `/api/scheduling/clients/${encodeURIComponent(clientId)}/appointments/${encodeURIComponent(appointmentId)}/${encodeURIComponent(action)}`,
      {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        body: JSON.stringify({ version, reason }),
      }
    ),
  reschedule: (...args: any[]): Promise<Appointment> =>
    apiRequest<Appointment>('/api/scheduling/appointments/reschedule', {
      method: 'POST',
      body: JSON.stringify({ args }),
    }),
  update: (...args: any[]): Promise<Appointment> =>
    apiRequest<Appointment>('/api/scheduling/appointments/update', {
      method: 'PATCH',
      body: JSON.stringify({ args }),
    }),
  cancel: (id: string, reason?: string): Promise<Appointment> =>
    apiRequest<Appointment>(`/api/scheduling/appointments/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  getRoom: (appointmentId: string, ..._rest: any[]): Promise<ConsultationRoom> =>
    apiRequest<ConsultationRoom>(`/api/scheduling/appointments/${encodeURIComponent(appointmentId)}/room`),
  room: (...args: any[]): Promise<ConsultationRoom> =>
    apiRequest<ConsultationRoom>(`/api/scheduling/appointments/${encodeURIComponent(String(args[args.length - 1] || ''))}/room`),
  roomEvent: (...args: any[]): Promise<any> =>
    apiRequest<any>('/api/scheduling/appointments/room/events', {
      method: 'POST',
      body: JSON.stringify({ args }),
    }),
};
