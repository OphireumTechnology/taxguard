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
  variant = 'dark',
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
          className={`block text-xs font-semibold mb-1.5 ${
            isLight ? 'text-[#10233D] uppercase tracking-wider' : 'text-[#A9B7C8]'
          }`}
        >
          {label}
          {required && <span className="text-[#D4A843] ml-1">*</span>}
        </label>
      )}

      <input
        id={inputId}
        disabled={disabled}
        className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none transition-all ${
          disabled
            ? isLight
              ? 'bg-[#EAD7A3]/30 text-[#718096] border-[#D8C9A5] cursor-not-allowed placeholder-[#718096]'
              : 'bg-[#071A2E]/50 text-[#7F91A6] border-[rgba(148,163,184,0.12)] cursor-not-allowed placeholder-[#7F91A6]'
            : isLight
              ? error
                ? 'bg-[#FFF1F0] text-[#10233D] border-[#B42318] focus:ring-2 focus:ring-[#B42318] placeholder-[#52657B]'
                : 'bg-[#FBF8F1] text-[#10233D] border-[#D8C9A5] focus:border-[#B98B32] focus:ring-2 focus:ring-[#C99A3D] placeholder-[#52657B] hover:border-[#B98B32]'
              : error
                ? 'bg-[#102D4F] text-[#F8FAFC] border-red-500 focus:ring-1 focus:ring-red-500 placeholder-[#7F91A6]'
                : 'bg-[#102D4F] text-[#F8FAFC] border-[rgba(148,163,184,0.18)] focus:border-[#D4A843] focus:ring-1 focus:ring-[#D4A843] placeholder-[#7F91A6] hover:border-[#D4A843]/50'
        } ${className}`}
        {...props}
      />

      {error ? (
        <p className="mt-1 text-[11px] font-semibold text-red-400">{error}</p>
      ) : helpText ? (
        <p className={`mt-1 text-[11px] ${isLight ? 'text-[#52657B]' : 'text-[#7F91A6]'}`}>
          {helpText}
        </p>
      ) : null}
    </div>
  );
};
