import React from 'react';

interface StrategyAmbientBackdropProps {
  shouldAnimate: boolean;
}

/**
 * Restrained architectural technology backdrop for the Tax Strategy Center canvas.
 * Keeps heading and body text areas visually calm while framing page margins with
 * subtle ledger gridlines and slow-moving metallic gold & sapphire pathways.
 */
export const StrategyAmbientBackdrop: React.FC<StrategyAmbientBackdropProps> = ({
  shouldAnimate,
}) => {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Subtle architectural grid pattern & quiet radial depth */}
      <div
        className="absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 68% 36% at 78% 8%, rgba(212, 168, 67, 0.08), transparent 65%), radial-gradient(ellipse 56% 32% at 14% 48%, rgba(56, 189, 248, 0.055), transparent 65%), linear-gradient(to right, rgba(148, 163, 184, 0.032) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.032) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 64px 64px, 64px 64px',
        }}
      />

      {/* Restrained perimeter SVG network traces (desktop only, off-center from text) */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
        className="hidden lg:block absolute inset-x-0 top-0 w-full h-[900px] opacity-55"
      >
        <defs>
          <linearGradient id="ts-bg-gold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0" />
            <stop offset="50%" stopColor="#D4A843" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ts-bg-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
            <stop offset="50%" stopColor="#7DD3FC" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d="M 0 120 H 220 L 268 168 H 420"
          fill="none"
          stroke="url(#ts-bg-gold)"
          strokeWidth="0.9"
          className="destria-ecosystem-stream"
          style={{ animationDuration: '9.5s' }}
        />
        <path
          d="M 1440 210 H 1190 L 1138 262 H 980"
          fill="none"
          stroke="url(#ts-bg-cyan)"
          strokeWidth="0.9"
          className="destria-ecosystem-stream"
          style={{ animationDuration: '10.8s', animationDelay: '1.6s' }}
        />
        <path
          d="M 0 740 H 310 L 368 682 H 580"
          fill="none"
          stroke="url(#ts-bg-cyan)"
          strokeWidth="0.85"
          className="destria-ecosystem-stream"
          style={{ animationDuration: '11.4s', animationDelay: '0.8s' }}
        />
        <path
          d="M 1440 690 H 1120 L 1068 742 H 860"
          fill="none"
          stroke="url(#ts-bg-gold)"
          strokeWidth="0.85"
          className="destria-ecosystem-stream"
          style={{ animationDuration: '10.2s', animationDelay: '2.4s' }}
        />

        {shouldAnimate && (
          <>
            <circle r="2.2" fill="#E5B552" opacity="0.72">
              <animateMotion
                dur="11s"
                repeatCount="indefinite"
                path="M 0 120 H 220 L 268 168 H 420"
              />
            </circle>
            <circle r="2" fill="#7DD3FC" opacity="0.68">
              <animateMotion
                dur="12.5s"
                begin="2s"
                repeatCount="indefinite"
                path="M 1440 210 H 1190 L 1138 262 H 980"
              />
            </circle>
          </>
        )}
      </svg>
    </div>
  );
};
