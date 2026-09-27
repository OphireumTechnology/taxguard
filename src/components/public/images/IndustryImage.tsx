import React from 'react';

interface IndustryImageProps {
  srcJpg: string;
  srcWebp?: string;
  alt: string;
  industryName: string;
  formsTag?: string;
  className?: string;
}

export const IndustryImage: React.FC<IndustryImageProps> = ({
  srcJpg,
  srcWebp,
  alt,
  industryName,
  formsTag,
  className = '',
}) => {
  return (
    <div
      className={`relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-[#1E3A5F] bg-[#07172B] shadow-lg group ${className}`}
    >
      <picture className="w-full h-full block">
        {srcWebp && <source srcSet={srcWebp} type="image/webp" />}
        <img
          src={srcJpg}
          alt={alt}
          width={700}
          height={394}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
      </picture>

      <div
        className="absolute inset-0 bg-gradient-to-t from-[#06172C]/90 via-[#06172C]/25 to-transparent pointer-events-none"
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 ring-1 ring-inset ring-white/10 group-hover:ring-[#C6A15B]/40 transition-colors rounded-2xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between text-xs z-10">
        <span className="font-serif font-bold text-white text-xs sm:text-sm drop-shadow-sm">
          {industryName}
        </span>
        {formsTag && (
          <span className="text-[10px] font-mono text-[#C6A15B] bg-[#07172B]/90 px-2 py-0.5 rounded border border-[#1E3A5F]">
            {formsTag}
          </span>
        )}
      </div>
    </div>
  );
};
