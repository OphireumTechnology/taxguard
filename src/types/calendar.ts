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
  | 'internal_staff_meeting'
  | string;

export interface AvailableTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  available: boolean;
  staffId?: string;
  staffName?: string;
  [key: string]: any;
}

export interface CalendarConnection {
  provider: 'google' | 'outlook' | 'apple' | string;
  connected: boolean;
  email?: string;
  lastSynced?: string;
  [key: string]: any;
}
