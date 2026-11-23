import React, { useEffect, useState } from 'react';
import { jobMessage, jobService } from '../../services/jobService';

function DuplicateReview({ jobId, onSaved }: { jobId: string; onSaved: (decision: "ACKNOWLEDGED" | "RETURNED") => void }) {
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof jobService.reviewEvidence>>>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function review(decision?: 'ACKNOWLEDGED' | 'RETURNED') {
    setBusy(true);
    setMessage('');
    try {
      if (decision && preview) {
        await jobService.reviewDuplicate(jobId, preview.version, decision);
        onSaved(decision);
        setPreview(undefined);
      } else setPreview(await jobService.reviewEvidence(jobId));
    } catch (error) {
      setMessage(jobMessage(error));
      setPreview(undefined);
    }
    finally { setBusy(false); }
  }
  return <div>
    <button type="button" disabled={busy} onClick={() => review()}>Inspect review evidence</button>
    {preview && <><ul>{preview.documents.map(doc => <li key={doc.id + ':' + doc.version}>Document {doc.id} · version {doc.version} · {doc.status} · {doc.duplicateGroup ? `Duplicate group ${doc.duplicateGroup}` : 'No matching document in this check'}</li>)}</ul>
      <button type="button" disabled={busy} onClick={() => review('ACKNOWLEDGED')}>Acknowledge result</button>
      <button type="button" disabled={busy} onClick={() => review('RETURNED')}>Return for review</button></>}
    {message && <p role="status">{message}</p>}
  </div>;
}

export function CaseDuplicateAdvisories({ caseId, assignedReviewer }: { caseId: string; assignedReviewer: boolean }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof jobService.caseAdvisories>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  function refresh() {
    setRows(null);
    setFailed(false);
    setRevision(value => value + 1);
  }
  useEffect(() => {
    let current = true;
    jobService.caseAdvisories(caseId).then(data => { if (current) setRows(data); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [caseId, revision]);
  return <section><h3>Duplicate document checks</h3>
    <button type="button" onClick={refresh} disabled={rows === null && !failed}>Refresh checks</button>
    {failed ? <p role="status">Case advisories are unavailable.</p> :
      rows === null ? <p role="status">Loading checks…</p> :
      rows.length === 0 ? <p>No completed checks for this case.</p> :
      <ul aria-label="Latest 20 completed checks">{rows.map(row =>
        <li key={row.jobId}><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time>
          {' · '}{row.duplicateGroupCount} duplicate groups ·  {row.decision ? (row.decision === 'RETURNED' ? 'Returned for review' : 'Acknowledged') : !assignedReviewer ? 'Awaiting reviewer decision' :
            <DuplicateReview jobId={row.jobId} onSaved={decision => setRows(current =>
              current?.map(item => item.jobId === row.jobId ? { ...item, decision } : item) ?? null)} />}</li>)}</ul>}
  </section>;
}
