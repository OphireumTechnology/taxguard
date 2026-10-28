/**
 * TaxGuard AI – Document Summarization (Client-Friendly & Professional Dual View)
 * Generates verified plain-language client overviews and in-depth statutory technical summaries
 * with mandatory disclaimers and inconsistency alerts.
 */

import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldAlert, 
  User, 
  Briefcase, 
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { TaxGuardDocumentSummary } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardSummariesView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [summaries] = useState<TaxGuardDocumentSummary[]>(() =>
    TaxGuardStorageService.getSummaries(userRole, userRole === 'client' ? 'client_henze_001' : undefined)
  );
  const [selectedSummary, setSelectedSummary] = useState<TaxGuardDocumentSummary | null>(summaries[0] || null);
  const [viewPerspective, setViewPerspective] = useState<'client' | 'professional'>(userRole === 'client' ? 'client' : 'professional');

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Header bar */}
      <div className="bg-white border border-[#D8DCE2] p-5 rounded-xs shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C99A32]" />
            <span>AI Document Intelligence & Statutory Summaries</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified key figure extractions, detected discrepancies, and IRC regulatory citations in dual audience views.
          </p>
        </div>

        {/* Perspective Toggle */}
        <div className="inline-flex rounded-xs border border-slate-300 p-0.5 bg-slate-50 text-xs">
          <button
            onClick={() => setViewPerspective('client')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xs font-semibold transition-colors ${
              viewPerspective === 'client' ? 'bg-[#061A2F] text-white shadow-xs' : 'text-slate-600 hover:text-[#061A2F]'
            }`}
          >
            <User className="w-3.5 h-3.5 text-[#C99A32]" />
            <span>Taxpayer / Client View</span>
          </button>
          <button
            onClick={() => setViewPerspective('professional')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xs font-semibold transition-colors ${
              viewPerspective === 'professional' ? 'bg-[#061A2F] text-white shadow-xs' : 'text-slate-600 hover:text-[#061A2F]'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-[#C99A32]" />
            <span>Practitioner Technical View</span>
          </button>
        </div>
      </div>

      {/* Mandatory Statutory Notice */}
      <div className="bg-amber-50 border border-amber-300 p-3 rounded-xs flex items-center gap-2.5 text-xs text-amber-900 font-medium">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          <strong>Statutory Compliance Notice:</strong> AI-generated summary – Requires verification before use in accounting records or tax filings. No figures are considered final until reviewed by a qualified preparer or CPA.
        </span>
      </div>

      {/* Main Grid: Document List & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Available Summaries ({summaries.length})
          </div>

          {summaries.map((s) => {
            const isSelected = selectedSummary?.id === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedSummary(s)}
                className={`p-4 rounded-xs border cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-white border-[#C99A32] shadow-sm ring-1 ring-[#C99A32]/40' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#C99A32] bg-[#061A2F] px-1.5 py-0.5 rounded-xs">
                      {s.documentCategory}
                    </span>
                    <h3 className="text-xs font-bold text-[#061A2F] mt-1.5 truncate max-w-[220px]">
                      {s.documentName}
                    </h3>
                    <div className="text-[11px] text-slate-500 mt-0.5">TY{s.taxYear} • {s.taxpayerName}</div>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {s.generatedAt.split('T')[0]}
                  </span>
                </div>

                {s.detectedInconsistencies.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-1 text-[11px] text-rose-700 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{s.detectedInconsistencies.length} alert flagged</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Summary Inspector */}
        <div className="lg:col-span-8">
          {selectedSummary ? (
            <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-6 space-y-6">
              {/* Header */}
              <div className="border-b border-slate-200 pb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#C99A32] bg-[#061A2F] px-2 py-0.5 rounded-xs">
                      {selectedSummary.documentCategory}
                    </span>
                    <span className="text-xs text-slate-500">Tax Year {selectedSummary.taxYear}</span>
                  </div>
                  <h2 className="text-base font-bold text-[#061A2F] mt-1.5">{selectedSummary.documentName}</h2>
                  <p className="text-xs text-slate-500">
                    Taxpayer: {selectedSummary.taxpayerName} • Issuer: {selectedSummary.issuerOrPayer}
                  </p>
                </div>

                <div className="text-right text-xs">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Extraction Confidence</span>
                  <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-xs border border-emerald-200">
                    {(selectedSummary.overallConfidence * 100).toFixed(0)}% Certified
                  </span>
                </div>
              </div>

              {/* VIEW SWITCH: CLIENT PERSPECTIVE */}
              {viewPerspective === 'client' ? (
                <div className="space-y-5">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xs">
                    <h3 className="text-xs font-bold text-[#061A2F] uppercase tracking-wide mb-1.5">
                      Plain-Language Document Summary
                    </h3>
                    <p className="text-xs text-slate-700 leading-relaxed">
                      {selectedSummary.clientFriendlySummary}
                    </p>
                  </div>

                  {/* Key Amounts for Client */}
                  <div>
                    <h3 className="text-xs font-bold text-[#061A2F] uppercase tracking-wider mb-2">
                      Key Reported Figures
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedSummary.keyAmounts.map((amt, idx) => (
                        <div key={idx} className="border border-slate-200 p-3 rounded-xs bg-white">
                          <span className="text-[11px] text-slate-500 block">{amt.label}</span>
                          <span className="text-sm font-mono font-bold text-slate-900 mt-0.5 block">{amt.formatted}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Items for Client */}
                  {selectedSummary.questionsForClient.length > 0 && (
                    <div className="border border-amber-200 bg-amber-50/50 p-4 rounded-xs text-xs space-y-2">
                      <span className="font-bold text-amber-900 block uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Action or Clarification Needed From Taxpayer</span>
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-amber-950">
                        {selectedSummary.questionsForClient.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                /* VIEW SWITCH: PRACTITIONER TECHNICAL PERSPECTIVE */
                <div className="space-y-6">
                  {/* Detailed technical summary */}
                  <div className="border border-slate-200 p-4 rounded-xs bg-slate-50 text-xs">
                    <span className="font-bold text-slate-700 block uppercase tracking-wide text-[10px] mb-1">
                      Statutory Technical Analysis
                    </span>
                    <p className="text-slate-700 leading-relaxed font-mono text-[11px]">
                      {selectedSummary.professionalTechnicalSummary}
                    </p>
                  </div>

                  {/* IRC Provisions & Potential Relationships */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-slate-200 p-3.5 rounded-xs bg-white text-xs">
                      <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px] mb-1">
                        Tax & Accounting Relationships
                      </span>
                      <ul className="list-disc list-inside space-y-1 mt-1 text-slate-600">
                        {selectedSummary.potentialTaxAccountingRelationships.map((rel, i) => (
                          <li key={i}>{rel}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="border border-slate-200 p-3.5 rounded-xs bg-white text-xs">
                      <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px] mb-1">
                        Reviewer Open Inquiries
                      </span>
                      <ul className="list-disc list-inside space-y-1 mt-1 text-slate-600">
                        {selectedSummary.questionsForProfessionalReview.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Inconsistencies & Missing Items */}
                  {(selectedSummary.detectedInconsistencies.length > 0 || selectedSummary.missingPagesOrFields.length > 0) && (
                    <div className="border border-rose-200 bg-rose-50/50 p-4 rounded-xs text-xs space-y-2">
                      <span className="font-bold text-rose-900 block uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                        <span>Detected Inconsistencies & Omissions</span>
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-rose-950 font-medium">
                        {selectedSummary.detectedInconsistencies.map((inc, i) => (
                          <li key={`inc-${i}`}>{inc}</li>
                        ))}
                        {selectedSummary.missingPagesOrFields.map((mis, i) => (
                          <li key={`mis-${i}`}>Missing: {mis}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xs p-12 text-center text-slate-400 text-xs">
              Select a document to inspect its AI summary and statutory citations.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
