/**
 * TaxGuard AI – Source-Grounded Accounting and Tax Assistant Service
 * Powered by Ophireum AI Technology
 * Strict guardrails for U.S. Tax, Bookkeeping, & Accounting with authoritative citations.
 */

export interface AuthoritativeCitation {
  title: string;
  agency: 'Internal Revenue Service (IRS)' | 'U.S. Department of the Treasury' | 'South Carolina Department of Revenue' | 'Financial Crimes Enforcement Network (FinCEN)' | 'Securities and Exchange Commission (SEC)';
  citationCode: string; // e.g. IRC § 179, Rev. Proc. 2024-40, SC Code § 12-6-40
  publicationDate: string;
  retrievalDate: string;
  url: string;
  jurisdiction: 'Federal' | 'South Carolina' | 'Multi-State';
  applicableTaxYear: number;
}

export interface TaxGuardAssistantResponse {
  answer: string;
  citations: AuthoritativeCitation[];
  isTaxQuestion: boolean;
  requiresProfessionalReview: boolean;
  applicableTaxYear: number;
  jurisdiction: string;
  disclaimer: string;
}

// Built-in Authoritative Grounding Knowledge Repository
const TAX_KNOWLEDGE_BASE: Array<{
  keywords: string[];
  response: string;
  citations: AuthoritativeCitation[];
}> = [
  {
    keywords: ['section 179', 'depreciation', 'equipment', 'vehicle deduction', 'bonus depreciation'],
    response: `For tax year 2024, Internal Revenue Code (IRC) § 179 permits eligible businesses to expense up to $1,220,000 of qualifying Section 179 property placed in service during the tax year. The phase-out threshold begins dollar-for-dollar once total qualifying purchases exceed $3,050,000. Under the Tax Cuts and Jobs Act (TCJA) phase-down schedule, bonus depreciation for property placed in service in calendar year 2024 is 60% (decreasing from 80% in 2023). For commercial vehicles rated under 6,000 lbs GVWR, statutory passenger automobile luxury limits under IRC § 280F apply.`,
    citations: [
      {
        title: 'Rev. Proc. 2023-34 & Rev. Proc. 2024-40 (Cost of Living Adjustments)',
        agency: 'Internal Revenue Service (IRS)',
        citationCode: 'IRC § 179(b); IRC § 168(k)',
        publicationDate: 'November 2023 / October 2024',
        retrievalDate: '2025-01-15',
        url: 'https://www.irs.gov/pub/irs-drop/rp-24-40.pdf',
        jurisdiction: 'Federal',
        applicableTaxYear: 2024
      },
      {
        title: 'IRS Publication 946: How To Depreciate Property',
        agency: 'Internal Revenue Service (IRS)',
        citationCode: 'IRS Pub 946',
        publicationDate: 'February 2024',
        retrievalDate: '2025-01-15',
        url: 'https://www.irs.gov/forms-pubs/about-publication-946',
        jurisdiction: 'Federal',
        applicableTaxYear: 2024
      }
    ]
  },
  {
    keywords: ['meals', 'entertainment', 'travel', 'food deduction', 'business dinner'],
    response: `Under IRC § 274(n), business meals are 50% deductible if they are directly related or associated with the active conduct of a trade or business, the taxpayer (or an employee) is present, and the expense is not lavish or extravagant. Entertainment, amusement, or recreation expenses remain 100% non-deductible under the TCJA. Strict substantiation is required under Treasury Regulation § 1.274-5, requiring contemporaneous documentation of: (1) amount, (2) time and place, (3) business purpose, and (4) business relationship of the attendee.`,
    citations: [
      {
        title: 'IRS Notice 2021-25 & IRC § 274 Disallowance of Certain Expenses',
        agency: 'Internal Revenue Service (IRS)',
        citationCode: 'IRC § 274(n); Treas. Reg. § 1.274-5',
        publicationDate: 'April 2021 / Verified 2024',
        retrievalDate: '2025-01-15',
        url: 'https://www.irs.gov/newsroom/heres-what-businesses-need-to-know-about-the-food-and-beverage-deduction',
        jurisdiction: 'Federal',
        applicableTaxYear: 2024
      }
    ]
  },
  {
    keywords: ['south carolina', 'sc corporate', 'sc tax credit', 'columbia', 'sc dor'],
    response: `South Carolina imposes a 5.0% flat corporate income tax on South Carolina net taxable income allocated and apportioned to SC under SC Code § 12-6-530. Multi-state corporations utilize a single gross receipts factor apportionment formula under SC Code § 12-6-2280. South Carolina does not adopt federal bonus depreciation (IRC § 168(k)) and requires an add-back on SC Form 1120 or Schedule SC-K-1. South Carolina conforms to federal IRC § 179 expensing with specific state limitations.`,
    citations: [
      {
        title: 'SC Department of Revenue Corporate Income Tax Manual & SC Code § 12-6-530',
        agency: 'South Carolina Department of Revenue',
        citationCode: 'SC Code Ann. § 12-6-530; SC Code § 12-6-2280',
        publicationDate: 'January 2024',
        retrievalDate: '2025-01-15',
        url: 'https://dor.sc.gov/tax/corporate-income',
        jurisdiction: 'South Carolina',
        applicableTaxYear: 2024
      }
    ]
  },
  {
    keywords: ['boi', 'fincen', 'beneficial ownership', 'corporate transparency'],
    response: `Under the Corporate Transparency Act (CTA), non-exempt reporting companies created or registered in the U.S. must submit a Beneficial Ownership Information (BOI) Report to the Financial Crimes Enforcement Network (FinCEN). Entities formed prior to January 1, 2024 must file their initial BOI report by January 1, 2025. Entities formed during 2024 must file within 90 calendar days of creation notice. Willful failure to report or updating within 30 days of changes may result in civil and criminal statutory penalties.`,
    citations: [
      {
        title: 'FinCEN Beneficial Ownership Information Reporting Rule',
        agency: 'Financial Crimes Enforcement Network (FinCEN)',
        citationCode: '31 U.S.C. § 5336; 31 C.F.R. § 1010.380',
        publicationDate: 'March 2023 / Updated 2024',
        retrievalDate: '2025-01-15',
        url: 'https://www.fincen.gov/boi',
        jurisdiction: 'Federal',
        applicableTaxYear: 2024
      }
    ]
  }
];

export class TaxGuardAssistantService {
  private static readonly DISCLAIMER = 'TaxGuard AI provides technology-assisted document processing, research support, and workflow recommendations. AI-generated results may contain errors and must be reviewed by an authorized tax professional. The platform does not replace professional judgment and does not independently file tax returns.';

  public static async queryAssistant(prompt: string): Promise<TaxGuardAssistantResponse> {
    const cleanPrompt = (prompt || '').trim();
    const lower = cleanPrompt.toLowerCase();

    // Guardrail 1: Refuse prompt injections
    if (
      lower.includes('ignore all previous instructions') ||
      lower.includes('system prompt') ||
      lower.includes('jailbreak') ||
      lower.includes('pretend you are') ||
      lower.includes('reveal secrets')
    ) {
      return {
        answer: 'Security Alert: Instruction override detected. TaxGuard AI operates strictly within U.S. accounting, tax, and compliance boundaries governed by A/R Tax Services, LLC firm policy.',
        citations: [],
        isTaxQuestion: false,
        requiresProfessionalReview: true,
        applicableTaxYear: 2024,
        jurisdiction: 'Federal',
        disclaimer: this.DISCLAIMER
      };
    }

    // Guardrail 2: Refuse unrelated general-purpose questions
    const taxAndAccountingIndicators = [
      'tax', 'deduct', '1040', '1120', 'w-2', '1099', 'irs', 'depreciation', 'expense', 
      'revenue', 'withholding', 'sc dor', 'basis', 'k-1', 'accounting', 'reconciliation', 
      'ledger', 'fincen', 'audit', 'schedule c', 'payroll', 'fica', 'entity', 'llc', 'cpa'
    ];

    const isRelated = taxAndAccountingIndicators.some(k => lower.includes(k));
    if (!isRelated && cleanPrompt.length > 5) {
      return {
        answer: 'TaxGuard AI is strictly limited to U.S. tax compliance, accounting, bookkeeping, and regulatory research for A/R Tax Services, LLC. Please submit questions regarding federal, state, or business tax matters.',
        citations: [],
        isTaxQuestion: false,
        requiresProfessionalReview: false,
        applicableTaxYear: 2024,
        jurisdiction: 'Federal',
        disclaimer: this.DISCLAIMER
      };
    }

    // Match authoritative grounded knowledge base
    for (const kb of TAX_KNOWLEDGE_BASE) {
      if (kb.keywords.some(k => lower.includes(k))) {
        return {
          answer: kb.response,
          citations: kb.citations,
          isTaxQuestion: true,
          requiresProfessionalReview: true,
          applicableTaxYear: 2024,
          jurisdiction: kb.citations[0]?.jurisdiction || 'Federal',
          disclaimer: this.DISCLAIMER
        };
      }
    }

    // Default grounded professional response
    return {
      answer: `Regarding your inquiry on "${cleanPrompt}": Under Internal Revenue Code and federal Treasury regulations, treatment depends upon the taxpayer's accounting method (cash vs. accrual) and entity classification. Due to statutory variance and taxpayer-specific facts and circumstances, please review with your assigned A/R Tax Services preparer or CPA before committing entries to permanent tax schedules.`,
      citations: [
        {
          title: 'Internal Revenue Code Title 26 (General Principles of Gross Income and Deductions)',
          agency: 'Internal Revenue Service (IRS)',
          citationCode: 'IRC § 61; IRC § 162',
          publicationDate: '2024 Edition',
          retrievalDate: new Date().toISOString().split('T')[0],
          url: 'https://www.irs.gov/privacy-disclosure/tax-code-regulations-and-official-guidance',
          jurisdiction: 'Federal',
          applicableTaxYear: 2024
        }
      ],
      isTaxQuestion: true,
      requiresProfessionalReview: true,
      applicableTaxYear: 2024,
      jurisdiction: 'Federal',
      disclaimer: this.DISCLAIMER
    };
  }
}
