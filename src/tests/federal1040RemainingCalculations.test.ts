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

function input<const T extends Record<string, unknown>>(
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
