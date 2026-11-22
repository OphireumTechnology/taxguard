import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from 'libphonenumber-js';

export interface SupportedPhoneCountry {
  code: CountryCode;
  name: string;
  dialCode: string;
  example: string;
}

export const SUPPORTED_PHONE_COUNTRIES: readonly SupportedPhoneCountry[] = [
  { code: 'US', name: 'United States', dialCode: '+1', example: '+1-678-205-9486' },
  { code: 'CA', name: 'Canada', dialCode: '+1', example: '+1-416-555-0199' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', example: '+44 20 7946 0958' },
  { code: 'PH', name: 'Philippines', dialCode: '+63', example: '+63 917 966 8814' },
  { code: 'MX', name: 'Mexico', dialCode: '+52', example: '+52 55 1234 5678' },
  { code: 'AU', name: 'Australia', dialCode: '+61', example: '+61 2 9374 4000' },
  { code: 'DE', name: 'Germany', dialCode: '+49', example: '+49 30 901820' },
  { code: 'FR', name: 'France', dialCode: '+33', example: '+33 1 42 68 53 00' },
  { code: 'IN', name: 'India', dialCode: '+91', example: '+91 22 2266 1234' },
  { code: 'JP', name: 'Japan', dialCode: '+81', example: '+81 3 3580 3311' },
] as const;

export interface PhoneValidationResult {
  valid: boolean;
  e164: string | null;
  display: string;
  href: string | null;
  country?: CountryCode;
  extension?: string;
  error?: string;
}

const EXTENSION_REGEX = /\s*(?:;ext=|ext\.?|extension|x)\s*([0-9]{1,8})\s*$/i;

// Non-phone tax & financial identifiers that MUST NEVER be formatted as telephone numbers
const NON_PHONE_IDENTIFIER_PATTERNS: readonly RegExp[] = [
  /^\d{3}-\d{2}-\d{4}$/, // SSN (XXX-XX-XXXX)
  /^\d{2}-\d{7}$/, // EIN (XX-XXXXXXX)
  /^P\d{8}$/i, // PTIN (PXXXXXXXX)
  /^\d{5}(?:-\d{4})?$/, // US ZIP / ZIP+4
  /^(?:INV|TXN|ACCT|REF|DOC|CASE|EIN|SSN|PTIN|ROUTING)[-_#:\s]/i,
];

/**
 * Returns true if the value looks like a tax/financial identifier (SSN, EIN, PTIN, ZIP, etc.)
 * rather than a telephone number.
 */
export function isNonPhoneIdentifier(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return NON_PHONE_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function extractExtension(raw: string): { base: string; extension?: string } {
  const match = raw.match(EXTENSION_REGEX);
  if (!match) {
    return { base: raw.trim() };
  }
  const base = raw.slice(0, match.index).trim();
  return { base, extension: match[1] };
}

/**
 * Collapses accidental duplicated country codes such as:
 * "+1 +1-678-205-9486", "+1 1-678-205-9486", "+1+16782059486", "1-1-678-205-9486",
 * or "+44 +44 20 7946 0958".
 */
export function deduplicateCountryCode(raw: string): string {
  let cleaned = raw.trim();

  // Strip leading `tel:` if someone passed a URI
  if (/^tel:/i.test(cleaned)) {
    cleaned = cleaned.replace(/^tel:/i, '').trim();
  }

  // Convert international dialing prefix `00` to `+` when followed by enough digits
  if (/^00[1-9]\d{6,}/.test(cleaned.replace(/[\s.-]/g, ''))) {
    cleaned = `+${cleaned.replace(/^00/, '')}`;
  }

  // Collapse repeated explicit +CC prefixes (e.g. "+1 +1-678...", "+1+1...", "+44 +44 ...")
  cleaned = cleaned.replace(/^\+(\d{1,3})[\s.-]*\+\1[\s.-]*/, '+$1 ');

  // Collapse "+1 1-678-205-9486" or "+1-1-678-205-9486" (11+ digits with repeated NANP 1)
  const digits = cleaned.replace(/\D/g, '');
  if (cleaned.startsWith('+1') && /^11[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    return `+1${digits.slice(2)}`;
  }
  if (/^1[\s.-]+1[\s.-]+[2-9]\d{2}/.test(cleaned) && digits.length === 12 && digits.startsWith('11')) {
    return `+1${digits.slice(2)}`;
  }

  return cleaned;
}

/**
 * Formats 10 NANP digits into Destria's mandatory US international display format: `+1-XXX-XXX-XXXX`.
 */
export function formatUsTenDigits(tenDigits: string, extension?: string): string {
  const formatted = `+1-${tenDigits.slice(0, 3)}-${tenDigits.slice(3, 6)}-${tenDigits.slice(6, 10)}`;
  return extension ? `${formatted} ext. ${extension}` : formatted;
}

function isNanpTestOrReservedNumber(digits: string): string | null {
  // Handle valid 10-digit or 11-digit NANP numbers including 555-01XX / 555-XXXX directory/test ranges
  if (/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    return digits;
  }
  if (/^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)) {
    return digits.slice(1);
  }
  // Allow explicit 555-000-0000 style placeholder only if explicitly 10/11 digits starting with 2-9
  if (/^[2-9]\d{2}000\d{4}$/.test(digits)) {
    return digits;
  }
  if (/^1[2-9]\d{2}000\d{4}$/.test(digits)) {
    return digits.slice(1);
  }
  return null;
}

function tryParsePhone(
  rawInput: string,
  defaultCountry?: CountryCode
): { parsed?: PhoneNumber; extension?: string; cleanedBase: string } {
  const { base, extension } = extractExtension(rawInput);
  const cleanedBase = deduplicateCountryCode(base);
  if (!cleanedBase || isNonPhoneIdentifier(cleanedBase)) {
    return { cleanedBase, extension };
  }

  // If the number starts with `+`, never force defaultCountry (preserve actual international country code)
  const parsed = cleanedBase.startsWith('+')
    ? parsePhoneNumberFromString(cleanedBase)
    : parsePhoneNumberFromString(cleanedBase, defaultCountry);

  return { parsed, extension: extension ?? (parsed?.ext ? String(parsed.ext) : undefined), cleanedBase };
}

/**
 * Normalizes a valid telephone number to canonical E.164 (e.g., `+16782059486`, `+639179668814`).
 * Returns `null` if the input is invalid, a non-phone identifier, or lacks a country code when `defaultCountry` is omitted.
 */
export function normalizePhoneToE164(
  input: string,
  defaultCountry?: CountryCode
): string | null {
  const raw = input.trim();
  if (!raw || isNonPhoneIdentifier(raw)) return null;

  const { parsed, cleanedBase } = tryParsePhone(raw, defaultCountry);

  if (parsed && parsed.isValid()) {
    return parsed.number;
  }

  // Support NANP fictional/example 555-01XX numbers when explicitly US/CA or +1 prefixed
  const hasPlus = cleanedBase.startsWith('+');
  const isExplicitUs = cleanedBase.startsWith('+1');
  const digits = cleanedBase.replace(/\D/g, '');
  if (
    (isExplicitUs || (!hasPlus && (defaultCountry === 'US' || defaultCountry === 'CA'))) &&
    isNanpTestOrReservedNumber(digits)
  ) {
    const ten = isNanpTestOrReservedNumber(digits)!;
    // Reject obviously invalid repeated zeros except standard 555-01XX or 555-XXXX test ranges
    if (ten.slice(3, 6) === '555') {
      return `+1${ten}`;
    }
  }

  return null;
}

/**
 * Formats a telephone number for user-facing display:
 * - United States / NANP (`+1`) numbers: `+1-XXX-XXX-XXXX` (preserving optional `ext. N`)
 * - Non-US international numbers (e.g. `+63`, `+44`, `+33`): standard international format preserving their actual country code
 * - Non-phone identifiers or unparseable values: returned unchanged so no data is corrupted
 */
export function formatPhoneDisplay(
  input: string,
  defaultCountry?: CountryCode
): string {
  const raw = input.trim();
  if (!raw || isNonPhoneIdentifier(raw)) return input;

  const { parsed, extension, cleanedBase } = tryParsePhone(raw, defaultCountry);

  if (parsed && parsed.isValid()) {
    if (parsed.countryCallingCode === '1') {
      const national = parsed.nationalNumber.toString();
      if (national.length === 10) {
        return formatUsTenDigits(national, extension);
      }
    }
    const intl = parsed.formatInternational();
    return extension ? `${intl} ext. ${extension}` : intl;
  }

  // Fallback for NANP reserved/555 numbers when explicitly +1 or defaultCountry is US/CA
  const hasPlus = cleanedBase.startsWith('+');
  const isExplicitUs = cleanedBase.startsWith('+1');
  const digits = cleanedBase.replace(/\D/g, '');
  if (isExplicitUs || (!hasPlus && (defaultCountry === 'US' || defaultCountry === 'CA'))) {
    const ten = isNanpTestOrReservedNumber(digits);
    if (ten && (ten.slice(3, 6) === '555' || ten.slice(3, 6) === '000')) {
      return formatUsTenDigits(ten, extension);
    }
  }

  return input;
}

/**
 * Builds a canonical click-to-call `tel:` URI (`tel:+16782059486`, `tel:+639179668814`).
 * Returns `null` if the input cannot be validated as a real telephone number.
 */
export function buildTelHref(
  input: string,
  defaultCountry?: CountryCode
): string | null {
  const raw = input.trim();
  if (!raw || isNonPhoneIdentifier(raw)) return null;

  const { extension } = extractExtension(raw);
  const e164 = normalizePhoneToE164(raw, defaultCountry);
  if (!e164) return null;

  return extension ? `tel:${e164};ext=${extension}` : `tel:${e164}`;
}

/**
 * Validates an international or US telephone number and returns structured status,
 * E.164 normalization, standardized display text, and click-to-call `tel:` href.
 */
export function validateInternationalPhone(
  input: string,
  options: { defaultCountry?: CountryCode; required?: boolean } = {}
): PhoneValidationResult {
  const { defaultCountry = 'US', required = false } = options;
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      valid: !required,
      e164: null,
      display: '',
      href: null,
      error: required ? 'Please enter a valid telephone number.' : undefined,
    };
  }

  if (isNonPhoneIdentifier(trimmed)) {
    return {
      valid: false,
      e164: null,
      display: trimmed,
      href: null,
      error: 'Enter a valid telephone number (not an EIN, SSN, PTIN, or ZIP code).',
    };
  }

  // Reject characters invalid in telephone numbers (allow digits, +, spaces, hyphens, parentheses, dots, ext/x)
  const { base, extension } = extractExtension(trimmed);
  if (/[^0-9+\s().-]/.test(base)) {
    return {
      valid: false,
      e164: null,
      display: trimmed,
      href: null,
      error: 'Telephone numbers may only include digits, +, spaces, dashes, or an extension.',
    };
  }

  const { parsed } = tryParsePhone(trimmed, defaultCountry);
  const e164 = normalizePhoneToE164(trimmed, defaultCountry);

  if (!e164) {
    return {
      valid: false,
      e164: null,
      display: trimmed,
      href: null,
      error:
        defaultCountry === 'US'
          ? 'Enter a valid US number (e.g., +1-678-205-9486) or include your international country code.'
          : 'Enter a valid international telephone number including country code.',
    };
  }

  const display = formatPhoneDisplay(trimmed, defaultCountry);
  const href = extension ? `tel:${e164};ext=${extension}` : `tel:${e164}`;

  return {
    valid: true,
    e164,
    display,
    href,
    country: parsed?.country ?? (e164.startsWith('+1') ? 'US' : undefined),
    extension,
  };
}

/**
 * Formats user input progressively while typing without duplicating country codes.
 * - For US/CA (`+1`): produces `+1-XXX-XXX-XXXX` progressively
 * - For other countries: uses libphonenumber-js `AsYouType` in international format
 */
export function formatPhoneAsYouType(
  rawInput: string,
  selectedCountry: CountryCode = 'US'
): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return '';

  const { base, extension } = extractExtension(trimmed);
  const cleaned = deduplicateCountryCode(base);

  // If the user explicitly typed a non-+1 international prefix, preserve their country code!
  if (cleaned.startsWith('+') && !cleaned.startsWith('+1')) {
    const formatted = new AsYouType().input(cleaned);
    return extension ? `${formatted} ext. ${extension}` : formatted;
  }

  const isNanp = selectedCountry === 'US' || selectedCountry === 'CA' || cleaned.startsWith('+1');
  if (isNanp) {
    let digits = cleaned.replace(/\D/g, '');
    if (digits.startsWith('1') && digits.length > 1) {
      digits = digits.slice(1);
    } else if (digits === '1' && cleaned.startsWith('+1')) {
      return '+1-';
    }
    digits = digits.slice(0, 10);
    if (!digits) return cleaned.startsWith('+') ? '+1' : '';

    let out = '+1-';
    if (digits.length <= 3) {
      out += digits;
    } else if (digits.length <= 6) {
      out += `${digits.slice(0, 3)}-${digits.slice(3)}`;
    } else {
      out += `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return extension ? `${out} ext. ${extension}` : out;
  }

  // Non-NANP selected country
  const dialCode = `+${getCountryCallingCode(selectedCountry)}`;
  const normalizedBase = cleaned.startsWith('+')
    ? cleaned
    : `${dialCode}${cleaned.replace(/\D/g, '')}`;
  const formatted = new AsYouType().input(normalizedBase);
  return extension ? `${formatted} ext. ${extension}` : formatted;
}

/**
 * Detects a matching supported country code from a `+CC...` telephone string.
 */
export function detectCountryFromPhone(input: string): CountryCode | undefined {
  const cleaned = deduplicateCountryCode(input);
  if (!cleaned.startsWith('+')) return undefined;
  const parsed = parsePhoneNumberFromString(cleaned);
  if (parsed?.country) return parsed.country;

  // Fallback by dial code prefix for partial input while typing
  const matched = [...SUPPORTED_PHONE_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => cleaned.startsWith(c.dialCode));
  return matched?.code;
}

/**
 * Telephone numbers stored by the public intake tables (consultation requests, contact intake) must match the
 * database rule `^[0-9+() .-]{7,32}$` (proposals 20261014430000 and 20261016050000). Display formatting can add an
 * extension ("ext. 12"), which that rule does not allow, so intake forms check this before submitting.
 */
export const INTAKE_PHONE_PATTERN = /^[0-9+() .-]{7,32}$/;
export function isIntakeStorablePhone(value: string): boolean {
  return INTAKE_PHONE_PATTERN.test(value.trim());
}
