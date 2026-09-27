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
  // Dimensions calibrated to meet official specification:
  // Desktop header: ~48-58px high
  // Mobile header: ~38-46px high
  const sizeConfig = {
    sm: {
      imgClass: 'h-9 w-9 sm:h-10 sm:w-10',
      dimPx: 40,
      titleClass: 'text-xs sm:text-sm',
      subClass: 'text-[8px] sm:text-[9px]'
    },
    md: {
      imgClass: 'h-10 w-10 sm:h-[50px] sm:w-[50px]',
      dimPx: 50,
      titleClass: 'text-sm sm:text-base font-bold',
      subClass: 'text-[8.5px] sm:text-[10px]'
    },
    lg: {
      imgClass: 'h-14 w-14 sm:h-16 sm:w-16',
      dimPx: 64,
      titleClass: 'text-lg sm:text-xl font-bold',
      subClass: 'text-xs'
    },
    xl: {
      imgClass: 'h-20 w-20 sm:h-24 sm:w-24',
      dimPx: 96,
      titleClass: 'text-2xl sm:text-3xl font-bold',
      subClass: 'text-xs sm:text-sm'
    }
  }[size];

  const logoImage = (
    <div className="relative flex-shrink-0 flex items-center justify-center">
      <picture>
        <source srcSet={BRAND_ASSETS.logoWebp} type="image/webp" />
        <img
          src={BRAND_ASSETS.logoPng}
          alt="A/R Tax Services, LLC Official Logo"
          width={sizeConfig.dimPx}
          height={sizeConfig.dimPx}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`${sizeConfig.imgClass} object-contain transition-transform duration-200 group-hover:scale-[1.02] drop-shadow-[0_2px_10px_rgba(201,154,61,0.25)]`}
        />
      </picture>
    </div>
  );

  if (variant === 'emblem') {
    return (
      <div 
        onClick={onClick} 
        className={`inline-flex items-center justify-center select-none ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}
        title="A/R Tax Services, LLC"
      >
        {logoImage}
      </div>
    );
  }

  return (
    <div 
      onClick={onClick} 
      className={`inline-flex items-center gap-2.5 sm:gap-3.5 select-none min-w-0 ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      title="A/R Tax Services, LLC - Preserving Wealth. Building Legacies."
    >
      {logoImage}

      <div className="flex flex-col text-left min-w-0 justify-center">
        <div className="flex items-baseline gap-1">
          <span 
            className={`font-serif tracking-wider text-white ${sizeConfig.titleClass} group-hover:text-[#E2BD67] transition-colors leading-tight whitespace-nowrap`}
            style={{ fontSize: 'clamp(0.875rem, 1.2vw + 0.5rem, 1.125rem)' }}
          >
            A/R TAX SERVICES
          </span>
          <span className="text-[#C99A3D] font-sans font-semibold text-[10px] sm:text-xs tracking-wider">
            LLC
          </span>
        </div>
        
        {variant !== 'compact' && (
          <span 
            className={`font-sans tracking-[0.14em] uppercase text-[#C99A3D] font-medium ${sizeConfig.subClass} leading-tight mt-0.5 whitespace-nowrap ${
              showSubtitleOnMobile 
                ? 'block' 
                : hideTaglineOnCompact 
                  ? 'hidden xl:block' 
                  : 'hidden sm:block'
            }`}
          >
            Preserving Wealth. Building Legacies.
          </span>
        )}
      </div>
    </div>
  );
};
