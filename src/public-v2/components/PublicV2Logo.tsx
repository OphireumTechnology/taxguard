import React from 'react';
import { BRAND_ASSETS } from '../../utils/assets';

interface PublicV2LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  onClick?: () => void;
}

export const PublicV2Logo: React.FC<PublicV2LogoProps> = ({
  size = 'md',
  className = '',
  showText = true,
  onClick
}) => {
  const dimensions = {
    sm: { img: 'h-8 w-8', px: 32, title: 'text-sm font-semibold', sub: 'text-[9px]' },
    md: { img: 'h-10 w-10', px: 40, title: 'text-base font-bold', sub: 'text-[10px]' },
    lg: { img: 'h-14 w-14', px: 56, title: 'text-lg font-bold', sub: 'text-xs' },
    xl: { img: 'h-20 w-20', px: 80, title: 'text-2xl font-bold', sub: 'text-sm' }
  }[size];

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      aria-label="DESTRIA TAX SERVICES LLC Home"
    >
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <img
          src={BRAND_ASSETS.destriaLogo}
          alt="DESTRIA TAX SERVICES LLC Circular Logo"
          width={dimensions.px}
          height={dimensions.px}
          loading="eager"
          decoding="async"
          className={`${dimensions.img} object-contain rounded-full shadow-sm`}
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-none text-left">
          <span className={`tracking-tight text-white uppercase font-serif ${dimensions.title}`}>
            DESTRIA
          </span>
          <span className={`tracking-widest text-[#C99A35] uppercase font-sans mt-0.5 ${dimensions.sub} font-semibold`}>
            Tax Services LLC
          </span>
        </div>
      )}
    </div>
  );
};
