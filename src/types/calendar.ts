export type AppointmentTypeCode =
  | 'INITIAL_CONSULTATION'
  | 'TAX_PLANNING'
  | 'RETURN_REVIEW'
  | 'DOCUMENT_INTAKE'
  | 'ADVISORY_SESSION'
  | 'AUDIT_REPRESENTATION'
  | 'FOLLOW_UP'
  | string;

export interface AvailableTimeSlot {
  id?: string;
  start: string;
  end: string;
  startTime?: string;
  endTime?: string;
  date?: string;
  label?: string;
  advisorId?: string;
  advisorName?: string;
  available?: boolean;
  [key: string]: any;
}

export interface CalendarConnection {
  id: string;
  provider: 'google' | 'microsoft' | 'outlook' | 'caldav' | string;
  email?: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  lastSyncedAt?: string;
  [key: string]: any;
}
