import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '../../../types';
import { readClientMfaStatus, type ClientMfaStatus } from '../../../supabase/clientMfa';

const recordedMfaSetting = (user: Pick<User, 'mfaEnabled'> | null) =>
  user?.mfaEnabled === true ? 'Recorded as enabled' : user?.mfaEnabled === false ? 'Recorded as disabled' : 'Not recorded';
const LEVEL: Record<string, string> = { aal2: 'This sign-in used an authenticator', aal1: 'This sign-in used a password only', unknown: 'Not reported' };

/** The provider's report for this session. Pure: no request is made here and nothing can be changed. */
export function ClientMfaStatusBody({ status, user }: { status: ClientMfaStatus | null; user: User | null }) {
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
    <div className="rounded-lg border border-amber-500/40 p-3 text-amber-200">
      <p className="font-semibold">Adding an authenticator is not available yet.</p>
      <p>Client sign-in does not yet ask for an authenticator code, so an enrolled authenticator would not protect your account. It will be offered once client sign-in verifies it and the practice approves its client security policy. To change or recover an authenticator, contact your practice.</p>
    </div>
    <button type="button" disabled className="p-2 border border-slate-500 rounded-lg">Add authenticator (unavailable)</button>
  </>;
}

/** Contract C2: client multi-factor status from the identity provider (read-only). */
export function ClientMfaPanel({ user, read = readClientMfaStatus }: { user: User | null; read?: () => Promise<ClientMfaStatus> }) {
  const [status, setStatus] = useState<ClientMfaStatus | null>(null);
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current; setStatus(null);
    read().then(s => { if (mine === seq.current) setStatus(s); }).catch(() => { if (mine === seq.current) setStatus({ state: 'ERROR' }); });
  }, [read]);
  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);
  return <section aria-labelledby="client-mfa-heading" aria-busy={status === null} className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-3 text-slate-300">
    <h2 id="client-mfa-heading" className="font-bold text-white">MFA & Credentials</h2>
    <ClientMfaStatusBody status={status} user={user} />
    {status !== null && <button type="button" className="ml-2 p-2 border border-slate-500 rounded-lg" onClick={load}>Check again</button>}
  </section>;
}
