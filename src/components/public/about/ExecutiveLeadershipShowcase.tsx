import React from 'react';
import { ArrowRight, Calendar } from 'lucide-react';
import { COMPANY_BRANDING } from '../../../config/companyBranding';
import { FounderPortrait } from '../images';

interface ExecutiveLeadershipShowcaseProps {
  onViewProfile: () => void;
  onScheduleConsultation: () => void;
  shouldAnimate: boolean;
}

/**
 * Prestigious executive leadership showcase centered on Desmond Hinds'
 * original, unmodified FounderPortrait asset.
 * All subtle background network geometry stays strictly behind the card
 * perimeter — never overlapping the founder's face, body, or wall emblem.
 */
export const ExecutiveLeadershipShowcase: React.FC<ExecutiveLeadershipShowcaseProps> = ({
  onViewProfile,
  onScheduleConsultation,
  shouldAnimate,
}) => {
  return (
    <section
      aria-labelledby="executive-leadership-heading"
      className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B2544] via-[#071A31] to-[#041120] border border-[#D4A843]/40 p-6 sm:p-10 lg:p-14 shadow-2xl">
        {/* Subtle ambient navy/gold perimeter lighting — strictly behind content */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 22% 48%, rgba(212, 168, 67, 0.14), transparent 44%), radial-gradient(circle at 86% 20%, rgba(56, 189, 248, 0.08), transparent 42%)',
          }}
          aria-hidden="true"
        />

        {/* Exceptionally subtle perimeter technology network (right/bottom edge only, never over portrait) */}
        <svg
          viewBox="0 0 1280 560"
          preserveAspectRatio="xMidYMid slice"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-45 ${
            shouldAnimate ? '' : 'destria-motion-paused'
          }`}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="exec-net-gold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4A843" stopOpacity="0.05" />
              <stop offset="50%" stopColor="#E5B552" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <g fill="none">
            <path
              d="M 640 42 L 980 42 L 1050 96 L 1280 96"
              stroke="rgba(148, 163, 184, 0.14)"
              strokeWidth="1"
            />
            <path
              d="M 640 42 L 980 42 L 1050 96 L 1280 96"
              stroke="url(#exec-net-gold)"
              strokeWidth="1.2"
              className="destria-ecosystem-stream"
              style={{ animationDuration: '10.5s' }}
            />
            <path
              d="M 720 518 L 1020 518 L 1084 472 L 1280 472"
              stroke="rgba(148, 163, 184, 0.12)"
              strokeWidth="1"
            />
            <circle cx="980" cy="42" r="2.5" fill="#D4A843" fillOpacity="0.7" />
            <circle cx="1050" cy="96" r="2" fill="#7DD3FC" fillOpacity="0.55" />
          </g>
        </svg>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Official Unmodified Founder Portrait with Prestigious Framing */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative w-full max-w-[460px]">
              {/* Soft warm gold ambient halo strictly behind the portrait frame */}
              <div
                className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-tr from-[#D4A843]/20 via-transparent to-[#E5B552]/16 blur-xl"
                aria-hidden="true"
              />

              {/* Outer architectural gold double-hairline plinth */}
              <div className="relative rounded-[1.75rem] p-[1px] bg-gradient-to-b from-[#E5B552]/70 via-[#D4A843]/25 to-[#D4A843]/55 shadow-2xl">
                <div className="rounded-[1.7rem] bg-[#06182B] p-1.5 sm:p-2">
                  <FounderPortrait
                    size="full"
                    priority={true}
                    caption="Desmond Hinds • Founder & Chief Executive Officer"
                    className="w-full border-[#D4A843]/40 shadow-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authoritative Executive Message */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="space-y-3">
              <div className="text-xs font-bold tracking-[0.18em] uppercase text-[#E1BB60]">
                Executive Leadership
              </div>

              <h2
                id="executive-leadership-heading"
                className="font-serif text-3xl sm:text-4xl lg:text-[2.65rem] font-bold text-white leading-[1.15]"
                style={{ textWrap: 'balance' }}
              >
                A Message from Desmond Hinds
              </h2>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm font-semibold text-[#E2BD67]">
                <span>Founder &amp; Chief Executive Officer</span>
                <span className="text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-200">{COMPANY_BRANDING.displayName}</span>
                <span className="text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className="text-slate-300">Columbia, South Carolina, USA</span>
              </div>
            </div>

            {/* Refined Executive Quote Container (all-around gold hairline, no thick left bar) */}
            <blockquote className="relative rounded-2xl bg-[#051426]/90 border border-[#D4A843]/32 p-6 sm:p-7 shadow-inner">
              <span
                className="block font-serif text-4xl leading-none text-[#D4A843]/65 select-none mb-2"
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <p className="font-serif italic text-base sm:text-lg lg:text-[1.15rem] text-[#F8FAFC] leading-relaxed">
                Your Growth, Our Priority. We established DESTRIA TAX SERVICES, LLC to give
                individuals, families, and businesses confidential, executive-tier tax counsel they
                can rely on through every economic season.&rdquo;
              </p>
            </blockquote>

            <p className="text-sm sm:text-[15px] text-slate-300 leading-relaxed">
              Desmond established the firm to bring integrity, accuracy, and strategic foresight to
              every client relationship. Combining rigorous tax statutory knowledge with a
              client-first approach, our firm empowers clients to navigate complex regulations with
              absolute confidence.
            </p>

            {/* Preserved Executive Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onViewProfile}
                className="min-h-[44px] px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-[#06182B] bg-gradient-to-r from-[#C99A3D] via-[#D9AE51] to-[#E5BE68] hover:brightness-105 transition-all duration-200 shadow-lg shadow-[#D4A843]/15 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>View Full Executive Profile</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onScheduleConsultation}
                className="min-h-[44px] px-6 py-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-100 bg-[#0B2440] border border-[#D4A843]/40 hover:border-[#D4A843] hover:bg-[#102F52] transition-all duration-200 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#D4A843] shrink-0" aria-hidden="true" />
                <span>Schedule Private Consultation</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
