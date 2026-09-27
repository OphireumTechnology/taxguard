import React, { useState } from 'react';
import {
  Calendar,
  DollarSign,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Clock,
  UploadCloud,
  FileText,
  Info,
  ChevronRight
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientEstimatedTaxesSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
}

export const ClientEstimatedTaxesSection: React.FC<ClientEstimatedTaxesSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant
}) => {
  const [selectedTaxYear, setSelectedTaxYear] = useState('2026');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Voucher tracking list
  const [vouchers, setVouchers] = useState([
    {
      id: 'vouch_q1_fed',
      quarter: '2026 Q1',
      jurisdiction: 'Federal (IRS)',
      form: 'Form 1040-ES / 1120-W',
      dueDate: 'April 15, 2026',
      recommendedAmount: 18500.00,
      safeHarborMinimum: 16800.00,
      paymentMethod: 'IRS Direct Pay / EFTPS',
      directPayUrl: 'https://www.irs.gov/payments/direct-pay',
      status: 'Pending Due Date' as 'Paid & Verified' | 'Pending Due Date' | 'Action Required',
      confirmationNumber: '',
      paidDate: ''
    },
    {
      id: 'vouch_q1_sc',
      quarter: '2026 Q1',
      jurisdiction: 'South Carolina SCDOR',
      form: 'SC 1040-ES / SC PTE Voucher',
      dueDate: 'April 15, 2026',
      recommendedAmount: 4800.00,
      safeHarborMinimum: 4200.00,
      paymentMethod: 'SCDOR MyDORWAY Online Portal',
      directPayUrl: 'https://mydorway.dor.sc.gov',
      status: 'Pending Due Date',
      confirmationNumber: '',
      paidDate: ''
    },
    {
      id: 'vouch_q2_fed',
      quarter: '2026 Q2',
      jurisdiction: 'Federal (IRS)',
      form: 'Form 1040-ES',
      dueDate: 'June 15, 2026',
      recommendedAmount: 18500.00,
      safeHarborMinimum: 16800.00,
      paymentMethod: 'IRS Direct Pay / EFTPS',
      directPayUrl: 'https://www.irs.gov/payments/direct-pay',
      status: 'Pending Due Date',
      confirmationNumber: '',
      paidDate: ''
    },
    {
      id: 'vouch_q3_fed',
      quarter: '2026 Q3',
      jurisdiction: 'Federal (IRS)',
      form: 'Form 1040-ES',
      dueDate: 'September 15, 2026',
      recommendedAmount: 18500.00,
      safeHarborMinimum: 16800.00,
      paymentMethod: 'IRS Direct Pay / EFTPS',
      directPayUrl: 'https://www.irs.gov/payments/direct-pay',
      status: 'Pending Due Date',
      confirmationNumber: '',
      paidDate: ''
    }
  ]);

  // Mark voucher as paid modal
  const [activeVoucherModal, setActiveVoucherModal] = useState<typeof vouchers[0] | null>(null);
  const [modalConfNumber, setModalConfNumber] = useState('');
  const [modalPaidDate, setModalPaidDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSavePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVoucherModal || !modalConfNumber) return;

    setVouchers(prev =>
      prev.map(v =>
        v.id === activeVoucherModal.id
          ? {
              ...v,
              status: 'Paid & Verified',
              confirmationNumber: modalConfNumber,
              paidDate: modalPaidDate
            }
          : v
      )
    );

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Logged Estimated Tax Payment Confirmation',
      record: `${activeVoucherModal.quarter} ${activeVoucherModal.jurisdiction}: Conf #${modalConfNumber}`,
      result: 'Success (Simulated)',
      reason: `Taxpayer logged estimated tax payment of $${activeVoucherModal.recommendedAmount.toLocaleString()}`
    });

    setActionNotice(`Estimated tax payment for ${activeVoucherModal.quarter} logged successfully.`);
    setActiveVoucherModal(null);
    setModalConfNumber('');
    setTimeout(() => setActionNotice(null), 5000);
  };

  return (
    <div className="space-y-6" id="client-estimated-taxes-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                IRC § 6654 Safe Harbor
              </span>
              <span className="text-xs text-[#667085]">Statutory Estimated Tax Schedules</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Estimated Taxes, Safe Harbor &amp; Vouchers
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Quarterly payment vouchers designed to protect taxpayers from underpayment penalties under IRC § 6654 / § 6655.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert('Downloaded 2026 Estimated Tax Voucher Package (IRS Form 1040-ES & SCDOR Vouchers)')}
              className="px-3.5 py-2 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Download All Vouchers (PDF)</span>
            </button>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Recorded in workpapers</span>
          </div>
        )}

        {/* Safe Harbor Metric Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="p-3.5 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Safe Harbor Rule Applied</span>
            <span className="text-base font-bold text-[#061A2F] mt-0.5 block">110% Prior Year Tax</span>
            <span className="text-[10px] text-[#667085]">AGI &gt; $150k Threshold (IRC § 6654(d)(1)(C))</span>
          </div>

          <div className="p-3.5 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Total 2026 Safe Harbor Target</span>
            <span className="text-base font-bold text-[#1B5E20] font-mono mt-0.5 block">$93,200.00 Total</span>
            <span className="text-[10px] text-[#667085]">Fed: $74,000 &bull; SC: $19,200</span>
          </div>

          <div className="p-3.5 bg-[#FBFAF7] border border-[#E5E7EB] rounded">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Next Impending Due Date</span>
            <span className="text-base font-bold text-[#C99A32] mt-0.5 block">April 15, 2026 (Q1)</span>
            <span className="text-[10px] text-[#667085]">Recommended Federal: $18,500.00</span>
          </div>
        </div>
      </div>

      {/* Vouchers List */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
        <div className="border-b border-[#D8DCE2] pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#061A2F]">2026 Quarterly Payment Voucher Schedule</h3>
            <p className="text-xs text-[#667085]">
              Make payments directly with taxing authorities online via EFTPS, IRS Direct Pay, or SCDOR MyDORWAY.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {vouchers.map(v => (
            <div
              key={v.id}
              className="border border-[#D8DCE2] rounded-lg p-4 bg-[#FBFAF7] flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-[#061A2F] text-white px-2 py-0.5 rounded">
                    {v.quarter}
                  </span>
                  <span className="font-bold text-sm text-[#061A2F]">{v.jurisdiction}</span>
                  <span className="text-xs text-[#667085]">({v.form})</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    v.status === 'Paid & Verified'
                      ? 'bg-[#E8F5E9] text-[#1B5E20] border-[#C8E6C9]'
                      : 'bg-[#FFFDE7] text-[#F57F17] border-[#FFF59D]'
                  }`}>
                    {v.status}
                  </span>
                </div>

                <div className="text-xs text-[#4B5563] flex flex-wrap items-center gap-4 pt-1">
                  <span>Due Date: <strong className="font-mono text-[#061A2F]">{v.dueDate}</strong></span>
                  <span>&bull;</span>
                  <span>Recommended: <strong className="font-mono text-[#061A2F]">${v.recommendedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>&bull;</span>
                  <span>Safe Harbor Minimum: <strong className="font-mono text-[#1B5E20]">${v.safeHarborMinimum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                </div>

                {v.confirmationNumber && (
                  <div className="text-[11px] text-[#1B5E20] font-mono mt-1">
                    Confirmed Paid: {v.paidDate} &bull; Confirmation Ref: <strong>{v.confirmationNumber}</strong>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => window.open(v.directPayUrl, '_blank')}
                  className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F] flex items-center gap-1.5"
                >
                  <span>Pay at Agency</span>
                  <ExternalLink className="w-3 h-3 text-[#667085]" />
                </button>

                {v.status !== 'Paid & Verified' && (
                  <button
                    onClick={() => setActiveVoucherModal(v)}
                    className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#0A2544]"
                  >
                    Log Payment Conf #
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STATUTORY MANDATORY PAYMENT NOTICE */}
      <div className="border border-[#D8DCE2] bg-[#FAF9F5] p-4 rounded-lg text-xs text-[#667085] flex items-start gap-3">
        <Info className="w-5 h-5 text-[#C99A32] flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#061A2F] block mb-0.5">Direct Agency Payment Policy:</strong>
          Payment must be made directly by the taxpayer with the taxing authority (IRS or South Carolina Department of Revenue). A/R Tax Services, LLC does not debit your bank account for estimated tax liabilities. Keep all EFTPS and SCDOR confirmation receipts for end-of-year return preparation.
        </div>
      </div>

      {/* LOG PAYMENT CONFIRMATION MODAL */}
      {activeVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="border-b border-[#D8DCE2] pb-3">
              <h3 className="text-sm font-bold text-[#061A2F]">
                Log Estimated Tax Payment: {activeVoucherModal.quarter}
              </h3>
              <p className="text-xs text-[#667085]">
                {activeVoucherModal.jurisdiction} &bull; ${activeVoucherModal.recommendedAmount.toLocaleString()}
              </p>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Payment Date</label>
                <input
                  type="date"
                  value={modalPaidDate}
                  onChange={e => setModalPaidDate(e.target.value)}
                  className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Agency Confirmation Number (EFTPS / Direct Pay)</label>
                <input
                  type="text"
                  value={modalConfNumber}
                  onChange={e => setModalConfNumber(e.target.value)}
                  placeholder="e.g. EFTPS-9201849182 or SC-PAY-88192"
                  className="w-full p-2 border border-[#D8DCE2] rounded bg-white font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#D8DCE2]">
                <button
                  type="button"
                  onClick={() => setActiveVoucherModal(null)}
                  className="px-3 py-1.5 border border-[#D8DCE2] rounded text-[#667085]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#061A2F] text-white font-bold rounded"
                >
                  Save &amp; Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
