import { COMPANY_BRANDING } from '../config/companyBranding';

export const BRAND_ASSET_VERSION = '20261121-emblem-v3';
export const FOUNDER_PORTRAIT_VERSION = '2f1007a9';
export const BRAND_WEBSITE_URL = `${COMPANY_BRANDING.website}/`;

const getBaseUrl = (): string => {
  const rawBase =
    typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL
      ? (import.meta as { env?: { BASE_URL?: string } }).env!.BASE_URL!
      : '/';
  return rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
};

export const resolveAssetUrl = (assetPath: string, version?: string): string => {
  const normalized = assetPath.replace(/^\/+/, '');
  const resolved = `${getBaseUrl()}${normalized}`;
  return version ? `${resolved}?v=${version}` : resolved;
};

const withBrandVersion = (assetPath: string) => resolveAssetUrl(assetPath, BRAND_ASSET_VERSION);

export const BRAND_ASSETS = {
  destriaFounderPortrait: withBrandVersion('branding/destria-founder-executive-portrait.png'),
  destriaLogo: withBrandVersion('branding/destria-logo-header.png'),
  destriaLogoHero: withBrandVersion('branding/destria-logo-hero.png'),
  destriaLogoOriginal: withBrandVersion('branding/destria-logo-original.png'),
  destriaFounderPortraitPath: resolveAssetUrl('branding/destria-founder-executive-portrait.png'),
  destriaFounderPortrait: resolveAssetUrl(
    'branding/destria-founder-executive-portrait.png',
    FOUNDER_PORTRAIT_VERSION
  ),
  destriaEmblem: withBrandVersion('branding/destria-emblem-icon.png'),
  destriaFavicon: withBrandVersion('branding/destria-favicon.png'),
  appleTouchIcon: withBrandVersion('apple-touch-icon.png'),

  aboutClientAdvisoryJpg: resolveAssetUrl('images/about/about-client-advisory.jpg'),
  aboutClientAdvisoryWebp: resolveAssetUrl('images/about/about-client-advisory.webp'),
  aboutTaxAdvisoryOfficeJpg: resolveAssetUrl('images/about/about-tax-advisory-office.jpg'),
  aboutTaxAdvisoryOfficeWebp: resolveAssetUrl('images/about/about-tax-advisory-office.webp'),

  auditRepresentationJpg: resolveAssetUrl('images/audit-representation.jpg'),
  auditRepresentationWebp: resolveAssetUrl('images/audit-representation.webp'),
  bookkeepingReportingJpg: resolveAssetUrl('images/bookkeeping-financial-reporting.jpg'),
  bookkeepingReportingWebp: resolveAssetUrl('images/bookkeeping-financial-reporting.webp'),
  businessStrategyJpg: resolveAssetUrl('images/business-tax-strategy.jpg'),
  businessStrategyWebp: resolveAssetUrl('images/business-tax-strategy.webp'),
  columbiaSkylineJpg: resolveAssetUrl('images/hero-executive-advisory.jpg'),
  columbiaSkylineWebp: resolveAssetUrl('images/hero-executive-advisory.webp'),
  corporateBusinessAdvisoryJpg: resolveAssetUrl('images/corporate-business-advisory.jpg'),
  corporateBusinessAdvisoryWebp: resolveAssetUrl('images/corporate-business-advisory.webp'),
  corporateTaxComplianceJpg: resolveAssetUrl('images/corporate-tax-compliance.jpg'),
  corporateTaxComplianceWebp: resolveAssetUrl('images/corporate-tax-compliance.webp'),
  digitalDocumentReviewJpg: resolveAssetUrl('images/digital-document-review.jpg'),
  digitalDocumentReviewWebp: resolveAssetUrl('images/digital-document-review.webp'),
  estateLegacyPlanningJpg: resolveAssetUrl('images/estate-legacy-planning.jpg'),
  estateLegacyPlanningWebp: resolveAssetUrl('images/estate-legacy-planning.webp'),
  executiveConsultationSuiteJpg: resolveAssetUrl('images/executive-consultation-suite.jpg'),
  executiveConsultationSuiteWebp: resolveAssetUrl('images/executive-consultation-suite.webp'),
  familyTaxPlanningJpg: resolveAssetUrl('images/family-tax-planning.jpg'),
  familyTaxPlanningWebp: resolveAssetUrl('images/family-tax-planning.webp'),
  meticulousTaxPrepJpg: resolveAssetUrl('images/meticulous-tax-preparation.jpg'),
  meticulousTaxPrepWebp: resolveAssetUrl('images/meticulous-tax-preparation.webp'),
  payrollAdminJpg: resolveAssetUrl('images/payroll-administration.jpg'),
  payrollAdminWebp: resolveAssetUrl('images/payroll-administration.webp'),
  privateConsultationExpJpg: resolveAssetUrl('images/private-consultation-experience.jpg'),
  privateConsultationExpWebp: resolveAssetUrl('images/private-consultation-experience.webp'),
  taxAdvisoryPlanningJpg: resolveAssetUrl('images/tax-advisory-planning.jpg'),
  taxAdvisoryPlanningWebp: resolveAssetUrl('images/tax-advisory-planning.webp'),
  taxConsultationJpg: resolveAssetUrl('images/tax-consultation-advisory.jpg'),
  taxConsultationWebp: resolveAssetUrl('images/tax-consultation-advisory.webp'),
  taxCreditResearchJpg: resolveAssetUrl('images/tax-credit-research.jpg'),
  taxCreditResearchWebp: resolveAssetUrl('images/tax-credit-research.webp'),
  taxStrategyWorkspaceJpg: resolveAssetUrl('images/tax-strategies/tax-strategy-workspace.jpg'),
  taxStrategyWorkspaceWebp: resolveAssetUrl('images/tax-strategies/tax-strategy-workspace.webp'),
} as const;
