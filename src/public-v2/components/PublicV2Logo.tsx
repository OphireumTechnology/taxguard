import React from 'react';
import { BRAND_ASSETS } from '../../utils/assets';

interface PublicV2LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  theme?: 'light' | 'dark';
  onClick?: () => void;
}

export const PublicV2Logo: React.FC<PublicV2LogoProps> = ({
  size = 'md',
  className = '',
  showText = true,
  theme = 'light',
  onClick
}) => {
  const dimensions = {
    sm: { img: 'h-8 w-8', px: 32, src: BRAND_ASSETS.destriaEmblem, title: 'text-sm font-semibold', sub: 'text-[9px]' },
    md: { img: 'h-10 w-10', px: 40, src: BRAND_ASSETS.destriaLogo, title: 'text-base font-bold', sub: 'text-[10px]' },
    lg: { img: 'h-14 w-14', px: 56, src: BRAND_ASSETS.destriaLogo, title: 'text-lg font-bold', sub: 'text-xs' },
    xl: { img: 'h-20 w-20', px: 80, src: BRAND_ASSETS.destriaLogoHero, title: 'text-2xl font-bold', sub: 'text-sm' }
  }[size];

  const primaryTextClass = theme === 'dark' ? 'text-white' : 'text-[#071D3A]';
  const secondaryTextClass = theme === 'dark' ? 'text-[#C99A35]' : 'text-[#9A711A]';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 sm:gap-3 select-none min-w-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      aria-label="DESTRIA TAX SERVICES LLC Home"
    >
      <img
        src={dimensions.src}
        alt="DESTRIA TAX SERVICES LLC Official Emblem"
        width={dimensions.px}
        height={dimensions.px}
        loading="eager"
        decoding="async"
        className={`${dimensions.img} aspect-square flex-shrink-0 object-contain`}
      />

      {showText && (
        <div className="flex flex-col leading-none text-left min-w-0">
          <span className={`tracking-tight uppercase font-serif whitespace-nowrap ${primaryTextClass} ${dimensions.title}`}>
            DESTRIA
          </span>
          <span className={`tracking-widest uppercase font-sans mt-0.5 whitespace-nowrap ${secondaryTextClass} ${dimensions.sub} font-semibold`}>
            Tax Services LLC
          </span>
        </div>
      )}
    </div>
  );
};
