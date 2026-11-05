import { INITIAL_APPOINTMENTS } from '../data/mockData';

export type AppointmentMode = 'virtual' | 'in_office' | 'phone' | 'REMOTE' | 'PHONE' | string;
export type AppointmentCategory = 'tax_review' | 'planning' | 'onboarding' | 'general' | string;
export type RoomState = 'waiting' | 'in_progress' | 'ended';

export const CATEGORY_LABEL: Record<string, string> = {
  tax_review: 'Tax Return Review',
  planning: 'Strategic Planning',
  onboarding: 'Client Onboarding',
  general: 'General Consultation'
};

export const MODE_LABEL: Record<string, string> = {
  virtual: 'Virtual Video Meeting',
  in_office: 'In-Office Conference',
  phone: 'Phone Consultation'
};

export const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending Confirmation',
  cancelled: 'Cancelled',
  completed: 'Completed'
};

export function newAppointmentKey(): string {
  return 'apt_key_' + Math.random().toString(36).slice(2) + '_' + Date.now();
}

export function zonedLocalToIso(dateStr: string, timeStr: string, tz?: string): string {
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

export interface Appointment {
  appointmentId: string;
  id?: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceType?: string;
  staffId?: string;
  staffName?: string;
  accountantId?: string;
  accountantName?: string;
  category: AppointmentCategory;
  mode: AppointmentMode;
  status: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  startsAt?: string;
  timezone?: string;
  hasStaff?: boolean;
  meetingUrl?: string;
  updatedAt?: string;
  durationMinutes?: number;
  version?: number;
  type?: string;
  date?: string;
  timeSlot?: string;
  meetingLink?: string;
  location?: string;
  notes?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ConsultationRoom {
  roomId: string;
  appointmentId: string;
  status: RoomState;
  hostName: string;
  clientName: string;
  scheduledTime: string;
  messages: Array<{ id: string; sender: string; text: string; time: string }>;
}

export function formatAppointmentTime(date: string, timeSlot?: string): string {
  return timeSlot ? `${date} at ${timeSlot}` : date;
}

export function appointmentErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Appointment operation failed.';
}

const mockList: Appointment[] = INITIAL_APPOINTMENTS.map(a => ({
  ...a,
  appointmentId: a.id,
  category: 'planning',
  mode: (a.type as any) || 'virtual',
  scheduledStart: new Date(a.date).toISOString(),
  scheduledEnd: new Date(a.date).toISOString(),
  durationMinutes: 60,
  version: 1
}));

export const appointmentsService = {
  getAppointments: async (): Promise<Appointment[]> => mockList,
  listForClient: async (clientId: string, signal?: AbortSignal): Promise<Appointment[]> => mockList,
  schedule: async (from: string, to: string, staff?: string, signal?: AbortSignal): Promise<Appointment[]> => mockList,
  get: async (clientId: string, appointmentId: string): Promise<Appointment> => mockList[0],
  book: async (...args: any[]) => mockList[0],
  confirm: async (...args: any[]) => mockList[0],
  cancel: async (...args: any[]) => mockList[0],
  reschedule: async (...args: any[]) => mockList[0],
  bookAppointment: async (apt: Partial<Appointment>): Promise<{ success: boolean; appointment: Appointment }> => ({
    success: true,
    appointment: { ...mockList[0], ...apt, appointmentId: 'apt_' + Date.now() }
  }),
  getConsultationRoom: async (roomId: string): Promise<ConsultationRoom> => ({
    roomId,
    appointmentId: 'apt_001',
    status: 'waiting',
    hostName: 'Desmond Hinds',
    clientName: 'Michael Perotti',
    scheduledTime: '10:00 AM EST',
    messages: []
  })
};
