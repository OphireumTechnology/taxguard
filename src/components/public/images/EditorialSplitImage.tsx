import React from 'react';

interface EditorialSplitImageProps {
  srcJpg?: string;
  srcWebp?: string;
  src?: string;
  webpSrc?: string;
  alt: string;
  caption?: string;
  tag?: string;
  badgeText?: string;
  aspectRatio?: '4/3' | '16/9' | '1/1' | 'auto';
  className?: string;
}

export const EditorialSplitImage: React.FC<EditorialSplitImageProps> = ({
  srcJpg,
  srcWebp,
  src,
  webpSrc,
  alt,
  caption,
  tag,
  badgeText,
  aspectRatio = '4/3',
  className = '',
}) => {
  const finalJpg = srcJpg || src || '';
  const finalWebp = srcWebp || webpSrc;
  const finalTag = tag || badgeText;
  const aspectClass = {
    '4/3': 'aspect-[4/3] min-h-[280px]',
    '16/9': 'aspect-[16/9] min-h-[260px]',
    '1/1': 'aspect-square min-h-[280px]',
    'auto': 'h-full min-h-[300px]',
  }[aspectRatio];

  return (
    <div
      className={`relative w-full ${aspectClass} rounded-2xl sm:rounded-3xl overflow-hidden border border-[#1E3A5F] bg-[#07172B] group shadow-xl ${className}`}
    >
      <picture className="w-full h-full block">
        {finalWebp && <source srcSet={finalWebp} type="image/webp" />}
        <img
          src={finalJpg}
          alt={alt}
          width={800}
          height={600}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
      </picture>

      {/* Restrained bottom gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#06172C]/85 via-transparent to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Subtle border highlight */}
      <div
        className="absolute inset-0 ring-1 ring-inset ring-white/10 group-hover:ring-[#C6A15B]/40 transition-colors rounded-2xl sm:rounded-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Optional Metadata Bar */}
      {(caption || finalTag) && (
        <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between gap-3 text-xs text-white z-10">
          {caption && (
            <div className="text-[11px] sm:text-xs text-slate-200 font-medium truncate drop-shadow-sm">
              {caption}
            </div>
          )}
          {finalTag && (
            <span className="text-[10px] text-[#E2BD67] font-semibold uppercase tracking-wider bg-[#07172B]/90 px-2.5 py-1 rounded-full border border-[#C6A15B]/30 shrink-0">
              {finalTag}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
