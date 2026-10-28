import { beforeEach, describe, expect, it } from 'vitest';

import { RuleRegistry } from '../taxguard/intelligence/rules/RuleRegistry';
import { DeterministicRuleEngine } from '../taxguard/intelligence/rules/DeterministicRuleEngine';

import type {
  RuleDefinition,
  RuleEvaluationInput,
} from '../taxguard/intelligence/types';

describe('TG-CORE-002 Deterministic Rule Engine', () => {
  const BASE_RULE: RuleDefinition = {
    ruleId: 'RULE-TG-001',
    ruleCode: 'TG-DETERMINISTIC-001',
    name: 'Deterministic Test Rule',
    description:
      'Test-only deterministic rule for TaxGuard Intelligence Core.',
    jurisdiction: 'US-FEDERAL',
    version: '1.0.0',
    taxYears: [2025, 2026],
    authoritySourceIds: ['AUTH-IRS-001'],
    deterministic: true,
    isActive: true,
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
  };

  const BASE_INPUT: RuleEvaluationInput = {
    clientId: 'client-test-001',
    engagementId: 'engagement-test-001',
    taxYear: 2026,
    ruleId: BASE_RULE.ruleId,
    facts: {
      filingStatus: 'SINGLE',
      taxableIncome: 100000,
    },
    correlationId: 'corr-tg-core-002',
  };

  beforeEach(() => {
    RuleRegistry.clear();
  });

  it('registers and evaluates an approved deterministic rule', () => {
    RuleRegistry.register(BASE_RULE);

    const result =
      DeterministicRuleEngine.evaluate(BASE_INPUT);

    expect(result.ruleId).toBe(BASE_RULE.ruleId);
    expect(result.clientId).toBe(BASE_INPUT.clientId);
    expect(result.engagementId).toBe(
      BASE_INPUT.engagementId
    );
    expect(result.taxYear).toBe(BASE_INPUT.taxYear);
    expect(result.result).toBe('REVIEW_REQUIRED');
  });

  it('preserves authoritative source provenance', () => {
    RuleRegistry.register(BASE_RULE);

    const result =
      DeterministicRuleEngine.evaluate(BASE_INPUT);

    expect(result.authoritySourceIds).toEqual([
      'AUTH-IRS-001',
    ]);
  });

  it('preserves evaluated facts without mutation', () => {
    RuleRegistry.register(BASE_RULE);

    const result =
      DeterministicRuleEngine.evaluate(BASE_INPUT);

    expect(result.evaluatedFacts).toEqual(
      BASE_INPUT.facts
    );

    expect(result.evaluatedFacts).not.toBe(
      BASE_INPUT.facts
    );
  });

  it('preserves the correlation ID for traceability', () => {
    RuleRegistry.register(BASE_RULE);

    const result =
      DeterministicRuleEngine.evaluate(BASE_INPUT);

    expect(result.correlationId).toBe(
      BASE_INPUT.correlationId
    );

    expect(result.evaluationId).toContain(
      BASE_INPUT.correlationId
    );
  });

  it('rejects evaluation of an unknown rule', () => {
    expect(() =>
      DeterministicRuleEngine.evaluate({
        ...BASE_INPUT,
        ruleId: 'RULE-DOES-NOT-EXIST',
      })
    ).toThrow(/not found/i);
  });

  it('rejects a rule outside the requested tax year', () => {
    RuleRegistry.register(BASE_RULE);

    expect(() =>
      DeterministicRuleEngine.evaluate({
        ...BASE_INPUT,
        taxYear: 2024,
      })
    ).toThrow(/not applicable/i);
  });

  it('RuleRegistry rejects rules without authority provenance', () => {
    const invalidRule: RuleDefinition = {
      ...BASE_RULE,
      ruleId: 'RULE-NO-AUTHORITY',
      ruleCode: 'TG-NO-AUTHORITY',
      authoritySourceIds: [],
    };

    expect(() =>
      RuleRegistry.register(invalidRule)
    ).toThrow(/authority/i);
  });

  it('does not execute a deactivated rule', () => {
    RuleRegistry.register(BASE_RULE);
    RuleRegistry.deactivate(BASE_RULE.ruleId);

    expect(() =>
      DeterministicRuleEngine.evaluate(BASE_INPUT)
    ).toThrow(/inactive/i);
  });

  it('evaluates only applicable active rules for a tax year', () => {
    RuleRegistry.register(BASE_RULE);

    RuleRegistry.register({
      ...BASE_RULE,
      ruleId: 'RULE-TG-002',
      ruleCode: 'TG-DETERMINISTIC-002',
      name: 'Second Deterministic Test Rule',
      authoritySourceIds: ['AUTH-IRS-002'],
      taxYears: [2026],
    });

    RuleRegistry.register({
      ...BASE_RULE,
      ruleId: 'RULE-TG-003',
      ruleCode: 'TG-DETERMINISTIC-003',
      name: 'Prior-Year Deterministic Test Rule',
      authoritySourceIds: ['AUTH-IRS-003'],
      taxYears: [2025],
    });

    const results =
      DeterministicRuleEngine.evaluateApplicableRules({
        clientId: BASE_INPUT.clientId,
        engagementId: BASE_INPUT.engagementId,
        taxYear: 2026,
        facts: BASE_INPUT.facts,
        correlationId: BASE_INPUT.correlationId,
      });

    expect(results).toHaveLength(2);

    expect(
      results.map((result) => result.ruleId).sort()
    ).toEqual([
      'RULE-TG-001',
      'RULE-TG-002',
    ]);
  });

  it('does not invent a tax determination before a formula exists', () => {
    RuleRegistry.register(BASE_RULE);

    const result =
      DeterministicRuleEngine.evaluate(BASE_INPUT);

    expect(result.result).toBe('REVIEW_REQUIRED');

    expect(result.explanation).toMatch(
      /human review|deterministic calculation/i
    );
  });
});