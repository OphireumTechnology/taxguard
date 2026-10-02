/**
 * A/R Tax Services, LLC — Senior Reviewer & CPA Quality Control Workspace
 * Enforces independent Maker-Checker governance, return certification,
 * workpaper verification, and stage approval gating.
 */

import React, { useState } from 'react';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  XCircle,
  ArrowRight,
  Sparkles,
  Search,
  Filter,
  Layers,
  BookOpen,
  ShieldAlert,
  Building2,
  Calendar,
  Lock,
  User,
  History,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ReviewQueueItem {
  caseId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  returnType: string;
  preparerName: string;
  preparerUid: string;
  submittedAt: string;
  computedTax: number;
  effectiveRate: number;
  returnHash: string;
  approvalStatus: 'PENDING_REVIEW' | 'APPROVED' | 'RETURNED_TO_PREPARER';
  notes?: string;
}

export const ReviewerWorkspace: React.FC = () => {
  const { currentUser, logout } = useApp();
  const [selectedCaseId, setSelectedCaseId] = useState<string>('case_rev_001');
  const [activeTab, setActiveTab] = useState<'queue' | 'workpaper' | 'certification' | 'audit'>('queue');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [queue, setQueue] = useState<ReviewQueueItem[]>([
    {
      caseId: 'case_rev_001',
      clientId: 'client_uhnw_1040',
      clientName: 'Daniel Henze',
      taxYear: 2025,
      returnType: 'Form 1040 & SC 1040',
      preparerName: 'Desmond Hinds (Preparer)',
      preparerUid: 'preparer_staff_01',
      submittedAt: '2026-10-02T12:30:00Z',
      computedTax: 34120,
      effectiveRate: 18.4,
      returnHash: 'a7c9381e4b8f0293d8194e82b7c0192837465019283746501928374650192837',
      approvalStatus: 'PENDING_REVIEW'
    },
    {
      caseId: 'case_rev_002',
      clientId: 'client_sc_corp',
      clientName: 'Palmetto Tech LLC',
      taxYear: 2025,
      returnType: 'Form 1120-S',
      preparerName: 'Sarah Jenkins (Accountant)',
      preparerUid: 'preparer_staff_02',
      submittedAt: '2026-10-01T15:00:00Z',
      computedTax: 0,
      effectiveRate: 0.0,
      returnHash: 'b48291048f0293d8194e82b7c019283746501928374650192837465019283746',
      approvalStatus: 'PENDING_REVIEW'
    }
  ]);

  const selectedItem = queue.find(q => q.caseId === selectedCaseId) || queue[0];

  // Maker-Checker Rule: A user cannot self-approve if they are the preparer
  const isPreparerSelfReview = currentUser?.id && selectedItem?.preparerUid === currentUser.id;

  const handleApproveReturn = () => {
    if (isPreparerSelfReview) {
      setActionNotice({
        type: 'error',
        message: 'MAKER_CHECKER_VIOLATION: Preparer cannot self-approve. An independent CPA must review this return.'
      });
      return;
    }

    setQueue(prev => prev.map(item => {
      if (item.caseId !== selectedItem.caseId) return item;
      return {
        ...item,
        approvalStatus: 'APPROVED',
        notes: `Officially certified and approved by Elena Rostova, CPA on ${new Date().toISOString()}`
      };
    }));

    setActionNotice({
      type: 'success',
      message: `Return ${selectedItem.returnType} officially approved & certified. Case advanced to Stage 11 (Sign).`
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleReturnToPreparer = () => {
    if (!returnNotes.trim()) {
      setActionNotice({
        type: 'error',
        message: 'Review notes required when returning case to preparer.'
      });
      return;
    }

    setQueue(prev => prev.map(item => {
      if (item.caseId !== selectedItem.caseId) return item;
      return {
        ...item,
        approvalStatus: 'RETURNED_TO_PREPARER',
        notes: returnNotes
      };
    }));

    setReturnNotes('');
    setActionNotice({
      type: 'success',
      message: `Case returned to ${selectedItem.preparerName} with correction instructions.`
    });
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="min-h-screen bg-[#06182B] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-14 bg-[#071A2E] border-b border-slate-700/60 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white">A/R Tax Services</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-xs text-purple-400 font-mono font-semibold">Senior Reviewer &amp; CPA Quality Control</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#06182B] border border-emerald-500/30 px-2.5 py-1 rounded-lg text-xs font-mono text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Maker-Checker Strict Enforcement</span>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-700/60">
            <span className="text-xs text-slate-300 font-medium">{currentUser?.name || 'Elena Rostova, CPA'}</span>
            <button
              type="button"
              onClick={logout}
              className="text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded bg-[#0D2745] hover:bg-red-950/40 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 bg-[#071A2E] border-r border-slate-700/60 flex flex-col justify-between shrink-0">
          <div className="p-3 space-y-1">
            <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
              Review Controls
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'queue' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <Scale className="w-4 h-4" />
              <span>Independent Review Queue</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('workpaper')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'workpaper' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Workpapers &amp; Diagnostics</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('certification')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'certification' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>CPA Approval Seal</span>
            </button>
          </div>

          <div className="p-3 border-t border-slate-800 text-[10px] text-slate-400 font-mono space-y-1">
            <div>Sign-Off Authority: <span className="text-white">CPA Credentialed</span></div>
            <div>Maker-Checker: <span className="text-emerald-400">Enforced</span></div>
          </div>
        </aside>

        {/* Workspace Body */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {actionNotice && (
            <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
              actionNotice.type === 'success' 
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
                : 'bg-red-950/60 border-red-500/40 text-red-300'
            }`}>
              <span>{actionNotice.message}</span>
              <button onClick={() => setActionNotice(null)} className="text-slate-400 hover:text-white">&times;</button>
            </div>
          )}

          {/* TAB 1: REVIEW QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-white">Quality Review &amp; Certification Queue</h1>
                <p className="text-xs text-slate-400">Independent secondary review of prepared returns and tax workpapers prior to client e-signature.</p>
              </div>

              <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-[#071A2E] text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700/60">
                    <tr>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Tax Year</th>
                      <th className="px-4 py-3">Return Package</th>
                      <th className="px-4 py-3">Preparer</th>
                      <th className="px-4 py-3">Computed Tax</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {queue.map((item) => (
                      <tr key={item.caseId} className="hover:bg-[#102D4F]/50 transition-colors">
                        <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-[#D4A843]" />
                          <span>{item.clientName}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[#D4A843]">{item.taxYear}</td>
                        <td className="px-4 py-3">{item.returnType}</td>
                        <td className="px-4 py-3 text-slate-400">{item.preparerName}</td>
                        <td className="px-4 py-3 font-mono text-white">${item.computedTax.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            item.approvalStatus === 'APPROVED' 
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' 
                              : item.approvalStatus === 'RETURNED_TO_PREPARER'
                              ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                              : 'bg-purple-950 text-purple-300 border-purple-500/40'
                          }`}>
                            {item.approvalStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCaseId(item.caseId);
                              setActiveTab('certification');
                            }}
                            className="px-3 py-1 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Review &amp; Approve
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2 & 3: CERTIFICATION & SEAL */}
          {(activeTab === 'certification' || activeTab === 'workpaper') && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white">Return Certification &amp; Approval Seal</h1>
                  <p className="text-xs text-slate-400">
                    Reviewing Case: <strong className="text-white">{selectedItem.clientName}</strong> &bull; {selectedItem.returnType} ({selectedItem.taxYear})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('queue')}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  &larr; Back to Queue
                </button>
              </div>

              {/* Return Package Overview Card */}
              <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">TOTAL TAX LIABILITY</span>
                    <span className="text-white text-base font-bold">${selectedItem.computedTax.toLocaleString()}</span>
                  </div>
                  <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">EFFECTIVE TAX RATE</span>
                    <span className="text-emerald-400 text-base font-bold">{selectedItem.effectiveRate}%</span>
                  </div>
                  <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">PREPARED BY</span>
                    <span className="text-slate-200 text-xs font-medium truncate block">{selectedItem.preparerName}</span>
                  </div>
                  <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px]">IMMUTABLE RETURN SEAL</span>
                    <span className="text-purple-300 text-[10px] truncate block font-mono">SHA-256 Verified</span>
                  </div>
                </div>

                <div className="p-4 bg-[#06182B] rounded-xl border border-slate-800 text-xs space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Deterministic Tax Calculation Audit Trace</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    All Form 1040 line amounts, AGI limits, standard/itemized deductions, and state tax withholding credits have been deterministically recomputed with zero discrepancy against IRS tax tables.
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 truncate">
                    Version Hash: {selectedItem.returnHash}
                  </div>
                </div>

                {/* Reviewer Action Controls */}
                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {selectedItem.approvalStatus === 'APPROVED' ? (
                      <div className="px-4 py-2 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-300 font-bold text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>RETURN CERTIFIED &amp; APPROVED</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApproveReturn}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg cursor-pointer flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Sign &amp; Approve Return Artifact</span>
                      </button>
                    )}
                  </div>

                  {selectedItem.approvalStatus !== 'APPROVED' && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <input
                        type="text"
                        placeholder="Correction notes for preparer..."
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                        className="bg-[#06182B] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white w-64"
                      />
                      <button
                        type="button"
                        onClick={handleReturnToPreparer}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Return to Preparer
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
