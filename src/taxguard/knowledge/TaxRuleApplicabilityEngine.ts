import type {
  TaxRule,
  TaxRuleCondition,
  TaxRuleEvidenceRequirement
} from './TaxRuleRegistry';

import {
  TaxRuleRegistry
} from './TaxRuleRegistry';

export type TaxFactValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TaxFactValue[]
  | {
      [key: string]:
        TaxFactValue;
    };

export interface TaxFactContext {
  [key: string]:
    TaxFactValue;
}

export interface TaxRuleRetrievalRequest {
  taxYear: number;

  jurisdictionCode: string;

  facts: TaxFactContext;

  includeProfessionalReview?: boolean;
}

export type ApplicabilityState =
  | 'applicable'
  | 'not_applicable'
  | 'insufficient_facts'
  | 'blocked_unverified'
  | 'blocked_dependency'
  | 'blocked_unsupported_condition';

export interface ConditionEvaluation {
  condition: TaxRuleCondition;

  state:
    | 'matched'
    | 'not_matched'
    | 'missing_fact'
    | 'unsupported';

  actualValue?: TaxFactValue;
}

export interface TaxRuleApplicabilityResult {
  ruleId: string;

  ruleName: string;

  taxYear: number;

  jurisdictionCode: string;

  state: ApplicabilityState;

  usable: boolean;

  applicable: boolean;

  missingFacts: string[];

  conditionEvaluations:
    ConditionEvaluation[];

  requiredEvidence:
    TaxRuleEvidenceRequirement[];

  professionalReviewRequired:
    boolean;

  dependencyRuleIds:
    string[];

  reasonCodes:
    string[];
}

export interface TaxRuleRetrievalResult {
  taxYear: number;

  jurisdictionCode: string;

  applicableRules:
    TaxRuleApplicabilityResult[];

  professionalReviewRules:
    TaxRuleApplicabilityResult[];

  blockedRules:
    TaxRuleApplicabilityResult[];

  insufficientFactRules:
    TaxRuleApplicabilityResult[];

  evaluatedRuleCount: number;
}

function normalizeCode(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

function isObject(
  value: unknown
): value is Record<string, unknown> {

  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getFactValue(
  facts: TaxFactContext,
  factPath: string
): TaxFactValue {

  const parts =
    factPath
      .split('.')
      .map(part => part.trim())
      .filter(Boolean);

  let current:
    unknown = facts;

  for (const part of parts) {

    if (!isObject(current)) {
      return undefined;
    }

    if (
      !Object.prototype
        .hasOwnProperty
        .call(current, part)
    ) {
      return undefined;
    }

    current =
      current[part];
  }

  return current as TaxFactValue;
}

function isMissing(
  value: TaxFactValue
): boolean {

  if (
    value === undefined ||
    value === null
  ) {
    return true;
  }

  if (
    typeof value === 'string' &&
    value.trim() === ''
  ) {
    return true;
  }

  return false;
}

function compareNumbers(
  actual: TaxFactValue,
  expected:
    string |
    number |
    boolean |
    undefined,
  comparator:
    (a: number, b: number) => boolean
): boolean {

  if (
    typeof actual !== 'number' ||
    typeof expected !== 'number'
  ) {
    return false;
  }

  return comparator(
    actual,
    expected
  );
}

function evaluateCondition(
  condition: TaxRuleCondition,
  facts: TaxFactContext
): ConditionEvaluation {

  const actualValue =
    getFactValue(
      facts,
      condition.factPath
    );

  switch (
    condition.operator
  ) {

    case 'exists':
      return {
        condition,
        actualValue,
        state:
          isMissing(actualValue)
            ? 'not_matched'
            : 'matched'
      };

    case 'not_exists':
      return {
        condition,
        actualValue,
        state:
          isMissing(actualValue)
            ? 'matched'
            : 'not_matched'
      };

    default:
      break;
  }

  if (isMissing(actualValue)) {
    return {
      condition,
      actualValue,
      state:
        'missing_fact'
    };
  }

  switch (
    condition.operator
  ) {

    case 'equals':
      return {
        condition,
        actualValue,
        state:
          actualValue ===
          condition.value
            ? 'matched'
            : 'not_matched'
      };

    case 'not_equals':
      return {
        condition,
        actualValue,
        state:
          actualValue !==
          condition.value
            ? 'matched'
            : 'not_matched'
      };

    case 'greater_than':
      return {
        condition,
        actualValue,
        state:
          compareNumbers(
            actualValue,
            condition.value,
            (a, b) => a > b
          )
            ? 'matched'
            : 'not_matched'
      };

    case 'greater_than_or_equal':
      return {
        condition,
        actualValue,
        state:
          compareNumbers(
            actualValue,
            condition.value,
            (a, b) => a >= b
          )
            ? 'matched'
            : 'not_matched'
      };

    case 'less_than':
      return {
        condition,
        actualValue,
        state:
          compareNumbers(
            actualValue,
            condition.value,
            (a, b) => a < b
          )
            ? 'matched'
            : 'not_matched'
      };

    case 'less_than_or_equal':
      return {
        condition,
        actualValue,
        state:
          compareNumbers(
            actualValue,
            condition.value,
            (a, b) => a <= b
          )
            ? 'matched'
            : 'not_matched'
      };

    case 'includes': {

      if (
        Array.isArray(actualValue)
      ) {
        return {
          condition,
          actualValue,
          state:
            actualValue.includes(
              condition.value as never
            )
              ? 'matched'
              : 'not_matched'
        };
      }

      if (
        typeof actualValue ===
          'string' &&
        typeof condition.value ===
          'string'
      ) {
        return {
          condition,
          actualValue,
          state:
            actualValue.includes(
              condition.value
            )
              ? 'matched'
              : 'not_matched'
        };
      }

      return {
        condition,
        actualValue,
        state:
          'not_matched'
      };
    }

    default:
      return {
        condition,
        actualValue,
        state:
          'unsupported'
      };
  }
}

export class TaxRuleApplicabilityEngine {

  constructor(
    private readonly rules:
      TaxRuleRegistry
  ) {}

  evaluateRule(
    ruleId: string,
    taxYear: number,
    jurisdictionCode: string,
    facts: TaxFactContext
  ): TaxRuleApplicabilityResult {

    const rule =
      this.rules.get(
        ruleId
      );

    if (!rule) {
      throw new Error(
        'APPLICABILITY_RULE_NOT_FOUND'
      );
    }

    const normalizedJurisdiction =
      normalizeCode(
        jurisdictionCode
      );

    const reasonCodes:
      string[] = [];

    /*
     * Fail closed on jurisdiction.
     */

    if (
      rule.jurisdictionCode !==
      normalizedJurisdiction
    ) {
      return {
        ruleId:
          rule.ruleId,

        ruleName:
          rule.name,

        taxYear,

        jurisdictionCode:
          normalizedJurisdiction,

        state:
          'not_applicable',

        usable:
          false,

        applicable:
          false,

        missingFacts:
          [],

        conditionEvaluations:
          [],

        requiredEvidence:
          rule.requiredEvidence,

        professionalReviewRequired:
          rule.professionalReviewRequired,

        dependencyRuleIds:
          rule.dependencyRuleIds,

        reasonCodes:
          [
            'JURISDICTION_MISMATCH'
          ]
      };
    }

    /*
     * Fail closed on tax year.
     */

    if (
      !rule.taxYears.includes(
        taxYear
      )
    ) {
      return {
        ruleId:
          rule.ruleId,

        ruleName:
          rule.name,

        taxYear,

        jurisdictionCode:
          normalizedJurisdiction,

        state:
          'not_applicable',

        usable:
          false,

        applicable:
          false,

        missingFacts:
          [],

        conditionEvaluations:
          [],

        requiredEvidence:
          rule.requiredEvidence,

        professionalReviewRequired:
          rule.professionalReviewRequired,

        dependencyRuleIds:
          rule.dependencyRuleIds,

        reasonCodes:
          [
            'TAX_YEAR_MISMATCH'
          ]
      };
    }

    /*
     * Registry usability is authoritative.
     *
     * Draft/unverified rules never become
     * applicable merely because facts match.
     */

    if (
      !this.rules.isUsableRule(
        rule.ruleId,
        taxYear
      )
    ) {

      const dependency =
        this.rules
          .validateDependencies(
            rule.ruleId
          );

      if (!dependency.valid) {
        reasonCodes.push(
          'DEPENDENCY_NOT_VERIFIED'
        );

        return {
          ruleId:
            rule.ruleId,

          ruleName:
            rule.name,

          taxYear,

          jurisdictionCode:
            normalizedJurisdiction,

          state:
            'blocked_dependency',

          usable:
            false,

          applicable:
            false,

          missingFacts:
            [],

          conditionEvaluations:
            [],

          requiredEvidence:
            rule.requiredEvidence,

          professionalReviewRequired:
            rule.professionalReviewRequired,

          dependencyRuleIds:
            rule.dependencyRuleIds,

          reasonCodes
        };
      }

      reasonCodes.push(
        'RULE_OR_AUTHORITY_NOT_VERIFIED'
      );

      return {
        ruleId:
          rule.ruleId,

        ruleName:
          rule.name,

        taxYear,

        jurisdictionCode:
          normalizedJurisdiction,

        state:
          'blocked_unverified',

        usable:
          false,

        applicable:
          false,

        missingFacts:
          [],

        conditionEvaluations:
          [],

        requiredEvidence:
          rule.requiredEvidence,

        professionalReviewRequired:
          rule.professionalReviewRequired,

        dependencyRuleIds:
          rule.dependencyRuleIds,

        reasonCodes
      };
    }

    /*
     * Required facts are evaluated independently
     * from applicability conditions.
     */

    const missingFacts =
      rule.requiredFacts.filter(
        factPath =>
          isMissing(
            getFactValue(
              facts,
              factPath
            )
          )
      );

    if (
      missingFacts.length > 0
    ) {
      return {
        ruleId:
          rule.ruleId,

        ruleName:
          rule.name,

        taxYear,

        jurisdictionCode:
          normalizedJurisdiction,

        state:
          'insufficient_facts',

        usable:
          true,

        applicable:
          false,

        missingFacts,

        conditionEvaluations:
          [],

        requiredEvidence:
          rule.requiredEvidence,

        professionalReviewRequired:
          rule.professionalReviewRequired,

        dependencyRuleIds:
          rule.dependencyRuleIds,

        reasonCodes:
          [
            'REQUIRED_FACTS_MISSING'
          ]
      };
    }

    const conditionEvaluations =
      rule.applicabilityConditions.map(
        condition =>
          evaluateCondition(
            condition,
            facts
          )
      );

    const unsupported =
      conditionEvaluations.some(
        evaluation =>
          evaluation.state ===
          'unsupported'
      );

    if (unsupported) {
      return {
        ruleId:
          rule.ruleId,

        ruleName:
          rule.name,

        taxYear,

        jurisdictionCode:
          normalizedJurisdiction,

        state:
          'blocked_unsupported_condition',

        usable:
          true,

        applicable:
          false,

        missingFacts:
          [],

        conditionEvaluations,

        requiredEvidence:
          rule.requiredEvidence,

        professionalReviewRequired:
          rule.professionalReviewRequired,

        dependencyRuleIds:
          rule.dependencyRuleIds,

        reasonCodes:
          [
            'UNSUPPORTED_CONDITION_OPERATOR'
          ]
      };
    }

    const missingConditionFacts =
      conditionEvaluations
        .filter(
          evaluation =>
            evaluation.state ===
            'missing_fact'
        )
        .map(
          evaluation =>
            evaluation.condition
              .factPath
        );

    if (
      missingConditionFacts.length > 0
    ) {
      return {
        ruleId:
          rule.ruleId,

        ruleName:
          rule.name,

        taxYear,

        jurisdictionCode:
          normalizedJurisdiction,

        state:
          'insufficient_facts',

        usable:
          true,

        applicable:
          false,

        missingFacts:
          [
            ...new Set(
              missingConditionFacts
            )
          ],

        conditionEvaluations,

        requiredEvidence:
          rule.requiredEvidence,

        professionalReviewRequired:
          rule.professionalReviewRequired,

        dependencyRuleIds:
          rule.dependencyRuleIds,

        reasonCodes:
          [
            'CONDITION_FACTS_MISSING'
          ]
      };
    }

    const allConditionsMatched =
      conditionEvaluations.every(
        evaluation =>
          evaluation.state ===
          'matched'
      );

    if (
      conditionEvaluations.length > 0 &&
      !allConditionsMatched
    ) {
      return {
        ruleId:
          rule.ruleId,

        ruleName:
          rule.name,

        taxYear,

        jurisdictionCode:
          normalizedJurisdiction,

        state:
          'not_applicable',

        usable:
          true,

        applicable:
          false,

        missingFacts:
          [],

        conditionEvaluations,

        requiredEvidence:
          rule.requiredEvidence,

        professionalReviewRequired:
          rule.professionalReviewRequired,

        dependencyRuleIds:
          rule.dependencyRuleIds,

        reasonCodes:
          [
            'APPLICABILITY_CONDITIONS_NOT_MET'
          ]
      };
    }

    return {
      ruleId:
        rule.ruleId,

      ruleName:
        rule.name,

      taxYear,

      jurisdictionCode:
        normalizedJurisdiction,

      state:
        'applicable',

      usable:
        true,

      applicable:
        true,

      missingFacts:
        [],

      conditionEvaluations,

      requiredEvidence:
        rule.requiredEvidence,

      professionalReviewRequired:
        rule.professionalReviewRequired,

      dependencyRuleIds:
        rule.dependencyRuleIds,

      reasonCodes:
        [
          'RULE_APPLICABLE'
        ]
    };
  }

  retrieve(
    request:
      TaxRuleRetrievalRequest
  ): TaxRuleRetrievalResult {

    if (
      !Number.isInteger(
        request.taxYear
      ) ||
      request.taxYear < 1900 ||
      request.taxYear > 2200
    ) {
      throw new Error(
        'INVALID_RETRIEVAL_TAX_YEAR'
      );
    }

    const jurisdictionCode =
      normalizeCode(
        request.jurisdictionCode
      );

    if (!jurisdictionCode) {
      throw new Error(
        'RETRIEVAL_JURISDICTION_REQUIRED'
      );
    }

    /*
     * Evaluate rules registered for the requested
     * jurisdiction/year.
     *
     * Draft rules remain visible only as blocked
     * evaluation results. They are not returned as
     * applicable.
     */

    const candidateRules =
      this.rules.query({
        taxYear:
          request.taxYear,

        jurisdictionCode
      });

    const evaluations =
      candidateRules.map(
        rule =>
          this.evaluateRule(
            rule.ruleId,
            request.taxYear,
            jurisdictionCode,
            request.facts
          )
      );

    const applicableRules =
      evaluations.filter(
        result =>
          result.applicable &&
          (
            request
              .includeProfessionalReview ===
              true ||
            !result
              .professionalReviewRequired
          )
      );

    const professionalReviewRules =
      evaluations.filter(
        result =>
          result.applicable &&
          result
            .professionalReviewRequired
      );

    const insufficientFactRules =
      evaluations.filter(
        result =>
          result.state ===
          'insufficient_facts'
      );

    const blockedRules =
      evaluations.filter(
        result =>
          result.state ===
            'blocked_unverified' ||
          result.state ===
            'blocked_dependency' ||
          result.state ===
            'blocked_unsupported_condition'
      );

    return {
      taxYear:
        request.taxYear,

      jurisdictionCode,

      applicableRules,

      professionalReviewRules,

      blockedRules,

      insufficientFactRules,

      evaluatedRuleCount:
        evaluations.length
    };
  }
}
