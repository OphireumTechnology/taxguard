import { INITIAL_APPOINTMENTS } from '../data/mockData';

export type AppointmentMode = 'REMOTE' | 'PHONE' | 'IN_PERSON' | 'virtual' | 'in_office' | 'phone' | string;
export type AppointmentCategory = 'CONSULTATION' | 'tax_review' | 'planning' | 'onboarding' | 'general' | string;
export type RoomState = 'OPEN' | 'NOT_YET_OPEN' | 'NOT_CONFIRMED' | 'NOT_REMOTE' | 'CANCELLED' | 'ENDED';

export const CATEGORY_LABEL: Record<string, string> = {
  CONSULTATION: 'Consultation',
  tax_review: 'Tax Return Review',
  planning: 'Strategic Planning',
  onboarding: 'Client Onboarding',
  general: 'General Consultation'
};

export const MODE_LABEL: Record<string, string> = {
  REMOTE: 'Virtual Video Meeting',
  IN_PERSON: 'In-Office Conference',
  PHONE: 'Phone Consultation',
  virtual: 'Virtual Video Meeting',
  in_office: 'In-Office Conference',
  phone: 'Phone Consultation'
};

export const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Requested',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  confirmed: 'Confirmed',
  pending: 'Pending Confirmation',
  cancelled: 'Cancelled',
  completed: 'Completed'
};

export function newAppointmentKey(): string {
  return 'apt_key_' + Math.random().toString(36).slice(2) + '_' + Date.now();
}

export function zonedLocalToIso(dateOrLocalStr: string, tzOrTimeStr?: string, _tz?: string): string {
  if (!dateOrLocalStr) return '';
  if (tzOrTimeStr && /^\d{2}:\d{2}/.test(tzOrTimeStr)) {
    const d = new Date(`${dateOrLocalStr}T${tzOrTimeStr}:00`);
    return Number.isFinite(d.getTime()) ? d.toISOString() : '';
  }
  const d = new Date(dateOrLocalStr);
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}

export interface AppointmentHistoryEntry {
  seq: number;
  at: string;
  action: string;
  actorUid: string;
  actorRole: string;
}

export interface Appointment {
  appointmentId: string;
  id?: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  title: string;
  serviceType?: string;
  staffUid?: string;
  staffId?: string;
  staffName?: string;
  accountantId?: string;
  accountantName?: string;
  category: AppointmentCategory;
  mode: AppointmentMode;
  status: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  hasStaff?: boolean;
  agenda?: string | null;
  internalNote?: string | null;
  meetingUrl?: string | null;
  cancelReason?: string | null;
  location?: string | null;
  durationMinutes?: number;
  version: number;
  history?: AppointmentHistoryEntry[];
  type?: string;
  date?: string;
  timeSlot?: string;
  meetingLink?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConsultationRoom {
  roomId: string;
  appointmentId: string;
  title: string;
  roomState: RoomState;
  status?: RoomState;
  startsAt: string;
  endsAt: string;
  timezone: string;
  accessWindow: {
    opensAt: string;
    closesAt: string;
  };
  host: {
    assigned: boolean;
    displayName?: string;
  };
  hostPresent: boolean;
  clientPresent: boolean;
  meetingUrl?: string | null;
  joined: boolean;
  hostName: string;
  clientName: string;
  referenceCode?: string;
  scheduledTime: string;
  messages: Array<{ id: string; sender: string; text: string; time: string }>;
}

export function formatAppointmentTime(
  appointmentOrDate: { startsAt: string; endsAt?: string; timezone: string } | string,
  viewerZoneOrSlot?: string
): string {
  if (typeof appointmentOrDate === 'string') {
    return viewerZoneOrSlot ? `${appointmentOrDate} at ${viewerZoneOrSlot}` : appointmentOrDate;
  }
  try {
    const dt = new Date(appointmentOrDate.startsAt).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: appointmentOrDate.timezone || viewerZoneOrSlot || 'UTC'
    });
    return `${dt} (${appointmentOrDate.timezone || 'UTC'})`;
  } catch {
    return appointmentOrDate.startsAt;
  }
}

export function appointmentErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Appointment operation failed.';
}

const mockList: Appointment[] = INITIAL_APPOINTMENTS.map(a => {
  const startIso = new Date(a.date || Date.now()).toISOString();
  const endIso = new Date(Date.parse(startIso) + 60 * 60_000).toISOString();
  return {
    ...a,
    clientId: a.clientId || '',
    appointmentId: a.id,
    title: a.title || a.serviceType || 'Tax Consultation',
    category: 'CONSULTATION',
    mode: a.type === 'in_office' ? 'IN_PERSON' : a.type === 'telephone' ? 'PHONE' : 'REMOTE',
    status: String(a.status || 'CONFIRMED').toUpperCase(),
    scheduledStart: startIso,
    scheduledEnd: endIso,
    startsAt: startIso,
    endsAt: endIso,
    timezone: 'America/New_York',
    staffUid: a.accountantId,
    durationMinutes: 60,
    version: 1,
    history: []
  };
});

const defaultRoom = (appointmentId: string): ConsultationRoom => ({
  roomId: 'room_' + appointmentId,
  appointmentId,
  title: 'Consultation Room',
  roomState: 'OPEN',
  status: 'OPEN',
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 3600_000).toISOString(),
  timezone: 'America/New_York',
  accessWindow: {
    opensAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    closesAt: new Date(Date.now() + 60 * 60_000).toISOString()
  },
  host: { assigned: true, displayName: 'Desmond Hinds, CPA' },
  hostPresent: false,
  clientPresent: false,
  meetingUrl: null,
  joined: false,
  hostName: 'Desmond Hinds',
  clientName: 'Michael Perotti',
  scheduledTime: '10:00 AM EST',
  messages: []
});

export interface CreateAppointmentDraft {
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
}

export const appointmentsService = {
  getAppointments: async (): Promise<Appointment[]> => mockList,
  listForClient: async (_clientId: string, _signal?: AbortSignal): Promise<Appointment[]> => mockList,
  schedule: async (_from: string, _to: string, _staff?: string, _signal?: AbortSignal): Promise<Appointment[]> => mockList,
  get: async (_clientId: string, _appointmentId: string): Promise<Appointment> => mockList[0],
  create: async (clientId: string, draft: CreateAppointmentDraft, _key?: string): Promise<Appointment> => ({
    ...mockList[0],
    appointmentId: 'apt_' + Date.now(),
    clientId,
    title: draft.title,
    category: draft.category,
    mode: draft.mode,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    timezone: draft.timezone,
    agenda: draft.agenda,
    staffUid: draft.staffUid,
    meetingUrl: draft.meetingUrl,
    location: draft.location,
    status: draft.confirm ? 'CONFIRMED' : 'REQUESTED'
  }),
  transition: async (
    _clientId: string,
    appointmentId: string,
    version: number,
    action: string,
    _key?: string,
    cancelReason?: string
  ): Promise<Appointment> => ({
    ...mockList[0],
    appointmentId,
    version: version + 1,
    status: action === 'confirm' ? 'CONFIRMED' : action === 'complete' ? 'COMPLETED' : action === 'no_show' ? 'NO_SHOW' : 'CANCELLED',
    cancelReason
  }),
  update: async (
    _clientId: string,
    appointmentId: string,
    version: number,
    patch: { agenda?: string | null; internalNote?: string | null; meetingUrl?: string | null; location?: string | null },
    _key?: string
  ): Promise<Appointment> => ({
    ...mockList[0],
    appointmentId,
    version: version + 1,
    ...patch
  }),
  book: async (..._args: any[]): Promise<Appointment> => mockList[0],
  confirm: async (..._args: any[]): Promise<Appointment> => mockList[0],
  cancel: async (..._args: any[]): Promise<Appointment> => mockList[0],
  reschedule: async (..._args: any[]): Promise<Appointment> => mockList[0],
  bookAppointment: async (apt: Partial<Appointment>): Promise<{ success: boolean; appointment: Appointment }> => ({
    success: true,
    appointment: { ...mockList[0], ...apt, appointmentId: 'apt_' + Date.now() }
  }),
  room: async (_clientId: string, appointmentId: string): Promise<ConsultationRoom> => defaultRoom(appointmentId),
  roomEvent: async (_clientId: string, appointmentId: string, event: 'join' | 'leave'): Promise<ConsultationRoom> => ({
    ...defaultRoom(appointmentId),
    joined: event === 'join',
    clientPresent: event === 'join'
  }),
  getConsultationRoom: async (roomId: string): Promise<ConsultationRoom> => ({
    ...defaultRoom('apt_001'),
    roomId
  })
};
