import React from 'react';
import { Building2, ChevronRight, CheckCircle2, UserCheck } from 'lucide-react';
import { User } from '../../../types';

interface SetupComplianceCardProps {
  currentUser: User | null;
  onContinueSetup: () => void;
}

export const SetupComplianceCard: React.FC<SetupComplianceCardProps> = ({
  currentUser,
  onContinueSetup
}) => {
  const percent = 68;
  const entityName = currentUser?.companyName || 'Perotti Financial Consulting';
  const entityType = currentUser?.taxFilingType || 'Individual Form 1040 w/ Schedule C';

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#C6A15B]/15 border border-[#C6A15B]/30 text-[#C6A15B] flex items-center justify-center flex-shrink-0 mt-0.5">
          <Building2 className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Setup &amp; Compliance
            </span>
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.2 rounded border border-emerald-500/30">
              {percent}% Complete
            </span>
          </div>
          <h4 className="font-serif text-base font-bold text-white">
            U.S. Entity Onboarding &bull; {entityName}
          </h4>
          <p className="text-xs text-slate-300">
            Filing Structure: <strong className="text-white">{entityType}</strong> &bull; Assigned Senior Accountant: <strong className="text-[#C6A15B]">Desmond Hinds</strong>
          </p>
        </div>
      </div>

      <div className="w-full sm:w-auto flex-shrink-0">
        <button
          type="button"
          onClick={onContinueSetup}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0D2340] hover:bg-[#132E52] border border-[#183458] hover:border-[#C6A15B]/40 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-colors"
        >
          <span>Continue Setup</span>
          <ChevronRight className="w-4 h-4 text-[#C6A15B]" />
        </button>
      </div>
    </div>
  );
};
