import React from 'react';
import { Lock, UserCheck, ShieldCheck, FileCheck2 } from 'lucide-react';
import { CLIENT_CONFIDENCE_INDICATORS } from './clientPortalVisualAssets';

const INDICATOR_ICONS = {
  confidentiality: Lock,
  access: UserCheck,
  oversight: ShieldCheck,
  handling: FileCheck2
} as const;

/**
 * Truthful, conceptual client confidence indicators placed below the authentication panel.
 * Contains no fabricated certifications, live telemetry, or compliance badges.
 */
export const ClientPortalTrustIndicators: React.FC = () => {
  return (
    <div
      aria-label="Client portal governance principles"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {CLIENT_CONFIDENCE_INDICATORS.map((item) => {
        const Icon = INDICATOR_ICONS[item.id];
        return (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-[rgba(148,163,184,0.16)] bg-[#081D34]/85 px-3.5 py-3"
          >
            <Icon
              className="mt-0.5 h-4 w-4 shrink-0 text-[#D4A843]"
              aria-hidden="true"
            />
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold text-white">{item.title}</p>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {item.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
