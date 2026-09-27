import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxAuthoritySourceRegistry
} from '../taxguard/knowledge/TaxAuthoritySourceRegistry';

describe(
  'M6.1 Tax Authority Source Registry',
  () => {

    let registry:
      TaxAuthoritySourceRegistry;

    beforeEach(() => {
      registry =
        new TaxAuthoritySourceRegistry();
    });

    const federalSource = () => ({
      sourceId:
        'IRS-F1040-INSTRUCTIONS-2025',

      jurisdictionLevel:
        'federal' as const,

      jurisdictionCode:
        'US',

      authorityType:
        'instruction' as const,

      title:
        'Form 1040 Instructions',

      issuingAuthority:
        'Internal Revenue Service',

      taxYears:
        [2025],

      sourceUrl:
        'https://www.irs.gov/',

      citation: {
        title:
          'Form 1040 Instructions'
      }
    });

    it(
      'registers authority as draft by default',
      () => {

        const result =
          registry.register(
            federalSource()
          );

        expect(result.status)
          .toBe('draft');

        expect(result.taxYears)
          .toEqual([2025]);
      }
    );

    it(
      'does not permit direct verified registration',
      () => {

        expect(() =>
          registry.register({
            ...federalSource(),
            status: 'verified'
          })
        ).toThrow(
          'DIRECT_VERIFIED_REGISTRATION_PROHIBITED'
        );
      }
    );

    it(
      'requires explicit human verification',
      () => {

        registry.register(
          federalSource()
        );

        const verified =
          registry.verify(
            'IRS-F1040-INSTRUCTIONS-2025',
            {
              reviewedBy:
                'authorized-reviewer'
            }
          );

        expect(verified.status)
          .toBe('verified');

        expect(verified.reviewedBy)
          .toBe(
            'authorized-reviewer'
          );
      }
    );

    it(
      'rejects duplicate source identifiers',
      () => {

        registry.register(
          federalSource()
        );

        expect(() =>
          registry.register(
            federalSource()
          )
        ).toThrow(
          'TAX_AUTHORITY_SOURCE_ALREADY_EXISTS'
        );
      }
    );

    it(
      'filters by tax year',
      () => {

        registry.register(
          federalSource()
        );

        registry.register({
          ...federalSource(),

          sourceId:
            'IRS-F1040-INSTRUCTIONS-2024',

          taxYears:
            [2024]
        });

        expect(
          registry.query({
            taxYear: 2025
          })
        ).toHaveLength(1);
      }
    );

    it(
      'does not treat draft authority as usable',
      () => {

        registry.register(
          federalSource()
        );

        expect(
          registry.isUsableAuthority(
            'IRS-F1040-INSTRUCTIONS-2025',
            2025
          )
        ).toBe(false);
      }
    );

    it(
      'allows verified authority for matching tax year',
      () => {

        registry.register(
          federalSource()
        );

        registry.verify(
          'IRS-F1040-INSTRUCTIONS-2025',
          {
            reviewedBy:
              'authorized-reviewer'
          }
        );

        expect(
          registry.isUsableAuthority(
            'IRS-F1040-INSTRUCTIONS-2025',
            2025
          )
        ).toBe(true);

        expect(
          registry.isUsableAuthority(
            'IRS-F1040-INSTRUCTIONS-2025',
            2024
          )
        ).toBe(false);
      }
    );

    it(
      'supports supersession without deleting history',
      () => {

        registry.register({
          ...federalSource(),

          sourceId:
            'IRS-SOURCE-V1',

          taxYears:
            [2024]
        });

        registry.register({
          ...federalSource(),

          sourceId:
            'IRS-SOURCE-V2',

          taxYears:
            [2025],

          version:
            2
        });

        const result =
          registry.supersede({
            supersededSourceId:
              'IRS-SOURCE-V1',

            replacementSourceId:
              'IRS-SOURCE-V2',

            reviewedBy:
              'authorized-reviewer'
          });

        expect(
          result.superseded.status
        ).toBe('superseded');

        expect(
          result.superseded
            .supersededBySourceId
        ).toBe('IRS-SOURCE-V2');

        expect(
          result.replacement
            .supersedesSourceId
        ).toBe('IRS-SOURCE-V1');
      }
    );

    it(
      'returns defensive copies',
      () => {

        registry.register(
          federalSource()
        );

        const first =
          registry.get(
            'IRS-F1040-INSTRUCTIONS-2025'
          );

        expect(first)
          .not.toBeNull();

        if (!first) {
          return;
        }

        first.taxYears.push(2099);

        const second =
          registry.get(
            'IRS-F1040-INSTRUCTIONS-2025'
          );

        expect(
          second?.taxYears
        ).toEqual([2025]);
      }
    );

    it(
      'rejects invalid source URL protocols',
      () => {

        expect(() =>
          registry.register({
            ...federalSource(),

            sourceUrl:
              'javascript:alert(1)'
          })
        ).toThrow(
          'INVALID_SOURCE_URL_PROTOCOL'
        );
      }
    );

    it(
      'rejects empty tax year coverage',
      () => {

        expect(() =>
          registry.register({
            ...federalSource(),
            taxYears: []
          })
        ).toThrow(
          'TAX_YEAR_REQUIRED'
        );
      }
    );

    it(
      'requires reviewer identity for verification',
      () => {

        registry.register(
          federalSource()
        );

        expect(() =>
          registry.verify(
            'IRS-F1040-INSTRUCTIONS-2025',
            {
              reviewedBy: ' '
            }
          )
        ).toThrow(
          'REVIEWER_REQUIRED'
        );
      }
    );

    it(
      'returns only verified authority through verified query',
      () => {

        registry.register(
          federalSource()
        );

        registry.register({
          ...federalSource(),

          sourceId:
            'IRS-SECOND-SOURCE-2025'
        });

        registry.verify(
          'IRS-F1040-INSTRUCTIONS-2025',
          {
            reviewedBy:
              'authorized-reviewer'
          }
        );

        const verified =
          registry.getVerifiedForTaxYear(
            2025,
            'US'
          );

        expect(verified)
          .toHaveLength(1);

        expect(
          verified[0].sourceId
        ).toBe(
          'IRS-F1040-INSTRUCTIONS-2025'
        );
      }
    );
  }
);
