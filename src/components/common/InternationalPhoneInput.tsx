import React, { useId, useState } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import {
  SUPPORTED_PHONE_COUNTRIES,
  detectCountryFromPhone,
  formatPhoneAsYouType,
  formatPhoneDisplay,
  validateInternationalPhone,
} from '../../utils/phoneFormat';

export interface InternationalPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onNormalizedChange?: (e164: string | null) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  defaultCountry?: CountryCode;
  variant?: 'dark' | 'light' | 'v2';
  className?: string;
  inputClassName?: string;
  selectClassName?: string;
  'aria-label'?: string;
  showValidation?: boolean;
  testId?: string;
}

export const InternationalPhoneInput: React.FC<InternationalPhoneInputProps> = ({
  value,
  onChange,
  onNormalizedChange,
  id,
  name,
  required = false,
  disabled = false,
  placeholder,
  defaultCountry = 'US',
  variant = 'dark',
  className = '',
  inputClassName = '',
  selectClassName = '',
  'aria-label': ariaLabel,
  showValidation = true,
  testId,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const [country, setCountry] = useState<CountryCode>(() => {
    const detected = detectCountryFromPhone(value);
    if (detected && SUPPORTED_PHONE_COUNTRIES.some((c) => c.code === detected)) {
      return detected;
    }
    return defaultCountry;
  });
  const [touched, setTouched] = useState(false);

  const selectedMeta =
    SUPPORTED_PHONE_COUNTRIES.find((c) => c.code === country) ?? SUPPORTED_PHONE_COUNTRIES[0];

  const validation = validateInternationalPhone(value, {
    defaultCountry: country,
    required,
  });

  const showError = showValidation && touched && !validation.valid && Boolean(validation.error);

  const handleCountryChange = (nextCountry: CountryCode) => {
    setCountry(nextCountry);
    const nextMeta = SUPPORTED_PHONE_COUNTRIES.find((c) => c.code === nextCountry);
    if (!value.trim() && nextMeta) {
      onNormalizedChange?.(null);
      return;
    }
    // Re-strip previous country dial code if user switches countries on a partially typed value
    const prevMeta = selectedMeta;
    let national = value.trim();
    if (prevMeta && national.startsWith(prevMeta.dialCode)) {
      national = national.slice(prevMeta.dialCode.length).replace(/^[\s.-]+/, '');
    }
    const reformatted = formatPhoneAsYouType(national, nextCountry);
    onChange(reformatted);
    onNormalizedChange?.(
      validateInternationalPhone(reformatted, { defaultCountry: nextCountry, required }).e164
    );
  };

  const handleInputChange = (raw: string) => {
    // Allow user to clear field cleanly
    if (!raw.trim()) {
      onChange('');
      onNormalizedChange?.(null);
      return;
    }

    // If user pastes or types an explicit international prefix, sync selector automatically
    let activeCountry = country;
    if (raw.trim().startsWith('+')) {
      const detected = detectCountryFromPhone(raw);
      if (detected && SUPPORTED_PHONE_COUNTRIES.some((c) => c.code === detected)) {
        activeCountry = detected;
        setCountry(detected);
      }
    }

    const formatted = formatPhoneAsYouType(raw, activeCountry);
    onChange(formatted);
    const nextValidation = validateInternationalPhone(formatted, {
      defaultCountry: activeCountry,
      required,
    });
    onNormalizedChange?.(nextValidation.e164);
  };

  const handleBlur = () => {
    setTouched(true);
    if (!value.trim()) return;
    const standardized = formatPhoneDisplay(value, country);
    if (standardized !== value) {
      onChange(standardized);
    }
    const nextValidation = validateInternationalPhone(standardized, {
      defaultCountry: country,
      required,
    });
    onNormalizedChange?.(nextValidation.e164);
  };

  const baseWrapper =
    variant === 'v2'
      ? 'flex items-stretch border border-slate-300 bg-white focus-within:border-black transition-colors'
      : variant === 'light'
      ? 'flex items-stretch rounded-lg border border-slate-300 bg-white focus-within:border-[#0B2341] focus-within:ring-1 focus-within:ring-[#0B2341] transition-colors'
      : 'flex items-stretch rounded-lg border border-[#1E3A5F] bg-[#07172B] focus-within:border-[#C6A15B] focus-within:ring-1 focus-within:ring-[#C6A15B] transition-colors';

  const errorBorder = showError
    ? variant === 'dark'
      ? '!border-rose-400'
      : '!border-rose-600'
    : '';

  const defaultSelectStyle =
    variant === 'v2'
      ? 'shrink-0 bg-slate-50 border-r border-slate-300 px-2.5 py-2 text-xs font-medium text-black focus:outline-none'
      : variant === 'light'
      ? 'shrink-0 bg-slate-50 border-r border-slate-300 rounded-l-lg px-2.5 py-2 text-xs font-medium text-slate-800 focus:outline-none'
      : 'shrink-0 bg-[#051224] border-r border-[#1E3A5F] rounded-l-lg px-2.5 py-2.5 text-xs font-medium text-slate-200 focus:outline-none';

  const defaultInputStyle =
    variant === 'v2'
      ? 'w-full min-w-0 bg-transparent px-3 py-2 text-sm text-black placeholder-slate-400 focus:outline-none'
      : variant === 'light'
      ? 'w-full min-w-0 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none'
      : 'w-full min-w-0 bg-transparent px-3 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none';

  return (
    <div className={className}>
      <div className={`${baseWrapper} ${errorBorder}`}>
        <select
          aria-label="Country calling code"
          value={country}
          disabled={disabled}
          onChange={(e) => handleCountryChange(e.target.value as CountryCode)}
          className={selectClassName || defaultSelectStyle}
        >
          {SUPPORTED_PHONE_COUNTRIES.map((c) => (
            <option
              key={c.code}
              value={c.code}
              className={variant === 'dark' ? 'bg-[#071830] text-white' : 'bg-white text-slate-900'}
            >
              {c.code} ({c.dialCode})
            </option>
          ))}
        </select>
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder || selectedMeta.example}
          aria-label={ariaLabel}
          aria-invalid={showError ? 'true' : undefined}
          aria-describedby={showError ? errorId : undefined}
          data-testid={testId}
          className={inputClassName || defaultInputStyle}
        />
      </div>
      {showError && (
        <p
          id={errorId}
          role="alert"
          className={`mt-1 text-xs ${variant === 'dark' ? 'text-rose-300' : 'text-rose-600'}`}
        >
          {validation.error}
        </p>
      )}
    </div>
  );
};
