/**
 * A/R Tax Services, LLC - Client Portal Extended Navigation Sub-Views
 * Implementation of secondary grouped views: Document Requests, Import History,
 * AR/AP ledgers, Trial Balance, Period Close, Filing Status, Appointments,
 * Notifications, Audit Activity History, and Contact Support.
 */

import React, { useState } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
  Layers,
  BookOpen,
  Scale,
  Lock,
  Send,
  Bell,
  History,
  Phone,
  Mail,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';

/* 1. Document Requests View */
export const ClientDocumentRequestsView: React.FC<{ onNavigateToUpload: () => void }> = ({ onNavigateToUpload }) => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Accountant Document Requests</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Active formal requests submitted by your engagement team requiring client documentation.
            </p>
          </div>
          <button
            onClick={onNavigateToUpload}
            className="px-4 py-2 bg-[#061A2F] text-white rounded text-xs font-semibold hover:bg-[#0A2544] flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4 text-[#D7AC4A]" />
            <span>Upload Requested Items</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 rounded">
                Action Required
              </span>
              <span className="text-xs text-neutral-500 font-mono">Issued Feb 20, 2026</span>
            </div>
            <h3 className="text-sm font-bold text-neutral-900">ALTA Settlement Statement for Commercial Real Estate Purchase</h3>
            <p className="text-xs text-neutral-600">Requested by Desmond Hinds, CPA for Section 1031 depreciation basis allocation.</p>
          </div>
          <button
            onClick={onNavigateToUpload}
            className="px-3 py-1.5 bg-[#061A2F] text-white text-xs font-semibold rounded hover:bg-[#0A2544]"
          >
            Fulfill Request
          </button>
        </div>

        <div className="p-4 bg-white border border-emerald-300 bg-emerald-50/20 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 rounded">
                Completed
              </span>
              <span className="text-xs text-neutral-500 font-mono">Fulfilled Feb 18, 2026</span>
            </div>
            <h3 className="text-sm font-bold text-neutral-900">Form 1099-INT Chase Private Client</h3>
            <p className="text-xs text-neutral-600">Uploaded and approved by engagement reviewer.</p>
          </div>
          <span className="text-xs font-mono text-emerald-700 font-bold">Verified in Vault</span>
        </div>
      </div>
    </div>
  );
};

/* 2. Import History View */
export const ClientImportHistoryView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Data Import & Transmission History</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Complete log of automated bank feed syncs, manual spreadsheet uploads, and tax slip ingestion events.
        </p>
      </div>

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-3">
        <div className="p-3 border border-neutral-200 rounded flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-neutral-900">QuickBooks Online Cloud Sync</span>
            <div className="text-neutral-500 text-[11px] mt-0.5">84 transactions imported into cash receipts ledger</div>
          </div>
          <span className="font-mono text-neutral-500">2026-02-27 18:22 EST</span>
        </div>

        <div className="p-3 border border-neutral-200 rounded flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-neutral-900">Plaid Bank Feed Sweep (Chase Operating ****1092)</span>
            <div className="text-neutral-500 text-[11px] mt-0.5">31 posted transactions reconciled</div>
          </div>
          <span className="font-mono text-neutral-500">2026-02-26 06:00 EST</span>
        </div>
      </div>
    </div>
  );
};

/* 3. Customers & Accounts Receivable */
export const ClientCustomersArView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Customers & Accounts Receivable Ledger</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Commercial invoicing, outstanding collections, and customer aging analysis for CY2025.
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-[10px] text-neutral-500 uppercase block">Total Open AR</span>
            <span className="text-lg font-bold text-neutral-900">$48,250.00</span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 font-mono uppercase text-[10px]">
              <th className="py-2">Customer Entity</th>
              <th className="py-2">Invoice #</th>
              <th className="py-2">Due Date</th>
              <th className="py-2">Amount</th>
              <th className="py-2">Aging Bracket</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-neutral-800">
            <tr>
              <td className="py-2.5 font-bold">Apex Commercial Real Estate</td>
              <td className="py-2.5 font-mono">INV-2025-089</td>
              <td className="py-2.5 font-mono">2026-03-15</td>
              <td className="py-2.5 font-mono font-bold">$22,500.00</td>
              <td className="py-2.5 text-neutral-600">Current (&lt;30 days)</td>
              <td className="py-2.5"><span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-bold">Unpaid</span></td>
            </tr>
            <tr>
              <td className="py-2.5 font-bold">Highland Partners Ltd.</td>
              <td className="py-2.5 font-mono">INV-2025-074</td>
              <td className="py-2.5 font-mono">2026-02-28</td>
              <td className="py-2.5 font-mono font-bold">$25,750.00</td>
              <td className="py-2.5 text-neutral-600">Current (&lt;30 days)</td>
              <td className="py-2.5"><span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-bold">Pending ACH</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* 4. Vendors & Accounts Payable */
export const ClientVendorsApView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Vendors & Accounts Payable Ledger</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Subcontractor bills, Form W-9 compliance tracking, and scheduled vendor disbursements.
            </p>
          </div>
          <div className="text-right font-mono">
            <span className="text-[10px] text-neutral-500 uppercase block">Total Open AP</span>
            <span className="text-lg font-bold text-neutral-900">$16,400.00</span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500 font-mono uppercase text-[10px]">
              <th className="py-2">Vendor Name</th>
              <th className="py-2">Form W-9</th>
              <th className="py-2">Bill #</th>
              <th className="py-2">Due Date</th>
              <th className="py-2">Amount</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-neutral-800">
            <tr>
              <td className="py-2.5 font-bold">Mid-Atlantic Concrete Supplies</td>
              <td className="py-2.5"><span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">W-9 Verified</span></td>
              <td className="py-2.5 font-mono">BILL-9921</td>
              <td className="py-2.5 font-mono">2026-03-10</td>
              <td className="py-2.5 font-mono font-bold">$11,200.00</td>
              <td className="py-2.5"><span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-bold">Scheduled</span></td>
            </tr>
            <tr>
              <td className="py-2.5 font-bold">Vance Legal Counsel Group</td>
              <td className="py-2.5"><span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">W-9 Verified</span></td>
              <td className="py-2.5 font-mono">BILL-4108</td>
              <td className="py-2.5 font-mono">2026-03-15</td>
              <td className="py-2.5 font-mono font-bold">$5,200.00</td>
              <td className="py-2.5"><span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-bold">Approved</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* 5. General Ledger View */
export const ClientLedgerView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">General Ledger Activity Log</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Double-entry debits and credits synchronized with your chart of accounts for CY2025.
        </p>
      </div>

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-neutral-300 text-neutral-500 uppercase text-[10px]">
              <th className="py-2">Date</th>
              <th className="py-2">Account</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Debit ($)</th>
              <th className="py-2 text-right">Credit ($)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            <tr>
              <td className="py-2">2025-12-31</td>
              <td className="py-2 font-bold text-neutral-900">1010 — Operating Cash</td>
              <td className="py-2 text-neutral-600">Client Retainer Payment Receipt</td>
              <td className="py-2 text-right text-emerald-700 font-bold">45,000.00</td>
              <td className="py-2 text-right text-neutral-400">—</td>
            </tr>
            <tr>
              <td className="py-2">2025-12-31</td>
              <td className="py-2 font-bold text-neutral-900">4010 — Consulting Revenue</td>
              <td className="py-2 text-neutral-600">Recognition of advisory fees</td>
              <td className="py-2 text-right text-neutral-400">—</td>
              <td className="py-2 text-right text-emerald-700 font-bold">45,000.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* 6. Trial Balance View */
export const ClientTrialBalanceView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Adjusted Trial Balance</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Cumulative year-end financial position verified and balanced for Schedule C / Form 1065 conversion.
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold rounded font-mono">
            Balanced: $1,420,500.00
          </span>
        </div>
      </div>

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-neutral-300 text-neutral-500 uppercase text-[10px]">
              <th className="py-2">Account Code</th>
              <th className="py-2">Account Description</th>
              <th className="py-2 text-right">Debit Balance</th>
              <th className="py-2 text-right">Credit Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            <tr>
              <td className="py-2 font-bold">1010</td>
              <td className="py-2">Chase Operating Cash</td>
              <td className="py-2 text-right font-bold">$218,400.00</td>
              <td className="py-2 text-right text-neutral-400">—</td>
            </tr>
            <tr>
              <td className="py-2 font-bold">1200</td>
              <td className="py-2">Accounts Receivable</td>
              <td className="py-2 text-right font-bold">$48,250.00</td>
              <td className="py-2 text-right text-neutral-400">—</td>
            </tr>
            <tr>
              <td className="py-2 font-bold">2000</td>
              <td className="py-2">Accounts Payable</td>
              <td className="py-2 text-right text-neutral-400">—</td>
              <td className="py-2 text-right font-bold">$16,400.00</td>
            </tr>
            <tr>
              <td className="py-2 font-bold">3000</td>
              <td className="py-2">Member Capital & Equity</td>
              <td className="py-2 text-right text-neutral-400">—</td>
              <td className="py-2 text-right font-bold">$250,250.00</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* 7. Period Close View */
export const ClientPeriodCloseView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Financial Period Close Status</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Accounting books lock and closure milestones for quarterly and annual tax preparation.
        </p>
      </div>

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-3 text-xs">
        <div className="p-3 border border-neutral-200 rounded flex items-center justify-between">
          <div>
            <span className="font-bold text-neutral-900">CY2025 Annual Books Lock</span>
            <div className="text-neutral-500 text-[11px]">Period closed by Desmond Hinds, CPA on Jan 31, 2026</div>
          </div>
          <span className="px-2.5 py-1 bg-[#0A2544] text-[#E8C66A] font-bold font-mono text-[10px] rounded flex items-center gap-1">
            <Lock className="w-3 h-3" /> Locked
          </span>
        </div>
      </div>
    </div>
  );
};

/* 8. Electronic Filing & Acknowledgments */
export const ClientFilingStatusView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Electronic Filing Status & IRS MEF Confirmations</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Direct status of IRS Modernized e-File (MeF) transmissions and state department receipts.
        </p>
      </div>

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-3 text-xs">
        <div className="p-3.5 border border-neutral-200 rounded-lg bg-neutral-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-neutral-900 text-sm">IRS Form 1040 Federal Return (CY2025)</span>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-mono font-bold rounded text-[10px]">
              Pending Client Signature (Form 8879)
            </span>
          </div>
          <p className="text-neutral-600">
            The tax return package has been reviewed and approved by Desmond Hinds, CPA. Review and e-sign Form 8879 to authorize electronic batch transmission.
          </p>
        </div>
      </div>
    </div>
  );
};

/* 9. Appointments & Consultations */
export const ClientAppointmentsView: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [topic, setTopic] = useState('CY2025 Final Return Review & Strategy Call');
  const [preferredDate, setPreferredDate] = useState('2026-03-20');
  const [preferredTime, setPreferredTime] = useState('14:00');
  const [notes, setNotes] = useState('');
  const [bookedAppointments, setBookedAppointments] = useState([
    {
      id: 'apt-01',
      title: 'CY2025 Final Return Review & Strategy Call',
      host: 'Desmond Hinds, CPA (Google Meet / Zoom)',
      dateStr: 'March 8, 2026 • 2:00 PM EST',
      status: 'Confirmed'
    }
  ]);
  const [notice, setNotice] = useState<string | null>(null);

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault();
    const newApt = {
      id: `apt-${Date.now()}`,
      title: topic,
      host: 'Desmond Hinds, CPA & Senior Tax Strategist',
      dateStr: `${preferredDate} • ${preferredTime} EST`,
      status: 'Confirmed'
    };
    setBookedAppointments(prev => [newApt, ...prev]);
    setShowModal(false);
    setNotice(`Appointment reserved: "${topic}" on ${preferredDate} at ${preferredTime} EST. Calendar invite dispatched.`);
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Tax Consultations & Strategy Calls</h2>
            <p className="text-sm text-neutral-600 mt-1">
              Schedule or review video conferences with Desmond Hinds, CPA and senior tax strategists.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-[#061A2F] text-white rounded text-xs font-semibold hover:bg-[#0A2544] flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-[#D7AC4A]" />
            <span>Schedule New Call</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-medium flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-3">
        <h3 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Scheduled Consultations</h3>
        {bookedAppointments.map(apt => (
          <div key={apt.id} className="p-3 border border-neutral-200 rounded flex items-center justify-between text-xs hover:border-neutral-300 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-[#D7AC4A] bg-[#061A2F] flex-shrink-0">
                <img
                  src="/ceo/123456789-desmond.png"
                  alt="Desmond Hinds, Founder and Chief Executive Officer of A/R Tax Services, LLC"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div>
                <span className="font-bold text-neutral-900">{apt.title}</span>
                <div className="text-neutral-500 text-[11px] mt-0.5">With {apt.host}</div>
              </div>
            </div>
            <div className="text-right font-mono">
              <div className="font-bold text-neutral-900">{apt.dateStr}</div>
              <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{apt.status}</span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl border border-neutral-300 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C99A32]" />
                <span>Schedule Consultation with Desmond Hinds, CPA</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleBook} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-neutral-800 mb-1">Consultation Topic</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white text-xs"
                >
                  <option value="CY2025 Final Return Review & Strategy Call">CY2025 Final Return Review & Strategy Call</option>
                  <option value="CY2026 Forward Tax Planning & PTET Analysis">CY2026 Forward Tax Planning & PTET Analysis</option>
                  <option value="IRS / State Notice Technical Response Review">IRS / State Notice Technical Response Review</option>
                  <option value="Entity Restructuring & Capital Allocation Call">Entity Restructuring & Capital Allocation Call</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">Target Date</label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-800 mb-1">Preferred Time</label>
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded text-xs bg-white"
                  >
                    <option value="10:00 AM">10:00 AM EST</option>
                    <option value="11:30 AM">11:30 AM EST</option>
                    <option value="02:00 PM">02:00 PM EST</option>
                    <option value="04:30 PM">04:30 PM EST</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-800 mb-1">Specific Questions or Focus Areas</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="E.g. Review K-1 allocation and 1099-B wash sale carryovers..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 border border-neutral-300 hover:bg-neutral-50 rounded text-neutral-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#061A2F] hover:bg-[#0A2544] text-white rounded font-semibold transition-colors cursor-pointer"
                >
                  Confirm Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* 10. Notifications & Alerts */
export const ClientNotificationsView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Notifications & Action Center</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Automated compliance alerts, filing reminders, and practitioner advisory broadcasts.
        </p>
      </div>

      <div className="space-y-2.5">
        <div className="p-3.5 bg-white border border-neutral-300 rounded-lg shadow-xs text-xs flex items-start gap-3">
          <Bell className="w-4 h-4 text-[#0A2544] mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <div className="font-bold text-neutral-900">Q1 2026 Estimated Tax Payment Due in 45 Days</div>
            <p className="text-neutral-600">The first quarterly installment of $4,850.00 is due on April 15, 2026. Review vouchers in the Estimated Tax tab.</p>
            <span className="text-[10px] font-mono text-neutral-400 block">Today, 08:30 EST</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* 11. Activity History & Audit Log */
export const ClientActivityHistoryView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Portal Security & Audit Log</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Immutable chain-of-custody logging of user access, uploads, signature actions, and document downloads.
        </p>
      </div>

      <div className="p-4 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-2 text-xs font-mono">
        <div className="p-2 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <span className="font-bold text-neutral-900">Document Upload Completed</span>
            <span className="text-neutral-500 ml-2">2025_Form_W2_Apex_Technology.pdf</span>
          </div>
          <span className="text-neutral-400">2026-02-28 10:14:02 UTC</span>
        </div>
        <div className="p-2 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <span className="font-bold text-neutral-900">Tax Year Switch</span>
            <span className="text-neutral-500 ml-2">Switched active view to CY2025</span>
          </div>
          <span className="text-neutral-400">2026-02-28 09:55:18 UTC</span>
        </div>
      </div>
    </div>
  );
};

/* 12. Contact Support */
export const ClientContactSupportView: React.FC = () => {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [dispatchedTicket, setDispatchedTicket] = useState<{ id: string; time: string; text: string } | null>(null);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setDispatchedTicket({
      id: `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: message.trim()
    });
    setMessage('');
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold text-neutral-900">Dedicated Practice Support</h2>
        <p className="text-sm text-neutral-600 mt-1">
          Connect directly with the A/R Tax Services operations desk, administrative team, or your lead CPA.
        </p>
      </div>

      {dispatchedTicket && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-lg text-xs space-y-1">
          <div className="font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>Support Ticket Registered ({dispatchedTicket.id})</span>
          </div>
          <p className="text-emerald-800">
            Your inquiry has been routed to the engagement coordinator desk at {dispatchedTicket.time}. A response will be posted in your Messages & Tasks tab.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-5 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-2">
          <h3 className="text-sm font-bold text-neutral-900">Direct Office Contact</h3>
          <div className="space-y-1.5 text-neutral-700">
            <div><strong>Firm:</strong> A/R Tax Services, LLC</div>
            <div><strong>Lead Practitioner:</strong> Desmond Hinds, CPA</div>
            <div><strong>Direct Telephone:</strong> (240) 413-0570</div>
            <div><strong>Practice Email:</strong> contact@artaxservices.com</div>
            <div><strong>Hours:</strong> Mon–Fri 8:30 AM – 6:30 PM EST</div>
          </div>
        </div>

        <div className="p-5 bg-white border border-neutral-300 rounded-lg shadow-xs space-y-2">
          <h3 className="text-sm font-bold text-neutral-900">Submit Direct Message</h3>
          <form onSubmit={handleSendMessage} className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-semibold text-neutral-700">Urgency:</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="px-2 py-1 border border-neutral-300 rounded text-xs bg-white"
              >
                <option value="Normal">Normal — Standard Inquiry</option>
                <option value="Urgent">Urgent — Statutory Filing Deadline</option>
                <option value="Audit">Priority — IRS Notice or Audit Examination</option>
              </select>
            </div>
            <textarea
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message or technical question to the engagement coordinator..."
              className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
              rows={3}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#061A2F] text-white rounded text-xs font-semibold hover:bg-[#0A2544] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-[#D7AC4A]" />
              <span>Send Message</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
