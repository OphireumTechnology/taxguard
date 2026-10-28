import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConsultationRoomPage, RoomBody } from '../components/appointments/ConsultationRoomPanel';
import { appointmentErrorText, type ConsultationRoom } from '../services/appointmentsService';

// Contract C5 room view: truthful states only (synthetic data). No video provider is implied.
const room = (over: Partial<ConsultationRoom> = {}): ConsultationRoom => ({ appointmentId: 'apt_' + 'a'.repeat(32), title: 'Synthetic', mode: 'REMOTE', appointmentStatus: 'CONFIRMED',
  startsAt: '2026-07-01T14:00:00.000Z', endsAt: '2026-07-01T15:00:00.000Z', timezone: 'America/New_York', participant: 'CLIENT', roomState: 'OPEN',
  accessWindow: { opensAt: '2026-07-01T13:45:00.000Z', closesAt: '2026-07-01T15:15:00.000Z' }, host: { assigned: true, displayName: 'Synthetic Advisor' }, clientName: 'Synthetic Client',
  meetingUrl: 'https://meet.example.test/x', videoProvider: 'NOT_COMMISSIONED', joined: false, hostPresent: false, clientPresent: false, ...over });
const html = (r: ConsultationRoom) => renderToStaticMarkup(<RoomBody room={r} busy={false} loading={false} onRecord={() => undefined} onRefresh={() => undefined} />);

describe('consultation room view', () => {
  it('offers to join an open room with the recorded link and states that no video is provided or recorded', () => {
    const out = html(room());
    expect(out).toContain('The room is open.');
    expect(out).toContain('Join and open meeting link');
    expect(out).toContain('href="https://meet.example.test/x"');
    expect(out).toContain('does not provide or record the video call');
    expect(out).toContain('Host: Synthetic Advisor');
    expect(out).toContain('host has not joined yet');
  });
  it('shows no link or join action outside the open window', () => {
    for (const [state, text] of [['NOT_YET_OPEN', 'opens 15 minutes before'], ['CANCELLED', 'was cancelled'], ['ENDED', 'has ended'], ['NOT_REMOTE', 'not a video call']] as const) {
      const out = html(room({ roomState: state, meetingUrl: null }));
      expect(out, state).toContain(text);
      expect(out, state).not.toMatch(/Join|href=/);
    }
  });
  it('is honest when no meeting link was recorded and offers to leave once joined', () => {
    expect(html(room({ meetingUrl: null }))).toContain('no meeting link has been recorded yet');
    expect(html(room({ meetingUrl: null }))).toContain('Record that I joined');
    const joined = html(room({ joined: true, clientPresent: true }));
    expect(joined).toContain('Leave room');
    expect(joined).not.toContain('Join and open');
  });
  it('gives guidance without an appointment and explains refusals', () => {
    expect(renderToStaticMarkup(<ConsultationRoomPage onExit={() => undefined} />)).toContain('Open a video appointment from your appointments list');
    expect(appointmentErrorText({ code: 'ROOM_NOT_OPEN' })).toMatch(/15 minutes before/);
    expect(appointmentErrorText({ code: 'ROOM_EVENT_LIMIT' })).toMatch(/Too many/);
  });
});
