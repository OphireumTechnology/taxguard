import React from 'react';
import { AlertTriangle, UploadCloud, ChevronRight, Clock, FileWarning } from 'lucide-react';

interface ActionCenterProps {
  onUploadDocument: (category?: string) => void;
  onReviewChecklist: () => void;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({
  onUploadDocument,
  onReviewChecklist
}) => {
  return (
    <section aria-labelledby="action-center-title" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 id="action-center-title" className="text-xs uppercase font-bold tracking-wider text-slate-300">
            Action Center &bull; Your Next Steps
          </h3>
          <p className="text-xs text-slate-400">
            1 item needs your attention before we can complete your tax return.
          </p>
        </div>
        <button
          type="button"
          onClick={onReviewChecklist}
          className="text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] flex items-center gap-1"
        >
          <span>View full checklist</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Prominent Action Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#0D2340] via-[#0A1F38] to-[#0D2340] border border-amber-500/40 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all hover:border-amber-500/60">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Action Required
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Target Date: March 20, 2026
              </span>
            </div>
            <h4 className="font-serif text-base font-bold text-white">
              Missing business bank statement (Dec 2025)
            </h4>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              We need your latest 2025 bank statement to complete the Schedule C revenue and deduction verification for Elena Rostova's CPA review.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto flex-shrink-0 pt-2 sm:pt-0">
          <button
            type="button"
            onClick={() => onUploadDocument('bank_statement')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] text-xs font-bold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>
    </section>
  );
};
