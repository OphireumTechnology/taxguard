import React, { useState } from 'react';
import {
  FileEdit,
  AlertTriangle,
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  Lock,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientAmendmentsClosureSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
}

export const ClientAmendmentsClosureSection: React.FC<ClientAmendmentsClosureSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant
}) => {
  const [activeTab, setActiveTab] = useState<'amendment' | 'dissolution'>('amendment');
  const [targetYear, setTargetYear] = useState('2024');
  const [targetForm, setTargetForm] = useState('Form 1120-S (Amended Return)');
  const [amendReason, setAmendReason] = useState('Corrected Schedule K-1 Received from Joint Venture');
  const [amendExplanation, setAmendExplanation] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Active amendment cases
  const [amendmentCases, setAmendmentCases] = useState([
    {
      id: 'amd_01',
      entityName: 'Perotti Capital Holdings LLC',
      taxYear: '2023',
      formType: 'Form 1120-S Amended',
      reason: 'Bonus Depreciation & Section 179 Retroactive Adjustment',
      status: 'Filed & Accepted by IRS',
      submittedDate: '2024-11-12',
      acceptedDate: '2024-12-04',
      refundOrBalanceDue: 'Tax Neutral (Shareholder Basis Adjustment)',
      leadCpa: 'Elena Rostova, CPA'
    }
  ]);

  const handleSubmitAmendmentRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendExplanation.trim()) {
      alert('Please provide a detailed explanation of the correction.');
      return;
    }

    const newCase = {
      id: `amd_${Date.now()}`,
      entityName: 'Perotti Capital Holdings LLC',
      taxYear: targetYear,
      formType: targetForm,
      reason: amendReason,
      status: 'In Senior Review (CPA Elena Rostova)',
      submittedDate: new Date().toISOString().split('T')[0],
      acceptedDate: 'Pending Review',
      refundOrBalanceDue: 'Calculated in Workpapers',
      leadCpa: 'Elena Rostova, CPA'
    };

    setAmendmentCases(prev => [newCase, ...prev]);

    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Submitted Formal Tax Amendment Request',
      record: `${targetYear} ${targetForm}`,
      result: 'Success (Simulated)',
      reason: `${amendReason}: ${amendExplanation}`
    });

    setActionNotice(`Amendment request for ${targetYear} submitted to Elena Rostova, CPA for preliminary review.`);
    setAmendExplanation('');
    setTimeout(() => setActionNotice(null), 5000);
  };

  return (
    <div className="space-y-6" id="client-amendments-closure-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Statutory Corrections &amp; Dissolutions
              </span>
              <span className="text-xs text-[#667085]">Prior-Year Returns &bull; Final Entity Closures</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Tax Return Amendments &amp; Final Entity Dissolutions
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Submit corrected K-1s, retroactive depreciation adjustments, or manage final liquidating return filings.
            </p>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Logged to audit trail</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#D8DCE2] pt-4">
          <button
            onClick={() => setActiveTab('amendment')}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'amendment'
                ? 'border-[#061A2F] text-[#061A2F]'
                : 'border-transparent text-[#667085] hover:text-[#061A2F]'
            }`}
          >
            <FileEdit className="w-4 h-4" />
            <span>Tax Return Amendment Request</span>
          </button>
          <button
            onClick={() => setActiveTab('dissolution')}
            className={`flex items-center gap-2 py-2 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'dissolution'
                ? 'border-[#061A2F] text-[#061A2F]'
                : 'border-transparent text-[#667085] hover:text-[#061A2F]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Final Return &amp; Entity Dissolution Checklist</span>
          </button>
        </div>
      </div>

      {/* TAB 1: AMENDMENT REQUEST */}
      {activeTab === 'amendment' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-6 shadow-xs">
            <div className="border-b border-[#D8DCE2] pb-3">
              <h3 className="text-sm font-bold text-[#061A2F]">Initiate Prior-Year Tax Amendment</h3>
              <p className="text-xs text-[#667085]">
                IRC § 6511 allows claims for refund within 3 years from the date the original return was filed.
              </p>
            </div>

            <form onSubmit={handleSubmitAmendmentRequest} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[#061A2F] mb-1">Target Tax Year to Amend</label>
                  <select
                    value={targetYear}
                    onChange={e => setTargetYear(e.target.value)}
                    className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                  >
                    <option value="2024">2024 (Filed March 2025)</option>
                    <option value="2023">2023 (Filed March 2024)</option>
                    <option value="2022">2022 (Statute Expiration Approaching)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#061A2F] mb-1">Primary Reason for Amendment</label>
                  <select
                    value={amendReason}
                    onChange={e => setAmendReason(e.target.value)}
                    className="w-full p-2 border border-[#D8DCE2] rounded bg-white"
                  >
                    <option value="Corrected Schedule K-1 Received from Joint Venture">Corrected Schedule K-1 Received</option>
                    <option value="Omitted Form 1099 or Brokerage 1099-B Statement">Omitted 1099 Statement</option>
                    <option value="Retroactive Section 179 / Bonus Depreciation Claim">Retroactive Depreciation Claim</option>
                    <option value="Multi-State Nexus or Withholding Apportionment Correction">Multi-State Apportionment</option>
                    <option value="Response to IRS Notice / CP2000 Proposed Adjustment">IRS CP2000 Notice Response</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#061A2F] mb-1">Factual Background &amp; Impact Description</label>
                <textarea
                  value={amendExplanation}
                  onChange={e => setAmendExplanation(e.target.value)}
                  placeholder="Describe what changed and provide the dollar figures involved..."
                  className="w-full p-2.5 border border-[#D8DCE2] rounded bg-white h-24"
                  required
                />
              </div>

              <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-[11px] text-[#4B5563] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#C99A32] flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Professional Standards Policy:</strong> Submission will generate a preliminary review workpaper by Elena Rostova, CPA. If substantial re-filing is required, an amendment engagement letter detailing scope and fixed fees will be provided before transmission.
                </span>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#061A2F] text-[#F7F4ED] hover:bg-[#0A2544] text-xs font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileEdit className="w-3.5 h-3.5 text-[#E8C66A]" />
                  <span>Submit Amendment Request</span>
                </button>
              </div>
            </form>
          </div>

          {/* Historical Amendments */}
          <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
            <div className="border-b border-[#D8DCE2] pb-3">
              <h3 className="text-sm font-bold text-[#061A2F]">Prior Amendment Filings</h3>
              <p className="text-xs text-[#667085]">Historical amended tax returns and IRS e-file acceptance acknowledgments.</p>
            </div>

            <div className="space-y-3">
              {amendmentCases.map(c => (
                <div
                  key={c.id}
                  className="border border-[#D8DCE2] rounded-lg p-4 bg-[#FBFAF7] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#061A2F] bg-white px-2 py-0.5 border border-[#D8DCE2] rounded">
                        {c.taxYear}
                      </span>
                      <span className="font-bold text-sm text-[#061A2F]">{c.formType}</span>
                      <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-bold">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs text-[#4B5563]">
                      <strong>Reason:</strong> {c.reason}
                    </div>
                    <div className="text-[11px] text-[#667085] flex flex-wrap items-center gap-3">
                      <span>Submitted: <strong>{c.submittedDate}</strong></span>
                      <span>&bull;</span>
                      <span>Accepted: <strong>{c.acceptedDate}</strong></span>
                      <span>&bull;</span>
                      <span>Lead CPA: <strong>{c.leadCpa}</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() => alert(`Showing accepted e-file workpapers for ${c.taxYear} ${c.formType}`)}
                    className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F]"
                  >
                    View E-File Acceptance
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DISSOLUTION CHECKLIST */}
      {activeTab === 'dissolution' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-6 shadow-xs">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Entity Winding Down &amp; Final Liquidating Return Checklist</h3>
            <p className="text-xs text-[#667085]">
              Mandatory federal and South Carolina requirements for formal corporate dissolution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg space-y-2">
              <span className="font-bold text-[#061A2F] block">1. Federal (IRS) Final Filing Steps</span>
              <ul className="space-y-1.5 text-[#4B5563] list-disc list-inside">
                <li>Check "Final Return" box on Form 1120-S Page 1</li>
                <li>Report final liquidating distributions on Schedule K-1 Box 16D</li>
                <li>File final Form 941 quarterly payroll return and check box 17</li>
                <li>Issue final employee Form W-2s and file Form W-3</li>
                <li>Report final Form 1099-NEC contractor disbursements</li>
              </ul>
            </div>

            <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg space-y-2">
              <span className="font-bold text-[#061A2F] block">2. South Carolina State Closures</span>
              <ul className="space-y-1.5 text-[#4B5563] list-disc list-inside">
                <li>File SC Form C-278 (Articles of Dissolution with Secretary of State)</li>
                <li>Obtain SC DOR Tax Compliance Certificate / Good Standing</li>
                <li>Close South Carolina Withholding Account (WH-1605 Final)</li>
                <li>Close SC Sales &amp; Use Tax License if applicable</li>
                <li>File final South Carolina Corporate Return SC 1120-S</li>
              </ul>
            </div>
          </div>

          <div className="border border-[#D8DCE2] bg-[#FAF9F5] p-4 rounded text-xs text-[#667085] flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 text-[#061A2F] flex-shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#061A2F] block mb-0.5">Statutory 7-Year Document Retention Requirement:</strong>
              Under Treasury Circular 230 and IRC § 6001, corporate records, general ledgers, bank statements, and tax returns must be retained for a minimum of 7 years post-dissolution. A/R Tax Services, LLC maintains an encrypted, immutable archive of all dissolved entity files.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
