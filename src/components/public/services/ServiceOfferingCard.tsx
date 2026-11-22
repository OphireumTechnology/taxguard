import React, { useState } from 'react';
import { Check, ShieldCheck } from 'lucide-react';
import {
  SERVICE_CARD_ASSETS,
  type ServiceOverlayMotif,
} from './servicesVisualAssets';

export interface ServiceOfferingItem {
  id: string;
  index: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ServiceOfferingCardProps {
  item: ServiceOfferingItem;
  shouldAnimate: boolean;
}

/**
 * Redesigned service offering card with unique 16:9 technology imagery,
 * restrained motif-specific SVG/CSS animation overlay, consistent card height,
 * and verbatim preservation of existing titles and descriptions.
 */
export const ServiceOfferingCard: React.FC<ServiceOfferingCardProps> = ({
  item,
  shouldAnimate,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const asset = SERVICE_CARD_ASSETS[item.id];
  const Icon = item.icon;

  return (
    <article className="group relative h-full rounded-2xl bg-[#081C33]/92 backdrop-blur-md border border-slate-700/65 hover:border-[#D4A843]/65 focus-within:border-[#D4A843]/75 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-0.5 shadow-[0_14px_40px_-24px_rgba(2,13,24,0.9)] hover:shadow-[0_22px_50px_-22px_rgba(212,168,67,0.28)]">
      {/* Top champagne-gold border illumination on hover/focus */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#E5B552]/85 to-transparent opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300"
        aria-hidden="true"
      />

      <div>
        {/* Unique 16:9 Service Visual Banner */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#051426] border-b border-slate-700/55">
          {asset && !imageFailed ? (
            <picture>
              <source srcSet={asset.webp} type="image/webp" />
              <img
                src={asset.jpg}
                alt={asset.alt}
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

          {/* Subtle bottom atmospheric transition into the glass card body */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#081C33] via-[#06182B]/15 to-[#06182B]/30"
            aria-hidden="true"
          />

          {/* Subtle motif-specific animated overlay */}
          <ServiceMotifOverlay
            motif={asset?.motif ?? 'pathway'}
            shouldAnimate={shouldAnimate}
          />

          {/* Corner icon medallion & crisp numeric identifier */}
          <div className="pointer-events-none absolute inset-x-3.5 top-3 flex items-center justify-between">
            <span className="w-8 h-8 rounded-lg bg-[#06182B]/85 backdrop-blur-md border border-slate-600/65 group-hover:border-[#D4A843]/65 flex items-center justify-center text-[#E5B552] transition-colors">
              <Icon className="w-4 h-4" />
            </span>
            <span className="px-2 py-0.5 rounded bg-[#06182B]/80 backdrop-blur-md border border-slate-700/70 font-mono text-[10px] text-slate-300 group-hover:text-[#E5B552] group-hover:border-[#D4A843]/50 tabular-nums transition-colors">
              {item.index}
            </span>
          </div>
        </div>

        {/* Preserved Service Title & Description */}
        <div className="p-5 sm:p-6 space-y-3">
          <div className="flex items-start gap-2.5">
            <Check className="w-4 h-4 text-[#D4A843] shrink-0 mt-1" />
            <h3 className="font-serif text-lg font-bold text-white group-hover:text-[#E5B552] transition-colors leading-snug">
              {item.title}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-[#A9B7C8] leading-relaxed">
            {item.desc}
          </p>
        </div>
      </div>

      {/* Understated Professional Oversight Footer */}
      <div className="px-5 sm:px-6 pb-5 pt-3.5 mt-auto border-t border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400">
        <span className="text-[#E5B552]/90 font-medium">
          Specialist-Reviewed Process
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          Destria Advisory
        </span>
      </div>
    </article>
  );
};

interface MotifOverlayProps {
  motif: ServiceOverlayMotif;
  shouldAnimate: boolean;
}

const ServiceMotifOverlay: React.FC<MotifOverlayProps> = ({
  motif,
  shouldAnimate,
}) => {
  switch (motif) {
    case 'scan':
      return (
        <div
          className="pointer-events-none absolute inset-0 opacity-50 group-hover:opacity-90 transition-opacity duration-300"
          aria-hidden="true"
        >
          <div className="destria-card-scan-beam absolute inset-x-4 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#E5B552] to-transparent shadow-[0_0_10px_rgba(229,181,82,0.75)]" />
        </div>
      );

    case 'timeline':
      return (
        <svg
          viewBox="0 0 320 180"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-50 group-hover:opacity-90 transition-opacity duration-300"
          aria-hidden="true"
        >
          <path
            d="M 28 138 H 292"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '5.2s' }}
          />
          {[68, 130, 192, 254].map((cx, i) => (
            <circle
              key={cx}
              cx={cx}
              cy={138}
              r="3"
              fill={i === 3 ? '#E5B552' : '#7DD3FC'}
              className="destria-checkpoint-glow"
              style={{ animationDelay: `${i * 0.6}s` }}
            />
          ))}
        </svg>
      );

    case 'trajectory':
      return (
        <svg
          viewBox="0 0 320 180"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-50 group-hover:opacity-90 transition-opacity duration-300"
          aria-hidden="true"
        >
          <path
            d="M 24 146 C 96 138, 140 104, 194 78 C 234 58, 266 50, 296 36"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1.35"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '5s' }}
          />
          {shouldAnimate && (
            <circle r="2.6" fill="#F3CE74" opacity="0.9">
              <animateMotion
                dur="5.4s"
                repeatCount="indefinite"
                path="M 24 146 C 96 138, 140 104, 194 78 C 234 58, 266 50, 296 36"
              />
            </circle>
          )}
        </svg>
      );

    case 'compare':
      return (
        <svg
          viewBox="0 0 320 180"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-50 group-hover:opacity-90 transition-opacity duration-300"
          aria-hidden="true"
        >
          <path
            d="M 28 92 H 136 M 184 92 H 292"
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '4.6s' }}
          />
          <circle
            cx="160"
            cy="92"
            r="16"
            fill="none"
            stroke="#E5B552"
            strokeOpacity="0.6"
            strokeWidth="1"
            className="destria-checkpoint-glow"
          />
        </svg>
      );

    case 'shield':
      return (
        <svg
          viewBox="0 0 320 180"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-45 group-hover:opacity-85 transition-opacity duration-300"
          aria-hidden="true"
        >
          <circle
            cx="160"
            cy="92"
            r="48"
            fill="none"
            stroke="rgba(212, 168, 67, 0.5)"
            strokeWidth="1"
            strokeDasharray="8 10"
            className="destria-orbit-slow"
          />
          <circle
            cx="160"
            cy="92"
            r="34"
            fill="none"
            stroke="rgba(125, 211, 252, 0.4)"
            strokeWidth="0.9"
            strokeDasharray="6 8"
            className="destria-orbit-reverse"
          />
        </svg>
      );

    case 'pathway':
    default:
      return (
        <svg
          viewBox="0 0 320 180"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-45 group-hover:opacity-90 transition-opacity duration-300"
          aria-hidden="true"
        >
          <path
            d="M 22 138 L 122 104 L 204 104 L 298 62"
            fill="none"
            stroke="#E5B552"
            strokeWidth="1.2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '5.4s' }}
          />
          {shouldAnimate && (
            <circle r="2.5" fill="#F3CE74" opacity="0.9">
              <animateMotion
                dur="5.8s"
                repeatCount="indefinite"
                path="M 22 138 L 122 104 L 204 104 L 298 62"
              />
            </circle>
          )}
        </svg>
      );
  }
};
