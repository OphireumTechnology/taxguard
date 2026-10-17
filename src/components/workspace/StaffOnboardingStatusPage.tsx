import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, CircleDashed } from 'lucide-react';
import { STEP_TEXT, StaffOnboardingError, staffOnboardingApi, type StaffOnboardingStatus } from '../../services/staffOnboardingApi';

const MEMBERSHIP: Record<string, string> = { pending_approval: 'Pending approval', active: 'Active', suspended: 'Suspended', disabled: 'Deactivated', NONE: 'Not a member', NOT_STAFF: 'Client account' };
const ASSURANCE: Record<string, string> = { aal2: 'Authenticator used', aal1: 'Password only', unknown: 'Not reported' };

/**
 * Durable staff onboarding status (contract C4), replacing the former in-memory onboarding dossier.
 * Read-only: invitations, approvals, MFA and assignments stay in the existing staff-access and
 * practice workflows. A professional dossier (credentials, PTIN / EFIN) needs an owner-approved data
 * and retention model and is not collected here.
 */
export function StaffOnboardingStatusPage({ api = staffOnboardingApi }: { api?: typeof staffOnboardingApi }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'unavailable' | 'signin'; data?: StaffOnboardingStatus }>({ status: 'loading' });
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current;
    if (!api.available()) { setState({ status: 'unavailable' }); return; }
    setState(s => ({ ...s, status: 'loading' }));
    api.status().then(data => { if (mine === seq.current) setState({ status: 'ready', data }); })
      .catch(e => { if (mine === seq.current) setState({ status: e instanceof StaffOnboardingError && ['PROVIDER_IDENTITY_DENIED', 'PROVIDER_TOKEN_REQUIRED'].includes(e.code) ? 'signin' : 'error' }); });
  }, [api]);
  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);
  const d = state.data;
  return <main id="main-content" aria-labelledby="staff-onboarding-heading" aria-busy={state.status === 'loading'} className="max-w-3xl mx-auto py-10 px-4 space-y-5 text-sm text-slate-200">
    <header className="space-y-1">
      <p className="text-[11px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">Staff onboarding</p>
      <h1 id="staff-onboarding-heading" className="text-2xl font-bold text-white">Your onboarding status</h1>
      <p className="text-slate-400">Recorded by the practice's staff-access service. Nothing on this page grants access or approves anything.</p>
    </header>
    {state.status === 'loading' && <p role="status">Loading your status…</p>}
    {state.status === 'unavailable' && <p role="status">Staff onboarding is not enabled in this environment.</p>}
    {state.status === 'signin' && <p role="alert">Sign in to the staff portal first, then return to this page.</p>}
    {state.status === 'error' && <p role="alert">Your status could not be loaded. <button type="button" className="underline" onClick={load}>Retry</button></p>}
    {state.status === 'ready' && d && <>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">Membership</dt><dd className="font-semibold text-white">{MEMBERSHIP[d.membershipStatus] ?? d.membershipStatus}{d.role ? ` · ${d.role.replace(/_/g, ' ')}` : ''}</dd></div>
        <div className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">Invitation accepted</dt><dd className="font-semibold text-white">{d.invitationAcceptedAt ? <time dateTime={d.invitationAcceptedAt}>{new Date(d.invitationAcceptedAt).toLocaleDateString()}</time> : 'Not recorded'}</dd></div>
        <div className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">This sign-in</dt><dd className="font-semibold text-white">{ASSURANCE[d.mfa.sessionAssurance] ?? d.mfa.sessionAssurance}{d.mfa.verifiedFactors !== null ? ` · ${d.mfa.verifiedFactors} authenticator${d.mfa.verifiedFactors === 1 ? '' : 's'}` : ''}</dd></div>
        <div className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">Assignments</dt><dd className="font-semibold text-white">{d.activeAssignments} active · {d.assignedClients} client{d.assignedClients === 1 ? '' : 's'}</dd></div>
      </dl>
      <section aria-labelledby="onboarding-next-heading" className="space-y-2">
        <h2 id="onboarding-next-heading" className="font-bold text-white">Next steps</h2>
        <ol className="space-y-2">{d.nextSteps.map(step => <li key={step} className="rounded-xl border border-slate-700 p-3 flex gap-2">
          {step === 'READY' ? <CheckCircle2 aria-hidden="true" className="w-5 h-5 text-emerald-400 shrink-0" /> : <CircleDashed aria-hidden="true" className="w-5 h-5 text-amber-400 shrink-0" />}
          <div><p className="font-semibold text-white">{STEP_TEXT[step].title}</p><p>{STEP_TEXT[step].detail}</p></div></li>)}</ol>
      </section>
      <button type="button" className="px-3 py-2 rounded-lg border border-slate-600 min-h-[40px]" onClick={load}>Refresh</button>
    </>}
  </main>;
}
