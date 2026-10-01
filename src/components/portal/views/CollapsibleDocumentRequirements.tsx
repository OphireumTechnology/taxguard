/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Collapsible Document Requirements Component
 *
 * Implements:
 * - Section 11 & Section 55: Collapsible document requirements organized by clean category:
 *   Federal Documents, State Documents, Prior-Year Returns, Business/Accounting Records, Accountant Requests
 * - Section 12: Only shows applicable requirements based on questionnaire answers
 * - Section 14: Clear explanations answering "What is this?", "Why do we need it?", "Where can I get it?"
 * - Section 15 & 59: Requirement-to-document binding and direct upload action
 * - Section 56: Clear client status language (Missing, Uploaded, Under Review, Accepted)
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  HelpCircle,
  Building2,
  FileCheck,
  FolderLock,
  PlusCircle,
  Info
} from 'lucide-react';
import {
  TaxDocumentRequirementItem,
  TaxDocumentRequirementEngine
} from '../../../services/taxDocumentRequirementEngine';
import { StageTwoUploadedDocument } from '../../../services/stageTwoCollectionService';

interface CollapsibleDocumentRequirementsProps {
  clientId: string;
  selectedTaxYear: number;
  uploadedDocs: StageTwoUploadedDocument[];
  onUploadForRequirement: (requirement: TaxDocumentRequirementItem) => void;
  onOpenQuestionnaire?: () => void;
}

export const CollapsibleDocumentRequirements: React.FC<CollapsibleDocumentRequirementsProps> = ({
  clientId,
  selectedTaxYear,
  uploadedDocs,
  onUploadForRequirement,
  onOpenQuestionnaire
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'Federal Documents': true,
    'State Documents': true,
    'Prior-Year Tax Records': true,
    'Business / Accounting Records': false,
    'Additional Accountant Requests': true
  });

  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
  };

  const evaluation = TaxDocumentRequirementEngine.evaluateMissingDocuments({
    clientId,
    taxYear: selectedTaxYear,
    uploadedDocs: uploadedDocs.map(d => ({
      id: d.documentId,
      associatedRequirementId: d.associatedRequirementId,
      claimedCategory: d.claimedCategory,
      status: d.processingStatus,
      isVerified: d.isVerified
    }))
  });

  const categories = evaluation.categories;

  const categoryOrder: Array<TaxDocumentRequirementItem['category']> = [
    'Federal Documents',
    'State Documents',
    'Prior-Year Tax Records',
    'Business / Accounting Records',
    'Additional Accountant Requests'
  ];

  return (
    <div className="space-y-4" id="collapsible-document-requirements">
      {/* Header bar */}
      <div className="rounded-2xl bg-[#0D2745] border border-slate-700/60 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="text-[10px] font-mono uppercase text-[#D4A843] font-bold">
            Tax Year {selectedTaxYear} Checklist
          </div>
          <h2 className="text-xl font-bold text-[#F8FAFC] flex items-center gap-2 mt-0.5">
            <FileText className="w-5 h-5 text-[#D4A843]" />
            <span>Required Documents &amp; Evidence</span>
          </h2>
          <p className="text-xs text-[#A9B7C8] mt-1 max-w-xl">
            Derived dynamically from your profile, jurisdictions, and guided discovery answers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#06182B] border border-slate-700/80 px-4 py-2 rounded-xl text-xs font-mono">
            <span className="text-[#A9B7C8]">Status: </span>
            <strong className="text-[#D4A843]">
              {evaluation.receivedCount} of {evaluation.totalRequirements} Resolved
            </strong>
          </div>

          {onOpenQuestionnaire && (
            <button
              type="button"
              onClick={onOpenQuestionnaire}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#F8FAFC] bg-[#102D4F] hover:bg-[#153a66] border border-slate-700 transition-colors cursor-pointer"
            >
              Update Tax Answers
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Categories */}
      <div className="space-y-3">
        {categoryOrder.map((catKey) => {
          const catData = categories[catKey];
          if (!catData || catData.items.length === 0) return null;

          const isExpanded = expandedCategories[catKey] ?? true;

          return (
            <div
              key={catKey}
              className="rounded-2xl bg-[#0D2745] border border-slate-700/60 overflow-hidden shadow-lg transition-all"
            >
              {/* Category Header (Click to expand) */}
              <button
                type="button"
                onClick={() => toggleCategory(catKey)}
                className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left hover:bg-[#102D4F]/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-[#06182B] border border-slate-700 text-[#D4A843] shrink-0">
                    {catKey === 'Federal Documents' ? (
                      <Building2 className="w-4 h-4" />
                    ) : catKey === 'State Documents' ? (
                      <FileCheck className="w-4 h-4" />
                    ) : catKey === 'Prior-Year Tax Records' ? (
                      <FolderLock className="w-4 h-4" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#F8FAFC]">
                      {catKey}
                    </h3>
                    <div className="text-xs text-[#A9B7C8] font-mono mt-0.5">
                      {catData.received} of {catData.required} resolved &bull; {catData.missing} missing
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    catData.missing === 0
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-950 text-amber-300 border border-amber-600/40'
                  }`}>
                    {catData.missing === 0 ? '✓ Complete' : `${catData.missing} Missing`}
                  </span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[#A9B7C8]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#A9B7C8]" />
                  )}
                </div>
              </button>

              {/* Requirement Items (When expanded) */}
              {isExpanded && (
                <div className="p-4 pt-0 sm:p-5 sm:pt-0 space-y-2.5 border-t border-slate-700/40">
                  {catData.items.map((req) => {
                    const isSatisfied = req.status === 'Uploaded';
                    const isDetailsOpen = expandedDetailsId === req.id;

                    return (
                      <div
                        key={req.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isSatisfied
                            ? 'bg-[#06182B]/60 border-emerald-500/30'
                            : 'bg-[#06182B] border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="mt-0.5 shrink-0">
                              {isSatisfied ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <Clock className="w-5 h-5 text-amber-400" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-sm text-[#F8FAFC]">
                                  {req.title}
                                </h4>
                                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-bold bg-[#102D4F] text-[#D4A843] border border-slate-700">
                                  {req.formNumber}
                                </span>
                                <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-bold ${
                                  isSatisfied
                                    ? 'bg-emerald-950 text-emerald-300'
                                    : 'bg-amber-950 text-amber-300'
                                }`}>
                                  {isSatisfied ? 'Received' : 'Missing'}
                                </span>
                              </div>

                              <p className="text-xs text-[#A9B7C8] mt-1">
                                {req.description}
                              </p>

                              <div className="flex items-center gap-3 mt-2 text-[11px] text-[#A9B7C8] font-mono">
                                <span>Jurisdiction: <strong>{req.jurisdiction}</strong></span>
                                <span>&bull;</span>
                                <span>Authority: <strong>{req.authority}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedDetailsId(isDetailsOpen ? null : req.id)}
                                  className="text-[#D4A843] hover:underline flex items-center gap-1 cursor-pointer font-sans"
                                >
                                  <Info className="w-3 h-3" />
                                  <span>{isDetailsOpen ? 'Hide Explanations' : 'Why do we need this?'}</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Upload Action */}
                          <div className="shrink-0 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => onUploadForRequirement(req)}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm ${
                                isSatisfied
                                  ? 'bg-[#102D4F] text-[#F8FAFC] hover:bg-[#153a66] border border-slate-700'
                                  : 'bg-[#D4A843] text-[#06182B] hover:bg-[#E1BB60]'
                              }`}
                            >
                              <UploadCloud className="w-3.5 h-3.5" />
                              <span>{isSatisfied ? 'Upload Additional Page' : 'Upload Document'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Section 14: Clear Explanations (What is this, Why do we need it, Where to get it) */}
                        {isDetailsOpen && (
                          <div className="mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-[#0D2745] p-3.5 rounded-xl">
                            <div>
                              <div className="font-bold text-[#F8FAFC] text-[11px] uppercase tracking-wider font-mono text-[#D4A843]">
                                What is this?
                              </div>
                              <p className="text-[#A9B7C8] mt-1 leading-relaxed">
                                {req.whatIsThis}
                              </p>
                            </div>
                            <div>
                              <div className="font-bold text-[#F8FAFC] text-[11px] uppercase tracking-wider font-mono text-[#D4A843]">
                                Why do we need it?
                              </div>
                              <p className="text-[#A9B7C8] mt-1 leading-relaxed">
                                {req.whyDoWeNeedIt}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono block mt-1">
                                Basis: {req.statutoryBasis}
                              </span>
                            </div>
                            <div>
                              <div className="font-bold text-[#F8FAFC] text-[11px] uppercase tracking-wider font-mono text-[#D4A843]">
                                Where can I get it?
                              </div>
                              <p className="text-[#A9B7C8] mt-1 leading-relaxed">
                                {req.whereCanIGetIt}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
