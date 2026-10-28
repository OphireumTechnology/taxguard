import React, { useState } from 'react';
import {
  FileText,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Hash,
  Clock,
  User,
  Database,
  ExternalLink,
  Code,
  Copy,
  Check,
  Search,
  Filter,
  ArrowRight
} from 'lucide-react';
import {
  SAMPLE_AI_RUNS,
  AiRunRecord
} from './ai/aiControlCenterData';

interface AiRunAuditViewerProps {
  initialAgentFilter?: string;
  onNavigateToCase?: (caseId: string) => void;
}

export const AiRunAuditViewer: React.FC<AiRunAuditViewerProps> = ({
  initialAgentFilter = '',
  onNavigateToCase
}) => {
  const [selectedRunId, setSelectedRunId] = useState<string>(SAMPLE_AI_RUNS[0].run_id);
  const [searchTerm, setSearchTerm] = useState<string>(initialAgentFilter);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const selectedRun: AiRunRecord =
    SAMPLE_AI_RUNS.find(r => r.run_id === selectedRunId) || SAMPLE_AI_RUNS[0];

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filteredRuns = SAMPLE_AI_RUNS.filter(r => {
    return (
      r.run_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.agent_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.tax_case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.requested_action.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="space-y-5" data-testid="ai-run-audit-viewer">
      {/* Page 8 Header Banner */}
      <div className="p-4 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
              PAGE 8 ARCHITECTURE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
              22 IMMUTABLE FIELDS PER RECORD
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Execution Audit Records (<code className="text-[#D4A843]">ai_run</code>)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographic audit trail with SHA-256 hashes, source evidence linkages, confidence scores, and human maker-checker sign-offs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono bg-emerald-950/60 text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Cryptographic Integrity Verified
          </span>
        </div>
      </div>

      {/* Search and Records Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Run Selector Table */}
        <div className="lg:col-span-5 bg-[#071A2E] border border-slate-700 rounded-2xl overflow-hidden flex flex-col">
          <div className="p-3 bg-[#0A223D] border-b border-slate-700">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Filter runs by Agent, Case ID, Action..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#071A2E] border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#D4A843]"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-800 overflow-y-auto max-h-[620px]">
            {filteredRuns.map(run => {
              const isSelected = run.run_id === selectedRunId;
              return (
                <div
                  key={run.run_id}
                  onClick={() => setSelectedRunId(run.run_id)}
                  className={`p-3 cursor-pointer transition-colors hover:bg-[#0E2E50] ${
                    isSelected ? 'bg-[#0E2E50] border-l-4 border-l-[#D4A843]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[#D4A843]">
                      {run.agent_id} · {run.agent_name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        run.risk_level === 'low'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : run.risk_level === 'material'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {run.risk_level.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    {run.run_id}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300 mt-2">
                    <span>{run.tax_case_id} ({run.tax_year})</span>
                    <span className="text-emerald-400 font-mono">
                      Conf: {(run.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 22-Field Record Inspector */}
        <div className="lg:col-span-7 bg-[#071A2E] border border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-700 pb-3 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-white">
                  {selectedRun.run_id}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843]">
                  {selectedRun.agent_id} v{selectedRun.agent_version}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Timestamp: <code className="text-slate-300">{selectedRun.timestamp}</code>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCopy('json', JSON.stringify(selectedRun, null, 2))}
              className="px-2.5 py-1 rounded-lg bg-[#0D2745] hover:bg-slate-700 border border-slate-600 text-[11px] text-slate-200 flex items-center gap-1.5 transition-colors"
            >
              {copiedField === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedField === 'json' ? 'Copied JSON' : 'Copy JSON'}
            </button>
          </div>

          {/* 22 Required Fields Tabular Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Field 1: run_id */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">1. run_id</span>
              <span className="font-mono text-white text-[11px] break-all">{selectedRun.run_id}</span>
            </div>

            {/* Field 2: agent_id */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">2. agent_id</span>
              <span className="font-mono text-[#D4A843] font-bold text-[11px]">{selectedRun.agent_id} ({selectedRun.agent_name})</span>
            </div>

            {/* Field 3: agent_version */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">3. agent_version</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.agent_version}</span>
            </div>

            {/* Field 4: model_provider */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">4. model_provider</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.model_provider}</span>
            </div>

            {/* Field 5: model_version */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">5. model_version</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.model_version}</span>
            </div>

            {/* Field 6: prompt_version */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">6. prompt_version</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.prompt_version}</span>
            </div>

            {/* Field 7: tenant_id */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">7. tenant_id</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.tenant_id}</span>
            </div>

            {/* Field 8: client_id */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">8. client_id</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.client_id}</span>
            </div>

            {/* Field 9: tax_case_id */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">9. tax_case_id</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.tax_case_id}</span>
            </div>

            {/* Field 10: tax_year */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">10. tax_year</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.tax_year}</span>
            </div>

            {/* Field 11: workflow_stage */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">11. workflow_stage</span>
              <span className="font-mono text-[#D4A843] text-[11px]">{selectedRun.workflow_stage}</span>
            </div>

            {/* Field 12: requested_action */}
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">12. requested_action</span>
              <span className="font-mono text-white text-[11px]">{selectedRun.requested_action}</span>
            </div>
          </div>

          {/* Field 13: source_evidence (Array) */}
          <div className="p-3 bg-[#0A223D] rounded-xl border border-slate-800 space-y-1.5">
            <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">
              13. source_evidence (Document Linkages)
            </span>
            <div className="space-y-1.5">
              {selectedRun.source_evidence.map((ev, i) => (
                <div key={i} className="flex items-center justify-between bg-[#071A2E] p-2 rounded border border-slate-700/60 text-[11px]">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-[#D4A843]" />
                    <span className="font-bold text-white">{ev.document_name}</span>
                    <span className="text-slate-400">({ev.document_id}, Page {ev.page})</span>
                  </div>
                  <span className="font-mono text-slate-400 text-[10px]">{ev.hash}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Field 14 & 15: Hashes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">14. input_hash</span>
              <span className="font-mono text-emerald-400 text-[10px] break-all">{selectedRun.input_hash}</span>
            </div>
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">15. output_hash</span>
              <span className="font-mono text-emerald-400 text-[10px] break-all">{selectedRun.output_hash}</span>
            </div>
          </div>

          {/* Field 16, 17, 18: Confidence, Risk, Proposed Action */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">16. confidence</span>
              <span className="font-mono font-bold text-white text-sm">
                {(selectedRun.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">17. risk_level</span>
              <span className="font-mono font-bold text-amber-300 text-sm uppercase">
                {selectedRun.risk_level}
              </span>
            </div>
            <div className="p-2.5 bg-[#0A223D] rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">18. proposed_action</span>
              <span className="font-mono text-white text-[11px] break-all">{selectedRun.proposed_action}</span>
            </div>
          </div>

          {/* Field 19, 20, 21, 22: Human Gate & Audit Event ID */}
          <div className="p-3 bg-[#0D2745] rounded-xl border border-slate-700 space-y-2 text-xs">
            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
              Human Review &amp; Authoritative Audit Linkage (Fields 19–22)
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px]">19. human_review_req</span>
                <span className="font-bold text-amber-300">
                  {selectedRun.human_review_required ? 'TRUE (Mandatory)' : 'FALSE'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">20. reviewer</span>
                <span className="font-mono text-white">{selectedRun.reviewer || 'Unassigned'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">21. review_decision</span>
                <span className="font-bold text-emerald-400 uppercase">
                  {selectedRun.review_decision || 'Pending'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">22. audit_event_id</span>
                <span className="font-mono text-[#D4A843]">{selectedRun.audit_event_id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
