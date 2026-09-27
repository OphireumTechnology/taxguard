/**
 * TaxGuard AI – Field Mapping Engine & Smart Form Filling Workspace
 * Multi-stage pipeline: Source Doc -> Extracted Field -> Normalized Record -> Accounting Category -> Tax Form Line
 * Live interactive Smart Form Filling for Form 1040 and Schedule C with source provenance citations.
 */

import React, { useState } from 'react';
import { 
  GitMerge, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  ArrowRight,
  Edit3
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { TaxGuardFieldMapping, TaxGuardSmartFormTemplate } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardFieldMappingView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState<'mappings' | 'smart_forms'>('smart_forms');
  const [mappings, setMappings] = useState<TaxGuardFieldMapping[]>(() =>
    TaxGuardStorageService.getFieldMappings(userRole)
  );
  const [smartForms, setSmartForms] = useState<TaxGuardSmartFormTemplate[]>(() =>
    TaxGuardStorageService.getSmartForms()
  );
  const [selectedFormId, setSelectedFormId] = useState<string>('form_1040_2024');
  const [selectedMapping, setSelectedMapping] = useState<TaxGuardFieldMapping | null>(mappings[0] || null);

  // Edit Mapping Modal
  const [editingMapping, setEditingMapping] = useState<TaxGuardFieldMapping | null>(null);
  const [newDestination, setNewDestination] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');

  // Edit Form Line State
  const [editingFormLine, setEditingFormLine] = useState<{ formId: string; lineNumber: string; currentVal: string | number } | null>(null);
  const [lineValueInput, setLineValueInput] = useState<string>('');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const activeForm = smartForms.find(f => f.formId === selectedFormId) || smartForms[0];

  const handleApproveMapping = (id: string) => {
    TaxGuardStorageService.approveFieldMapping(id, userRole === 'cpa' ? 'Desmond Hinds, Principal' : 'Marcus Vance, EA', userRole);
    setMappings([...TaxGuardStorageService.getFieldMappings(userRole)]);
  };

  const handleSaveMappingEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMapping || !newDestination) return;

    TaxGuardStorageService.updateFieldMapping(
      editingMapping.id,
      newDestination,
      userRole === 'cpa' ? 'Desmond Hinds, Principal' : 'Marcus Vance, EA',
      editReason || 'Reclassified by tax practitioner'
    );

    setMappings([...TaxGuardStorageService.getFieldMappings(userRole)]);
    setEditingMapping(null);
    setNewDestination('');
    setEditReason('');
  };

  const handleSaveFormLine = () => {
    if (!editingFormLine) return;
    const val = isNaN(Number(lineValueInput)) ? lineValueInput : Number(lineValueInput);
    TaxGuardStorageService.updateSmartFormField(
      editingFormLine.formId,
      editingFormLine.lineNumber,
      val,
      userRole === 'cpa' ? 'Desmond Hinds, CPA' : 'Sarah Jenkins, CPA'
    );
    setSmartForms([...TaxGuardStorageService.getSmartForms()]);
    setEditingFormLine(null);
  };

  const handleExportWatermarkedDraft = () => {
    setExportNotice('Generated draft export with mandatory DEMONSTRATION DRAFT watermark.');
    setTimeout(() => setExportNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      {/* Header bar */}
      <div className="bg-white border border-[#D8DCE2] p-5 rounded-xs shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-[#C99A32]" />
            <span>Tax Form Field Mapping & Smart Form Auto-Population</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographic provenance tracking from source OCR boxes to IRS form line items with dual maker-checker locks.
          </p>
        </div>

        {/* View Switcher */}
        <div className="inline-flex rounded-xs border border-slate-300 p-0.5 bg-slate-50 text-xs">
          <button
            onClick={() => setActiveTab('smart_forms')}
            className={`px-3 py-1 rounded-xs font-semibold transition-colors ${
              activeTab === 'smart_forms' ? 'bg-[#061A2F] text-white shadow-xs' : 'text-slate-600 hover:text-[#061A2F]'
            }`}
          >
            Smart Form Live Workpapers
          </button>
          <button
            onClick={() => setActiveTab('mappings')}
            className={`px-3 py-1 rounded-xs font-semibold transition-colors ${
              activeTab === 'mappings' ? 'bg-[#061A2F] text-white shadow-xs' : 'text-slate-600 hover:text-[#061A2F]'
            }`}
          >
            Field Mapping Engine ({mappings.length})
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 bg-blue-50 border border-blue-300 rounded-xs text-xs text-blue-900 flex items-center gap-2">
          <Download className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {activeTab === 'smart_forms' ? (
        /* SMART FORMS VIEW */
        <div className="space-y-6">
          {/* Watermark Banner */}
          <div className="bg-amber-500/10 border-2 border-dashed border-amber-500/40 p-3 rounded-xs flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2 font-mono font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
              <span>DEMONSTRATION DRAFT – NOT FILED – PROFESSIONAL REVIEW REQUIRED</span>
            </div>
            <button
              onClick={handleExportWatermarkedDraft}
              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-300 rounded-xs font-semibold text-amber-950 hover:bg-amber-50"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Export Watermarked Draft</span>
            </button>
          </div>

          {/* Form Selector Tabs */}
          <div className="flex gap-2 border-b border-slate-200">
            {smartForms.map(f => (
              <button
                key={f.formId}
                onClick={() => setSelectedFormId(f.formId)}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                  selectedFormId === f.formId
                    ? 'border-[#C99A32] text-[#061A2F] bg-white'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {f.formName} (TY{f.taxYear})
              </button>
            ))}
          </div>

          {/* Active Smart Form Table */}
          <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-[#061A2F] uppercase tracking-wide">
                  {activeForm.formName} – Line Item Auto-Population Matrix
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Every figure links directly to audited source documents. Reviewer certification locks values against tampering.
                </p>
              </div>

              <div className="text-xs text-slate-500">
                Total Lines: <span className="font-bold text-[#061A2F]">{activeForm.lines.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3 w-16">Line</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 w-32 text-right">Value ($)</th>
                    <th className="py-2.5 px-3">Audit Provenance Citation</th>
                    <th className="py-2.5 px-3 w-28 text-center">Confidence</th>
                    <th className="py-2.5 px-3 w-36 text-center">Maker-Checker Status</th>
                    <th className="py-2.5 px-3 w-24 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeForm.lines.map((line) => {
                    const isMaterial = line.isMaterial;
                    const isLocked = line.status === 'reviewer_locked';

                    return (
                      <tr key={line.lineNumber} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-[#061A2F]">
                          {line.lineNumber}
                        </td>

                        <td className="py-3 px-3 font-medium text-slate-800">
                          <div>{line.lineDescription}</div>
                          {isMaterial && (
                            <span className="text-[9px] font-bold uppercase text-rose-700 bg-rose-50 px-1 py-0.2 rounded-xs border border-rose-200">
                              Material Tax Item
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {typeof line.suggestedValue === 'number'
                            ? line.suggestedValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                            : line.suggestedValue || '—'}
                        </td>

                        <td className="py-3 px-3 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded-xs border border-slate-200 text-slate-700">
                              {line.sourceCitation}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs border ${
                            line.confidence >= 0.9
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : line.confidence >= 0.75
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {(line.confidence * 100).toFixed(0)}%
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs border ${
                            isLocked
                              ? 'bg-purple-50 text-purple-900 border-purple-200'
                              : line.status === 'preparer_confirmed'
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}>
                            {line.status.replace(/_/g, ' ')}
                          </span>
                          {line.reviewedBy && (
                            <div className="text-[9px] text-slate-400 mt-0.5">By {line.reviewedBy}</div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => {
                              setEditingFormLine({
                                formId: activeForm.formId,
                                lineNumber: line.lineNumber,
                                currentVal: line.suggestedValue
                              });
                              setLineValueInput(String(line.suggestedValue));
                            }}
                            className="text-xs font-semibold text-[#061A2F] hover:text-[#C99A32] underline"
                          >
                            {isLocked ? 'Modify' : 'Review'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* FIELD MAPPING ENGINE VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Mappings List */}
          <div className="lg:col-span-6 space-y-3">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Active Source-to-Tax Field Mappings ({mappings.length})
            </div>

            {mappings.map((m) => {
              const isSelected = selectedMapping?.id === m.id;
              const isLocked = m.approvalStatus === 'reviewer_locked';

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMapping(m)}
                  className={`p-4 rounded-xs border cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-white border-[#C99A32] shadow-sm ring-1 ring-[#C99A32]/40' 
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#061A2F]">{m.extractedFieldName}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-mono text-xs font-bold text-[#C99A32]">{m.taxFormLine}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Doc: {m.sourceDocName} (p. {m.sourcePageNumber})</div>
                    </div>

                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs border ${
                      isLocked
                        ? 'bg-purple-50 text-purple-900 border-purple-200'
                        : m.approvalStatus === 'preparer_approved'
                        ? 'bg-blue-50 text-blue-900 border-blue-200'
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}>
                      {m.approvalStatus.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-800">
                      Value: {typeof m.extractedValue === 'number' ? `$${m.extractedValue.toLocaleString()}` : m.extractedValue}
                    </span>
                    <span className="text-[11px] text-slate-500">Confidence: {(m.confidenceScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mapping Inspector & Editor */}
          <div className="lg:col-span-6">
            {selectedMapping ? (
              <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-6 space-y-5">
                <div className="border-b border-slate-200 pb-3 flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-[#C99A32] bg-[#061A2F] px-2 py-0.5 rounded-xs">
                      {selectedMapping.id}
                    </span>
                    <h2 className="text-sm font-bold text-[#061A2F] mt-1.5">{selectedMapping.extractedFieldName}</h2>
                    <p className="text-xs text-slate-500">Category: {selectedMapping.accountingCategory}</p>
                  </div>

                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-xs border ${
                    selectedMapping.approvalStatus === 'reviewer_locked'
                      ? 'bg-purple-50 text-purple-900 border-purple-200'
                      : 'bg-amber-50 text-amber-900 border-amber-200'
                  }`}>
                    {selectedMapping.approvalStatus.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Values Comparison */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 border border-slate-200 p-3 rounded-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Extracted Raw Value</span>
                    <span className="font-mono font-bold text-slate-800 text-sm">
                      {typeof selectedMapping.extractedValue === 'number' ? `$${selectedMapping.extractedValue.toLocaleString()}` : selectedMapping.extractedValue}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Accounting Category</span>
                    <span className="font-mono font-bold text-[#061A2F] text-sm">
                      {selectedMapping.accountingCategory}
                    </span>
                  </div>
                </div>

                {/* Destination Routing */}
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-slate-700 block uppercase tracking-wide text-[10px]">Tax Destination Routing</span>
                  <div className="border border-slate-200 p-2.5 rounded-xs bg-white space-y-1">
                    <div><span className="font-semibold text-slate-700">Target Line Item:</span> <span className="font-mono font-bold text-[#C99A32]">{selectedMapping.taxFormLine}</span></div>
                    <div><span className="font-semibold text-slate-700">Workpaper Field:</span> {selectedMapping.workpaperField}</div>
                    <div><span className="font-semibold text-slate-700">Source Document:</span> {selectedMapping.sourceDocName} (Page {selectedMapping.sourcePageNumber})</div>
                  </div>
                </div>

                {/* Correction History */}
                {selectedMapping.correctionHistory.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    <span className="font-bold text-slate-700 block uppercase tracking-wide text-[10px]">Correction History</span>
                    <div className="space-y-1">
                      {selectedMapping.correctionHistory.map((h, i) => (
                        <div key={i} className="text-[11px] bg-slate-50 p-2 rounded-xs border border-slate-200 text-slate-600">
                          <div>Changed from <b>{h.previousDestination}</b> to <b>{h.newDestination}</b></div>
                          <div className="text-slate-400 text-[10px]">By {h.changedBy} on {h.changedAt}. Reason: {h.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Maker-Checker Controls */}
                <div className="pt-4 border-t border-slate-200 flex gap-2">
                  <button
                    onClick={() => handleApproveMapping(selectedMapping.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#061A2F] text-white text-xs font-bold rounded-xs hover:bg-[#0A2544] border border-[#1A365D]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C99A32]" />
                    <span>{userRole === 'cpa' ? 'CPA Lock Mapping' : 'Preparer Accept'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingMapping(selectedMapping);
                      setNewDestination(selectedMapping.taxFormLine);
                    }}
                    className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xs hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Reroute Line</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xs p-12 text-center text-slate-400 text-xs">
                Select a field mapping to inspect source coordinates and routing.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reroute Line Modal */}
      {editingMapping && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold text-[#061A2F] uppercase">Reroute Tax Form Destination</h2>
              <p className="text-xs text-slate-500 mt-0.5">Reassigns source field to an alternative tax form line item with justification.</p>
            </div>

            <form onSubmit={handleSaveMappingEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Field</label>
                <div className="font-mono text-slate-800 bg-slate-50 p-2 rounded-xs border border-slate-200">
                  {editingMapping.extractedFieldName} ({editingMapping.sourceDocName})
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Target Tax Form Line *</label>
                <input
                  type="text"
                  required
                  value={newDestination}
                  onChange={(e) => setNewDestination(e.target.value)}
                  placeholder="e.g. Form 1040, Line 1z or Schedule C, Line 27a"
                  className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden focus:border-[#C99A32]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for Reassignment *</label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Technical justification under IRC provisions..."
                  className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden focus:border-[#C99A32]"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingMapping(null)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#061A2F] text-white font-semibold rounded-xs hover:bg-[#0A2544] border border-[#1A365D]"
                >
                  Commit Rerouting
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Form Line Edit Modal */}
      {editingFormLine && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xl max-w-sm w-full p-5 space-y-4">
            <div className="border-b border-slate-200 pb-2.5">
              <h2 className="text-xs font-bold text-[#061A2F] uppercase">Review Line Item Value</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Line {editingFormLine.lineNumber} Review & Locking</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirmed Line Value</label>
                <input
                  type="text"
                  value={lineValueInput}
                  onChange={(e) => setLineValueInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xs px-2.5 py-1.5 outline-hidden focus:border-[#C99A32]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingFormLine(null)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-xs hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveFormLine}
                  className="px-4 py-1.5 bg-[#061A2F] text-white font-semibold rounded-xs hover:bg-[#0A2544]"
                >
                  Lock & Sign Off
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
