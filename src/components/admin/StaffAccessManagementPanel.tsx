import { StaffMfaRecoveryPanel } from './StaffMfaRecoveryPanel';
import { StaffSessionsPanel } from './StaffSessionsPanel';
import React, { useEffect, useRef, useState } from 'react';
import { api, getStoredToken } from '../../services/api';
import type { User } from '../../types';
import type { StaffInvitationIssueInput, StaffInvitationIssueResult, StaffInvitationRecord, StaffMemberRecord, StaffMembershipAction } from '../../types/staffAccess';
import { staffSessionKey, useStaffAccessDirectory } from '../../hooks/useStaffAccessDirectory';

export const STAFF_INVITATION_ROLES = ['accountant', 'reviewer', 'senior_reviewer', 'bookkeeper', 'practice_manager', 'operations', 'admin'] as const;
export function normalizeStaffInvitation(input: StaffInvitationIssueInput): StaffInvitationIssueInput {
  const email = input.email.trim().toLowerCase();
  const legalFirstName = input.legalFirstName.trim().replace(/\s+/g, ' ');
  const legalLastName = input.legalLastName.trim().replace(/\s+/g, ' ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !legalFirstName || !legalLastName || legalFirstName.length > 100 || legalLastName.length > 100 || !STAFF_INVITATION_ROLES.includes(input.role)) throw new Error('Enter a valid email, legal name, and allowed staff role.');
  return {email, legalFirstName, legalLastName, role: input.role};
}
export function staffActionAvailable(row: StaffMemberRecord | StaffInvitationRecord, action: string): boolean {
  return (row.actions as unknown as Record<string, unknown>)[action] === true;
}
export function validateIssuedInvitation(result: StaffInvitationIssueResult) {
  if (!result || typeof result.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(result.id) || typeof result.token !== 'string' || !/^[a-f0-9]{64}$/.test(result.token) || result.delivery !== 'administrator_handoff' || typeof result.expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(result.expiresAt) || !Number.isFinite(Date.parse(result.expiresAt)) || Date.parse(result.expiresAt) <= Date.now()) throw new Error('Invalid invitation confirmation');
  return {id: result.id, token: result.token, expiresAt: result.expiresAt, delivery: result.delivery};
}
const inputClass = 'w-full rounded-lg border border-slate-500 bg-[#071A2E] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-300';
const buttonClass = 'rounded-lg border border-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 disabled:cursor-not-allowed';
type Action = {row: StaffMemberRecord | StaffInvitationRecord; action: 'approve' | 'revoke' | StaffMembershipAction};

export function StaffAccessManagementPanel({user, authStatus, refresh = 0}: {user: User | null; authStatus: string; refresh?: number}) {
  const directory = useStaffAccessDirectory(user, authStatus, refresh);
  const key = directory.sessionKey;
  const latest = useRef(key); latest.current = key;
  const controllers = useRef(new Set<AbortController>());
  const busy = useRef(new Set<string>());
  const emptyForm: StaffInvitationIssueInput = {email: '', legalFirstName: '', legalLastName: '', role: 'accountant'};
  const [formState, setFormState] = useState<{key: string; value: StaffInvitationIssueInput}>({key, value: emptyForm});
  const form = formState.key === key ? formState.value : emptyForm;
  const setForm = (value: StaffInvitationIssueInput) => setFormState({key, value});
  const [issued, setIssued] = useState<{key: string; value: StaffInvitationIssueResult} | null>(null);
  const [actionState, setActionState] = useState<{key: string; value: Action} | null>(null);
  const action = actionState?.key === key ? actionState.value : null;
  const setAction = (value: Action | null) => setActionState(value ? {key, value} : null);
  const [reasonState, setReasonState] = useState({key, value: ''});
  const reason = reasonState.key === key ? reasonState.value : '';
  const setReason = (value: string) => setReasonState({key, value});
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {if (action) confirmationHeading.current?.focus();}, [key, actionState]);
  const cancel = () => {setAction(null); setReason(''); if (trigger.current?.isConnected) trigger.current.focus();};
  const [pending, setPending] = useState<{key: string; ids: string[]}>({key: '', ids: []});
  const [notice, setNotice] = useState<{key: string; error: boolean; text: string} | null>(null);
  useEffect(() => {
    setIssued(null); setAction(null); setReason(''); setNotice(null); setPending({key, ids: []}); busy.current.clear();
    setForm({email: '', legalFirstName: '', legalLastName: '', role: 'accountant'});
    return () => { controllers.current.forEach(controller => controller.abort()); controllers.current.clear(); };
  }, [key]);
  const run = async (id: string, operation: (signal: AbortSignal) => Promise<unknown>, onSuccess: (value: any) => void) => {
    if (!directory.allowed || latest.current !== key || staffSessionKey(user, authStatus, getStoredToken()) !== key || busy.current.has(id)) return;
    const token = getStoredToken();
    const controller = new AbortController(); controllers.current.add(controller); busy.current.add(id);
    setPending({key, ids: [...busy.current]}); setNotice(null);
    const current = () => !controller.signal.aborted && latest.current === key && getStoredToken() === token;
    try { const result = await operation(controller.signal); if (!current()) return; onSuccess(result); directory.refresh(); }
    catch { if (current()) setNotice({key, error: true, text: 'The staff service did not confirm this action. Refresh the directory before retrying.'}); }
    finally { controllers.current.delete(controller); if (current()) {busy.current.delete(id); setPending({key, ids: [...busy.current]});} }
  };
  const isBusy = (id: string) => pending.key === key && pending.ids.includes(id);
  const invite = (event: React.FormEvent) => {
    event.preventDefault();
    try { const payload = normalizeStaffInvitation(form); setIssued(null); void run('invite', signal => api.staffAccess.createInvitation(payload, signal), value => {
      setIssued({key, value: validateIssuedInvitation(value)}); setForm({email: '', legalFirstName: '', legalLastName: '', role: 'accountant'});
      setNotice({key, error: false, text: 'Invitation created. Staff access still requires the server activation and approval process.'});
    }); } catch (error) { setNotice({key, error: true, text: (error as Error).message}); }
  };
  const confirm = () => {
    if (!action || actionState?.key !== key || reasonState.key !== key || !staffActionAvailable(action.row, action.action)) return;
    const selected = action;
    const lifecycle = ['suspend', 'deactivate', 'reactivate'].includes(selected.action);
    if (lifecycle && (!reason.trim() || reason.trim().length > 500)) return;
    const id = 'uid' in selected.row ? selected.row.uid : selected.row.id;
    void run(id, signal => selected.action === 'revoke' ? api.staffAccess.revokeInvitation(id, signal) : selected.action === 'approve' ? api.staffAccess.approveMember(id, signal) : api.staffAccess.changeMemberStatus(id, selected.action as StaffMembershipAction, reason.trim(), signal), value => {
      const expected = {revoke: 'revoked', approve: 'active', suspend: 'suspended', deactivate: 'disabled', reactivate: 'active'}[selected.action];
      if (value?.status !== expected) throw new Error('Unconfirmed action');
      setAction(null); setReason(''); setNotice({key, error: false, text: 'The server confirmed the staff access change. The directory is refreshing.'});
    });
  };
  if (!directory.allowed) return <section className="text-slate-300"><h2 className="text-lg font-bold text-white">Staff access</h2><p role="status">An active administrator session is required to manage staff access.</p></section>;
  const secret = issued?.key === key ? issued.value : null;
  return <section aria-labelledby="staff-access-heading" className="space-y-6 text-sm text-slate-200">
    <header><h2 id="staff-access-heading" className="text-xl font-bold text-white">Staff access</h2><p className="mt-1 text-slate-400">Manage invitations and authoritative staff membership for your tenant.</p></header>
    <form onSubmit={invite} className="space-y-4 rounded-xl border border-slate-600 bg-[#071A2E] p-4">
      <h3 className="font-bold text-amber-200">Invite a staff member</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>Email<input type="email" autoComplete="off" required maxLength={254} value={form.email} onChange={e => setForm({...form, email: e.target.value})} className={inputClass} /></label>
        <label>Staff role<select value={form.role} onChange={e => setForm({...form, role: e.target.value as StaffInvitationIssueInput['role']})} className={inputClass}>{STAFF_INVITATION_ROLES.map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</select></label>
        <label>Legal first name<input required maxLength={100} value={form.legalFirstName} onChange={e => setForm({...form, legalFirstName: e.target.value})} className={inputClass} /></label>
        <label>Legal last name<input required maxLength={100} value={form.legalLastName} onChange={e => setForm({...form, legalLastName: e.target.value})} className={inputClass} /></label>
      </div>
      <p className="text-slate-400">The one-time token is shown here for administrator handoff. No message is sent automatically.</p>
      <button disabled={isBusy('invite') || Boolean(secret)} className={buttonClass + ' bg-amber-300 font-bold text-[#071A2E]'}>{isBusy('invite') ? 'Creating invitation…' : 'Create invitation'}</button>
    </form>
    {secret && <div role="region" aria-label="One-time invitation token" className="space-y-3 rounded-xl border border-amber-300 p-4">
      <h3 className="font-bold text-amber-200">One-time invitation token</h3><p>Hand this token to the intended recipient through your approved secure channel. It cannot be shown again after dismissal.</p>
      <label className="block">Invitation token<textarea readOnly autoComplete="off" value={secret.token} className={inputClass + ' break-all font-mono'} /></label>
      <p>Expires: {secret.expiresAt}</p><button type="button" className={buttonClass} onClick={() => setIssued(null)}>Dismiss and clear token</button>
    </div>}
    {notice?.key === key && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : 'text-emerald-300'}>{notice.text}</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label>Directory<select className={inputClass} value={directory.kind} onChange={e => {directory.setKind(e.target.value as 'members' | 'invitations'); setAction(null);}}><option value="members">Staff members</option><option value="invitations">Invitations</option></select></label>
      <label>Status<select className={inputClass} value={directory.query.status ?? ''} onChange={e => {directory.setStatus(e.target.value); setAction(null);}}><option value="">All statuses</option>{(directory.kind === 'members' ? ['pending_approval', 'active', 'suspended', 'disabled', 'deactivated'] : ['pending', 'accepted', 'revoked']).map(status => <option key={status}>{status}</option>)}</select></label>
      <label>Rows per page<select className={inputClass} value={directory.query.limit ?? 25} onChange={e => directory.setLimit(Number(e.target.value))}><option value={25}>25</option><option value={50}>50</option></select></label>
      <button type="button" onClick={directory.refresh} className={buttonClass}>Refresh directory</button>
    </div>
    {directory.status === 'loading' && <p role="status">Loading staff directory…</p>}
    {directory.status === 'empty' && <p role="status">No {directory.kind === 'members' ? 'staff members' : 'invitations'} match this filter.</p>}
    {directory.status === 'unavailable' && <p role="alert">The staff directory is unavailable for this session. Retry or sign in again.</p>}
    {directory.status === 'error' && <p role="alert">The staff directory could not be loaded. Use Refresh directory to retry.</p>}
    {directory.status === 'ready' && <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Authoritative {directory.kind} directory</caption><thead className="text-slate-400"><tr>{['Name / email', 'Role', 'Status', 'Membership details', 'Actions'].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{directory.items.map(row => {
      const member = 'uid' in row; const id = member ? row.uid : row.id;
      const options = member ? ['approve', 'suspend', 'deactivate', 'reactivate'] : ['revoke'];
      return <tr key={id} className="border-t border-slate-700"><td className="p-3"><span className="block font-semibold text-white">{member ? row.name : row.legalFirstName + ' ' + row.legalLastName}</span>{row.email}</td><td className="p-3">{row.role.replaceAll('_', ' ')}</td><td className="p-3">{row.status}</td><td className="p-3 text-xs">Created: {row.createdAt}{member ? <><br />Approved by: {row.approvedBy ?? 'Not approved'}{row.approvedAt && <><br />Approved: {row.approvedAt}</>}{row.statusChangedAt && <><br />Status changed: {row.statusChangedAt}</>}{row.mfaReenrollmentRequired && <><br />MFA reenrollment required</>}</> : <><br />Expires: {row.expiresAt}<br />Invited by: {row.invitedBy}</>}</td><td className="p-3"><div className="flex flex-wrap gap-2">{options.filter(option => staffActionAvailable(row, option)).map(option => <button type="button" className={buttonClass} disabled={isBusy(id)} key={option} onClick={e => {trigger.current = e.currentTarget; setAction({row, action: option as Action['action']}); setReason('');}} aria-label={option + ' ' + row.email}>{option}</button>)}</div></td></tr>;
    })}</tbody></table></div>}
    {action && <form role="region" aria-labelledby="staff-action-title" className="space-y-3 rounded-xl border border-amber-300 p-4" onSubmit={e => {e.preventDefault(); confirm();}}>
      <h3 ref={confirmationHeading} tabIndex={-1} id="staff-action-title" className="font-bold text-amber-200">Confirm {action.action} for {action.row.email}</h3><p>The server verifies authorization and current membership before changing access.</p>
      {['suspend', 'deactivate', 'reactivate'].includes(action.action) && <label className="block">Reason (required, recorded)<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} className={inputClass} /></label>}
      <div className="flex gap-3"><button disabled={isBusy('uid' in action.row ? action.row.uid : action.row.id) || (['suspend', 'deactivate', 'reactivate'].includes(action.action) && !reason.trim())} className={buttonClass + ' text-amber-200'}>Confirm {action.action}</button><button type="button" className={buttonClass} onClick={cancel}>Cancel</button></div>
    </form>}
    <StaffMfaRecoveryPanel user={user} authStatus={authStatus} refresh={refresh} members={directory.items.filter((row): row is StaffMemberRecord => 'uid' in row)} />
    <StaffSessionsPanel user={user} authStatus={authStatus} refresh={refresh} members={directory.items.filter((row): row is StaffMemberRecord => 'uid' in row)} />
    <nav aria-label="Directory pagination" className="flex gap-3"><button type="button" className={buttonClass} disabled={!directory.query.cursor || directory.status === 'loading'} onClick={directory.firstPage}>First page</button><button type="button" className={buttonClass} disabled={!directory.nextCursor || directory.status === 'loading'} onClick={directory.nextPage}>Next page</button></nav>
  </section>;
}
