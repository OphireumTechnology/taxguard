/**
 * TaxGuard AI – Tax Resolution & Audit Defense Center
 * Notice classification, statutory deadline tracking, Form 433-A OIC workpapers,
 * First-Time Penalty Abatement (FTA) calculators, and response drafting.
 */

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  FileText, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  DollarSign, 
  Clock, 
  ArrowRight,
  Download,
  Lock,
  Sparkles,
  Send
} from 'lucide-react';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';

export interface ResolutionNotice {
  id: string;
  noticeType: 'CP2000' | 'CP504' | 'LT11' | 'Math Error' | 'SC DOR Notice' | 'Form 941 Notice' | 'Audit Exam';
  taxYear: number;
  issuingAgency: 'IRS' | 'SC Department of Revenue';
  proposedAdjustment: number;
  penaltiesAndInterest: number;
  statutoryDeadline: string;
  daysRemaining: number;
  resolutionStrategy: 'Dispute / Form 8857' | 'Penalty Abatement (FTA)' | 'Offer in Compromise (OIC)' | 'Installment Agreement';
  status: 'Evidence Review' | 'Response Drafted' | 'CPA Certified' | 'Submitted';
  form433ACompleted: boolean;
}

const INITIAL_NOTICES: ResolutionNotice[] = [
  {
    id: 'not_001',
    noticeType: 'CP2000',
    taxYear: 2022,
    issuingAgency: 'IRS',
    proposedAdjustment: 14850,
    penaltiesAndInterest: 3120,
    statutoryDeadline: '2024-10-18',
    daysRemaining: 18,
    resolutionStrategy: 'Dispute / Form 8857',
    status: 'Response Drafted',
    form433ACompleted: false
  },
  {
    id: 'not_002',
    noticeType: 'CP504',
    taxYear: 2021,
    issuingAgency: 'IRS',
    proposedAdjustment: 28400,
    penaltiesAndInterest: 6800,
    statutoryDeadline: '2024-10-05',
    daysRemaining: 5,
    resolutionStrategy: 'Offer in Compromise (OIC)',
    status: 'Evidence Review',
    form433ACompleted: true
  }
];

export const TaxResolutionCenter: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [notices, setNotices] = useState<ResolutionNotice[]>(INITIAL_NOTICES);
  const [selectedNoticeId, setSelectedNoticeId] = useState<string>('not_001');
  const [activeTab, setActiveTab] = useState<'notices' | 'form433a' | 'penalty_abatement'>('notices');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Form 433-A OIC Interactive Calculator state
  const [monthlyIncome, setMonthlyIncome] = useState<number>(7500);
  const [housingUtilities, setHousingUtilities] = useState<number>(2400); // Standard IRS ALE
  const [foodClothing, setFoodClothing] = useState<number>(1450);
  const [transportation, setTransportation] = useState<number>(650);
  const [healthCare, setHealthCare] = useState<number>(550);
  const [quickSaleEquity, setQuickSaleEquity] = useState<number>(18000); // Net asset equity

  const allowableLivingExpenses = housingUtilities + foodClothing + transportation + healthCare;
  const monthlyDisposableIncome = Math.max(0, monthlyIncome - allowableLivingExpenses);
  // Lump Sum Offer in Compromise = Quick Sale Equity + (12 * Monthly Disposable Income)
  const reasonableCollectionPotential = quickSaleEquity + (12 * monthlyDisposableIncome);

  const selectedNotice = notices.find(n => n.id === selectedNoticeId) || notices[0];

  const handleCertifyResponse = () => {
    setNotices(prev => prev.map(n => {
      if (n.id === selectedNotice.id) {
        TaxGuardAuditService.logEvent({
          tenantId: 'tenant_ar_tax_prod',
          userId: userRole,
          userEmail: `${userRole}@artaxservices.com`,
          userRole,
          action: 'RESOLUTION_NOTICE_CERTIFIED',
          recordType: 'notice',
          recordId: n.id,
          ipAddress: '127.0.0.1 (authenticated)',
          result: 'success',
          riskLevel: 'material',
          details: `Certified legal response for Notice ${n.noticeType} (${n.issuingAgency} TY${n.taxYear}). Strategy: ${n.resolutionStrategy}`
        });
        return { ...n, status: 'CPA Certified' };
      }
      return n;
    }));
    setActionNotice(`Notice ${selectedNotice.noticeType} response packet certified by CPA.`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border border-neutral-300 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold tracking-wider">
              A/R Tax Services, LLC • Tax Controversy &amp; Representation Practice
            </div>
            <h2 className="text-base font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#061A2F]" />
              <span>Tax Resolution, Notice Defense &amp; Offer in Compromise Center</span>
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              CP2000 underreported income disputes, IRS collection stays, Form 433-A financial statements, and First-Time Penalty Abatements.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-rose-50 border border-rose-300 text-rose-800 text-[11px] font-mono font-bold">
              {notices.length} Active Agency Cases
            </span>
          </div>
        </div>

        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-neutral-200 gap-2 text-xs font-semibold">
          {[
            { id: 'notices', label: 'Agency Notices & Deadlines' },
            { id: 'form433a', label: 'Form 433-A OIC Financial Analysis' },
            { id: 'penalty_abatement', label: 'First-Time Penalty Abatement (FTA)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[#061A2F] text-[#061A2F] font-bold'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Notices & Deadlines */}
      {activeTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Notices List */}
          <div className="lg:col-span-2 border border-neutral-300 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-bold text-[#061A2F] uppercase">Active Statutory Notices</h3>
              <span className="text-xs text-neutral-500 font-mono">IRS / SC DOR</span>
            </div>

            <div className="space-y-3">
              {notices.map(notice => (
                <div
                  key={notice.id}
                  onClick={() => setSelectedNoticeId(notice.id)}
                  className={`p-4 border cursor-pointer transition-colors space-y-2 ${
                    selectedNoticeId === notice.id
                      ? 'border-[#061A2F] bg-neutral-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-400'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#061A2F] text-white text-xs font-mono font-bold">
                        {notice.noticeType}
                      </span>
                      <span className="text-xs font-bold text-neutral-900">
                        {notice.issuingAgency} • Tax Year {notice.taxYear}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[11px] font-mono font-bold">
                        {notice.daysRemaining} Days to Statutory Deadline
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-neutral-500">Proposed Tax:</span>
                      <div className="font-mono font-bold text-neutral-900">${notice.proposedAdjustment.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">Interest &amp; Penalty:</span>
                      <div className="font-mono font-bold text-rose-700">${notice.penaltiesAndInterest.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">Strategy:</span>
                      <div className="font-semibold text-neutral-800">{notice.resolutionStrategy}</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">Status:</span>
                      <div className="font-mono font-bold text-emerald-800">{notice.status}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Col: Notice Detail & Response Gate */}
          <div className="border border-neutral-300 bg-white p-5 space-y-4">
            <div className="border-b border-neutral-200 pb-3">
              <div className="text-[10px] font-mono uppercase text-neutral-500">Notice Dossier</div>
              <h3 className="text-sm font-bold text-[#061A2F]">{selectedNotice.noticeType} Response Docket</h3>
              <div className="text-xs text-neutral-600 font-mono mt-0.5">Deadline: {selectedNotice.statutoryDeadline}</div>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">Total Balance at Issue:</span>
                <span className="font-mono font-bold text-rose-800">
                  ${(selectedNotice.proposedAdjustment + selectedNotice.penaltiesAndInterest).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">Defense Approach:</span>
                <span className="font-semibold text-neutral-900">{selectedNotice.resolutionStrategy}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-100">
                <span className="text-neutral-600">Form 433-A Prepared:</span>
                <span className="font-mono font-semibold">{selectedNotice.form433ACompleted ? 'Yes (Verified)' : 'Not Applicable'}</span>
              </div>
              <div className="flex justify-between py-1 items-center">
                <span className="text-neutral-600">Certification:</span>
                <span className="font-mono font-bold text-[10px] uppercase text-emerald-700">{selectedNotice.status}</span>
              </div>
            </div>

            <div className="pt-2">
              {selectedNotice.status !== 'CPA Certified' ? (
                <button
                  onClick={handleCertifyResponse}
                  className="w-full py-2 bg-[#061A2F] hover:bg-neutral-800 text-white text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>CPA Review &amp; Certify Notice Response</span>
                </button>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Certified for Transmission to {selectedNotice.issuingAgency}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Form 433-A OIC Calculator */}
      {activeTab === 'form433a' && (
        <div className="border border-neutral-300 bg-white p-6 space-y-6">
          <div className="border-b border-neutral-200 pb-3">
            <h3 className="text-sm font-bold text-[#061A2F] uppercase">
              Form 433-A Collection Information Statement &amp; Offer in Compromise Modeler
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Calculates Reasonable Collection Potential (RCP) using IRS National &amp; Local Allowable Living Expense (ALE) standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Left: Financial Statement Inputs */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Total Monthly Household Income ($)</label>
                <input
                  type="number"
                  value={monthlyIncome}
                  onChange={e => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-neutral-300 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Housing &amp; Utilities (Richland County ALE Standard)</label>
                <input
                  type="number"
                  value={housingUtilities}
                  onChange={e => setHousingUtilities(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-neutral-300 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Food, Clothing &amp; Miscellaneous ALE ($)</label>
                <input
                  type="number"
                  value={foodClothing}
                  onChange={e => setFoodClothing(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-neutral-300 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Net Quick Sale Asset Equity (Real Estate + Bank + Accounts)</label>
                <input
                  type="number"
                  value={quickSaleEquity}
                  onChange={e => setQuickSaleEquity(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-neutral-300 font-mono"
                />
              </div>
            </div>

            {/* Right: RCP Calculation Breakdown */}
            <div className="border border-neutral-200 bg-neutral-50 p-5 space-y-4">
              <div className="text-xs font-bold text-[#061A2F] uppercase border-b border-neutral-200 pb-2">
                OIC Eligibility &amp; Minimum Settlement Target
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-600">Total Monthly ALE Expenses:</span>
                  <span className="font-mono font-bold text-neutral-900">${allowableLivingExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Monthly Disposable Income:</span>
                  <span className="font-mono font-bold text-neutral-900">${monthlyDisposableIncome.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Future Remaining Income (12 mo):</span>
                  <span className="font-mono font-bold text-neutral-900">${(monthlyDisposableIncome * 12).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">Net Asset Quick Sale Value:</span>
                  <span className="font-mono font-bold text-neutral-900">${quickSaleEquity.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-neutral-300 flex justify-between text-sm font-bold">
                  <span className="text-[#061A2F]">Calculated RCP (Minimum OIC Offer):</span>
                  <span className="font-mono text-emerald-800">${reasonableCollectionPotential.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 bg-white border border-neutral-300 text-[11px] text-neutral-600 space-y-1">
                <div className="font-bold text-neutral-900">Professional Review Requirement:</div>
                <div>Offers in Compromise based on Doubt as to Collectibility require exhaustive 3-month bank statement substantiation. An authorized CPA must sign Form 656.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Penalty Abatement */}
      {activeTab === 'penalty_abatement' && (
        <div className="border border-neutral-300 bg-white p-6 space-y-4 text-xs">
          <div className="border-b border-neutral-200 pb-3">
            <h3 className="text-sm font-bold text-[#061A2F] uppercase">
              First-Time Penalty Abatement (FTA) Administrative Waiver
            </h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Under IRM 20.1.1.3.6.1, taxpayers with 3 years of clean filing history qualify for automatic waiver of Failure to File (§ 6651(a)(1)) and Failure to Pay (§ 6651(a)(2)).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 space-y-1">
              <div className="text-[10px] font-mono text-emerald-800 font-bold uppercase">Filing History Test</div>
              <div className="text-sm font-bold text-emerald-900">Passed Clean</div>
              <div className="text-[10px] text-emerald-700">No penalties for TY20, TY21, TY22.</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 space-y-1">
              <div className="text-[10px] font-mono text-emerald-800 font-bold uppercase">Current Compliance Test</div>
              <div className="text-sm font-bold text-emerald-900">All Returns Filed</div>
              <div className="text-[10px] text-emerald-700">No outstanding unfiled tax periods.</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 space-y-1">
              <div className="text-[10px] font-mono text-emerald-800 font-bold uppercase">Estimated Relief Amount</div>
              <div className="text-sm font-bold font-mono text-emerald-900">$3,120.00</div>
              <div className="text-[10px] text-emerald-700">Waiver applied to Notice CP2000.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
