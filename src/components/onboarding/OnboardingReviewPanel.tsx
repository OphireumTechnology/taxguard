import React, { useCallback, useEffect, useState } from 'react';
import { onboardingApi, onboardingMessage, type OnboardingQueueItem, type OnboardingView } from '../../services/onboardingApi';

/**
 * Practice manager / administrator review of submitted Stage 01 onboarding. The database checks the
 * verified identity document, possible duplicates and the consent version again on every decision.
 */
export const OnboardingReviewPanel: React.FC = () => {
  const [items, setItems] = useState<OnboardingQueueItem[] | null>(null);
  const [selected, setSelected] = useState<OnboardingView | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  const loadQueue = useCallback(() => {
    onboardingApi.queue().then(r => setItems(r.items)).catch(e => { setItems([]); setNotice({ error: true, text: onboardingMessage(e) }); });
  }, []);
  useEffect(() => { loadQueue(); }, [loadQueue]);
  const open = (clientId: string) => {
    setNotice(null); setReason(''); setNote(''); setOverride(false);
    onboardingApi.client(clientId).then(setSelected).catch(e => setNotice({ error: true, text: onboardingMessage(e) }));
  };
  const decide = async (decision: 'approve' | 'request_changes') => {
    if (!selected) return;
    setBusy(true); setNotice(null);
    try {
      const v = await onboardingApi.decide(selected.clientId, selected.revision, decision,
        decision === 'approve' ? { internalNote: note, duplicateOverride: override } : { clientReason: reason, internalNote: note });
      setSelected(null);
      setNotice({ error: false, text: v.status === 'APPROVED' ? `Onboarding for ${v.clientId} approved. Stage 02 is open for the client.` : `Changes requested from ${v.clientId}.` });
      loadQueue();
    } catch (e) { setNotice({ error: true, text: onboardingMessage(e) }); }
    finally { setBusy(false); }
  };
  const duplicates = selected?.possibleDuplicates ?? [];

  return (
    <section aria-labelledby="onboarding-review-title" className="tg-manager-card">
      <h2 id="onboarding-review-title">Onboarding review</h2>
      <p>Submitted Stage 01 onboarding awaiting a decision. Approval needs a practice-verified identification document.</p>
      {items === null && <p role="status">Loading submitted onboarding…</p>}
      {items?.length === 0 && <p role="status">No onboarding is awaiting review.</p>}
      {items && items.length > 0 && <table aria-label="Submitted onboarding">
        <thead><tr><th scope="col">Client</th><th scope="col">Legal name</th><th scope="col">Submitted</th><th scope="col">Identity document</th><th scope="col">Possible duplicates</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
        <tbody>{items.map(i => <tr key={i.clientId}><td>{i.clientId}</td><td>{i.legalName}</td><td>{i.submittedAt?.slice(0, 10)}</td><td>{i.identityDocument ? 'Verified' : 'Not verified'}</td>
          <td>{i.possibleDuplicates}</td><td><button type="button" onClick={() => open(i.clientId)} aria-label={`Review onboarding for client ${i.clientId}`}>Review</button></td></tr>)}</tbody>
      </table>}
      {selected && <article aria-label={`Onboarding for client ${selected.clientId}`}>
        <h3>Client {selected.clientId}: {selected.legalName}</h3>
        <dl>
          <dt>Taxpayer type</dt><dd>{selected.taxpayerType}</dd>
          <dt>Identification number</dt><dd>{selected.tinType} {selected.tinMasked}</dd>
          <dt>Address</dt><dd>{[selected.address.street, selected.address.city, selected.address.state, selected.address.postalCode].filter(Boolean).join(', ')}</dd>
          {selected.representative && <><dt>Representative</dt><dd>{selected.representative.fullName}, {selected.representative.title}</dd></>}
          <dt>Consent</dt><dd>Version {selected.consentVersion}, signed by {selected.consentSigner} on {selected.consentAt?.slice(0, 10)}</dd>
          <dt>Identity document</dt><dd>{selected.requirements.identityDocument ? 'Verified by the practice' : 'Not verified yet (verify it under Document Review)'}</dd>
          <dt>Possible duplicates</dt><dd>{duplicates.length ? duplicates.join(', ') : 'None found'}</dd>
        </dl>
        <label>Reason shown to the client (required to request changes)<input value={reason} maxLength={500} onChange={e => setReason(e.target.value)} /></label>
        <label>Internal note (staff only)<input value={note} maxLength={1000} onChange={e => setNote(e.target.value)} /></label>
        {duplicates.length > 0 && <label><input type="checkbox" checked={override} onChange={e => setOverride(e.target.checked)} /> Not a duplicate: approve anyway (internal note of at least 10 characters required)</label>}
        <button type="button" disabled={busy} onClick={() => void decide('approve')}>Approve onboarding</button>
        <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => void decide('request_changes')}>Request changes</button>
      </article>}
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    </section>
  );
};
