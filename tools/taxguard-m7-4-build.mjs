import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function line() {
  console.log("============================================================");
}

function section(title) {
  console.log("");
  line();
  console.log(" " + title);
  line();
}

function fail(message) {
  console.error("");
  line();
  console.error(" TAXGUARD M7.4 STOPPED SAFELY");
  line();
  console.error(message);
  console.error("");
  console.error("Frozen milestones remain preserved.");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function full(rel) {
  return path.join(ROOT, rel);
}

function write(rel, content) {
  const target = full(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  console.log("WRITE " + rel);
}

function read(rel) {
  return fs.readFileSync(full(rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(full(rel));
}

function backupFiles(files) {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  const backupRoot =
    full(`backups/m7-4-${stamp}`);

  fs.mkdirSync(backupRoot, {
    recursive: true
  });

  for (const rel of files) {
    if (!exists(rel)) continue;

    const destination =
      path.join(backupRoot, rel);

    fs.mkdirSync(
      path.dirname(destination),
      { recursive: true }
    );

    fs.copyFileSync(
      full(rel),
      destination
    );
  }

  console.log(
    "Backup: " + backupRoot
  );

  return backupRoot;
}

function run(label, command) {
  section(label);

  const cp =
    require("node:child_process");

  const result =
    cp.spawnSync(
      command,
      {
        cwd: ROOT,
        shell: true,
        stdio: "inherit",
        env: process.env
      }
    );

  if (
    result.error ||
    result.status !== 0
  ) {
    fail(label + " failed.");
  }

  console.log("");
  console.log("PASS: " + label);
}

section(
  "TAXGUARD M7.4 - AGI CALCULATION ENGINE"
);

console.log(`
PRESERVE
---------------------------------------------
M1-M5.5                         FROZEN
M6.1-M6.9                      FROZEN
M7.1 Calculation Core          FROZEN
M7.2 Tax-Year Registry         FROZEN
M7.3 Federal Income            FROZEN

BUILD
---------------------------------------------
AGI Calculation Contract       YES
Gross Income Binding           YES
Adjustment Aggregation         YES
Deterministic AGI              YES
Validated Fact Gate            YES
Evidence Gate                  YES
Rule Provenance                YES
Authority Provenance           YES
Tax-Year Binding               YES
Duplicate Protection           YES
Calculation Trace              YES
Negative AGI Support           YES
Human Review Propagation       YES
Fail-Closed Validation         YES

PROHIBITED
---------------------------------------------
AI tax calculation             DISABLED
AI-created facts               DISABLED
Missing evidence guessing      DISABLED
Missing authority guessing     DISABLED
Missing rule guessing          DISABLED
Silent calculation repair      DISABLED
Tax rate calculation           NOT M7.4
Return filing                  DISABLED
External tax submission        DISABLED
OpenAI API                     NOT USED
`);

const required = [
  "src/taxguard/calculation/TaxDecimal.ts",
  "src/taxguard/calculation/TaxCalculationContract.ts",
  "src/taxguard/calculation/TaxYearCalculationRegistry.ts",
  "src/taxguard/calculation/Federal1040IncomeAggregation.ts",
  "src/taxguard/calculation/index.ts",
  "src/tests/taxCalculationCore.test.ts",
  "src/tests/taxYearCalculationRegistry.test.ts",
  "src/tests/federal1040IncomeAggregation.test.ts"
];

for (const rel of required) {
  if (!exists(rel)) {
    fail(
      "Required frozen M7 dependency missing: " +
      rel
    );
  }
}

console.log(
  "PASS: Required M7.1-M7.3 files present"
);

const targets = [
  "src/taxguard/calculation/Federal1040AgiCalculation.ts",
  "src/taxguard/calculation/index.ts",
  "src/tests/federal1040AgiCalculation.test.ts"
];

backupFiles(targets);

const engine = String.raw`import {
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

export type Federal1040AgiInputType =
  | 'GROSS_INCOME'
  | 'ADJUSTMENT';

export type Federal1040AdjustmentCategory =
  | 'EDUCATOR_EXPENSE'
  | 'HSA_DEDUCTION'
  | 'DEDUCTIBLE_SELF_EMPLOYMENT_TAX'
  | 'SELF_EMPLOYED_RETIREMENT'
  | 'SELF_EMPLOYED_HEALTH_INSURANCE'
  | 'IRA_DEDUCTION'
  | 'STUDENT_LOAN_INTEREST'
  | 'OTHER_VERIFIED_ADJUSTMENT';

export interface Federal1040AgiInput
  extends TaxCalculationInput {

  inputType:
    Federal1040AgiInputType;

  adjustmentCategory?:
    Federal1040AdjustmentCategory;
}

export interface Federal1040AgiBreakdown {
  grossIncome: TaxDecimal;

  totalAdjustments:
    TaxDecimal;

  adjustedGrossIncome:
    TaxDecimal;

  adjustments:
    Readonly<
      Partial<
        Record<
          Federal1040AdjustmentCategory,
          TaxDecimal
        >
      >
    >;
}

export interface Federal1040AgiResult
  extends TaxCalculationResult {

  value: TaxDecimal;

  breakdown:
    Federal1040AgiBreakdown;
}

const SCALE = 2;

function zero(): TaxDecimal {
  return TaxDecimal.zero(SCALE);
}

function money(
  value: TaxDecimal,
  context:
    TaxCalculationContext
): TaxDecimal {

  return value.round(
    SCALE,
    context.roundingMode
  );
}

function add(
  left: TaxDecimal,
  right: TaxDecimal,
  context:
    TaxCalculationContext
): TaxDecimal {

  return money(
    left.add(right),
    context
  );
}

export class Federal1040AgiCalculationEngine {

  static readonly calculationType =
    'FEDERAL_1040_AGI_CALCULATION';

  static calculate(
    context:
      TaxCalculationContext,

    inputs:
      readonly Federal1040AgiInput[]
  ):
    Federal1040AgiResult {

    TaxCalculationGuard
      .validateContext(context);

    TaxCalculationGuard
      .validateInputs(inputs);

    if (
      context.calculationType !==
      this.calculationType
    ) {
      throw new Error(
        'FEDERAL_1040_AGI_CALCULATION_TYPE_MISMATCH'
      );
    }

    if (
      context.jurisdiction !==
      'federal'
    ) {
      throw new Error(
        'FEDERAL_1040_AGI_FEDERAL_JURISDICTION_REQUIRED'
      );
    }

    const inputIds =
      new Set<string>();

    const grossIncomeInputs =
      inputs.filter(
        input =>
          input.inputType ===
          'GROSS_INCOME'
      );

    if (
      grossIncomeInputs.length !== 1
    ) {
      throw new Error(
        'FEDERAL_1040_AGI_SINGLE_GROSS_INCOME_REQUIRED'
      );
    }

    for (const input of inputs) {

      if (
        inputIds.has(input.inputId)
      ) {
        throw new Error(
          'FEDERAL_1040_AGI_DUPLICATE_INPUT'
        );
      }

      inputIds.add(input.inputId);

      if (
        input.inputType ===
          'GROSS_INCOME' &&
        input.adjustmentCategory
      ) {
        throw new Error(
          'FEDERAL_1040_AGI_GROSS_INCOME_CATEGORY_NOT_ALLOWED'
        );
      }

      if (
        input.inputType ===
          'ADJUSTMENT' &&
        !input.adjustmentCategory
      ) {
        throw new Error(
          'FEDERAL_1040_AGI_ADJUSTMENT_CATEGORY_REQUIRED'
        );
      }

      if (
        input.inputType ===
          'ADJUSTMENT' &&
        input.value.isNegative()
      ) {
        throw new Error(
          'FEDERAL_1040_AGI_NEGATIVE_ADJUSTMENT_BLOCKED'
        );
      }
    }

    const grossIncome =
      money(
        grossIncomeInputs[0].value,
        context
      );

    const adjustmentTotals:
      Partial<
        Record<
          Federal1040AdjustmentCategory,
          TaxDecimal
        >
      > = {};

    let totalAdjustments =
      zero();

    const trace:
      TaxCalculationTraceStep[] =
        [];

    let sequence = 1;

    trace.push({
      sequence:
        sequence++,

      operation:
        'BIND_GROSS_INCOME',

      inputReferences:
        [
          grossIncomeInputs[0]
            .inputId
        ],

      ruleIds:
        [...context.ruleIds],

      authorityIds:
        [...context.authorityIds],

      result:
        grossIncome,

      explanation:
        'Validated gross income is bound as the starting value for deterministic AGI calculation.'
    });

    for (
      const input
      of inputs
    ) {
      if (
        input.inputType !==
        'ADJUSTMENT'
      ) {
        continue;
      }

      const category =
        input.adjustmentCategory;

      if (!category) {
        throw new Error(
          'FEDERAL_1040_AGI_ADJUSTMENT_CATEGORY_REQUIRED'
        );
      }

      const amount =
        money(
          input.value,
          context
        );

      const current =
        adjustmentTotals[
          category
        ] ?? zero();

      const updated =
        add(
          current,
          amount,
          context
        );

      adjustmentTotals[
        category
      ] = updated;

      totalAdjustments =
        add(
          totalAdjustments,
          amount,
          context
        );

      trace.push({
        sequence:
          sequence++,

        operation:
          'AGGREGATE_AGI_ADJUSTMENT_' +
          category,

        inputReferences:
          [input.inputId],

        ruleIds:
          [...context.ruleIds],

        authorityIds:
          [...context.authorityIds],

        result:
          amount,

        explanation:
          'Validated adjustment input was included in the deterministic AGI adjustment aggregation.'
      });
    }

    const adjustedGrossIncome =
      money(
        grossIncome.subtract(
          totalAdjustments
        ),
        context
      );

    trace.push({
      sequence:
        sequence++,

      operation:
        'CALCULATE_ADJUSTED_GROSS_INCOME',

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
        adjustedGrossIncome,

      explanation:
        'Adjusted gross income is deterministically calculated as validated gross income less validated adjustment inputs.'
    });

    const reviewReasons:
      string[] = [];

    if (
      context.riskLevel ===
      'critical'
    ) {
      reviewReasons.push(
        'CRITICAL_RISK_CALCULATION_REVIEW_REQUIRED'
      );
    }

    if (
      adjustedGrossIncome
        .isNegative()
    ) {
      reviewReasons.push(
        'NEGATIVE_AGI_REVIEW_REQUIRED'
      );
    }

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
        reviewReasons.length > 0
          ? 'REQUIRES_REVIEW'
          : 'CALCULATED',

      value:
        adjustedGrossIncome,

      breakdown: {
        grossIncome,

        totalAdjustments,

        adjustedGrossIncome,

        adjustments:
          { ...adjustmentTotals }
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
        reviewReasons.length > 0,

      reviewReasons,

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

write(
  "src/taxguard/calculation/Federal1040AgiCalculation.ts",
  engine
);

let index =
  read(
    "src/taxguard/calculation/index.ts"
  );

const exportLine =
  "export * from './Federal1040AgiCalculation';";

if (
  !index.includes(exportLine)
) {
  if (
    !index.endsWith("\n")
  ) {
    index += "\n";
  }

  index +=
    exportLine + "\n";

  write(
    "src/taxguard/calculation/index.ts",
    index
  );
} else {
  console.log(
    "PRESERVE src/taxguard/calculation/index.ts - export already present"
  );
}

const tests = String.raw`import {
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
  Federal1040AgiCalculationEngine,
  type Federal1040AgiInput
} from '../taxguard/calculation/Federal1040AgiCalculation';

function context(
  riskLevel:
    TaxCalculationContext[
      'riskLevel'
    ] = 'routine'
):
  TaxCalculationContext {

  return {
    calculationId:
      'CALC-AGI-001',

    calculationType:
      'FEDERAL_1040_AGI_CALCULATION',

    clientId:
      'CLIENT-005',

    engagementId:
      'ENG-2025-005',

    taxYear:
      2025,

    jurisdiction:
      'federal',

    ruleIds:
      ['RULE-AGI-001'],

    authorityIds:
      ['AUTH-AGI-001'],

    evidencePackageIds:
      ['EVP-AGI-001'],

    correlationId:
      'CORR-AGI-001',

    roundingMode:
      'HALF_UP',

    riskLevel
  };
}

function gross(
  amount: string
):
  Federal1040AgiInput {

  return {
    inputId:
      'GROSS-001',

    factPath:
      'federal1040.grossIncome',

    inputType:
      'GROSS_INCOME',

    value:
      TaxDecimal.parse(
        amount,
        2
      ),

    evidenceIds:
      ['EVIDENCE-GROSS-001'],

    sourceDocumentIds:
      ['DOC-GROSS-001'],

    validated:
      true
  };
}

function adjustment(
  id: string,
  amount: string,
  category:
    NonNullable<
      Federal1040AgiInput[
        'adjustmentCategory'
      ]
    >
):
  Federal1040AgiInput {

  return {
    inputId:
      id,

    factPath:
      'federal1040.adjustments.' +
      category.toLowerCase(),

    inputType:
      'ADJUSTMENT',

    adjustmentCategory:
      category,

    value:
      TaxDecimal.parse(
        amount,
        2
      ),

    evidenceIds:
      [
        'EVIDENCE-' + id
      ],

    sourceDocumentIds:
      [
        'DOC-' + id
      ],

    validated:
      true
  };
}

describe(
  'M7.4 Federal 1040 AGI Calculation',
  () => {

    it(
      'calculates AGI from gross income',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                )
              ]
            );

        expect(
          result.value.toFixed()
        ).toBe(
          '85000.00'
        );

        expect(
          result
            .breakdown
            .totalAdjustments
            .toFixed()
        ).toBe(
          '0.00'
        );
      }
    );

    it(
      'subtracts validated adjustments',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '2500.00',
                  'IRA_DEDUCTION'
                ),

                adjustment(
                  'ADJ-002',
                  '1000.00',
                  'HSA_DEDUCTION'
                )
              ]
            );

        expect(
          result
            .breakdown
            .totalAdjustments
            .toFixed()
        ).toBe(
          '3500.00'
        );

        expect(
          result.value.toFixed()
        ).toBe(
          '81500.00'
        );
      }
    );

    it(
      'aggregates duplicate categories without losing provenance',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '50000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '500.00',
                  'OTHER_VERIFIED_ADJUSTMENT'
                ),

                adjustment(
                  'ADJ-002',
                  '250.00',
                  'OTHER_VERIFIED_ADJUSTMENT'
                )
              ]
            );

        expect(
          result
            .breakdown
            .adjustments
            .OTHER_VERIFIED_ADJUSTMENT
            ?.toFixed()
        ).toBe(
          '750.00'
        );

        expect(
          result.value.toFixed()
        ).toBe(
          '49250.00'
        );
      }
    );

    it(
      'requires exactly one gross income input',
      () => {
        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                adjustment(
                  'ADJ-001',
                  '100.00',
                  'OTHER_VERIFIED_ADJUSTMENT'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_SINGLE_GROSS_INCOME_REQUIRED'
        );
      }
    );

    it(
      'blocks multiple gross income inputs',
      () => {
        const secondGross:
          Federal1040AgiInput = {
            ...gross(
              '1000.00'
            ),

            inputId:
              'GROSS-002'
          };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),
                secondGross
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_SINGLE_GROSS_INCOME_REQUIRED'
        );
      }
    );

    it(
      'blocks duplicate input IDs',
      () => {
        const first =
          adjustment(
            'ADJ-001',
            '100.00',
            'IRA_DEDUCTION'
          );

        const duplicate = {
          ...first,

          adjustmentCategory:
            'HSA_DEDUCTION'
              as const
        };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),
                first,
                duplicate
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_DUPLICATE_INPUT'
        );
      }
    );

    it(
      'blocks negative adjustment inputs',
      () => {
        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '-100.00',
                  'IRA_DEDUCTION'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_NEGATIVE_ADJUSTMENT_BLOCKED'
        );
      }
    );

    it(
      'requires adjustment category',
      () => {
        const bad:
          Federal1040AgiInput = {

          inputId:
            'ADJ-001',

          factPath:
            'federal1040.adjustment',

          inputType:
            'ADJUSTMENT',

          value:
            TaxDecimal.parse(
              '100.00',
              2
            ),

          evidenceIds:
            ['EVIDENCE-ADJ-001'],

          validated:
            true
        };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),
                bad
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_ADJUSTMENT_CATEGORY_REQUIRED'
        );
      }
    );

    it(
      'blocks missing evidence through the calculation guard',
      () => {
        const bad = {
          ...adjustment(
            'ADJ-001',
            '100.00',
            'IRA_DEDUCTION'
          ),

          evidenceIds:
            []
        };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),
                bad
              ]
            )
        ).toThrow(
          'TAX_CALCULATION_INPUT_EVIDENCE_REQUIRED'
        );
      }
    );

    it(
      'preserves deterministic calculation trace',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '1000.00',
                  'HSA_DEDUCTION'
                )
              ]
            );

        expect(
          result.trace.length
        ).toBe(3);

        expect(
          result.trace[
            result.trace.length - 1
          ].operation
        ).toBe(
          'CALCULATE_ADJUSTED_GROSS_INCOME'
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
      'routes negative AGI to human review',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '1000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '1500.00',
                  'OTHER_VERIFIED_ADJUSTMENT'
                )
              ]
            );

        expect(
          result.value.toFixed()
        ).toBe(
          '-500.00'
        );

        expect(
          result.status
        ).toBe(
          'REQUIRES_REVIEW'
        );

        expect(
          result.requiresHumanReview
        ).toBe(true);

        expect(
          result.reviewReasons
        ).toContain(
          'NEGATIVE_AGI_REVIEW_REQUIRED'
        );
      }
    );

    it(
      'propagates critical-risk human review',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(
                'critical'
              ),
              [
                gross(
                  '85000.00'
                )
              ]
            );

        expect(
          result.status
        ).toBe(
          'REQUIRES_REVIEW'
        );

        expect(
          result.reviewReasons
        ).toContain(
          'CRITICAL_RISK_CALCULATION_REVIEW_REQUIRED'
        );
      }
    );

    it(
      'blocks wrong jurisdiction',
      () => {
        const badContext = {
          ...context(),

          jurisdiction:
            'state' as const
        };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              badContext,
              [
                gross(
                  '85000.00'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_FEDERAL_JURISDICTION_REQUIRED'
        );
      }
    );
  }
);
`;

write(
  "src/tests/federal1040AgiCalculation.test.ts",
  tests
);

section(
  "M7.4 STATIC GOVERNANCE ASSERTIONS"
);

const source =
  read(
    "src/taxguard/calculation/Federal1040AgiCalculation.ts"
  );

const assertions = [
  [
    "Deterministic result",
    "deterministic:"
  ],
  [
    "AI calculation disabled",
    "aiCalculated:"
  ],
  [
    "Validated fact guard",
    "validateInputs"
  ],
  [
    "Context governance",
    "validateContext"
  ],
  [
    "Rule provenance",
    "ruleIds"
  ],
  [
    "Authority provenance",
    "authorityIds"
  ],
  [
    "Evidence provenance",
    "evidencePackageIds"
  ],
  [
    "AGI calculation trace",
    "CALCULATE_ADJUSTED_GROSS_INCOME"
  ],
  [
    "Human review",
    "requiresHumanReview"
  ],
  [
    "Negative AGI review",
    "NEGATIVE_AGI_REVIEW_REQUIRED"
  ]
];

for (
  const [name, token]
  of assertions
) {
  if (!source.includes(token)) {
    fail(
      "Governance assertion failed: " +
      name
    );
  }

  console.log(
    "PASS: " + name
  );
}

const forbidden = [
  "openai",
  "chatgpt",
  "Math.random(",
  "eval(",
  "localStorage",
  "submitReturn",
  "fileReturn"
];

for (const token of forbidden) {
  if (
    source
      .toLowerCase()
      .includes(
        token.toLowerCase()
      )
  ) {
    fail(
      "Forbidden M7.4 dependency detected: " +
      token
    );
  }
}

console.log(
  "PASS: No AI/OpenAI calculation dependency"
);

console.log(
  "PASS: No browser calculation authority"
);

console.log(
  "PASS: No return filing authority"
);

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
  "STEP 4 - M7.3 FEDERAL INCOME",
  "npm.cmd test -- src/tests/federal1040IncomeAggregation.test.ts --run"
);

run(
  "STEP 5 - M7.4 AGI CALCULATION",
  "npm.cmd test -- src/tests/federal1040AgiCalculation.test.ts --run"
);

run(
  "STEP 6 - M6 GOVERNANCE REGRESSION",
  "npm.cmd test -- src/tests/taxAuthoritySourceRegistry.test.ts src/tests/taxRuleRegistry.test.ts src/tests/federal1040KnowledgePack.test.ts src/tests/taxRuleApplicabilityEngine.test.ts src/tests/taxEvidenceCitationBinding.test.ts src/tests/taxKnowledgeConflictEngine.test.ts src/tests/taxAIKnowledgeBoundary.test.ts src/tests/taxHumanReviewAuditIntegration.test.ts --run"
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
  "npm.cmd test -- src/tests/liveWorkflowGateAuthority.test.ts src/tests/liveWorkflowUIAuthority.test.ts src/tests/liveIntelligenceCoreKnowledgeRegistry.test.ts --run"
);

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

section(
  "TAXGUARD M7.4 VERIFIED PASS"
);

console.log(`
PRESERVED
---------------------------------------------
M1-M5.5                        FROZEN / PASS
M6.1-M6.9                      FROZEN / PASS
M7.1 Calculation Core          FROZEN / PASS
M7.2 Tax-Year Registry         FROZEN / PASS
M7.3 Federal Income            FROZEN / PASS

M7.4
---------------------------------------------
AGI Calculation Engine         PASS
Gross Income Binding           PASS
Adjustment Aggregation         PASS
Deterministic AGI              PASS
Validated Fact Gate            PASS
Evidence Provenance            PASS
Rule Provenance                PASS
Authority Provenance           PASS
Tax-Year Context               PASS
Duplicate Protection           PASS
Negative AGI Handling          PASS
Calculation Trace              PASS
Human Review Routing           PASS
Fail-Closed Validation         PASS

SYSTEM VALIDATION
---------------------------------------------
TypeScript                     PASS
M7.1                           PASS
M7.2                           PASS
M7.3                           PASS
M7.4                           PASS
M6 Governance                  PASS
Stage 01                       PASS
Stage 02                       PASS
Stage 03                       PASS
LIVE Workflow Authority        PASS
Full Active Regression         PASS
Production Build               PASS
Final TypeScript               PASS

GOVERNANCE
---------------------------------------------
JavaScript floating money      NOT USED
AI tax calculation             BLOCKED
AI-created facts               BLOCKED
Missing evidence guessing      BLOCKED
Missing authority guessing     BLOCKED
Missing rule guessing          BLOCKED
Silent calculation repair      BLOCKED
Negative AGI                   HUMAN REVIEW
Critical-risk calculation      HUMAN REVIEW
Browser workflow authority     BLOCKED
External tax submission        DISABLED
OpenAI API credits             NONE

============================================================
 M7.4 COMPLETE - FREEZE CHECKPOINT
============================================================

NEXT:
M7.5 - STANDARD / ITEMIZED DEDUCTION ENGINE

THEN:
M7.6  Taxable Income Engine
M7.7  Federal Income Tax Rate Engine
M7.8  Credits + Payments Engine
M7.9  Self-Employment Calculation Foundation
M7.10 Refund / Balance Due Reconciliation
M7.11 Calculation Evidence + Trace Binding
M7.12 Human Review / Override Controls
M7.13 M7 Final Regression + Freeze
`);

process.exit(0);

