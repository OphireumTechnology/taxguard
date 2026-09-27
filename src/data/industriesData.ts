import { IndustrySolutionRecord } from '../types';

export const INDUSTRIES_DATA: IndustrySolutionRecord[] = [
  {
    id: 'ind_construction',
    name: 'Construction, General Contractors & Specialty Trades',
    slug: 'construction-contractors',
    tagline: 'Precision job costing, progress billing, subcontractor 1099 compliance, and WIP schedule reconciliations.',
    description: 'Developed in direct alignment with commercial and residential builders like D Henze Construction, our specialized construction accounting suite masters the complexities of Percentage-of-Completion accounting, retainage tracking, mechanic lien waivers, and multi-county South Carolina licensing requirements.',
    keyChallenges: [
      'Cash flow volatility between progress billing milestones and supplier draws',
      'Complex Work-in-Progress (WIP) schedules and over/under-billing adjustments',
      'Subcontractor vs. employee classification scrutiny under IRS and SC DOL rules',
      'Equipment capitalization, Section 179 expensing, and fleet fuel tax management'
    ],
    strategicSolutions: [
      'Automated Percentage-of-Completion (PCM) and Completed-Contract accounting workflows',
      'Subcontractor compliance portal: W-9 collection, Certificate of Insurance (COI) tracking, and Form 1099-NEC e-filing',
      'Job cost allocation by cost code (labor, materials, equipment, subcontracts, overhead)',
      'Heavy machinery Section 179 expensing and South Carolina contractor tax optimization'
    ],
    applicableForms: ['Form 1120-S / Form 1065', 'Schedule C', 'Form 1099-NEC', 'SC Form WH-1612', 'Form 4562'],
    recommendedServicePlan: 'Enterprise / Custom Construction Advisory Retainer',
    clientCaseExample: 'Standardized a regional general contractor with $4.8M gross billings by implementing job-level WIP tracking, recovering $64,000 in unbilled change orders, and eliminating year-end tax surprises through quarterly proactive tax planning.'
  },
  {
    id: 'ind_real_estate',
    name: 'Real Estate Developers, Investors & Property Managers',
    slug: 'real-estate-investors',
    tagline: 'Cost segregation, Section 1031 like-kind exchanges, and passive loss optimization.',
    description: 'We guide real estate professionals, commercial syndicators, and residential multi-family property investors through advanced tax sheltering, property-by-property ledger maintenance, and statutory depreciation acceleration.',
    keyChallenges: [
      'Managing passive activity loss limitations under IRC § 469',
      'Depreciation recapture exposure upon property disposition',
      'Navigating strict 45-day identification rules for Section 1031 like-kind exchanges',
      'Short-term rental (STR) vs. long-term rental material participation rules'
    ],
    strategicSolutions: [
      'Certified engineering-based cost segregation studies to unlock 5- and 15-year property write-offs',
      'Real Estate Professional Status (REPS) substantiation and material participation logs',
      'Qualified Intermediary (QI) coordination for tax-deferred 1031 like-kind exchanges',
      'Entity structuring utilizing multi-tiered LLCs for liability protection and capital account tracking'
    ],
    applicableForms: ['Form 1065 Schedule K-1', 'Form 8825', 'Form 8824 (Like-Kind Exchanges)', 'Form 4562'],
    recommendedServicePlan: 'Corporate / Real Estate Advisory Retainer',
    clientCaseExample: 'Executed an engineering cost segregation study on a newly acquired 12-unit residential complex in Columbia, SC, generating $185,000 in first-year bonus depreciation and shielding active rental cash flow completely from state and federal income taxes.'
  },
  {
    id: 'ind_healthcare',
    name: 'Healthcare Practices, Physicians & Dental Clinics',
    slug: 'healthcare-medical-practices',
    tagline: 'S-Corporation reasonable compensation, medical equipment expensing, and practice cash flow optimization.',
    description: 'Our healthcare accounting team understands the operational demands of independent medical clinics, dental practices, surgical centers, and private therapists, delivering HIPAA-conscious financial workflows and practice succession planning.',
    keyChallenges: [
      'High personal income tax exposure and Medicare surtax on practice earnings',
      'Complex medical billing cycles, insurer clawbacks, and provider credentialing lags',
      'High capital equipment costs (imaging machines, dental chairs, clinical IT)',
      'Balancing partner buy-in/buy-out valuations and physician production bonuses'
    ],
    strategicSolutions: [
      'Statistically defended S-Corporation reasonable compensation baselines using medical specialty benchmarks',
      'Section 179 and bonus depreciation write-offs for clinical equipment purchases',
      'Practice financial dashboarding tracking revenue per patient day and collection realization rates',
      'Tiered defined-benefit cash balance retirement plans allowing up to $300k+ in pre-tax contributions'
    ],
    applicableForms: ['Form 1120-S', 'Form W-2 / 941', 'Form 5500', 'SC Active Trade or Business Return'],
    recommendedServicePlan: 'Executive Professional Practice Plan',
    clientCaseExample: 'Restructured a three-doctor dental partnership into an S-Corporation with an integrated cash-balance pension plan, reducing aggregate annual tax liabilities by $112,000 while ensuring compliance with SC medical board and IRS guidelines.'
  },
  {
    id: 'ind_legal_professional',
    name: 'Law Firms & Professional Service Practices',
    slug: 'legal-professional-services',
    tagline: 'IOLTA trust accounting compliance, partner equity distributions, and Pass-Through Entity Tax workarounds.',
    description: 'Tailored for attorneys, engineering consultants, architecture firms, and executive advisors, ensuring uncompromising ethical trust accounting standards and multi-owner pass-through tax efficiency.',
    keyChallenges: [
      'Strict South Carolina Bar IOLTA trust account reconciliation and audit requirements',
      'Complex partner equity compensation, capital contributions, and draw schedules',
      'State and local tax (SALT) $10,000 cap impact on high-earning firm partners',
      'Tracking billable realization rates vs. work-in-progress receivables'
    ],
    strategicSolutions: [
      'Three-way monthly IOLTA trust reconciliations compliant with Rule 417 SCACR',
      'South Carolina Pass-Through Entity Tax (PTET) elections creating federal deductions for state taxes',
      'Partner capital account accounting under IRC § 704(b) and distribution forecasting',
      'Time-and-billing software integrations with QuickBooks Online and firm management tools'
    ],
    applicableForms: ['Form 1065 / Schedule K-1', 'SC Form I-388 (Active Trade or Business)', 'Form 1099-NEC'],
    recommendedServicePlan: 'Corporate / Professional Practice Plan',
    clientCaseExample: 'Implemented a three-way automated IOLTA trust audit system for a trial law firm in Columbia, SC, eliminating audit risks and successfully electing SC PTET to pass $45,000 in federal deductions directly to firm partners.'
  },
  {
    id: 'ind_transportation',
    name: 'Transportation, Logistics & Commercial Freight',
    slug: 'transportation-trucking-logistics',
    tagline: 'Owner-operator accounting, multi-state IFTA fuel tax reconciliation, and per-diem deduction substantiation.',
    description: 'Dedicated financial oversight for commercial freight carriers, independent owner-operators, freight brokers, and intermodal transport fleets navigating multi-jurisdiction compliance across the Southeast.',
    keyChallenges: [
      'Multi-state IFTA fuel tax calculations, highway use taxes, and mileage audits',
      'High fuel, maintenance, and insurance volatility impacting working capital',
      'Rigorous driver per-diem deduction substantiation under IRS special transportation rules',
      'Heavy vehicle acquisition financing, depreciation, and Form 2290 Heavy Highway Vehicle Use Tax'
    ],
    strategicSolutions: [
      'Quarterly IFTA tax filing calculations and ELD GPS mileage reconciliation',
      'IRS special transportation per-diem allowance optimization ($69+/day statutory rates)',
      'Heavy Highway Vehicle Use Tax Form 2290 electronic preparation and schedule 1 receipt verification',
      'Equipment replacement tax modeling (Section 179 vs. MACRS for Class 8 commercial tractors)'
    ],
    applicableForms: ['Form 2290 (Schedule 1)', 'Form 1120-S / Schedule C', 'SC IFTA Quarterly Return', 'Form 4562'],
    recommendedServicePlan: 'Commercial Fleet Advisory Package',
    clientCaseExample: 'Assisted an interstate freight carrier with 14 power units in restructuring dispatch and fuel records, resolving a $38,000 state fuel audit deficiency and saving $22,000 annually in substantiated driver per-diem deductions.'
  },
  {
    id: 'ind_technology',
    name: 'Technology, SaaS & E-Commerce Startups',
    slug: 'technology-saas-ecommerce',
    tagline: 'Federal R&D tax credits, sales tax economic nexus compliance, and multi-channel inventory accounting.',
    description: 'Engineered for high-growth tech startups, software firms, and Shopify/Amazon multi-channel sellers requiring agile SaaS unit economics, Section 174 amortization compliance, and multi-state sales tax nexus mitigation.',
    keyChallenges: [
      'Mandatory 5-year amortization of domestic software development costs under IRC § 174',
      'Multi-state sales tax economic nexus thresholds triggered across hundreds of jurisdictions',
      'Reconciling multi-currency Stripe, PayPal, and merchant settlement feeds with inventory reserves',
      'Equity compensation management (ISO, NSO, 83(b) elections, and QSBS tracking)'
    ],
    strategicSolutions: [
      'Comprehensive Research & Development (R&D) Tax Credit studies under IRC § 41 (offsetting up to $500k in payroll taxes)',
      'Automated sales tax nexus monitoring and remittance via automated e-commerce tax engines',
      'Section 1202 Qualified Small Business Stock (QSBS) setup for 100% federal capital gains exclusion',
      'SaaS financial metrics reporting: MRR, ARR, churn rate, Customer Acquisition Cost (CAC), and runway projections'
    ],
    applicableForms: ['Form 6765 (R&D Credit)', 'Form 8974 (Payroll Offset)', 'Form 1120', 'Multi-State Sales Tax Returns'],
    recommendedServicePlan: 'Venture & SaaS Growth Advisory',
    clientCaseExample: 'Helped a Columbia-based SaaS platform claim $68,000 in federal R&D tax credits to offset employer payroll taxes, extending company runway by four months while structuring company equity to qualify for Section 1202 QSBS.'
  },
  {
    id: 'ind_hospitality',
    name: 'Restaurants, Food Service & Hospitality',
    slug: 'restaurants-hospitality',
    tagline: 'FICA tip credit calculations, point-of-sale integrations, and prime cost inventory management.',
    description: 'Full-spectrum accounting and tax compliance for independent restaurants, franchises, craft breweries, and hospitality groups managing tipped labor, high perishable inventory turns, and dynamic margins.',
    keyChallenges: [
      'Tipped wage compliance, Form 8027 tip reporting, and employee turnover',
      'Maintaining healthy prime costs (cost of goods sold + labor) below 60%',
      'Daily POS settlement reconciliation (Toast, Square, Clover) with physical cash and credit deposits',
      'Alcohol and beverage excise tax compliance and local hospitality tax filings'
    ],
    strategicSolutions: [
      'IRC § 45B FICA Tip Credit optimization (claiming corporate tax credits for employer taxes paid on tips)',
      'Automated point-of-sale sync with QuickBooks Online for daily sales and merchant fee reconciliation',
      'Weekly food and beverage prime cost variance analysis to protect gross operating margins',
      'South Carolina state and local hospitality/accommodations tax preparation and timely remittance'
    ],
    applicableForms: ['Form 8846 (FICA Tip Credit)', 'Form 8027', 'Form 941', 'SC Form ST-3 (Sales & Use Tax)'],
    recommendedServicePlan: 'Hospitality Management & Tax Retainer',
    clientCaseExample: 'Recovered $34,500 in retroactive FICA tip credits under Form 8846 for a regional restaurant group with two locations, while automating daily POS sales integration and lowering food waste by 4.2%.'
  },
  {
    id: 'ind_nonprofit',
    name: 'Non-Profits, Foundations & Faith-Based Organizations',
    slug: 'nonprofits-foundations',
    tagline: 'IRS Form 990 preparation, 501(c)(3) governance compliance, and donor contribution tracking.',
    description: 'Dedicated to preserving tax-exempt status for educational institutions, charities, religious bodies, and private foundations through rigorous fund accounting, public support tests, and board fiduciary reports.',
    keyChallenges: [
      'Maintaining public support status on Schedule A to prevent reclassification as a private foundation',
      'Unrelated Business Income Tax (UBIT) exposure on commercial or advertising activities',
      'Donor-restricted vs. unrestricted fund allocation under FASB ASC 958 accounting standards',
      'Board compliance, conflict-of-interest disclosures, and public inspection transparency'
    ],
    strategicSolutions: [
      'IRS Form 990, 990-EZ, and 990-PF preparation with Schedule A public support test verification',
      'Fund accounting configuration tracking restricted grant expenditures and program expense ratios',
      'UBIT review on commercial sponsorships and auxiliary business activities under Form 990-T',
      'Executive compensation governance review to protect against excess benefit transactions under IRC § 4958'
    ],
    applicableForms: ['Form 990 / 990-EZ / 990-N', 'Form 990-T (UBIT)', 'SC Form Non-Profit Annual Report', 'Form 1023'],
    recommendedServicePlan: 'Non-Profit Fiduciary & Tax Retainer',
    clientCaseExample: 'Assisted a Columbia community foundation with $1.4M in endowed contributions in restructuring grant tracking, passing their IRS Form 990 public support audit with zero findings, and providing clean financial reports for state grant applications.'
  }
];
