import React, { useState } from 'react';
import { ArrowRight, FileCheck2, ShieldCheck } from 'lucide-react';
import { CATEGORY_HERO_ASSETS } from './servicesVisualAssets';

interface AuditDefenseShowcaseProps {
  onRequestEvaluation: () => void;
  shouldAnimate: boolean;
}

/**
 * Enhanced IRS Notice Resolution & Audit Defense Support section replacing
 * conventional imagery with an ultra-realistic professional evidence review
 * visual and restrained animated verification indicators.
 */
export const AuditDefenseShowcase: React.FC<AuditDefenseShowcaseProps> = ({
  onRequestEvaluation,
  shouldAnimate,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const asset = CATEGORY_HERO_ASSETS.auditDefense;

  return (
    <section
      aria-labelledby="audit-defense-heading"
      className="relative rounded-[28px] bg-[#081D36]/95 border border-[#D4A843]/40 overflow-hidden shadow-[0_24px_70px_-30px_rgba(2,13,24,0.92)]"
    >
      {/* Top metallic champagne gold hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#E5B552]/75 to-transparent"
        aria-hidden="true"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Visual Stage */}
        <div className="lg:col-span-6 relative min-h-[260px] sm:min-h-[320px] lg:min-h-[360px] bg-[#051426] border-b lg:border-b-0 lg:border-r border-slate-700/55 overflow-hidden group">
          {!imageFailed ? (
            <picture>
              <source srcSet={asset.webp} type="image/webp" />
              <img
                src={asset.jpg}
                alt={asset.alt}
                width={1200}
                height={675}
                loading="lazy"
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
              <ShieldCheck className="w-12 h-12 text-[#D4A843]/65" />
            </div>
          )}

          {/* Atmospheric vignette */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#06182B]/90 via-[#06182B]/15 to-[#06182B]/20"
            aria-hidden="true"
          />

          {/* Restrained Document Verification & Evidence Traceability Overlay */}
          <svg
            viewBox="0 0 600 360"
            className="pointer-events-none absolute inset-0 w-full h-full opacity-80"
            aria-hidden="true"
          >
            <path
              d="M 32 288 L 166 288 L 214 252 L 386 252 L 434 288 L 568 288"
              fill="none"
              stroke="#E5B552"
              strokeOpacity="0.58"
              strokeWidth="1.2"
              className="destria-ecosystem-stream"
              style={{ animationDuration: '6.6s' }}
            />
            {[
              { cx: 166, cy: 288, delay: '0s' },
              { cx: 214, cy: 252, delay: '0.8s' },
              { cx: 386, cy: 252, delay: '1.6s' },
              { cx: 434, cy: 288, delay: '2.4s' },
            ].map((node, i) => (
              <g key={i}>
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r="7"
                  fill="none"
                  stroke="#E5B552"
                  strokeOpacity="0.35"
                  strokeWidth="1"
                  className="destria-checkpoint-glow"
                  style={{ animationDelay: node.delay }}
                />
                <circle cx={node.cx} cy={node.cy} r="2.5" fill="#E5B552" />
              </g>
            ))}
            {shouldAnimate && (
              <circle r="3" fill="#F3CE74" opacity="0.95">
                <animateMotion
                  dur="7s"
                  repeatCount="indefinite"
                  path="M 32 288 L 166 288 L 214 252 L 386 252 L 434 288 L 568 288"
                />
              </circle>
            )}
          </svg>

          {/* Bottom Evidence Caption */}
          <div className="pointer-events-none absolute bottom-3.5 left-4 right-4 z-10 flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-white">
              <ShieldCheck className="w-4 h-4 text-[#E5B552] shrink-0" />
              <span>Audit Defense &amp; Evidence Traceability</span>
            </span>
            <span className="font-mono text-[10px] tracking-wider uppercase text-slate-300/80">
              Confidential Case Review
            </span>
          </div>
        </div>

        {/* Right Narrative Column */}
        <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-center space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.18em] text-[#E5B552] uppercase">
              Advisory Assurance
            </p>
            <h3
              id="audit-defense-heading"
              className="font-serif text-2xl sm:text-3xl lg:text-[2rem] font-bold text-white leading-tight"
            >
              IRS Notice Resolution &amp; Audit Defense Support
            </h3>
            <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
              Received a CP2000, statutory deficiency notice, or audit examination inquiry from the IRS or South Carolina Department of Revenue? Our tax professionals reconstruct workpapers, retrieve IRS transcripts, calculate penalty abatements, and draft formal responses.
            </p>
          </div>

          {/* Structured Preparedness Milestones */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {[
              { label: 'Transcript Audit', note: 'Account & filing history check' },
              { label: 'Workpaper Rebuild', note: 'Organized supporting records' },
              { label: 'Formal Response', note: 'Prepared by tax specialists' },
            ].map((step) => (
              <div
                key={step.label}
                className="rounded-xl bg-[#06182B]/85 border border-slate-700/60 p-3 space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <FileCheck2 className="w-3.5 h-3.5 text-[#E5B552] shrink-0" />
                  <span>{step.label}</span>
                </div>
                <p className="text-[11px] text-[#A9B7C8] leading-snug">
                  {step.note}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={onRequestEvaluation}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-[#06182B] bg-[#D4A843] hover:bg-[#E5B552] transition-all shadow-[0_12px_30px_-12px_rgba(212,168,67,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white whitespace-nowrap"
            >
              <span>Request Notice Evaluation</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <span className="text-[11px] text-slate-400">
              Independent firm representation — outcomes depend on facts and statutory authority.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
