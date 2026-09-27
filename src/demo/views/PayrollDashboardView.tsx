/**
 * A/R Tax Services, LLC - Payroll Specialist Demonstration Workspace
 * Payroll registers, IRS Form 941/940 liabilities, W-2 & 1099 wage filings.
 */

import React, { useState } from 'react';
import { Sparkles, CheckCircle, FileText, DollarSign, Calendar } from 'lucide-react';

interface PayrollDashboardViewProps {
  onOpenAiAssistant: () => void;
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
}

export const PayrollDashboardView: React.FC<PayrollDashboardViewProps> = ({ 
  onOpenAiAssistant,
  activeNavId,
  onSelectNav
}) => {
  const [activeTabState, setActiveTabState] = useState<'registers' | 'form941' | 'liabilities' | 'yearend'>('registers');
  const activeTab = (activeNavId && ['registers', 'form941', 'liabilities', 'yearend'].includes(activeNavId))
    ? (activeNavId as 'registers' | 'form941' | 'liabilities' | 'yearend')
    : activeTabState;

  const handleSelectTab = (tabId: 'registers' | 'form941' | 'liabilities' | 'yearend') => {
    setActiveTabState(tabId);
    if (onSelectNav) {
      onSelectNav(tabId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Corporate Payroll &amp; Employment Tax Practice
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Payroll Compliance &amp; Form 941 Workpaper Workspace
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Payroll Assistant</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-300 flex flex-wrap gap-1 text-xs">
        {[
          { id: 'registers', label: 'Client Payroll Registers' },
          { id: 'form941', label: 'Form 941 (Quarterly Federal Return)' },
          { id: 'liabilities', label: 'Tax Deposit Liabilities & EFTPS' },
          { id: 'yearend', label: 'Year-End W-2 & 1099 Filings' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleSelectTab(tab.id as any)}
            className={`px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-black text-black font-bold'
                : 'border-transparent text-neutral-600 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'registers' && (
        <div className="border border-neutral-300 p-4 space-y-3 bg-white">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Client Compensation Summary: Perotti Capital Holdings LLC (Bi-Weekly Period)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-mono uppercase text-neutral-600">
                  <th className="p-2">Employee / Officer</th>
                  <th className="p-2">Gross Pay</th>
                  <th className="p-2">Fed Withholding</th>
                  <th className="p-2">Social Security</th>
                  <th className="p-2">Medicare</th>
                  <th className="p-2">SC State Withholding</th>
                  <th className="p-2 text-right">Net Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                <tr className="hover:bg-neutral-50">
                  <td className="p-2 font-bold text-black">Michael Perotti (Managing Member)</td>
                  <td className="p-2 font-mono">$4,807.69</td>
                  <td className="p-2 font-mono">$784.00</td>
                  <td className="p-2 font-mono">$298.08</td>
                  <td className="p-2 font-mono">$69.71</td>
                  <td className="p-2 font-mono">$288.46</td>
                  <td className="p-2 font-mono font-bold text-right">$3,367.44</td>
                </tr>
                <tr className="hover:bg-neutral-50">
                  <td className="p-2 font-bold text-black">David Vance (Operations Lead)</td>
                  <td className="p-2 font-mono">$3,076.92</td>
                  <td className="p-2 font-mono">$412.00</td>
                  <td className="p-2 font-mono">$190.77</td>
                  <td className="p-2 font-mono">$44.62</td>
                  <td className="p-2 font-mono">$169.23</td>
                  <td className="p-2 font-mono font-bold text-right">$2,260.30</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'form941' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            IRS Form 941 Quarterly Tax Return Workpaper (Q4 2025)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
              <span className="font-bold text-black">Line 2: Total Compensation &amp; Wages</span>
              <div className="font-mono text-base font-bold text-black">$51,250.00</div>
            </div>
            <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
              <span className="font-bold text-black">Line 3: Federal Income Tax Withheld</span>
              <div className="font-mono text-base font-bold text-black">$7,774.00</div>
            </div>
            <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1">
              <span className="font-bold text-black">Line 5e: Total Social Security &amp; Medicare</span>
              <div className="font-mono text-base font-bold text-black">$7,841.25</div>
            </div>
            <div className="p-3 border border-black bg-white space-y-1">
              <span className="font-bold text-black">Line 12: Total Taxes After Adjustments</span>
              <div className="font-mono text-base font-bold text-black">$15,615.25 (Reconciled)</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'liabilities' && (
        <div className="border border-neutral-300 p-4 space-y-3 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Federal Tax Deposit Schedule (EFTPS Semi-Weekly Schedule B)
          </h3>
          <div className="p-3 border border-neutral-200 bg-neutral-50 flex items-center justify-between">
            <div>
              <div className="font-bold text-black">Deposit Status: All Liabilities Remitted On-Time</div>
              <div className="text-[11px] text-neutral-600">No late-deposit penalties assessed under IRC § 6656.</div>
            </div>
            <span className="border border-black px-2 py-0.5 font-bold uppercase text-[10px]">
              EFTPS Compliant
            </span>
          </div>
        </div>
      )}

      {activeTab === 'yearend' && (
        <div className="border border-neutral-300 p-4 space-y-3 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Annual Form W-2 &amp; 1099-NEC Filing Pipeline (TY2025)
          </h3>
          <div className="space-y-2">
            <div className="p-2 border border-neutral-200 flex justify-between items-center">
              <span>Perotti Capital Holdings LLC (2 Form W-2s, 4 Form 1099-NECs)</span>
              <span className="border border-black px-2 py-0.5 text-[10px] font-bold">Transmitted to SSA/IRS</span>
            </div>
            <div className="p-2 border border-neutral-200 flex justify-between items-center">
              <span>Summit Dental Partners PC (6 Form W-2s, 2 Form 1099-MISC)</span>
              <span className="border border-black px-2 py-0.5 text-[10px] font-bold">Transmitted to SSA/IRS</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
