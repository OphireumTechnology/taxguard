export type AppointmentTypeCode =
  | 'consultation'
  | 'tax_planning'
  | 'tax_preparation'
  | 'review'
  | 'signing';

export interface SynchronizedAppointment {
  id: string;
  type: AppointmentTypeCode;
  startsAt: string;
  endsAt: string;
  title?: string;
  status?: string;
}

export interface AvailableTimeSlot {
  date: string;
  time: string;
  startUtc?: string;
  endUtc?: string;
}

export interface CalendarBusyBlock {
  start: string;
  end: string;
}

export interface CalendarConnection {
  id: string;
  provider: string;
  connected: boolean;
}
