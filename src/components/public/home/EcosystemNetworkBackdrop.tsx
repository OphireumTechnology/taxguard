import React from 'react';

export interface EcosystemNodePosition {
  id: string;
  number: string;
  x: number;
  y: number;
  pipelineStage: number;
}

/**
 * Coordinates in a 1200x760 conceptual topology aligned with the 3x3 capability grid.
 */
export const ECOSYSTEM_NODES: EcosystemNodePosition[] = [
  { id: 'ai-tax-prep', number: '01', x: 200, y: 135, pipelineStage: 1 },
  { id: 'doc-recognition', number: '02', x: 600, y: 115, pipelineStage: 0 },
  { id: 'auto-reconciliation', number: '03', x: 1000, y: 135, pipelineStage: 2 },
  { id: 'tax-compliance', number: '04', x: 200, y: 380, pipelineStage: 3 },
  { id: 'anomaly-detection', number: '05', x: 600, y: 380, pipelineStage: 2 },
  { id: 'intelligent-bookkeeping', number: '06', x: 1000, y: 380, pipelineStage: 1 },
  { id: 'strategic-analytics', number: '07', x: 200, y: 625, pipelineStage: 2 },
  { id: 'secure-doc-mgmt', number: '08', x: 600, y: 645, pipelineStage: 0 },
  { id: 'professional-review', number: '09', x: 1000, y: 625, pipelineStage: 4 },
];

interface EdgeDef {
  id: string;
  from: string;
  to: string;
  accent: 'gold' | 'cyan';
  duration: string;
  delay: string;
}

const ECOSYSTEM_EDGES: EdgeDef[] = [
  { id: 'e-01-02', from: 'ai-tax-prep', to: 'doc-recognition', accent: 'gold', duration: '6.4s', delay: '0s' },
  { id: 'e-02-03', from: 'doc-recognition', to: 'auto-reconciliation', accent: 'cyan', duration: '7.1s', delay: '1.2s' },
  { id: 'e-01-04', from: 'ai-tax-prep', to: 'tax-compliance', accent: 'cyan', duration: '6.8s', delay: '0.6s' },
  { id: 'e-02-05', from: 'doc-recognition', to: 'anomaly-detection', accent: 'gold', duration: '5.9s', delay: '1.8s' },
  { id: 'e-03-06', from: 'auto-reconciliation', to: 'intelligent-bookkeeping', accent: 'gold', duration: '6.5s', delay: '0.9s' },
  { id: 'e-04-05', from: 'tax-compliance', to: 'anomaly-detection', accent: 'gold', duration: '7.4s', delay: '2.1s' },
  { id: 'e-05-06', from: 'anomaly-detection', to: 'intelligent-bookkeeping', accent: 'cyan', duration: '6.2s', delay: '1.5s' },
  { id: 'e-04-07', from: 'tax-compliance', to: 'strategic-analytics', accent: 'cyan', duration: '7.0s', delay: '0.4s' },
  { id: 'e-05-08', from: 'anomaly-detection', to: 'secure-doc-mgmt', accent: 'gold', duration: '6.0s', delay: '2.4s' },
  { id: 'e-06-09', from: 'intelligent-bookkeeping', to: 'professional-review', accent: 'gold', duration: '6.6s', delay: '1.0s' },
  { id: 'e-07-08', from: 'strategic-analytics', to: 'secure-doc-mgmt', accent: 'cyan', duration: '6.9s', delay: '1.7s' },
  { id: 'e-08-09', from: 'secure-doc-mgmt', to: 'professional-review', accent: 'gold', duration: '5.8s', delay: '0.3s' },
  // Cross-verification diagonals connecting preparation, integrity, and human review
  { id: 'e-01-05', from: 'ai-tax-prep', to: 'anomaly-detection', accent: 'gold', duration: '8.2s', delay: '2.8s' },
  { id: 'e-03-05', from: 'auto-reconciliation', to: 'anomaly-detection', accent: 'cyan', duration: '8.0s', delay: '3.4s' },
  { id: 'e-05-09', from: 'anomaly-detection', to: 'professional-review', accent: 'gold', duration: '7.6s', delay: '0.8s' },
  { id: 'e-04-08', from: 'tax-compliance', to: 'secure-doc-mgmt', accent: 'cyan', duration: '8.4s', delay: '2.0s' },
];

const NODE_BY_ID = new Map(ECOSYSTEM_NODES.map((n) => [n.id, n]));

interface EcosystemNetworkBackdropProps {
  activeCapabilityId: string | null;
  highlightedCapabilityIds: Set<string>;
  shouldAnimate: boolean;
}

/**
 * Conceptual blockchain-inspired transparency network rendered behind the 9 capability cards.
 * Pure SVG + GPU-friendly CSS animations; pauses automatically off-screen and under reduced motion.
 */
export const EcosystemNetworkBackdrop: React.FC<EcosystemNetworkBackdropProps> = ({
  activeCapabilityId,
  highlightedCapabilityIds,
  shouldAnimate,
}) => {
  const isNodeActive = (id: string) =>
    activeCapabilityId === id || highlightedCapabilityIds.has(id);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]"
      aria-hidden="true"
    >
      {/* Subtle architectural ledger-grid ambiance */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 18%, rgba(212, 168, 67, 0.08), transparent 42%), radial-gradient(circle at 82% 76%, rgba(56, 189, 248, 0.07), transparent 44%), linear-gradient(to right, rgba(148, 163, 184, 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.045) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 56px 56px, 56px 56px',
        }}
      />

      {/* Conceptual transparency pathway mesh (full detail on md+, clean ambient glow on mobile) */}
      <svg
        viewBox="0 0 1200 760"
        preserveAspectRatio="none"
        className="hidden md:block absolute inset-0 w-full h-full opacity-90"
      >
        <defs>
          <linearGradient id="destria-net-gold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.18" />
            <stop offset="50%" stopColor="#E5B552" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="destria-net-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.14" />
            <stop offset="50%" stopColor="#7DD3FC" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.14" />
          </linearGradient>
          <radialGradient id="destria-node-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#E5B552" stopOpacity="0.45" />
            <stop offset="55%" stopColor="#38BDF8" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#06182B" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle geometric ledger-inspired structural perimeter lines */}
        <g opacity="0.22" stroke="#94A3B8" strokeWidth="0.6" fill="none">
          <path d="M 48 92 H 1152" strokeDasharray="3 9" />
          <path d="M 48 380 H 1152" strokeDasharray="3 9" />
          <path d="M 48 668 H 1152" strokeDasharray="3 9" />
          <path d="M 400 32 V 728" strokeDasharray="2 10" />
          <path d="M 800 32 V 728" strokeDasharray="2 10" />
        </g>

        {/* Interconnected pathways & animated data particles */}
        {ECOSYSTEM_EDGES.map((edge) => {
          const start = NODE_BY_ID.get(edge.from);
          const end = NODE_BY_ID.get(edge.to);
          if (!start || !end) return null;

          const edgeActive =
            isNodeActive(edge.from) || isNodeActive(edge.to);
          const pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
          const strokeColor =
            edge.accent === 'gold'
              ? 'url(#destria-net-gold)'
              : 'url(#destria-net-cyan)';

          return (
            <g key={edge.id}>
              {/* Base structural trace */}
              <path
                d={pathD}
                fill="none"
                stroke={edgeActive ? strokeColor : 'rgba(148, 163, 184, 0.16)'}
                strokeWidth={edgeActive ? 1.75 : 0.9}
                className="transition-all duration-300"
              />

              {/* Animated flowing ledger trace */}
              <path
                d={pathD}
                fill="none"
                stroke={edge.accent === 'gold' ? '#E5B552' : '#7DD3FC'}
                strokeWidth={edgeActive ? 1.8 : 1.05}
                strokeOpacity={edgeActive ? 0.85 : 0.34}
                className="destria-ecosystem-stream"
                style={{
                  animationDuration: edge.duration,
                  animationDelay: edge.delay,
                }}
              />

              {/* Moving data particle along pathway when in view & motion enabled */}
              {shouldAnimate && (
                <circle
                  r={edgeActive ? 3.2 : 2.1}
                  fill={edge.accent === 'gold' ? '#F3CE74' : '#7DD3FC'}
                  opacity={edgeActive ? 0.95 : 0.65}
                >
                  <animateMotion
                    dur={edge.duration}
                    begin={edge.delay}
                    repeatCount="indefinite"
                    path={pathD}
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Nine ledger-inspired intersection nodes behind the cards */}
        {ECOSYSTEM_NODES.map((node) => {
          const active = isNodeActive(node.id);
          return (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
              <circle
                r={active ? 46 : 26}
                fill="url(#destria-node-halo)"
                opacity={active ? 0.9 : 0.38}
                className="transition-all duration-300"
              />
              <polygon
                points="0,-13 11,-6.5 11,6.5 0,13 -11,6.5 -11,-6.5"
                fill="rgba(6, 24, 43, 0.9)"
                stroke={active ? '#E5B552' : 'rgba(125, 211, 252, 0.38)'}
                strokeWidth={active ? 1.4 : 0.9}
                className="transition-all duration-300"
              />
              <circle
                r={active ? 3.5 : 2.2}
                fill={active ? '#E5B552' : '#7DD3FC'}
                opacity={active ? 1 : 0.7}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};
