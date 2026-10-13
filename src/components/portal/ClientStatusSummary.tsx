import React, { useEffect, useState } from 'react';
import { vaultService } from '../../services/vaultService';
import { documentRequestService } from '../../services/documentRequestService';
import { billingApi } from '../../services/billingApiService';

type Figures = { requestsNeeded: number; requestsOverdue: number; awaitingReview: number; accepted: number; needsReplacement: number; invoicesOpen: number; balanceDue: string; unread: number };

/**
 * The client's own status from durable records: requests still needed, documents awaiting review,
 * accepted and needing replacement, open invoices with the recorded balance, unread notices.
 * Each source is optional: if one is unavailable its figures are omitted, never guessed.
 */
export function ClientStatusSummary({ clientId }: { clientId: string }) {
  const [f, setF] = useState<Partial<Figures> | null>(null);
  useEffect(() => {
    let live = true;
    Promise.allSettled([documentRequestService.list(clientId), vaultService.list(clientId), billingApi.invoices(clientId), documentRequestService.notifications(clientId)]).then(([req, docs, inv, notes]) => {
      if (!live) return;
      const out: Partial<Figures> = {};
      if (req.status === 'fulfilled') { const open = req.value.items.filter(q => ['OPEN', 'SUBMITTED'].includes(q.status)); out.requestsNeeded = open.filter(q => q.status === 'OPEN').length; out.requestsOverdue = open.filter(q => q.overdue).length; }
      if (docs.status === 'fulfilled') { const d = docs.value.items; out.awaitingReview = d.filter(x => ['SCAN_PENDING', 'PENDING_REVIEW'].includes(x.status)).length;
        out.accepted = d.filter(x => x.status === 'VERIFIED').length; out.needsReplacement = d.filter(x => ['REPLACEMENT_REQUESTED', 'REJECTED'].includes(x.status)).length; }
      if (inv.status === 'fulfilled') { const open = inv.value.items.filter((i: any) => ['ISSUED', 'PARTIALLY_PAID'].includes(i.status));
        out.invoicesOpen = open.length; out.balanceDue = (open.reduce((cents: number, i: any) => cents + Math.round(Number(i.balanceDue) * 100), 0) / 100).toFixed(2); }
      if (notes.status === 'fulfilled') out.unread = notes.value.unread;
      setF(Object.keys(out).length ? out : null);
    });
    return () => { live = false; };
  }, [clientId]);
  if (!f) return null;
  const items: Array<[string, number | string | undefined]> = [['Documents still needed', f.requestsNeeded], ['Overdue requests', f.requestsOverdue], ['Awaiting review', f.awaitingReview],
    ['Accepted', f.accepted], ['Need a replacement', f.needsReplacement], ['Open invoices', f.invoicesOpen], ['Balance due', f.balanceDue === undefined ? undefined : '$' + f.balanceDue], ['Unread notices', f.unread]];
  return <section aria-labelledby="client-status-heading" className="rounded-xl border border-slate-700 bg-[#071A2E] p-4 text-sm text-slate-200">
    <h2 id="client-status-heading" className="text-lg font-bold text-white">Your status</h2>
    <ul className="flex flex-wrap gap-4">{items.filter(([, v]) => v !== undefined).map(([label, v]) => <li key={label}><span className="text-slate-400">{label}</span> <strong>{v}</strong></li>)}</ul>
  </section>;
}
