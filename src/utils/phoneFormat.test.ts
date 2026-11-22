import { describe, expect, it } from 'vitest';
import { COMPANY_CONTACT } from '../config/companyBranding';
import {
  buildTelHref,
  deduplicateCountryCode,
  detectCountryFromPhone,
  formatPhoneAsYouType,
  formatPhoneDisplay,
  isNonPhoneIdentifier,
  normalizePhoneToE164,
  validateInternationalPhone,
} from './phoneFormat';

describe('COMPANY_CONTACT canonical configuration', () => {
  it('exposes Destria Tax Services, LLC official international telephone constants', () => {
    expect(COMPANY_CONTACT.companyName).toBe('Destria Tax Services, LLC');
    expect(COMPANY_CONTACT.phoneDisplay).toBe('+1-678-205-9486');
    expect(COMPANY_CONTACT.phoneE164).toBe('+16782059486');
    expect(COMPANY_CONTACT.phoneHref).toBe('tel:+16782059486');
    expect(COMPANY_CONTACT.email).toBe('info@destriataxservices.com');
    expect(COMPANY_CONTACT.website).toBe('https://destriataxservices.com');
    expect(COMPANY_CONTACT.location).toBe('Columbia, South Carolina, USA');
  });
});

describe('formatPhoneDisplay & normalizePhoneToE164 — US standardization', () => {
  const legacyCompanyFormats = [
    '678-205-9486',
    '(678) 205-9486',
    '6782059486',
    '678.205.9486',
    '1-678-205-9486',
    '+1 (678) 205-9486',
    '+16782059486',
    '+1-678-205-9486',
  ];

  it.each(legacyCompanyFormats)('converts %s to +1-678-205-9486 and canonical E.164', (raw) => {
    expect(formatPhoneDisplay(raw, 'US')).toBe('+1-678-205-9486');
    expect(normalizePhoneToE164(raw, 'US')).toBe('+16782059486');
    expect(buildTelHref(raw, 'US')).toBe('tel:+16782059486');
  });

  it('preserves individual, office, agency, and fictional US digits while standardizing format', () => {
    expect(formatPhoneDisplay('(925) 397-1040', 'US')).toBe('+1-925-397-1040');
    expect(buildTelHref('(925) 397-1040', 'US')).toBe('tel:+19253971040');
    expect(formatPhoneDisplay('1-866-255-0654', 'US')).toBe('+1-866-255-0654');
    expect(formatPhoneDisplay('(803) 555-0142', 'US')).toBe('+1-803-555-0142');
    expect(normalizePhoneToE164('(803) 555-0142', 'US')).toBe('+18035550142');
    expect(formatPhoneDisplay('+1 (803) 555-0190', 'US')).toBe('+1-803-555-0190');
  });

  it('prevents duplicate country codes', () => {
    expect(deduplicateCountryCode('+1 +1-678-205-9486')).toBe('+1 678-205-9486');
    expect(formatPhoneDisplay('+1 +1-678-205-9486', 'US')).toBe('+1-678-205-9486');
    expect(formatPhoneDisplay('+1 1-678-205-9486', 'US')).toBe('+1-678-205-9486');
    expect(formatPhoneDisplay('1-1-678-205-9486', 'US')).toBe('+1-678-205-9486');
    expect(formatPhoneDisplay('+1+16782059486', 'US')).toBe('+1-678-205-9486');
  });

  it('preserves telephone extensions cleanly', () => {
    expect(formatPhoneDisplay('678-205-9486 ext. 204', 'US')).toBe('+1-678-205-9486 ext. 204');
    expect(formatPhoneDisplay('(678) 205-9486 x42', 'US')).toBe('+1-678-205-9486 ext. 42');
    expect(buildTelHref('678-205-9486 ext. 204', 'US')).toBe('tel:+16782059486;ext=204');
  });
});

describe('international non-US telephone preservation', () => {
  it('preserves Philippine (+63) and other international country codes without adding +1', () => {
    expect(formatPhoneDisplay('+639179668814', 'US')).toBe('+63 917 966 8814');
    expect(normalizePhoneToE164('+63 917 966 8814', 'US')).toBe('+639179668814');
    expect(buildTelHref('+63 917 966 8814', 'US')).toBe('tel:+639179668814');

    expect(normalizePhoneToE164('+44 20 7946 0958', 'US')).toBe('+442079460958');
    expect(formatPhoneDisplay('+44 20 7946 0958', 'US')).toMatch(/^\+44\s/);
    expect(formatPhoneDisplay('+44 20 7946 0958', 'US')).not.toContain('+1');

    expect(normalizePhoneToE164('+33 1 42 68 53 00', 'US')).toBe('+33142685300');
    expect(detectCountryFromPhone('+63 917 966 8814')).toBe('PH');
    expect(detectCountryFromPhone('+44 20 7946 0958')).toBe('GB');
  });

  it('never guesses a country code when defaultCountry is omitted on national numbers', () => {
    expect(normalizePhoneToE164('678-205-9486')).toBeNull();
    expect(normalizePhoneToE164('+1-678-205-9486')).toBe('+16782059486');
  });
});

describe('validation and non-phone identifier safety', () => {
  it('rejects invalid phone numbers cleanly', () => {
    expect(validateInternationalPhone('123', { defaultCountry: 'US' }).valid).toBe(false);
    expect(validateInternationalPhone('not-a-phone', { defaultCountry: 'US' }).valid).toBe(false);
    expect(validateInternationalPhone('+1-000-000-0000', { defaultCountry: 'US' }).valid).toBe(false);
    expect(validateInternationalPhone('', { defaultCountry: 'US', required: true }).valid).toBe(false);
    expect(validateInternationalPhone('', { defaultCountry: 'US', required: false }).valid).toBe(true);
  });

  it('never formats or accepts SSNs, EINs, PTINs, ZIP codes, or reference IDs', () => {
    const nonPhones = ['123-45-6789', '12-3456789', 'P12345678', '29201', '29201-1234', 'INV-2026-0001'];
    for (const id of nonPhones) {
      expect(isNonPhoneIdentifier(id)).toBe(true);
      expect(formatPhoneDisplay(id, 'US')).toBe(id);
      expect(normalizePhoneToE164(id, 'US')).toBeNull();
      expect(buildTelHref(id, 'US')).toBeNull();
      expect(validateInternationalPhone(id, { defaultCountry: 'US' }).valid).toBe(false);
    }
  });
});

describe('formatPhoneAsYouType', () => {
  it('progressively formats US input as +1-XXX-XXX-XXXX without duplicating +1', () => {
    expect(formatPhoneAsYouType('678', 'US')).toBe('+1-678');
    expect(formatPhoneAsYouType('678205', 'US')).toBe('+1-678-205');
    expect(formatPhoneAsYouType('6782059486', 'US')).toBe('+1-678-205-9486');
    expect(formatPhoneAsYouType('+16782059486', 'US')).toBe('+1-678-205-9486');
    expect(formatPhoneAsYouType('+1 +1-678-205-9486', 'US')).toBe('+1-678-205-9486');
  });

  it('preserves explicit non-US international prefixes while typing', () => {
    const formatted = formatPhoneAsYouType('+639179668814', 'US');
    expect(formatted.startsWith('+63')).toBe(true);
    expect(formatted.startsWith('+1')).toBe(false);
  });
});
