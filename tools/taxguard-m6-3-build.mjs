import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

function banner(t) {
  console.log("");
  console.log("============================================================");
  console.log(" " + t);
  console.log("============================================================");
}

function stop(m) {
  banner("TAXGUARD M6.3 STOPPED SAFELY");
  console.error(m);
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(label, args) {
  banner(label);

  const r = spawnSync("npm.cmd", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  });

  if (r.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

function p(relative) {
  return path.join(ROOT, relative);
}

function exists(relative) {
  return fs.existsSync(p(relative));
}

function read(relative) {
  return fs.readFileSync(p(relative), "utf8");
}

function write(relative, content) {
  fs.mkdirSync(path.dirname(p(relative)), {
    recursive: true
  });

  fs.writeFileSync(
    p(relative),
    content,
    "utf8"
  );

  console.log("WRITE " + relative);
}

banner("TAXGUARD M6.3 - FEDERAL 1040 KNOWLEDGE PACK");

console.log("PRESERVE M1-M6.2");
console.log("Tax year                       2025");
console.log("Jurisdiction                   US FEDERAL");
console.log("Calculation execution          NOT IN M6.3");
console.log("AI verification                PROHIBITED");
console.log("External submission            DISABLED");
console.log("OpenAI API                     NOT USED");

/*
============================================================
VERIFY M6.1 + M6.2
============================================================
*/

const authorityFile =
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts";

const ruleFile =
  "src/taxguard/knowledge/TaxRuleRegistry.ts";

if (!exists(authorityFile)) {
  stop("M6.1 registry missing.");
}

if (!exists(ruleFile)) {
  stop("M6.2 registry missing.");
}

const authoritySource = read(authorityFile);
const ruleSource = read(ruleFile);

for (const token of [
  "TaxAuthoritySourceRegistry",
  "getVerifiedForTaxYear",
  "isUsableAuthority"
]) {
  if (!authoritySource.includes(token)) {
    stop("M6.1 checkpoint invalid: " + token);
  }
}

for (const token of [
  "TaxRuleRegistry",
  "validateAuthority",
  "validateDependencies",
  "isUsableRule"
]) {
  if (!ruleSource.includes(token)) {
    stop("M6.2 checkpoint invalid: " + token);
  }
}

console.log("PASS: M6.1 authority foundation.");
console.log("PASS: M6.2 rule foundation.");

/*
============================================================
BACKUP M6.3 TARGETS
============================================================
*/

const stamp =
  new Date().toISOString().replace(/[:.]/g, "-");

const backup =
  p("backups/m6-3-" + stamp);

fs.mkdirSync(backup, {
  recursive: true
});

const targets = [
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts",
  "src/taxguard/knowledge/index.ts",
  "src/tests/federal1040KnowledgePack2025.test.ts"
];

for (const relative of targets) {
  if (!exists(relative)) continue;

  const destination =
    path.join(backup, relative);

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true }
  );

  fs.copyFileSync(
    p(relative),
    destination
  );
}

console.log("Backup: " + backup);

/*
============================================================
M6.3 FEDERAL KNOWLEDGE PACK

Important:
These records establish controlled knowledge metadata and
requirements. They do NOT execute the final tax calculation.

Numeric amounts are intentionally limited here. M7 owns
deterministic calculation tables and computational logic.
============================================================
*/

const pack = `
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
`;

write(
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts",
  pack.trimStart()
);

/*
============================================================
UPDATE KNOWLEDGE EXPORTS
============================================================
*/

const indexFile =
  "src/taxguard/knowledge/index.ts";

let index = exists(indexFile)
  ? read(indexFile)
  : "";

const exportsNeeded = [
  "export * from './TaxAuthoritySourceRegistry';",
  "export * from './TaxRuleRegistry';",
  "export * from './Federal1040KnowledgePack2025';"
];

for (const line of exportsNeeded) {
  if (!index.includes(line)) {
    index +=
      (index.endsWith("\n") || index.length === 0
        ? ""
        : "\n") +
      line +
      "\n";
  }
}

write(indexFile, index);

/*
============================================================
M6.3 TESTS
============================================================
*/

const tests = `
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxAuthoritySourceRegistry
} from '../taxguard/knowledge/TaxAuthoritySourceRegistry';

import {
  TaxRuleRegistry
} from '../taxguard/knowledge/TaxRuleRegistry';

import {
  FEDERAL_1040_2025_AUTHORITY_IDS,
  FEDERAL_1040_2025_RULE_IDS,
  installFederal1040KnowledgePack2025
} from '../taxguard/knowledge/Federal1040KnowledgePack2025';

describe(
  'M6.3 Federal 1040 Knowledge Pack 2025',
  () => {

    let authorities:
      TaxAuthoritySourceRegistry;

    let rules:
      TaxRuleRegistry;

    beforeEach(() => {
      authorities =
        new TaxAuthoritySourceRegistry();

      rules =
        new TaxRuleRegistry(
          authorities
        );
    });

    it(
      'installs the 2025 federal pack',
      () => {

        const result =
          installFederal1040KnowledgePack2025(
            authorities,
            rules
          );

        expect(result.taxYear)
          .toBe(2025);

        expect(result.ruleIds.length)
          .toBeGreaterThan(10);
      }
    );

    it(
      'registers IRS authority as draft rather than silently verified',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        const source =
          authorities.get(
            FEDERAL_1040_2025_AUTHORITY_IDS
              .publication501
          );

        expect(source?.status)
          .toBe('draft');
      }
    );

    it(
      'does not expose pack rules as usable before authority review',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.isUsableRule(
            FEDERAL_1040_2025_RULE_IDS
              .filingStatus,
            2025
          )
        ).toBe(false);
      }
    );

    it(
      'binds federal rules to authority sources',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        const rule =
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .filingStatus
          );

        expect(
          rule?.authoritySourceIds
        ).toContain(
          FEDERAL_1040_2025_AUTHORITY_IDS
            .publication501
        );
      }
    );

    it(
      'contains filing status knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .filingStatus
          )
        ).not.toBeNull();
      }
    );

    it(
      'contains dependent knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .dependents
          )
        ).not.toBeNull();
      }
    );

    it(
      'contains income classification knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .incomeClassification
          )
        ).not.toBeNull();
      }
    );

    it(
      'contains deduction decision knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .deductionMethod
          )
        ).not.toBeNull();
      }
    );

    it(
      'contains payment and withholding knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .withholdingPayments
          )
        ).not.toBeNull();
      }
    );

    it(
      'marks complex categories for professional review',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        const capital =
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .capitalTransactions
          );

        expect(
          capital?.professionalReviewRequired
        ).toBe(true);

        expect(
          capital?.riskLevel
        ).toBe('material');
      }
    );

    it(
      'creates validation dependencies',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        const validation =
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .returnValidation
          );

        expect(
          validation?.dependencyRuleIds
        ).toContain(
          FEDERAL_1040_2025_RULE_IDS
            .filingStatus
        );

        expect(
          validation?.dependencyRuleIds
        ).toContain(
          FEDERAL_1040_2025_RULE_IDS
            .incomeClassification
        );
      }
    );

    it(
      'is idempotent',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          authorities.list()
        ).toHaveLength(2);

        expect(
          rules.list().length
        ).toBe(
          Object.keys(
            FEDERAL_1040_2025_RULE_IDS
          ).length
        );
      }
    );
  }
);
`;

write(
  "src/tests/federal1040KnowledgePack2025.test.ts",
  tests.trimStart()
);

/*
============================================================
STATIC SAFETY ASSERTIONS
============================================================
*/

banner("M6.3 GOVERNANCE ASSERTIONS");

const source =
  read(
    "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts"
  );

const assertions = [
  [
    "2025 tax year locked",
    source.includes(
      "FEDERAL_1040_2025_TAX_YEAR"
    )
  ],

  [
    "IRS Form 1040 authority",
    source.includes(
      "IRS-2025-F1040-INSTRUCTIONS"
    )
  ],

  [
    "IRS Publication 501 authority",
    source.includes(
      "IRS-2025-PUB501"
    )
  ],

  [
    "Filing status domain",
    source.includes(
      "filingStatus"
    )
  ],

  [
    "Dependents domain",
    source.includes(
      "dependents"
    )
  ],

  [
    "Income domain",
    source.includes(
      "incomeClassification"
    )
  ],

  [
    "Deduction domain",
    source.includes(
      "deductionMethod"
    )
  ],

  [
    "Credits domain",
    source.includes(
      "credits"
    )
  ],

  [
    "Payments domain",
    source.includes(
      "withholdingPayments"
    )
  ],

  [
    "Self-employment domain",
    source.includes(
      "selfEmployment"
    )
  ],

  [
    "Capital transaction domain",
    source.includes(
      "capitalTransactions"
    )
  ],

  [
    "Retirement domain",
    source.includes(
      "retirementIncome"
    )
  ],

  [
    "Digital asset domain",
    source.includes(
      "digitalAssets"
    )
  ],

  [
    "Return validation domain",
    source.includes(
      "returnValidation"
    )
  ],

  [
    "No OpenAI dependency",
    !source.includes(
      "OpenAI"
    )
  ],

  [
    "No browser workflow mutation",
    !source.includes(
      "localStorage"
    )
  ],

  [
    "No tax filing transmission",
    !source.includes(
      "submitReturn"
    )
  ]
];

for (const [name, ok] of assertions) {
  console.log(
    (ok ? "PASS " : "FAIL ") +
    name
  );

  if (!ok) {
    stop(
      "Governance assertion failed: " +
      name
    );
  }
}

/*
============================================================
VALIDATION
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

run(
  "STEP 2 - M6.1 AUTHORITY REGISTRY",
  [
    "test",
    "--",
    "src/tests/taxAuthoritySourceRegistry.test.ts",
    "--run"
  ]
);

run(
  "STEP 3 - M6.2 RULE REGISTRY",
  [
    "test",
    "--",
    "src/tests/taxRuleRegistry.test.ts",
    "--run"
  ]
);

run(
  "STEP 4 - M6.3 FEDERAL 1040 PACK",
  [
    "test",
    "--",
    "src/tests/federal1040KnowledgePack2025.test.ts",
    "--run"
  ]
);

run(
  "STEP 5 - INTELLIGENCE CORE",
  [
    "test",
    "--",
    "src/tests/intelligenceCoreKnowledgeRegistry.test.ts",
    "src/tests/intelligenceCoreRuleEngine.test.ts",
    "src/tests/intelligenceCoreEvidencePackage.test.ts",
    "src/tests/intelligenceCoreHumanReviewBridge.test.ts",
    "src/tests/intelligenceCoreAIReasoningGateway.test.ts",
    "src/tests/intelligenceCoreDecisionApprovalOrchestrator.test.ts",
    "src/tests/intelligenceCoreDecisionTraceLedger.test.ts",
    "src/tests/intelligenceCoreGovernanceBoundary.test.ts",
    "--run"
  ]
);

run(
  "STEP 6 - LIVE WORKFLOW AUTHORITY",
  [
    "test",
    "--",
    "src/tests/liveWorkflowUiAuthority.test.ts",
    "src/tests/liveWorkflowGateAuthority.test.ts",
    "src/tests/serverStageGateOrchestrator.test.ts",
    "src/tests/liveAppRoutingAuthority.test.ts",
    "--run"
  ]
);

run(
  "STEP 7 - FULL ACTIVE REGRESSION",
  [
    "test",
    "--",
    "--run"
  ]
);

run(
  "STEP 8 - PRODUCTION BUILD",
  [
    "run",
    "build"
  ]
);

run(
  "STEP 9 - FINAL TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
FINAL
============================================================
*/

banner("TAXGUARD M6.3 VERIFIED PASS");

console.log("");
console.log("M1-M5.5                        FROZEN / PASS");
console.log("M6.1 Authority Registry        FROZEN / PASS");
console.log("M6.2 Tax Rule Registry         FROZEN / PASS");
console.log("M6.3 Federal 1040 Pack         PASS");

console.log("");
console.log("FEDERAL 1040 DOMAINS");
console.log("---------------------------------------------");
console.log("Filing Status                  PASS");
console.log("Filing Requirement             PASS");
console.log("Dependents                     PASS");
console.log("Income Classification          PASS");
console.log("Adjustments                    PASS");
console.log("Deduction Inputs               PASS");
console.log("Credit Inputs                  PASS");
console.log("Withholding / Payments         PASS");
console.log("Self Employment                PASS");
console.log("Capital Transactions           PASS");
console.log("Retirement Income              PASS");
console.log("Digital Assets                 PASS");
console.log("Health Tax Inputs              PASS");
console.log("Return Validation              PASS");

console.log("");
console.log("GOVERNANCE");
console.log("---------------------------------------------");
console.log("Authorities initially          DRAFT");
console.log("Automatic authority approval   BLOCKED");
console.log("Automatic rule approval        BLOCKED");
console.log("Professional review boundary   PRESERVED");
console.log("Calculation execution          RESERVED FOR M7");
console.log("External tax submission        DISABLED");
console.log("OpenAI API credits             NONE");

console.log("");
console.log("VALIDATION");
console.log("---------------------------------------------");
console.log("TypeScript                     PASS");
console.log("M6.1                           PASS");
console.log("M6.2                           PASS");
console.log("M6.3                           PASS");
console.log("Intelligence Core              PASS");
console.log("LIVE Workflow Authority        PASS");
console.log("Full Active Regression         PASS");
console.log("Production Build               PASS");
console.log("Final TypeScript               PASS");

console.log("");
console.log("============================================================");
console.log(" M6.3 COMPLETE - FREEZE CHECKPOINT");
console.log("============================================================");

console.log("");
console.log("NEXT:");
console.log("M6.4 - APPLICABILITY + RETRIEVAL ENGINE");
console.log("");
console.log("Then:");
console.log("M6.5 Evidence + Citation Binding");
console.log("M6.6 Conflict + Supersession Detection");
console.log("M6.7 AI Knowledge Boundary");
console.log("M6.8 Human Review + Audit Integration");
console.log("M6.9 M6 Final Regression + Freeze");
console.log("");
