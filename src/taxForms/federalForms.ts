/**
 * Federal forms catalog. Official names and source pages were checked against irs.gov on
 * 2026-10-12 (official "About Form" page titles, or the parent form's official page where a
 * schedule has no page of its own). Entries that could not be confirmed are marked unverified.
 * Tax-year revisions are not verified per year: version history says so explicitly.
 */
import { capabilitiesFor } from './capabilities';
import type { EntityCategory, FederalForm, FormClassification, LibraryGroupId, SourceVerification } from './types';
import { CATALOG_TAX_YEARS } from './types';

const CHECKED_ON = '2026-10-12';
const IRS = 'https://www.irs.gov/forms-pubs/';
const VERIFIED: SourceVerification = { status: 'verified', method: 'Official IRS page fetched; form number and official name confirmed from the page title.', checkedOn: CHECKED_ON };
const ON_PARENT_WITH_NAME: SourceVerification = { status: 'verified', method: 'Listed with its official name on the parent form’s official IRS page.', checkedOn: CHECKED_ON };
const ON_PARENT_NUMBER_ONLY: SourceVerification = { status: 'partially_verified', method: 'Form number listed on the parent form’s official IRS page; official name taken from internal reference and not confirmed.', checkedOn: CHECKED_ON };
const UNVERIFIED = (why: string): SourceVerification => ({ status: 'unverified', method: why, checkedOn: CHECKED_ON });

function form(
  id: string, formNumber: string, officialName: string, groups: LibraryGroupId[], entityCategory: EntityCategory,
  classification: FormClassification, source: SourceVerification, url: string,
  schedules: string[], requiredDocuments: string[], notes?: string,
): FederalForm {
  return {
    id, formNumber, officialName, jurisdiction: 'FEDERAL', groups, entityCategory, classification,
    taxYears: [...CATALOG_TAX_YEARS],
    officialSourceUrl: url.startsWith('http') ? url : IRS + url,
    instructionsNote: 'Current form and instructions are linked from the official source page.',
    schedules, requiredDocuments, source,
    capabilities: capabilitiesFor(id),
    versionHistory: CATALOG_TAX_YEARS.map(year => ({
      taxYear: year, revision: null,
      note: source.status === 'unverified'
        ? 'Catalog entry; official source not confirmed.'
        : 'Cataloged; the year-specific revision has not been verified.',
    })),
    notes,
  };
}

const IND: LibraryGroupId = 'individual-1040';
const SUP: LibraryGroupId = 'credits-deductions-schedules';
const EXT: LibraryGroupId = 'extensions-amendments';
const INDIVIDUAL_DOCS = ['Prior-year return', 'Taxpayer and dependent identification', 'Forms W-2, 1099 and other income statements', 'Records of deductions, credits and estimated payments'];

export const FEDERAL_FORMS: FederalForm[] = [
  // 1. Individual income tax: Form 1040 family
  form('F-1040', '1040', 'U.S. Individual Income Tax Return', [IND], 'individual', 'original', VERIFIED, 'about-form-1040',
    ['Schedule 1', 'Schedule 2', 'Schedule 3', 'Schedule A', 'Schedule B', 'Schedule C', 'Schedule D', 'Schedule E', 'Schedule F', 'Schedule SE', 'Schedule 8812'], INDIVIDUAL_DOCS),
  form('F-1040-SR', '1040-SR', 'U.S. Tax Return for Seniors', [IND], 'individual', 'original', ON_PARENT_NUMBER_ONLY, 'about-form-1040',
    ['Same schedules as Form 1040'], INDIVIDUAL_DOCS, 'IRS describes Form 1040-SR as an optional alternative to Form 1040; it is listed on the Form 1040 page.'),
  form('F-1040-X', '1040-X', 'Amended U.S. Individual Income Tax Return', [IND, EXT], 'individual', 'amended', VERIFIED, 'about-form-1040x',
    ['Corrected schedules as applicable'], ['Original return as filed', 'Documents supporting each change']),
  form('F-SCH-1', 'Schedule 1 (Form 1040)', 'Additional Income and Adjustments to Income', [IND, SUP], 'individual', 'supporting', ON_PARENT_WITH_NAME, 'about-form-1040', [], ['Records of additional income and adjustments']),
  form('F-SCH-2', 'Schedule 2 (Form 1040)', 'Additional Taxes', [IND, SUP], 'individual', 'supporting', ON_PARENT_WITH_NAME, 'about-form-1040', [], ['Records of additional taxes (for example AMT, self-employment tax)']),
  form('F-SCH-3', 'Schedule 3 (Form 1040)', 'Additional Credits and Payments', [IND, SUP], 'individual', 'supporting', ON_PARENT_WITH_NAME, 'about-form-1040', [], ['Credit eligibility records and payment confirmations']),
  form('F-SCH-A', 'Schedule A (Form 1040)', 'Itemized Deductions', [IND, SUP], 'individual', 'supporting', VERIFIED, 'about-schedule-a-form-1040', [], ['Medical, tax, interest and charitable contribution records']),
  form('F-SCH-B', 'Schedule B (Form 1040)', 'Interest and Ordinary Dividends', [IND, SUP], 'individual', 'supporting', VERIFIED, 'about-schedule-b-form-1040', [], ['Forms 1099-INT and 1099-DIV', 'Foreign account information']),
  form('F-SCH-C', 'Schedule C (Form 1040)', 'Profit or Loss from Business (Sole Proprietorship)', [IND, SUP], 'individual', 'supporting', VERIFIED, 'about-schedule-c-form-1040', [], ['Business income and expense records', 'Forms 1099-NEC / 1099-K', 'Asset and depreciation records']),
  form('F-SCH-D', 'Schedule D (Form 1040)', 'Capital Gains and Losses', [IND, SUP], 'individual', 'supporting', VERIFIED, 'about-schedule-d-form-1040', ['Form 8949'], ['Brokerage statements (Form 1099-B)', 'Cost basis records']),
  form('F-SCH-E', 'Schedule E (Form 1040)', 'Supplemental Income and Loss', [IND, SUP], 'individual', 'supporting', VERIFIED, 'about-schedule-e-form-1040', [], ['Rental income and expense records', 'Schedules K-1 received']),
  form('F-SCH-F', 'Schedule F (Form 1040)', 'Profit or Loss From Farming', [IND, SUP], 'individual', 'supporting', VERIFIED, 'about-schedule-f-form-1040', [], ['Farm income and expense records']),
  form('F-SCH-SE', 'Schedule SE (Form 1040)', 'Self-Employment Tax', [IND, SUP], 'individual', 'supporting', VERIFIED, 'about-schedule-se-form-1040', [], ['Net self-employment earnings (Schedule C / F, partnership K-1)']),
  form('F-SCH-8812', 'Schedule 8812 (Form 1040)', 'Credits for Qualifying Children and Other Dependents', [IND, SUP], 'individual', 'supporting', VERIFIED, 'about-schedule-8812-form-1040', [], ['Dependent identification and residency records']),

  // 2. Estates and trusts: Form 1041
  form('F-1041', '1041', 'U.S. Income Tax Return for Estates and Trusts', ['estates-trusts-1041'], 'estate-trust', 'original', VERIFIED, 'about-form-1041',
    ['Schedule K-1 (Form 1041)', 'Schedule D (Form 1041)', 'Schedule I (Form 1041)', 'Schedule J (Form 1041)'], ['Trust or estate governing instrument', 'Fiduciary EIN', 'Income statements and fiduciary expense records', 'Distribution records']),
  form('F-K1-1041', 'Schedule K-1 (Form 1041)', 'Beneficiary’s Share of Income, Deductions, Credits, etc.', ['estates-trusts-1041', SUP], 'estate-trust', 'supporting', ON_PARENT_NUMBER_ONLY, 'about-form-1041', [], ['Beneficiary identification', 'Distribution and allocation records']),
  form('F-1041-ES', '1041-ES', 'Estimated Income Tax for Estates and Trusts', ['estates-trusts-1041'], 'estate-trust', 'estimated', VERIFIED, 'about-form-1041-es', [], ['Prior-year fiduciary return', 'Projected fiduciary income']),

  // 3. Partnerships: Form 1065
  form('F-1065', '1065', 'U.S. Return of Partnership Income', ['partnerships-1065'], 'partnership', 'original', VERIFIED, 'about-form-1065',
    ['Schedule K-1 (Form 1065)', 'Schedules K-2 and K-3 (Form 1065)', 'Schedule B-1', 'Schedule L', 'Schedule M-1', 'Schedule M-2', 'Schedule M-3'], ['Partnership agreement', 'Trial balance and financial statements', 'Partner capital account records', 'Prior-year return']),
  form('F-K1-1065', 'Schedule K-1 (Form 1065)', 'Partner’s Share of Income, Deductions, Credits, etc.', ['partnerships-1065', SUP], 'partnership', 'supporting', ON_PARENT_WITH_NAME, 'about-form-1065', [], ['Partner allocation percentages', 'Capital account analysis']),
  form('F-K2K3-1065', 'Schedules K-2 and K-3 (Form 1065)', 'Partners’ Distributive Share Items — International / Partner’s Share of Income, Deductions, Credits, etc. — International', ['partnerships-1065', 'international', SUP], 'partnership', 'supporting',
    UNVERIFIED('No official IRS page found at the addresses tried; confirm with the IRS before use.'), 'about-form-1065', [], ['Foreign-source income and partner international reporting records']),

  // 4. C corporations: Form 1120
  form('F-1120', '1120', 'U.S. Corporation Income Tax Return', ['c-corporations-1120'], 'c-corporation', 'original', VERIFIED, 'about-form-1120',
    ['Schedule C', 'Schedule J', 'Schedule K', 'Schedule L', 'Schedule M-1', 'Schedule M-2', 'Schedule M-3'], ['Trial balance and financial statements', 'Prior-year return', 'Estimated tax payment records', 'Depreciation schedules']),
  form('F-1120-X', '1120-X', 'Amended U.S. Corporation Income Tax Return', ['c-corporations-1120', EXT], 'c-corporation', 'amended', VERIFIED, 'about-form-1120-x', [], ['Original return as filed', 'Documents supporting each change']),
  form('F-1120-W', '1120-W', 'Estimated Tax for Corporations', ['c-corporations-1120'], 'c-corporation', 'estimated',
    UNVERIFIED('Official IRS page and PDF were not found at the expected addresses on the check date; confirm current availability with the IRS.'), 'about-form-1120', [], ['Projected corporate taxable income', 'Prior-year tax liability']),

  // 5. S corporations: Form 1120-S
  form('F-1120-S', '1120-S', 'U.S. Income Tax Return for an S Corporation', ['s-corporations-1120s'], 's-corporation', 'original', VERIFIED, 'about-form-1120-s',
    ['Schedule K-1 (Form 1120-S)', 'Schedules K-2 and K-3 (Form 1120-S)', 'Schedule B', 'Schedule L', 'Schedule M-1', 'Schedule M-2'], ['S election (Form 2553) acceptance', 'Trial balance and financial statements', 'Shareholder basis workpapers', 'Prior-year return']),
  form('F-K1-1120S', 'Schedule K-1 (Form 1120-S)', 'Shareholder’s Share of Income, Deductions, Credits, etc.', ['s-corporations-1120s', SUP], 's-corporation', 'supporting', VERIFIED, 'about-schedule-k-1-form-1120-s', [], ['Shareholder ownership percentages', 'Shareholder basis records']),

  // 6. Exempt organizations: Form 990 family
  form('F-990', '990', 'Return of Organization Exempt from Income Tax', ['nonprofits-990'], 'exempt-organization', 'original', VERIFIED, 'about-form-990',
    ['Schedule A (Form 990)', 'Schedule B (Form 990)', 'Schedules C–R as applicable'], ['IRS determination letter', 'Financial statements', 'Governance policies and board records', 'Compensation information']),
  form('F-990-EZ', '990-EZ', 'Short Form Return of Organization Exempt from Income Tax', ['nonprofits-990'], 'exempt-organization', 'original', VERIFIED, 'about-form-990-ez', ['Schedule A (Form 990)', 'Schedule B (Form 990)'], ['Financial statements', 'Governance records']),
  form('F-990-N', '990-N', 'e-Postcard (annual electronic filing requirement for small exempt organizations)', ['nonprofits-990'], 'exempt-organization', 'original', VERIFIED,
    'https://www.irs.gov/charities-non-profits/annual-electronic-filing-requirement-for-small-exempt-organizations-form-990-n-e-postcard', [], ['EIN, tax year, legal name, principal officer and gross receipts confirmation'],
    'Filed electronically on the IRS site; there is no paper form.'),
  form('F-990-PF', '990-PF', 'Return of Private Foundation or Section 4947(a)(1) Trust Treated as a Private Foundation', ['nonprofits-990'], 'exempt-organization', 'original', VERIFIED, 'about-form-990-pf', ['Schedule B (Form 990)'], ['Investment and grant records', 'Financial statements']),
  form('F-SCH-A-990', 'Schedule A (Form 990)', 'Public Charity Status and Public Support', ['nonprofits-990', SUP], 'exempt-organization', 'supporting', VERIFIED, 'about-schedule-a-form-990-or-990-ez', [], ['Public support records']),
  form('F-SCH-B-990', 'Schedule B (Form 990)', 'Schedule of Contributors', ['nonprofits-990', SUP], 'exempt-organization', 'supporting', VERIFIED, 'about-schedule-b-form-990-990-ez-or-990-pf', [], ['Contributor records']),
  form('F-8868', '8868', 'Application for Extension of Time To File an Exempt Organization Return or Excise Taxes Related to Employee Benefit Plans', ['nonprofits-990', EXT], 'exempt-organization', 'extension', VERIFIED, 'about-form-8868', [], ['Organization EIN and return type']),

  // 7. Estate tax: Form 706
  form('F-706', '706', 'United States Estate (and Generation-Skipping Transfer) Tax Return', ['estate-tax-706'], 'decedent-estate', 'original', VERIFIED, 'about-form-706',
    ['Schedules A–U as applicable', 'Schedule R (generation-skipping transfer)', 'Part 6 (portability of deceased spousal unused exclusion)'], ['Death certificate', 'Will and trust instruments', 'Asset appraisals and valuation reports', 'Prior gift tax returns (Form 709)', 'Debts and expense records']),
  form('F-4768', '4768', 'Application for Extension of Time To File a Return and/or Pay U.S. Estate (and Generation-Skipping Transfer) Taxes', ['estate-tax-706', EXT], 'decedent-estate', 'extension', VERIFIED, 'about-form-4768', [], ['Estate identification', 'Estimated estate tax']),

  // 8. Gift tax: Form 709
  form('F-709', '709', 'United States Gift (and Generation-Skipping Transfer) Tax Return', ['gift-tax-709'], 'donor', 'original', VERIFIED, 'about-form-709',
    ['Schedule A (gifts)', 'Schedule B (prior-period gifts)', 'Schedule C (DSUE)', 'Schedule D (generation-skipping transfer)'], ['Gift descriptions and dates', 'Valuations and appraisals', 'Prior Forms 709', 'Spouse gift-splitting consent']),

  // Dependents, deductions and credits
  form('F-2441', '2441', 'Child and Dependent Care Expenses', [SUP, IND], 'individual', 'supporting', VERIFIED, 'about-form-2441', [], ['Care provider name, address and taxpayer identification number', 'Amounts paid']),
  form('F-8863', '8863', 'Education Credits (American Opportunity and Lifetime Learning Credits)', [SUP, IND], 'individual', 'supporting', VERIFIED, 'about-form-8863', [], ['Form 1098-T', 'Qualified education expense records']),
  form('F-8889', '8889', 'Health Savings Accounts (HSAs)', [SUP, IND], 'individual', 'supporting', VERIFIED, 'about-form-8889', [], ['Forms 5498-SA and 1099-SA', 'HDHP coverage records']),
  form('F-8962', '8962', 'Premium Tax Credit', [SUP, IND], 'individual', 'supporting', VERIFIED, 'about-form-8962', [], ['Form 1095-A']),

  // Capital gains, property and tax calculations
  form('F-8949', '8949', 'Sales and other Dispositions of Capital Assets', [SUP, IND], 'any-taxpayer', 'supporting', VERIFIED, 'about-form-8949', [], ['Form 1099-B', 'Cost basis records']),
  form('F-4797', '4797', 'Sales of Business Property', [SUP], 'any-taxpayer', 'supporting', VERIFIED, 'about-form-4797', [], ['Business asset sale records', 'Depreciation history']),
  form('F-4562', '4562', 'Depreciation and Amortization (Including Information on Listed Property)', [SUP], 'any-taxpayer', 'supporting', VERIFIED, 'about-form-4562', [], ['Asset acquisition records', 'Listed property usage logs']),
  form('F-6251', '6251', 'Alternative Minimum Tax - Individuals', [SUP, IND], 'individual', 'supporting', VERIFIED, 'about-form-6251', [], ['AMT adjustment and preference item records']),

  // Payroll and employment
  form('F-941', '941', "Employer's Quarterly Federal Tax Return", ['payroll-employment'], 'employer', 'payroll', VERIFIED, 'about-form-941', ['Schedule B (Form 941)'], ['Payroll registers', 'Federal tax deposit records']),
  form('F-940', '940', "Employer's Annual Federal Unemployment (FUTA) Tax Return", ['payroll-employment'], 'employer', 'payroll', VERIFIED, 'about-form-940', ['Schedule A (Form 940)'], ['Annual payroll and state unemployment contribution records']),
  form('F-W-2', 'W-2', 'Wage and Tax Statement', ['payroll-employment', 'information-returns'], 'employer', 'information', VERIFIED, 'about-form-w-2', [], ['Employee wage and withholding records']),
  form('F-W-3', 'W-3', 'Transmittal of Wage and Tax Statements', ['payroll-employment', 'information-returns'], 'employer', 'information', VERIFIED, 'about-form-w-3', [], ['Totals of Forms W-2']),

  // Information returns
  form('F-1099-NEC', '1099-NEC', 'Nonemployee Compensation', ['information-returns'], 'payer', 'information', VERIFIED, 'about-form-1099-nec', [], ['Payee Form W-9', 'Payment records']),
  form('F-1099-MISC', '1099-MISC', 'Miscellaneous Information', ['information-returns'], 'payer', 'information', VERIFIED, 'about-form-1099-misc', [], ['Payee Form W-9', 'Payment records']),
  form('F-1099-INT', '1099-INT', 'Interest Income', ['information-returns'], 'payer', 'information', VERIFIED, 'about-form-1099-int', [], ['Interest payment records']),
  form('F-1099-DIV', '1099-DIV', 'Dividends and Distributions', ['information-returns'], 'payer', 'information', VERIFIED, 'about-form-1099-div', [], ['Dividend payment records']),
  form('F-1099-K', '1099-K', 'Payment Card and Third Party Network Transactions', ['information-returns'], 'payer', 'information', VERIFIED, 'about-form-1099-k', [], ['Payment settlement records']),

  // Estimated taxes
  form('F-1040-ES', '1040-ES', 'Estimated Tax for Individuals', [IND], 'individual', 'estimated', VERIFIED, 'about-form-1040-es', [], ['Prior-year return', 'Projected income']),

  // Extensions
  form('F-4868', '4868', 'Application for Automatic Extension of Time to File U.S. Individual Income Tax Return', [IND, EXT], 'individual', 'extension', VERIFIED, 'about-form-4868', [], ['Estimated tax liability and payments']),
  form('F-7004', '7004', 'Application for Automatic Extension of Time To File Certain Business Income Tax, Information, and Other Returns', [EXT, 'estates-trusts-1041', 'partnerships-1065', 'c-corporations-1120', 's-corporations-1120s'], 'any-taxpayer', 'extension', VERIFIED, 'about-form-7004', [], ['Entity EIN and return type', 'Estimated tax liability']),

  // International reporting
  form('F-1116', '1116', 'Foreign Tax Credit (Individual, Estate, or Trust)', ['international', SUP], 'individual', 'supporting', VERIFIED, 'about-form-1116', [], ['Foreign income and foreign tax paid records']),
  form('F-2555', '2555', 'Foreign Earned Income', ['international', SUP], 'individual', 'supporting', VERIFIED, 'about-form-2555', [], ['Foreign residence / presence records', 'Foreign earned income records']),
  form('F-5471', '5471', 'Information Return of U.S. Persons With Respect To Certain Foreign Corporations', ['international'], 'any-taxpayer', 'information', VERIFIED, 'about-form-5471', [], ['Foreign corporation financial statements and ownership records']),
  form('F-8938', '8938', 'Statement of Specified Foreign Financial Assets', ['international', SUP], 'individual', 'supporting', VERIFIED, 'about-form-8938', [], ['Foreign financial account and asset statements']),
  form('F-8865', '8865', 'Return of U.S. Persons With Respect to Certain Foreign Partnerships', ['international'], 'any-taxpayer', 'information', VERIFIED, 'about-form-8865', [], ['Foreign partnership financial statements and ownership records']),

  // Authorizations and electronic filing
  form('F-2848', '2848', 'Power of Attorney and Declaration of Representative', ['federal-authorizations'], 'any-taxpayer', 'authorization', VERIFIED, 'about-form-2848', [], ['Taxpayer signature', 'Representative credentials (CAF number)']),
  form('F-8821', '8821', 'Tax Information Authorization', ['federal-authorizations'], 'any-taxpayer', 'authorization', VERIFIED, 'about-form-8821', [], ['Taxpayer signature', 'Designee information']),
  form('F-8879', '8879', 'IRS e-file Signature Authorization', ['federal-authorizations'], 'individual', 'authorization', VERIFIED, 'about-form-8879', [], ['Completed return for review', 'Taxpayer signature (PIN)']),
];

/** The eight mandatory primary federal return categories. */
export const CORE_RETURN_CATEGORIES = [
  { id: 'individual-1040', title: 'Form 1040 — Individual Income Tax', primaryFormIds: ['F-1040', 'F-1040-SR', 'F-1040-X'], scope: 'Dependents, credits, deductions, investments, self-employment, rental income, farming and amended returns.' },
  { id: 'estates-trusts-1041', title: 'Form 1041 — Estates and Trusts', primaryFormIds: ['F-1041', 'F-K1-1041'], scope: 'Fiduciary income tax, beneficiary Schedule K-1, fiduciary schedules, allocations and extensions (Form 7004).' },
  { id: 'partnerships-1065', title: 'Form 1065 — Partnerships', primaryFormIds: ['F-1065', 'F-K1-1065'], scope: 'Partnership information returns, partner K-1, allocations, capital accounts, adjustments and state partnership filings.' },
  { id: 'c-corporations-1120', title: 'Form 1120 — C Corporations', primaryFormIds: ['F-1120', 'F-1120-X'], scope: 'Corporate returns, schedules, deductions, credits, estimated payments, extensions and state corporate / franchise tax.' },
  { id: 's-corporations-1120s', title: 'Form 1120-S — S Corporations', primaryFormIds: ['F-1120-S', 'F-K1-1120S'], scope: 'S corporation returns, shareholder K-1, allocations, basis workpapers, adjustments and state S corporation returns.' },
  { id: 'nonprofits-990', title: 'Form 990 — Nonprofit and Tax-Exempt Organizations', primaryFormIds: ['F-990', 'F-990-EZ', 'F-990-N', 'F-990-PF'], scope: 'Exempt-organization returns, schedules, governance disclosures and state charitable registration.' },
  { id: 'estate-tax-706', title: 'Form 706 — Federal Estate Tax', primaryFormIds: ['F-706'], scope: 'Estate tax return and schedules, valuation and deduction workpapers, GST reporting, portability; state estate / inheritance taxes are separate.' },
  { id: 'gift-tax-709', title: 'Form 709 — Federal Gift Tax', primaryFormIds: ['F-709'], scope: 'Gift and GST reporting, valuations, exclusions and lifetime exemption; state gift tax (Connecticut) is separate.' },
] as const;
