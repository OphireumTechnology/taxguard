import { useCallback, useEffect, useState } from 'react';
import { RETURN_RISK_REASON_LABELS, TaxEngineRequestError, taxEngineMessage, taxEngineService, type ReviewQueueItem } from '../../services/taxEngineService';

/**
 * The signed-in reviewer's Stage 09 queue (proposal 20261019210000): submitted draft return versions of the cases they
 * are the live reviewer for, oldest submission first. Each item says whether it is stale, verified and how its latest
 * risk assessment came out; a BLOCKED assessment is shown so that it is not missed, never acted on here. The decision
 * itself is taken in Case Workflow → Draft return. Read only; hidden when the durable store is not enabled.
 */
export function reviewQueueStateText(item: Pick<ReviewQueueItem, 'stale' | 'verification' | 'risk'>): string {
  const parts: string[] = [];
  if (item.stale) parts.push('stale: its inputs changed, so it cannot be approved; return it to the preparer');
  parts.push(item.verification ? `calculations ${item.verification.result === 'VERIFIED' ? 'verified' : 'have a discrepancy'}` : 'calculations not verified yet');
  if (!item.risk) parts.push('risk not assessed');
  else if (item.risk.outcome === 'BLOCKED') parts.push('risk assessment BLOCKED: ' + item.risk.reasonCodes.filter(c => c !== 'RETURN_HUMAN_REVIEW_REQUIRED')
    .map(c => (RETURN_RISK_REASON_LABELS[c] ?? c).replace(/\.$/, '')).join('; '));
  else parts.push('risk: human review required');
  return parts.join(' · ');
}

export function ReturnReviewQueuePanel() {
  const [queue, setQueue] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; items: ReviewQueueItem[]; message?: string }>({ status: 'loading', items: [] });
  const load = useCallback(() => {
    setQueue(q => ({ ...q, status: q.status === 'off' ? 'off' : 'loading' }));
    taxEngineService.reviewQueue().then(items => setQueue({ status: 'ready', items }))
      .catch(e => {
        if (e instanceof TaxEngineRequestError && (e.status === 503 || e.status === 403)) { setQueue({ status: 'off', items: [] }); return; }
        setQueue({ status: 'error', items: [], message: taxEngineMessage(e) });
      });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (queue.status === 'off') return null;
  const blocked = queue.items.filter(i => i.risk?.outcome === 'BLOCKED').length;
  return <section aria-labelledby="review-queue-heading" className="tg-acct-card">
    <h2 id="review-queue-heading">Draft returns awaiting my review <button type="button" onClick={load} disabled={queue.status === 'loading'}>Refresh</button></h2>
    <p>Submitted draft returns of the cases you review, oldest first. Review and decide in Case Workflow → Draft return. Return use: BLOCKED.</p>
    {queue.status === 'loading' && queue.items.length === 0 && <p role="status">Loading your review queue…</p>}
    {queue.status === 'error' && <p role="alert">{queue.message}</p>}
    {queue.status === 'ready' && <p role="status">{queue.items.length === 0 ? 'No draft return is waiting for your review.'
      : `${queue.items.length} draft return${queue.items.length === 1 ? '' : 's'} waiting${blocked ? `; ${blocked} with a BLOCKED risk assessment` : ''}.`}</p>}
    {queue.items.map(item => {
      const name = `${item.templateId} version ${item.version}`;
      return <article key={item.returnVersionId} aria-label={`Review of ${name}`} data-risk={item.risk?.outcome}>
        <h3>{name} · case {item.caseId} · tax year {item.taxYear}</h3>
        <p>Prepared by {item.preparedBy} · submitted {new Date(item.submittedAt).toLocaleString()}</p>
        <p>{reviewQueueStateText(item)}</p>
      </article>;
    })}
  </section>;
}
