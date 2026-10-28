/**
 * TaxGuard AI — AI Control Center
 * Grounded in: "TaxGuard AI Architecture Overview — 11 Pages", Page 10
 * Complete 15-area navigation, KPI status cards, SVG donut charts,
 * activity timelines, performance monitors, exception tables, and live governance integration.
 */

import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Power,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Layers,
  Activity,
  UserCheck,
  AlertTriangle,
  History,
  DollarSign,
  Lock,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  FileText,
  Sliders,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BarChart3,
  Users
} from 'lucide-react';
import { api } from '../../services/api';
import { AiCommissioningView } from './AiCommissioningView';
import { AgentRegistryView } from './AgentRegistryView';
import { AiRunAuditViewer } from './AiRunAuditViewer';
import { HumanApprovalQueuePanel } from './HumanApprovalQueuePanel';
import { AiEmergencyStopPanel } from './AiEmergencyStopPanel';
import {
  CONTROL_CENTER_METRICS,
  CANONICAL_61_AGENTS,
  GOVERNANCE_AREAS,
  GovernanceAreaId
} from './ai/aiControlCenterData';

export const AiControlCenterPanel: React.FC = () => {
  const [activeArea, setActiveArea] = useState<GovernanceAreaId>('agent_dashboard');
  const [selectedAgentForAudit, setSelectedAgentForAudit] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [serverState, setServerState] = useState<{
    globalStop: boolean;
    scopedStops: { scope: string; target: string }[];
    loading: boolean;
  }>({
    globalStop: false,
    scopedStops: [],
    loading: false
  });

  useEffect(() => {
    let isMounted = true;
    api.caseAuthority
      .getAiControlCenter('registry')
      .then((res: any) => {
        if (!isMounted) return;
        setServerState({
          globalStop: res?.global_stop === true,
          scopedStops: Array.isArray(res?.scoped_stops) ? res.scoped_stops : [],
          loading: false
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setServerState(prev => ({ ...prev, loading: false }));
      });
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  return (
    <div className="space-y-6 text-slate-200" data-testid="taxguard-ai-control-center">
      {/* Page 10 Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-[#071A2E] border border-slate-700/80 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
              PAGE 10 ARCHITECTURE SPECIFICATION
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              SYSTEM ACTIVE · LIVE
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            TAXGUARD AI CONTROL CENTER
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            61 Registered Agents · Centralized Governance · Real-time Monitoring · Policy Enforcement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveArea('agent_registry')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              activeArea === 'agent_registry'
                ? 'bg-[#D4A843] text-[#06182B] border-[#D4A843]'
                : 'bg-[#0D2745] text-slate-200 border-slate-600 hover:bg-slate-700'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            View Agent Registry
          </button>

          <button
            type="button"
            onClick={() => setActiveArea('human_approvals')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              activeArea === 'human_approvals'
                ? 'bg-[#D4A843] text-[#06182B] border-[#D4A843]'
                : 'bg-[#0D2745] text-slate-200 border-slate-600 hover:bg-slate-700'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-300" />
            Approval Queue ({CONTROL_CENTER_METRICS.humanApprovalQueue.totalPending})
          </button>

          <button
            type="button"
            onClick={() => setActiveArea('kill_switch')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 shadow-md shadow-red-950/50 transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            Emergency Kill Switch
          </button>

          <button
            type="button"
            onClick={() => setRefreshKey(k => k + 1)}
            className="p-1.5 rounded-xl bg-[#0D2745] hover:bg-slate-700 text-slate-300 border border-slate-700"
            aria-label="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Global / Scoped Stop Warning Banner */}
      {serverState.globalStop && (
        <div role="alert" className="p-4 rounded-xl bg-red-950/80 border border-red-500 text-red-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
          <div>
            <strong className="block font-bold">A GLOBAL emergency stop is engaged for this tenant.</strong>
            <span>All governed AI work is refused by policy until lifted by an authorized compliance officer.</span>
          </div>
        </div>
      )}

      {/* 15-Area Navigation Bar */}
      <nav aria-label="AI Control Center navigation" className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
        {GOVERNANCE_AREAS.map(area => {
          const isActive = activeArea === area.id;
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => setActiveArea(area.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-[#D4A843] text-[#06182B] font-bold shadow'
                  : 'bg-[#071A2E] text-slate-300 hover:bg-[#0D2745] border border-slate-700/60'
              }`}
            >
              <span>{area.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Subview Routing */}
      {activeArea === 'agent_registry' && (
        <AgentRegistryView
          onOpenAuditLogs={agentId => {
            setSelectedAgentForAudit(agentId);
            setActiveArea('audit_logs');
          }}
        />
      )}

      {activeArea === 'audit_logs' && (
        <AiRunAuditViewer initialAgentFilter={selectedAgentForAudit} />
      )}

      {activeArea === 'human_approvals' && <HumanApprovalQueuePanel />}

      {activeArea === 'kill_switch' && <AiEmergencyStopPanel />}

      {activeArea === 'agent_permissions' && (
        <AgentRegistryView onOpenAuditLogs={() => setActiveArea('audit_logs')} />
      )}

      {/* Primary Master Dashboard View (Page 10 exact layout) */}
      {(activeArea === 'agent_dashboard' ||
        activeArea === 'agent_tools' ||
        activeArea === 'model_registry' ||
        activeArea === 'prompt_registry' ||
        activeArea === 'knowledge_sources' ||
        activeArea === 'tax_rules' ||
        activeArea === 'evaluations' ||
        activeArea === 'thresholds' ||
        activeArea === 'ai_exceptions' ||
        activeArea === 'cost_tokens' ||
        activeArea === 'security_events') && (
        <div className="space-y-6">
          {/* ROW 1: 3 KPI Summary Cards with Donut and Statuses */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Widget 1: AGENT STATUS */}
            <div className="p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-[#D4A843]" /> AGENT STATUS
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {CONTROL_CENTER_METRICS.agentStatus.activePct}% Active
                </span>
              </div>

              <div className="flex items-center gap-5 my-4">
                {/* SVG Donut Chart */}
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    {/* Background circle */}
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#0D2745" strokeWidth="4" />
                    {/* Active: 78.7% */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="4"
                      strokeDasharray="69.2 100"
                      strokeDashoffset="0"
                    />
                    {/* Restricted: 14.8% */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="4"
                      strokeDasharray="13 100"
                      strokeDashoffset="-69.2"
                    />
                    {/* Offline: 3.3% */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="4"
                      strokeDasharray="3 100"
                      strokeDashoffset="-82.2"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-lg font-bold text-white block leading-none">61</span>
                    <span className="text-[9px] text-slate-400 uppercase font-mono">Agents</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs flex-1">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> Active
                    </span>
                    <strong className="text-white font-mono">{CONTROL_CENTER_METRICS.agentStatus.active}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> Human Review Req
                    </span>
                    <strong className="text-amber-300 font-mono">{CONTROL_CENTER_METRICS.agentStatus.humanReviewRequired}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-orange-400" /> Restricted
                    </span>
                    <strong className="text-orange-300 font-mono">{CONTROL_CENTER_METRICS.agentStatus.restricted}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-red-400" /> Offline
                    </span>
                    <strong className="text-red-300 font-mono">{CONTROL_CENTER_METRICS.agentStatus.offline}</strong>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                Critical Exceptions: <strong className="text-emerald-400">0</strong>
              </div>
            </div>

            {/* Widget 2: AI RUNS (TODAY) */}
            <div className="p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-[#D4A843]" /> AI RUNS (TODAY)
                </span>
                <span className="text-xs font-mono text-white font-bold">
                  {CONTROL_CENTER_METRICS.aiRunsToday.total.toLocaleString()} Total
                </span>
              </div>

              <div className="space-y-2.5 my-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Accepted Proposals
                  </span>
                  <strong className="text-white font-mono">
                    {CONTROL_CENTER_METRICS.aiRunsToday.acceptedProposals.toLocaleString()}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <XCircle className="w-3.5 h-3.5 text-red-400" /> Rejected Proposals
                  </span>
                  <strong className="text-white font-mono">{CONTROL_CENTER_METRICS.aiRunsToday.rejectedProposals}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" /> Pending Review
                  </span>
                  <strong className="text-amber-300 font-mono">{CONTROL_CENTER_METRICS.aiRunsToday.pendingReview}</strong>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" /> Human Escalations
                  </span>
                  <strong className="text-orange-300 font-mono">{CONTROL_CENTER_METRICS.aiRunsToday.humanEscalations}</strong>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800 flex justify-between">
                <span>Autonomous Acceptance:</span>
                <strong className="text-emerald-400">{CONTROL_CENTER_METRICS.aiRunsToday.acceptedPct}%</strong>
              </div>
            </div>

            {/* Widget 3: COMPLIANCE & RISK */}
            <div className="p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> COMPLIANCE &amp; RISK
                </span>
                <span className="text-[10px] font-mono text-slate-400">Last 24 Hours</span>
              </div>

              <div className="grid grid-cols-2 gap-3 my-3">
                <div className="p-2.5 rounded-xl bg-[#0A223D] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Unsupported Claims</span>
                  <span className="text-lg font-bold text-amber-300 font-mono">
                    {CONTROL_CENTER_METRICS.complianceRisk.unsupportedClaims}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0A223D] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Security Violations</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {CONTROL_CENTER_METRICS.complianceRisk.securityViolations}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0A223D] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Hallucination Flags</span>
                  <span className="text-lg font-bold text-amber-300 font-mono">
                    {CONTROL_CENTER_METRICS.complianceRisk.hallucinationFlags}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#0A223D] border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Policy Breaches</span>
                  <span className="text-lg font-bold text-emerald-400 font-mono">
                    {CONTROL_CENTER_METRICS.complianceRisk.policyBreaches}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                Circular 230 Enforcement: <strong className="text-emerald-400">Compliant</strong>
              </div>
            </div>
          </div>

          {/* ROW 2: Activity Timeline (Bar Chart) + Run Outcomes Donut + Token/Cost */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Activity Chart (Last 24 Hours) */}
            <div className="lg:col-span-6 p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#D4A843]" />
                  AGENT ACTIVITY (LAST 24 HOURS)
                </span>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-slate-300">
                    <span className="w-2 h-2 bg-blue-500 rounded" /> AI Runs
                  </span>
                  <span className="flex items-center gap-1 text-slate-300">
                    <span className="w-2 h-2 bg-amber-500 rounded" /> Escalations
                  </span>
                </div>
              </div>

              {/* Bar Chart Visualization */}
              <div className="h-44 flex items-end justify-between gap-1.5 pt-4 px-2">
                {CONTROL_CENTER_METRICS.activity24h.map((col, idx) => {
                  const maxRuns = 220;
                  const runHeight = (col.runs / maxRuns) * 100;
                  const escHeight = (col.escalations / 20) * 40;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="w-full flex items-end justify-center gap-0.5 h-32">
                        <div
                          style={{ height: `${runHeight}%` }}
                          className="w-full bg-blue-500 hover:bg-blue-400 rounded-t transition-all"
                        />
                        <div
                          style={{ height: `${escHeight}%` }}
                          className="w-1.5 bg-amber-500 rounded-t"
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400">{col.hour}</span>
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-900 border border-slate-700 p-1 rounded text-[10px] font-mono whitespace-nowrap z-20">
                        {col.runs} runs · {col.escalations} esc
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Run Outcomes Donut */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div className="border-b border-slate-700 pb-3">
                <span className="text-xs font-bold text-white">RUN OUTCOMES</span>
              </div>

              <div className="flex items-center justify-center my-3 relative">
                <div className="w-32 h-32 relative flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#0D2745" strokeWidth="4" />
                    {/* 83.7% Accepted */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="4"
                      strokeDasharray="73.6 100"
                      strokeDashoffset="0"
                    />
                    {/* 5.6% Rejected */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="4"
                      strokeDasharray="4.9 100"
                      strokeDashoffset="-73.6"
                    />
                    {/* 6.9% Pending */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="4"
                      strokeDasharray="6 100"
                      strokeDashoffset="-78.5"
                    />
                    {/* 3.8% Escalated */}
                    <circle
                      cx="18"
                      cy="18"
                      r="14"
                      fill="none"
                      stroke="#8B5CF6"
                      strokeWidth="4"
                      strokeDasharray="3.3 100"
                      strokeDashoffset="-84.5"
                    />
                  </svg>
                  <div className="absolute text-center">
                    <span className="text-base font-bold text-white block">3,824</span>
                    <span className="text-[9px] text-slate-400 font-mono">Runs</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" /> Accepted
                  </span>
                  <span className="font-mono text-white">83.7% (3,201)</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-red-400" /> Rejected
                  </span>
                  <span className="font-mono text-white">5.6% (213)</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Pending Review
                  </span>
                  <span className="font-mono text-white">6.9% (263)</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-purple-400" /> Escalated
                  </span>
                  <span className="font-mono text-white">3.8% (147)</span>
                </div>
              </div>
            </div>

            {/* Token / Cost Monitoring */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div className="border-b border-slate-700 pb-3">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  TOKEN / COST MONITORING
                </span>
              </div>

              <div className="space-y-4 my-2">
                <div className="p-3 rounded-xl bg-[#0A223D] border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">
                    Total Tokens (Today)
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-bold font-mono text-white">
                      {CONTROL_CENTER_METRICS.tokensCostToday.totalTokens}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 flex items-center">
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                      {CONTROL_CENTER_METRICS.tokensCostToday.tokensChangePct}%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#0A223D] border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-mono block">
                    Estimated Cost (USD)
                  </span>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-2xl font-bold font-mono text-[#D4A843]">
                      ${CONTROL_CENTER_METRICS.tokensCostToday.estimatedCost.toFixed(2)}
                    </span>
                    <span className="text-xs font-mono text-emerald-400 flex items-center">
                      <TrendingDown className="w-3 h-3 mr-0.5" />
                      {CONTROL_CENTER_METRICS.tokensCostToday.costChangePct}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800">
                Budget Cap: <strong className="text-white">$150.00 / day</strong>
              </div>
            </div>
          </div>

          {/* ROW 3: Top 5 Performance + Recent Exceptions + Security Events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Top 5 Agent Performance */}
            <div className="p-5 rounded-2xl bg-[#071A2E] border border-slate-700 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                <span className="text-xs font-bold text-white">
                  AGENT PERFORMANCE (TOP 5)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Acceptance</span>
              </div>
              <div className="divide-y divide-slate-800 text-xs">
                {CONTROL_CENTER_METRICS.topPerformingAgents.map(a => (
                  <div key={a.id} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">
                        <span className="font-mono text-[#D4A843] mr-1">{a.id}</span>
                        {a.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {a.runs} runs · avg {a.avgTime}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-mono font-bold block">
                        {a.acceptance}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {(a.confidence * 100).toFixed(0)}% conf
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Exceptions (Recent) */}
            <div className="p-5 rounded-2xl bg-[#071A2E] border border-slate-700 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  AGENT EXCEPTIONS (RECENT)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Severity</span>
              </div>
              <div className="divide-y divide-slate-800 text-xs">
                {CONTROL_CENTER_METRICS.recentExceptions.map((ex, i) => (
                  <div key={i} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-white">
                        <span className="font-mono text-[#D4A843] mr-1">{ex.agentId}</span>
                        {ex.type}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {ex.time} · {ex.status}
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        ex.severity === 'High'
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {ex.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Events (Recent) */}
            <div className="p-5 rounded-2xl bg-[#071A2E] border border-slate-700 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-red-400" />
                  SECURITY EVENTS (RECENT)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Status</span>
              </div>
              <div className="divide-y divide-slate-800 text-xs">
                {CONTROL_CENTER_METRICS.recentSecurityEvents.map((sec, i) => (
                  <div key={i} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-white truncate max-w-[190px]">
                        {sec.event}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {sec.time} · {sec.severity}
                      </div>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        sec.status === 'Resolved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : sec.status === 'Blocked'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {sec.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 4: Agent Lifecycle + Model Usage + Human Approval Queue + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Agent Lifecycle (Col 3) */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-white block border-b border-slate-700 pb-2 mb-3">
                  AGENT LIFECYCLE
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                    <span className="text-lg font-bold text-emerald-400 font-mono">48</span>
                    <span className="text-[10px] text-slate-400 block">Active</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30">
                    <span className="text-lg font-bold text-amber-300 font-mono">9</span>
                    <span className="text-[10px] text-slate-400 block">Restricted</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                    <span className="text-lg font-bold text-slate-400 font-mono">2</span>
                    <span className="text-[10px] text-slate-400 block">Disabled</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono pt-3 border-t border-slate-800">
                Total Catalog: <strong>61 Specialized Agents</strong>
              </div>
            </div>

            {/* Model Usage (Col 3) */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-white block border-b border-slate-700 pb-2 mb-3">
                  MODEL USAGE
                </span>
                <div className="space-y-2 text-xs">
                  {CONTROL_CENTER_METRICS.modelUsage.map(m => (
                    <div key={m.name}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-300">{m.name}</span>
                        <span className="font-mono text-white">{m.pct}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          style={{ width: `${m.pct}%`, backgroundColor: m.color }}
                          className="h-full rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono pt-3 border-t border-slate-800">
                Primary: <strong>GPT-4o / Claude 3.5 Sonnet</strong>
              </div>
            </div>

            {/* Human Approval Queue Summary (Col 3) */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-300" />
                    APPROVAL QUEUE
                  </span>
                  <span className="text-[10px] font-mono text-amber-300">
                    {CONTROL_CENTER_METRICS.humanApprovalQueue.changeTrend} today
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-amber-300 mb-2">
                  &gt; {CONTROL_CENTER_METRICS.humanApprovalQueue.totalPending} Pending
                </div>
                <div className="space-y-1 text-[11px]">
                  {CONTROL_CENTER_METRICS.humanApprovalQueue.categories.slice(0, 3).map(cat => (
                    <div key={cat.name} className="flex justify-between text-slate-300">
                      <span>{cat.name}</span>
                      <strong className="text-white font-mono">{cat.count}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveArea('human_approvals')}
                className="mt-2 w-full py-1.5 rounded-lg bg-[#0D2745] hover:bg-slate-700 text-[#D4A843] text-xs font-bold transition-colors flex items-center justify-center gap-1"
              >
                Inspect Queue <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Quick Actions (Col 3) */}
            <div className="lg:col-span-3 p-5 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-white block border-b border-slate-700 pb-2 mb-3">
                  QUICK ACTIONS
                </span>
                <div className="space-y-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveArea('agent_permissions')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#0A223D] hover:bg-slate-700 text-slate-200 transition-colors flex items-center justify-between"
                  >
                    <span>Manage Agent Permissions</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveArea('audit_logs')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-[#0A223D] hover:bg-slate-700 text-slate-200 transition-colors flex items-center justify-between"
                  >
                    <span>View AI Audit Logs (ai_run)</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveArea('kill_switch')}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-200 border border-red-500/30 transition-colors flex items-center justify-between font-semibold"
                  >
                    <span>Emergency Kill Switch</span>
                    <Power className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-slate-400 font-mono pt-3 border-t border-slate-800">
                Governance Mode: <strong className="text-white">Authoritative</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
