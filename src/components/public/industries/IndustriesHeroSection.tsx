import React, { useState } from 'react';
import { ArrowRight, Layers } from 'lucide-react';
import { INDUSTRIES_HERO_VISUAL } from './industryVisualAssets';

interface IndustriesHeroSectionProps {
  onBookConsultation: () => void;
  onJumpToSectors: () => void;
  shouldAnimate: boolean;
}

/**
 * Enterprise two-column Industries hero combining unobstructed high-contrast
 * typography on the left with photorealistic multi-sector financial technology
 * infrastructure and restrained perimeter network pathways on the right.
 */
export const IndustriesHeroSection: React.FC<IndustriesHeroSectionProps> = ({
  onBookConsultation,
  onJumpToSectors,
  shouldAnimate,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section
      aria-labelledby="industries-hero-heading"
      className="relative overflow-hidden border-b border-slate-700/45 bg-[#051527] pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24"
    >
      {/* Subtle architectural midnight-navy grid and controlled ambient illumination */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 58% 58% at 24% 46%, rgba(6, 24, 43, 0.95), rgba(6, 24, 43, 0.62) 70%, transparent 100%), radial-gradient(circle at 84% 24%, rgba(212, 168, 67, 0.12), transparent 44%), radial-gradient(circle at 14% 84%, rgba(56, 189, 248, 0.08), transparent 42%), linear-gradient(to right, rgba(148, 163, 184, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 56px 56px, 56px 56px',
        }}
        aria-hidden="true"
      />

      {/* Restrained Perimeter Financial Information Network SVG (paused off-screen) */}
      <svg
        viewBox="0 0 1440 520"
        preserveAspectRatio="xMidYMid slice"
        className={`pointer-events-none absolute inset-0 w-full h-full opacity-65 ${
          shouldAnimate ? '' : 'destria-motion-paused'
        }`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ind-hero-gold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.06" />
            <stop offset="50%" stopColor="#E5B552" stopOpacity="0.76" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="ind-hero-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#7DD3FC" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <g fill="none">
          <path
            d="M -20 74 L 240 74 L 306 118 L 650 118"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeWidth="1"
          />
          <path
            d="M -20 74 L 240 74 L 306 118 L 650 118"
            stroke="url(#ind-hero-gold)"
            strokeWidth="1.25"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '8.2s' }}
          />
          <path
            d="M -20 448 L 260 448 L 328 408 L 640 408"
            stroke="rgba(148, 163, 184, 0.12)"
            strokeWidth="1"
          />
          <path
            d="M -20 448 L 260 448 L 328 408 L 640 408"
            stroke="url(#ind-hero-cyan)"
            strokeWidth="1.15"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '9.4s', animationDelay: '-2.6s' }}
          />
          {/* Right-side anchor network lines behind technology image */}
          <path
            d="M 1460 88 L 1240 88 L 1184 134"
            stroke="rgba(212, 168, 67, 0.24)"
            strokeWidth="1"
          />
          <path
            d="M 1460 434 L 1220 434 L 1166 392"
            stroke="rgba(125, 211, 252, 0.2)"
            strokeWidth="1"
          />
        </g>

        {/* Subtle geometric verification nodes */}
        <g>
          <rect
            x="234"
            y="68"
            width="12"
            height="12"
            rx="2"
            fill="#071A2E"
            stroke="#D4A843"
            strokeOpacity="0.6"
            strokeWidth="1"
          />
          <circle
            cx="240"
            cy="74"
            r="2.2"
            fill="#E5B552"
            className="destria-checkpoint-glow"
          />
          <rect
            x="322"
            y="402"
            width="12"
            height="12"
            rx="2"
            fill="#071A2E"
            stroke="#7DD3FC"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          <circle
            cx="328"
            cy="408"
            r="2"
            fill="#7DD3FC"
            className="destria-checkpoint-glow"
            style={{ animationDelay: '-1.6s' }}
          />
        </g>
      </svg>

      <div className="relative z-10 mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Column: High-Contrast Narrative */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6 text-left">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold tracking-[0.14em] uppercase text-[#E1BB60]">
              <Layers className="w-3.5 h-3.5 text-[#D4A843] shrink-0" aria-hidden="true" />
              <span>Specialized Commercial Practice Sectors</span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-300 tracking-[0.08em]">8 Dedicated Verticals</span>
            </div>

            <h1
              id="industries-hero-heading"
              className="font-serif font-extrabold text-white leading-[1.12] tracking-tight"
              style={{
                fontSize: 'clamp(2.15rem, 3.6vw, 3.45rem)',
                textWrap: 'balance',
              }}
            >
              Industry-Specific Tax &amp; Accounting Solutions
            </h1>

            <p className="text-base sm:text-lg text-slate-200/95 leading-relaxed max-w-2xl">
              Every commercial sector operates under distinct regulatory pressures, statutory
              depreciation rules, and revenue recognition standards. DESTRIA TAX SERVICES, LLC
              provides bespoke advisory frameworks tailored to the unique economic realities of your
              trade.
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={onBookConsultation}
                className="min-h-[44px] px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-[#06182B] bg-gradient-to-r from-[#C99A3D] via-[#D9AE51] to-[#E5BE68] hover:brightness-105 transition-all duration-200 shadow-lg shadow-[#D4A843]/15 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Book Sector Discovery Consultation</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onJumpToSectors}
                className="min-h-[44px] px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-100 bg-[#0B223C]/90 border border-[#D4A843]/35 hover:border-[#D4A843]/75 hover:bg-[#102D4F] transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Select Your Industry
              </button>
            </div>

            <div className="pt-4 border-t border-slate-700/50 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300/90">
              <span>Sector-Specific Compliance</span>
              <span className="text-[#D4A843]/70" aria-hidden="true">
                ·
              </span>
              <span>Structured Financial Intelligence</span>
              <span className="text-[#D4A843]/70" aria-hidden="true">
                ·
              </span>
              <span>Human Advisory Oversight</span>
            </div>
          </div>

          {/* Right Column: Photorealistic Enterprise Infrastructure Visualization */}
          <div className="lg:col-span-6 flex items-stretch">
            <div className="relative w-full rounded-2xl overflow-hidden border border-[#D4A843]/35 bg-[#091D34] shadow-2xl flex flex-col justify-between group min-h-[300px] sm:min-h-[360px]">
              {!imgFailed ? (
                <picture className="block w-full h-full flex-1">
                  <source srcSet={INDUSTRIES_HERO_VISUAL.webp} type="image/webp" />
                  <img
                    src={INDUSTRIES_HERO_VISUAL.jpg}
                    alt={INDUSTRIES_HERO_VISUAL.alt}
                    width={1280}
                    height={720}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="w-full h-full min-h-[300px] sm:min-h-[360px] object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.025]"
                  />
                </picture>
              ) : (
                <div className="w-full h-full min-h-[300px] sm:min-h-[360px] bg-gradient-to-br from-[#0F2C4E] via-[#071A2E] to-[#04101E]" />
              )}

              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#041222]/92 via-[#06182B]/25 to-[#06182B]/18"
                aria-hidden="true"
              />

              {/* Subtle animated verification overlay along upper frame */}
              <svg
                viewBox="0 0 640 380"
                preserveAspectRatio="none"
                className={`pointer-events-none absolute inset-0 w-full h-full ${
                  shouldAnimate ? '' : 'destria-motion-paused'
                }`}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="ind-frame-gold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D4A843" stopOpacity="0" />
                    <stop offset="50%" stopColor="#E5B552" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 18 46 L 18 18 L 46 18 M 594 18 L 622 18 L 622 46"
                  fill="none"
                  stroke="#D4A843"
                  strokeOpacity="0.55"
                  strokeWidth="1.25"
                />
                <path
                  d="M 56 28 L 240 28 L 272 48 L 486 48"
                  fill="none"
                  stroke="rgba(229, 181, 82, 0.22)"
                  strokeWidth="1"
                />
                <path
                  d="M 56 28 L 240 28 L 272 48 L 486 48"
                  fill="none"
                  stroke="url(#ind-frame-gold)"
                  strokeWidth="1.4"
                  className="destria-ecosystem-stream"
                  style={{ animationDuration: '6.8s' }}
                />
                <circle
                  cx="272"
                  cy="48"
                  r="3"
                  fill="#E5B552"
                  className="destria-checkpoint-glow"
                />
                <circle
                  cx="486"
                  cy="48"
                  r="2.5"
                  fill="#7DD3FC"
                  className="destria-checkpoint-glow"
                  style={{ animationDelay: '-1.5s' }}
                />
              </svg>

              <div className="pointer-events-none absolute bottom-0 inset-x-0 px-5 py-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#051527]/72 backdrop-blur-sm">
                <span className="text-xs font-semibold text-slate-100">
                  Enterprise Multi-Sector Financial Intelligence
                </span>
                <span className="text-[11px] font-medium text-[#E1BB60]/90">
                  IRS &amp; South Carolina DOR Aligned
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
