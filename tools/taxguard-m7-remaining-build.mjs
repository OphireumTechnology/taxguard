import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

const backupDir = path.join(
  ROOT,
  'backups',
  'm7-remaining-' +
    new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
);

function write(rel, content) {
  const file = path.join(ROOT, rel);

  fs.mkdirSync(
    path.dirname(file),
    { recursive: true }
  );

  if (fs.existsSync(file)) {
    const backup =
      path.join(backupDir, rel);

    fs.mkdirSync(
      path.dirname(backup),
      { recursive: true }
    );

    fs.copyFileSync(
      file,
      backup
    );
  }

  fs.writeFileSync(
    file,
    content.replace(/^\n/, ''),
    'utf8'
  );

  console.log('WROTE', rel);
}

function run(cmd, args) {
  console.log(
    '\n>',
    cmd,
    ...args
  );

  execFileSync(
    'cmd.exe',
    [
      '/d',
      '/s',
      '/c',
      cmd,
      ...args
    ],
    {
      cwd: ROOT,
      stdio: 'inherit',
      windowsHide: false
    }
  );
}
const source = String.raw`
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

`;

const tests = String.raw`
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
  Federal1040DeductionCalculationEngine,
  Federal1040TaxableIncomeEngine,
  Federal1040IncomeTaxRateEngine,
  Federal1040CreditsPaymentsEngine,
  Federal1040SelfEmploymentEngine,
  Federal1040RefundBalanceEngine,
  Federal1040CalculationEvidenceTraceGuard,
  Federal1040HumanReviewOverrideGuard
} from '../taxguard/calculation/Federal1040RemainingCalculations';

function decimal(
  value: string
): TaxDecimal {
  return TaxDecimal.parse(value);
}

function context(
  calculationType: string
):
  TaxCalculationContext {

  return {
    calculationId:
      'CALC-M7-TEST',

    calculationType,

    clientId:
      'CLIENT-TEST',

    engagementId:
      'ENGAGEMENT-TEST',

    taxYear:
      2025,

    jurisdiction:
      'federal',

    ruleIds:
      ['RULE-VERIFIED'],

    authorityIds:
      ['AUTH-VERIFIED'],

    evidencePackageIds:
      ['EVIDENCE-PACKAGE'],

    correlationId:
      'CORRELATION-M7',

    roundingMode:
      'HALF_UP',

    riskLevel:
      'routine'
  };
}

function input<T extends Record<string, unknown>>(
  inputId: string,
  value: string,
  extra: T
) {
  return {
    inputId,

    factPath:
      'verified.' + inputId,

    value:
      decimal(value),

    evidenceIds:
      ['EVIDENCE-' + inputId],

    validated:
      true as const,

    ...extra
  };
}
describe(
  'TaxGuard M7.5-M7.13 remaining calculations',
  () => {

    it(
      'M7.5 selects itemized when greater than standard',
      () => {

        const result =
          Federal1040DeductionCalculationEngine
            .calculate(
              context(
                Federal1040DeductionCalculationEngine
                  .calculationType
              ),
              [
                input(
                  'AGI',
                  '100000.00',
                  {
                    kind: 'AGI'
                  }
                ),

                input(
                  'STANDARD',
                  '15000.00',
                  {
                    kind:
                      'STANDARD_DEDUCTION'
                  }
                ),

                input(
                  'ITEMIZED',
                  '18000.00',
                  {
                    kind:
                      'ITEMIZED_DEDUCTION'
                  }
                )
              ]
            );

        expect(
          result.value.toFixed()
        ).toBe('18000.00');

        expect(
          result.selectedDeduction
        ).toBe('ITEMIZED');

        expect(
          result.aiCalculated
        ).toBe(false);

        expect(
          result.deterministic
        ).toBe(true);
      }
    );

    it(
      'M7.5 selects standard when greater',
      () => {

        const result =
          Federal1040DeductionCalculationEngine
            .calculate(
              context(
                Federal1040DeductionCalculationEngine
                  .calculationType
              ),
              [
                input(
                  'AGI',
                  '100000.00',
                  {
                    kind: 'AGI'
                  }
                ),

                input(
                  'STANDARD',
                  '20000.00',
                  {
                    kind:
                      'STANDARD_DEDUCTION'
                  }
                ),

                input(
                  'ITEMIZED',
                  '18000.00',
                  {
                    kind:
                      'ITEMIZED_DEDUCTION'
                  }
                )
              ]
            );

        expect(
          result.selectedDeduction
        ).toBe('STANDARD');

        expect(
          result.value.toFixed()
        ).toBe('20000.00');
      }
    );

    it(
      'M7.6 calculates taxable income',
      () => {

        const result =
          Federal1040TaxableIncomeEngine
            .calculate(
              context(
                Federal1040TaxableIncomeEngine
                  .calculationType
              ),
              [
                input(
                  'AGI',
                  '100000.00',
                  {
                    kind: 'AGI'
                  }
                ),

                input(
                  'DEDUCTION',
                  '20000.00',
                  {
                    kind:
                      'DEDUCTION'
                  }
                )
              ]
            );

        expect(
          result.value?.toFixed()
        ).toBe('80000.00');
      }
    );

    it(
      'M7.6 floors taxable income at zero',
      () => {

        const result =
          Federal1040TaxableIncomeEngine
            .calculate(
              context(
                Federal1040TaxableIncomeEngine
                  .calculationType
              ),
              [
                input(
                  'AGI',
                  '10000.00',
                  {
                    kind: 'AGI'
                  }
                ),

                input(
                  'DEDUCTION',
                  '15000.00',
                  {
                    kind:
                      'DEDUCTION'
                  }
                )
              ]
            );

        expect(
          result.value?.toFixed()
        ).toBe('0.00');
      }
    );

    it(
      'M7.7 applies verified tax bracket inputs',
      () => {

        const result =
          Federal1040IncomeTaxRateEngine
            .calculate(
              context(
                Federal1040IncomeTaxRateEngine
                  .calculationType
              ),
              [
                input(
                  'TAXABLE',
                  '10000.00',
                  {
                    kind:
                      'TAXABLE_INCOME'
                  }
                ),

                input(
                  'BRACKET-1',
                  '10000.00',
                  {
                    kind:
                      'BRACKET_PORTION',

                    rate:
                      decimal('0.10')
                  }
                )
              ]
            );

        expect(
          result.value?.toFixed()
        ).toBe('1000.00');

        expect(
          result.aiCalculated
        ).toBe(false);
      }
    );

    it(
      'M7.7 rejects bracket allocation mismatch',
      () => {

        expect(
          () =>
            Federal1040IncomeTaxRateEngine
              .calculate(
                context(
                  Federal1040IncomeTaxRateEngine
                    .calculationType
                ),
                [
                  input(
                    'TAXABLE',
                    '10000.00',
                    {
                      kind:
                        'TAXABLE_INCOME'
                    }
                  ),

                  input(
                    'BRACKET-1',
                    '9000.00',
                    {
                      kind:
                        'BRACKET_PORTION',

                      rate:
                        decimal('0.10')
                    }
                  )
                ]
              )
        ).toThrow(
          'FEDERAL_1040_TAX_BRACKET_PORTIONS_MISMATCH'
        );
      }
    );

    it(
      'M7.8 applies credits and binds payments',
      () => {

        const result =
          Federal1040CreditsPaymentsEngine
            .calculate(
              context(
                Federal1040CreditsPaymentsEngine
                  .calculationType
              ),
              [
                input(
                  'TAX',
                  '5000.00',
                  {
                    kind:
                      'INCOME_TAX'
                  }
                ),

                input(
                  'CREDIT',
                  '1000.00',
                  {
                    kind:
                      'CREDIT'
                  }
                ),

                input(
                  'PAYMENT',
                  '4500.00',
                  {
                    kind:
                      'PAYMENT'
                  }
                )
              ]
            );

        expect(
          result.taxAfterCredits
            .toFixed()
        ).toBe('4000.00');

        expect(
          result.totalPayments
            .toFixed()
        ).toBe('4500.00');
      }
    );

    it(
      'M7.9 calculates self-employment foundation from verified parameters',
      () => {

        const result =
          Federal1040SelfEmploymentEngine
            .calculate(
              context(
                Federal1040SelfEmploymentEngine
                  .calculationType
              ),
              [
                input(
                  'NET',
                  '10000.00',
                  {
                    kind:
                      'NET_EARNINGS'
                  }
                ),

                input(
                  'RATE',
                  '0.10',
                  {
                    kind:
                      'SE_TAX_RATE'
                  }
                ),

                input(
                  'SHARE',
                  '0.50',
                  {
                    kind:
                      'DEDUCTIBLE_SHARE_RATE'
                  }
                )
              ]
            );

        expect(
          result.selfEmploymentTax
            .toFixed()
        ).toBe('1000.00');

        expect(
          result.deductibleShare
            .toFixed()
        ).toBe('500.00');
      }
    );

    it(
      'M7.10 reconciles a refund',
      () => {

        const result =
          Federal1040RefundBalanceEngine
            .calculate(
              context(
                Federal1040RefundBalanceEngine
                  .calculationType
              ),
              [
                input(
                  'TOTAL-TAX',
                  '4000.00',
                  {
                    kind:
                      'TOTAL_TAX'
                  }
                ),

                input(
                  'PAYMENT',
                  '4500.00',
                  {
                    kind:
                      'PAYMENT'
                  }
                )
              ]
            );

        expect(
          result.outcome
        ).toBe('REFUND');

        expect(
          result.amount.toFixed()
        ).toBe('500.00');
      }
    );

    it(
      'M7.10 reconciles a balance due',
      () => {

        const result =
          Federal1040RefundBalanceEngine
            .calculate(
              context(
                Federal1040RefundBalanceEngine
                  .calculationType
              ),
              [
                input(
                  'TOTAL-TAX',
                  '5000.00',
                  {
                    kind:
                      'TOTAL_TAX'
                  }
                ),

                input(
                  'PAYMENT',
                  '4000.00',
                  {
                    kind:
                      'PAYMENT'
                  }
                )
              ]
            );

        expect(
          result.outcome
        ).toBe('BALANCE_DUE');

        expect(
          result.amount.toFixed()
        ).toBe('1000.00');
      }
    );

    it(
      'M7.11 blocks missing calculation trace',
      () => {

        expect(
          () =>
            Federal1040CalculationEvidenceTraceGuard
              .validate(
                context(
                  'TRACE-TEST'
                ),
                decimal('1.00'),
                []
              )
        ).toThrow(
          'FEDERAL_1040_CALCULATION_TRACE_REQUIRED'
        );
      }
    );

    it(
      'M7.12 requires independent approval for material override',
      () => {

        expect(
          () =>
            Federal1040HumanReviewOverrideGuard
              .authorize({
                overrideId:
                  'OVERRIDE-1',

                requestedBy:
                  'REVIEWER-A',

                approvedBy:
                  'REVIEWER-A',

                reason:
                  'Material tax adjustment',

                material:
                  true
              })
        ).toThrow(
          'FEDERAL_1040_OVERRIDE_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M7.12 permits maker-checker authorized override',
      () => {

        const result =
          Federal1040HumanReviewOverrideGuard
            .authorize({
              overrideId:
                'OVERRIDE-2',

              requestedBy:
                'PREPARER-A',

              approvedBy:
                'REVIEWER-B',

              reason:
                'Reviewed material adjustment',

              material:
                true
            });

        expect(
          result.authorized
        ).toBe(true);

        expect(
          result.auditable
        ).toBe(true);

        expect(
          result.aiApproved
        ).toBe(false);
      }
    );

    it(
      'M7.13 preserves deterministic non-AI calculations',
      () => {

        const result =
          Federal1040TaxableIncomeEngine
            .calculate(
              context(
                Federal1040TaxableIncomeEngine
                  .calculationType
              ),
              [
                input(
                  'AGI',
                  '50000.00',
                  {
                    kind: 'AGI'
                  }
                ),

                input(
                  'DEDUCTION',
                  '10000.00',
                  {
                    kind:
                      'DEDUCTION'
                  }
                )
              ]
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
      'blocks unvalidated calculation facts',
      () => {

        const badInput = {
          inputId:
            'BAD',

          factPath:
            'unverified.bad',

          value:
            decimal('100.00'),

          evidenceIds:
            ['EVIDENCE-BAD'],

          validated:
            false
        };

        expect(
          () =>
            Federal1040TaxableIncomeEngine
              .calculate(
                context(
                  Federal1040TaxableIncomeEngine
                    .calculationType
                ),
                [
                  badInput as never
                ]
              )
        ).toThrow(
          'TAX_CALCULATION_UNVALIDATED_FACT_BLOCKED'
        );
      }
    );
  }
);
`;

// ============================================================
// WRITE IMPLEMENTATION
// ============================================================

write(
  'src/taxguard/calculation/Federal1040RemainingCalculations.ts',
  source
);

write(
  'src/tests/federal1040RemainingCalculations.test.ts',
  tests
);

// ============================================================
// PRESERVE EXISTING INDEX AND APPEND EXPORT
// ============================================================

const indexPath =
  path.join(
    ROOT,
    'src',
    'taxguard',
    'calculation',
    'index.ts'
  );

if (
  !fs.existsSync(indexPath)
) {
  throw new Error(
    'TAXGUARD_CALCULATION_INDEX_NOT_FOUND'
  );
}

const exportLine =
  "export * from './Federal1040RemainingCalculations';";

let indexContent =
  fs.readFileSync(
    indexPath,
    'utf8'
  );

if (
  !indexContent.includes(
    exportLine
  )
) {
  const backup =
    path.join(
      backupDir,
      'src',
      'taxguard',
      'calculation',
      'index.ts'
    );

  fs.mkdirSync(
    path.dirname(backup),
    {
      recursive: true
    }
  );

  fs.copyFileSync(
    indexPath,
    backup
  );

  if (
    !indexContent.endsWith('\n')
  ) {
    indexContent += '\n';
  }

  indexContent +=
    exportLine + '\n';

  fs.writeFileSync(
    indexPath,
    indexContent,
    'utf8'
  );

  console.log(
    'UPDATED src/taxguard/calculation/index.ts'
  );
}

// ============================================================
// M7.13 — COMPLETE VALIDATION / FREEZE GATE
// ============================================================

console.log('');
console.log(
  '============================================================'
);
console.log(
  'TAXGUARD M7.5-M7.13 IMPLEMENTATION WRITTEN'
);
console.log(
  'Beginning fail-closed validation...'
);
console.log(
  '============================================================'
);

run(
  'npm.cmd',
  [
    'run',
    'typecheck'
  ]
);

run(
  'npm.cmd',
  [
    'test',
    '--',
    '--run',
    'src/tests/federal1040RemainingCalculations.test.ts'
  ]
);

run(
  'npm.cmd',
  [
    'test',
    '--',
    '--run'
  ]
);

run(
  'npm.cmd',
  [
    'run',
    'build'
  ]
);

run(
  'npm.cmd',
  [
    'run',
    'typecheck'
  ]
);

console.log('');
console.log(
  '============================================================'
);
console.log(
  'TAXGUARD M7.5-M7.13 IMPLEMENTATION VERIFIED'
);
console.log(
  '============================================================'
);
console.log(
  'M7.5  Deduction Engine                  PASS'
);
console.log(
  'M7.6  Taxable Income                    PASS'
);
console.log(
  'M7.7  Federal Income Tax                PASS'
);
console.log(
  'M7.8  Credits + Payments                PASS'
);
console.log(
  'M7.9  Self-Employment Foundation        PASS'
);
console.log(
  'M7.10 Refund / Balance Due              PASS'
);
console.log(
  'M7.11 Evidence + Trace                  PASS'
);
console.log(
  'M7.12 Human Review / Overrides          PASS'
);
console.log(
  'M7.13 Regression + Build                PASS'
);
console.log('');
console.log(
  'AI final calculation authority: BLOCKED'
);
console.log(
  'External tax submission: DISABLED'
);
console.log(
  'Deterministic calculation: ENFORCED'
);
console.log('');
console.log(
  'Backup location:'
);
console.log(
  backupDir
);
console.log('');
console.log(
  'CMD remains open.'
);
console.log(
  '============================================================'
);



