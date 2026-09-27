/**
 * A/R Tax Services, LLC - Consolidated Workpaper Center
 * Sections 11, 12, 13, 14, 15, 16, 17, 18:
 * Income Summary, Tax Payments, Business, Rental, Investments, and Deductions/Credits.
 */

import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  DollarSign, 
  Building2, 
  Home, 
  TrendingUp, 
  Receipt, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  Info,
  CheckSquare,
  Square,
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';

interface WorkpaperCenterProps {
  isDark: boolean;
  onNavigateToDocs?: () => void;
}

export const WorkpaperCenter: React.FC<WorkpaperCenterProps> = ({ isDark, onNavigateToDocs }) => {
  const [activeTab, setActiveTab] = useState<'income' | 'payments' | 'business' | 'rental' | 'investments' | 'deductions'>('income');
  
  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();
  const incomeItems = accountantCenterService.getIncomeWorkpaper();
  const paymentItems = accountantCenterService.getPaymentReconciliation();
  const businessProfile = accountantCenterService.getBusinessProfile();
  const rentalProperties = accountantCenterService.getRentalProperties();
  const investmentAccounts = accountantCenterService.getInvestmentAccounts();
  const deductionCredits = accountantCenterService.getDeductionsCredits();

  // Income summary math
  const totalGrossIncome = incomeItems.reduce((acc, i) => acc + i.grossAmount, 0);
  const totalFedWithholding = incomeItems.reduce((acc, i) => acc + i.federalWithholding, 0);
  const totalStateWithholding = incomeItems.reduce((acc, i) => acc + i.stateWithholding, 0);

  // Payments summary math
  const totalEstimatedFed = paymentItems
    .filter(p => p.paymentType.includes('Estimated Payment') || p.paymentType.includes('Federal Withholding'))
    .reduce((acc, p) => acc + p.amount, 0);

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  const handleVerifyIncome = (id: string) => {
    accountantCenterService.verifyIncomeItem(id, 'Verified');
  };

  const handleTogglePayment = (id: string, currentVal: boolean) => {
    accountantCenterService.verifyPaymentItem(id, !currentVal);
  };

  const handleToggleBusinessCheck = (itemKey: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Received' ? 'Missing' : currentStatus === 'Missing' ? 'Not Applicable' : 'Received';
    accountantCenterService.toggleBusinessChecklist(itemKey, nextStatus as any);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Sections 11–18 &bull; Lead Tax Workpapers &amp; Schedules
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
            Accountant Workpaper Center &bull; {client.name} (TY{taxYear})
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Cross-functional workpapers dynamically linked to source tax documents and modern IRS schedules.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setActiveTab('income')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'income' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            11. Income Summary
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'payments' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            12. Payments / WH
          </button>
          <button
            onClick={() => setActiveTab('business')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'business' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            13-14. Business
          </button>
          <button
            onClick={() => setActiveTab('rental')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'rental' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            15-16. Rental
          </button>
          <button
            onClick={() => setActiveTab('investments')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'investments' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            17. Investments
          </button>
          <button
            onClick={() => setActiveTab('deductions')}
            className={`px-3 py-1.5 rounded font-bold border transition-colors ${
              activeTab === 'deductions' 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            18. Deductions
          </button>
        </div>
      </div>

      {/* TAB 11: CONSOLIDATED INCOME WORKPAPER */}
      {activeTab === 'income' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
                11. Consolidated Income Summary Workpaper
              </h3>
              <p className={`text-xs ${textSecondary}`}>
                Aggregated documented income streams extracted from confirmed source forms.
              </p>
            </div>
            <span className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700">
              Tax Year: CY{taxYear}
            </span>
          </div>

          <div className="border rounded overflow-x-auto border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="p-3">Source &amp; Doc ID</th>
                  <th className="p-3">Income Type</th>
                  <th className="p-3">Payer / Source Entity</th>
                  <th className="p-3 text-right">Gross Amount</th>
                  <th className="p-3 text-right">Fed Withholding</th>
                  <th className="p-3 text-right">State Withholding</th>
                  <th className="p-3 text-center">AI Conf.</th>
                  <th className="p-3">Accountant Verification</th>
                  <th className="p-3">Audit Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {incomeItems.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="p-3 font-mono">
                      <div className="font-bold text-neutral-900 dark:text-white">{item.sourceDocId}</div>
                      <div className="text-[10px] text-neutral-500">{item.sourceDocName}</div>
                    </td>
                    <td className="p-3 font-medium text-neutral-800 dark:text-neutral-200">
                      {item.incomeType}
                    </td>
                    <td className="p-3 font-medium text-neutral-700 dark:text-neutral-300">
                      {item.payerName}
                    </td>
                    <td className="p-3 font-mono text-right font-bold text-neutral-900 dark:text-white">
                      ${item.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-mono text-right text-neutral-700 dark:text-neutral-300">
                      {item.federalWithholding > 0 
                        ? `$${item.federalWithholding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="p-3 font-mono text-right text-neutral-700 dark:text-neutral-300">
                      {item.stateWithholding > 0 
                        ? `$${item.stateWithholding.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="p-3 text-center font-mono text-[10px]">
                      {item.aiConfidence.toFixed(1)}%
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          item.verificationStatus === 'Verified' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {item.verificationStatus}
                        </span>
                        {item.verificationStatus !== 'Verified' && (
                          <button
                            onClick={() => handleVerifyIncome(item.id)}
                            className="px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold uppercase rounded hover:opacity-80"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-neutral-500 text-[11px]">
                      {item.notes || 'Reconciled against source scan'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Totals (Section 11 Mandatory Metrics & Disclaimer) */}
          <div className="p-4 bg-neutral-100/70 dark:bg-neutral-800/60 border rounded border-neutral-300 dark:border-neutral-700 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-neutral-500 block">Total Documented Sources</span>
                <span className="text-base font-bold text-neutral-900 dark:text-white">{incomeItems.length} Sources</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-neutral-500 block">Total Extracted Gross Amount</span>
                <span className="text-base font-bold text-neutral-900 dark:text-white">
                  ${totalGrossIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-neutral-500 block">Total Federal Withholding</span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  ${totalFedWithholding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-neutral-500 block">Total State Withholding</span>
                <span className="text-base font-bold text-neutral-800 dark:text-neutral-200">
                  ${totalStateWithholding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-300 dark:border-neutral-700 flex items-start gap-2 text-[11px] text-amber-800 dark:text-amber-300">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>CRITICAL STATUTORY DISCLAIMER:</strong> Do NOT represent this extracted total as final taxable income or final tax liability. Statutory adjustments (e.g. Schedule C deductions, MACRS rental depreciation, IRA adjustments, standard/itemized deductions) must be computed in the preparation schedule before taxable amounts are derived.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 12: WITHHOLDING & TAX PAYMENT RECONCILIATION */}
      {activeTab === 'payments' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
              12. Tax Payment &amp; Estimated Withholding Reconciliation
            </h3>
            <p className={`text-xs ${textSecondary}`}>
              Audit schedule of Federal, State, and quarterly estimated tax voucher payments.
            </p>
          </div>

          <div className="border rounded overflow-x-auto border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="p-3">Payment Type</th>
                  <th className="p-3">Source Document</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3 text-center">AI Conf.</th>
                  <th className="p-3 text-center">Accountant Verification</th>
                  <th className="p-3">Reference / Confirmation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {paymentItems.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="p-3 font-bold text-neutral-900 dark:text-white">
                      {p.paymentType}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                      {p.sourceDocName}
                    </td>
                    <td className="p-3 font-mono">{p.paymentDate}</td>
                    <td className="p-3 font-mono text-right font-bold text-neutral-900 dark:text-white">
                      ${p.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center font-mono text-[10px]">
                      {p.aiConfidence.toFixed(1)}%
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleTogglePayment(p.id, p.accountantVerified)}
                        className={`px-2.5 py-0.5 rounded font-mono text-[10px] font-bold border transition-colors ${
                          p.accountantVerified
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-400'
                            : 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                        }`}
                      >
                        {p.accountantVerified ? '✓ VERIFIED' : 'UNVERIFIED'}
                      </button>
                    </td>
                    <td className="p-3 text-neutral-500 font-mono text-[10px]">
                      {p.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-neutral-100/70 dark:bg-neutral-800/60 border rounded border-neutral-300 dark:border-neutral-700 flex justify-between items-center text-xs font-mono">
            <div>
              <span className="text-neutral-500 uppercase">Total Federal Tax Payments Documented:</span>
              <strong className="text-base text-neutral-900 dark:text-white ml-2">
                ${totalEstimatedFed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="text-emerald-700 dark:text-emerald-300 font-bold">
              Safe Harbor Provision: SATISFIED (&gt;110% of prior year tax liability)
            </span>
          </div>
        </div>
      )}

      {/* TAB 13 & 14: BUSINESS WORKPAPER & COMPLETENESS CHECKLIST */}
      {activeTab === 'business' && (
        <div className="space-y-6">
          {businessProfile ? (
            <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-5`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="text-[10px] font-mono uppercase text-neutral-500">
                    13. Business Profile &amp; Entity Intelligence
                  </div>
                  <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
                    {businessProfile.legalName} ({businessProfile.entityType})
                  </h3>
                  <p className={`text-xs ${textSecondary}`}>
                    EIN: <span className="font-mono">{businessProfile.einIndicator}</span> &bull; Activity: {businessProfile.businessActivity} &bull; Accounting Method: {businessProfile.accountingMethod}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 border rounded font-bold">
                    Ownership: {businessProfile.ownershipPercentage}%
                  </span>
                </div>
              </div>

              {/* Financial Summary Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-neutral-500">
                  Business Financial Summary (Cash Basis P&amp;L)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="text-[10px] text-neutral-500 uppercase block">Gross Receipts</span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">
                      ${businessProfile.grossReceipts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="text-[10px] text-neutral-500 uppercase block">Contractors</span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">
                      ${businessProfile.contractorExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                    <span className="text-[10px] text-neutral-500 uppercase block">Vehicle Expense</span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-white">
                      ${businessProfile.vehicleExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 border rounded bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase block font-bold">
                      Net Schedule C Profit
                    </span>
                    <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                      ${(businessProfile.grossReceipts - 28450).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 14: BUSINESS DOCUMENT COMPLETENESS CHECKLIST */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-neutral-500">
                    14. Business Document Completeness Checklist (Click Item to Toggle or Review)
                  </h4>
                  <span className="text-[10px] font-mono text-neutral-400">Interactive Checklist</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                  {businessProfile.completeness.map((item) => (
                    <div 
                      key={item.itemKey}
                      onClick={() => handleToggleBusinessCheck(item.itemKey, item.status)}
                      className="p-3 border rounded cursor-pointer hover:border-black dark:hover:border-white transition-all flex items-center justify-between border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40"
                    >
                      <div>
                        <div className="font-bold text-neutral-900 dark:text-white">{item.label}</div>
                        {item.supportingDocName && (
                          <div className="text-[10px] text-neutral-500 truncate max-w-[180px]">
                            {item.supportingDocName}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.status === 'Received'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : item.status === 'Missing'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
                      }`}>
                        [{item.status}]
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className={`p-8 border rounded-lg text-center text-neutral-500 font-mono text-xs ${cardBg}`}>
              No active business entity registered for this taxpayer profile.
            </div>
          )}
        </div>
      )}

      {/* TAB 15 & 16: RENTAL PROPERTY WORKPAPER & RECONCILIATION */}
      {activeTab === 'rental' && (
        <div className="space-y-6">
          {rentalProperties.map((prop) => (
            <div key={prop.id} className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-neutral-200 dark:border-neutral-800">
                <div>
                  <div className="text-[10px] font-mono uppercase text-neutral-500">
                    15. Rental Property Profile &bull; Schedule E
                  </div>
                  <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
                    {prop.address}
                  </h3>
                  <p className={`text-xs ${textSecondary}`}>
                    Acquisition: {prop.acquisitionDate} &bull; Basis: ${prop.purchasePrice.toLocaleString()} &bull; Ownership: {prop.ownershipPercentage}%
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-bold self-start sm:self-auto">
                  ✓ Schedule E Ready
                </span>
              </div>

              {/* Rental Math */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="text-[10px] text-neutral-500 uppercase block">Gross Rents Received</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    ${prop.rentalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="text-[10px] text-neutral-500 uppercase block">Mortgage Interest</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    ${prop.mortgageInterest.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="text-[10px] text-neutral-500 uppercase block">Property Taxes &amp; Ins.</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    ${(prop.propertyTaxes + prop.insurance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-3 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="text-[10px] text-neutral-500 uppercase block">Management &amp; Repairs</span>
                  <span className="text-sm font-bold text-neutral-900 dark:text-white">
                    ${(prop.managementFees + prop.repairs).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* 16. Rental Reconciliation Matrix */}
              <div className="p-4 border rounded border-neutral-300 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-2 text-xs font-mono">
                <h4 className="font-bold text-neutral-900 dark:text-neutral-100 uppercase">
                  16. Rental Reconciliation Check
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>Income Doc: <strong className="text-emerald-600">[Received]</strong></div>
                  <div>Expense Docs: <strong className="text-emerald-600">[Received]</strong></div>
                  <div>Property Info: <strong className="text-emerald-600">[Complete]</strong></div>
                  <div>Prior-Year Comparison: <strong className="text-emerald-600">[Reconciled +5.9%]</strong></div>
                </div>
              </div>
            </div>
          ))}

          {rentalProperties.length === 0 && (
            <div className={`p-8 border rounded-lg text-center text-neutral-500 font-mono text-xs ${cardBg}`}>
              No rental properties associated with active client file.
            </div>
          )}
        </div>
      )}

      {/* TAB 17: INVESTMENT WORKPAPER */}
      {activeTab === 'investments' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
              17. Investment &amp; Brokerage Workpaper
            </h3>
            <p className={`text-xs ${textSecondary}`}>
              Securities, capital gains/losses, digital assets indicators, and 1099-B reconciliation.
            </p>
          </div>

          {investmentAccounts.map((inv) => (
            <div key={inv.id} className="p-4 border rounded border-neutral-300 dark:border-neutral-700 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-sm text-neutral-900 dark:text-white">
                    {inv.institution} ({inv.accountNumberMasked})
                  </div>
                  <div className="text-xs text-neutral-500 font-mono">
                    Account Type: {inv.accountType} &bull; Tax Year: {inv.taxYear}
                  </div>
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-mono text-[10px] font-bold">
                  RECONCILED
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="text-[10px] text-neutral-500 block">Form 1099-B</span>
                  <span className="font-bold text-emerald-600">{inv.has1099B ? '✓ Received' : 'Missing'}</span>
                </div>
                <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="text-[10px] text-neutral-500 block">Net ST Capital Loss</span>
                  <span className="font-bold text-red-600">(${Math.abs(inv.capitalGainShortTerm).toLocaleString()})</span>
                </div>
                <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="text-[10px] text-neutral-500 block">Net LT Capital Gain</span>
                  <span className="font-bold text-emerald-600">+${inv.capitalGainLongTerm.toLocaleString()}</span>
                </div>
                <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800/40">
                  <span className="text-[10px] text-neutral-500 block">Digital Assets Indicator</span>
                  <span className="font-bold text-neutral-700 dark:text-neutral-300">
                    {inv.digitalAssetsReportable ? 'Yes (Box Checked)' : 'No (None Documented)'}
                  </span>
                </div>
              </div>

              <div className="text-xs text-neutral-600 dark:text-neutral-400 p-2.5 bg-neutral-50 dark:bg-neutral-800/30 rounded border border-neutral-200 dark:border-neutral-800">
                <strong>Reconciliation Notes:</strong> {inv.reconciliationNotes}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 18: DEDUCTION & CREDIT CENTER */}
      {activeTab === 'deductions' && (
        <div className={`p-5 border rounded-lg shadow-sm ${cardBg} space-y-4`}>
          <div>
            <h3 className={`text-base font-bold uppercase tracking-tight ${textPrimary}`}>
              18. Deduction &amp; Credit Workpaper Matrix
            </h3>
            <p className={`text-xs ${textSecondary}`}>
              The AI identifies evidentiary substantiation; the accountant certifies professional statutory treatment.
            </p>
          </div>

          <div className="border rounded overflow-x-auto border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="p-3">Potential Area</th>
                  <th className="p-3">Evidence Received</th>
                  <th className="p-3">Source Document</th>
                  <th className="p-3 text-right">Amount Claimed</th>
                  <th className="p-3">Accountant Decision</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {deductionCredits.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="p-3 font-bold text-neutral-900 dark:text-white">
                      {item.area}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.evidenceReceived ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.evidenceReceived ? '✓ Evidence Verified' : 'Missing'}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                      {item.sourceDocName}
                    </td>
                    <td className="p-3 font-mono text-right font-bold text-neutral-900 dark:text-white">
                      ${item.amountClaimed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-medium text-neutral-800 dark:text-neutral-200">
                      {item.accountantDecision}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-mono text-[10px] font-bold">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
