/**
 * A/R Tax Services, LLC - AI Document Processing Pipeline & Structured Output
 * Compliance with Sections 12-17: 14-stage pipeline, confidence badges, duplicate detection,
 * quality flags, structured JSON preview, and client correction workflow.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  Search,
  Eye,
  AlertCircle,
  HelpCircle,
  X,
  FileText
} from 'lucide-react';

export interface AiProcessingResult {
  documentId: string;
  originalFilename: string;
  standardizedFilename: string;
  status: 'COMPLETED' | 'IN_REVIEW' | 'FLAGGED';
  confidenceScore: number;
  duplicateProbability: number;
  qualityScore: number;
  qualityFlags: string[];
  extraction: {
    formType: string;
    taxYear: number;
    taxpayerName: string;
    taxpayerIdMasked: string;
    payerOrIssuer: string;
    payerEinMasked: string;
    totalAmountOrIncome: number;
    withholdingOrTax: number;
    vaultCategory: string;
    checklistMatchingId: string;
  };
  pipelineStages: Array<{
    stageNumber: number;
    name: string;
    status: 'success' | 'warning' | 'pending';
    detail: string;
  }>;
}

const SAMPLE_RESULTS: AiProcessingResult[] = [
  {
    documentId: 'doc-ai-w2-apex',
    originalFilename: '2025_Form_W2_Apex_Technology.pdf',
    standardizedFilename: '2025_W2_ApexTechnologyPartners_DH_XXXX.pdf',
    status: 'COMPLETED',
    confidenceScore: 98.4,
    duplicateProbability: 1.2,
    qualityScore: 99.0,
    qualityFlags: [],
    extraction: {
      formType: 'Form W-2 Wage and Tax Statement',
      taxYear: 2025,
      taxpayerName: 'Desmond Hinds',
      taxpayerIdMasked: '***-**-4891',
      payerOrIssuer: 'Apex Technology Partners LLC',
      payerEinMasked: '**-***7812',
      totalAmountOrIncome: 185000.0,
      withholdingOrTax: 32450.0,
      vaultCategory: '04 — Income Statements (W-2, 1099-MISC, 1099-NEC)',
      checklistMatchingId: 'chk-w2-1'
    },
    pipelineStages: [
      { stageNumber: 1, name: 'Security Scanning', status: 'warning', detail: 'Document security scanning is not configured (isolated tenant sandbox).' },
      { stageNumber: 2, name: 'OCR & Text Extraction', status: 'success', detail: 'Native vector text extracted; 100% OCR density on 1 page.' },
      { stageNumber: 3, name: 'Tax Year Detection', status: 'success', detail: 'Detected CY2025 in Box c and header.' },
      { stageNumber: 4, name: 'Form Identification', status: 'success', detail: 'Matched IRS Form W-2 layout specification (Rev. 2025).' },
      { stageNumber: 5, name: 'Taxpayer Matching', status: 'success', detail: 'Matched taxpayer Desmond Hinds (SSN ending in 4891).' },
      { stageNumber: 6, name: 'Payer Resolution', status: 'success', detail: 'Matched Apex Technology Partners LLC (EIN ending in 7812).' },
      { stageNumber: 7, name: 'Field Extraction', status: 'success', detail: 'Extracted Box 1 wages ($185,000.00), Box 2 withholding ($32,450.00).' },
      { stageNumber: 8, name: 'Confidence Scoring', status: 'success', detail: 'Calculated composite score of 98.4% (High Confidence).' },
      { stageNumber: 9, name: 'Duplicate Detection', status: 'success', detail: 'Checked SHA-256 fingerprint; duplicate probability: 1.2%.' },
      { stageNumber: 10, name: 'Quality Assessment', status: 'success', detail: 'Resolution: 300 DPI, contrast ratio: 98%, skew angle: 0.1°.' },
      { stageNumber: 11, name: 'Standard Filename', status: 'success', detail: 'Generated 2025_W2_ApexTechnologyPartners_DH_XXXX.pdf.' },
      { stageNumber: 12, name: 'Category Assignment', status: 'success', detail: 'Routed to Category 04 — Income Statements.' },
      { stageNumber: 13, name: 'Checklist Reconciliation', status: 'success', detail: 'Linked to checklist item #chk-w2-1 (Status updated to Uploaded).' },
      { stageNumber: 14, name: 'Discrepancy Check', status: 'success', detail: 'Zero anomalies found; ready for reviewer sign-off.' }
    ]
  },
  {
    documentId: 'doc-ai-1099nec-highland',
    originalFilename: '2025_Form_1099NEC_Highland_Consulting.pdf',
    standardizedFilename: '2025_1099NEC_HighlandConsulting_DH_XXXX.pdf',
    status: 'COMPLETED',
    confidenceScore: 91.2,
    duplicateProbability: 4.8,
    qualityScore: 92.0,
    qualityFlags: ['Slight horizontal skew (1.8°) automatically rectified'],
    extraction: {
      formType: 'Form 1099-NEC Nonemployee Compensation',
      taxYear: 2025,
      taxpayerName: 'Desmond Hinds',
      taxpayerIdMasked: '***-**-4891',
      payerOrIssuer: 'Highland Consulting Group Inc.',
      payerEinMasked: '**-***3491',
      totalAmountOrIncome: 45000.0,
      withholdingOrTax: 0.0,
      vaultCategory: '04 — Income Statements (W-2, 1099-MISC, 1099-NEC)',
      checklistMatchingId: 'chk-1099-nec'
    },
    pipelineStages: [
      { stageNumber: 1, name: 'Security Scanning', status: 'warning', detail: 'Document security scanning is not configured.' },
      { stageNumber: 2, name: 'OCR & Text Extraction', status: 'success', detail: 'Tesseract OCR engine extracted text blocks with 94% accuracy.' },
      { stageNumber: 3, name: 'Tax Year Detection', status: 'success', detail: 'CY2025 verified in header box.' },
      { stageNumber: 4, name: 'Form Identification', status: 'success', detail: 'IRS Form 1099-NEC standard template.' },
      { stageNumber: 5, name: 'Taxpayer Matching', status: 'success', detail: 'Matched taxpayer Desmond Hinds.' },
      { stageNumber: 6, name: 'Payer Resolution', status: 'success', detail: 'Payer Highland Consulting Group Inc.' },
      { stageNumber: 7, name: 'Field Extraction', status: 'success', detail: 'Box 1 nonemployee compensation $45,000.00.' },
      { stageNumber: 8, name: 'Confidence Scoring', status: 'success', detail: 'Score 91.2% (Review Recommended).' },
      { stageNumber: 9, name: 'Duplicate Detection', status: 'success', detail: 'Duplicate probability: 4.8%.' },
      { stageNumber: 10, name: 'Quality Assessment', status: 'warning', detail: '1.8° skew angle corrected.' },
      { stageNumber: 11, name: 'Standard Filename', status: 'success', detail: 'Generated 2025_1099NEC_HighlandConsulting_DH_XXXX.pdf.' },
      { stageNumber: 12, name: 'Category Assignment', status: 'success', detail: 'Routed to Category 04.' },
      { stageNumber: 13, name: 'Checklist Reconciliation', status: 'success', detail: 'Linked to item #chk-1099-nec.' },
      { stageNumber: 14, name: 'Discrepancy Check', status: 'success', detail: 'No state tax withholding reported in Box 5.' }
    ]
  },
  {
    documentId: 'doc-ai-k1-pinnacle',
    originalFilename: '2025_Schedule_K1_Pinnacle_LP.pdf',
    standardizedFilename: '2025_K1_PinnacleRealEstateFundLP_DH_XXXX.pdf',
    status: 'FLAGGED',
    confidenceScore: 78.5,
    duplicateProbability: 12.0,
    qualityScore: 75.0,
    qualityFlags: ['Multi-tier pass-through allocation', 'Footnotes contain Section 199A QBI statement'],
    extraction: {
      formType: 'Schedule K-1 (Form 1065)',
      taxYear: 2025,
      taxpayerName: 'Desmond Hinds',
      taxpayerIdMasked: '***-**-4891',
      payerOrIssuer: 'Pinnacle Real Estate Fund LP',
      payerEinMasked: '**-***9921',
      totalAmountOrIncome: 38200.0,
      withholdingOrTax: 0.0,
      vaultCategory: '07 — Pass-Through Entities (Schedule K-1, 1065, 1120-S)',
      checklistMatchingId: 'chk-k1-pass'
    },
    pipelineStages: [
      { stageNumber: 1, name: 'Security Scanning', status: 'warning', detail: 'Document security scanning is not configured.' },
      { stageNumber: 2, name: 'OCR & Text Extraction', status: 'success', detail: 'Extracted 4 pages of pass-through reporting & statements.' },
      { stageNumber: 3, name: 'Tax Year Detection', status: 'success', detail: 'CY2025 identified.' },
      { stageNumber: 4, name: 'Form Identification', status: 'success', detail: 'IRS Form 1065 Schedule K-1.' },
      { stageNumber: 5, name: 'Taxpayer Matching', status: 'success', detail: 'Matched partner Desmond Hinds.' },
      { stageNumber: 6, name: 'Payer Resolution', status: 'success', detail: 'Partnership Pinnacle Real Estate Fund LP.' },
      { stageNumber: 7, name: 'Field Extraction', status: 'warning', detail: 'Box 2 net rental income $38,200.00; Box 20 Code Z QBI statement detected.' },
      { stageNumber: 8, name: 'Confidence Scoring', status: 'warning', detail: 'Score 78.5% — Mandatory Human Review Required (<80%).' },
      { stageNumber: 9, name: 'Duplicate Detection', status: 'warning', detail: 'Duplicate probability 12.0%.' },
      { stageNumber: 10, name: 'Quality Assessment', status: 'warning', detail: 'Complex multi-page table requires human cross-tie.' },
      { stageNumber: 11, name: 'Standard Filename', status: 'success', detail: 'Generated 2025_K1_PinnacleRealEstateFundLP_DH_XXXX.pdf.' },
      { stageNumber: 12, name: 'Category Assignment', status: 'success', detail: 'Category 07 — Pass-Through Entities.' },
      { stageNumber: 13, name: 'Checklist Reconciliation', status: 'success', detail: 'Reconciled to item #chk-k1-pass.' },
      { stageNumber: 14, name: 'Discrepancy Check', status: 'warning', detail: 'Mandatory human reviewer verification flagged.' }
    ]
  }
];

export const AiProcessingPipelineSection: React.FC = () => {
  const [selectedResult, setSelectedResult] = useState<AiProcessingResult>(SAMPLE_RESULTS[0]);
  const [copiedJson, setCopiedJson] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('wrong_category');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [clientConfirmed, setClientConfirmed] = useState<Record<string, boolean>>({});
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(selectedResult, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleConfirmCorrect = (docId: string) => {
    setClientConfirmed(prev => ({ ...prev, [docId]: true }));
  };

  const handleSubmitCorrection = () => {
    setFeedbackNotice(`Correction request submitted for "${selectedResult.originalFilename}": ${correctionReason.toUpperCase()}. Notification dispatched to your assigned tax reviewer.`);
    setCorrectionModalOpen(false);
    setCorrectionNotes('');
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 95.0) {
      return (
        <span className="px-2.5 py-1 text-xs font-bold font-mono bg-emerald-100 text-emerald-900 border border-emerald-300 rounded flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>High Confidence ({score.toFixed(1)}%) — Fast Track Review</span>
        </span>
      );
    } else if (score >= 80.0) {
      return (
        <span className="px-2.5 py-1 text-xs font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300 rounded flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
          <span>Review Recommended ({score.toFixed(1)}%) — Standard Verification</span>
        </span>
      );
    } else {
      return (
        <span className="px-2.5 py-1 text-xs font-bold font-mono bg-rose-100 text-rose-900 border border-rose-300 rounded flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
          <span>Mandatory Human Review Required ({score.toFixed(1)}%)</span>
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#D7AC4A]" />
              <h2 className="text-xl font-bold text-neutral-900">AI Document Processing Pipeline</h2>
            </div>
            <p className="text-sm text-neutral-600 mt-1">
              Automated 14-stage extraction, confidence classification, duplicate checking, and standardized naming.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-neutral-500">
              {SAMPLE_RESULTS.length} Documents Ingested
            </span>
          </div>
        </div>
      </div>

      {feedbackNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-lg text-xs font-medium flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* Document Selector Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {SAMPLE_RESULTS.map((res) => {
          const isSelected = selectedResult.documentId === res.documentId;
          const isConfirmed = clientConfirmed[res.documentId];

          return (
            <button
              key={res.documentId}
              onClick={() => setSelectedResult(res)}
              className={`p-4 border rounded-lg text-left transition-all shadow-xs ${
                isSelected
                  ? 'border-[#0A2544] bg-[#0A2544]/5 ring-1 ring-[#0A2544]'
                  : 'border-neutral-300 bg-white hover:border-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900 truncate">
                  {res.originalFilename}
                </span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    res.confidenceScore >= 95
                      ? 'bg-emerald-500'
                      : res.confidenceScore >= 80
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
              </div>

              <div className="text-xs text-neutral-600 mt-1 truncate">
                {res.extraction.formType}
              </div>

              <div className="flex items-center justify-between mt-3 text-[11px] font-mono text-neutral-500 border-t border-neutral-200 pt-2">
                <span>Score: {res.confidenceScore}%</span>
                {isConfirmed ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Confirmed
                  </span>
                ) : (
                  <span>Pending Client Sign-Off</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Extracted Data & Pipeline Stages */}
        <div className="lg:col-span-7 space-y-6">
          {/* Classification & Confidence Card */}
          <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-semibold">
                  Source Document:
                </span>
                <h3 className="text-base font-bold text-neutral-900 mt-0.5">
                  {selectedResult.originalFilename}
                </h3>
              </div>
              <div>{getConfidenceBadge(selectedResult.confidenceScore)}</div>
            </div>

            {/* Standardized Filename */}
            <div className="p-3 bg-neutral-50 border border-neutral-300 rounded space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 font-bold block">
                Standardized Vault Filename:
              </span>
              <div className="font-mono text-xs font-semibold text-[#0A2544] select-all">
                {selectedResult.standardizedFilename}
              </div>
            </div>

            {/* Quality & Duplication Scores */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-2.5 border border-neutral-200 rounded bg-white">
                <span className="text-[10px] font-mono text-neutral-500 block">Quality Assessment</span>
                <span className="text-sm font-bold text-neutral-900 font-mono">
                  {selectedResult.qualityScore.toFixed(1)}%
                </span>
              </div>
              <div className="p-2.5 border border-neutral-200 rounded bg-white">
                <span className="text-[10px] font-mono text-neutral-500 block">Duplicate Risk</span>
                <span className="text-sm font-bold text-neutral-900 font-mono">
                  {selectedResult.duplicateProbability.toFixed(1)}%
                </span>
              </div>
              <div className="p-2.5 border border-neutral-200 rounded bg-white col-span-2 sm:col-span-1">
                <span className="text-[10px] font-mono text-neutral-500 block">Vault Category</span>
                <span className="text-xs font-semibold text-neutral-900 truncate block">
                  Cat 04 — Income
                </span>
              </div>
            </div>

            {/* Client Verification Action Bar */}
            <div className="p-3.5 bg-neutral-100 border border-neutral-300 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-neutral-700">
                <span className="font-bold text-neutral-900">Verify Classification:</span> Does this document look correctly identified?
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleConfirmCorrect(selectedResult.documentId)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors ${
                    clientConfirmed[selectedResult.documentId]
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{clientConfirmed[selectedResult.documentId] ? 'Verified' : 'This is correct'}</span>
                </button>
                <button
                  onClick={() => setCorrectionModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 rounded"
                >
                  This isn't correct
                </button>
              </div>
            </div>
          </div>

          {/* 14-Stage Pipeline Execution Trail */}
          <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0A2544]" />
              <span>14-Stage Processing Pipeline Audit Trail</span>
            </h3>

            <div className="space-y-2 pt-2">
              {selectedResult.pipelineStages.map((stage) => (
                <div
                  key={stage.stageNumber}
                  className="p-2.5 border border-neutral-200 rounded flex items-start justify-between gap-3 text-xs bg-neutral-50/50"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-700 flex items-center justify-center font-mono text-[10px] font-bold flex-shrink-0">
                      {stage.stageNumber}
                    </span>
                    <div>
                      <div className="font-bold text-neutral-900">{stage.name}</div>
                      <div className="text-neutral-600 text-[11px] mt-0.5">{stage.detail}</div>
                    </div>
                  </div>

                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-mono font-bold rounded flex-shrink-0 ${
                      stage.status === 'success'
                        ? 'bg-emerald-100 text-emerald-800'
                        : stage.status === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-neutral-200 text-neutral-700'
                    }`}
                  >
                    {stage.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Structured JSON Output Preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 bg-white border border-neutral-300 rounded-lg shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#0A2544]" />
                <h3 className="text-sm font-bold text-neutral-900">Extracted Structured JSON</h3>
              </div>
              <button
                onClick={handleCopyJson}
                className="px-2.5 py-1 text-xs border border-neutral-300 hover:bg-neutral-50 rounded flex items-center gap-1 transition-colors"
                title="Copy JSON payload"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-4 bg-[#061A2F] text-[#E8C66A] font-mono text-[11px] rounded-lg overflow-x-auto max-h-[500px] leading-relaxed shadow-inner">
              {JSON.stringify(
                {
                  documentId: selectedResult.documentId,
                  standardizedFilename: selectedResult.standardizedFilename,
                  classification: {
                    formType: selectedResult.extraction.formType,
                    taxYear: selectedResult.extraction.taxYear,
                    confidenceScore: selectedResult.confidenceScore,
                    qualityScore: selectedResult.qualityScore,
                    duplicateProbability: selectedResult.duplicateProbability
                  },
                  extractedFields: {
                    taxpayerName: selectedResult.extraction.taxpayerName,
                    taxpayerId: selectedResult.extraction.taxpayerIdMasked,
                    issuer: selectedResult.extraction.payerOrIssuer,
                    issuerEin: selectedResult.extraction.payerEinMasked,
                    grossIncome: selectedResult.extraction.totalAmountOrIncome,
                    withholding: selectedResult.extraction.withholdingOrTax
                  },
                  routing: {
                    vaultCategory: selectedResult.extraction.vaultCategory,
                    checklistMatch: selectedResult.extraction.checklistMatchingId
                  }
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      </div>

      {/* Correction Modal */}
      {correctionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-neutral-300 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">Flag Classification Issue</h3>
              <button
                onClick={() => setCorrectionModalOpen(false)}
                className="p-1 text-neutral-500 hover:text-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600">
              Please specify the discrepancy with <strong>{selectedResult.originalFilename}</strong> so our tax staff can re-index or re-assign it.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Issue Type:</label>
                <select
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded bg-white text-xs"
                >
                  <option value="wrong_taxpayer">Wrong Taxpayer / Entity</option>
                  <option value="wrong_tax_year">Wrong Tax Year (e.g., 2024 vs 2025)</option>
                  <option value="wrong_category">Wrong Category / Form Type</option>
                  <option value="replace_file">Upload Replacement File</option>
                  <option value="duplicate_upload">Accidental Duplicate Upload</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-neutral-700 block mb-1">Additional Notes:</label>
                <textarea
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  placeholder="Describe details (e.g., this is actually an S-Corp K-1, not an individual W-2)."
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-xs"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200">
              <button
                onClick={() => setCorrectionModalOpen(false)}
                className="px-4 py-2 border border-neutral-300 rounded text-xs font-semibold hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitCorrection}
                className="px-4 py-2 bg-[#061A2F] text-white rounded text-xs font-semibold hover:bg-[#0A2544]"
              >
                Submit Flag to Reviewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
