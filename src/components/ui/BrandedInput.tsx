import React, { useId } from 'react';

export interface BrandedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  variant?: 'light' | 'dark';
}

export const BrandedInput: React.FC<BrandedInputProps> = ({
  id: propId,
  label,
  required,
  error,
  helpText,
  variant = 'light',
  className = '',
  disabled,
  ...props
}) => {
  const generatedId = useId();
  const inputId = propId || generatedId;
  const isLight = variant === 'light';

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${
            isLight ? 'text-[#10233D]' : 'text-[#E2B957]'
          }`}
        >
          {label}
          {required && <span className="text-[#B42318] ml-1">*</span>}
        </label>
      )}

      <input
        id={inputId}
        disabled={disabled}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none transition-all ${
          disabled
            ? isLight
              ? 'bg-[#EAD7A3]/30 text-[#718096] border-[#D8C9A5] cursor-not-allowed placeholder-[#718096]'
              : 'bg-[#081E36]/50 text-[#718096] border-[#244567] cursor-not-allowed placeholder-[#718096]'
            : isLight
              ? error
                ? 'bg-[#FFF1F0] text-[#10233D] border-[#B42318] focus:ring-2 focus:ring-[#B42318] placeholder-[#52657B]'
                : 'bg-[#FBF8F1] text-[#10233D] border-[#D8C9A5] focus:border-[#B98B32] focus:ring-2 focus:ring-[#C99A3D] placeholder-[#52657B] hover:border-[#B98B32]'
              : error
                ? 'bg-[#0D2746] text-[#F7F1E5] border-[#B42318] focus:ring-2 focus:ring-[#B42318] placeholder-slate-400'
                : 'bg-[#0D2746] text-[#F7F1E5] border-[#244567] focus:border-[#E2B957] focus:ring-2 focus:ring-[#C99A3D] placeholder-slate-400 hover:border-[#C99A3D]'
        } ${className}`}
        {...props}
      />

      {error ? (
        <p className="mt-1 text-[11px] font-semibold text-[#B42318]">{error}</p>
      ) : helpText ? (
        <p className={`mt-1 text-[11px] ${isLight ? 'text-[#52657B]' : 'text-slate-400'}`}>
          {helpText}
        </p>
      ) : null}
    </div>
  );
};
