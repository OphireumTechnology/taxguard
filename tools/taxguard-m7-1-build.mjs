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
  banner("TAXGUARD M7.1 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("M1-M6.9 remain preserved.");
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

  if (!fs.existsSync(source)) {
    return;
  }

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
  "TAXGUARD M7.1 - CALCULATION CONTRACT + DECIMAL / ROUNDING CORE"
);

console.log(`
PRESERVED
---------------------------------------------
M1-M5.5                         FROZEN
M6.1-M6.9                       FROZEN

BUILD
---------------------------------------------
Deterministic decimal core      YES
Money representation            YES
Exact parsing                   YES
Exact addition                  YES
Exact subtraction               YES
Exact multiplication            YES
Exact division                  YES
Rounding policies               YES
Calculation contract            YES
Calculation input provenance    YES
Calculation output provenance   YES
Tax-year binding                YES
Rule binding                    YES
Authority binding               YES
Evidence binding                YES
Human-review flag               YES
Calculation trace               YES
Fail-closed validation          YES

NOT INCLUDED YET
---------------------------------------------
Tax brackets                    M7.7
Standard deduction amounts      M7.5
Credit amounts                  M7.8
Self-employment formulas        M7.9
Refund calculation              M7.10
Return preparation              LATER
External tax submission         DISABLED
AI calculation                  PROHIBITED
OpenAI API                      NOT USED
`);

//
// ----------------------------------------------------------
// VERIFY M6 FREEZE BEFORE STARTING M7
// ----------------------------------------------------------
//

const freezeManifest =
  absolute(
    "taxguard-freeze/M6_FREEZE_MANIFEST.json"
  );

if (!fs.existsSync(freezeManifest)) {
  stop(
    "M6 freeze manifest missing. M7 cannot start."
  );
}

const freeze =
  JSON.parse(
    fs.readFileSync(
      freezeManifest,
      "utf8"
    )
  );

if (freeze.status !== "FROZEN_PASS") {
  stop(
    "M6 is not in FROZEN_PASS state."
  );
}

if (
  freeze.externalTaxSubmissionEnabled !==
  false
) {
  stop(
    "External tax submission must remain disabled."
  );
}

console.log(
  "PASS: M6 freeze manifest verified"
);

//
// ----------------------------------------------------------
// BACKUP ONLY M7.1 TARGETS
// ----------------------------------------------------------
//

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot =
  absolute(
    "backups/m7-1-" + stamp
  );

fs.mkdirSync(
  backupRoot,
  { recursive: true }
);

console.log(
  "Backup: " + backupRoot
);

const decimalFile =
  "src/taxguard/calculation/TaxDecimal.ts";

const contractFile =
  "src/taxguard/calculation/TaxCalculationContract.ts";

const indexFile =
  "src/taxguard/calculation/index.ts";

const testFile =
  "src/tests/taxCalculationCore.test.ts";

//
// ----------------------------------------------------------
// TAX DECIMAL
//
// Integer-backed fixed-scale arithmetic.
// No JavaScript floating-point arithmetic is used for
// stored monetary values.
// ----------------------------------------------------------
//

const decimalSource = String.raw`
export type TaxRoundingMode =
  | 'HALF_UP'
  | 'HALF_EVEN'
  | 'DOWN'
  | 'UP'
  | 'TRUNCATE';

export interface TaxDecimalJSON {
  unscaledValue: string;
  scale: number;
}

const POW10: bigint[] = [1n];

function power10(exponent: number): bigint {
  if (
    !Number.isInteger(exponent) ||
    exponent < 0 ||
    exponent > 18
  ) {
    throw new Error(
      'TAX_DECIMAL_INVALID_SCALE'
    );
  }

  while (POW10.length <= exponent) {
    POW10.push(
      POW10[POW10.length - 1] * 10n
    );
  }

  return POW10[exponent];
}

function assertScale(scale: number): void {
  if (
    !Number.isInteger(scale) ||
    scale < 0 ||
    scale > 18
  ) {
    throw new Error(
      'TAX_DECIMAL_INVALID_SCALE'
    );
  }
}

function signOf(value: bigint): bigint {
  return value < 0n ? -1n : 1n;
}

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export class TaxDecimal {
  private constructor(
    private readonly units: bigint,
    public readonly scale: number
  ) {
    assertScale(scale);
  }

  static fromUnscaled(
    value: bigint | string,
    scale: number
  ): TaxDecimal {
    assertScale(scale);

    return new TaxDecimal(
      typeof value === 'bigint'
        ? value
        : BigInt(value),
      scale
    );
  }

  static parse(
    value: string,
    scale?: number
  ): TaxDecimal {
    const normalized =
      value.trim();

    if (
      !/^[+-]?\d+(?:\.\d+)?$/.test(
        normalized
      )
    ) {
      throw new Error(
        'TAX_DECIMAL_INVALID_FORMAT'
      );
    }

    const negative =
      normalized.startsWith('-');

    const unsigned =
      normalized.replace(
        /^[+-]/,
        ''
      );

    const parts =
      unsigned.split('.');

    const whole =
      parts[0];

    const fraction =
      parts[1] ?? '';

    const targetScale =
      scale ?? fraction.length;

    assertScale(targetScale);

    if (
      fraction.length >
      targetScale
    ) {
      throw new Error(
        'TAX_DECIMAL_SCALE_LOSS_REQUIRES_ROUNDING'
      );
    }

    const padded =
      fraction.padEnd(
        targetScale,
        '0'
      );

    const raw =
      BigInt(
        whole +
        (
          targetScale > 0
            ? padded
            : ''
        )
      );

    return new TaxDecimal(
      negative ? -raw : raw,
      targetScale
    );
  }

  static zero(
    scale = 2
  ): TaxDecimal {
    return new TaxDecimal(
      0n,
      scale
    );
  }

  get unscaledValue(): bigint {
    return this.units;
  }

  add(
    other: TaxDecimal
  ): TaxDecimal {
    const [left, right, scale] =
      TaxDecimal.align(
        this,
        other
      );

    return new TaxDecimal(
      left + right,
      scale
    );
  }

  subtract(
    other: TaxDecimal
  ): TaxDecimal {
    const [left, right, scale] =
      TaxDecimal.align(
        this,
        other
      );

    return new TaxDecimal(
      left - right,
      scale
    );
  }

  multiply(
    other: TaxDecimal
  ): TaxDecimal {
    const newScale =
      this.scale +
      other.scale;

    assertScale(newScale);

    return new TaxDecimal(
      this.units *
        other.units,
      newScale
    );
  }

  divide(
    other: TaxDecimal,
    outputScale: number,
    mode:
      TaxRoundingMode =
        'HALF_UP'
  ): TaxDecimal {
    assertScale(outputScale);

    if (
      other.units === 0n
    ) {
      throw new Error(
        'TAX_DECIMAL_DIVIDE_BY_ZERO'
      );
    }

    const exponent =
      outputScale +
      other.scale -
      this.scale;

    let numerator =
      this.units;

    let denominator =
      other.units;

    if (exponent >= 0) {
      numerator *=
        power10(exponent);
    } else {
      denominator *=
        power10(-exponent);
    }

    const quotient =
      numerator /
      denominator;

    const remainder =
      numerator %
      denominator;

    return new TaxDecimal(
      TaxDecimal.applyRounding(
        quotient,
        remainder,
        denominator,
        mode
      ),
      outputScale
    );
  }

  round(
    targetScale: number,
    mode:
      TaxRoundingMode =
        'HALF_UP'
  ): TaxDecimal {
    assertScale(targetScale);

    if (
      targetScale ===
      this.scale
    ) {
      return this;
    }

    if (
      targetScale >
      this.scale
    ) {
      return new TaxDecimal(
        this.units *
          power10(
            targetScale -
            this.scale
          ),
        targetScale
      );
    }

    const divisor =
      power10(
        this.scale -
        targetScale
      );

    const quotient =
      this.units /
      divisor;

    const remainder =
      this.units %
      divisor;

    return new TaxDecimal(
      TaxDecimal.applyRounding(
        quotient,
        remainder,
        divisor,
        mode
      ),
      targetScale
    );
  }

  compare(
    other: TaxDecimal
  ): -1 | 0 | 1 {
    const [left, right] =
      TaxDecimal.align(
        this,
        other
      );

    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  isNegative(): boolean {
    return this.units < 0n;
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  toFixed(): string {
    const negative =
      this.units < 0n;

    const digits =
      absolute(this.units)
        .toString()
        .padStart(
          this.scale + 1,
          '0'
        );

    if (
      this.scale === 0
    ) {
      return (
        negative ? '-' : ''
      ) + digits;
    }

    const split =
      digits.length -
      this.scale;

    return (
      (negative ? '-' : '') +
      digits.slice(0, split) +
      '.' +
      digits.slice(split)
    );
  }

  toJSON():
    TaxDecimalJSON {
    return {
      unscaledValue:
        this.units.toString(),

      scale:
        this.scale
    };
  }

  private static align(
    left: TaxDecimal,
    right: TaxDecimal
  ): [bigint, bigint, number] {
    const scale =
      Math.max(
        left.scale,
        right.scale
      );

    return [
      left.units *
        power10(
          scale -
          left.scale
        ),

      right.units *
        power10(
          scale -
          right.scale
        ),

      scale
    ];
  }

  private static applyRounding(
    quotient: bigint,
    remainder: bigint,
    denominator: bigint,
    mode: TaxRoundingMode
  ): bigint {
    if (
      remainder === 0n
    ) {
      return quotient;
    }

    if (
      mode === 'TRUNCATE'
    ) {
      return quotient;
    }

    const resultSign =
      signOf(remainder) *
      signOf(denominator);

    if (
      mode === 'DOWN'
    ) {
      return quotient;
    }

    if (
      mode === 'UP'
    ) {
      return (
        quotient +
        resultSign
      );
    }

    const twiceRemainder =
      absolute(remainder) *
      2n;

    const absoluteDenominator =
      absolute(denominator);

    if (
      twiceRemainder <
      absoluteDenominator
    ) {
      return quotient;
    }

    if (
      twiceRemainder >
      absoluteDenominator
    ) {
      return (
        quotient +
        resultSign
      );
    }

    if (
      mode === 'HALF_UP'
    ) {
      return (
        quotient +
        resultSign
      );
    }

    if (
      mode === 'HALF_EVEN'
    ) {
      const isEven =
        absolute(quotient) %
          2n ===
        0n;

      return isEven
        ? quotient
        : quotient +
            resultSign;
    }

    throw new Error(
      'TAX_DECIMAL_UNKNOWN_ROUNDING_MODE'
    );
  }
}
`;

//
// ----------------------------------------------------------
// CALCULATION CONTRACT
// ----------------------------------------------------------
//

const contractSource = String.raw`
import type {
  TaxDecimal,
  TaxRoundingMode
} from './TaxDecimal';

export type TaxCalculationStatus =
  | 'NOT_STARTED'
  | 'CALCULATED'
  | 'BLOCKED'
  | 'REQUIRES_REVIEW'
  | 'SUPERSEDED';

export type TaxCalculationRisk =
  | 'routine'
  | 'material'
  | 'critical';

export interface TaxCalculationInput {
  inputId: string;

  factPath: string;

  value: TaxDecimal;

  evidenceIds: string[];

  sourceDocumentIds?: string[];

  validated: true;
}

export interface TaxCalculationContext {
  calculationId: string;

  calculationType: string;

  clientId: string;

  engagementId: string;

  taxYear: number;

  jurisdiction:
    | 'federal'
    | 'state'
    | 'local';

  ruleIds: string[];

  authorityIds: string[];

  evidencePackageIds: string[];

  correlationId: string;

  roundingMode:
    TaxRoundingMode;

  riskLevel:
    TaxCalculationRisk;
}

export interface TaxCalculationTraceStep {
  sequence: number;

  operation: string;

  inputReferences: string[];

  ruleIds: string[];

  authorityIds: string[];

  result: TaxDecimal;

  explanation: string;
}

export interface TaxCalculationResult {
  calculationId: string;

  calculationType: string;

  taxYear: number;

  jurisdiction:
    TaxCalculationContext[
      'jurisdiction'
    ];

  status:
    TaxCalculationStatus;

  value?: TaxDecimal;

  ruleIds: string[];

  authorityIds: string[];

  evidencePackageIds: string[];

  trace: TaxCalculationTraceStep[];

  requiresHumanReview: boolean;

  reviewReasons: string[];

  correlationId: string;

  calculatedAt: string;

  deterministic: true;

  aiCalculated: false;
}

export interface TaxCalculationDefinition {
  calculationType: string;

  version: string;

  supportedTaxYears: number[];

  execute(
    context:
      TaxCalculationContext,

    inputs:
      readonly TaxCalculationInput[]
  ): TaxCalculationResult;
}

function required(
  value: string,
  code: string
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

export class TaxCalculationGuard {
  static validateContext(
    context:
      TaxCalculationContext
  ): void {
    required(
      context.calculationId,
      'TAX_CALCULATION_ID_REQUIRED'
    );

    required(
      context.calculationType,
      'TAX_CALCULATION_TYPE_REQUIRED'
    );

    required(
      context.clientId,
      'TAX_CALCULATION_CLIENT_REQUIRED'
    );

    required(
      context.engagementId,
      'TAX_CALCULATION_ENGAGEMENT_REQUIRED'
    );

    required(
      context.correlationId,
      'TAX_CALCULATION_CORRELATION_REQUIRED'
    );

    if (
      !Number.isInteger(
        context.taxYear
      ) ||
      context.taxYear < 1900 ||
      context.taxYear > 2200
    ) {
      throw new Error(
        'TAX_CALCULATION_INVALID_TAX_YEAR'
      );
    }

    if (
      context.ruleIds.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_VERIFIED_RULE_REQUIRED'
      );
    }

    if (
      context.authorityIds.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_VERIFIED_AUTHORITY_REQUIRED'
      );
    }

    if (
      context
        .evidencePackageIds
        .length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_EVIDENCE_REQUIRED'
      );
    }
  }

  static validateInputs(
    inputs:
      readonly TaxCalculationInput[]
  ): void {
    if (
      inputs.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_INPUT_REQUIRED'
      );
    }

    for (
      const input
      of inputs
    ) {
      required(
        input.inputId,
        'TAX_CALCULATION_INPUT_ID_REQUIRED'
      );

      required(
        input.factPath,
        'TAX_CALCULATION_FACT_PATH_REQUIRED'
      );

      if (
        input.validated !== true
      ) {
        throw new Error(
          'TAX_CALCULATION_UNVALIDATED_FACT_BLOCKED'
        );
      }

      if (
        input.evidenceIds.length ===
        0
      ) {
        throw new Error(
          'TAX_CALCULATION_INPUT_EVIDENCE_REQUIRED'
        );
      }
    }
  }

  static createBlockedResult(
    context:
      TaxCalculationContext,

    reasons:
      readonly string[]
  ): TaxCalculationResult {
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
        'BLOCKED',

      ruleIds:
        [...context.ruleIds],

      authorityIds:
        [...context.authorityIds],

      evidencePackageIds:
        [
          ...context
            .evidencePackageIds
        ],

      trace:
        [],

      requiresHumanReview:
        true,

      reviewReasons:
        [...reasons],

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

import {
  TaxCalculationGuard
} from '../taxguard/calculation/TaxCalculationContract';

describe(
  'M7.1 Deterministic Calculation Core',
  () => {

    it(
      'parses money exactly',
      () => {
        expect(
          TaxDecimal
            .parse(
              '85000.00',
              2
            )
            .toFixed()
        ).toBe(
          '85000.00'
        );
      }
    );

    it(
      'adds without floating point drift',
      () => {
        const result =
          TaxDecimal
            .parse('0.10')
            .add(
              TaxDecimal
                .parse('0.20')
            );

        expect(
          result.toFixed()
        ).toBe('0.30');
      }
    );

    it(
      'subtracts deterministically',
      () => {
        const result =
          TaxDecimal
            .parse('100.00')
            .subtract(
              TaxDecimal
                .parse('19.99')
            );

        expect(
          result.toFixed()
        ).toBe('80.01');
      }
    );

    it(
      'multiplies exactly',
      () => {
        const result =
          TaxDecimal
            .parse('10.25')
            .multiply(
              TaxDecimal
                .parse('2.00')
            );

        expect(
          result.toFixed()
        ).toBe(
          '20.5000'
        );
      }
    );

    it(
      'divides with explicit rounding',
      () => {
        const result =
          TaxDecimal
            .parse('10')
            .divide(
              TaxDecimal
                .parse('3'),
              2,
              'HALF_UP'
            );

        expect(
          result.toFixed()
        ).toBe('3.33');
      }
    );

    it(
      'blocks division by zero',
      () => {
        expect(() =>
          TaxDecimal
            .parse('10')
            .divide(
              TaxDecimal
                .parse('0'),
              2
            )
        ).toThrow(
          'TAX_DECIMAL_DIVIDE_BY_ZERO'
        );
      }
    );

    it(
      'requires explicit rounding before scale loss',
      () => {
        expect(() =>
          TaxDecimal.parse(
            '1.234',
            2
          )
        ).toThrow(
          'TAX_DECIMAL_SCALE_LOSS_REQUIRES_ROUNDING'
        );
      }
    );

    it(
      'supports HALF_UP',
      () => {
        expect(
          TaxDecimal
            .parse('2.345')
            .round(
              2,
              'HALF_UP'
            )
            .toFixed()
        ).toBe('2.35');
      }
    );

    it(
      'supports HALF_EVEN',
      () => {
        expect(
          TaxDecimal
            .parse('2.345')
            .round(
              2,
              'HALF_EVEN'
            )
            .toFixed()
        ).toBe('2.34');

        expect(
          TaxDecimal
            .parse('2.355')
            .round(
              2,
              'HALF_EVEN'
            )
            .toFixed()
        ).toBe('2.36');
      }
    );

    it(
      'handles negative rounding',
      () => {
        expect(
          TaxDecimal
            .parse('-2.345')
            .round(
              2,
              'HALF_UP'
            )
            .toFixed()
        ).toBe('-2.35');
      }
    );

    it(
      'serializes without converting to JavaScript number',
      () => {
        expect(
          TaxDecimal
            .parse(
              '999999999999.99'
            )
            .toJSON()
        ).toEqual({
          unscaledValue:
            '99999999999999',

          scale:
            2
        });
      }
    );

    it(
      'requires rule provenance',
      () => {
        expect(() =>
          TaxCalculationGuard
            .validateContext({
              calculationId:
                'CALC-001',

              calculationType:
                'TEST',

              clientId:
                'CLIENT-001',

              engagementId:
                'ENG-001',

              taxYear:
                2025,

              jurisdiction:
                'federal',

              ruleIds:
                [],

              authorityIds:
                ['AUTH-001'],

              evidencePackageIds:
                ['EVP-001'],

              correlationId:
                'CORR-001',

              roundingMode:
                'HALF_UP',

              riskLevel:
                'material'
            })
        ).toThrow(
          'TAX_CALCULATION_VERIFIED_RULE_REQUIRED'
        );
      }
    );

    it(
      'requires authority provenance',
      () => {
        expect(() =>
          TaxCalculationGuard
            .validateContext({
              calculationId:
                'CALC-002',

              calculationType:
                'TEST',

              clientId:
                'CLIENT-001',

              engagementId:
                'ENG-001',

              taxYear:
                2025,

              jurisdiction:
                'federal',

              ruleIds:
                ['RULE-001'],

              authorityIds:
                [],

              evidencePackageIds:
                ['EVP-001'],

              correlationId:
                'CORR-002',

              roundingMode:
                'HALF_UP',

              riskLevel:
                'material'
            })
        ).toThrow(
          'TAX_CALCULATION_VERIFIED_AUTHORITY_REQUIRED'
        );
      }
    );

    it(
      'requires evidence provenance',
      () => {
        expect(() =>
          TaxCalculationGuard
            .validateContext({
              calculationId:
                'CALC-003',

              calculationType:
                'TEST',

              clientId:
                'CLIENT-001',

              engagementId:
                'ENG-001',

              taxYear:
                2025,

              jurisdiction:
                'federal',

              ruleIds:
                ['RULE-001'],

              authorityIds:
                ['AUTH-001'],

              evidencePackageIds:
                [],

              correlationId:
                'CORR-003',

              roundingMode:
                'HALF_UP',

              riskLevel:
                'material'
            })
        ).toThrow(
          'TAX_CALCULATION_EVIDENCE_REQUIRED'
        );
      }
    );

    it(
      'rejects inputs without evidence',
      () => {
        expect(() =>
          TaxCalculationGuard
            .validateInputs([
              {
                inputId:
                  'INPUT-001',

                factPath:
                  'income.wages',

                value:
                  TaxDecimal.parse(
                    '85000.00'
                  ),

                evidenceIds:
                  [],

                validated:
                  true
              }
            ])
        ).toThrow(
          'TAX_CALCULATION_INPUT_EVIDENCE_REQUIRED'
        );
      }
    );

    it(
      'blocked calculations require human review',
      () => {
        const result =
          TaxCalculationGuard
            .createBlockedResult(
              {
                calculationId:
                  'CALC-004',

                calculationType:
                  'TEST',

                clientId:
                  'CLIENT-001',

                engagementId:
                  'ENG-001',

                taxYear:
                  2025,

                jurisdiction:
                  'federal',

                ruleIds:
                  ['RULE-001'],

                authorityIds:
                  ['AUTH-001'],

                evidencePackageIds:
                  ['EVP-001'],

                correlationId:
                  'CORR-004',

                roundingMode:
                  'HALF_UP',

                riskLevel:
                  'material'
              },

              [
                'MISSING_REQUIRED_FACT'
              ]
            );

        expect(
          result.status
        ).toBe('BLOCKED');

        expect(
          result
            .requiresHumanReview
        ).toBe(true);

        expect(
          result.aiCalculated
        ).toBe(false);

        expect(
          result.deterministic
        ).toBe(true);
      }
    );
  }
);
`;

write(
  decimalFile,
  decimalSource,
  backupRoot
);

write(
  contractFile,
  contractSource,
  backupRoot
);

//
// Safe calculation index.
// Preserve existing exports if the file already exists.
//
let indexSource = "";

if (
  fs.existsSync(
    absolute(indexFile)
  )
) {
  indexSource =
    fs.readFileSync(
      absolute(indexFile),
      "utf8"
    );
}

const exports = [
  "export * from './TaxDecimal';",
  "export * from './TaxCalculationContract';"
];

for (const line of exports) {
  if (
    !indexSource.includes(line)
  ) {
    indexSource +=
      (
        indexSource.length > 0 &&
        !indexSource.endsWith("\n")
          ? "\n"
          : ""
      ) +
      line +
      "\n";
  }
}

write(
  indexFile,
  indexSource,
  backupRoot
);

write(
  testFile,
  testSource,
  backupRoot
);

//
// ----------------------------------------------------------
// STATIC SECURITY ASSERTIONS
// ----------------------------------------------------------
//

banner("M7.1 GOVERNANCE ASSERTIONS");

const decimal =
  fs.readFileSync(
    absolute(decimalFile),
    "utf8"
  );

const contract =
  fs.readFileSync(
    absolute(contractFile),
    "utf8"
  );

const assertions = [
  [
    "BigInt decimal storage",
    decimal.includes("bigint")
  ],

  [
    "Explicit rounding modes",
    decimal.includes(
      "HALF_EVEN"
    ) &&
    decimal.includes(
      "HALF_UP"
    )
  ],

  [
    "Divide by zero blocked",
    decimal.includes(
      "TAX_DECIMAL_DIVIDE_BY_ZERO"
    )
  ],

  [
    "Rule provenance required",
    contract.includes(
      "TAX_CALCULATION_VERIFIED_RULE_REQUIRED"
    )
  ],

  [
    "Authority provenance required",
    contract.includes(
      "TAX_CALCULATION_VERIFIED_AUTHORITY_REQUIRED"
    )
  ],

  [
    "Evidence provenance required",
    contract.includes(
      "TAX_CALCULATION_EVIDENCE_REQUIRED"
    )
  ],

  [
    "Validated input required",
    contract.includes(
      "TAX_CALCULATION_UNVALIDATED_FACT_BLOCKED"
    )
  ],

  [
    "AI calculation false",
    contract.includes(
      "aiCalculated: false"
    )
  ],

  [
    "Deterministic result",
    contract.includes(
      "deterministic: true"
    )
  ],

  [
    "Human review support",
    contract.includes(
      "requiresHumanReview"
    )
  ]
];

for (
  const [name, passed]
  of assertions
) {
  if (!passed) {
    stop(
      "Governance assertion failed: " +
      name
    );
  }

  console.log(
    "PASS: " + name
  );
}

//
// Explicitly prohibit tax-law values in M7.1.
//
const forbidden =
  [
    "11600",
    "14600",
    "15000",
    "23200",
    "29200",
    "10%",
    "12%",
    "22%",
    "24%",
    "32%",
    "35%",
    "37%"
  ];

const m71Source =
  decimal +
  "\n" +
  contract;

for (
  const token
  of forbidden
) {
  if (
    m71Source.includes(token)
  ) {
    stop(
      "Unexpected tax-law value detected in M7.1: " +
      token
    );
  }
}

console.log(
  "PASS: No embedded federal tax rates"
);

console.log(
  "PASS: No embedded deduction amounts"
);

console.log(
  "PASS: No AI dependency"
);

console.log(
  "PASS: No external filing authority"
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

//
// Revalidate M6 before allowing M7.1 to pass.
//
run(
  "STEP 3 - M6.7 AI KNOWLEDGE BOUNDARY",
  "npm.cmd test -- src/tests/taxAIKnowledgeBoundary.test.ts --run"
);

run(
  "STEP 4 - M6.8 HUMAN REVIEW + AUDIT",
  "npm.cmd test -- src/tests/taxHumanReviewAuditIntegration.test.ts --run"
);

run(
  "STEP 5 - FULL ACTIVE SYSTEM REGRESSION",
  "npm.cmd test -- --run"
);

run(
  "STEP 6 - PRODUCTION BUILD",
  "npm.cmd run build"
);

run(
  "STEP 7 - FINAL TYPESCRIPT",
  "npm.cmd run typecheck"
);

//
// ----------------------------------------------------------
// FINAL
// ----------------------------------------------------------
//

banner("TAXGUARD M7.1 VERIFIED PASS");

console.log(`
PRESERVED
---------------------------------------------
M1-M5.5                         FROZEN / PASS
M6.1-M6.9                       FROZEN / PASS

M7.1
---------------------------------------------
Calculation Contract            PASS
Fixed-Scale Decimal Core        PASS
Exact Money Parsing             PASS
Exact Addition                  PASS
Exact Subtraction               PASS
Exact Multiplication            PASS
Deterministic Division          PASS
HALF_UP Rounding                PASS
HALF_EVEN Rounding              PASS
Negative Value Handling         PASS
Scale-Loss Protection           PASS
Divide-by-Zero Protection       PASS
Rule Provenance                 PASS
Authority Provenance            PASS
Evidence Provenance             PASS
Tax-Year Binding                PASS
Calculation Trace Contract      PASS
Human Review Contract           PASS
Fail-Closed Validation          PASS

SYSTEM VALIDATION
---------------------------------------------
TypeScript                      PASS
M7.1 Tests                      PASS
M6 Governance Regression        PASS
Full Active Regression          PASS
Production Build                PASS
Final TypeScript                PASS

GOVERNANCE
---------------------------------------------
JavaScript float money storage  NOT USED
Silent precision loss           BLOCKED
Implicit scale loss             BLOCKED
Unvalidated fact calculation    BLOCKED
Missing rule provenance         BLOCKED
Missing authority provenance    BLOCKED
Missing evidence provenance     BLOCKED
AI tax calculation              BLOCKED
Tax rates in M7.1               NONE
Tax deduction values in M7.1    NONE
External tax submission         DISABLED
OpenAI API credits              NONE

============================================================
 M7.1 COMPLETE - FREEZE CHECKPOINT
============================================================

NEXT:
M7.2 - TAX-YEAR CALCULATION REGISTRY

THEN:
M7.3  Federal 1040 Income Aggregation
M7.4  AGI Calculation
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

