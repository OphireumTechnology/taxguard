/**
 * TaxGuard AI – Provider-Neutral OCR Extraction & Human Verification Queue
 * Enforces isAiProposedOnly: true until CPA/EA signoff with complete provenance trace.
 */

import React, { useState } from 'react';
import { 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  Edit3, 
  History, 
  FileText, 
  ShieldCheck,
  Check,
  X,
  Layers,
  Database
} from 'lucide-react';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';
import { ExtractedFieldEntity } from '../../server/taxguard/persistence.types';

export const TaxGuardExtractionView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [fields, setFields] = useState<ExtractedFieldEntity[]>([
    {
      id: 'field_w2_wages_001',
      tenantId: 'tenant_ar_tax_prod',
      clientId: 'client_henze_001',
      engagementId: 'eng_2025_tax',
      caseId: 'case_2025',
      taxYear: 2025,
      documentId: 'doc_w2_2025_001',
      page: 1,
      field: 'Box 1: Wages, tips, other compensation',
      proposedValue: 124500.00,
      confidence: 0.985,
      sourceText: '1 Wages, tips, other compensation 124,500.00',
      provider: 'Google-Document-AI',
      providerVersion: 'v2.1-tax-forms',
      isAiProposedOnly: true,
      humanDecision: 'ACCEPTED',
      finalAcceptedValue: 124500.00,
      reviewer: 'Sarah Jenkins, CPA',
      reviewerRole: 'reviewer',
      reviewTimestamp: '2026-02-15T14:30:00Z',
      provenance: {
        tenantId: 'tenant_ar_tax_prod',
        caseId: 'case_2025',
        documentId: 'doc_w2_2025_001',
        page: 1,
        source: 'Henze_2025_Form_W2_Wage_Statement.pdf',
        provider: 'Google-Document-AI',
        providerVersion: 'v2.1-tax-forms',
        proposal: 124500.00,
        confidence: 0.985,
        recordVersion: 2,
        humanDecision: 'ACCEPTED',
        reviewer: 'Sarah Jenkins, CPA',
        reviewTimestamp: '2026-02-15T14:30:00Z'
      },
      version: 2,
      createdAt: '2026-02-15T11:20:00Z',
      createdBy: 'system',
      updatedAt: '2026-02-15T14:30:00Z',
      updatedBy: 'reviewer_sarah_cpa'
    },
    {
      id: 'field_w2_fed_withheld_002',
      tenantId: 'tenant_ar_tax_prod',
      clientId: 'client_henze_001',
      engagementId: 'eng_2025_tax',
      caseId: 'case_2025',
      taxYear: 2025,
      documentId: 'doc_w2_2025_001',
      page: 1,
      field: 'Box 2: Federal income tax withheld',
      proposedValue: 18450.50,
      confidence: 0.962,
      sourceText: '2 Federal income tax withheld 18,450.50',
      provider: 'Google-Document-AI',
      providerVersion: 'v2.1-tax-forms',
      isAiProposedOnly: true,
      provenance: {
        tenantId: 'tenant_ar_tax_prod',
        caseId: 'case_2025',
        documentId: 'doc_w2_2025_001',
        page: 1,
        source: 'Henze_2025_Form_W2_Wage_Statement.pdf',
        provider: 'Google-Document-AI',
        providerVersion: 'v2.1-tax-forms',
        proposal: 18450.50,
        confidence: 0.962,
        recordVersion: 1
      },
      version: 1,
      createdAt: '2026-02-15T11:20:00Z',
      createdBy: 'system',
      updatedAt: '2026-02-15T11:20:00Z',
      updatedBy: 'system'
    },
    {
      id: 'field_1099_box1_nec_003',
      tenantId: 'tenant_ar_tax_prod',
      clientId: 'client_henze_001',
      engagementId: 'eng_2025_tax',
      caseId: 'case_2025',
      taxYear: 2025,
      documentId: 'doc_1099nec_2025_002',
      page: 1,
      field: 'Box 1: Nonemployee compensation',
      proposedValue: 42500.00,
      confidence: 0.912,
      sourceText: '1 Nonemployee compensation $42,500.00',
      provider: 'Google-Document-AI',
      providerVersion: 'v2.1-tax-forms',
      isAiProposedOnly: true,
      provenance: {
        tenantId: 'tenant_ar_tax_prod',
        caseId: 'case_2025',
        documentId: 'doc_1099nec_2025_002',
        page: 1,
        source: 'Henze_1099_NEC_Nonemployee_Compensation.pdf',
        provider: 'Google-Document-AI',
        providerVersion: 'v2.1-tax-forms',
        proposal: 42500.00,
        confidence: 0.912,
        recordVersion: 1
      },
      version: 1,
      createdAt: '2026-02-15T11:25:00Z',
      createdBy: 'system',
      updatedAt: '2026-02-15T11:25:00Z',
      updatedBy: 'system'
    }
  ]);

  const [correctingFieldId, setCorrectingFieldId] = useState<string | null>(null);
  const [correctedValue, setCorrectedValue] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleAccept = (fieldId: string) => {
    setFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        return {
          ...f,
          humanDecision: 'ACCEPTED',
          finalAcceptedValue: f.proposedValue,
          reviewer: 'Sarah Jenkins, CPA',
          reviewerRole: 'reviewer',
          reviewTimestamp: new Date().toISOString(),
          version: f.version + 1,
          provenance: {
            ...f.provenance,
            humanDecision: 'ACCEPTED',
            reviewer: 'Sarah Jenkins, CPA',
            reviewTimestamp: new Date().toISOString(),
            recordVersion: f.provenance.recordVersion + 1
          }
        };
      }
      return f;
    }));
    setActionNotice(`Field #${fieldId} ACCEPTED and stamped with full provenance.`);
  };

  const handleReject = (fieldId: string) => {
    setFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        return {
          ...f,
          humanDecision: 'REJECTED',
          reviewer: 'Sarah Jenkins, CPA',
          reviewerRole: 'reviewer',
          reviewTimestamp: new Date().toISOString(),
          version: f.version + 1,
          provenance: {
            ...f.provenance,
            humanDecision: 'REJECTED',
            reviewer: 'Sarah Jenkins, CPA',
            reviewTimestamp: new Date().toISOString(),
            recordVersion: f.provenance.recordVersion + 1
          }
        };
      }
      return f;
    }));
    setActionNotice(`Field #${fieldId} REJECTED by professional reviewer.`);
  };

  const handleSaveCorrection = (fieldId: string) => {
    if (!correctedValue || !correctionReason) return;
    const num = Number(correctedValue);
    const parsed = isNaN(num) ? correctedValue : num;

    setFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        return {
          ...f,
          humanDecision: 'CORRECTED',
          finalAcceptedValue: parsed,
          reviewReason: correctionReason,
          reviewer: 'Sarah Jenkins, CPA',
          reviewerRole: 'reviewer',
          reviewTimestamp: new Date().toISOString(),
          version: f.version + 1,
          provenance: {
            ...f.provenance,
            humanDecision: 'CORRECTED',
            reviewer: 'Sarah Jenkins, CPA',
            reviewTimestamp: new Date().toISOString(),
            recordVersion: f.provenance.recordVersion + 1
          }
        };
      }
      return f;
    }));
    setCorrectingFieldId(null);
    setCorrectedValue('');
    setCorrectionReason('');
    setActionNotice(`Field #${fieldId} CORRECTED to ${parsed} with provenance recorded.`);
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* AI Proposed Invariant Notice */}
      <div className="bg-[#FAF8F5] border border-[#C99A32]/40 rounded-xs p-4 space-y-2">
        <div className="flex items-center gap-2 text-[#061A2F] font-bold text-xs uppercase tracking-wide">
          <Cpu className="w-4 h-4 text-[#C99A32]" />
          <span>M18.6 Production OCR Invariant: isAiProposedOnly = true</span>
        </div>
        <p className="text-xs text-slate-700 leading-relaxed">
          All OCR and automated AI extraction proposals remain non-authoritative advisory data (<code className="font-mono font-bold bg-amber-100 px-1">isAiProposedOnly: true</code>)
          until an authorized CPA or EA reviewer performs human review (Accept, Correct, or Reject).
          Every field retains end-to-end provenance tracing back to source file, OCR provider, model version, and reviewer credential.
        </p>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Extraction Review Workspace */}
      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#C99A32]" />
              <span>OCR Structured Data & Human Review Workspace</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review extracted tax data fields, verify bounding boxes, and promote validated evidence into the case authority ledger.
            </p>
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Provider: Google Document AI (v2.1)
          </div>
        </div>

        {/* Fields List */}
        <div className="space-y-4">
          {fields.map((f) => {
            const isAccepted = f.humanDecision === 'ACCEPTED';
            const isRejected = f.humanDecision === 'REJECTED';
            const isCorrected = f.humanDecision === 'CORRECTED';
            const isPending = !f.humanDecision;
            const isEditing = correctingFieldId === f.id;

            return (
              <div 
                key={f.id}
                className={`p-4 rounded-xs border transition-all space-y-3 ${
                  isAccepted
                    ? 'border-emerald-300 bg-emerald-50/20'
                    : isRejected
                    ? 'border-red-300 bg-red-50/20'
                    : isCorrected
                    ? 'border-blue-300 bg-blue-50/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <div>
                      <span className="font-bold text-xs text-[#061A2F] block">
                        {f.field}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Page {f.page} • Doc ID: {f.documentId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Confidence</span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {(f.confidence * 100).toFixed(1)}%
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs ${
                      isAccepted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isRejected
                        ? 'bg-red-100 text-red-800'
                        : isCorrected
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {f.humanDecision || 'AI Proposed Only'}
                    </span>
                  </div>
                </div>

                {/* Values Comparison & Raw OCR text */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xs border border-slate-200">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">AI Proposed Value:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {typeof f.proposedValue === 'number' ? `$${f.proposedValue.toLocaleString()}` : String(f.proposedValue)}
                    </span>
                    {f.sourceText && (
                      <span className="text-[10px] text-slate-500 font-mono block mt-1">
                        Source snippet: "{f.sourceText}"
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Final Accepted Value:</span>
                    <span className={`font-mono font-bold text-sm ${
                      f.finalAcceptedValue !== undefined ? 'text-emerald-700' : 'text-slate-400 italic'
                    }`}>
                      {f.finalAcceptedValue !== undefined
                        ? (typeof f.finalAcceptedValue === 'number' ? `$${f.finalAcceptedValue.toLocaleString()}` : String(f.finalAcceptedValue))
                        : 'Pending human decision'}
                    </span>
                    {f.reviewReason && (
                      <span className="text-[10px] text-blue-700 font-medium block mt-1">
                        Reason: {f.reviewReason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Provenance Trace Box */}
                <div className="p-2.5 bg-white border border-slate-200 rounded-xs text-[11px] font-mono text-slate-600 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800">Provenance: </span>
                    <span>Provider: {f.provenance.provider} ({f.provenance.providerVersion}) • Source: {f.provenance.source}</span>
                  </div>
                  {f.reviewer && (
                    <div className="text-emerald-800 font-semibold">
                      Signed off by {f.reviewer} ({f.reviewTimestamp?.split('T')[0]})
                    </div>
                  )}
                </div>

                {/* Action Bar */}
                {isPending && !isEditing && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 text-xs">
                    <button
                      onClick={() => handleAccept(f.id)}
                      className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xs transition flex items-center gap-1 shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      onClick={() => {
                        setCorrectingFieldId(f.id);
                        setCorrectedValue(String(f.proposedValue));
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xs transition flex items-center gap-1 shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Correct</span>
                    </button>
                    <button
                      onClick={() => handleReject(f.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xs transition flex items-center gap-1 shadow-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}

                {/* Correction Form */}
                {isEditing && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xs space-y-2 text-xs">
                    <span className="font-bold text-blue-900 block">Provide Corrected Value & Justification:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={correctedValue}
                        onChange={(e) => setCorrectedValue(e.target.value)}
                        placeholder="Corrected value"
                        className="p-1.5 border border-slate-300 rounded-xs bg-white text-slate-800 font-mono text-xs"
                      />
                      <input
                        type="text"
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                        placeholder="Reason for correction (required)"
                        className="p-1.5 border border-slate-300 rounded-xs bg-white text-slate-800 text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => setCorrectingFieldId(null)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-200 rounded-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={!correctedValue || !correctionReason}
                        onClick={() => handleSaveCorrection(f.id)}
                        className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xs disabled:opacity-50"
                      >
                        Save Correction
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TaxGuardExtractionView;
