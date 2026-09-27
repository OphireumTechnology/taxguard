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

import {
  TaxRuleApplicabilityEngine
} from '../taxguard/knowledge/TaxRuleApplicabilityEngine';

describe(
  'M6.4 Tax Rule Applicability Engine',
  () => {

    let authorities:
      TaxAuthoritySourceRegistry;

    let rules:
      TaxRuleRegistry;

    let engine:
      TaxRuleApplicabilityEngine;

    beforeEach(() => {
      authorities =
        new TaxAuthoritySourceRegistry();

      rules =
        new TaxRuleRegistry(
          authorities
        );

      engine =
        new TaxRuleApplicabilityEngine(
          rules
        );
    });

    function authority() {
      authorities.register({
        sourceId:
          'IRS-M64-2025',

        jurisdictionLevel:
          'federal',

        jurisdictionCode:
          'US',

        authorityType:
          'official_guidance',

        title:
          'M6.4 Test Authority',

        issuingAuthority:
          'Internal Revenue Service',

        taxYears:
          [2025],

        sourceUrl:
          'https://www.irs.gov/',

        citation: {
          title:
            'M6.4 Test Authority'
        }
      });
    }

    function verifyAuthority() {
      authorities.verify(
        'IRS-M64-2025',
        {
          reviewedBy:
            'authorized-reviewer'
        }
      );
    }

    function rule(
      overrides:
        Record<string, unknown> = {}
    ) {
      return {
        ruleId:
          'TG-M64-001',

        name:
          'M6.4 Test Rule',

        description:
          'Applicability engine test rule.',

        jurisdictionLevel:
          'federal' as const,

        jurisdictionCode:
          'US',

        taxYears:
          [2025],

        executionClass:
          'informational' as const,

        authoritySourceIds:
          ['IRS-M64-2025'],

        requiredFacts:
          ['taxpayer.filingStatus'],

        applicabilityConditions:
          [
            {
              factPath:
                'taxpayer.filingStatus',

              operator:
                'equals' as const,

              value:
                'single'
            }
          ],

        ...overrides
      };
    }

    function verifyRule(
      ruleId =
        'TG-M64-001'
    ) {
      rules.verify(
        ruleId,
        {
          reviewedBy:
            'authorized-reviewer'
        }
      );
    }

    it(
      'blocks draft rule and draft authority',
      () => {

        authority();

        rules.register(
          rule()
        );

        const result =
          engine.evaluateRule(
            'TG-M64-001',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        expect(result.state)
          .toBe(
            'blocked_unverified'
          );

        expect(result.applicable)
          .toBe(false);
      }
    );

    it(
      'does not make a rule usable merely by verifying authority',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule()
        );

        const result =
          engine.evaluateRule(
            'TG-M64-001',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        expect(result.state)
          .toBe(
            'blocked_unverified'
          );
      }
    );

    it(
      'returns applicable only after authority and rule verification',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule()
        );

        verifyRule();

        const result =
          engine.evaluateRule(
            'TG-M64-001',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        expect(result.state)
          .toBe('applicable');

        expect(result.applicable)
          .toBe(true);

        expect(result.usable)
          .toBe(true);
      }
    );

    it(
      'fails closed when a required fact is missing',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule()
        );

        verifyRule();

        const result =
          engine.evaluateRule(
            'TG-M64-001',
            2025,
            'US',
            {}
          );

        expect(result.state)
          .toBe(
            'insufficient_facts'
          );

        expect(result.missingFacts)
          .toContain(
            'taxpayer.filingStatus'
          );
      }
    );

    it(
      'returns not applicable when condition is not met',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule()
        );

        verifyRule();

        const result =
          engine.evaluateRule(
            'TG-M64-001',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'married'
              }
            }
          );

        expect(result.state)
          .toBe(
            'not_applicable'
          );

        expect(result.applicable)
          .toBe(false);
      }
    );

    it(
      'fails closed on wrong tax year',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule()
        );

        verifyRule();

        const result =
          engine.evaluateRule(
            'TG-M64-001',
            2024,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        expect(result.state)
          .toBe(
            'not_applicable'
          );

        expect(result.reasonCodes)
          .toContain(
            'TAX_YEAR_MISMATCH'
          );
      }
    );

    it(
      'fails closed on jurisdiction mismatch',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule()
        );

        verifyRule();

        const result =
          engine.evaluateRule(
            'TG-M64-001',
            2025,
            'SC',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        expect(result.state)
          .toBe(
            'not_applicable'
          );

        expect(result.reasonCodes)
          .toContain(
            'JURISDICTION_MISMATCH'
          );
      }
    );

    it(
      'supports numeric comparisons',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule({
            ruleId:
              'TG-M64-NUMERIC',

            requiredFacts:
              ['taxpayer.age'],

            applicabilityConditions:
              [
                {
                  factPath:
                    'taxpayer.age',

                  operator:
                    'greater_than_or_equal',

                  value:
                    65
                }
              ]
          })
        );

        verifyRule(
          'TG-M64-NUMERIC'
        );

        const result =
          engine.evaluateRule(
            'TG-M64-NUMERIC',
            2025,
            'US',
            {
              taxpayer: {
                age: 67
              }
            }
          );

        expect(result.applicable)
          .toBe(true);
      }
    );

    it(
      'routes applicable professional-review rule separately',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule({
            ruleId:
              'TG-M64-REVIEW',

            executionClass:
              'professional_review',

            professionalReviewRequired:
              true
          })
        );

        verifyRule(
          'TG-M64-REVIEW'
        );

        const result =
          engine.retrieve({
            taxYear:
              2025,

            jurisdictionCode:
              'US',

            facts: {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          });

        expect(
          result
            .professionalReviewRules
        ).toHaveLength(1);

        expect(
          result.applicableRules
        ).toHaveLength(0);
      }
    );

    it(
      'can include professional-review rules when explicitly requested',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule({
            ruleId:
              'TG-M64-REVIEW',

            executionClass:
              'professional_review',

            professionalReviewRequired:
              true
          })
        );

        verifyRule(
          'TG-M64-REVIEW'
        );

        const result =
          engine.retrieve({
            taxYear:
              2025,

            jurisdictionCode:
              'US',

            includeProfessionalReview:
              true,

            facts: {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          });

        expect(
          result.applicableRules
        ).toHaveLength(1);

        expect(
          result
            .professionalReviewRules
        ).toHaveLength(1);
      }
    );

    it(
      'preserves required evidence in applicability result',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule({
            requiredEvidence:
              [
                {
                  evidenceType:
                    'identity_document',

                  required:
                    true
                }
              ]
          })
        );

        verifyRule();

        const result =
          engine.evaluateRule(
            'TG-M64-001',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        expect(
          result.requiredEvidence
        ).toHaveLength(1);

        expect(
          result.requiredEvidence[0]
            .evidenceType
        ).toBe(
          'identity_document'
        );
      }
    );

    it(
      'blocks a rule with an unverified dependency',
      () => {

        authority();
        verifyAuthority();

        rules.register(
          rule({
            ruleId:
              'TG-M64-DEPENDENCY',

            applicabilityConditions:
              []
          })
        );

        rules.register(
          rule({
            ruleId:
              'TG-M64-PARENT',

            dependencyRuleIds:
              [
                'TG-M64-DEPENDENCY'
              ]
          })
        );

        const result =
          engine.evaluateRule(
            'TG-M64-PARENT',
            2025,
            'US',
            {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          );

        expect(result.state)
          .toBe(
            'blocked_dependency'
          );
      }
    );

    it(
      'retrieval never returns draft rules as applicable',
      () => {

        authority();

        rules.register(
          rule()
        );

        const result =
          engine.retrieve({
            taxYear:
              2025,

            jurisdictionCode:
              'US',

            facts: {
              taxpayer: {
                filingStatus:
                  'single'
              }
            }
          });

        expect(
          result.applicableRules
        ).toHaveLength(0);

        expect(
          result.blockedRules
        ).toHaveLength(1);
      }
    );
  }
);
