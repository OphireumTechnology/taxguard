export type AppointmentTypeCode =
  | 'discovery_call'
  | 'tax_planning'
  | 'return_review'
  | 'audit_defense';

export interface AvailableTimeSlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  availableStaffId?: string;
  isBooked: boolean;
}

export interface CalendarConnection {
  provider: 'google_calendar' | 'outlook';
  email: string;
  synced: boolean;
}
