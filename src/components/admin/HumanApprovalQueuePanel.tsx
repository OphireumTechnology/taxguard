import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Shield,
  UserCheck,
  ChevronRight,
  Filter,
  Check,
  Edit3,
  RotateCcw,
  Scale,
  DollarSign
} from 'lucide-react';

interface ProposalItem {
  id: string;
  agentId: string;
  agentName: string;
  category: 'Material Tax Positions' | 'Low Confidence' | 'Rule Conflicts' | 'Client Communications';
  caseId: string;
  taxYear: number;
  clientName: string;
  confidence: number;
  risk: 'HIGH' | 'MATERIAL' | 'MEDIUM';
  title: string;
  summary: string;
  evidenceSource: string;
  proposedChange: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MODIFIED';
}

const INITIAL_PROPOSALS: ProposalItem[] = [
  {
    id: 'PROP-2026-001',
    agentId: 'A22',
    agentName: 'Deduction Agent',
    category: 'Material Tax Positions',
    caseId: 'TAX-2026-000889',
    taxYear: 2024,
    clientName: 'Apex Logistics LLC',
    confidence: 0.76,
    risk: 'MATERIAL',
    title: 'Section 179 Expensing on Heavy Vehicle Fleet ($128,500)',
    summary: 'Agent proposes full Section 179 deduction on 3 newly acquired delivery vans (GVWR > 6,000 lbs). Net business income limit must be verified.',
    evidenceSource: 'DOC-441_Vehicle_Purchase_Agreements.pdf (Pages 2-4)',
    proposedChange: 'Schedule C Line 13: +$128,500 (Form 4562 Part I Line 6)',
    status: 'PENDING',
  },
  {
    id: 'PROP-2026-002',
    agentId: 'A07',
    agentName: 'OCR Extraction Agent',
    category: 'Low Confidence',
    caseId: 'TAX-2026-000456',
    taxYear: 2024,
    clientName: 'Sarah Jenkins',
    confidence: 0.64,
    risk: 'MEDIUM',
    title: 'Handwritten W-2 Box 12 Code D ($8,450)',
    summary: 'OCR extraction flagged Box 12 code as ambiguous between "D" (401k) and "E" (403b). Optical character variance requires human reviewer resolution.',
    evidenceSource: 'DOC-001_Scanned_W2.pdf (Box 12 Row 1)',
    proposedChange: 'Confirm Box 12 Code D: $8,450',
    status: 'PENDING',
  },
  {
    id: 'PROP-2026-003',
    agentId: 'A17',
    agentName: 'Tax Research Agent',
    category: 'Rule Conflicts',
    caseId: 'TAX-2026-000721',
    taxYear: 2024,
    clientName: 'Nexus BioHealth Inc',
    confidence: 0.82,
    risk: 'HIGH',
    title: 'Section 174 R&D Expense Amortization vs State Conformity',
    summary: 'Federal law requires mandatory 5-year amortization under TCJA, but California Revenue & Tax Code has not conformed. Multi-state schedule variance generated.',
    evidenceSource: 'CA Franchise Tax Board Notice 2023-04 & General Ledger Acct 6200',
    proposedChange: 'Federal Form 1065: Amortize 5-yr ($84,000); CA Schedule K-1: Deduct current ($420,000)',
    status: 'PENDING',
  },
  {
    id: 'PROP-2026-004',
    agentId: 'A43',
    agentName: 'Client Communication Agent',
    category: 'Client Communications',
    caseId: 'TAX-2026-000311',
    taxYear: 2024,
    clientName: 'David & Rachel Miller',
    confidence: 0.95,
    risk: 'MEDIUM',
    title: 'Missing Form 1098 Mortgage Interest Request Letter',
    summary: 'Taxpayer indicated owning primary residence with mortgage, but no Form 1098 uploaded. Agent drafted request letter explaining deductible interest requirements.',
    evidenceSource: 'Client Tax Questionnaire 2024 Item 14',
    proposedChange: 'Send portal notification requesting Form 1098 from lender',
    status: 'PENDING',
  },
];

export const HumanApprovalQueuePanel: React.FC = () => {
  const [proposals, setProposals] = useState<ProposalItem[]>(INITIAL_PROPOSALS);
  const [selectedProposalId, setSelectedProposalId] = useState<string>(INITIAL_PROPOSALS[0].id);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [feedbackNotes, setFeedbackNotes] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const selectedProposal = proposals.find(p => p.id === selectedProposalId) || proposals[0];

  const handleDecision = (decision: 'APPROVED' | 'REJECTED' | 'MODIFIED') => {
    setProposals(prev =>
      prev.map(p => (p.id === selectedProposalId ? { ...p, status: decision } : p))
    );
    setActionSuccess(`Proposal ${selectedProposalId} successfully marked as ${decision}. Audit record committed.`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const filtered = proposals.filter(p => {
    if (selectedCategory === 'All') return true;
    return p.category === selectedCategory;
  });

  return (
    <div className="space-y-5" data-testid="human-approval-queue-panel">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#071A2E] border border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
              MAKER-CHECKER CONTROL PLANE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
              263 PENDING PROPOSALS
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Human Approval Queue</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Page 4, 8 &amp; 10: Mandatory reviewer gates for material tax positions, low confidence extractions, and statutory rule conflicts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono bg-[#0D2745] text-slate-300 px-3 py-1.5 rounded-lg border border-slate-600">
            Escalation Rate: <strong className="text-amber-300">3.8%</strong>
          </span>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {['All', 'Material Tax Positions', 'Low Confidence', 'Rule Conflicts', 'Client Communications'].map(cat => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              selectedCategory === cat
                ? 'bg-[#D4A843] text-[#06182B]'
                : 'bg-[#0D2745] text-slate-300 hover:bg-slate-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Queue Split: Left List + Right Maker-Checker Review Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Proposal List */}
        <div className="lg:col-span-5 bg-[#071A2E] border border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-800">
          {filtered.map(item => {
            const isSelected = item.id === selectedProposalId;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedProposalId(item.id)}
                className={`p-4 cursor-pointer transition-colors hover:bg-[#0E2E50] ${
                  isSelected ? 'bg-[#0E2E50] border-l-4 border-l-[#D4A843]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#D4A843]">
                    {item.agentId} · {item.agentName}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.status === 'APPROVED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : item.status === 'REJECTED'
                        ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white mt-1.5 leading-snug">{item.title}</h4>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                  <span>{item.clientName}</span>
                  <span className="font-mono text-emerald-400">
                    Conf: {(item.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Proposal Inspection & Decision Desk */}
        <div className="lg:col-span-7 bg-[#071A2E] border border-slate-700 rounded-2xl p-5 space-y-4">
          <div className="flex items-start justify-between border-b border-slate-700 pb-3">
            <div>
              <span className="font-mono text-xs text-[#D4A843] block">
                {selectedProposal.id} · {selectedProposal.category}
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                {selectedProposal.title}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Case: <code className="text-slate-300">{selectedProposal.caseId}</code> ({selectedProposal.taxYear}) · Client: <strong className="text-white">{selectedProposal.clientName}</strong>
              </p>
            </div>
            <span
              className={`px-2 py-1 rounded text-xs font-mono font-bold ${
                selectedProposal.risk === 'HIGH'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {selectedProposal.risk} RISK
            </span>
          </div>

          {/* AI Analysis Summary */}
          <div className="p-3 bg-[#0D2745] rounded-xl border border-slate-700/80 space-y-1">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">
              AI Proposed Action &amp; Rationale
            </span>
            <p className="text-xs text-slate-200 leading-relaxed">
              {selectedProposal.summary}
            </p>
          </div>

          {/* Side-by-Side: Evidence vs Proposal Delta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-[#0A223D] rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-[#D4A843]" /> Source Evidence
              </span>
              <p className="text-slate-300 font-mono text-[11px] break-words">
                {selectedProposal.evidenceSource}
              </p>
            </div>

            <div className="p-3 bg-[#0A223D] rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-400" /> Proposed Return Delta
              </span>
              <p className="text-emerald-300 font-mono text-[11px] font-bold break-words">
                {selectedProposal.proposedChange}
              </p>
            </div>
          </div>

          {/* Reviewer Notes Input */}
          <div className="space-y-1.5 text-xs">
            <label className="text-[11px] font-bold text-slate-300 block">
              Maker-Checker Reviewer Justification &amp; Notes
            </label>
            <textarea
              rows={2}
              value={feedbackNotes}
              onChange={e => setFeedbackNotes(e.target.value)}
              placeholder="Enter rationale for approval, modification details, or reason for rejection..."
              className="w-full bg-[#071A2E] border border-slate-600 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#D4A843]"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleDecision('APPROVED')}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-colors"
            >
              <Check className="w-4 h-4" /> Approve Proposal
            </button>
            <button
              type="button"
              onClick={() => handleDecision('MODIFIED')}
              className="py-2 px-3 rounded-xl bg-[#0D2745] hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-4 h-4 text-amber-300" /> Modify &amp; Accept
            </button>
            <button
              type="button"
              onClick={() => handleDecision('REJECTED')}
              className="py-2 px-3 rounded-xl bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <XCircle className="w-4 h-4 text-red-400" /> Reject to Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
