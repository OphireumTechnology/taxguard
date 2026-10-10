import React from 'react';
/** Shared accountant/reviewer presentation of persisted workpapers, without review mutations. */
export function CaseWorkpaperList({ items }: { items: Array<{ id: string; title: string; status: string; issue: string; analysis: string; conclusion: string; sourceEvidenceIds?: string[]; taxRecordIds?: string[]; references?: string[] }> }) {
  return <>{items.map(w => <details key={w.id}>
    <summary>{w.title} · {w.status}</summary>
    <dl>
      <dt>Issue</dt><dd>{w.issue}</dd>
      <dt>Analysis</dt><dd>{w.analysis}</dd>
      <dt>Conclusion</dt><dd>{w.conclusion}</dd>
      <dt>Source evidence</dt><dd>{w.sourceEvidenceIds?.join(', ') || 'None recorded'}</dd>
      <dt>Tax records</dt><dd>{w.taxRecordIds?.join(', ') || 'None recorded'}</dd>
      <dt>References</dt><dd>{w.references?.join(', ') || 'None recorded'}</dd>
    </dl>
  </details>)}</>;
}
