import React, { useEffect, useId, useRef, useState } from 'react';
import { createStaffInvitationApi, StaffInvitationFlowError, type StaffInvitationApi, type StaffInvitationDetails } from '../../services/staffInvitationApi';
import { beginProviderOnlyIdentityFlow } from '../../context/providerOnlyIdentityFlow';
import { createStaffInvitationLifecycle } from '../../services/staffInvitationLifecycle';
import { useProviderIdentityBoundary } from '../../services/providerIdentityBoundary';
import { TotpEnrollmentPanel } from './TotpEnrollmentPanel';

/** Invitation secrets exist only in component memory; no URLs, storage, logs, or role selection. */
export function StaffInvitationFlow({ onCancel, api: injectedApi }: { onCancel: () => void; api?: StaffInvitationApi }) {
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
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [token, setToken] = useBoundState('');
  const [email, setEmail] = useBoundState('');
  const [password, setPassword] = useBoundState('');
  const [code, setCode] = useBoundState('');
  const [details, setDetails] = useBoundState<StaffInvitationDetails | null>(null);
  const [mfa, setMfa] = useBoundState<{ kind: 'ready' | 'enroll' | 'challenge'; factorId?: string } | null>(null);
  const [pending, setPending] = useState(false);
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
      catch (cause) { if (isActive()) setError(cause instanceof StaffInvitationFlowError ? cause.message : 'Staff onboarding could not be completed. Contact your administrator.'); }
      finally { submitting.current = false; if (isActive()) setBusy(false); }
    })();
    await lease.track(operation);
  }
  async function accept(isActive: () => boolean) {
    if (!isActive()) return;
    const assurance = await api.mfaState();
    if (!isActive()) return;
    if (assurance.kind !== 'ready') { setMfa(assurance); return; }
    await api.accept(token);
    if (!isActive()) return;
    setPending(true); setToken(''); setPassword(''); setCode(''); setDetails(null); setMfa(null); setNotice('');
    await api.signOut();
  }
  return <section aria-label="Staff invitation onboarding" className="space-y-4 rounded-lg border border-slate-700 bg-[#071A2E] p-4 text-sm text-slate-200">
    <h2 className="font-bold text-[#D4A843]">Accept staff invitation</h2>
    <p>Use the invitation code provided privately by your administrator. Staff access requires email verification, an authenticator, and independent administrator approval.</p>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {pending ? <p role="status">Invitation accepted. Your account is pending independent administrator approval. Sign in after your administrator confirms activation.</p> : !details ? <form onSubmit={event => { event.preventDefault(); void perform(async isActive => {
      const result = await api.authenticate(mode, email, password);
      if (!isActive()) return;
      const proof = identity.capture();
      const current = () => isActive() && identity.isCurrent(proof);
      const providerEmail = identity.current().email;
      if (providerEmail && providerEmail !== email.trim().toLowerCase()) return;
      if (result.emailVerificationRequired) {
        setMode('signin'); await api.signOut(); if (!isActive()) return;
        setPassword('');
        setNotice('Email verification is required before continuing. Check your email, then return here and sign in with the same invitation code.');
        return;
      }
      if (providerEmail !== email.trim().toLowerCase()) return;
      setToken(token); setEmail(email); setPassword('');
      try {
        const authorized = await api.lookup(token);
        if (!current()) return;
        const state = await api.mfaState();
        if (!current()) return;
        setDetails(authorized); setMfa(state); setNotice('');
      } catch (cause) {if (current()) throw cause;}
    }, true); }} className="space-y-3">
      <fieldset disabled={busy} className="space-y-3">
        <label htmlFor={id + '-mode'} className="block">Provider account</label>
        <select id={id + '-mode'} value={mode} onChange={event => setMode(event.target.value as 'signin' | 'signup')} className="w-full rounded border border-slate-600 bg-[#071A2E] p-2">
          <option value="signin">Sign in to an existing account</option><option value="signup">Set up a new account</option>
        </select>
        <label htmlFor={id + '-token'} className="block">Invitation code</label>
        <input id={id + '-token'} type="password" required pattern="[a-f0-9]{64}" minLength={64} maxLength={64} autoComplete="off" spellCheck={false} value={token} onChange={event => setToken(event.target.value.trim())} className="w-full rounded border border-slate-600 bg-[#071A2E] p-2" />
        <label htmlFor={id + '-email'} className="block">Invited work email</label>
        <input id={id + '-email'} type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="w-full rounded border border-slate-600 bg-[#071A2E] p-2" />
        <label htmlFor={id + '-password'} className="block">Password</label>
        <input id={id + '-password'} type="password" required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} aria-describedby={mode === 'signup' ? id + '-policy' : undefined} className="w-full rounded border border-slate-600 bg-[#071A2E] p-2" />
        {mode === 'signup' && <p id={id + '-policy'}>Use at least 8 characters including uppercase, lowercase, a number, and a special character.</p>}
        <button type="submit" className="rounded bg-[#D4A843] px-4 py-2 font-semibold text-[#071A2E]">Verify invitation</button>
      </fieldset>
    </form> : <>
      <dl><dt>Invited name</dt><dd>{details.legalFirstName} {details.legalLastName}</dd><dt>Assigned role</dt><dd>{details.role}</dd></dl>
      {mfa?.kind === 'enroll' && <TotpEnrollmentPanel trackOperation={operation => { leaseRef.current?.track(operation); }} onComplete={() => void perform(accept)} onCancel={() => void perform(async isActive => { await api.signOut(); if (!isActive()) return; setDetails(null); setMfa(null); setPassword(''); }, true)} />}
      {mfa?.kind === 'challenge' && <form onSubmit={event => { event.preventDefault(); void perform(async isActive => { await api.challenge(mfa.factorId || '', code); if (!isActive()) return; setCode(''); await accept(isActive); }); }}>
        <label htmlFor={id + '-code'}>Authenticator code</label>
        <input id={id + '-code'} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} className="w-full rounded border border-slate-600 bg-[#071A2E] p-2" />
        <button type="submit" disabled={busy}>Verify and accept invitation</button>
      </form>}
      {mfa?.kind === 'ready' && <button type="button" disabled={busy} onClick={() => void perform(accept)}>Accept invitation</button>}
    </>}
    <button type="button" disabled={busy} onClick={() => void perform(async isActive => { await api.signOut(); if (!isActive()) return; setToken(''); setPassword(''); setCode(''); onCancel(); }, true)}>Return to staff sign-in</button>
  </section>;
}
