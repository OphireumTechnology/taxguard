import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export interface PhoneCountryMeta {
  code: CountryCode;
  name: string;
  dialCode: string;
  example: string;
}

export const SUPPORTED_PHONE_COUNTRIES: PhoneCountryMeta[] = [
  { code: 'US', name: 'United States', dialCode: '+1', example: '(678) 205-9486' },
  { code: 'CA', name: 'Canada', dialCode: '+1', example: '(416) 555-0192' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', example: '07700 900123' },
  { code: 'AU', name: 'Australia', dialCode: '+61', example: '0412 345 678' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', example: '55 1234 5678' },
  { code: 'DE', name: 'Germany', dialCode: '+49', example: '01512 3456789' },
  { code: 'FR', name: 'France', dialCode: '+33', example: '06 12 34 56 78' },
  { code: 'IN', name: 'India', dialCode: '+91', example: '098765 43210' },
  { code: 'JM', name: 'Jamaica', dialCode: '+1', example: '(876) 555-0142' },
  { code: 'TT', name: 'Trinidad & Tobago', dialCode: '+1', example: '(868) 555-0190' },
  { code: 'BB', name: 'Barbados', dialCode: '+1', example: '(246) 555-0188' },
  { code: 'BS', name: 'Bahamas', dialCode: '+1', example: '(242) 555-0174' },
];

export function detectCountryFromPhone(raw: string): CountryCode | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = parsePhoneNumberFromString(trimmed);
    if (parsed?.country) return parsed.country;
  } catch {
    // ignore parse failure
  }
  return null;
}

export function formatPhoneAsYouType(raw: string, defaultCountry: CountryCode = 'US'): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    const formatter = new AsYouType(defaultCountry);
    return formatter.input(raw);
  } catch {
    return raw;
  }
}

export function formatPhoneDisplay(raw: string | undefined | null, defaultCountry: CountryCode = 'US'): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (parsed && parsed.isPossible()) {
      return parsed.country === 'US' ? parsed.formatNational() : parsed.formatInternational();
    }
  } catch {
    // fall through
  }
  return trimmed;
}

export interface PhoneValidationResult {
  valid: boolean;
  e164: string | null;
  error?: string;
}

export function validateInternationalPhone(
  raw: string,
  options: { defaultCountry?: CountryCode; required?: boolean } = {}
): PhoneValidationResult {
  const { defaultCountry = 'US', required = false } = options;
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return required
      ? { valid: false, e164: null, error: 'Phone number is required.' }
      : { valid: true, e164: null };
  }
  try {
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    if (parsed && parsed.isValid()) {
      return { valid: true, e164: parsed.number };
    }
    if (parsed && parsed.isPossible()) {
      return { valid: true, e164: parsed.number };
    }
  } catch {
    // fall through
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10 && digits.length <= 15) {
    return { valid: true, e164: trimmed.startsWith('+') ? `+${digits}` : `+1${digits.slice(-10)}` };
  }
  return {
    valid: false,
    e164: null,
    error: 'Please enter a valid phone number.',
  };
}

export function isIntakeStorablePhone(raw: string | undefined | null): boolean {
  const trimmed = (raw || '').trim();
  if (!trimmed) return false;
  const res = validateInternationalPhone(trimmed, { required: true });
  return res.valid;
}
