import React, { useState } from 'react';
import {
  Building2,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { TaxStrategyRecord } from '../../../types';
import { STRATEGY_CATEGORIES_MAP } from '../../../data/taxStrategiesData';
import { STRATEGY_CATEGORY_VISUALS } from './strategyVisualAssets';

interface StrategyCategoryCardProps {
  strategy: TaxStrategyRecord;
  isStaff: boolean;
  shouldAnimate: boolean;
  onViewDossier: (strategy: TaxStrategyRecord) => void;
  onEditStrategy: (strategy: TaxStrategyRecord) => void;
}

/**
 * Institutional fintech Tax Strategy Card preserving all strategy metadata,
 * eligibility conditions, statutory authority, tax year, and dossier action.
 */
export const StrategyCategoryCard: React.FC<StrategyCategoryCardProps> = ({
  strategy,
  isStaff,
  shouldAnimate,
  onViewDossier,
  onEditStrategy,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  const visual = STRATEGY_CATEGORY_VISUALS[strategy.category];
  const categoryLabel =
    STRATEGY_CATEGORIES_MAP[strategy.category]?.label || strategy.category;

  return (
    <article className="group relative h-full rounded-2xl bg-[#091E36]/92 backdrop-blur-md border border-slate-700/65 hover:border-[#D4A843]/65 focus-within:border-[#D4A843]/75 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-0.5 shadow-[0_14px_40px_-24px_rgba(2,13,24,0.9)] hover:shadow-[0_22px_52px_-22px_rgba(212,168,67,0.28)]">
      {/* Top animated gold illumination hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#E5B552]/85 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300"
        aria-hidden="true"
      />

      <div>
        {/* Compact 16:9 Category-Specific Technology Visual Banner */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#051426] border-b border-slate-700/55">
          {visual && !imageFailed ? (
            <picture>
              <source srcSet={visual.webp} type="image/webp" />
              <img
                src={visual.jpg}
                alt={visual.alt}
                width={880}
                height={495}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setImageFailed(true)}
                className="w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.045]"
              />
            </picture>
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background:
                  'radial-gradient(circle at 50% 45%, rgba(212, 168, 67, 0.16), rgba(6, 24, 43, 0.96) 72%)',
              }}
            >
              <ShieldCheck className="w-9 h-9 text-[#D4A843]/60" />
            </div>
          )}

          {/* Subtle bottom atmospheric fade into the card body */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#091E36] via-[#06182B]/20 to-[#06182B]/35"
            aria-hidden="true"
          />

          {/* Restrained data-pathway micro-overlay */}
          <CardPathwayOverlay
            variant={visual?.pathwayVariant ?? 'ascending'}
            shouldAnimate={shouldAnimate}
          />

          {/* Top overlay header strip: Category designation & Tax Year */}
          <div className="pointer-events-none absolute inset-x-3.5 top-3 flex items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-md bg-[#06182B]/85 backdrop-blur-md border border-[#D4A843]/40 text-[10px] font-bold tracking-wider uppercase text-[#E5B552] truncate max-w-[66%]">
              {categoryLabel}
            </span>
            <span className="px-2 py-1 rounded-md bg-[#06182B]/80 backdrop-blur-md border border-slate-700/70 text-[10px] font-mono text-slate-300 flex items-center gap-1 shrink-0 tabular-nums">
              <Clock className="w-3 h-3 text-[#7DD3FC]" />
              <span>TY {strategy.applicableTaxYear}</span>
            </span>
          </div>
        </div>

        {/* Card Content Body */}
        <div className="p-5 sm:p-6 pb-4 space-y-3.5">
          <h3 className="font-serif text-lg font-bold text-[#F8FAFC] group-hover:text-[#E5B552] transition-colors leading-snug">
            {strategy.strategyName}
          </h3>

          <p className="text-xs text-[#A9B7C8] line-clamp-3 leading-relaxed">
            {strategy.plainLanguageSummary}
          </p>

          {/* Eligibility & Statutory Authority */}
          <div className="pt-3 border-t border-slate-700/55 space-y-2 text-xs">
            <div className="flex items-start gap-2 text-[#A9B7C8] text-[11px] leading-snug">
              <Building2 className="w-3.5 h-3.5 text-[#D4A843] shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                <strong className="text-slate-200 font-semibold">Eligibility:</strong>{' '}
                {strategy.eligibleTaxpayerType}
              </span>
            </div>
            <div className="flex items-start gap-2 text-[#A9B7C8] text-[11px] leading-snug">
              <FileText className="w-3.5 h-3.5 text-[#7DD3FC] shrink-0 mt-0.5" />
              <span className="truncate">
                <strong className="text-slate-200 font-semibold">Authority:</strong>{' '}
                {strategy.officialAuthority.codeCitation}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-5 sm:px-6 pb-5 pt-3.5 mt-auto border-t border-slate-700/55 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onViewDossier(strategy)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5B552] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] rounded-md py-1"
        >
          <span>View Dossier &amp; Checklist</span>
          <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>

        {isStaff && (
          <button
            type="button"
            onClick={() => onEditStrategy(strategy)}
            className="p-1.5 rounded-lg bg-[#102D4F] text-[#A9B7C8] hover:text-[#F8FAFC] hover:bg-[#143657] border border-slate-700/60 transition"
            title="Edit Strategy (Staff)"
            aria-label={`Edit ${strategy.strategyName}`}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
};

interface CardPathwayOverlayProps {
  variant: 'ascending' | 'dual' | 'orbital' | 'grid';
  shouldAnimate: boolean;
}

const CardPathwayOverlay: React.FC<CardPathwayOverlayProps> = ({
  variant,
  shouldAnimate,
}) => {
  const pathByVariant: Record<CardPathwayOverlayProps['variant'], string> = {
    ascending: 'M 20 148 C 102 134, 152 96, 224 68 L 302 42',
    dual: 'M 18 134 L 128 96 L 194 96 L 302 58',
    orbital: 'M 42 126 Q 160 44 278 126',
    grid: 'M 22 142 H 116 V 88 H 214 V 52 H 298',
  };

  const pathD = pathByVariant[variant];

  return (
    <svg
      viewBox="0 0 320 180"
      className="pointer-events-none absolute inset-0 w-full h-full opacity-45 group-hover:opacity-90 transition-opacity duration-300"
      aria-hidden="true"
    >
      <path
        d={pathD}
        fill="none"
        stroke="#E5B552"
        strokeWidth="1.2"
        className="destria-ecosystem-stream"
        style={{ animationDuration: '5.2s' }}
      />
      {shouldAnimate && (
        <circle r="2.6" fill="#F3CE74" opacity="0.9">
          <animateMotion dur="5.8s" repeatCount="indefinite" path={pathD} />
        </circle>
      )}
    </svg>
  );
};
