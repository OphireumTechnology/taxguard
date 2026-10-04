/**
 * A/R Tax Services, LLC — Stage 07: Report Workspace
 * Statutory Financial Deliverables, Workpapers & Presentation Packages
 *
 * Implements:
 * - Compiled Financial Statements (Balance Sheet, Income Statement, Cash Flows)
 * - Supporting Tax Workpapers & Schedule Lead Sheets
 * - Depreciation & Amortization Schedules (Form 4562)
 * - CPA Compilation Engagement Sign-off & Delivery Manifest
 */

import React, { useState } from 'react';
import {
  FileCheck,
  FileSpreadsheet,
  Download,
  Calendar,
  Lock,
  ArrowRight,
  ShieldCheck,
  Building2,
  FileText,
  Printer,
  ExternalLink
} from 'lucide-react';

interface ReportDeliverable {
  id: string;
  category: 'FINANCIAL_STATEMENT' | 'TAX_WORKPAPER' | 'DEPRECIATION_SCHEDULE' | 'COMPILATION_LETTER';
  title: string;
  documentRef: string;
  generatedDate: string;
  certifiedBy: string;
  fileSizeBytes: number;
  status: 'DRAFT' | 'SEALED' | 'DELIVERED';
  sha256Hash: string;
}

interface StageSevenReportViewProps {
  clientId: string;
  selectedTaxYear: number;
  onNavigateToStageEight?: () => void;
}

export const StageSevenReportView: React.FC<StageSevenReportViewProps> = ({
  clientId,
  selectedTaxYear,
  onNavigateToStageEight
}) => {
  const [deliverables] = useState<ReportDeliverable[]>([
    {
      id: 'rep_001',
      category: 'FINANCIAL_STATEMENT',
      title: `${selectedTaxYear} Compiled Balance Sheet & Income Statement`,
      documentRef: `FS-${selectedTaxYear}-001.pdf`,
      generatedDate: '2026-10-02T16:00:00Z',
      certifiedBy: 'Elena Rostova, CPA',
      fileSizeBytes: 248190,
      status: 'SEALED',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    {
      id: 'rep_002',
      category: 'TAX_WORKPAPER',
      title: `${selectedTaxYear} Form 1040 Lead Schedules & Reconciliation Lead Sheets`,
      documentRef: `WP-1040-${selectedTaxYear}-FINAL.pdf`,
      generatedDate: '2026-10-02T16:15:00Z',
      certifiedBy: 'Elena Rostova, CPA',
      fileSizeBytes: 412950,
      status: 'SEALED',
      sha256Hash: 'cb44e4b38d38855e96684ef9b43376ae7c73fa73f0ee3e8958288e227e77ea9f'
    },
    {
      id: 'rep_003',
      category: 'DEPRECIATION_SCHEDULE',
      title: `${selectedTaxYear} MACRS & Section 179 Depreciation Workpapers`,
      documentRef: `DEP-SCH-${selectedTaxYear}.pdf`,
      generatedDate: '2026-10-02T16:20:00Z',
      certifiedBy: 'Desmond Hinds (Preparer)',
      fileSizeBytes: 189200,
      status: 'SEALED',
      sha256Hash: '4355a46b19d348dc2f57c046f8ef63d4538ebb936000f3c9ee954a27460dd865'
    },
    {
      id: 'rep_004',
      category: 'COMPILATION_LETTER',
      title: 'CPA Notice to Reader & Management Representation Statement',
      documentRef: `NTR-${selectedTaxYear}.pdf`,
      generatedDate: '2026-10-02T16:30:00Z',
      certifiedBy: 'Elena Rostova, CPA',
      fileSizeBytes: 114500,
      status: 'SEALED',
      sha256Hash: '7d793037a0760186574b0282f2f435e7b1e50774690f4504535acf35ff202ecd'
    }
  ]);

  const [selectedDocId, setSelectedDocId] = useState<string>('rep_001');
  const activeDoc = deliverables.find(d => d.id === selectedDocId) || deliverables[0];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6" id="stage-07-report-workspace">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 07 of 18 · Report
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <FileCheck className="w-5 h-5 text-[#D4A843]" />
              <span>Financial Deliverables &amp; Certified Tax Workpapers</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-300">
              Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong>
            </span>
            {onNavigateToStageEight && (
              <button
                type="button"
                onClick={onNavigateToStageEight}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <span>Advance to Stage 08 (Plan)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Core Client Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 07: Reviewing certified workpapers and financial statements ready for tax preparation.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Review your compiled financial packages. No client action required unless discrepancies are found.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Elena Rostova, CPA has compiled reconciliation workpapers into certified tax lead schedules.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Deliverables transfer to Stage 08 (Tax Planning) and Stage 09 (Form 1040 Tax Preparation).</p>
          </div>
        </div>
      </div>

      {/* Deliverables Overview & Document Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Deliverable List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 px-1">
            Available Deliverable Packages ({deliverables.length})
          </h2>
          <div className="space-y-2">
            {deliverables.map((item) => {
              const isSelected = item.id === selectedDocId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedDocId(item.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0D2745] border-[#D4A843] shadow-md ring-1 ring-[#D4A843]/40'
                      : 'bg-[#071A2E] border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>{item.category.replace('_', ' ')}</span>
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{item.status}</span>
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white line-clamp-1">{item.title}</h3>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>{item.documentRef}</span>
                    <span className="font-mono">{(item.fileSizeBytes / 1024).toFixed(0)} KB</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Deliverable Details & Verification Certificate */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#D4A843]/15 text-[#D4A843] border border-[#D4A843]/30">
                  {activeDoc.category}
                </span>
                <h2 className="text-lg font-bold text-white mt-1">{activeDoc.title}</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Reference: {activeDoc.documentRef}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert(`Simulated download of ${activeDoc.documentRef}`)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#071A2E] text-slate-200 border border-slate-700 hover:text-white hover:border-slate-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#D4A843]" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Statutory CPA Attestation Card */}
            <div className="p-4 bg-[#071A2E] rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="text-[10px] text-[#D4A843] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>CPA Compilation &amp; Practitioner Workpaper Record</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Certifying Practitioner:</span>
                  <span className="text-white font-semibold">{activeDoc.certifiedBy}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Certification Timestamp:</span>
                  <span className="text-white">{new Date(activeDoc.generatedDate).toLocaleString()}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block">Cryptographic Hash (SHA-256 Tamper-Evidence):</span>
                  <span className="text-emerald-400 font-mono text-[10px] break-all">{activeDoc.sha256Hash}</span>
                </div>
              </div>
            </div>

            {/* Document Content Preview Summary */}
            <div className="space-y-3 text-xs text-slate-300">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D4A843]" />
                <span>Executive Summary &amp; Accounting Basis</span>
              </h3>
              <p className="leading-relaxed text-slate-300">
                This schedule has been compiled in accordance with Statements on Standards for Accounting and Review Services (SSARS) issued by the AICPA.
                All accounts have been reconciled against primary source documents, 1099-DIV/INT/B reporting statements, and general ledger postings.
              </p>

              <div className="p-3.5 bg-[#06182B] rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Reconciliation Status:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span>Balanced &bull; Zero Out-of-Period Variances</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
