/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Staff Practice Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React from 'react';
import type { StaffMotionComplexity } from './useStaffPortalMotion';

interface StaffTechnologyBackgroundProps {
  /** Whether GPU-composited ambient CSS/SVG motion should actively play. */
  animate: boolean;
  /** Scales visual density for desktop ('full'), tablet ('reduced'), and mobile/low-power ('minimal'). */
  complexity: StaffMotionComplexity;
}

const NETWORK_NODES = [
  { id: 'n1', cx: 110, cy: 130, r: 3.5, accent: 'cyan', delay: '0s' },
  { id: 'n2', cx: 285, cy: 96, r: 4, accent: 'gold', delay: '0.9s' },
  { id: 'n3', cx: 470, cy: 165, r: 3.2, accent: 'cyan', delay: '1.6s' },
  { id: 'n4', cx: 180, cy: 310, r: 3.8, accent: 'gold', delay: '2.1s' },
  { id: 'n5', cx: 365, cy: 295, r: 4.2, accent: 'cyan', delay: '0.5s' },
  { id: 'n6', cx: 560, cy: 350, r: 3.5, accent: 'gold', delay: '1.3s' },
  { id: 'n7', cx: 140, cy: 525, r: 3.4, accent: 'cyan', delay: '2.6s' },
  { id: 'n8', cx: 340, cy: 560, r: 4, accent: 'gold', delay: '1.1s' },
  { id: 'n9', cx: 610, cy: 520, r: 3.2, accent: 'cyan', delay: '0.4s' },
  { id: 'n10', cx: 880, cy: 135, r: 3.6, accent: 'cyan', delay: '1.8s' },
  { id: 'n11', cx: 1090, cy: 92, r: 4, accent: 'gold', delay: '0.7s' },
  { id: 'n12', cx: 1290, cy: 185, r: 3.4, accent: 'cyan', delay: '2.2s' },
  { id: 'n13', cx: 960, cy: 390, r: 3.5, accent: 'gold', delay: '1.5s' },
  { id: 'n14', cx: 1215, cy: 430, r: 4.1, accent: 'cyan', delay: '0.3s' },
  { id: 'n15', cx: 1045, cy: 645, r: 3.8, accent: 'gold', delay: '1.9s' },
  { id: 'n16', cx: 1310, cy: 670, r: 3.2, accent: 'cyan', delay: '0.8s' },
  { id: 'n17', cx: 745, cy: 690, r: 3.5, accent: 'cyan', delay: '2.4s' },
  { id: 'n18', cx: 455, cy: 715, r: 3.6, accent: 'gold', delay: '1.4s' }
] as const;

const NETWORK_LINKS: Array<{
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  accent: 'cyan' | 'gold';
  pulsed?: boolean;
}> = [
  { id: 'l1', x1: 110, y1: 130, x2: 285, y2: 96, accent: 'cyan', pulsed: true },
  { id: 'l2', x1: 285, y1: 96, x2: 470, y2: 165, accent: 'gold', pulsed: true },
  { id: 'l3', x1: 110, y1: 130, x2: 180, y2: 310, accent: 'cyan' },
  { id: 'l4', x1: 285, y1: 96, x2: 365, y2: 295, accent: 'cyan', pulsed: true },
  { id: 'l5', x1: 180, y1: 310, x2: 365, y2: 295, accent: 'gold' },
  { id: 'l6', x1: 365, y1: 295, x2: 470, y2: 165, accent: 'cyan' },
  { id: 'l7', x1: 365, y1: 295, x2: 560, y2: 350, accent: 'gold', pulsed: true },
  { id: 'l8', x1: 180, y1: 310, x2: 140, y2: 525, accent: 'cyan' },
  { id: 'l9', x1: 140, y1: 525, x2: 340, y2: 560, accent: 'gold', pulsed: true },
  { id: 'l10', x1: 365, y1: 295, x2: 340, y2: 560, accent: 'cyan' },
  { id: 'l11', x1: 340, y1: 560, x2: 610, y2: 520, accent: 'cyan', pulsed: true },
  { id: 'l12', x1: 560, y1: 350, x2: 610, y2: 520, accent: 'gold' },
  { id: 'l13', x1: 470, y1: 165, x2: 880, y2: 135, accent: 'cyan', pulsed: true },
  { id: 'l14', x1: 880, y1: 135, x2: 1090, y2: 92, accent: 'gold' },
  { id: 'l15', x1: 1090, y1: 92, x2: 1290, y2: 185, accent: 'cyan', pulsed: true },
  { id: 'l16', x1: 880, y1: 135, x2: 960, y2: 390, accent: 'cyan' },
  { id: 'l17', x1: 1290, y1: 185, x2: 1215, y2: 430, accent: 'gold', pulsed: true },
  { id: 'l18', x1: 960, y1: 390, x2: 1215, y2: 430, accent: 'cyan' },
  { id: 'l19', x1: 960, y1: 390, x2: 1045, y2: 645, accent: 'gold' },
  { id: 'l20', x1: 1215, y1: 430, x2: 1310, y2: 670, accent: 'cyan', pulsed: true },
  { id: 'l21', x1: 1045, y1: 645, x2: 1310, y2: 670, accent: 'gold' },
  { id: 'l22', x1: 610, y1: 520, x2: 745, y2: 690, accent: 'cyan' },
  { id: 'l23', x1: 340, y1: 560, x2: 455, y2: 715, accent: 'gold' },
  { id: 'l24', x1: 455, y1: 715, x2: 745, y2: 690, accent: 'cyan', pulsed: true },
  { id: 'l25', x1: 745, y1: 690, x2: 1045, y2: 645, accent: 'gold' }
];

/**
 * Lightweight decorative blockchain-inspired & financial-technology network backdrop.
 * Pure SVG + GPU-composited CSS animations; strictly decorative with zero credential access.
 */
export const StaffTechnologyBackground: React.FC<StaffTechnologyBackgroundProps> = ({
  animate,
  complexity
}) => {
  const isMinimal = complexity === 'minimal';
  const isFull = complexity === 'full';

  return (
    <div
      aria-hidden="true"
      data-testid="staff-technology-background"
      data-motion-state={animate ? 'running' : 'paused'}
      data-motion-complexity={complexity}
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      {/* Architectural Midnight Navy -> Deep Blue radial atmospheric depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 72% 62% at 18% 22%, rgba(0, 194, 209, 0.10), transparent 58%), radial-gradient(ellipse 65% 58% at 82% 76%, rgba(212, 175, 55, 0.09), transparent 60%), linear-gradient(155deg, #061426 0%, #0B1F36 52%, #051120 100%)'
        }}
      />

      {/* Precision FinTech architectural coordinate grid */}
      <div
        className={`absolute inset-0 opacity-55 ${
          isFull ? 'staff-tech-grid-layer' : 'staff-tech-grid-static'
        }`}
      />

      {/* Top and bottom hairline metallic gold framing accents */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#00C2D1]/25 to-transparent" />

      {/* Lightweight SVG distributed-ledger-inspired node mesh and flowing data curves */}
      {!isMinimal ? (
        <svg
          viewBox="0 0 1440 820"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full opacity-75"
          focusable="false"
        >
          <defs>
            <linearGradient id="staff-cyan-stream" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00C2D1" stopOpacity="0" />
              <stop offset="50%" stopColor="#00C2D1" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#00C2D1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="staff-gold-stream" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0" />
              <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="staff-node-cyan" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#00C2D1" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#00C2D1" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#00C2D1" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="staff-node-gold" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#D4AF37" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Flowing abstract financial data pathways */}
          <g fill="none" strokeLinecap="round">
            <path
              d="M -60 220 C 240 165, 440 315, 760 245 C 1020 185, 1240 280, 1500 210"
              stroke="url(#staff-cyan-stream)"
              strokeWidth="1.25"
              className="staff-data-curve"
            />
            <path
              d="M -40 595 C 260 650, 520 510, 815 570 C 1080 625, 1265 515, 1500 565"
              stroke="url(#staff-gold-stream)"
              strokeWidth="1.15"
              className="staff-data-curve-slow"
            />
            {isFull && (
              <path
                d="M -20 410 C 310 355, 595 465, 920 390 C 1155 335, 1320 430, 1480 385"
                stroke="rgba(0, 194, 209, 0.14)"
                strokeWidth="1"
              />
            )}
          </g>

          {/* Slowly rotating abstract geometric digital structures */}
          {isFull && (
            <g opacity="0.22">
              <g transform="translate(275 340)">
                <g className="destria-orbit-slow">
                  <polygon
                    points="0,-168 145,-84 145,84 0,168 -145,84 -145,-84"
                    fill="none"
                    stroke="#00C2D1"
                    strokeWidth="0.9"
                    strokeDasharray="6 10"
                  />
                  <circle cx="0" cy="0" r="118" fill="none" stroke="#D4AF37" strokeWidth="0.7" />
                </g>
              </g>
              <g transform="translate(1155 470)">
                <g className="destria-orbit-reverse">
                  <polygon
                    points="0,-128 111,-64 111,64 0,128 -111,64 -111,-64"
                    fill="none"
                    stroke="#D4AF37"
                    strokeWidth="0.85"
                    strokeDasharray="5 11"
                  />
                  <circle cx="0" cy="0" r="88" fill="none" stroke="#00C2D1" strokeWidth="0.7" />
                </g>
              </g>
            </g>
          )}

          {/* Interconnected blockchain-inspired verification links */}
          <g fill="none">
            {NETWORK_LINKS.map((link) => (
              <React.Fragment key={link.id}>
                <line
                  x1={link.x1}
                  y1={link.y1}
                  x2={link.x2}
                  y2={link.y2}
                  stroke={
                    link.accent === 'gold'
                      ? 'rgba(212, 175, 55, 0.18)'
                      : 'rgba(0, 194, 209, 0.17)'
                  }
                  strokeWidth="1"
                />
                {link.pulsed && (
                  <line
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke={link.accent === 'gold' ? '#D4AF37' : '#00C2D1'}
                    strokeWidth="1.35"
                    strokeLinecap="round"
                    opacity="0.58"
                    className={
                      link.accent === 'gold'
                        ? 'staff-pulse-stream-gold'
                        : 'staff-pulse-stream-cyan'
                    }
                  />
                )}
              </React.Fragment>
            ))}
          </g>

          {/* Subtle glowing verification nodes */}
          <g>
            {NETWORK_NODES.map((node) => (
              <g key={node.id}>
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r * 3.4}
                  fill={node.accent === 'gold' ? 'url(#staff-node-gold)' : 'url(#staff-node-cyan)'}
                  className="staff-node-halo"
                  style={{ animationDelay: node.delay }}
                />
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r}
                  fill="#061426"
                  stroke={node.accent === 'gold' ? '#D4AF37' : '#00C2D1'}
                  strokeWidth="1.35"
                />
              </g>
            ))}
          </g>

          {/* Subtle floating depth particles & faint cyan trails (full desktop mode only) */}
          {isFull && (
            <g opacity="0.65">
              {[
                { cx: 215, cy: 195, r: 1.8, fill: '#00C2D1', delay: '0s' },
                { cx: 520, cy: 255, r: 1.5, fill: '#D4AF37', delay: '1.1s' },
                { cx: 695, cy: 170, r: 1.7, fill: '#00C2D1', delay: '2.2s' },
                { cx: 830, cy: 485, r: 1.6, fill: '#D4AF37', delay: '0.6s' },
                { cx: 1170, cy: 295, r: 1.9, fill: '#00C2D1', delay: '1.7s' },
                { cx: 410, cy: 645, r: 1.5, fill: '#00C2D1', delay: '2.8s' },
                { cx: 920, cy: 710, r: 1.7, fill: '#D4AF37', delay: '1.4s' }
              ].map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.cx}
                  cy={p.cy}
                  r={p.r}
                  fill={p.fill}
                  className="destria-particle-float"
                  style={{ animationDelay: p.delay }}
                />
              ))}
            </g>
          )}
        </svg>
      ) : (
        /* Mobile / low-power simplified geometric accent — zero expensive animations or blurs */
        <svg
          viewBox="0 0 640 480"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full opacity-45"
          focusable="false"
        >
          <g fill="none" strokeWidth="1">
            <line x1="40" y1="80" x2="220" y2="55" stroke="rgba(0, 194, 209, 0.20)" />
            <line x1="220" y1="55" x2="460" y2="115" stroke="rgba(212, 175, 55, 0.22)" />
            <line x1="460" y1="115" x2="600" y2="75" stroke="rgba(0, 194, 209, 0.18)" />
            <line x1="80" y1="395" x2="310" y2="425" stroke="rgba(212, 175, 55, 0.18)" />
            <line x1="310" y1="425" x2="575" y2="380" stroke="rgba(0, 194, 209, 0.18)" />
          </g>
          <g>
            <circle cx="220" cy="55" r="3" fill="#061426" stroke="#D4AF37" strokeWidth="1.25" />
            <circle cx="460" cy="115" r="3" fill="#061426" stroke="#00C2D1" strokeWidth="1.25" />
            <circle cx="310" cy="425" r="3" fill="#061426" stroke="#D4AF37" strokeWidth="1.25" />
          </g>
        </svg>
      )}
    </div>
  );
};

export default StaffTechnologyBackground;
