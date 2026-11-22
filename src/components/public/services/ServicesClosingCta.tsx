import React from 'react';
import { ArrowRight, Calendar, Layers } from 'lucide-react';

interface ServicesClosingCtaProps {
  onBookAppointment: () => void;
  onViewPricing: () => void;
  shouldAnimate: boolean;
}

/**
 * Institutional closing consultation call-to-action with slow-moving digital network
 * pathways and subtle champagne-gold ambient illumination.
 */
export const ServicesClosingCta: React.FC<ServicesClosingCtaProps> = ({
  onBookAppointment,
  onViewPricing,
  shouldAnimate,
}) => {
  return (
    <section
      aria-labelledby="services-cta-heading"
      className="relative rounded-[28px] bg-gradient-to-br from-[#091E36] via-[#06182B] to-[#0B233F] border border-[#D4A843]/45 px-6 py-12 sm:px-12 sm:py-14 text-center overflow-hidden shadow-[0_26px_72px_-32px_rgba(2,13,24,0.95)]"
    >
      {/* Top metallic champagne gold hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/80 to-transparent"
        aria-hidden="true"
      />

      {/* Ambient financial grid & warm gold lighting */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 56% 52% at 50% 0%, rgba(212, 168, 67, 0.14), transparent 70%), radial-gradient(ellipse 46% 42% at 15% 92%, rgba(56, 189, 248, 0.08), transparent 65%), linear-gradient(to right, rgba(148, 163, 184, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 52px 52px, 52px 52px',
        }}
        aria-hidden="true"
      />

      {/* Restrained perimeter SVG network */}
      <svg
        viewBox="0 0 1200 280"
        preserveAspectRatio="xMidYMid slice"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-70"
        aria-hidden="true"
      >
        <path
          d="M -20 68 L 190 68 L 245 112 L 340 112"
          fill="none"
          stroke="rgba(212, 168, 67, 0.35)"
          strokeWidth="1.1"
          className="destria-ecosystem-stream"
          style={{ animationDuration: '7.4s' }}
        />
        <path
          d="M 1220 212 L 1010 212 L 955 168 L 860 168"
          fill="none"
          stroke="rgba(125, 211, 252, 0.32)"
          strokeWidth="1.1"
          className="destria-ecosystem-stream"
          style={{ animationDuration: '8.2s', animationDelay: '1.1s' }}
        />
        {shouldAnimate && (
          <>
            <circle r="2.6" fill="#E5B552" opacity="0.9">
              <animateMotion
                dur="8.6s"
                repeatCount="indefinite"
                path="M -20 68 L 190 68 L 245 112 L 340 112"
              />
            </circle>
            <circle r="2.4" fill="#7DD3FC" opacity="0.85">
              <animateMotion
                dur="9.2s"
                begin="1.8s"
                repeatCount="indefinite"
                path="M 1220 212 L 1010 212 L 955 168 L 860 168"
              />
            </circle>
          </>
        )}
      </svg>

      <div className="relative z-10 max-w-2xl mx-auto space-y-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-[#E5B552] uppercase">
          Confidential Private-Client &amp; Business Advisory
        </p>

        <h2
          id="services-cta-heading"
          className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
        >
          Ready to Discuss Your Specific Tax or Business Needs?
        </h2>

        <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
          Schedule a confidential consultation with Desmond Hinds or our tax specialists. We review your situation and recommend the optimal service plan.
        </p>

        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <button
            type="button"
            onClick={onBookAppointment}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-[#06182B] bg-[#D4A843] hover:bg-[#E5B552] transition-all shadow-[0_14px_34px_-14px_rgba(212,168,67,0.65)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white whitespace-nowrap"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Book an Appointment</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>

          <button
            type="button"
            onClick={onViewPricing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-[#071A2F]/90 hover:bg-[#102D4F] border border-slate-600/75 hover:border-[#D4A843]/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] whitespace-nowrap"
          >
            <Layers className="w-4 h-4 text-[#E5B552] shrink-0" />
            <span>View Service Plans &amp; Pricing</span>
          </button>
        </div>
      </div>
    </section>
  );
};
