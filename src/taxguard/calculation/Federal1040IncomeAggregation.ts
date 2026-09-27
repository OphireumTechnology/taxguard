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
