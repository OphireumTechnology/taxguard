/**
 * TaxGuard AI – Discrepancy & Quality-Control (QC) Alert Engine
 * 18+ Diagnostic rules enforced with strictly neutral, objective terminology.
 */

import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  FileText, 
  HelpCircle, 
  Search,
  Check,
  X,
  Layers
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { TaxGuardDiscrepancy } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardDiscrepanciesView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [discrepancies, setDiscrepancies] = useState<TaxGuardDiscrepancy[]>(() =>
    TaxGuardStorageService.getDiscrepancies(userRole, userRole === 'client' ? 'client_henze_001' : undefined)
  );
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');

  const handleResolve = (id: string) => {
    if (!resolutionNotes) return;
    TaxGuardStorageService.resolveDiscrepancy(
      id, 
      userRole === 'client' ? 'Client Explanation' : 'Sarah Jenkins, CPA', 
      resolutionNotes
    );
    setDiscrepancies(TaxGuardStorageService.getDiscrepancies(userRole, userRole === 'client' ? 'client_henze_001' : undefined));
    setResolvingId(null);
    setResolutionNotes('');
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#C99A32]" />
              <span>Discrepancy & Quality-Control (QC) Audit Center</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              18 automated verification heuristics evaluating name fidelity, bank tie-outs, SSN endings, and schedule reconciliations.
            </p>
          </div>

          <div className="text-xs text-slate-600">
            Open Alerts:{' '}
            <strong className="text-amber-700 font-mono text-sm">
              {discrepancies.filter(d => d.status === 'open').length}
            </strong>
          </div>
        </div>

        <div className="space-y-4">
          {discrepancies.map((d) => (
            <div
              key={d.id}
              className={`p-4 border rounded-xs transition-colors space-y-3 ${
                d.status === 'resolved'
                  ? 'bg-slate-50 border-slate-200 opacity-80'
                  : 'bg-amber-50/40 border-amber-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xs">
                      {d.ruleCode}
                    </span>
                    <span className="font-bold text-xs text-[#061A2F]">{d.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono">TY {d.taxYear}</span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed">
                    {d.neutralDescription}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-xs font-mono ${
                    d.status === 'resolved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-200 text-amber-900'
                  }`}>
                    {d.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Affected Documents & Fields */}
              <div className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xs border border-slate-200 space-y-1">
                <div>
                  <strong>Affected Documents:</strong> {d.affectedDocuments.join(', ')}
                </div>
                <div>
                  <strong>Audit Recommendation:</strong> {d.recommendedAction}
                </div>
                {d.reviewerNotes && (
                  <div className="text-emerald-800 font-medium pt-1 border-t border-slate-100">
                    Resolution Note ({d.reviewedBy}): "{d.reviewerNotes}"
                  </div>
                )}
              </div>

              {/* Action */}
              {d.status !== 'resolved' && (
                <div className="flex justify-end pt-1">
                  {resolvingId === d.id ? (
                    <div className="w-full space-y-2">
                      <textarea
                        value={resolutionNotes}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                        placeholder="Provide professional reconciliation explanation (e.g. Verified contract retainage deposited Jan 4th)..."
                        rows={2}
                        className="w-full p-2 text-xs border border-slate-300 rounded-xs focus:ring-1 focus:ring-[#C99A32]"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setResolvingId(null)}
                          className="px-3 py-1 border border-slate-300 text-xs font-medium rounded-xs"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleResolve(d.id)}
                          disabled={!resolutionNotes}
                          className="px-3 py-1 bg-[#061A2F] text-white text-xs font-bold uppercase rounded-xs disabled:opacity-50"
                        >
                          Mark Reconciled & Resolved
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setResolvingId(d.id); setResolutionNotes(''); }}
                      className="px-3 py-1 bg-[#0A2544] hover:bg-[#061A2F] text-white text-xs font-semibold rounded-xs transition-colors"
                    >
                      Resolve Discrepancy
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
