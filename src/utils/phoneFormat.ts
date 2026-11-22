import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export interface PhoneCountryMeta {
  code: CountryCode;
  name: string;
  dialCode: string;
  placeholder: string;
  example: string;
}

export const SUPPORTED_PHONE_COUNTRIES: PhoneCountryMeta[] = [
  { code: 'US', name: 'United States', dialCode: '+1', placeholder: '(678) 205-9486', example: '(678) 205-9486' },
  { code: 'CA', name: 'Canada', dialCode: '+1', placeholder: '(416) 555-0199', example: '(416) 555-0199' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', placeholder: '020 7946 0958', example: '020 7946 0958' },
  { code: 'AU', name: 'Australia', dialCode: '+61', placeholder: '0412 345 678', example: '0412 345 678' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', placeholder: '55 1234 5678', example: '55 1234 5678' },
  { code: 'DE', name: 'Germany', dialCode: '+49', placeholder: '030 123456', example: '030 123456' },
  { code: 'FR', name: 'France', dialCode: '+33', placeholder: '01 23 45 67 89', example: '01 23 45 67 89' },
  { code: 'IN', name: 'India', dialCode: '+91', placeholder: '98765 43210', example: '98765 43210' },
  { code: 'JM', name: 'Jamaica', dialCode: '+1', placeholder: '(876) 555-0142', example: '(876) 555-0142' },
  { code: 'BB', name: 'Barbados', dialCode: '+1', placeholder: '(246) 555-0199', example: '(246) 555-0199' },
  { code: 'BS', name: 'Bahamas', dialCode: '+1', placeholder: '(242) 555-0188', example: '(242) 555-0188' },
  { code: 'TT', name: 'Trinidad & Tobago', dialCode: '+1', placeholder: '(868) 555-0177', example: '(868) 555-0177' },
];

export function detectCountryFromPhone(value: string): CountryCode | null {
  if (!value || !value.trim()) return null;
  try {
    const parsed = parsePhoneNumberFromString(value.trim());
    return parsed?.country ?? null;
  } catch {
    return null;
  }
}

export function formatPhoneAsYouType(value: string, defaultCountry: CountryCode = 'US'): string {
  if (!value) return '';
  try {
    const formatter = new AsYouType(defaultCountry);
    return formatter.input(value);
  } catch {
    return value;
  }
}

export function formatPhoneDisplay(value: string, defaultCountry: CountryCode = 'US'): string {
  if (!value || !value.trim()) return '';
  try {
    const parsed = parsePhoneNumberFromString(value.trim(), defaultCountry);
    if (!parsed) return value.trim();
    return parsed.country === 'US' ? parsed.formatNational() : parsed.formatInternational();
  } catch {
    return value.trim();
  }
}

export interface PhoneValidationResult {
  valid: boolean;
  e164: string | null;
  formatted: string;
  country: CountryCode | null;
  error?: string;
}

export function validateInternationalPhone(
  value: string,
  options: { defaultCountry?: CountryCode; required?: boolean } = {}
): PhoneValidationResult {
  const { defaultCountry = 'US', required = false } = options;
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return {
      valid: !required,
      e164: null,
      formatted: '',
      country: defaultCountry,
      error: required ? 'Please enter a valid phone number.' : undefined,
    };
  }
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (parsed && parsed.isValid()) {
      return {
        valid: true,
        e164: parsed.format('E.164'),
        formatted: parsed.country === 'US' ? parsed.formatNational() : parsed.formatInternational(),
        country: parsed.country ?? defaultCountry,
      };
    }
  } catch {
    // Fall through to invalid result
  }
  return {
    valid: false,
    e164: null,
    formatted: trimmed,
    country: defaultCountry,
    error: 'Enter a valid phone number including area code.',
  };
}

export function isIntakeStorablePhone(value: string, defaultCountry: CountryCode = 'US'): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;
  const res = validateInternationalPhone(trimmed, { defaultCountry, required: true });
  return res.valid;
}
