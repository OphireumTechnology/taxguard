import React from 'react';
import { MapPin } from 'lucide-react';

interface FounderPortraitProps {
  size?: 'sm' | 'md' | 'lg' | 'full';
  variant?: 'portrait' | 'wide' | 'landscape' | 'square' | 'mobile';
  showBadge?: boolean;
  caption?: string;
  className?: string;
  priority?: boolean;
}

/**
 * FounderPortrait Component
 *
 * Displays the verified CEO photograph:
 * /images/123456789-desmond.png
 * Preserving the original aspect ratio with object-fit: contain
 * without distortion, stretching, or cropping.
 */
export const FounderPortrait: React.FC<FounderPortraitProps> = ({
  showBadge = true,
  caption,
  className = '',
  priority = true,
}) => {
  return (
    <figure
      className={`relative rounded-2xl sm:rounded-3xl border border-[#C99A3D]/40 bg-[#06172C] p-2 sm:p-3 shadow-2xl overflow-hidden flex flex-col items-center justify-center group ${className}`}
      id="founder-portrait-container"
    >
      {/* Background subtle architectural gradient to complement portrait */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#0A1F38] via-[#06172C] to-[#040E1B] pointer-events-none"
        aria-hidden="true"
      />

      {/* Frame wrapper strictly containing full photograph without forced cropping */}
      <div
        className="relative w-full flex items-center justify-center overflow-hidden rounded-xl bg-[#06172C]"
        id="ceo-photo-frame"
      >
        <img
          id="ceo-official-portrait"
          src="/ceo/123456789-desmond.png?v=20260922-1"
          alt="Desmond Hinds, Founder and Chief Executive Officer of A/R Tax Services, LLC"
          className="ceo-photo"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />

        {/* Subtle executive vignette along corners to anchor frame without covering subject */}
        <div
          className="absolute inset-0 ring-1 ring-inset ring-[#C99A3D]/25 rounded-xl pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Executive Caption / Verification Badge */}
      {showBadge && (
        <figcaption className="w-full mt-3 px-2 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left z-10">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#C99A3D]" aria-hidden="true" />
            <span className="text-[11px] font-bold tracking-wider text-[#E2BD67] uppercase">
              {caption || 'Desmond Hinds • Founder & Chief Executive Officer'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-300 font-medium">
            <MapPin className="w-3 h-3 text-[#C99A3D] flex-shrink-0" />
            <span>Columbia, SC Practice Office</span>
          </div>
        </figcaption>
      )}
    </figure>
  );
};
