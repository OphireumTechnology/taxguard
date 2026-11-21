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
