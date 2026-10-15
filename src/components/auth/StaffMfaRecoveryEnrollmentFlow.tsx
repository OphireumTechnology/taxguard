import React, { useEffect, useId, useRef, useState } from 'react';
import { createStaffInvitationApi, StaffInvitationFlowError, type StaffInvitationApi } from '../../services/staffInvitationApi';
import { beginProviderOnlyIdentityFlow } from '../../context/providerOnlyIdentityFlow';
import { createStaffInvitationLifecycle } from '../../services/staffInvitationLifecycle';
import { useProviderIdentityBoundary } from '../../services/providerIdentityBoundary';
import { TotpEnrollmentPanel } from './TotpEnrollmentPanel';

/**
 * Staff MFA recovery re-enrolment. The member is suspended, so no TaxGuard session exists or is
 * requested: provider sign-in, new authenticator, AAL2, then a provider-token proof to the server.
 * Reactivation is a separate, independent administrator action.
 */
export function StaffMfaRecoveryEnrollmentFlow({ onCancel, api: injectedApi }: { onCancel: () => void; api?: StaffInvitationApi }) {
  const apiRef = useRef<StaffInvitationApi | null>(null);
  if (!apiRef.current) apiRef.current = injectedApi || createStaffInvitationApi();
  const api = apiRef.current;
  const lifecycleRef = useRef<ReturnType<typeof createStaffInvitationLifecycle> | null>(null);
  if (!lifecycleRef.current) lifecycleRef.current = createStaffInvitationLifecycle(beginProviderOnlyIdentityFlow, () => api.signOut());
  const leaseRef = useRef<ReturnType<ReturnType<typeof createStaffInvitationLifecycle>['mount']> | null>(null);
  useEffect(() => {
    const lease = lifecycleRef.current!.mount(); leaseRef.current = lease;
    return () => { void lease.close(); };
  }, []);
  const identity = useProviderIdentityBoundary();
  function useBoundState<T>(initial: T): [T, (value: T) => void] {
    const [state, setState] = useState({key: identity.key, value: initial});
    useEffect(() => {setState(previous => previous.key === identity.key ? previous : {key: identity.key, value: initial});}, [identity.key]);
    return [state.key === identity.key ? state.value : initial, value => setState({key: identity.capture(), value})];
  }
  const id = useId();
  const [email, setEmail] = useBoundState('');
  const [password, setPassword] = useBoundState('');
  const [code, setCode] = useBoundState('');
  const [mfa, setMfa] = useBoundState<{ kind: 'ready' | 'enroll' | 'challenge'; factorId?: string } | null>(null);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useBoundState('');
  const [error, setError] = useBoundState('');
  const [busy, setBusy] = useBoundState(false);
  const submitting = useRef(false);
  async function perform(action: (isActive: () => boolean) => Promise<void>, allowIdentityTransition = false) {
    const lease = leaseRef.current;
    if (!lease?.isActive() || submitting.current || !identity.isCurrent(identity.key)) return;
    const proof = identity.capture();
    const isActive = () => lease.isActive() && (allowIdentityTransition || identity.isCurrent(proof));
    submitting.current = true; setBusy(true); setError('');
    const operation = (async () => {
      try { await action(isActive); }
      catch (cause) {
        if (!isActive()) return;
        if (!(cause instanceof StaffInvitationFlowError) || cause.code === 'denied') setError('Authenticator recovery could not be completed. Contact your administrator.');
        else setError(cause.code === 'unavailable' ? 'Authenticator recovery is unavailable in this environment. Contact your administrator.' : cause.message);
      }
      finally { submitting.current = false; if (isActive()) setBusy(false); }
    })();
    await lease.track(operation);
  }
  async function submit(isActive: () => boolean) {
    if (!isActive()) return;
    const assurance = await api.mfaState();
    if (!isActive()) return;
    if (assurance.kind !== 'ready') { setMfa(assurance); return; }
    await api.submitRecoveryEnrollment();
    if (!isActive()) return;
    setDone(true); setPassword(''); setCode(''); setMfa(null); setNotice('');
    await api.signOut();
  }
  return <section aria-label="Staff authenticator recovery" className="space-y-4 rounded-lg border border-slate-700 bg-[#071A2E] p-4 text-sm text-slate-200">
    <h2 className="font-bold text-[#D4A843]">Set up a replacement authenticator</h2>
    <p>Use this only after your administrator tells you that your authenticator was reset. Your access stays suspended until an independent administrator confirms the recovery.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {done ? <p role="status">Your new authenticator is recorded. An independent administrator must now complete your recovery. After they confirm it, sign in again with your new authenticator.</p> : !mfa ? <form onSubmit={event => { event.preventDefault(); void perform(async isActive => {
      const result = await api.authenticate('signin', email, password);
      if (!isActive()) return;
      const proof = identity.capture();
      const current = () => isActive() && identity.isCurrent(proof);
      if (result.emailVerificationRequired) {
        await api.signOut(); if (!isActive()) return;
        setPassword(''); setNotice('Email verification is required before continuing. Check your email, then return here.');
        return;
      }
      if (identity.current().email !== email.trim().toLowerCase()) return;
      setPassword('');
      const state = await api.mfaState();
      if (!current()) return;
      setMfa(state); setNotice('');
    }, true); }} className="space-y-3">
      <fieldset disabled={busy} className="space-y-3">
        <label htmlFor={id + '-email'} className="block">Work email</label>
        <input id={id + '-email'} type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded border border-slate-600 bg-[#071A2E] p-2" />
        <label htmlFor={id + '-password'} className="block">Password</label>
        <input id={id + '-password'} type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="w-full rounded border border-slate-600 bg-[#071A2E] p-2" />
        <button type="submit" className="rounded bg-[#D4A843] px-4 py-2 font-semibold text-[#071A2E]">Sign in to continue recovery</button>
      </fieldset>
    </form> : <>
      {mfa.kind === 'enroll' && <TotpEnrollmentPanel trackOperation={operation => { leaseRef.current?.track(operation); }} onComplete={() => void perform(submit)} onCancel={() => void perform(async isActive => { await api.signOut(); if (!isActive()) return; setMfa(null); setPassword(''); }, true)} />}
      {mfa.kind === 'challenge' && <form onSubmit={event => { event.preventDefault(); void perform(async isActive => { await api.challenge(mfa.factorId || '', code); if (!isActive()) return; setCode(''); await submit(isActive); }); }}>
        <label htmlFor={id + '-code'}>Code from your new authenticator</label>
        <input id={id + '-code'} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} className="w-full rounded border border-slate-600 bg-[#071A2E] p-2" />
        <button type="submit" disabled={busy}>Verify and record new authenticator</button>
      </form>}
      {mfa.kind === 'ready' && <button type="button" disabled={busy} onClick={() => void perform(submit)}>Record new authenticator</button>}
    </>}
    <button type="button" disabled={busy} onClick={() => void perform(async isActive => { await api.signOut(); if (!isActive()) return; setPassword(''); setCode(''); onCancel(); }, true)}>Return to staff sign-in</button>
  </section>;
}
