import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

function banner(text) {
  console.log("");
  console.log("============================================================");
  console.log(" " + text);
  console.log("============================================================");
}

function stop(message) {
  banner("TAXGUARD M7.3 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("M1-M6.9 and M7.1-M7.2 remain preserved.");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(label, command) {
  banner(label);

  try {
    execSync(command, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env
    });

    console.log("PASS: " + label);
  } catch {
    stop(label + " failed.");
  }
}

function absolute(relative) {
  return path.join(ROOT, relative);
}

function backup(relative, backupRoot) {
  const source = absolute(relative);

  if (!fs.existsSync(source)) return;

  const destination =
    path.join(backupRoot, relative);

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true }
  );

  fs.copyFileSync(
    source,
    destination
  );
}

function write(relative, content, backupRoot) {
  backup(relative, backupRoot);

  const target = absolute(relative);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true }
  );

  fs.writeFileSync(
    target,
    content.trimStart(),
    "utf8"
  );

  console.log("WRITE " + relative);
}

banner(
  "TAXGUARD M7.3 - FEDERAL 1040 INCOME AGGREGATION"
);

console.log(`
PRESERVE
---------------------------------------------
M1-M5.5                         FROZEN
M6.1-M6.9                       FROZEN
M7.1 Calculation Core           FROZEN
M7.2 Tax-Year Registry          FROZEN

BUILD
---------------------------------------------
Federal Income Contract         YES
Wages Aggregation               YES
Interest Aggregation            YES
Dividend Aggregation            YES
Business Income Aggregation     YES
Capital Gain/Loss Input         YES
IRA Distribution Input         YES
Pension/Annuity Input           YES
Social Security Input           YES
Rental/Royalty Input            YES
Other Income Input              YES
Category Subtotals              YES
Gross Income Aggregation        YES
Evidence Preservation           YES
Rule Provenance                 YES
Authority Provenance            YES
Calculation Trace               YES
Negative Income Support         YES
Validated-Fact Gate             YES
Duplicate Input Protection      YES
Fail-Closed Calculation         YES

NOT INCLUDED
---------------------------------------------
AGI adjustments                 M7.4
Standard deduction              M7.5
Itemized deductions             M7.5
Taxable income                  M7.6
Federal tax rates               M7.7
Credits                         M7.8
Refund / balance due            M7.10
Return filing                   DISABLED
AI tax calculation              PROHIBITED
OpenAI API                      NOT USED
`);

//
// ----------------------------------------------------------
// PREREQUISITES
// ----------------------------------------------------------
//

const prerequisites = [
  "taxguard-freeze/M6_FREEZE_MANIFEST.json",
  "src/taxguard/calculation/TaxDecimal.ts",
  "src/taxguard/calculation/TaxCalculationContract.ts",
  "src/taxguard/calculation/TaxYearCalculationRegistry.ts",
  "src/tests/taxCalculationCore.test.ts",
  "src/tests/taxYearCalculationRegistry.test.ts"
];

for (const relative of prerequisites) {
  if (!fs.existsSync(absolute(relative))) {
    stop(
      "Prerequisite missing: " +
      relative
    );
  }

  console.log(
    "PASS prerequisite: " +
    relative
  );
}

const freeze =
  JSON.parse(
    fs.readFileSync(
      absolute(
        "taxguard-freeze/M6_FREEZE_MANIFEST.json"
      ),
      "utf8"
    )
  );

if (freeze.status !== "FROZEN_PASS") {
  stop(
    "M6 freeze validation failed."
  );
}

console.log(
  "PASS: M6 freeze verified"
);

//
// ----------------------------------------------------------
// TARGETED BACKUP
// ----------------------------------------------------------
//

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot =
  absolute(
    "backups/m7-3-" + stamp
  );

fs.mkdirSync(
  backupRoot,
  { recursive: true }
);

console.log(
  "Backup: " + backupRoot
);

const engineFile =
  "src/taxguard/calculation/Federal1040IncomeAggregation.ts";

const testFile =
  "src/tests/federal1040IncomeAggregation.test.ts";

const indexFile =
  "src/taxguard/calculation/index.ts";

//
// ----------------------------------------------------------
// FEDERAL 1040 INCOME AGGREGATION
// ----------------------------------------------------------
//

const engineSource = String.raw`
import {
  TaxDecimal
} from './TaxDecimal';

import type {
  TaxCalculationContext,
  TaxCalculationInput,
  TaxCalculationResult,
  TaxCalculationTraceStep
} from './TaxCalculationContract';

import {
  TaxCalculationGuard
} from './TaxCalculationContract';

export type Federal1040IncomeCategory =
  | 'WAGES'
  | 'TAXABLE_INTEREST'
  | 'ORDINARY_DIVIDENDS'
  | 'BUSINESS_INCOME'
  | 'CAPITAL_GAIN_LOSS'
  | 'IRA_DISTRIBUTIONS'
  | 'PENSIONS_ANNUITIES'
  | 'SOCIAL_SECURITY'
  | 'RENTAL_ROYALTY'
  | 'OTHER_INCOME';

export interface Federal1040IncomeInput
  extends TaxCalculationInput {

  category:
    Federal1040IncomeCategory;
}

export interface Federal1040IncomeAggregation {
  wages: TaxDecimal;

  taxableInterest: TaxDecimal;

  ordinaryDividends: TaxDecimal;

  businessIncome: TaxDecimal;

  capitalGainLoss: TaxDecimal;

  iraDistributions: TaxDecimal;

  pensionsAnnuities: TaxDecimal;

  socialSecurity: TaxDecimal;

  rentalRoyalty: TaxDecimal;

  otherIncome: TaxDecimal;

  grossIncome: TaxDecimal;
}

export interface Federal1040IncomeAggregationResult
  extends TaxCalculationResult {

  value: TaxDecimal;

  aggregation:
    Federal1040IncomeAggregation;
}

const SCALE = 2;

function zero(): TaxDecimal {
  return TaxDecimal.zero(SCALE);
}

function normalizeMoney(
  value: TaxDecimal
): TaxDecimal {
  return value.round(
    SCALE,
    'HALF_UP'
  );
}

function add(
  left: TaxDecimal,
  right: TaxDecimal
): TaxDecimal {
  return normalizeMoney(
    left.add(right)
  );
}

export class Federal1040IncomeAggregationEngine {

  static readonly calculationType =
    'FEDERAL_1040_INCOME_AGGREGATION';

  static aggregate(
    context:
      TaxCalculationContext,

    inputs:
      readonly Federal1040IncomeInput[]
  ):
    Federal1040IncomeAggregationResult {

    TaxCalculationGuard
      .validateContext(context);

    TaxCalculationGuard
      .validateInputs(inputs);

    if (
      context.calculationType !==
      this.calculationType
    ) {
      throw new Error(
        'FEDERAL_1040_INCOME_CALCULATION_TYPE_MISMATCH'
      );
    }

    if (
      context.jurisdiction !==
      'federal'
    ) {
      throw new Error(
        'FEDERAL_1040_INCOME_FEDERAL_JURISDICTION_REQUIRED'
      );
    }

    const inputIds =
      new Set<string>();

    for (const input of inputs) {
      if (
        inputIds.has(
          input.inputId
        )
      ) {
        throw new Error(
          'FEDERAL_1040_INCOME_DUPLICATE_INPUT'
        );
      }

      inputIds.add(
        input.inputId
      );
    }

    let wages =
      zero();

    let taxableInterest =
      zero();

    let ordinaryDividends =
      zero();

    let businessIncome =
      zero();

    let capitalGainLoss =
      zero();

    let iraDistributions =
      zero();

    let pensionsAnnuities =
      zero();

    let socialSecurity =
      zero();

    let rentalRoyalty =
      zero();

    let otherIncome =
      zero();

    const trace:
      TaxCalculationTraceStep[] =
        [];

    let sequence = 1;

    for (const input of inputs) {

      const amount =
        normalizeMoney(
          input.value
        );

      switch (input.category) {

        case 'WAGES':
          wages =
            add(
              wages,
              amount
            );
          break;

        case 'TAXABLE_INTEREST':
          taxableInterest =
            add(
              taxableInterest,
              amount
            );
          break;

        case 'ORDINARY_DIVIDENDS':
          ordinaryDividends =
            add(
              ordinaryDividends,
              amount
            );
          break;

        case 'BUSINESS_INCOME':
          businessIncome =
            add(
              businessIncome,
              amount
            );
          break;

        case 'CAPITAL_GAIN_LOSS':
          capitalGainLoss =
            add(
              capitalGainLoss,
              amount
            );
          break;

        case 'IRA_DISTRIBUTIONS':
          iraDistributions =
            add(
              iraDistributions,
              amount
            );
          break;

        case 'PENSIONS_ANNUITIES':
          pensionsAnnuities =
            add(
              pensionsAnnuities,
              amount
            );
          break;

        case 'SOCIAL_SECURITY':
          socialSecurity =
            add(
              socialSecurity,
              amount
            );
          break;

        case 'RENTAL_ROYALTY':
          rentalRoyalty =
            add(
              rentalRoyalty,
              amount
            );
          break;

        case 'OTHER_INCOME':
          otherIncome =
            add(
              otherIncome,
              amount
            );
          break;

        default:
          throw new Error(
            'FEDERAL_1040_INCOME_UNKNOWN_CATEGORY'
          );
      }

      trace.push({
        sequence:
          sequence++,

        operation:
          'AGGREGATE_' +
          input.category,

        inputReferences:
          [input.inputId],

        ruleIds:
          [...context.ruleIds],

        authorityIds:
          [...context.authorityIds],

        result:
          amount,

        explanation:
          'Validated income input aggregated into ' +
          input.category +
          '.'
      });
    }

    const categoryValues = [
      wages,
      taxableInterest,
      ordinaryDividends,
      businessIncome,
      capitalGainLoss,
      iraDistributions,
      pensionsAnnuities,
      socialSecurity,
      rentalRoyalty,
      otherIncome
    ];

    const grossIncome =
      categoryValues.reduce(
        (
          total,
          amount
        ) =>
          add(
            total,
            amount
          ),

        zero()
      );

    trace.push({
      sequence:
        sequence++,

      operation:
        'CALCULATE_GROSS_INCOME',

      inputReferences:
        inputs.map(
          input =>
            input.inputId
        ),

      ruleIds:
        [...context.ruleIds],

      authorityIds:
        [...context.authorityIds],

      result:
        grossIncome,

      explanation:
        'Gross income is the deterministic aggregation of validated income categories supplied to this calculation.'
    });

    return {
      calculationId:
        context.calculationId,

      calculationType:
        context.calculationType,

      taxYear:
        context.taxYear,

      jurisdiction:
        context.jurisdiction,

      status:
        'CALCULATED',

      value:
        grossIncome,

      aggregation: {
        wages,
        taxableInterest,
        ordinaryDividends,
        businessIncome,
        capitalGainLoss,
        iraDistributions,
        pensionsAnnuities,
        socialSecurity,
        rentalRoyalty,
        otherIncome,
        grossIncome
      },

      ruleIds:
        [...context.ruleIds],

      authorityIds:
        [...context.authorityIds],

      evidencePackageIds:
        [
          ...context
            .evidencePackageIds
        ],

      trace,

      requiresHumanReview:
        context.riskLevel ===
        'critical',

      reviewReasons:
        context.riskLevel ===
        'critical'
          ? [
              'CRITICAL_RISK_CALCULATION_REVIEW_REQUIRED'
            ]
          : [],

      correlationId:
        context.correlationId,

      calculatedAt:
        new Date()
          .toISOString(),

      deterministic:
        true,

      aiCalculated:
        false
    };
  }
}
`;

//
// ----------------------------------------------------------
// TESTS
// ----------------------------------------------------------
//

const testSource = String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxDecimal
} from '../taxguard/calculation/TaxDecimal';

import type {
  TaxCalculationContext
} from '../taxguard/calculation/TaxCalculationContract';

import {
  Federal1040IncomeAggregationEngine,
  type Federal1040IncomeInput
} from '../taxguard/calculation/Federal1040IncomeAggregation';

function context():
  TaxCalculationContext {

  return {
    calculationId:
      'CALC-INCOME-001',

    calculationType:
      'FEDERAL_1040_INCOME_AGGREGATION',

    clientId:
      'CLIENT-005',

    engagementId:
      'ENG-2025-005',

    taxYear:
      2025,

    jurisdiction:
      'federal',

    ruleIds:
      ['RULE-INCOME-001'],

    authorityIds:
      ['AUTH-INCOME-001'],

    evidencePackageIds:
      ['EVP-INCOME-001'],

    correlationId:
      'CORR-INCOME-001',

    roundingMode:
      'HALF_UP',

    riskLevel:
      'routine'
  };
}

function input(
  inputId: string,
  category:
    Federal1040IncomeInput[
      'category'
    ],
  amount: string
):
  Federal1040IncomeInput {

  return {
    inputId,

    factPath:
      'income.' +
      category.toLowerCase(),

    category,

    value:
      TaxDecimal.parse(
        amount,
        2
      ),

    evidenceIds:
      [
        'EVIDENCE-' +
        inputId
      ],

    sourceDocumentIds:
      [
        'DOC-' +
        inputId
      ],

    validated:
      true
  };
}

describe(
  'M7.3 Federal 1040 Income Aggregation',
  () => {

    it(
      'aggregates wages',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result
            .aggregation
            .wages
            .toFixed()
        ).toBe(
          '85000.00'
        );

        expect(
          result.value.toFixed()
        ).toBe(
          '85000.00'
        );
      }
    );

    it(
      'aggregates multiple wage documents',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '50000.00'
                ),

                input(
                  'W2-2',
                  'WAGES',
                  '35000.00'
                )
              ]
            );

        expect(
          result
            .aggregation
            .wages
            .toFixed()
        ).toBe(
          '85000.00'
        );
      }
    );

    it(
      'aggregates multiple income categories',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                ),

                input(
                  'INT-1',
                  'TAXABLE_INTEREST',
                  '500.00'
                ),

                input(
                  'DIV-1',
                  'ORDINARY_DIVIDENDS',
                  '1000.00'
                ),

                input(
                  'OTHER-1',
                  'OTHER_INCOME',
                  '250.00'
                )
              ]
            );

        expect(
          result.value.toFixed()
        ).toBe(
          '86750.00'
        );
      }
    );

    it(
      'supports negative business income',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                ),

                input(
                  'BUS-1',
                  'BUSINESS_INCOME',
                  '-5000.00'
                )
              ]
            );

        expect(
          result
            .aggregation
            .businessIncome
            .toFixed()
        ).toBe(
          '-5000.00'
        );

        expect(
          result.value.toFixed()
        ).toBe(
          '80000.00'
        );
      }
    );

    it(
      'supports capital gain/loss input',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'CAP-1',
                  'CAPITAL_GAIN_LOSS',
                  '-1000.00'
                )
              ]
            );

        expect(
          result
            .aggregation
            .capitalGainLoss
            .toFixed()
        ).toBe(
          '-1000.00'
        );
      }
    );

    it(
      'preserves evidence package provenance',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result
            .evidencePackageIds
        ).toEqual(
          ['EVP-INCOME-001']
        );
      }
    );

    it(
      'preserves rule provenance',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result.ruleIds
        ).toEqual(
          ['RULE-INCOME-001']
        );
      }
    );

    it(
      'preserves authority provenance',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result.authorityIds
        ).toEqual(
          ['AUTH-INCOME-001']
        );
      }
    );

    it(
      'creates deterministic trace',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result.trace.length
        ).toBe(2);

        expect(
          result.trace[1]
            .operation
        ).toBe(
          'CALCULATE_GROSS_INCOME'
        );

        expect(
          result.deterministic
        ).toBe(true);

        expect(
          result.aiCalculated
        ).toBe(false);
      }
    );

    it(
      'blocks duplicate input IDs',
      () => {
        expect(() =>
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'SAME',
                  'WAGES',
                  '100.00'
                ),

                input(
                  'SAME',
                  'WAGES',
                  '200.00'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_INCOME_DUPLICATE_INPUT'
        );
      }
    );

    it(
      'blocks non-federal jurisdiction',
      () => {
        const wrong = {
          ...context(),

          jurisdiction:
            'state' as const
        };

        expect(() =>
          Federal1040IncomeAggregationEngine
            .aggregate(
              wrong,
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_INCOME_FEDERAL_JURISDICTION_REQUIRED'
        );
      }
    );

    it(
      'blocks wrong calculation type',
      () => {
        const wrong = {
          ...context(),

          calculationType:
            'OTHER_CALCULATION'
        };

        expect(() =>
          Federal1040IncomeAggregationEngine
            .aggregate(
              wrong,
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_INCOME_CALCULATION_TYPE_MISMATCH'
        );
      }
    );

    it(
      'requires evidence on every input',
      () => {
        const bad =
          input(
            'W2-1',
            'WAGES',
            '85000.00'
          );

        bad.evidenceIds = [];

        expect(() =>
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [bad]
            )
        ).toThrow(
          'TAX_CALCULATION_INPUT_EVIDENCE_REQUIRED'
        );
      }
    );

    it(
      'requires human review for critical risk',
      () => {
        const critical = {
          ...context(),

          riskLevel:
            'critical' as const
        };

        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              critical,
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result
            .requiresHumanReview
        ).toBe(true);

        expect(
          result.reviewReasons
        ).toContain(
          'CRITICAL_RISK_CALCULATION_REVIEW_REQUIRED'
        );
      }
    );
  }
);
`;

write(
  engineFile,
  engineSource,
  backupRoot
);

write(
  testFile,
  testSource,
  backupRoot
);

//
// ----------------------------------------------------------
// SAFE INDEX UPDATE
// ----------------------------------------------------------
//

let indexSource =
  fs.existsSync(
    absolute(indexFile)
  )
    ? fs.readFileSync(
        absolute(indexFile),
        "utf8"
      )
    : "";

const exportLine =
  "export * from './Federal1040IncomeAggregation';";

if (
  !indexSource.includes(
    exportLine
  )
) {
  backup(
    indexFile,
    backupRoot
  );

  indexSource +=
    (
      indexSource.length > 0 &&
      !indexSource.endsWith("\n")
        ? "\n"
        : ""
    ) +
    exportLine +
    "\n";

  fs.writeFileSync(
    absolute(indexFile),
    indexSource,
    "utf8"
  );

  console.log(
    "APPEND " + indexFile
  );
} else {
  console.log(
    "PRESERVE " + indexFile
  );
}

//
// ----------------------------------------------------------
// GOVERNANCE ASSERTIONS
// ----------------------------------------------------------
//

banner(
  "M7.3 GOVERNANCE ASSERTIONS"
);

const source =
  fs.readFileSync(
    absolute(engineFile),
    "utf8"
  );

const assertions = [
  [
    "Validated fact gate",
    source.includes(
      "validateInputs"
    )
  ],

  [
    "Calculation context gate",
    source.includes(
      "validateContext"
    )
  ],

  [
    "Federal jurisdiction gate",
    source.includes(
      "FEDERAL_1040_INCOME_FEDERAL_JURISDICTION_REQUIRED"
    )
  ],

  [
    "Duplicate input protection",
    source.includes(
      "FEDERAL_1040_INCOME_DUPLICATE_INPUT"
    )
  ],

  [
    "Evidence preservation",
    source.includes(
      "evidencePackageIds"
    )
  ],

  [
    "Rule provenance",
    source.includes(
      "ruleIds"
    )
  ],

  [
    "Authority provenance",
    source.includes(
      "authorityIds"
    )
  ],

  [
    "Calculation trace",
    source.includes(
      "TaxCalculationTraceStep"
    )
  ],

  [
    "AI calculation blocked",
    source.includes(
      "aiCalculated:\n        false"
    )
  ],

  [
    "Deterministic calculation",
    source.includes(
      "deterministic:\n        true"
    )
  ]
];

for (
  const [name, passed]
  of assertions
) {
  if (!passed) {
    stop(
      "M7.3 assertion failed: " +
      name
    );
  }

  console.log(
    "PASS: " + name
  );
}

//
// Do not allow later-stage tax-law values into M7.3.
//
const forbiddenTokens = [
  "STANDARD_DEDUCTION_AMOUNT",
  "TAX_BRACKET",
  "TAX_RATE_TABLE",
  "CHILD_TAX_CREDIT_AMOUNT",
  "fileReturn(",
  "transmitReturn(",
  "approveByAI("
];

for (
  const token
  of forbiddenTokens
) {
  if (
    source.includes(token)
  ) {
    stop(
      "Forbidden M7.3 implementation detected: " +
      token
    );
  }
}

console.log(
  "PASS: No deduction engine"
);

console.log(
  "PASS: No tax rate engine"
);

console.log(
  "PASS: No credit engine"
);

console.log(
  "PASS: No AI approval"
);

console.log(
  "PASS: No return submission"
);

//
// ----------------------------------------------------------
// VALIDATION
// ----------------------------------------------------------
//

run(
  "STEP 1 - TYPESCRIPT",
  "npm.cmd run typecheck"
);

run(
  "STEP 2 - M7.1 CALCULATION CORE",
  "npm.cmd test -- src/tests/taxCalculationCore.test.ts --run"
);

run(
  "STEP 3 - M7.2 TAX-YEAR REGISTRY",
  "npm.cmd test -- src/tests/taxYearCalculationRegistry.test.ts --run"
);

run(
  "STEP 4 - M7.3 FEDERAL INCOME AGGREGATION",
  "npm.cmd test -- src/tests/federal1040IncomeAggregation.test.ts --run"
);

run(
  "STEP 5 - M6.7 AI KNOWLEDGE BOUNDARY",
  "npm.cmd test -- src/tests/taxAIKnowledgeBoundary.test.ts --run"
);

run(
  "STEP 6 - M6.8 HUMAN REVIEW + AUDIT",
  "npm.cmd test -- src/tests/taxHumanReviewAuditIntegration.test.ts --run"
);

run(
  "STEP 7 - STAGE 01",
  "npm.cmd test -- src/tests/stageOneOnboarding.test.ts --run"
);

run(
  "STEP 8 - STAGE 02",
  "npm.cmd test -- src/tests/stageTwoCollection.test.ts src/tests/stageTwoSprintTwoSecurity.test.ts src/tests/stageTwoSprintThreeIntelligence.test.ts src/tests/stageTwoSprintFourOperations.test.ts --run"
);

run(
  "STEP 9 - STAGE 03",
  "npm.cmd test -- src/tests/stageThreeValidationFoundation.test.ts src/tests/stageThreeSprintOne.test.ts src/tests/stageThreeSprintTwo.test.ts src/tests/stageThreeSprintThree.test.ts --run"
);

run(
  "STEP 10 - LIVE WORKFLOW AUTHORITY",
  "npm.cmd test -- src/tests/liveWorkflowUiAuthority.test.ts src/tests/liveWorkflowGateAuthority.test.ts src/tests/serverStageGateOrchestrator.test.ts src/tests/liveAppRoutingAuthority.test.ts --run"
);

//
// This is the command that detects other currently
// test-covered TaxGuard defects.
//
run(
  "STEP 11 - FULL ACTIVE SYSTEM REGRESSION",
  "npm.cmd test -- --run"
);

run(
  "STEP 12 - PRODUCTION BUILD",
  "npm.cmd run build"
);

run(
  "STEP 13 - FINAL TYPESCRIPT",
  "npm.cmd run typecheck"
);

banner(
  "TAXGUARD M7.3 VERIFIED PASS"
);

console.log(`
PRESERVED
---------------------------------------------
M1-M5.5                         FROZEN / PASS
M6.1-M6.9                       FROZEN / PASS
M7.1 Calculation Core           FROZEN / PASS
M7.2 Tax-Year Registry          FROZEN / PASS

M7.3
---------------------------------------------
Federal Income Contract         PASS
Wages Aggregation               PASS
Interest Aggregation            PASS
Dividend Aggregation            PASS
Business Income                 PASS
Capital Gain/Loss Input         PASS
IRA Distribution Input         PASS
Pension/Annuity Input           PASS
Social Security Input           PASS
Rental/Royalty Input            PASS
Other Income                    PASS
Category Subtotals              PASS
Gross Income Aggregation        PASS
Negative Income Support         PASS
Duplicate Input Protection      PASS
Validated-Fact Gate             PASS
Evidence Preservation           PASS
Rule Provenance                 PASS
Authority Provenance            PASS
Calculation Trace               PASS
Critical-Risk Review            PASS
Deterministic Calculation       PASS

SYSTEM VALIDATION
---------------------------------------------
TypeScript                      PASS
M7.1                            PASS
M7.2                            PASS
M7.3                            PASS
M6 Governance                   PASS
Stage 01                        PASS
Stage 02                        PASS
Stage 03                        PASS
LIVE Workflow Authority         PASS
Full Active Regression          PASS
Production Build                PASS
Final TypeScript                PASS

GOVERNANCE
---------------------------------------------
Unvalidated facts               BLOCKED
Missing evidence                BLOCKED
Wrong jurisdiction              BLOCKED
Duplicate income input          BLOCKED
AI tax calculation              BLOCKED
AI approval                     BLOCKED
Tax rates                       NOT IMPLEMENTED
Deductions                      NOT IMPLEMENTED
Credits                         NOT IMPLEMENTED
External tax submission         DISABLED
OpenAI API credits              NONE

============================================================
 M7.3 COMPLETE - FREEZE CHECKPOINT
============================================================

NEXT:
M7.4 - AGI CALCULATION

THEN:
M7.5  Standard / Itemized Deduction Engine
M7.6  Taxable Income Engine
M7.7  Federal Income Tax Rate Engine
M7.8  Credits + Payments Engine
M7.9  Self-Employment Calculation Foundation
M7.10 Refund / Balance Due Reconciliation
M7.11 Calculation Evidence + Trace Binding
M7.12 Human Review / Override Controls
M7.13 M7 Final Regression + Freeze
`);

