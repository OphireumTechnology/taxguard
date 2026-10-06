/**
 * A/R Tax Services, LLC - TaxGuard AI
 * "DOCUMENT CHECKLIST — [YEAR] Personalized for You"
 *
 * Implements:
 * - Section 13: Dynamic Document Requirement Engine presentation
 * - Section 14: Comprehensive Requirement States
 * - Section 15: Filterable, expandable checklist rows matching visual design target
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ShieldCheck,
  XCircle,
  FileCheck,
  Eye,
  Filter
} from 'lucide-react';
import { TaxDocumentRequirementItem } from '../../../services/taxDocumentRequirementEngine';

export interface DocumentChecklistSectionProps {
  taxYear: number;
  requirements: TaxDocumentRequirementItem[];
  matchedDocumentCounts?: Record<string, number>;
  onUploadForRequirement: (req: TaxDocumentRequirementItem) => void;
  onViewDocumentsForRequirement?: (req: TaxDocumentRequirementItem) => void;
  onMarkNotApplicable?: (req: TaxDocumentRequirementItem) => void;
  onOpenQuestionnaire?: () => void;
}

export type ChecklistFilter =
  | 'ALL'
  | 'REQUIRED'
  | 'RECEIVED'
  | 'MISSING'
  | 'UNDER_REVIEW'
  | 'REPLACEMENT_REQUIRED'
  | 'NOT_APPLICABLE';

export const DocumentChecklistSection: React.FC<DocumentChecklistSectionProps> = ({
  taxYear,
  requirements = [],
  matchedDocumentCounts = {},
  onUploadForRequirement,
  onViewDocumentsForRequirement,
  onMarkNotApplicable,
  onOpenQuestionnaire
}) => {
  const [activeFilter, setActiveFilter] = useState<ChecklistFilter>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const filteredRequirements = useMemo(() => {
    return requirements.filter((item) => {
      const isNotApplicable = item.applicability === 'NOT_APPLICABLE' || item.status === 'Complete';
      const isReceived = item.status === 'Accepted' || item.status === 'Uploaded';
      const isUnderReview = item.status === 'Under Review' || item.status === 'Processing';
      const isMissing = item.status === 'Missing' && !isNotApplicable;
      const isReplacement = item.status === 'Replace Required' || item.status === 'Needs Your Attention';

      switch (activeFilter) {
        case 'REQUIRED':
          return !isNotApplicable;
        case 'RECEIVED':
          return isReceived;
        case 'MISSING':
          return isMissing;
        case 'UNDER_REVIEW':
          return isUnderReview;
        case 'REPLACEMENT_REQUIRED':
          return isReplacement;
        case 'NOT_APPLICABLE':
          return isNotApplicable;
        case 'ALL':
        default:
          return true;
      }
    });
  }, [requirements, activeFilter]);

  const totalCount = requirements.length;
  const missingCount = requirements.filter(r => r.status === 'Missing' && r.applicability !== 'NOT_APPLICABLE').length;
  const receivedCount = requirements.filter(r => r.status === 'Accepted' || r.status === 'Uploaded').length;
  const underReviewCount = requirements.filter(r => r.status === 'Under Review' || r.status === 'Processing').length;
  const notApplicableCount = requirements.filter(r => r.applicability === 'NOT_APPLICABLE').length;

  const getStatusBadge = (item: TaxDocumentRequirementItem) => {
    if (item.applicability === 'NOT_APPLICABLE') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
          NOT APPLICABLE
        </span>
      );
    }
    if (item.status === 'Accepted') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>ACCEPTED</span>
        </span>
      );
    }
    if (item.status === 'Uploaded' || item.status === 'Under Review' || item.status === 'Processing') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-950 text-blue-300 border border-blue-500/40 flex items-center gap-1">
          <Clock className="w-3 h-3 text-blue-400" />
          <span>UNDER REVIEW</span>
        </span>
      );
    }
    if (item.status === 'Replace Required' || item.status === 'Needs Your Attention') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-950 text-red-300 border border-red-500/40 flex items-center gap-1">
          <AlertCircle className="w-3 h-3 text-red-400" />
          <span>REPLACEMENT REQUIRED</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950/60 text-amber-300 border border-amber-500/40 flex items-center gap-1">
        <Clock className="w-3 h-3 text-amber-400" />
        <span>MISSING</span>
      </span>
    );
  };

  return (
    <section
      aria-label={`Document Checklist for Tax Year ${taxYear}`}
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D4A843]/15 text-[#D4A843]">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                DOCUMENT CHECKLIST &mdash; {taxYear}
              </h2>
              <div className="text-[11px] text-[#D4A843] font-mono font-semibold">
                Personalized for You based on your tax facts
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Status:</span>
          <span className="text-emerald-400 font-bold">{receivedCount} Received</span>
          <span className="text-slate-500">&bull;</span>
          <span className={missingCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
            {missingCount} Missing
          </span>
          <span className="text-slate-500">&bull;</span>
          <span className="text-slate-400">{totalCount} Total</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3 text-xs">
        {[
          { key: 'ALL', label: `All (${totalCount})` },
          { key: 'REQUIRED', label: `Required for You (${totalCount - notApplicableCount})` },
          { key: 'MISSING', label: `Missing (${missingCount})` },
          { key: 'RECEIVED', label: `Received (${receivedCount})` },
          { key: 'UNDER_REVIEW', label: `Under Review (${underReviewCount})` },
          { key: 'REPLACEMENT_REQUIRED', label: `Replacement Required` },
          { key: 'NOT_APPLICABLE', label: `Not Applicable (${notApplicableCount})` }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveFilter(tab.key as ChecklistFilter)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer text-xs ${
              activeFilter === tab.key
                ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-sm'
                : 'bg-[#071A2E] text-slate-300 hover:text-white hover:bg-[#102D4F]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Checklist Rows */}
      {filteredRequirements.length === 0 ? (
        <div className="py-8 text-center text-slate-400 bg-[#071A2E] rounded-xl border border-slate-800 p-6 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <p className="text-sm font-semibold text-white">No documents in this filter view</p>
          <p className="text-xs text-slate-400">
            {activeFilter === 'MISSING'
              ? 'Great news! All required documents have been uploaded and received.'
              : 'Try selecting "All" to view all checklist requirements.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredRequirements.map((item) => {
            const isExpanded = expandedId === item.id;
            const matchedCount = matchedDocumentCounts[item.requirementId] || (item.status === 'Accepted' || item.status === 'Uploaded' ? 1 : 0);
            const isMissing = item.status === 'Missing' && item.applicability !== 'NOT_APPLICABLE';

            return (
              <div
                key={item.id}
                className={`rounded-xl border transition-all ${
                  isMissing
                    ? 'bg-[#071A2E] border-slate-700/80 hover:border-slate-600'
                    : 'bg-[#071A2E]/70 border-slate-800'
                }`}
              >
                {/* Main Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">
                        {item.title}
                      </span>
                      {item.formNumber && (
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#102D4F] text-[#D4A843] border border-slate-700">
                          {item.formNumber}
                        </span>
                      )}
                      {item.jurisdiction && item.jurisdiction !== 'Federal' && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/30">
                          {item.jurisdiction}
                        </span>
                      )}
                      {getStatusBadge(item)}
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-1">
                      {item.whyDoWeNeedIt || item.description || item.requirementReason}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span>Category: {item.category}</span>
                      <span>&bull;</span>
                      <span>Matched Docs: <strong className="text-slate-200">{matchedCount}</strong></span>
                      {item.requestedAt && (
                        <>
                          <span>&bull;</span>
                          <span>Requested: {new Date(item.requestedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {item.applicability !== 'NOT_APPLICABLE' && (
                      <button
                        type="button"
                        onClick={() => onUploadForRequirement(item)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Upload</span>
                      </button>
                    )}

                    {matchedCount > 0 && onViewDocumentsForRequirement && (
                      <button
                        type="button"
                        onClick={() => onViewDocumentsForRequirement(item)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#102D4F] hover:bg-[#143657] text-slate-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>View</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title={isExpanded ? 'Collapse details' : 'Expand details'}
                      aria-label="Toggle details"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-800 p-4 bg-[#06182B] rounded-b-xl space-y-3 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {item.whatIsThis && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block">
                            What is this?
                          </span>
                          <p className="text-slate-300 leading-relaxed">{item.whatIsThis}</p>
                        </div>
                      )}
                      {item.whyDoWeNeedIt && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block">
                            Why do we need it?
                          </span>
                          <p className="text-slate-300 leading-relaxed">{item.whyDoWeNeedIt}</p>
                        </div>
                      )}
                      {item.whereCanIGetIt && (
                        <div className="space-y-1">
                          <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block">
                            Where can I get it?
                          </span>
                          <p className="text-slate-300 leading-relaxed">{item.whereCanIGetIt}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                      <span>Statutory Basis: {item.statutoryBasis || 'IRC § 6001 (Recordkeeping)'}</span>
                      {item.applicability !== 'NOT_APPLICABLE' && onMarkNotApplicable && (
                        <button
                          type="button"
                          onClick={() => onMarkNotApplicable(item)}
                          className="text-slate-400 hover:text-amber-300 underline cursor-pointer text-left sm:text-right"
                        >
                          I don't have this / Not applicable to me &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
