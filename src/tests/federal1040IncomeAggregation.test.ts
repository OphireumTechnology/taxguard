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
  Federal1040IncomeAggregationEngine,
  type Federal1040IncomeInput
} from '../taxguard/calculation/Federal1040IncomeAggregation';

function context():
  TaxCalculationContext {

  return {
    calculationId:
      'CALC-INCOME-001',

    calculationType:
      'FEDERAL_1040_INCOME_AGGREGATION',

    clientId:
      'CLIENT-005',

    engagementId:
      'ENG-2025-005',

    taxYear:
      2025,

    jurisdiction:
      'federal',

    ruleIds:
      ['RULE-INCOME-001'],

    authorityIds:
      ['AUTH-INCOME-001'],

    evidencePackageIds:
      ['EVP-INCOME-001'],

    correlationId:
      'CORR-INCOME-001',

    roundingMode:
      'HALF_UP',

    riskLevel:
      'routine'
  };
}

function input(
  inputId: string,
  category:
    Federal1040IncomeInput[
      'category'
    ],
  amount: string
):
  Federal1040IncomeInput {

  return {
    inputId,

    factPath:
      'income.' +
      category.toLowerCase(),

    category,

    value:
      TaxDecimal.parse(
        amount,
        2
      ),

    evidenceIds:
      [
        'EVIDENCE-' +
        inputId
      ],

    sourceDocumentIds:
      [
        'DOC-' +
        inputId
      ],

    validated:
      true
  };
}

describe(
  'M7.3 Federal 1040 Income Aggregation',
  () => {

    it(
      'aggregates wages',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result
            .aggregation
            .wages
            .toFixed()
        ).toBe(
          '85000.00'
        );

        expect(
          result.value.toFixed()
        ).toBe(
          '85000.00'
        );
      }
    );

    it(
      'aggregates multiple wage documents',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '50000.00'
                ),

                input(
                  'W2-2',
                  'WAGES',
                  '35000.00'
                )
              ]
            );

        expect(
          result
            .aggregation
            .wages
            .toFixed()
        ).toBe(
          '85000.00'
        );
      }
    );

    it(
      'aggregates multiple income categories',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                ),

                input(
                  'INT-1',
                  'TAXABLE_INTEREST',
                  '500.00'
                ),

                input(
                  'DIV-1',
                  'ORDINARY_DIVIDENDS',
                  '1000.00'
                ),

                input(
                  'OTHER-1',
                  'OTHER_INCOME',
                  '250.00'
                )
              ]
            );

        expect(
          result.value.toFixed()
        ).toBe(
          '86750.00'
        );
      }
    );

    it(
      'supports negative business income',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                ),

                input(
                  'BUS-1',
                  'BUSINESS_INCOME',
                  '-5000.00'
                )
              ]
            );

        expect(
          result
            .aggregation
            .businessIncome
            .toFixed()
        ).toBe(
          '-5000.00'
        );

        expect(
          result.value.toFixed()
        ).toBe(
          '80000.00'
        );
      }
    );

    it(
      'supports capital gain/loss input',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'CAP-1',
                  'CAPITAL_GAIN_LOSS',
                  '-1000.00'
                )
              ]
            );

        expect(
          result
            .aggregation
            .capitalGainLoss
            .toFixed()
        ).toBe(
          '-1000.00'
        );
      }
    );

    it(
      'preserves evidence package provenance',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result
            .evidencePackageIds
        ).toEqual(
          ['EVP-INCOME-001']
        );
      }
    );

    it(
      'preserves rule provenance',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result.ruleIds
        ).toEqual(
          ['RULE-INCOME-001']
        );
      }
    );

    it(
      'preserves authority provenance',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result.authorityIds
        ).toEqual(
          ['AUTH-INCOME-001']
        );
      }
    );

    it(
      'creates deterministic trace',
      () => {
        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result.trace.length
        ).toBe(2);

        expect(
          result.trace[1]
            .operation
        ).toBe(
          'CALCULATE_GROSS_INCOME'
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
      'blocks duplicate input IDs',
      () => {
        expect(() =>
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [
                input(
                  'SAME',
                  'WAGES',
                  '100.00'
                ),

                input(
                  'SAME',
                  'WAGES',
                  '200.00'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_INCOME_DUPLICATE_INPUT'
        );
      }
    );

    it(
      'blocks non-federal jurisdiction',
      () => {
        const wrong = {
          ...context(),

          jurisdiction:
            'state' as const
        };

        expect(() =>
          Federal1040IncomeAggregationEngine
            .aggregate(
              wrong,
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_INCOME_FEDERAL_JURISDICTION_REQUIRED'
        );
      }
    );

    it(
      'blocks wrong calculation type',
      () => {
        const wrong = {
          ...context(),

          calculationType:
            'OTHER_CALCULATION'
        };

        expect(() =>
          Federal1040IncomeAggregationEngine
            .aggregate(
              wrong,
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            )
        ).toThrow(
          'FEDERAL_1040_INCOME_CALCULATION_TYPE_MISMATCH'
        );
      }
    );

    it(
      'requires evidence on every input',
      () => {
        const bad =
          input(
            'W2-1',
            'WAGES',
            '85000.00'
          );

        bad.evidenceIds = [];

        expect(() =>
          Federal1040IncomeAggregationEngine
            .aggregate(
              context(),
              [bad]
            )
        ).toThrow(
          'TAX_CALCULATION_INPUT_EVIDENCE_REQUIRED'
        );
      }
    );

    it(
      'requires human review for critical risk',
      () => {
        const critical = {
          ...context(),

          riskLevel:
            'critical' as const
        };

        const result =
          Federal1040IncomeAggregationEngine
            .aggregate(
              critical,
              [
                input(
                  'W2-1',
                  'WAGES',
                  '85000.00'
                )
              ]
            );

        expect(
          result
            .requiresHumanReview
        ).toBe(true);

        expect(
          result.reviewReasons
        ).toContain(
          'CRITICAL_RISK_CALCULATION_REVIEW_REQUIRED'
        );
      }
    );
  }
);
