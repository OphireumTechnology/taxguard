import React, { useState } from 'react';
import {
  FileEdit,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Calendar,
  FileText,
  ShieldCheck,
  Clock,
  ArrowRight,
  HelpCircle,
  Plus,
  X
} from 'lucide-react';
import { AmendmentRequestItem } from '../../../types/clientPortal';
import { MOCK_AMENDMENT_REQUESTS } from '../../../services/clientPortalService';

interface AmendmentViewProps {
  selectedTaxYear?: number;
  onOpenUpload?: (category: string, year: number) => void;
}

export const AmendmentView: React.FC<AmendmentViewProps> = ({
  selectedTaxYear = 2025,
  onOpenUpload
}) => {
  const [amendments, setAmendments] = useState<AmendmentRequestItem[]>(MOCK_AMENDMENT_REQUESTS);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    taxYear: 2024,
    statutoryForm: 'Form 1040-X' as AmendmentRequestItem['statutoryForm'],
    reasonForAmendment: '',
    changeDetails: '',
    hasGovernmentNotice: false,
    noticeDetails: '',
    clientCertifiedUnderPerjury: false
  });

  const handleCreateAmendmentRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reasonForAmendment || !formData.changeDetails) {
      alert('Please fill out Reason for Amendment and Change Details.');
      return;
    }
    if (!formData.clientCertifiedUnderPerjury) {
      alert('You must certify the accuracy of your amendment information under penalty of perjury.');
      return;
    }

    const newRequest: AmendmentRequestItem = {
      id: `amend_${Date.now()}`,
      clientId: 'user_client_1',
      taxYear: formData.taxYear,
      originalReturnDescription: `${formData.taxYear} Filed Tax Return`,
      statutoryForm: formData.statutoryForm,
      reasonForAmendment: formData.reasonForAmendment,
      changeDetails: formData.changeDetails,
      hasGovernmentNotice: formData.hasGovernmentNotice,
      noticeDetails: formData.noticeDetails || undefined,
      attachedSupportingDocs: [
        { name: 'Amendment_Substantiating_Documents.pdf', size: '1.8 MB', date: new Date().toISOString().split('T')[0] }
      ],
      clientCertifiedUnderPerjury: true,
      submittedAt: new Date().toISOString(),
      status: 'submitted_to_cpa'
    };

    setAmendments(prev => [newRequest, ...prev]);
    setIsRequestModalOpen(false);
    setActionSuccessNotice(`Amendment request for Tax Year ${newRequest.taxYear} (${newRequest.statutoryForm}) has been formally recorded and assigned to your CPA.`);
    setFormData({
      taxYear: 2024,
      statutoryForm: 'Form 1040-X',
      reasonForAmendment: '',
      changeDetails: '',
      hasGovernmentNotice: false,
      noticeDetails: '',
      clientCertifiedUnderPerjury: false
    });
  };

  return (
    <div className="space-y-6" id="client-amendment-workspace">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#0B2748] pb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
              Controlled Statutory Workflow &bull; IRC § 6511
            </div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
              Tax Return Amendment Requests (Form 1040-X / 1120-S-X)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Submit requests to amend a previously filed federal or state tax return due to corrected forms, omitted deductions, or revenue agency notices.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsRequestModalOpen(true)}
            className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Request Prior Year Amendment</span>
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs text-slate-300 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#C99A3D] flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-white">Three-Year Statutory Limitation Notice:</strong> Under IRC § 6511, claims for refund on amended returns must generally be filed within 3 years from the date the original return was filed or 2 years from the date the tax was paid, whichever is later.
          </div>
        </div>
      </div>

      {actionSuccessNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
          <button type="button" onClick={() => setActionSuccessNotice(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Active Amendment Requests List */}
      <div className="space-y-4">
        {amendments.map((amend) => (
          <div
            key={amend.id}
            className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-4 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#0B2748] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded bg-[#0B2748] text-[#E2BD67] font-bold text-xs border border-[#C99A3D]/40">
                    {amend.statutoryForm}
                  </span>
                  <span className="font-bold text-white text-base">Tax Year {amend.taxYear} Amendment</span>
                </div>
                <div className="text-slate-400 mt-0.5">{amend.originalReturnDescription}</div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  amend.status === 'ready_for_client_authorization'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                }`}>
                  {amend.status === 'ready_for_client_authorization' ? 'Ready for Signature' : 'In Technical Review'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="font-semibold text-slate-200">Reason for Amendment:</div>
                <p className="text-slate-300 leading-relaxed bg-[#06172C] p-3 rounded-xl border border-[#1E3A5F]">
                  {amend.reasonForAmendment}
                </p>
                <div className="font-semibold text-slate-200 pt-1">Specific Factual Changes:</div>
                <p className="text-slate-300 leading-relaxed bg-[#06172C] p-3 rounded-xl border border-[#1E3A5F]">
                  {amend.changeDetails}
                </p>
              </div>

              <div className="space-y-3 bg-[#06172C] p-4 rounded-xl border border-[#1E3A5F]">
                <div className="font-semibold text-slate-200">Substantiating Attachments:</div>
                <div className="space-y-1.5">
                  {amend.attachedSupportingDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-[#07172B] text-slate-300">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-[#C99A3D]" />
                        <span className="truncate">{doc.name}</span>
                      </div>
                      <span className="text-slate-400 text-[11px] whitespace-nowrap">{doc.size}</span>
                    </div>
                  ))}
                </div>

                {amend.cpaAssignedNotes && (
                  <div className="p-3 rounded-lg bg-[#0B2748]/60 border border-[#C99A3D]/30 space-y-1 mt-2">
                    <div className="font-bold text-[#E2BD67]">CPA Technical Evaluation:</div>
                    <div className="text-slate-200 leading-relaxed">{amend.cpaAssignedNotes}</div>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-[#1E3A5F]">
                  <span>Submitted: {new Date(amend.submittedAt).toLocaleDateString()}</span>
                  <span className="text-emerald-400">✓ Perjury Attestation Signed</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Amendment Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#07172B] border-2 border-[#C99A3D] rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#0B2748] pb-3">
              <h3 className="font-serif text-lg font-bold text-white">
                Initiate Tax Return Amendment Request
              </h3>
              <button type="button" onClick={() => setIsRequestModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAmendmentRequest} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tax Year to Amend *</label>
                  <select
                    value={formData.taxYear}
                    onChange={(e) => setFormData({ ...formData, taxYear: parseInt(e.target.value) })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  >
                    <option value={2024}>2024 Tax Year</option>
                    <option value={2023}>2023 Tax Year</option>
                    <option value={2022}>2022 Tax Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Return Type *</label>
                  <select
                    value={formData.statutoryForm}
                    onChange={(e) => setFormData({ ...formData, statutoryForm: e.target.value as any })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  >
                    <option value="Form 1040-X">Form 1040-X (Individual)</option>
                    <option value="Form 1120-S (Amended)">Form 1120-S (S-Corporation)</option>
                    <option value="Form 1065 (Amended)">Form 1065 (Partnership)</option>
                    <option value="Form SC1040 (Amended)">Form SC1040 (South Carolina State)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Reason for Amendment * (e.g. Corrected 1099, Missed Deductions, Revenue Notice)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Summary of reason for filing an amended return..."
                  value={formData.reasonForAmendment}
                  onChange={(e) => setFormData({ ...formData, reasonForAmendment: e.target.value })}
                  className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Detailed Explanation of Changed Items *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe what lines are changing, new dollar amounts, or items being added/removed..."
                  value={formData.changeDetails}
                  onChange={(e) => setFormData({ ...formData, changeDetails: e.target.value })}
                  className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasGovernmentNotice}
                    onChange={(e) => setFormData({ ...formData, hasGovernmentNotice: e.target.checked })}
                    className="rounded border-slate-700 text-[#C99A3D]"
                  />
                  <span className="text-slate-300 font-semibold">
                    Is this amendment in response to an IRS or State Notice (e.g. CP2000, Letter 12C)?
                  </span>
                </label>

                {formData.hasGovernmentNotice && (
                  <input
                    type="text"
                    placeholder="Enter Notice Number and Date (e.g. IRS CP2000 dated Jan 14, 2026)"
                    value={formData.noticeDetails}
                    onChange={(e) => setFormData({ ...formData, noticeDetails: e.target.value })}
                    className="w-full bg-[#06172C] border border-[#1E3A5F] rounded-xl px-3 py-2 text-white"
                  />
                )}
              </div>

              {/* Perjury Certification Checkbox */}
              <div className="p-4 rounded-xl bg-[#040E1B] border border-[#C99A3D]/40 space-y-2 text-xs">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={formData.clientCertifiedUnderPerjury}
                    onChange={(e) => setFormData({ ...formData, clientCertifiedUnderPerjury: e.target.checked })}
                    className="mt-0.5 rounded border-slate-700 text-[#C99A3D]"
                  />
                  <div className="text-slate-200 leading-relaxed">
                    <strong className="text-white">Taxpayer Attestation:</strong> Under penalties of perjury, I declare that I have examined this amendment request and accompanying documents, and to the best of my knowledge and belief, they are true, correct, and complete.
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#0B2748]">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.clientCertifiedUnderPerjury}
                  className="px-5 py-2.5 rounded-xl font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow disabled:opacity-50"
                >
                  Submit Amendment Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
