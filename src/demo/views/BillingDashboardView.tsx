/**
 * A/R Tax Services, LLC - Billing & Collections Demonstration Workspace
 * Engagement fees, Accounts Receivable aging, Retainers, and simulated payments.
 */

import React, { useState, useEffect } from 'react';
import { DemoInvoice } from '../types';
import { demoDataStore } from '../services/DemoDataService';
import { SimulatedActionModal } from '../components/SimulatedActionModal';
import { DollarSign, FileText, CheckCircle, Clock, Sparkles, Calendar, Coins } from 'lucide-react';
import { EstimatedPaymentsCenter, AICreditUsageManager } from '../../taxguard';

interface BillingDashboardViewProps {
  onOpenAiAssistant: () => void;
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
}

export const BillingDashboardView: React.FC<BillingDashboardViewProps> = ({ 
  onOpenAiAssistant,
  activeNavId,
  onSelectNav
}) => {
  const [invoices, setInvoices] = useState<DemoInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<DemoInvoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const validTabs = ['invoices', 'estimated_pmts', 'ai_credits'];
  const [activeTabState, setActiveTabState] = useState<'invoices' | 'estimated_pmts' | 'ai_credits'>('invoices');
  const activeTab = (activeNavId && validTabs.includes(activeNavId))
    ? (activeNavId as 'invoices' | 'estimated_pmts' | 'ai_credits')
    : activeTabState;

  const handleSelectTab = (tabId: 'invoices' | 'estimated_pmts' | 'ai_credits') => {
    setActiveTabState(tabId);
    if (onSelectNav) {
      onSelectNav(tabId);
    }
  };

  const refresh = () => {
    setInvoices(demoDataStore.getInvoices());
  };

  useEffect(() => {
    refresh();
    return demoDataStore.subscribe(refresh);
  }, []);

  const totalBilled = invoices.reduce((acc, i) => acc + i.amount, 0);
  const totalBalanceDue = invoices.reduce((acc, i) => acc + i.balanceDue, 0);
  const totalCollected = totalBilled - totalBalanceDue;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Practice Revenue &amp; Treasury Management
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Invoicing, Retainers &amp; Accounts Receivable Workspace
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Billing Assistant</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-300 flex flex-wrap gap-1 text-xs">
        {[
          { id: 'invoices', label: 'Practice Invoices & Collections', icon: DollarSign },
          { id: 'estimated_pmts', label: 'Client Estimated Tax Vouchers (Safe-Harbor)', icon: Calendar },
          { id: 'ai_credits', label: 'Firm AI Credit Metering & Usage', icon: Coins }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id as any)}
              className={`px-3.5 py-2 font-medium transition-colors flex items-center gap-1.5 border-b-2 -mb-[1px] ${
                activeTab === tab.id
                  ? 'border-black text-black font-bold bg-neutral-50'
                  : 'border-transparent text-neutral-600 hover:text-black'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'invoices' && (
        <>
          {/* AR Aging Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="border border-neutral-200 p-4 bg-neutral-50 space-y-1">
          <span className="font-bold text-neutral-500 uppercase text-[10px]">Total Billed (Season)</span>
          <div className="font-mono text-xl font-bold text-black">${totalBilled.toLocaleString()}.00</div>
        </div>
        <div className="border border-neutral-200 p-4 bg-neutral-50 space-y-1">
          <span className="font-bold text-neutral-500 uppercase text-[10px]">Collections Settled</span>
          <div className="font-mono text-xl font-bold text-black">${totalCollected.toLocaleString()}.00</div>
        </div>
        <div className="border border-black p-4 bg-white space-y-1">
          <span className="font-bold text-black uppercase text-[10px]">Outstanding A/R Balance</span>
          <div className="font-mono text-xl font-bold text-black">${totalBalanceDue.toLocaleString()}.00</div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="border border-neutral-300 overflow-x-auto">
        <div className="p-3 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-black">
            Practice Invoices ({invoices.length})
          </span>
          <span className="text-[11px] font-mono text-neutral-500">
            Simulated Sandbox Billing
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-white text-[10px] font-mono uppercase text-neutral-600">
              <th className="p-2.5">Invoice #</th>
              <th className="p-2.5">Client</th>
              <th className="p-2.5">Service Description</th>
              <th className="p-2.5">Due Date</th>
              <th className="p-2.5 text-right">Fee</th>
              <th className="p-2.5 text-right">Balance Due</th>
              <th className="p-2.5">Status</th>
              <th className="p-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-neutral-50">
                <td className="p-2.5 font-mono font-bold text-black">{inv.invoiceNumber}</td>
                <td className="p-2.5 font-medium text-black">{inv.clientName}</td>
                <td className="p-2.5 text-neutral-700">{inv.description}</td>
                <td className="p-2.5 font-mono text-neutral-600">{inv.dueDate}</td>
                <td className="p-2.5 font-mono text-right">${inv.amount.toFixed(2)}</td>
                <td className="p-2.5 font-mono font-bold text-right text-black">${inv.balanceDue.toFixed(2)}</td>
                <td className="p-2.5">
                  <span className="border border-black px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase">
                    {inv.status}
                  </span>
                </td>
                <td className="p-2.5 text-right">
                  {inv.balanceDue > 0 ? (
                    <button
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setShowPaymentModal(true);
                      }}
                      className="px-2.5 py-1 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800"
                    >
                      Record Payment
                    </button>
                  ) : (
                    <span className="text-[11px] font-mono text-neutral-500 font-bold">Settled</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPaymentModal && selectedInvoice && (
        <SimulatedActionModal
          actionType="pay_invoice"
          invoice={selectedInvoice}
          userRole="billing"
          userName="Rachel Adams"
          onClose={() => setShowPaymentModal(false)}
          onCompleted={() => {
            refresh();
            setShowPaymentModal(false);
          }}
        />
      )}
        </>
      )}

      {/* Tab: Estimated Payments & Safe Harbor */}
      {activeTab === 'estimated_pmts' && (
        <div className="pt-1">
          <EstimatedPaymentsCenter userRole="billing" />
        </div>
      )}

      {/* Tab: AI Credit Usage & Metering */}
      {activeTab === 'ai_credits' && (
        <div className="pt-1">
          <AICreditUsageManager userRole="billing" />
        </div>
      )}
    </div>
  );
};
