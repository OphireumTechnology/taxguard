/**
 * A/R Accounting Guidance Assistant Knowledge Engine
 * 
 * Strict Educational Scope:
 * - U.S. Federal & State Taxation
 * - U.S. Bookkeeping & Monthly Close
 * - U.S. Payroll Accounting
 * - U.S. Financial Reporting & Entity Structures
 * - IRS & State Department of Revenue Compliance
 * 
 * Strict Guardrails:
 * - Refuses non-U.S. tax advice (e.g., Philippine BIR)
 * - Refuses illegal conduct (tax evasion, hiding income, fabricating records, falsifying deductions)
 * - Refuses unauthorized private data access
 * - Refuses investment/crypto trading advice, legal representation, immigration, or medical advice
 */

export interface SourceReference {
  authority: string;
  documentTitle: string;
  citationUrl?: string;
  relevance: string;
}

export interface AssistantResponse {
  answer: string;
  sources: SourceReference[];
  refusal?: boolean;
}

export interface AssistantContext {
  taxYear: '2025' | '2024' | '2023';
  jurisdiction: string;
  profile: 'individual' | 'business' | 'self_employed';
}

export const MANDATORY_REFUSAL_MESSAGE = 
  "The A/R Accounting Guidance Assistant is limited to general U.S. accounting and tax education. It cannot assist with tax evasion, fabricated records, unauthorized access, non-U.S. tax matters, or professional services outside this scope.";

// Guardrail violation patterns
const GUARDRAIL_PATTERNS = [
  // Tax evasion, fraud, false documents
  /\b(evade|evasion|hide\s+income|underreport|fake\s+receipt|fabricat(e|ed|ion)|falsif(y|ied)|offshore\s+shell\s+to\s+hide|launder|cheat\s+on\s+taxes|dodge\s+taxes)\b/i,
  // Other taxpayer private information
  /\b(lookup|search|steal|hack|find)\s+(someone\s+else's|another\s+person's|taxpayer's)\s+(ssn|social\s+security|return|private\s+record|bank\s+account)\b/i,
  // Philippine BIR or non-U.S. tax queries
  /\b(bir|philippine\s+tax|philippines\s+internal\s+revenue|tin\s+philippines|2316|2550m|2551q|pag-ibig|philhealth|sss\s+philippines|uk\s+hmrc|canada\s+cra|australia\s+ato)\b/i,
  // Crypto trading speculation / investment advice
  /\b(which\s+(crypto|coin|stock|token)\s+should\s+i\s+buy|trading\s+strategy|leverage\s+trade|guaranteed\s+returns|pump\s+and\s+dump|stock\s+pick)\b/i,
  // Legal representation / unauthorized practice of law
  /\b(represent\s+me\s+in\s+court|sue\s+my\s+partner|divorce\s+attorney\s+advice|custody\s+dispute|criminal\s+defense)\b/i,
  // Medical / Immigration
  /\b(medical\s+diagnosis|prescribe|visa\s+petition|green\s+card\s+interview\s+defense|asylum\s+claim)\b/i
];

/**
 * Checks if an inquiry violates system guardrails
 */
export function checkGuardrails(prompt: string): boolean {
  return GUARDRAIL_PATTERNS.some(pattern => pattern.test(prompt));
}

export const SUGGESTED_QUESTIONS = [
  "What documents are commonly needed for an individual tax return?",
  "What is the difference between bookkeeping and tax preparation?",
  "How does an S corporation generally report income?",
  "What records should a small business retain?",
  "What is bank reconciliation?",
  "What are estimated tax payments?",
  "What happens after a tax return is electronically submitted?",
  "How should I respond to an IRS notice?",
  "What is the difference between Form 1099 and Form W-2?",
  "What information is needed for Schedule C?"
];

/**
 * Curated knowledge base for common educational topics
 */
const KNOWLEDGE_BASE: Record<string, AssistantResponse> = {
  documents_individual: {
    answer: `### Commonly Required Documentation for U.S. Individual Income Tax Returns (Form 1040)

To ensure accurate reporting and compliance with the Internal Revenue Code (IRC), individuals generally need to assemble information across three primary categories: Identification, Income Documentation, and Substantiating Deductions/Credits.

#### 1. Identification & Household Verification
* **Social Security Cards or ITIN Letters**: For the taxpayer, spouse, and all claimed dependents.
* **Government-Issued Photo ID**: Driver's license or passport (required by states and IRS e-file fraud protection protocols).
* **Prior Year Tax Return**: Form 1040 from the preceding tax year (critical for Adjusted Gross Income [AGI] verification when e-filing).

#### 2. Income Statements (Information Returns)
* **Form W-2**: Wage and Tax Statement from each employer.
* **Form 1099-NEC & 1099-K**: Nonemployee compensation from freelance, contract, or gig work.
* **Form 1099-INT & 1099-DIV**: Interest and dividend income from financial institutions and brokerages.
* **Form 1099-B**: Proceeds from broker and barter transactions (accompanied by cost-basis records).
* **Form 1099-MISC**: Rent, royalties, prizes, or other miscellaneous income.
* **Form 1099-R**: Distributions from pensions, annuities, retirement accounts, or IRAs.
* **Form 1099-G**: Government payments, including state tax refunds or unemployment compensation.
* **Schedule K-1 (Form 1065 / Form 1120-S / Form 1041)**: Distributive share of partnership, S-corporation, or estate/trust income.

#### 3. Expense Substantiation & Adjustments
* **Form 1098**: Mortgage Interest Statement and real estate property tax payments.
* **Form 1098-E / 1098-T**: Student loan interest paid and tuition statements for education credits.
* **Charitable Contributions**: Written contemporaneous acknowledgments from 501(c)(3) organizations for gifts of $250 or more.
* **Medical & Dental Expenses**: Detailed log of unreimbursed out-of-pocket costs exceeding 7.5% of AGI.
* **Health Coverage Documentation**: Form 1095-A (Health Insurance Marketplace Statement) for reconciling Advance Premium Tax Credits.
* **Estimated Tax Payment Records**: Dates and confirmation numbers for quarterly payments made to the IRS (Form 1040-ES) and state departments of revenue.`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "IRS Publication 17: Your Federal Income Tax For Individuals", citationUrl: "https://www.irs.gov/forms-pubs/about-publication-17", relevance: "Defines substantiation rules and filing requirements for Form 1040." },
      { authority: "IRS.gov", documentTitle: "Topic No. 305: Recordkeeping Requirements", citationUrl: "https://www.irs.gov/taxtopics/tc305", relevance: "Official guidance on maintaining records to substantiate items reported on income tax returns." }
    ]
  },

  difference_bookkeeping_tax: {
    answer: `### The Distinction Between Bookkeeping and Tax Preparation

While bookkeeping and tax preparation are complementary components of financial operations in the United States, they serve fundamentally distinct purposes and operate under different frameworks.

| Dimension | Bookkeeping & Monthly Close | Tax Preparation & Compliance |
| :--- | :--- | :--- |
| **Primary Focus** | Ongoing, chronological capture and reconciliation of economic events. | Annual statutory compliance, tax liability computation, and return preparation. |
| **Governing Standard** | Generally Accepted Accounting Principles (U.S. GAAP) or Cash Basis Framework. | Internal Revenue Code (IRC) and State Revenue & Taxation Codes. |
| **Frequency** | Daily, weekly, monthly, and quarterly reconciliation cycles. | Annual filings with quarterly estimated computations (e.g., Form 1040-ES, Form 1120-W). |
| **Core Deliverables** | Balance Sheet, Profit & Loss Statement, General Ledger, Bank Reconciliation reports. | Form 1040, Form 1120-S, Form 1065, Schedule C, State Returns, and supporting tax schedules. |
| **Objective** | Measuring real-world cash flow, tracking operational solvency, and business decision-making. | Accurately reporting taxable income, claiming allowable credits, and mitigating penalty exposure. |

#### Key Operational Interaction:
Clean, disciplined bookkeeping is the foundational prerequisite for efficient tax preparation. Without reconciled bank statements and verified chart-of-accounts classifications, tax preparation requires extensive backward-looking adjustments (such as book-to-tax Schedule M-1 reconciliations) to account for non-deductible expenses (e.g., 50% meals limitations, fines, entertainment expenses).`,
    sources: [
      { authority: "Financial Accounting Standards Board (FASB)", documentTitle: "FASB Accounting Standards Codification (ASC)", relevance: "Establishes authoritative standards for financial recordkeeping and reporting." },
      { authority: "IRS.gov", documentTitle: "IRS Publication 583: Starting a Business and Keeping Records", citationUrl: "https://www.irs.gov/forms-pubs/about-publication-583", relevance: "Explains the necessity of orderly bookkeeping as the basis for preparing federal tax returns." }
    ]
  },

  scorp_reporting: {
    answer: `### How an S Corporation Reports Income Under U.S. Federal Tax Law

An S corporation is an eligible domestic corporation that elects under **Subchapter S of the Internal Revenue Code (IRC § 1362)** to pass corporate income, losses, deductions, and credits through to its shareholders for federal tax purposes.

#### 1. The Information Return: Form 1120-S
* The S corporation itself is generally a **pass-through entity** and does not pay federal income tax at the entity level (subject to exceptions like built-in gains tax or passive investment income tax under IRC § 1374 and § 1375).
* The entity must file **Form 1120-S (U.S. Income Tax Return for an S Corporation)** annually, generally by the 15th day of the 3rd month following the close of the tax year (**March 15** for calendar-year filers).

#### 2. Schedule K and Schedule K-1
* **Schedule K**: A summary schedule of all shareholders' total shares of the corporation's income, deductions, and credits.
* **Schedule K-1 (Form 1120-S)**: Prepared for each individual shareholder, detailing their pro-rata percentage share of:
  * Ordinary business income (or loss)
  * Net rental real estate income
  * Interest, dividend, and royalty income
  * Net capital gains (short-term and long-term)
  * Section 179 expense deductions
  * Charitable contributions
  * Foreign transactions and alternative minimum tax (AMT) items

#### 3. Shareholder Reporting (Form 1040)
* Each shareholder imports the figures from their Schedule K-1 onto their personal **Form 1040, Schedule E (Part II)**.
* Pass-through income is taxed at the shareholder's individual marginal income tax rate.
* **Crucial Rule on Reasonable Compensation**: Shareholder-employees who perform more than minor services for the S corporation must be paid **reasonable compensation via Form W-2**, subject to FICA payroll taxes (Social Security & Medicare), before taking non-dividend distributions of profits.`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "Instructions for Form 1120-S: U.S. Income Tax Return for an S Corporation", citationUrl: "https://www.irs.gov/forms-pubs/about-form-1120-s", relevance: "Authoritative instructions governing S corporation tax return preparation." },
      { authority: "U.S. Department of the Treasury", documentTitle: "Treasury Regulations § 1.1366-1", relevance: "Governs the pass-through of items to shareholders of an S corporation." },
      { authority: "IRS.gov", documentTitle: "Wage Compensation for S Corporation Officers", citationUrl: "https://www.irs.gov/businesses/small-businesses-self-employed/s-corporation-compensation-and-medical-insurance-issues", relevance: "Outlines reasonable compensation requirements under IRC § 3121." }
    ]
  },

  records_retention: {
    answer: `### Record Retention Guidelines for U.S. Small Businesses

Under U.S. federal and state tax guidelines, small business owners must retain all documentation that supports items of income, deduction, or credit on their tax returns until the period of limitations for that return expires.

#### 1. Three-Year Rule (Standard IRS Audit Window)
* **Scope**: Keep receipts, invoices, canceled checks, mileage logs, bank statements, and general business correspondence for at least **3 years** from the date the return was filed, or 2 years from when tax was paid (whichever is later) under IRC § 6501(a).

#### 2. Six-Year Rule (Substantial Omission of Income)
* **Scope**: Keep records for at least **6 years** if gross income omitted from the return exceeds 25% of the total reported gross income under IRC § 6501(e).

#### 3. Four-Year Rule (Employment & Payroll Tax Records)
* **Scope**: Under IRS and Department of Labor regulations, retain all employment tax records for at least **4 years** after the date the tax becomes due or is paid.
* **Items**: Employer identification numbers, amounts/dates of wage payments, withholdings (Federal income tax, FICA, FUTA), and copies of Form 941, Form 940, and Form W-2/W-3.

#### 4. Indefinite / Permanent Retention
* **Asset & Property Records**: Retain purchase agreements, depreciation schedules (Form 4562), and capital improvement invoices until the period of limitations expires for the year in which the asset is sold, exchanged, or liquidated, in order to substantiate cost basis (IRC § 1012).
* **Corporate Governance**: Articles of Incorporation/Organization, Operating Agreements, Bylaws, Board Minutes, Tax Exemption Determination Letters, and Filed Federal/State Returns should be kept permanently.
* **Fraud or Non-Filing**: If no return was filed, or if a false/fraudulent return was filed, there is **no statute of limitations** (IRC § 6501(c)).`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "IRS Publication 583: Starting a Business and Keeping Records", citationUrl: "https://www.irs.gov/forms-pubs/about-publication-583", relevance: "Official IRS timeline for keeping books and records." },
      { authority: "Congress.gov", documentTitle: "Internal Revenue Code § 6501: Limitations on Assessment and Collection", citationUrl: "https://www.congress.gov", relevance: "Statutory provisions governing audit timeframes and statute of limitations." },
      { authority: "U.S. Department of Labor (DOL)", documentTitle: "Fair Labor Standards Act (FLSA) Recordkeeping Regulations (29 CFR Part 516)", relevance: "Federal payroll record retention mandates." }
    ]
  },

  bank_reconciliation: {
    answer: `### What Is Bank Reconciliation and Why Is It Critical?

A **bank reconciliation** is the formal accounting procedure of comparing the cash balance reported on a company's balance sheet (general ledger cash account) against the ending balance on its commercial bank statement.

#### 1. Why Discrepancies Occur
Discrepancies between the general ledger and the bank statement arise routinely due to timing differences and unrecorded items:
* **Deposits in Transit**: Funds recorded in the company's ledger that have not yet cleared or been credited by the banking institution.
* **Outstanding Checks**: Checks issued and recorded in the books that have not yet been presented to or paid by the bank.
* **Bank Fees & Service Charges**: Fees debited by the bank that must be recorded as operating expenses.
* **Direct Deposits / Electronic Funds Transfers**: Wire payments, merchant processing deposits (e.g., Stripe, Square), or automated vendor drafts.
* **Interest Earned**: Credit interest posted by the bank.
* **Book or Bank Errors**: Transposition mistakes, double-posted debits, or unauthorized charges.

#### 2. The Step-by-Step Reconciliation Cycle
1. **Match Recorded Cash Receipts**: Compare bank statement deposits against general ledger cash receipts.
2. **Match Disbursed Checks**: Identify all cleared checks; list unpaid checks as outstanding.
3. **Record Adjusting Journal Entries**: Book bank fees, merchant processing charges, and earned interest to update the general ledger.
4. **Compute Adjusted Bank Balance**: Bank Statement Ending Balance + Deposits in Transit − Outstanding Checks ± Bank Errors.
5. **Verify Equality**: Adjusted Bank Balance **MUST EXACTLY EQUAL** Adjusted Book Balance.

#### 3. Impact on Tax Preparation
Tax return preparation cannot proceed reliably on un-reconciled numbers. Un-reconciled books frequently lead to double-counted income, omitted deductions, inaccurate 1099 reconciliations, and elevated audit risk.`,
    sources: [
      { authority: "Financial Accounting Standards Board (FASB)", documentTitle: "FASB ASC 305: Cash and Cash Equivalents", relevance: "Authoritative GAAP rules for measuring and presenting cash balances." },
      { authority: "IRS.gov", documentTitle: "Internal Revenue Manual (IRM) 4.10.3: Examination Techniques - Bank Statement Analysis", citationUrl: "https://www.irs.gov/irm/part4/irm_04-010-003", relevance: "Describes how IRS revenue agents verify taxpayer gross receipts via bank reconciliations." }
    ]
  },

  estimated_taxes: {
    answer: `### U.S. Quarterly Estimated Tax Payments Explained

Because the United States operates a **pay-as-you-go** income tax system under the Internal Revenue Code, individuals and business entities must pay tax on income as it is earned throughout the tax year.

#### 1. Who Must Pay Estimated Taxes?
* **Individuals**: Sole proprietors, partners, S corporation shareholders, freelancers, and independent contractors who expect to owe **$1,000 or more** in federal tax when their return is filed (after subtracting withholdings and refundable credits).
* **Corporations**: C corporations that expect to owe federal tax of **$500 or more** (Form 1120-W).

#### 2. Statutory Due Dates (Calendar-Year Filers)
* **Q1 (Jan 1 – Mar 31)**: Due **April 15**
* **Q2 (Apr 1 – May 31)**: Due **June 15**
* **Q3 (Jun 1 – Aug 31)**: Due **September 15**
* **Q4 (Sep 1 – Dec 31)**: Due **January 15** of the subsequent calendar year

*(Note: If a due date falls on a weekend or federal holiday, the deadline shifts to the following business day).*

#### 3. The Safe Harbor Rules (Avoiding Underpayment Penalties under IRC § 6654)
To avoid the statutory estimated tax penalty, an individual must pay throughout the year (via timely withholdings and estimated installments) at least:
* **90%** of the tax shown on the current year's tax return, OR
* **100%** of the tax shown on the prior year's return (provided the prior return covered a 12-month period).
* **High-Income Taxpayers**: If your Adjusted Gross Income (AGI) on the prior year return exceeded **$150,000** ($75,000 if married filing separately), the prior-year safe harbor threshold rises to **110%**.

#### 4. State Requirements
Most states with an individual income tax (e.g., California FTB, New York DTF) impose parallel estimated tax payment schedules and separate underpayment penalties.`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "Form 1040-ES: Estimated Tax for Individuals", citationUrl: "https://www.irs.gov/forms-pubs/about-form-1040-es", relevance: "Official instructions, calculation worksheets, and payment vouchers." },
      { authority: "Congress.gov", documentTitle: "Internal Revenue Code § 6654: Failure by Individual to Pay Estimated Income Tax", citationUrl: "https://www.congress.gov", relevance: "Statutory basis for estimated tax requirements and safe harbor provisions." }
    ]
  },

  after_efile: {
    answer: `### What Happens After an Electronic Tax Return Is Submitted?

When an authorized IRS e-file provider or taxpayer transmits a federal tax return electronically, the submission enters a multi-stage verification and processing lifecycle.

#### Stage 1: Modernized e-File (MeF) Transmission & Schema Validation
* The encrypted tax package is transmitted to the IRS Modernized e-File (MeF) intake gateways.
* Automated syntactical and mathematical checks verify that the return conforms to official XML schemas and business rules.

#### Stage 2: Acknowledgement (Acceptance or Rejection)
* Within **24 to 48 hours** of transmission, the IRS generates an electronic **Acknowledgement Record**:
  * **Accepted**: The return has satisfied initial screening rules (correct names, matching SSNs/EINs, prior-year AGI or IP PIN validation) and is entered into the master pipeline for formal processing.
  * **Rejected**: The return encountered a validation error (e.g., mismatched dependent Social Security number, duplicate filing, incorrect Identity Protection PIN). The rejection report contains specific error codes that must be corrected before re-transmission.

#### Stage 3: State Return Processing
* If state returns were bundled with the federal return, the IRS passes the state component through the Federal/State Electronic Filing program to the relevant state department of revenue (e.g., CA Franchise Tax Board). State processing operates on independent timelines.

#### Stage 4: Processing & Refund / Balance Due Settlement
* **Refund Returns**: Routine returns requesting direct deposits are generally issued within 21 calendar days, provided no identity verification (IDV) filters or Path Act holds (for EITC or ACTC) apply.
* **Tax Due Returns**: Acceptance confirms filing compliance, but payments must be independently scheduled via IRS Direct Pay, Electronic Federal Tax Payment System (EFTPS), or check before the statutory filing deadline to avoid late-payment interest.

#### Stage 5: Archive & Transcript Availability
* Once processed, the return data posts to the taxpayer's official **IRS Master File (IMF/BMF)**, making Return and Account Transcripts accessible.`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "IRS Publication 4164: Modernized e-File (MeF) Guide for Software Developers and Transmitters", citationUrl: "https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications", relevance: "Technical and administrative framework for IRS electronic return submission." },
      { authority: "IRS.gov", documentTitle: "Where's My Refund? Official Tracking Service", citationUrl: "https://www.irs.gov/refunds", relevance: "Official portal documenting post-submission return stages." }
    ]
  },

  respond_irs_notice: {
    answer: `### Procedural Steps for Responding to an IRS Notice or Letter

Receiving an official notice from the Internal Revenue Service requires an organized, prompt, and documented response. Do not ignore IRS correspondence; failure to reply within the specified timeframe can forfeit appeal rights or trigger statutory levies.

#### Step 1: Verify the Authenticity of the Notice
* Inspect the top-right corner of the correspondence for the notice or letter number (e.g., **CP2000, CP14, CP504, Letter 525**), the tax year, and the designated IRS contact telephone number.
* Note: The IRS **first contacts taxpayers via official postal mail**, never via unsolicited telephone calls, text messages, or direct social media messages.

#### Step 2: Identify the Underlying Cause
* **CP14**: Notice of unpaid balance due.
* **CP2000**: Underreporter Inquiry (discrepancy between income reported on Form 1040 and third-party 1099/W-2 documents).
* **CP504**: Urgent Notice of Intent to Levy.
* **Letter 12C**: Request for missing forms or schedules (such as Form 8962 for Premium Tax Credits).

#### Step 3: Compare Against Your Filed Return & Workpapers
* Pull your copy of the filed return, supporting W-2s/1099s, and reconciliations for the tax year in question.
* Confirm whether the IRS calculation is mathematically accurate or based on incomplete third-party reporting (for example, reporting gross stock proceeds without recognizing cost basis on Form 8949).

#### Step 4: Prepare a Contemporaneous Response
* **If You Agree**: Sign the consent/agreement form and submit payment or request an installment agreement (Form 9465) or Online Payment Agreement (OPA).
* **If You Disagree (Partial or Total)**:
  * Prepare a clear, concise written explanation.
  * Attach substantiating documentation (e.g., bank statements, invoices, brokerage 1099-B with basis).
  * Never send original documents; send legible copies.
  * Send the package via **USPS Certified Mail with Return Receipt Requested** to establish proof of timely delivery before the deadline printed on the notice.

#### Step 5: Consult a Qualified Practice Representative
* If the notice involves significant adjustments, proposed penalties, or examination audits, engage an authorized tax professional (Enrolled Agent, CPA, or Tax Attorney) empowered by Form 2848 (Power of Attorney) to represent you before the IRS.`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "IRS Publication 594: The IRS Collection Process", citationUrl: "https://www.irs.gov/forms-pubs/about-publication-594", relevance: "Outlines taxpayer rights and procedures for addressing balance-due notices and collection actions." },
      { authority: "IRS.gov", documentTitle: "Understanding Your IRS Notice or Letter", citationUrl: "https://www.irs.gov/individuals/understanding-your-irs-notice-or-letter", relevance: "Index of IRS notice codes, response procedures, and contact protocols." },
      { authority: "Internal Revenue Service (IRS)", documentTitle: "Taxpayer Bill of Rights (IRC § 7803(a)(3))", citationUrl: "https://www.irs.gov/taxpayer-bill-of-rights", relevance: "Guarantees rights to challenge the IRS's position and be heard." }
    ]
  },

  difference_1099_w2: {
    answer: `### Form 1099-NEC vs. Form W-2: Independent Contractor vs. Employee

Under U.S. federal tax and labor law, the classification of a worker as either an **independent contractor (Form 1099-NEC)** or a **statutory employee (Form W-2)** is governed by common-law rules focusing on behavioral control, financial control, and the type of relationship.

| Dimension | Form W-2 (Employee) | Form 1099-NEC (Independent Contractor) |
| :--- | :--- | :--- |
| **Worker Status** | Common-law or statutory employee. | Independent business owner / self-employed contractor. |
| **Withholding** | Employer withholds federal & state income tax, plus employee FICA (7.65%). | **No tax withheld** by the paying entity. Contractor is responsible for all tax. |
| **Payroll Tax Matching** | Employer pays an additional 7.65% for employer share of FICA (Social Security & Medicare) + FUTA. | Contractor pays **Self-Employment Tax (15.3%)** via Schedule SE on Form 1040. |
| **Reporting Threshold** | All compensation, regardless of amount (or $20+ for tax reporting). | Total payments of **$600 or more** in a calendar year for services rendered. |
| **Deadline to Recipient** | Furnished by **January 31** following the tax year. | Furnished by **January 31** following the tax year. |
| **Expense Deductions** | Cannot deduct unreimbursed employee expenses (suspended under TCJA through 2025). | Deducts ordinary and necessary trade or business expenses on **Schedule C** (IRC § 162). |
| **Filing Form** | Reported on Form 1040, Line 1a. | Reported on Form 1040, Schedule C / Schedule 1. |

#### Legal & Regulatory Risk:
Misclassifying an employee as an independent contractor exposes businesses to severe liability under IRC § 3509, including back taxes, interest, unpaid overtime under the Fair Labor Standards Act (FLSA), and state unemployment penalties. If classification status is ambiguous, Form SS-8 can be filed with the IRS for an official determination.`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "IRS Publication 15-A: Employer's Supplemental Tax Guide", citationUrl: "https://www.irs.gov/forms-pubs/about-publication-15-a", relevance: "Comprehensive criteria for worker classification (Behavioral, Financial, Relationship)." },
      { authority: "U.S. Department of Labor (DOL)", documentTitle: "Employee or Independent Contractor Classification Under the FLSA (29 CFR Part 795)", citationUrl: "https://www.dol.gov", relevance: "Federal labor standards governing independent contractor status." }
    ]
  },

  schedule_c_info: {
    answer: `### Information Needed for Schedule C (Form 1040: Profit or Loss From Business)

**Schedule C** is filed by sole proprietors, single-member LLCs (disregarded entities), and statutory employees to report operating results and calculate net earnings subject to self-employment tax.

#### 1. General Business Details
* **Business Name & Principal Activity Code**: 6-digit NAICS code corresponding to your trade or profession.
* **Employer Identification Number (EIN)**: If applicable (or Social Security Number if operating without an EIN).
* **Accounting Method**: Cash, Accrual, or Other (as defined under IRC § 446).
* **Form 1099 Filing Compliance**: You must explicitly answer whether you made payments requiring Form 1099 filings and whether you filed them.

#### 2. Gross Receipts & Cost of Goods Sold (COGS)
* **Gross Sales / Receipts**: Total revenue collected from all clients, invoices, merchant processors (Form 1099-K), and cash/check receipts.
* **Returns & Allowances**: Refunds or customer credits.
* **Inventory (if applicable)**:
  * Beginning inventory value at Jan 1
  * Inventory purchases minus personal withdrawal
  * Direct labor and materials
  * Ending inventory value at Dec 31

#### 3. Operating Expenses (Ordinary & Necessary under IRC § 162)
* **Advertising & Marketing**: Website hosting, digital ads, print media, branding assets.
* **Car & Truck Expenses**: Standard mileage rate (with contemporaneous mileage log) or actual expenses (gas, insurance, depreciation).
* **Contract Labor**: Fees paid to non-employees for which Form 1099-NEC was issued.
* **Depreciation & Section 179**: Equipment, computers, tools, furniture placed in service during the year (substantiated on Form 4562).
* **Insurance**: General liability, professional liability, errors & omissions.
* **Legal & Professional Services**: Accounting, legal counsel, compliance consultants.
* **Office Expenses**: Supplies, software subscriptions, postage.
* **Rent / Lease Payments**: Commercial real estate and machinery leases.
* **Business Meals**: 50% limitation applies under IRC § 274(n). (Note: Detailed date, business purpose, and participants must be retained).
* **Travel**: Airfare, lodging, and local transit solely for business purposes.
* **Utilities**: Internet, phone, commercial electricity.
* **Home Office Deduction**: Simplified method ($5/sq ft up to 300 sq ft) or actual method (Form 8829) requiring exclusive and regular business use.`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "Instructions for Schedule C (Form 1040): Profit or Loss From Business", citationUrl: "https://www.irs.gov/forms-pubs/about-schedule-c-form-1040", relevance: "Official IRS instructions and allowable deduction categories." },
      { authority: "Congress.gov", documentTitle: "Internal Revenue Code § 162: Trade or Business Expenses", citationUrl: "https://www.congress.gov", relevance: "Statutory requirement that expenses must be ordinary and necessary." },
      { authority: "IRS.gov", documentTitle: "IRS Publication 334: Tax Guide for Small Business", citationUrl: "https://www.irs.gov/forms-pubs/about-publication-334", relevance: "Comprehensive guide for sole proprietors filing Schedule C." }
    ]
  }
};

/**
 * Generate intelligent guidance response based on user prompt and context
 */
export function generateAssistantResponse(prompt: string, context: AssistantContext): AssistantResponse {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // 1. First priority: Check Guardrails
  if (checkGuardrails(cleanPrompt)) {
    return {
      answer: MANDATORY_REFUSAL_MESSAGE,
      sources: [
        {
          authority: "A/R Accounting Practice Standards",
          documentTitle: "Professional Scope & Ethical Guidelines",
          relevance: "Mandatory compliance boundaries governing general educational assistance."
        }
      ],
      refusal: true
    };
  }

  // 2. Check for exact or close match in curated knowledge base
  if (lower.includes("document") && (lower.includes("individual") || lower.includes("personal") || lower.includes("1040"))) {
    return KNOWLEDGE_BASE.documents_individual;
  }
  if (lower.includes("difference") && lower.includes("bookkeeping") && lower.includes("tax")) {
    return KNOWLEDGE_BASE.difference_bookkeeping_tax;
  }
  if (lower.includes("s corp") || lower.includes("s-corp") || lower.includes("1120-s") || lower.includes("1120s")) {
    return KNOWLEDGE_BASE.scorp_reporting;
  }
  if (lower.includes("record") && (lower.includes("retain") || lower.includes("retention") || lower.includes("keep"))) {
    return KNOWLEDGE_BASE.records_retention;
  }
  if (lower.includes("bank reconciliation") || (lower.includes("reconcil") && lower.includes("bank"))) {
    return KNOWLEDGE_BASE.bank_reconciliation;
  }
  if (lower.includes("estimated tax") || lower.includes("quarterly tax") || lower.includes("1040-es")) {
    return KNOWLEDGE_BASE.estimated_taxes;
  }
  if (lower.includes("after") && (lower.includes("submit") || lower.includes("e-file") || lower.includes("efile") || lower.includes("filed"))) {
    return KNOWLEDGE_BASE.after_efile;
  }
  if (lower.includes("notice") || lower.includes("letter") || lower.includes("audit") || lower.includes("cp2000")) {
    return KNOWLEDGE_BASE.respond_irs_notice;
  }
  if (lower.includes("1099") && (lower.includes("w-2") || lower.includes("w2") || lower.includes("employee") || lower.includes("contractor"))) {
    return KNOWLEDGE_BASE.difference_1099_w2;
  }
  if (lower.includes("schedule c") || lower.includes("sole propriet") || lower.includes("self employ")) {
    return KNOWLEDGE_BASE.schedule_c_info;
  }

  // 3. Fallback to dynamic, contextual educational guidance for other U.S. queries
  return generateDynamicGuidance(cleanPrompt, context);
}

function generateDynamicGuidance(prompt: string, context: AssistantContext): AssistantResponse {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // General payroll query
  if (lower.includes("payroll") || lower.includes("fica") || lower.includes("941")) {
    return {
      answer: `### U.S. Federal & State Payroll Accounting Principles (${context.taxYear} Focus)

Under U.S. employment tax rules, employers are responsible for calculating, withholding, remitting, and reporting payroll taxes across federal and state jurisdictions:

#### 1. Statutory Federal Withholdings
* **Federal Income Tax Withholding (FITW)**: Calculated based on employee Form W-4 allowances or modern computational worksheets.
* **Federal Insurance Contributions Act (FICA)**:
  * **Social Security Tax**: 6.2% withheld from employee wages up to the statutory wage base limit ($168,600 for 2024; indexed annually), matched by 6.2% employer contribution.
  * **Medicare Tax**: 1.45% on all covered wages with no cap, matched by 1.45% employer contribution.
  * **Additional Medicare Tax**: 0.9% withheld on employee wages exceeding $200,000 ($250,000 for married filing jointly), with no employer match.

#### 2. Federal Employer Liability
* **Federal Unemployment Tax Act (FUTA)**: Effective rate of 0.6% on the first $7,000 of wages per employee for employers eligible for the maximum state unemployment credit. Reported on annual **Form 940**.
* **Quarterly Reporting**: Employers must file **Form 941 (Employer's Quarterly Federal Tax Return)** to reconcile withheld income taxes and FICA contributions.

#### 3. State-Specific Rules (${context.jurisdiction})
* In jurisdictions like ${context.jurisdiction}, employers must also register for State Unemployment Insurance (SUI), state income tax withholding, and applicable disability/paid family leave programs.`,
      sources: [
        { authority: "Internal Revenue Service (IRS)", documentTitle: "IRS Publication 15 (Circular E): Employer's Tax Guide", citationUrl: "https://www.irs.gov/forms-pubs/about-publication-15", relevance: "Authoritative rules on withholding, deposits, and reporting of employment taxes." },
        { authority: "Social Security Administration (SSA)", documentTitle: "Annual Maximum Wage Base Limits", citationUrl: "https://www.ssa.gov", relevance: "Statutory contribution limits for FICA Social Security." }
      ]
    };
  }

  // General depreciation query
  if (lower.includes("depreciation") || lower.includes("section 179") || lower.includes("bonus")) {
    return {
      answer: `### U.S. Asset Depreciation & Section 179 Expensing (${context.taxYear})

When a business acquires capital assets (machinery, computers, vehicles, furniture), U.S. tax law governs how those costs are recovered:

#### 1. Section 179 Immediate Expensing (IRC § 179)
* Allows qualifying businesses to deduct the full purchase price of eligible equipment and software purchased or financed during the tax year.
* Subject to statutory annual deduction dollar limits and overall phase-out caps based on total equipment placed in service during the year.
* Limited to taxable income from the active conduct of trade or business (cannot create or increase an overall net operating loss).

#### 2. Modified Accelerated Cost Recovery System (MACRS)
* Where Section 179 is not claimed or exhausted, assets are depreciated over statutory recovery periods (e.g., 5-year for computers and autos, 7-year for office furniture, 15-year for qualified improvement property, 27.5-year for residential real estate, 39-year for commercial real estate).
* Utilizes the 200% or 150% declining balance switching to straight-line, or straight-line method under IRS half-year or mid-quarter conventions.

#### 3. Form 4562 Compliance
* All depreciation and amortization claims are reported on **Form 4562**, which must be maintained with complete historical asset ledger workpapers.`,
      sources: [
        { authority: "Internal Revenue Service (IRS)", documentTitle: "IRS Publication 946: How To Depreciate Property", citationUrl: "https://www.irs.gov/forms-pubs/about-publication-946", relevance: "Comprehensive MACRS, Section 179, and recovery period guidance." },
        { authority: "Congress.gov", documentTitle: "IRC § 168 & § 179", citationUrl: "https://www.congress.gov", relevance: "Statutory cost recovery and expensing provisions." }
      ]
    };
  }

  // Standard responsive educational answer for general U.S. accounting questions
  return {
    answer: `### Overview: ${cleanPrompt}

In U.S. accounting and tax practice (${context.taxYear} Tax Year | Jurisdiction: ${context.jurisdiction} | Profile: ${context.profile.toUpperCase()}):

#### 1. Core Principles & Regulatory Framework
Under United States federal statutes and accounting standards, financial events must be measured consistently, supported by verifiable documentation, and reported according to the appropriate statutory schedule.
* **Accuracy & Substantiation**: Deductions, expenses, and credits require contemporaneous records (invoices, canceled checks, digital statements).
* **Timely Filing**: Standard federal filing dates must be observed to avoid late-filing additions to tax under IRC § 6651.

#### 2. Practical Steps for Business & Tax Planning
1. **Maintain Reconciled Books**: Ensure monthly bank and credit card accounts balance to zero variance.
2. **Segregate Personal & Business Accounts**: Commingling funds undermines corporate limited liability veils and complicates IRS audit defense.
3. **Monitor Thresholds**: Keep track of quarterly estimated tax requirements to prevent unexpected penalties at filing time.

*This response provides general educational context. For specific transactions or tax positions, professional consultation with a credentialed practitioner is recommended.*`,
    sources: [
      { authority: "Internal Revenue Service (IRS)", documentTitle: "IRS Publication 17 & Publication 583", citationUrl: "https://www.irs.gov", relevance: "Authoritative standards for federal recordkeeping and reporting compliance." },
      { authority: "Financial Accounting Standards Board (FASB)", documentTitle: "U.S. GAAP Overview", relevance: "Governs general financial accounting conventions." }
    ]
  };
}
