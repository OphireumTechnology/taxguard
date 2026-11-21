import React from 'react';
import { BRAND_ASSETS } from '../../utils/assets';

interface BrandLogoProps {
  variant?: 'full' | 'emblem' | 'horizontal' | 'compact';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  showSubtitleOnMobile?: boolean;
  hideTaglineOnCompact?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  onClick,
  showSubtitleOnMobile = false,
  hideTaglineOnCompact = false
}) => {
  const sizeConfig = {
    sm: {
      imgClass: 'h-9 w-9 sm:h-10 sm:w-10',
      dimPx: 40,
      src: BRAND_ASSETS.destriaEmblem,
      titleClass: 'text-xs sm:text-sm',
      subClass: 'text-[8px] sm:text-[9px]'
    },
    md: {
      imgClass: 'h-11 w-11 sm:h-12 sm:w-12',
      dimPx: 48,
      src: BRAND_ASSETS.destriaLogo,
      titleClass: 'text-sm sm:text-base font-bold',
      subClass: 'text-[8.5px] sm:text-[9.5px]'
    },
    lg: {
      imgClass: 'h-14 w-14 sm:h-16 sm:w-16',
      dimPx: 64,
      src: BRAND_ASSETS.destriaLogo,
      titleClass: 'text-lg sm:text-xl font-bold',
      subClass: 'text-xs'
    },
    xl: {
      imgClass: 'h-20 w-20 sm:h-24 sm:w-24',
      dimPx: 96,
      src: BRAND_ASSETS.destriaLogoHero,
      titleClass: 'text-2xl sm:text-3xl font-bold',
      subClass: 'text-xs sm:text-sm'
    }
  }[size];

  const logoImage = (
    <img
      src={sizeConfig.src}
      alt="DESTRIA TAX SERVICES LLC Official Emblem"
      width={sizeConfig.dimPx}
      height={sizeConfig.dimPx}
      loading="eager"
      decoding="async"
      className={`${sizeConfig.imgClass} aspect-square flex-shrink-0 object-contain transition-transform duration-200 group-hover:scale-[1.03] drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]`}
    />
  );

  if (variant === 'emblem') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center select-none ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
        title="DESTRIA TAX SERVICES LLC"
      >
        {logoImage}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 sm:gap-3 select-none min-w-0 ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      title="DESTRIA TAX SERVICES LLC - Accounting, Tax, Advisory & Wealth Planning"
    >
      {logoImage}

      <div className="flex flex-col text-left min-w-0 justify-center">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className={`font-serif tracking-wider text-white ${sizeConfig.titleClass} group-hover:text-[#E5B552] transition-colors leading-tight whitespace-nowrap font-semibold`}
            style={{ fontSize: 'clamp(0.875rem, 1vw + 0.5rem, 1.125rem)' }}
          >
            DESTRIA
          </span>
          <span className="text-[#C99A35] font-sans font-semibold text-[10px] sm:text-xs tracking-wider whitespace-nowrap">
            TAX SERVICES LLC
          </span>
        </div>

        {variant !== 'compact' && (
          <span
            className={`font-sans tracking-[0.11em] uppercase text-[#C99A35] font-medium ${sizeConfig.subClass} leading-tight mt-0.5 whitespace-nowrap ${
              showSubtitleOnMobile
                ? 'block'
                : hideTaglineOnCompact
                  ? 'hidden 2xl:block'
                  : 'hidden sm:block'
            }`}
          >
            Accounting &bull; Tax &bull; Advisory &bull; Wealth Planning
          </span>
        )}
      </div>
    </div>
  );
};
