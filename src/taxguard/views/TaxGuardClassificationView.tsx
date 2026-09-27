/**
 * TaxGuard AI – Document Recognition, Classification, & Auto-Sorting Center
 * Deep heuristic & neural classification with confidence scoring, human verification,
 * and cross-client reassignment safety controls.
 */

import React, { useState } from 'react';
import { 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Sparkles, 
  Edit3, 
  ShieldCheck, 
  Filter, 
  Search,
  Lock,
  ArrowRight,
  Layers,
  Calendar,
  Building
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { DocumentClassificationDetail, DocumentCategory } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

const ALL_CATEGORIES: DocumentCategory[] = [
  'W-2',
  '1099-NEC',
  '1099-MISC',
  '1099-INT',
  '1099-DIV',
  '1099-B',
  '1099-K',
  '1099-R',
  'Schedule K-1',
  '1098 Mortgage',
  'Bank Statement',
  'Credit Card Statement',
  'Receipt',
  'Invoice',
  'Payroll Report',
  'Prior Year Return',
  'Fixed Asset Record',
  'Brokerage Statement',
  'Cryptocurrency Transaction Report',
  'Business Registration',
  'IRS Notice',
  'State Tax Notice',
  'Supporting Schedule',
  'Engagement Document',
  'Unclassified'
];

export const TaxGuardClassificationView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [classifications, setClassifications] = useState<DocumentClassificationDetail[]>(() =>
    TaxGuardStorageService.getClassifications(userRole, userRole === 'client' ? 'client_henze_001' : undefined)
  );
  const [selectedCls, setSelectedCls] = useState<DocumentClassificationDetail | null>(classifications[0] || null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingCategory, setEditingCategory] = useState<boolean>(false);
  const [overrideCategory, setOverrideCategory] = useState<DocumentCategory>('W-2');
  const [overrideNotes, setOverrideNotes] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const filteredClassifications = classifications.filter(c => {
    if (categoryFilter !== 'all' && (c.confirmedCategory || c.proposedCategory) !== categoryFilter) return false;
    if (searchTerm && !c.documentName.toLowerCase().includes(searchTerm.toLowerCase()) && !c.detectedTaxpayerOrEntity.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const handleConfirmClassification = (clsId: string, cat: DocumentCategory, notes: string) => {
    TaxGuardStorageService.confirmClassification(clsId, cat, userRole === 'client' ? 'Client Verification' : 'Marcus Vance, EA', notes);
    setClassifications(TaxGuardStorageService.getClassifications(userRole, userRole === 'client' ? 'client_henze_001' : undefined));
    setEditingCategory(false);
    setSuccessMessage(`Classification for ${cat} confirmed and locked.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Header bar */}
      <div className="bg-white border border-[#D8DCE2] p-5 rounded-xs shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#C99A32]" />
            <span>AI Document Recognition, Classification, & Auto-Sorting</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated form family detection, confidence scoring, tax-year alignment, and human-in-the-loop overrides.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search document or entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-xs text-xs outline-hidden focus:border-[#C99A32] w-56"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent font-medium text-[#061A2F] outline-hidden cursor-pointer"
            >
              <option value="all">All Categories ({classifications.length})</option>
              {ALL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xs text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Grid: Classification List & Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Classification Queue */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Processed Classification Queue ({filteredClassifications.length})
          </div>

          {filteredClassifications.map((item) => {
            const isSelected = selectedCls?.id === item.id;
            const effectiveCategory = item.confirmedCategory || item.proposedCategory;
            const isHighConfidence = item.confidenceScore >= 0.85;

            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedCls(item);
                  setOverrideCategory(effectiveCategory);
                  setEditingCategory(false);
                }}
                className={`p-4 rounded-xs border cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-white border-[#C99A32] shadow-sm ring-1 ring-[#C99A32]/40' 
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#061A2F]">{effectiveCategory}</span>
                      <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-xs border ${
                        isHighConfidence 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : 'bg-amber-50 text-amber-900 border-amber-200'
                      }`}>
                        {(item.confidenceScore * 100).toFixed(0)}% Conf
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-700 mt-1 truncate max-w-xs">{item.documentName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.detectedTaxpayerOrEntity}</div>
                  </div>

                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs border ${
                    item.reviewStatus === 'human_confirmed' || item.reviewStatus === 'human_corrected'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-blue-50 text-blue-900 border-blue-200'
                  }`}>
                    {item.reviewStatus.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Detected Tax Year: {item.detectedTaxYear}</span>
                  <span className="text-[10px] font-mono text-slate-400">{item.classificationModel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Classification Details & Auto-Sorting Routing */}
        <div className="lg:col-span-7">
          {selectedCls ? (
            <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-6 space-y-6">
              {/* Header */}
              <div className="border-b border-slate-200 pb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#C99A32] bg-[#061A2F] px-2 py-0.5 rounded-xs">
                      {selectedCls.documentId}
                    </span>
                    <span className="text-xs text-slate-500">
                      Model: {selectedCls.classificationModel} (v{selectedCls.modelVersion})
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-[#061A2F] mt-1.5">{selectedCls.documentName}</h2>
                  <p className="text-xs text-slate-500">
                    Timestamp: {selectedCls.processedAt}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Primary AI Prediction:</div>
                  <div className="text-sm font-bold text-[#061A2F] flex items-center justify-end gap-1.5 mt-0.5">
                    <span className="text-emerald-700 font-mono">{(selectedCls.confidenceScore * 100).toFixed(1)}%</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200">{selectedCls.proposedCategory}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Alternative: {selectedCls.alternativeCategory}
                  </div>
                </div>
              </div>

              {/* Heuristic Explanation Box */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xs text-xs space-y-1.5">
                <span className="font-bold text-slate-700 block uppercase tracking-wider text-[10px]">
                  Classification Reasoning & Heuristic Rationale
                </span>
                <p className="text-slate-600 leading-relaxed">{selectedCls.explanation}</p>
              </div>

              {/* Auto-Sorting & Metadata Proposal Engine */}
              <div>
                <h3 className="text-xs font-bold text-[#061A2F] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#C99A32]" />
                  <span>Proposed Sorting, Routing, & Retention Plan</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="border border-slate-200 p-2.5 rounded-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Assigned Client & Entity</span>
                    <span className="font-semibold text-slate-800">{selectedCls.proposedClient}</span>
                    <span className="text-slate-500 block text-[11px]">{selectedCls.proposedEntity}</span>
                  </div>

                  <div className="border border-slate-200 p-2.5 rounded-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Workflow Destination</span>
                    <span className="font-semibold text-[#061A2F]">{selectedCls.proposedWorkflowDestination}</span>
                    <span className="text-slate-500 block text-[11px]">Direct mapping into tax workpapers</span>
                  </div>

                  <div className="border border-slate-200 p-2.5 rounded-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Retention Category</span>
                    <span className="font-semibold text-slate-800">{selectedCls.proposedRetentionCategory}</span>
                    <span className="text-slate-500 block text-[11px]">IRS Regulation § 1.6001-1</span>
                  </div>

                  <div className="border border-slate-200 p-2.5 rounded-xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Confidentiality Level</span>
                    <span className="font-semibold text-slate-800">{selectedCls.sensitivityLevel}</span>
                    <span className="text-slate-500 block text-[11px]">Strict Tenant Boundary Isolation</span>
                  </div>
                </div>
              </div>

              {/* Cross-Client Isolation Guard Notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xs text-[11px] text-blue-900 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Tenant Isolation Rule: </span>
                  Documents are strictly locked to their authorized client account ({selectedCls.proposedClient}). Cross-client reassignment is prohibited without dual administrative authorization.
                </div>
              </div>

              {/* Review & Manual Override Controls */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#061A2F] uppercase tracking-wide">
                    Human Verification & Professional Confirmation
                  </span>
                  {selectedCls.confirmedCategory && (
                    <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Certified as {selectedCls.confirmedCategory}</span>
                    </span>
                  )}
                </div>

                {editingCategory ? (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xs space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Select Correct Document Category</label>
                      <select
                        value={overrideCategory}
                        onChange={(e) => setOverrideCategory(e.target.value as any)}
                        className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden focus:border-[#C99A32]"
                      >
                        {ALL_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Professional Review Notes & Justification</label>
                      <input
                        type="text"
                        value={overrideNotes}
                        onChange={(e) => setOverrideNotes(e.target.value)}
                        placeholder="Document verified against client engagement scope..."
                        className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden focus:border-[#C99A32]"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditingCategory(false)}
                        className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xs hover:bg-slate-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleConfirmClassification(selectedCls.id, overrideCategory, overrideNotes || 'Corrected by reviewer')}
                        className="px-4 py-1.5 bg-[#061A2F] text-white font-semibold rounded-xs hover:bg-[#0A2544] border border-[#1A365D]"
                      >
                        Commit Classification
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirmClassification(selectedCls.id, selectedCls.proposedCategory, 'Confirmed AI proposed category')}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#061A2F] text-white text-xs font-bold rounded-xs hover:bg-[#0A2544] border border-[#1A365D]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#C99A32]" />
                      <span>Confirm Proposed ({selectedCls.proposedCategory})</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingCategory(true);
                        setOverrideCategory(selectedCls.confirmedCategory || selectedCls.proposedCategory);
                      }}
                      className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xs hover:bg-slate-50 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Change Category</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xs p-12 text-center text-slate-400 text-xs">
              Select a document to inspect its classification heuristics and routing metadata.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
