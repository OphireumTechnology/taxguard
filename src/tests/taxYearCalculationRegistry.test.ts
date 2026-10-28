import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxDecimal
} from '../taxguard/calculation/TaxDecimal';

import type {
  TaxCalculationContext,
  TaxCalculationDefinition,
  TaxCalculationInput,
  TaxCalculationResult
} from '../taxguard/calculation/TaxCalculationContract';

import {
  TaxYearCalculationRegistry
} from '../taxguard/calculation/TaxYearCalculationRegistry';

function definition(
  version = '1.0.0',
  years = [2025]
):
  TaxCalculationDefinition {

  return {
    calculationType:
      'TEST_CALCULATION',

    version,

    supportedTaxYears:
      years,

    execute(
      context:
        TaxCalculationContext,

      inputs:
        readonly TaxCalculationInput[]
    ): TaxCalculationResult {

      const value =
        inputs.reduce(
          (
            total,
            input
          ) =>
            total.add(
              input.value
            ),

          TaxDecimal.zero(2)
        );

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

        value,

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
          false,

        reviewReasons:
          [],

        correlationId:
          context.correlationId,

        calculatedAt:
          '2026-09-24T00:00:00.000Z',

        deterministic:
          true,

        aiCalculated:
          false
      };
    }
  };
}

function register(
  version = '1.0.0',
  years = [2025]
) {
  return TaxYearCalculationRegistry
    .registerDraft({
      calculationType:
        'TEST_CALCULATION',

      version,

      jurisdiction:
        'federal',

      supportedTaxYears:
        years,

      definition:
        definition(
          version,
          years
        ),

      ruleIds:
        ['RULE-001'],

      authorityIds:
        ['AUTH-001']
    });
}

function context(
  taxYear = 2025
):
  TaxCalculationContext {

  return {
    calculationId:
      'CALC-001',

    calculationType:
      'TEST_CALCULATION',

    clientId:
      'CLIENT-001',

    engagementId:
      'ENG-001',

    taxYear,

    jurisdiction:
      'federal',

    ruleIds:
      ['RULE-001'],

    authorityIds:
      ['AUTH-001'],

    evidencePackageIds:
      ['EVP-001'],

    correlationId:
      'CORR-001',

    roundingMode:
      'HALF_UP',

    riskLevel:
      'routine'
  };
}

function inputs():
  TaxCalculationInput[] {

  return [
    {
      inputId:
        'INPUT-001',

      factPath:
        'income.wages',

      value:
        TaxDecimal.parse(
          '100.00',
          2
        ),

      evidenceIds:
        ['EVIDENCE-001'],

      validated:
        true
    }
  ];
}

describe(
  'M7.2 Tax-Year Calculation Registry',
  () => {

    beforeEach(() => {
      TaxYearCalculationRegistry
        .clearForTests();
    });

    it(
      'registers calculations as draft',
      () => {
        expect(
          register().status
        ).toBe('DRAFT');
      }
    );

    it(
      'requires explicit human verification',
      () => {
        register();

        const verified =
          TaxYearCalculationRegistry
            .verify({
              calculationType:
                'TEST_CALCULATION',

              version:
                '1.0.0',

              verifiedBy:
                'tax-professional-001'
            });

        expect(
          verified.status
        ).toBe('VERIFIED');

        expect(
          verified.verifiedBy
        ).toBe(
          'tax-professional-001'
        );
      }
    );

    it(
      'blocks duplicate definition',
      () => {
        register();

        expect(() =>
          register()
        ).toThrow(
          'TAX_CALCULATION_DUPLICATE_DEFINITION'
        );
      }
    );

    it(
      'blocks direct execution of draft calculation',
      () => {
        register();

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              version:
                '1.0.0',

              context:
                context(),

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_UNVERIFIED_DEFINITION_BLOCKED'
        );
      }
    );

    it(
      'executes verified deterministic definition',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'tax-professional-001'
          });

        const result =
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              context:
                context(),

              inputs:
                inputs()
            });

        expect(
          result.status
        ).toBe('CALCULATED');

        expect(
          result.value
            ?.toFixed()
        ).toBe('100.00');

        expect(
          result.aiCalculated
        ).toBe(false);
      }
    );

    it(
      'filters by tax year',
      () => {
        register(
          '1.0.0',
          [2025]
        );

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        expect(
          TaxYearCalculationRegistry
            .findVerified(
              'TEST_CALCULATION',
              2024,
              'federal'
            )
        ).toHaveLength(0);

        expect(
          TaxYearCalculationRegistry
            .findVerified(
              'TEST_CALCULATION',
              2025,
              'federal'
            )
        ).toHaveLength(1);
      }
    );

    it(
      'blocks unsupported tax year',
      () => {
        register(
          '1.0.0',
          [2025]
        );

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              version:
                '1.0.0',

              context:
                context(2024),

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_UNSUPPORTED_TAX_YEAR'
        );
      }
    );

    it(
      'blocks wrong jurisdiction',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        const wrong = {
          ...context(),

          jurisdiction:
            'state' as const
        };

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              version:
                '1.0.0',

              context:
                wrong,

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_WRONG_JURISDICTION'
        );
      }
    );

    it(
      'blocks rule provenance mismatch',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        const wrong = {
          ...context(),

          ruleIds:
            ['OTHER-RULE']
        };

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              context:
                wrong,

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_RULE_PROVENANCE_MISMATCH'
        );
      }
    );

    it(
      'blocks authority provenance mismatch',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        const wrong = {
          ...context(),

          authorityIds:
            ['OTHER-AUTHORITY']
        };

        expect(() =>
          TaxYearCalculationRegistry
            .execute({
              calculationType:
                'TEST_CALCULATION',

              context:
                wrong,

              inputs:
                inputs()
            })
        ).toThrow(
          'TAX_CALCULATION_AUTHORITY_PROVENANCE_MISMATCH'
        );
      }
    );

    it(
      'supports supersession without deleting history',
      () => {
        register(
          '1.0.0'
        );

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        const old =
          TaxYearCalculationRegistry
            .supersede(
              'TEST_CALCULATION',
              '1.0.0',
              '1.1.0'
            );

        expect(
          old.status
        ).toBe(
          'SUPERSEDED'
        );

        expect(
          old.supersededBy
        ).toBe(
          '1.1.0'
        );

        expect(
          TaxYearCalculationRegistry
            .get(
              'TEST_CALCULATION',
              '1.0.0'
            )
            ?.status
        ).toBe(
          'SUPERSEDED'
        );
      }
    );

    it(
      'blocks self supersession',
      () => {
        register();

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        expect(() =>
          TaxYearCalculationRegistry
            .supersede(
              'TEST_CALCULATION',
              '1.0.0',
              '1.0.0'
            )
        ).toThrow(
          'TAX_CALCULATION_SELF_SUPERSESSION_BLOCKED'
        );
      }
    );

    it(
      'returns defensive copies',
      () => {
        register();

        const first =
          TaxYearCalculationRegistry
            .get(
              'TEST_CALCULATION',
              '1.0.0'
            );

        if (!first) {
          throw new Error(
            'fixture missing'
          );
        }

        (
          first.ruleIds as string[]
        ).push(
          'MUTATION'
        );

        const second =
          TaxYearCalculationRegistry
            .get(
              'TEST_CALCULATION',
              '1.0.0'
            );

        expect(
          second?.ruleIds
        ).toEqual(
          ['RULE-001']
        );
      }
    );

    it(
      'blocks ambiguous verified definitions',
      () => {
        register(
          '1.0.0'
        );

        register(
          '2.0.0'
        );

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '1.0.0',

            verifiedBy:
              'reviewer-001'
          });

        TaxYearCalculationRegistry
          .verify({
            calculationType:
              'TEST_CALCULATION',

            version:
              '2.0.0',

            verifiedBy:
              'reviewer-002'
          });

        expect(() =>
          TaxYearCalculationRegistry
            .resolveVerified(
              'TEST_CALCULATION',
              2025,
              'federal'
            )
        ).toThrow(
          'TAX_CALCULATION_AMBIGUOUS_VERIFIED_DEFINITION'
        );
      }
    );
  }
);
