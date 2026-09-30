/**
 * A/R Tax Services, LLC - Role-Specific Demonstration AI Engine
 * Provides deterministic mock AI assistant interactions strictly labeled as simulated.
 * Complies with IRS Section 7216 disclosure standards and human-review mandates.
 */

import { DemoRole, DemoAiResponse } from '../types';

interface AiScenario {
  promptQuery: string;
  response: Omit<DemoAiResponse, 'id' | 'role' | 'prompt' | 'timestamp'>;
}

const ROLE_SCENARIOS: Partial<Record<DemoRole, AiScenario[]>> = {
  client: [
    {
      promptQuery: 'What deductions are available for my home office and vehicle?',
      response: {
        assistantTitle: 'Client Tax Concierge (Demonstration)',
        summary: 'Under IRC § 280A and § 162, home office and business vehicle deductions require exclusive business use and detailed mileage substantiation.',
        details: [
          'Home Office: The simplified method allows $5/sq ft up to 300 sq ft ($1,500 max). Actual expense method requires square footage ratio of mortgage interest, utilities, and depreciation.',
          'Business Mileage: For 2025/2026, IRS standard mileage rate is 67¢/mile. Contemporaneous log with date, destination, business purpose, and odometer readings is mandatory.',
          'Current Portal Status: Your Vehicle Mileage Log remains listed under missing documents. Uploading this will allow your preparer to finalize Schedule C/Line 9.'
        ],
        sourceRecords: [
          'Client Questionnaire 2025',
          'First Citizens Checking Bank Statements (...4810)',
          'IRS Publication 587 (Business Use of Your Home)'
        ],
        confidence: 96,
        assumptions: [
          'Home office area is used regularly and exclusively for administrative management.',
          'Taxpayer maintains a contemporaneous log meeting IRC § 274(d) strict substantiation rules.'
        ],
        humanReviewRequirement: 'MANDATORY HUMAN REVIEW: AI-generated tax deductions are illustrative demonstration estimates and must be reviewed and approved by your assigned CPA/EA.'
      }
    },
    {
      promptQuery: 'Why is my Form 1120-S awaiting signature?',
      response: {
        assistantTitle: 'Client Tax Concierge (Demonstration)',
        summary: 'Your 2025 Form 1120-S has successfully passed CPA Quality Review and is awaiting your electronic signature authorization on Form 8879-S.',
        details: [
          'Senior Reviewer Elena Rostova, CPA verified all book-to-tax reconciliations and approved the tax return package.',
          'Next Step: Navigate to Return Review & Signature, review the draft Form 1120-S PDF, and complete the simulated Form 8879-S authorization signature.'
        ],
        sourceRecords: [
          'Engagement Record: eng_2025_perotti',
          'Reviewer Signoff Certificate #QC-2026-091'
        ],
        confidence: 99,
        assumptions: ['Officer Michael Perotti is authorized corporate officer.'],
        humanReviewRequirement: 'MANDATORY HUMAN REVIEW: Review the entire tax return before authorizing submission.'
      }
    }
  ],
  bookkeeper: [
    {
      promptQuery: 'Categorize uncategorized transactions and flag exceptions',
      response: {
        assistantTitle: 'Bookkeeping Intelligence Assistant (Demonstration)',
        summary: 'Scanned 5 bank feed transactions; 4 successfully matched to chart of accounts, 1 exception requires client invoice copy.',
        details: [
          'Matched Adobe Creative Cloud ($189.99) -> GL 6420 Software & Cloud Subscriptions (99% confidence).',
          'Matched SC Department of Revenue ($1,450.00) -> GL 2140 State Payroll Withholding Payable (98% confidence).',
          'Matched Retainer Wire ($12,500.00) -> GL 4010 Advisory Revenue (95% confidence).',
          'EXCEPTION: Check #4092 ($8,750.00 for Summit Ridge) lacks vendor payee metadata. Classified to GL 1999 Suspense pending receipt.'
        ],
        sourceRecords: [
          'Transaction Ledger TY2025',
          'Chart of Accounts Mapping Rules',
          'Wells Fargo Bank Feed Register'
        ],
        confidence: 94,
        assumptions: [
          'Recurring software and tax payments conform to prior period classification rules.'
        ],
        humanReviewRequirement: 'MANDATORY HUMAN REVIEW: Suspense entries must be resolved prior to month-end trial balance certification.'
      }
    }
  ],
  payroll: [
    {
      promptQuery: 'Review quarterly payroll tax liability and Form 941 deposit schedule',
      response: {
        assistantTitle: 'Payroll Compliance Assistant (Demonstration)',
        summary: 'Calculated bi-weekly payroll liabilities for Perotti Holdings and Summit Ridge; tax deposit deadlines aligned with semi-weekly rules.',
        details: [
          'Perotti Holdings: Total gross $28,400.00. Federal withholding $4,120.00, FICA/Medicare $2,172.60. Total liability $6,292.60 due next Wednesday under semi-weekly deposit schedule.',
          'Summit Ridge: Gross $94,250.00 across 24 employees. Total tax deposit $21,810.12 verified against Form 941 Schedule B draft.'
        ],
        sourceRecords: [
          'Payroll Register Pay Period 2026-02-14',
          'IRS Publication 15 (Circular E)',
          'EFTPS Deposit Schedules'
        ],
        confidence: 98,
        assumptions: ['No supplemental wages subject to higher flat 22% or 37% withholding.'],
        humanReviewRequirement: 'MANDATORY HUMAN REVIEW: Payroll deposits must be authorized by licensed payroll specialist.'
      }
    }
  ],
  accountant: [
    {
      promptQuery: 'Calculate Section 179 depreciation and Schedule M-1 adjustments for Summit Ridge',
      response: {
        assistantTitle: 'Tax Preparation & Workpaper Assistant (Demonstration)',
        summary: 'Identified $124,000 Section 179 accelerated depreciation on qualifying warehouse cold storage and logistics assets.',
        details: [
          'Total asset additions: $172,000 cold storage installation placed in service Q3 2025.',
          'Book depreciation: $48,000 straight-line. Tax Section 179 election: $172,000.',
          'Schedule M-1 Adjustment: Line 8(a) tax depreciation exceeds book depreciation by $124,000, reducing current taxable income.'
        ],
        sourceRecords: [
          'Summit_Ridge_Fixed_Assets_2025.xlsx',
          'General Ledger Account 1500 Machinery & Equipment',
          'IRC § 179 Dollar Limitation Guidelines'
        ],
        confidence: 95,
        assumptions: [
          'Summit Ridge meets taxable income business limitation for Sec 179 deduction.',
          'Assets qualify as MACRS 7-year property placed in service during 2025.'
        ],
        humanReviewRequirement: 'MANDATORY HUMAN REVIEW: Sec 179 election requires formal CPA review and Form 4562 verification.'
      }
    }
  ],
  reviewer: [
    {
      promptQuery: 'Run QC diagnostics and verify source-to-return traceability for Perotti 1120-S',
      response: {
        assistantTitle: 'CPA Quality Review Assistant (Demonstration)',
        summary: 'All 14 statutory QC check items passed. Officer compensation substantiated, zero trial balance variance, Form 8879-S prepared.',
        details: [
          '1. Officer Compensation: $145,000 matches Form W-2 and general ledger account 6010. Benchmarked against RCReports industry median ($140,000–$160,000).',
          '2. Schedule M-1: 50% meals disallowance of $4,225 correctly backed out.',
          '3. Balance Sheet (Schedule L): Total assets $842,910 reconcile to ending bank balances, receivables, and equipment.',
          '4. Shareholder Basis: K-1 Box 1 ordinary income $182,410 increases stock basis; distribution of $60,000 is non-taxable.',
          '5. Maker-Checker Status: Preparer is Marcus Vance, EA. Reviewer Elena Rostova, CPA is eligible to certify.'
        ],
        sourceRecords: [
          'Form 1120-S Draft Workpapers',
          'Form W-2 Officer Wage Statement',
          'First Citizens Bank Statement Q4 2025',
          'RCReports Executive Compensation Survey 2025'
        ],
        confidence: 99,
        assumptions: [
          'All material third-party 1099 and K-1 inputs received and reconciled without unrecorded liabilities.'
        ],
        humanReviewRequirement: 'MANDATORY CPA CERTIFICATION: Reviewer must sign review checklist before return package is released.'
      }
    }
  ],
  advisor: [
    {
      promptQuery: 'Model tax savings of S-Corporation salary vs. distribution optimization',
      response: {
        assistantTitle: 'Strategic Advisory & Wealth Modeling (Demonstration)',
        summary: 'Projected annual employment tax savings of $18,240 by optimizing officer compensation to $150,000 with remaining $190,000 as S-Corp distributions.',
        details: [
          'Projected Net Business Earnings: $340,000.',
          'Sole Proprietorship / LLC Default: Subject to 15.3% SE tax on full $340k -> ~$42,800 SE tax burden.',
          'S-Corporation Optimization: $150,000 reasonable salary pays FICA/Medicare; remaining $190,000 distributed free of self-employment tax.',
          'Net Annual Cash Savings: $18,240 retained inside business or distributed to principal.'
        ],
        sourceRecords: [
          '2024-2025 Form 1120-S Historical Filings',
          'RCReports Executive Wage Benchmark Study',
          'IRC § 3121 FICA Definitions & Revenue Ruling 59-221'
        ],
        confidence: 93,
        assumptions: [
          'Executive dedicates 35 hours weekly to executive management and client development.',
          'Firm maintains quarterly payroll tax filings and timely Form 941 deposits.'
        ],
        humanReviewRequirement: 'MANDATORY HUMAN REVIEW: Advisory roadmap is a scenario demonstration. Formal implementation requires consultation with licensed CPA.'
      }
    }
  ],
  compliance: [
    {
      promptQuery: 'Audit Section 7216 consents, PTIN/EFIN active status, and access log anomalies',
      response: {
        assistantTitle: 'Compliance & Governance Engine (Demonstration)',
        summary: 'Zero data leakage events detected; 100% of active client dossiers have signed § 7216 tax information consent on file.',
        details: [
          'IRC § 7216 Registry: 8 active client files audited; all 8 have unexpired consent forms.',
          'IRS EFIN/PTIN Registry: EFIN 57-XXXXX verified active for 2026 tax season; all 3 practice preparers hold active 2026 PTINs.',
          'Access Audit: 128 audit trail events logged in past 7 days; 100% of access requests authenticated.',
          'Data Retention: 2 client engagement archives approaching 7-year statutory archive expiration in Q4 2026.'
        ],
        sourceRecords: [
          'System Audit Trail',
          'IRC Section 7216 Signed Consent Database',
          'IRS E-Services EFIN Tracking Log'
        ],
        confidence: 100,
        assumptions: ['No off-system communications or manual exports occurred.'],
        humanReviewRequirement: 'MANDATORY COMPLIANCE OFFICER REVIEW: Annual security review must be filed with executive committee.'
      }
    }
  ],
  intake: [
    {
      promptQuery: 'Check client conflict of interest and service plan suitability for new lead',
      response: {
        assistantTitle: 'Intake & Onboarding Assistant (Demonstration)',
        summary: 'Conflict check negative across active firm client rosters; prospect qualifies for Corporate Tax & Monthly Bookkeeping package.',
        details: [
          'Conflict Check: Searched legal name and business entity against existing 42 client entities. Zero direct or adverse party conflicts identified.',
          'Service Match: S-Corp filing with $1.2M gross receipts qualifies for Professional Practice Tier ($3,250 annual filing + $450/mo bookkeeping).',
          'Next Step: Issue standardized digital engagement letter and digital questionnaire packet.'
        ],
        sourceRecords: [
          'Firm Master Client Directory',
          'Intake Lead Questionnaire Form #INT-2026-088'
        ],
        confidence: 97,
        assumptions: ['Prospect ownership structure contains no foreign parent entities requiring Form 5472.'],
        humanReviewRequirement: 'MANDATORY REVIEW: Engagement letter must be countersigned by managing principal.'
      }
    }
  ],
  billing: [
    {
      promptQuery: 'Analyze accounts receivable aging and unbilled work-in-progress',
      response: {
        assistantTitle: 'Billing & AR Intelligence Assistant (Demonstration)',
        summary: 'Total outstanding accounts receivable: $9,050.00 across 2 active invoices; 100% current within 30 days.',
        details: [
          'Invoice INV-2026-0144 ($3,250.00, Perotti Holdings): Due March 15, 2026. Status: Current.',
          'Invoice INV-2026-0145 ($5,800.00, Summit Ridge): Due March 18, 2026. Status: Current.',
          'Unbilled WIP: 1 engagement (Apex Artisan Carpentry) has $1,450.00 in preparation time ready for billing once documents complete.'
        ],
        sourceRecords: ['Accounts Receivable Ledger', 'Time Tracking Work-in-Progress Register'],
        confidence: 99,
        assumptions: ['All time entries logged through close of business yesterday.'],
        humanReviewRequirement: 'MANDATORY BILLING REVIEW: Invoices must be approved prior to dispatch.'
      }
    }
  ],
  operations: [
    {
      promptQuery: 'Identify tax season bottlenecks and capacity constraints across preparers',
      response: {
        assistantTitle: 'Practice Operations Assistant (Demonstration)',
        summary: '1 critical bottleneck detected: March 15 S-Corp/Partnership filing deadline in 12 days; 1 return requires correction.',
        details: [
          'Staff Utilization: Marcus Vance, EA is at 88% capacity with 4 returns in preparation or revision.',
          'Bottleneck: Harbor Dental (Form 1065) is flagged "Corrections Required" due to $42.5k partner draw discrepancy.',
          'Recommendation: Reassign Apex Carpentry document collection follow-up to Intake Coordinator to free 4 preparer hours.'
        ],
        sourceRecords: ['Engagement Pipeline TY2025', 'Staff Workload Matrix'],
        confidence: 96,
        assumptions: ['No additional unscheduled expedited filing requests received today.'],
        humanReviewRequirement: 'MANDATORY OPERATIONS REVIEW: Staff reallocations must be approved by Operations Director.'
      }
    }
  ],
  admin: [
    {
      promptQuery: 'Report on system security, session health, and mock integration status',
      response: {
        assistantTitle: 'System Administration Assistant (Demonstration)',
        summary: 'System health 100% nominal; all 22 mock third-party integration connectors safely maintained in "Not Configured" state.',
        details: [
          'Demo Mode Verification: APP_MODE="demo" confirmed active. Zero external API keys or live transaction credentials configured.',
          'Active Sessions: Isolated role demonstration sessions functioning normally with 4-hour automatic expiration.',
          'Rate Limiting: 5-attempt threshold active with automatic 60-second temporary lockout.'
        ],
        sourceRecords: ['Environment Config Ledger', 'Demo Integration Registry'],
        confidence: 100,
        assumptions: ['Local execution sandboxed in modern Chromium/WebKit rendering container.'],
        humanReviewRequirement: 'System configurations require senior administrator sign-off.'
      }
    }
  ],
  executive: [
    {
      promptQuery: 'Executive briefing on filing season pacing, revenue realized, and firm risk',
      response: {
        assistantTitle: 'Executive Intelligence Briefing (Demonstration)',
        summary: 'Filing season pacing is 14% ahead of prior year; realization rate is 98.2% on $24,550 in current active engagements.',
        details: [
          'Revenue Realized: $2,200 collected; $9,050 invoiced current; $13,300 work-in-progress scheduled for billing upon filing sign-off.',
          'Filing Readiness: 1 return approved and awaiting client signature; 1 in senior review; 1 in corrections; 1 notice protest ready.',
          'High Priority: Maintain focus on resolving Harbor Dental partner draw correction before March 15 statutory deadline.'
        ],
        sourceRecords: ['Executive Practice Dashboard', 'Firmwide Engagement Pipeline'],
        confidence: 97,
        assumptions: ['March 15 returns will complete client signatures within 48 hours of release.'],
        humanReviewRequirement: 'Executive strategic metrics provided for planning purposes only.'
      }
    }
  ]
};

export class DemoAIService {
  public static async queryRoleAssistant(role: DemoRole, prompt: string): Promise<DemoAiResponse> {
    // Simulate brief processing delay
    await new Promise(res => setTimeout(res, 350));

    const scenarios = ROLE_SCENARIOS[role] || ROLE_SCENARIOS.client || [];
    if (!scenarios || scenarios.length === 0) {
      return {
        id: `ai_${Date.now()}`,
        role,
        prompt: prompt || 'Role-specific operational guidance',
        timestamp: new Date().toISOString(),
        assistantTitle: `${role.replace(/-/g, ' ').toUpperCase()} AI Assistant (Demonstration)`,
        summary: `Demonstration operational intelligence for ${role.replace(/-/g, ' ')} at A/R Tax Services, LLC.`,
        details: [
          'All guidance provided is simulated demonstration content reflecting firm standard operating procedures.',
          'Workflow tasks must comply with statutory requirements, firm review gates, and professional quality control.'
        ],
        sourceRecords: ['Firm Policy Handbook', 'Standard Operating Procedures TY2025/2026'],
        confidence: 95,
        assumptions: ['Operating in accordance with firm quality standards.'],
        humanReviewRequirement: 'MANDATORY HUMAN REVIEW: Guidance is for demonstration only. Human review is required before taking operational action.'
      };
    }

    // Find closest match or default to first
    const matched = scenarios.find(s => prompt.toLowerCase().includes(s.promptQuery.toLowerCase().slice(0, 15))) || scenarios[0];

    return {
      id: `ai_${Date.now()}`,
      role,
      prompt: prompt || matched.promptQuery,
      timestamp: new Date().toISOString(),
      ...matched.response
    };
  }

  public static getSamplePromptsForRole(role: DemoRole): string[] {
    const scenarios = ROLE_SCENARIOS[role] || [];
    if (scenarios.length === 0) {
      return [
        `Analyze workflow status and critical bottlenecks for ${role.replace(/-/g, ' ')}`,
        `Review compliance gates and checklist items for stage execution`,
        `Draft simulated correspondence or workpaper notes`
      ];
    }
    return scenarios.map(s => s.promptQuery);
  }
}
