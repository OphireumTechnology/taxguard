
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
