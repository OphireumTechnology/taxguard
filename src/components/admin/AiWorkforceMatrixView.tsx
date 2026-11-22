import React, { useMemo, useState } from 'react';
import {
  buildWorkforceMatrix,
  workforceMatrixTotals,
  type MatrixBatchId,
} from '../../ai/workforceMatrix';
import type { AgentId } from '../../ai/types';
import { aiWorkforceService, workforceErrorMessage, type ClientWorkforceAdvisory } from '../../services/aiWorkforceService';
import { useApp } from '../../context/AppContext';

const BATCH_LABELS: ReadonlyArray<readonly [MatrixBatchId | 'ALL', string]> = [
  ['ALL', 'All 61 Agents (A00–A60)'],
  ['BATCH_1_FOUNDATION_COLLECTION', 'Batch 1 · Foundation & Collection (A00–A11)'],
  ['BATCH_2_ACCOUNTING', 'Batch 2 · Accounting (A12–A16)'],
  ['BATCH_3_TAX_PREPARATION', 'Batch 3 · Tax Preparation (A17–A31)'],
  ['BATCH_4_REVIEW_RELEASE', 'Batch 4 · Review & Release (A32–A42)'],
  ['BATCH_5_PRACTICE_OPERATIONS', 'Batch 5 · Practice Operations (A43–A50)'],
  ['BATCH_6_ADMIN_GOVERNANCE', 'Batch 6 · Admin & Governance (A51–A60)'],
];

/**
 * Single repository-tracked 61-row AI Workforce Matrix (A00–A60) plus bounded Batch 6
 * Administration & Governance advisory runner (A51–A60) inside the AI Control Center.
 */
export const AiWorkforceMatrixView: React.FC = () => {
  const { currentUser } = useApp();
  const rows = useMemo(() => buildWorkforceMatrix(), []);
  const totals = useMemo(() => workforceMatrixTotals(rows), [rows]);

  const [batchFilter, setBatchFilter] = useState<MatrixBatchId | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [adminAgent, setAdminAgent] = useState<AgentId>('A56');
  const [adminResult, setAdminResult] = useState<ClientWorkforceAdvisory | null>(null);
  const [adminNotice, setAdminNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (batchFilter !== 'ALL' && r.batchId !== batchFilter) return false;
      if (!q) return true;
      return (
        r.agentId.toLowerCase().includes(q) ||
        r.overviewName.toLowerCase().includes(q) ||
        r.plannedTaskAndSurface.toLowerCase().includes(q) ||
        r.openDependencyOrOwnerDecision.toLowerCase().includes(q)
      );
    });
  }, [rows, batchFilter, search]);

  const batch6Agents = useMemo(() => rows.filter(r => r.batchId === 'BATCH_6_ADMIN_GOVERNANCE'), [rows]);

  const handleRunAdminAgent = async () => {
    if (busy) return;
    setBusy(true);
    setAdminNotice(null);
    try {
      const tenantId = (currentUser as { tenantId?: string } | null)?.tenantId || 'tenant_default';
      const res = await aiWorkforceService.executeAgent(adminAgent, {
        request_id: `admin-${adminAgent}-${Date.now()}`,
        scope: {
          tenant_id: tenantId,
          client_id: 'TENANT_ADMIN_SCOPE',
          tax_case_id: 'TENANT_GOVERNANCE_AUDIT',
          tax_year: new Date().getUTCFullYear(),
        },
        workflow_stage: 1,
        payload: {},
      });
      setAdminResult(res.advisory);
      setAdminNotice({ error: false, text: `${adminAgent} governance advisory generated (advisory only).` });
    } catch (error) {
      setAdminNotice({ error: true, text: workforceErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 text-xs text-slate-200" data-testid="ai-workforce-matrix-view">
      <p role="note" className="text-slate-300">
        Single repository-tracked 61-agent matrix (A00–A60) derived from <code className="text-[#D4A843]">src/ai/workforceMatrix.ts</code>. Lifecycle states are strictly separated: local implementation and website integration never constitute hosted staging acceptance or production commissioning.
      </p>

      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" aria-label="Workforce lifecycle totals">
        {[
          ['Total rows tracked', `${totals.totalRows} / 61`, 'text-white'],
          ['Designed', `${totals.designed} / 61`, 'text-emerald-300'],
          ['Locally implemented', `${totals.locallyImplemented} / 61`, 'text-emerald-300'],
          ['Reserved (OV-01 A39)', `${totals.reservedFailClosed} / 61`, 'text-amber-300'],
          ['Website-integrated', `${totals.websiteIntegrated} / 61`, 'text-sky-300'],
          ['Staging / Production', `${totals.stagingAccepted} / ${totals.productionCommissioned}`, 'text-slate-300'],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-lg border border-slate-700 bg-[#071A2E] p-2.5">
            <dt className="text-slate-400">{label}</dt>
            <dd className={`mt-0.5 text-base font-bold ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="admin-gov-runner-heading" className="rounded-lg border border-slate-700 bg-[#071A2E]/80 p-3 space-y-2">
        <h3 id="admin-gov-runner-heading" className="font-semibold text-[#D4A843]">
          Batch 6 · Administration & Governance Bounded Runner (A51–A60)
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Select governance agent"
            value={adminAgent}
            onChange={e => setAdminAgent(e.target.value as AgentId)}
            className="rounded-lg border border-slate-600 bg-[#06182B] px-2.5 py-1.5 text-white"
          >
            {batch6Agents.map(a => (
              <option key={a.agentId} value={a.agentId}>
                {a.agentId} — {a.overviewName}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleRunAdminAgent()}
            className="rounded-lg bg-[#D4A843] px-3 py-1.5 font-bold text-[#06182B] disabled:opacity-50"
          >
            {busy ? 'Running…' : `Run ${adminAgent} Governance Check`}
          </button>
        </div>
        {adminNotice && (
          <p role={adminNotice.error ? 'alert' : 'status'} className={adminNotice.error ? 'text-amber-300' : 'text-emerald-300'}>
            {adminNotice.text}
          </p>
        )}
        {adminResult && (
          <div className="rounded border border-slate-700 bg-[#0A223D] p-2.5 space-y-1">
            <p className="font-semibold text-white">{adminResult.agent_id} · {adminResult.status}</p>
            <p>{adminResult.summary}</p>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5">
          <span>Batch</span>
          <select
            value={batchFilter}
            onChange={e => setBatchFilter(e.target.value as MatrixBatchId | 'ALL')}
            className="rounded border border-slate-600 bg-[#071A2E] px-2 py-1 text-white"
          >
            {BATCH_LABELS.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span>Filter</span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search A00–A60, surface, or dependency"
            className="rounded border border-slate-600 bg-[#071A2E] px-2.5 py-1 text-white"
          />
        </label>
        <span className="text-slate-400">Showing {visibleRows.length} of {rows.length} agents</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">61-Agent Application Workforce Matrix A00 through A60</caption>
          <thead>
            <tr className="bg-[#0A223D] text-slate-300">
              <th scope="col" className="p-2">ID &amp; Name</th>
              <th scope="col" className="p-2">Planned task &amp; surface</th>
              <th scope="col" className="p-2">Implemented function &amp; source</th>
              <th scope="col" className="p-2">Inputs, tools &amp; audience</th>
              <th scope="col" className="p-2">API, worker, DB &amp; website</th>
              <th scope="col" className="p-2">Reviewer &amp; decisions</th>
              <th scope="col" className="p-2">Local tests</th>
              <th scope="col" className="p-2">Staging</th>
              <th scope="col" className="p-2">Production</th>
              <th scope="col" className="p-2">Open dependency / owner decision</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(r => (
              <tr key={r.agentId} className="border-t border-slate-800 align-top">
                <th scope="row" className="p-2 font-mono whitespace-nowrap">
                  <span className={r.locallyImplemented ? 'text-[#D4A843]' : 'text-amber-400'}>{r.agentId}</span>
                  <div className="font-sans font-semibold text-white whitespace-normal">{r.overviewName}</div>
                  <div className="font-sans text-[11px] text-slate-400">{r.workflowStages}</div>
                </th>
                <td className="p-2 min-w-[180px]">{r.plannedTaskAndSurface}</td>
                <td className="p-2 min-w-[180px] font-mono text-[11px]">{r.implementedDomainFunctionAndSourcePath}</td>
                <td className="p-2 min-w-[180px]">{r.authorizedInputsToolsAndAudience}</td>
                <td className="p-2 min-w-[200px]">{r.apiWorkerDbAndWebsiteIntegration}</td>
                <td className="p-2 min-w-[180px]">{r.humanReviewerAndPermittedDecisions}</td>
                <td className="p-2 min-w-[150px] text-emerald-300">{r.localTestEvidence}</td>
                <td className="p-2 min-w-[130px] text-slate-400">{r.hostedStagingAcceptance}</td>
                <td className="p-2 min-w-[130px] text-slate-400">{r.productionCommissioningAndReleaseEvidence}</td>
                <td className="p-2 min-w-[180px] text-amber-200">{r.openDependencyOrOwnerDecision}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
