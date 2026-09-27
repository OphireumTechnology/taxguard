/**
 * A/R Tax Services, LLC - Personalized Documents Engine Modals
 * Supports:
 * - Smart Upload & Document Scanner simulation with AI confidence scoring
 * - OCR Data Inspector with sensitive data masking and field-level audit trail
 * - Interactive Intake Questionnaire Editor (life events & state triggers)
 * - Tax Professional Override Modal with reason logging
 */

import React, { useState } from 'react';
import {
  UploadCloud,
  Camera,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Eye,
  Lock,
  ArrowRight,
  Info,
  Calendar,
  Building,
  DollarSign
} from 'lucide-react';
import {
  PersonalizedDocItem,
  IntakeResponses,
  OcrAuditEntry,
  detectUploadAnomalies,
  ALL_STANDARD_TAX_FORMS
} from '../../services/personalizedDocumentsEngine';

// --------------------------------------------------------------------------
// 1. SMART UPLOAD & DOCUMENT SCANNER MODAL
// --------------------------------------------------------------------------

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDoc: PersonalizedDocItem | null;
  selectedTaxYear: number;
  allExistingDocs: PersonalizedDocItem[];
  onUploadSuccess: (
    docId: string,
    uploadedData: {
      fileName: string;
      fileSize: string;
      fileHash: string;
      confidenceScore: number;
      ocrData: Record<string, string | number>;
      taxYearMismatch?: boolean;
      mismatchDetectedYear?: number;
      possibleDuplicateOf?: string;
    }
  ) => void;
}

export const SmartUploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  targetDoc,
  selectedTaxYear,
  allExistingDocs,
  onUploadSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [simulatedDocYear, setSimulatedDocYear] = useState<number>(selectedTaxYear);

  if (!isOpen || !targetDoc) return null;

  const handleSimulatedUpload = () => {
    setIsProcessing(true);
    setUploadProgress(20);

    const timer1 = setTimeout(() => setUploadProgress(60), 300);
    const timer2 = setTimeout(() => {
      setUploadProgress(100);

      const fileName = selectedFile
        ? selectedFile.name
        : `${simulatedDocYear}_${targetDoc.formNumber.replace(/[^a-zA-Z0-9]/g, '_')}_Upload_${Math.floor(1000 + Math.random() * 9000)}.pdf`;

      const fileHash = `sha256_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;

      // Run anomaly check
      const anomaly = detectUploadAnomalies(
        {
          fileName,
          fileHash,
          taxYear: simulatedDocYear,
          formType: targetDoc.formNumber
        },
        allExistingDocs,
        selectedTaxYear
      );

      // Generate realistic extracted OCR fields
      const ocrFields: Record<string, string | number> = {
        taxYear: simulatedDocYear,
        taxpayerName: 'Taxpayer on Record',
        taxpayerSSNMasked: '***-**-8419',
        detectedForm: targetDoc.formNumber,
        issuingEntity: targetDoc.source === 'Employer' ? 'Apex Technology Corp' : 'Financial Custodian N.A.',
        scanTimestamp: new Date().toISOString()
      };

      if (targetDoc.category === 'Employment') {
        ocrFields.box1Wages = 145200.00;
        ocrFields.box2FedWithheld = 26800.00;
        ocrFields.box16StateWages = 145200.00;
        ocrFields.box17StateWithheld = 7410.00;
      } else if (targetDoc.category === 'Contract / Gig Work') {
        ocrFields.box1NonempComp = 38500.00;
      } else if (targetDoc.category === 'Mortgage Interest') {
        ocrFields.mortgageInterest = 18450.00;
        ocrFields.outstandingPrincipal = 420000.00;
      }

      onUploadSuccess(targetDoc.id, {
        fileName,
        fileSize: selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : '1.34 MB',
        fileHash,
        confidenceScore: anomaly.isTaxYearMismatch ? 76 : 98,
        ocrData: ocrFields,
        taxYearMismatch: anomaly.isTaxYearMismatch,
        mismatchDetectedYear: anomaly.mismatchYear,
        possibleDuplicateOf: anomaly.duplicateMatchId
      });

      setIsProcessing(false);
      setSelectedFile(null);
      setIsCameraActive(false);
      onClose();
    }, 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A2544] text-[#E8C66A]">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Upload &amp; Scan Tax Document</h3>
              <p className="text-xs text-neutral-500 font-mono">Target: {targetDoc.formNumber} — {targetDoc.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Target Document Specs */}
          <div className="rounded-lg bg-neutral-50 p-3 text-xs border border-neutral-200 space-y-1">
            <div className="flex justify-between">
              <span className="font-semibold text-neutral-700">Category:</span>
              <span className="font-mono text-neutral-900">{targetDoc.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-neutral-700">Target Tax Year:</span>
              <span className="font-mono font-bold text-[#0A2544]">CY{selectedTaxYear}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-neutral-700">Issuing Source:</span>
              <span className="text-neutral-800">{targetDoc.source}</span>
            </div>
          </div>

          {/* Upload or Camera Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsCameraActive(false)}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all ${
                !isCameraActive
                  ? 'border-[#0A2544] bg-[#0A2544] text-white shadow-xs'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              <span>File Browser / PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCameraActive(true)}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all ${
                isCameraActive
                  ? 'border-[#0A2544] bg-[#0A2544] text-white shadow-xs'
                  : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Camera className="h-4 w-4" />
              <span>Camera / Mobile Scan</span>
            </button>
          </div>

          {/* Camera Simulation Mode */}
          {isCameraActive ? (
            <div className="rounded-lg border-2 border-dashed border-[#0A2544]/40 bg-neutral-900 p-6 text-center text-white">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 mb-3 animate-pulse">
                <Camera className="h-7 w-7 text-[#E8C66A]" />
              </div>
              <p className="text-xs font-semibold">Live High-Resolution Camera Mode</p>
              <p className="text-[11px] text-neutral-400 mt-1">
                Align document edges inside the viewport. Auto-edge detection &amp; perspective correction enabled.
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-[#C99A32] animate-ping" />
                <span className="text-[10px] font-mono text-[#E8C66A]">Scanner Ready (300 DPI Simulated)</span>
              </div>
            </div>
          ) : (
            /* Drag and Drop Zone */
            <div className="rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50/50 p-6 text-center hover:bg-neutral-50 transition-colors">
              <input
                type="file"
                id="doc-file-input"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.tiff"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
              />
              <label htmlFor="doc-file-input" className="cursor-pointer block">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-xs border border-neutral-200 mb-2">
                  <FileText className="h-6 w-6 text-[#0A2544]" />
                </div>
                <p className="text-xs font-semibold text-neutral-900">
                  {selectedFile ? selectedFile.name : 'Click to select or drag PDF, JPG, PNG here'}
                </p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Multi-page PDFs supported up to 50 MB. 256-bit encrypted transit.
                </p>
              </label>
            </div>
          )}

          {/* Year Simulation Control for Mismatch Testing */}
          <div className="flex items-center justify-between rounded-lg bg-neutral-100 p-2.5 text-xs">
            <span className="font-semibold text-neutral-700 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-neutral-500" />
              Document Calendar Year:
            </span>
            <div className="flex gap-1.5">
              {[2026, 2025, 2024].map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSimulatedDocYear(yr)}
                  className={`rounded px-2.5 py-1 text-xs font-mono font-semibold transition-colors ${
                    simulatedDocYear === yr
                      ? 'bg-[#0A2544] text-[#E8C66A]'
                      : 'bg-white text-neutral-600 border border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {simulatedDocYear !== selectedTaxYear && (
            <div className="rounded-lg border border-[#C99A32] bg-[#FAF9F5] p-2.5 text-xs text-[#061A2F] flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-[#C99A32] flex-shrink-0 mt-0.5" />
              <span>
                <strong>Notice:</strong> Document year ({simulatedDocYear}) differs from currently active tax year ({selectedTaxYear}). This will trigger the Tax Year Mismatch audit flag upon upload.
              </span>
            </div>
          )}

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-neutral-700">
                <span>AI Optical Character Recognition &amp; Form Sorter...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-[#0A2544] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSimulatedUpload}
            disabled={isProcessing}
            className="flex items-center gap-2 rounded-lg bg-[#0A2544] px-4 py-2 text-xs font-semibold text-[#E8C66A] shadow-sm hover:bg-[#061A2F]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isProcessing ? 'Processing...' : 'Complete Upload &amp; Scan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// 2. OCR INSPECTION & DATA AUDIT MODAL
// --------------------------------------------------------------------------

interface OcrInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: PersonalizedDocItem | null;
}

export const OcrInspectionModal: React.FC<OcrInspectionModalProps> = ({
  isOpen,
  onClose,
  doc
}) => {
  if (!isOpen || !doc) return null;

  const ocrData = doc.ocrData || {};
  const entries = Object.entries(ocrData);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#061A2F] text-[#E8C66A]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">OCR Extraction &amp; Field Audit Trail</h3>
              <p className="text-xs text-neutral-500 font-mono">{doc.formNumber} — {doc.uploadedFileName || 'Uploaded Document'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Metadata banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-neutral-50 p-3 border border-neutral-200 text-xs">
            <div>
              <span className="text-neutral-500 block text-[10px] font-mono uppercase">Confidence</span>
              <span className="font-bold text-[#061A2F]">{doc.confidenceScore || 98}% ({doc.confidenceTier || 'High'})</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-mono uppercase">Tax Year</span>
              <span className="font-bold text-[#0A2544]">CY{doc.taxYear}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-mono uppercase">Review Status</span>
              <span className="font-bold text-neutral-800">{doc.status}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px] font-mono uppercase">Reviewer</span>
              <span className="font-medium text-neutral-700">{doc.reviewedBy || 'Marcus Vance, EA'}</span>
            </div>
          </div>

          {/* Extracted Key-Value Table */}
          <div>
            <h4 className="text-xs font-bold text-neutral-900 mb-2 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-[#0A2544]" />
              <span>Extracted Tax Form Fields (Masked for Security)</span>
            </h4>

            {entries.length === 0 ? (
              <div className="rounded-lg border border-neutral-200 p-4 text-center text-xs text-neutral-500">
                No structured OCR data available for this document.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-neutral-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 font-mono text-[11px] text-neutral-700">
                    <tr>
                      <th className="px-3 py-2">Field Description</th>
                      <th className="px-3 py-2">Extracted Value</th>
                      <th className="px-3 py-2">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 bg-white">
                    {entries.map(([key, val]) => (
                      <tr key={key} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 font-mono font-medium text-neutral-800">
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </td>
                        <td className="px-3 py-2 font-mono text-neutral-900">
                          {typeof val === 'number'
                            ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : String(val)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#061A2F] bg-[#FAF9F5] px-2 py-0.5 rounded border border-[#C99A32]">
                            <CheckCircle2 className="h-3 w-3 text-[#C99A32]" />
                            Verified
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Provenance and Chain of Custody */}
          <div className="rounded-lg bg-neutral-50 p-3 border border-neutral-200 text-xs space-y-1.5">
            <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-neutral-600" />
              <span>Security, Hash &amp; Chain of Custody</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-neutral-600">
              <div>SHA-256 Hash: <span className="text-neutral-900">{doc.fileHash || 'sha256_e8910a293b8214'}</span></div>
              <div>Upload Timestamp: <span className="text-neutral-900">{doc.uploadedDate || '2026-02-14 14:22 EST'}</span></div>
              <div>Malware &amp; PDF Sanitization: <span className="text-[#061A2F] font-bold">Passed (Zero Threats)</span></div>
              <div>PII Redaction Engine: <span className="text-[#061A2F] font-bold">SSN &amp; Bank Accts Masked</span></div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#0A2544] px-4 py-2 text-xs font-semibold text-white hover:bg-[#061A2F]"
          >
            Close Audit Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// 3. INTERACTIVE INTAKE QUESTIONNAIRE MODAL
// --------------------------------------------------------------------------

interface IntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIntake: IntakeResponses;
  onSaveIntake: (updatedIntake: IntakeResponses) => void;
}

export const IntakeQuestionnaireModal: React.FC<IntakeModalProps> = ({
  isOpen,
  onClose,
  currentIntake,
  onSaveIntake
}) => {
  const [draft, setDraft] = useState<IntakeResponses>({ ...currentIntake });

  if (!isOpen) return null;

  const handleToggle = (key: keyof IntakeResponses) => {
    setDraft(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    onSaveIntake(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-2xl border border-neutral-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A2544] text-[#E8C66A]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Personalized Tax Intake &amp; Requirement Rules</h3>
              <p className="text-xs text-neutral-500">
                Adjusting life events and sources updates document requirements in real time.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-6">
          {/* Automatic State of Residence Notice */}
          <div className="rounded-lg bg-[#FAF9F5] p-3 border border-[#C99A32]/40 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[#061A2F]">State of Residence: </span>
                <span className="font-mono font-bold text-[#C99A32] bg-[#061A2F] text-white px-2 py-0.5 rounded text-[11px] ml-1">
                  {draft.residenceState}
                </span>
                <span className="text-[#667085] ml-2 text-[11px]">
                  (Configured automatically during client onboarding)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraft(prev => ({
                      ...prev,
                      hadW2Employment: true,
                      hadFreelanceOrContract: true,
                      received1099MISC: true,
                      receivedInterest: true,
                      receivedDividends: true,
                      receivedInterestOrDividends: true,
                      soldInvestments: true,
                      received1099K: true,
                      receivedRetirementDistributions: true,
                      receivedGovernmentPayments: true,
                      receivedSocialSecurity: true,
                      hasPassThroughK1: true,
                      hasMortgage: true,
                      hasCollegeOrTuition: true,
                      paysStudentLoanInterest: true,
                      hasForeclosureOrAbandonment: true,
                      hasCancelledDebt: true,
                      hasCancelledDebtOrForeclosure: true,
                      soldRealEstate: true,
                      hasHSAorMSA: true,
                      contributedToIRA: true,
                      hasMarketplaceInsurance: true,
                      hasLongTermCare: true,
                      hasABLEAccount: true,
                      hasEducationPlans: true,
                      receivedUnemployment: true
                    }));
                  }}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#061A2F] text-[#E8C66A] rounded border border-[#C99A32]/40 hover:bg-[#0A2544]"
                >
                  Enable All 23 Forms
                </button>
              </div>
            </div>
          </div>

          {/* All 23 Standard Forms Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-[#061A2F]">
                Standard Tax Forms Intake Checklist (23 Forms)
              </h4>
              <span className="text-[11px] font-mono text-[#667085]">
                {ALL_STANDARD_TAX_FORMS.filter(f => !!draft[f.intakeKey]).length} of 23 Active
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {ALL_STANDARD_TAX_FORMS.map(form => {
                const isChecked = !!draft[form.intakeKey];
                return (
                  <label
                    key={form.id}
                    className={`flex items-start justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                      isChecked
                        ? 'border-[#C99A32] bg-[#FAF9F5]'
                        : 'border-[#D8DCE2] bg-white hover:bg-[#FAF9F5]/40'
                    }`}
                  >
                    <div className="pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-[#061A2F] bg-[#FAF9F5] border border-[#C99A32]/50 px-1.5 py-0.5 rounded">
                          {form.formNumber}
                        </span>
                        <span className="text-[10px] font-semibold text-[#667085] uppercase font-mono">
                          {form.category}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[#061A2F]">{form.title}</div>
                      <div className="text-[11px] text-[#667085] mt-0.5">{form.description}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(form.intakeKey)}
                      className="mt-1 h-4 w-4 rounded border-[#D8DCE2] text-[#061A2F] accent-[#061A2F] focus:ring-[#C99A32]"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-[#0A2544] px-4 py-2 text-xs font-semibold text-[#E8C66A] shadow-sm hover:bg-[#061A2F]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Apply Rules &amp; Regenerate Requirements</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// 4. TAX PROFESSIONAL STATUS OVERRIDE MODAL
// --------------------------------------------------------------------------

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: PersonalizedDocItem | null;
  onApplyOverride: (docId: string, newStatus: PersonalizedDocItem['status'], reason: string) => void;
}

export const ProfessionalOverrideModal: React.FC<OverrideModalProps> = ({
  isOpen,
  onClose,
  doc,
  onApplyOverride
}) => {
  const [selectedStatus, setSelectedStatus] = useState<PersonalizedDocItem['status']>('Accepted');
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !doc) return null;

  const handleSave = () => {
    if (!overrideReason.trim()) {
      setError('Professional override requires a documented statutory or audit explanation.');
      return;
    }
    onApplyOverride(doc.id, selectedStatus, overrideReason.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-neutral-200">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A2544] text-[#E8C66A]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Tax Preparer Status Override</h3>
              <p className="text-xs text-neutral-500 font-mono">{doc.formNumber} — {doc.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="rounded-lg bg-neutral-50 p-3 text-xs border border-neutral-200 space-y-1">
            <div className="flex justify-between">
              <span className="font-semibold text-neutral-600">Current Status:</span>
              <span className="font-bold text-neutral-900">{doc.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-neutral-600">Reviewer:</span>
              <span className="font-mono text-neutral-800">Elena Rostova, CPA (Senior Sign-off)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Select New Review Status:
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as PersonalizedDocItem['status'])}
              className="w-full rounded-lg border border-neutral-300 p-2 text-xs font-medium text-neutral-800 bg-white"
            >
              <option value="Accepted">Accepted — Validated &amp; Ready for Filing</option>
              <option value="Needs Review">Needs Review — Flagged for Clarification</option>
              <option value="Rejected / Replace">Rejected / Replace — Illegible or Incomplete</option>
              <option value="Not Applicable">Not Applicable — Statutory Exemption Applies</option>
              <option value="Awaiting Client">Awaiting Client Action</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-800 mb-1">
              Documented Professional Reason (Required for Audit Trail):
            </label>
            <textarea
              value={overrideReason}
              onChange={(e) => {
                setOverrideReason(e.target.value);
                setError(null);
              }}
              rows={3}
              placeholder="e.g., Reviewed substitute 1099; corroborated with year-end banking tie-out. Statutory requirements met."
              className="w-full rounded-lg border border-neutral-300 p-2.5 text-xs text-neutral-800 focus:border-[#0A2544] focus:outline-hidden"
            />
            {error && (
              <p className="text-[11px] text-[#061A2F] font-bold mt-1 bg-[#FAF9F5] border border-[#061A2F] p-2 rounded">{error}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-[#0A2544] px-4 py-2 text-xs font-semibold text-[#E8C66A] hover:bg-[#061A2F]"
          >
            Log Override &amp; Update Status
          </button>
        </div>
      </div>
    </div>
  );
};
