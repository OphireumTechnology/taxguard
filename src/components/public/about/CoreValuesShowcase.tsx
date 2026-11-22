import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Building,
  CheckCircle2,
  HeartHandshake,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { CORE_VALUE_ASSETS, type CoreValueAssetId } from './aboutVisualAssets';

interface CoreValueDefinition {
  id: CoreValueAssetId;
  index: string;
  subtitle: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  gridSpanClass: string;
}

const CORE_VALUES: CoreValueDefinition[] = [
  {
    id: 'accuracy',
    index: '01',
    subtitle: 'Precision Standard',
    title: 'Accuracy',
    desc: 'Precision is paramount in accounting. We cross-verify all documents and data points with multi-tiered professional accounting reviews.',
    icon: Award,
    gridSpanClass: 'md:col-span-1 lg:col-span-6',
  },
  {
    id: 'integrity',
    index: '02',
    subtitle: 'Ethical Stewardship',
    title: 'Integrity',
    desc: 'We operate with uncompromising ethical standards, honoring your trust and ensuring full statutory compliance.',
    icon: ShieldCheck,
    gridSpanClass: 'md:col-span-1 lg:col-span-6',
  },
  {
    id: 'transparency',
    index: '03',
    subtitle: 'Traceable Clarity',
    title: 'Transparency',
    desc: 'No hidden fees, no opaque algorithms. Clear upfront pricing and plain-English explanations of all deductions and filings.',
    icon: CheckCircle2,
    gridSpanClass: 'md:col-span-1 lg:col-span-4',
  },
  {
    id: 'client_first',
    index: '04',
    subtitle: 'Dedicated Counsel',
    title: 'Client-First Service',
    desc: 'Your goals and peace of mind guide every strategy. We structure our advisory around your unique personal and business needs.',
    icon: Users,
    gridSpanClass: 'md:col-span-1 lg:col-span-4',
  },
  {
    id: 'education',
    index: '05',
    subtitle: 'Informed Decisions',
    title: 'Education',
    desc: 'Empowering clients through knowledge. We clarify complex tax laws so you make confident, informed financial choices.',
    icon: BookOpen,
    gridSpanClass: 'md:col-span-1 lg:col-span-4',
  },
  {
    id: 'relationships',
    index: '06',
    subtitle: 'Multi-Year Continuity',
    title: 'Long-Term Relationships',
    desc: 'We are your steadfast year-round advocates, supporting your growth from early ventures to multi-generational wealth.',
    icon: HeartHandshake,
    gridSpanClass: 'md:col-span-1 lg:col-span-6',
  },
  {
    id: 'community',
    index: '07',
    subtitle: 'Regional Empowerment',
    title: 'Community Impact',
    desc: 'Committed to building stronger communities in South Carolina and beyond through accessible financial education programs.',
    icon: Building,
    gridSpanClass: 'md:col-span-2 lg:col-span-6',
  },
];

const ValueVisualMotif: React.FC<{
  id: CoreValueAssetId;
  shouldAnimate: boolean;
}> = ({ id, shouldAnimate }) => {
  const paused = shouldAnimate ? '' : 'destria-motion-paused';

  switch (id) {
    case 'accuracy':
      return (
        <svg
          viewBox="0 0 400 225"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-75 ${paused}`}
          aria-hidden="true"
        >
          <path
            d="M 24 190 L 130 190 L 170 156 L 376 156"
            fill="none"
            stroke="#E5B552"
            strokeOpacity="0.6"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '6.8s' }}
          />
          <circle cx="170" cy="156" r="2.8" fill="#E5B552" className="destria-checkpoint-glow" />
        </svg>
      );
    case 'integrity':
      return (
        <svg
          viewBox="0 0 400 225"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-70 ${paused}`}
          aria-hidden="true"
        >
          <path
            d="M 28 32 L 154 32 L 182 54 L 372 54"
            fill="none"
            stroke="#7DD3FC"
            strokeOpacity="0.55"
            strokeWidth="1.1"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '7.5s' }}
          />
          <circle cx="182" cy="54" r="2.5" fill="#7DD3FC" className="destria-checkpoint-glow" />
        </svg>
      );
    case 'transparency':
      return (
        <svg
          viewBox="0 0 400 225"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-80 ${paused}`}
          aria-hidden="true"
        >
          <path
            d="M 18 182 L 138 182 L 198 142 L 382 142"
            fill="none"
            stroke="#E5B552"
            strokeOpacity="0.72"
            strokeWidth="1.25"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '6.2s' }}
          />
          <rect
            x="194"
            y="138"
            width="8"
            height="8"
            rx="1.5"
            fill="#06182B"
            stroke="#E5B552"
            strokeWidth="1.2"
          />
        </svg>
      );
    case 'client_first':
      return (
        <svg
          viewBox="0 0 400 225"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-65 ${paused}`}
          aria-hidden="true"
        >
          <path
            d="M 26 196 Q 200 158 374 188"
            fill="none"
            stroke="#E5B552"
            strokeOpacity="0.55"
            strokeWidth="1.15"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '8.4s' }}
          />
        </svg>
      );
    case 'education':
      return (
        <svg
          viewBox="0 0 400 225"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-75 ${paused}`}
          aria-hidden="true"
        >
          <path
            d="M 24 186 L 116 170 L 210 176 L 304 148 L 376 136"
            fill="none"
            stroke="#7DD3FC"
            strokeOpacity="0.62"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '7.2s' }}
          />
          <circle cx="304" cy="148" r="2.5" fill="#E5B552" className="destria-checkpoint-glow" />
        </svg>
      );
    case 'relationships':
      return (
        <svg
          viewBox="0 0 400 225"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-75 ${paused}`}
          aria-hidden="true"
        >
          <path
            d="M 24 176 C 120 132, 280 202, 376 146"
            fill="none"
            stroke="#E5B552"
            strokeOpacity="0.65"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '8.8s' }}
          />
          <circle cx="198" cy="166" r="2.8" fill="#E5B552" className="destria-checkpoint-glow" />
        </svg>
      );
    case 'community':
      return (
        <svg
          viewBox="0 0 400 225"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full opacity-80 ${paused}`}
          aria-hidden="true"
        >
          <path
            d="M 32 178 Q 200 116 368 172"
            fill="none"
            stroke="#E5B552"
            strokeOpacity="0.7"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '9.2s' }}
          />
          <circle cx="200" cy="145" r="3" fill="#E5B552" className="destria-checkpoint-glow" />
        </svg>
      );
  }
};

const CoreValueCard: React.FC<{
  item: CoreValueDefinition;
  shouldAnimate: boolean;
}> = ({ item, shouldAnimate }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const asset = CORE_VALUE_ASSETS[item.id];
  const Icon = item.icon;

  return (
    <article
      className={`group relative flex flex-col rounded-2xl overflow-hidden bg-[#0A1F38]/90 border border-slate-700/55 hover:border-[#D4A843]/50 transition-all duration-300 shadow-lg hover:-translate-y-0.5 ${item.gridSpanClass}`}
    >
      {/* Unique 16:9 Realistic Visual Container */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#06182B]">
        {!imgFailed ? (
          <picture>
            <source srcSet={asset.webp} type="image/webp" />
            <img
              src={asset.jpg}
              alt={asset.alt}
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.035]"
            />
          </picture>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0F2C4E] to-[#06182B] flex items-center justify-center">
            <Icon className="w-10 h-10 text-[#D4A843]/50" aria-hidden="true" />
          </div>
        )}

        {/* Measured Contrast Scrim */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A1F38] via-[#06182B]/25 to-transparent"
          aria-hidden="true"
        />

        {/* Tailored Restrained Digital Overlay */}
        <ValueVisualMotif id={item.id} shouldAnimate={shouldAnimate} />
      </div>

      {/* Card Body */}
      <div className="flex-1 flex flex-col p-6 sm:p-7 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#D4A843]">
            {item.index} · {item.subtitle}
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#07182C] border border-[#D4A843]/30 flex items-center justify-center text-[#E1BB60] shrink-0 group-hover:border-[#D4A843]/65 transition-colors">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <h3 className="font-serif text-xl sm:text-2xl font-bold text-white leading-snug">
          {item.title}
        </h3>

        <p className="text-sm text-slate-300 leading-relaxed">{item.desc}</p>
      </div>
    </article>
  );
};

interface CoreValuesShowcaseProps {
  shouldAnimate: boolean;
}

/**
 * Balanced 2 + 3 + 2 asymmetric 12-column grid displaying all seven
 * Destria corporate values with distinct visual assets and zero isolated orphan cards.
 */
export const CoreValuesShowcase: React.FC<CoreValuesShowcaseProps> = ({ shouldAnimate }) => {
  return (
    <section
      aria-labelledby="core-values-heading"
      className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8"
    >
      <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
        <div className="text-xs font-bold tracking-[0.18em] uppercase text-[#E1BB60]">
          Principles We Live By
        </div>
        <h2
          id="core-values-heading"
          className="font-serif text-3xl sm:text-4xl lg:text-[2.5rem] font-bold text-white leading-tight"
        >
          Our Core Values
        </h2>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          These foundational standards govern every client consultation, balance sheet, and tax
          preparation we deliver.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-7">
        {CORE_VALUES.map((item) => (
          <CoreValueCard key={item.id} item={item} shouldAnimate={shouldAnimate} />
        ))}
      </div>
    </section>
  );
};
