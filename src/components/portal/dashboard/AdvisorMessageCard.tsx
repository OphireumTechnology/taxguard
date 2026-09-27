import React from 'react';
import { MessageSquare, ChevronRight, Clock, ShieldCheck } from 'lucide-react';

interface AdvisorMessageCardProps {
  onOpenConversation: () => void;
}

export const AdvisorMessageCard: React.FC<AdvisorMessageCardProps> = ({ onOpenConversation }) => {
  return (
    <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-4">
      <div className="space-y-3.5">
        <div className="flex items-center justify-between border-b border-[#183458] pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Direct Advisory
            </span>
            <h3 className="font-serif text-base font-bold text-white">From Your Tax Advisor</h3>
          </div>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Online
          </span>
        </div>

        {/* Advisor Details */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
            DH
          </div>
          <div>
            <div className="text-xs font-semibold text-white">
              Desmond Hinds
            </div>
            <div className="text-[11px] text-slate-400">
              Founder &amp; Senior Managing Accountant &bull; AFSP
            </div>
          </div>
        </div>

        {/* Message Snippet */}
        <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#183458] text-xs text-slate-300 relative">
          <p className="italic leading-relaxed">
            &ldquo;We&apos;ve completed the initial review of your wage and 1099 documents. We need your latest business bank statement to finalize the Schedule C deductions before secondary CPA sign-off.&rdquo;
          </p>
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>2 hours ago</span>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[#183458]">
        <button
          type="button"
          onClick={onOpenConversation}
          className="text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] flex items-center gap-1"
        >
          <span>Open conversation</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
