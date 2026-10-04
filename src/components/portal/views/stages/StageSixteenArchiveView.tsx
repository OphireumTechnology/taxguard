/**
 * A/R Tax Services, LLC — Stage 16: Archive Workspace
 * Permanent Retention & Multi-Year Immutable Return Vault
 *
 * Implements:
 * - Configurable, jurisdiction-sensitive document retention schedules
 * - Active legal hold preservation controls
 * - Immutable Cryptographic SHA-256 Checksums
 * - Engagement Audit Packages & Tamper-Evident Manifests
 * - Multi-Year Direct Access to Official Transcripts & Filings
 */

import React, { useState } from 'react';
import {
  Archive,
  Lock,
  Download,
  ShieldCheck,
  Calendar,
  FileText,
  FileCheck,
  ArrowRight,
  Database,
  ExternalLink,
  History,
  ShieldAlert
} from 'lucide-react';

interface ArchivedReturnPackage {
  id: string;
  taxYear: number;
  returnType: string;
  filingDate: string;
  retentionScheduleYears: number;
  scheduledArchiveReviewDate: string;
  isLegalHoldActive: boolean;
  legalHoldReason?: string;
  fileSizeBytes: number;
  sha256Hash: string;
  retentionPolicyBasis: string;
  status: 'LOCKED_IMMUTABLE' | 'ARCHIVED';
  documents: Array<{
    name: string;
    type: string;
    size: string;
  }>;
}

interface StageSixteenArchiveViewProps {
  clientId: string;
  selectedTaxYear: number;
  onNavigateToStageSeventeen?: () => void;
}

export const StageSixteenArchiveView: React.FC<StageSixteenArchiveViewProps> = ({
  clientId,
  selectedTaxYear,
  onNavigateToStageSeventeen
}) => {
  const [archivedPackages] = useState<ArchivedReturnPackage[]>([
    {
      id: 'arch_ty2025',
      taxYear: 2025,
      returnType: 'Form 1040 & SC 1040 (Engagement Package)',
      filingDate: '2026-10-02T18:00:00Z',
      retentionScheduleYears: 7,
      scheduledArchiveReviewDate: '2033-10-15T00:00:00Z',
      isLegalHoldActive: false,
      fileSizeBytes: 1482090,
      sha256Hash: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      retentionPolicyBasis: 'Configurable firm practice policy (Default 7-year review horizon; subject to state rules & active legal holds)',
      status: 'LOCKED_IMMUTABLE',
      documents: [
        { name: 'Form 1040 Copy.pdf', type: 'Tax Return', size: '420 KB' },
        { name: 'Form SC1040 State Return.pdf', type: 'State Return', size: '280 KB' },
        { name: 'Form 8879 E-File Signature Authorization.pdf', type: 'Consent / Signature', size: '190 KB' },
        { name: 'Compiled Tax Workpapers & Lead Schedules.pdf', type: 'Workpapers', size: '592 KB' }
      ]
    },
    {
      id: 'arch_ty2024',
      taxYear: 2024,
      returnType: 'Form 1040 & SC 1040 (Prior Year Archive)',
      filingDate: '2025-04-12T14:30:00Z',
      retentionScheduleYears: 7,
      scheduledArchiveReviewDate: '2032-04-15T00:00:00Z',
      isLegalHoldActive: true,
      legalHoldReason: 'Notice response administrative inquiry pending (routine statutory record preservation)',
      fileSizeBytes: 1210400,
      sha256Hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
      retentionPolicyBasis: 'Configurable firm practice policy (Active Legal Hold: Purge prevention enforced)',
      status: 'LOCKED_IMMUTABLE',
      documents: [
        { name: 'TY2024 Form 1040 Final.pdf', type: 'Tax Return', size: '390 KB' },
        { name: 'TY2024 SC1040 Final.pdf', type: 'State Return', size: '250 KB' },
        { name: 'TY2024 Form 8879 Signed.pdf', type: 'Consent / Signature', size: '180 KB' },
        { name: 'TY2024 Workpaper Dossier.pdf', type: 'Workpapers', size: '390 KB' }
      ]
    }
  ]);

  const [selectedPackageId, setSelectedPackageId] = useState<string>('arch_ty2025');
  const activePackage = archivedPackages.find(p => p.id === selectedPackageId) || archivedPackages[0];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6" id="stage-16-archive-workspace">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 16 of 18 · Archive
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <Archive className="w-5 h-5 text-[#D4A843]" />
              <span>Multi-Year Tax Return &amp; Evidence Vault</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-300">
              Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong>
            </span>
            {onNavigateToStageSeventeen && (
              <button
                type="button"
                onClick={onNavigateToStageSeventeen}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <span>Advance to Stage 17 (Renew)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 16: Multi-year archive preserving finalized returns and supporting evidence according to firm retention schedules.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Download copies of filed returns and workpapers or request historical engagement packages whenever needed.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Maintaining encrypted SHA-256 tamper-evident records adhering to applicable professional standards and legal hold requirements.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Stage 17 (Renew) prepares roll-forward data and early discovery for the upcoming tax season.</p>
          </div>
        </div>
      </div>

      {/* Archive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Multi-Year Packages */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 px-1">
            Sealed Engagement Packages ({archivedPackages.length})
          </h2>
          <div className="space-y-2">
            {archivedPackages.map((pkg) => {
              const isSelected = pkg.id === selectedPackageId;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedPackageId(pkg.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#0D2745] border-[#D4A843] shadow-md ring-1 ring-[#D4A843]/40'
                      : 'bg-[#071A2E] border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span className="text-[#D4A843] font-bold">Tax Year {pkg.taxYear}</span>
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <Lock className="w-3 h-3" />
                      <span>{pkg.status}</span>
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white line-clamp-1">{pkg.returnType}</h3>
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                    <span>Filed: {new Date(pkg.filingDate).toLocaleDateString()}</span>
                    <span className="font-mono">{(pkg.fileSizeBytes / 1024).toFixed(0)} KB</span>
                  </div>
                  {pkg.isLegalHoldActive && (
                    <div className="mt-2 text-[10px] font-mono text-amber-400 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 shrink-0" />
                      <span>Legal Hold Active</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Package Details & Document Manifest */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                  {activePackage.status}
                </span>
                <h2 className="text-lg font-bold text-white mt-1">Tax Year {activePackage.taxYear} Engagement Vault</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{activePackage.retentionPolicyBasis}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => alert(`Exporting engagement vault package for Tax Year ${activePackage.taxYear}.`)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#071A2E] text-slate-200 border border-slate-700 hover:text-white hover:border-slate-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#D4A843]" />
                  <span>Export Vault Bundle</span>
                </button>
              </div>
            </div>

            {/* Cryptographic Manifest Card */}
            <div className="p-4 bg-[#071A2E] rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="text-[10px] text-[#D4A843] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Retention Policy &amp; Cryptographic Manifest</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Filing Timestamp:</span>
                  <span className="text-white">{new Date(activePackage.filingDate).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Scheduled Retention Review:</span>
                  <span className="text-emerald-400 font-semibold">{new Date(activePackage.scheduledArchiveReviewDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Retention Schedule Horizon:</span>
                  <span className="text-white font-semibold">{activePackage.retentionScheduleYears} Years (Configurable)</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Legal Hold Status:</span>
                  <span className={activePackage.isLegalHoldActive ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                    {activePackage.isLegalHoldActive ? `ACTIVE: ${activePackage.legalHoldReason || 'Under Hold'}` : 'None (Standard Schedule)'}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 block">Package SHA-256 Digest:</span>
                  <span className="text-emerald-400 font-mono text-[10px] break-all">{activePackage.sha256Hash}</span>
                </div>
              </div>
            </div>

            {/* Encapsulated Documents */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Sealed Artifacts in Container ({activePackage.documents.length})
              </h3>
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-[#071A2E]">
                {activePackage.documents.map((doc, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between text-xs hover:bg-[#0A2544]/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <FileCheck className="w-4 h-4 text-[#D4A843]" />
                      <div>
                        <div className="font-semibold text-white">{doc.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{doc.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-400 text-[11px]">{doc.size}</span>
                      <button
                        type="button"
                        onClick={() => alert(`Simulated download of ${doc.name}`)}
                        className="text-[11px] font-bold text-[#D4A843] hover:underline cursor-pointer"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

