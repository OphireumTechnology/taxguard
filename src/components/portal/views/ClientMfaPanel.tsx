import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { User } from '../../../types';
import { useOptionalApp } from '../../../context/AppContext';
import { beginClientTotpEnrollment, cancelClientTotpEnrollment, clientMfaEnrollmentAvailable, clientMfaErrorText, confirmClientTotpEnrollment, ClientMfaError,
  readClientMfaStatus, type ClientMfaStatus, type ClientTotpEnrollment } from '../../../supabase/clientMfa';

const recordedMfaSetting = (user: Pick<User, 'mfaEnabled'> | null) =>
  user?.mfaEnabled === true ? 'Recorded as enabled' : user?.mfaEnabled === false ? 'Recorded as disabled' : 'Not recorded';
const LEVEL: Record<string, string> = { aal2: 'This sign-in used an authenticator', aal1: 'This sign-in used a password only', unknown: 'Not reported' };

/** The provider's report for this session. Pure: no request is made here and nothing can be changed. */
export function ClientMfaStatusBody({ status, user, enrollmentAvailable = false }: { status: ClientMfaStatus | null; user: User | null; enrollmentAvailable?: boolean }) {
  const protectedAccount = status?.state === 'READY' && status.verifiedFactors > 0;
  return <>
    {status === null && <p role="status">Checking your sign-in security…</p>}
    {status?.state === 'UNAVAILABLE' && <p role="status">The identity provider is not configured in this environment, so authenticator status cannot be shown.</p>}
    {status?.state === 'NO_PROVIDER_SESSION' && <p role="status">This session was not created by the identity provider, so authenticator status cannot be shown.</p>}
    {status?.state === 'ERROR' && <p role="alert">The identity provider did not report your authenticator status.</p>}
    {status?.state === 'READY' && <dl className="grid gap-2 sm:grid-cols-2">
      <div><dt className="text-xs text-slate-400">This sign-in</dt><dd className="font-semibold text-white">{LEVEL[status.currentLevel]}</dd></div>
      <div><dt className="text-xs text-slate-400">Verified authenticators</dt><dd className="font-semibold text-white">{status.verifiedFactors}{status.pendingFactors ? ` (${status.pendingFactors} not finished)` : ''}</dd></div>
    </dl>}
    <p className="text-xs text-slate-400">Profile record: {recordedMfaSetting(user)}. This recorded setting does not verify the current authentication factor, an enrolled device or signing authority.
      The status above is reported by the identity provider for this session only.</p>
    {protectedAccount && <p role="status">An authenticator protects your account: every sign-in asks for its code. To replace or remove it, contact your practice; it cannot be removed here.</p>}
    {!protectedAccount && !enrollmentAvailable && <>
      <div className="rounded-lg border border-amber-500/40 p-3 text-amber-200">
        <p className="font-semibold">Adding an authenticator is not available yet.</p>
        <p>Your practice enables it once its client security policy is approved and the identity provider is configured for this environment. If an authenticator is already set up, sign-in always asks for its code.</p>
      </div>
      <button type="button" disabled className="p-2 border border-slate-500 rounded-lg">Add authenticator (unavailable)</button>
    </>}
  </>;
}

/**
 * Client authenticator enrolment through the identity provider (contract C2). The setup key is shown
 * once by the provider and kept only in this component's memory; nothing is written to storage.
 * After verification the client is signed out and signs in again with the code, so the new session
 * is established at AAL2.
 */
const PROVIDER_ENROLLMENT_API = { begin: beginClientTotpEnrollment, verifyCode: confirmClientTotpEnrollment, cancel: cancelClientTotpEnrollment };
export function ClientTotpEnrollment({ onEnrolled, api = PROVIDER_ENROLLMENT_API }:
  { onEnrolled: () => void; api?: { begin: () => Promise<ClientTotpEnrollment>; verifyCode: (factorId: string, code: string) => Promise<void>; cancel: (factorId: string) => Promise<void> } }) {
  const id = useId();
  const [setup, setSetup] = useState<ClientTotpEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const live = useRef(true);
  const startButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  // A setup left open is cancelled when the panel goes away (navigation, sign-out).
  // Unmount only: a cleanup keyed on the api object ran on re-renders and removed the factor just created.
  const pending = useRef<string | null>(null);
  const apiRef = useRef(api); apiRef.current = api;
  useEffect(() => () => { if (pending.current) void apiRef.current.cancel(pending.current).catch(() => undefined); }, []);
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setMessage(null);
    try { await work(); } catch (e) { if (live.current) setMessage({ error: true, text: clientMfaErrorText(e instanceof ClientMfaError ? e.code : undefined) }); }
    finally { if (live.current) setBusy(false); }
  };
  const start = () => run(async () => { const s = await api.begin(); pending.current = s.factorId; if (live.current) setSetup(s); });
  const cancel = () => run(async () => {
    if (setup) await api.cancel(setup.factorId);
    pending.current = null;
    if (!live.current) return;
    setSetup(null); setCode(''); setMessage({ error: false, text: 'Authenticator setup cancelled. Nothing was added.' });
    setTimeout(() => startButton.current?.focus(), 0);
  });
  const verify = (e: React.FormEvent) => { e.preventDefault(); void run(async () => {
    await api.verifyCode(setup!.factorId, code);
    pending.current = null;
    if (!live.current) return;
    setSetup(null); setCode('');
    setMessage({ error: false, text: 'Authenticator added. You will now be signed out; sign in again with your password and the code from your app.' });
    onEnrolled();
  }); };
  return <section aria-labelledby={id + '-heading'} className="space-y-3 rounded-lg border border-slate-600 p-3">
    <h3 id={id + '-heading'} className="font-semibold text-white">Add an authenticator</h3>
    {!setup && <>
      <p>An authenticator app adds a one-time code to every sign-in.</p>
      <button ref={startButton} type="button" disabled={busy} className="p-2 border border-slate-500 rounded-lg" onClick={() => void start()}>{busy ? 'Starting…' : 'Start authenticator setup'}</button>
    </>}
    {setup && <>
      <p>Scan the QR code in your authenticator app, or enter the setup key. Keep the key private: it is not shown again.</p>
      {setup.qrCode.startsWith('data:image/') && <img src={setup.qrCode} alt="Authenticator setup QR code" width={200} height={200} />}
      <label htmlFor={id + '-secret'} className="block">Setup key</label>
      <input id={id + '-secret'} readOnly value={setup.secret} autoComplete="off" className="w-full bg-[#071A2E] p-2 font-mono" />
      <form onSubmit={verify} className="space-y-2" aria-label="Verify authenticator">
        <label htmlFor={id + '-code'} className="block">6-digit code from your app</label>
        <input id={id + '-code'} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code}
          aria-describedby={message?.error ? id + '-msg' : undefined} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full bg-[#071A2E] p-2" />
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || code.length !== 6} className="p-2 border border-slate-500 rounded-lg">{busy ? 'Verifying…' : 'Verify authenticator'}</button>
          <button type="button" disabled={busy} className="p-2 border border-slate-500 rounded-lg" onClick={() => void cancel()}>Cancel setup</button>
        </div>
      </form>
    </>}
    {message && <p id={id + '-msg'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </section>;
}

/** Contract C2: client multi-factor status and (when enabled) enrolment, from the identity provider. */
export function ClientMfaPanel({ user, read = readClientMfaStatus, enrollmentAvailable = clientMfaEnrollmentAvailable }:
  { user: User | null; read?: () => Promise<ClientMfaStatus>; enrollmentAvailable?: () => boolean }) {
  const app = useOptionalApp();
  const [status, setStatus] = useState<ClientMfaStatus | null>(null);
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current; setStatus(null);
    read().then(s => { if (mine === seq.current) setStatus(s); }).catch(() => { if (mine === seq.current) setStatus({ state: 'ERROR' }); });
  }, [read]);
  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);
  const canEnrol = enrollmentAvailable();
  const offerEnrolment = canEnrol && status?.state === 'READY' && status.verifiedFactors === 0;
  return <section aria-labelledby="client-mfa-heading" aria-busy={status === null} className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-3 text-slate-300">
    <h2 id="client-mfa-heading" className="font-bold text-white">MFA & Credentials</h2>
    <ClientMfaStatusBody status={status} user={user} enrollmentAvailable={canEnrol} />
    {offerEnrolment && <ClientTotpEnrollment onEnrolled={() => { setTimeout(() => { void app?.logout(); }, 2500); }} />}
    {status !== null && <button type="button" className="ml-2 p-2 border border-slate-500 rounded-lg" onClick={load}>Check again</button>}
  </section>;
}
