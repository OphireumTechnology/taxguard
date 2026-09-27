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
