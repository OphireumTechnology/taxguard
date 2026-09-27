import {
  TaxAuthoritySourceRegistry
} from './TaxAuthoritySourceRegistry';

import {
  TaxRuleRegistry
} from './TaxRuleRegistry';

export const FEDERAL_1040_2025_PACK_ID =
  'TG-FED-1040-2025';

export const FEDERAL_1040_2025_TAX_YEAR =
  2025;

export const FEDERAL_1040_2025_AUTHORITY_IDS = {
  form1040Instructions:
    'IRS-2025-F1040-INSTRUCTIONS',

  publication501:
    'IRS-2025-PUB501'
} as const;

export const FEDERAL_1040_2025_RULE_IDS = {
  filingStatus:
    'TG-FED-2025-FILING-STATUS',

  filingRequirement:
    'TG-FED-2025-FILING-REQUIREMENT',

  dependents:
    'TG-FED-2025-DEPENDENTS',

  incomeClassification:
    'TG-FED-2025-INCOME-CLASSIFICATION',

  adjustments:
    'TG-FED-2025-ADJUSTMENTS',

  deductionMethod:
    'TG-FED-2025-DEDUCTION-METHOD',

  credits:
    'TG-FED-2025-CREDITS',

  withholdingPayments:
    'TG-FED-2025-WITHHOLDING-PAYMENTS',

  selfEmployment:
    'TG-FED-2025-SELF-EMPLOYMENT',

  capitalTransactions:
    'TG-FED-2025-CAPITAL-TRANSACTIONS',

  retirementIncome:
    'TG-FED-2025-RETIREMENT-INCOME',

  digitalAssets:
    'TG-FED-2025-DIGITAL-ASSETS',

  healthTaxInputs:
    'TG-FED-2025-HEALTH-TAX-INPUTS',

  returnValidation:
    'TG-FED-2025-RETURN-VALIDATION'
} as const;

export interface Federal1040PackInstallResult {
  packId: string;

  taxYear: number;

  authoritySourceIds: string[];

  ruleIds: string[];
}

export function installFederal1040KnowledgePack2025(
  authorities: TaxAuthoritySourceRegistry,
  rules: TaxRuleRegistry
): Federal1040PackInstallResult {

  const authorityDefinitions = [
    {
      sourceId:
        FEDERAL_1040_2025_AUTHORITY_IDS
          .form1040Instructions,

      jurisdictionLevel:
        'federal' as const,

      jurisdictionCode:
        'US',

      authorityType:
        'instruction' as const,

      title:
        '2025 Instructions for Form 1040',

      issuingAuthority:
        'Internal Revenue Service',

      taxYears:
        [2025],

      sourceUrl:
        'https://www.irs.gov/instructions/i1040gi',

      citation: {
        title:
          '2025 Instructions for Form 1040'
      }
    },

    {
      sourceId:
        FEDERAL_1040_2025_AUTHORITY_IDS
          .publication501,

      jurisdictionLevel:
        'federal' as const,

      jurisdictionCode:
        'US',

      authorityType:
        'official_guidance' as const,

      title:
        'Publication 501 (2025), Dependents, Standard Deduction, and Filing Information',

      issuingAuthority:
        'Internal Revenue Service',

      taxYears:
        [2025],

      sourceUrl:
        'https://www.irs.gov/publications/p501',

      citation: {
        title:
          'Publication 501 (2025)'
      }
    }
  ];

  for (const source of authorityDefinitions) {
    if (!authorities.get(source.sourceId)) {
      authorities.register(source);
    }
  }

  const A = [
    FEDERAL_1040_2025_AUTHORITY_IDS
      .form1040Instructions,

    FEDERAL_1040_2025_AUTHORITY_IDS
      .publication501
  ];

  const rulesToRegister = [
    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .filingStatus,

      name:
        'Federal Filing Status Classification',

      description:
        'Determines the filing-status facts and eligibility questions required for a 2025 individual federal return.',

      requiredFacts: [
        'taxpayer.maritalStatus',
        'taxpayer.maritalStatusAtYearEnd',
        'taxpayer.spouseDeath',
        'taxpayer.householdMaintenance',
        'taxpayer.qualifyingPersons'
      ],

      requiredEvidence: [
        {
          evidenceType:
            'taxpayer_declaration',
          required: true
        }
      ]
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .filingRequirement,

      name:
        'Federal Filing Requirement',

      description:
        'Collects facts required to determine whether a 2025 federal individual income tax return filing requirement exists.',

      requiredFacts: [
        'taxpayer.filingStatus',
        'taxpayer.age',
        'income.grossIncome',
        'taxpayer.dependentStatus',
        'income.selfEmploymentIndicators'
      ]
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .dependents,

      name:
        'Dependent Classification',

      description:
        'Collects and evaluates qualifying-child and qualifying-relative facts for the federal individual return.',

      requiredFacts: [
        'dependents.relationship',
        'dependents.age',
        'dependents.residency',
        'dependents.support',
        'dependents.jointReturnStatus',
        'dependents.citizenshipResidency'
      ],

      requiredEvidence: [
        {
          evidenceType:
            'dependent_identity',
          required: true
        }
      ]
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .incomeClassification,

      name:
        'Federal Income Classification',

      description:
        'Classifies validated taxpayer income inputs into federal individual-return income categories without calculating final tax.',

      requiredFacts: [
        'income.wages',
        'income.interest',
        'income.dividends',
        'income.business',
        'income.capital',
        'income.retirement',
        'income.socialSecurity',
        'income.other'
      ],

      requiredEvidence: [
        {
          evidenceType:
            'income_document',
          required: true
        }
      ]
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .adjustments,

      name:
        'Federal Adjustment Inputs',

      description:
        'Identifies adjustment-to-income categories requiring validated taxpayer facts or supporting evidence.',

      requiredFacts: [
        'adjustments.claimedCategories'
      ]
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .deductionMethod,

      name:
        'Standard or Itemized Deduction Decision Inputs',

      description:
        'Collects the facts needed to determine standard-deduction eligibility or itemized-deduction treatment.',

      requiredFacts: [
        'taxpayer.filingStatus',
        'taxpayer.age',
        'taxpayer.blind',
        'taxpayer.dependentStatus',
        'deductions.itemizedInputs',
        'taxpayer.spouseItemizes'
      ],

      requiredEvidence: [
        {
          evidenceType:
            'deduction_support',
          required: false
        }
      ]
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .credits,

      name:
        'Federal Credit Eligibility Inputs',

      description:
        'Identifies federal individual-return credit categories requiring further eligibility evaluation.',

      requiredFacts: [
        'credits.claimedCategories',
        'taxpayer.dependents',
        'taxpayer.education',
        'taxpayer.childCare',
        'taxpayer.healthCoverage'
      ],

      executionClass:
        'professional_review' as const
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .withholdingPayments,

      name:
        'Federal Withholding and Payment Inputs',

      description:
        'Collects validated federal withholding, estimated-payment, extension-payment, and prior-year credit inputs.',

      requiredFacts: [
        'payments.federalWithholding',
        'payments.estimatedPayments',
        'payments.extensionPayments',
        'payments.priorYearApplied'
      ],

      requiredEvidence: [
        {
          evidenceType:
            'payment_evidence',
          required: true
        }
      ]
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .selfEmployment,

      name:
        'Self-Employment Indicator',

      description:
        'Identifies taxpayers requiring self-employment or business-return schedule evaluation.',

      requiredFacts: [
        'business.selfEmployed',
        'business.grossReceipts',
        'business.expenses'
      ],

      executionClass:
        'professional_review' as const
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .capitalTransactions,

      name:
        'Capital Transaction Indicator',

      description:
        'Identifies securities, property, or other capital transactions requiring basis and disposition review.',

      requiredFacts: [
        'capital.transactions',
        'capital.basisEvidence'
      ],

      executionClass:
        'professional_review' as const
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .retirementIncome,

      name:
        'Retirement Income Indicator',

      description:
        'Identifies pension, annuity, IRA, and retirement-distribution inputs requiring federal tax treatment.',

      requiredFacts: [
        'retirement.distributions'
      ]
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .digitalAssets,

      name:
        'Digital Asset Activity Indicator',

      description:
        'Collects taxpayer digital-asset activity facts needed for federal return classification and follow-up.',

      requiredFacts: [
        'digitalAssets.activity'
      ],

      executionClass:
        'professional_review' as const
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .healthTaxInputs,

      name:
        'Health-Related Federal Tax Inputs',

      description:
        'Collects health-coverage and related tax facts when relevant to the federal individual return.',

      requiredFacts: [
        'health.marketplaceCoverage',
        'health.taxDocuments'
      ],

      executionClass:
        'professional_review' as const
    },

    {
      ruleId:
        FEDERAL_1040_2025_RULE_IDS
          .returnValidation,

      name:
        'Federal Return Validation Dependencies',

      description:
        'Requires completion of core federal individual-return knowledge classifications before downstream calculation or return preparation.',

      requiredFacts: [
        'taxpayer.identityValidated',
        'taxpayer.filingStatus',
        'income.validationComplete'
      ],

      dependencyRuleIds: [
        FEDERAL_1040_2025_RULE_IDS
          .filingStatus,

        FEDERAL_1040_2025_RULE_IDS
          .incomeClassification,

        FEDERAL_1040_2025_RULE_IDS
          .deductionMethod,

        FEDERAL_1040_2025_RULE_IDS
          .withholdingPayments
      ],

      executionClass:
        'professional_review' as const
    }
  ];

  for (const definition of rulesToRegister) {
    if (rules.get(definition.ruleId)) {
      continue;
    }

    rules.register({
      ruleId:
        definition.ruleId,

      name:
        definition.name,

      description:
        definition.description,

      jurisdictionLevel:
        'federal',

      jurisdictionCode:
        'US',

      taxYears:
        [2025],

      executionClass:
        definition.executionClass ??
        'informational',

      riskLevel:
        definition.executionClass ===
          'professional_review'
          ? 'material'
          : 'routine',

      authoritySourceIds:
        A,

      citations:
        A.map(sourceId => ({
          sourceId
        })),

      applicabilityConditions:
        [],

      requiredFacts:
        definition.requiredFacts,

      requiredEvidence:
        definition.requiredEvidence ?? [],

      dependencyRuleIds:
        definition.dependencyRuleIds ?? [],

      professionalReviewRequired:
        definition.executionClass ===
          'professional_review'
    });
  }

  return {
    packId:
      FEDERAL_1040_2025_PACK_ID,

    taxYear:
      FEDERAL_1040_2025_TAX_YEAR,

    authoritySourceIds:
      [...A],

    ruleIds:
      Object.values(
        FEDERAL_1040_2025_RULE_IDS
      )
  };
}
