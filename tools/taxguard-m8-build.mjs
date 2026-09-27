import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function write(rel, content) {
  const target = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  console.log('WROTE ' + rel);
}

write(
  'src/taxguard/preparation/Federal1040Preparation.ts',
  String.raw`
import { TaxDecimal } from '../calculation/TaxDecimal';

import type {
  TaxCalculationResult,
  TaxCalculationTraceStep
} from '../calculation/TaxCalculationContract';

export type Federal1040PreparationStatus =
  | 'DRAFT'
  | 'REQUIRES_REVIEW'
  | 'READY_FOR_APPROVAL'
  | 'APPROVED'
  | 'SUPERSEDED'
  | 'BLOCKED';

export type Federal1040LineSource =
  | 'CALCULATION'
  | 'VERIFIED_FACT';

export interface Federal1040PreparationContext {
  returnId: string;
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;
  ruleIds: string[];
  authorityIds: string[];
  evidencePackageIds: string[];
}

export interface Federal1040VerifiedFact {
  factId: string;
  factPath: string;
  value: string;
  evidenceIds: string[];
  validated: true;
}

export interface Federal1040LineBinding {
  lineId: string;
  source: Federal1040LineSource;
  sourceId: string;
  value: TaxDecimal;
  evidenceIds: string[];
  ruleIds: string[];
  authorityIds: string[];
}

export type Federal1040ScheduleCode =
  | 'SCHEDULE_1'
  | 'SCHEDULE_2'
  | 'SCHEDULE_3'
  | 'SCHEDULE_A'
  | 'SCHEDULE_B'
  | 'SCHEDULE_C'
  | 'SCHEDULE_D'
  | 'SCHEDULE_E'
  | 'SCHEDULE_SE';

export interface Federal1040ScheduleDependency {
  schedule: Federal1040ScheduleCode;
  required: boolean;
  reason: string;
  sourceIds: string[];
}

export interface Federal1040PreparedReturn {
  returnId: string;
  version: number;
  clientId: string;
  engagementId: string;
  taxYear: number;

  status:
    Federal1040PreparationStatus;

  lines:
    Readonly<
      Record<
        string,
        Federal1040LineBinding
      >
    >;

  schedules:
    readonly Federal1040ScheduleDependency[];

  calculationIds: string[];
  evidencePackageIds: string[];
  ruleIds: string[];
  authorityIds: string[];

  trace:
    readonly TaxCalculationTraceStep[];

  reviewReasons: string[];

  preparedAt: string;

  deterministic: true;
  aiPrepared: false;
  externallyFiled: false;
}

export interface Federal1040ReturnVersion {
  returnId: string;
  version: number;
  priorVersion?: number;
  createdBy: string;
  createdAt: string;
  reason: string;
  immutable: true;
}

export interface Federal1040ReviewDecision {
  reviewId: string;
  requestedBy: string;
  approvedBy?: string;
  material: boolean;
  reason: string;
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

function unique(
  values: readonly string[]
): string[] {
  return [...new Set(values)];
}

export class Federal1040PreparationGuard {

  static validateContext(
    context:
      Federal1040PreparationContext
  ): void {

    required(
      context.returnId,
      'FEDERAL_1040_RETURN_ID_REQUIRED'
    );

    required(
      context.clientId,
      'FEDERAL_1040_CLIENT_REQUIRED'
    );

    required(
      context.engagementId,
      'FEDERAL_1040_ENGAGEMENT_REQUIRED'
    );

    required(
      context.correlationId,
      'FEDERAL_1040_CORRELATION_REQUIRED'
    );

    if (
      !Number.isInteger(
        context.taxYear
      ) ||
      context.taxYear < 1900 ||
      context.taxYear > 2200
    ) {
      throw new Error(
        'FEDERAL_1040_INVALID_TAX_YEAR'
      );
    }

    if (
      context.ruleIds.length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_VERIFIED_RULE_REQUIRED'
      );
    }

    if (
      context.authorityIds.length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_VERIFIED_AUTHORITY_REQUIRED'
      );
    }

    if (
      context.evidencePackageIds
        .length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_EVIDENCE_REQUIRED'
      );
    }
  }

  static validateCalculation(
    result:
      TaxCalculationResult
  ): void {

    if (
      result.aiCalculated !== false ||
      result.deterministic !== true
    ) {
      throw new Error(
        'FEDERAL_1040_UNTRUSTED_CALCULATION_BLOCKED'
      );
    }

    if (
      result.status === 'BLOCKED' ||
      result.status === 'NOT_STARTED' ||
      result.status === 'SUPERSEDED'
    ) {
      throw new Error(
        'FEDERAL_1040_UNUSABLE_CALCULATION_BLOCKED'
      );
    }

    if (!result.value) {
      throw new Error(
        'FEDERAL_1040_CALCULATION_VALUE_REQUIRED'
      );
    }

    if (
      result.ruleIds.length === 0 ||
      result.authorityIds.length === 0 ||
      result.evidencePackageIds
        .length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_CALCULATION_PROVENANCE_REQUIRED'
      );
    }
  }

  static validateFact(
    fact:
      Federal1040VerifiedFact
  ): void {

    required(
      fact.factId,
      'FEDERAL_1040_FACT_ID_REQUIRED'
    );

    required(
      fact.factPath,
      'FEDERAL_1040_FACT_PATH_REQUIRED'
    );

    if (
      fact.validated !== true
    ) {
      throw new Error(
        'FEDERAL_1040_UNVALIDATED_FACT_BLOCKED'
      );
    }

    if (
      fact.evidenceIds.length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_FACT_EVIDENCE_REQUIRED'
      );
    }
  }
}

export class Federal1040LineMappingEngine {

  static fromCalculation(
    lineId: string,
    result:
      TaxCalculationResult
  ): Federal1040LineBinding {

    required(
      lineId,
      'FEDERAL_1040_LINE_ID_REQUIRED'
    );

    Federal1040PreparationGuard
      .validateCalculation(result);

    return {
      lineId,
      source: 'CALCULATION',
      sourceId:
        result.calculationId,

      value:
        result.value!,

      evidenceIds: [
        ...result.evidencePackageIds
      ],

      ruleIds: [
        ...result.ruleIds
      ],

      authorityIds: [
        ...result.authorityIds
      ]
    };
  }
}

export class Federal1040ScheduleDependencyEngine {

  static evaluate(
    calculations:
      readonly TaxCalculationResult[]
  ):
    Federal1040ScheduleDependency[] {

    const dependencies:
      Federal1040ScheduleDependency[] =
        [];

    const find =
      (calculationType: string) =>
        calculations.filter(
          calculation =>
            calculation
              .calculationType ===
            calculationType
        );

    const selfEmployment =
      find(
        'FEDERAL_1040_SELF_EMPLOYMENT'
      );

    if (
      selfEmployment.length > 0
    ) {
      dependencies.push({
        schedule:
          'SCHEDULE_SE',

        required:
          true,

        reason:
          'Validated self-employment calculation is present.',

        sourceIds:
          selfEmployment.map(
            calculation =>
              calculation
                .calculationId
          )
      });
    }

    const agi =
      find(
        'FEDERAL_1040_AGI_CALCULATION'
      );

    if (
      agi.length > 0
    ) {
      dependencies.push({
        schedule:
          'SCHEDULE_1',

        required:
          true,

        reason:
          'AGI calculation contains validated adjustment information requiring supporting schedule mapping.',

        sourceIds:
          agi.map(
            calculation =>
              calculation
                .calculationId
          )
      });
    }

    return dependencies;
  }
}


export class Federal1040ReturnAssemblyEngine {

  static assemble(
    context:
      Federal1040PreparationContext,

    calculations:
      readonly TaxCalculationResult[],

    lineMap:
      Readonly<
        Record<string, string>
      >
  ):
    Federal1040PreparedReturn {

    Federal1040PreparationGuard
      .validateContext(context);

    if (
      calculations.length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_CALCULATIONS_REQUIRED'
      );
    }

    calculations.forEach(
      calculation =>
        Federal1040PreparationGuard
          .validateCalculation(
            calculation
          )
    );

    const calculationById =
      new Map(
        calculations.map(
          calculation =>
            [
              calculation
                .calculationId,
              calculation
            ] as const
        )
      );

    const lines:
      Record<
        string,
        Federal1040LineBinding
      > = {};

    for (
      const [
        lineId,
        calculationId
      ]
      of Object.entries(lineMap)
    ) {

      if (
        lines[lineId]
      ) {
        throw new Error(
          'FEDERAL_1040_DUPLICATE_LINE_BINDING'
        );
      }

      const calculation =
        calculationById.get(
          calculationId
        );

      if (!calculation) {
        throw new Error(
          'FEDERAL_1040_LINE_CALCULATION_NOT_FOUND'
        );
      }

      if (
        calculation.taxYear !==
          context.taxYear ||
        calculation.jurisdiction !==
          'federal'
      ) {
        throw new Error(
          'FEDERAL_1040_CALCULATION_SCOPE_MISMATCH'
        );
      }

      lines[lineId] =
        Federal1040LineMappingEngine
          .fromCalculation(
            lineId,
            calculation
          );
    }

    const reviewReasons =
      unique(
        calculations.flatMap(
          calculation =>
            calculation
              .requiresHumanReview
              ? (
                  calculation
                    .reviewReasons
                    .length > 0
                    ? calculation
                        .reviewReasons
                    : [
                        'CALCULATION_REVIEW_REQUIRED'
                      ]
                )
              : []
        )
      );

    return {
      returnId:
        context.returnId,

      version:
        1,

      clientId:
        context.clientId,

      engagementId:
        context.engagementId,

      taxYear:
        context.taxYear,

      status:
        reviewReasons.length > 0
          ? 'REQUIRES_REVIEW'
          : 'READY_FOR_APPROVAL',

      lines,

      schedules:
        Federal1040ScheduleDependencyEngine
          .evaluate(
            calculations
          ),

      calculationIds:
        calculations.map(
          calculation =>
            calculation
              .calculationId
        ),

      evidencePackageIds:
        unique([
          ...context
            .evidencePackageIds,

          ...calculations.flatMap(
            calculation =>
              calculation
                .evidencePackageIds
          )
        ]),

      ruleIds:
        unique([
          ...context.ruleIds,

          ...calculations.flatMap(
            calculation =>
              calculation.ruleIds
          )
        ]),

      authorityIds:
        unique([
          ...context.authorityIds,

          ...calculations.flatMap(
            calculation =>
              calculation
                .authorityIds
          )
        ]),

      trace:
        calculations.flatMap(
          calculation =>
            calculation.trace
        ),

      reviewReasons,

      preparedAt:
        new Date()
          .toISOString(),

      deterministic:
        true,

      aiPrepared:
        false,

      externallyFiled:
        false
    };
  }
}

export class Federal1040CrossFormReconciliationGuard {

  static requireEqual(
    leftName:
      string,

    left:
      TaxDecimal,

    rightName:
      string,

    right:
      TaxDecimal
  ):
    true {

    if (
      left.compare(right) !== 0
    ) {
      throw new Error(
        'FEDERAL_1040_CROSS_FORM_MISMATCH:' +
        leftName +
        ':' +
        rightName
      );
    }

    return true;
  }
}

export class Federal1040ReturnVersionControl {

  private static readonly versions =
    new Map<
      string,
      Federal1040ReturnVersion[]
    >();

  static create(
    returnId:
      string,

    createdBy:
      string,

    reason:
      string
  ):
    Federal1040ReturnVersion {

    required(
      returnId,
      'FEDERAL_1040_RETURN_ID_REQUIRED'
    );

    required(
      createdBy,
      'FEDERAL_1040_VERSION_CREATOR_REQUIRED'
    );

    required(
      reason,
      'FEDERAL_1040_VERSION_REASON_REQUIRED'
    );

    const existing =
      this.versions.get(
        returnId
      ) ?? [];

    const version =
      existing.length + 1;

    const record:
      Federal1040ReturnVersion =
        Object.freeze({
          returnId,

          version,

          priorVersion:
            version > 1
              ? version - 1
              : undefined,

          createdBy,

          createdAt:
            new Date()
              .toISOString(),

          reason,

          immutable:
            true
        });

    this.versions.set(
      returnId,
      [
        ...existing,
        record
      ]
    );

    return record;
  }

  static history(
    returnId:
      string
  ):
    readonly Federal1040ReturnVersion[] {

    return [
      ...(
        this.versions.get(
          returnId
        ) ?? []
      )
    ];
  }
}

export class Federal1040PreparationEvidenceGuard {

  static validate(
    prepared:
      Federal1040PreparedReturn
  ):
    true {

    if (
      prepared
        .evidencePackageIds
        .length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_PREPARATION_EVIDENCE_REQUIRED'
      );
    }

    if (
      prepared.ruleIds.length === 0 ||
      prepared.authorityIds.length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_PREPARATION_PROVENANCE_REQUIRED'
      );
    }

    for (
      const line
      of Object.values(
        prepared.lines
      )
    ) {

      if (
        line.evidenceIds.length === 0 ||
        line.ruleIds.length === 0 ||
        line.authorityIds.length === 0
      ) {
        throw new Error(
          'FEDERAL_1040_LINE_PROVENANCE_REQUIRED'
        );
      }
    }

    return true;
  }
}

export class Federal1040ProfessionalReviewGate {

  static approve(
    prepared:
      Federal1040PreparedReturn,

    decision:
      Federal1040ReviewDecision
  ):
    Federal1040PreparedReturn {

    required(
      decision.reviewId,
      'FEDERAL_1040_REVIEW_ID_REQUIRED'
    );

    required(
      decision.requestedBy,
      'FEDERAL_1040_REVIEW_REQUESTER_REQUIRED'
    );

    required(
      decision.reason,
      'FEDERAL_1040_REVIEW_REASON_REQUIRED'
    );

    if (
      decision.material &&
      !decision
        .approvedBy
        ?.trim()
    ) {
      throw new Error(
        'FEDERAL_1040_REVIEW_APPROVAL_REQUIRED'
      );
    }

    if (
      decision.approvedBy &&
      decision.approvedBy ===
        decision.requestedBy
    ) {
      throw new Error(
        'FEDERAL_1040_REVIEW_MAKER_CHECKER_REQUIRED'
      );
    }

    Federal1040PreparationEvidenceGuard
      .validate(
        prepared
      );

    return {
      ...prepared,

      status:
        'APPROVED',

      reviewReasons:
        [],

      deterministic:
        true,

      aiPrepared:
        false,

      externallyFiled:
        false
    };
  }
}

export class Federal1040ExternalFilingGuard {

  static submit():
    never {

    throw new Error(
      'FEDERAL_1040_EXTERNAL_FILING_DISABLED'
    );
  }
}
`);


write(
  'src/taxguard/preparation/index.ts',
  String.raw`
export * from './Federal1040Preparation';
`
);

write(
  'src/tests/federal1040Preparation.test.ts',
  String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxDecimal
} from '../taxguard/calculation/TaxDecimal';

import type {
  TaxCalculationResult
} from '../taxguard/calculation/TaxCalculationContract';

import {
  Federal1040ReturnAssemblyEngine,
  Federal1040CrossFormReconciliationGuard,
  Federal1040ReturnVersionControl,
  Federal1040PreparationEvidenceGuard,
  Federal1040ProfessionalReviewGate,
  Federal1040ExternalFilingGuard
} from '../taxguard/preparation/Federal1040Preparation';

function calculation(
  id: string,
  calculationType: string,
  value: string,
  requiresReview = false
):
  TaxCalculationResult {

  const amount =
    TaxDecimal.parse(
      value,
      2
    );

  return {
    calculationId:
      id,

    calculationType,

    taxYear:
      2025,

    jurisdiction:
      'federal',

    status:
      requiresReview
        ? 'REQUIRES_REVIEW'
        : 'CALCULATED',

    value:
      amount,

    ruleIds:
      ['RULE-1'],

    authorityIds:
      ['AUTHORITY-1'],

    evidencePackageIds:
      ['EVIDENCE-1'],

    trace: [
      {
        sequence:
          1,

        operation:
          'TEST_CALCULATION',

        inputReferences:
          ['INPUT-1'],

        ruleIds:
          ['RULE-1'],

        authorityIds:
          ['AUTHORITY-1'],

        result:
          amount,

        explanation:
          'Validated deterministic calculation used for M8 regression testing.'
      }
    ],

    requiresHumanReview:
      requiresReview,

    reviewReasons:
      requiresReview
        ? [
            'PROFESSIONAL_REVIEW_REQUIRED'
          ]
        : [],

    correlationId:
      'CORRELATION-1',

    calculatedAt:
      new Date()
        .toISOString(),

    deterministic:
      true,

    aiCalculated:
      false
  };
}

const context = {
  returnId:
    'RETURN-1',

  clientId:
    'CLIENT-1',

  engagementId:
    'ENGAGEMENT-1',

  taxYear:
    2025,

  correlationId:
    'CORRELATION-1',

  ruleIds:
    ['RULE-1'],

  authorityIds:
    ['AUTHORITY-1'],

  evidencePackageIds:
    ['EVIDENCE-1']
};

describe(
  'TaxGuard M8 Federal 1040 Preparation Engine',
  () => {

    it(
      'M8.1 assembles deterministic non-AI return',
      () => {

        const result =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-1',
                  'FEDERAL_1040_TAXABLE_INCOME',
                  '80000.00'
                )
              ],

              {
                '1040_LINE_15':
                  'CALC-1'
              }
            );

        expect(
          result.status
        ).toBe(
          'READY_FOR_APPROVAL'
        );

        expect(
          result.deterministic
        ).toBe(true);

        expect(
          result.aiPrepared
        ).toBe(false);

        expect(
          result.externallyFiled
        ).toBe(false);
      }
    );

    it(
      'M8.2 binds calculation provenance to a Form 1040 line',
      () => {

        const result =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-2',
                  'FEDERAL_1040_INCOME_TAX',
                  '1000.00'
                )
              ],

              {
                '1040_LINE_16':
                  'CALC-2'
              }
            );

        expect(
          result
            .lines[
              '1040_LINE_16'
            ]
            .sourceId
        ).toBe(
          'CALC-2'
        );

        expect(
          result
            .lines[
              '1040_LINE_16'
            ]
            .authorityIds
        ).toEqual(
          ['AUTHORITY-1']
        );
      }
    );

    it(
      'M8.3 detects Schedule SE dependency',
      () => {

        const result =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-SE',
                  'FEDERAL_1040_SELF_EMPLOYMENT',
                  '1000.00'
                )
              ],

              {
                '1040_SE_TAX':
                  'CALC-SE'
              }
            );

        expect(
          result.schedules.some(
            dependency =>
              dependency.schedule ===
              'SCHEDULE_SE'
          )
        ).toBe(true);
      }
    );

    it(
      'M8.4 blocks cross-form mismatch',
      () => {

        expect(
          () =>
            Federal1040CrossFormReconciliationGuard
              .requireEqual(
                'FORM_1040',

                TaxDecimal.parse(
                  '100.00',
                  2
                ),

                'SUPPORTING_SCHEDULE',

                TaxDecimal.parse(
                  '99.00',
                  2
                )
              )
        ).toThrow(
          'FEDERAL_1040_CROSS_FORM_MISMATCH'
        );
      }
    );

    it(
      'M8.5 creates immutable sequential return versions',
      () => {

        const returnId =
          'RETURN-VERSION-TEST';

        const version1 =
          Federal1040ReturnVersionControl
            .create(
              returnId,
              'PREPARER-A',
              'Initial preparation'
            );

        const version2 =
          Federal1040ReturnVersionControl
            .create(
              returnId,
              'PREPARER-A',
              'Corrected preparation'
            );

        expect(
          version1.version
        ).toBe(1);

        expect(
          version2.version
        ).toBe(2);

        expect(
          version2.priorVersion
        ).toBe(1);

        expect(
          version2.immutable
        ).toBe(true);
      }
    );
    it(
      'M8.6 validates preparation evidence and provenance',
      () => {

        const prepared =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-EVIDENCE',
                  'FEDERAL_1040_TAXABLE_INCOME',
                  '50000.00'
                )
              ],

              {
                '1040_LINE_15':
                  'CALC-EVIDENCE'
              }
            );

        expect(
          Federal1040PreparationEvidenceGuard
            .validate(
              prepared
            )
        ).toBe(true);
      }
    );

    it(
      'M8.7 requires maker-checker separation for material approval',
      () => {

        const prepared =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-REVIEW',
                  'FEDERAL_1040_TAXABLE_INCOME',
                  '50000.00',
                  true
                )
              ],

              {
                '1040_LINE_15':
                  'CALC-REVIEW'
              }
            );

        expect(
          () =>
            Federal1040ProfessionalReviewGate
              .approve(
                prepared,
                {
                  reviewId:
                    'REVIEW-1',

                  requestedBy:
                    'REVIEWER-A',

                  approvedBy:
                    'REVIEWER-A',

                  material:
                    true,

                  reason:
                    'Material professional review'
                }
              )
        ).toThrow(
          'FEDERAL_1040_REVIEW_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M8.8 permits independent professional approval',
      () => {

        const prepared =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-APPROVAL',
                  'FEDERAL_1040_TAXABLE_INCOME',
                  '50000.00',
                  true
                )
              ],

              {
                '1040_LINE_15':
                  'CALC-APPROVAL'
              }
            );

        const approved =
          Federal1040ProfessionalReviewGate
            .approve(
              prepared,
              {
                reviewId:
                  'REVIEW-2',

                requestedBy:
                  'PREPARER-A',

                approvedBy:
                  'REVIEWER-B',

                material:
                  true,

                reason:
                  'Independent professional review'
              }
            );

        expect(
          approved.status
        ).toBe(
          'APPROVED'
        );

        expect(
          approved.aiPrepared
        ).toBe(false);

        expect(
          approved.externallyFiled
        ).toBe(false);
      }
    );

    it(
      'M8.9 keeps external tax filing disabled',
      () => {

        expect(
          () =>
            Federal1040ExternalFilingGuard
              .submit()
        ).toThrow(
          'FEDERAL_1040_EXTERNAL_FILING_DISABLED'
        );
      }
    );

    it(
      'blocks calculations without required provenance',
      () => {

        const invalid =
          calculation(
            'CALC-BAD',
            'FEDERAL_1040_TAXABLE_INCOME',
            '100.00'
          );

        invalid.evidencePackageIds =
          [];

        expect(
          () =>
            Federal1040ReturnAssemblyEngine
              .assemble(
                context,
                [invalid],
                {
                  '1040_LINE_15':
                    'CALC-BAD'
                }
              )
        ).toThrow(
          'FEDERAL_1040_CALCULATION_PROVENANCE_REQUIRED'
        );
      }
    );
  }
);
`
);

console.log('');
console.log(
  '=============================================='
);

console.log(
  'TaxGuard M8 source generated successfully.'
);

console.log(
  '=============================================='
);

console.log(
  'Created:'
);

console.log(
  'src/taxguard/preparation/Federal1040Preparation.ts'
);

console.log(
  'src/taxguard/preparation/index.ts'
);

console.log(
  'src/tests/federal1040Preparation.test.ts'
);

console.log('');
console.log(
  'External tax filing remains DISABLED.'
);








