/**
 * TaxGuard AI – Mandatory Regulatory Disclaimer Component
 * Standardized across all TaxGuard views
 */

import React from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export const TaxGuardDisclaimer: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="border border-[#C99A32]/40 bg-[#FAF8F5] p-2.5 text-[11px] text-[#4A5568] flex items-start gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-[#C99A32] flex-shrink-0 mt-0.5" />
        <p className="leading-snug">
          <strong className="text-[#061A2F]">Compliance-supporting technology.</strong> Final legal, regulatory, accounting, and tax requirements must be validated by qualified U.S. professionals. Projected outcomes are estimates and are not guaranteed. Demonstration Environment – No Live Filing, Payment, Signature, Banking Connection, or Government Submission.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#C99A32]/50 bg-[#FDFBF7] p-4 text-xs text-[#2D3748] rounded-sm shadow-xs space-y-2">
      <div className="flex items-center gap-2 text-[#061A2F] font-bold tracking-tight uppercase">
        <ShieldCheck className="w-4 h-4 text-[#C99A32]" />
        <span>TaxGuard AI – Regulatory Notice & Scope Limitation</span>
        <span className="text-[10px] font-mono text-[#718096] bg-slate-100 px-2 py-0.5 ml-auto">
          Treasury Dept. Circular 230 Notice
        </span>
      </div>
      <p className="text-[11px] leading-relaxed text-[#4A5568]">
        <strong>Compliance-supporting technology. Final legal, regulatory, accounting, and tax requirements must be validated by qualified U.S. professionals.</strong> Projected outcomes are estimates and are not guaranteed. AI-generated analysis does not constitute final professional advice.
      </p>
      <div className="border-t border-[#C99A32]/20 pt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-neutral-600">
        <span>Demonstration Environment – No Live Filing, Payment, Signature, Banking Connection, or Government Submission</span>
        <span>IRC § 7216 & Circular 230 Protected</span>
      </div>
    </div>
  );
};
