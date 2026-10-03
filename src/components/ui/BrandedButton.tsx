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
      ? 'bg-[#102D4F] text-[#7F91A6] border border-[rgba(148,163,184,0.18)] cursor-not-allowed shadow-none'
      : 'bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] font-bold shadow-md active:scale-[0.98] border border-[#D4A843]',
    secondary: isDisabled
      ? 'bg-[#071A2E]/60 text-[#7F91A6] border border-[rgba(148,163,184,0.12)] cursor-not-allowed'
      : 'bg-[#102D4F] text-[#F8FAFC] font-semibold border border-[rgba(148,163,184,0.18)] hover:border-[#D4A843]/50 hover:bg-[#143657] shadow-xs',
    outline: isDisabled
      ? 'bg-transparent text-[#7F91A6] border border-[rgba(148,163,184,0.12)] cursor-not-allowed'
      : 'bg-transparent text-[#F8FAFC] hover:text-[#D4A843] border border-[rgba(148,163,184,0.30)] hover:border-[#D4A843] font-semibold',
    danger: isDisabled
      ? 'bg-red-950/20 text-[#7F91A6] border border-red-900/30 cursor-not-allowed'
      : 'bg-[#EF4444] text-white font-bold hover:bg-[#DC2626] border border-[#EF4444] shadow-xs',
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
