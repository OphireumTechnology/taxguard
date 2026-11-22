import React, { useState } from 'react';

interface ServiceTechnologyVisualProps {
  webpSrc: string;
  jpgSrc: string;
  alt: string;
  categoryLabel: string;
  icon: React.ReactNode;
  animate: boolean;
}

/**
 * Photorealistic 16:9 service card visual with restrained architectural motion accents,
 * lazy loading, explicit dimensions, and graceful fallback handling.
 */
export const ServiceTechnologyVisual: React.FC<ServiceTechnologyVisualProps> = ({
  webpSrc,
  jpgSrc,
  alt,
  categoryLabel,
  icon,
  animate
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-[rgba(212,168,67,0.22)] bg-[#051424] ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      {!imageError ? (
        <picture>
          <source srcSet={webpSrc} type="image/webp" />
          <img
            src={jpgSrc}
            alt={alt}
            width={1376}
            height={768}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
            className="h-full w-full object-cover object-center brightness-[0.9] contrast-[1.04] transition-transform duration-700 ease-out group-hover:scale-[1.03]"
          />
        </picture>
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full bg-[radial-gradient(circle_at_60%_40%,rgba(212,168,67,0.2),rgba(13,39,69,0.9)_52%,#051424_100%)]"
        />
      )}

      {/* Clean Atmospheric Navy Scrim for High-Contrast Foreground Legibility */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#081A30] via-[#081A30]/25 to-[#06182B]/30"
      />

      {/* Subtle Moving Metallic-Gold Verification Reflection & Corner Geometry */}
      <div
        aria-hidden="true"
        className="destria-card-scan-beam pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-[rgba(212,168,67,0.13)] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 border-l border-t border-[rgba(212,168,67,0.5)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 border-r border-t border-[rgba(212,168,67,0.5)]"
      />

      {/* Subtle SVG Node Accent in Upper Right */}
      <svg
        aria-hidden="true"
        viewBox="0 0 120 44"
        fill="none"
        className="pointer-events-none absolute right-3 top-3 h-10 w-28 opacity-75"
      >
        <path
          d="M 8 22 L 56 22 L 74 12 L 112 12"
          stroke="rgba(212, 168, 67, 0.35)"
          strokeWidth="1"
        />
        <path
          d="M 8 22 L 56 22 L 74 12 L 112 12"
          stroke="#E1BB60"
          strokeWidth="1.25"
          className="destria-ecosystem-stream"
        />
        <circle cx="56" cy="22" r="2.2" fill="#E1BB60" />
        <circle cx="112" cy="12" r="2.2" fill="#93C5FD" className="destria-checkpoint-glow" />
      </svg>

      {/* Bottom Classification Bar (Unboxed Matte Glass — Zero Pill Badges) */}
      <div className="absolute inset-x-4 bottom-3.5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(212,168,67,0.38)] bg-[#06182B]/85 backdrop-blur-md">
          {icon}
        </div>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#E5B552] drop-shadow-sm">
          {categoryLabel}
        </span>
      </div>
    </div>
  );
};
