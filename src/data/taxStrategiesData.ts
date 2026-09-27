import { TaxStrategyRecord, StrategyCategory } from '../types';

export const STRATEGY_CATEGORIES_MAP: Record<StrategyCategory, { label: string; description: string }> = {
  individuals: {
    label: 'Individuals',
    description: 'Personal income tax optimization, standard vs. itemized timing, and health savings structures.'
  },
  families: {
    label: 'Families',
    description: 'Dependent tax credits, education funding plans, and family income-shifting strategies.'
  },
  self_employed: {
    label: 'Self-Employed',
    description: 'Schedule C expense allocation, statutory home office deductions, and SECA tax mitigation.'
  },
  small_businesses: {
    label: 'Small Businesses',
    description: 'Entity classification, equipment capital expense acceleration, and working capital optimization.'
  },
  s_corporations: {
    label: 'S Corporations',
    description: 'Reasonable compensation baselines, non-dividend distributions, and shareholder health deductions.'
  },
  c_corporations: {
    label: 'C Corporations',
    description: 'Qualified Small Business Stock (QSBS) exclusions, accumulated earnings, and corporate rate parity.'
  },
  partnerships: {
    label: 'Partnerships',
    description: 'Guaranteed payments, special allocations under IRC § 704(b), and capital account tracking.'
  },
  real_estate: {
    label: 'Real Estate',
    description: 'Cost segregation studies, IRC § 1031 like-kind exchanges, and real estate professional status.'
  },
  retirement: {
    label: 'Retirement',
    description: 'Backdoor Roth conversions, defined benefit cash-balance plans, and solo 401(k) structures.'
  },
  estates_trusts: {
    label: 'Estates and Trusts',
    description: 'Irrevocable trusts, generation-skipping transfer planning, and fiduciary income minimization.'
  },
  charitable_planning: {
    label: 'Charitable Planning',
    description: 'Donor-advised fund bunching, charitable remainder trusts (CRT), and appreciated asset gifts.'
  },
  payroll_benefits: {
    label: 'Payroll and Employee Benefits',
    description: 'IRC § 62 accountable plans, commuter benefits, and fringe benefit exclusion compliance.'
  },
  credits_incentives: {
    label: 'Credits and Incentives',
    description: 'Federal R&D tax credits (IRC § 41), Work Opportunity Tax Credits (WOTC), and energy incentives.'
  },
  state_local_tax: {
    label: 'State and Local Tax',
    description: 'Pass-Through Entity Tax (PTET) state-level workarounds, South Carolina credits, and nexus defense.'
  },
  international: {
    label: 'International or Cross-Border',
    description: 'Foreign Earned Income Exclusion (FEIE), Foreign Tax Credits (FTC), and FBAR/FATCA compliance.'
  },
  year_end_planning: {
    label: 'Year-End Planning',
    description: 'Tax-loss harvesting, capital asset timing, accelerated deductions, and deferred income recognition.'
  }
};

export const INITIAL_TAX_STRATEGIES: TaxStrategyRecord[] = [
  // 1. Individuals
  {
    id: 'strat_hsa_triple_tax',
    strategyName: 'Health Savings Account (HSA) Triple-Tax Optimization',
    category: 'individuals',
    plainLanguageSummary: 'Maximize pre-tax or tax-deductible HSA contributions, allow the funds to grow compound interest tax-free, and withdraw tax-free for qualified medical expenses.',
    eligibleTaxpayerType: 'Individual taxpayers enrolled in an eligible High-Deductible Health Plan (HDHP)',
    taxObjective: 'Above-the-line adjusted gross income (AGI) reduction with permanent tax-free capital accumulation',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    requiredDocuments: [
      'Form 1099-SA (Distributions from HSA)',
      'Form 5498-SA (HSA Contribution Information)',
      'HDHP Policy Declaration and Coverage Certificate',
      'Qualified Medical Expense Receipts Ledger'
    ],
    workflowChecklist: [
      { id: 'w1', step: 'Verify HDHP minimum statutory deductible and maximum out-of-pocket limits', requiredRole: 'accountant' },
      { id: 'w2', step: 'Calculate maximum allowable contribution including age 55+ catch-up allowance ($1,000)', requiredRole: 'accountant' },
      { id: 'w3', step: 'Verify no disqualifying secondary non-HDHP coverage or general-purpose FSA enrollment', requiredRole: 'reviewer' },
      { id: 'w4', step: 'Reconcile Form 8889 and integrate into Form 1040 Schedule 1', requiredRole: 'accountant' }
    ],
    potentialBenefits: [
      '100% tax-deductible contributions lowering federal and state taxable income',
      'Tax-free earnings and capital compounding over multi-decade horizon',
      'Tax-free withdrawals for eligible current and future healthcare expenses',
      'Unused balances roll over indefinitely without use-it-or-lose-it forfeitures'
    ],
    materialRisksAndLimitations: [
      'Non-qualified withdrawals incurred prior to age 65 face ordinary income tax plus a 20% IRS penalty',
      'Excess contributions are subject to a 6% excise penalty per year until withdrawn',
      'Ineligible if enrolled in Medicare Part A or Part B'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 223 - Health Savings Accounts',
      codeCitation: '26 U.S.C. § 223; IRS Publication 969',
      url: 'https://www.irs.gov/publications/p969'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'Taxpayers with low to moderate chronic medical expenses enrolled in HDHPs with investable discretionary savings.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-01-10', notes: 'Initial practice approval' },
      { version: '1.1.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-11-15', notes: 'Updated statutory contribution thresholds for 2025/2026' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-15',
    version: '1.1.0'
  },

  // 2. Families
  {
    id: 'strat_child_care_stacking',
    strategyName: 'Dependent Care FSA & Child Tax Credit Stacking Coordination',
    category: 'families',
    plainLanguageSummary: 'Harmonize pre-tax employer Dependent Care FSA payroll withholdings with the federal Child and Dependent Care Credit and Child Tax Credit to avoid phase-outs and double-dipping disallowances.',
    eligibleTaxpayerType: 'Married filing jointly or head of household taxpayers with qualifying children under age 13',
    taxObjective: 'Maximize family pre-tax child care allocations while capturing statutory excess expenses under IRC § 21',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS)',
    requiredDocuments: [
      'Form W-2 Box 10 (Dependent care benefits)',
      'Provider statements with EIN or SSN, name, and address',
      'Proof of earned income for both spouses'
    ],
    workflowChecklist: [
      { id: 'fc1', step: 'Confirm both spouses meet earned income requirements (or full-time student status)', requiredRole: 'accountant' },
      { id: 'fc2', step: 'Reconcile Form 2441 Part III for employer dependent care exclusions ($5,000 cap)', requiredRole: 'accountant' },
      { id: 'fc3', step: 'Check for remaining allowable expenses up to $6,000 cap for 2+ dependents', requiredRole: 'reviewer' },
      { id: 'fc4', step: 'Verify Child Tax Credit eligibility under IRC § 24 modified AGI phase-outs', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Excludes up to $5,000 in qualifying child care costs from FICA (7.65%) and federal income taxes',
      'Additional non-refundable credit on remaining qualifying expenses up to $1,000',
      'Child Tax Credit preserved for each qualifying child up to statutory age limit'
    ],
    materialRisksAndLimitations: [
      'Expenses allocated to Dependent Care FSA cannot also be used for the Child and Dependent Care Credit',
      'Both spouses must report earned income during the tax year'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 21 & § 24 - Dependent Care & Child Tax Credit',
      codeCitation: '26 U.S.C. §§ 21, 24, 129; IRS Publication 503',
      url: 'https://www.irs.gov/publications/p503'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'Working parents with dependent daycare, preschool, or summer camp expenses.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-01-12', notes: 'Approved for family tax planning' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-20',
    version: '1.0.0'
  },

  // 3. Self-Employed
  {
    id: 'strat_home_office_allocation',
    strategyName: 'Home Office Deduction & Actual Expense Allocation Strategy',
    category: 'self_employed',
    plainLanguageSummary: 'Substantiate regular and exclusive commercial use of a dedicated home office portion to deduct direct expenses and allocable indirect housing costs, unlocking additional business travel mileage deductions.',
    eligibleTaxpayerType: 'Sole proprietors, 1099 independent contractors, and single-member LLCs operating from home',
    taxObjective: 'Convert personal housing and utility expenditures into legitimate Schedule C business deductions',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    requiredDocuments: [
      'Home floor plan or square footage measurements (dedicated office vs. total home)',
      'Annual mortgage interest statement (Form 1098) or rental lease agreement',
      'Annual electric, heating, gas, water, internet, and trash utility bills',
      'Homeowner or renter insurance annual policy statements'
    ],
    workflowChecklist: [
      { id: 'ho1', step: 'Perform strict exclusivity and regularity test under IRC § 280A(c)(1)', requiredRole: 'accountant' },
      { id: 'ho2', step: 'Calculate exact square footage percentage (Office Sq Ft / Total Sq Ft)', requiredRole: 'accountant' },
      { id: 'ho3', step: 'Model Simplified Method ($5/sq ft up to $1,500) vs. Actual Expense Method for optimal net savings', requiredRole: 'accountant' },
      { id: 'ho4', step: 'Verify office functions as Principal Place of Business to establish home-as-tax-home for business travel', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Direct deductions for office repairs, paint, and dedicated communication lines',
      'Indirect deductions for rent, utilities, insurance, and home depreciation percentage',
      'Eliminates non-deductible commuting mileage between home and client sites'
    ],
    materialRisksAndLimitations: [
      'Dual personal-commercial use of the space voids deduction under IRS audit',
      'Claiming depreciation on homeowner property may trigger Section 1250 depreciation recapture upon home sale',
      'Deduction is capped at gross business income and cannot generate a Schedule C net loss (excess carries forward)'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 280A - Disallowance of Certain Expenses in Connection with Business Use of Home',
      codeCitation: '26 U.S.C. § 280A; Rev. Proc. 2013-13; IRS Publication 587',
      url: 'https://www.irs.gov/publications/p587'
    },
    status: 'active',
    assignedProfessional: 'Desmond Hinds, CEO',
    clientSuitabilityAssessment: 'Full-time self-employed individuals with a clearly segregated workspace used exclusively for business.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-02-01', notes: 'Practice standard established' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-10-15',
    version: '1.0.0'
  },

  // 4. Small Businesses
  {
    id: 'strat_section_179_bonus',
    strategyName: 'Section 179 Expensing & Bonus Depreciation Capital Acceleration',
    category: 'small_businesses',
    plainLanguageSummary: 'Immediately expense the full cost of qualifying tangible business equipment, commercial vehicles, and off-the-shelf software placed in service during the tax year rather than depreciating over multiple years.',
    eligibleTaxpayerType: 'Small businesses, LLCs, and corporations purchasing tangible business personal property',
    taxObjective: 'Accelerate tax write-offs to offset high current-year operating income and preserve operational liquidity',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    requiredDocuments: [
      'Capital asset purchase invoices and bills of sale showing date placed in service',
      'Vehicle title, weight registration (GVWR > 6,000 lbs documentation), and business mileage log',
      'Equipment financing or lease agreements',
      'Form 4562 depreciation workpapers from prior year'
    ],
    workflowChecklist: [
      { id: 's1', step: 'Verify asset qualifies as Section 1245 tangible personal property placed in service during tax year', requiredRole: 'accountant' },
      { id: 's2', step: 'Confirm business use percentage exceeds 50.0% threshold (mandatory for listed property)', requiredRole: 'accountant' },
      { id: 's3', step: 'Apply Section 179 dollar limitation and phase-out thresholds under IRC § 179(b)', requiredRole: 'reviewer' },
      { id: 's4', step: 'Calculate phase-down percentage for remaining bonus depreciation under IRC § 168(k)', requiredRole: 'reviewer' },
      { id: 's5', step: 'Review South Carolina state-specific depreciation decoupling adjustments', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Up to 100% immediate deduction of capital equipment costs in Year 1',
      'Substantial reduction in net taxable ordinary income and self-employment tax',
      'Supports financing equipment where deduction exceeds year-one cash down payment'
    ],
    materialRisksAndLimitations: [
      'Section 179 deduction cannot exceed aggregate taxable income from all active trades or businesses',
      'Disposing of the asset or dropping business use below 50% triggers mandatory depreciation recapture into ordinary income',
      'Some states (including South Carolina adjustments) do not conform fully to federal bonus depreciation rates'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 179 & § 168(k) - Election to Expense Certain Depreciable Assets',
      codeCitation: '26 U.S.C. §§ 179, 168(k); Form 4562 Instructions',
      url: 'https://www.irs.gov/forms-pubs/about-form-4562'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'Profitable businesses acquiring machinery, IT infrastructure, commercial equipment, or heavy vehicles.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-01-20', notes: 'Re-certified for 2025 bonus depreciation schedule' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-01',
    version: '1.0.0'
  },

  // 5. S Corporations
  {
    id: 'strat_scorp_reasonable_comp',
    strategyName: 'S Corporation Reasonable Compensation & Distribution Optimization',
    category: 's_corporations',
    plainLanguageSummary: 'Establish a statistically defensible W-2 reasonable salary for owner-employees based on RCReports empirical industry metrics, taking the remaining business net profits as non-wage distributions exempt from FICA taxes.',
    eligibleTaxpayerType: 'S Corporation shareholder-employees providing substantial services to their corporation',
    taxObjective: 'Minimize combined 15.3% FICA and 3.8% Medicare surtax while maintaining full IRS audit defensibility',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    requiredDocuments: [
      'Current-year corporate Profit and Loss statement (Form 1120-S draft)',
      'Owner duty allocation log, hours worked, and operational responsibilities description',
      'Bureau of Labor Statistics (BLS) or RCReports wage comparability study',
      'Form W-2 and quarterly Form 941 payroll filings'
    ],
    workflowChecklist: [
      { id: 'rc1', step: 'Perform multi-factor reasonable compensation analysis under Rev. Rul. 74-44 and Watson v. Comm.', requiredRole: 'accountant' },
      { id: 'rc2', step: 'Determine defensible salary split considering capital vs. personal services contributions', requiredRole: 'reviewer' },
      { id: 'rc3', step: 'Verify corporate payroll is executed with statutory federal and state withholdings', requiredRole: 'accountant' },
      { id: 'rc4', step: 'Verify shareholder basis in stock and debt under IRC § 1366(d) prior to authorizing distributions', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Saves 15.3% SECA / FICA tax on all profits distributed as S-Corp dividends above the reasonable wage',
      'Provides a substantiated and defensible documentation trail against IRS reclassification inquiries',
      'Protects shareholder eligibility for IRC § 199A Qualified Business Income (QBI) 20% deduction'
    ],
    materialRisksAndLimitations: [
      'Zero or unrealistically low salary invites immediate IRS reclassification, penalties, and back payroll tax assessments',
      'Shareholder distributions taken without sufficient tax basis result in taxable capital gains',
      'S-Corp must maintain corporate formalities, payroll registrations, and separate commercial accounts'
    ],
    officialAuthority: {
      title: 'IRS Fact Sheet FS-2008-25 & Rev. Rul. 74-44 - Wage Payments for S Corporation Officers',
      codeCitation: '26 U.S.C. §§ 1366, 3121; Rev. Rul. 74-44; IRS FS-2008-25',
      url: 'https://www.irs.gov/businesses/small-businesses-self-employed/s-corporation-compensation-and-medical-insurance-issues'
    },
    status: 'active',
    assignedProfessional: 'Desmond Hinds, CEO',
    clientSuitabilityAssessment: 'Established S-Corp owners generating over $80,000 in net business income seeking systematic payroll and distribution structuring.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-01-05', notes: 'Firm core competency' },
      { version: '1.2.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-10-10', notes: 'Integrated formal RCReports benchmark requirements' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-10-10',
    version: '1.2.0'
  },

  // 6. C Corporations
  {
    id: 'strat_qsbs_exclusion',
    strategyName: 'Qualified Small Business Stock (QSBS) Capital Gains Exclusion',
    category: 'c_corporations',
    plainLanguageSummary: 'Structure equity in eligible domestic C corporations to qualify for up to 100% federal capital gains tax exclusion (up to $10M or 10x basis) upon the sale of stock held for more than 5 years.',
    eligibleTaxpayerType: 'Founders and early investors in domestic C-Corporations meeting gross assets tests',
    taxObjective: 'Eliminate federal capital gains tax upon enterprise exit or acquisition under IRC § 1202',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS)',
    requiredDocuments: [
      'Articles of Incorporation establishing domestic C-Corporation status',
      'Stock purchase agreements, capitalization table, and stock certificates',
      'Balance sheet history proving aggregate gross assets did not exceed $50M at or before issuance',
      'Active business trade verification documents demonstrating >80% asset use in qualified active trade'
    ],
    workflowChecklist: [
      { id: 'qs1', step: 'Verify original issuance requirement directly from corporation for money, property, or services', requiredRole: 'reviewer' },
      { id: 'qs2', step: 'Audit corporate balance sheets for $50M aggregate gross assets limit under IRC § 1202(d)', requiredRole: 'reviewer' },
      { id: 'qs3', step: 'Screen trade or business against non-qualifying sectors (hospitality, law, accounting, farming)', requiredRole: 'reviewer' },
      { id: 'qs4', step: 'Track 5-year statutory holding period from date of stock issuance', requiredRole: 'accountant' }
    ],
    potentialBenefits: [
      'Up to 100% federal capital gains tax exclusion on up to $10,000,000 in gain or 10x basis',
      'Complete exemption from the 3.8% Net Investment Income Tax (NIIT)',
      'Potential to roll over gains into replacement QSBS under IRC § 1045 within 60 days'
    ],
    materialRisksAndLimitations: [
      'Stock issued after entity conversion from LLC may have basis adjustments limiting exempt portion',
      'Ineligible if corporation redeems stock within statutory disqualification windows',
      'Certain states do not conform to IRC § 1202 exclusions'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 1202 - Partial Exclusion for Gain from Certain Small Business Stock',
      codeCitation: '26 U.S.C. § 1202; IRC § 1045',
      url: 'https://www.irs.gov/businesses/small-businesses-self-employed/qualified-small-business-stock'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'Technology, manufacturing, and scalable startup founders intending to raise equity capital and target a 5+ year exit.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-02-15', notes: 'Approved for corporate consulting' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-10-01',
    version: '1.0.0'
  },

  // 7. Partnerships
  {
    id: 'strat_guaranteed_payments',
    strategyName: 'Guaranteed Payments vs. Distributive Share Structuring',
    category: 'partnerships',
    plainLanguageSummary: 'Structure partner compensation between IRC § 707(c) guaranteed payments for services and distributive shares of partnership income to preserve equity capital accounts and reflect commercial risk.',
    eligibleTaxpayerType: 'Partners in general partnerships, limited partnerships, and multi-member LLCs',
    taxObjective: 'Deduct partner service costs at partnership level while managing partner-level SECA liabilities',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & State Partnership Filings',
    requiredDocuments: [
      'Executed Partnership Agreement or LLC Operating Agreement with Section 704 allocation clauses',
      'Form 1065 Schedule K and Schedule K-1 history',
      'Partner capital account records under tax basis method'
    ],
    workflowChecklist: [
      { id: 'gp1', step: 'Review Operating Agreement for explicit authorization of guaranteed payments', requiredRole: 'reviewer' },
      { id: 'gp2', step: 'Classify partner compensation between services, capital interest, and profit share', requiredRole: 'accountant' },
      { id: 'gp3', step: 'Reconcile Form 1065 page 1 deductions and Schedule K line 4 guaranteed payment reporting', requiredRole: 'accountant' },
      { id: 'gp4', step: 'Verify partner capital account maintenance under IRC § 704(b) capital accounting rules', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Provides predictable ordinary income to service partners irrespective of partnership net profitability',
      'Permissible ordinary business deduction reducing bottom-line partnership net ordinary income',
      'Enables differentiated compensation across active vs. passive financial capital partners'
    ],
    materialRisksAndLimitations: [
      'Guaranteed payments are subject to full self-employment tax at the individual partner level',
      'Guaranteed payments do not qualify for the 20% Qualified Business Income (QBI) deduction under IRC § 199A',
      'Partners cannot be classified as W-2 employees of their own partnership'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 707(c) - Transactions Between Partner and Partnership (Guaranteed Payments)',
      codeCitation: '26 U.S.C. § 707(c); Treas. Reg. § 1.707-1',
      url: 'https://www.irs.gov/forms-pubs/about-form-1065'
    },
    status: 'active',
    assignedProfessional: 'Desmond Hinds, CEO',
    clientSuitabilityAssessment: 'Multi-member partnerships where founding partners provide unequal operational day-to-day services.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-01-25', notes: 'Verified partnership framework' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-09-18',
    version: '1.0.0'
  },

  // 8. Real Estate
  {
    id: 'strat_cost_seg_1031',
    strategyName: 'Cost Segregation Studies & Section 1031 Like-Kind Exchange Rollover',
    category: 'real_estate',
    plainLanguageSummary: 'Conduct an engineering-based cost segregation study to reclassify 27.5/39-year building components into 5-, 7-, and 15-year personal property for accelerated depreciation, paired with IRC § 1031 deferrals on divestiture.',
    eligibleTaxpayerType: 'Commercial and residential rental property owners and active real estate developers',
    taxObjective: 'Generate large early-stage non-cash paper losses to offset rental income and roll gains into replacement assets',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    requiredDocuments: [
      'Certified engineering cost segregation study with asset breakdown schedule',
      'Closing settlement statement (HUD-1 / ALTA) for property acquisition',
      'Qualified Intermediary (QI) exchange escrow agreement and 45-day identification letter',
      'Prior Form 8824 like-kind exchange filings'
    ],
    workflowChecklist: [
      { id: 'cs1', step: 'Review quality of engineering cost segregation report against IRS Cost Segregation Audit Techniques Guide', requiredRole: 'reviewer' },
      { id: 'cs2', step: 'File Form 3115 (Application for Change in Accounting Method) if claiming missed prior depreciation', requiredRole: 'reviewer' },
      { id: 'cs3', step: 'Test Real Estate Professional Status (REPS) under IRC § 469(c)(7) (750 hours + >50% personal services)', requiredRole: 'reviewer' },
      { id: 'cs4', step: 'Verify strict adherence to 45-day identification and 180-day closing exchange timelines under IRC § 1031', requiredRole: 'accountant' }
    ],
    potentialBenefits: [
      'Accelerates 20% to 40% of building cost basis into Year 1 write-offs',
      'Offsets positive rental net cash flow, shielding real estate yields from current taxation',
      'Defers 100% of federal and state capital gains and depreciation recapture taxes upon sale via 1031 exchange'
    ],
    materialRisksAndLimitations: [
      'Passive activity loss limits under IRC § 469 trap losses unless taxpayer qualifies as a Real Estate Professional or uses STR loop',
      'Failure to identify replacement property within 45 days automatically invalidates 1031 exchange',
      'Boot received (cash or net debt relief) in 1031 exchange is taxable'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 1031 & Cost Segregation Audit Techniques Guide',
      codeCitation: '26 U.S.C. § 1031; IRS Cost Segregation ATG; Rev. Proc. 87-56',
      url: 'https://www.irs.gov/businesses/cost-segregation-audit-techniques-guide-table-of-contents'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'Real estate investors purchasing or holding commercial property or residential multi-family assets valued > $500k.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-01-30', notes: 'Full real estate practice protocol' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-10',
    version: '1.0.0'
  },

  // 9. Retirement
  {
    id: 'strat_backdoor_roth',
    strategyName: 'Backdoor Roth IRA Conversion & Mega-Backdoor 401(k) Execution',
    category: 'retirement',
    plainLanguageSummary: 'Make non-deductible contributions to a traditional IRA and promptly convert to a Roth IRA, circumventing statutory income limits to establish lifetime tax-free investment growth and tax-free retirement distributions.',
    eligibleTaxpayerType: 'High-earning individuals exceeding statutory direct Roth IRA contribution income limits',
    taxObjective: 'Bypass MAGI limits to build tax-free retirement reserves without required minimum distributions (RMDs)',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS)',
    requiredDocuments: [
      'Form 1099-R showing IRA distribution and distribution code 2 or 7',
      'Form 5498 showing non-deductible traditional IRA contribution',
      'Year-end December 31 traditional, SEP, and SIMPLE IRA account valuation statements (Form 8606 basis check)'
    ],
    workflowChecklist: [
      { id: 'bd1', step: 'Perform pro-rata aggregate IRA check across all pre-tax IRAs (Form 8606 line 6)', requiredRole: 'reviewer' },
      { id: 'bd2', step: 'Model reverse-rollover of pre-tax IRA funds into active employer 401(k) to clear pro-rata basis if needed', requiredRole: 'reviewer' },
      { id: 'bd3', step: 'Ensure prompt conversion timing to minimize taxable interim capital gain accrual', requiredRole: 'accountant' },
      { id: 'bd4', step: 'Prepare Form 8606 accurately to document non-deductible basis and zero-tax conversion', requiredRole: 'accountant' }
    ],
    potentialBenefits: [
      'Allows high earners to contribute up to annual statutory IRA limits ($7,000 / $8,000 if 50+)',
      '100% tax-free growth and tax-free withdrawals in retirement after meeting 5-year aging rule',
      'Roth IRAs have no Required Minimum Distributions (RMDs) during the owner lifetime'
    ],
    materialRisksAndLimitations: [
      'Existing pre-tax traditional, SEP, or SIMPLE IRAs trigger pro-rata taxation on converted amounts',
      'Each conversion starts an independent 5-year clock for penalty-free principal withdrawal prior to age 59½'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 408A & IRS Form 8606 - Nondeductible IRAs',
      codeCitation: '26 U.S.C. § 408A; IRS Form 8606 Instructions; IRS Notice 2014-54',
      url: 'https://www.irs.gov/forms-pubs/about-form-8606'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'High-income individuals with MAGI above Roth limits with zero balance in traditional pre-tax IRAs.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-02-05', notes: 'Annual statutory limits updated' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-05',
    version: '1.0.0'
  },

  // 10. Estates and Trusts
  {
    id: 'strat_ilit_annual_gifting',
    strategyName: 'Irrevocable Life Insurance Trust (ILIT) & Annual Exclusion Gifting',
    category: 'estates_trusts',
    plainLanguageSummary: 'Fund an Irrevocable Life Insurance Trust using annual gift tax exclusions ($19,000 per donee) and Crummey withdrawal notices to remove life insurance death benefits completely from the gross taxable estate.',
    eligibleTaxpayerType: 'High-net-worth families, business owners, and estates approaching federal or state estate tax exemptions',
    taxObjective: 'Provide immediate estate tax liquidity and transfer death benefit proceeds 100% tax-free outside probate',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina Probate Code',
    requiredDocuments: [
      'Draft or executed Irrevocable Life Insurance Trust agreement prepared by licensed SC estate attorney',
      'Life insurance policy application or transfer documentation',
      'Annual Crummey beneficiary notice letters and proof of delivery',
      'Trust EIN assignment letter (Form CP 575) and dedicated trust bank statements'
    ],
    workflowChecklist: [
      { id: 'et1', step: 'Confirm 3-year transfer lookback rule under IRC § 2035 for existing policy transfers', requiredRole: 'reviewer' },
      { id: 'et2', step: 'Reconcile annual gift amounts against annual exclusion thresholds under IRC § 2503(b)', requiredRole: 'accountant' },
      { id: 'et3', step: 'Coordinate directly with client legal counsel to confirm Crummey notice compliance window', requiredRole: 'reviewer' },
      { id: 'et4', step: 'Prepare Form 709 (United States Gift Tax Return) if gifts exceed annual exclusions or split-gifts elected', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Death benefits bypass federal estate tax (40% rate) and state inheritance taxes completely',
      'Provides immediate liquid cash to pay estate administrative costs and business transfer settlements',
      'Proceeds are protected from personal estate creditors and probate delays'
    ],
    materialRisksAndLimitations: [
      'Trust is irrevocable; the grantor relinquishes all incidents of ownership in the policy',
      'Transferring an existing policy creates estate inclusion risk if grantor passes within 3 years of transfer',
      'Trustee must follow strict annual Crummey notice procedures for premium gifts'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 2042 & § 2503(b) - Proceeds of Life Insurance & Annual Gift Exclusion',
      codeCitation: '26 U.S.C. §§ 2042, 2503(b), 2035; Crummey v. Comm., 397 F.2d 82',
      url: 'https://www.irs.gov/businesses/small-businesses-self-employed/estate-and-gift-taxes'
    },
    status: 'active',
    assignedProfessional: 'Desmond Hinds, CEO',
    clientSuitabilityAssessment: 'Families with gross estates projected to exceed current or sunsetting federal estate tax limits.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-01-18', notes: 'Coordinated with boutique estate legal counsel' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-10-25',
    version: '1.0.0'
  },

  // 11. Charitable Planning
  {
    id: 'strat_daf_charitable_bunching',
    strategyName: 'Donor-Advised Fund (DAF) Charitable Bunching Strategy',
    category: 'charitable_planning',
    plainLanguageSummary: 'Bunch several years of planned charitable donations into a single tax year using a Donor-Advised Fund to exceed the standard deduction threshold, while recommending individual grants to charities over time.',
    eligibleTaxpayerType: 'Charitably minded individuals and couples claiming the standard deduction in typical years',
    taxObjective: 'Unlock itemized deduction benefits under IRC § 170 while smoothing out philanthropic distributions',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    requiredDocuments: [
      'DAF contribution confirmation receipts from 501(c)(3) sponsoring charity',
      'Brokerage statements documenting transfer of long-term appreciated public securities',
      'Prior-year Schedule A itemized deduction summaries'
    ],
    workflowChecklist: [
      { id: 'ch1', step: 'Calculate multi-year donation schedule vs. current standard deduction threshold', requiredRole: 'accountant' },
      { id: 'ch2', step: 'Screen portfolio for long-term appreciated equities held > 1 year to donate at fair market value', requiredRole: 'reviewer' },
      { id: 'ch3', step: 'Verify AGI percentage limitations for public charity gifts (60% cash / 30% capital gain property)', requiredRole: 'accountant' },
      { id: 'ch4', step: 'Document contemporaneous written acknowledgment (CWA) from DAF sponsor', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Immediate upfront itemized deduction in the year of the bunched contribution',
      'Donating appreciated stock eliminates capital gains tax on accumulated gains',
      'Donor retains grant recommendation privileges across future years without recurring tax pressure'
    ],
    materialRisksAndLimitations: [
      'Contributions to DAFs are irrevocable; funds cannot be reclaimed or redirected for private benefit',
      'Charitable itemized deductions cannot create a net operating loss (excess carries forward up to 5 years)'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 170 - Charitable, etc., Contributions and Gifts',
      codeCitation: '26 U.S.C. § 170; IRS Notice 2006-110; IRS Publication 526',
      url: 'https://www.irs.gov/publications/p526'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'Taxpayers with stable charitable intentions who would otherwise miss itemized deduction benefits due to high standard deductions.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-02-10', notes: 'Philanthropic tax standard approved' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-12',
    version: '1.0.0'
  },

  // 12. Payroll and Employee Benefits
  {
    id: 'strat_accountable_plan',
    strategyName: 'Internal Revenue Code § 62 Accountable Plan Implementation',
    category: 'payroll_benefits',
    plainLanguageSummary: 'Adopt a formal corporate Accountable Plan to reimburse owner-employees and staff for business travel, mileage, cell phone, and home internet without treating payments as taxable wages or payroll compensation.',
    eligibleTaxpayerType: 'S-Corporations, C-Corporations, and LLCs with active owner-employees or W-2 staff',
    taxObjective: 'Convert out-of-pocket business expenses into 100% tax-free reimbursements exempt from income and FICA taxes',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    requiredDocuments: [
      'Corporate Resolution and Written Accountable Plan document',
      'Monthly expense reimbursement reports with commercial receipts attached',
      'Detailed business mileage logs showing date, destination, business purpose, and mileage'
    ],
    workflowChecklist: [
      { id: 'ap1', step: 'Draft and formally adopt written corporate Accountable Plan satisfying 3 statutory IRS criteria', requiredRole: 'accountant' },
      { id: 'ap2', step: 'Audit expense reports for business connection, substantiation within 60 days, and return of excess funds', requiredRole: 'accountant' },
      { id: 'ap3', step: 'Ensure reimbursements bypass payroll Form W-2 Box 1 and Box 3 reporting', requiredRole: 'reviewer' },
      { id: 'ap4', step: 'Reconcile reimbursement payments through dedicated corporate bank disbursements', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      '100% tax-free cash back to the owner/employee (no federal income, state income, or 15.3% FICA taxes)',
      '100% corporate tax deduction reducing net business profit',
      'Captures business portion of cell phone, internet, home office utilities, and vehicle mileage'
    ],
    materialRisksAndLimitations: [
      'Without contemporaneous receipts or mileage logs, IRS recharacterizes reimbursements as taxable W-2 wages subject to back employment taxes and penalties',
      'Reimbursements must occur within a reasonable statutory timeframe (typically within 60 to 120 days)'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 62(a)(2)(A) & Treasury Regulation § 1.62-2 - Accountable Plans',
      codeCitation: '26 U.S.C. § 62(a)(2)(A); 26 C.F.R. § 1.62-2; IRS Publication 463',
      url: 'https://www.irs.gov/publications/p463'
    },
    status: 'active',
    assignedProfessional: 'Desmond Hinds, CEO',
    clientSuitabilityAssessment: 'All corporate and S-Corp clients where owners regularly incur out-of-pocket operational and vehicle expenses.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-01-15', notes: 'Standard firm compliance deliverable' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-10-30',
    version: '1.0.0'
  },

  // 13. Credits and Incentives
  {
    id: 'strat_rd_tax_credit',
    strategyName: 'Research & Development (R&D) Tax Credit for Small Businesses & Startups',
    category: 'credits_incentives',
    plainLanguageSummary: 'Identify qualified research activities (software development, engineering, prototype testing, process improvement) to claim federal R&D credits, with an election for qualified small businesses to offset up to $500k in payroll taxes.',
    eligibleTaxpayerType: 'Small businesses and technology firms with gross receipts < $5M and active technological development',
    taxObjective: 'Dollar-for-dollar tax credit offsetting regular corporate income tax or quarterly employer payroll taxes',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & Form 6765',
    requiredDocuments: [
      'W-2 payroll summaries itemizing technical staff and software engineering wages',
      '1099-NEC contractor invoices for US-based development services',
      'Cloud computing and server hosting invoices dedicated to development (AWS, Google Cloud)',
      'Project technical documentation proving the 4-Part IRS statutory test'
    ],
    workflowChecklist: [
      { id: 'rd1', step: 'Perform statutory Four-Part Test (Section 174 permitted purpose, technical uncertainty, process of experimentation, technological nature)', requiredRole: 'reviewer' },
      { id: 'rd2', step: 'Calculate Qualified Research Expenses (QREs) under ASC or Regular Credit methodologies', requiredRole: 'accountant' },
      { id: 'rd3', step: 'Verify Qualified Small Business (QSB) eligibility to elect Form 8974 payroll tax offset', requiredRole: 'reviewer' },
      { id: 'rd4', step: 'Reconcile Section 174 mandatory research expense amortization requirements', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Dollar-for-dollar tax credit typically yielding 6% to 10% of total qualified development expenditures',
      'Startups with no income tax liability can monetize up to $500,000 annually against employer FICA taxes',
      'Federal credit carries forward up to 20 years to shield future profitable operations'
    ],
    materialRisksAndLimitations: [
      'Section 174 requires domestic R&D costs to be amortized over 5 years rather than immediately expensed',
      'IRS requires robust contemporaneous documentation proving technical uncertainty existed at project inception',
      'Foreign research activities are strictly excluded'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 41 & § 174 - Credit for Increasing Research Activities',
      codeCitation: '26 U.S.C. §§ 41, 174; IRS Form 6765; Form 8974',
      url: 'https://www.irs.gov/forms-pubs/about-form-6765'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'Software companies, custom manufacturers, engineering consultants, and technical innovators investing in new product development.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-02-20', notes: 'Integrated Section 174 update guidance' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-18',
    version: '1.0.0'
  },

  // 14. State and Local Tax
  {
    id: 'strat_ptet_salt_workaround',
    strategyName: 'Pass-Through Entity Tax (PTET) State Tax Deduction Workaround',
    category: 'state_local_tax',
    plainLanguageSummary: 'Elect to pay South Carolina (and other non-resident state) income taxes at the partnership or S-Corporation level, creating an entity-level federal tax deduction that legally circumvents the $10,000 individual SALT cap.',
    eligibleTaxpayerType: 'S-Corporation and partnership owners residing in or operating pass-throughs in South Carolina and conforming states',
    taxObjective: 'Full federal deduction for state income taxes without limitation under IRS Notice 2020-75',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'South Carolina Department of Revenue (SC Code § 12-6-545) & Federal IRS',
    requiredDocuments: [
      'Pass-through entity tax returns (SC Form 1120S / SC 1065)',
      'SC Form I-388 (South Carolina Active Trade or Business Income tax computation)',
      'Estimated PTET payment vouchers and confirmation receipts'
    ],
    workflowChecklist: [
      { id: 'pt1', step: 'Audit owner individual tax profiles to confirm itemized SALT deductions exceed $10,000 cap', requiredRole: 'accountant' },
      { id: 'pt2', step: 'File annual timely South Carolina PTET election on SC Form 1120S or Form SC 1065', requiredRole: 'reviewer' },
      { id: 'pt3', step: 'Calculate 3.0% South Carolina active trade or business tax rate on qualified net income', requiredRole: 'accountant' },
      { id: 'pt4', step: 'Flow entity-level tax deduction through to Schedule K-1 to reduce federal adjusted gross income', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Deducts 100% of state income taxes paid on business profits directly on federal return Form 1120-S / Form 1065',
      'Saves up to 37% federal tax on all state tax dollars paid, with zero impact from the $10k personal SALT cap',
      'Provides South Carolina tax credit or exclusion to individual owners on their SC Form SC1040'
    ],
    materialRisksAndLimitations: [
      'Election must be formally filed by the statutory annual deadline or it is irrevocably waived for the tax year',
      'Multi-state owners must verify resident state credit conformity to prevent potential double-taxation'
    ],
    officialAuthority: {
      title: 'IRS Notice 2020-75 & South Carolina Code Ann. § 12-6-545',
      codeCitation: 'IRS Notice 2020-75; S.C. Code Ann. § 12-6-545(G); SC Revenue Ruling #21-15',
      url: 'https://dor.sc.gov/tax/business'
    },
    status: 'active',
    assignedProfessional: 'Desmond Hinds, CEO',
    clientSuitabilityAssessment: 'South Carolina pass-through business owners with net business income exceeding $150k paying high state income taxes.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-01-08', notes: 'Core South Carolina practice strategy' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-10-12',
    version: '1.0.0'
  },

  // 15. International or Cross-Border
  {
    id: 'strat_feie_ftc_optimization',
    strategyName: 'Foreign Earned Income Exclusion (FEIE) vs. Foreign Tax Credit (FTC) Analysis',
    category: 'international',
    plainLanguageSummary: 'Model and elect between IRC § 911 Foreign Earned Income Exclusion ($126,500+ statutory ceiling) and IRC § 901 Foreign Tax Credits to eliminate double taxation for US expatriates and global digital nomads.',
    eligibleTaxpayerType: 'US citizens and resident aliens living or working outside the United States',
    taxObjective: 'Eliminate US federal income tax on qualifying foreign compensation and foreign business earnings',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & Foreign Tax Authorities',
    requiredDocuments: [
      'Passport showing international entry/exit stamps and flight itineraries',
      'Foreign tax returns and certified foreign tax assessment payment receipts',
      'Foreign housing lease agreements and utility records',
      'Form 2555 and Form 1116 workpapers from prior years'
    ],
    workflowChecklist: [
      { id: 'in1', step: 'Perform statutory test: Physical Presence Test (330 full days in foreign country) or Bona Fide Residence Test', requiredRole: 'accountant' },
      { id: 'in2', step: 'Calculate allowable foreign housing exclusion or deduction under IRC § 911(c)', requiredRole: 'accountant' },
      { id: 'in3', step: 'Model FEIE vs. Form 1116 Foreign Tax Credit to preserve child tax credits and IRA contribution eligibility', requiredRole: 'reviewer' },
      { id: 'in4', step: 'Screen for mandatory FinCEN Form 114 (FBAR) and Form 8938 (FATCA) foreign account disclosures', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Excludes up to $126,500+ of foreign wage and self-employment earnings per qualifying taxpayer',
      'Additional exclusion for high-cost foreign housing expenses',
      'Prevents double taxation on income earned and taxed abroad'
    ],
    materialRisksAndLimitations: [
      'Electing FEIE revokes eligibility to make Roth or traditional IRA contributions on excluded income',
      'Revoking an active FEIE election bars re-electing without IRS consent for five consecutive tax years',
      'Self-employment tax still applies to US self-employed expatriates unless covered by a bilateral Totalization Agreement'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 911 & § 901 - Foreign Earned Income & Foreign Tax Credit',
      codeCitation: '26 U.S.C. §§ 911, 901; Form 2555 Instructions; IRS Publication 54',
      url: 'https://www.irs.gov/publications/p54'
    },
    status: 'active',
    assignedProfessional: 'Elena Rostova, CPA',
    clientSuitabilityAssessment: 'US professionals and consultants residing abroad or digital nomads with sustained overseas presence.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Elena Rostova, CPA', approvedDate: '2025-02-18', notes: 'International compliance guidelines verified' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-08',
    version: '1.0.0'
  },

  // 16. Year-End Planning
  {
    id: 'strat_tax_loss_harvesting',
    strategyName: 'Tax-Loss Harvesting & Wash-Sale Rule Defense Strategy',
    category: 'year_end_planning',
    plainLanguageSummary: 'Realize capital losses in taxable investment accounts prior to December 31 to offset short-term and long-term capital gains dollar-for-dollar, plus up to $3,000 of ordinary income, while navigating IRC § 1091 wash-sale rules.',
    eligibleTaxpayerType: 'Individual and corporate taxable brokerage account holders with unrealized capital losses',
    taxObjective: 'Neutralize taxable capital gains and defer investment tax liabilities into future periods',
    applicableTaxYear: '2025 / 2026',
    jurisdiction: 'Federal (IRS) & South Carolina DOR',
    requiredDocuments: [
      'Year-to-date realized gain/loss reports from all taxable brokerage accounts',
      'Unrealized loss position summaries and cost basis reports',
      'Transaction history for 30 days before and after target sale date across all household accounts'
    ],
    workflowChecklist: [
      { id: 'ye1', step: 'Identify lot-specific unrealized losses in taxable accounts prior to year-end closing', requiredRole: 'accountant' },
      { id: 'ye2', step: 'Coordinate purchase of non-substantially identical replacement assets to maintain market exposure', requiredRole: 'accountant' },
      { id: 'ye3', step: 'Perform strict 61-day wash-sale audit under IRC § 1091 across taxpayer, spouse, and IRA accounts', requiredRole: 'reviewer' },
      { id: 'ye4', step: 'Offset realized losses against short-term gains (taxed up to 37%) before long-term gains', requiredRole: 'reviewer' }
    ],
    potentialBenefits: [
      'Eliminates federal and state capital gains tax on realized profits',
      'Deducts up to $3,000 of excess net capital loss against high ordinary income annually',
      'Indefinite carryforward of remaining unused capital losses for future tax seasons'
    ],
    materialRisksAndLimitations: [
      'Purchasing substantially identical securities within 30 days before or after the loss sale disallows deduction under wash-sale rules',
      'Wash-sale repurchases in an IRA permanently eliminate the loss deduction without adjusting IRA basis'
    ],
    officialAuthority: {
      title: 'Internal Revenue Code § 1211 & § 1091 - Capital Losses & Loss from Wash Sales',
      codeCitation: '26 U.S.C. §§ 1211, 1091; IRS Publication 550',
      url: 'https://www.irs.gov/publications/p550'
    },
    status: 'active',
    assignedProfessional: 'Desmond Hinds, CEO',
    clientSuitabilityAssessment: 'Investors with significant realized capital gains from business exits, real estate sales, or stock portfolios.',
    professionalReviewRequirement: true,
    approvalHistory: [
      { version: '1.0.0', approvedBy: 'Desmond Hinds, CEO', approvedDate: '2025-01-28', notes: 'Year-end protocol re-certified' }
    ],
    expirationDate: '2026-12-31',
    lastReviewedDate: '2025-11-25',
    version: '1.0.0'
  }
];
