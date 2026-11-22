import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const TaxGuardDisclaimer: React.FC = () => {
  return (
    <div className="p-3.5 rounded-xs bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-slate-700 flex items-start gap-2.5">
      <ShieldCheck className="w-4 h-4 text-[#0A2544] flex-shrink-0 mt-0.5" />
      <p className="leading-relaxed">
        <strong className="text-[#061A2F]">Professional Oversight Notice:</strong> Automated TaxGuard diagnostics are
        advisory review aids only. Every tax position, reconciliation, and filing requires qualified human practitioner
        review and explicit client authorization.
      </p>
    </div>
  );
};
