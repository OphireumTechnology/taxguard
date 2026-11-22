import React, { useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { COMPANY_BRANDING } from '../../../config/companyBranding';
import { ABOUT_HERO_VISUAL } from './aboutVisualAssets';

interface AboutHeroSectionProps {
  onMeetFounder: () => void;
  onExploreServices: () => void;
  shouldAnimate: boolean;
}

/**
 * Executive two-column About hero section combining photorealistic modern
 * advisory headquarters imagery with restrained perimeter ledger pathways
 * and unobstructed high-contrast typography.
 */
export const AboutHeroSection: React.FC<AboutHeroSectionProps> = ({
  onMeetFounder,
  onExploreServices,
  shouldAnimate,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <section
      aria-labelledby="about-hero-heading"
      className="relative overflow-hidden border-b border-slate-700/45 bg-[#051527] pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24"
    >
      {/* Subtle architectural navy grid & controlled ambient lighting */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 56% at 24% 44%, rgba(6, 24, 43, 0.94), rgba(6, 24, 43, 0.58) 70%, transparent 100%), radial-gradient(circle at 82% 24%, rgba(212, 168, 67, 0.12), transparent 44%), radial-gradient(circle at 12% 84%, rgba(56, 189, 248, 0.08), transparent 42%), linear-gradient(to right, rgba(148, 163, 184, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 100% 100%, 56px 56px, 56px 56px',
        }}
        aria-hidden="true"
      />

      {/* Restrained Perimeter Ledger Network SVG (paused automatically when off-screen) */}
      <svg
        viewBox="0 0 1440 520"
        preserveAspectRatio="xMidYMid slice"
        className={`pointer-events-none absolute inset-0 w-full h-full opacity-65 ${
          shouldAnimate ? '' : 'destria-motion-paused'
        }`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="about-hero-gold-path" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D4A843" stopOpacity="0.06" />
            <stop offset="50%" stopColor="#E5B552" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="about-hero-cyan-path" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#7DD3FC" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <g fill="none">
          {/* Upper architectural ledger conduit */}
          <path
            d="M -20 68 L 280 68 L 350 112 L 690 112"
            stroke="rgba(148, 163, 184, 0.14)"
            strokeWidth="1"
          />
          <path
            d="M -20 68 L 280 68 L 350 112 L 690 112"
            stroke="url(#about-hero-gold-path)"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '8.5s' }}
          />

          {/* Lower architectural ledger conduit */}
          <path
            d="M -20 452 L 240 452 L 310 412 L 620 412"
            stroke="rgba(148, 163, 184, 0.12)"
            strokeWidth="1"
          />
          <path
            d="M -20 452 L 240 452 L 310 412 L 620 412"
            stroke="url(#about-hero-cyan-path)"
            strokeWidth="1.1"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '9.8s', animationDelay: '-2.2s' }}
          />

          {/* Right outer anchor conduit behind visual frame */}
          <path
            d="M 1460 98 L 1220 98 L 1160 144"
            stroke="rgba(212, 168, 67, 0.22)"
            strokeWidth="1"
          />
          <path
            d="M 1460 430 L 1200 430 L 1140 384"
            stroke="rgba(148, 163, 184, 0.16)"
            strokeWidth="1"
          />
        </g>

        {/* Subtle geometric ledger nodes */}
        <g>
          <rect
            x="274"
            y="62"
            width="12"
            height="12"
            rx="2"
            fill="#071A2E"
            stroke="#D4A843"
            strokeOpacity="0.6"
            strokeWidth="1"
          />
          <circle
            cx="280"
            cy="68"
            r="2.2"
            fill="#E5B552"
            className="destria-checkpoint-glow"
          />
          <rect
            x="304"
            y="406"
            width="12"
            height="12"
            rx="2"
            fill="#071A2E"
            stroke="#7DD3FC"
            strokeOpacity="0.45"
            strokeWidth="1"
          />
          <circle
            cx="310"
            cy="412"
            r="2"
            fill="#7DD3FC"
            className="destria-checkpoint-glow"
            style={{ animationDelay: '-1.5s' }}
          />
        </g>
      </svg>

      {/* Main Responsive Two-Column Content */}
      <div className="relative z-10 mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          {/* Left Column: High-Contrast Institutional Narrative */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6 text-left">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold tracking-[0.14em] uppercase text-[#E1BB60]">
              <MapPin className="w-3.5 h-3.5 text-[#D4A843] shrink-0" aria-hidden="true" />
              <span>Our Heritage &amp; Purpose</span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-300 tracking-[0.08em]">
                Columbia, South Carolina
              </span>
            </div>

            <h1
              id="about-hero-heading"
              className="font-serif font-extrabold text-white leading-[1.12] tracking-tight"
              style={{
                fontSize: 'clamp(2.25rem, 3.8vw, 3.55rem)',
                textWrap: 'balance',
              }}
            >
              About {COMPANY_BRANDING.displayName}
            </h1>

            <p className="text-base sm:text-lg text-slate-200/95 leading-relaxed max-w-2xl">
              Your Trusted Partner in Tax and Financial Solutions. Delivering client-focused tax
              preparation, strategic business accounting, and legacy preservation built upon trust,
              transparency, and accuracy.
            </p>

            {/* Existing Functional Navigation Actions */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={onMeetFounder}
                className="min-h-[44px] px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-[#06182B] bg-gradient-to-r from-[#C99A3D] via-[#D9AE51] to-[#E5BE68] hover:brightness-105 transition-all duration-200 shadow-lg shadow-[#D4A843]/15 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Meet Founder Desmond Hinds</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onExploreServices}
                className="min-h-[44px] px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-100 bg-[#0B223C]/90 border border-[#D4A843]/35 hover:border-[#D4A843]/75 hover:bg-[#102D4F] transition-all duration-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Explore Practice Services
              </button>
            </div>

            {/* Clean Unboxed Institutional Pillars Line */}
            <div className="pt-4 border-t border-slate-700/50 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-300/90">
              <span>Intelligent Tax Preparation</span>
              <span className="text-[#D4A843]/70" aria-hidden="true">
                ·
              </span>
              <span>Transparent Governance</span>
              <span className="text-[#D4A843]/70" aria-hidden="true">
                ·
              </span>
              <span>Human Advisory Oversight</span>
            </div>
          </div>

          {/* Right Column: Cinematic Financial Technology Visualization */}
          <div className="lg:col-span-6 flex items-stretch">
            <div className="relative w-full rounded-2xl overflow-hidden border border-[#D4A843]/35 bg-[#091D34] shadow-2xl flex flex-col justify-between group min-h-[300px] sm:min-h-[360px]">
              {/* Photorealistic Financial Advisory Headquarters Visual */}
              {!imgFailed ? (
                <picture className="block w-full h-full flex-1">
                  <source srcSet={ABOUT_HERO_VISUAL.webp} type="image/webp" />
                  <img
                    src={ABOUT_HERO_VISUAL.jpg}
                    alt={ABOUT_HERO_VISUAL.alt}
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
                <div className="w-full h-full min-h-[300px] sm:min-h-[360px] bg-gradient-to-br from-[#0D2745] via-[#071A2E] to-[#04101E] flex items-center justify-center p-8 text-center">
                  <span className="font-serif text-lg text-[#E1BB60]">
                    {COMPANY_BRANDING.displayName}
                  </span>
                </div>
              )}

              {/* Measured cinematic contrast scrim */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#041222]/92 via-[#06182B]/25 to-[#06182B]/20"
                aria-hidden="true"
              />

              {/* Subtle Glass Architectural Frame & Flowing Gold Verification Pathways */}
              <svg
                viewBox="0 0 640 380"
                preserveAspectRatio="none"
                className={`pointer-events-none absolute inset-0 w-full h-full ${
                  shouldAnimate ? '' : 'destria-motion-paused'
                }`}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="hero-frame-gold" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D4A843" stopOpacity="0" />
                    <stop offset="50%" stopColor="#E5B552" stopOpacity="0.82" />
                    <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Delicate architectural corner brackets */}
                <path
                  d="M 18 46 L 18 18 L 46 18 M 594 18 L 622 18 L 622 46"
                  fill="none"
                  stroke="#D4A843"
                  strokeOpacity="0.55"
                  strokeWidth="1.25"
                />
                {/* Subtle upper verification signal */}
                <path
                  d="M 64 26 L 260 26 L 284 44 L 468 44"
                  fill="none"
                  stroke="rgba(229, 181, 82, 0.2)"
                  strokeWidth="1"
                />
                <path
                  d="M 64 26 L 260 26 L 284 44 L 468 44"
                  fill="none"
                  stroke="url(#hero-frame-gold)"
                  strokeWidth="1.4"
                  className="destria-ecosystem-stream"
                  style={{ animationDuration: '6.8s' }}
                />
                <circle
                  cx="284"
                  cy="44"
                  r="3"
                  fill="#E5B552"
                  className="destria-checkpoint-glow"
                />
                <circle
                  cx="468"
                  cy="44"
                  r="2.5"
                  fill="#7DD3FC"
                  className="destria-checkpoint-glow"
                  style={{ animationDelay: '-1.8s' }}
                />
              </svg>

              {/* Bottom Caption Strip */}
              <div className="pointer-events-none absolute bottom-0 inset-x-0 px-5 py-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#051527]/70 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-100">
                  <MapPin className="w-3.5 h-3.5 text-[#D4A843] shrink-0" aria-hidden="true" />
                  <span>Columbia, South Carolina Headquarters</span>
                </div>
                <span className="text-[11px] font-medium text-[#E1BB60]/90">
                  Modern Tax &amp; Financial Intelligence
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
