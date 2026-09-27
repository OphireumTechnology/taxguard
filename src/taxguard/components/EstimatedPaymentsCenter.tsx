/**
 * TaxGuard AI – Estimated Tax Payments & Safe-Harbor Center
 * Quarterly tax projection calendar, IRC § 6654 Safe-Harbor testing,
 * payment voucher generation, and client authorization controls.
 */

import React, { useState } from 'react';
import { 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  ShieldAlert, 
  AlertCircle, 
  CheckCircle2, 
  Download, 
  Upload, 
  Lock, 
  ArrowRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';

export interface QuarterlyVoucher {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  dueDate: string;
  federalAmount: number;
  stateSCAmount: number;
  totalDue: number;
  status: 'Paid (Simulated)' | 'Client Authorized' | 'Awaiting Payment' | 'Upcoming';
  confirmationNumber?: string;
  receiptUploaded: boolean;
}

const INITIAL_VOUCHERS: QuarterlyVoucher[] = [
  {
    quarter: 'Q1',
    dueDate: '2024-04-15',
    federalAmount: 16500,
    stateSCAmount: 3800,
    totalDue: 20300,
    status: 'Paid (Simulated)',
    confirmationNumber: 'EFTPS-8849102-FED',
    receiptUploaded: true
  },
  {
    quarter: 'Q2',
    dueDate: '2024-06-17',
    federalAmount: 16500,
    stateSCAmount: 3800,
    totalDue: 20300,
    status: 'Paid (Simulated)',
    confirmationNumber: 'EFTPS-9102481-FED',
    receiptUploaded: true
  },
  {
    quarter: 'Q3',
    dueDate: '2024-09-16',
    federalAmount: 16500,
    stateSCAmount: 3800,
    totalDue: 20300,
    status: 'Awaiting Payment',
    receiptUploaded: false
  },
  {
    quarter: 'Q4',
    dueDate: '2025-01-15',
    federalAmount: 16500,
    stateSCAmount: 3800,
    totalDue: 20300,
    status: 'Upcoming',
    receiptUploaded: false
  }
];

export const EstimatedPaymentsCenter: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [vouchers, setVouchers] = useState<QuarterlyVoucher[]>(INITIAL_VOUCHERS);
  const [priorYearTax, setPriorYearTax] = useState<number>(58000);
  const [currentEstimatedTax, setCurrentEstimatedTax] = useState<number>(66000);
  const [priorAGI, setPriorAGI] = useState<number>(240000);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // IRC § 6654 Safe Harbor Calculations:
  // If AGI > $150k, safe harbor is 110% of prior year tax; otherwise 100%.
  // Alternative safe harbor: 90% of current year tax.
  const safeHarborPercent = priorAGI > 150000 ? 1.10 : 1.00;
  const safeHarborPriorYear = Math.round(priorYearTax * safeHarborPercent);
  const safeHarborCurrentYear = Math.round(currentEstimatedTax * 0.90);
  const requiredAnnualSafeHarbor = Math.min(safeHarborPriorYear, safeHarborCurrentYear);
  const requiredQuarterlyPayment = Math.round(requiredAnnualSafeHarbor / 4);

  const totalPaidToDate = vouchers
    .filter(v => v.status === 'Paid (Simulated)')
    .reduce((sum, v) => sum + v.federalAmount, 0);

  const meetsSafeHarbor = totalPaidToDate >= Math.round(requiredAnnualSafeHarbor * 0.5); // For Q2 end

  const handleRecordPayment = (quarter: string) => {
    setVouchers(prev => prev.map(v => {
      if (v.quarter === quarter) {
        TaxGuardAuditService.logEvent({
          tenantId: 'tenant_ar_tax_prod',
          userId: userRole,
          userEmail: `${userRole}@artaxservices.com`,
          userRole,
          action: 'ESTIMATED_PAYMENT_CONFIRMED',
          recordType: 'billing',
          recordId: `est_pmt_${quarter}`,
          ipAddress: '127.0.0.1 (authenticated)',
          result: 'success',
          riskLevel: 'routine',
          details: `Client authorized simulated payment for ${quarter} estimated tax ($${v.totalDue.toLocaleString()}). Safe harbor confirmed.`
        });
        return {
          ...v,
          status: 'Paid (Simulated)',
          confirmationNumber: `EFTPS-${Math.floor(1000000 + Math.random() * 9000000)}-SIM`,
          receiptUploaded: true
        };
      }
      return v;
    }));
    setActionNotice(`${quarter} Estimated Tax payment confirmed and receipt logged.`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border border-neutral-300 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold tracking-wider">
              A/R Tax Services, LLC • Compliance &amp; Cash Flow Desk
            </div>
            <h2 className="text-base font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#061A2F]" />
              <span>Estimated Tax Payments &amp; IRC § 6654 Safe-Harbor Center</span>
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Federal Form 1040-ES / 1120-W, South Carolina SC1040ES vouchers, and statutory underpayment penalty avoidance analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-300 text-neutral-800 text-[11px] font-mono">
              Tax Year 2024 Schedule
            </span>
          </div>
        </div>

        {/* Non-Custodial / Authority Notice */}
        <div className="p-3 bg-neutral-50 border-l-4 border-[#061A2F] text-neutral-700 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#061A2F] shrink-0" />
          <span>
            <strong>Payment Authority Notice:</strong> A/R Tax Services, LLC does not initiate funds debits without explicit client authorization and a configured payment provider. Client retains ultimate authority over payment execution via EFTPS or MyDORWAY.
          </span>
        </div>

        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Safe Harbor Metric Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-3.5 bg-neutral-50 border border-neutral-200 space-y-1">
            <div className="text-[10px] uppercase font-mono text-neutral-500">Prior Year Tax (TY23)</div>
            <div className="text-lg font-mono font-bold text-neutral-900">${priorYearTax.toLocaleString()}</div>
            <div className="text-[10px] text-neutral-500 font-mono">Prior AGI: ${priorAGI.toLocaleString()} (&gt;$150k = 110% Rule)</div>
          </div>

          <div className="p-3.5 bg-neutral-50 border border-neutral-200 space-y-1">
            <div className="text-[10px] uppercase font-mono text-neutral-500">IRC § 6654 Safe Harbor Floor</div>
            <div className="text-lg font-mono font-bold text-emerald-700">${requiredAnnualSafeHarbor.toLocaleString()}/yr</div>
            <div className="text-[10px] text-neutral-500 font-mono">${requiredQuarterlyPayment.toLocaleString()} per quarter to eliminate penalties</div>
          </div>

          <div className="p-3.5 bg-emerald-50 border border-emerald-300 space-y-1">
            <div className="text-[10px] uppercase font-mono text-emerald-800 font-bold">Safe Harbor Status</div>
            <div className="text-lg font-mono font-black text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{meetsSafeHarbor ? 'Protected from Penalties' : 'Underpayment Risk'}</span>
            </div>
            <div className="text-[10px] text-emerald-700 font-mono">${totalPaidToDate.toLocaleString()} paid YTD across Q1 &amp; Q2</div>
          </div>
        </div>
      </div>

      {/* Quarterly Vouchers Table */}
      <div className="border border-neutral-300 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
          <h3 className="text-sm font-bold text-[#061A2F] uppercase">
            2024 Quarterly Estimated Payment Schedule &amp; Vouchers
          </h3>
          <span className="text-xs text-neutral-500 font-mono">Statutory Deadlines</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-neutral-100 border-b border-neutral-300 text-neutral-700 font-mono text-[11px]">
                <th className="py-2.5 px-3">Voucher Period</th>
                <th className="py-2.5 px-3">Statutory Due Date</th>
                <th className="py-2.5 px-3 text-right">Federal (1040-ES)</th>
                <th className="py-2.5 px-3 text-right">SC DOR (SC1040ES)</th>
                <th className="py-2.5 px-3 text-right">Total Payment</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {vouchers.map(voucher => (
                <tr key={voucher.quarter} className="hover:bg-neutral-50">
                  <td className="py-3 px-3 font-bold text-neutral-900">
                    {voucher.quarter} Payment Voucher
                    {voucher.confirmationNumber && (
                      <div className="text-[10px] font-mono text-neutral-500 font-normal">{voucher.confirmationNumber}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 font-mono text-neutral-700">{voucher.dueDate}</td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-900">${voucher.federalAmount.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-900">${voucher.stateSCAmount.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-[#061A2F]">${voucher.totalDue.toLocaleString()}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase font-mono ${
                      voucher.status === 'Paid (Simulated)'
                        ? 'bg-emerald-100 text-emerald-800'
                        : voucher.status === 'Awaiting Payment'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {voucher.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {voucher.status === 'Awaiting Payment' ? (
                      <button
                        onClick={() => handleRecordPayment(voucher.quarter)}
                        className="px-3 py-1 bg-[#061A2F] hover:bg-neutral-800 text-white text-[11px] font-bold uppercase transition-colors"
                      >
                        Authorize Payment
                      </button>
                    ) : (
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {voucher.status === 'Paid (Simulated)' ? 'Receipt on file' : 'Voucher Ready'}
                      </span>
                    )}
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
