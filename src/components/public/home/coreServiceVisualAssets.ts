import taxAdvisoryWebp from '../../../assets/images/home_svc_tax_advisory_1795334516549.webp';
import taxAdvisoryJpg from '../../../assets/images/home_svc_tax_advisory_1795334516549.jpg';
import corporateComplianceWebp from '../../../assets/images/home_svc_corporate_compliance_1795334515931.webp';
import corporateComplianceJpg from '../../../assets/images/home_svc_corporate_compliance_1795334515931.jpg';
import wealthEstateWebp from '../../../assets/images/home_svc_wealth_estate_1795334516297.webp';
import wealthEstateJpg from '../../../assets/images/home_svc_wealth_estate_1795334516297.jpg';
import individualTaxWebp from '../../../assets/images/home_svc_individual_tax_1795334514992.webp';
import individualTaxJpg from '../../../assets/images/home_svc_individual_tax_1795334514992.jpg';
import intelligentAccountingWebp from '../../../assets/images/home_acct_intelligent_hub_1795334515448.webp';
import intelligentAccountingJpg from '../../../assets/images/home_acct_intelligent_hub_1795334515448.jpg';

export interface CoreServiceCardSpec {
  readonly id: 'tax-advisory' | 'corporate-compliance' | 'wealth-estate' | 'individual-tax';
  readonly categoryLabel: string;
  readonly title: string;
  readonly description: string;
  readonly capabilities: readonly string[];
  readonly webp: string;
  readonly jpg: string;
  readonly alt: string;
}

export interface TransparencyPathwayStage {
  readonly id: string;
  readonly step: string;
  readonly label: string;
  readonly description: string;
}

export interface AccountingCapabilityPanelSpec {
  readonly id: 'quickbooks' | 'xero' | 'reconciliation';
  readonly title: string;
  readonly description: string;
  readonly supportingDetail: string;
}

export const CORE_SERVICES_CATALOG: readonly CoreServiceCardSpec[] = [
  {
    id: 'tax-advisory',
    categoryLabel: 'Tax Advisory & Strategy',
    title: 'Tax Advisory & Strategic Planning',
    description:
      'Strategic tax planning designed around your financial circumstances, business structure, and long-term objectives across federal and multistate requirements.',
    capabilities: [
      'Entity selection and structuring guidance for LLCs, S-Corporations, and C-Corporations',
      'Quarterly tax projections and estimated payment schedules aligned with cash flow',
      'Section 199A QBI and state Pass-Through Entity Tax (PTET) analysis',
      'IRS transcript review and structured compliance resolution support'
    ],
    webp: taxAdvisoryWebp,
    jpg: taxAdvisoryJpg,
    alt: 'Executive tax strategy workstation displaying financial forecasting models in midnight navy and metallic gold'
  },
  {
    id: 'corporate-compliance',
    categoryLabel: 'Corporate & Enterprise',
    title: 'Corporate Compliance & Entity Filings',
    description:
      'Professional tax preparation and compliance support for corporations, partnerships, and multi-entity businesses managing federal and state obligations.',
    capabilities: [
      'Federal and state filings for Form 1120-S (S-Corporation), Form 1065 (Partnership), and Form 1120',
      'Multistate nexus and income apportionment review',
      'Owner reasonable compensation and payroll tax coordination',
      'Organized Schedule K-1 delivery through the secure Client Portal'
    ],
    webp: corporateComplianceWebp,
    jpg: corporateComplianceJpg,
    alt: 'Corporate financial operations suite with entity hierarchy visualizations and governance binders'
  },
  {
    id: 'wealth-estate',
    categoryLabel: 'Wealth & Legacy',
    title: 'Wealth, Estate & Asset Protection',
    description:
      'Coordinated financial planning and tax advisory focused on wealth preservation, estate considerations, and multi-generational priorities alongside qualified legal counsel.',
    capabilities: [
      'Revocable and irrevocable trust tax reporting (Form 1041)',
      'Estate and gift tax compliance coordination (Form 706 and Form 709)',
      'Business succession and multi-generational transfer planning',
      'Direct coordination with independent estate attorneys and financial advisers'
    ],
    webp: wealthEstateWebp,
    jpg: wealthEstateJpg,
    alt: 'Executive wealth and estate advisory room with architectural glass structures and portfolio volumes'
  },
  {
    id: 'individual-tax',
    categoryLabel: 'Accuracy & Compliance',
    title: 'Precision Individual Tax Preparation',
    description:
      'Careful, professional preparation of individual tax returns for executives, investors, and families, supported by organized documentation and thorough review.',
    capabilities: [
      'Federal Form 1040 and multi-state individual income tax returns',
      'Structured workpaper reconciliation and practitioner quality review',
      'Schedule C business income, Schedule E real estate, equity compensation, and Schedule K-1 reporting',
      'Client review walkthrough and formal filing authorization package'
    ],
    webp: individualTaxWebp,
    jpg: individualTaxJpg,
    alt: 'Precision individual tax preparation workstation with organized document layers and review monitor'
  }
];

export const FINANCIAL_TRANSPARENCY_STAGES: readonly TransparencyPathwayStage[] = [
  {
    id: 'financial-documents',
    step: '01',
    label: 'Financial Documents',
    description: 'Source tax forms, ledgers, and supporting statements are collected in a structured digital workspace.'
  },
  {
    id: 'information-verification',
    step: '02',
    label: 'Information Verification',
    description: 'Document completeness, cross-form figures, and supporting schedules are checked before preparation.'
  },
  {
    id: 'accounting-intelligence',
    step: '03',
    label: 'Accounting Intelligence',
    description: 'Trial balances and ledger categories are mapped cleanly to support accurate book-to-tax alignment.'
  },
  {
    id: 'tax-analysis',
    step: '04',
    label: 'Tax Analysis',
    description: 'Applicable statutory rules, deductions, and entity filing considerations are evaluated carefully.'
  },
  {
    id: 'professional-review',
    step: '05',
    label: 'Professional Review',
    description: 'Qualified Destria tax professionals review workpapers, calculations, and compliance positions.'
  },
  {
    id: 'transparent-reporting',
    step: '06',
    label: 'Transparent Reporting',
    description: 'Clients receive clear summaries, filing walkthroughs, and organized final documentation.'
  }
];

export const ACCOUNTING_CAPABILITY_PANELS: readonly AccountingCapabilityPanelSpec[] = [
  {
    id: 'quickbooks',
    title: 'QuickBooks Reporting',
    description: 'Organized financial reports and accounting information.',
    supportingDetail: 'Trial balance & chart of accounts review'
  },
  {
    id: 'xero',
    title: 'Xero Ledger Management',
    description: 'Structured financial records and ledger visibility.',
    supportingDetail: 'General ledger & book-to-tax mapping'
  },
  {
    id: 'reconciliation',
    title: 'Account Reconciliation',
    description: 'Review and reconciliation of financial transactions.',
    supportingDetail: 'CSV, Excel & PDF statement intake'
  }
];

export const INTELLIGENT_ACCOUNTING_VISUAL = {
  webp: intelligentAccountingWebp,
  jpg: intelligentAccountingJpg,
  alt: 'Enterprise intelligent accounting workstation displaying financial ledger structures and reconciliation pathways'
} as const;
