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
  FEDERAL_1040_2025_AUTHORITY_IDS,
  FEDERAL_1040_2025_RULE_IDS,
  installFederal1040KnowledgePack2025
} from '../taxguard/knowledge/Federal1040KnowledgePack2025';

describe(
  'M6.3 Federal 1040 Knowledge Pack 2025',
  () => {

    let authorities:
      TaxAuthoritySourceRegistry;

    let rules:
      TaxRuleRegistry;

    beforeEach(() => {
      authorities =
        new TaxAuthoritySourceRegistry();

      rules =
        new TaxRuleRegistry(
          authorities
        );
    });

    it(
      'installs the 2025 federal pack',
      () => {

        const result =
          installFederal1040KnowledgePack2025(
            authorities,
            rules
          );

        expect(result.taxYear)
          .toBe(2025);

        expect(result.ruleIds.length)
          .toBeGreaterThan(10);
      }
    );

    it(
      'registers IRS authority as draft rather than silently verified',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        const source =
          authorities.get(
            FEDERAL_1040_2025_AUTHORITY_IDS
              .publication501
          );

        expect(source?.status)
          .toBe('draft');
      }
    );

    it(
      'does not expose pack rules as usable before authority review',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.isUsableRule(
            FEDERAL_1040_2025_RULE_IDS
              .filingStatus,
            2025
          )
        ).toBe(false);
      }
    );

    it(
      'binds federal rules to authority sources',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        const rule =
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .filingStatus
          );

        expect(
          rule?.authoritySourceIds
        ).toContain(
          FEDERAL_1040_2025_AUTHORITY_IDS
            .publication501
        );
      }
    );

    it(
      'contains filing status knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .filingStatus
          )
        ).not.toBeNull();
      }
    );

    it(
      'contains dependent knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .dependents
          )
        ).not.toBeNull();
      }
    );

    it(
      'contains income classification knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .incomeClassification
          )
        ).not.toBeNull();
      }
    );

    it(
      'contains deduction decision knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .deductionMethod
          )
        ).not.toBeNull();
      }
    );

    it(
      'contains payment and withholding knowledge',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .withholdingPayments
          )
        ).not.toBeNull();
      }
    );

    it(
      'marks complex categories for professional review',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        const capital =
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .capitalTransactions
          );

        expect(
          capital?.professionalReviewRequired
        ).toBe(true);

        expect(
          capital?.riskLevel
        ).toBe('material');
      }
    );

    it(
      'creates validation dependencies',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        const validation =
          rules.get(
            FEDERAL_1040_2025_RULE_IDS
              .returnValidation
          );

        expect(
          validation?.dependencyRuleIds
        ).toContain(
          FEDERAL_1040_2025_RULE_IDS
            .filingStatus
        );

        expect(
          validation?.dependencyRuleIds
        ).toContain(
          FEDERAL_1040_2025_RULE_IDS
            .incomeClassification
        );
      }
    );

    it(
      'is idempotent',
      () => {

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        installFederal1040KnowledgePack2025(
          authorities,
          rules
        );

        expect(
          authorities.list()
        ).toHaveLength(2);

        expect(
          rules.list().length
        ).toBe(
          Object.keys(
            FEDERAL_1040_2025_RULE_IDS
          ).length
        );
      }
    );
  }
);
