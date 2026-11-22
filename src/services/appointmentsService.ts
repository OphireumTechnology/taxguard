/** Browser client for /api/scheduling (durable appointments, proposal 040). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class AppointmentRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string) { super(code || 'APPOINTMENT_REQUEST_FAILED'); }
}
export type AppointmentStatus = 'REQUESTED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type AppointmentMode = 'REMOTE' | 'IN_PERSON' | 'PHONE';
export type AppointmentCategory = 'CONSULTATION' | 'DOCUMENT_REVIEW' | 'TAX_PLANNING' | 'RETURN_REVIEW' | 'SIGNING_MEETING' | 'GENERAL';
export interface Appointment { appointmentId: string; clientId: string; engagementId: string | null; category: AppointmentCategory; mode: AppointmentMode; status: AppointmentStatus;
  title: string; agenda: string | null; startsAt: string; endsAt: string; timezone: string; location: string | null; meetingUrl: string | null; cancelReason: string | null;
  hasStaff: boolean; version: number; createdAt: string; updatedAt: string; staffUid?: string | null; internalNote?: string | null; createdBy?: string; clientName?: string | null;
  history?: Array<{ seq: number; action: string; actorUid: string; actorRole: string; at: string; changes: Record<string, unknown> }>; replayed?: boolean }
export const CATEGORY_LABEL: Record<AppointmentCategory, string> = { CONSULTATION: 'Consultation', DOCUMENT_REVIEW: 'Document review', TAX_PLANNING: 'Tax planning',
  RETURN_REVIEW: 'Return review', SIGNING_MEETING: 'Signing meeting', GENERAL: 'General' };
export const MODE_LABEL: Record<AppointmentMode, string> = { REMOTE: 'Video call', IN_PERSON: 'In person', PHONE: 'Phone call' };
export const STATUS_LABEL: Record<AppointmentStatus, string> = { REQUESTED: 'Requested', CONFIRMED: 'Confirmed', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'No-show' };
export const newAppointmentKey = () => 'ap-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string, signal?: AbortSignal): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new AppointmentRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/scheduling' + path), { method, cache: 'no-store', credentials: 'omit', signal,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new AppointmentRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new AppointmentRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}
const c = (clientId: string) => '/clients/' + encodeURIComponent(clientId) + '/appointments';
export interface AppointmentDraft { title: string; category: AppointmentCategory; mode: AppointmentMode; startsAt: string; endsAt: string; timezone: string;
  engagementId?: string; staffUid?: string; agenda?: string; internalNote?: string; meetingUrl?: string; location?: string; confirm?: boolean }
export const appointmentsService = {
  schedule: (from: string, to: string, staffUid?: string, signal?: AbortSignal) =>
    request<Appointment[]>('GET', '/schedule?' + new URLSearchParams({ from, to, ...(staffUid ? { staffUid } : {}) }), undefined, undefined, signal),
  listForClient: (clientId: string, signal?: AbortSignal) => request<Appointment[]>('GET', c(clientId), undefined, undefined, signal),
  get: (clientId: string, id: string) => request<Appointment>('GET', c(clientId) + '/' + encodeURIComponent(id)),
  create: (clientId: string, draft: AppointmentDraft, key: string) => request<Appointment>('POST', c(clientId), draft, key),
  update: (clientId: string, id: string, version: number, fields: Record<string, string | null>, key: string) =>
    request<Appointment>('POST', c(clientId) + '/' + encodeURIComponent(id) + '/update', { version, fields }, key),
  reschedule: (clientId: string, id: string, version: number, input: { startsAt: string; endsAt: string; timezone: string; staffUid?: string }, key: string) =>
    request<Appointment>('POST', c(clientId) + '/' + encodeURIComponent(id) + '/reschedule', { version, ...input }, key),
  transition: (clientId: string, id: string, version: number, action: 'confirm' | 'complete' | 'no_show' | 'cancel', key: string, reason?: string) =>
    request<Appointment>('POST', c(clientId) + '/' + encodeURIComponent(id) + '/status', { version, action, ...(reason ? { reason } : {}) }, key),
  room: (clientId: string, id: string, signal?: AbortSignal) => request<ConsultationRoom>('GET', c(clientId) + '/' + encodeURIComponent(id) + '/room', undefined, undefined, signal),
  roomEvent: (clientId: string, id: string, event: 'join' | 'leave') => request<ConsultationRoom>('POST', c(clientId) + '/' + encodeURIComponent(id) + '/room/' + event),
};

/** Contract C5: room state derived from the appointment. No video transport exists (videoProvider NOT_COMMISSIONED). */
export type RoomState = 'OPEN' | 'NOT_YET_OPEN' | 'NOT_REMOTE' | 'NOT_CONFIRMED' | 'CANCELLED' | 'ENDED';
export interface ConsultationRoom { appointmentId: string; title: string; mode: AppointmentMode; appointmentStatus: AppointmentStatus; startsAt: string; endsAt: string; timezone: string;
  participant: 'CLIENT' | 'HOST' | 'MANAGER'; roomState: RoomState; accessWindow: { opensAt: string; closesAt: string }; host: { assigned: boolean; displayName: string | null };
  clientName: string | null; meetingUrl: string | null; videoProvider: 'NOT_COMMISSIONED'; joined: boolean; hostPresent: boolean; clientPresent: boolean; recorded?: boolean }

/** "Tuesday, Oct 14, 2026, 10:00 AM – 11:00 AM EDT" in the appointment's own time zone. */
export function formatAppointmentTime(a: Pick<Appointment, 'startsAt' | 'endsAt' | 'timezone'>, viewerZone?: string): string {
  const zone = a.timezone;
  try {
    const day = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(a.startsAt));
    const time = (iso: string, name: boolean) => new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', ...(name ? { timeZoneName: 'short' } : {}) }).format(new Date(iso));
    const text = `${day}, ${time(a.startsAt, false)} – ${time(a.endsAt, true)}`;
    if (viewerZone && viewerZone !== zone) {
      const local = new Intl.DateTimeFormat('en-US', { timeZone: viewerZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(a.startsAt));
      return `${text} (your time ${local})`;
    }
    return text;
  } catch { return 'Time unavailable'; }
}

/** Converts a wall-clock "YYYY-MM-DDTHH:mm" in an IANA zone to a UTC instant (ISO string), or null. */
export function zonedLocalToIso(local: string, zone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  try {
    const parts = (t: number) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t)).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
    const offsetAt = (t: number) => { const p = parts(t); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t; };
    let t = guess - offsetAt(guess);
    t = guess - offsetAt(t); // second pass handles offset changes (DST) near the guess
    const p = parts(t);
    if (p.year !== y || p.month !== mo || p.day !== d || p.hour !== h || p.minute !== mi) return null; // non-existent local time (DST gap)
    return new Date(t).toISOString();
  } catch { return null; }
}

export function appointmentErrorText(error: unknown): string {
  switch ((error as { code?: string })?.code) {
    case 'APPOINTMENT_STORE_UNAVAILABLE': return 'Scheduling is not available in this environment.';
    case 'APPOINTMENT_STAFF_CONFLICT': return 'The staff member already has an appointment at that time. Choose another time.';
    case 'APPOINTMENT_CLIENT_CONFLICT': return 'This client already has an appointment at that time. Choose another time.';
    case 'APPOINTMENT_VERSION_CONFLICT': return 'This appointment changed since it was loaded. Refresh and try again.';
    case 'APPOINTMENT_TIME_INVALID': return 'Choose a start at least 30 minutes from now (staff: not in the past), lasting 5 minutes to 8 hours.';
    case 'APPOINTMENT_TIMEZONE_INVALID': return 'Choose a valid time zone.';
    case 'APPOINTMENT_REASON_REQUIRED': return 'Enter a reason (at least 5 characters).';
    case 'APPOINTMENT_NOT_STARTED': return 'An appointment can be completed or marked as a no-show only after it starts.';
    case 'APPOINTMENT_TRANSITION_INVALID': case 'APPOINTMENT_CLOSED': return 'This appointment can no longer be changed that way.';
    case 'APPOINTMENT_STAFF_REQUIRED': case 'APPOINTMENT_ACCESS_DENIED': case 'APPOINTMENT_MANAGER_REQUIRED': return 'You are not permitted to do this.';
    case 'APPOINTMENT_STAFF_INVALID': return 'That staff member cannot be responsible for this client.';
    case 'APPOINTMENT_INPUT_INVALID': return 'Check the details: meeting links must be https addresses, and in-person appointments have no link.';
    case 'APPOINTMENT_CLIENT_NOT_FOUND': case 'APPOINTMENT_NOT_FOUND': return 'This appointment is not available to you.';
    case 'ROOM_NOT_OPEN': return 'The room is not open. It opens 15 minutes before a confirmed video appointment starts.';
    case 'ROOM_EVENT_LIMIT': return 'Too many join and leave actions were recorded for this appointment. Contact your advisor.';
    case 'IDEMPOTENCY_KEY_REUSED': return 'This request conflicts with one already sent. Refresh and try again.';
    default: return 'The server did not confirm this. Nothing was changed; try again.';
  }
}
