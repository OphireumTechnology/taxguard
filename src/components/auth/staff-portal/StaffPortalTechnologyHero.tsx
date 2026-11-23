/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Staff Practice Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React from 'react';
import type { StaffMotionComplexity } from './useStaffPortalMotion';

interface StaffPortalTechnologyHeroProps {
  /** Controls ambient animation playback for visibility, off-screen, and reduced-motion pausing. */
  animate: boolean;
  /** Scales decorative visual detail across desktop, tablet, and mobile devices. */
  complexity: StaffMotionComplexity;
}

const OPERATIONAL_PILLARS = [
  {
    id: 'secure-access',
    label: 'Secure Staff Access',
    detail: 'Role-scoped practitioner sessions'
  },
  {
    id: 'verified-workflows',
    label: 'Verified Workflows',
    detail: 'Traceable review & sign-off trails'
  },
  {
    id: 'intelligent-ops',
    label: 'Intelligent Tax Operations',
    detail: 'Structured AI-assisted preparation'
  }
] as const;

/**
 * Left-column executive FinTech presentation for the Staff Practice Portal.
 * Strictly presentational: renders no client records, live telemetry, or unverified claims.
 */
export const StaffPortalTechnologyHero: React.FC<StaffPortalTechnologyHeroProps> = ({
  animate,
  complexity
}) => {
  const showFullOrbitalDetail = complexity === 'full';

  return (
    <section
      aria-label="Destria Tax Services Staff Practice Technology Overview"
      className={`flex flex-col justify-between space-y-5 lg:space-y-6 ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      {/* Headline & Editorial Introduction */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#D4AF37]">
          Destria Tax Services LLC &middot; TaxGuard Practice Architecture
        </p>

        <h2
          className="font-serif text-3xl sm:text-4xl lg:text-[2.45rem] font-extrabold leading-[1.12] tracking-tight text-white"
          style={{ textWrap: 'balance' }}
        >
          SECURE INTELLIGENCE.{' '}
          <span className="block sm:inline text-[#D4AF37]">TRANSPARENT OPERATIONS.</span>
        </h2>

        <p className="max-w-xl text-sm leading-relaxed text-[#A8B8CC]">
          Access the Destria Tax Services professional workspace through a secure,
          technology-driven environment designed for accuracy, accountability, and operational
          excellence.
        </p>
      </div>

      {/* Transparent 3D Isometric Digital Network & Financial Security Shield Illustration */}
      <div className="relative overflow-hidden rounded-2xl border border-[#00C2D1]/20 bg-[#0B1F36]/55 p-3.5 sm:p-5 shadow-[0_24px_64px_rgba(2,10,22,0.52)]">
        {/* Hairline metallic gold top accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/55 to-transparent"
        />

        <div className="relative aspect-[16/9] max-h-[300px] w-full">
          <svg
            viewBox="0 0 640 400"
            role="img"
            aria-label="Abstract three-dimensional financial data-security shield connected to an illuminated digital verification network"
            className="h-full w-full"
          >
            <defs>
              <radialGradient id="hero-core-glow" cx="50%" cy="48%" r="48%">
                <stop offset="0%" stopColor="#00C2D1" stopOpacity="0.22" />
                <stop offset="48%" stopColor="#D4AF37" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#061426" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="hero-shield-surface" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#123156" stopOpacity="0.92" />
                <stop offset="55%" stopColor="#0B1F36" stopOpacity="0.96" />
                <stop offset="100%" stopColor="#061426" stopOpacity="0.98" />
              </linearGradient>
              <linearGradient id="hero-gold-edge" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#E6C766" />
                <stop offset="50%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#9C7A1F" />
              </linearGradient>
              <linearGradient id="hero-cyan-edge" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00C2D1" stopOpacity="0.15" />
                <stop offset="50%" stopColor="#00C2D1" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#00C2D1" stopOpacity="0.15" />
              </linearGradient>
            </defs>

            {/* Central atmospheric halo */}
            <rect width="640" height="400" fill="url(#hero-core-glow)" />

            {/* Perspective 3D translucent base grid plane */}
            <g stroke="rgba(0, 194, 209, 0.14)" strokeWidth="0.9" fill="none">
              <polygon points="320,310 555,225 320,145 85,225" fill="rgba(6, 20, 38, 0.35)" />
              <line x1="143" y1="205" x2="379" y2="288" />
              <line x1="202" y1="185" x2="437" y2="267" />
              <line x1="261" y1="165" x2="496" y2="246" />
              <line x1="143" y1="246" x2="379" y2="165" />
              <line x1="202" y1="267" x2="437" y2="185" />
              <line x1="261" y1="288" x2="496" y2="205" />
            </g>

            {/* Elevated translucent data plane rings (3D depth perspective) */}
            <g fill="none">
              <ellipse
                cx="320"
                cy="218"
                rx="212"
                ry="76"
                stroke="rgba(0, 194, 209, 0.24)"
                strokeWidth="1"
                strokeDasharray="4 8"
              />
              <ellipse
                cx="320"
                cy="200"
                rx="158"
                ry="56"
                stroke="rgba(212, 175, 55, 0.32)"
                strokeWidth="1.15"
              />
            </g>

            {/* Slowly rotating precision orbital geometry behind the shield */}
            <g transform="translate(320 192)">
              <g className={showFullOrbitalDetail ? 'destria-orbit-slow' : undefined}>
                <circle
                  cx="0"
                  cy="0"
                  r="116"
                  fill="none"
                  stroke="rgba(0, 194, 209, 0.26)"
                  strokeWidth="1"
                  strokeDasharray="8 12"
                />
                <circle cx="116" cy="0" r="3.5" fill="#00C2D1" />
                <circle cx="-116" cy="0" r="3.5" fill="#D4AF37" />
              </g>
              <g className={showFullOrbitalDetail ? 'destria-orbit-reverse' : undefined}>
                <polygon
                  points="0,-90 78,-45 78,45 0,90 -78,45 -78,-45"
                  fill="none"
                  stroke="rgba(212, 175, 55, 0.28)"
                  strokeWidth="1"
                />
                <circle cx="0" cy="-90" r="3" fill="#D4AF37" />
                <circle cx="78" cy="45" r="2.75" fill="#00C2D1" />
                <circle cx="-78" cy="45" r="2.75" fill="#00C2D1" />
              </g>
            </g>

            {/* Interconnected AI & blockchain-inspired network pathways */}
            <g fill="none" strokeLinecap="round">
              {/* Left cluster conduits */}
              <path
                d="M 98 118 L 194 148 L 266 178"
                stroke="rgba(0, 194, 209, 0.32)"
                strokeWidth="1.2"
              />
              <path
                d="M 98 118 L 194 148 L 266 178"
                stroke="#00C2D1"
                strokeWidth="1.6"
                className="staff-pulse-stream-cyan"
              />

              <path
                d="M 86 274 L 188 242 L 268 214"
                stroke="rgba(212, 175, 55, 0.28)"
                strokeWidth="1.2"
              />
              <path
                d="M 86 274 L 188 242 L 268 214"
                stroke="#D4AF37"
                strokeWidth="1.5"
                className="staff-pulse-stream-gold"
              />

              {/* Right cluster conduits */}
              <path
                d="M 542 118 L 446 148 L 374 178"
                stroke="rgba(212, 175, 55, 0.30)"
                strokeWidth="1.2"
              />
              <path
                d="M 542 118 L 446 148 L 374 178"
                stroke="#D4AF37"
                strokeWidth="1.5"
                className="staff-pulse-stream-gold"
              />

              <path
                d="M 554 274 L 452 242 L 372 214"
                stroke="rgba(0, 194, 209, 0.32)"
                strokeWidth="1.2"
              />
              <path
                d="M 554 274 L 452 242 L 372 214"
                stroke="#00C2D1"
                strokeWidth="1.6"
                className="staff-pulse-stream-cyan"
              />

              {/* Vertical governance spine & cross-ledger links */}
              <path
                d="M 194 148 L 188 242 M 446 148 L 452 242"
                stroke="rgba(168, 184, 204, 0.20)"
                strokeWidth="1"
              />
              <path
                d="M 320 62 L 320 118 M 320 278 L 320 342"
                stroke="url(#hero-cyan-edge)"
                strokeWidth="1.25"
              />
            </g>

            {/* Minimalist translucent glass-card data structures (strictly decorative) */}
            <g>
              {/* Top-left translucent panel */}
              <rect
                x="44"
                y="90"
                width="108"
                height="54"
                rx="10"
                fill="rgba(11, 31, 54, 0.82)"
                stroke="rgba(0, 194, 209, 0.35)"
                strokeWidth="1"
              />
              <line x1="58" y1="109" x2="108" y2="109" stroke="#00C2D1" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
              <line x1="58" y1="121" x2="134" y2="121" stroke="#A8B8CC" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
              <line x1="58" y1="131" x2="118" y2="131" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />

              {/* Bottom-left translucent panel */}
              <rect
                x="34"
                y="246"
                width="108"
                height="54"
                rx="10"
                fill="rgba(11, 31, 54, 0.82)"
                stroke="rgba(212, 175, 55, 0.35)"
                strokeWidth="1"
              />
              <rect x="48" y="264" width="12" height="22" rx="2" fill="#00C2D1" opacity="0.45" />
              <rect x="66" y="258" width="12" height="28" rx="2" fill="#D4AF37" opacity="0.72" />
              <rect x="84" y="268" width="12" height="18" rx="2" fill="#00C2D1" opacity="0.65" />
              <rect x="102" y="254" width="12" height="32" rx="2" fill="#D4AF37" opacity="0.45" />

              {/* Top-right translucent panel */}
              <rect
                x="488"
                y="90"
                width="108"
                height="54"
                rx="10"
                fill="rgba(11, 31, 54, 0.82)"
                stroke="rgba(212, 175, 55, 0.35)"
                strokeWidth="1"
              />
              <polyline
                points="502,128 522,116 540,122 560,105 582,111"
                fill="none"
                stroke="#D4AF37"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="560" cy="105" r="2.75" fill="#00C2D1" />
              <circle cx="582" cy="111" r="2.75" fill="#D4AF37" />

              {/* Bottom-right translucent panel */}
              <rect
                x="498"
                y="246"
                width="108"
                height="54"
                rx="10"
                fill="rgba(11, 31, 54, 0.82)"
                stroke="rgba(0, 194, 209, 0.35)"
                strokeWidth="1"
              />
              <circle cx="520" cy="273" r="10" fill="none" stroke="#00C2D1" strokeWidth="1.5" opacity="0.8" />
              <path d="M 516 273 L 519 276 L 525 269" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="538" y1="268" x2="588" y2="268" stroke="#A8B8CC" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
              <line x1="538" y1="279" x2="574" y2="279" stroke="#00C2D1" strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
            </g>

            {/* Interconnected verification nodes */}
            <g>
              {[
                { cx: 194, cy: 148, color: '#00C2D1' },
                { cx: 188, cy: 242, color: '#D4AF37' },
                { cx: 446, cy: 148, color: '#D4AF37' },
                { cx: 452, cy: 242, color: '#00C2D1' },
                { cx: 320, cy: 62, color: '#00C2D1' },
                { cx: 320, cy: 342, color: '#D4AF37' }
              ].map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r="11"
                    fill={pt.color}
                    opacity="0.14"
                    className="staff-node-halo"
                    style={{ animationDelay: `${idx * 0.45}s` }}
                  />
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r="4.5"
                    fill="#061426"
                    stroke={pt.color}
                    strokeWidth="1.75"
                  />
                </g>
              ))}
            </g>

            {/* Central Abstract Financial Data-Security Shield */}
            <g className="staff-shield-float">
              {/* Outer metallic gold architectural shield contour */}
              <path
                d="M 320 116 L 382 142 V 196 C 382 238 355 269 320 284 C 285 269 258 238 258 196 V 142 Z"
                fill="url(#hero-shield-surface)"
                stroke="url(#hero-gold-edge)"
                strokeWidth="2.1"
              />
              {/* Inner cyan security facet */}
              <path
                d="M 320 128 L 370 149 V 195 C 370 230 348 256 320 269 C 292 256 270 230 270 195 V 149 Z"
                fill="none"
                stroke="rgba(0, 194, 209, 0.45)"
                strokeWidth="1.15"
              />
              {/* Internal AI neural-lattice geometry inside the shield */}
              <g stroke="rgba(0, 194, 209, 0.35)" strokeWidth="1" fill="none">
                <line x1="320" y1="156" x2="294" y2="188" />
                <line x1="320" y1="156" x2="346" y2="188" />
                <line x1="294" y1="188" x2="320" y2="226" />
                <line x1="346" y1="188" x2="320" y2="226" />
                <line x1="294" y1="188" x2="346" y2="188" />
              </g>
              {/* Shield verification crest */}
              <circle cx="320" cy="156" r="3.2" fill="#00C2D1" />
              <circle cx="294" cy="188" r="3" fill="#D4AF37" />
              <circle cx="346" cy="188" r="3" fill="#D4AF37" />
              <circle cx="320" cy="226" r="3.2" fill="#00C2D1" />
              <circle cx="320" cy="191" r="14" fill="#061426" stroke="#D4AF37" strokeWidth="1.6" />
              <path
                d="M 314 191.5 L 318.5 196 L 327 186.5"
                fill="none"
                stroke="#00C2D1"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Three Minimalist Informational Labels — clean, unboxed editorial hairline strip */}
      <dl className="grid grid-cols-1 gap-4 border-t border-white/10 pt-5 sm:grid-cols-3 sm:gap-6">
        {OPERATIONAL_PILLARS.map((item, idx) => (
          <div
            key={item.id}
            className="space-y-1 sm:border-l sm:border-white/10 sm:first:border-l-0 sm:pl-5 sm:first:pl-0"
          >
            <dt className="flex items-center gap-2 text-xs font-semibold tracking-wide text-white">
              <span
                aria-hidden="true"
                className="font-mono text-[10px] font-medium tabular-nums text-[#D4AF37]"
              >
                0{idx + 1}
              </span>
              <span>{item.label}</span>
            </dt>
            <dd className="text-xs leading-relaxed text-[#A8B8CC]">{item.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
