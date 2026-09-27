import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Scale,
  DollarSign,
  AlertCircle,
  Eye,
  Building2,
  Sparkles,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientFinancialReportsSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
  onNavigateToLenderPackage?: () => void;
}

export const ClientFinancialReportsSection: React.FC<ClientFinancialReportsSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant,
  onNavigateToLenderPackage
}) => {
  const [reportType, setReportType] = useState<
    'balance_sheet' | 'income_statement' | 'cash_flows' | 'ar_ap_aging' | 'schedule_m1'
  >('income_statement');
  
  const [accountingBasis, setAccountingBasis] = useState<'Accrual' | 'Cash'>('Accrual');
  const [reportPeriod, setReportPeriod] = useState('FY 2025 (Jan 1 – Dec 31, 2025)');
  const [roundingMode, setRoundingMode] = useState<'Exact' | 'Thousands'>('Exact');
  const [watermark, setWatermark] = useState<'FINAL CERTIFIED' | 'MANAGEMENT USE ONLY'>('FINAL CERTIFIED');

  // Profit & Loss / Income Statement Data
  const incomeStatement = {
    revenue: [
      { name: 'Advisory & Portfolio Consulting Gross Receipts', amount2025: 624500.00, amount2024: 512000.00 },
      { name: 'Private Placement Due Diligence Retainers', amount2025: 85000.00, amount2024: 65000.00 }
    ],
    totalRevenue2025: 709500.00,
    totalRevenue2024: 577000.00,
    expenses: [
      { name: 'Officer Compensation (Michael Perotti - W-2)', amount2025: 175000.00, amount2024: 160000.00 },
      { name: 'Officer 2%+ Shareholder Health Insurance', amount2025: 9600.00, amount2024: 8400.00 },
      { name: 'Salaries & Administrative Staff Wages', amount2025: 82000.00, amount2024: 74000.00 },
      { name: 'Rent & Lease of Facilities (Suite 1940)', amount2025: 51000.00, amount2024: 48000.00 },
      { name: 'Legal & Certified Public Accounting Fees', amount2025: 18500.00, amount2024: 15200.00 },
      { name: 'Business Travel & Ground Transportation', amount2025: 14200.00, amount2024: 11800.00 },
      { name: 'Client Entertainment & Business Meals (Book)', amount2025: 6900.00, amount2024: 5400.00 },
      { name: 'Depreciation & Amortization (MACRS)', amount2025: 12400.00, amount2024: 10800.00 },
      { name: 'Commercial Term Loan Interest Expense', amount2025: 7620.00, amount2024: 9100.00 },
      { name: 'Other Operating Expenses (Tech, Dues, Ins)', amount2025: 22850.00, amount2024: 19800.00 }
    ],
    totalExpenses2025: 400070.00,
    totalExpenses2024: 362500.00,
    netIncome2025: 309430.00,
    netIncome2024: 214500.00
  };

  // Balance Sheet Data
  const balanceSheet = {
    assets: [
      { name: 'Operating Checking Account (••4912)', amount: 184520.44 },
      { name: 'Money Market Liquidity Reserve', amount: 350000.00 },
      { name: 'Accounts Receivable (Trade Due < 30 Days)', amount: 62400.00 },
      { name: 'Total Current Assets', amount: 596920.44, isSubtotal: true },
      { name: 'Computer Hardware & Office Tech Assets', amount: 78500.00 },
      { name: 'Less: Accumulated Depreciation', amount: -38200.00 },
      { name: 'Net Property & Equipment', amount: 40300.00, isSubtotal: true },
      { name: 'Total Assets', amount: 637220.44, isTotal: true }
    ],
    liabilitiesAndEquity: [
      { name: 'Accounts Payable (Trade)', amount: 18400.00 },
      { name: 'Accrued Professional Retainers', amount: 4500.00 },
      { name: 'Commercial Term Loan (First Citizens)', amount: 114000.00 },
      { name: 'Total Liabilities', amount: 136900.00, isSubtotal: true },
      { name: 'Common Stock & Paid-In Capital', amount: 50000.00 },
      { name: 'Retained Earnings (Beginning)', amount: 225890.44 },
      { name: 'Current Tax Year Net Income', amount: 309430.00 },
      { name: 'Less: Shareholder Distributions', amount: -85000.00 },
      { name: 'Total Shareholder Equity', amount: 500320.44, isSubtotal: true },
      { name: 'Total Liabilities & Equity', amount: 637220.44, isTotal: true }
    ]
  };

  // Schedule M-1 Book-to-Tax Reconciliation
  const scheduleM1 = [
    { line: '1', title: 'Net Income (Loss) per Books', amount: 309430.00, sign: '+' },
    { line: '2', title: 'Federal Income Tax per Books', amount: 0.00, sign: '+' },
    { line: '3', title: 'Excess of Capital Losses over Gains', amount: 0.00, sign: '+' },
    { line: '4a', title: 'Tax-Exempt Interest Income', amount: 0.00, sign: '-' },
    { line: '4b', title: 'Travel & Entertainment Disallowed (50% Meals Limit § 274(n))', amount: 3450.00, sign: '+' },
    { line: '4c', title: 'Officer Life Insurance Premiums (Non-Deductible)', amount: 1200.00, sign: '+' },
    { line: '5', title: 'Depreciation Difference (Book vs Tax MACRS / § 179)', amount: -4200.00, sign: '-' },
    { line: '6', title: 'Total Ordinary Taxable Income (Form 1120-S Line 21)', amount: 309880.00, isFinal: true }
  ];

  const handleExportReport = (format: string) => {
    alert(`Generating ${watermark} report export in ${format} format.`);
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Exported Financial Statement Report',
      record: `${reportType.toUpperCase()} - ${format}`,
      result: 'Success (Simulated)',
      reason: `Client generated ${accountingBasis} report for ${reportPeriod}`
    });
  };

  return (
    <div className="space-y-6" id="client-financial-reports-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Financial Statements
              </span>
              <span className="text-xs text-[#667085]">Compiled Workpapers &bull; SSARS Standard</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Financial Reports &amp; Book-to-Tax Tie-Out
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Certified Balance Sheets, Profit &amp; Loss statements, Comparative Variance analysis, and Schedule M-1 bridge.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportReport('PDF')}
              className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => handleExportReport('Excel (XLSX)')}
              className="px-3 py-2 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F]"
            >
              <span>Export XLSX</span>
            </button>
          </div>
        </div>

        {/* Report Controls Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div>
            <label className="text-[10px] font-mono uppercase text-[#667085] block">Accounting Basis</label>
            <div className="flex items-center gap-1 mt-1">
              {(['Accrual', 'Cash'] as const).map(b => (
                <button
                  key={b}
                  onClick={() => setAccountingBasis(b)}
                  className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                    accountingBasis === b
                      ? 'bg-[#061A2F] text-white border-[#061A2F]'
                      : 'bg-white text-[#667085] border-[#D8DCE2]'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-[#667085] block">Report Period</label>
            <select
              value={reportPeriod}
              onChange={e => setReportPeriod(e.target.value)}
              className="w-full mt-1 p-1 border border-[#D8DCE2] rounded bg-white text-xs text-[#061A2F]"
            >
              <option value="FY 2025 (Jan 1 – Dec 31, 2025)">FY 2025 (Full Year Closed)</option>
              <option value="2025 Q4 (Oct 1 – Dec 31, 2025)">2025 Q4 (Quarterly Closing)</option>
              <option value="FY 2024 (Comparative)">FY 2024 (Prior Tax Year)</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-[#667085] block">Rounding Mode</label>
            <div className="flex items-center gap-1 mt-1">
              {(['Exact', 'Thousands'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRoundingMode(r)}
                  className={`px-2.5 py-1 rounded text-xs font-bold border transition-colors ${
                    roundingMode === r
                      ? 'bg-[#061A2F] text-white border-[#061A2F]'
                      : 'bg-white text-[#667085] border-[#D8DCE2]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-[#667085] block">Watermark Certification</label>
            <div className="mt-1 font-mono text-[11px] font-bold text-[#1B5E20] bg-[#E8F5E9] border border-[#C8E6C9] px-2 py-1 rounded text-center">
              {watermark}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#D8DCE2] bg-white px-4 rounded-t-lg overflow-x-auto">
        {[
          { id: 'income_statement', label: 'Profit & Loss (Income Statement)', icon: TrendingUp },
          { id: 'balance_sheet', label: 'Balance Sheet (Assets & Equity)', icon: Scale },
          { id: 'schedule_m1', label: 'Book-to-Tax Bridge (Schedule M-1)', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = reportType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
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

      {/* TAB 1: PROFIT & LOSS */}
      {reportType === 'income_statement' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-6 shadow-xs">
          <div className="text-center border-b border-[#D8DCE2] pb-4">
            <h2 className="text-base font-bold text-[#061A2F]">PEROTTI CAPITAL HOLDINGS LLC</h2>
            <div className="text-xs font-mono text-[#667085] uppercase">Statement of Income &amp; Expenses (Accrual Basis)</div>
            <div className="text-xs text-[#061A2F] mt-0.5">For the Years Ended December 31, 2025 and 2024</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-3">Operating Line Account</th>
                  <th className="p-3 text-right w-40">FY 2025 ($)</th>
                  <th className="p-3 text-right w-40">FY 2024 ($)</th>
                  <th className="p-3 text-right w-32">YoY Change (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {/* Revenue Header */}
                <tr className="bg-[#FAF9F5] font-bold text-[#061A2F]">
                  <td colSpan={4} className="p-2.5 uppercase text-[11px] font-mono">Operating Gross Revenue</td>
                </tr>
                {incomeStatement.revenue.map((rev, idx) => (
                  <tr key={idx} className="hover:bg-[#FBFAF7]">
                    <td className="p-2.5 pl-6 text-[#061A2F]">{rev.name}</td>
                    <td className="p-2.5 text-right font-mono font-medium text-[#061A2F]">
                      ${rev.amount2025.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-mono text-[#667085]">
                      ${rev.amount2024.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-mono text-[#1B5E20] font-bold">
                      +{(((rev.amount2025 - rev.amount2024) / rev.amount2024) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="font-bold text-[#061A2F] bg-[#FBFAF7]">
                  <td className="p-2.5 uppercase text-[11px] font-mono">Total Gross Revenue:</td>
                  <td className="p-2.5 text-right font-mono text-sm">
                    ${incomeStatement.totalRevenue2025.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right font-mono text-sm text-[#667085]">
                    ${incomeStatement.totalRevenue2024.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right font-mono text-[#1B5E20]">
                    +{(((incomeStatement.totalRevenue2025 - incomeStatement.totalRevenue2024) / incomeStatement.totalRevenue2024) * 100).toFixed(1)}%
                  </td>
                </tr>

                {/* Expenses Header */}
                <tr className="bg-[#FAF9F5] font-bold text-[#061A2F]">
                  <td colSpan={4} className="p-2.5 uppercase text-[11px] font-mono">Operating &amp; Administrative Expenses</td>
                </tr>
                {incomeStatement.expenses.map((exp, idx) => (
                  <tr key={idx} className="hover:bg-[#FBFAF7]">
                    <td className="p-2.5 pl-6 text-[#061A2F]">{exp.name}</td>
                    <td className="p-2.5 text-right font-mono font-medium text-[#061A2F]">
                      ${exp.amount2025.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-mono text-[#667085]">
                      ${exp.amount2024.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-right font-mono text-[#667085]">
                      {(((exp.amount2025 - exp.amount2024) / exp.amount2024) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="font-bold text-[#061A2F] bg-[#FBFAF7]">
                  <td className="p-2.5 uppercase text-[11px] font-mono">Total Operating Expenses:</td>
                  <td className="p-2.5 text-right font-mono text-sm">
                    ${incomeStatement.totalExpenses2025.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right font-mono text-sm text-[#667085]">
                    ${incomeStatement.totalExpenses2024.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-2.5 text-right font-mono text-[#667085]">
                    +{(((incomeStatement.totalExpenses2025 - incomeStatement.totalExpenses2024) / incomeStatement.totalExpenses2024) * 100).toFixed(1)}%
                  </td>
                </tr>

                {/* Net Income Row */}
                <tr className="bg-[#061A2F] text-[#F7F4ED] font-bold">
                  <td className="p-3 uppercase text-[11px] font-mono tracking-wider">
                    Net Ordinary Operating Income (Loss):
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-[#E8C66A]">
                    ${incomeStatement.netIncome2025.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-slate-300">
                    ${incomeStatement.netIncome2024.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-right font-mono text-[#E8C66A]">
                    +{(((incomeStatement.netIncome2025 - incomeStatement.netIncome2024) / incomeStatement.netIncome2024) * 100).toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BALANCE SHEET */}
      {reportType === 'balance_sheet' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-6 shadow-xs">
          <div className="text-center border-b border-[#D8DCE2] pb-4">
            <h2 className="text-base font-bold text-[#061A2F]">PEROTTI CAPITAL HOLDINGS LLC</h2>
            <div className="text-xs font-mono text-[#667085] uppercase">Statement of Financial Position (Balance Sheet)</div>
            <div className="text-xs text-[#061A2F] mt-0.5">As of December 31, 2025</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Assets */}
            <div className="space-y-2 border border-[#E5E7EB] rounded p-4 bg-[#FBFAF7]">
              <h3 className="font-mono font-bold text-xs uppercase text-[#061A2F] border-b border-[#E5E7EB] pb-2">
                Assets &amp; Holdings
              </h3>
              <div className="space-y-1.5 text-xs">
                {balanceSheet.assets.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-1.5 rounded ${
                      item.isTotal ? 'bg-[#061A2F] text-white font-bold' : item.isSubtotal ? 'font-bold bg-white border border-[#E5E7EB]' : ''
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className="font-mono font-bold">
                      ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="space-y-2 border border-[#E5E7EB] rounded p-4 bg-[#FBFAF7]">
              <h3 className="font-mono font-bold text-xs uppercase text-[#061A2F] border-b border-[#E5E7EB] pb-2">
                Liabilities &amp; Shareholder Equity
              </h3>
              <div className="space-y-1.5 text-xs">
                {balanceSheet.liabilitiesAndEquity.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-1.5 rounded ${
                      item.isTotal ? 'bg-[#061A2F] text-white font-bold' : item.isSubtotal ? 'font-bold bg-white border border-[#E5E7EB]' : ''
                    }`}
                  >
                    <span>{item.name}</span>
                    <span className="font-mono font-bold">
                      ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SCHEDULE M-1 */}
      {reportType === 'schedule_m1' && (
        <div className="bg-white rounded-b-lg border border-t-0 border-[#D8DCE2] p-6 space-y-4 shadow-xs">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Schedule M-1: Reconciliation of Income per Books with Income per Return</h3>
            <p className="text-xs text-[#667085]">Statutory tie-out for Form 1120-S Page 5 compliance.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-[#D8DCE2]">
              <thead className="bg-[#FBFAF7] border-b border-[#D8DCE2] text-[#667085] uppercase text-[10px] font-mono">
                <tr>
                  <th className="p-3 w-16">Line</th>
                  <th className="p-3">Statutory Description</th>
                  <th className="p-3 text-center w-16">Effect</th>
                  <th className="p-3 text-right w-44">Amount ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8DCE2]">
                {scheduleM1.map((row, idx) => (
                  <tr key={idx} className={row.isFinal ? 'bg-[#061A2F] text-white font-bold' : 'hover:bg-[#FAF9F5]'}>
                    <td className="p-3 font-mono font-bold">{row.line}</td>
                    <td className="p-3 font-medium">{row.title}</td>
                    <td className="p-3 text-center font-mono font-bold">{row.sign || ''}</td>
                    <td className={`p-3 text-right font-mono font-bold ${row.isFinal ? 'text-[#E8C66A] text-sm' : 'text-[#061A2F]'}`}>
                      ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AICPA STATUTORY COMPILATION DISCLAIMER BANNER */}
      <div className="border border-[#D8DCE2] bg-[#FAF9F5] p-4 rounded-lg text-xs text-[#667085] space-y-1">
        <div className="font-bold text-[#061A2F] uppercase text-[11px] font-mono">
          Accountant Compilation &amp; Preparation Disclaimer (SSARS Standards):
        </div>
        <p className="leading-relaxed">
          The accompanying financial statements of Perotti Capital Holdings LLC as of and for the year ended December 31, 2025, were prepared from books and records supplied by management. These compiled financial statements have not been audited or reviewed in accordance with AICPA standards, and accordingly, no assurance is expressed. Prepared solely for internal management analysis and statutory tax compliance.
        </p>
      </div>
    </div>
  );
};
