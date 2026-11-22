import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { HERO_TAX_STRATEGY_ASSET } from './strategyVisualAssets';

interface TaxStrategyHeroVisualProps {
  shouldAnimate: boolean;
}

/**
 * Cinematic architectural financial technology hero visual for /tax-strategies.
 * Combines optimized WebP/JPG imagery with restrained SVG verification pathways and particles.
 */
export const TaxStrategyHeroVisual: React.FC<TaxStrategyHeroVisualProps> = ({
  shouldAnimate,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-[#D4A843]/35 bg-[#071A2E] shadow-[0_24px_64px_-24px_rgba(2,13,24,0.92)] group">
      {/* Subtle metallic top specular hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#E5B552]/75 to-transparent"
        aria-hidden="true"
      />

      {/* Primary Hero Image (WebP with JPG fallback, stable 16:9 aspect ratio) */}
      <div className="relative aspect-[16/9] w-full bg-[#051426]">
        {!imageFailed ? (
          <picture>
            <source srcSet={HERO_TAX_STRATEGY_ASSET.webp} type="image/webp" />
            <img
              src={HERO_TAX_STRATEGY_ASSET.jpg}
              alt={HERO_TAX_STRATEGY_ASSET.alt}
              width={1280}
              height={720}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </picture>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background:
                'radial-gradient(circle at 50% 42%, rgba(212, 168, 67, 0.2), rgba(6, 24, 43, 0.96) 72%)',
            }}
          >
            <ShieldCheck className="w-12 h-12 text-[#D4A843]/60" />
          </div>
        )}

        {/* Controlled edge vignette for crisp caption legibility */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06182B]/95 via-[#06182B]/20 to-[#06182B]/25"
          aria-hidden="true"
        />

        {/* Restrained conceptual ledger pathway overlay (never obscures heading text) */}
        <svg
          viewBox="0 0 640 360"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-80"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ts-hero-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4A843" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#E5B552" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="ts-hero-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#7DD3FC" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Upper gold verification pathway */}
          <path
            d="M 28 96 L 164 96 L 204 68 L 436 68 L 478 96 L 612 96"
            fill="none"
            stroke="url(#ts-hero-gold)"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '6.8s' }}
          />

          {/* Lower sapphire traceability pathway */}
          <path
            d="M 42 264 L 182 264 L 222 238 L 418 238 L 456 264 L 598 264"
            fill="none"
            stroke="url(#ts-hero-cyan)"
            strokeWidth="1.1"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '7.4s', animationDelay: '1.2s' }}
          />

          {/* Illuminated ledger nodes */}
          {[
            { cx: 164, cy: 96, color: '#E5B552', delay: '0s' },
            { cx: 436, cy: 68, color: '#7DD3FC', delay: '1.1s' },
            { cx: 222, cy: 238, color: '#7DD3FC', delay: '0.6s' },
            { cx: 456, cy: 264, color: '#E5B552', delay: '1.7s' },
          ].map((node, i) => (
            <g key={i}>
              <circle
                cx={node.cx}
                cy={node.cy}
                r="7"
                fill="none"
                stroke={node.color}
                strokeOpacity="0.35"
                strokeWidth="1"
                className="destria-checkpoint-glow"
                style={{ animationDelay: node.delay }}
              />
              <circle
                cx={node.cx}
                cy={node.cy}
                r="2.6"
                fill={node.color}
                opacity="0.9"
              />
            </g>
          ))}

          {/* Slow-moving data verification particles */}
          {shouldAnimate && (
            <>
              <circle r="3" fill="#F3CE74" opacity="0.95">
                <animateMotion
                  dur="7.2s"
                  repeatCount="indefinite"
                  path="M 28 96 L 164 96 L 204 68 L 436 68 L 478 96 L 612 96"
                />
              </circle>
              <circle r="2.5" fill="#7DD3FC" opacity="0.88">
                <animateMotion
                  dur="8.4s"
                  begin="2.1s"
                  repeatCount="indefinite"
                  path="M 42 264 L 182 264 L 222 238 L 418 238 L 456 264 L 598 264"
                />
              </circle>
            </>
          )}
        </svg>

        {/* Bottom institutional caption bar */}
        <div className="absolute bottom-3.5 left-4 right-4 z-10 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-semibold text-[#F8FAFC]">
            <ShieldCheck className="w-4 h-4 text-[#E5B552] shrink-0" />
            <span>Structured Tax Strategy &amp; Independent CPA Review</span>
          </div>
          <span className="hidden sm:inline font-mono text-[10px] tracking-wider uppercase text-slate-300/80">
            Conceptual Visual
          </span>
        </div>
      </div>
    </div>
  );
};
