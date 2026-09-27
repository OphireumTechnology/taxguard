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

const SCALE = 2;

function zero(): TaxDecimal {
  return TaxDecimal.zero(SCALE);
}

function money(
  value: TaxDecimal,
  context: TaxCalculationContext
): TaxDecimal {
  return value.round(
    SCALE,
    context.roundingMode
  );
}

function add(
  left: TaxDecimal,
  right: TaxDecimal,
  context: TaxCalculationContext
): TaxDecimal {
  return money(
    left.add(right),
    context
  );
}

function subtract(
  left: TaxDecimal,
  right: TaxDecimal,
  context: TaxCalculationContext
): TaxDecimal {
  return money(
    left.subtract(right),
    context
  );
}

function validateBase(
  context: TaxCalculationContext,
  inputs: readonly TaxCalculationInput[],
  calculationType: string
): void {
  TaxCalculationGuard.validateContext(
    context
  );

  TaxCalculationGuard.validateInputs(
    inputs
  );

  if (
    context.calculationType !==
    calculationType
  ) {
    throw new Error(
      'FEDERAL_1040_CALCULATION_TYPE_MISMATCH'
    );
  }

  if (
    context.jurisdiction !==
    'federal'
  ) {
    throw new Error(
      'FEDERAL_1040_FEDERAL_JURISDICTION_REQUIRED'
    );
  }

  const ids =
    new Set<string>();

  for (const input of inputs) {
    if (
      ids.has(input.inputId)
    ) {
      throw new Error(
        'FEDERAL_1040_DUPLICATE_INPUT'
      );
    }

    ids.add(input.inputId);
  }
}

function createTrace(
  context: TaxCalculationContext,
  sequence: number,
  operation: string,
  inputReferences: string[],
  value: TaxDecimal,
  explanation: string
): TaxCalculationTraceStep {
  return {
    sequence,
    operation,
    inputReferences,

    ruleIds: [
      ...context.ruleIds
    ],

    authorityIds: [
      ...context.authorityIds
    ],

    result: value,
    explanation
  };
}

function createResult(
  context: TaxCalculationContext,
  value: TaxDecimal,
  trace: TaxCalculationTraceStep[],
  additionalReviewReasons:
    string[] = []
): TaxCalculationResult {

  const reviewReasons = [
    ...additionalReviewReasons
  ];

  if (
    context.riskLevel ===
    'critical'
  ) {
    reviewReasons.push(
      'CRITICAL_RISK_CALCULATION_REVIEW_REQUIRED'
    );
  }

  const requiresHumanReview =
    reviewReasons.length > 0;

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
      requiresHumanReview
        ? 'REQUIRES_REVIEW'
        : 'CALCULATED',

    value,

    ruleIds: [
      ...context.ruleIds
    ],

    authorityIds: [
      ...context.authorityIds
    ],

    evidencePackageIds: [
      ...context.evidencePackageIds
    ],

    trace,

    requiresHumanReview,
    reviewReasons,

    correlationId:
      context.correlationId,

    calculatedAt:
      new Date()
        .toISOString(),

    deterministic: true,

    aiCalculated: false
  };
}

// ============================================================
// M7.5 — STANDARD / ITEMIZED DEDUCTION
// ============================================================

export type Federal1040DeductionKind =
  | 'AGI'
  | 'STANDARD_DEDUCTION'
  | 'ITEMIZED_DEDUCTION';

export interface Federal1040DeductionInput
  extends TaxCalculationInput {

  kind:
    Federal1040DeductionKind;
}

export interface Federal1040DeductionResult
  extends TaxCalculationResult {

  value: TaxDecimal;

  adjustedGrossIncome:
    TaxDecimal;

  standardDeduction:
    TaxDecimal;

  itemizedDeduction:
    TaxDecimal;

  selectedDeduction:
    | 'STANDARD'
    | 'ITEMIZED';
}

export class Federal1040DeductionCalculationEngine {

  static readonly calculationType =
    'FEDERAL_1040_DEDUCTION_CALCULATION';

  static calculate(
    context:
      TaxCalculationContext,

    inputs:
      readonly Federal1040DeductionInput[]
  ):
    Federal1040DeductionResult {

    validateBase(
      context,
      inputs,
      this.calculationType
    );

    const agiInputs =
      inputs.filter(
        input =>
          input.kind === 'AGI'
      );

    const standardInputs =
      inputs.filter(
        input =>
          input.kind ===
          'STANDARD_DEDUCTION'
      );

    const itemizedInputs =
      inputs.filter(
        input =>
          input.kind ===
          'ITEMIZED_DEDUCTION'
      );

    if (
      agiInputs.length !== 1
    ) {
      throw new Error(
        'FEDERAL_1040_DEDUCTION_SINGLE_AGI_REQUIRED'
      );
    }

    if (
      standardInputs.length !== 1
    ) {
      throw new Error(
        'FEDERAL_1040_STANDARD_DEDUCTION_DEFINITION_REQUIRED'
      );
    }

    const adjustedGrossIncome =
      money(
        agiInputs[0].value,
        context
      );

    const standardDeduction =
      money(
        standardInputs[0].value,
        context
      );

    if (
      standardDeduction
        .isNegative()
    ) {
      throw new Error(
        'FEDERAL_1040_NEGATIVE_STANDARD_DEDUCTION_BLOCKED'
      );
    }

    let itemizedDeduction =
      zero();

    for (
      const input
      of itemizedInputs
    ) {
      if (
        input.value.isNegative()
      ) {
        throw new Error(
          'FEDERAL_1040_NEGATIVE_ITEMIZED_DEDUCTION_BLOCKED'
        );
      }

      itemizedDeduction =
        add(
          itemizedDeduction,
          input.value,
          context
        );
    }

    const useItemized =
      itemizedDeduction.compare(
        standardDeduction
      ) > 0;

    const selectedDeduction =
      useItemized
        ? itemizedDeduction
        : standardDeduction;

    const trace = [
      createTrace(
        context,
        1,
        'BIND_ADJUSTED_GROSS_INCOME',
        [agiInputs[0].inputId],
        adjustedGrossIncome,
        'Bind validated adjusted gross income.'
      ),

      createTrace(
        context,
        2,
        'COMPARE_STANDARD_AND_ITEMIZED_DEDUCTION',
        inputs
          .filter(
            input =>
              input.kind !== 'AGI'
          )
          .map(
            input =>
              input.inputId
          ),
        selectedDeduction,
        'Select the greater verified deduction amount.'
      )
    ];

    return {
      ...createResult(
        context,
        selectedDeduction,
        trace
      ),

      value:
        selectedDeduction,

      adjustedGrossIncome,

      standardDeduction,

      itemizedDeduction,

      selectedDeduction:
        useItemized
          ? 'ITEMIZED'
          : 'STANDARD'
    };
  }
}

// ============================================================
// M7.6 — TAXABLE INCOME ENGINE
// ============================================================

export type Federal1040TaxableIncomeKind =
  | 'AGI'
  | 'DEDUCTION';

export interface Federal1040TaxableIncomeInput
  extends TaxCalculationInput {

  kind:
    Federal1040TaxableIncomeKind;
}

export class Federal1040TaxableIncomeEngine {

  static readonly calculationType =
    'FEDERAL_1040_TAXABLE_INCOME';

  static calculate(
    context:
      TaxCalculationContext,

    inputs:
      readonly Federal1040TaxableIncomeInput[]
  ):
    TaxCalculationResult {

    validateBase(
      context,
      inputs,
      this.calculationType
    );

    const agiInputs =
      inputs.filter(
        input =>
          input.kind === 'AGI'
      );

    const deductionInputs =
      inputs.filter(
        input =>
          input.kind ===
          'DEDUCTION'
      );

    if (
      agiInputs.length !== 1 ||
      deductionInputs.length !== 1
    ) {
      throw new Error(
        'FEDERAL_1040_TAXABLE_INCOME_REQUIRED_INPUTS'
      );
    }

    let taxableIncome =
      subtract(
        agiInputs[0].value,
        deductionInputs[0].value,
        context
      );

    if (
      taxableIncome.isNegative()
    ) {
      taxableIncome =
        zero();
    }

    const trace = [
      createTrace(
        context,
        1,
        'CALCULATE_TAXABLE_INCOME',
        inputs.map(
          input =>
            input.inputId
        ),
        taxableIncome,
        'Subtract verified deduction from validated AGI and floor the result at zero.'
      )
    ];

    return createResult(
      context,
      taxableIncome,
      trace
    );
  }
}

// ============================================================
// M7.7 — FEDERAL INCOME TAX RATE ENGINE
//
// IMPORTANT:
// TaxGuard does NOT invent tax brackets or tax rates here.
// Bracket portions and rates must arrive as validated,
// evidence-backed inputs derived from verified tax-year rules.
// ============================================================

export type Federal1040TaxRateKind =
  | 'TAXABLE_INCOME'
  | 'BRACKET_PORTION';

export interface Federal1040TaxRateInput
  extends TaxCalculationInput {

  kind:
    Federal1040TaxRateKind;

  rate?: TaxDecimal;
}

export class Federal1040IncomeTaxRateEngine {

  static readonly calculationType =
    'FEDERAL_1040_INCOME_TAX';

  static calculate(
    context:
      TaxCalculationContext,

    inputs:
      readonly Federal1040TaxRateInput[]
  ):
    TaxCalculationResult {

    validateBase(
      context,
      inputs,
      this.calculationType
    );

    const taxableIncomeInputs =
      inputs.filter(
        input =>
          input.kind ===
          'TAXABLE_INCOME'
      );

    const bracketInputs =
      inputs.filter(
        input =>
          input.kind ===
          'BRACKET_PORTION'
      );

    if (
      taxableIncomeInputs.length !== 1
    ) {
      throw new Error(
        'FEDERAL_1040_SINGLE_TAXABLE_INCOME_REQUIRED'
      );
    }

    if (
      bracketInputs.length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_TAX_RATE_VERIFIED_BRACKETS_REQUIRED'
      );
    }

    const taxableIncome =
      money(
        taxableIncomeInputs[0].value,
        context
      );

    if (
      taxableIncome.isNegative()
    ) {
      throw new Error(
        'FEDERAL_1040_NEGATIVE_TAXABLE_INCOME_BLOCKED'
      );
    }

    let allocatedIncome =
      zero();

    let federalIncomeTax =
      zero();

    for (
      const bracket
      of bracketInputs
    ) {
      if (!bracket.rate) {
        throw new Error(
          'FEDERAL_1040_TAX_RATE_REQUIRED'
        );
      }

      if (
        bracket.value.isNegative() ||
        bracket.rate.isNegative()
      ) {
        throw new Error(
          'FEDERAL_1040_NEGATIVE_TAX_BRACKET_BLOCKED'
        );
      }

      allocatedIncome =
        add(
          allocatedIncome,
          bracket.value,
          context
        );

      const bracketTax =
        bracket.value
          .multiply(
            bracket.rate
          )
          .round(
            SCALE,
            context.roundingMode
          );

      federalIncomeTax =
        add(
          federalIncomeTax,
          bracketTax,
          context
        );
    }

    if (
      allocatedIncome.compare(
        taxableIncome
      ) !== 0
    ) {
      throw new Error(
        'FEDERAL_1040_TAX_BRACKET_PORTIONS_MISMATCH'
      );
    }

    const trace = [
      createTrace(
        context,
        1,
        'APPLY_VERIFIED_TAX_BRACKETS',
        bracketInputs.map(
          input =>
            input.inputId
        ),
        federalIncomeTax,
        'Apply evidence-backed tax-year bracket portions and rates.'
      )
    ];

    return createResult(
      context,
      federalIncomeTax,
      trace
    );
  }
}

// ============================================================
// M7.8 — CREDITS + PAYMENTS ENGINE
// ============================================================

export type Federal1040CreditPaymentKind =
  | 'INCOME_TAX'
  | 'CREDIT'
  | 'PAYMENT';

export interface Federal1040CreditPaymentInput
  extends TaxCalculationInput {

  kind:
    Federal1040CreditPaymentKind;
}

export interface Federal1040CreditPaymentResult
  extends TaxCalculationResult {

  value: TaxDecimal;

  incomeTax:
    TaxDecimal;

  totalCredits:
    TaxDecimal;

  taxAfterCredits:
    TaxDecimal;

  totalPayments:
    TaxDecimal;
}

export class Federal1040CreditsPaymentsEngine {

  static readonly calculationType =
    'FEDERAL_1040_CREDITS_PAYMENTS';

  static calculate(
    context:
      TaxCalculationContext,

    inputs:
      readonly Federal1040CreditPaymentInput[]
  ):
    Federal1040CreditPaymentResult {

    validateBase(
      context,
      inputs,
      this.calculationType
    );

    const taxInputs =
      inputs.filter(
        input =>
          input.kind ===
          'INCOME_TAX'
      );

    if (
      taxInputs.length !== 1
    ) {
      throw new Error(
        'FEDERAL_1040_SINGLE_INCOME_TAX_REQUIRED'
      );
    }

    const incomeTax =
      money(
        taxInputs[0].value,
        context
      );

    if (
      incomeTax.isNegative()
    ) {
      throw new Error(
        'FEDERAL_1040_NEGATIVE_INCOME_TAX_BLOCKED'
      );
    }

    let totalCredits =
      zero();

    let totalPayments =
      zero();

    for (
      const input
      of inputs
    ) {
      if (
        input.value.isNegative()
      ) {
        throw new Error(
          'FEDERAL_1040_NEGATIVE_CREDIT_PAYMENT_BLOCKED'
        );
      }

      if (
        input.kind === 'CREDIT'
      ) {
        totalCredits =
          add(
            totalCredits,
            input.value,
            context
          );
      }

      if (
        input.kind === 'PAYMENT'
      ) {
        totalPayments =
          add(
            totalPayments,
            input.value,
            context
          );
      }
    }

    let taxAfterCredits =
      subtract(
        incomeTax,
        totalCredits,
        context
      );

    if (
      taxAfterCredits.isNegative()
    ) {
      taxAfterCredits =
        zero();
    }

    const trace = [
      createTrace(
        context,
        1,
        'APPLY_CREDITS_AND_BIND_PAYMENTS',
        inputs.map(
          input =>
            input.inputId
        ),
        taxAfterCredits,
        'Apply validated credits to income tax and bind validated payments for reconciliation.'
      )
    ];

    return {
      ...createResult(
        context,
        taxAfterCredits,
        trace
      ),

      value:
        taxAfterCredits,

      incomeTax,

      totalCredits,

      taxAfterCredits,

      totalPayments
    };
  }
}

// ============================================================
// M7.9 — SELF-EMPLOYMENT CALCULATION FOUNDATION
//
// Rates are NOT hard-coded.
// Tax-year parameters must arrive as validated,
// evidence-backed inputs.
// ============================================================

export type Federal1040SelfEmploymentKind =
  | 'NET_EARNINGS'
  | 'SE_TAX_RATE'
  | 'DEDUCTIBLE_SHARE_RATE';

export interface Federal1040SelfEmploymentInput
  extends TaxCalculationInput {

  kind:
    Federal1040SelfEmploymentKind;
}

export interface Federal1040SelfEmploymentResult
  extends TaxCalculationResult {

  value: TaxDecimal;

  netEarnings:
    TaxDecimal;

  selfEmploymentTax:
    TaxDecimal;

  deductibleShare:
    TaxDecimal;
}

export class Federal1040SelfEmploymentEngine {

  static readonly calculationType =
    'FEDERAL_1040_SELF_EMPLOYMENT';

  static calculate(
    context:
      TaxCalculationContext,

    inputs:
      readonly Federal1040SelfEmploymentInput[]
  ):
    Federal1040SelfEmploymentResult {

    validateBase(
      context,
      inputs,
      this.calculationType
    );

    const netInputs =
      inputs.filter(
        input =>
          input.kind ===
          'NET_EARNINGS'
      );

    const rateInputs =
      inputs.filter(
        input =>
          input.kind ===
          'SE_TAX_RATE'
      );

    const shareInputs =
      inputs.filter(
        input =>
          input.kind ===
          'DEDUCTIBLE_SHARE_RATE'
      );

    if (
      netInputs.length !== 1 ||
      rateInputs.length !== 1 ||
      shareInputs.length !== 1
    ) {
      throw new Error(
        'FEDERAL_1040_SE_VERIFIED_INPUTS_REQUIRED'
      );
    }

    if (
      netInputs[0].value.isNegative() ||
      rateInputs[0].value.isNegative() ||
      shareInputs[0].value.isNegative()
    ) {
      throw new Error(
        'FEDERAL_1040_SE_NEGATIVE_INPUT_BLOCKED'
      );
    }

    const netEarnings =
      money(
        netInputs[0].value,
        context
      );

    const selfEmploymentTax =
      netEarnings
        .multiply(
          rateInputs[0].value
        )
        .round(
          SCALE,
          context.roundingMode
        );

    const deductibleShare =
      selfEmploymentTax
        .multiply(
          shareInputs[0].value
        )
        .round(
          SCALE,
          context.roundingMode
        );

    const trace = [
      createTrace(
        context,
        1,
        'CALCULATE_SELF_EMPLOYMENT_TAX',
        inputs.map(
          input =>
            input.inputId
        ),
        selfEmploymentTax,
        'Apply verified self-employment calculation parameters.'
      )
    ];

    return {
      ...createResult(
        context,
        selfEmploymentTax,
        trace
      ),

      value:
        selfEmploymentTax,

      netEarnings,

      selfEmploymentTax,

      deductibleShare
    };
  }
}

// ============================================================
// M7.10 — REFUND / BALANCE DUE RECONCILIATION
// ============================================================

export type Federal1040ReconciliationKind =
  | 'TOTAL_TAX'
  | 'PAYMENT';

export interface Federal1040ReconciliationInput
  extends TaxCalculationInput {

  kind:
    Federal1040ReconciliationKind;
}

export interface Federal1040ReconciliationResult
  extends TaxCalculationResult {

  value: TaxDecimal;

  totalTax:
    TaxDecimal;

  totalPayments:
    TaxDecimal;

  outcome:
    | 'REFUND'
    | 'BALANCE_DUE'
    | 'ZERO';

  amount:
    TaxDecimal;
}

export class Federal1040RefundBalanceEngine {

  static readonly calculationType =
    'FEDERAL_1040_REFUND_BALANCE';

  static calculate(
    context:
      TaxCalculationContext,

    inputs:
      readonly Federal1040ReconciliationInput[]
  ):
    Federal1040ReconciliationResult {

    validateBase(
      context,
      inputs,
      this.calculationType
    );

    const taxInputs =
      inputs.filter(
        input =>
          input.kind ===
          'TOTAL_TAX'
      );

    if (
      taxInputs.length !== 1
    ) {
      throw new Error(
        'FEDERAL_1040_SINGLE_TOTAL_TAX_REQUIRED'
      );
    }

    const totalTax =
      money(
        taxInputs[0].value,
        context
      );

    if (
      totalTax.isNegative()
    ) {
      throw new Error(
        'FEDERAL_1040_NEGATIVE_TOTAL_TAX_BLOCKED'
      );
    }

    let totalPayments =
      zero();

    for (
      const payment
      of inputs.filter(
        input =>
          input.kind === 'PAYMENT'
      )
    ) {
      if (
        payment.value.isNegative()
      ) {
        throw new Error(
          'FEDERAL_1040_NEGATIVE_PAYMENT_BLOCKED'
        );
      }

      totalPayments =
        add(
          totalPayments,
          payment.value,
          context
        );
    }

    const difference =
      subtract(
        totalPayments,
        totalTax,
        context
      );

    let outcome:
      | 'REFUND'
      | 'BALANCE_DUE'
      | 'ZERO';

    let amount:
      TaxDecimal;

    if (
      difference.compare(
        zero()
      ) > 0
    ) {
      outcome = 'REFUND';
      amount = difference;
    } else if (
      difference.compare(
        zero()
      ) < 0
    ) {
      outcome =
        'BALANCE_DUE';

      amount =
        zero().subtract(
          difference
        );
    } else {
      outcome = 'ZERO';
      amount = zero();
    }

    const trace = [
      createTrace(
        context,
        1,
        'RECONCILE_REFUND_OR_BALANCE',
        inputs.map(
          input =>
            input.inputId
        ),
        amount,
        'Reconcile validated payments against validated total tax.'
      )
    ];

    return {
      ...createResult(
        context,
        amount,
        trace
      ),

      value:
        amount,

      totalTax,

      totalPayments,

      outcome,

      amount
    };
  }
}

// ============================================================
// M7.11 — CALCULATION EVIDENCE + TRACE BINDING
// ============================================================

export class Federal1040CalculationEvidenceTraceGuard {

  static validate(
    context:
      TaxCalculationContext,

    resultValue:
      TaxDecimal,

    steps:
      readonly TaxCalculationTraceStep[]
  ):
    true {

    TaxCalculationGuard
      .validateContext(
        context
      );

    if (
      steps.length === 0
    ) {
      throw new Error(
        'FEDERAL_1040_CALCULATION_TRACE_REQUIRED'
      );
    }

    steps.forEach(
      (
        step,
        index
      ) => {

        if (
          step.sequence !==
          index + 1
        ) {
          throw new Error(
            'FEDERAL_1040_CALCULATION_TRACE_SEQUENCE_INVALID'
          );
        }

        if (
          step.ruleIds.length === 0 ||
          step.authorityIds.length === 0
        ) {
          throw new Error(
            'FEDERAL_1040_CALCULATION_TRACE_PROVENANCE_REQUIRED'
          );
        }

        if (
          !step.operation.trim() ||
          !step.explanation.trim()
        ) {
          throw new Error(
            'FEDERAL_1040_CALCULATION_TRACE_DETAIL_REQUIRED'
          );
        }
      }
    );

    const finalStep =
      steps[
        steps.length - 1
      ];

    if (
      finalStep.result.compare(
        resultValue
      ) !== 0
    ) {
      throw new Error(
        'FEDERAL_1040_CALCULATION_TRACE_RESULT_MISMATCH'
      );
    }

    return true;
  }
}

// ============================================================
// M7.12 — HUMAN REVIEW / OVERRIDE CONTROLS
// ============================================================

export interface TaxCalculationOverride {

  overrideId:
    string;

  requestedBy:
    string;

  approvedBy?:
    string;

  reason:
    string;

  material:
    boolean;
}

export interface TaxCalculationOverrideAuthorization {

  authorized:
    true;

  auditable:
    true;

  aiApproved:
    false;
}

export class Federal1040HumanReviewOverrideGuard {

  static authorize(
    override:
      TaxCalculationOverride
  ):
    TaxCalculationOverrideAuthorization {

    if (
      !override.overrideId.trim() ||
      !override.requestedBy.trim() ||
      !override.reason.trim()
    ) {
      throw new Error(
        'FEDERAL_1040_OVERRIDE_REQUIRED_FIELDS'
      );
    }

    if (
      override.material &&
      !override.approvedBy?.trim()
    ) {
      throw new Error(
        'FEDERAL_1040_MATERIAL_OVERRIDE_APPROVAL_REQUIRED'
      );
    }

    if (
      override.approvedBy &&
      override.approvedBy ===
        override.requestedBy
    ) {
      throw new Error(
        'FEDERAL_1040_OVERRIDE_MAKER_CHECKER_REQUIRED'
      );
    }

    return {
      authorized: true,
      auditable: true,
      aiApproved: false
    };
  }
}

