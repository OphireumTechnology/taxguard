import React from 'react';

interface PublicHeroImageProps {
  srcJpg: string;
  srcWebp?: string;
  alt: string;
  badgeText?: string;
  locationText?: string;
  aspectRatio?: '21/9' | '16/9' | '16/10' | 'auto';
  className?: string;
  gradientOverlay?: 'default' | 'subtle' | 'editorial' | 'none';
  children?: React.ReactNode;
}

export const PublicHeroImage: React.FC<PublicHeroImageProps> = ({
  srcJpg,
  srcWebp,
  alt,
  badgeText,
  locationText,
  aspectRatio = '16/9',
  className = '',
  gradientOverlay = 'default',
  children,
}) => {
  const aspectClasses = {
    '21/9': 'aspect-[21/9] min-h-[360px] sm:min-h-[460px]',
    '16/9': 'aspect-[16/9] min-h-[320px] sm:min-h-[420px]',
    '16/10': 'aspect-[16/10] min-h-[320px]',
    'auto': 'h-full min-h-[300px]',
  }[aspectRatio];

  const overlayClasses = {
    default: 'bg-gradient-to-t from-[#06172C] via-[#06172C]/30 to-transparent',
    subtle: 'bg-gradient-to-t from-[#06172C]/70 via-transparent to-transparent',
    editorial: 'bg-gradient-to-r from-[#06172C]/90 via-[#06172C]/40 to-transparent',
    none: 'hidden',
  }[gradientOverlay];

  return (
    <div
      className={`relative w-full ${aspectClasses} rounded-2xl sm:rounded-3xl overflow-hidden border border-[#C6A15B]/30 bg-[#06172C] shadow-2xl ${className}`}
    >
      <picture className="w-full h-full block">
        {srcWebp && <source srcSet={srcWebp} type="image/webp" />}
        <img
          src={srcJpg}
          alt={alt}
          width={1200}
          height={800}
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover object-center transform transition-transform duration-1000 ease-out"
          referrerPolicy="no-referrer"
        />
      </picture>

      {/* Restrained gradient overlay that protects text readability while retaining image depth and natural colors */}
      <div
        className={`absolute inset-0 ${overlayClasses} pointer-events-none`}
        aria-hidden="true"
      />

      {/* Subtle outer inner-ring */}
      <div
        className="absolute inset-0 ring-1 ring-inset ring-[#C6A15B]/20 rounded-2xl sm:rounded-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Optional Metadata Tag Bar */}
      {(badgeText || locationText) && (
        <div className="absolute bottom-3 sm:bottom-4 left-4 right-4 flex items-center justify-between gap-3 text-xs text-white z-10">
          {locationText && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#06172C]/85 border border-[#1E3A5F] text-slate-200 text-[11px] font-medium backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C6A15B]" />
              <span>{locationText}</span>
            </div>
          )}
          {badgeText && (
            <span className="text-[10px] sm:text-[11px] text-[#E2BD67] font-semibold tracking-wider uppercase bg-[#06172C]/90 px-3 py-1 rounded-full border border-[#C6A15B]/40 shadow-sm backdrop-blur-sm">
              {badgeText}
            </span>
          )}
        </div>
      )}

      {children && <div className="absolute inset-0 z-10">{children}</div>}
    </div>
  );
};
