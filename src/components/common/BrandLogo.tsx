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
      imgClass: 'h-10 w-10 min-w-[40px] min-h-[40px] sm:h-11 sm:w-11 sm:min-w-[44px] sm:min-h-[44px]',
      dimPx: 44,
      src: BRAND_ASSETS.destriaLogo,
      titleClass: 'text-sm sm:text-base',
      subCompanyClass: 'text-[9px] sm:text-[10px]',
      taglineClass: 'text-[8px] sm:text-[9px]'
    },
    md: {
      imgClass:
        'h-11 w-11 min-w-[44px] min-h-[44px] sm:h-12 sm:w-12 sm:min-w-[48px] sm:min-h-[48px] lg:h-[60px] lg:w-[60px] lg:min-w-[60px] lg:min-h-[60px] xl:h-16 xl:w-16 xl:min-w-[64px] xl:min-h-[64px]',
      dimPx: 64,
      src: BRAND_ASSETS.destriaLogo,
      titleClass: 'text-sm sm:text-base lg:text-lg',
      subCompanyClass: 'text-[9px] sm:text-[10px] lg:text-[11px]',
      taglineClass: 'text-[9px]'
    },
    lg: {
      imgClass: 'h-16 w-16 min-w-[64px] min-h-[64px] sm:h-[72px] sm:w-[72px] sm:min-w-[72px] sm:min-h-[72px]',
      dimPx: 72,
      src: BRAND_ASSETS.destriaLogo,
      titleClass: 'text-lg sm:text-xl',
      subCompanyClass: 'text-xs',
      taglineClass: 'text-[10px]'
    },
    xl: {
      imgClass: 'h-24 w-24 min-w-[96px] min-h-[96px] sm:h-28 sm:w-28 sm:min-w-[112px] sm:min-h-[112px]',
      dimPx: 112,
      src: BRAND_ASSETS.destriaLogoHero,
      titleClass: 'text-2xl sm:text-3xl',
      subCompanyClass: 'text-xs sm:text-sm',
      taglineClass: 'text-xs'
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
      className={`destria-brand-emblem ${sizeConfig.imgClass} aspect-square flex-shrink-0 object-contain block`}
    />
  );

  if (variant === 'emblem') {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center flex-shrink-0 select-none ${onClick ? 'cursor-pointer hover:opacity-95 transition-opacity' : ''} ${className}`}
        title="DESTRIA TAX SERVICES LLC"
      >
        {logoImage}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 sm:gap-3 flex-shrink-0 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
      title="DESTRIA TAX SERVICES LLC — Accounting, Tax, Advisory & Wealth Planning"
    >
      {logoImage}

      <div className="flex flex-col text-left justify-center leading-tight">
        <span
          className={`font-serif tracking-[0.12em] text-white ${sizeConfig.titleClass} group-hover:text-[#E5B552] transition-colors whitespace-nowrap font-bold`}
        >
          DESTRIA
        </span>
        <span
          className={`text-[#C99A35] font-sans font-semibold ${sizeConfig.subCompanyClass} tracking-[0.14em] uppercase whitespace-nowrap mt-0.5`}
        >
          TAX SERVICES LLC
        </span>

        {variant !== 'compact' && (
          <span
            className={`font-sans tracking-[0.1em] uppercase text-slate-300/90 font-medium ${sizeConfig.taglineClass} leading-tight mt-0.5 whitespace-nowrap ${
              showSubtitleOnMobile
                ? 'block'
                : hideTaglineOnCompact
                  ? 'hidden'
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
