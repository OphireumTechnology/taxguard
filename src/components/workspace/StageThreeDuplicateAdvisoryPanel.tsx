import React, { useCallback, useEffect, useState } from 'react';
import {
  aiWorkforceService,
  workforceErrorMessage,
  type ClientA10InspectionItem,
  type ClientWorkforceScope,
} from '../../services/aiWorkforceService';

interface StageThreeDuplicateAdvisoryPanelProps {
  tenantId: string;
  clientId: string;
  caseId: string;
  taxYear: number;
  activeStage: number;
}

const DECISIONS = ['ACKNOWLEDGE', 'ESCALATE', 'DISMISS', 'RETURN_FOR_CORRECTION'] as const;

/**
 * Stage Three Staff Panel for A10 (Duplicate/Fraud Indicator Agent — Narrow Byte-Duplicate Pilot).
 *
 * Security & Governance Guarantees:
 * - Equal SHA-256 hashes indicate equal recorded bytes only — never fraud, classification, or verified tax facts.
 * - Never deletes documents or alters tax records.
 * - Live decision button stays disabled/unavailable while A10's production reviewer role awaits owner approval.
 * - Flags stale evidence whenever document version, release status, or quarantine state changes.
 */
export const StageThreeDuplicateAdvisoryPanel: React.FC<StageThreeDuplicateAdvisoryPanelProps> = ({
  tenantId,
  clientId,
  caseId,
  taxYear,
  activeStage,
}) => {
  const [sourceIdsInput, setSourceIdsInput] = useState('');
  const [items, setItems] = useState<ClientA10InspectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [rationales, setRationales] = useState<Record<string, string>>({});
  const [selectedDecision, setSelectedDecision] = useState<Record<string, string>>({});

  const scope: ClientWorkforceScope = {
    tenant_id: tenantId,
    client_id: clientId,
    tax_case_id: caseId,
    tax_year: taxYear,
  };

  const loadAdvisories = useCallback(async () => {
    if (!tenantId || !clientId || !caseId) return;
    setLoading(true);
    try {
      const res = await aiWorkforceService.listA10CaseAdvisories(scope);
      setItems(res.items);
    } catch (error) {
      setNotice({ error: true, text: workforceErrorMessage(error) });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, clientId, caseId, taxYear]);

  useEffect(() => {
    void loadAdvisories();
  }, [loadAdvisories]);

  const handleRunDuplicateCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const ids = sourceIdsInput
      .split(/[\s,]+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (ids.length === 0 || ids.length > 10) {
      setNotice({ error: true, text: 'Enter between 1 and 10 authorized clean evidence source UUIDs.' });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const submitted = await aiWorkforceService.submitA10Job({
        request_id: `a10-${Date.now()}`,
        scope,
        evidence_source_ids: ids,
      });
      await aiWorkforceService.processA10Job(submitted.job.job_id, tenantId);
      setNotice({
        error: false,
        text: submitted.created
          ? 'Stage Three A10 byte-duplicate advisory generated (advisory only; no documents altered).'
          : 'Reused existing idempotent A10 duplicate check job for this exact evidence version set.',
      });
      await loadAdvisories();
    } catch (error) {
      setNotice({ error: true, text: workforceErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const handleRecordDecision = async (item: ClientA10InspectionItem) => {
    if (busy) return;
    const advisoryId = item.advisory.advisory_id;
    const decision = selectedDecision[advisoryId] || 'ACKNOWLEDGE';
    const rationale = (rationales[advisoryId] ?? '').trim();
    if (rationale.length < 10) {
      setNotice({ error: true, text: 'Enter a review rationale of at least 10 characters.' });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      await aiWorkforceService.recordDecision(advisoryId, {
        request_id: `a10-dec-${Date.now()}`,
        agent_id: 'A10',
        scope,
        expected_evidence_fingerprint: item.advisory.evidence_fingerprint,
        decision,
        rationale,
      });
      setNotice({ error: false, text: `Recorded human decision (${decision}) bound to exact evidence version fingerprint.` });
      setRationales(prev => ({ ...prev, [advisoryId]: '' }));
      await loadAdvisories();
    } catch (error) {
      setNotice({ error: true, text: workforceErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby="stage-three-a10-heading"
      data-testid="stage-three-a10-panel"
      className="mt-4 rounded-xl border border-slate-700/80 bg-[#071A2E]/90 p-4 text-xs text-slate-200 space-y-3"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 id="stage-three-a10-heading" className="text-sm font-bold text-[#D4A843]">
            Stage Three · A10 Duplicate Document Advisory (Pilot)
          </h4>
          <p className="text-slate-300">
            Narrow exact SHA-256 byte comparison only (OV-01). Equal hashes indicate equal recorded bytes, never fraud, classification, or verified tax facts. Documents are never deleted or altered.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAdvisories()}
          disabled={loading}
          className="rounded-lg border border-slate-600 px-2.5 py-1 text-slate-200 hover:border-[#D4A843]"
        >
          {loading ? 'Refreshing…' : 'Refresh advisories'}
        </button>
      </header>

      {activeStage !== 3 && (
        <p role="note" className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-2 text-amber-200">
          Case is currently in Stage {activeStage}. New A10 submissions require Stage 3 active gate; existing case advisories remain visible below.
        </p>
      )}

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

      <form onSubmit={handleRunDuplicateCheck} className="space-y-2">
        <label className="block space-y-1">
          <span className="text-slate-300 font-medium">
            Authorized clean evidence source IDs (1–10 UUIDs, comma or newline separated)
          </span>
          <textarea
            rows={2}
            value={sourceIdsInput}
            onChange={e => setSourceIdsInput(e.target.value)}
            placeholder="Paste 1–10 verified RELEASED/VERIFIED CLEAN evidence source UUIDs for this case"
            className="w-full rounded-lg border border-slate-600 bg-[#06182B] p-2 font-mono text-xs text-white"
          />
        </label>
        <button
          type="submit"
          disabled={busy || activeStage !== 3}
          className="rounded-lg bg-[#D4A843] px-3 py-1.5 font-bold text-[#06182B] disabled:opacity-50"
        >
          {busy ? 'Running Stage Three Check…' : 'Run A10 Byte-Duplicate Check'}
        </button>
      </form>

      <div className="space-y-2">
        {items.length === 0 && !loading && (
          <p className="text-slate-400">No A10 duplicate advisories recorded for this case yet.</p>
        )}
        {items.map(item => {
          const adv = item.advisory;
          const alreadyDecided = item.decisions.length > 0;
          const decisionDisabled =
            busy ||
            alreadyDecided ||
            item.stale_evidence ||
            !item.live_decision_available ||
            (rationales[adv.advisory_id] ?? '').trim().length < 10;

          return (
            <article
              key={adv.advisory_id}
              className="rounded-lg border border-slate-700 bg-[#0A223D]/70 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[#D4A843] font-semibold">
                  Advisory {adv.advisory_id.slice(0, 8)} · {adv.status}
                </span>
                <span className="text-slate-400">
                  Fingerprint {adv.evidence_fingerprint.slice(0, 12)}… · {adv.evidence_pins.length} pinned doc(s)
                </span>
              </div>
              <p className="text-white">{adv.summary}</p>

              {item.stale_evidence && (
                <p role="alert" className="rounded border border-amber-500/50 bg-amber-950/40 p-2 text-amber-200">
                  Stale evidence detected ({item.stale_reason}). Re-run A10 on current document versions before recording any decision.
                </p>
              )}

              {!item.live_decision_available && (
                <p role="note" className="rounded border border-slate-600 bg-slate-900/60 p-2 text-slate-300">
                  Live decision action unavailable ({item.live_decision_block_reason}): pending owner approval of A10&apos;s production reviewer role.
                </p>
              )}

              {alreadyDecided ? (
                <div className="rounded border border-emerald-500/40 bg-emerald-950/20 p-2 text-emerald-200">
                  <strong>Human decision recorded:</strong> {item.decisions[0].decision} by {item.decisions[0].reviewer_uid} ({item.decisions[0].reviewer_role}) — {item.decisions[0].rationale}
                </div>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1.5">
                      <span>Disposition</span>
                      <select
                        value={selectedDecision[adv.advisory_id] ?? 'ACKNOWLEDGE'}
                        onChange={e => setSelectedDecision(prev => ({ ...prev, [adv.advisory_id]: e.target.value }))}
                        disabled={!item.live_decision_available || item.stale_evidence}
                        className="rounded border border-slate-600 bg-[#06182B] px-2 py-1 text-white"
                      >
                        {DECISIONS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                    <input
                      type="text"
                      value={rationales[adv.advisory_id] ?? ''}
                      onChange={e => setRationales(prev => ({ ...prev, [adv.advisory_id]: e.target.value }))}
                      disabled={!item.live_decision_available || item.stale_evidence}
                      placeholder="Independent reviewer rationale (min 10 chars)"
                      className="flex-1 min-w-[220px] rounded border border-slate-600 bg-[#06182B] px-2 py-1 text-white"
                    />
                    <button
                      type="button"
                      disabled={decisionDisabled}
                      onClick={() => void handleRecordDecision(item)}
                      className="rounded-lg border border-[#D4A843] px-3 py-1 font-semibold text-[#D4A843] disabled:opacity-40"
                    >
                      Record Human Decision
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
