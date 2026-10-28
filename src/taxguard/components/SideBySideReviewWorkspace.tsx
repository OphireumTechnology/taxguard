/**
 * TaxGuard AI – Side-by-Side Professional Review & Provenance Workspace
 * Displays source document page with highlighted bounding boxes, raw extracted values,
 * normalized workpaper figures, prior-year delta, and Maker-Checker approval invalidation gates.
 */

import React, { useState } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  ZoomIn, 
  ZoomOut, 
  ShieldCheck, 
  ShieldAlert, 
  CornerUpLeft, 
  Edit3, 
  HelpCircle,
  MessageSquare,
  Lock,
  Sparkles,
  Layers,
  Clock
} from 'lucide-react';
import { TaxGuardAuditService } from '../services/TaxGuardAuditService';

export interface BoundingBoxReviewField {
  id: string;
  fieldName: string;
  taxFormTarget: string; // e.g. Form 1120-S Line 1a
  sourceDocName: string;
  sourcePage: number;
  boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number };
  extractedRawValue: string;
  normalizedValue: number;
  workpaperValue: number;
  priorYearValue: number;
  variancePercentage: number;
  confidence: number;
  provenanceModel: string;
  reviewStatus: 'Pending Review' | 'Approved' | 'Corrected' | 'Rejected' | 'Evidence Requested';
  preparerNotes?: string;
  reviewerNotes?: string;
  lastApprovedBy?: string;
  version: number;
}

const INITIAL_REVIEW_FIELDS: BoundingBoxReviewField[] = [
  {
    id: 'fld_rev_001',
    fieldName: 'Gross Receipts or Sales',
    taxFormTarget: 'Form 1120-S, Line 1a',
    sourceDocName: '2024_General_Ledger_Revenue_Summary.pdf',
    sourcePage: 1,
    boundingBox: { ymin: 140, xmin: 65, ymax: 180, xmax: 320 },
    extractedRawValue: '$ 1,482,910.45',
    normalizedValue: 1482910,
    workpaperValue: 1482910,
    priorYearValue: 1290400,
    variancePercentage: 14.9,
    confidence: 0.98,
    provenanceModel: 'Google Doc AI v2.4 Enterprise + TaxGuard Parser',
    reviewStatus: 'Approved',
    reviewerNotes: 'Reconciled to Form 1099-K and Merchant Bank Settlement Statements.',
    lastApprovedBy: 'Elena Rostova, CPA',
    version: 1
  },
  {
    id: 'fld_rev_002',
    fieldName: 'Officer Compensation (W-2 Wages)',
    taxFormTarget: 'Form 1120-S, Line 7',
    sourceDocName: '2024_Form_941_Quarterly_Return_Q4.pdf',
    sourcePage: 2,
    boundingBox: { ymin: 240, xmin: 80, ymax: 275, xmax: 290 },
    extractedRawValue: '$ 115,000.00',
    normalizedValue: 115000,
    workpaperValue: 115000,
    priorYearValue: 110000,
    variancePercentage: 4.5,
    confidence: 0.99,
    provenanceModel: 'Google Doc AI v2.4 Enterprise + TaxGuard Parser',
    reviewStatus: 'Approved',
    reviewerNotes: 'Supported by 2024 Form W-2 Box 1 and Section 199A reasonable comp study.',
    lastApprovedBy: 'Elena Rostova, CPA',
    version: 1
  },
  {
    id: 'fld_rev_003',
    fieldName: 'Depreciation & Section 179 Expense',
    taxFormTarget: 'Form 1120-S, Line 14 (Form 4562)',
    sourceDocName: '2024_Fixed_Asset_Additions_Invoice_Batch.pdf',
    sourcePage: 1,
    boundingBox: { ymin: 360, xmin: 50, ymax: 410, xmax: 310 },
    extractedRawValue: '$ 173,731.00',
    normalizedValue: 173731,
    workpaperValue: 173731,
    priorYearValue: 94200,
    variancePercentage: 84.4,
    confidence: 0.92,
    provenanceModel: 'Google Doc AI v2.4 Enterprise + TaxGuard Parser',
    reviewStatus: 'Pending Review',
    preparerNotes: 'Significant variance due to new Mini Excavator ($118.5k) and Ford F-250 ($68.4k).',
    version: 1
  },
  {
    id: 'fld_rev_004',
    fieldName: 'Taxes and Licenses (SC DOR & County Property Tax)',
    taxFormTarget: 'Form 1120-S, Line 12',
    sourceDocName: 'Richland_County_Property_Tax_Receipt.pdf',
    sourcePage: 1,
    boundingBox: { ymin: 480, xmin: 70, ymax: 520, xmax: 330 },
    extractedRawValue: '$ 24,180.00',
    normalizedValue: 24180,
    workpaperValue: 24180,
    priorYearValue: 22600,
    variancePercentage: 7.0,
    confidence: 0.95,
    provenanceModel: 'Google Doc AI v2.4 Enterprise + TaxGuard Parser',
    reviewStatus: 'Pending Review',
    version: 1
  }
];

export const SideBySideReviewWorkspace: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [fields, setFields] = useState<BoundingBoxReviewField[]>(INITIAL_REVIEW_FIELDS);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('fld_rev_003');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [overrideValue, setOverrideValue] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [showOverrideModal, setShowOverrideModal] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const selectedField = fields.find(f => f.id === selectedFieldId) || fields[0];

  // Professional Reviewer: Approve
  const handleApprove = (fieldId: string) => {
    setFields(prev => prev.map(f => {
      if (f.id === fieldId) {
        TaxGuardAuditService.logEvent({
          tenantId: 'tenant_ar_tax_prod',
          userId: userRole,
          userEmail: `${userRole}@artaxservices.com`,
          userRole,
          action: 'EVIDENCE_FIELD_APPROVED',
          recordType: 'workpaper',
          recordId: fieldId,
          ipAddress: '127.0.0.1 (authenticated)',
          result: 'success',
          riskLevel: 'material',
          details: `Approved field "${f.fieldName}" ($${f.workpaperValue.toLocaleString()}) against source document ${f.sourceDocName}`
        });
        return {
          ...f,
          reviewStatus: 'Approved',
          lastApprovedBy: 'Elena Rostova, CPA'
        };
      }
      return f;
    }));
    setActionNotice({ type: 'success', message: `Certified "${selectedField.fieldName}" and locked to workpaper.` });
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Material Correction Handler: Automatic Invalidation of Previous Approvals
  const handleApplyCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(overrideValue);
    if (isNaN(parsed)) return;

    setFields(prev => prev.map(f => {
      if (f.id === selectedField.id) {
        const wasApproved = f.reviewStatus === 'Approved';

        // Log Invalidation Audit Event if previously approved
        if (wasApproved) {
          TaxGuardAuditService.logEvent({
            tenantId: 'tenant_ar_tax_prod',
            userId: userRole,
            userEmail: `${userRole}@artaxservices.com`,
            userRole,
            action: 'MATERIAL_CHANGE_INVALIDATED_APPROVAL',
            recordType: 'engagement',
            recordId: 'eng_2025_perotti',
            ipAddress: '127.0.0.1 (authenticated)',
            result: 'success',
            riskLevel: 'critical',
            details: `Material override on "${f.fieldName}" from $${f.workpaperValue.toLocaleString()} to $${parsed.toLocaleString()} INVALIDATED former approval by ${f.lastApprovedBy || 'Reviewer'}. Reason: ${overrideReason}`
          });
        }

        return {
          ...f,
          workpaperValue: parsed,
          reviewStatus: 'Corrected', // Drops back to review requirement
          version: f.version + 1,
          reviewerNotes: `Manual correction by ${userRole}: ${overrideReason}`,
          lastApprovedBy: undefined // Cleared due to invalidation
        };
      }
      return f;
    }));

    setShowOverrideModal(false);
    setOverrideValue('');
    setOverrideReason('');
    setActionNotice({ 
      type: 'warning', 
      message: `Material override applied. Any prior CPA approval was invalidated and returned to review status (v${selectedField.version + 1}).` 
    });
    setTimeout(() => setActionNotice(null), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="border border-neutral-300 bg-white p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
          <div>
            <div className="text-[10px] font-mono uppercase text-[#C99A32] font-bold tracking-wider">
              A/R Tax Services, LLC • Maker-Checker Provenance Engine
            </div>
            <h2 className="text-base font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#061A2F]" />
              <span>Side-by-Side Professional Review &amp; Provenance Workspace</span>
            </h2>
            <p className="text-xs text-neutral-600 mt-0.5">
              Grounds return line items to physical document coordinates. Material changes automatically invalidate previous sign-offs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-neutral-100 border border-neutral-300 text-neutral-800 text-[11px] font-mono">
              Perotti Holdings, LLC • Form 1120-S
            </span>
          </div>
        </div>

        {actionNotice && (
          <div className={`p-3 text-xs font-semibold flex items-center gap-2 border ${
            actionNotice.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : actionNotice.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            {actionNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
            <span>{actionNotice.message}</span>
          </div>
        )}
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Physical Document Viewer with Bounding Box Overlay */}
        <div className="lg:col-span-6 border border-neutral-300 bg-white p-4 space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-neutral-600" />
              <span className="text-xs font-bold text-neutral-900 truncate max-w-[240px]">
                {selectedField.sourceDocName}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 font-mono text-neutral-600">
                Pg {selectedField.sourcePage}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setZoomLevel(prev => Math.max(75, prev - 15))}
                className="p-1 hover:bg-neutral-100 border border-neutral-200 text-neutral-600"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono px-1.5">{zoomLevel}%</span>
              <button 
                onClick={() => setZoomLevel(prev => Math.min(150, prev + 15))}
                className="p-1 hover:bg-neutral-100 border border-neutral-200 text-neutral-600"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Document Canvas Simulator with Bounding Box */}
          <div className="relative bg-neutral-900 border border-neutral-300 min-h-[460px] flex-1 flex items-center justify-center p-4 overflow-hidden select-none">
            <div 
              className="relative bg-white shadow-2xl transition-transform duration-200"
              style={{
                width: '420px',
                height: '560px',
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'center center'
              }}
            >
              {/* Document Mock Sheet Header */}
              <div className="p-4 border-b border-neutral-200">
                <div className="text-[9px] font-mono text-neutral-400 uppercase tracking-wider">
                  Internal Revenue Service • Tax Document Record
                </div>
                <div className="text-[11px] font-black text-neutral-900 uppercase">
                  {selectedField.sourceDocName.replace(/_/g, ' ')}
                </div>
                <div className="text-[8px] font-mono text-neutral-500">
                  Tax Year 2024 • Verified Substantive Copy
                </div>
              </div>

              {/* Document Text Simulator Lines */}
              <div className="p-4 space-y-3 text-[9px] text-neutral-600 font-mono">
                <div className="flex justify-between border-b border-neutral-100 pb-1">
                  <span>Line 1a Gross Receipts</span>
                  <span className="font-bold text-neutral-900">$1,482,910.45</span>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-1">
                  <span>Line 7 Officer Compensation</span>
                  <span className="font-bold text-neutral-900">$115,000.00</span>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-1">
                  <span>Line 14 Form 4562 Depreciation</span>
                  <span className="font-bold text-neutral-900">$173,731.00</span>
                </div>
                <div className="flex justify-between border-b border-neutral-100 pb-1">
                  <span>Line 12 Taxes and Licenses</span>
                  <span className="font-bold text-neutral-900">$24,180.00</span>
                </div>
                <div className="pt-8 text-[8px] text-neutral-400 space-y-1">
                  <div className="h-2 bg-neutral-100 rounded w-5/6"></div>
                  <div className="h-2 bg-neutral-100 rounded w-4/6"></div>
                  <div className="h-2 bg-neutral-100 rounded w-full"></div>
                  <div className="h-2 bg-neutral-100 rounded w-3/4"></div>
                </div>
              </div>

              {/* Live Highlighted Bounding Box Overlay */}
              <div 
                className="absolute border-2 border-emerald-600 bg-emerald-500/20 shadow-sm pointer-events-none transition-all duration-300 flex items-start justify-end p-1"
                style={{
                  top: `${selectedField.boundingBox.ymin}px`,
                  left: `${selectedField.boundingBox.xmin}px`,
                  height: `${selectedField.boundingBox.ymax - selectedField.boundingBox.ymin}px`,
                  width: `${selectedField.boundingBox.xmax - selectedField.boundingBox.xmin}px`
                }}
              >
                <span className="text-[8px] font-mono font-black uppercase tracking-wider bg-emerald-700 text-white px-1 py-0.5 rounded-xs">
                  OCR {(selectedField.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-neutral-500 font-mono flex items-center justify-between pt-1">
            <span>Model: {selectedField.provenanceModel}</span>
            <span>Box: [{selectedField.boundingBox.ymin}, {selectedField.boundingBox.xmin}, {selectedField.boundingBox.ymax}, {selectedField.boundingBox.xmax}]</span>
          </div>
        </div>

        {/* Right 6 Cols: Value Comparison, Diagnostics & Decision Gate */}
        <div className="lg:col-span-6 space-y-4">
          {/* Field Selection Carousel */}
          <div className="border border-neutral-300 bg-white p-4 space-y-2">
            <div className="text-[10px] font-mono uppercase text-neutral-500">Select Line Item to Inspect</div>
            <div className="grid grid-cols-2 gap-2">
              {fields.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFieldId(f.id)}
                  className={`p-2 text-left border text-xs transition-colors ${
                    selectedFieldId === f.id 
                      ? 'border-[#061A2F] bg-neutral-50 font-bold' 
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <div className="text-[11px] truncate text-neutral-900">{f.fieldName}</div>
                  <div className="text-[10px] font-mono text-neutral-500 flex justify-between mt-1">
                    <span>${f.workpaperValue.toLocaleString()}</span>
                    <span className={`font-semibold ${
                      f.reviewStatus === 'Approved' ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {f.reviewStatus}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Value Multi-Vector Comparison Matrix */}
          <div className="border border-neutral-300 bg-white p-5 space-y-4">
            <div className="border-b border-neutral-200 pb-3 flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#C99A32] font-bold">
                  {selectedField.taxFormTarget}
                </span>
                <h3 className="text-sm font-bold text-[#061A2F]">{selectedField.fieldName}</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 font-bold uppercase font-mono border ${
                selectedField.reviewStatus === 'Approved'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {selectedField.reviewStatus} (v{selectedField.version})
              </span>
            </div>

            {/* Metrics Comparison Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                <div className="text-[10px] uppercase font-mono text-neutral-500">Physical Extracted OCR</div>
                <div className="text-sm font-mono font-bold text-neutral-900">{selectedField.extractedRawValue}</div>
                <div className="text-[9px] text-neutral-400">Confidence: {(selectedField.confidence * 100).toFixed(1)}%</div>
              </div>
              <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                <div className="text-[10px] uppercase font-mono text-neutral-500">Normalized Value</div>
                <div className="text-sm font-mono font-bold text-neutral-900">${selectedField.normalizedValue.toLocaleString()}</div>
                <div className="text-[9px] text-neutral-400">Standard Currency</div>
              </div>
              <div className="p-2.5 bg-neutral-50 border border-neutral-200">
                <div className="text-[10px] uppercase font-mono text-neutral-500">Prior Year Value (TY23)</div>
                <div className="text-sm font-mono font-bold text-neutral-900">${selectedField.priorYearValue.toLocaleString()}</div>
                <div className="text-[9px] text-neutral-500">Variance: +{selectedField.variancePercentage}%</div>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-300">
                <div className="text-[10px] uppercase font-mono text-emerald-800 font-bold">Current Workpaper Value</div>
                <div className="text-sm font-mono font-black text-emerald-900">${selectedField.workpaperValue.toLocaleString()}</div>
                <div className="text-[9px] text-emerald-700">Ready for Form 1120-S Line Item</div>
              </div>
            </div>

            {/* Notes & Variance Warning */}
            {selectedField.variancePercentage > 25 && (
              <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Significant Prior-Year Variance ({selectedField.variancePercentage}%):</strong>{' '}
                  Requires affirmative reviewer explanation for audit defense.
                  {selectedField.preparerNotes && (
                    <div className="text-[11px] text-amber-800 font-mono mt-1">
                      Preparer: {selectedField.preparerNotes}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Reviewer Action Controls */}
            <div className="pt-2 border-t border-neutral-200 space-y-3">
              <div className="text-[11px] font-bold text-neutral-800 uppercase">Reviewer Decision Gate</div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleApprove(selectedField.id)}
                  className="py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve &amp; Certify Value</span>
                </button>

                <button
                  onClick={() => setShowOverrideModal(true)}
                  className="py-2 px-3 bg-white hover:bg-neutral-50 border border-neutral-400 text-neutral-800 text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Material Override</span>
                </button>
              </div>

              {selectedField.lastApprovedBy && (
                <div className="text-[10px] text-neutral-500 font-mono text-center">
                  Last Certified by {selectedField.lastApprovedBy} • Immutable version {selectedField.version}.0
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-300 max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-neutral-200 pb-3">
              <h3 className="text-sm font-bold text-[#061A2F] uppercase">Material Override &amp; Invalidation Warning</h3>
              <button onClick={() => setShowOverrideModal(false)} className="text-neutral-500 hover:text-black">✕</button>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Maker-Checker Compliance Rule:</strong> Applying a manual correction to an approved workpaper value immediately invalidates any prior CPA sign-off, drops the return back into review status, and logs a tamper-evident audit record.
              </div>
            </div>

            <form onSubmit={handleApplyCorrection} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-neutral-800">New Corrected Amount ($)</label>
                <input
                  type="number"
                  required
                  placeholder="168500"
                  value={overrideValue}
                  onChange={e => setOverrideValue(e.target.value)}
                  className="w-full p-2 border border-neutral-300 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-neutral-800">Professional Justification Reason</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Reclassified $5,231 personal mileage allocation per contemporaneous vehicle log."
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="w-full p-2 border border-neutral-300"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3 py-1.5 border border-neutral-300 text-neutral-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-700 text-white font-bold uppercase hover:bg-rose-800"
                >
                  Apply &amp; Invalidate Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
