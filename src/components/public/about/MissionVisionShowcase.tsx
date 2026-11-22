import React, { useState } from 'react';
import { Compass, Target } from 'lucide-react';
import { ABOUT_MISSION_VISUAL, ABOUT_VISION_VISUAL } from './aboutVisualAssets';

interface MissionVisionShowcaseProps {
  shouldAnimate: boolean;
}

/**
 * Complementary Mission and Vision executive cards featuring distinct
 * photorealistic financial technology imagery, translucent glass framing,
 * and preserved verbatim corporate statements.
 */
export const MissionVisionShowcase: React.FC<MissionVisionShowcaseProps> = ({
  shouldAnimate,
}) => {
  const [missionImgFailed, setMissionImgFailed] = useState(false);
  const [visionImgFailed, setVisionImgFailed] = useState(false);

  return (
    <section
      aria-label="Mission and Vision"
      className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* 01. Our Mission */}
        <article className="group relative flex flex-col rounded-2xl overflow-hidden bg-[#0A1F38]/90 border border-slate-700/55 hover:border-[#D4A843]/45 transition-colors duration-300 shadow-xl">
          {/* Mission Photorealistic Visual Header */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#071A2E]">
            {!missionImgFailed ? (
              <picture>
                <source srcSet={ABOUT_MISSION_VISUAL.webp} type="image/webp" />
                <img
                  src={ABOUT_MISSION_VISUAL.jpg}
                  alt={ABOUT_MISSION_VISUAL.alt}
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setMissionImgFailed(true)}
                  className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </picture>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0F2C4E] to-[#06182B]" />
            )}

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A1F38] via-[#06182B]/35 to-transparent"
              aria-hidden="true"
            />

            {/* Subtle Animated Verification Pathway Overlay */}
            <svg
              viewBox="0 0 640 360"
              preserveAspectRatio="none"
              className={`pointer-events-none absolute inset-0 w-full h-full opacity-80 ${
                shouldAnimate ? '' : 'destria-motion-paused'
              }`}
              aria-hidden="true"
            >
              <path
                d="M 28 312 L 154 312 L 204 276 L 368 276"
                fill="none"
                stroke="rgba(212, 168, 67, 0.25)"
                strokeWidth="1"
              />
              <path
                d="M 28 312 L 154 312 L 204 276 L 368 276"
                fill="none"
                stroke="#E5B552"
                strokeOpacity="0.82"
                strokeWidth="1.4"
                className="destria-ecosystem-stream"
                style={{ animationDuration: '7.4s' }}
              />
              <circle
                cx="204"
                cy="276"
                r="3"
                fill="#E5B552"
                className="destria-checkpoint-glow"
              />
              <circle
                cx="368"
                cy="276"
                r="2.5"
                fill="#7DD3FC"
                className="destria-checkpoint-glow"
                style={{ animationDelay: '-1.6s' }}
              />
            </svg>
          </div>

          {/* Mission Content Body */}
          <div className="flex-1 flex flex-col justify-between p-7 sm:p-9 space-y-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#07182C] border border-[#D4A843]/35 flex items-center justify-center text-[#E1BB60] shrink-0">
                    <Target className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#D4A843]">
                      01 · Institutional Purpose
                    </div>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight">
                      Our Mission
                    </h2>
                  </div>
                </div>
              </div>

              <blockquote className="rounded-xl bg-[#07182C]/85 border border-[#D4A843]/28 p-5 sm:p-6">
                <p className="font-serif italic text-base sm:text-lg text-[#F8FAFC] leading-relaxed">
                  &ldquo;To deliver premium tax, accounting and financial advisory services that
                  preserve wealth and build legacies for every client.&rdquo;
                </p>
              </blockquote>

              <p className="text-sm sm:text-[15px] text-slate-300 leading-relaxed">
                We provide accurate, transparent, and client-focused tax preparation and financial
                support services that empower individuals, entrepreneurs, and families to make
                confident financial decisions.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-700/45 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>Intelligent Tax Preparation</span>
              <span className="text-[#D4A843]/60" aria-hidden="true">
                ·
              </span>
              <span>Accurate Financial Analysis</span>
              <span className="text-[#D4A843]/60" aria-hidden="true">
                ·
              </span>
              <span>Secure Document Handling</span>
            </div>
          </div>
        </article>

        {/* 02. Our Vision */}
        <article className="group relative flex flex-col rounded-2xl overflow-hidden bg-[#0A1F38]/90 border border-slate-700/55 hover:border-[#D4A843]/45 transition-colors duration-300 shadow-xl">
          {/* Vision Photorealistic Visual Header */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#071A2E]">
            {!visionImgFailed ? (
              <picture>
                <source srcSet={ABOUT_VISION_VISUAL.webp} type="image/webp" />
                <img
                  src={ABOUT_VISION_VISUAL.jpg}
                  alt={ABOUT_VISION_VISUAL.alt}
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setVisionImgFailed(true)}
                  className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                />
              </picture>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#0F2C4E] to-[#06182B]" />
            )}

            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A1F38] via-[#06182B]/35 to-transparent"
              aria-hidden="true"
            />

            {/* Subtle Forward-Horizon Interconnected Knowledge Arcs */}
            <svg
              viewBox="0 0 640 360"
              preserveAspectRatio="none"
              className={`pointer-events-none absolute inset-0 w-full h-full opacity-80 ${
                shouldAnimate ? '' : 'destria-motion-paused'
              }`}
              aria-hidden="true"
            >
              <path
                d="M 272 288 Q 410 232 612 256"
                fill="none"
                stroke="rgba(125, 211, 252, 0.25)"
                strokeWidth="1"
              />
              <path
                d="M 272 288 Q 410 232 612 256"
                fill="none"
                stroke="#E5B552"
                strokeOpacity="0.78"
                strokeWidth="1.4"
                className="destria-ecosystem-stream"
                style={{ animationDuration: '8.2s', animationDelay: '-2.1s' }}
              />
              <circle
                cx="434"
                cy="251"
                r="3"
                fill="#E5B552"
                className="destria-checkpoint-glow"
                style={{ animationDelay: '-0.8s' }}
              />
              <circle
                cx="562"
                cy="252"
                r="2.5"
                fill="#7DD3FC"
                className="destria-checkpoint-glow"
                style={{ animationDelay: '-2.4s' }}
              />
            </svg>
          </div>

          {/* Vision Content Body */}
          <div className="flex-1 flex flex-col justify-between p-7 sm:p-9 space-y-6">
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#07182C] border border-[#D4A843]/35 flex items-center justify-center text-[#E1BB60] shrink-0">
                    <Compass className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#D4A843]">
                      02 · Long-Term Horizon
                    </div>
                    <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight">
                      Our Vision
                    </h2>
                  </div>
                </div>
              </div>

              <blockquote className="rounded-xl bg-[#07182C]/85 border border-[#D4A843]/28 p-5 sm:p-6">
                <p className="font-serif italic text-base sm:text-lg text-[#F8FAFC] leading-relaxed">
                  &ldquo;To be the trusted financial partner that individuals and businesses turn to
                  for clarity, confidence and long-term prosperity.&rdquo;
                </p>
              </blockquote>

              <p className="text-sm sm:text-[15px] text-slate-300 leading-relaxed">
                We strive to be a trusted leader in tax and financial solutions, known for
                integrity, innovation, and a lasting positive impact on our clients, families, and
                communities.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-700/45 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>Enterprise Financial Clarity</span>
              <span className="text-[#D4A843]/60" aria-hidden="true">
                ·
              </span>
              <span>Responsible Innovation</span>
              <span className="text-[#D4A843]/60" aria-hidden="true">
                ·
              </span>
              <span>Human Oversight</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};
