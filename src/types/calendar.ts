export type AppointmentTypeCode =
  | 'initial_consultation'
  | 'tax_strategy_review'
  | 'business_advisory'
  | 'founder_executive_session'
  | 'audit_representation'
  | 'document_review'
  | string;

export interface AvailableTimeSlot {
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  label: string;
  available: boolean;
  advisorId?: string;
  advisorName?: string;
  [key: string]: any;
}

export interface CalendarConnection {
  id: string;
  provider: 'google' | 'microsoft' | 'internal' | string;
  email?: string;
  connected: boolean;
  lastSyncedAt?: string;
  [key: string]: any;
}
