import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { appointmentErrorText, formatAppointmentTime, zonedLocalToIso } from '../services/appointmentsService';
import { AppointmentsPanel } from '../components/appointments/AppointmentsPanel';
import { appointmentSummaries } from '../components/portal/dashboard/clientDashboardModel';

// Appointment UI helpers (proposal 040), synthetic values only.
describe('time zone handling', () => {
  it('converts a wall-clock time in an IANA zone to the right instant, across daylight saving', () => {
    expect(zonedLocalToIso('2026-07-01T10:00', 'America/New_York')).toBe('2026-07-01T14:00:00.000Z'); // EDT, UTC-4
    expect(zonedLocalToIso('2026-12-01T10:00', 'America/New_York')).toBe('2026-12-01T15:00:00.000Z'); // EST, UTC-5
    expect(zonedLocalToIso('2026-12-01T10:00', 'UTC')).toBe('2026-12-01T10:00:00.000Z');
    expect(zonedLocalToIso('2026-07-01T10:00', 'Asia/Manila')).toBe('2026-07-01T02:00:00.000Z');
  });
  it('refuses local times that do not exist, invalid zones and malformed input', () => {
    expect(zonedLocalToIso('2026-03-08T02:30', 'America/New_York')).toBeNull(); // spring-forward gap
    expect(zonedLocalToIso('2026-07-01T10:00', 'Mars/Olympus')).toBeNull();
    expect(zonedLocalToIso('2026-07-01 10:00', 'UTC')).toBeNull();
  });
  it('formats in the appointment zone and adds the viewer time when it differs', () => {
    const a = { startsAt: '2026-07-01T14:00:00.000Z', endsAt: '2026-07-01T15:00:00.000Z', timezone: 'America/New_York' };
    expect(formatAppointmentTime(a)).toBe('Wednesday, Jul 1, 2026, 10:00 AM – 11:00 AM EDT');
    expect(formatAppointmentTime(a, 'UTC')).toContain('(your time 2:00 PM UTC)');
  });
});

describe('client overview from durable appointments', () => {
  it('maps own appointments to the overview shape in their own time zone, never another client', () => {
    const base = { appointmentId: 'apt_a', clientId: 'client-a', engagementId: null, category: 'CONSULTATION' as const, mode: 'REMOTE' as const, status: 'REQUESTED' as const,
      title: 'Synthetic', agenda: null, startsAt: '2026-07-01T14:00:00.000Z', endsAt: '2026-07-01T15:00:00.000Z', timezone: 'America/New_York', location: null, meetingUrl: null,
      cancelReason: null, hasStaff: false, version: 1, createdAt: '2026-06-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z' };
    const rows = appointmentSummaries([base, { ...base, appointmentId: 'apt_b', clientId: 'client-b' }], { userId: 'u', clientId: 'client-a', tenantId: 't', taxYear: 2026 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'apt_a', date: '2026-07-01', timeSlot: '10:00', status: 'pending', type: 'virtual', accountantName: 'Not yet assigned' });
  });
});

describe('appointments panel', () => {
  it('starts loading, and offers clients a request form without staff-only fields', () => {
    const html = renderToStaticMarkup(<AppointmentsPanel mode={{ kind: 'client', clientId: 'client-a' }} />);
    expect(html).toContain('Loading appointments');
    expect(html).toContain('Request an appointment');
    expect(html).not.toMatch(/Internal note|Responsible staff|Client ID/);
  });
  it('offers staff a booking form with the client and staff fields', () => {
    const html = renderToStaticMarkup(<AppointmentsPanel mode={{ kind: 'staff' }} actorId="staff-a" />);
    expect(html).toContain('My appointment schedule');
    expect(html).toMatch(/Client ID/); expect(html).toMatch(/Responsible staff UID/);
  });
  it('explains conflicts and refusals without claiming a change', () => {
    expect(appointmentErrorText({ code: 'APPOINTMENT_STAFF_CONFLICT' })).toMatch(/already has an appointment/);
    expect(appointmentErrorText({ code: 'APPOINTMENT_STORE_UNAVAILABLE' })).toBe('Scheduling is not available in this environment.');
    expect(appointmentErrorText({})).toMatch(/Nothing was changed/);
  });
});
