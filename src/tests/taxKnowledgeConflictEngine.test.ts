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
  TaxKnowledgeConflictEngine
} from '../taxguard/knowledge/TaxKnowledgeConflictEngine';

describe(
  'M6.6 Tax Knowledge Conflict Engine',
  () => {

    let authorities:
      TaxAuthoritySourceRegistry;

    let rules:
      TaxRuleRegistry;

    let engine:
      TaxKnowledgeConflictEngine;

    beforeEach(() => {
      authorities =
        new TaxAuthoritySourceRegistry();

      rules =
        new TaxRuleRegistry(
          authorities
        );

      engine =
        new TaxKnowledgeConflictEngine(
          authorities,
          rules
        );
    });

    function addAuthority(
      sourceId: string,
      taxYears = [2025],
      jurisdictionCode = 'US'
    ) {
      authorities.register({
        sourceId,

        jurisdictionLevel:
          jurisdictionCode === 'US'
            ? 'federal'
            : 'state',

        jurisdictionCode,

        authorityType:
          'official_guidance',

        title:
          sourceId,

        issuingAuthority:
          'Test Tax Authority',

        taxYears,

        sourceUrl:
          'https://www.irs.gov/',

        citation: {
          title: sourceId
        }
      });

      authorities.verify(
        sourceId,
        {
          reviewedBy:
            'authority-reviewer'
        }
      );
    }

    function addRule(
      input: {
        ruleId: string;
        name?: string;
        sourceId?: string;
        taxYears?: number[];
        jurisdictionCode?: string;
        conditions?: any[];
        dependencyRuleIds?: string[];
        supersedesRuleId?: string;
        verify?: boolean;
      }
    ) {

      const jurisdictionCode =
        input.jurisdictionCode ??
        'US';

      rules.register({
        ruleId:
          input.ruleId,

        name:
          input.name ??
          input.ruleId,

        description:
          'M6.6 test rule',

        jurisdictionLevel:
          jurisdictionCode === 'US'
            ? 'federal'
            : 'state',

        jurisdictionCode,

        taxYears:
          input.taxYears ??
          [2025],

        executionClass:
          'informational',

        authoritySourceIds:
          [
            input.sourceId ??
            'AUTH-001'
          ],

        applicabilityConditions:
          input.conditions ?? [],

        dependencyRuleIds:
          input.dependencyRuleIds ?? [],

        supersedesRuleId:
          input.supersedesRuleId
      });

      if (
        input.verify !== false
      ) {
        rules.verify(
          input.ruleId,
          {
            reviewedBy:
              'rule-reviewer'
          }
        );
      }
    }

    it(
      'returns clean scan for non-conflicting verified rule',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'RULE-001'
        });

        const result =
          engine.scan({
            taxYear: 2025,
            jurisdictionCode:
              'US'
          });

        expect(
          result.blockingConflicts
        ).toHaveLength(0);

        expect(
          result.materialConflicts
        ).toHaveLength(0);

        expect(
          result.canProceed
        ).toBe(true);
      }
    );

    it(
      'detects contradictory equals conditions',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'RULE-SINGLE',

          conditions: [
            {
              factPath:
                'taxpayer.filingStatus',

              operator:
                'equals',

              value:
                'single'
            }
          ]
        });

        addRule({
          ruleId:
            'RULE-MARRIED',

          conditions: [
            {
              factPath:
                'taxpayer.filingStatus',

              operator:
                'equals',

              value:
                'married'
            }
          ]
        });

        const result =
          engine.scan();

        expect(
          result.conflicts.some(
            conflict =>
              conflict.type ===
              'condition_conflict'
          )
        ).toBe(true);

        expect(
          result.canProceed
        ).toBe(false);
      }
    );

    it(
      'detects overlapping named rule versions',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'RULE-V1',
          name:
            'Standard Deduction Rule'
        });

        addRule({
          ruleId:
            'RULE-V2',
          name:
            'Standard Deduction Rule'
        });

        const result =
          engine.scan();

        expect(
          result.conflicts.some(
            conflict =>
              conflict.type ===
              'rule_version_conflict'
          )
        ).toBe(true);
      }
    );

    it(
      'preserves registry dependency verification boundary',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'DEPENDENCY',
          verify:
            false
        });

        expect(() =>
          addRule({
            ruleId:
              'PARENT',

            dependencyRuleIds:
              ['DEPENDENCY']
          })
        ).toThrow(
          'TAX_RULE_DEPENDENCIES_NOT_VERIFIED'
        );
      }
    );

    it(
      'requires human identity and rationale to resolve conflict',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'RULE-A',
          name:
            'Duplicate Concept'
        });

        addRule({
          ruleId:
            'RULE-B',
          name:
            'Duplicate Concept'
        });

        const result =
          engine.scan();

        const conflict =
          result.conflicts[0];

        expect(conflict)
          .toBeDefined();

        expect(() =>
          engine.resolve({
            resolutionId:
              'RES-001',

            conflictId:
              conflict.conflictId,

            disposition:
              'not_a_conflict',

            resolvedBy:
              '',

            rationale:
              'Reviewed'
          })
        ).toThrow(
          'CONFLICT_RESOLVER_REQUIRED'
        );

        expect(() =>
          engine.resolve({
            resolutionId:
              'RES-002',

            conflictId:
              conflict.conflictId,

            disposition:
              'not_a_conflict',

            resolvedBy:
              'reviewer',

            rationale:
              ''
          })
        ).toThrow(
          'CONFLICT_RATIONALE_REQUIRED'
        );
      }
    );

    it(
      'records explicit human resolution',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'RULE-A',
          name:
            'Versioned Rule'
        });

        addRule({
          ruleId:
            'RULE-B',
          name:
            'Versioned Rule'
        });

        const result =
          engine.scan();

        const conflict =
          result.conflicts.find(
            item =>
              item.type ===
              'rule_version_conflict'
          );

        expect(conflict)
          .toBeDefined();

        if (!conflict) {
          return;
        }

        engine.markUnderReview(
          conflict.conflictId
        );

        const resolution =
          engine.resolve({
            resolutionId:
              'RES-001',

            conflictId:
              conflict.conflictId,

            disposition:
              'not_a_conflict',

            resolvedBy:
              'authorized-reviewer',

            rationale:
              'Rules intentionally represent separate documented scenarios.'
          });

        expect(
          resolution.resolvedBy
        ).toBe(
          'authorized-reviewer'
        );

        expect(
          engine.getConflict(
            conflict.conflictId
          )?.status
        ).toBe(
          'dismissed'
        );
      }
    );

    it(
      'blocks material conflicts',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'RULE-YES',

          conditions: [
            {
              factPath:
                'taxpayer.hasBusiness',

              operator:
                'equals',

              value:
                true
            }
          ]
        });

        addRule({
          ruleId:
            'RULE-NO',

          conditions: [
            {
              factPath:
                'taxpayer.hasBusiness',

              operator:
                'equals',

              value:
                false
            }
          ]
        });

        expect(() =>
          engine
            .assertNoBlockingConflicts()
        ).toThrow(
          'MATERIAL_TAX_KNOWLEDGE_CONFLICT'
        );
      }
    );

    it(
      'does not delete historical conflict records',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'RULE-H1',
          name:
            'Historical Test'
        });

        addRule({
          ruleId:
            'RULE-H2',
          name:
            'Historical Test'
        });

        const scan =
          engine.scan();

        const conflict =
          scan.conflicts[0];

        engine.resolve({
          resolutionId:
            'RES-HISTORY',

          conflictId:
            conflict.conflictId,

          disposition:
            'not_a_conflict',

          resolvedBy:
            'reviewer',

          rationale:
            'Reviewed and retained for audit history.'
        });

        expect(
          engine.getConflict(
            conflict.conflictId
          )
        ).not.toBeNull();

        expect(
          engine.getResolution(
            'RES-HISTORY'
          )
        ).not.toBeNull();
      }
    );

    it(
      'returns defensive conflict copies',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'RULE-C1',
          name:
            'Copy Test'
        });

        addRule({
          ruleId:
            'RULE-C2',
          name:
            'Copy Test'
        });

        const scan =
          engine.scan();

        const conflict =
          scan.conflicts[0];

        conflict.ruleIds.push(
          'TAMPERED'
        );

        const stored =
          engine.getConflict(
            conflict.conflictId
          );

        expect(
          stored?.ruleIds
        ).not.toContain(
          'TAMPERED'
        );
      }
    );
  }
);
