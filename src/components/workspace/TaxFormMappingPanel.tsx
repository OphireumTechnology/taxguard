import React, { useState } from 'react';
import {
  FileText,
  CheckCircle2,
  Lock,
  Scale,
  Shield,
  Layers,
  Search,
  ExternalLink,
  Cpu,
  Info
} from 'lucide-react';

interface FormLineItem {
  line: string;
  description: string;
  amount: number;
  sourceType: 'DETERMINISTIC_ENGINE' | 'OCR_WORKPAPER' | 'AGENT_PROPOSAL' | 'PRIOR_YEAR';
  sourceReference: string;
  legalAuthority: string;
  verified: boolean;
  verifiedBy: string | null;
}

const FORMS_MAP: Record<string, FormLineItem[]> = {
  'Form 1040 (U.S. Individual Income Tax Return)': [
    {
      line: '1a',
      description: 'Total amount from Form(s) W-2, box 1',
      amount: 112500,
      sourceType: 'OCR_WORKPAPER',
      sourceReference: 'DOC-001 (W-2 Box 1) · SHA-256: a3f5e19...',
      legalAuthority: 'IRC §61(a)(1) Gross Income Defined',
      verified: true,
      verifiedBy: 'CPA Reviewer (USR-2026-0045)',
    },
    {
      line: '2b',
      description: 'Taxable interest (Schedule B if required)',
      amount: 1420,
      sourceType: 'OCR_WORKPAPER',
      sourceReference: 'DOC-004 (1099-INT Box 1)',
      legalAuthority: 'IRC §61(a)(4) Interest',
      verified: true,
      verifiedBy: 'CPA Reviewer (USR-2026-0045)',
    },
    {
      line: '3b',
      description: 'Ordinary dividends',
      amount: 2850,
      sourceType: 'OCR_WORKPAPER',
      sourceReference: 'DOC-005 (1099-DIV Box 1a)',
      legalAuthority: 'IRC §61(a)(7) Dividends',
      verified: true,
      verifiedBy: 'CPA Reviewer (USR-2026-0045)',
    },
    {
      line: '8',
      description: 'Additional income from Schedule 1, line 10',
      amount: 48200,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Schedule 1 Line 10 Rollup (Sched C + Sched E)',
      legalAuthority: 'Deterministic Tax Engine v4.2',
      verified: true,
      verifiedBy: 'Senior Reviewer (USR-2026-0012)',
    },
    {
      line: '9',
      description: 'Total Income (add lines 1z, 2b, 3b, 4b, 5b, 6b, 7, and 8)',
      amount: 164970,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Arithmetic Sum lines 1a..8',
      legalAuthority: 'IRC §61 Calculation Rules',
      verified: true,
      verifiedBy: 'Deterministic Calculation Engine (A28 Verified)',
    },
    {
      line: '10',
      description: 'Adjustments to income from Schedule 1, line 26',
      amount: 6500,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Schedule 1 Line 26 (IRA Deduction + SE Tax deduction)',
      legalAuthority: 'IRC §62 Adjusted Gross Income Defined',
      verified: true,
      verifiedBy: 'CPA Reviewer (USR-2026-0045)',
    },
    {
      line: '11',
      description: 'Adjusted Gross Income (subtract line 10 from line 9)',
      amount: 158470,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Line 9 minus Line 10',
      legalAuthority: 'IRC §62(a)',
      verified: true,
      verifiedBy: 'A28 Calculation Verification Agent',
    },
    {
      line: '12',
      description: 'Standard deduction or itemized deductions (Schedule A)',
      amount: 29200,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: '2024 Standard Deduction (Married Filing Jointly)',
      legalAuthority: 'IRC §63(c) Standard Deduction',
      verified: true,
      verifiedBy: 'Deterministic Tax Engine v4.2',
    },
    {
      line: '15',
      description: 'Taxable Income (subtract line 14 from line 11)',
      amount: 129270,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Line 11 minus Line 12',
      legalAuthority: 'IRC §63(a) Taxable Income Defined',
      verified: true,
      verifiedBy: 'A28 Calculation Verification Agent',
    },
    {
      line: '16',
      description: 'Tax (computed using Tax Table / Rate Schedules)',
      amount: 18452,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: '2024 IRS Tax Rate Schedule Y-1',
      legalAuthority: 'IRC §1(a) Tax Imposed (Joint Returns)',
      verified: true,
      verifiedBy: 'Deterministic Tax Engine v4.2',
    },
    {
      line: '25a',
      description: 'Federal income tax withheld from Form(s) W-2',
      amount: 21400,
      sourceType: 'OCR_WORKPAPER',
      sourceReference: 'DOC-001 (W-2 Box 2)',
      legalAuthority: 'IRC §31 Tax Withheld on Wages',
      verified: true,
      verifiedBy: 'CPA Reviewer (USR-2026-0045)',
    },
    {
      line: '34',
      description: 'Overpayment (Refund Amount) (line 33 minus line 24)',
      amount: 2948,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Total Payments $21,400 minus Total Tax $18,452',
      legalAuthority: 'IRC §6402 Authority to Make Credits or Refunds',
      verified: true,
      verifiedBy: 'A28 Calculation Verification Agent',
    },
  ],
  'Schedule C (Form 1040) — Profit or Loss From Business': [
    {
      line: '1',
      description: 'Gross receipts or sales',
      amount: 184500,
      sourceType: 'OCR_WORKPAPER',
      sourceReference: 'General Ledger Account 4000 (1099-NEC Reconciled)',
      legalAuthority: 'IRC §61(a)(2) Business Income',
      verified: true,
      verifiedBy: 'Accountant (USR-2026-0088)',
    },
    {
      line: '4',
      description: 'Cost of goods sold (from line 42)',
      amount: 42100,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Schedule C Part III line 42',
      legalAuthority: 'Treas. Reg. §1.61-3',
      verified: true,
      verifiedBy: 'Accountant (USR-2026-0088)',
    },
    {
      line: '13',
      description: 'Depreciation and section 179 expense deduction',
      amount: 28400,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Form 4562 Line 22 (MACRS Schedule)',
      legalAuthority: 'IRC §168 / §179 Depreciation',
      verified: true,
      verifiedBy: 'CPA Reviewer (USR-2026-0045)',
    },
    {
      line: '28',
      description: 'Total expenses before expenses for business use of home',
      amount: 94200,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Sum of lines 8 through 27a',
      legalAuthority: 'IRC §162 Trade or Business Expenses',
      verified: true,
      verifiedBy: 'Deterministic Tax Engine v4.2',
    },
    {
      line: '31',
      description: 'Net profit or (loss) (to Schedule 1, line 3 and Schedule SE)',
      amount: 48200,
      sourceType: 'DETERMINISTIC_ENGINE',
      sourceReference: 'Gross income minus Total expenses',
      legalAuthority: 'IRC §162 / Schedule 1 Tie-Out',
      verified: true,
      verifiedBy: 'A28 Calculation Verification Agent',
    },
  ],
};

export const TaxFormMappingPanel: React.FC = () => {
  const [selectedForm, setSelectedForm] = useState<string>(
    'Form 1040 (U.S. Individual Income Tax Return)'
  );
  const [filterText, setFilterText] = useState<string>('');

  const lineItems = FORMS_MAP[selectedForm] || FORMS_MAP['Form 1040 (U.S. Individual Income Tax Return)'];

  const filteredItems = lineItems.filter(item => {
    return (
      item.line.toLowerCase().includes(filterText.toLowerCase()) ||
      item.description.toLowerCase().includes(filterText.toLowerCase()) ||
      item.sourceReference.toLowerCase().includes(filterText.toLowerCase()) ||
      item.legalAuthority.toLowerCase().includes(filterText.toLowerCase())
    );
  });

  return (
    <div className="space-y-4" data-testid="tax-form-mapping-panel">
      {/* Header */}
      <div className="p-4 rounded-2xl bg-[#071A2E] border border-slate-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
              PAGE 6 &amp; 11 SPECIFICATION
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              DETERMINISTIC CALCULATION BINDING
            </span>
          </div>
          <h2 className="text-lg font-bold text-white mt-1">
            IRS Tax Form Mapping &amp; Workpaper Provenance
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every form line is derived deterministically from validated source evidence and verified by A28/A30 agents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300 flex items-center gap-2">
            <span className="font-semibold">Target Form:</span>
            <select
              value={selectedForm}
              onChange={e => setSelectedForm(e.target.value)}
              className="bg-[#0D2745] border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white"
            >
              {Object.keys(FORMS_MAP).map(f => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex items-center gap-3 bg-[#0D2745] p-3 rounded-xl border border-slate-700">
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          placeholder="Search by line number, description, statutory reference, or workpaper..."
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          className="w-full bg-[#071A2E] border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#D4A843]"
        />
      </div>

      {/* Mapping Table */}
      <div className="bg-[#071A2E] border border-slate-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0A223D] text-slate-300 border-b border-slate-700 font-semibold">
              <tr>
                <th scope="col" className="py-2.5 pl-4 pr-2">Line</th>
                <th scope="col" className="py-2.5 px-2">Line Description</th>
                <th scope="col" className="py-2.5 px-2 text-right">Amount ($)</th>
                <th scope="col" className="py-2.5 px-2">Source Type</th>
                <th scope="col" className="py-2.5 px-2">Workpaper / Evidence Link</th>
                <th scope="col" className="py-2.5 px-2">Statutory Authority</th>
                <th scope="col" className="py-2.5 pr-4 pl-2">Reviewer Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredItems.map(item => (
                <tr key={item.line} className="hover:bg-[#0E2E50] transition-colors">
                  <td className="py-2.5 pl-4 pr-2 font-mono font-bold text-[#D4A843]">
                    {item.line}
                  </td>
                  <td className="py-2.5 px-2 text-white font-medium max-w-[220px]">
                    {item.description}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-white whitespace-nowrap">
                    ${item.amount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-2 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.sourceType === 'DETERMINISTIC_ENGINE'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {item.sourceType === 'DETERMINISTIC_ENGINE' ? 'Tax Engine' : 'OCR Workpaper'}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-mono text-[11px] text-slate-300 truncate max-w-[200px]">
                    {item.sourceReference}
                  </td>
                  <td className="py-2.5 px-2 text-[11px] text-slate-400">
                    {item.legalAuthority}
                  </td>
                  <td className="py-2.5 pr-4 pl-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {item.verifiedBy || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
