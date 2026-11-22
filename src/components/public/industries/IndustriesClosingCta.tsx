import React from 'react';
import { ArrowRight, Compass } from 'lucide-react';

interface IndustriesClosingCtaProps {
  onBookConsultation: () => void;
  onExploreStrategies: () => void;
  shouldAnimate: boolean;
}

/**
 * Executive closing consultation banner with subtle interconnected financial
 * data nodes and preserved calls to action.
 */
export const IndustriesClosingCta: React.FC<IndustriesClosingCtaProps> = ({
  onBookConsultation,
  onExploreStrategies,
  shouldAnimate,
}) => {
  return (
    <section
      aria-labelledby="industries-closing-cta-heading"
      className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B2340] via-[#07192E] to-[#041120] border border-[#D4A843]/40 px-6 py-12 sm:px-12 sm:py-16 text-center shadow-2xl">
        {/* Subtle Interconnected Digital Network Backdrop */}
        <svg
          viewBox="0 0 1200 320"
          preserveAspectRatio="xMidYMid slice"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-55 ${
            shouldAnimate ? '' : 'destria-motion-paused'
          }`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="ind-cta-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4A843" stopOpacity="0.06" />
              <stop offset="50%" stopColor="#E5B552" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0.06" />
            </linearGradient>
            <radialGradient id="ind-cta-veil" cx="50%" cy="50%" r="48%">
              <stop offset="0%" stopColor="#07192E" stopOpacity="0.92" />
              <stop offset="70%" stopColor="#07192E" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#07192E" stopOpacity="0" />
            </radialGradient>
          </defs>
          <g fill="none">
            <path
              d="M -20 68 L 220 68 L 284 120 L 420 120"
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth="1"
            />
            <path
              d="M -20 68 L 220 68 L 284 120 L 420 120"
              stroke="url(#ind-cta-gold)"
              strokeWidth="1.25"
              className="destria-ecosystem-stream"
              style={{ animationDuration: '8.4s' }}
            />
            <path
              d="M 1220 252 L 980 252 L 916 200 L 780 200"
              stroke="rgba(148, 163, 184, 0.16)"
              strokeWidth="1"
            />
            <path
              d="M 1220 252 L 980 252 L 916 200 L 780 200"
              stroke="url(#ind-cta-gold)"
              strokeWidth="1.25"
              className="destria-ecosystem-stream"
              style={{ animationDuration: '9.2s', animationDelay: '-2.1s' }}
            />
            <circle cx="220" cy="68" r="2.8" fill="#E5B552" className="destria-checkpoint-glow" />
            <circle
              cx="980"
              cy="252"
              r="2.8"
              fill="#7DD3FC"
              className="destria-checkpoint-glow"
              style={{ animationDelay: '-1.4s' }}
            />
          </g>
          <rect width="1200" height="320" fill="url(#ind-cta-veil)" />
        </svg>

        <div className="relative z-10 max-w-3xl mx-auto space-y-5">
          <div className="text-xs font-bold tracking-[0.18em] uppercase text-[#E1BB60]">
            Bespoke Commercial Advisory
          </div>

          <h2
            id="industries-closing-cta-heading"
            className="font-serif text-3xl sm:text-4xl font-bold text-white leading-tight"
            style={{ textWrap: 'balance' }}
          >
            Operate in a Unique Commercial Sector?
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
            Our principal executive, Desmond Hinds, provides custom accounting consultations to
            design specialized chart-of-accounts hierarchies, tax elections, and compliance
            workflows tailored to your operational model.
          </p>

          <div className="pt-2 flex flex-wrap justify-center items-center gap-3.5">
            <button
              type="button"
              onClick={onBookConsultation}
              className="min-h-[44px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#C99A3D] via-[#D9AE51] to-[#E5BE68] text-[#06182B] font-bold text-xs sm:text-sm hover:brightness-105 transition-all duration-200 shadow-lg shadow-[#D4A843]/15 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <span>Book Sector Discovery Consultation</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={onExploreStrategies}
              className="min-h-[44px] px-6 py-3 rounded-xl bg-[#0B223C]/90 border border-[#D4A843]/40 hover:border-[#D4A843] hover:bg-[#102D4F] text-slate-100 font-semibold text-xs sm:text-sm transition-all duration-200 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Compass className="w-4 h-4 text-[#D4A843] shrink-0" aria-hidden="true" />
              <span>Explore Tax Strategy Domains</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
