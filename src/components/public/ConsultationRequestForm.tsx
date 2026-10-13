import React, { useEffect, useRef, useState } from 'react';
import { apiEndpoint } from '../../config/apiEndpoint';
import { BrandedDatePicker } from '../ui/BrandedDatePicker';

const TOPICS: Array<[string, string]> = [['INDIVIDUAL_TAX', 'Individual tax'], ['BUSINESS_TAX', 'Business tax'], ['TAX_PLANNING', 'Tax planning'],
  ['BOOKKEEPING', 'Bookkeeping'], ['IRS_NOTICE', 'IRS or state notice'], ['OTHER', 'Something else']];
const PARTS: Array<[string, string]> = [['MORNING', 'Morning'], ['AFTERNOON', 'Afternoon'], ['EVENING', 'Evening']];
const zone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
const isoDay = (days: number) => { const d = new Date(Date.now() + days * 86_400_000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const newKey = () => 'cs-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
const field = 'w-full rounded-lg border border-[rgba(148,163,184,0.25)] bg-[#102D4F] px-3 py-2 text-sm text-white';

export function consultationErrorText(code?: string) {
  switch (code) {
    case 'CONSULTATION_RATE_LIMITED': return 'Too many requests were sent recently. Please try again later or call the office.';
    case 'CONSULTATION_CONSENT_REQUIRED': return 'Please confirm the consent statement.';
    case 'CONSULTATION_INPUT_INVALID': return 'Please check your details: a valid e-mail, a phone number if you prefer a call, and dates within the next four months.';
    case 'CONSULTATION_TOO_LARGE': return 'Your message is too long.';
    case 'CONSULTATION_UNAVAILABLE': case 'CONSULTATION_STORE_UNAVAILABLE': return 'Online consultation requests are not available right now. Please call the office.';
    default: return 'Your request was not received. Please try again or call the office.';
  }
}

/**
 * Public consultation request (proposal 043). Sends a request only: no account, no booking, no
 * e-mail. The server validates, rate-limits and stores it; staff contact the visitor to confirm.
 */
export function ConsultationRequestForm() {
  const [consent, setConsent] = useState<{ version: string; text: string } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [f, setF] = useState({ fullName: '', email: '', phone: '', preferredContact: 'EMAIL', topic: 'INDIVIDUAL_TAX', modePreference: 'REMOTE', message: '',
    windows: [{ date: '', partOfDay: 'MORNING' }], agreed: false, website: '' });
  const [state, setState] = useState<{ status: 'idle' | 'sending' | 'sent' | 'error'; text?: string; reference?: string }>({ status: 'idle' });
  const key = useRef(newKey());
  useEffect(() => {
    fetch(apiEndpoint('/api/public/consultation-requests/consent'), { cache: 'no-store', credentials: 'omit' })
      .then(r => r.ok ? r.json() : Promise.reject(r)).then(setConsent).catch(() => setUnavailable(true));
  }, []);
  const set = (patch: Partial<typeof f>) => { setF({ ...f, ...patch }); key.current = newKey(); if (state.status === 'error') setState({ status: 'idle' }); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent || state.status === 'sending') return;
    if (!f.agreed) { setState({ status: 'error', text: consultationErrorText('CONSULTATION_CONSENT_REQUIRED') }); return; }
    setState({ status: 'sending' });
    try {
      const r = await fetch(apiEndpoint('/api/public/consultation-requests'), { method: 'POST', cache: 'no-store', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key.current },
        body: JSON.stringify({ fullName: f.fullName.trim(), email: f.email.trim(), ...(f.phone.trim() ? { phone: f.phone.trim() } : {}), preferredContact: f.preferredContact,
          topic: f.topic, modePreference: f.modePreference, preferredWindows: f.windows.filter(w => w.date), timezone: zone, ...(f.message.trim() ? { message: f.message.trim() } : {}),
          consent: true, consentVersion: consent.version, website: f.website }) });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.received) { setState({ status: 'error', text: consultationErrorText(data?.code) }); return; }
      setState({ status: 'sent', reference: data.reference });
    } catch { setState({ status: 'error', text: consultationErrorText() }); }
  };
  if (unavailable) return <p role="status" className="rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[#0D2745] p-6 text-sm text-[#A9B7C8]">{consultationErrorText('CONSULTATION_UNAVAILABLE')}</p>;
  if (state.status === 'sent') return <section role="status" aria-label="Consultation request received" className="space-y-2 rounded-2xl border border-[rgba(212,168,67,0.4)] bg-[#0D2745] p-6 text-sm text-[#F8FAFC]">
    <h2 className="font-serif text-xl font-bold">Request received</h2>
    <p>Thank you. Our team reviews every request and will contact you to confirm a time. No appointment is booked until we do.</p>
    {state.reference && <p>Your reference: <strong>{state.reference}</strong></p>}
  </section>;
  return <form aria-label="Consultation request" onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[#0D2745] p-6 text-sm text-[#F8FAFC]">
    <h2 className="font-serif text-xl font-bold">Request a consultation</h2>
    <p className="text-[#A9B7C8]">This sends a request to the practice. It does not create an account or book a time.</p>
    {state.status === 'error' && <p role="alert" className="text-red-300">{state.text}</p>}
    <label className="block">Full name<input className={field} required minLength={2} maxLength={120} autoComplete="name" value={f.fullName} onChange={e => set({ fullName: e.target.value })} /></label>
    <label className="block">E-mail<input className={field} type="email" required maxLength={254} autoComplete="email" value={f.email} onChange={e => set({ email: e.target.value })} /></label>
    <label className="block">Phone (optional)<input className={field} type="tel" maxLength={32} autoComplete="tel" value={f.phone} onChange={e => set({ phone: e.target.value })} /></label>
    <label className="block">How should we contact you?<select className={field} value={f.preferredContact} onChange={e => set({ preferredContact: e.target.value })}>
      <option value="EMAIL">E-mail</option><option value="PHONE">Phone</option></select></label>
    <label className="block">Topic<select className={field} value={f.topic} onChange={e => set({ topic: e.target.value })}>{TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label className="block">Meeting preference<select className={field} value={f.modePreference} onChange={e => set({ modePreference: e.target.value })}>
      <option value="REMOTE">Video call</option><option value="PHONE">Phone call</option><option value="IN_PERSON">In person</option></select></label>
    <fieldset className="space-y-2"><legend>When are you generally available? (up to three, times in {zone})</legend>
      {f.windows.map((w, i) => <div key={i} className="flex flex-wrap gap-2">
        <BrandedDatePicker id={'consultation-window-date-' + i} label="Date" ariaLabel={'Preferred date ' + (i + 1)} value={w.date} minDate={isoDay(0)} maxDate={isoDay(120)}
          onChange={date => set({ windows: f.windows.map((x, j) => j === i ? { ...x, date } : x) })} />
        <label>Time of day<select className={field} value={w.partOfDay} onChange={e => set({ windows: f.windows.map((x, j) => j === i ? { ...x, partOfDay: e.target.value } : x) })}>
          {PARTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>)}
      {f.windows.length < 3 && <button type="button" onClick={() => set({ windows: [...f.windows, { date: '', partOfDay: 'MORNING' }] })}>Add another time</button>}
    </fieldset>
    <label className="block">Anything we should know? (optional; no account numbers or tax IDs, please)<textarea className={field} maxLength={1000} value={f.message} onChange={e => set({ message: e.target.value })} /></label>
    {/* Honeypot for automated submissions; hidden from people and assistive technology. */}
    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
      <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={e => set({ website: e.target.value })} /></label>
    </div>
    {consent && <label className="flex gap-2"><input type="checkbox" checked={f.agreed} onChange={e => set({ agreed: e.target.checked })} /><span>{consent.text}</span></label>}
    <button disabled={!consent || state.status === 'sending'} className="rounded-lg bg-[#D4A843] px-4 py-2 font-bold text-[#06182B] disabled:opacity-50">{state.status === 'sending' ? 'Sending…' : 'Send request'}</button>
  </form>;
}
