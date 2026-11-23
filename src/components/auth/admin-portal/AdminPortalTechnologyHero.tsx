/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Secure Super Administrator Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React from 'react';
import { ShieldCheck, Lock, FileCheck2, Cpu } from 'lucide-react';
import type { StaffMotionComplexity } from '../staff-portal/useStaffPortalMotion';

interface AdminPortalTechnologyHeroProps {
  animate: boolean;
  complexity: StaffMotionComplexity;
}

const GOVERNANCE_PILLARS = [
  {
    index: '01',
    icon: Lock,
    title: 'Encrypted Information Flow',
    detail: 'Server-authoritative session isolation with tenant-scoped administrative boundaries.'
  },
  {
    index: '02',
    icon: ShieldCheck,
    title: 'Mandatory Multifactor Access',
    detail: 'Hardware-ready authentication posture with server-verified TOTP enforcement.'
  },
  {
    index: '03',
    icon: FileCheck2,
    title: 'Verifiable Audit Records',
    detail: 'Immutable administrative logs recording every privileged sign-in, view, and action.'
  },
  {
    index: '04',
    icon: Cpu,
    title: 'AI Workforce Governance',
    detail: 'Centralized oversight of the 61-agent matrix and server-enforced emergency stop controls.'
  }
] as const;

/**
 * Executive left-column visual narrative for the Destria Super Administrator Portal (/admin/login).
 * Purely presentational: zero authentication logic, zero credential state, zero fake telemetry.
 */
export const AdminPortalTechnologyHero: React.FC<AdminPortalTechnologyHeroProps> = ({
  animate,
  complexity
}) => {
  const showDetailNodes = complexity !== 'minimal';

  return (
    <section
      aria-label="Destria Secure Administration Architecture"
      className={`space-y-6 lg:space-y-7 ${!animate ? 'destria-motion-paused' : ''}`}
    >
      {/* Institutional Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="h-[2px] w-7 bg-[#D4AF37]" aria-hidden="true" />
          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#D4AF37]">
            DESTRIA SECURE ADMINISTRATION
          </p>
        </div>

        <h2 className="font-serif text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold leading-[1.12] tracking-tight text-white">
          Intelligent Governance.{' '}
          <span className="text-[#E6C96E]">Verified Access.</span>{' '}
          Transparent Operations.
        </h2>

        <p className="max-w-xl text-sm sm:text-[15px] leading-relaxed text-[#A8B8CC]">
          Centralized executive command for DESTRIA TAX SERVICES, LLC. Role-enforced administration,
          mandatory multifactor authentication, tamper-evident audit trails, and accountable AI
          workforce oversight — built on TaxGuard&apos;s least-privilege security architecture.
        </p>
      </div>

      {/* Bespoke Animated Security & Governance Architecture Diagram */}
      <div
        aria-hidden="true"
        data-testid="admin-governance-visual"
        className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/22 bg-[#081A30]/82 p-4 sm:p-5 shadow-[0_20px_56px_rgba(2,10,22,0.58)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />

        <svg
          viewBox="0 0 640 240"
          className="h-auto w-full block"
          role="img"
          aria-label="Encrypted governance topology showing verified authorization, audit ledger, and AI oversight nodes"
        >
          <defs>
            <linearGradient id="adminGoldLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#E6C96E" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#00C2D1" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="adminCyanLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00C2D1" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#00C2D1" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.25" />
            </linearGradient>
            <radialGradient id="adminCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.24" />
              <stop offset="55%" stopColor="#00C2D1" stopOpacity="0.09" />
              <stop offset="100%" stopColor="#061426" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Subtle Architectural Grid */}
          <g stroke="#94A3B8" strokeOpacity="0.08" strokeWidth="1">
            <line x1="0" y1="60" x2="640" y2="60" />
            <line x1="0" y1="120" x2="640" y2="120" />
            <line x1="0" y1="180" x2="640" y2="180" />
            <line x1="160" y1="0" x2="160" y2="240" />
            <line x1="320" y1="0" x2="320" y2="240" />
            <line x1="480" y1="0" x2="480" y2="240" />
          </g>

          {/* Central Governance Core Glow */}
          <circle cx="320" cy="120" r="96" fill="url(#adminCoreGlow)" />

          {/* Connecting Encrypted Channels */}
          <path
            d="M 96 66 C 172 66, 214 102, 266 114"
            fill="none"
            stroke="url(#adminGoldLine)"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            className={animate ? 'staff-flow-dash' : ''}
          />
          <path
            d="M 96 174 C 172 174, 214 138, 266 126"
            fill="none"
            stroke="url(#adminCyanLine)"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            className={animate ? 'staff-flow-dash' : ''}
          />
          <path
            d="M 374 114 C 426 102, 468 66, 544 66"
            fill="none"
            stroke="url(#adminCyanLine)"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            className={animate ? 'staff-flow-dash' : ''}
          />
          <path
            d="M 374 126 C 426 138, 468 174, 544 174"
            fill="none"
            stroke="url(#adminGoldLine)"
            strokeWidth="1.5"
            strokeDasharray="6 6"
            className={animate ? 'staff-flow-dash' : ''}
          />

          {/* Concentric Governance Rings */}
          <circle
            cx="320"
            cy="120"
            r="64"
            fill="none"
            stroke="#D4AF37"
            strokeOpacity="0.28"
            strokeWidth="1"
            strokeDasharray="4 6"
          />
          <circle
            cx="320"
            cy="120"
            r="48"
            fill="#061426"
            fillOpacity="0.92"
            stroke="#D4AF37"
            strokeOpacity="0.65"
            strokeWidth="1.5"
          />
          <circle
            cx="320"
            cy="120"
            r="34"
            fill="none"
            stroke="#00C2D1"
            strokeOpacity="0.45"
            strokeWidth="1"
            className={animate ? 'staff-node-pulse' : ''}
          />

          {/* Shield Emblem in Core */}
          <path
            d="M 320 96 L 339 104 L 339 121 C 339 134 331 143 320 148 C 309 143 301 134 301 121 L 301 104 Z"
            fill="#0B1F36"
            stroke="#D4AF37"
            strokeWidth="1.6"
          />
          <path
            d="M 313 121 L 318 126 L 328 115"
            fill="none"
            stroke="#00C2D1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Four Satellite Governance Nodes */}
          {showDetailNodes && (
            <g fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontSize="10">
              {/* Top-Left: MFA Gate */}
              <rect x="12" y="42" width="144" height="48" rx="10" fill="#061426" stroke="#D4AF37" strokeOpacity="0.42" />
              <circle cx="28" cy="60" r="3.5" fill="#D4AF37" />
              <text x="40" y="63" fill="#FFFFFF" fontWeight="700">MFA GATE</text>
              <text x="26" y="79" fill="#A8B8CC" fontSize="8.8">AAL2 · TOTP Enforced</text>

              {/* Bottom-Left: RBAC Policy */}
              <rect x="12" y="150" width="144" height="48" rx="10" fill="#061426" stroke="#00C2D1" strokeOpacity="0.38" />
              <circle cx="28" cy="168" r="3.5" fill="#00C2D1" />
              <text x="40" y="171" fill="#FFFFFF" fontWeight="700">SERVER RBAC</text>
              <text x="26" y="187" fill="#A8B8CC" fontSize="8.8">Least-Privilege Scope</text>

              {/* Top-Right: Audit Ledger */}
              <rect x="484" y="42" width="144" height="48" rx="10" fill="#061426" stroke="#00C2D1" strokeOpacity="0.38" />
              <circle cx="500" cy="60" r="3.5" fill="#00C2D1" />
              <text x="512" y="63" fill="#FFFFFF" fontWeight="700">AUDIT LEDGER</text>
              <text x="498" y="79" fill="#A8B8CC" fontSize="8.8">Immutable Event Log</text>

              {/* Bottom-Right: AI Control */}
              <rect x="484" y="150" width="144" height="48" rx="10" fill="#061426" stroke="#D4AF37" strokeOpacity="0.42" />
              <circle cx="500" cy="168" r="3.5" fill="#D4AF37" />
              <text x="512" y="171" fill="#FFFFFF" fontWeight="700">AI GOVERNANCE</text>
              <text x="498" y="187" fill="#A8B8CC" fontSize="8.8">Kill-Switch Ready</text>
            </g>
          )}
        </svg>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[11px] font-mono text-[#A8B8CC]">
          <span>DESTRIA TAX SERVICES, LLC · GOVERNANCE LAYER</span>
          <span className="text-[#D4AF37] tabular-nums">TAXGUARD SECURITY ARCHITECTURE</span>
        </div>
      </div>

      {/* Four Crisp Governance Pillars (Zero Pill Spam) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {GOVERNANCE_PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div
              key={pillar.index}
              className="rounded-xl border border-white/10 bg-[#0B1F36]/68 px-4 py-3.5 transition-colors hover:border-[#D4AF37]/30"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/25 bg-[#061426] text-[#D4AF37]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold text-[#00C2D1] tabular-nums">
                      {pillar.index}
                    </span>
                    <h3 className="text-xs font-bold tracking-wide text-white">
                      {pillar.title}
                    </h3>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#A8B8CC]">
                    {pillar.detail}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
