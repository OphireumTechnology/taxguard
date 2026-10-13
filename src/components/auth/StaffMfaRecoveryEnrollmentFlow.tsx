import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TotpEnrollmentPanel } from './TotpEnrollmentPanel';
import { beginProviderOnlyIdentityFlow } from '../../context/providerOnlyIdentityFlow';
import { createStaffInvitationLifecycle } from '../../services/staffInvitationLifecycle';
import { createRecoveryEnrollmentApi, RecoveryEnrollmentError, type RecoveryEnrollmentApi, type RecoveryStep } from '../../services/staffRecoveryEnrollmentApi';

const STEP_TEXT: Record<RecoveryStep, string> = {
  none: 'There is no open MFA recovery for this account. If you lost your authenticator, ask an administrator to request recovery.',
  awaiting_approval: 'Your recovery request is waiting for approval by a second administrator.',
  awaiting_reset: 'Your recovery was approved. Your previous authenticators are being removed; check again shortly.',
  reset_failed: 'Removing your previous authenticators failed. An administrator has to retry it.',
  ready_for_enrollment: 'Your previous authenticators were removed. Set up a new authenticator below.',
  awaiting_reactivation: 'Your new authenticator is verified. An administrator must now reactivate your access; then sign in again with the new authenticator.',
};

/** Staff self-service step of MFA recovery: provider sign-in, new authenticator, verified proof. */
export function StaffMfaRecoveryEnrollmentFlow({ onCancel, api: injected }: { onCancel: () => void; api?: RecoveryEnrollmentApi }) {
  const api = useMemo(() => injected ?? createRecoveryEnrollmentApi(), [injected]);
  // The recovery provider session proves identity only. While this flow is mounted the app must not
  // bridge it into a TaxGuard session (or provision anything); leaving signs it out first.
  const lifecycle = useRef<ReturnType<typeof createStaffInvitationLifecycle> | null>(null);
  if (!lifecycle.current) lifecycle.current = createStaffInvitationLifecycle(beginProviderOnlyIdentityFlow, () => api.signOut());
  useEffect(() => { const lease = lifecycle.current!.mount(); return () => { void lease.close(); }; }, []);
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [step, setStep] = useState<RecoveryStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const pending = useRef(false);
  const run = async (fn: () => Promise<void>) => {
    if (pending.current) return; pending.current = true; setBusy(true); setMessage(null);
    try { await fn(); } catch (e) { setMessage({ error: true, text: e instanceof RecoveryEnrollmentError ? e.message : 'The server did not confirm this step. Try again.' }); }
    finally { pending.current = false; setBusy(false); }
  };
  if (!api.available()) return <section aria-label="Complete MFA recovery" className="space-y-3 text-sm text-slate-200">
    <h2 className="font-bold">Complete MFA recovery</h2>
    <p role="status">MFA recovery is not available in this environment.</p>
    <button type="button" onClick={onCancel}>Back to staff sign in</button>
  </section>;
  return <section aria-label="Complete MFA recovery" className="space-y-4 text-sm text-slate-200">
    <h2 className="font-bold">Complete MFA recovery</h2>
    <p>Use this after an administrator approved recovery of your authenticator. You will not be signed in to TaxGuard here; access returns after an administrator reactivates you.</p>
    {message && <p role={message.error ? 'alert' : 'status'}>{message.text}</p>}
    {step === null ? <form aria-label="Sign in to continue recovery" onSubmit={e => { e.preventDefault(); void run(async () => {
        await api.signIn(credentials.email, credentials.password); setCredentials({ email: credentials.email, password: '' }); setStep(await api.step()); }); }}>
      <label className="block">Work email<input type="email" autoComplete="username" required value={credentials.email} onChange={e => setCredentials({ ...credentials, email: e.target.value })} className="w-full bg-[#071A2E] p-2" /></label>
      <label className="block">Password<input type="password" autoComplete="current-password" required value={credentials.password} onChange={e => setCredentials({ ...credentials, password: e.target.value })} className="w-full bg-[#071A2E] p-2" /></label>
      <button disabled={busy} type="submit">{busy ? 'Checking…' : 'Continue recovery'}</button>
    </form> : <>
      <p role="status" aria-label="Recovery step">{STEP_TEXT[step]}</p>
      {step === 'ready_for_enrollment' && <TotpEnrollmentPanel onComplete={() => void run(async () => { await api.submit(); setStep('awaiting_reactivation');
          setMessage({ error: false, text: 'New authenticator verified by the server. An administrator must now reactivate your access.' }); })}
        onCancel={() => setMessage({ error: false, text: 'Setup cancelled. You can start again.' })} />}
      {['awaiting_reset', 'awaiting_approval', 'reset_failed'].includes(step) && <button type="button" disabled={busy} onClick={() => void run(async () => setStep(await api.step()))}>Check again</button>}
    </>}
    <button type="button" disabled={busy} onClick={() => void run(async () => { await api.signOut(); setStep(null); onCancel(); })}>Leave recovery</button>
  </section>;
}
