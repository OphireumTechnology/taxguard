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
      titleClass: 'text-xs sm:text-sm',
      subClass: 'text-[8px] sm:text-[9px]'
    },
    md: {
      imgClass: 'h-11 w-11 sm:h-12 sm:w-12',
      dimPx: 48,
      titleClass: 'text-sm sm:text-base font-bold',
      subClass: 'text-[8.5px] sm:text-[9.5px]'
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
      <img
        src={BRAND_ASSETS.destriaLogo}
        alt="DESTRIA TAX SERVICES LLC Official Logo"
        width={sizeConfig.dimPx}
        height={sizeConfig.dimPx}
        loading="eager"
        decoding="async"
        className={`${sizeConfig.imgClass} object-contain rounded-full transition-transform duration-200 group-hover:scale-[1.03] shadow-[0_2px_12px_rgba(201,154,53,0.3)] ring-1 ring-[#C99A35]/30`}
      />
    </div>
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
      className={`inline-flex items-center gap-2.5 sm:gap-3.5 select-none min-w-0 ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      title="DESTRIA TAX SERVICES LLC - Tax Preparation, Advisory & Wealth Planning"
    >
      {logoImage}

      <div className="flex flex-col text-left min-w-0 justify-center">
        <div className="flex items-baseline gap-1.5">
          <span 
            className={`font-serif tracking-wider text-white ${sizeConfig.titleClass} group-hover:text-[#E5B552] transition-colors leading-tight whitespace-nowrap font-semibold`}
            style={{ fontSize: 'clamp(0.875rem, 1.2vw + 0.5rem, 1.15rem)' }}
          >
            DESTRIA
          </span>
          <span className="text-[#C99A35] font-sans font-semibold text-[10px] sm:text-xs tracking-wider">
            TAX SERVICES LLC
          </span>
        </div>
        
        {variant !== 'compact' && (
          <span 
            className={`font-sans tracking-[0.12em] uppercase text-[#C99A35] font-medium ${sizeConfig.subClass} leading-tight mt-0.5 whitespace-nowrap ${
              showSubtitleOnMobile 
                ? 'block' 
                : hideTaglineOnCompact 
                  ? 'hidden xl:block' 
                  : 'hidden sm:block'
            }`}
          >
            Tax Preparation, Advisory &amp; Wealth Planning
          </span>
        )}
      </div>
    </div>
  );
};
