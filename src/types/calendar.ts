export type AppointmentTypeCode =
  | 'new_client_consultation'
  | 'founder_consultation'
  | 'individual_tax_consultation'
  | 'business_tax_consultation'
  | 'tax_planning_session'
  | 'bookkeeping_consultation'
  | 'payroll_consultation'
  | 'irs_notice_consultation'
  | 'accounting_software_setup'
  | 'document_review'
  | 'return_review'
  | 'follow_up_meeting'
  | 'internal_staff_meeting';

export interface AvailableTimeSlot {
  slotKey: string;
  startUtc: string;
  endUtc: string;
  clientLocalDisplay: string;
  staffId: string;
  staffName: string;
  available?: boolean;
  [key: string]: unknown;
}

export interface CalendarConnection {
  id: string;
  provider: 'google' | 'microsoft' | 'apple' | string;
  email: string;
  status: 'connected' | 'disconnected' | 'error' | string;
  lastSyncedAt?: string;
  calendarName?: string;
  [key: string]: unknown;
}
