import React from 'react';
import { MapPin } from 'lucide-react';
import { BRAND_ASSETS } from '../../../utils/assets';
import { COMPANY_BRANDING, COMPANY_CONTACT } from '../../../config/companyBranding';

interface FounderPortraitProps {
  size?: 'sm' | 'md' | 'lg' | 'full';
  variant?: 'portrait' | 'wide' | 'landscape' | 'square' | 'mobile';
  showBadge?: boolean;
  caption?: string;
  className?: string;
  priority?: boolean;
}

const SIZE_MAX_WIDTH: Record<NonNullable<FounderPortraitProps['size']>, string> = {
  sm: 'max-w-[280px]',
  md: 'max-w-[380px]',
  lg: 'max-w-[460px]',
  full: 'max-w-full',
};

/**
 * FounderPortrait Component
 *
 * Displays the centralized official executive portrait:
 * /branding/destria-founder-executive-portrait.png (versioned via content hash).
 * Preserves the exact 1:1 original proportions so Desmond Hinds and the official
 * Destria Tax Services wall emblem remain sharp, complete, and uncropped on all viewports.
 */
export const FounderPortrait: React.FC<FounderPortraitProps> = ({
  size = 'lg',
  showBadge = true,
  caption,
  className = '',
  priority = true,
}) => {
  return (
    <figure
      className={`relative w-full ${SIZE_MAX_WIDTH[size]} rounded-2xl sm:rounded-3xl border border-[#D4A843]/50 bg-[#06182B] p-2.5 sm:p-3 shadow-2xl overflow-hidden flex flex-col items-center justify-center ${className}`}
      id="founder-portrait-container"
    >
      {/* Subtle navy architectural backdrop */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0A213C] via-[#06182B] to-[#04101E] pointer-events-none"
        aria-hidden="true"
      />

      {/* Uncropped 1:1 container preserving portrait and background Destria emblem */}
      <div
        className="relative w-full aspect-square flex items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl bg-[#06182B]"
        id="ceo-photo-frame"
      >
        <img
          id="ceo-official-portrait"
          src={BRAND_ASSETS.destriaFounderPortrait}
          alt={`Desmond Hinds, Founder and Chief Executive Officer of ${COMPANY_BRANDING.displayName}, standing in front of the official Destria Tax Services corporate emblem`}
          width={1254}
          height={1254}
          className="ceo-photo"
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
        />

        {/* Subtle metallic gold inner hairline frame */}
        <div
          className="absolute inset-0 ring-1 ring-inset ring-[#D4A843]/35 rounded-xl sm:rounded-2xl pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Consistent Corporate Executive Caption */}
      {showBadge && (
        <figcaption className="w-full mt-3 px-1.5 flex flex-col gap-1 text-center sm:text-left z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="text-[11px] font-bold tracking-wider text-[#E5B552] uppercase">
              {caption || 'Desmond Hinds • Founder & Chief Executive Officer'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-between gap-x-2 gap-y-1 text-[11px] text-slate-300">
            <span className="font-medium text-slate-200">{COMPANY_BRANDING.displayName}</span>
            <span className="inline-flex items-center gap-1 text-slate-300">
              <MapPin className="w-3 h-3 text-[#D4A843] flex-shrink-0" />
              <span>{COMPANY_CONTACT.location}</span>
            </span>
          </div>
        </figcaption>
      )}
    </figure>
  );
};
