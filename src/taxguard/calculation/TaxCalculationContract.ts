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
