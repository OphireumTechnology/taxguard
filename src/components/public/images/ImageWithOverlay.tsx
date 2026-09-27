import React from 'react';

interface ImageWithOverlayProps {
  srcJpg: string;
  srcWebp?: string;
  alt: string;
  aspectRatio?: string;
  overlayOpacity?: string;
  className?: string;
  children?: React.ReactNode;
}

export const ImageWithOverlay: React.FC<ImageWithOverlayProps> = ({
  srcJpg,
  srcWebp,
  alt,
  aspectRatio = 'aspect-[16/9]',
  overlayOpacity = 'bg-gradient-to-t from-[#06172C] via-[#06172C]/40 to-transparent',
  className = '',
  children,
}) => {
  return (
    <div
      className={`relative w-full ${aspectRatio} rounded-2xl overflow-hidden border border-[#1E3A5F] bg-[#07172B] ${className}`}
    >
      <picture className="w-full h-full block">
        {srcWebp && <source srcSet={srcWebp} type="image/webp" />}
        <img
          src={srcJpg}
          alt={alt}
          width={800}
          height={450}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </picture>

      <div className={`absolute inset-0 ${overlayOpacity} pointer-events-none`} aria-hidden="true" />

      {children && <div className="absolute inset-0 z-10">{children}</div>}
    </div>
  );
};
