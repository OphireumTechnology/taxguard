import React, { useState } from 'react';
import { getIndustryVisualProfile } from './industryVisualAssets';

interface IndustryTechnologyVisualProps {
  slug: string;
  industryName: string;
  primaryForm: string;
  shouldAnimate: boolean;
}

/**
 * Large photorealistic industry technology visualization with sector-specific
 * conceptual digital overlays. Features a dedicated BIM/WIP/job-costing
 * architectural overlay for Construction & Specialty Trades.
 */
export const IndustryTechnologyVisual: React.FC<IndustryTechnologyVisualProps> = ({
  slug,
  industryName,
  primaryForm,
  shouldAnimate,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const profile = getIndustryVisualProfile(slug);
  const isConstruction = slug === 'construction-contractors';
  const pausedClass = shouldAnimate ? '' : 'destria-motion-paused';

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-[#D4A843]/35 bg-[#06172A] shadow-2xl">
      {/* Main Photorealistic Visual Stage */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#051426] group">
        {!imgFailed ? (
          <picture>
            <source srcSet={profile.webp} type="image/webp" />
            <img
              key={slug}
              src={profile.jpg}
              alt={profile.alt}
              width={1280}
              height={800}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </picture>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0F2C4E] via-[#071A2E] to-[#04101E] flex items-center justify-center p-6 text-center">
            <span className="font-serif text-lg text-[#E1BB60]">{industryName}</span>
          </div>
        )}

        {/* Measured Scrim */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#051426]/95 via-[#06182B]/28 to-[#06182B]/22"
          aria-hidden="true"
        />

        {/* Gentle horizontal financial verification scan line */}
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/75 to-transparent destria-card-scan-beam ${pausedClass}`}
          aria-hidden="true"
        />

        {/* Sector-Specific Conceptual Technology Overlay */}
        <svg
          viewBox="0 0 640 400"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full ${pausedClass}`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`tech-gold-${slug}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4A843" stopOpacity="0.08" />
              <stop offset="50%" stopColor="#E5B552" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Architectural corner brackets */}
          <path
            d="M 18 48 L 18 18 L 48 18 M 592 18 L 622 18 L 622 48"
            fill="none"
            stroke="#D4A843"
            strokeOpacity="0.58"
            strokeWidth="1.25"
          />

          {isConstruction ? (
            /* Dedicated Construction BIM / WIP / Job Costing Architectural Schematic Overlay */
            <g fill="none">
              {/* Blueprint elevation grid lines */}
              <path
                d="M 36 276 L 196 276 L 238 228 L 424 228 L 468 184 L 604 184"
                stroke="rgba(229, 181, 82, 0.28)"
                strokeWidth="1"
              />
              <path
                d="M 36 276 L 196 276 L 238 228 L 424 228 L 468 184 L 604 184"
                stroke={`url(#tech-gold-${slug})`}
                strokeWidth="1.6"
                className="destria-ecosystem-stream"
                style={{ animationDuration: '6.4s' }}
              />
              {/* Secondary BIM structural cost-code conduit */}
              <path
                d="M 36 116 L 164 116 L 204 148 L 352 148"
                stroke="rgba(125, 211, 252, 0.25)"
                strokeWidth="1"
              />
              <path
                d="M 36 116 L 164 116 L 204 148 L 352 148"
                stroke="#7DD3FC"
                strokeOpacity="0.65"
                strokeWidth="1.25"
                className="destria-ecosystem-stream"
                style={{ animationDuration: '7.6s', animationDelay: '-1.4s' }}
              />
              {/* Construction milestone verification nodes */}
              {[
                { cx: 196, cy: 276, color: '#E5B552' },
                { cx: 238, cy: 228, color: '#E5B552' },
                { cx: 424, cy: 228, color: '#7DD3FC' },
                { cx: 468, cy: 184, color: '#E5B552' },
              ].map((pt, i) => (
                <g key={i}>
                  <rect
                    x={pt.cx - 5}
                    y={pt.cy - 5}
                    width="10"
                    height="10"
                    rx="1.5"
                    fill="#051426"
                    stroke={pt.color}
                    strokeWidth="1.2"
                  />
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r="2.2"
                    fill={pt.color}
                    className="destria-checkpoint-glow"
                    style={{ animationDelay: `${-i * 0.7}s` }}
                  />
                </g>
              ))}
            </g>
          ) : (
            /* General Sector Financial Intelligence Conduit Overlay */
            <g fill="none">
              <path
                d="M 32 284 L 180 284 L 228 242 L 456 242 L 496 206 L 608 206"
                stroke="rgba(229, 181, 82, 0.26)"
                strokeWidth="1"
              />
              <path
                d="M 32 284 L 180 284 L 228 242 L 456 242 L 496 206 L 608 206"
                stroke={`url(#tech-gold-${slug})`}
                strokeWidth="1.5"
                className="destria-ecosystem-stream"
                style={{ animationDuration: '7.2s' }}
              />
              <circle
                cx="228"
                cy="242"
                r="3.2"
                fill="#E5B552"
                className="destria-checkpoint-glow"
              />
              <circle
                cx="456"
                cy="242"
                r="2.8"
                fill="#7DD3FC"
                className="destria-checkpoint-glow"
                style={{ animationDelay: '-1.5s' }}
              />
            </g>
          )}
        </svg>

        {/* Bottom Caption Overlay */}
        <div className="pointer-events-none absolute bottom-0 inset-x-0 px-5 py-4 border-t border-white/10 bg-[#051426]/78 backdrop-blur-sm flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#E1BB60]">
              Sector {profile.sectorCode} · Visual Intelligence
            </div>
            <div className="text-xs sm:text-sm font-semibold text-white">
              {profile.visualCaption}
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-200/90">{primaryForm}</span>
        </div>
      </div>

      {/* Structured Conceptual Financial Layers Strip (Clean Unboxed List) */}
      <div className="p-5 bg-[#07192E] border-t border-slate-700/45 space-y-3">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#D4A843]">
          Conceptual Operations-to-Accounting Alignment
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {profile.intelligenceLayers.map((layer, index) => (
            <div
              key={layer}
              className="flex items-center gap-2 text-xs text-slate-200/95 leading-snug"
            >
              <span className="text-[10px] font-mono text-[#E1BB60]/90 tabular-nums shrink-0">
                0{index + 1}
              </span>
              <span className="text-slate-600" aria-hidden="true">
                /
              </span>
              <span>{layer}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
