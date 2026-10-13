import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api, getStoredToken } from '../../services/api';
import { StaffSessionsPanel } from '../admin/StaffSessionsPanel';

type SecurityEvent = { action: string; actorUid: string; actorRole: string | null; at: string; byAdministrator: boolean; details: Record<string, unknown> };
const LABELS: Record<string, string> = {
  SESSION_CREATED: 'Signed in', SESSION_REVOKED: 'Signed out', SESSION_REVOKED_BY_OWNER: 'You revoked a session', SESSIONS_OTHER_REVOKED_BY_OWNER: 'You signed out other sessions',
  STAFF_SESSIONS_REVOKED_BY_ADMIN: 'An administrator revoked sessions',
};
export function securityEventLabel(event: Pick<SecurityEvent, 'action' | 'byAdministrator'>): string {
  const base = LABELS[event.action] ?? event.action.toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  return event.byAdministrator && !LABELS[event.action] ? base + ' (by an administrator)' : base;
}
export function accountStatusMessage(code: unknown): string | null {
  if (code === 'STAFF_MFA_REENROLLMENT_REQUIRED') return 'Your authenticator must be re-enrolled before you can continue. Contact your administrator to complete MFA recovery.';
  if (code === 'STAFF_FRESH_SIGN_IN_REQUIRED') return 'Your account status changed. Sign in again with your authenticator.';
  if (code === 'SESSION_AUTHORITY_DENIED') return 'This account is not active. If you believe it was suspended in error, contact your administrator.';
  if (code === 'STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE') return 'Account security tools are not enabled in this environment.';
  return null;
}

/** Staff-wide account security: own sessions and own security history. Server authority decides everything shown. */
export function StaffAccountSecurityPage() {
  const { currentUser, authLifecycleState } = useApp();
  const token = getStoredToken();
  const key = JSON.stringify([currentUser?.id, currentUser?.tenantId, currentUser?.role, authLifecycleState, token]);
  const latest = useRef(key); latest.current = key;
  const [events, setEvents] = useState<{ status: 'loading' | 'ready' | 'error'; items: SecurityEvent[]; message?: string }>({ status: 'loading', items: [] });
  const load = useCallback(() => {
    const k = key;
    setEvents({ status: 'loading', items: [] });
    api.staffAccess.securityEvents().then(r => { if (latest.current === k) setEvents({ status: 'ready', items: Array.isArray(r?.items) ? r.items : [] }); })
      .catch((e: { code?: string }) => { if (latest.current === k) setEvents({ status: 'error', items: [], message: accountStatusMessage(e?.code) ?? 'Your security history could not be loaded. Try again.' }); });
  }, [key]);
  useEffect(() => { if (currentUser && authLifecycleState === 'AUTHENTICATED') load(); }, [load, currentUser, authLifecycleState]);

  if (!currentUser || authLifecycleState !== 'AUTHENTICATED') return <main className="p-6 text-slate-200"><p role="alert">Sign in to manage your account security.</p></main>;
  if (['client', 'prospective_client'].includes(currentUser.role)) return <main className="p-6 text-slate-200"><p role="alert">This page is for practice staff accounts.</p></main>;
  return <main aria-labelledby="account-security-heading" className="mx-auto max-w-4xl space-y-6 p-4 text-sm text-slate-200 sm:p-6">
    <header><h1 id="account-security-heading" className="text-2xl font-bold text-white">Account security</h1>
      <p className="mt-1 text-slate-400">{currentUser.name} · {currentUser.role.replace(/_/g, ' ')}. Staff accounts require an authenticator (MFA) for every session.</p></header>
    <StaffSessionsPanel user={currentUser} authStatus={authLifecycleState} />
    <section aria-labelledby="security-history-heading" className="space-y-3 rounded-xl border border-slate-600 bg-[#071A2E] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="security-history-heading" className="font-bold text-amber-200">Security history</h2>
        <button type="button" className="rounded-lg border border-slate-500 px-3 py-1 focus:outline-none focus:ring-2 focus:ring-amber-300" onClick={load}>Refresh</button></div>
      {events.status === 'loading' && <p role="status">Loading security history…</p>}
      {events.status === 'error' && <p role="alert">{events.message}</p>}
      {events.status === 'ready' && events.items.length === 0 && <p role="status">No security events are recorded for your account.</p>}
      {events.status === 'ready' && events.items.length > 0 && <ul className="space-y-1">{events.items.map((e, i) => <li key={e.at + i} className="flex flex-wrap justify-between gap-2 border-t border-slate-800 pt-1">
        <span>{securityEventLabel(e)}{e.byAdministrator ? ` · ${e.actorUid}` : ''}</span><time dateTime={e.at} className="text-slate-400">{new Date(e.at).toLocaleString()}</time></li>)}</ul>}
      <p className="text-slate-400">If you see activity you do not recognise, sign out other sessions and contact your administrator.</p>
    </section>
  </main>;
}
