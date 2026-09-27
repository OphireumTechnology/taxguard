import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const PageLoadingFallback: React.FC = () => {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-2xl bg-[#0B2748] border border-[#C99A3D]/40 flex items-center justify-center animate-pulse">
          <ShieldCheck className="w-6 h-6 text-[#E2BD67]" />
        </div>
        <div className="absolute -inset-1 rounded-2xl border border-[#C99A3D]/20 animate-ping pointer-events-none" />
      </div>
      <p className="text-sm font-medium text-slate-300">
        Loading secure workspace...
      </p>
      <p className="text-xs text-slate-400 mt-1">
        A/R Tax Services, LLC &bull; Confidential &amp; Encrypted
      </p>
    </div>
  );
};
