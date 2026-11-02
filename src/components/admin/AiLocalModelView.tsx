import { useEffect, useState } from 'react';
import { api } from '../../services/api';

/**
 * Administrator diagnostics for the local model: the runtime's own report and the model's true provenance and licences,
 * from the server (governance roles only). Read-only. Nothing is shown when the server does not confirm it.
 */
interface Party { name: string; identifier?: string; creator: string; licence: string }
interface LocalModel { name: string; sizeBytes: number | null; vramBytes?: number | null; processor?: string }
export interface LocalModelReport {
  branding: { assistant: string; model: string; operator: string; privateNetwork: string };
  provenance: { modelId: string; baseModel: Party; inferenceEngine: Party; operatorRole: string; notices: string };
  runtime: { status: 'UNAVAILABLE' | 'AVAILABLE'; endpoint: string; version?: string | null; models?: LocalModel[]; loaded?: LocalModel[] };
}
const gb = (bytes: number | null | undefined) => typeof bytes === 'number' ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : 'not reported';

export function LocalModelReportView({ report }: { report: LocalModelReport }) {
  const { branding, provenance, runtime } = report;
  const installed = runtime.models?.some(m => m.name === provenance.modelId) ?? false;
  return <div className="space-y-4">
    <section aria-labelledby="ai-local-runtime" className="space-y-1">
      <h3 id="ai-local-runtime" className="font-bold text-white">Runtime</h3>
      <p role="status">{runtime.status === 'AVAILABLE' ? `Available: engine version ${runtime.version ?? 'not reported'}, at ${runtime.endpoint}.` : `Not available at ${runtime.endpoint}. Nothing is sent to any other provider.`}</p>
      {runtime.status === 'AVAILABLE' && <>
        <p>{provenance.modelId}: {installed ? 'installed' : 'not installed'}.</p>
        <p>{runtime.loaded?.length ? runtime.loaded.map(m => `Loaded: ${m.name}, ${gb(m.sizeBytes)}, on ${m.processor}`).join('; ') : 'No model is loaded in memory.'}</p>
      </>}
    </section>
    <section aria-labelledby="ai-local-provenance" className="space-y-1">
      <h3 id="ai-local-provenance" className="font-bold text-white">Provenance and licences</h3>
      <p>{branding.model} ({provenance.modelId}), shown to users as {branding.assistant}, operated by {branding.operator} on the {branding.privateNetwork}.</p>
      <p>{provenance.operatorRole}</p>
      <ul className="list-disc pl-5">
        <li>Model weights: {provenance.baseModel.name} ({provenance.baseModel.identifier}) by {provenance.baseModel.creator}, {provenance.baseModel.licence}.</li>
        <li>Inference engine: {provenance.inferenceEngine.name} by {provenance.inferenceEngine.creator}, {provenance.inferenceEngine.licence}.</li>
      </ul>
      <p>Full notices: {provenance.notices}</p>
    </section>
  </div>;
}

export function AiLocalModelView() {
  const [state, setState] = useState<{ report?: LocalModelReport; failed?: boolean }>({});
  useEffect(() => {
    const abort = new AbortController();
    api.caseAuthority.getAiControlCenter('local-model', {}, abort.signal)
      .then(report => setState({ report: report as unknown as LocalModelReport }))
      .catch(() => { if (!abort.signal.aborted) setState({ failed: true }); });
    return () => abort.abort();
  }, []);
  if (state.failed) return <p role="alert">Local model details could not be loaded. Nothing is shown in their place.</p>;
  if (!state.report) return <p role="status">Loading local model details…</p>;
  return <LocalModelReportView report={state.report} />;
}
