/**
 * State and local tax coverage for all 50 states and Washington, D.C.
 *
 * This catalogs which tax CATEGORIES apply in each jurisdiction; it deliberately does not list
 * state form numbers (none are asserted without verification, and no income tax return is
 * cataloged for a state without a general individual income tax). Applicability comes from
 * internal reference knowledge and is UNVERIFIED until confirmed with the revenue agency.
 * Agency sites were checked for reachability on 2026-10-12 (reachable / bot-protected /
 * unreachable from the development environment); reachability does not verify content.
 */
import type { Applicability, CategoryApplicability, StateJurisdiction, StateTaxCategoryId } from './types';

const CHECKED_ON = '2026-10-12';
type Check = StateJurisdiction['agencyCheck']['result'];
type Inc = 'yes' | 'no' | { limited: string; byYear?: Partial<Record<number, Applicability>> };
interface Spec {
  inc: Inc; corp: true | false | string; sales: true | false | string;
  estate?: true; inheritance?: true | { byYear: Partial<Record<number, Applicability>>; note: string }; gift?: true;
  franchise?: string; pte?: true; local?: string;
}

export const STATE_TAX_CATEGORIES: Array<{ id: StateTaxCategoryId; label: string }> = [
  { id: 'individual-income', label: 'Individual income tax (resident, nonresident, part-year)' },
  { id: 'individual-amended-extension-estimated', label: 'Individual amended returns, extensions and estimated payments' },
  { id: 'corporate-income', label: 'Corporate income tax' },
  { id: 's-corporation', label: 'S corporation tax' },
  { id: 'partnership', label: 'Partnership tax' },
  { id: 'pass-through-entity', label: 'Pass-through entity elections, returns and payments' },
  { id: 'franchise-gross-receipts', label: 'Franchise, gross receipts and business privilege taxes' },
  { id: 'sales-use', label: 'Sales and use tax' },
  { id: 'employer-withholding', label: 'Employer withholding' },
  { id: 'unemployment-insurance', label: 'State unemployment insurance reporting' },
  { id: 'fiduciary-income', label: 'Estate and trust fiduciary income tax' },
  { id: 'estate-tax', label: 'State estate tax' },
  { id: 'inheritance-tax', label: 'State inheritance tax' },
  { id: 'gift-tax', label: 'State gift tax' },
  { id: 'local-taxes', label: 'Local city, county, school district and other taxes' },
];

function categories(s: Spec): Record<StateTaxCategoryId, CategoryApplicability> {
  const incomeTax: CategoryApplicability = s.inc === 'yes' ? { applicability: 'applies' }
    : s.inc === 'no' ? { applicability: 'does-not-apply', note: 'No general individual income tax; no individual income tax return is cataloged.' }
    : { applicability: 'limited', note: s.inc.limited, byYear: s.inc.byYear };
  const generalIncomeTax = s.inc === 'yes';
  const cat = (applicability: Applicability, note?: string): CategoryApplicability => ({ applicability, ...(note ? { note } : {}) });
  return {
    'individual-income': incomeTax,
    'individual-amended-extension-estimated': generalIncomeTax ? cat('applies') : { ...incomeTax },
    'corporate-income': s.corp === true ? cat('applies') : s.corp === false ? cat('does-not-apply', 'No corporate income tax.') : cat('limited', s.corp),
    's-corporation': generalIncomeTax ? cat('applies', 'S corporation / pass-through filing generally required; confirm entity-level taxes.')
      : s.franchise ? cat('limited', `No income tax return; entity-level tax may apply: ${s.franchise}.`) : cat('does-not-apply'),
    'partnership': generalIncomeTax ? cat('applies', 'Partnership return / composite filing generally required; confirm.')
      : s.franchise ? cat('limited', `No income tax return; entity-level tax may apply: ${s.franchise}.`) : cat('does-not-apply'),
    'pass-through-entity': !generalIncomeTax ? cat('does-not-apply', 'No individual income tax to offset.')
      : s.pte ? cat('applies', 'Elective pass-through entity tax regime reported; confirm current-year availability.') : cat('not-confirmed', 'No elective PTE regime confirmed in reference data.'),
    'franchise-gross-receipts': s.franchise ? cat('applies', s.franchise) : cat('not-confirmed'),
    'sales-use': s.sales === true ? cat('applies') : s.sales === false ? cat('does-not-apply', 'No statewide sales tax.') : cat('limited', s.sales),
    'employer-withholding': generalIncomeTax ? cat('applies') : cat('does-not-apply', 'No state income tax withholding on wages.'),
    'unemployment-insurance': cat('applies', 'Administered by the state workforce / labor agency.'),
    'fiduciary-income': generalIncomeTax ? cat('applies') : { ...incomeTax, note: incomeTax.note ? `Fiduciary: ${incomeTax.note}` : undefined },
    'estate-tax': s.estate ? cat('applies') : cat('does-not-apply'),
    'inheritance-tax': s.inheritance === true ? cat('applies')
      : s.inheritance ? { applicability: 'does-not-apply', note: s.inheritance.note, byYear: s.inheritance.byYear } : cat('does-not-apply'),
    'gift-tax': s.gift ? cat('applies') : cat('does-not-apply'),
    'local-taxes': s.local ? cat('applies', s.local) : cat('not-confirmed', 'Local sales or property taxes may apply; no local income tax noted in reference data.'),
  };
}

function j(code: string, name: string, agencyName: string, agencyUrl: string, check: Check, spec: Spec): StateJurisdiction {
  return {
    code, name, agencyName, agencyUrl,
    agencyCheck: { result: check, checkedOn: CHECKED_ON },
    categories: categories(spec),
    verification: { status: 'unverified', method: 'Applicability from internal reference; confirm with the revenue agency before relying on it.', checkedOn: null },
  };
}

const R: Check = 'reachable', B: Check = 'bot-protected', U: Check = 'unreachable-from-environment';
export const STATE_JURISDICTIONS: StateJurisdiction[] = [
  j('AL', 'Alabama', 'Alabama Department of Revenue', 'https://www.revenue.alabama.gov/', R, { inc: 'yes', corp: true, sales: true, franchise: 'Business privilege tax', pte: true, local: 'Municipal occupational license taxes (some cities); local sales taxes' }),
  j('AK', 'Alaska', 'Alaska Department of Revenue, Tax Division', 'https://tax.alaska.gov/', R, { inc: 'no', corp: true, sales: 'No statewide sales tax; some boroughs and cities levy local sales taxes', local: 'Borough and municipal sales and property taxes' }),
  j('AZ', 'Arizona', 'Arizona Department of Revenue', 'https://azdor.gov/', B, { inc: 'yes', corp: true, sales: 'Transaction privilege tax (TPT) rather than a traditional sales tax', pte: true, local: 'City transaction privilege taxes' }),
  j('AR', 'Arkansas', 'Arkansas Department of Finance and Administration', 'https://www.dfa.arkansas.gov/', U, { inc: 'yes', corp: true, sales: true, franchise: 'Franchise tax', pte: true, local: 'Local sales taxes' }),
  j('CA', 'California', 'Franchise Tax Board', 'https://www.ftb.ca.gov/', R, { inc: 'yes', corp: true, sales: true, franchise: 'Corporate franchise tax, S corporation tax and LLC fee', pte: true, local: 'City business license / gross receipts taxes; local sales taxes' }),
  j('CO', 'Colorado', 'Colorado Department of Revenue, Taxation Division', 'https://tax.colorado.gov/', B, { inc: 'yes', corp: true, sales: true, pte: true, local: 'Occupational privilege taxes (some cities); home-rule city sales taxes' }),
  j('CT', 'Connecticut', 'Department of Revenue Services', 'https://portal.ct.gov/drs', U, { inc: 'yes', corp: true, sales: true, estate: true, gift: true, pte: true }),
  j('DE', 'Delaware', 'Division of Revenue', 'https://revenue.delaware.gov/', R, { inc: 'yes', corp: true, sales: false, franchise: 'Franchise tax and gross receipts tax', local: 'Wilmington earned income tax' }),
  j('DC', 'Washington, D.C.', 'Office of Tax and Revenue', 'https://otr.cfo.dc.gov/', R, { inc: 'yes', corp: 'Corporation franchise tax (income-based)', sales: true, estate: true, franchise: 'Unincorporated business franchise tax', local: 'D.C. is itself the local taxing jurisdiction' }),
  j('FL', 'Florida', 'Florida Department of Revenue', 'https://floridarevenue.com/', U, { inc: 'no', corp: true, sales: true, local: 'Discretionary sales surtaxes; local business tax receipts' }),
  j('GA', 'Georgia', 'Georgia Department of Revenue', 'https://dor.georgia.gov/', U, { inc: 'yes', corp: true, sales: true, franchise: 'Corporate net worth tax', pte: true, local: 'Local sales taxes' }),
  j('HI', 'Hawaii', 'Hawaii Department of Taxation', 'https://tax.hawaii.gov/', R, { inc: 'yes', corp: true, sales: 'General excise tax (GET) on business gross income rather than a retail sales tax', estate: true, pte: true, local: 'County general excise tax surcharges' }),
  j('ID', 'Idaho', 'Idaho State Tax Commission', 'https://tax.idaho.gov/', U, { inc: 'yes', corp: true, sales: true, pte: true, local: 'Resort city local option taxes' }),
  j('IL', 'Illinois', 'Illinois Department of Revenue', 'https://tax.illinois.gov/', U, { inc: 'yes', corp: true, sales: true, estate: true, franchise: 'Personal property replacement income tax', pte: true, local: 'Local sales taxes; Chicago-specific taxes' }),
  j('IN', 'Indiana', 'Indiana Department of Revenue', 'https://www.in.gov/dor/', U, { inc: 'yes', corp: true, sales: true, pte: true, local: 'County local income taxes' }),
  j('IA', 'Iowa', 'Iowa Department of Revenue', 'https://revenue.iowa.gov/', R, { inc: 'yes', corp: true, sales: true, pte: true,
    inheritance: { note: 'Inheritance tax phased out; applies to deaths before January 1, 2025.', byYear: { 2022: 'applies', 2023: 'applies', 2024: 'applies', 2025: 'does-not-apply' } },
    local: 'School district income surtax; local option sales taxes' }),
  j('KS', 'Kansas', 'Kansas Department of Revenue', 'https://www.ksrevenue.gov/', U, { inc: 'yes', corp: true, sales: true, pte: true, local: 'Local sales taxes' }),
  j('KY', 'Kentucky', 'Kentucky Department of Revenue', 'https://revenue.ky.gov/', R, { inc: 'yes', corp: true, sales: true, inheritance: true, franchise: 'Limited liability entity tax (LLET)', pte: true, local: 'City and county occupational license taxes' }),
  j('LA', 'Louisiana', 'Louisiana Department of Revenue', 'https://revenue.louisiana.gov/', R, { inc: 'yes', corp: true, sales: true, franchise: 'Corporation franchise tax', pte: true, local: 'Parish sales taxes' }),
  j('ME', 'Maine', 'Maine Revenue Services', 'https://www.maine.gov/revenue/', R, { inc: 'yes', corp: true, sales: true, estate: true }),
  j('MD', 'Maryland', 'Comptroller of Maryland', 'https://www.marylandtaxes.gov/', R, { inc: 'yes', corp: true, sales: true, estate: true, inheritance: true, pte: true, local: 'County (local) income taxes' }),
  j('MA', 'Massachusetts', 'Massachusetts Department of Revenue', 'https://www.mass.gov/orgs/massachusetts-department-of-revenue', R, { inc: 'yes', corp: 'Corporate excise (income and non-income measures)', sales: true, estate: true, pte: true, local: 'Local option meals and room occupancy taxes' }),
  j('MI', 'Michigan', 'Michigan Department of Treasury', 'https://www.michigan.gov/taxes', R, { inc: 'yes', corp: true, sales: true, pte: true, local: 'City income taxes (for example Detroit)' }),
  j('MN', 'Minnesota', 'Minnesota Department of Revenue', 'https://www.revenue.state.mn.us/', R, { inc: 'yes', corp: 'Corporation franchise tax (income-based)', sales: true, estate: true, pte: true, local: 'Local sales taxes' }),
  j('MS', 'Mississippi', 'Mississippi Department of Revenue', 'https://www.dor.ms.gov/', R, { inc: 'yes', corp: true, sales: true, franchise: 'Franchise tax', pte: true, local: 'Local sales and tourism taxes' }),
  j('MO', 'Missouri', 'Missouri Department of Revenue', 'https://dor.mo.gov/', B, { inc: 'yes', corp: true, sales: true, pte: true, local: 'Kansas City and St. Louis earnings taxes; local sales taxes' }),
  j('MT', 'Montana', 'Montana Department of Revenue', 'https://mtrevenue.gov/', R, { inc: 'yes', corp: true, sales: false, pte: true, local: 'Resort area local option taxes' }),
  j('NE', 'Nebraska', 'Nebraska Department of Revenue', 'https://revenue.nebraska.gov/', U, { inc: 'yes', corp: true, sales: true, inheritance: true, pte: true, local: 'Local sales taxes; county-administered inheritance tax' }),
  j('NV', 'Nevada', 'Nevada Department of Taxation', 'https://tax.nv.gov/', R, { inc: 'no', corp: false, sales: true, franchise: 'Commerce tax (gross revenue) and modified business tax (payroll)', local: 'Local sales taxes' }),
  j('NH', 'New Hampshire', 'New Hampshire Department of Revenue Administration', 'https://www.revenue.nh.gov/', R, {
    inc: { limited: 'No tax on wages. Interest and dividends tax repealed for tax periods beginning after December 31, 2024.', byYear: { 2022: 'limited', 2023: 'limited', 2024: 'limited', 2025: 'does-not-apply' } },
    corp: 'Business profits tax', sales: 'No general sales tax; meals and rooms tax applies', franchise: 'Business enterprise tax' }),
  j('NJ', 'New Jersey', 'New Jersey Division of Taxation', 'https://www.nj.gov/treasury/taxation/', R, { inc: 'yes', corp: 'Corporation business tax', sales: true, inheritance: true, pte: true, local: 'Newark payroll tax' }),
  j('NM', 'New Mexico', 'New Mexico Taxation and Revenue Department', 'https://www.tax.newmexico.gov/', R, { inc: 'yes', corp: true, sales: 'Gross receipts tax rather than a traditional sales tax', pte: true, local: 'Local gross receipts tax increments' }),
  j('NY', 'New York', 'New York State Department of Taxation and Finance', 'https://www.tax.ny.gov/', R, { inc: 'yes', corp: true, sales: true, estate: true, pte: true, local: 'New York City and Yonkers income taxes; MCTMT; local sales taxes' }),
  j('NC', 'North Carolina', 'North Carolina Department of Revenue', 'https://www.ncdor.gov/', R, { inc: 'yes', corp: true, sales: true, franchise: 'Franchise tax', pte: true, local: 'County sales taxes' }),
  j('ND', 'North Dakota', 'North Dakota Office of State Tax Commissioner', 'https://www.tax.nd.gov/', R, { inc: 'yes', corp: true, sales: true, local: 'City sales taxes' }),
  j('OH', 'Ohio', 'Ohio Department of Taxation', 'https://tax.ohio.gov/', B, { inc: 'yes', corp: false, sales: true, franchise: 'Commercial activity tax (CAT)', pte: true, local: 'Municipal income taxes and school district income taxes' }),
  j('OK', 'Oklahoma', 'Oklahoma Tax Commission', 'https://oklahoma.gov/tax.html', R, { inc: 'yes', corp: true, sales: true, pte: true, local: 'Local sales taxes' }),
  j('OR', 'Oregon', 'Oregon Department of Revenue', 'https://www.oregon.gov/dor/', R, { inc: 'yes', corp: 'Corporation excise / income tax', sales: false, estate: true, franchise: 'Corporate activity tax (CAT)', pte: true, local: 'Portland Metro supportive housing services tax, Multnomah County preschool for all tax, transit payroll taxes' }),
  j('PA', 'Pennsylvania', 'Pennsylvania Department of Revenue', 'https://www.revenue.pa.gov/', R, { inc: 'yes', corp: 'Corporate net income tax', sales: true, inheritance: true, local: 'Local earned income taxes and local services tax; Philadelphia wage tax and business income and receipts tax' }),
  j('RI', 'Rhode Island', 'Rhode Island Division of Taxation', 'https://tax.ri.gov/', B, { inc: 'yes', corp: true, sales: true, estate: true, pte: true }),
  j('SC', 'South Carolina', 'South Carolina Department of Revenue', 'https://dor.sc.gov/', R, { inc: 'yes', corp: true, sales: true, franchise: 'Corporate license fee', pte: true, local: 'Local option sales taxes' }),
  j('SD', 'South Dakota', 'South Dakota Department of Revenue', 'https://dor.sd.gov/', R, { inc: 'no', corp: 'No general corporate income tax; bank franchise tax applies to financial institutions', sales: true, local: 'Municipal sales taxes' }),
  j('TN', 'Tennessee', 'Tennessee Department of Revenue', 'https://www.tn.gov/revenue.html', U, { inc: 'no', corp: 'Excise tax on net earnings (franchise and excise tax)', sales: true, franchise: 'Franchise tax (net worth) and business tax', local: 'Local sales taxes and local business tax' }),
  j('TX', 'Texas', 'Texas Comptroller of Public Accounts', 'https://comptroller.texas.gov/', R, { inc: 'no', corp: false, sales: true, franchise: 'Franchise (margin) tax', local: 'Local sales taxes' }),
  j('UT', 'Utah', 'Utah State Tax Commission', 'https://tax.utah.gov/', B, { inc: 'yes', corp: true, sales: true, pte: true, local: 'Local sales taxes' }),
  j('VT', 'Vermont', 'Vermont Department of Taxes', 'https://tax.vermont.gov/', R, { inc: 'yes', corp: true, sales: true, estate: true, local: 'Local option sales, meals and rooms taxes' }),
  j('VA', 'Virginia', 'Virginia Department of Taxation', 'https://www.tax.virginia.gov/', R, { inc: 'yes', corp: true, sales: true, pte: true, local: 'Business, professional and occupational license (BPOL) taxes; local sales taxes' }),
  j('WA', 'Washington', 'Washington State Department of Revenue', 'https://dor.wa.gov/', R, {
    inc: { limited: 'No general income tax; a capital gains excise tax applies to certain long-term capital gains of individuals (from 2022).' },
    corp: false, sales: true, estate: true, franchise: 'Business and occupation (B&O) tax', local: 'City B&O taxes; local sales taxes' }),
  j('WV', 'West Virginia', 'West Virginia Tax Division', 'https://tax.wv.gov/', R, { inc: 'yes', corp: true, sales: true, pte: true, local: 'Municipal B&O taxes and city service fees' }),
  j('WI', 'Wisconsin', 'Wisconsin Department of Revenue', 'https://www.revenue.wi.gov/', R, { inc: 'yes', corp: 'Corporate franchise / income tax', sales: true, pte: true, local: 'County and stadium sales taxes' }),
  j('WY', 'Wyoming', 'Wyoming Department of Revenue', 'https://revenue.wyo.gov/', R, { inc: 'no', corp: false, sales: true, local: 'Local option sales taxes' }),
];

/** Year-aware applicability for a category. */
export function applicabilityFor(state: StateJurisdiction, category: StateTaxCategoryId, taxYear: number): Applicability {
  const c = state.categories[category];
  return c.byYear?.[taxYear] ?? c.applicability;
}
