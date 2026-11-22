import heroEnterpriseWebp from '../../../assets/images/ind_hero_enterprise_1795333015255.webp';
import heroEnterpriseJpg from '../../../assets/images/ind_hero_enterprise_1795333015255.jpg';

import constructionWebp from '../../../assets/images/svc_biz_entities_1795330307189.webp';
import constructionJpg from '../../../assets/images/svc_biz_entities_1795330307189.jpg';

import realEstateWebp from '../../../assets/images/strat_real_estate_1795328203853.webp';
import realEstateJpg from '../../../assets/images/strat_real_estate_1795328203853.jpg';

import healthcareWebp from '../../../assets/images/svc_ind_aca_1795330361589.webp';
import healthcareJpg from '../../../assets/images/svc_ind_aca_1795330361589.jpg';

import legalWebp from '../../../assets/images/svc_est_trust_1795330306534.webp';
import legalJpg from '../../../assets/images/svc_est_trust_1795330306534.jpg';

import transportationWebp from '../../../assets/images/svc_biz_multistate_1795330307320.webp';
import transportationJpg from '../../../assets/images/svc_biz_multistate_1795330307320.jpg';

import technologyWebp from '../../../assets/images/ind_technology_1795333014651.webp';
import technologyJpg from '../../../assets/images/ind_technology_1795333014651.jpg';

import restaurantsWebp from '../../../assets/images/ind_restaurants_1795333014224.webp';
import restaurantsJpg from '../../../assets/images/ind_restaurants_1795333014224.jpg';

import nonprofitsWebp from '../../../assets/images/ind_nonprofits_1795333013988.webp';
import nonprofitsJpg from '../../../assets/images/ind_nonprofits_1795333013988.jpg';

export interface IndustryVisualProfile {
  slug: string;
  shortTitle: string;
  sectorCode: string;
  cardSummary: string;
  webp: string;
  jpg: string;
  alt: string;
  visualCaption: string;
  intelligenceLayers: string[];
  flowAdaptations: [string, string, string, string, string, string, string];
}

export const INDUSTRIES_HERO_VISUAL = {
  webp: heroEnterpriseWebp,
  jpg: heroEnterpriseJpg,
  alt: 'DESTRIA TAX SERVICES, LLC enterprise multi-industry financial advisory and analytical command center',
};

export const INDUSTRY_VISUAL_PROFILES: Record<string, IndustryVisualProfile> = {
  'construction-contractors': {
    slug: 'construction-contractors',
    shortTitle: 'Construction',
    sectorCode: '01',
    cardSummary: 'Job costing, WIP schedules, progress billing & 1099 contractor compliance.',
    webp: constructionWebp,
    jpg: constructionJpg,
    alt: 'Modern commercial construction and structural engineering financial cost intelligence architecture',
    visualCaption: 'Construction Project Cost Intelligence & WIP Architecture',
    intelligenceLayers: [
      'Work-in-Progress (WIP) Schedules',
      'Progress Billing & Retainage',
      'Job Cost Code Allocation',
      'Subcontractor 1099-NEC & COI Review',
      'Section 179 Equipment Depreciation',
    ],
    flowAdaptations: [
      'Job Sites & Draws',
      'WIP & Cost Codes',
      'W-9 & COI Checks',
      'PCM Margin Tracking',
      '1120-S & 1099-NEC',
      'Advisor Sign-Off',
      'Bonding & Tax Clarity',
    ],
  },
  'real-estate-investors': {
    slug: 'real-estate-investors',
    shortTitle: 'Real Estate Developers',
    sectorCode: '02',
    cardSummary: 'Cost segregation, Section 1031 exchanges & multi-entity asset ledgers.',
    webp: realEstateWebp,
    jpg: realEstateJpg,
    alt: 'Commercial real estate development portfolio and digital property depreciation analytics',
    visualCaption: 'Commercial Development & Property Portfolio Intelligence',
    intelligenceLayers: [
      'Property-Level Ledger Architecture',
      'Cost Segregation & Depreciation Schedules',
      'Section 1031 Exchange Coordination',
      'IRC § 469 Passive Loss Tracking',
    ],
    flowAdaptations: [
      'Acquisitions & Leases',
      'Property Ledgers',
      'Basis & Closing Audit',
      'Depreciation Modeling',
      'Form 8825 & 8824',
      'Advisor Review',
      'Investor K-1 Reporting',
    ],
  },
  'healthcare-medical-practices': {
    slug: 'healthcare-medical-practices',
    shortTitle: 'Healthcare Practices',
    sectorCode: '03',
    cardSummary: 'Practice cash flow, clinical equipment expensing & S-Corp compensation.',
    webp: healthcareWebp,
    jpg: healthcareJpg,
    alt: 'Modern healthcare practice financial compliance and clinical operations accounting environment without patient records',
    visualCaption: 'Clinical Practice Financial & Compliance Infrastructure',
    intelligenceLayers: [
      'Practice Revenue Realization Review',
      'S-Corp Compensation Benchmarking',
      'Clinical Equipment Section 179 Planning',
      'Confidential Financial Safeguards',
    ],
    flowAdaptations: [
      'Practice Operations',
      'Billing & Payroll Logs',
      'Reconciliation Checks',
      'Cash Flow Intelligence',
      '1120-S & Form 5500',
      'CPA Governance',
      'Partner Financials',
    ],
  },
  'legal-professional-services': {
    slug: 'legal-professional-services',
    shortTitle: 'Law Firms & Practices',
    sectorCode: '04',
    cardSummary: 'Three-way IOLTA trust reconciliation, partner equity & SC PTET planning.',
    webp: legalWebp,
    jpg: legalJpg,
    alt: 'Modern legal practice fiduciary accounting ledger and partner compliance suite',
    visualCaption: 'Fiduciary Trust Accounting & Partner Equity Architecture',
    intelligenceLayers: [
      'Three-Way IOLTA Trust Reconciliation',
      'Partner Capital Account Tracking',
      'Pass-Through Entity Tax (PTET) Review',
      'Billing & Realization Alignment',
    ],
    flowAdaptations: [
      'Client Retainers',
      'Trust & Operating Books',
      'Three-Way Tie-Out',
      'Partner Allocation',
      'Form 1065 & SC I-388',
      'Fiduciary Review',
      'Bar-Ready Reporting',
    ],
  },
  'transportation-trucking-logistics': {
    slug: 'transportation-trucking-logistics',
    shortTitle: 'Transportation',
    sectorCode: '05',
    cardSummary: 'Multi-state IFTA fuel tax, Form 2290 compliance & fleet depreciation.',
    webp: transportationWebp,
    jpg: transportationJpg,
    alt: 'Interstate commercial freight logistics network and multi-state fleet compliance mapping',
    visualCaption: 'Multi-State Fleet Compliance & Freight Cost Intelligence',
    intelligenceLayers: [
      'Quarterly IFTA Fuel Reconciliation',
      'ELD Mileage & Jurisdiction Mapping',
      'Per-Diem Substantiation Controls',
      'Form 2290 & Fleet Asset Modeling',
    ],
    flowAdaptations: [
      'Dispatch & Mileage',
      'Fuel & Settlement Logs',
      'ELD Jurisdiction Match',
      'Cost-Per-Mile Review',
      'IFTA & Form 2290',
      'Compliance Review',
      'Fleet Performance',
    ],
  },
  'technology-saas-ecommerce': {
    slug: 'technology-saas-ecommerce',
    shortTitle: 'Technology',
    sectorCode: '06',
    cardSummary: 'R&D tax credit studies, Section 174 compliance & multi-state sales nexus.',
    webp: technologyWebp,
    jpg: technologyJpg,
    alt: 'Enterprise cloud data center and software engineering environment supporting SaaS financial analytics',
    visualCaption: 'Cloud Enterprise, SaaS Metrics & R&D Tax Architecture',
    intelligenceLayers: [
      'IRC § 41 R&D Credit Documentation',
      'Section 174 Amortization Tracking',
      'Multi-State Sales Nexus Monitoring',
      'Subscription Revenue Reconciliation',
    ],
    flowAdaptations: [
      'Cloud & Subscriptions',
      'Merchant Settlements',
      'Nexus & R&D Validation',
      'SaaS Unit Economics',
      'Form 6765 & 1120',
      'Technical Review',
      'Board-Ready Reports',
    ],
  },
  'restaurants-hospitality': {
    slug: 'restaurants-hospitality',
    shortTitle: 'Restaurants',
    sectorCode: '07',
    cardSummary: 'FICA tip credits, daily POS reconciliation & prime cost oversight.',
    webp: restaurantsWebp,
    jpg: restaurantsJpg,
    alt: 'Modern fine-dining restaurant interior, commercial kitchen pass, and digital point-of-sale counter',
    visualCaption: 'Hospitality POS Settlement & Prime Cost Intelligence',
    intelligenceLayers: [
      'Daily POS & Merchant Settlement Sync',
      'IRC § 45B FICA Tip Credit Tracking',
      'Food & Labor Prime Cost Analysis',
      'State & Local Hospitality Tax Filings',
    ],
    flowAdaptations: [
      'Daily POS Service',
      'Sales, Tips & COGS',
      'Deposit Verification',
      'Prime Cost Margin',
      'Form 8846 & SC ST-3',
      'Advisor Review',
      'Store Profitability',
    ],
  },
  'nonprofits-foundations': {
    slug: 'nonprofits-foundations',
    shortTitle: 'Non-Profits',
    sectorCode: '08',
    cardSummary: 'Form 990 compliance, fund accounting & transparent grant stewardship.',
    webp: nonprofitsWebp,
    jpg: nonprofitsJpg,
    alt: 'Modern civic foundation and community educational center glass atrium symbolizing transparent nonprofit stewardship',
    visualCaption: 'Fund Accounting & Philanthropic Stewardship Architecture',
    intelligenceLayers: [
      'Restricted vs. Unrestricted Fund Tracking',
      'IRS Form 990 & Schedule A Public Support',
      'Grant Expenditure Allocation',
      'UBIT & Board Governance Oversight',
    ],
    flowAdaptations: [
      'Grants & Donations',
      'Fund Ledger Entries',
      'Restriction Verification',
      'Program Ratio Analysis',
      'Form 990 & 990-T',
      'Fiduciary Review',
      'Board & Donor Reports',
    ],
  },
};

export function getIndustryVisualProfile(slug: string): IndustryVisualProfile {
  return (
    INDUSTRY_VISUAL_PROFILES[slug] ?? INDUSTRY_VISUAL_PROFILES['construction-contractors']
  );
}
