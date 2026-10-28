import React, { useState, useMemo } from 'react';
import {
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  ExternalLink,
  ChevronRight,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  CANONICAL_61_AGENTS,
  CanonicalAgentDefinition
} from './ai/aiControlCenterData';

interface AgentRegistryViewProps {
  onSelectAgent?: (agentId: string) => void;
  onOpenAuditLogs?: (agentId: string) => void;
}

const CLUSTERS = [
  'All Clusters',
  'Supervisor',
  'Client Services',
  'Document Intelligence',
  'Accounting',
  'Tax Intelligence',
  'Risk & QC Control',
  'Sign / File / Resolve',
  'Practice Operations',
  'Governance, Security & Platform'
];

export const AgentRegistryView: React.FC<AgentRegistryViewProps> = ({
  onSelectAgent,
  onOpenAuditLogs
}) => {
  const [selectedCluster, setSelectedCluster] = useState<string>('All Clusters');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>('A07');
  const [activeTab, setActiveTab] = useState<'overview' | 'permissions' | 'stages'>('overview');

  const filteredAgents = useMemo(() => {
    return CANONICAL_61_AGENTS.filter(agent => {
      const matchesCluster =
        selectedCluster === 'All Clusters' || agent.cluster === selectedCluster;
      const matchesSearch =
        agent.agent_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.primary_responsibility.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agent.human_gate.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCluster && matchesSearch;
    });
  }, [selectedCluster, searchTerm]);

  const selectedAgent = useMemo(() => {
    return CANONICAL_61_AGENTS.find(a => a.agent_id === selectedAgentId) || CANONICAL_61_AGENTS[0];
  }, [selectedAgentId]);

  return (
    <div className="space-y-5" data-testid="complete-agent-registry-view">
      {/* Header with Title and Policy Guard */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#071A2E] border border-slate-700/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
              PAGE 2 &amp; 9 SPECIFICATION
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              61 REGISTERED AGENTS · ALL DRAFT
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Complete Agent Registry (A00–A60)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full canonical inventory across 7 functional clusters. Governed by fail-closed policy enforcement; no autonomous execution authority without verified human gate.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block">Fail-Closed Status</span>
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 justify-end">
              <ShieldCheck className="w-3.5 h-3.5" /> Deny-By-Default Active
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D2745] p-3 rounded-xl border border-slate-700">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            placeholder="Search by Agent ID, name, responsibility, or human gate..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-[#071A2E] border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#D4A843]"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {CLUSTERS.slice(0, 5).map(cluster => (
            <button
              key={cluster}
              type="button"
              onClick={() => setSelectedCluster(cluster)}
              className={`px-2.5 py-1 rounded-lg text-xs whitespace-nowrap transition-colors ${
                selectedCluster === cluster
                  ? 'bg-[#D4A843] text-[#06182B] font-bold'
                  : 'bg-[#071A2E] text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cluster}
            </button>
          ))}
          <select
            value={selectedCluster}
            onChange={e => setSelectedCluster(e.target.value)}
            className="bg-[#071A2E] text-slate-300 border border-slate-600 rounded-lg px-2 py-1 text-xs"
          >
            <option value="All Clusters">More Clusters...</option>
            {CLUSTERS.slice(5).map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Left Agent Table + Right Selected Agent Inspection Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Table: 61 Agent Listing */}
        <div className="lg:col-span-7 bg-[#071A2E] border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 bg-[#0A223D] border-b border-slate-700 flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#D4A843]" />
              Agent Workforce ({filteredAgents.length} matching)
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Tier 0–6 Hierarchy
            </span>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[640px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#091D33] text-slate-300 border-b border-slate-700">
                <tr>
                  <th scope="col" className="py-2.5 pl-4 pr-2 font-semibold">Agent</th>
                  <th scope="col" className="py-2.5 px-2 font-semibold">Name &amp; Cluster</th>
                  <th scope="col" className="py-2.5 px-2 font-semibold">Human Gate</th>
                  <th scope="col" className="py-2.5 px-2 font-semibold">Risk Class</th>
                  <th scope="col" className="py-2.5 pr-4 pl-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAgents.map(agent => {
                  const isSelected = selectedAgentId === agent.agent_id;
                  return (
                    <tr
                      key={agent.agent_id}
                      onClick={() => {
                        setSelectedAgentId(agent.agent_id);
                        if (onSelectAgent) onSelectAgent(agent.agent_id);
                      }}
                      className={`cursor-pointer transition-colors hover:bg-[#0E2E50] ${
                        isSelected ? 'bg-[#0E2E50] border-l-4 border-l-[#D4A843]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-4 pr-2 font-mono font-bold text-[#D4A843] whitespace-nowrap">
                        {agent.agent_id}
                        <span className="ml-1.5 text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
                          T{agent.tier}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-white">{agent.agent_name}</div>
                        <div className="text-[10px] text-slate-400">{agent.cluster}</div>
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                            agent.human_gate_required
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-700/60 text-slate-300'
                          }`}
                        >
                          {agent.human_gate_required && <Lock className="w-2.5 h-2.5" />}
                          {agent.human_gate}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            agent.risk_class === 'CRITICAL'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                              : agent.risk_class === 'HIGH'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                              : agent.risk_class === 'MATERIAL'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {agent.risk_class}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 pl-2 text-right">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedAgentId(agent.agent_id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-white"
                          aria-label={`Inspect ${agent.agent_name}`}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Drawer: Page 9 Deep Dive Inspection */}
        <div className="lg:col-span-5 bg-[#071A2E] border border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between border-b border-slate-700 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-[#D4A843]">
                  {selectedAgent.agent_id}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                  Tier {selectedAgent.tier} · {selectedAgent.cluster}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  DRAFT
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                {selectedAgent.agent_name}
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Required Gate</span>
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1 justify-end">
                <Lock className="w-3.5 h-3.5" />
                {selectedAgent.human_gate}
              </span>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                activeTab === 'overview'
                  ? 'bg-[#D4A843] text-[#06182B]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview &amp; Scope
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                activeTab === 'permissions'
                  ? 'bg-[#D4A843] text-[#06182B]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Page 9 CAN / CANNOT
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stages')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                activeTab === 'stages'
                  ? 'bg-[#D4A843] text-[#06182B]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Matrix &amp; Tools
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-[#0D2745] rounded-xl border border-slate-700/70">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">
                  Primary Responsibility
                </span>
                <p className="text-slate-200 leading-relaxed">
                  {selectedAgent.primary_responsibility}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#0A223D] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Risk Classification</span>
                  <span className="font-bold text-white text-sm">{selectedAgent.risk_class}</span>
                </div>
                <div className="p-3 bg-[#0A223D] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Execution Authority</span>
                  <span className="font-bold text-amber-300 text-sm">Non-Authoritative</span>
                </div>
              </div>

              <div className="p-3 bg-red-950/30 border border-red-500/30 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-red-300 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Regulatory Gate Notice</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Per Architecture Page 3 &amp; 9, {selectedAgent.agent_id} operates strictly under
                  A00 Orchestrator routing. Direct peer-to-peer invocation is prohibited. All material
                  tax proposals require sign-off by <strong>{selectedAgent.human_gate}</strong> before
                  binding state changes.
                </p>
              </div>

              {onOpenAuditLogs && (
                <button
                  type="button"
                  onClick={() => onOpenAuditLogs(selectedAgent.agent_id)}
                  className="w-full py-2 px-3 rounded-xl bg-[#0D2745] hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Inspect {selectedAgent.agent_id} Audit History
                </button>
              )}
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-4 text-xs">
              {/* CAN Permissions (Page 9 Left Column) */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wide">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>CAN (Allowed Permissions)</span>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {selectedAgent.can_permissions.map((perm, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-200 text-[11px]">
                      <span className="text-emerald-400 font-bold mt-0.5">•</span>
                      <span>{perm}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CANNOT Permissions (Page 9 Right Column) */}
              <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs uppercase tracking-wide">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>CANNOT (Restricted Permissions)</span>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {selectedAgent.cannot_permissions.map((perm, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-slate-200 text-[11px]">
                      <span className="text-red-400 font-bold mt-0.5">•</span>
                      <span>{perm}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'stages' && (
            <div className="space-y-4 text-xs">
              {/* Data Access Matrix */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Data Access Boundaries (Page 9)
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between p-2 bg-[#0A223D] rounded border border-slate-800">
                    <span className="text-slate-300">Read Client Data</span>
                    {selectedAgent.data_access.read_client_data ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#0A223D] rounded border border-slate-800">
                    <span className="text-slate-300">Read Documents</span>
                    {selectedAgent.data_access.read_documents ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#0A223D] rounded border border-slate-800">
                    <span className="text-slate-300">Read Accounting</span>
                    {selectedAgent.data_access.read_accounting ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#0A223D] rounded border border-slate-800">
                    <span className="text-slate-300">Read Tax Rules</span>
                    {selectedAgent.data_access.read_tax_rules ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#0A223D] rounded border border-slate-800">
                    <span className="text-slate-300">Write Staging</span>
                    {selectedAgent.data_access.write_staging ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-2 bg-[#0A223D] rounded border border-slate-800">
                    <span className="text-slate-300">Write Return Data</span>
                    {selectedAgent.data_access.write_return_data ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Actions & Tools */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Authoritative Action Restrictions
                </span>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="p-2 bg-[#0A223D] rounded border border-slate-800 text-center">
                    <span className="block text-slate-400">Modify Return</span>
                    <span className={`font-bold ${selectedAgent.allowed_actions.modify_return ? 'text-amber-300' : 'text-slate-500'}`}>
                      {selectedAgent.allowed_actions.modify_return ? 'Restricted' : 'Denied'}
                    </span>
                  </div>
                  <div className="p-2 bg-[#0A223D] rounded border border-slate-800 text-center">
                    <span className="block text-slate-400">File Return</span>
                    <span className={`font-bold ${selectedAgent.allowed_actions.file_return ? 'text-amber-300' : 'text-red-400'}`}>
                      {selectedAgent.allowed_actions.file_return ? 'Explicit Auth' : 'Forbidden'}
                    </span>
                  </div>
                  <div className="p-2 bg-[#0A223D] rounded border border-slate-800 text-center">
                    <span className="block text-slate-400">Sign Return</span>
                    <span className="font-bold text-red-400">Forbidden</span>
                  </div>
                </div>
              </div>

              {/* Workflow Stage Eligibility */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  Workflow Stage Presence (Collect / Validate / Prepare / Review / File)
                </span>
                <div className="flex items-center gap-1.5">
                  {(['collect', 'validate', 'prepare', 'review', 'file'] as const).map(stage => {
                    const active = selectedAgent.workflow_stages[stage];
                    return (
                      <div
                        key={stage}
                        className={`flex-1 py-1.5 px-1 rounded text-center font-mono text-[10px] font-bold uppercase ${
                          active
                            ? 'bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40'
                            : 'bg-slate-800/40 text-slate-600'
                        }`}
                      >
                        {stage}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
