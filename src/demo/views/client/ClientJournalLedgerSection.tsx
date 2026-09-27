import React, { useState } from 'react';
import {
  Layers,
  FileSpreadsheet,
  Download,
  Lock,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  Info,
  DollarSign,
  Scale
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientJournalLedgerSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
  onNavigateToReports?: () => void;
}

export const ClientJournalLedgerSection: React.FC<ClientJournalLedgerSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant,
  onNavigateToReports
}) => {
  const [activeLedgerTab, setActiveLedgerTab] = useState<
    'general_journal' | 'trial_balance' | 'fixed_assets' | 'debt_schedule' | 'equity'
  >('general_journal');
  
  const [selectedPeriod, setSelectedPeriod] = useState('2025-FY');
  const [searchQuery, setSearchQuery] = useState('');
  const [proposeModalOpen, setProposeModalOpen] = useState(false);
  const [selectedEntryRef, setSelectedEntryRef] = useState('');
  const [proposalText, setProposalText] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Journal Entries (Double-Entry Bookkeeping records)
  const journalEntries = [
    {
      entryNumber: 'AJE-2025-01',
      date: '2025-12-31',
      type: 'Adjusting Journal Entry',
      description: 'Accrue 2025 Q4 CPA Professional Fees & Audit Defense Retainer',
      preparedBy: 'Elena Rostova, CPA',
      reviewedBy: 'Desmond Hinds, CEO',
      status: 'Posted & Period Locked',
      debitTotal: 4500.00,
      creditTotal: 4500.00,
      lines: [
        { accountNum: '6200', accountName: 'Legal & Professional Fees', debit: 4500.00, credit: 0 },
        { accountNum: '2050', accountName: 'Accrued Expenses Payable', debit: 0, credit: 4500.00 }
      ]
    },
    {
      entryNumber: 'AJE-2025-02',
      date: '2025-12-31',
      type: 'Depreciation & Section 179',
      description: 'Record 2025 Book Depreciation on IT Equipment and Office Assets',
      preparedBy: 'Elena Rostova, CPA',
      reviewedBy: 'Desmond Hinds, CEO',
      status: 'Posted & Period Locked',
      debitTotal: 12400.00,
      creditTotal: 12400.00,
      lines: [
        { accountNum: '6500', accountName: 'Depreciation Expense', debit: 12400.00, credit: 0 },
        { accountNum: '1590', accountName: 'Accumulated Depreciation - Equipment', debit: 0, credit: 12400.00 }
      ]
    },
    {
      entryNumber: 'AJE-2025-03',
      date: '2025-12-31',
      type: 'Reclassification Entry',
      description: 'Reclassify 50% Non-Deductible Business Meals per IRC § 274(n)',
      preparedBy: 'Elena Rostova, CPA',
      reviewedBy: 'Desmond Hinds, CEO',
      status: 'Posted & Period Locked',
      debitTotal: 3450.00,
      creditTotal: 3450.00,
      lines: [
        { accountNum: '6380', accountName: 'Non-Deductible Meals (M-1 Target)', debit: 3450.00, credit: 0 },
        { accountNum: '6350', accountName: 'Travel & Entertainment Expense', debit: 0, credit: 3450.00 }
      ]
    },
    {
      entryNumber: 'AJE-2025-04',
      date: '2025-12-31',
      type: 'Shareholder Distribution Reclassification',
      description: 'Reclassify Officer Medical Premium as Compensation under Notice 2008-1',
      preparedBy: 'Elena Rostova, CPA',
      reviewedBy: 'Desmond Hinds, CEO',
      status: 'Posted & Period Locked',
      debitTotal: 9600.00,
      creditTotal: 9600.00,
      lines: [
        { accountNum: '5120', accountName: 'Officer Health Insurance (Form 1120-S Line 7)', debit: 9600.00, credit: 0 },
        { accountNum: '3020', accountName: 'Shareholder Distributions (Michael Perotti)', debit: 0, credit: 9600.00 }
      ]
    }
  ];

  // Trial Balance Data
  const trialBalance = [
    { code: '1010', name: 'Operating Checking Account (••4912)', debit: 184520.00, credit: 0 },
    { code: '1050', name: 'Money Market Liquidity Reserve', debit: 350000.00, credit: 0 },
    { code: '1200', name: 'Accounts Receivable (Trade)', debit: 62400.00, credit: 0 },
    { code: '1500', name: 'Computer Hardware & Office Equipment', debit: 78500.00, credit: 0 },
    { code: '1590', name: 'Accumulated Depreciation', debit: 0, credit: 38200.00 },
    { code: '2010', name: 'Accounts Payable (Trade)', debit: 0, credit: 18400.00 },
    { code: '2050', name: 'Accrued Expenses & Retainers', debit: 0, credit: 4500.00 },
    { code: '2200', name: 'Commercial Term Loan (First Citizens)', debit: 0, credit: 114000.00 },
    { code: '3010', name: 'Common Stock & Additional Paid-in Capital', debit: 0, credit: 50000.00 },
    { code: '3020', name: 'Shareholder Distributions (2025)', debit: 85000.00, credit: 0 },
    { code: '3050', name: 'Retained Earnings (Beginning of Year)', debit: 0, credit: 265820.00 },
    { code: '4010', name: 'Advisory & Consulting Revenue', debit: 0, credit: 624500.00 },
    { code: '5010', name: 'Officer Compensation (Form 1120-S Line 7)', debit: 175000.00, credit: 0 },
    { code: '5120', name: 'Officer 2%+ Shareholder Health Insurance', debit: 9600.00, credit: 0 },
    { code: '6100', name: 'Salaries & Wages (Staff)', debit: 82000.00, credit: 0 },
    { code: '6200', name: 'Legal & Professional Fees', debit: 18500.00, credit: 0 },
    { code: '6300', name: 'Rent & Lease of Facilities', debit: 51000.00, credit: 0 },
    { code: '6350', name: 'Travel & Deductible Entertainment', debit: 14200.00, credit: 0 },
    { code: '6380', name: 'Non-Deductible Meals (50%)', debit: 3450.00, credit: 0 },
    { code: '6500', name: 'Depreciation Expense', debit: 12400.00, credit: 0 },
    { code: '6900', name: 'Other Deductions (Office, Dues, Tech)', debit: 22850.00, credit: 0 }
  ];

  const totalDebits = trialBalance.reduce((sum, item) => sum + item.debit, 0);
  const totalCredits = trialBalance.reduce((sum, item) => sum + item.credit, 0);

  // Fixed Asset Register
  const fixedAssets = [
    {
      id: 'fa_01',
      name: 'Executive Boardroom Conference System & AV Displays',
      dateAcquired: '2022-04-10',
      costBasis: 18500.00,
      recoveryPeriod: '5-Year MACRS',
      priorDepreciation: 9620.00,
      currentDepreciation: 3552.00,
      netBookValue: 5328.00,
      taxMethod: '200% Declining Balance / Half-Year'
    },
    {
      id: 'fa_02',
      name: 'High-Density Server & Workstation Cluster',
      dateAcquired: '2023-01-15',
      costBasis: 32000.00,
      recoveryPeriod: '5-Year MACRS',
      priorDepreciation: 10240.00,
      currentDepreciation: 6144.00,
      netBookValue: 15616.00,
      taxMethod: 'IRC § 179 Eligible / MACRS'
    },
    {
      id: 'fa_03',
      name: 'Executive Office Furniture & Fixtures',
      dateAcquired: '2021-09-01',
      costBasis: 28000.00,
      recoveryPeriod: '7-Year MACRS',
      priorDepreciation: 18340.00,
      currentDepreciation: 2704.00,
      netBookValue: 6956.00,
      taxMethod: '150% Declining Balance'
    }
  ];

  // Debt & Loan Schedule
  const debtSchedule = [
    {
      lender: 'First Citizens Bank',
      loanNumber: 'LN-004819',
      originalPrincipal: 175000.00,
      currentBalance: 114000.00,
      interestRate: '6.25% Fixed',
      maturityDate: '2029-08-15',
      monthlyPayment: 2150.00,
      ytdInterestPaid: 7620.00,
      collateral: 'Business Assets & UCC-1 Lien'
    }
  ];

  const handleProposeAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalText.trim()) return;

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Proposed Journal Entry Adjustment',
      record: selectedEntryRef || 'General Ledger',
      result: 'Success (Simulated)',
      reason: proposalText
    });

    setActionNotice('Adjustment proposal submitted to Elena Rostova, CPA for review.');
    setProposeModalOpen(false);
    setProposalText('');
    setTimeout(() => setActionNotice(null), 5000);
  };

  return (
    <div className="space-y-6" id="client-journal-ledger-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                General Ledger &amp; Journals
              </span>
              <span className="text-xs text-[#667085]">Double-Entry Books of Account</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              General Journal, Ledgers &amp; Trial Balance
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Certified debits, credits, adjusting entries, fixed asset depreciation schedules, and trial balance verification.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedEntryRef('General Ledger Balance');
                setProposeModalOpen(true);
              }}
              className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Propose Ledger Adjustment</span>
            </button>
            <button
              onClick={() => alert('Trial Balance and General Journal export downloaded (PDF/XLSX).')}
              className="px-3 py-2 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F] flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Logged to audit trail</span>
          </div>
        )}

        {/* Status Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Trial Balance Equilibrium</span>
            <span className="text-base font-bold text-[#1B5E20] mt-0.5 block flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Debits = Credits
            </span>
            <span className="text-[10px] text-[#667085] font-mono">${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })} Balanced</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Period Lock Status</span>
            <span className="text-base font-bold text-[#061A2F] mt-0.5 block flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#1B5E20]" />
              FY 2025 Certified
            </span>
            <span className="text-[10px] text-[#667085]">Locked on Jan 14, 2026</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Adjusting Entries</span>
            <span className="text-base font-bold text-[#061A2F] mt-0.5 block">4 Posted Entries</span>
            <span className="text-[10px] text-[#667085]">Prepared by Elena Rostova, CPA</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Depreciation Method</span>
            <span className="text-base font-bold text-[#061A2F] mt-0.5 block">MACRS + § 179</span>
            <span className="text-[10px] text-[#667085]">$12,400.00 Current FY</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D8DCE2] bg-white px-4 rounded-t-lg overflow-x-auto">
        {[
          { id: 'general_journal', label: 'General Journal Entries (AJEs)', icon: Layers },
          { id: 'trial_balance', label: 'Trial Balance Verification', icon: Scale },
          { id: 'fixed_assets', label: 'Fixed Asset Register', icon: FileSpreadsheet },
          { id: 'debt_schedule', label: 'Debt & Liability Schedule', icon: DollarSign }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeLedgerTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveLedgerTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-[#061A2F] text-[#061A2F]'
                  : 'border-transparent text-[#667085] hover:text-[#061A2F]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C99A32]' : 'text-[#667085]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL JOURNAL */}
      {activeLedgerTab === 'general_journal' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-6">
          <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#061A2F]">Adjusting &amp; Reclassifying Journal Entries</h3>
              <p className="text-xs text-[#667085]">Prepared by firm CPAs with verified equal debits and credits.</p>
            </div>
            <span className="px-2.5 py-1 bg-[#FAF9F5] border border-[#C99A32] text-[#061A2F] rounded text-xs font-bold">
              Period 2025-FY Locked
            </span>
          </div>

          <div className="space-y-4">
            {journalEntries.map(entry => (
              <div key={entry.entryNumber} className="border border-[#D8DCE2] rounded p-4 bg-[#FBFAF7] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#061A2F] bg-white px-2 py-0.5 rounded border border-[#D8DCE2]">
                      {entry.entryNumber}
                    </span>
                    <span className="font-bold text-xs text-[#061A2F]">{entry.type}</span>
                    <span className="text-[10px] text-[#667085] font-mono">• {entry.date}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#667085]">Prep: <strong>{entry.preparedBy}</strong></span>
                    <span className="text-[#667085]">|</span>
                    <span className="text-[#1B5E20] font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {entry.status}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-[#4B5563]">
                  <strong>Description &amp; Tax Intent:</strong> {entry.description}
                </div>

                {/* Double Entry Lines Table */}
                <table className="w-full text-xs text-left bg-white border border-[#E5E7EB] rounded overflow-hidden">
                  <thead className="bg-[#FAF9F5] text-[#667085] uppercase text-[10px] font-mono border-b border-[#E5E7EB]">
                    <tr>
                      <th className="p-2 w-16">Acct #</th>
                      <th className="p-2">Account Title</th>
                      <th className="p-2 text-right w-28">Debit ($)</th>
                      <th className="p-2 text-right w-28">Credit ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {entry.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-mono text-[#667085]">{line.accountNum}</td>
                        <td className={`p-2 ${line.credit > 0 ? 'pl-6 text-[#4B5563]' : 'font-semibold text-[#061A2F]'}`}>
                          {line.accountName}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-[#061A2F]">
                          {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                        <td className="p-2 text-right font-mono font-bold text-[#061A2F]">
                          {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[#FBFAF7] font-bold text-[#061A2F]">
                      <td colSpan={2} className="p-2 text-right uppercase text-[10px] font-mono">Balanced Total:</td>
                      <td className="p-2 text-right font-mono">${entry.debitTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-2 text-right font-mono">${entry.creditTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TRIAL BALANCE */}
      {activeLedgerTab === 'trial_balance' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#061A2F]">Adjusted Trial Balance (Year-End 2025)</h3>
              <p className="text-xs text-[#667085]">Reconciled chart of accounts feeding directly to Form 1120-S workpapers.</p>
            </div>
            <div className="text-xs text-[#1B5E20] font-bold bg-[#E8F5E9] border border-[#C8E6C9] px-3 py-1 rounded flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Perfect Balance Verified</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-[#D8DCE2]">
              <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-2.5 w-20">Acct Code</th>
                  <th className="p-2.5">Account Description</th>
                  <th className="p-2.5 text-right w-36">Debit ($)</th>
                  <th className="p-2.5 text-right w-36">Credit ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DCE2]">
                {trialBalance.map(item => (
                  <tr key={item.code} className="hover:bg-[#FAF9F5]">
                    <td className="p-2.5 font-mono text-[#667085]">{item.code}</td>
                    <td className="p-2.5 font-medium text-[#061A2F]">{item.name}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-[#061A2F]">
                      {item.debit > 0 ? item.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-[#061A2F]">
                      {item.credit > 0 ? item.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#061A2F] text-[#F7F4ED] font-bold">
                  <td colSpan={2} className="p-3 uppercase text-[11px] font-mono tracking-wider">
                    Total Adjusted Trial Balance (Balanced):
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-[#E8C66A]">
                    ${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-[#E8C66A]">
                    ${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FIXED ASSETS */}
      {activeLedgerTab === 'fixed_assets' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Fixed Asset Register &amp; Depreciation Schedules</h3>
            <p className="text-xs text-[#667085]">Form 4562 statutory tax depreciation tracking and book-versus-tax basis.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-[#D8DCE2]">
              <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-3">Asset Description</th>
                  <th className="p-3">Acquired</th>
                  <th className="p-3 text-right">Cost Basis</th>
                  <th className="p-3">Recovery / Method</th>
                  <th className="p-3 text-right">Prior Depr</th>
                  <th className="p-3 text-right">2025 Depr</th>
                  <th className="p-3 text-right">Net Book Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DCE2]">
                {fixedAssets.map(fa => (
                  <tr key={fa.id} className="hover:bg-[#FAF9F5]">
                    <td className="p-3 font-semibold text-[#061A2F]">{fa.name}</td>
                    <td className="p-3 font-mono text-[#667085]">{fa.dateAcquired}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#061A2F]">
                      ${fa.costBasis.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3">
                      <div>{fa.recoveryPeriod}</div>
                      <div className="text-[10px] text-[#667085]">{fa.taxMethod}</div>
                    </td>
                    <td className="p-3 text-right font-mono text-[#667085]">
                      ${fa.priorDepreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#1B5E20]">
                      ${fa.currentDepreciation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#061A2F]">
                      ${fa.netBookValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DEBT SCHEDULE */}
      {activeLedgerTab === 'debt_schedule' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Debt &amp; Commercial Note Schedules</h3>
            <p className="text-xs text-[#667085]">Reconciliation of principal paydown vs deductible business interest under IRC § 163(j).</p>
          </div>

          <div className="space-y-3">
            {debtSchedule.map(debt => (
              <div key={debt.loanNumber} className="border border-[#D8DCE2] rounded p-4 bg-[#FBFAF7] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#061A2F]">{debt.lender}</span>
                    <span className="text-xs px-2 py-0.5 bg-white border border-[#D8DCE2] font-mono text-[#061A2F] rounded">
                      {debt.loanNumber}
                    </span>
                  </div>
                  <div className="text-xs text-[#667085] mt-1 space-x-3">
                    <span>Terms: <strong>{debt.interestRate}</strong></span>
                    <span>•</span>
                    <span>Maturity: <strong>{debt.maturityDate}</strong></span>
                    <span>•</span>
                    <span>Security: <strong>{debt.collateral}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[10px] text-[#667085] uppercase">Current Balance</div>
                    <div className="text-base font-bold font-mono text-[#061A2F]">
                      ${debt.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[#667085] uppercase">2025 Interest Expense</div>
                    <div className="text-base font-bold font-mono text-[#1B5E20]">
                      ${debt.ytdInterestPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Professional Disclaimers Notice */}
      <div className="border border-[#D8DCE2] bg-[#FAF9F5] p-4 rounded-lg text-xs text-[#667085] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#061A2F] flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#061A2F] block mb-0.5">Statutory Governance &amp; Client Access Policy:</strong>
          The client may review authorized journal entries, trial balance schedules, and debt registers. Under professional accounting standards (SSARS / Circular 230), clients may not post entries directly or alter locked periods. All suggested adjustments must be submitted for CPA review.
        </div>
      </div>

      {/* MODAL: PROPOSE ADJUSTMENT */}
      {proposeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-[#D8DCE2] pb-3">
              <h3 className="text-sm font-bold text-[#061A2F]">Propose General Ledger Adjustment</h3>
              <p className="text-xs text-[#667085]">
                Submit questions or proposed reclassifications to senior reviewer Elena Rostova, CPA.
              </p>
            </div>

            <form onSubmit={handleProposeAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Target Account or Entry Reference</label>
                <input
                  type="text"
                  value={selectedEntryRef}
                  onChange={e => setSelectedEntryRef(e.target.value)}
                  placeholder="e.g. Account 6350 (Travel) or Entry AJE-2025-01"
                  className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Proposal &amp; Accounting Explanation</label>
                <textarea
                  value={proposalText}
                  onChange={e => setProposalText(e.target.value)}
                  placeholder="Explain why an adjustment is necessary (e.g., equipment purchase misclassified as supplies, owner loan repayment)..."
                  className="w-full p-2 border border-[#D8DCE2] rounded bg-white h-24"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DCE2]">
                <button
                  type="button"
                  onClick={() => setProposeModalOpen(false)}
                  className="px-4 py-2 border border-[#D8DCE2] rounded text-[#667085] hover:text-[#061A2F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white font-bold rounded hover:bg-[#0A2544]"
                >
                  Submit Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
