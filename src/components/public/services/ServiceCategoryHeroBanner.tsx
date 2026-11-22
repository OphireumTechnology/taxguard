import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface ServiceCategoryHeroBannerProps {
  sectionNumber: string;
  title: string;
  description: string;
  categoryLabel: string;
  imageJpg: string;
  imageWebp: string;
  imageAlt: string;
  icon: React.ComponentType<{ className?: string }>;
  highlights: string[];
  shouldAnimate: boolean;
}

/**
 * High-craft category showcase banner pairing authoritative typography with
 * realistic financial technology photography and restrained animated verification overlays.
 */
export const ServiceCategoryHeroBanner: React.FC<
  ServiceCategoryHeroBannerProps
> = ({
  sectionNumber,
  title,
  description,
  categoryLabel,
  imageJpg,
  imageWebp,
  imageAlt,
  icon: Icon,
  highlights,
  shouldAnimate,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="relative rounded-[24px] bg-[#081C33]/92 backdrop-blur-md border border-slate-700/60 overflow-hidden shadow-[0_22px_64px_-30px_rgba(2,13,24,0.92)]">
      {/* Top metallic champagne gold specular hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#D4A843]/65 to-transparent"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Content Column */}
        <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-[#06182B] border border-[#D4A843]/45 flex items-center justify-center text-[#E5B552] shrink-0">
                <Icon className="w-4 h-4" />
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-[#E5B552] font-semibold tracking-wider">
                  {sectionNumber}
                </span>
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-semibold tracking-[0.14em] uppercase text-slate-300">
                  {categoryLabel}
                </span>
              </div>
            </div>

            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              {title}
            </h2>

            <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
              {description}
            </p>
          </div>

          {/* Quiet Unboxed Governance Highlights */}
          <div className="pt-5 border-t border-slate-700/55 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
            {highlights.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#D4A843]"
                  aria-hidden="true"
                />
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Right Visual Column: Realistic Technology Photography + Restrained Verification Overlay */}
        <div className="lg:col-span-6 relative min-h-[240px] sm:min-h-[300px] lg:min-h-[340px] bg-[#051426] border-t lg:border-t-0 lg:border-l border-slate-700/55 overflow-hidden group">
          {!imageFailed ? (
            <picture>
              <source srcSet={imageWebp} type="image/webp" />
              <img
                src={imageJpg}
                alt={imageAlt}
                width={1200}
                height={675}
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
                  'radial-gradient(circle at 50% 42%, rgba(212, 168, 67, 0.18), rgba(6, 24, 43, 0.96) 72%)',
              }}
            >
              <ShieldCheck className="w-12 h-12 text-[#D4A843]/60" />
            </div>
          )}

          {/* Atmospheric dark navy framing gradient */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06182B]/85 via-[#06182B]/15 to-[#06182B]/20"
            aria-hidden="true"
          />

          {/* Subtle Animated Gold Scanning Line & Connected Verification Nodes */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden"
            aria-hidden="true"
          >
            <div className="destria-card-scan-beam absolute inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#E5B552]/75 to-transparent shadow-[0_0_10px_rgba(229,181,82,0.55)] opacity-60" />

            <svg
              viewBox="0 0 600 340"
              className="absolute inset-0 w-full h-full opacity-75"
            >
              <path
                d="M 28 272 L 154 272 L 196 244 L 404 244 L 448 272 L 572 272"
                fill="none"
                stroke="#E5B552"
                strokeOpacity="0.55"
                strokeWidth="1.15"
                className="destria-ecosystem-stream"
                style={{ animationDuration: '6.2s' }}
              />
              {[
                { cx: 154, cy: 272, color: '#E5B552', delay: '0s' },
                { cx: 196, cy: 244, color: '#7DD3FC', delay: '0.9s' },
                { cx: 404, cy: 244, color: '#7DD3FC', delay: '1.8s' },
                { cx: 448, cy: 272, color: '#E5B552', delay: '2.7s' },
              ].map((pt, i) => (
                <g key={i}>
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r="6"
                    fill="none"
                    stroke={pt.color}
                    strokeOpacity="0.35"
                    strokeWidth="1"
                    className="destria-checkpoint-glow"
                    style={{ animationDelay: pt.delay }}
                  />
                  <circle cx={pt.cx} cy={pt.cy} r="2.3" fill={pt.color} />
                </g>
              ))}
              {shouldAnimate && (
                <circle r="2.8" fill="#F3CE74" opacity="0.92">
                  <animateMotion
                    dur="6.8s"
                    repeatCount="indefinite"
                    path="M 28 272 L 154 272 L 196 244 L 404 244 L 448 272 L 572 272"
                  />
                </circle>
              )}
            </svg>
          </div>

          {/* Subtle Bottom Caption Strip */}
          <div className="pointer-events-none absolute bottom-3.5 left-4 right-4 z-10 flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-white">
              <ShieldCheck className="w-4 h-4 text-[#E5B552] shrink-0" />
              <span>Human-Reviewed Financial Intelligence</span>
            </span>
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-300/80">
              {categoryLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
