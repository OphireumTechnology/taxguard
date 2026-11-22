import React, { useState } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import type { IndustrySolutionRecord } from '../../../types';
import { getIndustryVisualProfile } from './industryVisualAssets';

interface IndustrySelectionCardProps {
  industry: IndustrySolutionRecord;
  icon: React.ElementType;
  isSelected: boolean;
  onSelect: () => void;
  shouldAnimate: boolean;
}

/**
 * Premium visual industry selector card with unique photorealistic 16:9 image,
 * subtle animated pathway overlay, accessible keyboard focus, and non-color-only
 * selected state communication.
 */
export const IndustrySelectionCard: React.FC<IndustrySelectionCardProps> = ({
  industry,
  icon: Icon,
  isSelected,
  onSelect,
  shouldAnimate,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const profile = getIndustryVisualProfile(industry.slug);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      aria-controls="selected-industry-detail-panel"
      className={`group relative flex flex-col text-left rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#D4A843] focus-visible:outline-offset-2 ${
        isSelected
          ? 'bg-[#0F2A49] border-[#D4A843] shadow-xl shadow-[#D4A843]/15 ring-1 ring-[#D4A843]/45 -translate-y-0.5'
          : 'bg-[#0A1E36]/90 border-slate-700/55 hover:border-[#D4A843]/50 hover:bg-[#0D2542] hover:-translate-y-0.5'
      }`}
    >
      {/* Top metallic gold active indicator bar */}
      <span
        className={`block h-[2px] w-full transition-opacity duration-200 ${
          isSelected
            ? 'bg-gradient-to-r from-[#C99A3D] via-[#F0CE7A] to-[#C99A3D] opacity-100'
            : 'bg-[#D4A843]/40 opacity-0 group-hover:opacity-60'
        }`}
        aria-hidden="true"
      />

      {/* Industry 16:9 Visual Header */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#06182B]">
        {!imgFailed ? (
          <picture>
            <source srcSet={profile.webp} type="image/webp" />
            <img
              src={profile.jpg}
              alt={profile.alt}
              width={640}
              height={360}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className={`w-full h-full object-cover object-center transition-transform duration-500 ease-out ${
                isSelected ? 'scale-[1.03]' : 'group-hover:scale-[1.04]'
              }`}
            />
          </picture>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0F2C4E] to-[#06182B] flex items-center justify-center">
            <Icon className="w-8 h-8 text-[#D4A843]/55" aria-hidden="true" />
          </div>
        )}

        {/* Measured contrast gradient */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A1E36] via-[#06182B]/35 to-transparent"
          aria-hidden="true"
        />

        {/* Subtle animated ledger line overlay on card */}
        <svg
          viewBox="0 0 320 180"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute inset-0 w-full h-full transition-opacity duration-300 ${
            isSelected ? 'opacity-85' : 'opacity-40 group-hover:opacity-75'
          } ${shouldAnimate ? '' : 'destria-motion-paused'}`}
          aria-hidden="true"
        >
          <path
            d="M 16 146 L 116 146 L 146 122 L 304 122"
            fill="none"
            stroke={isSelected ? '#E5B552' : '#7DD3FC'}
            strokeOpacity={isSelected ? '0.8' : '0.45'}
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '6.5s' }}
          />
          <circle
            cx="146"
            cy="122"
            r="2.6"
            fill={isSelected ? '#E5B552' : '#7DD3FC'}
            className="destria-checkpoint-glow"
          />
        </svg>

        {/* Sector icon anchored cleanly inside bottom-left of image */}
        <div
          className={`absolute bottom-2.5 left-3 w-9 h-9 rounded-xl flex items-center justify-center border backdrop-blur-sm transition-colors ${
            isSelected
              ? 'bg-[#D4A843] border-[#F0CE7A] text-[#06182B] shadow-md'
              : 'bg-[#06182B]/85 border-[#D4A843]/40 text-[#E1BB60] group-hover:border-[#D4A843]'
          }`}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>

        {/* Non-color-only active state text readout */}
        <div className="absolute top-2.5 right-3">
          {isSelected ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#06182B] bg-[#E5B552] px-2 py-0.5 rounded-md shadow-sm">
              <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Active</span>
            </span>
          ) : (
            <span className="text-[10px] font-semibold tracking-wider text-slate-200/85 bg-[#051527]/75 px-2 py-0.5 rounded-md tabular-nums">
              {profile.sectorCode}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex-1 flex flex-col justify-between p-4 sm:p-5 space-y-3">
        <div className="space-y-1.5">
          <div
            className={`font-serif text-base sm:text-[17px] font-bold leading-snug transition-colors ${
              isSelected ? 'text-white' : 'text-slate-100 group-hover:text-white'
            }`}
          >
            {profile.shortTitle}
          </div>
          <p className="text-xs text-slate-300/90 leading-relaxed line-clamp-2">
            {profile.cardSummary}
          </p>
        </div>

        <div className="pt-2.5 border-t border-slate-700/45 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-slate-400 truncate">
            {industry.applicableForms.slice(0, 2).join(' · ')}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 font-semibold shrink-0 transition-colors ${
              isSelected ? 'text-[#E5B552]' : 'text-slate-300 group-hover:text-[#E1BB60]'
            }`}
          >
            <span>{isSelected ? 'Viewing' : 'Inspect'}</span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          </span>
        </div>
      </div>
    </button>
  );
};
