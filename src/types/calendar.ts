export type AppointmentTypeCode =
  | 'initial_consultation'
  | 'tax_planning'
  | 'return_review'
  | 'audit_defense'
  | 'bookkeeping_review'
  | 'general_advisory'
  | string;

export interface AvailableTimeSlot {
  id?: string;
  start: string;
  end: string;
  date?: string;
  time?: string;
  staffId?: string;
  staffName?: string;
  available?: boolean;
  [key: string]: any;
}

export interface CalendarConnection {
  id: string;
  userId?: string;
  staffId?: string;
  provider: 'google' | 'microsoft' | 'outlook' | 'apple' | string;
  email?: string;
  status: string;
  lastSyncedAt?: string;
  [key: string]: any;
}
