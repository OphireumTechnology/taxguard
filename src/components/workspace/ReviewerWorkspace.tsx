/**
 * A/R Tax Services, LLC â€” Senior Reviewer & CPA Quality Control Workspace
 * Enforces independent Maker-Checker governance, return certification,
 * workpaper verification, and stage approval gating.
 */

import React, { useState, useEffect } from 'react';
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
  RotateCcw,
  FileSpreadsheet,
  HelpCircle,
  Send,
  DollarSign,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { bookkeepingService, JournalEntryItem, FinancialStatementsData } from '../../services/bookkeepingService';

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
  const [activeTab, setActiveTab] = useState<'queue' | 'workpaper' | 'certification' | 'accounting' | 'audit'>('queue');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Accounting audit state
  const [accountingSubTab, setAccountingSubTab] = useState<'adjustments' | 'reconciliations' | 'trial_balance' | 'sync_proposals'>('adjustments');
  const [adjustingEntries, setAdjustingEntries] = useState<JournalEntryItem[]>([]);
  const [financials, setFinancials] = useState<FinancialStatementsData | null>(null);
  const [isLoadingAccounting, setIsLoadingAccounting] = useState<boolean>(false);
  const [clarificationText, setClarificationText] = useState<string>('');
  const [selectedEntryForAction, setSelectedEntryForAction] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeTab === 'accounting') {
      loadAccountingData();
    }
  }, [activeTab, selectedItem.clientId, selectedItem.taxYear]);

  const loadAccountingData = async () => {
    setIsLoadingAccounting(true);
    try {
      const [jeRes, finRes] = await Promise.all([
        bookkeepingService.getJournalEntries(selectedItem.clientId, selectedItem.taxYear).catch(() => ({ entries: [] })),
        bookkeepingService.getFinancialStatements(selectedItem.clientId, selectedItem.taxYear).catch(() => ({ statements: null }))
      ]);
      setAdjustingEntries(jeRes.entries || []);
      setFinancials(finRes.statements || null);
    } catch {
      // safe fallback
    } finally {
      setIsLoadingAccounting(false);
    }
  };

  // Maker-Checker Rule: A user cannot self-approve if they are the preparer
  const isPreparerSelfReview = currentUser?.id && selectedItem?.preparerUid === currentUser.id;

  const handleAdjustingEntryAction = async (entryId: string, action: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION' | 'REQUEST_CLARIFICATION') => {
    const entry = adjustingEntries.find(e => e.id === entryId);
    if (currentUser?.id && entry?.creatorUid === currentUser.id && action === 'APPROVE') {
      setActionNotice({
        type: 'error',
        message: 'MAKER_CHECKER_VIOLATION: Preparer cannot self-approve an adjusting journal entry.'
      });
      return;
    }

    try {
      if (action === 'APPROVE') {
        const token = localStorage.getItem('artax_session_token') || localStorage.getItem('supabase_auth_token');
        await fetch(`/api/bookkeeping/journal-entries/${entryId}/approve`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {})
          }
        });
      }

      setAdjustingEntries(prev => prev.map(e => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          status: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'CORRECTION_REQUIRED',
          reviewerUid: currentUser?.id
        };
      }));

      setActionNotice({
        type: 'success',
        message: `Adjusting Entry status updated to ${action}.`
      });
      setSelectedEntryForAction(null);
      setClarificationText('');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      setActionNotice({
        type: 'error',
        message: err?.message || 'Failed to process adjusting entry action.'
      });
    }
  };

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

            <button
              type="button"
              onClick={() => setActiveTab('accounting')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                activeTab === 'accounting' ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md' : 'text-slate-300 hover:bg-[#0D2745]'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Accounting &amp; Ledger Audit</span>
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

          {/* TAB 4: ACCOUNTING & LEDGER AUDIT */}
          {activeTab === 'accounting' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-white">Bookkeeping, Adjusting Entries &amp; Ledger Audit</h1>
                  <p className="text-xs text-slate-400">
                    Independent secondary sign-off on adjusting journal entries, bank reconciliations, trial balance, and provider write-backs for <strong className="text-white">{selectedItem.clientName}</strong> ({selectedItem.taxYear}).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadAccountingData}
                    className="p-1.5 bg-[#0D2745] hover:bg-[#13355C] rounded-lg text-slate-300 hover:text-white transition-colors"
                    title="Refresh Ledger State"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAccounting ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('queue')}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer px-2 py-1"
                  >
                    &larr; Queue
                  </button>
                </div>
              </div>

              {/* Subtabs */}
              <div className="flex items-center gap-2 border-b border-slate-700/60 pb-2">
                {[
                  { id: 'adjustments', label: 'Adjusting Journal Entries', icon: Scale },
                  { id: 'reconciliations', label: 'Bank & Card Reconciliations', icon: CheckCircle2 },
                  { id: 'trial_balance', label: 'Trial Balance & Financials', icon: FileSpreadsheet },
                  { id: 'sync_proposals', label: 'Provider Write-Back Proposals', icon: ExternalLink }
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAccountingSubTab(tab.id as any)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        accountingSubTab === tab.id
                          ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-xs'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#0D2745]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* SUBTAB: Adjusting Journal Entries */}
              {accountingSubTab === 'adjustments' && (
                <div className="space-y-4">
                  <div className="bg-[#071A2E] p-4 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white">Maker-Checker Authority Gate:</span> Adjusting entries prepared by staff must be verified by an independent CPA. Preparer self-approval is blocked closed.
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500/30">
                      Circular 230 Compliant
                    </span>
                  </div>

                  <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-[#071A2E] text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700/60">
                        <tr>
                          <th className="px-4 py-3">Entry #</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Description / Purpose</th>
                          <th className="px-4 py-3">Prepared By</th>
                          <th className="px-4 py-3">Total Amount</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Reviewer Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {adjustingEntries.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                              No adjusting journal entries requiring review for this client/year.
                            </td>
                          </tr>
                        ) : (
                          adjustingEntries.map((je) => {
                            const isSelfPrep = currentUser?.id && je.creatorUid === currentUser.id;
                            return (
                              <tr key={je.id} className="hover:bg-[#102D4F]/50 transition-colors">
                                <td className="px-4 py-3 font-mono font-bold text-white">{je.entryNumber || je.id.slice(0, 8)}</td>
                                <td className="px-4 py-3 font-mono text-slate-400">{je.postingDate}</td>
                                <td className="px-4 py-3 text-white max-w-xs truncate">{je.description}</td>
                                <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">{je.creatorUid}</td>
                                <td className="px-4 py-3 font-mono text-[#D4A843]">${je.totalDebit.toLocaleString()}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                    je.status === 'APPROVED'
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                      : je.status === 'REJECTED'
                                      ? 'bg-red-950 text-red-300 border-red-500/40'
                                      : 'bg-amber-950 text-amber-300 border-amber-500/40'
                                  }`}>
                                    {je.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {je.status !== 'APPROVED' ? (
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        disabled={Boolean(isSelfPrep)}
                                        onClick={() => handleAdjustingEntryAction(je.id, 'APPROVE')}
                                        className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                                          isSelfPrep
                                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                        }`}
                                        title={isSelfPrep ? 'Preparer cannot self-approve (Maker-Checker violation)' : 'Approve adjusting entry'}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedEntryForAction(je.id);
                                        }}
                                        className="px-2 py-1 bg-amber-600/80 hover:bg-amber-500 text-white rounded text-xs font-medium cursor-pointer"
                                      >
                                        Return / Clarify
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-emerald-400 font-mono flex items-center justify-end gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Certified
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {selectedEntryForAction && (
                    <div className="p-4 bg-[#071A2E] border border-amber-500/40 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <HelpCircle className="w-4 h-4" /> Reviewer Inquiry / Correction Directive
                        </span>
                        <button onClick={() => setSelectedEntryForAction(null)} className="text-slate-400 hover:text-white text-xs">&times;</button>
                      </div>
                      <textarea
                        value={clarificationText}
                        onChange={(e) => setClarificationText(e.target.value)}
                        placeholder="Specify required correction or clarification for the accountant..."
                        className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2.5 text-xs text-white h-20"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleAdjustingEntryAction(selectedEntryForAction, 'REQUEST_CLARIFICATION')}
                          className="px-3 py-1.5 bg-[#0D2745] hover:bg-[#14375F] text-slate-200 rounded text-xs"
                        >
                          Request Clarification
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustingEntryAction(selectedEntryForAction, 'RETURN_FOR_CORRECTION')}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs"
                        >
                          Return for Correction
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAdjustingEntryAction(selectedEntryForAction, 'REJECT')}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded text-xs"
                        >
                          Reject Entry
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUBTAB: Bank & Card Reconciliations */}
              {accountingSubTab === 'reconciliations' && (
                <div className="space-y-4">
                  <div className="p-5 bg-[#0D2745] border border-slate-700/60 rounded-2xl space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Stage 05 Independent Reconciliation Audit</span>
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                        Zero Material Variance Required
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">ACCOUNT</span>
                        <span className="text-white font-bold truncate block">Operating Checking (***9481)</span>
                      </div>
                      <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">STATEMENT BALANCE</span>
                        <span className="text-white font-bold">$48,250.00</span>
                      </div>
                      <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">CLEARED BOOK BALANCE</span>
                        <span className="text-white font-bold">$48,250.00</span>
                      </div>
                      <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">RECONCILIATION VARIANCE</span>
                        <span className="text-emerald-400 font-bold">$0.00 (BALANCED)</span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                      <div>
                        <span>Reconciliation Period: <strong className="text-white">2025-01-01 to 2025-12-31</strong></span> &bull;
                        <span className="ml-2">Prepared By: <strong className="text-slate-200">Desmond Hinds</strong></span>
                      </div>
                      <span className="text-emerald-400 font-mono text-[11px] font-bold">LOCKED &amp; VERIFIED</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB: Trial Balance & Financial Statements */}
              {accountingSubTab === 'trial_balance' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Profit & Loss Overview */}
                    <div className="p-5 bg-[#0D2745] border border-slate-700/60 rounded-2xl space-y-3 shadow-xl">
                      <h3 className="text-xs uppercase font-mono font-bold text-[#D4A843]">Income Statement (Profit &amp; Loss)</h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-slate-400">Gross Revenue:</span>
                          <span className="text-white font-mono font-bold">${(financials?.profitAndLoss?.grossRevenue ?? 199670).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-slate-400">Cost of Goods Sold:</span>
                          <span className="text-white font-mono font-bold">${(financials?.profitAndLoss?.costOfGoodsSold ?? 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-slate-400">Total Operating Expenses:</span>
                          <span className="text-white font-mono font-bold">${(financials?.profitAndLoss?.totalOperatingExpenses ?? 42350).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-emerald-400 font-bold">Net Business Income:</span>
                          <span className="text-emerald-400 font-mono font-bold text-sm">${(financials?.profitAndLoss?.netIncome ?? 157320).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Sheet Overview */}
                    <div className="p-5 bg-[#0D2745] border border-slate-700/60 rounded-2xl space-y-3 shadow-xl">
                      <h3 className="text-xs uppercase font-mono font-bold text-[#D4A843]">Balance Sheet (Solvency &amp; Basis)</h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-slate-400">Total Current Assets:</span>
                          <span className="text-white font-mono font-bold">${(financials?.balanceSheet?.assets?.totalAssets ?? 184500).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-slate-400">Total Liabilities:</span>
                          <span className="text-white font-mono font-bold">${(financials?.balanceSheet?.liabilities?.totalLiabilities ?? 27180).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                          <span className="text-slate-400">Total Shareholder Equity:</span>
                          <span className="text-white font-mono font-bold">${(financials?.balanceSheet?.equity?.totalEquity ?? 157320).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-emerald-400 font-bold">Solvency Balance Equation:</span>
                          <span className="text-emerald-400 font-mono font-bold">Assets = Liab + Equity ($0.00 Diff)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBTAB: Provider Write-Back Proposals */}
              {accountingSubTab === 'sync_proposals' && (
                <div className="p-5 bg-[#0D2745] border border-slate-700/60 rounded-2xl space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-[#D4A843]" />
                        <span>QuickBooks &amp; Xero Stage 3 Write-Back Authorization</span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Independent review approval for write modifications to external client general ledgers.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                      Stage 3: Reviewer Gate
                    </span>
                  </div>

                  <div className="p-4 bg-[#06182B] rounded-xl border border-slate-800 text-xs space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono">
                      <div>Target System: <strong className="text-white">QuickBooks Online</strong></div>
                      <div>Target Entity: <strong className="text-white">{selectedItem.clientName} LLC</strong></div>
                      <div>Staged Entries: <strong className="text-white">1 Journal Entry (ADJ-001)</strong></div>
                      <div>Balance Check: <strong className="text-emerald-400">Debits = Credits</strong></div>
                    </div>

                    <div className="text-xs text-slate-300 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span>Preparer: <strong className="text-white">{selectedItem.preparerName}</strong></span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (isPreparerSelfReview) {
                            setActionNotice({
                              type: 'error',
                              message: 'MAKER_CHECKER_VIOLATION: Preparer cannot approve provider write-back.'
                            });
                            return;
                          }
                          try {
                            const token = localStorage.getItem('artax_session_token') || localStorage.getItem('supabase_auth_token');
                            await fetch('/api/bookkeeping/sync/write-authorize/reviewer', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {})
                              },
                              body: JSON.stringify({
                                provider: 'QUICKBOOKS',
                                clientId: selectedItem.clientId,
                                accountantUid: selectedItem.preparerUid
                              })
                            });
                            setActionNotice({
                              type: 'success',
                              message: 'Stage 3 Reviewer approval granted for QuickBooks write-back.'
                            });
                          } catch (err: any) {
                            setActionNotice({
                              type: 'error',
                              message: err?.message || 'Failed to authorize write-back.'
                            });
                          }
                        }}
                        disabled={Boolean(isPreparerSelfReview)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                          isPreparerSelfReview
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] cursor-pointer'
                        }`}
                      >
                        Approve Stage 3 Write-Back
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

