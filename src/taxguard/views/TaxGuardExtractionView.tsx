/**
 * TaxGuard AI – Provider-Neutral OCR Extraction & Verification Queue
 * Field-by-field confidence triage, manual override audit history, and low-confidence gates.
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
  Layers
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { TaxGuardExtractionDossier, ExtractedField } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardExtractionView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [extractions, setExtractions] = useState<TaxGuardExtractionDossier[]>(() =>
    TaxGuardStorageService.getExtractions(userRole, userRole === 'client' ? 'client_henze_001' : undefined)
  );
  const [editingField, setEditingField] = useState<{ dossierId: string; field: ExtractedField } | null>(null);
  const [newValue, setNewValue] = useState<string>('');
  const [correctionReason, setCorrectionReason] = useState<string>('');

  const activeDossier = extractions[0];

  const handleSaveCorrection = () => {
    if (!editingField || !correctionReason) return;
    const parsed = isNaN(Number(newValue)) ? newValue : Number(newValue);
    TaxGuardStorageService.updateExtractedField(
      editingField.dossierId,
      editingField.field.id,
      parsed,
      userRole === 'client' ? 'Client Verified' : 'Marcus Vance, EA',
      correctionReason
    );
    setExtractions(TaxGuardStorageService.getExtractions(userRole, userRole === 'client' ? 'client_henze_001' : undefined));
    setEditingField(null);
    setNewValue('');
    setCorrectionReason('');
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#C99A32]" />
              <span>OCR Structured Data Extraction & Confidence Triage</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Provider-neutral extraction adapter: Google Document AI, Azure Document Intelligence, AWS Textract, and Gemini 2.5 Flash.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Overall Dossier Confidence:</span>
            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold font-mono rounded-xs">
              {(activeDossier.overallConfidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Dossier Info */}
        <div className="bg-[#FAF8F5] border border-[#C99A32]/40 p-3 rounded-xs flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-500">Form:</span>{' '}
              <strong className="text-[#061A2F]">{activeDossier.formDetected}</strong>
            </div>
            <div>
              <span className="text-slate-500">Tax Year:</span>{' '}
              <strong className="text-[#061A2F]">{activeDossier.taxYear}</strong>
            </div>
            <div>
              <span className="text-slate-500">Status:</span>{' '}
              <span className="font-semibold text-amber-800 uppercase text-[10px] bg-amber-100 px-2 py-0.5 rounded-xs">
                {activeDossier.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            Processed: {new Date(activeDossier.lastProcessedAt).toLocaleDateString()}
          </div>
        </div>

        {/* Extracted Fields Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                <th className="py-2.5 px-3">Field Label & Name</th>
                <th className="py-2.5 px-3">Extracted Value</th>
                <th className="py-2.5 px-3">Confidence & Model</th>
                <th className="py-2.5 px-3">Review Gate</th>
                <th className="py-2.5 px-3">Reviewer Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeDossier.fields.map((field) => {
                const isLowConfidence = field.confidenceScore < 0.85;
                return (
                  <tr key={field.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#061A2F]">{field.fieldLabel}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {field.fieldName} • Pg {field.sourcePageNumber}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-800 font-semibold">
                      {typeof field.extractedValue === 'number'
                        ? `$${field.extractedValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                        : field.extractedValue}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono text-xs font-bold ${
                          isLowConfidence ? 'text-amber-700' : 'text-emerald-700'
                        }`}>
                          {(field.confidenceScore * 100).toFixed(0)}%
                        </span>
                        {isLowConfidence && (
                          <span className="text-[9px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded uppercase font-bold">
                            Low
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {field.provider} ({field.modelVersion})
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {field.isMaterialField ? (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xs text-[10px] font-bold uppercase">
                          Material Field
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Routine</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {field.humanReviewed ? (
                        <div className="text-emerald-700 flex items-center gap-1 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Reviewed by {field.reviewedBy}</span>
                        </div>
                      ) : (
                        <div className="text-amber-700 flex items-center gap-1 text-[11px] font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Pending Review</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          setEditingField({ dossierId: activeDossier.id, field });
                          setNewValue(String(field.extractedValue));
                          setCorrectionReason('');
                        }}
                        className="px-2.5 py-1 border border-slate-300 hover:border-[#061A2F] text-[#061A2F] hover:bg-slate-50 rounded-xs font-medium text-[11px]"
                      >
                        Correct / Certify
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Field Correction Modal */}
      {editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-[#061A2F] max-w-md w-full p-5 rounded-xs shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#061A2F] uppercase">Human Review & Value Correction</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{editingField.field.fieldLabel}</p>
              </div>
              <button onClick={() => setEditingField(null)} className="p-1 text-slate-400 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs bg-slate-50 p-2.5 rounded-xs border border-slate-200 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Source Document:</span>
                <span className="font-semibold text-slate-800">{editingField.field.sourceDocumentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Extracted Raw Value:</span>
                <span className="font-mono font-bold text-slate-800">{String(editingField.field.extractedValue)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#061A2F]">Verified Value</label>
                <input
                  type="text"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xs font-mono focus:ring-1 focus:ring-[#C99A32]"
                  placeholder="Enter verified value"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#061A2F]">Mandatory Justification / Review Note</label>
                <textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-xs focus:ring-1 focus:ring-[#C99A32]"
                  placeholder="Explain reason for manual correction or sign-off (e.g. Cross-referenced with Box 17 SC W-2 copy B)..."
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="px-3 py-1.5 border border-slate-300 text-xs font-medium rounded-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCorrection}
                disabled={!correctionReason}
                className="px-4 py-1.5 bg-[#061A2F] text-white text-xs font-bold uppercase tracking-wider rounded-xs disabled:opacity-50"
              >
                Sign Off & Commit Correction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
