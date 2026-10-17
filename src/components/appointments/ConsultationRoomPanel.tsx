import React, { useCallback, useEffect, useRef, useState } from 'react';
import { appointmentErrorText, appointmentsService, formatAppointmentTime, type ConsultationRoom, type RoomState } from '../../services/appointmentsService';

const STATE_TEXT: Record<RoomState, string> = {
  OPEN: 'The room is open.',
  NOT_YET_OPEN: 'The room opens 15 minutes before the appointment starts.',
  NOT_CONFIRMED: 'The room opens once the appointment is confirmed.',
  NOT_REMOTE: 'This appointment is not a video call, so it has no room.',
  CANCELLED: 'This appointment was cancelled.',
  ENDED: 'This appointment has ended.',
};

/**
 * Durable consultation room (contract C5). Everything shown comes from the appointment record:
 * room state, access window, assigned host and the meeting link entered by the practice. TaxGuard
 * provides no video service, does not record audio or video, and only records that a participant
 * joined or left. Joining opens the practice's meeting link in a new tab.
 */
export function ConsultationRoomPanel({ clientId, appointmentId, api = appointmentsService }: { clientId: string; appointmentId: string; api?: typeof appointmentsService }) {
  const [room, setRoom] = useState<{ status: 'loading' | 'ready' | 'error'; data?: ConsultationRoom; error?: string }>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current;
    setRoom(r => ({ ...r, status: 'loading' }));
    api.room(clientId, appointmentId).then(data => { if (mine === seq.current) setRoom({ status: 'ready', data }); })
      .catch(e => { if (mine === seq.current) setRoom({ status: 'error', error: appointmentErrorText(e) }); });
  }, [api, clientId, appointmentId]);
  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);
  const record = async (event: 'join' | 'leave') => {
    setBusy(true); setNotice(null);
    try {
      const data = await api.roomEvent(clientId, appointmentId, event);
      seq.current++; setRoom({ status: 'ready', data });
      setNotice({ error: false, text: event === 'join' ? 'Your attendance was recorded.' : 'Your departure was recorded.' });
      if (event === 'join' && data.meetingUrl) window.open(data.meetingUrl, '_blank', 'noopener,noreferrer');
    } catch (e) { setNotice({ error: true, text: appointmentErrorText(e) }); }
    finally { setBusy(false); }
  };
  const r = room.data;
  return <section aria-labelledby={`room-${appointmentId}`} aria-busy={room.status === 'loading'} className="space-y-2 rounded border p-3">
    <h4 id={`room-${appointmentId}`} className="font-semibold">Consultation room</h4>
    {room.status === 'loading' && !r && <p role="status">Loading the room…</p>}
    {room.status === 'error' && <p role="alert">{room.error} <button type="button" onClick={load}>Retry</button></p>}
    {r && <RoomBody room={r} busy={busy} loading={room.status === 'loading'} onRecord={record} onRefresh={load} />}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
  </section>;
}

/** The room as reported by the server. Pure: no request is made here. */
export function RoomBody({ room: r, busy, loading, onRecord, onRefresh }: { room: ConsultationRoom; busy: boolean; loading: boolean;
  onRecord: (event: 'join' | 'leave') => void; onRefresh: () => void }) {
  return <>
    <p role="status">{STATE_TEXT[r.roomState]}</p>
      <p>{formatAppointmentTime(r)} · Room access <time dateTime={r.accessWindow.opensAt}>{new Date(r.accessWindow.opensAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
        {' – '}<time dateTime={r.accessWindow.closesAt}>{new Date(r.accessWindow.closesAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</time></p>
      <p>Host: {r.host.assigned ? r.host.displayName ?? 'Assigned advisor' : 'No advisor assigned yet'}
        {r.roomState === 'OPEN' && <> · {r.hostPresent ? 'host has joined' : 'host has not joined yet'} · {r.clientPresent ? 'client has joined' : 'client has not joined yet'}</>}</p>
      <p className="text-xs">TaxGuard does not provide or record the video call. The practice's own meeting service is used{r.roomState === 'OPEN' && !r.meetingUrl ? ', but no meeting link has been recorded yet. Ask your advisor for the link.' : '.'}</p>
      {r.roomState === 'OPEN' && r.meetingUrl && <p>Meeting link: <a href={r.meetingUrl} target="_blank" rel="noopener noreferrer">{r.meetingUrl}</a></p>}
      <div className="flex flex-wrap gap-2">
        {r.roomState === 'OPEN' && !r.joined && <button type="button" disabled={busy} onClick={() => onRecord('join')}>{busy ? 'Recording…' : r.meetingUrl ? 'Join and open meeting link' : 'Record that I joined'}</button>}
        {r.joined && <button type="button" disabled={busy} onClick={() => onRecord('leave')}>{busy ? 'Recording…' : 'Leave room'}</button>}
        <button type="button" disabled={busy || loading} onClick={onRefresh}>Refresh room</button>
      </div>
  </>;
}

/** Page for the 'virtual_consultation_room' route: the durable room for one appointment, or guidance. */
export function ConsultationRoomPage({ clientId, appointmentId, onExit }: { clientId?: string; appointmentId?: string; onExit: () => void }) {
  return <main id="main-content" aria-labelledby="consultation-room-heading" className="max-w-3xl mx-auto py-10 px-4 space-y-4">
    <h1 id="consultation-room-heading" className="text-2xl font-bold">Consultation room</h1>
    {clientId && appointmentId ? <ConsultationRoomPanel clientId={clientId} appointmentId={appointmentId} />
      : <p role="status">Open a video appointment from your appointments list to see its room.</p>}
    <button type="button" onClick={onExit}>Back</button>
  </main>;
}
