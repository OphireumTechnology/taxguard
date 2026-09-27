import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface BrandedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabledReason?: string;
  icon?: React.ReactNode;
}

export const BrandedButton: React.FC<BrandedButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabledReason,
  icon,
  disabled = false,
  className = '',
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs min-h-[36px]',
    md: 'px-5 py-2.5 text-xs sm:text-sm min-h-[44px]',
    lg: 'px-7 py-3 text-sm min-h-[48px]',
  }[size];

  const isDisabled = disabled || isLoading;

  const variantClasses = {
    primary: isDisabled
      ? 'bg-[#EAD7A3]/50 text-[#52657B] border border-[#D8C9A5] cursor-not-allowed shadow-none'
      : 'bg-gradient-to-r from-[#C99A3D] to-[#E2B957] text-[#06172C] font-bold shadow-md hover:brightness-105 active:scale-[0.98] border border-[#B98B32]',
    secondary: isDisabled
      ? 'bg-[#081E36]/40 text-[#718096] border border-[#244567]/50 cursor-not-allowed'
      : 'bg-[#0D2746] text-[#F7F1E5] font-semibold border border-[#244567] hover:border-[#C99A3D] hover:bg-[#14375D] shadow-sm',
    outline: isDisabled
      ? 'bg-transparent text-[#718096] border border-[#D8C9A5]/50 cursor-not-allowed'
      : 'bg-transparent text-[#10233D] hover:text-[#06172C] border border-[#B98B32] hover:bg-[#F4E7C3] font-bold',
    danger: isDisabled
      ? 'bg-[#FFF1F0] text-[#718096] border border-[#B42318]/30 cursor-not-allowed'
      : 'bg-[#B42318] text-white font-bold hover:bg-[#911d14] border border-[#B42318] shadow-sm',
  }[variant];

  return (
    <div className="inline-flex flex-col items-center">
      <button
        disabled={isDisabled}
        aria-disabled={isDisabled}
        title={isDisabled && disabledReason ? disabledReason : undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C99A3D] focus-visible:ring-offset-2 ${sizeClasses} ${variantClasses} ${className}`}
        {...props}
      >
        {isLoading ? (
          <RefreshCw className="w-4 h-4 animate-spin text-current" />
        ) : icon ? (
          <span className="shrink-0">{icon}</span>
        ) : null}
        <span>{children}</span>
      </button>
      {isDisabled && disabledReason && (
        <span className="text-[10px] text-[#718096] mt-1 font-medium text-center">
          {disabledReason}
        </span>
      )}
    </div>
  );
};
