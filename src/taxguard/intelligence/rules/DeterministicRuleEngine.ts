import type {
  RuleDefinition,
  RuleEvaluationInput,
  RuleEvaluation,
  RuleResult,
} from '../types';

import { RuleRegistry } from './RuleRegistry';

/**
 * TG-CORE-002 — Deterministic Rule Engine
 *
 * Executes registered deterministic rules against structured facts.
 *
 * Governance invariants:
 * - No Gemini / LLM execution.
 * - No probabilistic tax determination.
 * - No silent fallback.
 * - Only registered rules may execute.
 * - Authority provenance is preserved.
 * - Evaluation output is traceable by correlation ID.
 */
export class DeterministicRuleEngine {
  /**
   * Evaluate one registered deterministic rule.
   */
  public static evaluate(
    input: RuleEvaluationInput
  ): RuleEvaluation {
    const rule = RuleRegistry.get(input.ruleId);

    if (!rule) {
      throw new Error(
        `Deterministic rule not found: ${input.ruleId}`
      );
    }

    this.validateRule(rule, input);

    const result: RuleResult = this.determineResult(
      rule,
      input.facts
    );

    return {
      evaluationId: `RULE-EVAL-${input.correlationId}-${rule.ruleId}`,
      clientId: input.clientId,
      engagementId: input.engagementId,
      taxYear: input.taxYear,
      ruleId: rule.ruleId,
      result,
      explanation: this.buildExplanation(rule, result),
      authoritySourceIds: [...rule.authoritySourceIds],
      evaluatedFacts: { ...input.facts },
      evaluatedAt: new Date().toISOString(),
      correlationId: input.correlationId,
    };
  }

  /**
   * Evaluate every active deterministic rule applicable
   * to the supplied tax year.
   */
  public static evaluateApplicableRules(
    input: Omit<RuleEvaluationInput, 'ruleId'>
  ): RuleEvaluation[] {
    const rules = RuleRegistry.findForTaxYear(input.taxYear);

    return rules
      .filter((rule) => rule.isActive && rule.deterministic)
      .map((rule) =>
        this.evaluate({
          ...input,
          ruleId: rule.ruleId,
        })
      );
  }

  /**
   * Enforce rule governance before execution.
   */
  private static validateRule(
    rule: RuleDefinition,
    input: RuleEvaluationInput
  ): void {
    if (!rule.isActive) {
      throw new Error(
        `Deterministic rule is inactive: ${rule.ruleId}`
      );
    }

    if (!rule.deterministic) {
      throw new Error(
        `Rule ${rule.ruleId} is not approved for deterministic execution.`
      );
    }

    if (!rule.taxYears.includes(input.taxYear)) {
      throw new Error(
        `Rule ${rule.ruleId} is not applicable to tax year ${input.taxYear}.`
      );
    }

    if (rule.authoritySourceIds.length === 0) {
      throw new Error(
        `Rule ${rule.ruleId} has no authoritative source provenance.`
      );
    }
  }

  /**
   * Sprint-1 execution boundary.
   *
   * TG-CORE-002 establishes deterministic execution,
   * provenance, lifecycle controls, and traceability.
   *
   * Tax-specific formulas are intentionally NOT invented here.
   * A registered rule without an implemented deterministic
   * calculation therefore returns REVIEW_REQUIRED.
   */
  private static determineResult(
    rule: RuleDefinition,
    facts: Record<string, unknown>
  ): RuleResult {
    void rule;
    void facts;

    return 'REVIEW_REQUIRED';
  }

  private static buildExplanation(
    rule: RuleDefinition,
    result: RuleResult
  ): string {
    if (result === 'REVIEW_REQUIRED') {
      return (
        `Rule ${rule.ruleCode} requires deterministic calculation ` +
        `implementation or authorized human review before a tax ` +
        `determination may be made.`
      );
    }

    return `Rule ${rule.ruleCode} evaluated with result ${result}.`;
  }
}