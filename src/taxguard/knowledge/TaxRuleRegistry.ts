import type {
  TaxAuthoritySource,
  TaxJurisdictionLevel
} from './TaxAuthoritySourceRegistry';

import {
  TaxAuthoritySourceRegistry
} from './TaxAuthoritySourceRegistry';

export type TaxRuleStatus =
  | 'draft'
  | 'pending_review'
  | 'verified'
  | 'superseded'
  | 'retired'
  | 'rejected';

export type TaxRuleExecutionClass =
  | 'deterministic'
  | 'professional_review'
  | 'informational';

export type TaxRuleRiskLevel =
  | 'routine'
  | 'material'
  | 'high';

export type TaxRuleConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'includes'
  | 'exists'
  | 'not_exists';

export interface TaxRuleCondition {
  factPath: string;
  operator: TaxRuleConditionOperator;
  value?: string | number | boolean;
}

export interface TaxRuleEvidenceRequirement {
  evidenceType: string;
  required: boolean;
  description?: string;
}

export interface TaxRuleCitationBinding {
  sourceId: string;
  locator?: string;
  section?: string;
  explanation?: string;
}

export interface TaxRule {
  ruleId: string;

  name: string;

  description: string;

  jurisdictionLevel: TaxJurisdictionLevel;

  jurisdictionCode: string;

  taxYears: number[];

  version: number;

  status: TaxRuleStatus;

  executionClass: TaxRuleExecutionClass;

  riskLevel: TaxRuleRiskLevel;

  authoritySourceIds: string[];

  citations: TaxRuleCitationBinding[];

  applicabilityConditions: TaxRuleCondition[];

  requiredFacts: string[];

  requiredEvidence: TaxRuleEvidenceRequirement[];

  dependencyRuleIds: string[];

  professionalReviewRequired: boolean;

  supersedesRuleId?: string;

  supersededByRuleId?: string;

  reviewedBy?: string;

  reviewedAt?: string;

  createdAt: string;

  updatedAt: string;
}

export interface RegisterTaxRuleInput {
  ruleId: string;

  name: string;

  description: string;

  jurisdictionLevel: TaxJurisdictionLevel;

  jurisdictionCode: string;

  taxYears: number[];

  version?: number;

  status?: TaxRuleStatus;

  executionClass: TaxRuleExecutionClass;

  riskLevel?: TaxRuleRiskLevel;

  authoritySourceIds: string[];

  citations?: TaxRuleCitationBinding[];

  applicabilityConditions?: TaxRuleCondition[];

  requiredFacts?: string[];

  requiredEvidence?: TaxRuleEvidenceRequirement[];

  dependencyRuleIds?: string[];

  professionalReviewRequired?: boolean;

  supersedesRuleId?: string;
}

export interface TaxRuleQuery {
  jurisdictionLevel?: TaxJurisdictionLevel;

  jurisdictionCode?: string;

  taxYear?: number;

  status?: TaxRuleStatus;

  executionClass?: TaxRuleExecutionClass;

  riskLevel?: TaxRuleRiskLevel;
}

export interface TaxRuleVerificationInput {
  reviewedBy: string;
  reviewedAt?: string;
}

export interface TaxRuleSupersessionInput {
  supersededRuleId: string;
  replacementRuleId: string;
  reviewedBy: string;
  reviewedAt?: string;
}

export interface TaxRuleAuthorityValidation {
  valid: boolean;
  sourceIds: string[];
  missingSourceIds: string[];
  unverifiedSourceIds: string[];
  wrongTaxYearSourceIds: string[];
}

function normalize(value: string): string {
  return value.trim();
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function uniqueStrings(
  values: string[]
): string[] {
  return [
    ...new Set(
      values
        .map(value => value.trim())
        .filter(Boolean)
    )
  ];
}

function validateTaxYears(
  taxYears: number[]
): void {
  if (
    !Array.isArray(taxYears) ||
    taxYears.length === 0
  ) {
    throw new Error(
      'TAX_RULE_TAX_YEAR_REQUIRED'
    );
  }

  for (const year of taxYears) {
    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2200
    ) {
      throw new Error(
        'INVALID_TAX_RULE_TAX_YEAR'
      );
    }
  }
}

function validateRuleId(
  ruleId: string
): void {
  if (
    !/^[A-Z0-9][A-Z0-9._:-]{2,127}$/i.test(
      ruleId
    )
  ) {
    throw new Error(
      'INVALID_TAX_RULE_ID'
    );
  }
}

function validateDate(
  value: string | undefined,
  errorCode: string
): void {
  if (!value) {
    return;
  }

  if (
    Number.isNaN(
      Date.parse(value)
    )
  ) {
    throw new Error(errorCode);
  }
}

function cloneRule(
  rule: TaxRule
): TaxRule {
  return {
    ...rule,

    taxYears: [
      ...rule.taxYears
    ],

    authoritySourceIds: [
      ...rule.authoritySourceIds
    ],

    citations:
      rule.citations.map(
        citation => ({
          ...citation
        })
      ),

    applicabilityConditions:
      rule.applicabilityConditions.map(
        condition => ({
          ...condition
        })
      ),

    requiredFacts: [
      ...rule.requiredFacts
    ],

    requiredEvidence:
      rule.requiredEvidence.map(
        evidence => ({
          ...evidence
        })
      ),

    dependencyRuleIds: [
      ...rule.dependencyRuleIds
    ]
  };
}

export class TaxRuleRegistry {
  private readonly rules =
    new Map<string, TaxRule>();

  constructor(
    private readonly authorityRegistry:
      TaxAuthoritySourceRegistry
  ) {}

  register(
    input: RegisterTaxRuleInput
  ): TaxRule {

    validateRuleId(
      input.ruleId
    );

    validateTaxYears(
      input.taxYears
    );

    const ruleId =
      normalize(input.ruleId);

    if (
      this.rules.has(ruleId)
    ) {
      throw new Error(
        'TAX_RULE_ALREADY_EXISTS'
      );
    }

    const name =
      normalize(input.name);

    const description =
      normalize(input.description);

    const jurisdictionCode =
      normalizeCode(
        input.jurisdictionCode
      );

    if (!name) {
      throw new Error(
        'TAX_RULE_NAME_REQUIRED'
      );
    }

    if (!description) {
      throw new Error(
        'TAX_RULE_DESCRIPTION_REQUIRED'
      );
    }

    if (!jurisdictionCode) {
      throw new Error(
        'TAX_RULE_JURISDICTION_REQUIRED'
      );
    }

    const authoritySourceIds =
      uniqueStrings(
        input.authoritySourceIds
      );

    if (
      authoritySourceIds.length === 0
    ) {
      throw new Error(
        'TAX_RULE_AUTHORITY_REQUIRED'
      );
    }

    const dependencyRuleIds =
      uniqueStrings(
        input.dependencyRuleIds ?? []
      );

    if (
      dependencyRuleIds.includes(
        ruleId
      )
    ) {
      throw new Error(
        'TAX_RULE_SELF_DEPENDENCY'
      );
    }

    const now =
      new Date().toISOString();

    const version =
      input.version ?? 1;

    if (
      !Number.isInteger(version) ||
      version < 1
    ) {
      throw new Error(
        'INVALID_TAX_RULE_VERSION'
      );
    }

    /*
     * Governance boundary:
     *
     * Registration cannot directly create a verified rule.
     * Verification is a separate controlled transition.
     */

    if (
      input.status === 'verified'
    ) {
      throw new Error(
        'DIRECT_VERIFIED_RULE_REGISTRATION_PROHIBITED'
      );
    }

    const rule: TaxRule = {
      ruleId,

      name,

      description,

      jurisdictionLevel:
        input.jurisdictionLevel,

      jurisdictionCode,

      taxYears:
        [...new Set(input.taxYears)]
          .sort((a, b) => a - b),

      version,

      status:
        input.status ?? 'draft',

      executionClass:
        input.executionClass,

      riskLevel:
        input.riskLevel ?? 'routine',

      authoritySourceIds,

      citations:
        (input.citations ?? [])
          .map(citation => ({
            ...citation,
            sourceId:
              normalize(
                citation.sourceId
              )
          })),

      applicabilityConditions:
        (input.applicabilityConditions ?? [])
          .map(condition => ({
            ...condition,
            factPath:
              normalize(
                condition.factPath
              )
          })),

      requiredFacts:
        uniqueStrings(
          input.requiredFacts ?? []
        ),

      requiredEvidence:
        (input.requiredEvidence ?? [])
          .map(evidence => ({
            ...evidence,
            evidenceType:
              normalize(
                evidence.evidenceType
              )
          })),

      dependencyRuleIds,

      professionalReviewRequired:
        input.professionalReviewRequired ??
        input.executionClass ===
          'professional_review',

      supersedesRuleId:
        input.supersedesRuleId,

      createdAt: now,

      updatedAt: now
    };

    this.rules.set(
      ruleId,
      rule
    );

    return cloneRule(rule);
  }

  get(
    ruleId: string
  ): TaxRule | null {

    const rule =
      this.rules.get(
        normalize(ruleId)
      );

    return rule
      ? cloneRule(rule)
      : null;
  }

  list(): TaxRule[] {
    return [
      ...this.rules.values()
    ].map(cloneRule);
  }

  query(
    query: TaxRuleQuery
  ): TaxRule[] {

    return this.list().filter(
      rule => {

        if (
          query.jurisdictionLevel &&
          rule.jurisdictionLevel !==
            query.jurisdictionLevel
        ) {
          return false;
        }

        if (
          query.jurisdictionCode &&
          rule.jurisdictionCode !==
            normalizeCode(
              query.jurisdictionCode
            )
        ) {
          return false;
        }

        if (
          query.taxYear !== undefined &&
          !rule.taxYears.includes(
            query.taxYear
          )
        ) {
          return false;
        }

        if (
          query.status &&
          rule.status !==
            query.status
        ) {
          return false;
        }

        if (
          query.executionClass &&
          rule.executionClass !==
            query.executionClass
        ) {
          return false;
        }

        if (
          query.riskLevel &&
          rule.riskLevel !==
            query.riskLevel
        ) {
          return false;
        }

        return true;
      }
    );
  }

  validateAuthority(
    ruleId: string
  ): TaxRuleAuthorityValidation {

    const rule =
      this.rules.get(
        normalize(ruleId)
      );

    if (!rule) {
      throw new Error(
        'TAX_RULE_NOT_FOUND'
      );
    }

    const missingSourceIds:
      string[] = [];

    const unverifiedSourceIds:
      string[] = [];

    const wrongTaxYearSourceIds:
      string[] = [];

    for (
      const sourceId of
      rule.authoritySourceIds
    ) {
      const source =
        this.authorityRegistry.get(
          sourceId
        );

      if (!source) {
        missingSourceIds.push(
          sourceId
        );

        continue;
      }

      if (
        source.status !==
        'verified'
      ) {
        unverifiedSourceIds.push(
          sourceId
        );
      }

      const hasApplicableYear =
        rule.taxYears.some(
          year =>
            source.taxYears.includes(
              year
            )
        );

      if (!hasApplicableYear) {
        wrongTaxYearSourceIds.push(
          sourceId
        );
      }
    }

    return {
      valid:
        missingSourceIds.length === 0 &&
        unverifiedSourceIds.length === 0 &&
        wrongTaxYearSourceIds.length === 0,

      sourceIds: [
        ...rule.authoritySourceIds
      ],

      missingSourceIds,

      unverifiedSourceIds,

      wrongTaxYearSourceIds
    };
  }

  validateDependencies(
    ruleId: string
  ): {
    valid: boolean;
    missingRuleIds: string[];
    unverifiedRuleIds: string[];
  } {

    const rule =
      this.rules.get(
        normalize(ruleId)
      );

    if (!rule) {
      throw new Error(
        'TAX_RULE_NOT_FOUND'
      );
    }

    const missingRuleIds:
      string[] = [];

    const unverifiedRuleIds:
      string[] = [];

    for (
      const dependencyRuleId of
      rule.dependencyRuleIds
    ) {
      const dependency =
        this.rules.get(
          dependencyRuleId
        );

      if (!dependency) {
        missingRuleIds.push(
          dependencyRuleId
        );

        continue;
      }

      if (
        dependency.status !==
        'verified'
      ) {
        unverifiedRuleIds.push(
          dependencyRuleId
        );
      }
    }

    return {
      valid:
        missingRuleIds.length === 0 &&
        unverifiedRuleIds.length === 0,

      missingRuleIds,

      unverifiedRuleIds
    };
  }

  markPendingReview(
    ruleId: string
  ): TaxRule {

    const rule =
      this.rules.get(
        normalize(ruleId)
      );

    if (!rule) {
      throw new Error(
        'TAX_RULE_NOT_FOUND'
      );
    }

    if (
      rule.status ===
        'superseded' ||
      rule.status ===
        'retired'
    ) {
      throw new Error(
        'TAX_RULE_NOT_REVIEWABLE'
      );
    }

    rule.status =
      'pending_review';

    rule.updatedAt =
      new Date().toISOString();

    return cloneRule(rule);
  }

  verify(
    ruleId: string,
    input:
      TaxRuleVerificationInput
  ): TaxRule {

    const rule =
      this.rules.get(
        normalize(ruleId)
      );

    if (!rule) {
      throw new Error(
        'TAX_RULE_NOT_FOUND'
      );
    }

    if (
      rule.status ===
        'superseded' ||
      rule.status ===
        'retired' ||
      rule.status ===
        'rejected'
    ) {
      throw new Error(
        'TAX_RULE_NOT_ELIGIBLE_FOR_VERIFICATION'
      );
    }

    const reviewer =
      normalize(
        input.reviewedBy
      );

    if (!reviewer) {
      throw new Error(
        'TAX_RULE_REVIEWER_REQUIRED'
      );
    }

    const authority =
      this.validateAuthority(
        ruleId
      );

    if (!authority.valid) {
      throw new Error(
        'TAX_RULE_AUTHORITY_NOT_VERIFIED'
      );
    }

    const dependencies =
      this.validateDependencies(
        ruleId
      );

    if (!dependencies.valid) {
      throw new Error(
        'TAX_RULE_DEPENDENCIES_NOT_VERIFIED'
      );
    }

    const reviewedAt =
      input.reviewedAt ??
      new Date().toISOString();

    validateDate(
      reviewedAt,
      'INVALID_TAX_RULE_REVIEW_DATE'
    );

    rule.status =
      'verified';

    rule.reviewedBy =
      reviewer;

    rule.reviewedAt =
      reviewedAt;

    rule.updatedAt =
      new Date().toISOString();

    return cloneRule(rule);
  }

  supersede(
    input:
      TaxRuleSupersessionInput
  ): {
    superseded: TaxRule;
    replacement: TaxRule;
  } {

    if (
      input.supersededRuleId ===
      input.replacementRuleId
    ) {
      throw new Error(
        'TAX_RULE_CANNOT_SUPERSEDE_ITSELF'
      );
    }

    const oldRule =
      this.rules.get(
        normalize(
          input.supersededRuleId
        )
      );

    const replacement =
      this.rules.get(
        normalize(
          input.replacementRuleId
        )
      );

    if (
      !oldRule ||
      !replacement
    ) {
      throw new Error(
        'TAX_RULE_SUPERSESSION_NOT_FOUND'
      );
    }

    const reviewer =
      normalize(
        input.reviewedBy
      );

    if (!reviewer) {
      throw new Error(
        'TAX_RULE_REVIEWER_REQUIRED'
      );
    }

    const reviewedAt =
      input.reviewedAt ??
      new Date().toISOString();

    validateDate(
      reviewedAt,
      'INVALID_TAX_RULE_REVIEW_DATE'
    );

    oldRule.status =
      'superseded';

    oldRule.supersededByRuleId =
      replacement.ruleId;

    oldRule.reviewedBy =
      reviewer;

    oldRule.reviewedAt =
      reviewedAt;

    oldRule.updatedAt =
      new Date().toISOString();

    replacement.supersedesRuleId =
      oldRule.ruleId;

    replacement.updatedAt =
      new Date().toISOString();

    return {
      superseded:
        cloneRule(oldRule),

      replacement:
        cloneRule(replacement)
    };
  }

  getVerifiedRulesForTaxYear(
    taxYear: number,
    jurisdictionCode?: string
  ): TaxRule[] {

    validateTaxYears(
      [taxYear]
    );

    return this.query({
      taxYear,
      jurisdictionCode,
      status: 'verified'
    });
  }

  isUsableRule(
    ruleId: string,
    taxYear: number
  ): boolean {

    const rule =
      this.get(ruleId);

    if (!rule) {
      return false;
    }

    if (
      rule.status !==
      'verified'
    ) {
      return false;
    }

    if (
      !rule.taxYears.includes(
        taxYear
      )
    ) {
      return false;
    }

    const authority =
      this.validateAuthority(
        ruleId
      );

    if (!authority.valid) {
      return false;
    }

    const dependencies =
      this.validateDependencies(
        ruleId
      );

    return dependencies.valid;
  }

  clearForTesting(): void {
    this.rules.clear();
  }
}
