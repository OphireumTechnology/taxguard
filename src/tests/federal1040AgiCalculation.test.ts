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
  Federal1040AgiCalculationEngine,
  type Federal1040AgiInput
} from '../taxguard/calculation/Federal1040AgiCalculation';

function context(
  riskLevel:
    TaxCalculationContext[
      'riskLevel'
    ] = 'routine'
):
  TaxCalculationContext {

  return {
    calculationId:
      'CALC-AGI-001',

    calculationType:
      'FEDERAL_1040_AGI_CALCULATION',

    clientId:
      'CLIENT-005',

    engagementId:
      'ENG-2025-005',

    taxYear:
      2025,

    jurisdiction:
      'federal',

    ruleIds:
      ['RULE-AGI-001'],

    authorityIds:
      ['AUTH-AGI-001'],

    evidencePackageIds:
      ['EVP-AGI-001'],

    correlationId:
      'CORR-AGI-001',

    roundingMode:
      'HALF_UP',

    riskLevel
  };
}

function gross(
  amount: string
):
  Federal1040AgiInput {

  return {
    inputId:
      'GROSS-001',

    factPath:
      'federal1040.grossIncome',

    inputType:
      'GROSS_INCOME',

    value:
      TaxDecimal.parse(
        amount,
        2
      ),

    evidenceIds:
      ['EVIDENCE-GROSS-001'],

    sourceDocumentIds:
      ['DOC-GROSS-001'],

    validated:
      true
  };
}

function adjustment(
  id: string,
  amount: string,
  category:
    NonNullable<
      Federal1040AgiInput[
        'adjustmentCategory'
      ]
    >
):
  Federal1040AgiInput {

  return {
    inputId:
      id,

    factPath:
      'federal1040.adjustments.' +
      category.toLowerCase(),

    inputType:
      'ADJUSTMENT',

    adjustmentCategory:
      category,

    value:
      TaxDecimal.parse(
        amount,
        2
      ),

    evidenceIds:
      [
        'EVIDENCE-' + id
      ],

    sourceDocumentIds:
      [
        'DOC-' + id
      ],

    validated:
      true
  };
}

describe(
  'M7.4 Federal 1040 AGI Calculation',
  () => {

    it(
      'calculates AGI from gross income',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                )
              ]
            );

        expect(
          result.value.toFixed()
        ).toBe(
          '85000.00'
        );

        expect(
          result
            .breakdown
            .totalAdjustments
            .toFixed()
        ).toBe(
          '0.00'
        );
      }
    );

    it(
      'subtracts validated adjustments',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '2500.00',
                  'IRA_DEDUCTION'
                ),

                adjustment(
                  'ADJ-002',
                  '1000.00',
                  'HSA_DEDUCTION'
                )
              ]
            );

        expect(
          result
            .breakdown
            .totalAdjustments
            .toFixed()
        ).toBe(
          '3500.00'
        );

        expect(
          result.value.toFixed()
        ).toBe(
          '81500.00'
        );
      }
    );

    it(
      'aggregates duplicate categories without losing provenance',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '50000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '500.00',
                  'OTHER_VERIFIED_ADJUSTMENT'
                ),

                adjustment(
                  'ADJ-002',
                  '250.00',
                  'OTHER_VERIFIED_ADJUSTMENT'
                )
              ]
            );

        expect(
          result
            .breakdown
            .adjustments
            .OTHER_VERIFIED_ADJUSTMENT
            ?.toFixed()
        ).toBe(
          '750.00'
        );

        expect(
          result.value.toFixed()
        ).toBe(
          '49250.00'
        );
      }
    );

    it(
      'requires exactly one gross income input',
      () => {
        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                adjustment(
                  'ADJ-001',
                  '100.00',
                  'OTHER_VERIFIED_ADJUSTMENT'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_SINGLE_GROSS_INCOME_REQUIRED'
        );
      }
    );

    it(
      'blocks multiple gross income inputs',
      () => {
        const secondGross:
          Federal1040AgiInput = {
            ...gross(
              '1000.00'
            ),

            inputId:
              'GROSS-002'
          };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),
                secondGross
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_SINGLE_GROSS_INCOME_REQUIRED'
        );
      }
    );

    it(
      'blocks duplicate input IDs',
      () => {
        const first =
          adjustment(
            'ADJ-001',
            '100.00',
            'IRA_DEDUCTION'
          );

        const duplicate = {
          ...first,

          adjustmentCategory: 'HSA_DEDUCTION' as const
        };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),
                first,
                duplicate
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_DUPLICATE_INPUT'
        );
      }
    );

    it(
      'blocks negative adjustment inputs',
      () => {
        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '-100.00',
                  'IRA_DEDUCTION'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_NEGATIVE_ADJUSTMENT_BLOCKED'
        );
      }
    );

    it(
      'requires adjustment category',
      () => {
        const bad:
          Federal1040AgiInput = {

          inputId:
            'ADJ-001',

          factPath:
            'federal1040.adjustment',

          inputType:
            'ADJUSTMENT',

          value:
            TaxDecimal.parse(
              '100.00',
              2
            ),

          evidenceIds:
            ['EVIDENCE-ADJ-001'],

          validated:
            true
        };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),
                bad
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_ADJUSTMENT_CATEGORY_REQUIRED'
        );
      }
    );

    it(
      'blocks missing evidence through the calculation guard',
      () => {
        const bad = {
          ...adjustment(
            'ADJ-001',
            '100.00',
            'IRA_DEDUCTION'
          ),

          evidenceIds:
            []
        };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),
                bad
              ]
            )
        ).toThrow(
          'TAX_CALCULATION_INPUT_EVIDENCE_REQUIRED'
        );
      }
    );

    it(
      'preserves deterministic calculation trace',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '85000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '1000.00',
                  'HSA_DEDUCTION'
                )
              ]
            );

        expect(
          result.trace.length
        ).toBe(3);

        expect(
          result.trace[
            result.trace.length - 1
          ].operation
        ).toBe(
          'CALCULATE_ADJUSTED_GROSS_INCOME'
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
      'routes negative AGI to human review',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(),
              [
                gross(
                  '1000.00'
                ),

                adjustment(
                  'ADJ-001',
                  '1500.00',
                  'OTHER_VERIFIED_ADJUSTMENT'
                )
              ]
            );

        expect(
          result.value.toFixed()
        ).toBe(
          '-500.00'
        );

        expect(
          result.status
        ).toBe(
          'REQUIRES_REVIEW'
        );

        expect(
          result.requiresHumanReview
        ).toBe(true);

        expect(
          result.reviewReasons
        ).toContain(
          'NEGATIVE_AGI_REVIEW_REQUIRED'
        );
      }
    );

    it(
      'propagates critical-risk human review',
      () => {
        const result =
          Federal1040AgiCalculationEngine
            .calculate(
              context(
                'critical'
              ),
              [
                gross(
                  '85000.00'
                )
              ]
            );

        expect(
          result.status
        ).toBe(
          'REQUIRES_REVIEW'
        );

        expect(
          result.reviewReasons
        ).toContain(
          'CRITICAL_RISK_CALCULATION_REVIEW_REQUIRED'
        );
      }
    );

    it(
      'blocks wrong jurisdiction',
      () => {
        const badContext = {
          ...context(),

          jurisdiction:
            'state' as const
        };

        expect(() =>
          Federal1040AgiCalculationEngine
            .calculate(
              badContext,
              [
                gross(
                  '85000.00'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_AGI_FEDERAL_JURISDICTION_REQUIRED'
        );
      }
    );
  }
);

