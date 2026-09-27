import React from 'react';

interface ServiceCardImageProps {
  srcJpg?: string;
  srcWebp?: string;
  src?: string;
  webpSrc?: string;
  alt: string;
  categoryTag?: string;
  categoryBadge?: string;
  icon?: React.ReactNode;
  aspectRatio?: '16/9' | '4/3' | '3/2';
  objectPosition?: string;
  className?: string;
}

export const ServiceCardImage: React.FC<ServiceCardImageProps> = ({
  srcJpg,
  srcWebp,
  src,
  webpSrc,
  alt,
  categoryTag,
  categoryBadge,
  icon,
  aspectRatio = '16/9',
  objectPosition = 'center',
  className = '',
}) => {
  const finalJpg = srcJpg || src || '';
  const finalWebp = srcWebp || webpSrc;
  const finalTag = categoryTag || categoryBadge;

  const aspectClass = {
    '16/9': 'aspect-[16/9]',
    '4/3': 'aspect-[4/3]',
    '3/2': 'aspect-[3/2]',
  }[aspectRatio];

  return (
    <div
      className={`relative w-full ${aspectClass} rounded-xl sm:rounded-2xl overflow-hidden border border-[#1E3A5F] bg-[#07172B] group ${className}`}
    >
      <picture className="w-full h-full block">
        {finalWebp && <source srcSet={finalWebp} type="image/webp" />}
        <img
          src={finalJpg}
          alt={alt}
          width={600}
          height={338}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          style={{ objectPosition }}
          referrerPolicy="no-referrer"
        />
      </picture>

      {/* Restrained gradient: minimal bottom darkening only for label contrast */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#06172C]/85 via-[#06172C]/20 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Subtle border accent */}
      <div
        className="absolute inset-0 ring-1 ring-inset ring-white/10 group-hover:ring-[#C6A15B]/40 transition-colors rounded-xl sm:rounded-2xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top-Left Category Icon Container */}
      {icon && (
        <div className="absolute top-3 left-3 p-2 rounded-lg bg-[#07172B]/90 text-[#C6A15B] border border-[#1E3A5F] shadow-md backdrop-blur-sm">
          {icon}
        </div>
      )}

      {/* Bottom-Right Category Tag */}
      {finalTag && (
        <div className="absolute bottom-2.5 right-3 text-[11px] font-semibold text-[#E2BD67] bg-[#07172B]/95 px-3 py-1 rounded-full border border-[#C6A15B]/30 shadow-md backdrop-blur-sm">
          {finalTag}
        </div>
      )}
    </div>
  );
};
