/**
 * A/R Tax Services, LLC — Accountant Bookkeeping & General Ledger Command Center
 * Integrated workspace for Bank Feeds, Transaction Review, General Ledger,
 * Bank Reconciliation, Trial Balance, Financial Statements, and Book-to-Tax.
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  DollarSign,
  Scale,
  Building2,
  Plus,
  Lock,
  Layers,
  Sparkles,
  Link,
  RefreshCw,
  FileText,
  AlertCircle
} from 'lucide-react';
import {
  bookkeepingService,
  ChartOfAccountItem,
  JournalEntryItem,
  BankTransactionItem,
  TrialBalanceReportItem,
  FinancialStatementsData
} from '../../services/bookkeepingService';

interface AccountantBookkeepingSectionProps {
  clientId: string;
  clientName: string;
  taxYear: number;
}

export const AccountantBookkeepingSection: React.FC<AccountantBookkeepingSectionProps> = ({
  clientId,
  clientName,
  taxYear
}) => {
  const [activeSubTab, setActiveSubTab] = useState<
    'transactions' | 'ledger' | 'coa' | 'reconciliation' | 'financials' | 'book_to_tax' | 'sync'
  >('transactions');

  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data state
  const [accounts, setAccounts] = useState<ChartOfAccountItem[]>([]);
  const [transactions, setTransactions] = useState<BankTransactionItem[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntryItem[]>([]);
  const [trialBalanceItems, setTrialBalanceItems] = useState<TrialBalanceReportItem[]>([]);
  const [financials, setFinancials] = useState<FinancialStatementsData | null>(null);

  // Reconciliation inputs
  const [statementStart, setStatementStart] = useState('2025-01-01');
  const [statementEnd, setStatementEnd] = useState('2025-01-31');
  const [begBalance, setBegBalance] = useState('10000.00');
  const [endBalance, setEndBalance] = useState('14500.00');
  const [clearedTxnIds, setClearedTxnIds] = useState<string[]>([]);

  // Sync state
  const [syncProvider, setSyncProvider] = useState<'QUICKBOOKS' | 'XERO'>('QUICKBOOKS');
  const [confirmationPhrase, setConfirmationPhrase] = useState('');
  const [syncStage, setSyncStage] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [coaRes, txnRes, jeRes, tbRes, finRes] = await Promise.all([
        bookkeepingService.getChartOfAccounts(clientId, taxYear).catch(() => ({ accounts: [] })),
        bookkeepingService.getTransactions(clientId).catch(() => ({ transactions: [] })),
        bookkeepingService.getJournalEntries(clientId, taxYear).catch(() => ({ entries: [] })),
        bookkeepingService.getTrialBalance(clientId, taxYear).catch(() => ({
          trialBalance: { items: [], isBalanced: true, totalEndingDebit: 0, totalEndingCredit: 0 }
        })),
        bookkeepingService.getFinancialStatements(clientId, taxYear).catch(() => ({ statements: null }))
      ]);

      setAccounts(coaRes.accounts);
      setTransactions(txnRes.transactions);
      setJournalEntries(jeRes.entries);
      setTrialBalanceItems(tbRes.trialBalance.items);
      setFinancials(finRes.statements);
    } catch (err: any) {
      setNotice({ type: 'error', message: err?.message || 'Failed to load bookkeeping data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [clientId, taxYear]);

  const handleApproveProposal = async (txn: BankTransactionItem) => {
    if (!txn.aiProposal) return;
    try {
      const res = await fetch(`/api/bookkeeping/transactions/${txn.id}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedAccountId: txn.aiProposal.suggestedAccountId,
          taxYear,
          notes: 'Accountant approved AI categorization proposal.'
        })
      });
      if (!res.ok) throw new Error('Failed to categorize transaction.');
      setNotice({ type: 'success', message: `Transaction "${txn.description}" posted to General Ledger.` });
      loadData();
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
    }
  };

  const handleToggleCleared = (txnId: string) => {
    setClearedTxnIds(prev =>
      prev.includes(txnId) ? prev.filter(id => id !== txnId) : [...prev, txnId]
    );
  };

  const clearedTotal = transactions
    .filter(t => clearedTxnIds.includes(t.id))
    .reduce((sum, t) => sum + t.amount, 0);

  const calculatedClearedBalance = Number(begBalance || 0) + clearedTotal;
  const currentVariance = calculatedClearedBalance - Number(endBalance || 0);

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#0D2745] border border-slate-700/60 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#D4A843]/10 border border-[#D4A843]/30">
            <FileSpreadsheet className="w-5 h-5 text-[#D4A843]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Bookkeeping &amp; General Ledger</span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-mono">
                TY{taxYear} &bull; Double-Entry
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Entity: <strong className="text-slate-200">{clientName}</strong> ({clientId}) &bull; Standard GAAP Taxonomy
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 bg-[#06182B] hover:bg-[#102D4F] border border-slate-700/60 rounded-xl text-xs text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#D4A843]' : 'text-slate-400'}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
          notice.type === 'success'
            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
            : 'bg-red-950/60 border-red-500/40 text-red-300'
        }`}>
          <span>{notice.message}</span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Sub-Navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 pb-2 text-xs">
        {[
          { id: 'transactions', label: 'Bank Feeds & Ingestion', icon: DollarSign },
          { id: 'ledger', label: 'General Ledger', icon: Layers },
          { id: 'coa', label: 'Chart of Accounts', icon: Building2 },
          { id: 'reconciliation', label: 'Reconciliation', icon: Scale },
          { id: 'financials', label: 'Trial Balance & Financials', icon: FileSpreadsheet },
          { id: 'book_to_tax', label: 'Schedule M-1 Bridge', icon: FileText },
          { id: 'sync', label: 'QuickBooks / Xero Sync', icon: Link },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-[#0D2745]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: BANK TRANSACTIONS */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing {transactions.length} ingested bank/credit-card transactions
            </span>
          </div>

          <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#071A2E] text-slate-400 uppercase font-mono text-[10px] border-b border-slate-700/60">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Classification</th>
                  <th className="px-4 py-3">AI Proposal</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 font-sans">
                      No bank transactions recorded. Ingest transactions via CSV or connected feed.
                    </td>
                  </tr>
                ) : (
                  transactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-[#102D4F]/40 transition-colors">
                      <td className="px-4 py-3 text-slate-400">{txn.transactionDate}</td>
                      <td className="px-4 py-3 font-bold text-white font-sans">{txn.description}</td>
                      <td className={`px-4 py-3 font-bold ${txn.amount >= 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {txn.amount >= 0 ? `+$${txn.amount.toFixed(2)}` : `-$${Math.abs(txn.amount).toFixed(2)}`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          txn.classificationStatus === 'POSTED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                        }`}>
                          {txn.classificationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-sans text-slate-300">
                        {txn.aiProposal ? (
                          <div className="flex items-center gap-1.5 text-amber-200/90">
                            <Sparkles className="w-3.5 h-3.5 text-[#D4A843]" />
                            <span>{txn.aiProposal.reasoning.slice(0, 45)}...</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-sans">
                        {txn.classificationStatus === 'AI_PROPOSED' && (
                          <button
                            type="button"
                            onClick={() => handleApproveProposal(txn)}
                            className="px-2.5 py-1 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            Approve &amp; Post
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: GENERAL LEDGER */}
      {activeSubTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">
              Posted Journal Entries ({journalEntries.length})
            </h3>
            {journalEntries.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No journal entries posted yet.</p>
            ) : (
              journalEntries.map((je) => (
                <div key={je.id} className="p-3 bg-[#06182B] rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white font-mono">{je.entryNumber} &bull; {je.description}</span>
                    <span className="text-[11px] text-[#D4A843] font-mono">
                      Debits: ${je.totalDebit.toFixed(2)} | Credits: ${je.totalCredit.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                    <div>Posting Date: <span className="text-white">{je.postingDate}</span></div>
                    <div>Source: <span className="text-white">{je.source}</span></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB: RECONCILIATION */}
      {activeSubTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#D4A843]" />
              <span>Bank Statement Reconciliation Gate</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Period Start</label>
                <input
                  type="date"
                  value={statementStart}
                  onChange={(e) => setStatementStart(e.target.value)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Period End</label>
                <input
                  type="date"
                  value={statementEnd}
                  onChange={(e) => setStatementEnd(e.target.value)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Statement Beg. Balance ($)</label>
                <input
                  type="number"
                  value={begBalance}
                  onChange={(e) => setBegBalance(e.target.value)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Statement Ending Balance ($)</label>
                <input
                  type="number"
                  value={endBalance}
                  onChange={(e) => setEndBalance(e.target.value)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2 text-white font-mono"
                />
              </div>
            </div>

            {/* Calculated variance metrics */}
            <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 grid grid-cols-3 gap-2 text-xs font-mono">
              <div>Cleared Total: <strong className="text-white">${clearedTotal.toFixed(2)}</strong></div>
              <div>Cleared Ending: <strong className="text-white">${calculatedClearedBalance.toFixed(2)}</strong></div>
              <div>
                Variance: <strong className={Math.abs(currentVariance) < 0.01 ? 'text-emerald-400' : 'text-red-400'}>
                  ${currentVariance.toFixed(2)}
                </strong>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={Math.abs(currentVariance) >= 0.01}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  Math.abs(currentVariance) < 0.01
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-[#06182B]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {Math.abs(currentVariance) < 0.01 ? 'Finalize & Lock Reconciliation' : 'Variance Must Equal $0.00 to Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: FINANCIAL STATEMENTS */}
      {activeSubTab === 'financials' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profit and Loss */}
            <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
                Income Statement / P&amp;L (TY{taxYear})
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Gross Receipts / Revenue:</span>
                  <span className="text-emerald-400 font-bold">${financials?.profitAndLoss.grossRevenue.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Cost of Goods Sold:</span>
                  <span>${financials?.profitAndLoss.costOfGoodsSold.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-1">
                  <span>Gross Profit:</span>
                  <span>${financials?.profitAndLoss.grossProfit.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Operating Expenses:</span>
                  <span>${financials?.profitAndLoss.totalOperatingExpenses.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-[#D4A843] font-bold border-t border-slate-800 pt-2 text-sm">
                  <span>Net Ordinary Income:</span>
                  <span>${financials?.profitAndLoss.netIncome.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>

            {/* Balance Sheet */}
            <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono border-b border-slate-800 pb-2">
                Balance Sheet (TY{taxYear})
              </h3>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Total Current Assets:</span>
                  <span className="text-emerald-400">${financials?.balanceSheet.assets.totalCurrentAssets.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-white font-bold border-t border-slate-800 pt-1">
                  <span>Total Assets:</span>
                  <span>${financials?.balanceSheet.assets.totalAssets.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-slate-300 border-t border-slate-800 pt-1">
                  <span>Total Liabilities:</span>
                  <span className="text-red-400">${financials?.balanceSheet.liabilities.totalLiabilities.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Total Retained Equity:</span>
                  <span className="text-emerald-400">${financials?.balanceSheet.equity.totalEquity.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-[#D4A843] font-bold border-t border-slate-800 pt-2 text-sm">
                  <span>Liabilities + Equity:</span>
                  <span>
                    ${((financials?.balanceSheet.liabilities.totalLiabilities || 0) + (financials?.balanceSheet.equity.totalEquity || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: QUICKBOOKS / XERO SYNC */}
      {activeSubTab === 'sync' && (
        <div className="space-y-4">
          <div className="bg-[#0D2745] border border-slate-700/60 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Link className="w-4 h-4 text-[#D4A843]" />
                <span>5-Stage Controlled Write Synchronization Pipeline</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                READ-ONLY DEFAULT ACTIVE
              </span>
            </div>

            <div className="p-3 bg-[#06182B] rounded-xl border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-white block">Security Invariant:</span>
              <p className="text-slate-400">
                Remote write-back to QuickBooks Online or Xero requires explicit certification across all 5 security gates.
                Confirmation phrase <code className="text-[#D4A843]">CONFIRM_WRITE_TO_LEDGER</code> is enforced.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <label className="text-slate-300 font-medium">Provider Target:</label>
                <select
                  value={syncProvider}
                  onChange={(e) => setSyncProvider(e.target.value as any)}
                  className="bg-[#06182B] border border-slate-700 rounded-lg px-2.5 py-1 text-white"
                >
                  <option value="QUICKBOOKS">QuickBooks Online</option>
                  <option value="XERO">Xero Accounting</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Stage 4 Explicit Confirmation Phrase:
                </label>
                <input
                  type="text"
                  placeholder='Type "CONFIRM_WRITE_TO_LEDGER"'
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await bookkeepingService.executeReadOnlySync(syncProvider, clientId);
                    setNotice({ type: 'success', message: `${syncProvider} Read-Only synchronization completed.` });
                  }}
                  className="px-3 py-1.5 bg-[#06182B] hover:bg-[#102D4F] border border-slate-700/60 rounded-xl text-xs text-slate-300 cursor-pointer"
                >
                  Execute Read-Only Sync
                </button>
                <button
                  type="button"
                  disabled={confirmationPhrase !== 'CONFIRM_WRITE_TO_LEDGER'}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    confirmationPhrase === 'CONFIRM_WRITE_TO_LEDGER'
                      ? 'bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B]'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Authorize Write-Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
