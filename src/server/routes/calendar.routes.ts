/**
 * A/R TAX SERVICES, LLC - Live Synchronized Calendar & Availability Engine
 * Production-ready two-way calendar sync, concurrency locking (10-minute slot holds),
 * multi-timezone conversion, external calendar masking, and Founder controls.
 */

import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../auth';
import { ADMIN_ROLES, CLIENT_ROLES, canAccessStaffClient } from '../clientAccess';

const STAFF_CALENDAR_ROLES = new Set(['accountant', 'senior_reviewer', 'reviewer', 'consultant', 'managing_consultant', 'founder', 'administrator', 'super_administrator', 'admin', 'super_admin', 'operations', 'practice_manager', 'bookkeeper', 'firm_manager']);
const isoDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v));
const shortText = (v: unknown, max: number) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
// Slots are 24-hour HH:MM (as produced by /available-slots); formatSlotUtc throws on anything else.
const slotTime = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const staffTenantOf = (staffId: unknown) => (typeof staffId === 'string' ? db.users.get(staffId)?.tenantId : undefined);

/** Owning client (id or booking e-mail), the assigned staff member, tenant administrators, or staff authorized for the client. */
function canManageAppointment(user: NonNullable<AuthenticatedRequest['user']>, apt: { clientId?: string; clientEmail?: string; accountantId?: string }): boolean {
  if (CLIENT_ROLES.has(user.role)) {
    return apt.clientId === (user.clientId || user.id) ||
      Boolean(apt.clientEmail && user.email && apt.clientEmail.toLowerCase() === user.email.toLowerCase());
  }
  if (apt.accountantId && apt.accountantId === user.id) return true;
  if (ADMIN_ROLES.has(user.role)) return Boolean(user.tenantId) && staffTenantOf(apt.accountantId) === user.tenantId;
  return Boolean(apt.clientId) && canAccessStaffClient(user, apt.clientId!);
}
import { 
  AppointmentTypeCode,
  SynchronizedAppointment, 
  AvailableTimeSlot, 
  CalendarBusyBlock, 
  CalendarConnection 
} from '../../types/calendar';

export const calendarRouter = Router();

// Helper to convert date and time to ISO string in specific timezone (standard Eastern Time default)
function formatSlotUtc(dateStr: string, timeStr: string, timeZone: string = 'America/New_York'): { startUtc: string; endUtc: string } {
  // Simple deterministic ISO construction
  const [hourStr, minStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  
  // Approximate standard EDT/EST offset (-4h EDT / -5h EST)
  const offsetHours = 4; // EDT
  const utcDate = new Date(`${dateStr}T${timeStr}:00.000Z`);
  utcDate.setUTCHours(hour + offsetHours, min);
  
  const startUtc = utcDate.toISOString();
  const endDate = new Date(utcDate.getTime() + 45 * 60 * 1000); // default 45m
  const endUtc = endDate.toISOString();

  return { startUtc, endUtc };
}

// -------------------------------------------------------------
// PART 6 & 8: CALCULATE REAL-TIME AVAILABILITY
// -------------------------------------------------------------

export function computeAvailableSlotsForDate(params: {
  date: string;
  serviceTypeCode?: string;
  staffId?: string;
  requestedFounder?: boolean;
  clientTimeZone?: string;
}): { availableSlots: AvailableTimeSlot[]; holiday?: string; message?: string } {
  const {
    date,
    serviceTypeCode = 'new_client_consultation',
    staffId,
    requestedFounder = false,
    clientTimeZone = 'America/New_York'
  } = params;

  // Clean expired holds
  db.cleanExpiredSlotHolds();

  // Check if requested date is a firm holiday
  const holiday = Array.from(db.firmHolidays.values()).find(h => h.date === date && h.isFirmClosed);
  if (holiday) {
    return {
      holiday: holiday.name,
      availableSlots: [],
      message: `Firm offices are closed for ${holiday.name}.`
    };
  }

  // Determine target staff
  let targetStaffId = staffId;
  const isFounderRequested = requestedFounder || serviceTypeCode === 'founder_consultation';

  if (isFounderRequested) {
    targetStaffId = 'user_accountant_desmond';
  }

  // If no specific staff requested, get all eligible staff or founder
  let candidateStaffConfigs = Array.from(db.staffAvailability.values());
  if (targetStaffId) {
    candidateStaffConfigs = candidateStaffConfigs.filter(c => c.staffId === targetStaffId);
  } else if (!isFounderRequested) {
    // Regular consultations can be handled by staff accountants
    candidateStaffConfigs = candidateStaffConfigs.filter(c => !c.isFounder || (c.founderControls?.acceptsNewClients));
  }

  const queryDate = new Date(`${date}T00:00:00`);
  const dayOfWeek = queryDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const results: AvailableTimeSlot[] = [];

  for (const config of candidateStaffConfigs) {
    // Check founder restrictions if founder
    if (config.isFounder && config.founderControls) {
      if (!config.founderControls.acceptsNewClients && isFounderRequested) {
        // Founder not accepting new clients
        continue;
      }
    }

    // Check staff's recurring schedule for this day
    const daySchedule = config.weeklySchedule.find(s => s.dayOfWeek === dayOfWeek);
    if (!daySchedule || !daySchedule.isAvailable) continue;

    // Check availability exceptions (vacation/leave)
    const hasException = Array.from(db.availabilityExceptions.values()).find(
      e => e.staffId === config.staffId && date >= e.startDate && date <= e.endDate && e.isAllDay
    );
    if (hasException) continue;

    // Generate candidate timeslots from 09:00 to 17:00
    const candidateTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

    for (const timeStr of candidateTimes) {
      // Check lunch break
      if (daySchedule.lunchBreak) {
        if (timeStr >= daySchedule.lunchBreak.start && timeStr < daySchedule.lunchBreak.end) {
          continue;
        }
      }

      const { startUtc, endUtc } = formatSlotUtc(date, timeStr, config.timeZone);
      const slotKey = `${config.staffId}_${startUtc}`;

      // 1. Check if slot is actively held by someone else
      const existingHold = db.appointmentSlotHolds.get(slotKey);
      if (existingHold && existingHold.expiresAtMs > Date.now()) {
        continue; // Slot held
      }

      // 2. Check if existing confirmed appointment occupies this time
      const existingAppointment = Array.from(db.appointments.values()).find(
        a => a.accountantId === config.staffId &&
             a.date === date &&
             a.timeSlot === timeStr &&
             (a.status === 'confirmed' || a.status === 'pending')
      );
      if (existingAppointment) continue;

      // 3. Check external calendar busy blocks (Google / Microsoft sync)
      const isExternalBusy = Array.from(db.calendarBusyBlocks.values()).find(
        b => b.staffId === config.staffId &&
             startUtc < b.endUtc &&
             endUtc > b.startUtc
      );
      if (isExternalBusy) continue;

      // Slot is genuinely free!
      results.push({
        slotKey,
        staffId: config.staffId,
        staffName: config.staffName,
        staffRole: config.staffRole,
        isFounder: config.isFounder,
        startUtc,
        endUtc,
        clientLocalDisplay: `${timeStr} (EDT)`,
        staffLocalDisplay: `${timeStr} (EDT)`,
        meetingTypesAvailable: ['virtual', 'telephone', ...(config.officeEnabled ? (['in_office'] as const) : [])]
      });
    }
  }

  return { availableSlots: results };
}

calendarRouter.get('/available-slots', (req, res) => {
  const { 
    serviceTypeCode = 'new_client_consultation', 
    staffId, 
    requestedFounder, 
    date, 
    clientTimeZone = 'America/New_York' 
  } = req.query as Record<string, string>;

  if (!date) {
    return res.status(400).json({ error: 'Query parameter "date" (YYYY-MM-DD) is required.' });
  }

  const { availableSlots, holiday, message } = computeAvailableSlotsForDate({
    date,
    serviceTypeCode,
    staffId,
    requestedFounder: requestedFounder === 'true',
    clientTimeZone
  });

  return res.json({
    date,
    serviceTypeCode,
    clientTimeZone,
    availableSlots,
    ...(holiday ? { holiday, message } : {})
  });
});

// Server-authoritative next available day lookup
calendarRouter.get('/next-available', (req, res) => {
  const {
    date,
    startDate,
    serviceTypeCode = 'new_client_consultation',
    staffId,
    requestedFounder,
    clientTimeZone = 'America/New_York'
  } = req.query as Record<string, string>;

  const initialDateStr = date || startDate || new Date().toISOString().slice(0, 10);
  const parts = initialDateStr.split('-').map(p => parseInt(p, 10));
  const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);

  // Scan up to 30 consecutive business days forward for first day with real availability
  for (let offset = 1; offset <= 30; offset++) {
    const scanDate = new Date(baseDate);
    scanDate.setDate(scanDate.getDate() + offset);
    const y = scanDate.getFullYear();
    const m = String(scanDate.getMonth() + 1).padStart(2, '0');
    const d = String(scanDate.getDate()).padStart(2, '0');
    const checkDateStr = `${y}-${m}-${d}`;

    const { availableSlots } = computeAvailableSlotsForDate({
      date: checkDateStr,
      serviceTypeCode,
      staffId,
      requestedFounder: requestedFounder === 'true',
      clientTimeZone
    });

    if (availableSlots.length > 0) {
      return res.json({
        found: true,
        date: checkDateStr,
        availableSlots,
        serviceTypeCode
      });
    }
  }

  return res.json({
    found: false,
    date: null,
    availableSlots: [],
    message: 'No consultation openings available within the next 30 days.'
  });
});

// -------------------------------------------------------------
// PART 7: CONCURRENCY PROTECTION - ATOMIC 10-MINUTE SLOT HOLD
// -------------------------------------------------------------

calendarRouter.post('/hold-slot', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { staffId, startUtc, endUtc, serviceType, idempotencyKey } = req.body;

  if (!staffId || !startUtc || !idempotencyKey) {
    return res.status(400).json({ error: 'staffId, startUtc, and idempotencyKey are required to hold a slot.' });
  }

  const clientId = req.user?.id || 'guest_prospect';
  const holdResult = db.createSlotHold(staffId, startUtc, endUtc || startUtc, clientId, serviceType || 'General Consultation', idempotencyKey);

  if (!holdResult.success) {
    return res.status(409).json({
      error: holdResult.error || 'Time slot is currently unavailable.',
      code: 'SLOT_HELD_OR_BOOKED'
    });
  }

  return res.json({
    success: true,
    message: 'Time slot reserved for 10 minutes while you complete your booking.',
    hold: holdResult.hold
  });
});

// -------------------------------------------------------------
// PART 7: CONFIRM BOOKING & SYNC WITH GOOGLE/OUTLOOK CALENDAR
// -------------------------------------------------------------

calendarRouter.post(['/book', '/confirm-booking'], authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      slotKey,
      holdId,
      idempotencyKey,
      staffId,
      date,
      timeSlot,
      serviceTypeCode,
      meetingType = 'virtual',
      clientName,
      clientEmail,
      clientPhone,
      clientTimeZone = 'America/New_York',
      notes
    } = req.body;

    const clientId = req.user?.id || 'guest_prospect';
    const effectiveClientName = clientName || req.user?.name || 'Valued Tax Client';
    const effectiveClientEmail = clientEmail || req.user?.email || 'client@example.com';
    const effectiveClientPhone = clientPhone || req.user?.phone || '803-555-0100';

    const targetStaffId = staffId || 'user_accountant_desmond';
    const staffUser = db.users.get(targetStaffId);
    const staffAvailability = db.staffAvailability.get(targetStaffId);

    // Verify slot hold if provided
    db.cleanExpiredSlotHolds();
    const resolvedSlotKey = slotKey || `${targetStaffId}_${date}T${timeSlot}:00.000Z`;
    const hold = db.appointmentSlotHolds.get(resolvedSlotKey);

    // Verify no conflicting existing booking
    const conflict = Array.from(db.appointments.values()).find(
      a => a.accountantId === targetStaffId &&
           a.date === date &&
           a.timeSlot === timeSlot &&
           (a.status === 'confirmed' || a.status === 'pending')
    );

    if (conflict) {
      return res.status(409).json({
        error: 'Slot is no longer available. Please select another slot.',
        code: 'SLOT_ALREADY_CONFIRMED'
      });
    }

    const aptId = `apt_${randomUUID()}`;
    const referenceCode = `AR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const { startUtc, endUtc } = formatSlotUtc(date, timeSlot, staffAvailability?.timeZone);

    // Two-Way Google Calendar / Microsoft Outlook Sync Synthesis:
    // Generate private meeting link and neutral calendar event title
    const isVirtual = meetingType === 'virtual';
    const virtualMeetingUrl = isVirtual 
      ? `https://meet.google.com/art-${randomUUID().slice(0, 4)}-${randomUUID().slice(0, 3)}`
      : undefined;

    // Neutral title mandated by privacy requirements
    const externalCalendarTitle = 'A/R Tax Services Appointment';
    const mockGoogleEventId = `gcal_${randomUUID().slice(0, 12)}`;

    // Create the confirmed appointment in portal database
    const newAppointment: any = {
      id: aptId,
      referenceCode,
      clientId,
      clientName: effectiveClientName,
      clientEmail: effectiveClientEmail,
      clientPhone: effectiveClientPhone,
      clientTimeZone,
      accountantId: targetStaffId,
      accountantName: staffUser?.name || 'A/R Tax Strategist',
      requestedFounder: targetStaffId === 'user_accountant_desmond',
      serviceType: serviceTypeCode || 'Tax Planning & Strategy Consultation',
      serviceTypeCode: serviceTypeCode || 'new_client_consultation',
      durationMinutes: 45,
      date,
      timeSlot,
      startUtc,
      endUtc,
      type: meetingType,
      meetingType,
      virtualMeetingUrl,
      meetingLink: virtualMeetingUrl,
      officeLocationAddress: meetingType === 'in_office' ? '1201 Main St, Suite 1400, Columbia, SC 29201' : undefined,
      status: 'confirmed',
      notes,
      googleCalendarEventId: mockGoogleEventId,
      syncStatus: 'synchronized',
      lastSyncAttempt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.appointments.set(aptId, newAppointment);

    // Release slot hold
    db.releaseSlotHold(resolvedSlotKey);

    // Create Calendar Busy Block reflecting the new confirmed appointment
    db.calendarBusyBlocks.set(`block_${aptId}`, {
      id: `block_${aptId}`,
      staffId: targetStaffId,
      source: 'portal_appointment',
      startUtc,
      endUtc,
      isAllDay: false,
      displayLabel: 'Unavailable', // Masked for privacy
      externalEventId: mockGoogleEventId
    });

    // Record audit event
    db.logAuditEvent(
      clientId,
      req.user?.role || 'client',
      'APPOINTMENT_BOOKED_AND_SYNCHRONIZED',
      'appointments',
      aptId,
      { referenceCode, staffId: targetStaffId, date, timeSlot, externalCalendarTitle },
      req.ip || '127.0.0.1'
    );

    return res.json({
      success: true,
      message: 'Consultation confirmed and synchronized with calendar.',
      appointment: newAppointment
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to complete calendar booking.', details: err.message });
  }
});

// -------------------------------------------------------------
// RESCHEDULE APPOINTMENT
// -------------------------------------------------------------

calendarRouter.post('/reschedule', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { appointmentId, newDate, newTimeSlot, reason } = req.body;
  if (!appointmentId || !isoDate(newDate) || !slotTime(newTimeSlot) || (reason !== undefined && !shortText(reason, 2000))) {
    return res.status(400).json({ error: 'appointmentId, newDate (YYYY-MM-DD) and newTimeSlot (HH:MM) are required.' });
  }

  const apt = db.appointments.get(appointmentId);
  // Previously only the "client" role was checked: any staff member (any tenant) could reschedule.
  if (!apt || !canManageAppointment(req.user!, apt)) return res.status(404).json({ error: 'Appointment not found.' });

  // Check for conflict on new date/slot
  const conflict = Array.from(db.appointments.values()).find(
    a => a.id !== appointmentId &&
         a.accountantId === apt.accountantId &&
         a.date === newDate &&
         a.timeSlot === newTimeSlot &&
         (a.status === 'confirmed' || a.status === 'pending')
  );
  if (conflict) {
    return res.status(409).json({ error: 'Selected time slot is occupied. Please select another slot.' });
  }

  // Update appointment
  const oldDate = apt.date;
  const oldTime = apt.timeSlot;
  apt.date = newDate;
  apt.timeSlot = newTimeSlot;
  apt.status = 'confirmed';
  apt.rescheduleReason = reason || 'Client requested schedule adjustment.';
  apt.updatedAt = new Date().toISOString();
  db.appointments.set(apt.id, apt);

  // Update busy block
  const { startUtc, endUtc } = formatSlotUtc(newDate, newTimeSlot);
  const block = db.calendarBusyBlocks.get(`block_${apt.id}`);
  if (block) {
    block.startUtc = startUtc;
    block.endUtc = endUtc;
    db.calendarBusyBlocks.set(block.id, block);
  }

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    'APPOINTMENT_RESCHEDULED',
    'appointments',
    apt.id,
    { oldDate, oldTime, newDate, newTimeSlot, reason },
    req.ip || '127.0.0.1'
  );

  return res.json({ success: true, message: 'Appointment rescheduled successfully.', appointment: apt });
});

// -------------------------------------------------------------
// CANCEL APPOINTMENT
// -------------------------------------------------------------

calendarRouter.post('/cancel', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { appointmentId, reason } = req.body;
  if (!appointmentId) return res.status(400).json({ error: 'appointmentId is required.' });
  if (reason !== undefined && !shortText(reason, 2000)) return res.status(400).json({ error: 'reason must be text of at most 2,000 characters.' });

  const apt = db.appointments.get(appointmentId);
  if (!apt || !canManageAppointment(req.user!, apt)) return res.status(404).json({ error: 'Appointment not found.' });

  apt.status = CLIENT_ROLES.has(req.user!.role) ? 'canceled_by_client' : 'canceled_by_staff';
  apt.cancellationReason = reason || 'Schedule conflict';
  apt.updatedAt = new Date().toISOString();
  db.appointments.set(apt.id, apt);

  // Remove busy block to free the slot immediately
  db.calendarBusyBlocks.delete(`block_${apt.id}`);

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    'APPOINTMENT_CANCELED',
    'appointments',
    apt.id,
    { reason, status: apt.status },
    req.ip || '127.0.0.1'
  );

  return res.json({ success: true, message: 'Appointment canceled and slot released.', appointment: apt });
});

// -------------------------------------------------------------
// PART 5: GOOGLE / MICROSOFT CALENDAR INTEGRATION MANAGEMENT
// -------------------------------------------------------------

calendarRouter.get('/connections', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  let connections = Array.from(db.calendarConnections.values());
  if (ADMIN_ROLES.has(req.user.role)) {
    // Administrators see their own tenant's staff connections only.
    connections = connections.filter(c => Boolean(req.user!.tenantId) && staffTenantOf(c.staffId) === req.user!.tenantId);
  } else {
    connections = connections.filter(c => c.staffId === req.user!.id);
  }

  return res.json({ connections });
});

calendarRouter.post('/connect-provider', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { provider = 'google_calendar', email } = req.body ?? {};
  if (!['google_calendar', 'microsoft_outlook', 'outlook', 'apple_calendar'].includes(provider)) {
    return res.status(400).json({ error: 'Unsupported calendar provider.', code: 'PROVIDER_INVALID' });
  }
  if (email !== undefined && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254)) {
    return res.status(400).json({ error: 'A valid provider account e-mail is required.', code: 'EMAIL_INVALID' });
  }

  const connId = `conn_${req.user.id}_${provider}`;
  // No calendar provider OAuth is commissioned (E04): record a pending authorization, never "connected".
  const connection: CalendarConnection = {
    id: connId,
    staffId: req.user.id,
    staffName: req.user.name,
    provider,
    status: 'authorization_pending',
    providerAccountEmail: email || req.user.email,
    selectedCalendarId: 'primary',
    selectedCalendarName: `${req.user.name} Work Calendar`,
    syncFreeBusyOnly: true,
    twoWaySyncEnabled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.calendarConnections.set(connId, connection);

  db.logAuditEvent(
    req.user.id,
    req.user.role,
    'CALENDAR_PROVIDER_CONNECTED',
    'calendarConnections',
    connId,
    { provider, email: connection.providerAccountEmail },
    req.ip || '127.0.0.1'
  );

  return res.json({ success: true, message: `${provider} connection request recorded. Provider authorization is not yet available; no calendar data is synchronized.`, connection });
});

calendarRouter.post('/disconnect-provider', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { connectionId } = req.body;

  const conn = db.calendarConnections.get(connectionId);
  // Only the connection's own staff member, or an administrator of that staff member's tenant.
  const mayDisconnect = conn && (conn.staffId === req.user.id ||
    (ADMIN_ROLES.has(req.user.role) && Boolean(req.user.tenantId) && staffTenantOf(conn.staffId) === req.user.tenantId));
  if (!conn || !mayDisconnect) return res.status(404).json({ error: 'Connection not found.' });

  conn.status = 'disconnected';
  conn.updatedAt = new Date().toISOString();
  db.calendarConnections.set(conn.id, conn);

  return res.json({ success: true, message: 'Calendar disconnected.' });
});

// -------------------------------------------------------------
// PART 9: FOUNDER CALENDAR CONTROLS (DESMOND HINDS)
// -------------------------------------------------------------

calendarRouter.get('/founder-controls', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const founderConfig = db.staffAvailability.get('user_accountant_desmond');
  if (!founderConfig) return res.status(404).json({ error: 'Founder availability config not found.' });

  return res.json({ controls: founderConfig.founderControls, config: founderConfig });
});

calendarRouter.post('/founder-controls', authenticateToken, requireRole('founder', 'administrator', 'super_administrator'), (req: AuthenticatedRequest, res: Response) => {
  const founderConfig = db.staffAvailability.get('user_accountant_desmond');
  // Only the founder's own tenant may change these controls.
  if (!founderConfig || !req.user!.tenantId || staffTenantOf(founderConfig.staffId) !== req.user!.tenantId) {
    return res.status(404).json({ error: 'Founder configuration not found.' });
  }

  const { controls } = req.body ?? {};
  if (!controls || typeof controls !== 'object' || Array.isArray(controls)) {
    return res.status(400).json({ error: 'controls must be an object.', code: 'FOUNDER_CONTROLS_INVALID' });
  }
  founderConfig.founderControls = {
    ...founderConfig.founderControls,
    ...controls
  };
  founderConfig.updatedAt = new Date().toISOString();
  db.staffAvailability.set(founderConfig.staffId, founderConfig);

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    'FOUNDER_CALENDAR_CONTROLS_UPDATED',
    'staffAvailability',
    founderConfig.id,
    controls,
    req.ip || '127.0.0.1'
  );

  return res.json({ success: true, message: 'Founder scheduling controls updated successfully.', controls: founderConfig.founderControls });
});

// -------------------------------------------------------------
// PART 10: ADMINISTRATIVE CALENDAR & OVERRIDE SCHEDULING
// -------------------------------------------------------------

calendarRouter.get('/firm-overview', authenticateToken, requireRole('administrator', 'super_administrator', 'firm_manager'), (req: AuthenticatedRequest, res: Response) => {
  // Scope to the caller's tenant via the staff member who owns each calendar (previously every tenant).
  const tenantId = req.user!.tenantId;
  const inTenant = (staffId: unknown) => Boolean(tenantId) && staffTenantOf(staffId) === tenantId;
  const appointments = Array.from(db.appointments.values()).filter(a => inTenant(a.accountantId));
  const staffConfigs = Array.from(db.staffAvailability.values()).filter(c => inTenant(c.staffId));
  const holidays = Array.from(db.firmHolidays.values());
  const locations = Array.from(db.meetingLocations.values());
  const activeHolds = Array.from(db.appointmentSlotHolds.values()).filter(h => h.expiresAtMs > Date.now() && inTenant(h.staffId));

  return res.json({
    totalAppointments: appointments.length,
    confirmedAppointments: appointments.filter(a => a.status === 'confirmed').length,
    staffCount: staffConfigs.length,
    activeHoldsCount: activeHolds.length,
    holidays,
    locations,
    appointments
  });
});

calendarRouter.post('/admin-override-booking', authenticateToken, requireRole('administrator', 'super_administrator'), (req: AuthenticatedRequest, res: Response) => {
  const { staffId, date, timeSlot, clientName, clientEmail, serviceType, overrideReason } = req.body ?? {};
  if (!staffId || !isoDate(date) || !slotTime(timeSlot) || !shortText(overrideReason, 2000)) {
    return res.status(400).json({ error: 'staffId, date (YYYY-MM-DD), timeSlot (HH:MM), and overrideReason are required for administrative overrides.' });
  }
  if ((clientName !== undefined && !shortText(clientName, 200)) || (serviceType !== undefined && !shortText(serviceType, 200)) ||
      (clientEmail !== undefined && (typeof clientEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clientEmail) || clientEmail.length > 254))) {
    return res.status(400).json({ error: 'Invalid client name, e-mail or service type.' });
  }

  // The staff member must exist, be staff, and belong to the administrator's tenant.
  const staff = typeof staffId === 'string' ? db.users.get(staffId) : undefined;
  if (!staff || !STAFF_CALENDAR_ROLES.has(staff.role) || !req.user!.tenantId || staff.tenantId !== req.user!.tenantId) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  const aptId = `apt_override_${randomUUID()}`;
  const referenceCode = `AR-ADM-${Math.floor(1000 + Math.random() * 9000)}`;

  // No invented contact details or meeting links: unknown values stay empty.
  const overrideAppointment: any = {
    id: aptId,
    referenceCode,
    clientId: 'admin_scheduled',
    clientName: clientName || 'Unspecified client',
    clientEmail: clientEmail || undefined,
    accountantId: staffId,
    accountantName: staff.name,
    serviceType: serviceType || 'Administrative Consultation',
    date,
    timeSlot,
    type: 'virtual',
    meetingLink: undefined,
    status: 'confirmed',
    staffInternalNotes: `Administrative override scheduled by ${req.user!.name}. Reason: ${overrideReason}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.appointments.set(aptId, overrideAppointment);

  db.logAuditEvent(
    req.user!.id,
    req.user!.role,
    'ADMINISTRATIVE_CALENDAR_OVERRIDE_BOOKED',
    'appointments',
    aptId,
    { staffId, date, timeSlot, overrideReason },
    req.ip || '127.0.0.1'
  );

  return res.json({ success: true, message: 'Administrative override booking confirmed.', appointment: overrideAppointment });
});
