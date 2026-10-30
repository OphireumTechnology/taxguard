import React, { useCallback, useEffect, useRef, useState } from 'react';
import { clientPortalContracts, portalErrorMessage, type SignaturePackageStatus } from '../../../services/clientPortalContracts';

const when = (iso: string) => { try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } };

/**
 * Returns your practice has released to you for signature (Stage 11, Block 74). Status only: no figures or forms are shown,
 * and electronic signing is not available yet, so there is nothing to sign here. A release the practice withdraws, or one
 * whose final authorization lapses, no longer appears.
 */
export function ClientSignaturePackagesPanel({ clientId, taxYear }: { clientId: string; taxYear: number }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: SignaturePackageStatus[]; message?: string }>({ status: 'loading', items: [] });
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current;
    setState(s => ({ ...s, status: 'loading' }));
    clientPortalContracts.signaturePackages(clientId)
      .then(items => { if (mine === seq.current) setState({ status: 'ready', items: items.filter(i => i.taxYear === taxYear) }); })
      .catch(e => { if (mine === seq.current) setState({ status: 'error', items: [], message: portalErrorMessage(e) }); });
  }, [clientId, taxYear]);
  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);

  return <section aria-labelledby="client-signature-heading" aria-busy={state.status === 'loading'} className="rounded-2xl border border-slate-700 bg-[#0D2745] p-4 space-y-3 text-sm text-slate-200">
    <header>
      <h3 id="client-signature-heading" className="font-bold text-white">Your return and signature</h3>
      <p className="text-xs text-slate-400">Electronic signing is not available yet. Your practice will contact you about signing; nothing is signed or filed here.</p>
    </header>
    {state.status === 'loading' && state.items.length === 0 && <p role="status">Loading your signature status…</p>}
    {state.status === 'error' && <p role="alert">{state.message} <button type="button" className="underline" onClick={load}>Retry</button></p>}
    {state.status === 'ready' && state.items.length === 0 && <p role="status">No {taxYear} return has been released to you for signature.</p>}
    {state.items.length > 0 && <ul className="space-y-2">{state.items.map(i => <li key={i.packageId} className="rounded-xl border border-slate-700 p-3">
      <p className="font-semibold text-white">{i.taxYear} return: awaiting your signature</p>
      <p className="text-xs text-slate-400">Released <time dateTime={i.releasedAt}>{when(i.releasedAt)}</time>. Signing is not available yet.</p>
    </li>)}</ul>}
  </section>;
}
