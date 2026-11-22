import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import commandVisualWebp from '../../../assets/images/human_ai_auth_command_1795335837223.webp';
import commandVisualJpg from '../../../assets/images/human_ai_auth_command_1795335837223.jpg';

interface HumanAiCommandVisualProps {
  animate: boolean;
}

/**
 * High-presence enterprise financial technology command visual with restrained
 * GPU-composited orbital verification rings, gold/cyan pathways, and error fallback.
 * Purely conceptual illustration; represents no live ledger or transaction telemetry.
 */
export const HumanAiCommandVisual: React.FC<HumanAiCommandVisualProps> = ({ animate }) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[rgba(212,168,67,0.3)] bg-[#041120] shadow-[0_24px_60px_rgba(2,10,20,0.62)] ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      {/* 4:3 Optical Glass Financial Command Stage */}
      <div className="relative aspect-[4/3] w-full flex-1 overflow-hidden">
        {!imageError ? (
          <picture>
            <source srcSet={commandVisualWebp} type="image/webp" />
            <img
              src={commandVisualJpg}
              alt="Transparent digital financial records and verification shield connected by gold and cyan network pathways above a dark glass surface"
              width={1200}
              height={896}
              loading="lazy"
              decoding="async"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover object-center brightness-[0.94] contrast-[1.06] transition-transform duration-700 ease-out group-hover:scale-[1.025]"
            />
          </picture>
        ) : (
          <div
            aria-hidden="true"
            className="h-full w-full bg-[radial-gradient(circle_at_50%_45%,rgba(56,189,248,0.16),rgba(212,168,67,0.14)_36%,#041120_100%)]"
          />
        )}

        {/* Atmospheric Navy Scrim for Grounded Edge Contrast */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#041120] via-transparent to-[#041120]/40"
        />

        {/* Subtle Rotating Shield Verification Rings & Cyan/Gold Node Pulses */}
        <svg
          aria-hidden="true"
          viewBox="0 0 480 360"
          fill="none"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
        >
          <defs>
            <linearGradient id="destriaShieldRingGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E5B552" stopOpacity="0.62" />
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="destriaCyanStream" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
              <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.58" />
              <stop offset="100%" stopColor="#E5B552" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Outer slow verification orbit centered on shield */}
          <g className="destria-orbit-slow" style={{ transformOrigin: '248px 168px' }}>
            <circle
              cx="248"
              cy="168"
              r="112"
              stroke="url(#destriaShieldRingGold)"
              strokeWidth="1"
              strokeDasharray="10 14"
            />
            <circle cx="248" cy="56" r="2.4" fill="#38BDF8" fillOpacity="0.85" />
            <circle cx="360" cy="168" r="2.4" fill="#E5B552" fillOpacity="0.85" />
          </g>

          {/* Counter-rotating inner calibration ring */}
          <g className="destria-orbit-reverse" style={{ transformOrigin: '248px 168px' }}>
            <circle
              cx="248"
              cy="168"
              r="82"
              stroke="rgba(56, 189, 248, 0.28)"
              strokeWidth="0.9"
              strokeDasharray="5 11"
            />
            <circle cx="166" cy="168" r="2" fill="#E5B552" fillOpacity="0.8" />
          </g>

          {/* Horizontal cyan/gold digital connection pathways */}
          <path
            d="M 28 168 L 128 168"
            stroke="url(#destriaCyanStream)"
            strokeWidth="1.25"
            className="destria-neural-stream"
          />
          <path
            d="M 368 168 L 452 168"
            stroke="url(#destriaCyanStream)"
            strokeWidth="1.25"
            className="destria-ecosystem-stream"
          />

          {/* Ambient floating data particles */}
          <circle cx="88" cy="108" r="1.8" fill="#38BDF8" className="destria-particle-float" />
          <circle
            cx="402"
            cy="114"
            r="1.8"
            fill="#E5B552"
            className="destria-particle-float"
            style={{ animationDelay: '1.5s' }}
          />
          <circle
            cx="116"
            cy="244"
            r="1.5"
            fill="#E5B552"
            className="destria-particle-float"
            style={{ animationDelay: '2.4s' }}
          />
          <circle
            cx="378"
            cy="240"
            r="1.6"
            fill="#38BDF8"
            className="destria-particle-float"
            style={{ animationDelay: '0.9s' }}
          />
        </svg>

        {/* Soft Verification Scan Sweep */}
        <div
          aria-hidden="true"
          className="destria-card-scan-beam pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-[rgba(56,189,248,0.14)] to-transparent"
        />

        {/* Architectural Corner Brackets */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-4 h-4 w-4 border-l border-t border-[rgba(56,189,248,0.5)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 h-4 w-4 border-r border-t border-[rgba(212,168,67,0.55)]"
        />
      </div>

      {/* Grounded Caption Footer */}
      <div className="border-t border-[rgba(148,163,184,0.18)] bg-[#06182B]/95 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,168,67,0.38)] bg-[#0D2745]">
            <ShieldCheck className="h-4 w-4 text-[#E5B552]" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E5B552]">
              Credentialed Oversight &amp; Protected Records
            </p>
            <p className="text-sm font-medium text-white leading-snug">
              AI-Assisted Verification Paired with Human Authority
            </p>
            <p className="text-xs leading-relaxed text-slate-400">
              Conceptual visual representing structured document protection, traceable review checkpoints, and controlled client access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
