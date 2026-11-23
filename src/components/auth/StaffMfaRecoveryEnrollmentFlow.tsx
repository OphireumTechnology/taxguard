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
  if (!api.available()) return <section aria-label="Complete MFA recovery" className="space-y-3 rounded-xl border border-white/12 bg-[#061426]/85 p-4 text-xs text-[#CBD6E4]">
    <h2 className="text-sm font-bold text-[#D4AF37]">Complete MFA recovery</h2>
    <p role="status" className="text-[#A8B8CC]">MFA recovery is not available in this environment.</p>
    <button type="button" onClick={onCancel} className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-xs font-semibold text-[#CBD6E4] hover:text-white hover:border-[#D4AF37]/50 transition-colors">Back to staff sign in</button>
  </section>;
  return <section aria-label="Complete MFA recovery" className="space-y-4 rounded-xl border border-white/12 bg-[#061426]/85 p-4 text-xs text-[#CBD6E4]">
    <h2 className="text-sm font-bold text-[#D4AF37]">Complete MFA recovery</h2>
    <p className="leading-relaxed text-[#A8B8CC]">Use this after an administrator approved recovery of your authenticator. You will not be signed in to TaxGuard here; access returns after an administrator reactivates you.</p>
    {message && <p role={message.error ? 'alert' : 'status'} className={message.error ? 'rounded-lg border border-rose-400/35 bg-rose-950/50 p-2.5 text-rose-100' : 'rounded-lg border border-[#00C2D1]/35 bg-[#0B1F36] p-2.5 text-[#E2EAF4]'}>{message.text}</p>}
    {step === null ? <form className="space-y-3" aria-label="Sign in to continue recovery" onSubmit={e => { e.preventDefault(); void run(async () => {
        await api.signIn(credentials.email, credentials.password); setCredentials({ email: credentials.email, password: '' }); setStep(await api.step()); }); }}>
      <label className="block font-semibold text-white space-y-1"><span>Work email</span><input type="email" autoComplete="username" required value={credentials.email} onChange={e => setCredentials({ ...credentials, email: e.target.value })} className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25" /></label>
      <label className="block font-semibold text-white space-y-1"><span>Password</span><input type="password" autoComplete="current-password" required value={credentials.password} onChange={e => setCredentials({ ...credentials, password: e.target.value })} className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25" /></label>
      <button disabled={busy} type="submit" className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2.5 font-bold text-[#061426] hover:brightness-105 transition-all disabled:opacity-55">{busy ? 'Checking…' : 'Continue recovery'}</button>
    </form> : <>
      <p role="status" aria-label="Recovery step" className="rounded-lg border border-white/12 bg-[#0B1F36] p-3 text-white">{STEP_TEXT[step]}</p>
      {step === 'ready_for_enrollment' && <TotpEnrollmentPanel onComplete={() => void run(async () => { await api.submit(); setStep('awaiting_reactivation');
          setMessage({ error: false, text: 'New authenticator verified by the server. An administrator must now reactivate your access.' }); })}
        onCancel={() => setMessage({ error: false, text: 'Setup cancelled. You can start again.' })} />}
      {['awaiting_reset', 'awaiting_approval', 'reset_failed'].includes(step) && <button type="button" disabled={busy} onClick={() => void run(async () => setStep(await api.step()))} className="w-full min-h-[42px] rounded-xl bg-[#123156] border border-[#00C2D1]/40 px-3 py-2 font-semibold text-white hover:border-[#D4AF37]/60 transition-colors">Check again</button>}
    </>}
    <button type="button" disabled={busy} onClick={() => void run(async () => { await api.signOut(); setStep(null); onCancel(); })} className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-xs font-semibold text-[#CBD6E4] hover:text-white hover:border-[#D4AF37]/50 transition-colors">Leave recovery</button>
  </section>;
}
