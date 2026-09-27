import React, { useState } from 'react';
import {
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  Download,
  Eye,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Clock,
  ShieldCheck,
  X,
  Send,
  Building
} from 'lucide-react';
import { ClientInvoiceRecord, IInvoiceService } from '../../services/clientDashboardServices';

interface ClientInvoicesSectionProps {
  invoiceService: IInvoiceService;
  clientId: string;
  onOpenAssistant: () => void;
}

export const ClientInvoicesSection: React.FC<ClientInvoicesSectionProps> = ({
  invoiceService,
  clientId,
  onOpenAssistant
}) => {
  const [invoices, setInvoices] = useState<ClientInvoiceRecord[]>(() =>
    invoiceService.getInvoices(clientId)
  );

  // Modals
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<ClientInvoiceRecord | null>(null);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<ClientInvoiceRecord | null>(null);
  const [selectedInvoiceForDispute, setSelectedInvoiceForDispute] = useState<ClientInvoiceRecord | null>(null);
  const [selectedInvoiceForPlan, setSelectedInvoiceForPlan] = useState<ClientInvoiceRecord | null>(null);
  const [paymentSuccessReceipt, setPaymentSuccessReceipt] = useState<{ receiptId: string; invoiceNumber: string; amount: number } | null>(null);

  // Form states
  const [paymentMethod, setPaymentMethod] = useState('Corporate Credit Card (ending 4242)');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeField, setDisputeField] = useState('Scope of Service');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const refreshInvoices = () => {
    setInvoices(invoiceService.getInvoices(clientId));
  };

  const handleSimulatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;

    const result = invoiceService.simulatePayment(
      selectedInvoiceForPayment.id,
      selectedInvoiceForPayment.balanceDue,
      paymentMethod
    );

    if (result.success && result.receiptId) {
      setPaymentSuccessReceipt({
        receiptId: result.receiptId,
        invoiceNumber: selectedInvoiceForPayment.invoiceNumber,
        amount: selectedInvoiceForPayment.balanceDue
      });
      setSelectedInvoiceForPayment(null);
      refreshInvoices();
    } else {
      alert(result.error || 'Payment simulation failed.');
    }
  };

  const handleDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForDispute || !disputeReason.trim()) return;

    invoiceService.disputeInvoice(
      selectedInvoiceForDispute.id,
      disputeReason.trim(),
      'Michael Perotti (Client)'
    );

    setSelectedInvoiceForDispute(null);
    setDisputeReason('');
    setActionNotice('Invoice dispute submitted to billing manager. Status changed to "Disputed".');
    refreshInvoices();
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleRequestPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPlan) return;

    invoiceService.requestPaymentPlan(
      selectedInvoiceForPlan.id,
      3,
      'Michael Perotti (Client)'
    );

    setSelectedInvoiceForPlan(null);
    setActionNotice('3-installment payment plan request logged for review.');
    refreshInvoices();
    setTimeout(() => setActionNotice(null), 4000);
  };

  const totalOutstanding = invoices
    .filter(i => i.status !== 'Paid (Simulated)')
    .reduce((sum, i) => sum + i.balanceDue, 0);

  return (
    <div className="space-y-6" id="client-invoices-section">
      {/* 1. Header Card */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#D7AC4A] uppercase tracking-wider font-bold bg-[#061A2F] px-2 py-0.5 rounded">
                Section 6 of 8
              </span>
              <span className="text-xs font-mono text-[#667085]">A/R Tax Services, LLC Billing</span>
            </div>
            <h1 className="text-xl font-black text-[#061A2F] mt-1">
              Fee Invoices & Billing
            </h1>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Itemized professional fee billing, retainer draw reconciliation, and simulated electronic settlement.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenAssistant}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>Billing Support</span>
            </button>
          </div>
        </div>

        {/* Total Outstanding Metric */}
        <div className="mt-4 p-4 bg-[#FAF9F5] border border-[#C99A32] rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#061A2F] font-bold">Total Current Balance Due</div>
            <div className="text-2xl font-black text-[#061A2F] font-mono mt-0.5">
              ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-xs text-[#667085] sm:text-right">
            <span>Payment Terms: Net 15 • Retainer draw applied where authorized.</span>
            <div className="text-[11px] text-[#C99A32] font-semibold mt-0.5">
              No finance charges applied during demonstration mode.
            </div>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] text-[#1B5E20] rounded text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 2. Simulated Payment Receipt Banner */}
      {paymentSuccessReceipt && (
        <div className="p-4 bg-[#E8F5E9] border border-[#A5D6A7] rounded-lg space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#1B5E20]" />
              <span className="font-bold text-[#1B5E20] text-sm">
                Simulated Payment Successful (Demo Mode)
              </span>
            </div>
            <button
              onClick={() => setPaymentSuccessReceipt(null)}
              className="text-xs text-[#1B5E20] hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-[#2E7D32]">
            Payment of <strong>${paymentSuccessReceipt.amount.toFixed(2)}</strong> for {paymentSuccessReceipt.invoiceNumber} recorded.
          </p>
          <div className="text-[11px] font-mono text-[#1B5E20] bg-white/60 p-2 rounded">
            Receipt ID: {paymentSuccessReceipt.receiptId} • Settlement Status: Cleared (Simulated) • Payment integration not configured.
          </div>
        </div>
      )}

      {/* 3. Invoices Table */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#061A2F] text-white border-b border-[#D8DCE2] font-mono text-[10px] uppercase">
                <th className="p-3">Invoice #</th>
                <th className="p-3">Service Description</th>
                <th className="p-3">Issue Date</th>
                <th className="p-3">Due Date</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3 text-right">Retainer Applied</th>
                <th className="p-3 text-right">Balance Due</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {invoices.map((inv) => {
                const isPaid = inv.status === 'Paid (Simulated)';
                return (
                  <tr key={inv.id} className="hover:bg-[#FAF9F5] transition-colors">
                    <td className="p-3 font-mono font-bold text-[#061A2F]">{inv.invoiceNumber}</td>
                    <td className="p-3">
                      <div className="font-semibold text-[#061A2F]">{inv.serviceDescription}</div>
                      <div className="text-[10px] text-[#667085]">{inv.engagementTitle}</div>
                    </td>
                    <td className="p-3 font-mono text-[#667085]">{inv.issueDate}</td>
                    <td className="p-3 font-mono text-[#667085]">{inv.dueDate}</td>
                    <td className="p-3 text-right font-mono font-bold text-[#061A2F]">
                      ${inv.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-right font-mono text-[#1B5E20]">
                      -${inv.retainerApplied.toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#061A2F]">
                      ${inv.balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded inline-block ${
                        isPaid
                          ? 'bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9]'
                          : inv.status === 'Disputed'
                          ? 'bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2]'
                          : 'bg-[#FFF8E1] text-[#B78103] border border-[#FFE082]'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInvoiceForDetail(inv)}
                          className="p-1 hover:bg-[#FAF9F5] text-[#061A2F] rounded"
                          title="View Itemized Breakdown"
                          aria-label="View Itemized Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => alert(`Simulated download of ${inv.invoiceNumber}.pdf`)}
                          className="p-1 hover:bg-[#FAF9F5] text-[#667085] rounded"
                          title="Download Invoice PDF"
                          aria-label="Download Invoice PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {!isPaid && (
                          <button
                            onClick={() => setSelectedInvoiceForPayment(inv)}
                            className="px-2.5 py-1 bg-[#061A2F] hover:bg-[#031323] text-white rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3 text-[#E8C66A]" />
                            <span>Pay Demo</span>
                          </button>
                        )}
                        {!isPaid && (
                          <button
                            onClick={() => setSelectedInvoiceForDispute(inv)}
                            className="p-1 hover:bg-[#FFEBEE] text-[#C62828] rounded text-[11px]"
                            title="Dispute Invoice"
                            aria-label="Dispute Invoice"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Invoice Detail Modal */}
      {selectedInvoiceForDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-detail-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <div>
                <h3 id="invoice-detail-title" className="text-sm font-bold text-[#061A2F]">
                  Itemized Professional Fee Invoice
                </h3>
                <div className="text-[11px] font-mono text-[#667085]">{selectedInvoiceForDetail.invoiceNumber}</div>
              </div>
              <button
                onClick={() => setSelectedInvoiceForDetail(null)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB] space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-[#667085]">Firm Name:</span>
                  <span className="font-bold text-[#061A2F]">A/R Tax Services, LLC</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[#667085]">Client Entity:</span>
                  <span className="font-bold text-[#061A2F]">{selectedInvoiceForDetail.clientName}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-[#667085]">Engagement:</span>
                  <span>{selectedInvoiceForDetail.engagementTitle}</span>
                </div>
              </div>

              <div className="font-bold text-[#061A2F] pt-2">Itemized Professional Services:</div>
              <div className="divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded p-3 bg-white">
                <div className="py-2 flex justify-between">
                  <div>
                    <div className="font-semibold text-[#061A2F]">Form 1120-S Preparation & Reconciliation</div>
                    <div className="text-[10px] text-[#667085]">Trial balance tie-out, Schedule M-1 adjustments</div>
                  </div>
                  <div className="font-mono font-bold">$1,500.00</div>
                </div>
                <div className="py-2 flex justify-between">
                  <div>
                    <div className="font-semibold text-[#061A2F]">South Carolina SC1120S State Compliance</div>
                    <div className="text-[10px] text-[#667085]">Elective pass-through entity tax credit schedules</div>
                  </div>
                  <div className="font-mono font-bold">$500.00</div>
                </div>
                <div className="py-2 flex justify-between">
                  <div>
                    <div className="font-semibold text-[#061A2F]">Senior CPA Technical Quality Review</div>
                    <div className="text-[10px] text-[#667085]">Maker-checker release gate (Elena Rostova, CPA)</div>
                  </div>
                  <div className="font-mono font-bold">$250.00</div>
                </div>
                <div className="py-2 flex justify-between text-[#1B5E20]">
                  <div className="font-semibold">Engagement Retainer Draw Applied</div>
                  <div className="font-mono font-bold">-$500.00</div>
                </div>
                <div className="py-2 flex justify-between font-bold text-sm bg-[#FAF9F5] p-2 rounded">
                  <span>Balance Due:</span>
                  <span className="font-mono text-[#061A2F]">${selectedInvoiceForDetail.balanceDue.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-[#D8DCE2] flex justify-between items-center">
              <button
                onClick={() => setSelectedInvoiceForPlan(selectedInvoiceForDetail)}
                className="text-xs font-bold text-[#061A2F] hover:underline cursor-pointer"
              >
                Request Installment Plan
              </button>
              <button
                onClick={() => setSelectedInvoiceForDetail(null)}
                className="px-4 py-1.5 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Simulate Payment Modal */}
      {selectedInvoiceForPayment && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="simulate-payment-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="simulate-payment-title" className="text-sm font-bold text-[#061A2F]">
                Simulate Fee Payment
              </h3>
              <button
                onClick={() => setSelectedInvoiceForPayment(null)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mandatory Demonstration Disclaimer */}
            <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded space-y-1 text-xs">
              <div className="font-bold text-[#061A2F] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#C99A32]" />
                Demo payment only — no funds will move.
              </div>
              <p className="text-[11px] text-[#4B5563]">
                Payment integration not configured. Executing this action updates the demonstration data store and issues a mock electronic receipt.
              </p>
            </div>

            <form onSubmit={handleSimulatePayment} className="space-y-3 text-xs">
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
                <div className="flex justify-between font-mono">
                  <span className="text-[#667085]">Invoice Number:</span>
                  <span className="font-bold text-[#061A2F]">{selectedInvoiceForPayment.invoiceNumber}</span>
                </div>
                <div className="flex justify-between font-mono mt-1">
                  <span className="text-[#667085]">Total Settlement Amount:</span>
                  <span className="font-bold text-base text-[#061A2F]">
                    ${selectedInvoiceForPayment.balanceDue.toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Select Payment Instrument</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                >
                  <option value="Corporate Credit Card (ending 4242)">Corporate Credit Card (ending 4242)</option>
                  <option value="ACH Bank Transfer (PNC Bank ending 9871)">ACH Bank Transfer (PNC Bank ending 9871)</option>
                  <option value="Retainer Account Draw">Retainer Account Draw</option>
                </select>
              </div>

              <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#061A2F] text-[#E8C66A] text-xs font-bold uppercase tracking-wider rounded hover:bg-[#031323] cursor-pointer shadow-xs"
                >
                  Confirm Simulated Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Dispute Modal */}
      {selectedInvoiceForDispute && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dispute-invoice-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="dispute-invoice-title" className="text-sm font-bold text-[#061A2F]">
                Submit Invoice Dispute
              </h3>
              <button
                onClick={() => setSelectedInvoiceForDispute(null)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDispute} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Dispute Reason</label>
                <select
                  value={disputeField}
                  onChange={(e) => setDisputeField(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                >
                  <option value="Scope of Service">Scope of Service Discrepancy</option>
                  <option value="Retainer Calculation">Retainer Calculation Incorrect</option>
                  <option value="Fee Schedule Discrepancy">Fee Schedule Discrepancy</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Explanation *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain why you are disputing this invoice..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForDispute(null)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C62828] text-white text-xs font-bold rounded hover:bg-[#B71C1C] cursor-pointer"
                >
                  Submit Dispute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Payment Plan Modal */}
      {selectedInvoiceForPlan && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-plan-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="payment-plan-title" className="text-sm font-bold text-[#061A2F]">
                Request Installment Payment Plan
              </h3>
              <button
                onClick={() => setSelectedInvoiceForPlan(null)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestPlan} className="space-y-3 text-xs">
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
                <div className="font-bold text-[#061A2F]">Proposed 3-Month Schedule:</div>
                <div className="text-[11px] text-[#667085] mt-1 space-y-1">
                  <div className="flex justify-between"><span>Month 1:</span><span className="font-mono font-bold">$583.33</span></div>
                  <div className="flex justify-between"><span>Month 2:</span><span className="font-mono font-bold">$583.33</span></div>
                  <div className="flex justify-between"><span>Month 3:</span><span className="font-mono font-bold">$583.34</span></div>
                </div>
              </div>

              <p className="text-[11px] text-[#667085]">
                Subject to managing member approval. No late fees will accrue during active agreement.
              </p>

              <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceForPlan(null)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
                >
                  Request Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
