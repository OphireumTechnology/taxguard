/**
 * Canonical company branding configuration for Destria Tax Services, LLC.
 * Single source of truth for legal/display names, official website, email, and tagline.
 */
export const COMPANY_BRANDING = {
  legalName: 'Destria Tax Services, LLC',
  displayName: 'Destria Tax Services, LLC',
  uppercaseName: 'DESTRIA TAX SERVICES, LLC',
  shortName: 'Destria',
  website: 'https://destriataxservices.com',
  email: 'info@destriataxservices.com',
  tagline: 'Preserving Wealth. Building Legacies.',
} as const;

export const COMPANY_MAILTO_HREF = `mailto:${COMPANY_BRANDING.email}` as const;

/**
 * Centralized official contact configuration for Destria Tax Services, LLC.
 * Display format: +1-XXX-XXX-XXXX | Click-to-call href: canonical E.164 tel:+1XXXXXXXXXX.
 */
export const COMPANY_CONTACT = {
  companyName: COMPANY_BRANDING.legalName,
  phoneDisplay: '+1-678-205-9486',
  phoneE164: '+16782059486',
  phoneHref: 'tel:+16782059486',
  email: COMPANY_BRANDING.email,
  website: COMPANY_BRANDING.website,
  location: 'Columbia, South Carolina, USA',
} as const;
