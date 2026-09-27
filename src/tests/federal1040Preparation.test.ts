
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxDecimal
} from '../taxguard/calculation/TaxDecimal';

import type {
  TaxCalculationResult
} from '../taxguard/calculation/TaxCalculationContract';

import {
  Federal1040ReturnAssemblyEngine,
  Federal1040CrossFormReconciliationGuard,
  Federal1040ReturnVersionControl,
  Federal1040PreparationEvidenceGuard,
  Federal1040ProfessionalReviewGate,
  Federal1040ExternalFilingGuard
} from '../taxguard/preparation/Federal1040Preparation';

function calculation(
  id: string,
  calculationType: string,
  value: string,
  requiresReview = false
):
  TaxCalculationResult {

  const amount =
    TaxDecimal.parse(
      value,
      2
    );

  return {
    calculationId:
      id,

    calculationType,

    taxYear:
      2025,

    jurisdiction:
      'federal',

    status:
      requiresReview
        ? 'REQUIRES_REVIEW'
        : 'CALCULATED',

    value:
      amount,

    ruleIds:
      ['RULE-1'],

    authorityIds:
      ['AUTHORITY-1'],

    evidencePackageIds:
      ['EVIDENCE-1'],

    trace: [
      {
        sequence:
          1,

        operation:
          'TEST_CALCULATION',

        inputReferences:
          ['INPUT-1'],

        ruleIds:
          ['RULE-1'],

        authorityIds:
          ['AUTHORITY-1'],

        result:
          amount,

        explanation:
          'Validated deterministic calculation used for M8 regression testing.'
      }
    ],

    requiresHumanReview:
      requiresReview,

    reviewReasons:
      requiresReview
        ? [
            'PROFESSIONAL_REVIEW_REQUIRED'
          ]
        : [],

    correlationId:
      'CORRELATION-1',

    calculatedAt:
      new Date()
        .toISOString(),

    deterministic:
      true,

    aiCalculated:
      false
  };
}

const context = {
  returnId:
    'RETURN-1',

  clientId:
    'CLIENT-1',

  engagementId:
    'ENGAGEMENT-1',

  taxYear:
    2025,

  correlationId:
    'CORRELATION-1',

  ruleIds:
    ['RULE-1'],

  authorityIds:
    ['AUTHORITY-1'],

  evidencePackageIds:
    ['EVIDENCE-1']
};

describe(
  'TaxGuard M8 Federal 1040 Preparation Engine',
  () => {

    it(
      'M8.1 assembles deterministic non-AI return',
      () => {

        const result =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-1',
                  'FEDERAL_1040_TAXABLE_INCOME',
                  '80000.00'
                )
              ],

              {
                '1040_LINE_15':
                  'CALC-1'
              }
            );

        expect(
          result.status
        ).toBe(
          'READY_FOR_APPROVAL'
        );

        expect(
          result.deterministic
        ).toBe(true);

        expect(
          result.aiPrepared
        ).toBe(false);

        expect(
          result.externallyFiled
        ).toBe(false);
      }
    );

    it(
      'M8.2 binds calculation provenance to a Form 1040 line',
      () => {

        const result =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-2',
                  'FEDERAL_1040_INCOME_TAX',
                  '1000.00'
                )
              ],

              {
                '1040_LINE_16':
                  'CALC-2'
              }
            );

        expect(
          result
            .lines[
              '1040_LINE_16'
            ]
            .sourceId
        ).toBe(
          'CALC-2'
        );

        expect(
          result
            .lines[
              '1040_LINE_16'
            ]
            .authorityIds
        ).toEqual(
          ['AUTHORITY-1']
        );
      }
    );

    it(
      'M8.3 detects Schedule SE dependency',
      () => {

        const result =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-SE',
                  'FEDERAL_1040_SELF_EMPLOYMENT',
                  '1000.00'
                )
              ],

              {
                '1040_SE_TAX':
                  'CALC-SE'
              }
            );

        expect(
          result.schedules.some(
            dependency =>
              dependency.schedule ===
              'SCHEDULE_SE'
          )
        ).toBe(true);
      }
    );

    it(
      'M8.4 blocks cross-form mismatch',
      () => {

        expect(
          () =>
            Federal1040CrossFormReconciliationGuard
              .requireEqual(
                'FORM_1040',

                TaxDecimal.parse(
                  '100.00',
                  2
                ),

                'SUPPORTING_SCHEDULE',

                TaxDecimal.parse(
                  '99.00',
                  2
                )
              )
        ).toThrow(
          'FEDERAL_1040_CROSS_FORM_MISMATCH'
        );
      }
    );

    it(
      'M8.5 creates immutable sequential return versions',
      () => {

        const returnId =
          'RETURN-VERSION-TEST';

        const version1 =
          Federal1040ReturnVersionControl
            .create(
              returnId,
              'PREPARER-A',
              'Initial preparation'
            );

        const version2 =
          Federal1040ReturnVersionControl
            .create(
              returnId,
              'PREPARER-A',
              'Corrected preparation'
            );

        expect(
          version1.version
        ).toBe(1);

        expect(
          version2.version
        ).toBe(2);

        expect(
          version2.priorVersion
        ).toBe(1);

        expect(
          version2.immutable
        ).toBe(true);
      }
    );
    it(
      'M8.6 validates preparation evidence and provenance',
      () => {

        const prepared =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-EVIDENCE',
                  'FEDERAL_1040_TAXABLE_INCOME',
                  '50000.00'
                )
              ],

              {
                '1040_LINE_15':
                  'CALC-EVIDENCE'
              }
            );

        expect(
          Federal1040PreparationEvidenceGuard
            .validate(
              prepared
            )
        ).toBe(true);
      }
    );

    it(
      'M8.7 requires maker-checker separation for material approval',
      () => {

        const prepared =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-REVIEW',
                  'FEDERAL_1040_TAXABLE_INCOME',
                  '50000.00',
                  true
                )
              ],

              {
                '1040_LINE_15':
                  'CALC-REVIEW'
              }
            );

        expect(
          () =>
            Federal1040ProfessionalReviewGate
              .approve(
                prepared,
                {
                  reviewId:
                    'REVIEW-1',

                  requestedBy:
                    'REVIEWER-A',

                  approvedBy:
                    'REVIEWER-A',

                  material:
                    true,

                  reason:
                    'Material professional review'
                }
              )
        ).toThrow(
          'FEDERAL_1040_REVIEW_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M8.8 permits independent professional approval',
      () => {

        const prepared =
          Federal1040ReturnAssemblyEngine
            .assemble(
              context,

              [
                calculation(
                  'CALC-APPROVAL',
                  'FEDERAL_1040_TAXABLE_INCOME',
                  '50000.00',
                  true
                )
              ],

              {
                '1040_LINE_15':
                  'CALC-APPROVAL'
              }
            );

        const approved =
          Federal1040ProfessionalReviewGate
            .approve(
              prepared,
              {
                reviewId:
                  'REVIEW-2',

                requestedBy:
                  'PREPARER-A',

                approvedBy:
                  'REVIEWER-B',

                material:
                  true,

                reason:
                  'Independent professional review'
              }
            );

        expect(
          approved.status
        ).toBe(
          'APPROVED'
        );

        expect(
          approved.aiPrepared
        ).toBe(false);

        expect(
          approved.externallyFiled
        ).toBe(false);
      }
    );

    it(
      'M8.9 keeps external tax filing disabled',
      () => {

        expect(
          () =>
            Federal1040ExternalFilingGuard
              .submit()
        ).toThrow(
          'FEDERAL_1040_EXTERNAL_FILING_DISABLED'
        );
      }
    );

    it(
      'blocks calculations without required provenance',
      () => {

        const invalid =
          calculation(
            'CALC-BAD',
            'FEDERAL_1040_TAXABLE_INCOME',
            '100.00'
          );

        invalid.evidencePackageIds =
          [];

        expect(
          () =>
            Federal1040ReturnAssemblyEngine
              .assemble(
                context,
                [invalid],
                {
                  '1040_LINE_15':
                    'CALC-BAD'
                }
              )
        ).toThrow(
          'FEDERAL_1040_CALCULATION_PROVENANCE_REQUIRED'
        );
      }
    );
  }
);
