import React, { useCallback, useEffect, useRef, useState } from 'react';
import { documentRequestService, type NotificationPreferences } from '../../../services/documentRequestService';
import { VaultRequestError } from '../../../services/vaultService';

const CATEGORY: Record<string, { title: string; detail: string }> = {
  DOCUMENT_REQUESTS: { title: 'Document requests', detail: 'New requests and their outcome. These need your action, so they are always shown.' },
  DOCUMENT_REMINDERS: { title: 'Reminders', detail: 'Repeat reminders about an open request. The request itself stays visible either way.' },
  ACCOUNT_SECURITY_LEGAL: { title: 'Account security and legal notices', detail: 'Required notices about your account and our obligations. Always shown.' },
};
const CHANNEL: Record<string, string> = { IN_APP: 'In this portal', EMAIL: 'E-mail', SMS: 'Text message' };
const button = 'px-3 py-1.5 rounded-lg border border-slate-600 text-xs font-bold hover:border-[#D4A843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4A843] disabled:opacity-50';

export function preferenceErrorText(code?: string): string {
  switch (code) {
    case 'NOTIFICATION_PREF_VERSION_CONFLICT': return 'Your preferences changed elsewhere. They were reloaded; try again.';
    case 'NOTIFICATION_CATEGORY_MANDATORY': return 'This notice is required and cannot be turned off.';
    case 'NOTIFICATION_CHANNEL_UNAVAILABLE': return 'That delivery channel is not offered.';
    case 'NOTIFICATION_PREF_LIMIT': return 'This preference has been changed too many times. Contact your practice.';
    default: return 'The server did not confirm this change. Nothing was changed; try again.';
  }
}

/** The preferences as reported by the server. Pure: no request is made here. */
export function PreferencesBody({ prefs, hidden, busy, onToggle }: { prefs: NotificationPreferences; hidden: number; busy: boolean; onToggle: (category: string, enabled: boolean, version: number) => void }) {
  return <>
    <fieldset className="space-y-2">
      <legend className="font-semibold text-white">Shown in this portal</legend>
      {prefs.categories.map(c => <div key={c.category} className="rounded-xl border border-slate-700 p-3">
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-1" checked={c.inApp} disabled={c.mandatory || busy} aria-describedby={`pref-${c.category}`}
            onChange={e => onToggle(c.category, e.target.checked, c.version)} />
          <span><span className="font-semibold text-white">{CATEGORY[c.category]?.title ?? c.category}</span>{c.mandatory && <span className="text-xs text-slate-400"> · Required</span>}
            <span id={`pref-${c.category}`} className="block text-xs text-slate-400">{CATEGORY[c.category]?.detail}</span></span>
        </label>
      </div>)}
    </fieldset>
    {hidden > 0 && <p role="status">{hidden} reminder{hidden === 1 ? ' is' : 's are'} hidden by your preference.</p>}
    <div>
      <h3 className="font-semibold text-white">Delivery channels</h3>
      <ul className="text-xs text-slate-300">{Object.entries(prefs.channels).map(([ch, st]) =>
        <li key={ch}>{CHANNEL[ch] ?? ch}: {st === 'AVAILABLE' ? 'available' : 'not offered — no messages are sent this way'}</li>)}</ul>
    </div>
  </>;
}

/**
 * Notification preferences (contract C6), stored by the server per client user. Only the in-app
 * channel exists; required notices cannot be turned off; e-mail and SMS are not offered because
 * no delivery service, channel consent or retention policy is approved.
 */
export function ClientNotificationPreferencesPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'unavailable'; prefs?: NotificationPreferences; hidden: number }>({ status: 'loading', hidden: 0 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const live = useRef(true);
  const load = useCallback(() => {
    setState(s => ({ ...s, status: 'loading' }));
    Promise.all([documentRequestService.preferences(clientId), documentRequestService.hiddenCount(clientId)])
      .then(([prefs, hidden]) => { if (live.current) setState({ status: 'ready', prefs, hidden }); })
      .catch(e => { if (live.current) setState({ status: e instanceof VaultRequestError && e.status === 503 ? 'unavailable' : 'error', hidden: 0 }); });
  }, [clientId]);
  useEffect(() => { live.current = true; load(); return () => { live.current = false; }; }, [load]);
  const toggle = async (category: string, enabled: boolean, version: number) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      await documentRequestService.setPreference(clientId, category, enabled, version);
      if (live.current) { setNotice({ error: false, text: enabled ? 'Reminders will be shown.' : 'Reminders are hidden.' }); load(); }
    } catch (e) {
      if (live.current) { setNotice({ error: true, text: preferenceErrorText((e as VaultRequestError)?.code) }); load(); }
    } finally { if (live.current) setBusy(false); }
  };
  return <section aria-labelledby="client-notification-prefs-heading" aria-busy={state.status === 'loading'} className="max-w-3xl mx-auto pb-6 px-4 space-y-3 text-sm text-slate-200">
    <h2 id="client-notification-prefs-heading" className="text-lg font-bold text-white">Notification preferences</h2>
    {state.status === 'loading' && !state.prefs && <p role="status">Loading preferences…</p>}
    {state.status === 'unavailable' && <p role="status">Notification preferences are not enabled in this environment.</p>}
    {state.status === 'error' && <p role="alert">Preferences could not be loaded. <button type="button" className={button} onClick={load}>Retry</button></p>}
    {state.prefs && state.status !== 'error' && <PreferencesBody prefs={state.prefs} hidden={state.hidden} busy={busy} onToggle={(c, e, v) => void toggle(c, e, v)} />}
    {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : undefined}>{notice.text}</p>}
  </section>;
}
