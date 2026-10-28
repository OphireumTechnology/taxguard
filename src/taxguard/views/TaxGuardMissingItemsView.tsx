/**
 * TaxGuard AI – Missing-Document & Information Detection Engine
 * Diagnostic checklist matching intake data against required tax schedules.
 */

import React, { useState } from 'react';
import { 
  ListChecks, 
  AlertCircle, 
  CheckCircle2, 
  Send, 
  Calendar, 
  FileText, 
  ShieldCheck,
  Clock
} from 'lucide-react';
import { TaxGuardStorageService } from '../services/TaxGuardStorageService';
import { TaxGuardMissingItem } from '../types';
import { TaxGuardDisclaimer } from '../components/TaxGuardDisclaimer';

export const TaxGuardMissingItemsView: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [missingItems, setMissingItems] = useState<TaxGuardMissingItem[]>(() =>
    TaxGuardStorageService.getMissingItems(userRole, userRole === 'client' ? 'client_henze_001' : undefined)
  );
  const [responseTexts, setResponseTexts] = useState<Record<string, string>>({});
  const [submittedIds, setSubmittedIds] = useState<Record<string, boolean>>({});

  const handleRespond = (itemId: string) => {
    const text = responseTexts[itemId];
    if (!text) return;
    TaxGuardStorageService.respondToMissingItem(itemId, text);
    setMissingItems(TaxGuardStorageService.getMissingItems(userRole, userRole === 'client' ? 'client_henze_001' : undefined));
    setSubmittedIds({ ...submittedIds, [itemId]: true });
  };

  return (
    <div className="space-y-6">
      <TaxGuardDisclaimer />

      <div className="bg-white border border-[#D8DCE2] rounded-xs shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-bold text-[#061A2F] uppercase tracking-wide flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-[#C99A32]" />
              <span>Missing-Document & Required Evidence Checklist</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Rules-assisted document gap identification based on taxpayer profile and intake disclosures.
            </p>
          </div>

          <div className="text-xs text-slate-600">
            Pending Items:{' '}
            <strong className="text-rose-700 font-mono text-sm">
              {missingItems.filter(i => i.status === 'pending_client').length}
            </strong>
          </div>
        </div>

        <div className="space-y-4">
          {missingItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 border rounded-xs transition-colors space-y-3 ${
                item.status === 'verified_complete'
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : item.priority === 'deadline_critical'
                  ? 'bg-rose-50/40 border-rose-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#061A2F]">{item.requiredItemName}</span>
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-xs font-mono ${
                      item.priority === 'deadline_critical'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.priority.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">TY {item.taxYear}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <strong>Statutory Reason:</strong> {item.reasonNeeded}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Related Schedule: {item.relatedFormOrSchedule}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono self-start sm:self-center">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-600">Due: <strong>{item.dueDate}</strong></span>
                </div>
              </div>

              {/* Status and Client Response */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className="font-semibold text-slate-800 uppercase text-[10px]">
                    {item.status.replace('_', ' ')}
                  </span>
                  {item.clientResponseNote && (
                    <div className="mt-1 text-[11px] text-slate-600 italic">
                      Client Note: "{item.clientResponseNote}"
                    </div>
                  )}
                </div>

                {item.status === 'pending_client' && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Add note or provide document ETA..."
                      value={responseTexts[item.id] || ''}
                      onChange={(e) => setResponseTexts({ ...responseTexts, [item.id]: e.target.value })}
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded-xs flex-1 sm:w-64 focus:ring-1 focus:ring-[#C99A32]"
                    />
                    <button
                      onClick={() => handleRespond(item.id)}
                      className="px-3 py-1 bg-[#061A2F] text-white hover:bg-[#0A2544] rounded-xs text-xs font-semibold flex items-center gap-1"
                    >
                      <Send className="w-3 h-3 text-[#D7AC4A]" />
                      <span>Send</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
