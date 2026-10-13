import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../../types';
import type { StaffMemberRecord } from '../../types/staffAccess';
import { SESSION_REVOCATION_REASONS, type DurableSessionRecord, type SessionRevocationReason } from '../../types/staffSessions';
import { api, getStoredToken } from '../../services/api';
import { canManageStaff, staffSessionKey } from '../../hooks/useStaffAccessDirectory';

const inputClass = 'w-full rounded-lg border border-slate-500 bg-[#071A2E] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-300';
const buttonClass = 'rounded-lg border border-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 disabled:cursor-not-allowed';
const REASON_LABELS: Record<SessionRevocationReason, string> = {
  security_incident: 'Security incident', lost_or_stolen_device: 'Lost or stolen device', offboarding: 'Offboarding',
  role_change: 'Role change', administrative_review: 'Administrative review',
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const time = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Rejects anything but a well-formed durable list with exactly one current session. */
export function parseSessionList(value: unknown): DurableSessionRecord[] {
  const page = value as { items?: unknown; source?: unknown };
  if (!page || page.source !== 'durable' || !Array.isArray(page.items) || page.items.length > 50) throw new Error('Invalid session list');
  const items = page.items.map((raw): DurableSessionRecord => {
    const row = raw as Record<string, unknown>;
    if (!row || typeof row.sessionId !== 'string' || !uuid.test(row.sessionId) || !time(row.createdAt) || !time(row.authenticatedAt) || !time(row.expiresAt) ||
      !['aal1', 'aal2'].includes(row.assuranceLevel as string) || typeof row.current !== 'boolean') throw new Error('Invalid session row');
    return { sessionId: row.sessionId, createdAt: row.createdAt as string, authenticatedAt: row.authenticatedAt as string, expiresAt: row.expiresAt as string,
      assuranceLevel: row.assuranceLevel as DurableSessionRecord['assuranceLevel'], current: row.current };
  });
  if (items.filter(item => item.current).length !== 1) throw new Error('Invalid session list');
  return items;
}
export function sessionActionMessage(code: unknown): string {
  if (code === 'STAFF_REAUTHENTICATION_REQUIRED') return 'This action requires a recent sign-in. Sign out, sign in again with your authenticator, and retry within 15 minutes.';
  if (code === 'SESSION_TARGET_PROTECTED') return 'Only a super administrator can revoke this account\'s sessions.';
  if (code === 'SESSION_TARGET_NOT_FOUND') return 'That staff member was not found in your tenant.';
  if (code === 'SESSION_STORE_BUSY') return 'Another access change for this account is in progress. Retry in a moment.';
  return 'The server did not confirm this session action. Refresh before retrying.';
}
const formatted = (value: string) => new Date(value).toLocaleString();

export function StaffSessionsPanel({ user, authStatus, members = [], refresh = 0 }: { user: User | null; authStatus: string; members?: StaffMemberRecord[]; refresh?: number }) {
  const token = getStoredToken();
  const key = staffSessionKey(user, authStatus, token);
  const latest = useRef(key); latest.current = key;
  const signedIn = authStatus === 'AUTHENTICATED' && user?.status === 'active' && Boolean(token);
  const admin = canManageStaff(user, authStatus, token);
  const [state, setState] = useState<{ key: string; status: 'loading' | 'ready' | 'error'; items: DurableSessionRecord[] }>({ key, status: 'loading', items: [] });
  const [notice, setNotice] = useState<{ key: string; error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState({ key, uid: '', reason: '' as SessionRevocationReason | '' });
  const [confirming, setConfirming] = useState<string | null>(null);
  const controllers = useRef(new Set<AbortController>());
  const current = useCallback((k: string, t: string | null) => latest.current === k && getStoredToken() === t, []);

  const load = useCallback(() => {
    if (!signedIn) return;
    const k = key, t = token, controller = new AbortController(); controllers.current.add(controller);
    setState({ key: k, status: 'loading', items: [] });
    api.staffAccess.sessions(controller.signal).then(
      value => { if (current(k, t)) setState({ key: k, status: 'ready', items: parseSessionList(value) }); },
      () => { if (current(k, t)) setState({ key: k, status: 'error', items: [] }); },
    ).catch(() => { if (current(k, t)) setState({ key: k, status: 'error', items: [] }); })
      .finally(() => controllers.current.delete(controller));
  }, [key, token, signedIn, current]);
  useEffect(() => {
    setNotice(null); setBusy(null); setConfirming(null); setTarget({ key, uid: '', reason: '' }); load();
    const owned = controllers.current;
    return () => { owned.forEach(c => c.abort()); owned.clear(); };
  }, [key, refresh, load]);

  const run = async (id: string, operation: (signal: AbortSignal) => Promise<unknown>, success: (value: any) => string) => {
    if (busy || !signedIn) return;
    const k = key, t = token, controller = new AbortController(); controllers.current.add(controller);
    setBusy(id); setNotice(null);
    try {
      const value = await operation(controller.signal);
      if (!current(k, t)) return;
      setNotice({ key: k, error: false, text: success(value) }); setConfirming(null); load();
    } catch (error) {
      if (current(k, t)) setNotice({ key: k, error: true, text: sessionActionMessage((error as { code?: string })?.code) });
    } finally { controllers.current.delete(controller); if (current(k, t)) setBusy(null); }
  };
  const count = (value: any) => { if (!Number.isSafeInteger(value?.revokedSessions) || value.revokedSessions < 0) throw new Error('Unconfirmed'); return value.revokedSessions as number; };

  if (!signedIn) return null;
  const sessions = state.key === key ? state : { status: 'loading' as const, items: [] };
  const form = target.key === key ? target : { uid: '', reason: '' as const };
  const eligible = members.filter(m => m.uid !== user?.id && !['super_admin', 'super_administrator'].includes(m.role));
  return <section aria-labelledby="staff-sessions-heading" className="space-y-4 rounded-xl border border-slate-600 bg-[#071A2E] p-4 text-sm text-slate-200">
    <header><h3 id="staff-sessions-heading" className="font-bold text-amber-200">Signed-in sessions</h3>
      <p className="mt-1 text-slate-400">Durable TaxGuard sessions for your account. Device and location details are not recorded.</p></header>
    {notice?.key === key && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : 'text-emerald-300'}>{notice.text}</p>}
    {sessions.status === 'loading' && <p role="status">Loading sessions…</p>}
    {sessions.status === 'error' && <p role="alert">Your sessions could not be loaded. <button type="button" className="underline" onClick={load}>Retry</button></p>}
    {sessions.status === 'ready' && <>
      <ul className="space-y-2">{sessions.items.map(s => <li key={s.sessionId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700 p-3">
        <span>{s.current ? <strong className="text-white">This session</strong> : 'Other session'} · signed in {formatted(s.authenticatedAt)} · expires {formatted(s.expiresAt)} · {s.assuranceLevel === 'aal2' ? 'MFA verified' : 'Password only'}</span>
        {!s.current && <button type="button" className={buttonClass} disabled={busy !== null} aria-label={'Revoke session signed in ' + formatted(s.authenticatedAt)}
          onClick={() => run(s.sessionId, signal => api.staffAccess.revokeSession(s.sessionId, signal), v => { if (typeof v?.revoked !== 'boolean') throw new Error('Unconfirmed'); return v.revoked ? 'Session revoked.' : 'That session had already ended.'; })}>Revoke</button>}
      </li>)}</ul>
      <button type="button" className={buttonClass} disabled={busy !== null || sessions.items.length < 2}
        onClick={() => run('others', signal => api.staffAccess.revokeOtherSessions(signal), v => `Signed out ${count(v)} other session(s).`)}>Sign out all other sessions</button>
    </>}
    {admin && <form aria-labelledby="member-sessions-heading" className="space-y-3 border-t border-slate-700 pt-4" onSubmit={e => {
      e.preventDefault();
      if (!form.uid || !form.reason) return;
      if (confirming !== form.uid) { setConfirming(form.uid); return; }
      const uid = form.uid, reason = form.reason;
      void run('member', signal => api.staffAccess.revokeMemberSessions(uid, reason, signal), v => `Revoked ${count(v)} session(s). The staff member must sign in again with MFA.`);
    }}>
      <h4 id="member-sessions-heading" className="font-bold text-white">Revoke a staff member's sessions</h4>
      <p className="text-slate-400">Ends every active session immediately and is recorded in the audit log. Requires a sign-in within the last 15 minutes.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Staff member<select className={inputClass} value={form.uid} onChange={e => { setConfirming(null); setTarget({ key, uid: e.target.value, reason: form.reason }); }}>
          <option value="">Select a staff member</option>{eligible.map(m => <option key={m.uid} value={m.uid}>{m.name} ({m.email})</option>)}</select></label>
        <label>Reason<select className={inputClass} value={form.reason} onChange={e => { setConfirming(null); setTarget({ key, uid: form.uid, reason: e.target.value as SessionRevocationReason }); }}>
          <option value="">Select a reason</option>{SESSION_REVOCATION_REASONS.map(r => <option key={r} value={r}>{REASON_LABELS[r]}</option>)}</select></label>
      </div>
      {eligible.length === 0 && <p className="text-slate-400">No other staff members are listed on the current directory page.</p>}
      <button className={buttonClass + ' text-amber-200'} disabled={busy !== null || !form.uid || !form.reason}>{confirming === form.uid && form.uid ? 'Confirm: revoke all sessions' : 'Revoke sessions'}</button>
    </form>}
  </section>;
}
