import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { buildWorkforceMatrix } from '../../ai/workforceMatrix';
import type { AgentId } from '../../ai/types';
import {
  aiWorkforceService,
  workforceErrorMessage,
  type ClientWorkforceAdvisory,
  type ClientWorkforceScope,
} from '../../services/aiWorkforceService';

interface CaseAiWorkforcePanelProps {
  tenantId: string;
  clientId: string;
  caseId: string;
  taxYear: number;
  activeStage: number;
}

/**
 * Case-level bounded AI Workforce panel covering Batches 1–5 (A00–A50, excluding reserved A39).
 * All outputs remain strictly advisory with human review required; zero authoritative mutations.
 */
export const CaseAiWorkforcePanel: React.FC<CaseAiWorkforcePanelProps> = ({
  tenantId,
  clientId,
  caseId,
  taxYear,
  activeStage,
}) => {
  const caseAgents = useMemo(
    () =>
      buildWorkforceMatrix().filter(
        r => r.batchId !== 'BATCH_6_ADMIN_GOVERNANCE' && r.agentId !== 'A10',
      ),
    [],
  );

  const [selectedAgent, setSelectedAgent] = useState<AgentId>('A00');
  const [payloadJson, setPayloadJson] = useState('{}');
  const [advisories, setAdvisories] = useState<ClientWorkforceAdvisory[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});

  const scope: ClientWorkforceScope = {
    tenant_id: tenantId,
    client_id: clientId,
    tax_case_id: caseId,
    tax_year: taxYear,
  };

  const load = useCallback(async () => {
    if (!tenantId || !clientId || !caseId) return;
    setLoading(true);
    try {
      const res = await aiWorkforceService.listCaseAdvisories(scope);
      setAdvisories(res.items);
    } catch (error) {
      setNotice({ error: true, text: workforceErrorMessage(error) });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, clientId, caseId, taxYear]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentRow = caseAgents.find(a => a.agentId === selectedAgent);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    let parsedPayload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(payloadJson || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Object required');
      }
      parsedPayload = parsed as Record<string, unknown>;
    } catch {
      setNotice({ error: true, text: 'Parameters must be a valid JSON object (metadata only; no raw documents or secrets).' });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const res = await aiWorkforceService.executeAgent(selectedAgent, {
        request_id: `wf-${selectedAgent}-${Date.now()}`,
        scope,
        workflow_stage: activeStage,
        payload: parsedPayload,
      });
      setNotice({
        error: false,
        text: `${res.advisory.agent_id} (${res.advisory.agent_name}) advisory recorded. Human review required.`,
      });
      await load();
    } catch (error) {
      setNotice({ error: true, text: workforceErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleDecide = async (advisory: ClientWorkforceAdvisory, decision: string) => {
    if (busy) return;
    const rationale = (decisionNote[advisory.advisory_id] ?? '').trim();
    if (rationale.length < 10) {
      setNotice({ error: true, text: 'Enter a human review rationale of at least 10 characters.' });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await aiWorkforceService.recordDecision(advisory.advisory_id, {
        request_id: `wf-dec-${Date.now()}`,
        agent_id: advisory.agent_id,
        scope,
        expected_evidence_fingerprint: advisory.evidence_fingerprint,
        decision,
        rationale,
      });
      setNotice({ error: false, text: `Recorded human decision (${decision}) for ${advisory.agent_id}.` });
      setDecisionNote(prev => ({ ...prev, [advisory.advisory_id]: '' }));
      await load();
    } catch (error) {
      setNotice({ error: true, text: workforceErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="case-ai-workforce-heading"
      data-testid="case-ai-workforce-panel"
      className="mt-4 rounded-xl border border-slate-700/80 bg-[#071A2E]/90 p-4 text-xs text-slate-200 space-y-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 id="case-ai-workforce-heading" className="text-sm font-bold text-[#D4A843]">
            Case AI Workforce Advisories (Batches 1–5 · A00–A50)
          </h4>
          <p className="text-slate-300">
            Bounded deterministic domain advisories scoped to this tenant, client, case, and tax year ({taxYear}). Every output requires independent human review.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-slate-600 px-2.5 py-1 text-slate-200 hover:border-[#D4A843]"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {notice && (
        <p
          role={notice.error ? 'alert' : 'status'}
          className={`rounded-lg border p-2 ${
            notice.error
              ? 'border-red-500/40 bg-red-950/30 text-red-200'
              : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
          }`}
        >
          {notice.text}
        </p>
      )}

      <form onSubmit={handleRun} className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-slate-300 font-medium">Select application agent</span>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value as AgentId)}
              className="w-full rounded-lg border border-slate-600 bg-[#06182B] px-2.5 py-1.5 text-white"
            >
              {caseAgents.map(row => (
                <option key={row.agentId} value={row.agentId} disabled={!row.locallyImplemented}>
                  {row.agentId} — {row.overviewName} ({row.workflowStages}){!row.locallyImplemented ? ' [RESERVED]' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-slate-700/80 bg-[#06182B]/70 p-2 text-slate-300">
            <p className="font-semibold text-white">{currentRow?.overviewName}</p>
            <p className="mt-0.5">{currentRow?.humanReviewerAndPermittedDecisions}</p>
            <p className="mt-0.5 text-slate-400">{currentRow?.openDependencyOrOwnerDecision}</p>
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-slate-300 font-medium">Bounded metadata parameters (JSON, no raw documents/secrets)</span>
          <textarea
            rows={2}
            value={payloadJson}
            onChange={e => setPayloadJson(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-[#06182B] p-2 font-mono text-xs text-white"
          />
        </label>

        <button
          type="submit"
          disabled={busy || !currentRow?.locallyImplemented}
          className="rounded-lg bg-[#D4A843] px-3 py-1.5 font-bold text-[#06182B] disabled:opacity-50"
        >
          {busy ? 'Executing Bounded Advisory…' : `Run ${selectedAgent} Advisory`}
        </button>
      </form>

      <div className="space-y-2">
        {advisories.length === 0 && !loading && (
          <p className="text-slate-400">No case workforce advisories recorded yet.</p>
        )}
        {advisories.map(adv => (
          <article key={adv.advisory_id} className="rounded-lg border border-slate-700 bg-[#0A223D]/70 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono font-bold text-[#D4A843]">
                {adv.agent_id} · {adv.agent_name}
              </span>
              <span className="text-slate-400">
                {adv.status} · Reviewer: {adv.required_reviewer_role}
              </span>
            </div>
            <p className="text-white">{adv.summary}</p>
            {adv.authority_citations.length > 0 && (
              <p className="text-slate-300">
                <strong>Citations:</strong> {adv.authority_citations.join(' · ')}
              </p>
            )}
            {adv.permitted_decisions.length > 0 && adv.agent_id !== 'A10' && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="text"
                  value={decisionNote[adv.advisory_id] ?? ''}
                  onChange={e => setDecisionNote(prev => ({ ...prev, [adv.advisory_id]: e.target.value }))}
                  placeholder="Reviewer rationale (min 10 chars)"
                  className="flex-1 min-w-[200px] rounded border border-slate-600 bg-[#06182B] px-2 py-1 text-white"
                />
                {adv.permitted_decisions.map(dec => (
                  <button
                    key={dec}
                    type="button"
                    disabled={busy || (decisionNote[adv.advisory_id] ?? '').trim().length < 10}
                    onClick={() => void handleDecide(adv, dec)}
                    className="rounded border border-slate-500 px-2 py-1 text-slate-200 hover:border-[#D4A843] disabled:opacity-40"
                  >
                    {dec}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
};
