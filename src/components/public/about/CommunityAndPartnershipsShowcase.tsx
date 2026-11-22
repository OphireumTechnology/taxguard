import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ABOUT_PARTNERSHIPS_VISUAL } from './aboutVisualAssets';

interface CommunityAndPartnershipsShowcaseProps {
  onInquirePartnerships: () => void;
  shouldAnimate: boolean;
}

const COMMUNITY_PILLARS = [
  {
    index: '01',
    title: 'Financial Literacy',
    desc: 'Workshops on budgeting and credit fundamentals.',
  },
  {
    index: '02',
    title: 'Small Business Support',
    desc: 'Guidance for local startups and sole proprietors.',
  },
  {
    index: '03',
    title: 'Community Engagement',
    desc: 'Civic partnerships across South Carolina.',
  },
  {
    index: '04',
    title: 'Education & Resources',
    desc: 'Free tax organizers and compliance seminars.',
  },
  {
    index: '05',
    title: 'Long-Term Impact',
    desc: 'Generational wealth initiatives for families.',
  },
];

const PARTNERSHIP_AREAS = [
  {
    title: 'Professional Referrals',
    desc: 'Attorney & banking networks',
  },
  {
    title: 'Business Collaborations',
    desc: 'Corporate & payroll integrations',
  },
  {
    title: 'Community Organizations',
    desc: 'Civic financial workshops',
  },
  {
    title: 'Education Seminars',
    desc: 'Year-round tax literacy clinics',
  },
];

/**
 * Refined Community & Impact showcase and Strategic Partnerships split band
 * preserving all existing copy, community pillars, and partnership inquiry action.
 */
export const CommunityAndPartnershipsShowcase: React.FC<
  CommunityAndPartnershipsShowcaseProps
> = ({ onInquirePartnerships, shouldAnimate }) => {
  const [partnerImgFailed, setPartnerImgFailed] = useState(false);

  return (
    <div className="space-y-16 lg:space-y-20">
      {/* Community & Impact */}
      <section
        aria-labelledby="community-impact-heading"
        className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8"
      >
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B2340] via-[#07192E] to-[#051222] border border-[#D4A843]/35 p-7 sm:p-10 lg:p-14 shadow-2xl space-y-10">
          {/* Subtle animated horizon line behind top right */}
          <svg
            viewBox="0 0 1200 220"
            preserveAspectRatio="none"
            className={`pointer-events-none absolute top-0 right-0 w-full h-48 opacity-45 ${
              shouldAnimate ? '' : 'destria-motion-paused'
            }`}
            aria-hidden="true"
          >
            <path
              d="M 540 52 Q 860 14 1180 76"
              fill="none"
              stroke="rgba(212, 168, 67, 0.28)"
              strokeWidth="1"
            />
            <path
              d="M 540 52 Q 860 14 1180 76"
              fill="none"
              stroke="#E5B552"
              strokeOpacity="0.7"
              strokeWidth="1.3"
              className="destria-ecosystem-stream"
              style={{ animationDuration: '9.4s' }}
            />
          </svg>

          <div className="relative z-10 max-w-3xl space-y-3.5">
            <div className="text-xs font-bold tracking-[0.18em] uppercase text-[#E1BB60]">
              Giving Back
            </div>
            <h2
              id="community-impact-heading"
              className="font-serif text-3xl sm:text-4xl font-bold text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Community &amp; Impact: Building Stronger Futures
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              At DESTRIA TAX SERVICES, LLC, we believe that stronger individuals and businesses
              create stronger communities. We are committed to financial education, empowerment, and
              supporting initiatives that help families and entrepreneurs build better futures.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {COMMUNITY_PILLARS.map((pillar) => (
              <div
                key={pillar.index}
                className="rounded-2xl bg-[#061629]/90 border border-slate-700/55 hover:border-[#D4A843]/45 transition-colors p-5 space-y-2"
              >
                <div className="text-[11px] font-semibold tracking-wider text-[#D4A843]/85 tabular-nums">
                  {pillar.index}
                </div>
                <div className="font-serif text-base font-bold text-white leading-snug">
                  {pillar.title}
                </div>
                <p className="text-xs text-slate-300/90 leading-relaxed">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Strategic Partnerships & Advisory Network */}
      <section
        aria-labelledby="strategic-partnerships-heading"
        className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8"
      >
        <div className="rounded-3xl bg-[#0A1F38]/95 border border-slate-700/55 overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            {/* Left Narrative & Partnership Grid */}
            <div className="lg:col-span-7 p-7 sm:p-10 lg:p-12 flex flex-col justify-center space-y-7">
              <div className="space-y-3">
                <div className="text-xs font-bold tracking-[0.18em] uppercase text-[#E1BB60]">
                  Collaborative Excellence
                </div>
                <h2
                  id="strategic-partnerships-heading"
                  className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Strategic Partnerships &amp; Advisory Network
                </h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  We value strategic partnerships with attorneys, wealth managers, and civic
                  organizations that share our commitment to client financial well-being. Together,
                  we expand access to resources, create opportunities, and make a lasting
                  difference.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {PARTNERSHIP_AREAS.map((area) => (
                  <div
                    key={area.title}
                    className="rounded-xl bg-[#061629]/90 border border-slate-700/55 p-4 space-y-1"
                  >
                    <div className="text-sm font-bold text-[#E1BB60]">{area.title}</div>
                    <div className="text-xs text-slate-300">{area.desc}</div>
                  </div>
                ))}
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={onInquirePartnerships}
                  className="min-h-[44px] px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-[#06182B] bg-gradient-to-r from-[#C99A3D] via-[#D9AE51] to-[#E5BE68] hover:brightness-105 transition-all duration-200 shadow-lg shadow-[#D4A843]/15 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Inquire About Partnerships</span>
                  <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Right Visual Showcase */}
            <div className="lg:col-span-5 relative min-h-[300px] lg:min-h-full bg-[#06182B] overflow-hidden group">
              {!partnerImgFailed ? (
                <picture className="block w-full h-full">
                  <source srcSet={ABOUT_PARTNERSHIPS_VISUAL.webp} type="image/webp" />
                  <img
                    src={ABOUT_PARTNERSHIPS_VISUAL.jpg}
                    alt={ABOUT_PARTNERSHIPS_VISUAL.alt}
                    width={1280}
                    height={720}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setPartnerImgFailed(true)}
                    className="w-full h-full min-h-[300px] object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                  />
                </picture>
              ) : (
                <div className="w-full h-full min-h-[300px] bg-gradient-to-br from-[#0F2C4E] to-[#06182B]" />
              )}

              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#051527]/92 via-[#06182B]/25 to-transparent"
                aria-hidden="true"
              />

              <div className="pointer-events-none absolute bottom-0 inset-x-0 px-6 py-4 border-t border-white/10 bg-[#051527]/70 backdrop-blur-sm">
                <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#E1BB60]">
                  Collaborative Advisory
                </div>
                <div className="text-xs text-slate-200 mt-0.5">
                  Legal, Wealth Management &amp; Civic Alliances
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
