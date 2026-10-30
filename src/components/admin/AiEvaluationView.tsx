import { useEffect, useState } from 'react';
import { api } from '../../services/api';

/**
 * AI evaluation records of the tenant (review-only proposal 20261018140000), read from the governance tables: whether
 * the framework is applied, the suites and who approved them, the latest runs with their coverage per dimension, and
 * whether each agent's current version would pass the activation gate. Read-only: nothing here runs an evaluation,
 * approves a suite or activates an agent.
 */
export interface EvaluationCoverage { dimension: string; required: boolean; cases: number; failed: number; met: boolean }
export interface EvaluationRun { evaluation_id: string; agent_id: string; agent_version: string; model_id: string; model_version: string; prompt_id: string;
  prompt_version: string; started_by: string; status: 'RUNNING' | 'PASS' | 'FAIL'; started_at: string; completed_at: string | null; coverage: EvaluationCoverage[] }
export interface EvaluationSuite { suite_id: string; agent_id: string; name: string; required_dimensions: string[]; minimum_cases_per_dimension: number;
  created_by: string; approved: boolean; approved_by: string | null; covers_all_dimensions: boolean }
export interface EvaluationAgent { agent_id: string; version: string; version_status: string; activation_gate: 'PASSED' | 'NOT_PASSED'; reason: string | null }
export interface EvaluationReport { framework: 'APPLIED' | 'NOT_APPLIED'; activation: 'NOT_PERFORMED_HERE'; dimensions: { dimension: string; description: string }[];
  suites: EvaluationSuite[]; runs: EvaluationRun[]; agents: EvaluationAgent[] }

const REASONS: Record<string, string> = {
  EVALUATION_FRAMEWORK_NOT_APPLIED: 'the evaluation framework is not applied to this database',
  MODEL_OR_PROMPT_NOT_CONFIGURED: 'no model or prompt is configured for this version',
  NO_PASSING_EVALUATION: 'no passing evaluation of this exact version, model and prompt against an approved suite that requires every dimension',
};
export const gateText = (a: EvaluationAgent) => a.activation_gate === 'PASSED'
  ? `${a.agent_id} ${a.version}: the activation gate would pass (activation is a separate, authorized change)`
  : `${a.agent_id} ${a.version}: not passed; ${REASONS[a.reason ?? ''] ?? a.reason ?? 'unknown reason'}`;
export const coverageText = (c: EvaluationCoverage) =>
  `${c.dimension}${c.required ? '' : ' (not required)'}: ${c.cases} case${c.cases === 1 ? '' : 's'}${c.failed ? `, ${c.failed} failed` : ''}${c.met ? '' : ' — not met'}`;

export function AiEvaluationView() {
  const [state, setState] = useState<{ data?: EvaluationReport; error?: string }>({});
  useEffect(() => {
    const controller = new AbortController();
    api.caseAuthority.getAiControlCenter('evaluations', {}, controller.signal)
      .then((data: any) => { if (!controller.signal.aborted) setState({ data: data as EvaluationReport }); })
      .catch((e: any) => { if (!controller.signal.aborted) setState({ error: e?.code === 'AI_CONTROL_CENTER_ROLE_DENIED' ? 'Your role is not authorized to view the AI Control Center.'
        : 'The AI governance service is unavailable. No data is shown rather than stale or estimated values.' }); });
    return () => controller.abort();
  }, []);
  if (state.error) return <p role="alert" className="text-amber-300">{state.error}</p>;
  const d = state.data;
  if (!d) return <p role="status">Loading evaluations…</p>;
  const passed = d.agents.filter(a => a.activation_gate === 'PASSED').length;
  return <div className="space-y-3" data-testid="ai-evaluation-view">
    <p role="note" className="text-slate-300">{d.framework === 'APPLIED'
      ? 'Evaluation records from this tenant\'s governance tables. Outcomes are derived by the database from recorded case results; nothing here runs, approves or activates anything.'
      : 'The evaluation framework (proposal 20261018140000) is not applied to this database, so no evaluation exists and no agent version can pass the activation gate.'}</p>
    <p role="status">{passed} of {d.agents.length} current agent versions would pass the activation gate.</p>
    {d.framework === 'APPLIED' && <>
      <h3 className="font-semibold text-white">Suites</h3>
      {d.suites.length === 0 ? <p>No evaluation suite is recorded for this tenant.</p>
        : <ul aria-label="Evaluation suites">{d.suites.map(s => <li key={s.suite_id}>{s.agent_id} · {s.name} · {s.required_dimensions.length} required dimension{s.required_dimensions.length === 1 ? '' : 's'}
            {s.covers_all_dimensions ? ' (all)' : ' (not all: cannot open the gate)'} · at least {s.minimum_cases_per_dimension} case{s.minimum_cases_per_dimension === 1 ? '' : 's'} each ·
            {s.approved ? ` approved by ${s.approved_by} (author ${s.created_by})` : ` not approved (author ${s.created_by})`}</li>)}</ul>}
      <h3 className="font-semibold text-white">Latest runs</h3>
      {d.runs.length === 0 ? <p>No evaluation run is recorded for this tenant.</p>
        : d.runs.map(r => <article key={r.evaluation_id} aria-label={`Evaluation of ${r.agent_id} ${r.agent_version}`} className="rounded-lg border border-slate-700 p-2">
            <p><strong>{r.agent_id} {r.agent_version}</strong> · model {r.model_id} {r.model_version} · prompt {r.prompt_id} {r.prompt_version} · {r.status}
              {' '}· started by {r.started_by} {new Date(r.started_at).toLocaleString()}</p>
            <ul aria-label={`Coverage of ${r.agent_id} ${r.agent_version}`}>{r.coverage.map(c => <li key={c.dimension}>{coverageText(c)}</li>)}</ul>
          </article>)}
    </>}
    <h3 className="font-semibold text-white">Activation gate by agent</h3>
    <ul aria-label="Activation gate by agent" className="max-h-64 overflow-y-auto">{d.agents.map(a => <li key={a.agent_id}>{gateText(a)}</li>)}</ul>
  </div>;
}
