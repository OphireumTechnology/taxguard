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
  return <section aria-label="Staff invitation onboarding" className="space-y-4 rounded-xl border border-white/12 bg-[#061426]/85 p-4 text-xs text-[#CBD6E4]">
    <h2 className="text-sm font-bold text-[#D4AF37]">Accept staff invitation</h2>
    <p className="leading-relaxed text-[#A8B8CC]">Use the invitation code provided privately by your administrator. Staff access requires email verification, an authenticator, and independent administrator approval.</p>
    {error && <p role="alert" className="rounded-lg border border-rose-400/35 bg-rose-950/50 p-2.5 text-rose-100">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-[#00C2D1]/35 bg-[#0B1F36] p-2.5 text-[#E2EAF4]">{notice}</p>}
    {pending ? <p role="status" className="rounded-lg border border-[#D4AF37]/35 bg-[#0B1F36] p-3 text-white">Invitation accepted. Your account is pending independent administrator approval. Sign in after your administrator confirms activation.</p> : !details ? <form onSubmit={event => { event.preventDefault(); void perform(async isActive => {
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
        <label htmlFor={id + '-mode'} className="block font-semibold text-white">Provider account</label>
        <select id={id + '-mode'} value={mode} onChange={event => setMode(event.target.value as 'signin' | 'signup')} className="dark-select w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25">
          <option value="signin">Sign in to an existing account</option><option value="signup">Set up a new account</option>
        </select>
        <label htmlFor={id + '-token'} className="block font-semibold text-white">Invitation code</label>
        <input id={id + '-token'} type="password" required pattern="[a-f0-9]{64}" minLength={64} maxLength={64} autoComplete="off" spellCheck={false} value={token} onChange={event => setToken(event.target.value.trim())} className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25" />
        <label htmlFor={id + '-email'} className="block font-semibold text-white">Invited work email</label>
        <input id={id + '-email'} type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25" />
        <label htmlFor={id + '-password'} className="block font-semibold text-white">Password</label>
        <input id={id + '-password'} type="password" required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} aria-describedby={mode === 'signup' ? id + '-policy' : undefined} className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25" />
        {mode === 'signup' && <p id={id + '-policy'} className="text-[11px] text-[#A8B8CC]">Use at least 8 characters including uppercase, lowercase, a number, and a special character.</p>}
        <button type="submit" className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2.5 font-bold text-[#061426] hover:brightness-105 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]">Verify invitation</button>
      </fieldset>
    </form> : <>
      <dl className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-[#0B1F36] p-3"><dt className="text-[#A8B8CC]">Invited name</dt><dd className="font-semibold text-white">{details.legalFirstName} {details.legalLastName}</dd><dt className="text-[#A8B8CC]">Assigned role</dt><dd className="font-semibold text-[#D4AF37]">{details.role}</dd></dl>
      {mfa?.kind === 'enroll' && <TotpEnrollmentPanel trackOperation={operation => { leaseRef.current?.track(operation); }} onComplete={() => void perform(accept)} onCancel={() => void perform(async isActive => { await api.signOut(); if (!isActive()) return; setDetails(null); setMfa(null); setPassword(''); }, true)} />}
      {mfa?.kind === 'challenge' && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void perform(async isActive => { await api.challenge(mfa.factorId || '', code); if (!isActive()) return; setCode(''); await accept(isActive); }); }}>
        <label htmlFor={id + '-code'} className="block font-semibold text-white">Authenticator code</label>
        <input id={id + '-code'} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 font-mono tabular-nums tracking-widest text-white focus:outline-none focus:border-[#D4AF37]" />
        <button type="submit" disabled={busy} className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2.5 font-bold text-[#061426]">Verify and accept invitation</button>
      </form>}
      {mfa?.kind === 'ready' && <button type="button" disabled={busy} onClick={() => void perform(accept)} className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2.5 font-bold text-[#061426]">Accept invitation</button>}
    </>}
    <button type="button" disabled={busy} onClick={() => void perform(async isActive => { await api.signOut(); if (!isActive()) return; setToken(''); setPassword(''); setCode(''); onCancel(); }, true)} className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-xs font-semibold text-[#CBD6E4] hover:text-white hover:border-[#D4AF37]/50 transition-colors">Return to staff sign-in</button>
  </section>;
}
