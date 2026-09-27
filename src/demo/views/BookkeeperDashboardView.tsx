/**
 * A/R Tax Services, LLC - Bookkeeper Demonstration Workspace
 * Bank feed categorization, Reconciliation with zero-variance verification, Month-End Close.
 */

import React, { useState, useEffect } from 'react';
import { DemoTransaction } from '../types';
import { demoDataStore } from '../services/DemoDataService';
import { Sparkles, CheckCircle, RefreshCw, Layers } from 'lucide-react';

interface BookkeeperDashboardViewProps {
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
  onOpenAiAssistant: () => void;
}

export const BookkeeperDashboardView: React.FC<BookkeeperDashboardViewProps> = ({ 
  activeNavId, 
  onSelectNav, 
  onOpenAiAssistant 
}) => {
  const [transactions, setTransactions] = useState<DemoTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'inbox' | 'reconciliation' | 'accounts' | 'close'>('inbox');
  const [reconciledNotice, setReconciledNotice] = useState(false);

  const currentTab = activeNavId && activeNavId !== 'default' ? activeNavId : activeTab;

  const refresh = () => {
    setTransactions(demoDataStore.getTransactions());
  };

  useEffect(() => {
    refresh();
    return demoDataStore.subscribe(refresh);
  }, []);

  const handleCategorize = (id: string, category: string) => {
    demoDataStore.updateTransactionCategory(id, category, 'Bookkeeper Verified');
    refresh();
  };

  const handleReconcileAll = () => {
    transactions.forEach(t => {
      demoDataStore.updateTransactionCategory(t.id, t.category, 'Reconciled');
    });
    setReconciledNotice(true);
    refresh();
    setTimeout(() => setReconciledNotice(false), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Client Accounting &amp; Advisory Services (CAS)
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Bookkeeping &amp; General Ledger Reconciliation Workspace
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Bookkeeping Assistant</span>
          </button>
        </div>
      </div>

      {reconciledNotice && (
        <div className="border border-black p-3 bg-neutral-50 text-xs font-bold text-black">
          Reconciliation verified: Ending Statement Balance matches General Ledger Cash with exactly $0.00 variance.
        </div>
      )}

      {/* Tab: Inbox / Overview */}
      {(currentTab === 'inbox' || currentTab === 'overview') && (
        <div className="border border-neutral-300 overflow-x-auto">
          <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-black">
              Unreconciled Bank &amp; Credit Card Transactions ({transactions.length})
            </span>
            <button
              onClick={handleReconcileAll}
              className="px-3 py-1 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800"
            >
              Verify &amp; Reconcile All Transactions
            </button>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-white text-[10px] font-mono uppercase text-neutral-600">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">Client</th>
                <th className="p-2.5">Description</th>
                <th className="p-2.5">Account</th>
                <th className="p-2.5">Assigned Category</th>
                <th className="p-2.5 text-right">Amount</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-neutral-50">
                  <td className="p-2.5 font-mono text-neutral-600">{t.date}</td>
                  <td className="p-2.5 font-medium text-black">{t.clientName}</td>
                  <td className="p-2.5 text-neutral-900">{t.description}</td>
                  <td className="p-2.5 font-mono text-neutral-600 text-[11px]">{t.account}</td>
                  <td className="p-2.5 text-neutral-800">{t.category}</td>
                  <td className={`p-2.5 font-mono font-bold text-right ${t.type === 'credit' ? 'text-black' : 'text-neutral-800'}`}>
                    {t.type === 'credit' ? '+' : '-'}${t.amount.toFixed(2)}
                  </td>
                  <td className="p-2.5">
                    <span className="border border-neutral-300 px-1.5 py-0.5 text-[10px] font-mono">
                      {t.status}
                    </span>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      onClick={() => handleCategorize(t.id, t.category)}
                      className="px-2 py-0.5 border border-neutral-300 hover:border-black text-[11px]"
                    >
                      Confirm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Reconciliation */}
      {currentTab === 'reconciliation' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white">
          <div className="border-b border-neutral-200 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black">
              Bank Reconciliation Workspace: First Citizens Commercial Checking
            </h3>
            <p className="text-xs text-neutral-600">Period Ending: December 31, 2025</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="border border-neutral-200 p-3 bg-neutral-50 space-y-1">
              <span className="font-bold text-neutral-500 uppercase text-[10px]">Statement Ending Balance</span>
              <div className="font-mono text-base font-bold text-black">$184,320.40</div>
            </div>
            <div className="border border-neutral-200 p-3 bg-neutral-50 space-y-1">
              <span className="font-bold text-neutral-500 uppercase text-[10px]">General Ledger Cleared Balance</span>
              <div className="font-mono text-base font-bold text-black">$184,320.40</div>
            </div>
            <div className="border border-black p-3 bg-white space-y-1">
              <span className="font-bold text-black uppercase text-[10px]">Reconciliation Variance</span>
              <div className="font-mono text-base font-bold text-black">$0.00 (Balanced)</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Chart of Accounts */}
      {currentTab === 'accounts' && (
        <div className="border border-neutral-300 p-4 space-y-3 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Standard Chart of Accounts (GAAP Tax-Basis Compliant)
          </h3>
          <div className="space-y-1 text-xs">
            <div className="p-2 border border-neutral-200 flex justify-between font-mono">
              <span>1010 • Commercial Operating Checking (Cash &amp; Equivalents)</span>
              <span>Asset</span>
            </div>
            <div className="p-2 border border-neutral-200 flex justify-between font-mono">
              <span>1200 • Accounts Receivable Trade</span>
              <span>Asset</span>
            </div>
            <div className="p-2 border border-neutral-200 flex justify-between font-mono">
              <span>1500 • Machinery &amp; Equipment (Section 179 Eligible)</span>
              <span>Asset</span>
            </div>
            <div className="p-2 border border-neutral-200 flex justify-between font-mono">
              <span>2010 • Accounts Payable Trade</span>
              <span>Liability</span>
            </div>
            <div className="p-2 border border-neutral-200 flex justify-between font-mono">
              <span>4010 • Professional Contracting Revenue</span>
              <span>Income</span>
            </div>
            <div className="p-2 border border-neutral-200 flex justify-between font-mono">
              <span>6010 • Officer Compensation (W-2 Wages)</span>
              <span>Expense</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Month-End Close */}
      {currentTab === 'close' && (
        <div className="border border-neutral-300 p-5 space-y-3 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Month-End Financial Close Verification Checklist
          </h3>
          <div className="space-y-2 text-xs">
            {[
              'Bank accounts and credit cards reconciled to third-party statements',
              'Undeposited funds account verified to have exactly zero balance',
              'Prepaid expenses and deferred revenue amortizations journalized',
              'Depreciation expense posted in accordance with MACRS / Book schedule',
              'Management trial balance package exported and delivered to CPA reviewer'
            ].map((step, idx) => (
              <label key={idx} className="flex items-center gap-2 p-2 border border-neutral-200 bg-neutral-50">
                <input type="checkbox" defaultChecked className="border border-black text-black" />
                <span className="font-medium text-black">{step}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
