import {
  beforeEach,
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxAuthoritySourceRegistry
} from '../taxguard/knowledge/TaxAuthoritySourceRegistry';

import {
  TaxRuleRegistry
} from '../taxguard/knowledge/TaxRuleRegistry';

describe(
  'M6.2 Tax Rule Registry',
  () => {

    let authority:
      TaxAuthoritySourceRegistry;

    let rules:
      TaxRuleRegistry;

    beforeEach(() => {
      authority =
        new TaxAuthoritySourceRegistry();

      rules =
        new TaxRuleRegistry(
          authority
        );
    });

    function registerAuthority(
      sourceId =
        'IRS-TEST-AUTHORITY-2025',
      taxYears =
        [2025]
    ) {
      authority.register({
        sourceId,

        jurisdictionLevel:
          'federal',

        jurisdictionCode:
          'US',

        authorityType:
          'official_guidance',

        title:
          'TaxGuard Test Authority',

        issuingAuthority:
          'Internal Revenue Service',

        taxYears,

        sourceUrl:
          'https://www.irs.gov/',

        citation: {
          title:
            'TaxGuard Test Authority'
        }
      });
    }

    function verifyAuthority(
      sourceId =
        'IRS-TEST-AUTHORITY-2025'
    ) {
      authority.verify(
        sourceId,
        {
          reviewedBy:
            'authorized-reviewer'
        }
      );
    }

    function baseRule(
      ruleId =
        'TG-FED-TEST-001'
    ) {
      return {
        ruleId,

        name:
          'TaxGuard Test Rule',

        description:
          'Controlled test rule for registry validation.',

        jurisdictionLevel:
          'federal' as const,

        jurisdictionCode:
          'US',

        taxYears:
          [2025],

        executionClass:
          'deterministic' as const,

        authoritySourceIds:
          [
            'IRS-TEST-AUTHORITY-2025'
          ],

        requiredFacts:
          [
            'taxpayer.filingStatus'
          ],

        requiredEvidence:
          [
            {
              evidenceType:
                'taxpayer_fact',

              required:
                true
            }
          ]
      };
    }

    it(
      'registers a rule as draft',
      () => {

        registerAuthority();

        const result =
          rules.register(
            baseRule()
          );

        expect(
          result.status
        ).toBe('draft');

        expect(
          result.version
        ).toBe(1);
      }
    );

    it(
      'blocks direct verified registration',
      () => {

        registerAuthority();

        expect(() =>
          rules.register({
            ...baseRule(),
            status:
              'verified'
          })
        ).toThrow(
          'DIRECT_VERIFIED_RULE_REGISTRATION_PROHIBITED'
        );
      }
    );

    it(
      'requires at least one authority source',
      () => {

        expect(() =>
          rules.register({
            ...baseRule(),
            authoritySourceIds:
              []
          })
        ).toThrow(
          'TAX_RULE_AUTHORITY_REQUIRED'
        );
      }
    );

    it(
      'rejects self dependency',
      () => {

        registerAuthority();

        expect(() =>
          rules.register({
            ...baseRule(),
            dependencyRuleIds:
              ['TG-FED-TEST-001']
          })
        ).toThrow(
          'TAX_RULE_SELF_DEPENDENCY'
        );
      }
    );

    it(
      'does not verify a rule backed by draft authority',
      () => {

        registerAuthority();

        rules.register(
          baseRule()
        );

        expect(() =>
          rules.verify(
            'TG-FED-TEST-001',
            {
              reviewedBy:
                'authorized-reviewer'
            }
          )
        ).toThrow(
          'TAX_RULE_AUTHORITY_NOT_VERIFIED'
        );
      }
    );

    it(
      'verifies rule after authority verification',
      () => {

        registerAuthority();

        verifyAuthority();

        rules.register(
          baseRule()
        );

        const verified =
          rules.verify(
            'TG-FED-TEST-001',
            {
              reviewedBy:
                'authorized-reviewer'
            }
          );

        expect(
          verified.status
        ).toBe('verified');

        expect(
          verified.reviewedBy
        ).toBe(
          'authorized-reviewer'
        );
      }
    );

    it(
      'blocks wrong-tax-year authority',
      () => {

        registerAuthority(
          'IRS-TEST-AUTHORITY-2025',
          [2024]
        );

        verifyAuthority();

        rules.register(
          baseRule()
        );

        const validation =
          rules.validateAuthority(
            'TG-FED-TEST-001'
          );

        expect(
          validation.valid
        ).toBe(false);

        expect(
          validation
            .wrongTaxYearSourceIds
        ).toContain(
          'IRS-TEST-AUTHORITY-2025'
        );
      }
    );

    it(
      'requires verified dependency rules',
      () => {

        registerAuthority();

        verifyAuthority();

        rules.register(
          baseRule(
            'TG-FED-DEPENDENCY'
          )
        );

        rules.register({
          ...baseRule(
            'TG-FED-PARENT'
          ),

          dependencyRuleIds:
            [
              'TG-FED-DEPENDENCY'
            ]
        });

        expect(() =>
          rules.verify(
            'TG-FED-PARENT',
            {
              reviewedBy:
                'authorized-reviewer'
            }
          )
        ).toThrow(
          'TAX_RULE_DEPENDENCIES_NOT_VERIFIED'
        );

        rules.verify(
          'TG-FED-DEPENDENCY',
          {
            reviewedBy:
              'authorized-reviewer'
          }
        );

        const parent =
          rules.verify(
            'TG-FED-PARENT',
            {
              reviewedBy:
                'authorized-reviewer'
            }
          );

        expect(
          parent.status
        ).toBe('verified');
      }
    );

    it(
      'supports professional review classification',
      () => {

        registerAuthority();

        const rule =
          rules.register({
            ...baseRule(),

            ruleId:
              'TG-FED-REVIEW-001',

            executionClass:
              'professional_review'
          });

        expect(
          rule
            .professionalReviewRequired
        ).toBe(true);
      }
    );

    it(
      'preserves evidence requirements',
      () => {

        registerAuthority();

        const rule =
          rules.register(
            baseRule()
          );

        expect(
          rule.requiredEvidence
        ).toHaveLength(1);

        expect(
          rule.requiredEvidence[0]
            .required
        ).toBe(true);
      }
    );

    it(
      'supports rule supersession without deleting history',
      () => {

        registerAuthority();

        rules.register(
          baseRule(
            'TG-FED-RULE-V1'
          )
        );

        rules.register({
          ...baseRule(
            'TG-FED-RULE-V2'
          ),
          version: 2
        });

        const result =
          rules.supersede({
            supersededRuleId:
              'TG-FED-RULE-V1',

            replacementRuleId:
              'TG-FED-RULE-V2',

            reviewedBy:
              'authorized-reviewer'
          });

        expect(
          result.superseded.status
        ).toBe(
          'superseded'
        );

        expect(
          result.superseded
            .supersededByRuleId
        ).toBe(
          'TG-FED-RULE-V2'
        );

        expect(
          result.replacement
            .supersedesRuleId
        ).toBe(
          'TG-FED-RULE-V1'
        );
      }
    );

    it(
      'returns defensive copies',
      () => {

        registerAuthority();

        rules.register(
          baseRule()
        );

        const first =
          rules.get(
            'TG-FED-TEST-001'
          );

        expect(first)
          .not.toBeNull();

        if (!first) {
          return;
        }

        first.taxYears.push(
          2099
        );

        first.requiredFacts.push(
          'tampered'
        );

        const second =
          rules.get(
            'TG-FED-TEST-001'
          );

        expect(
          second?.taxYears
        ).toEqual([2025]);

        expect(
          second?.requiredFacts
        ).not.toContain(
          'tampered'
        );
      }
    );

    it(
      'only exposes verified usable rules',
      () => {

        registerAuthority();

        verifyAuthority();

        rules.register(
          baseRule()
        );

        expect(
          rules.isUsableRule(
            'TG-FED-TEST-001',
            2025
          )
        ).toBe(false);

        rules.verify(
          'TG-FED-TEST-001',
          {
            reviewedBy:
              'authorized-reviewer'
          }
        );

        expect(
          rules.isUsableRule(
            'TG-FED-TEST-001',
            2025
          )
        ).toBe(true);

        expect(
          rules.isUsableRule(
            'TG-FED-TEST-001',
            2024
          )
        ).toBe(false);
      }
    );

    it(
      'queries verified rules by tax year',
      () => {

        registerAuthority();

        verifyAuthority();

        rules.register(
          baseRule()
        );

        rules.verify(
          'TG-FED-TEST-001',
          {
            reviewedBy:
              'authorized-reviewer'
          }
        );

        const result =
          rules
            .getVerifiedRulesForTaxYear(
              2025,
              'US'
            );

        expect(result)
          .toHaveLength(1);
      }
    );
  }
);
