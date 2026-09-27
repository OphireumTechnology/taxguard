import React, { useState } from 'react';
import {
  AlertCircle,
  ShieldCheck,
  UploadCloud,
  FileText,
  Clock,
  Eye,
  MessageSquare,
  Download,
  CheckCircle,
  X,
  Send,
  HelpCircle,
  Award
} from 'lucide-react';
import { ClientNoticeRecord, INoticeService } from '../../services/clientDashboardServices';

interface ClientNoticesSectionProps {
  noticeService: INoticeService;
  clientId: string;
  onOpenAssistant: () => void;
}

export const ClientNoticesSection: React.FC<ClientNoticesSectionProps> = ({
  noticeService,
  clientId,
  onOpenAssistant
}) => {
  const [notices, setNotices] = useState<ClientNoticeRecord[]>(() =>
    noticeService.getNotices(clientId)
  );

  // Modals
  const [selectedNoticeForDetail, setSelectedNoticeForDetail] = useState<ClientNoticeRecord | null>(null);
  const [selectedNoticeForMessage, setSelectedNoticeForMessage] = useState<ClientNoticeRecord | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPoaModal, setShowPoaModal] = useState(false);

  // Form states
  const [newNotice, setNewNotice] = useState({
    authority: 'Internal Revenue Service (IRS)',
    noticeNumber: '',
    noticeTitle: '',
    taxYear: '2025',
    receivedDate: '2026-03-01',
    responseDeadline: '2026-03-31',
    amountRequested: '0.00'
  });

  const [messageText, setMessageText] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const refreshNotices = () => {
    setNotices(noticeService.getNotices(clientId));
  };

  const handleUploadNotice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotice.noticeNumber || !newNotice.noticeTitle) return;

    noticeService.uploadNotice(clientId, {
      authority: newNotice.authority,
      noticeNumber: newNotice.noticeNumber,
      noticeTitle: newNotice.noticeTitle,
      taxYear: parseInt(newNotice.taxYear, 10) || 2025,
      receivedDate: newNotice.receivedDate,
      responseDeadline: newNotice.responseDeadline,
      amountRequested: parseFloat(newNotice.amountRequested) || 0,
      assignedCpa: 'Elena Rostova, CPA',
      aiSummary: 'Simulated AI summary of newly uploaded notice. Forwarded to Elena Rostova, CPA for official response drafting.'
    });

    setShowUploadModal(false);
    setNewNotice({
      authority: 'Internal Revenue Service (IRS)',
      noticeNumber: '',
      noticeTitle: '',
      taxYear: '2025',
      receivedDate: '2026-03-01',
      responseDeadline: '2026-03-31',
      amountRequested: '0.00'
    });
    refreshNotices();
    setActionNotice('Notice logged and transmitted to your CPA defense team.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNoticeForMessage || !messageText.trim()) return;

    noticeService.addNoticeComment(
      selectedNoticeForMessage.id,
      messageText.trim(),
      'Michael Perotti (Client)'
    );

    setSelectedNoticeForMessage(null);
    setMessageText('');
    refreshNotices();
    setActionNotice('Message logged and sent to assigned CPA.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleRequestPoa = () => {
    setShowPoaModal(false);
    setActionNotice('Form 2848 Power of Attorney representation request initiated.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-6" id="client-notices-section">
      {/* 1. Mandatory AI Disclaimer Banner */}
      <div className="bg-[#FAF9F5] border-2 border-[#C99A32] rounded-lg p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#061A2F] text-[#E8C66A] flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#C99A32] font-black">
                Official Agency Correspondence Disclaimer
              </div>
              <h2 className="text-sm sm:text-base font-black text-[#061A2F]">
                AI-generated demo summary — professional review required.
              </h2>
            </div>
          </div>
          <span className="text-xs font-mono text-[#667085]">
            No live agency filing or submission in demonstration mode
          </span>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] text-[#1B5E20] rounded text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 2. Header Card */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#D7AC4A] uppercase tracking-wider font-bold bg-[#061A2F] px-2 py-0.5 rounded">
                Section 7 of 8
              </span>
              <span className="text-xs font-mono text-[#667085]">Tax Resolution & Agency Inquiries</span>
            </div>
            <h1 className="text-xl font-black text-[#061A2F] mt-1">
              Tax Notices & Agency Defense
            </h1>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Upload IRS, State Department of Revenue, or municipal correspondence for CPA evaluation and representation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#061A2F] text-white hover:bg-[#031323] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#E8C66A]" />
              <span>Upload Notice</span>
            </button>
            <button
              onClick={() => setShowPoaModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>Request Form 2848 (POA)</span>
            </button>
          </div>
        </div>

        {/* Notices Active Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Total Inquiries Tracked</span>
            <span className="text-lg font-bold text-[#061A2F] block mt-0.5 font-mono">{notices.length} Records</span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Active Defense Matters</span>
            <span className="text-lg font-bold text-[#C99A32] block mt-0.5 font-mono">
              {notices.filter(n => n.status !== 'Resolved').length} Active
            </span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Assigned Lead Reviewer</span>
            <span className="text-lg font-bold text-[#1B5E20] block mt-0.5">Elena Rostova, CPA</span>
          </div>
        </div>
      </div>

      {/* 3. Notices List */}
      <div className="space-y-4">
        {notices.map((notice) => {
          const isResolved = notice.status === 'Resolved';
          return (
            <div
              key={notice.id}
              className={`bg-white rounded-lg border p-5 shadow-xs transition-colors ${
                isResolved ? 'border-[#D8DCE2]' : 'border-[#C99A32]'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#D8DCE2]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] font-mono text-[10px] font-bold rounded">
                      {notice.authority}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#061A2F]">{notice.noticeNumber}</span>
                    <span className="text-xs text-[#667085]">Tax Year {notice.taxYear}</span>
                  </div>
                  <h2 className="text-base font-bold text-[#061A2F] mt-1">
                    {notice.noticeTitle}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold ${
                    isResolved
                      ? 'bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9]'
                      : 'bg-[#FFF8E1] text-[#B78103] border border-[#FFE082]'
                  }`}>
                    {notice.status}
                  </span>
                  {!isResolved && notice.daysRemaining !== undefined && (
                    <span className="px-2.5 py-1 bg-[#FFEBEE] text-[#C62828] border border-[#FFCDD2] rounded font-mono text-[10px] font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {notice.daysRemaining} Days Left
                    </span>
                  )}
                </div>
              </div>

              {/* AI Summary Box */}
              <div className="my-3 p-3 bg-[#FAF9F5] border-l-3 border-[#C99A32] rounded-r text-xs space-y-1">
                <div className="font-bold text-[#061A2F] flex items-center gap-1">
                  <span>AI Extraction Summary:</span>
                </div>
                <p className="text-[#4B5563] text-[11px] leading-relaxed">
                  {notice.aiSummary}
                </p>
              </div>

              {/* Notice Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#667085] block">Received Date</span>
                  <span className="font-semibold text-[#061A2F]">{notice.receivedDate}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#667085] block">Agency Deadline</span>
                  <span className="font-semibold text-[#061A2F]">{notice.responseDeadline}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#667085] block">Amount Requested</span>
                  <span className="font-mono font-bold text-[#061A2F]">
                    ${notice.amountRequested.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-mono uppercase text-[#667085] block">Assigned CPA</span>
                  <span className="font-semibold text-[#061A2F]">{notice.assignedCpa}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#D8DCE2] mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-[#667085]">
                  Status: All official responses prepared on firm letterhead prior to submission.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedNoticeForDetail(notice)}
                    className="px-3 py-1.5 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] rounded text-xs font-bold text-[#061A2F] cursor-pointer"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => setSelectedNoticeForMessage(notice)}
                    className="px-3 py-1.5 bg-[#061A2F] text-white hover:bg-[#031323] rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-[#E8C66A]" />
                    <span>Message CPA</span>
                  </button>
                  <button
                    onClick={() => alert(`Simulated download of draft response for ${notice.noticeNumber}`)}
                    className="p-1.5 hover:bg-[#FAF9F5] border border-[#D8DCE2] rounded text-[#061A2F] cursor-pointer"
                    title="Download Response Draft"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Upload Notice Modal */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-notice-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="upload-notice-title" className="text-sm font-bold text-[#061A2F]">
                Upload Agency Tax Notice
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadNotice} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Issuing Government Authority</label>
                <select
                  value={newNotice.authority}
                  onChange={(e) => setNewNotice({ ...newNotice, authority: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                >
                  <option value="Internal Revenue Service (IRS)">Internal Revenue Service (IRS)</option>
                  <option value="South Carolina Department of Revenue (SCDOR)">South Carolina Department of Revenue (SCDOR)</option>
                  <option value="Municipal / Local Tax Authority">Municipal / Local Tax Authority</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Notice Number / Form Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CP2000 / Notice of Assessment"
                  value={newNotice.noticeNumber}
                  onChange={(e) => setNewNotice({ ...newNotice, noticeNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Notice Title / Subject *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Proposed Adjustment to Tax Year 2025"
                  value={newNotice.noticeTitle}
                  onChange={(e) => setNewNotice({ ...newNotice, noticeTitle: e.target.value })}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Tax Year</label>
                  <input
                    type="text"
                    value={newNotice.taxYear}
                    onChange={(e) => setNewNotice({ ...newNotice, taxYear: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Amount Requested ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newNotice.amountRequested}
                    onChange={(e) => setNewNotice({ ...newNotice, amountRequested: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Received Date</label>
                  <input
                    type="date"
                    value={newNotice.receivedDate}
                    onChange={(e) => setNewNotice({ ...newNotice, receivedDate: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-[#061A2F] block mb-1">Response Deadline</label>
                  <input
                    type="date"
                    value={newNotice.responseDeadline}
                    onChange={(e) => setNewNotice({ ...newNotice, responseDeadline: e.target.value })}
                    className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
                >
                  Upload & Forward to CPA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Message CPA Modal */}
      {selectedNoticeForMessage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="message-cpa-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="message-cpa-title" className="text-sm font-bold text-[#061A2F]">
                Send Message on {selectedNoticeForMessage.noticeNumber}
              </h3>
              <button
                onClick={() => setSelectedNoticeForMessage(null)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-3 text-xs">
              <div className="text-[11px] text-[#667085]">
                Forwarding directly to lead reviewer <strong>Elena Rostova, CPA</strong>.
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Message / Instructions *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide any context, prior payments made, or dates..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNoticeForMessage(null)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
                >
                  Send to CPA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Form 2848 Power of Attorney Modal */}
      {showPoaModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="poa-modal-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="poa-modal-title" className="text-sm font-bold text-[#061A2F]">
                Form 2848: Power of Attorney & Representation
              </h3>
              <button
                onClick={() => setShowPoaModal(false)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#4B5563]">
                Authorizes <strong>Elena Rostova, CPA</strong> and <strong>Desmond Hinds, MSA</strong> to represent Perotti Capital Holdings LLC before the Internal Revenue Service and South Carolina Department of Revenue.
              </p>
              <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded space-y-1">
                <span className="font-bold text-[#061A2F]">Powers Granted:</span>
                <ul className="list-disc pl-4 text-[11px] text-[#667085] space-y-0.5">
                  <li>Inspect and receive confidential tax information</li>
                  <li>Sign agreements, consents, or similar documents</li>
                  <li>Represent entity in administrative appeal proceedings</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPoaModal(false)}
                className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestPoa}
                className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
              >
                Execute Form 2848 Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
