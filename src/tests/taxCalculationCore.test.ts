import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxDecimal
} from '../taxguard/calculation/TaxDecimal';

import {
  TaxCalculationGuard
} from '../taxguard/calculation/TaxCalculationContract';

describe(
  'M7.1 Deterministic Calculation Core',
  () => {

    it(
      'parses money exactly',
      () => {
        expect(
          TaxDecimal
            .parse(
              '85000.00',
              2
            )
            .toFixed()
        ).toBe(
          '85000.00'
        );
      }
    );

    it(
      'adds without floating point drift',
      () => {
        const result =
          TaxDecimal
            .parse('0.10')
            .add(
              TaxDecimal
                .parse('0.20')
            );

        expect(
          result.toFixed()
        ).toBe('0.30');
      }
    );

    it(
      'subtracts deterministically',
      () => {
        const result =
          TaxDecimal
            .parse('100.00')
            .subtract(
              TaxDecimal
                .parse('19.99')
            );

        expect(
          result.toFixed()
        ).toBe('80.01');
      }
    );

    it(
      'multiplies exactly',
      () => {
        const result =
          TaxDecimal
            .parse('10.25')
            .multiply(
              TaxDecimal
                .parse('2.00')
            );

        expect(
          result.toFixed()
        ).toBe(
          '20.5000'
        );
      }
    );

    it(
      'divides with explicit rounding',
      () => {
        const result =
          TaxDecimal
            .parse('10')
            .divide(
              TaxDecimal
                .parse('3'),
              2,
              'HALF_UP'
            );

        expect(
          result.toFixed()
        ).toBe('3.33');
      }
    );

    it(
      'blocks division by zero',
      () => {
        expect(() =>
          TaxDecimal
            .parse('10')
            .divide(
              TaxDecimal
                .parse('0'),
              2
            )
        ).toThrow(
          'TAX_DECIMAL_DIVIDE_BY_ZERO'
        );
      }
    );

    it(
      'requires explicit rounding before scale loss',
      () => {
        expect(() =>
          TaxDecimal.parse(
            '1.234',
            2
          )
        ).toThrow(
          'TAX_DECIMAL_SCALE_LOSS_REQUIRES_ROUNDING'
        );
      }
    );

    it(
      'supports HALF_UP',
      () => {
        expect(
          TaxDecimal
            .parse('2.345')
            .round(
              2,
              'HALF_UP'
            )
            .toFixed()
        ).toBe('2.35');
      }
    );

    it(
      'supports HALF_EVEN',
      () => {
        expect(
          TaxDecimal
            .parse('2.345')
            .round(
              2,
              'HALF_EVEN'
            )
            .toFixed()
        ).toBe('2.34');

        expect(
          TaxDecimal
            .parse('2.355')
            .round(
              2,
              'HALF_EVEN'
            )
            .toFixed()
        ).toBe('2.36');
      }
    );

    it(
      'handles negative rounding',
      () => {
        expect(
          TaxDecimal
            .parse('-2.345')
            .round(
              2,
              'HALF_UP'
            )
            .toFixed()
        ).toBe('-2.35');
      }
    );

    it(
      'serializes without converting to JavaScript number',
      () => {
        expect(
          TaxDecimal
            .parse(
              '999999999999.99'
            )
            .toJSON()
        ).toEqual({
          unscaledValue:
            '99999999999999',

          scale:
            2
        });
      }
    );

    it(
      'requires rule provenance',
      () => {
        expect(() =>
          TaxCalculationGuard
            .validateContext({
              calculationId:
                'CALC-001',

              calculationType:
                'TEST',

              clientId:
                'CLIENT-001',

              engagementId:
                'ENG-001',

              taxYear:
                2025,

              jurisdiction:
                'federal',

              ruleIds:
                [],

              authorityIds:
                ['AUTH-001'],

              evidencePackageIds:
                ['EVP-001'],

              correlationId:
                'CORR-001',

              roundingMode:
                'HALF_UP',

              riskLevel:
                'material'
            })
        ).toThrow(
          'TAX_CALCULATION_VERIFIED_RULE_REQUIRED'
        );
      }
    );

    it(
      'requires authority provenance',
      () => {
        expect(() =>
          TaxCalculationGuard
            .validateContext({
              calculationId:
                'CALC-002',

              calculationType:
                'TEST',

              clientId:
                'CLIENT-001',

              engagementId:
                'ENG-001',

              taxYear:
                2025,

              jurisdiction:
                'federal',

              ruleIds:
                ['RULE-001'],

              authorityIds:
                [],

              evidencePackageIds:
                ['EVP-001'],

              correlationId:
                'CORR-002',

              roundingMode:
                'HALF_UP',

              riskLevel:
                'material'
            })
        ).toThrow(
          'TAX_CALCULATION_VERIFIED_AUTHORITY_REQUIRED'
        );
      }
    );

    it(
      'requires evidence provenance',
      () => {
        expect(() =>
          TaxCalculationGuard
            .validateContext({
              calculationId:
                'CALC-003',

              calculationType:
                'TEST',

              clientId:
                'CLIENT-001',

              engagementId:
                'ENG-001',

              taxYear:
                2025,

              jurisdiction:
                'federal',

              ruleIds:
                ['RULE-001'],

              authorityIds:
                ['AUTH-001'],

              evidencePackageIds:
                [],

              correlationId:
                'CORR-003',

              roundingMode:
                'HALF_UP',

              riskLevel:
                'material'
            })
        ).toThrow(
          'TAX_CALCULATION_EVIDENCE_REQUIRED'
        );
      }
    );

    it(
      'rejects inputs without evidence',
      () => {
        expect(() =>
          TaxCalculationGuard
            .validateInputs([
              {
                inputId:
                  'INPUT-001',

                factPath:
                  'income.wages',

                value:
                  TaxDecimal.parse(
                    '85000.00'
                  ),

                evidenceIds:
                  [],

                validated:
                  true
              }
            ])
        ).toThrow(
          'TAX_CALCULATION_INPUT_EVIDENCE_REQUIRED'
        );
      }
    );

    it(
      'blocked calculations require human review',
      () => {
        const result =
          TaxCalculationGuard
            .createBlockedResult(
              {
                calculationId:
                  'CALC-004',

                calculationType:
                  'TEST',

                clientId:
                  'CLIENT-001',

                engagementId:
                  'ENG-001',

                taxYear:
                  2025,

                jurisdiction:
                  'federal',

                ruleIds:
                  ['RULE-001'],

                authorityIds:
                  ['AUTH-001'],

                evidencePackageIds:
                  ['EVP-001'],

                correlationId:
                  'CORR-004',

                roundingMode:
                  'HALF_UP',

                riskLevel:
                  'material'
              },

              [
                'MISSING_REQUIRED_FACT'
              ]
            );

        expect(
          result.status
        ).toBe('BLOCKED');

        expect(
          result
            .requiresHumanReview
        ).toBe(true);

        expect(
          result.aiCalculated
        ).toBe(false);

        expect(
          result.deterministic
        ).toBe(true);
      }
    );

    describe('Section 13 Financial Precision & Invariants', () => {
      it('handles 0.01 values and prevents floating point drift over repeated summation', () => {
        let sum = TaxDecimal.zero(2);
        const oneCent = TaxDecimal.parse('0.01', 2);
        for (let i = 0; i < 1000; i++) {
          sum = sum.add(oneCent);
        }
        expect(sum.toFixed()).toBe('10.00');
        expect(sum.unscaledValue).toBe(1000n);
      });

      it('handles large amounts without precision overflow', () => {
        const largeVal1 = TaxDecimal.parse('15000000000.50', 2);
        const largeVal2 = TaxDecimal.parse('8750000000.75', 2);
        const total = largeVal1.add(largeVal2);
        expect(total.toFixed()).toBe('23750000001.25');
      });

      it('computes negative adjustments deterministically', () => {
        const grossIncome = TaxDecimal.parse('50000.00', 2);
        const negativeAdjustment = TaxDecimal.parse('-3500.50', 2);
        const adjustedGross = grossIncome.add(negativeAdjustment);
        expect(adjustedGross.toFixed()).toBe('46499.50');
      });

      it('evaluates exact zero variance and detects one-cent imbalance', () => {
        const totalDebits = TaxDecimal.parse('125000.50', 2);
        const equalCredits = TaxDecimal.parse('125000.50', 2);
        const imbalancedCredits = TaxDecimal.parse('125000.51', 2);

        const balancedVariance = totalDebits.subtract(equalCredits);
        expect(balancedVariance.isZero()).toBe(true);
        expect(balancedVariance.toFixed()).toBe('0.00');

        const oneCentVariance = totalDebits.subtract(imbalancedCredits);
        expect(oneCentVariance.isZero()).toBe(false);
        expect(oneCentVariance.toFixed()).toBe('-0.01');
      });
    });
  }
);
