/**
 * A/R Tax Services, LLC - Missing Document & Information Center
 * Sections 20, 21: Client Request Generation, Document Waivers, and Status Tracking.
 */

import React, { useState } from 'react';
import { 
  FileQuestion, 
  Send, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Plus, 
  FileText, 
  Clock, 
  AlertTriangle,
  Info,
  ShieldCheck,
  Search
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';
import { MissingDocumentRecord } from '../../types/accountantCenter';

interface MissingDocumentCenterProps {
  isDark: boolean;
}

export const MissingDocumentCenter: React.FC<MissingDocumentCenterProps> = ({ isDark }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [waiveModalItem, setWaiveModalItem] = useState<MissingDocumentRecord | null>(null);
  const [waiveReason, setWaiveReason] = useState('');

  // New Request Form state
  const [reqDocTitle, setReqDocTitle] = useState('');
  const [reqCategory, setReqCategory] = useState('Critical / Accountant Review');
  const [reqPriority, setReqPriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('High');
  const [reqReason, setReqReason] = useState('');
  const [reqMessage, setReqMessage] = useState('');
  const [reqDueDate, setReqDueDate] = useState('2026-03-25');

  const missingItems = accountantCenterService.getMissingDocuments();
  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();

  const filtered = missingItems.filter(item => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    return true;
  });

  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqDocTitle || !reqReason) {
      alert('Please specify the requested document and reason.');
      return;
    }

    accountantCenterService.requestMissingDocument({
      documentTitle: reqDocTitle,
      category: reqCategory as any,
      priority: reqPriority,
      reasonIdentified: reqReason,
      dueDate: reqDueDate,
      clientMessage: reqMessage || `Dear ${client.name}, please provide your ${reqDocTitle} for tax year ${taxYear} at your earliest convenience.`
    });

    setIsRequestModalOpen(false);
    setReqDocTitle('');
    setReqReason('');
    setReqMessage('');
  };

  const handleApplyWaive = () => {
    if (!waiveModalItem) return;
    if (!waiveReason.trim()) {
      alert('Please provide professional reason/justification for waiving this documentation.');
      return;
    }

    accountantCenterService.waiveMissingDocument(waiveModalItem.id, waiveReason);
    setWaiveModalItem(null);
    setWaiveReason('');
  };

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Sections 20 &amp; 21 &bull; Document Deficiencies
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
            Missing Document &amp; Information Intake
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Track documentation required to satisfy IRC substantiation rules for <strong>{client.name}</strong> (TY{taxYear}).
          </p>
        </div>

        <button
          onClick={() => setIsRequestModalOpen(true)}
          className="px-3.5 py-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-xs font-bold uppercase rounded hover:opacity-90 flex items-center gap-1.5 transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Request Document from Client</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className={`p-3 border rounded-lg shadow-sm ${cardBg} flex flex-wrap gap-2 text-xs font-mono`}>
        {['ALL', 'Critical / Accountant Review', 'Client Follow-up Required', 'Recommended Supporting Documentation', 'Potentially Not Applicable'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded border transition-colors ${
              selectedCategory === cat 
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold border-transparent' 
                : 'border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table of Missing Items */}
      <div className={`border rounded-lg shadow-sm overflow-x-auto ${cardBg}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
              <th className="p-3">Document Requested</th>
              <th className="p-3">Category</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Reason / Basis</th>
              <th className="p-3">Due Date</th>
              <th className="p-3">Client Status</th>
              <th className="p-3">Accountant Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                <td className="p-3 font-bold text-neutral-900 dark:text-white">
                  <div>{item.documentTitle}</div>
                  <div className="text-[10px] font-mono text-neutral-500">{item.id}</div>
                </td>
                <td className="p-3 font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                  {item.category}
                </td>
                <td className="p-3 font-mono">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.priority === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                    item.priority === 'High' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                    'bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300'
                  }`}>
                    {item.priority}
                  </span>
                </td>
                <td className="p-3 text-neutral-700 dark:text-neutral-300 max-w-xs">
                  {item.reasonIdentified}
                  {item.accountantNotes && (
                    <div className="text-[10px] font-mono text-emerald-600 mt-1">
                      Note: {item.accountantNotes}
                    </div>
                  )}
                </td>
                <td className="p-3 font-mono text-neutral-600 dark:text-neutral-400">
                  {item.dueDate || '—'}
                </td>
                <td className="p-3 font-mono text-[10px]">
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    item.clientStatus === 'Received' ? 'bg-emerald-100 text-emerald-800' :
                    item.clientStatus === 'Requested' ? 'bg-blue-100 text-blue-800' :
                    'bg-neutral-200 text-neutral-700'
                  }`}>
                    {item.clientStatus}
                  </span>
                </td>
                <td className="p-3 font-mono text-[10px]">
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    item.accountantStatus === 'Waived with Documented Reason' ? 'bg-neutral-200 text-neutral-800' :
                    item.accountantStatus === 'Under Review' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {item.accountantStatus}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {item.accountantStatus !== 'Waived with Documented Reason' && item.clientStatus !== 'Received' && (
                    <button
                      onClick={() => setWaiveModalItem(item)}
                      className="px-2 py-1 border border-neutral-400 dark:border-neutral-600 rounded text-[10px] font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Waive
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* REQUEST DOCUMENT MODAL */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form 
            onSubmit={handleSendRequest}
            className={`w-full max-w-lg border rounded-xl p-5 shadow-2xl ${
              isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
            } space-y-4`}
          >
            <div className="flex justify-between items-center border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold uppercase">Dispatch Document Request to Taxpayer</h3>
              <button type="button" onClick={() => setIsRequestModalOpen(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-neutral-500">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule K-1 from Apex BioTech, Form 1098 Mortgage Statement"
                  value={reqDocTitle}
                  onChange={e => setReqDocTitle(e.target.value)}
                  className="w-full mt-1 p-2 bg-neutral-50 dark:bg-neutral-800 border rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-neutral-500">Priority</label>
                  <select
                    value={reqPriority}
                    onChange={e => setReqPriority(e.target.value as any)}
                    className="w-full mt-1 p-2 bg-neutral-50 dark:bg-neutral-800 border rounded font-mono"
                  >
                    <option value="Critical">Critical (Blocks Filing)</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-mono font-bold uppercase text-neutral-500">Target Due Date</label>
                  <input
                    type="date"
                    value={reqDueDate}
                    onChange={e => setReqDueDate(e.target.value)}
                    className="w-full mt-1 p-2 bg-neutral-50 dark:bg-neutral-800 border rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-neutral-500">Reason / Tax Law Authority</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Required to substantiate partnership pass-through distribution on Schedule E Part II"
                  value={reqReason}
                  onChange={e => setReqReason(e.target.value)}
                  className="w-full mt-1 p-2 bg-neutral-50 dark:bg-neutral-800 border rounded"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-neutral-500">Client Portal Notification Message</label>
                <textarea
                  rows={3}
                  value={reqMessage}
                  onChange={e => setReqMessage(e.target.value)}
                  placeholder="Optional custom message displayed in client upload portal..."
                  className="w-full mt-1 p-2 bg-neutral-50 dark:bg-neutral-800 border rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="px-3 py-1.5 border rounded text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded text-xs font-bold uppercase flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Demo Request</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* WAIVE DOCUMENT MODAL */}
      {waiveModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`w-full max-w-lg border rounded-xl p-5 shadow-2xl ${
            isDark ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-neutral-900'
          } space-y-4`}>
            <div className="flex justify-between items-center border-b pb-3 border-neutral-200 dark:border-neutral-800">
              <h3 className="text-sm font-bold uppercase">Document Substantiation Waiver</h3>
              <button onClick={() => setWaiveModalItem(null)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-2 border rounded bg-neutral-50 dark:bg-neutral-800 font-mono">
                <div className="text-[10px] text-neutral-500">WAIVING DOCUMENT:</div>
                <strong>{waiveModalItem.documentTitle}</strong>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold uppercase text-neutral-500">
                  Preparer Justification / Alternative Evidence Basis
                </label>
                <textarea
                  rows={3}
                  value={waiveReason}
                  onChange={e => setWaiveReason(e.target.value)}
                  placeholder="Document why this item is not applicable or how the underlying transaction was corroborated via alternative records..."
                  className="w-full mt-1 p-2 bg-neutral-50 dark:bg-neutral-800 border rounded focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setWaiveModalItem(null)}
                className="px-3 py-1.5 border rounded text-xs font-bold uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyWaive}
                className="px-4 py-1.5 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded text-xs font-bold uppercase"
              >
                Sign &amp; Record Waiver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
