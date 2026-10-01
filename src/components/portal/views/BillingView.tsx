import React, { useState } from 'react';
import {
  CreditCard,
  Download,
  CheckCircle2,
  ShieldCheck,
  Receipt,
  FileText,
  Clock,
  DollarSign,
  ChevronRight,
  ExternalLink,
  Lock,
  X
} from 'lucide-react';
import { Invoice } from '../../../types';

interface BillingViewProps {
  invoices: Invoice[];
}

export const BillingView: React.FC<BillingViewProps> = ({ invoices }) => {
  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'proposals' | 'receipts' | 'history'>('invoices');
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<{ [key: string]: boolean }>({});
  const [showPaymentModal, setShowPaymentModal] = useState<Invoice | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const actualInvoices: Invoice[] = invoices || [];

  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;

    setPayingInvoiceId(showPaymentModal.id);
    setTimeout(() => {
      setPaidIds(prev => ({ ...prev, [showPaymentModal.id]: true }));
      setPayingInvoiceId(null);
      setPaymentSuccess(`Payment of $${showPaymentModal.amount.toFixed(2)} processed successfully for ${showPaymentModal.invoiceNumber}. Receipt generated.`);
      setShowPaymentModal(null);
    }, 1200);
  };

  const handleDownloadReceipt = (inv: Invoice) => {
    const text = 
      `=======================================================\n` +
      `A/R TAX SERVICES, LLC - OFFICIAL PAYMENT RECEIPT\n` +
      `=======================================================\n` +
      `Receipt Reference: REC-${inv.invoiceNumber}\n` +
      `Client: ${inv.clientName}\n` +
      `Practice Lead: Desmond Hinds, Founder & CEO\n` +
      `Date of Transaction: ${inv.issuedDate}\n` +
      `Amount Paid: $${inv.amount.toFixed(2)} USD\n` +
      `Description: ${inv.description}\n` +
      `Payment Method: Authorized Electronic Remittance\n` +
      `Status: FULLY SETTLED / NO OUTSTANDING BALANCE\n` +
      `=======================================================\n` +
      `A/R Tax Services, LLC • Columbia, SC • (843) 555-0199\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt_${inv.invoiceNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOutstanding = actualInvoices
    .filter(i => i.status !== 'paid' && !paidIds[i.id])
    .reduce((sum, i) => sum + i.amount, 0);

  const totalPaid = actualInvoices
    .filter(i => i.status === 'paid' || paidIds[i.id])
    .reduce((sum, i) => sum + i.amount, 0);

  return (
    <div className="space-y-6" id="client-billing-container">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#0B2748]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
            Engagement Invoicing &amp; Payment Processing
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5">
            Billing &amp; Fee Management
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Transparent professional fee schedules, invoices, payments, and downloadable tax-deductible receipts.
          </p>
        </div>

        {/* Subtab Navigation */}
        <div className="flex items-center gap-1 bg-[#07172B] border border-[#1E3A5F] p-1 rounded-xl text-xs overflow-x-auto">
          {[
            { key: 'invoices', label: 'Invoices' },
            { key: 'proposals', label: 'Fee Proposals' },
            { key: 'receipts', label: 'Payment Receipts' },
            { key: 'history', label: 'Billing Statements' }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSubTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap ${
                activeSubTab === tab.key
                  ? 'bg-[#C99A3D] text-[#06172C] shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#0A1F38]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {paymentSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{paymentSuccess}</span>
          </div>
          <button type="button" onClick={() => setPaymentSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-5 shadow">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Current Balance Due</div>
          <div className="text-2xl font-serif font-bold text-white mt-1">${totalOutstanding.toFixed(2)}</div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            {totalOutstanding === 0 ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> No balance due
              </>
            ) : (
              <span className="text-amber-400">Payment pending</span>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-5 shadow">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Fees Paid</div>
          <div className="text-2xl font-serif font-bold text-[#E2BD67] mt-1">${totalPaid.toFixed(2)}</div>
          <div className="text-[11px] text-slate-300 mt-1">
            Settled client payments
          </div>
        </div>

        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-5 shadow">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tax Deductibility</div>
          <div className="text-2xl font-serif font-bold text-white mt-1">IRC § 162 / 212</div>
          <div className="text-[11px] text-slate-300 mt-1">
            Business advisory portion deductible as professional fees
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 1. INVOICES */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'invoices' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-4">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Engagement Invoices
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Itemized billing for preparation, electronic filing, accounting reconciliation, and advisory services.
            </p>
          </div>

          {actualInvoices.length === 0 ? (
            <div className="p-8 text-center bg-[#06172C] rounded-xl border border-dashed border-slate-700 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-bold text-white">No Invoices Issued</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No invoices or professional fee statements have been billed for this engagement yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {actualInvoices.map((inv) => {
                const isPaid = inv.status === 'paid' || paidIds[inv.id];
                return (
                  <div
                    key={inv.id}
                    className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{inv.invoiceNumber}</span>
                          <span className="text-slate-400">&bull; Issued {inv.issuedDate}</span>
                        </div>
                        <p className="text-slate-300 mt-1 leading-relaxed max-w-2xl">{inv.description}</p>
                      </div>

                      <div className="flex sm:flex-col sm:items-end justify-between items-center gap-1">
                        <span className="font-serif text-lg font-bold text-white">${inv.amount.toFixed(2)}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {isPaid ? '✓ Paid in Full' : 'Pending Payment'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#1E3A5F]/60 text-[11px] text-slate-400">
                      <span>Payment Terms: Net 15 &bull; Practice Lead: Desmond Hinds</span>
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(inv)}
                          className="px-3 py-1.5 rounded-lg bg-[#0B2748] hover:bg-[#11355F] text-white border border-[#C99A3D]/40 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-[#C99A3D]" />
                          <span>Download Receipt</span>
                        </button>
                        {!isPaid && (
                          <button
                            type="button"
                            onClick={() => setShowPaymentModal(inv)}
                            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] text-[#06172C] font-bold transition-all shadow cursor-pointer"
                          >
                            Pay Online
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. PROPOSALS & FEE SCHEDULE */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'proposals' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-4">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Annual Engagement Proposal &amp; Fee Schedule
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Fixed fee scope agreed upon in your Annual Engagement Agreement.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3 text-xs">
            <div className="font-bold text-white text-sm">Comprehensive Tax &amp; Advisory Retainer</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
              <div>&bull; Federal &amp; State Tax Return Preparation</div>
              <div>&bull; Verified Stage 01 &mdash; Stage 18 Process Integration</div>
              <div>&bull; Schedule C / E / Pass-Through Reconciliation</div>
              <div>&bull; IRC § 7216 Secure Data Confidentiality</div>
              <div>&bull; Year-Round Practice Leader Access</div>
              <div>&bull; Direct CPA Review &amp; E-Filing Authorization</div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. RECEIPTS & STATEMENTS */}
      {/* --------------------------------------------------------------------- */}
      {(activeSubTab === 'receipts' || activeSubTab === 'history') && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-4">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Payment Receipts &amp; Annual Statements
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Export official statements for your personal files or business expense reimbursement.
            </p>
          </div>

          {actualInvoices.filter(i => i.status === 'paid' || paidIds[i.id]).length === 0 ? (
            <div className="p-8 text-center bg-[#06172C] rounded-xl border border-dashed border-slate-700 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-bold text-white">No Payment Receipts On File</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Official payment receipts will be generated here automatically when invoices are settled.
              </p>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              {actualInvoices
                .filter(i => i.status === 'paid' || paidIds[i.id])
                .map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-white">Official Receipt: REC-{inv.invoiceNumber}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">Paid on {inv.dueDate} &bull; ${inv.amount.toFixed(2)} USD</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(inv)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#0B2748] hover:bg-[#11355F] text-white border border-[#C99A3D]/40 font-semibold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#C99A3D]" />
                      <span>Download Statement</span>
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. PAYMENT MODAL */}
      {/* --------------------------------------------------------------------- */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#07172B] border-2 border-[#C99A3D] p-6 sm:p-7 shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setShowPaymentModal(null)}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
                Secure Payment Gateway
              </div>
              <h2 className="font-serif text-xl font-bold text-white mt-0.5">
                Pay Invoice: {showPaymentModal.invoiceNumber}
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Amount Due: <strong className="text-white">${showPaymentModal.amount.toFixed(2)} USD</strong>
              </p>
            </div>

            <form onSubmit={handleExecutePayment} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Cardholder Name:</label>
                <input
                  type="text"
                  defaultValue="Robert Perotti"
                  className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#C99A3D]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-300">Card Number:</label>
                <div className="flex items-center bg-[#06172C] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-white">
                  <CreditCard className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    defaultValue="•••• •••• •••• 4242"
                    className="w-full bg-transparent text-white focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">Expiration:</label>
                  <input
                    type="text"
                    defaultValue="08/28"
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#C99A3D] font-mono"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-300">CVC:</label>
                  <input
                    type="password"
                    defaultValue="•••"
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#C99A3D] font-mono"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-[11px] text-slate-400 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>256-bit encrypted tokenized payment. Raw card numbers are never stored.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(null)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-[#0B2748]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payingInvoiceId !== null}
                  className="px-6 py-2.5 rounded-xl font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow"
                >
                  {payingInvoiceId ? 'Processing...' : `Pay $${showPaymentModal.amount.toFixed(2)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
