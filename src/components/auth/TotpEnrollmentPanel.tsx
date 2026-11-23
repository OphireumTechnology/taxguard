import React, { useEffect, useId, useRef, useState } from 'react';
import { useProviderIdentityBoundary } from '../../services/providerIdentityBoundary';
import { beginTotpEnrollment, cancelTotpEnrollment, confirmTotpEnrollment, type TotpEnrollment } from '../../supabase/mfaEnrollment';

export function TotpEnrollmentPanel({ onComplete, onCancel, trackOperation }: { onComplete: () => void; onCancel: () => void; trackOperation?: (operation: Promise<void>) => void }) {
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const identity = useProviderIdentityBoundary();
  function useBoundState<T>(initial: T): [T, (value: T) => void] {
    const [state, setState] = useState({key: identity.key, value: initial});
    useEffect(() => {setState(previous => previous.key === identity.key ? previous : {key: identity.key, value: initial});}, [identity.key]);
    return [state.key === identity.key ? state.value : initial, value => setState({key: identity.capture(), value})];
  }
  const id = useId();
  const [enrollment, setEnrollment] = useBoundState<TotpEnrollment | null>(null);
  const [code, setCode] = useBoundState('');
  const [busy, setBusy] = useBoundState(false);
  const [error, setError] = useBoundState('');
  const submitting = useRef(false);
  async function perform(action: (current: () => boolean) => Promise<void>) {
    if (submitting.current || !identity.isCurrent(identity.key)) return;
    const proof = identity.capture();
    const current = () => mounted.current && identity.isCurrent(proof);
    submitting.current = true; setBusy(true); setError('');
    const operation = (async () => {
      try { await action(current); } catch (e) { if (current()) setError(e instanceof Error ? e.message : 'Enrollment could not be completed.'); }
      finally { submitting.current = false; if (current()) setBusy(false); }
    })();
    trackOperation?.(operation);
    await operation;
  }
  return <section aria-label="Enroll staff authenticator" className="space-y-4 rounded-xl border border-[#00C2D1]/25 bg-[#061426]/85 p-4 text-xs text-[#CBD6E4]">
    <h2 className="text-sm font-bold text-[#D4AF37]">Set up your authenticator</h2>
    <p className="leading-relaxed text-[#A8B8CC]">Staff access requires an authenticator app. Your workspace stays locked until verification and any required administrator approval are complete.</p>
    {error && <p role="alert" className="rounded-lg border border-rose-400/35 bg-rose-950/50 p-2.5 text-rose-100">{error}</p>}
    {!enrollment ? <button type="button" disabled={busy} onClick={() => void perform(async current => { const setup = await beginTotpEnrollment(); if (current()) setEnrollment(setup); })} className="w-full min-h-[42px] rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2 font-bold text-[#061426] hover:brightness-105 transition-all disabled:opacity-55">Start authenticator setup</button> : <>
      {enrollment.secret ? <>
      <p className="leading-relaxed text-[#A8B8CC]">Scan this QR code in your authenticator app, or enter the setup key. Keep the key private.</p>
      <img src={enrollment.qrCode.startsWith('data:image/') ? enrollment.qrCode : undefined} alt="Authenticator enrollment QR code" width={200} height={200} className="mx-auto rounded-lg bg-white p-2" />
      <label htmlFor={id + '-secret'} className="block font-semibold text-white">Setup key</label>
      <input id={id + '-secret'} readOnly value={enrollment.secret} autoComplete="off" className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 font-mono text-white" />
      </> : <p className="leading-relaxed text-[#A8B8CC]">A pending setup already exists. Enter the code from the authenticator you configured. If you no longer have the setup key, request approved recovery from your administrator.</p>}
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); void perform(async current => { await confirmTotpEnrollment(enrollment.factorId, code); if (!current()) return; setEnrollment(null); setCode(''); onComplete(); }); }}>
        <label htmlFor={id + '-code'} className="block font-semibold text-white">Authenticator code</label>
        <input id={id + '-code'} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 font-mono tabular-nums tracking-widest text-white focus:outline-none focus:border-[#D4AF37]" />
        <button disabled={busy} type="submit" className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2 font-bold text-[#061426] hover:brightness-105 transition-all disabled:opacity-55">Verify authenticator</button>
      </form>
    </>}
    <button type="button" disabled={busy} onClick={() => void perform(async current => { if (enrollment) await cancelTotpEnrollment(enrollment.factorId); if (!current()) return; setEnrollment(null); setCode(''); onCancel(); })} className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-2 text-xs font-semibold text-[#CBD6E4] hover:text-white hover:border-[#D4AF37]/50 transition-colors">Cancel setup</button>
  </section>;
}
