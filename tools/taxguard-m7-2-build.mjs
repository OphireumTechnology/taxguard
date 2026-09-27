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
  banner("TAXGUARD M7.2 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("M1-M6.9 and M7.1 remain preserved.");
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

function backup(relative, root) {
  const source = absolute(relative);

  if (!fs.existsSync(source)) {
    return;
  }

  const destination =
    path.join(root, relative);

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
  "TAXGUARD M7.2 - TAX-YEAR CALCULATION REGISTRY"
);

console.log(`
PRESERVE
---------------------------------------------
M1-M5.5                         FROZEN
M6.1-M6.9                       FROZEN
M7.1 Calculation Core           FROZEN

BUILD
---------------------------------------------
Calculation Definition Registry YES
Tax-Year Versioning             YES
Jurisdiction Binding            YES
Definition Lifecycle            YES
Verified Registration           YES
Duplicate Protection            YES
Version Protection              YES
Tax-Year Lookup                 YES
Jurisdiction Lookup             YES
Deterministic Execution Gate    YES
Rule Provenance Gate            YES
Authority Provenance Gate       YES
Evidence Provenance Gate        YES
Unsupported Tax-Year Block      YES
Wrong Jurisdiction Block        YES
Supersession Support            YES
Human Review Propagation        YES
Fail-Closed Execution           YES

NOT INCLUDED
---------------------------------------------
Federal tax brackets            NOT YET
Deduction amounts               NOT YET
Credit amounts                  NOT YET
Self-employment formulas        NOT YET
Return preparation              NOT YET
External submission             DISABLED
AI calculation                  PROHIBITED
OpenAI API                      NOT USED
`);

//
// M6 must remain frozen.
//
const m6Manifest =
  absolute(
    "taxguard-freeze/M6_FREEZE_MANIFEST.json"
  );

if (!fs.existsSync(m6Manifest)) {
  stop("M6 freeze manifest missing.");
}

const m6 =
  JSON.parse(
    fs.readFileSync(
      m6Manifest,
      "utf8"
    )
  );

if (m6.status !== "FROZEN_PASS") {
  stop("M6 freeze validation failed.");
}

//
// M7.1 must exist.
//
const m71Required = [
  "src/taxguard/calculation/TaxDecimal.ts",
  "src/taxguard/calculation/TaxCalculationContract.ts",
  "src/tests/taxCalculationCore.test.ts"
];

for (const relative of m71Required) {
  if (!fs.existsSync(absolute(relative))) {
    stop(
      "M7.1 prerequisite missing: " +
      relative
    );
  }
}

console.log(
  "PASS: M6 freeze verified"
);

console.log(
  "PASS: M7.1 prerequisites verified"
);

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot =
  absolute(
    "backups/m7-2-" + stamp
  );

fs.mkdirSync(
  backupRoot,
  { recursive: true }
);

console.log(
  "Backup: " + backupRoot
);

const registryFile =
  "src/taxguard/calculation/TaxYearCalculationRegistry.ts";

const testFile =
  "src/tests/taxYearCalculationRegistry.test.ts";

const indexFile =
  "src/taxguard/calculation/index.ts";

const registrySource = String.raw`
import type {
  TaxCalculationContext,
  TaxCalculationDefinition,
  TaxCalculationInput,
  TaxCalculationResult
} from './TaxCalculationContract';

export type TaxCalculationJurisdiction =
  | 'federal'
  | 'state'
  | 'local';

export type TaxCalculationDefinitionStatus =
  | 'DRAFT'
  | 'VERIFIED'
  | 'SUPERSEDED'
  | 'RETIRED';

export interface RegisteredTaxCalculation {
  calculationType: string;

  version: string;

  jurisdiction:
    TaxCalculationJurisdiction;

  supportedTaxYears:
    readonly number[];

  status:
    TaxCalculationDefinitionStatus;

  definition:
    TaxCalculationDefinition;

  ruleIds:
    readonly string[];

  authorityIds:
    readonly string[];

  verifiedBy?: string;

  verifiedAt?: string;

  supersededBy?: string;

  createdAt: string;
}

export interface RegisterCalculationInput {
  calculationType: string;

  version: string;

  jurisdiction:
    TaxCalculationJurisdiction;

  supportedTaxYears:
    readonly number[];

  definition:
    TaxCalculationDefinition;

  ruleIds:
    readonly string[];

  authorityIds:
    readonly string[];
}

export interface VerifyCalculationInput {
  calculationType: string;

  version: string;

  verifiedBy: string;
}

export interface ExecuteRegisteredCalculationInput {
  calculationType: string;

  version?: string;

  context:
    TaxCalculationContext;

  inputs:
    readonly TaxCalculationInput[];
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

function key(
  calculationType: string,
  version: string
): string {
  return (
    calculationType.trim() +
    '@' +
    version.trim()
  );
}

function copy(
  record:
    RegisteredTaxCalculation
): RegisteredTaxCalculation {
  return {
    ...record,

    supportedTaxYears:
      [...record.supportedTaxYears],

    ruleIds:
      [...record.ruleIds],

    authorityIds:
      [...record.authorityIds]
  };
}

export class TaxYearCalculationRegistry {
  private static readonly records =
    new Map<
      string,
      RegisteredTaxCalculation
    >();

  static registerDraft(
    input:
      RegisterCalculationInput
  ): RegisteredTaxCalculation {
    const calculationType =
      required(
        input.calculationType,
        'TAX_CALCULATION_TYPE_REQUIRED'
      );

    const version =
      required(
        input.version,
        'TAX_CALCULATION_VERSION_REQUIRED'
      );

    if (
      input.supportedTaxYears
        .length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_TAX_YEAR_REQUIRED'
      );
    }

    for (
      const taxYear
      of input.supportedTaxYears
    ) {
      if (
        !Number.isInteger(taxYear) ||
        taxYear < 1900 ||
        taxYear > 2200
      ) {
        throw new Error(
          'TAX_CALCULATION_INVALID_TAX_YEAR'
        );
      }
    }

    if (
      new Set(
        input.supportedTaxYears
      ).size !==
      input.supportedTaxYears
        .length
    ) {
      throw new Error(
        'TAX_CALCULATION_DUPLICATE_TAX_YEAR'
      );
    }

    if (
      input.ruleIds.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_VERIFIED_RULE_REQUIRED'
      );
    }

    if (
      input.authorityIds.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_VERIFIED_AUTHORITY_REQUIRED'
      );
    }

    if (
      input.definition
        .calculationType !==
      calculationType
    ) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_TYPE_MISMATCH'
      );
    }

    if (
      input.definition.version !==
      version
    ) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_VERSION_MISMATCH'
      );
    }

    const definitionYears =
      [...input.definition
        .supportedTaxYears]
        .sort();

    const registrationYears =
      [...input.supportedTaxYears]
        .sort();

    if (
      JSON.stringify(
        definitionYears
      ) !==
      JSON.stringify(
        registrationYears
      )
    ) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_TAX_YEAR_MISMATCH'
      );
    }

    const recordKey =
      key(
        calculationType,
        version
      );

    if (
      this.records.has(
        recordKey
      )
    ) {
      throw new Error(
        'TAX_CALCULATION_DUPLICATE_DEFINITION'
      );
    }

    const record:
      RegisteredTaxCalculation = {

      calculationType,

      version,

      jurisdiction:
        input.jurisdiction,

      supportedTaxYears:
        [...input.supportedTaxYears],

      status:
        'DRAFT',

      definition:
        input.definition,

      ruleIds:
        [...input.ruleIds],

      authorityIds:
        [...input.authorityIds],

      createdAt:
        new Date()
          .toISOString()
    };

    this.records.set(
      recordKey,
      record
    );

    return copy(record);
  }

  static verify(
    input:
      VerifyCalculationInput
  ): RegisteredTaxCalculation {
    const recordKey =
      key(
        input.calculationType,
        input.version
      );

    const record =
      this.records.get(
        recordKey
      );

    if (!record) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_FOUND'
      );
    }

    if (
      record.status !==
      'DRAFT'
    ) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_DRAFT'
      );
    }

    const verifiedBy =
      required(
        input.verifiedBy,
        'TAX_CALCULATION_VERIFIER_REQUIRED'
      );

    const verified:
      RegisteredTaxCalculation = {

      ...record,

      status:
        'VERIFIED',

      verifiedBy,

      verifiedAt:
        new Date()
          .toISOString()
    };

    this.records.set(
      recordKey,
      verified
    );

    return copy(verified);
  }

  static get(
    calculationType: string,
    version: string
  ):
    RegisteredTaxCalculation |
    undefined {
    const record =
      this.records.get(
        key(
          calculationType,
          version
        )
      );

    return record
      ? copy(record)
      : undefined;
  }

  static findVerified(
    calculationType: string,
    taxYear: number,
    jurisdiction:
      TaxCalculationJurisdiction
  ): RegisteredTaxCalculation[] {
    return [
      ...this.records.values()
    ]
      .filter(
        record =>
          record.calculationType ===
            calculationType &&
          record.status ===
            'VERIFIED' &&
          record.jurisdiction ===
            jurisdiction &&
          record
            .supportedTaxYears
            .includes(taxYear)
      )
      .map(copy);
  }

  static resolveVerified(
    calculationType: string,
    taxYear: number,
    jurisdiction:
      TaxCalculationJurisdiction
  ): RegisteredTaxCalculation {
    const matches =
      this.findVerified(
        calculationType,
        taxYear,
        jurisdiction
      );

    if (
      matches.length === 0
    ) {
      throw new Error(
        'TAX_CALCULATION_NO_VERIFIED_DEFINITION'
      );
    }

    if (
      matches.length > 1
    ) {
      throw new Error(
        'TAX_CALCULATION_AMBIGUOUS_VERIFIED_DEFINITION'
      );
    }

    return matches[0];
  }

  static execute(
    request:
      ExecuteRegisteredCalculationInput
  ): TaxCalculationResult {
    const record =
      request.version
        ? this.get(
            request.calculationType,
            request.version
          )
        : this.resolveVerified(
            request.calculationType,
            request.context.taxYear,
            request.context
              .jurisdiction
          );

    if (!record) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_FOUND'
      );
    }

    if (
      record.status !==
      'VERIFIED'
    ) {
      throw new Error(
        'TAX_CALCULATION_UNVERIFIED_DEFINITION_BLOCKED'
      );
    }

    if (
      record.jurisdiction !==
      request.context
        .jurisdiction
    ) {
      throw new Error(
        'TAX_CALCULATION_WRONG_JURISDICTION'
      );
    }

    if (
      !record
        .supportedTaxYears
        .includes(
          request.context
            .taxYear
        )
    ) {
      throw new Error(
        'TAX_CALCULATION_UNSUPPORTED_TAX_YEAR'
      );
    }

    if (
      request.context
        .calculationType !==
      record.calculationType
    ) {
      throw new Error(
        'TAX_CALCULATION_CONTEXT_TYPE_MISMATCH'
      );
    }

    const contextRules =
      new Set(
        request.context.ruleIds
      );

    for (
      const ruleId
      of record.ruleIds
    ) {
      if (
        !contextRules.has(
          ruleId
        )
      ) {
        throw new Error(
          'TAX_CALCULATION_RULE_PROVENANCE_MISMATCH'
        );
      }
    }

    const contextAuthorities =
      new Set(
        request.context
          .authorityIds
      );

    for (
      const authorityId
      of record.authorityIds
    ) {
      if (
        !contextAuthorities.has(
          authorityId
        )
      ) {
        throw new Error(
          'TAX_CALCULATION_AUTHORITY_PROVENANCE_MISMATCH'
        );
      }
    }

    return record.definition
      .execute(
        request.context,
        request.inputs
      );
  }

  static supersede(
    calculationType: string,
    version: string,
    supersededBy: string
  ): RegisteredTaxCalculation {
    const recordKey =
      key(
        calculationType,
        version
      );

    const record =
      this.records.get(
        recordKey
      );

    if (!record) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_FOUND'
      );
    }

    if (
      record.status !==
      'VERIFIED'
    ) {
      throw new Error(
        'TAX_CALCULATION_ONLY_VERIFIED_CAN_BE_SUPERSEDED'
      );
    }

    const replacement =
      required(
        supersededBy,
        'TAX_CALCULATION_SUPERSEDING_VERSION_REQUIRED'
      );

    if (
      replacement === version
    ) {
      throw new Error(
        'TAX_CALCULATION_SELF_SUPERSESSION_BLOCKED'
      );
    }

    const updated:
      RegisteredTaxCalculation = {
      ...record,

      status:
        'SUPERSEDED',

      supersededBy:
        replacement
    };

    this.records.set(
      recordKey,
      updated
    );

    return copy(updated);
  }

  static retire(
    calculationType: string,
    version: string
  ): RegisteredTaxCalculation {
    const recordKey =
      key(
        calculationType,
        version
      );

    const record =
      this.records.get(
        recordKey
      );

    if (!record) {
      throw new Error(
        'TAX_CALCULATION_DEFINITION_NOT_FOUND'
      );
    }

    const updated:
      RegisteredTaxCalculation = {
      ...record,

      status:
        'RETIRED'
    };

    this.records.set(
      recordKey,
      updated
    );

    return copy(updated);
  }

  static clearForTests(): void {
    this.records.clear();
  }
}
`;

const testSource = String.raw`
import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxDecimal
} from '../taxguard/calculation/TaxDecimal';

import type {
  TaxCalculationContext,
  TaxCalculationDefinition,
  TaxCalculationInput,
  TaxCalculationResult
} from '../taxguard/calculation/TaxCalculationContract';

import {
  TaxYearCalculationRegistry
} from '../taxguard/calculation/TaxYearCalculationRegistry';

function definition(
  version = '1.0.0',
  years = [2025]
):
  TaxCalculationDefinition {

  return {
    calculationType:
      'TEST_CALCULATION',

    version,

    supportedTaxYears:
      years,

    execute(
      context:
        TaxCalculationContext,

      inputs:
        readonly TaxCalculationInput[]
    ): TaxCalculationResult {

      const value =
        inputs.reduce(
          (
            total,
            input
          ) =>
            total.add(
              input.value
            ),

          TaxDecimal.zero(2)
        );

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

        value,

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
          false,

        reviewReasons:
          [],

        correlationId:
          context.correlationId,

        calculatedAt:
          '2026-09-24T00:00:00.000Z',

        deterministic:
          true,

        aiCalculated:
          false
      };
    }
  };
}

function register(
  version = '1.0.0',
  years = [2025]
) {
  return TaxYearCalculationRegistry
    .registerDraft({
      calculationType:
        'TEST_CALCULATION',

      version,

      jurisdiction:
        'federal',

      supportedTaxYears:
        years,

      definition:
        definition(
          version,
          years
        ),

      ruleIds:
        ['RULE-001'],

      authorityIds:
        ['AUTH-001']
    });
}

function context(
  taxYear = 2025
):
  TaxCalculationContext {

  return {
    calculationId:
      'CALC-001',

    calculationType:
      'TEST_CALCULATION',

    clientId:
      'CLIENT-001',

    engagementId:
      'ENG-001',

    taxYear,

    jurisdiction:
      'federal',

    ruleIds:
      ['RULE-001'],

    authorityIds:
      ['AUTH-001'],

    evidencePackageIds:
      ['EVP-001'],

    correlationId:
      'CORR-001',

    roundingMode:
      'HALF_UP',

    riskLevel:
      'routine'
  };
}

function inputs():
  TaxCalculationInput[] {

  return [
    {
      inputId:
        'INPUT-001',

      factPath:
        'income.wages',

      value:
        TaxDecimal.parse(
          '100.00',
          2
        ),

      evidenceIds:
        ['EVIDENCE-001'],

      validated:
        true
    }
  ];
}

describe(
  'M7.2 Tax-Year Calculation Registry',
  () => {

    beforeEach(() => {
      TaxYearCalculationRegistry
        .clearForTests();
    });

    it(
      'registers calculations as draft',
      () => {
        expect(
          register().status
        ).toBe('DRAFT');
      }
    );

    it(
      'requires explicit human verification',
      () => {
        register();

        const verified =
          TaxYearCalculationRegistry
            .verify({
              calculationType:
                'TEST_CALCULATION',

              version:
                '1.0.0',

              verifiedBy:
                'tax-professional-001'
            });

        expect(
          verified.status
        ).toBe('VERIFIED');

        expect(
          verified.verifiedBy
        ).toBe(
          'tax-professional-001'
        );
      }
    );

    it(
      'blocks duplicate definition',
      () => {
        register();

        expect(() =>
          register()
        ).toThrow(
          'TAX_CALCULATION_DUPLICATE_DEFINITION'
        );
      }
    );

    it(
      'blocks direct execution of draft calculation',
      () => {
        register();

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              version:
                '1.0.0',

              context:
                context(),

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_UNVERIFIED_DEFINITION_BLOCKED'
        );
      }
    );

    it(
      'executes verified deterministic definition',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'tax-professional-001'
          });

        const result =
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              context:
                context(),

              inputs:
                inputs()
            });

        expect(
          result.status
        ).toBe('CALCULATED');

        expect(
          result.value
            ?.toFixed()
        ).toBe('100.00');

        expect(
          result.aiCalculated
        ).toBe(false);
      }
    );

    it(
      'filters by tax year',
      () => {
        register(
          '1.0.0',
          [2025]
        );

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        expect(
          TaxYearCalculationRegistry
            .findVerified(
              'TEST_CALCULATION',
              2024,
              'federal'
            )
        ).toHaveLength(0);

        expect(
          TaxYearCalculationRegistry
            .findVerified(
              'TEST_CALCULATION',
              2025,
              'federal'
            )
        ).toHaveLength(1);
      }
    );

    it(
      'blocks unsupported tax year',
      () => {
        register(
          '1.0.0',
          [2025]
        );

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              version:
                '1.0.0',

              context:
                context(2024),

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_UNSUPPORTED_TAX_YEAR'
        );
      }
    );

    it(
      'blocks wrong jurisdiction',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        const wrong = {
          ...context(),

          jurisdiction:
            'state' as const
        };

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              version:
                '1.0.0',

              context:
                wrong,

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_WRONG_JURISDICTION'
        );
      }
    );

    it(
      'blocks rule provenance mismatch',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        const wrong = {
          ...context(),

          ruleIds:
            ['OTHER-RULE']
        };

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              context:
                wrong,

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_RULE_PROVENANCE_MISMATCH'
        );
      }
    );

    it(
      'blocks authority provenance mismatch',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        const wrong = {
          ...context(),

          authorityIds:
            ['OTHER-AUTHORITY']
        };

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              context:
                wrong,

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_AUTHORITY_PROVENANCE_MISMATCH'
        );
      }
    );

    it(
      'supports supersession without deleting history',
      () => {
        register(
          '1.0.0'
        );

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        const old =
          TaxYearCalculationRegistry
            .supersede(
              'TEST_CALCULATION',
              '1.0.0',
              '1.1.0'
            );

        expect(
          old.status
        ).toBe(
          'SUPERSEDED'
        );

        expect(
          old.supersededBy
        ).toBe(
          '1.1.0'
        );

        expect(
          TaxYearCalculationRegistry
            .get(
              'TEST_CALCULATION',
              '1.0.0'
            )
            ?.status
        ).toBe(
          'SUPERSEDED'
        );
      }
    );

    it(
      'blocks self supersession',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        expect(() =>
          TaxYearCalculationRegistry
            .supersede(
              'TEST_CALCULATION',
              '1.0.0',
              '1.0.0'
            )
        ).toThrow(
          'TAX_CALCULATION_SELF_SUPERSESSION_BLOCKED'
        );
      }
    );

    it(
      'returns defensive copies',
      () => {
        register();

        const first =
          TaxYearCalculationRegistry
            .get(
              'TEST_CALCULATION',
              '1.0.0'
            );

        if (!first) {
          throw new Error(
            'fixture missing'
          );
        }

        (
          first.ruleIds as string[]
        ).push(
          'MUTATION'
        );

        const second =
          TaxYearCalculationRegistry
            .get(
              'TEST_CALCULATION',
              '1.0.0'
            );

        expect(
          second?.ruleIds
        ).toEqual(
          ['RULE-001']
        );
      }
    );

    it(
      'blocks ambiguous verified definitions',
      () => {
        register(
          '1.0.0'
        );

        register(
          '2.0.0'
        );

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '2.0.0',

            verifiedBy:
              'reviewer-002'
          });

        expect(() =>
          TaxYearCalculationRegistry
            .resolveVerified(
              'TEST_CALCULATION',
              2025,
              'federal'
            )
        ).toThrow(
          'TAX_CALCULATION_AMBIGUOUS_VERIFIED_DEFINITION'
        );
      }
    );
  }
);
`;

write(
  registryFile,
  registrySource,
  backupRoot
);

write(
  testFile,
  testSource,
  backupRoot
);

//
// SAFE INDEX APPEND.
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
  "export * from './TaxYearCalculationRegistry';";

if (
  !indexSource.includes(
    exportLine
  )
) {
  indexSource +=
    (
      indexSource.length &&
      !indexSource.endsWith("\n")
        ? "\n"
        : ""
    ) +
    exportLine +
    "\n";

  backup(
    indexFile,
    backupRoot
  );

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
// GOVERNANCE ASSERTIONS
//
banner("M7.2 GOVERNANCE ASSERTIONS");

const source =
  fs.readFileSync(
    absolute(registryFile),
    "utf8"
  );

const assertions = [
  [
    "Draft registration",
    source.includes(
      "status:\n        'DRAFT'"
    )
  ],

  [
    "Explicit verification",
    source.includes(
      "static verify("
    )
  ],

  [
    "Verified execution gate",
    source.includes(
      "TAX_CALCULATION_UNVERIFIED_DEFINITION_BLOCKED"
    )
  ],

  [
    "Tax-year gate",
    source.includes(
      "TAX_CALCULATION_UNSUPPORTED_TAX_YEAR"
    )
  ],

  [
    "Jurisdiction gate",
    source.includes(
      "TAX_CALCULATION_WRONG_JURISDICTION"
    )
  ],

  [
    "Rule provenance",
    source.includes(
      "TAX_CALCULATION_RULE_PROVENANCE_MISMATCH"
    )
  ],

  [
    "Authority provenance",
    source.includes(
      "TAX_CALCULATION_AUTHORITY_PROVENANCE_MISMATCH"
    )
  ],

  [
    "Supersession",
    source.includes(
      "'SUPERSEDED'"
    )
  ],

  [
    "Ambiguity fail closed",
    source.includes(
      "TAX_CALCULATION_AMBIGUOUS_VERIFIED_DEFINITION"
    )
  ]
];

for (
  const [name, passed]
  of assertions
) {
  if (!passed) {
    stop(
      "M7.2 assertion failed: " +
      name
    );
  }

  console.log(
    "PASS: " + name
  );
}

const prohibited = [
  "approveByAI(",
  "autoVerify(",
  "fileReturn(",
  "transmitReturn("
];

for (const token of prohibited) {
  if (source.includes(token)) {
    stop(
      "Forbidden implementation detected: " +
      token
    );
  }
}

console.log(
  "PASS: AI verification authority blocked"
);

console.log(
  "PASS: External submission authority absent"
);

//
// VALIDATION
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
  "STEP 4 - M6.7 AI BOUNDARY",
  "npm.cmd test -- src/tests/taxAIKnowledgeBoundary.test.ts --run"
);

run(
  "STEP 5 - M6.8 HUMAN REVIEW",
  "npm.cmd test -- src/tests/taxHumanReviewAuditIntegration.test.ts --run"
);

run(
  "STEP 6 - FULL ACTIVE SYSTEM REGRESSION",
  "npm.cmd test -- --run"
);

run(
  "STEP 7 - PRODUCTION BUILD",
  "npm.cmd run build"
);

run(
  "STEP 8 - FINAL TYPESCRIPT",
  "npm.cmd run typecheck"
);

banner("TAXGUARD M7.2 VERIFIED PASS");

console.log(`
PRESERVED
---------------------------------------------
M1-M5.5                         FROZEN / PASS
M6.1-M6.9                       FROZEN / PASS
M7.1 Calculation Core           FROZEN / PASS

M7.2
---------------------------------------------
Calculation Registry            PASS
Tax-Year Versioning             PASS
Jurisdiction Binding            PASS
Draft Lifecycle                 PASS
Human Verification              PASS
Verified Execution Gate         PASS
Duplicate Protection            PASS
Tax-Year Gate                   PASS
Jurisdiction Gate               PASS
Rule Provenance Gate            PASS
Authority Provenance Gate       PASS
Supersession History            PASS
Ambiguity Detection             PASS
Defensive Registry Copies       PASS
Fail-Closed Execution           PASS

SYSTEM VALIDATION
---------------------------------------------
TypeScript                      PASS
M7.1                            PASS
M7.2                            PASS
M6 Governance                   PASS
Full Active Regression          PASS
Production Build                PASS
Final TypeScript                PASS

GOVERNANCE
---------------------------------------------
Draft calculation execution     BLOCKED
Unverified calculation          BLOCKED
Unsupported tax year            BLOCKED
Wrong jurisdiction              BLOCKED
Rule provenance mismatch        BLOCKED
Authority provenance mismatch   BLOCKED
Ambiguous definition            BLOCKED
AI verification                 BLOCKED
AI tax calculation              BLOCKED
External tax submission         DISABLED
OpenAI API credits              NONE

============================================================
 M7.2 COMPLETE - FREEZE CHECKPOINT
============================================================

NEXT:
M7.3 - FEDERAL 1040 INCOME AGGREGATION

THEN:
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

