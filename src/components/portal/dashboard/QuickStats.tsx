import React from 'react';
import { AlertCircle, FileCheck, CreditCard, ChevronRight } from 'lucide-react';

interface QuickStatsProps {
  missingCount: number;
  deliverablesCount: number;
  unpaidBalance: number;
  onNavigate: (tab: string) => void;
}

export const QuickStats: React.FC<QuickStatsProps> = ({
  missingCount = 1,
  deliverablesCount = 2,
  unpaidBalance = 0,
  onNavigate
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* 1. Action Required Card */}
      <div className="p-5 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-3 transition-colors hover:border-[#1E3A5F]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Action Required
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl font-bold text-white">
            {missingCount} {missingCount === 1 ? 'Item' : 'Items'}
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            Pending document needed before filing transmission.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('required_documents')}
          className="text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] flex items-center gap-1 self-start pt-1"
        >
          <span>Review checklist</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Deliverables Card */}
      <div className="p-5 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-3 transition-colors hover:border-[#1E3A5F]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Deliverables
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <FileCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl font-bold text-white">
            {deliverablesCount} Available
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            Certified Form 1040 package and Form 8879 authorization.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('reports')}
          className="text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] flex items-center gap-1 self-start pt-1"
        >
          <span>View deliverables</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Billing Card */}
      <div className="p-5 rounded-2xl bg-[#0A1F38] border border-[#183458] flex flex-col justify-between space-y-3 transition-colors hover:border-[#1E3A5F]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Billing
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="font-serif text-2xl font-bold text-white">
            ${unpaidBalance} Due
          </div>
          <p className="text-xs text-slate-400 leading-normal">
            {unpaidBalance === 0 ? 'Account settled in full. No open invoices.' : 'Outstanding balance pending settlement.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('billing')}
          className="text-xs font-semibold text-[#C6A15B] hover:text-[#D9BF7A] flex items-center gap-1 self-start pt-1"
        >
          <span>View invoices</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
