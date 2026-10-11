import React, { useEffect, useState } from 'react';
import { AlertTriangle, Power, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { CANONICAL_AGENTS } from '../../ai/registry';

/**
 * AI Control Center — Emergency Kill Switch.
 * Engages a server-enforced stop (GLOBAL or one agent). Reports success only on a
 * confirmed server response. Lifting a stop is intentionally not offered here.
 */
export interface KillSwitchRow { switch_id: string; scope: string; target: string; enabled: boolean; reason: string; activated_by: string; activated_at: string }

const MESSAGES: Record<string, string> = {
  AI_KILL_SWITCH_ROLE_DENIED: 'Your role is not authorized to engage or view AI emergency stops.',
  AI_KILL_SWITCH_REASON_INVALID: 'Enter a reason between 10 and 500 characters.',
  AI_KILL_SWITCH_UNKNOWN_AGENT: 'Select a registered agent.',
  AI_KILL_SWITCH_INVALID_REQUEST: 'The stop request was rejected as invalid.',
  AI_AUTH_REQUIRED: 'Your session could not be verified. Sign in again.',
};
export const killSwitchFailureMessage = (error: any): string => MESSAGES[error?.code] ??
  'The AI governance service is unavailable. The emergency stop was NOT confirmed — escalate through your incident procedure.';

export function parseKillSwitchRows(value: unknown): KillSwitchRow[] {
  if (!Array.isArray(value)) throw new Error('Invalid kill-switch response');
  return value.map((row: any) => {
    if (!row || typeof row.switch_id !== 'string' || !['GLOBAL', 'AGENT', 'MODEL', 'TOOL', 'WORKFLOW'].includes(row.scope) ||
      typeof row.target !== 'string' || typeof row.enabled !== 'boolean' || typeof row.activated_by !== 'string' || typeof row.activated_at !== 'string')
      throw new Error('Invalid kill-switch record');
    return { switch_id: row.switch_id, scope: row.scope, target: row.target, enabled: row.enabled, reason: String(row.reason ?? ''), activated_by: row.activated_by, activated_at: row.activated_at };
  });
}

/** Success is reported only for an explicit, well-formed server confirmation. */
export function interpretKillSwitchActivation(result: any): string {
  if (!result || result.enabled !== true || typeof result.switch_id !== 'string' || typeof result.target !== 'string') throw new Error('Unconfirmed response');
  return result.already_active
    ? `A stop for ${result.target} was already engaged; it remains in force.`
    : `Emergency stop engaged for ${result.target}. Governed AI assessments in scope are now refused by the server.`;
}

export const AiEmergencyStopPanel: React.FC = () => {
  const [list, setList] = useState<{ status: 'loading' | 'ready' | 'error'; rows: KillSwitchRow[]; message?: string }>({ status: 'loading', rows: [] });
  const [refresh, setRefresh] = useState(0);
  const [scope, setScope] = useState<'GLOBAL' | 'AGENT'>('GLOBAL');
  const [agentId, setAgentId] = useState('A00');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submit, setSubmit] = useState<{ status: 'idle' | 'submitting' | 'engaged' | 'error'; message?: string }>({ status: 'idle' });

  useEffect(() => {
    const controller = new AbortController();
    setList({ status: 'loading', rows: [] });
    api.caseAuthority.listAiKillSwitches(controller.signal)
      .then(result => { if (!controller.signal.aborted) setList({ status: 'ready', rows: parseKillSwitchRows(result.kill_switches) }); })
      .catch(error => { if (!controller.signal.aborted) setList({ status: 'error', rows: [], message: killSwitchFailureMessage(error) }); });
    return () => controller.abort();
  }, [refresh]);

  const reasonValid = reason.trim().length >= 10 && reason.trim().length <= 500;
  const engage = async () => {
    setSubmit({ status: 'submitting' });
    try {
      const payload = scope === 'GLOBAL' ? { scope, reason: reason.trim() } as const : { scope, agent_id: agentId, reason: reason.trim() } as const;
      setSubmit({ status: 'engaged', message: interpretKillSwitchActivation(await api.caseAuthority.activateAiKillSwitch(payload)) });
      setConfirming(false); setReason(''); setRefresh(value => value + 1);
    } catch (error) {
      setSubmit({ status: 'error', message: killSwitchFailureMessage(error) });
      setConfirming(false);
    }
  };

  return (
    <section aria-labelledby="ai-emergency-stop-heading" className="space-y-5 text-xs text-slate-200">
      <header className="space-y-1">
        <h2 id="ai-emergency-stop-heading" className="text-base font-bold text-white flex items-center gap-2"><Power className="w-4 h-4 text-red-400" />AI Emergency Stop</h2>
        <p className="text-slate-400">Engaging a stop immediately blocks governed AI work for your tenant, enforced on the server. Lifting a stop is not available in this workspace; it requires an approved governance procedure.</p>
      </header>

      <form className="p-4 rounded-xl border border-red-500/40 bg-red-950/30 space-y-3" onSubmit={event => { event.preventDefault(); if (reasonValid) setConfirming(true); }}>
        <fieldset className="flex gap-4">
          <legend className="sr-only">Stop scope</legend>
          <label className="flex items-center gap-1.5"><input type="radio" name="ai-stop-scope" checked={scope === 'GLOBAL'} onChange={() => { setScope('GLOBAL'); setConfirming(false); }} />All AI agents</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="ai-stop-scope" checked={scope === 'AGENT'} onChange={() => { setScope('AGENT'); setConfirming(false); }} />One agent</label>
        </fieldset>
        {scope === 'AGENT' && (
          <div>
            <label htmlFor="ai-stop-agent" className="block font-semibold mb-1">Agent</label>
            <select id="ai-stop-agent" value={agentId} onChange={event => { setAgentId(event.target.value); setConfirming(false); }} className="w-full bg-[#071A2E] border border-slate-600 rounded-lg px-2 py-2">
              {CANONICAL_AGENTS.map(agent => <option key={agent.agent_id} value={agent.agent_id}>{agent.agent_id} — {agent.agent_name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="ai-stop-reason" className="block font-semibold mb-1">Reason (recorded, 10–500 characters)</label>
          <textarea id="ai-stop-reason" value={reason} maxLength={500} onChange={event => { setReason(event.target.value); setConfirming(false); }} className="w-full bg-[#071A2E] border border-slate-600 rounded-lg px-2 py-2" rows={3} />
        </div>
        {!confirming ? (
          <button type="submit" disabled={!reasonValid || submit.status === 'submitting'} className="px-4 py-2 rounded-lg font-bold bg-red-600 text-white disabled:opacity-50">Engage emergency stop…</button>
        ) : (
          <div role="alertdialog" aria-labelledby="ai-stop-confirm" className="space-y-2">
            <p id="ai-stop-confirm" className="flex items-center gap-2 font-semibold text-red-200"><AlertTriangle className="w-4 h-4" />Stop {scope === 'GLOBAL' ? 'ALL AI agents' : agentId} for this tenant? This cannot be lifted from this workspace.</p>
            <div className="flex gap-2">
              <button type="button" onClick={engage} disabled={submit.status === 'submitting'} className="px-4 py-2 rounded-lg font-bold bg-red-600 text-white disabled:opacity-50">{submit.status === 'submitting' ? 'Engaging…' : 'Confirm emergency stop'}</button>
              <button type="button" onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg border border-slate-500">Cancel</button>
            </div>
          </div>
        )}
        {submit.status === 'engaged' && <p role="status" className="text-emerald-300">{submit.message}</p>}
        {submit.status === 'error' && <p role="alert" className="text-red-300">{submit.message}</p>}
      </form>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white">Recorded stops</h3>
          <button type="button" onClick={() => setRefresh(value => value + 1)} className="flex items-center gap-1 text-slate-300"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>
        </div>
        {list.status === 'loading' && <p role="status">Loading recorded stops…</p>}
        {list.status === 'error' && <p role="alert" className="text-amber-300">{list.message}</p>}
        {list.status === 'ready' && list.rows.length === 0 && <p>No emergency stops are recorded for this tenant.</p>}
        {list.status === 'ready' && list.rows.length > 0 && (
          <table className="w-full text-left">
            <thead><tr className="text-slate-400"><th scope="col">Scope</th><th scope="col">Target</th><th scope="col">State</th><th scope="col">Engaged by</th><th scope="col">Engaged at</th></tr></thead>
            <tbody>{list.rows.map(row => (
              <tr key={row.switch_id}><td>{row.scope}</td><td>{row.target}</td><td>{row.enabled ? 'ENGAGED' : 'Lifted'}</td><td>{row.activated_by}</td><td>{row.activated_at}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </section>
  );
};
