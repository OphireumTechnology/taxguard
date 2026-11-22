import React, { useEffect, useState } from 'react';
import { jobService } from '../../services/jobService';

export function CaseDuplicateAdvisories({ caseId }: { caseId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof jobService.caseAdvisories>> | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    jobService.caseAdvisories(caseId).then(data => { if (current) setRows(data); })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [caseId]);
  return <section><h3>Duplicate document checks</h3>
    {failed ? <p role="status">Case advisories are unavailable.</p> :
      rows === null ? <p role="status">Loading checks…</p> :
      rows.length === 0 ? <p>No completed checks for this case.</p> :
      <ul aria-label="Latest 20 completed checks">{rows.map(row =>
        <li key={row.jobId}><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time>
          {' · '}{row.duplicateGroupCount} duplicate groups · Human review required</li>)}</ul>}
  </section>;
}
