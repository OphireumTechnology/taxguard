import { useEffect, useRef, useState } from 'react';
import { evidenceText, taxEngineMessage, taxEngineService, type RunLineage } from '../../services/taxEngineService';

/**
 * The evidence behind each input of one calculation run (proposal 20261018190000). Approved runs show the lineage
 * recorded at approval; other runs show what each citation resolves to now. Read-only; mounted per run.
 */
export function RunEvidence({ runId, refreshKey }: { runId: string; refreshKey: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; lineage?: RunLineage; message?: string }>({ status: 'idle' });
  // Only the latest request for this run and refresh may update the view.
  const current = useRef(0);
  useEffect(() => {
    if (!open) return;
    const key = ++current.current;
    setState({ status: 'loading' });
    taxEngineService.runLineage(runId).then(lineage => { if (current.current === key) setState({ status: 'ready', lineage }); })
      .catch(e => { if (current.current === key) setState({ status: 'error', message: taxEngineMessage(e) }); });
    return () => { current.current++; };
  }, [open, runId, refreshKey]);
  const label = `evidence for run ${runId.slice(0, 8)}`;
  return <div>
    <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show'} {label}</button>
    {open && <section aria-label={'Evidence for run ' + runId.slice(0, 8)}>
      {state.status === 'loading' && <p role="status">Loading evidence…</p>}
      {state.status === 'error' && <p role="alert">{state.message}</p>}
      {state.status === 'ready' && state.lineage && <>
        <p role="status">{state.lineage.recorded ? 'Evidence recorded when the run was approved.'
          : state.lineage.complete ? 'Every input cites resolved evidence. It is recorded when the run is approved.'
          : 'Some cited evidence does not resolve. The run cannot be approved until every input cites a reviewed document or a decided extracted value.'}</p>
        <ul>{state.lineage.citations.map(x => <li key={x.factPath + '|' + x.ref}>
          {x.factPath} = {x.value ?? '?'} · {x.ref} · {evidenceText(x.resolution)}
        </li>)}</ul>
      </>}
    </section>}
  </div>;
}
