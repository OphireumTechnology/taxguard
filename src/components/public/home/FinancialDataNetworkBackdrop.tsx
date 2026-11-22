import React from 'react';

interface FinancialDataNetworkBackdropProps {
  animate: boolean;
}

/**
 * Subtle architectural financial network positioned behind the Core Services heading.
 * Purely decorative, GPU-composited, and pauses automatically when off-screen or reduced-motion.
 */
export const FinancialDataNetworkBackdrop: React.FC<FinancialDataNetworkBackdropProps> = ({
  animate
}) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 -top-6 h-56 overflow-hidden opacity-65 ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      <svg
        viewBox="0 0 1200 220"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="destriaCoreNetGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0" />
            <stop offset="35%" stopColor="#D4A843" stopOpacity="0.28" />
            <stop offset="72%" stopColor="#E1BB60" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#93C5FD" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="destriaCoreNetBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0" />
            <stop offset="55%" stopColor="#93C5FD" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Subtle geometric network conduits biased toward the right side of the heading */}
        <path
          d="M 520 42 L 740 42 L 812 92 L 1020 92 L 1160 54"
          stroke="rgba(148, 163, 184, 0.14)"
          strokeWidth="1"
        />
        <path
          d="M 520 42 L 740 42 L 812 92 L 1020 92 L 1160 54"
          stroke="url(#destriaCoreNetGold)"
          strokeWidth="1.25"
          className="destria-ecosystem-stream"
        />

        <path
          d="M 610 156 L 780 156 L 858 118 L 1068 118 L 1180 162"
          stroke="rgba(148, 163, 184, 0.12)"
          strokeWidth="1"
        />
        <path
          d="M 610 156 L 780 156 L 858 118 L 1068 118 L 1180 162"
          stroke="url(#destriaCoreNetBlue)"
          strokeWidth="1.2"
          className="destria-neural-stream"
        />

        {/* Interconnecting vertical verification lines */}
        <line x1="740" y1="42" x2="780" y2="156" stroke="rgba(212, 168, 67, 0.14)" strokeWidth="0.9" />
        <line x1="812" y1="92" x2="858" y2="118" stroke="rgba(212, 168, 67, 0.18)" strokeWidth="0.9" />
        <line x1="1020" y1="92" x2="1068" y2="118" stroke="rgba(147, 197, 253, 0.18)" strokeWidth="0.9" />

        {/* Subtle architectural node markers */}
        {[
          { cx: 740, cy: 42, delay: '0s' },
          { cx: 812, cy: 92, delay: '0.9s' },
          { cx: 1020, cy: 92, delay: '1.8s' },
          { cx: 780, cy: 156, delay: '1.2s' },
          { cx: 858, cy: 118, delay: '2.1s' },
          { cx: 1068, cy: 118, delay: '0.5s' }
        ].map((node) => (
          <g key={`${node.cx}-${node.cy}`}>
            <circle
              cx={node.cx}
              cy={node.cy}
              r="5.5"
              stroke="rgba(212, 168, 67, 0.24)"
              strokeWidth="0.9"
              className="destria-checkpoint-glow"
              style={{ animationDelay: node.delay }}
            />
            <circle cx={node.cx} cy={node.cy} r="2.2" fill="#E1BB60" fillOpacity="0.72" />
          </g>
        ))}

        {/* Slow floating ambient light particles */}
        <circle cx="670" cy="76" r="1.5" fill="#E1BB60" className="destria-particle-float" />
        <circle
          cx="932"
          cy="62"
          r="1.4"
          fill="#93C5FD"
          className="destria-particle-float"
          style={{ animationDelay: '1.7s' }}
        />
        <circle
          cx="964"
          cy="168"
          r="1.6"
          fill="#E1BB60"
          className="destria-particle-float"
          style={{ animationDelay: '2.6s' }}
        />
      </svg>
    </div>
  );
};
