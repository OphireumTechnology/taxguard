/**
 * DESTRIA TAX SERVICES, LLC — TaxGuard AI Enterprise Lifecycle Workspace (Stages 09–18)
 *
 * Unified server-authoritative workspace covering:
 *   09 Prepare Taxes · 10 Approve · 11 Sign · 12 File · 13 Government Feedback
 *   14 Resolve · 15 Monitor · 16 Archive · 17 Renew · 18 Repeat
 *
 * Design & Governance Invariants:
 * - Official Destria deep navy (#06182B / #0A213C) & metallic gold (#D4A843) aesthetic
 * - Tabular numeric alignment for all tax, currency, and percentage metrics
 * - Strictly reflects server-authoritative fail-closed provider boundaries
 * - Zero client-side approval/signature/filing forgery or optimistic state mutation
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Bell,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSignature,
  FileText,
  Landmark,
  Lock,
  RefreshCw,
  Repeat,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  stages09To18Service,
  Stages09To18ApiError,
  type StageScopePayload,
} from '../../services/stages09to18Service';

const STAGE_META = [
  { num: 9, title: '09 Prepare Taxes', weight: 25, icon: Calculator },
  { num: 10, title: '10 Approve', weight: 12, icon: ClipboardCheck },
  { num: 11, title: '11 Sign', weight: 8, icon: FileSignature },
  { num: 12, title: '12 File', weight: 12, icon: Send },
  { num: 13, title: '13 Gov Feedback', weight: 8, icon: Landmark },
  { num: 14, title: '14 Resolve', weight: 10, icon: Scale },
  { num: 15, title: '15 Monitor', weight: 8, icon: Bell },
  { num: 16, title: '16 Archive', weight: 7, icon: Archive },
  { num: 17, title: '17 Renew', weight: 5, icon: RefreshCw },
  { num: 18, title: '18 Repeat', weight: 5, icon: Repeat },
] as const;

const QC_CATEGORIES = [
  'IDENTITY_AND_FILING_STATUS',
  'DOCUMENT_COMPLETENESS',
  'FINANCIAL_RECONCILIATION',
  'TAX_COMPUTATION_VERIFICATION',
  'REGULATORY_COMPLIANCE',
  'FORM_COMPLETENESS',
  'FINAL_RELEASE_READINESS',
] as const;

export interface Stages09To18CommandWorkspaceProps {
  defaultScope?: Partial<StageScopePayload>;
  compact?: boolean;
}

export const Stages09To18CommandWorkspace: React.FC<Stages09To18CommandWorkspaceProps> = ({
  defaultScope,
  compact = false,
}) => {
  const { currentUser, authLifecycleState } = useApp();
  const [selectedStage, setSelectedStage] = useState<number>(9);
  const [scope, setScope] = useState<StageScopePayload>({
    tenantId: defaultScope?.tenantId || (currentUser as any)?.tenantId || 'tenantA',
    clientId: defaultScope?.clientId || 'client-1001',
    engagementId: defaultScope?.engagementId || 'eng-2025-001',
    caseId: defaultScope?.caseId || 'case-2025-001',
    taxYear: defaultScope?.taxYear || 2025,
  });

  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'info' | 'error' | 'success'; code?: string; message: string } | null>(null);

  // Stage 09 interactive inputs
  const [evidenceCategory, setEvidenceCategory] = useState<string>('W2_WAGES');
  const [evidenceAmount, setEvidenceAmount] = useState<string>('95000.00');
  const [evidenceDesc, setEvidenceDesc] = useState<string>('Verified Form W-2 Box 1 Wages');
  const [advisoryPrompt, setAdvisoryPrompt] = useState<string>('');
  const [advisoryResponse, setAdvisoryResponse] = useState<any>(null);

  // Stage 10 interactive inputs
  const [riskClass, setRiskClass] = useState<string>('Moderate');
  const [riskReason, setRiskReason] = useState<string>('All W-2 and Schedule C evidence verified against source documents.');

  // Stage 13 notice input
  const [noticeAgency, setNoticeAgency] = useState<string>('IRS');
  const [noticeCode, setNoticeCode] = useState<string>('CP2000');
  const [noticeText, setNoticeText] = useState<string>('Proposed underreporter income adjustment inquiry for TY 2025.');

  const isAuthorizedStaff = Boolean(
    authLifecycleState === 'AUTHENTICATED' &&
    currentUser &&
    !['client', 'prospective_client', 'recruiter'].includes(currentUser.role)
  );

  const loadSnapshot = useCallback(async () => {
    if (!isAuthorizedStaff) return;
    setLoading(true);
    setBanner(null);
    try {
      const data = await stages09To18Service.getSnapshot(scope);
      setSnapshot(data);
    } catch (err: unknown) {
      if (err instanceof Stages09To18ApiError) {
        setBanner({ type: 'error', code: err.code, message: err.message });
      } else {
        setBanner({ type: 'error', message: 'Unable to load Stages 09–18 case snapshot from server.' });
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthorizedStaff, scope]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const runAction = async (label: string, fn: () => Promise<any>, successMsg: string) => {
    setBusyAction(label);
    setBanner(null);
    try {
      const result = await fn();
      setBanner({ type: 'success', message: successMsg });
      await loadSnapshot();
      return result;
    } catch (err: unknown) {
      if (err instanceof Stages09To18ApiError) {
        setBanner({ type: 'error', code: err.code, message: err.message });
      } else {
        setBanner({ type: 'error', message: 'Server action failed.' });
      }
      return null;
    } finally {
      setBusyAction(null);
    }
  };

  if (!isAuthorizedStaff) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-[#0A213C] p-6 text-slate-200">
        <div className="flex items-center gap-3 text-[#D4A843] font-semibold">
          <Lock className="w-5 h-5" />
          <span>Authorized Staff Session Required (MFA AAL2)</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          TaxGuard Stages 09–18 operations are restricted to authenticated practice accountants, independent reviewers, and administrators with verified tenant context.
        </p>
      </div>
    );
  }

  const scorecard = snapshot?.scorecard;
  const stage09 = snapshot?.stage09;
  const stage10 = snapshot?.stage10;
  const latestReturn = stage09?.returnVersions?.[stage09.returnVersions.length - 1] || null;
  const approvedRulePack = stage09?.rulePacks?.find((rp: any) => rp.status === 'APPROVED') || null;

  return (
    <section
      className={`rounded-2xl border border-slate-700/70 bg-[#06182B] text-slate-100 shadow-2xl ${compact ? 'p-4' : 'p-6'} space-y-6`}
      aria-label="TaxGuard Enterprise Lifecycle Stages 09 through 18"
    >
      {/* Header & Honest Release Gate Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#D4A843]">
            Destria Tax Services, LLC · Workflow Authority LEGACY_18_V1
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white tracking-tight">
            Enterprise Tax Lifecycle Command Center (Stages 09–18)
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Deterministic exact-decimal preparation · Maker-checker approval · Fail-closed external provider boundaries
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded border border-red-500/40 bg-red-950/60 text-red-200">
            Staging: {scorecard?.stagingDecision ?? 'NO-GO'}
          </span>
          <span className="px-2.5 py-1 rounded border border-red-500/40 bg-red-950/60 text-red-200">
            Production: {scorecard?.productionDecision ?? 'NO-GO'}
          </span>
          <span className="px-2.5 py-1 rounded border border-[#D4A843]/40 bg-[#0A213C] text-[#E5B552] tabular-nums">
            Code Impl: {scorecard ? `${scorecard.weightedCodeImplementationPercent}%` : '—'}
          </span>
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] font-semibold hover:bg-[#E5B552] transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Server State
          </button>
        </div>
      </div>

      {/* Scoped Case Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#0A213C]/80 border border-slate-800 rounded-xl p-3">
        <label className="text-[11px] text-slate-400 flex flex-col gap-1">
          Tenant ID
          <input
            value={scope.tenantId}
            onChange={e => setScope(s => ({ ...s, tenantId: e.target.value }))}
            className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-xs text-white font-mono"
          />
        </label>
        <label className="text-[11px] text-slate-400 flex flex-col gap-1">
          Client ID
          <input
            value={scope.clientId}
            onChange={e => setScope(s => ({ ...s, clientId: e.target.value }))}
            className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-xs text-white font-mono"
          />
        </label>
        <label className="text-[11px] text-slate-400 flex flex-col gap-1">
          Engagement ID
          <input
            value={scope.engagementId}
            onChange={e => setScope(s => ({ ...s, engagementId: e.target.value }))}
            className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-xs text-white font-mono"
          />
        </label>
        <label className="text-[11px] text-slate-400 flex flex-col gap-1">
          Case ID
          <input
            value={scope.caseId}
            onChange={e => setScope(s => ({ ...s, caseId: e.target.value }))}
            className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-xs text-white font-mono"
          />
        </label>
        <label className="text-[11px] text-slate-400 flex flex-col gap-1">
          Tax Year
          <input
            type="number"
            min={2022}
            max={2026}
            value={scope.taxYear}
            onChange={e => setScope(s => ({ ...s, taxYear: Number(e.target.value) || 2025 }))}
            className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-xs text-white font-mono tabular-nums"
          />
        </label>
      </div>

      {/* Server Response Banner */}
      {banner && (
        <div
          role={banner.type === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-xl border p-3.5 text-xs ${
            banner.type === 'error'
              ? 'border-red-500/40 bg-red-950/50 text-red-100'
              : banner.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100'
                : 'border-slate-700 bg-[#0A213C] text-slate-200'
          }`}
        >
          {banner.type === 'error' ? (
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          )}
          <div className="space-y-0.5">
            {banner.code && <div className="font-mono font-bold tracking-wide">{banner.code}</div>}
            <div>{banner.message}</div>
          </div>
        </div>
      )}

      {/* Canonical Stages 09–18 Stepper */}
      <nav aria-label="TaxGuard Stages 09 to 18 Navigation" className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
        {STAGE_META.map(item => {
          const Icon = item.icon;
          const active = selectedStage === item.num;
          const serverStage = snapshot?.activeStage ?? 9;
          return (
            <button
              key={item.num}
              type="button"
              onClick={() => setSelectedStage(item.num)}
              className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                active
                  ? 'border-[#D4A843] bg-[#0D2745] text-white shadow-md'
                  : 'border-slate-800 bg-[#0A213C]/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="w-full flex items-center justify-between">
                <Icon className={`w-4 h-4 ${active ? 'text-[#D4A843]' : 'text-slate-400'}`} />
                <span className="text-[10px] font-mono text-slate-400 tabular-nums">{item.weight}%</span>
              </div>
              <div className="text-[11px] font-semibold leading-tight">{item.title}</div>
              <div className="text-[10px] font-mono text-slate-400">
                {serverStage === item.num ? 'ACTIVE' : serverStage > item.num ? 'PASSED' : 'GATED'}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Active Stage Workspace Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-5">
          {/* STAGE 09 — PREPARE TAXES */}
          {selectedStage === 9 && (
            <div className="rounded-xl border border-slate-800 bg-[#0A213C] p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-[#D4A843]" />
                    Stage 09 — Prepare Taxes (Block TG-09 · 25% Weight)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Versioned forms registry, exact-decimal computation engine, book-to-tax reconciliation, and evidence-to-form lineage.
                  </p>
                </div>
                <span className="text-xs font-mono px-2 py-1 rounded bg-[#06182B] border border-slate-700 text-[#E5B552] tabular-nums">
                  {stage09?.summary?.totalCatalogedFormsCount ?? 32} Forms Cataloged
                </span>
              </div>

              {/* Action Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-800 bg-[#06182B] p-4 space-y-3">
                  <div className="text-xs font-semibold text-[#D4A843] uppercase tracking-wider">
                    1. Record Verified Source Evidence
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={evidenceCategory}
                      onChange={e => setEvidenceCategory(e.target.value)}
                      className="rounded bg-[#0A213C] border border-slate-700 px-2 py-1.5 text-xs text-white"
                    >
                      <option value="W2_WAGES">W-2 Wages</option>
                      <option value="INTEREST_INCOME">1099-INT Interest</option>
                      <option value="SCHEDULE_C_GROSS">Schedule C Gross</option>
                      <option value="SCHEDULE_C_EXPENSES">Schedule C Expenses</option>
                      <option value="FEDERAL_WITHHOLDING">Federal Withholding</option>
                      <option value="ESTIMATED_PAYMENTS">Estimated Payments</option>
                    </select>
                    <input
                      value={evidenceAmount}
                      onChange={e => setEvidenceAmount(e.target.value)}
                      placeholder="0.00"
                      className="rounded bg-[#0A213C] border border-slate-700 px-2 py-1.5 text-xs text-white font-mono tabular-nums"
                    />
                  </div>
                  <input
                    value={evidenceDesc}
                    onChange={e => setEvidenceDesc(e.target.value)}
                    className="w-full rounded bg-[#0A213C] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void runAction(
                        'evidence',
                        () =>
                          stages09To18Service.recordEvidence(scope, {
                            sourceDocumentId: `doc_${Date.now()}`,
                            verifiedFactId: `fact_${Date.now()}`,
                            category: evidenceCategory,
                            description: evidenceDesc,
                            amount: evidenceAmount,
                            status: 'VERIFIED',
                          }),
                        'Verified source evidence recorded with exact-decimal normalization.'
                      )
                    }
                    className="w-full py-2 rounded bg-[#D4A843] text-[#06182B] text-xs font-semibold hover:bg-[#E5B552] disabled:opacity-50"
                  >
                    Record Verified Evidence
                  </button>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#06182B] p-4 space-y-3">
                  <div className="text-xs font-semibold text-[#D4A843] uppercase tracking-wider">
                    2. Profile, Rule Pack & Deterministic Run
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <div>Profile: <span className="font-mono text-white">{stage09?.summary?.profile?.federalTaxClassification || 'Not set'}</span></div>
                    <div>Approved Rule Pack: <span className="font-mono text-white">{approvedRulePack?.rulePackId || 'NONE (Calculation Gated)'}</span></div>
                    <div>Evidence Items: <span className="font-mono text-white tabular-nums">{stage09?.evidence?.length ?? 0}</span></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() =>
                        void runAction(
                          'profile',
                          () =>
                            stages09To18Service.upsertProfile(scope, {
                              legalEntityStructure: 'INDIVIDUAL',
                              federalTaxClassification: 'INDIVIDUAL_1040',
                              filingStatus: 'SINGLE',
                              primaryJurisdictionCode: 'SC',
                              dependentsCount: 0,
                            }),
                          'Taxpayer & entity classification profile saved.'
                        )
                      }
                      className="px-3 py-1.5 rounded border border-slate-600 bg-[#0A213C] text-xs text-white hover:border-[#D4A843]"
                    >
                      Save 1040 Profile
                    </button>
                    <button
                      type="button"
                      disabled={busyAction !== null || !approvedRulePack}
                      title={!approvedRulePack ? 'Requires an independently approved tax rule pack' : 'Run exact-decimal calculation'}
                      onClick={() =>
                        void runAction(
                          'calc',
                          () =>
                            stages09To18Service.runCalculation(scope, {
                              formCode: '1040',
                              jurisdictionCode: 'US',
                              rulePackId: approvedRulePack?.rulePackId,
                              filingStatus: 'SINGLE',
                            }),
                          'Deterministic exact-decimal calculation run completed and SHA-256 fingerprinted.'
                        )
                      }
                      className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] text-xs font-semibold hover:bg-[#E5B552] disabled:opacity-40"
                    >
                      Run Calculation
                    </button>
                    {stage09?.calculationRuns?.length > 0 && (
                      <button
                        type="button"
                        disabled={busyAction !== null}
                        onClick={() =>
                          void runAction(
                            'assemble',
                            () =>
                              stages09To18Service.assembleReturn(
                                scope,
                                stage09.calculationRuns[stage09.calculationRuns.length - 1].calculationRunId
                              ),
                            'Versioned draft return assembled with full Evidence-to-Form Lineage.'
                          )
                        }
                        className="px-3 py-1.5 rounded border border-emerald-500/50 bg-emerald-950/40 text-xs text-emerald-200 hover:bg-emerald-900/50"
                      >
                        Assemble Return Version
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Latest Return Version & Lineage Table */}
              {latestReturn && (
                <div className="rounded-lg border border-slate-800 bg-[#06182B] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-white">
                      Latest Return Version: <span className="font-mono text-[#D4A843]">{latestReturn.returnVersionId}</span> ({latestReturn.status})
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400">
                        SHA-256: {latestReturn.contentSha256.slice(0, 16)}…
                      </span>
                      {latestReturn.status === 'DRAFT' && (
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() =>
                            void runAction(
                              'submit',
                              () =>
                                stages09To18Service.submitReturn(
                                  scope,
                                  latestReturn.returnVersionId,
                                  latestReturn.optimisticVersion
                                ),
                              'Return version submitted for independent Stage 10 review.'
                            )
                          }
                          className="px-3 py-1 rounded bg-[#D4A843] text-[#06182B] text-xs font-semibold"
                        >
                          Submit for Stage 10 Review
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-1.5">Line</th>
                          <th className="py-1.5">Description</th>
                          <th className="py-1.5 text-right">Exact Value</th>
                          <th className="py-1.5 text-right">Lineage ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {latestReturn.formFields.map((f: any) => (
                          <tr key={f.lineKey}>
                            <td className="py-1.5 font-mono text-slate-300">{f.lineKey}</td>
                            <td className="py-1.5 text-slate-200">{f.label}</td>
                            <td className="py-1.5 text-right font-mono tabular-nums text-white">${f.value}</td>
                            <td className="py-1.5 text-right font-mono text-slate-400">{f.lineageId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bounded AI Advisory Assistant (Non-Authoritative) */}
              <div className="rounded-lg border border-slate-800 bg-[#06182B] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#D4A843]" />
                    Bounded AI Preparation Advisory (A14 · Non-Authoritative)
                  </div>
                  <span className="text-[10px] font-mono text-amber-300">Prompt-Injection Shield Active</span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={advisoryPrompt}
                    onChange={e => setAdvisoryPrompt(e.target.value)}
                    placeholder="Ask for a checklist or missing-evidence review (never computes or approves returns)..."
                    className="flex-1 rounded bg-[#0A213C] border border-slate-700 px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    disabled={busyAction !== null || !advisoryPrompt.trim()}
                    onClick={async () => {
                      const out = await runAction(
                        'advisory',
                        () => stages09To18Service.requestAdvisory(scope, advisoryPrompt),
                        'Advisory proposal generated (human review required).'
                      );
                      if (out) setAdvisoryResponse(out);
                    }}
                    className="px-3 py-1.5 rounded border border-[#D4A843]/50 text-xs text-[#E5B552] hover:bg-[#0D2745] disabled:opacity-40"
                  >
                    Request Advisory
                  </button>
                </div>
                {advisoryResponse && (
                  <div className="rounded bg-[#0A213C] border border-slate-700 p-3 text-xs text-slate-300 space-y-1">
                    <div className="font-mono text-[10px] text-[#D4A843]">
                      {advisoryResponse.agentCode} · isAuthoritative={String(advisoryResponse.isAuthoritative)}
                    </div>
                    <p>{advisoryResponse.summary}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STAGE 10 — APPROVE */}
          {selectedStage === 10 && (
            <div className="rounded-xl border border-slate-800 bg-[#0A213C] p-5 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#D4A843]" />
                Stage 10 — Maker-Checker Review &amp; Approval (Block TG-10 · 12% Weight)
              </h3>
              <p className="text-xs text-slate-400">
                Server enforces strict separation of duties: preparer cannot self-approve, admins cannot bypass, MFA AAL2 required, and all 7 QC categories must pass.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-slate-300 flex flex-col gap-1">
                  Risk Classification
                  <select
                    value={riskClass}
                    onChange={e => setRiskClass(e.target.value)}
                    className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </label>
                <label className="text-xs text-slate-300 flex flex-col gap-1">
                  Documented Risk Justification
                  <input
                    value={riskReason}
                    onChange={e => setRiskReason(e.target.value)}
                    className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!latestReturn || busyAction !== null}
                  onClick={() =>
                    latestReturn &&
                    void runAction(
                      'qc',
                      () =>
                        stages09To18Service.recordQcGates(
                          scope,
                          latestReturn.returnVersionId,
                          QC_CATEGORIES.map(category => ({
                            category,
                            passed: true,
                            notes: 'Verified by independent reviewer.',
                          }))
                        ),
                      'All 7 QC gate categories recorded.'
                    )
                  }
                  className="px-3 py-1.5 rounded border border-slate-600 bg-[#06182B] text-xs text-white hover:border-[#D4A843] disabled:opacity-40"
                >
                  Record All 7 QC Gates Passed
                </button>
                <button
                  type="button"
                  disabled={!latestReturn || busyAction !== null}
                  onClick={() =>
                    latestReturn &&
                    void runAction(
                      'approve',
                      () =>
                        stages09To18Service.approveReturn(scope, {
                          returnVersionId: latestReturn.returnVersionId,
                          riskClassification: riskClass,
                          riskJustification: riskReason,
                          notes: 'Independent maker-checker approval recorded.',
                        }),
                      'Stage 10 approval bound to return content SHA-256.'
                    )
                  }
                  className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] text-xs font-semibold hover:bg-[#E5B552] disabled:opacity-40"
                >
                  Approve Exact Return Version
                </button>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#06182B] p-3 text-xs space-y-1.5">
                <div className="font-semibold text-slate-300">Immutable Approval History ({stage10?.approvals?.length ?? 0})</div>
                {(stage10?.approvals || []).length === 0 ? (
                  <p className="text-slate-500">No Stage 10 approval decisions recorded for this case scope.</p>
                ) : (
                  stage10.approvals.map((a: any) => (
                    <div key={a.approvalId} className="flex flex-wrap justify-between border-t border-slate-800 pt-1.5 font-mono text-[11px]">
                      <span className={a.decision === 'APPROVED' ? 'text-emerald-300' : 'text-amber-300'}>{a.decision}</span>
                      <span className="text-slate-400">Risk: {a.riskClassification}</span>
                      <span className="text-slate-500">Hash: {a.returnContentSha256.slice(0, 12)}…</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STAGES 11–18 UNIFIED OPERATIONAL PANELS */}
          {selectedStage >= 11 && (
            <div className="rounded-xl border border-slate-800 bg-[#0A213C] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-[#D4A843]" />
                  {STAGE_META.find(m => m.num === selectedStage)?.title} — Controlled Lifecycle Workbench
                </h3>
                <span className="text-[11px] font-mono text-amber-300">Fail-Closed Provider Controls Active</span>
              </div>

              {selectedStage === 11 && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300">
                    Stage 11 creates SHA-256 hashed Form 8879 / 8878 / Engagement packages bound to an active Stage 10 approval. Live dispatch fails closed with <code className="text-amber-300">SIGNATURE_PROVIDER_NOT_CONFIGURED</code> until commissioned.
                  </p>
                  <button
                    type="button"
                    disabled={!latestReturn || busyAction !== null}
                    onClick={() =>
                      latestReturn &&
                      void runAction(
                        'sig-env',
                        () =>
                          stages09To18Service.createSignatureEnvelope(scope, {
                            returnVersionId: latestReturn.returnVersionId,
                            documentType: 'FORM_8879',
                            signerEmail: 'taxpayer@example.com',
                            signerName: 'Authorized Taxpayer',
                          }),
                        'Form 8879 signature envelope drafted with SHA-256 digest.'
                      )
                    }
                    className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] font-semibold disabled:opacity-40"
                  >
                    Prepare Form 8879 Package
                  </button>
                  <div className="text-slate-400 font-mono">
                    Envelopes recorded: {snapshot?.stage11?.envelopes?.length ?? 0}
                  </div>
                </div>
              )}

              {selectedStage === 12 && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300">
                    Stage 12 enforces 10-point filing readiness, duplicate filing locks, 11-state lifecycle tracking, and zero auto-retries on <code className="text-amber-300">UNKNOWN_OUTCOME</code>. Live transmission remains blocked (<code className="text-red-300">FILING_PROVIDER_NOT_COMMISSIONED</code>).
                  </p>
                  <div className="text-slate-400 font-mono">
                    Transmissions recorded: {snapshot?.stage12?.filings?.length ?? 0}
                  </div>
                </div>
              )}

              {selectedStage === 13 && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300">
                    Register government notices with automatic prompt-injection protection and advisory-only summaries. Transcript retrieval fails closed until IRS TDS commissioning.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={noticeAgency} onChange={e => setNoticeAgency(e.target.value)} className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-white" />
                    <input value={noticeCode} onChange={e => setNoticeCode(e.target.value)} className="rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-white font-mono" />
                  </div>
                  <textarea
                    rows={2}
                    value={noticeText}
                    onChange={e => setNoticeText(e.target.value)}
                    className="w-full rounded bg-[#06182B] border border-slate-700 px-2.5 py-1.5 text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() =>
                        void runAction(
                          'notice',
                          () =>
                            stages09To18Service.registerNotice(scope, {
                              issuingAgency: noticeAgency,
                              noticeCode,
                              noticeDate: new Date().toISOString().slice(0, 10),
                              rawNoticeText: noticeText,
                              requestAiAdvisorySummary: true,
                            }),
                          'Government notice registered and sanitized.'
                        )
                      }
                      className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] font-semibold"
                    >
                      Register Notice
                    </button>
                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() =>
                        void runAction(
                          'transcript',
                          () =>
                            stages09To18Service.requestTranscript(scope, {
                              transcriptType: 'ACCOUNT',
                              taxpayerConsentVerified: true,
                              representationAuthorityId: 'poa-2848-001',
                            }),
                          'Transcript request evaluated.'
                        )
                      }
                      className="px-3 py-1.5 rounded border border-slate-600 text-slate-200 hover:border-amber-400"
                    >
                      Verify Transcript Boundary
                    </button>
                  </div>
                  <div className="text-slate-400 font-mono">
                    Notices: {snapshot?.stage13?.notices?.length ?? 0} · Acknowledgments: {snapshot?.stage13?.acknowledgments?.length ?? 0}
                  </div>
                </div>
              )}

              {selectedStage === 14 && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300">
                    Resolution cases progress through controlled states (OPEN → TRIAGE → INVESTIGATION → … → RESOLVED) and block RESOLVED while government confirmation is pending. Amendments link to a new version without ever altering original filed returns.
                  </p>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void runAction(
                        'resolution',
                        () =>
                          stages09To18Service.openResolution(scope, {
                            summary: 'IRS CP2000 inquiry triage and supporting documentation compilation.',
                          }),
                        'Resolution case opened in OPEN state.'
                      )
                    }
                    className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] font-semibold"
                  >
                    Open Resolution Case
                  </button>
                  <div className="text-slate-400 font-mono">
                    Resolutions: {snapshot?.stage14?.resolutions?.length ?? 0} · Amendments: {snapshot?.stage14?.amendments?.length ?? 0}
                  </div>
                </div>
              )}

              {selectedStage === 15 && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300">
                    Jurisdiction/holiday/disaster-relief aware compliance calendar and idempotent notification outbox (blocks duplicate notifications; fails closed for uncommissioned external email/SMS).
                  </p>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void runAction(
                        'obligation',
                        () =>
                          stages09To18Service.scheduleObligation(scope, {
                            jurisdictionCode: 'US',
                            obligationType: 'ESTIMATED_TAX',
                            statutoryDueDate: `${scope.taxYear + 1}-04-15`,
                            ruleBasis: 'IRC §6654 Quarterly Estimated Tax Schedule',
                            projectedAmount: '2500.00',
                          }),
                        'Compliance obligation scheduled.'
                      )
                    }
                    className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] font-semibold"
                  >
                    Schedule Estimated Tax Obligation
                  </button>
                  <div className="text-slate-400 font-mono">
                    Obligations: {snapshot?.stage15?.obligations?.length ?? 0} · Notifications: {snapshot?.stage15?.notifications?.length ?? 0}
                  </div>
                </div>
              )}

              {selectedStage === 16 && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300">
                    Generates SHA-256 sealed archive manifests bound to configurable retention policies and strictly blocks disposition/deletion under any active legal hold.
                  </p>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={async () => {
                      const policy = await runAction(
                        'policy',
                        () =>
                          stages09To18Service.defineRetentionPolicy(scope, {
                            documentClass: 'TAX_RETURN',
                            jurisdictionCode: 'US',
                            engagementType: 'INDIVIDUAL',
                            retentionYears: 7,
                            policyAuthority: 'IRC §6501 & Destria Firm Policy',
                          }),
                        'Retention policy defined.'
                      );
                      if (policy?.policyId) {
                        await runAction(
                          'seal',
                          () => stages09To18Service.sealArchive(scope, policy.policyId),
                          'Immutable SHA-256 archive manifest sealed.'
                        );
                      }
                    }}
                    className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] font-semibold"
                  >
                    Seal SHA-256 Archive Manifest
                  </button>
                  <div className="text-slate-400 font-mono">
                    Archives: {snapshot?.stage16?.archives?.length ?? 0} · Active Legal Holds: {snapshot?.stage16?.legalHolds?.length ?? 0}
                  </div>
                </div>
              )}

              {selectedStage === 17 && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300">
                    Annual engagement renewal workflow with conflict check, risk review, fee update, and agreement/consent renewal gating.
                  </p>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void runAction(
                        'renewal',
                        () =>
                          stages09To18Service.createRenewal(scope, {
                            proposedFee: '1250.00',
                            scopeSummary: `TY ${scope.taxYear + 1} Federal & SC Individual Tax Return Preparation`,
                            conflictCheckPassed: true,
                            riskClassification: 'Low',
                            agreementRenewed: true,
                            consentRenewed: true,
                          }),
                        'Annual renewal proposal created.'
                      )
                    }
                    className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] font-semibold"
                  >
                    Create TY {scope.taxYear + 1} Renewal Proposal
                  </button>
                  <div className="text-slate-400 font-mono">
                    Renewals: {snapshot?.stage17?.renewals?.length ?? 0}
                  </div>
                </div>
              )}

              {selectedStage === 18 && (
                <div className="space-y-3 text-xs">
                  <p className="text-slate-300">
                    Multi-year continuity: transfers only REVIEWED_APPROVED carryforwards, preserves POTENTIAL_NEW_ENTITY / POTENTIAL_NEW_INCOME_SOURCE flags, and initializes the next tax year at Stage 01 without mutating historical finalized cases.
                  </p>
                  <button
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() =>
                      void runAction(
                        'carryforward',
                        () =>
                          stages09To18Service.registerCarryforward(scope, {
                            category: 'CAPITAL_LOSS',
                            description: 'Schedule D Net Capital Loss Carryforward',
                            amount: '4200.00',
                            eligibilityRuleRef: 'IRC §1212(b)',
                          }),
                        'Carryforward candidate registered for practitioner review.'
                      )
                    }
                    className="px-3 py-1.5 rounded bg-[#D4A843] text-[#06182B] font-semibold"
                  >
                    Register Capital Loss Carryforward Candidate
                  </button>
                  <div className="text-slate-400 font-mono">
                    Carryforwards: {snapshot?.stage18?.carryforwards?.length ?? 0} · Annual Generations: {snapshot?.stage18?.annualGenerations?.length ?? 0}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Provider Commissioning Matrix & Readiness Scorecard */}
        <aside className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-slate-800 bg-[#0A213C] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D4A843] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Provider Commissioning Boundary
              </h4>
            </div>
            <div className="space-y-2">
              {(scorecard?.providers || []).map((p: any) => (
                <div key={p.providerKey} className="rounded-lg border border-slate-800 bg-[#06182B] p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white truncate">{p.displayName}</span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded font-mono text-[10px] ${
                        p.liveExecutionPermitted
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-950/70 text-red-200 border border-red-500/30'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.blockingCode && (
                    <div className="text-[10px] font-mono text-amber-300/90 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {p.blockingCode}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0A213C] p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#D4A843] flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Immutable Case Audit Digest
            </h4>
            <div className="text-xs text-slate-300 space-y-1 font-mono">
              <div>Events: <span className="text-white tabular-nums">{snapshot?.audit?.totalEvents ?? 0}</span></div>
              <div className="truncate">Digest: <span className="text-slate-400">{snapshot?.audit?.digestSha256?.slice(0, 24) || '—'}…</span></div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
