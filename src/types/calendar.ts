/**
 * A/R Tax Services, LLC - Live Calendar & Availability Engine Types
 * Production-ready two-way calendar sync, concurrency locking, and availability rules.
 */

export type CalendarProvider = 'google_calendar' | 'microsoft_outlook' | 'apple_caldav';

export type CalendarConnectionStatus =
  | 'not_connected'
  | 'authorization_pending'
  | 'connected'
  | 'synchronization_active'
  | 'reauthorization_required'
  | 'token_expired'
  | 'provider_error'
  | 'disconnected';

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

export type ProductionAppointmentStatus =
  | 'slot_held'
  | 'requested'
  | 'payment_pending'
  | 'pending_approval'
  | 'confirmed'
  | 'synchronization_pending'
  | 'synchronized'
  | 'reschedule_requested'
  | 'rescheduled'
  | 'completed'
  | 'canceled_by_client'
  | 'canceled_by_staff'
  | 'declined'
  | 'no_show'
  | 'follow_up_required';

export interface CalendarConnection {
  id: string;
  staffId: string;
  staffName: string;
  provider: CalendarProvider;
  status: CalendarConnectionStatus;
  providerAccountEmail: string;
  selectedCalendarId: string;
  selectedCalendarName: string;
  syncFreeBusyOnly: boolean;
  twoWaySyncEnabled: boolean;
  lastSuccessfulSync?: string;
  syncError?: string;
  tokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarBusyBlock {
  id: string;
  staffId: string;
  source: 'google' | 'microsoft' | 'portal_appointment' | 'manual_block' | 'firm_holiday';
  startUtc: string;
  endUtc: string;
  isAllDay: boolean;
  // External event details are strictly omitted/masked to preserve client privacy
  displayLabel: string; // e.g. "Unavailable" or "Firm Holiday"
  externalEventId?: string;
}

export interface DayRecurringSchedule {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sun, 1 = Mon ...
  isAvailable: boolean;
  timeSlots: Array<{
    start: string; // '09:00'
    end: string;   // '17:00'
  }>;
  lunchBreak?: {
    start: string; // '12:00'
    end: string;   // '13:00'
  };
}

export interface StaffAvailabilityConfig {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  timeZone: string;
  isFounder: boolean;
  
  // Weekly Recurring Hours
  weeklySchedule: DayRecurringSchedule[];

  // Buffers and notice limits
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  maxDailyAppointments: number;
  maxWeeklyAppointments: number;

  // Modalities
  virtualEnabled: boolean;
  telephoneEnabled: boolean;
  officeEnabled: boolean;
  officeLocation?: string;

  // Founder Specific Controls
  founderControls?: {
    acceptsNewClients: boolean;
    existingClientsOnly: boolean;
    referralRequired: boolean;
    adminApprovalRequired: boolean;
    paidConsultationRequired: boolean;
    consultationFeeCents: number;
    priorityClientAccess: boolean;
    maxMeetingsPerDay: number;
    autoNextAvailableFallback: boolean;
  };

  pausedUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityException {
  id: string;
  staffId: string;
  type: 'vacation' | 'leave' | 'extra_hours' | 'emergency_unavailable';
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  reason?: string;
  isAllDay: boolean;
  customHours?: { start: string; end: string };
  createdAt: string;
}

export interface FirmHoliday {
  id: string;
  name: string;
  date: string; // 'YYYY-MM-DD'
  isFirmClosed: boolean;
}

export interface AppointmentSlotHold {
  id: string;
  slotKey: string; // `${staffId}_${startUtc}`
  staffId: string;
  clientId: string;
  serviceType: string;
  startUtc: string;
  endUtc: string;
  idempotencyKey: string;
  expiresAtMs: number; // e.g. Date.now() + 10 * 60 * 1000
  createdAt: string;
}

export interface SynchronizedAppointment {
  id: string;
  referenceCode: string; // e.g. "AR-2026-8942"
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientTimeZone: string;
  
  staffId: string;
  staffName: string;
  staffTimeZone: string;
  isFounderBooking: boolean;

  serviceTypeCode: AppointmentTypeCode;
  serviceTitle: string;
  durationMinutes: number;

  startUtc: string;
  endUtc: string;
  
  meetingType: 'virtual' | 'telephone' | 'in_office';
  virtualMeetingUrl?: string;
  phoneDialIn?: string;
  officeLocationAddress?: string;

  status: ProductionAppointmentStatus;
  
  // External calendar sync records
  googleCalendarEventId?: string;
  microsoftCalendarEventId?: string;
  syncStatus: 'pending' | 'synchronized' | 'error';
  lastSyncAttempt?: string;
  syncErrorDetails?: string;

  // Notes
  clientNotes?: string;
  staffInternalNotes?: string;
  cancellationReason?: string;
  rescheduleReason?: string;

  // Metadata
  depositPaid: boolean;
  depositAmountCents?: number;
  holdId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AvailableTimeSlot {
  slotKey: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  isFounder: boolean;
  startUtc: string;
  endUtc: string;
  clientLocalDisplay: string; // e.g. "10:00 AM"
  staffLocalDisplay: string;  // e.g. "10:00 AM EDT"
  meetingTypesAvailable: Array<'virtual' | 'telephone' | 'in_office'>;
}
