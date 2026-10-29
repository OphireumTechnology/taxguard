import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { AiCommissioningView } from './AiCommissioningView';
import { AiArchitectureOverviewView } from './AiArchitectureOverviewView';

/**
 * AI Control Center — read-only registry, execution history, governance decisions and
 * security events. All data comes from server projections; no metric is computed or invented
 * in the browser beyond counting the rows actually returned.
 */
export type ControlCenterView = 'registry' | 'runs' | 'decisions' | 'security-events' | 'usage';

const FILTERS: Record<ControlCenterView, { key: string; label: string; options: string[] }[]> = {
  registry: [],
  usage: [{ key: 'window', label: 'Window', options: ['24h', '7d', '30d'] }],
  runs: [{ key: 'status', label: 'Status', options: ['QUEUED', 'RUNNING', 'PROPOSED', 'VERIFYING', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'FAILED', 'CANCELLED'] }],
  decisions: [{ key: 'outcome', label: 'Outcome', options: ['ADVISORY_ALLOWED', 'REVIEW_REQUIRED', 'DENIED'] }],
  'security-events': [
    { key: 'event_type', label: 'Event type', options: ['AUTHORIZATION_DENIAL', 'PERMISSION_VIOLATION', 'CROSS_CLIENT_ATTEMPT', 'CROSS_TENANT_ATTEMPT', 'TOOL_DENIAL', 'POLICY_VIOLATION', 'PROMPT_INJECTION', 'KILL_SWITCH', 'MODEL_VIOLATION', 'HUMAN_APPROVAL_VIOLATION'] },
    { key: 'severity', label: 'Severity', options: ['LOW', 'MATERIAL', 'HIGH', 'CRITICAL'] },
  ],
};

const COLUMNS: Record<ControlCenterView, [string, string][]> = {
  registry: [['agent_id', 'Agent'], ['agent_name', 'Name'], ['category', 'Category'], ['status', 'Registry status'], ['risk_class', 'Risk class'], ['stopped', 'Emergency stop'], ['stop_reason', 'Stopped by']],
  usage: [['agent_id', 'Agent'], ['runs', 'Runs'], ['tokens', 'Tokens'], ['estimated_cost', 'Recorded est. cost'], ['awaiting_review', 'Awaiting human review'], ['failed', 'Failed'], ['rejected', 'Rejected'], ['approved', 'Approved']],
  runs: [['created_at', 'Created'], ['agent_id', 'Agent'], ['status', 'Status'], ['model_id', 'Model'], ['prompt_version', 'Prompt ver.'], ['tax_case_id', 'Case'], ['tax_year', 'Year'], ['risk_level', 'Risk'], ['confidence', 'Confidence'], ['token_usage', 'Tokens'], ['estimated_cost', 'Est. cost']],
  decisions: [['created_at', 'Time'], ['agent_id', 'Agent'], ['outcome', 'Outcome'], ['reason_code', 'Reason'], ['action_state', 'Action state'], ['actor_uid', 'Actor'], ['tax_case_id', 'Case']],
  'security-events': [['created_at', 'Time'], ['event_type', 'Event'], ['severity', 'Severity'], ['agent_id', 'Agent'], ['actor_uid', 'Actor'], ['details', 'Details']],
};

const DENIED: Record<string, string> = {
  AI_CONTROL_CENTER_ROLE_DENIED: 'Your role is not authorized to view the AI Control Center.',
  AI_CONTROL_CENTER_INVALID_QUERY: 'The selected filters were rejected.',
  AI_AUTH_REQUIRED: 'Your session could not be verified. Sign in again.',
};
export const controlCenterErrorMessage = (error: any): string => DENIED[error?.code] ?? 'The AI governance service is unavailable. No data is shown rather than stale or estimated values.';

/** Only well-formed MODEL / TOOL / WORKFLOW entries are displayed; anything else is dropped. */
export function parseScopedStops(value: unknown): { scope: string; target: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s: any) => s && ['MODEL', 'TOOL', 'WORKFLOW'].includes(s.scope) && typeof s.target === 'string' && s.target.length <= 300)
    .map((s: any) => ({ scope: s.scope, target: s.target }));
}

export function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'stopped') return value === true ? 'STOPPED' : 'Not stopped';
  if (key === 'details' && typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(', ') || '—';
  if (typeof value === 'object') return '—';
  return String(value);
}

type State = { status: 'loading' | 'ready' | 'error'; rows: Record<string, unknown>[]; next: string | null; globalStop?: boolean; scopedStops?: { scope: string; target: string }[]; totals?: Record<string, number>; message?: string; appending?: boolean };

type PanelView = ControlCenterView | 'commissioning' | 'architecture';
// Views rendered from build evidence in the browser; they call no governance endpoint.
const isLocalView = (view: PanelView): view is 'commissioning' | 'architecture' => view === 'commissioning' || view === 'architecture';

export const AiControlCenterPanel: React.FC<{ initialView?: PanelView }> = ({ initialView = 'registry' }) => {
  const [view, setView] = useState<PanelView>(initialView);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<State>({ status: 'loading', rows: [], next: null });

  const load = (cursor: string | null, signal?: AbortSignal) => {
    if (isLocalView(view)) return Promise.resolve({ rows: [], next: null as string | null });
    const query = { ...filters, ...(cursor ? { cursor } : {}) };
    return api.caseAuthority.getAiControlCenter(view, view === 'registry' ? {} : view === 'usage' ? filters : query, signal).then((result: any) => {
      const rows = view === 'registry' ? result.agents : view === 'usage' ? result.by_agent : result.items;
      if (!Array.isArray(rows)) throw new Error('Invalid control-center response');
      return { rows: rows as Record<string, unknown>[], next: typeof result.next_cursor === 'string' ? result.next_cursor : null, globalStop: result.global_stop === true, scopedStops: parseScopedStops(result.scoped_stops), totals: view === 'usage' && result.totals && typeof result.totals === 'object' ? result.totals as Record<string, number> : undefined };
    });
  };

  useEffect(() => {
    // The commissioning and architecture views are build evidence rendered locally; they call no governance endpoint.
    if (isLocalView(view)) { setState({ status: 'ready', rows: [], next: null }); return; }
    const controller = new AbortController();
    setState({ status: 'loading', rows: [], next: null });
    load(null, controller.signal)
      .then(page => { if (!controller.signal.aborted) setState({ status: 'ready', ...page }); })
      .catch(error => { if (!controller.signal.aborted) setState({ status: 'error', rows: [], next: null, message: controlCenterErrorMessage(error) }); });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, JSON.stringify(filters), refresh]);

  const loadMore = () => {
    if (!state.next) return;
    setState(current => ({ ...current, appending: true }));
    load(state.next)
      .then(page => setState(current => ({ status: 'ready', rows: [...current.rows, ...page.rows], next: page.next, globalStop: current.globalStop, scopedStops: current.scopedStops })))
      .catch(error => setState(current => ({ ...current, appending: false, message: controlCenterErrorMessage(error) })));
  };

  const tabs: [PanelView, string][] = [['registry', 'Agent registry'], ['commissioning', 'Commissioning readiness'], ['runs', 'Execution history'], ['decisions', 'Governance decisions'], ['security-events', 'Security events'], ['usage', 'Usage & review queue'], ['architecture', 'Architecture overview']];
  const select = (id: PanelView) => { setView(id); setFilters({}); };
  const onTabKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0];
    select(next);
    document.getElementById('ai-cc-tab-' + next)?.focus();
  };
  return (
    <section aria-labelledby="ai-control-center-heading" className="space-y-4 text-xs text-slate-200">
      <header className="flex items-center justify-between">
        <h2 id="ai-control-center-heading" className="text-base font-bold text-white">AI Control Center</h2>
        <button type="button" onClick={() => setRefresh(value => value + 1)} className="flex items-center gap-1 text-slate-300"><RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />Refresh</button>
      </header>
      <div role="tablist" aria-label="Control center views" className="flex flex-wrap gap-2">
        {tabs.map(([id, label], index) => (
          <button key={id} id={'ai-cc-tab-' + id} type="button" role="tab" aria-selected={view === id} aria-controls="ai-cc-panel" tabIndex={view === id ? 0 : -1}
            onKeyDown={e => onTabKey(e, index)} onClick={() => select(id)}
            className={`px-3 py-1.5 rounded-lg ${view === id ? 'bg-[#D4A843] text-[#06182B] font-bold' : 'bg-[#0D2745] text-slate-300'}`}>{label}</button>
        ))}
      </div>
      <div id="ai-cc-panel" role="tabpanel" aria-labelledby={'ai-cc-tab-' + view} className="space-y-4">
      {view === 'commissioning' && <AiCommissioningView />}
      {view === 'architecture' && <AiArchitectureOverviewView />}
      {!isLocalView(view) && FILTERS[view].length > 0 && (
        <div className="flex flex-wrap gap-3">
          {FILTERS[view].map(filter => (
            <label key={filter.key} className="flex items-center gap-1.5">{filter.label}
              <select value={filters[filter.key] ?? ''} onChange={event => setFilters(current => ({ ...current, [filter.key]: event.target.value }))} className="bg-[#071A2E] border border-slate-600 rounded px-2 py-1">
                <option value="">All</option>
                {filter.options.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      {view === 'registry' && state.status === 'ready' && (state.scopedStops?.length ?? 0) > 0 && (
        <div role="alert" className="text-amber-200">
          <p className="font-semibold">Scoped emergency stops in force (they block any request using this model, tool or stage):</p>
          <ul className="list-disc pl-5">{state.scopedStops!.map(stop => <li key={`${stop.scope}:${stop.target}`}>{stop.scope}: {stop.target}</li>)}</ul>
        </div>
      )}
      {view === 'registry' && state.status === 'ready' && state.globalStop &&<p role="alert" className="text-red-300 font-semibold">A GLOBAL emergency stop is engaged for this tenant. All governed AI work is refused.</p>}
      {state.status === 'loading' && <p role="status">Loading…</p>}
      {state.status === 'error' && <p role="alert" className="text-amber-300">{state.message}</p>}
      {!isLocalView(view) && state.status === 'ready' && state.rows.length === 0 && <p>No records match this view for your tenant.</p>}
      {!isLocalView(view) && state.status === 'ready' && state.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{tabs.find(([id]) => id === view)![1]}</caption>
            <thead><tr className="text-slate-400">{COLUMNS[view as ControlCenterView].map(([, label]) => <th key={label} scope="col" className="pr-3">{label}</th>)}</tr></thead>
            <tbody>{state.rows.map((row, index) => (
              <tr key={String(row.agent_id ?? row.run_id ?? row.decision_id ?? row.event_id ?? index)} className="border-t border-slate-800">
                {COLUMNS[view as ControlCenterView].map(([key]) => <td key={key} className="pr-3 py-1">{formatCell(key, row[key])}</td>)}
              </tr>
            ))}</tbody>
          </table>
          <p className="text-slate-400 mt-2">Showing {state.rows.length} record{state.rows.length === 1 ? '' : 's'}{state.next ? ' (more available)' : ''}.</p>
          {state.next && <button type="button" onClick={loadMore} disabled={state.appending} className="mt-2 px-3 py-1.5 rounded-lg border border-slate-500 disabled:opacity-50">{state.appending ? 'Loading…' : 'Load more'}</button>}
          {state.message && state.status === 'ready' && <p role="alert" className="text-amber-300">{state.message}</p>}
        </div>
      )}
      </div>
    </section>
  );
};
