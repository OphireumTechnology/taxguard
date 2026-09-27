import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  PenTool,
  HelpCircle,
  Download,
  Eye,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  X,
  Send,
  Lock,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { ClientDraftReturn, IReturnReviewService } from '../../services/clientDashboardServices';

interface ClientReturnReviewSectionProps {
  returnService: IReturnReviewService;
  clientId: string;
  onOpenAssistant: () => void;
}

export const ClientReturnReviewSection: React.FC<ClientReturnReviewSectionProps> = ({
  returnService,
  clientId,
  onOpenAssistant
}) => {
  const [draftReturn, setDraftReturn] = useState<ClientDraftReturn | undefined>(() =>
    returnService.getDraftReturn(clientId)
  );

  // Modals
  const [showFullDraftModal, setShowFullDraftModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);

  // Form states
  const [correctionField, setCorrectionField] = useState('Officer Compensation (Line 7)');
  const [correctionExplanation, setCorrectionExplanation] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [signatureName, setSignatureName] = useState('Michael Perotti');
  const [signatureConsent, setSignatureConsent] = useState(false);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  const refreshReturn = () => {
    setDraftReturn(returnService.getDraftReturn(clientId));
  };

  if (!draftReturn) {
    return (
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-8 text-center text-[#667085]">
        No active draft return available for review.
      </div>
    );
  }

  const handleAuthorizeSignature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signatureConsent || !signatureName.trim()) return;

    const result = returnService.approveDraftReturn(
      draftReturn.id,
      signatureName.trim(),
      '192.168.1.1 (Client Portal IP Auth)'
    );

    if (result.success) {
      refreshReturn();
      setShowSignModal(false);
      setActionSuccessNotice('Form 8879-S e-file authorization executed. Return status advanced to "Signed & Ready to File".');
      setTimeout(() => setActionSuccessNotice(null), 5000);
    } else {
      alert(result.error || 'Failed to authorize signature.');
    }
  };

  const handleRequestCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionExplanation.trim()) return;

    const result = returnService.requestCorrection(
      draftReturn.id,
      correctionField,
      correctionExplanation.trim(),
      'Michael Perotti (Client)'
    );

    if (result.success) {
      refreshReturn();
      setShowCorrectionModal(false);
      setCorrectionExplanation('');
      setActionSuccessNotice('Correction request transmitted to Elena Rostova, CPA. Return status updated to "Corrections Required".');
      setTimeout(() => setActionSuccessNotice(null), 5000);
    } else {
      alert(result.error || 'Failed to submit correction request.');
    }
  };

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    const result = returnService.askQuestion(
      draftReturn.id,
      questionText.trim(),
      'Michael Perotti (Client)'
    );

    if (result.success) {
      refreshReturn();
      setShowQuestionModal(false);
      setQuestionText('');
      setActionSuccessNotice('Inquiry sent to engagement review team.');
      setTimeout(() => setActionSuccessNotice(null), 4000);
    }
  };

  return (
    <div className="space-y-6" id="client-return-review-section">
      {/* 1. Prominent Demonstration Draft Banner */}
      <div className="bg-[#FAF9F5] border-2 border-[#C99A32] rounded-lg p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#061A2F] text-[#E8C66A] flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-[#C99A32] font-black">
                Official Compliance Disclaimer
              </div>
              <h2 className="text-sm sm:text-base font-black text-[#061A2F]">
                DEMONSTRATION DRAFT — NOT FILED — PROFESSIONAL REVIEW REQUIRED
              </h2>
            </div>
          </div>
          <span className="px-3 py-1 bg-[#061A2F] text-[#E8C66A] font-mono text-xs font-bold rounded">
            Version {draftReturn.version}
          </span>
        </div>
      </div>

      {actionSuccessNotice && (
        <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] text-[#1B5E20] rounded text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{actionSuccessNotice}</span>
        </div>
      )}

      {/* 2. Return Identification & Certification Status Card */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[#D7AC4A] uppercase tracking-wider font-bold bg-[#061A2F] px-2 py-0.5 rounded">
                Section 5 of 8
              </span>
              <span className="text-xs font-mono text-[#667085]">Form 1120-S & SC1120S Package</span>
            </div>
            <h1 className="text-xl font-black text-[#061A2F] mt-1">
              Return Review & Signature Gate
            </h1>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Prepared for <strong className="text-[#061A2F]">{draftReturn.entityName}</strong> • Tax Year {draftReturn.taxYear}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowFullDraftModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#FAF9F5] hover:bg-[#F2EDE0] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>View Full Draft Form</span>
            </button>
            <button
              onClick={() => setShowCorrectionModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#C99A32]" />
              <span>Request Correction</span>
            </button>
            <button
              onClick={() => setShowQuestionModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#FBFAF7] hover:bg-[#F3EFE6] border border-[#D8DCE2] text-[#061A2F] rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#061A2F]" />
              <span>Ask CPA a Question</span>
            </button>
            {draftReturn.status !== 'Signed & Ready to File' && (
              <button
                onClick={() => setShowSignModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#061A2F] hover:bg-[#031323] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
              >
                <PenTool className="w-3.5 h-3.5 text-[#E8C66A]" />
                <span>Authorize Signature</span>
              </button>
            )}
          </div>
        </div>

        {/* Technical Certification Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Review Status</span>
            <span className="font-bold text-[#061A2F] block mt-0.5">{draftReturn.status}</span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Certified Preparer</span>
            <span className="font-bold text-[#061A2F] block mt-0.5">{draftReturn.preparer}</span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">CPA Technical Reviewer</span>
            <span className="font-bold text-[#1B5E20] block mt-0.5 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> {draftReturn.certifiedBy}
            </span>
          </div>
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Sign Gate Readiness</span>
            <span className="font-bold text-[#061A2F] block mt-0.5">
              {draftReturn.status === 'Signed & Ready to File' ? 'Form 8879 Executed' : 'Awaiting Client E-Sign'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Key Summary Figures Box */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
        <div className="pb-3 border-b border-[#D8DCE2]">
          <h2 className="text-sm font-bold text-[#061A2F]">Key Federal & State Tax Return Figures</h2>
          <p className="text-xs text-[#667085]">Form 1120-S Page 1 tie-out for Tax Year 2025</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Gross Receipts</span>
            <span className="text-base font-bold text-[#061A2F] block mt-0.5 font-mono">
              ${draftReturn.grossReceipts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#667085]">Line 1a</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Total Deductions</span>
            <span className="text-base font-bold text-[#061A2F] block mt-0.5 font-mono">
              ${draftReturn.totalDeductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#667085]">Line 20</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Ordinary Income</span>
            <span className="text-base font-bold text-[#061A2F] block mt-0.5 font-mono">
              ${draftReturn.ordinaryBusinessIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#667085]">Line 21 (Flow-through)</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Tax Credits</span>
            <span className="text-base font-bold text-[#061A2F] block mt-0.5 font-mono">
              ${draftReturn.taxCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#667085]">Schedule K</span>
          </div>

          <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB]">
            <span className="text-[10px] font-mono uppercase text-[#667085] block">Estimated Paid</span>
            <span className="text-base font-bold text-[#061A2F] block mt-0.5 font-mono">
              ${draftReturn.estimatedPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#667085]">Fed + SC Total</span>
          </div>

          <div className="p-3 bg-[#FAF9F5] rounded border border-[#C99A32]">
            <span className="text-[10px] font-mono uppercase text-[#061A2F] font-bold block">
              {draftReturn.refundAmount > 0 ? 'Refund Due' : 'Balance Due'}
            </span>
            <span className="text-base font-black text-[#1B5E20] block mt-0.5 font-mono">
              ${draftReturn.refundAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-[#1B5E20] font-semibold">Direct Deposit Authorized</span>
          </div>
        </div>
      </div>

      {/* 4. Line-by-Line Breakdown & Prior Year Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Items */}
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs">
          <div className="pb-3 border-b border-[#D8DCE2] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#061A2F]">Detailed Line-by-Line Schedule</h2>
            <span className="text-[10px] font-mono text-[#667085] flex items-center gap-1">
              <Lock className="w-3 h-3" /> Read-Only Form Figures
            </span>
          </div>

          <div className="divide-y divide-[#E5E7EB] pt-1 text-xs">
            {draftReturn.lineItems.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#061A2F]">{item.lineNumber}</span>
                  <div className="text-[11px] text-[#667085]">{item.description}</div>
                </div>
                <div className="font-mono font-bold text-[#061A2F]">
                  ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-[#667085] mt-4 pt-3 border-t border-[#D8DCE2]">
            Note: Clients cannot edit professional tax calculation line numbers directly. To adjust any figure, click "Request Correction" to submit formal documentation to Elena Rostova, CPA.
          </p>
        </div>

        {/* Prior Year Comparison & Notes */}
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-[#D8DCE2]">
              <h2 className="text-sm font-bold text-[#061A2F]">Prior Year Comparison (TY2024 vs TY2025)</h2>
              <p className="text-xs text-[#667085]">Year-over-year operational variance analysis</p>
            </div>

            <div className="py-3 space-y-3 text-xs">
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#061A2F]">Revenue Growth</span>
                  <div className="text-[11px] text-[#667085]">Gross receipts increased from $580k to $645k</div>
                </div>
                <span className="font-mono font-bold text-[#1B5E20]">+11.2%</span>
              </div>

              <div className="p-3 bg-[#FBFAF7] rounded border border-[#E5E7EB] flex items-center justify-between">
                <div>
                  <span className="font-semibold text-[#061A2F]">Deductions Expansion</span>
                  <div className="text-[11px] text-[#667085]">Lease renewal and commercial equipment depreciation</div>
                </div>
                <span className="font-mono font-bold text-[#C99A32]">+8.4%</span>
              </div>

              <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs space-y-1">
                <span className="font-bold text-[#061A2F] block">CPA Reviewer Note:</span>
                <p className="text-[#4B5563] text-[11px] leading-relaxed">
                  "All pass-through items tie to Schedule K-1 for Michael Perotti (100% shareholder). South Carolina SC1120S includes elective PTE credit optimizing personal state liability."
                </p>
                <div className="text-[10px] font-mono text-[#667085] pt-1">
                  Signed: Elena Rostova, CPA • License #SC-49102
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#D8DCE2] flex justify-between items-center">
            <button
              onClick={() => alert('Simulated download of Demo Draft PDF with DEMO DRAFT watermark')}
              className="text-xs font-bold text-[#061A2F] hover:text-[#C99A32] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Download Watermarked Draft PDF
            </button>
            <span className="text-[10px] font-mono text-[#667085]">MeF XML Validated</span>
          </div>
        </div>
      </div>

      {/* 5. Full Draft Return Modal (Simulated Form 1120-S) */}
      {showFullDraftModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="full-draft-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <div>
                <h3 id="full-draft-title" className="text-base font-bold text-[#061A2F]">
                  Form 1120-S: U.S. Income Tax Return for an S Corporation (Draft)
                </h3>
                <div className="text-[11px] text-[#667085] font-mono">Tax Year 2025 • EIN: 84-3928190</div>
              </div>
              <button
                onClick={() => setShowFullDraftModal(false)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Simulated Watermarked Form Viewer */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#FBFAF7] border border-[#D8DCE2] rounded relative">
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-10 rotate-[-25deg]">
                <span className="text-7xl font-black text-slate-900 select-none">DEMO DRAFT</span>
              </div>

              <div className="space-y-4 text-xs font-mono relative z-10">
                <div className="border-b border-black pb-2 text-center">
                  <div className="text-sm font-bold">DEPARTMENT OF THE TREASURY — INTERNAL REVENUE SERVICE</div>
                  <div className="text-xs">Form 1120-S (2025) • For calendar year 2025</div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-black pb-2 text-[11px]">
                  <div>Name: PEROTTI CAPITAL HOLDINGS LLC</div>
                  <div>Principal Activity: REAL ESTATE INVESTMENT</div>
                  <div>Address: 100 FINANCIAL WAY, GREENVILLE, SC 29601</div>
                  <div>Incorporation Date: 03/15/2018</div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="font-bold text-xs">INCOME (Lines 1-6)</div>
                  <div className="flex justify-between"><span>1a. Gross receipts or sales:</span><span>$645,000.00</span></div>
                  <div className="flex justify-between"><span>2. Cost of goods sold:</span><span>$0.00</span></div>
                  <div className="flex justify-between border-t border-dashed"><span>6. Total income:</span><span>$645,000.00</span></div>

                  <div className="font-bold text-xs pt-2">DEDUCTIONS (Lines 7-20)</div>
                  <div className="flex justify-between"><span>7. Compensation of officers:</span><span>$120,000.00</span></div>
                  <div className="flex justify-between"><span>8. Salaries and wages:</span><span>$85,000.00</span></div>
                  <div className="flex justify-between"><span>16. Rents:</span><span>$48,500.00</span></div>
                  <div className="flex justify-between"><span>19. Other deductions:</span><span>$145,000.00</span></div>
                  <div className="flex justify-between border-t border-dashed"><span>20. Total deductions:</span><span>$398,500.00</span></div>

                  <div className="font-bold text-xs pt-2">ORDINARY BUSINESS INCOME</div>
                  <div className="flex justify-between font-bold text-sm bg-white p-2 border border-black">
                    <span>21. Ordinary business income (loss):</span>
                    <span>$246,500.00</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-[#667085]">
                Watermarked demonstration preview only • Not for tax filing
              </span>
              <button
                onClick={() => setShowFullDraftModal(false)}
                className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Form 8879 E-Signature Modal */}
      {showSignModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signature-modal-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-[#C99A32]" />
                <h3 id="signature-modal-title" className="text-sm font-bold text-[#061A2F]">
                  Form 8879-S: IRS E-File Signature Authorization
                </h3>
              </div>
              <button
                onClick={() => setShowSignModal(false)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAuthorizeSignature} className="space-y-4 text-xs">
              <div className="p-3 bg-[#FAF9F5] border border-[#061A2F] rounded space-y-2 text-[#1A2028]">
                <div className="font-bold">Part II: Declaration of Taxpayer</div>
                <p className="text-[11px] leading-relaxed text-[#4B5563]">
                  Under penalties of perjury, I declare that I am an officer of the above named corporation and that I have examined a copy of the corporation's 2025 electronic income tax return and accompanying schedules and statements and to the best of my knowledge and belief, it is true, correct, and complete. I authorize A/R Tax Services, LLC to transmit the return to the IRS.
                </p>
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Authorized Officer Name</label>
                <input
                  type="text"
                  required
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7] font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Officer Title</label>
                <input
                  type="text"
                  disabled
                  value="Managing Member / President"
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#F3F4F6] text-[#667085] cursor-not-allowed"
                />
              </div>

              <div className="p-3 bg-[#FBFAF7] border border-[#D8DCE2] rounded space-y-2">
                <label className="flex items-start gap-2 cursor-pointer font-bold text-[#061A2F]">
                  <input
                    type="checkbox"
                    required
                    checked={signatureConsent}
                    onChange={(e) => setSignatureConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I confirm that I have reviewed the draft Form 1120-S package, consent to electronic signature under the ESIGN Act, and authorize transmission.
                  </span>
                </label>
              </div>

              <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSignModal(false)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!signatureConsent || !signatureName.trim()}
                  className="px-5 py-2 bg-[#061A2F] text-[#E8C66A] text-xs font-bold uppercase tracking-wider rounded hover:bg-[#031323] transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  Execute Form 8879 E-Signature
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Correction Request Modal */}
      {showCorrectionModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="request-correction-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="request-correction-title" className="text-sm font-bold text-[#061A2F]">
                Request Return Correction
              </h3>
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestCorrection} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Target Line / Section</label>
                <select
                  value={correctionField}
                  onChange={(e) => setCorrectionField(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                >
                  <option value="Officer Compensation (Line 7)">Officer Compensation (Line 7)</option>
                  <option value="Gross Receipts (Line 1a)">Gross Receipts (Line 1a)</option>
                  <option value="Rents Deduction (Line 16)">Rents Deduction (Line 16)</option>
                  <option value="Shareholder Percentage / K-1">Shareholder Percentage / K-1</option>
                  <option value="South Carolina Apportionment">South Carolina Apportionment</option>
                  <option value="Other Line Item">Other Line Item</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Explanation of Correction Required *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain why this figure needs adjustment and cite any supporting documentation..."
                  value={correctionExplanation}
                  onChange={(e) => setCorrectionExplanation(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div className="p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-[11px] text-[#4B5563]">
                Submitting this request changes the return status to <strong>Corrections Required</strong> and notifies senior CPA reviewer Elena Rostova.
              </div>

              <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
                >
                  Submit Correction Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Ask CPA Question Modal */}
      {showQuestionModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ask-cpa-title"
        >
          <div className="bg-white rounded-lg border border-[#D8DCE2] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#D8DCE2]">
              <h3 id="ask-cpa-title" className="text-sm font-bold text-[#061A2F]">
                Ask Your Review CPA a Question
              </h3>
              <button
                onClick={() => setShowQuestionModal(false)}
                className="p-1 hover:bg-[#FAF9F5] rounded text-slate-400 hover:text-black cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAskQuestion} className="space-y-3 text-xs">
              <div className="text-[11px] text-[#667085]">
                Direct inquiry to <strong>Elena Rostova, CPA</strong> (Senior Technical Reviewer).
              </div>

              <div>
                <label className="font-semibold text-[#061A2F] block mb-1">Your Question / Inquiry *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ask about Schedule K-1 pass-through, South Carolina tax credits, or ordinary deductions..."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8DCE2] rounded bg-[#FBFAF7]"
                />
              </div>

              <div className="pt-2 border-t border-[#D8DCE2] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-3 py-2 border border-[#D8DCE2] text-xs font-bold rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#061A2F] text-white text-xs font-bold rounded hover:bg-[#031323] cursor-pointer"
                >
                  Send Inquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
