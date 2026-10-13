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
  return <section aria-label="Enroll staff authenticator" className="space-y-4 text-sm">
    <h2 className="font-bold">Set up your authenticator</h2>
    <p>Staff access requires an authenticator app. Your workspace stays locked until verification and any required administrator approval are complete.</p>
    {error && <p role="alert">{error}</p>}
    {!enrollment ? <button type="button" disabled={busy} onClick={() => void perform(async current => { const setup = await beginTotpEnrollment(); if (current()) setEnrollment(setup); })}>Start authenticator setup</button> : <>
      {enrollment.secret ? <>
      <p>Scan this QR code in your authenticator app, or enter the setup key. Keep the key private.</p>
      <img src={enrollment.qrCode.startsWith('data:image/') ? enrollment.qrCode : undefined} alt="Authenticator enrollment QR code" width={200} height={200} />
      <label htmlFor={id + '-secret'}>Setup key</label>
      <input id={id + '-secret'} readOnly value={enrollment.secret} autoComplete="off" className="w-full bg-[#071A2E] p-2" />
      </> : <p>A pending setup already exists. Enter the code from the authenticator you configured. If you no longer have the setup key, request approved recovery from your administrator.</p>}
      <form onSubmit={e => { e.preventDefault(); void perform(async current => { await confirmTotpEnrollment(enrollment.factorId, code); if (!current()) return; setEnrollment(null); setCode(''); onComplete(); }); }}>
        <label htmlFor={id + '-code'}>Authenticator code</label>
        <input id={id + '-code'} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full bg-[#071A2E] p-2" />
        <button disabled={busy} type="submit">Verify authenticator</button>
      </form>
    </>}
    <button type="button" disabled={busy} onClick={() => void perform(async current => { if (enrollment) await cancelTotpEnrollment(enrollment.factorId); if (!current()) return; setEnrollment(null); setCode(''); onCancel(); })}>Cancel setup</button>
  </section>;
}
