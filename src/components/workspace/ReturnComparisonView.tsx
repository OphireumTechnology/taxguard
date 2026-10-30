import { useEffect, useRef, useState } from 'react';
import { comparisonLineText, taxEngineMessage, taxEngineService, type ComparisonLine, type ReturnComparison } from '../../services/taxEngineService';

/**
 * Return comparison (Block 75, proposal 20261019200000): what changed in a version since the previous version of the same
 * case, and against the client's prior-year return approved at Stage 09. Lines match only on identical identifiers.
 * Variance flags come only from the practice's approved variance policy; without one nothing is flagged. Read only: the
 * comparison changes, gates and records nothing.
 */
export function ReturnComparisonView({ returnVersionId, name }: { returnVersionId: string; name: string }) {
  const [state, setState] = useState<{ data?: ReturnComparison; message?: string }>({});
  const live = useRef(returnVersionId); live.current = returnVersionId;
  useEffect(() => {
    const key = returnVersionId; setState({});
    taxEngineService.returnComparison(returnVersionId).then(data => { if (live.current === key) setState({ data }); })
      .catch(e => { if (live.current === key) setState({ message: taxEngineMessage(e) }); });
  }, [returnVersionId]);

  if (state.message) return <p role="alert">{state.message}</p>;
  const data = state.data;
  if (!data) return <p role="status">Loading the comparison of {name}…</p>;
  const prior = data.priorYear;
  return <section aria-label={`Comparison of ${name}`} className="tg-return-comparison">
    <p role="status">{data.varianceCheck === 'APPLIED'
      ? `Variance check: practice variance policy version ${data.variancePolicyVersion} applied to the prior-year comparison.`
      : 'Variance check: not configured. The practice has no approved variance policy, so no line is flagged.'}</p>
    <h6>Since the previous version</h6>
    {data.previousVersion
      ? <ComparisonLines label={`Changes in ${name} since version ${data.previousVersion.version}`} lines={data.previousVersion.lines} />
      : <p>This is the first version of {data.templateId} for this case.</p>}
    <h6>Against the prior year ({prior.taxYear})</h6>
    {prior.status === 'NOT_AVAILABLE'
      ? <p>No prior-year return approved at Stage 09 is available to compare.</p>
      : <>
        <p>Compared with {prior.templateId} version {prior.version} of {prior.taxYear}, approved at Stage 09{prior.stale ? ' (its inputs have changed since)' : ''}.
          Lines are matched only when form, schedule, line and field are identical.</p>
        <ComparisonLines label={`Changes in ${name} against ${prior.taxYear}`} lines={prior.lines} />
      </>}
  </section>;
}

export function ComparisonLines({ label, lines }: { label: string; lines: ComparisonLine[] }) {
  const changed = lines.filter(l => l.kind !== 'UNCHANGED');
  const flagged = lines.filter(l => l.variance).length;
  return <>
    <p>{changed.length === 0 ? 'No line changed.' : `${changed.length} of ${lines.length} lines differ${flagged ? `; ${flagged} above the variance threshold` : ''}.`}</p>
    {changed.length > 0 && <ul aria-label={label}>{changed.map(l => <li key={[l.formId, l.formVersion, l.priorFormVersion, l.schedule, l.line, l.field].join('|')}
      data-variance={l.variance ? 'true' : undefined}>{comparisonLineText(l)}</li>)}</ul>}
  </>;
}
