export type AppointmentTypeCode =
  | 'initial_consultation'
  | 'tax_planning'
  | 'return_review'
  | 'audit_defense'
  | 'business_advisory'
  | string;

export interface AvailableTimeSlot {
  id?: string;
  start: string;
  end: string;
  staffId?: string;
  staffName?: string;
  available?: boolean;
  [key: string]: any;
}

export interface CalendarConnection {
  id: string;
  provider: string;
  status: string;
  email?: string;
  connectedAt?: string;
  [key: string]: any;
}
