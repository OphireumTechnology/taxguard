import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clientPortalContracts, portalErrorMessage, type ConsultationHistoryItem } from '../../../services/clientPortalContracts';

const TOPIC: Record<string, string> = { INDIVIDUAL_TAX: 'Individual tax', BUSINESS_TAX: 'Business tax', TAX_PLANNING: 'Tax planning', BOOKKEEPING: 'Bookkeeping', IRS_NOTICE: 'IRS notice', OTHER: 'Other' };
const APT: Record<string, string> = { REQUESTED: 'Requested — not yet confirmed', CONFIRMED: 'Confirmed', COMPLETED: 'Completed', CANCELLED: 'Cancelled', NO_SHOW: 'Missed' };
const when = (iso: string, tz?: string) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', ...(tz ? { timeZone: tz } : {}) }); } catch { return new Date(iso).toLocaleString(); } };

/**
 * Consultation requests your practice converted into appointments for your account (contract C1).
 * Shows the appointment's current recorded status; a request without an appointment is never shown
 * as a booking. Requests not yet linked to your account by the practice do not appear.
 */
export function ClientConsultationHistoryPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<ConsultationHistoryItem[]>([]);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; message?: string; next: string | null }>({ status: 'loading', next: null });
  const seq = useRef(0);
  const load = useCallback((after?: string) => {
    const mine = ++seq.current;
    setState(s => ({ ...s, status: 'loading' }));
    clientPortalContracts.consultations(clientId, after)
      .then(r => { if (mine !== seq.current) return; setItems(prev => after ? [...prev, ...r.items] : r.items); setState({ status: 'ready', next: r.nextCursor }); })
      .catch(e => { if (mine === seq.current) setState({ status: 'error', message: portalErrorMessage(e), next: null }); });
  }, [clientId]);
  useEffect(() => { setItems([]); load(); return () => { seq.current++; }; }, [load]);

  return <section aria-labelledby="client-consultations-heading" aria-busy={state.status === 'loading'} className="rounded-2xl border border-slate-700 bg-[#0D2745] p-4 space-y-3 text-sm text-slate-200">
    <header>
      <h3 id="client-consultations-heading" className="font-bold text-white">Consultation history</h3>
      <p className="text-xs text-slate-400">Consultation requests your practice has linked to your account and scheduled. A request is not an appointment until it appears here with a confirmed time.</p>
    </header>
    {state.status === 'loading' && items.length === 0 && <p role="status">Loading consultation history…</p>}
    {state.status === 'error' && <p role="alert">{state.message} <button type="button" className="underline" onClick={() => load()}>Retry</button></p>}
    {state.status === 'ready' && items.length === 0 && <p role="status">No consultations have been scheduled from your requests yet.</p>}
    {items.length > 0 && <ul className="space-y-2">{items.map(i => <li key={i.requestId} className="rounded-xl border border-slate-700 p-3">
      <p className="font-semibold text-white">{TOPIC[i.topic] ?? 'Consultation'}</p>
      <p className="text-xs text-slate-400">Requested <time dateTime={i.createdAt}>{when(i.createdAt)}</time></p>
      {i.appointment
        ? <p>{APT[i.appointment.status] ?? i.appointment.status} · <time dateTime={i.appointment.startsAt}>{when(i.appointment.startsAt, i.appointment.timezone)}</time> ({i.appointment.timezone}) · {i.appointment.mode === 'REMOTE' ? 'Remote' : i.appointment.mode === 'PHONE' ? 'Phone' : 'In person'}</p>
        : <p>No appointment is recorded for this request.</p>}
    </li>)}</ul>}
    {state.next && <button type="button" className="px-3 py-1.5 rounded-lg border border-slate-600 min-h-[36px]" disabled={state.status === 'loading'} onClick={() => load(state.next!)}>Show more</button>}
  </section>;
}
