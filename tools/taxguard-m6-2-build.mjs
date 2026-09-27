import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

function banner(text) {
  console.log("");
  console.log("============================================================");
  console.log(" " + text);
  console.log("============================================================");
}

function stop(message) {
  banner("TAXGUARD M6.2 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(label, args) {
  banner(label);

  const result = spawnSync("npm.cmd", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  });

  if (result.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

function write(relative, content) {
  const target = path.join(ROOT, relative);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true }
  );

  fs.writeFileSync(
    target,
    content,
    "utf8"
  );

  console.log("WRITE " + relative);
}

function exists(relative) {
  return fs.existsSync(
    path.join(ROOT, relative)
  );
}

function read(relative) {
  return fs.readFileSync(
    path.join(ROOT, relative),
    "utf8"
  );
}

/*
============================================================
START
============================================================
*/

banner("TAXGUARD M6.2 - TAX RULE SCHEMA + RULE REGISTRY");

console.log("PRESERVE:");
console.log("M1-M5.5                         FROZEN");
console.log("M6.1 Authority Registry         FROZEN");
console.log("");
console.log("BUILD:");
console.log("M6.2 Tax Rule Schema            YES");
console.log("M6.2 Rule Registry              YES");
console.log("Authority binding               YES");
console.log("Tax-year validation             YES");
console.log("Rule lifecycle                  YES");
console.log("Dependency validation           YES");
console.log("Evidence requirements           YES");
console.log("Human review boundary           YES");
console.log("Supersession                    YES");
console.log("");
console.log("PROHIBITED:");
console.log("OpenAI API                      DISABLED");
console.log("AutoFix V1                      DISABLED");
console.log("Broad repository scan           DISABLED");
console.log("Client 006 creation             DISABLED");
console.log("AI-created verified rule        DISABLED");
console.log("Unverified authority use        DISABLED");
console.log("Browser workflow completion     DISABLED");
console.log("External tax submission         DISABLED");

/*
============================================================
VERIFY M6.1
============================================================
*/

const authorityFile =
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts";

if (!exists(authorityFile)) {
  stop(
    "M6.1 authority registry missing. " +
    "M6.2 will not modify the project."
  );
}

const authoritySource =
  read(authorityFile);

const m61Checks = [
  "TaxAuthoritySourceRegistry",
  "getVerifiedForTaxYear",
  "isUsableAuthority",
  "DIRECT_VERIFIED_REGISTRATION_PROHIBITED"
];

for (const check of m61Checks) {
  if (!authoritySource.includes(check)) {
    stop(
      "M6.1 checkpoint incomplete: " +
      check
    );
  }
}

console.log("");
console.log("PASS: M6.1 checkpoint verified.");

/*
============================================================
BACKUP M6.2 TARGETS ONLY
============================================================
*/

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  ROOT,
  "backups",
  "m6-2-" + stamp
);

fs.mkdirSync(
  backupRoot,
  { recursive: true }
);

const targets = [
  "src/taxguard/knowledge/TaxRuleRegistry.ts",
  "src/taxguard/knowledge/index.ts",
  "src/tests/taxRuleRegistry.test.ts"
];

for (const relative of targets) {
  const source =
    path.join(ROOT, relative);

  if (!fs.existsSync(source)) {
    continue;
  }

  const destination =
    path.join(
      backupRoot,
      relative
    );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true }
  );

  fs.copyFileSync(
    source,
    destination
  );
}

console.log(
  "Backup: " + backupRoot
);

/*
============================================================
M6.2 TAX RULE REGISTRY
============================================================
*/

const ruleRegistry = `
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
`;

write(
  "src/taxguard/knowledge/TaxRuleRegistry.ts",
  ruleRegistry.trimStart()
);

/*
============================================================
KNOWLEDGE INDEX

Preserve M6.1 export and expose M6.2.
============================================================
*/

const indexSource = `
export * from './TaxAuthoritySourceRegistry';
export * from './TaxRuleRegistry';
`;

write(
  "src/taxguard/knowledge/index.ts",
  indexSource.trimStart()
);

/*
============================================================
M6.2 TESTS
============================================================
*/

const testSource = `
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
`;

write(
  "src/tests/taxRuleRegistry.test.ts",
  testSource.trimStart()
);

/*
============================================================
STATIC GOVERNANCE ASSERTIONS
============================================================
*/

banner("M6.2 GOVERNANCE ASSERTIONS");

const ruleSource =
  read(
    "src/taxguard/knowledge/TaxRuleRegistry.ts"
  );

const assertions = [
  [
    "Rule tax-year versioning",
    ruleSource.includes(
      "taxYears: number[]"
    )
  ],

  [
    "Authority binding",
    ruleSource.includes(
      "authoritySourceIds: string[]"
    )
  ],

  [
    "Evidence requirements",
    ruleSource.includes(
      "requiredEvidence"
    )
  ],

  [
    "Fact requirements",
    ruleSource.includes(
      "requiredFacts"
    )
  ],

  [
    "Rule dependencies",
    ruleSource.includes(
      "dependencyRuleIds"
    )
  ],

  [
    "Professional review",
    ruleSource.includes(
      "professionalReviewRequired"
    )
  ],

  [
    "Authority validation",
    ruleSource.includes(
      "validateAuthority"
    )
  ],

  [
    "Dependency validation",
    ruleSource.includes(
      "validateDependencies"
    )
  ],

  [
    "Direct verified rule blocked",
    ruleSource.includes(
      "DIRECT_VERIFIED_RULE_REGISTRATION_PROHIBITED"
    )
  ],

  [
    "Supersession",
    ruleSource.includes(
      "supersededByRuleId"
    )
  ],

  [
    "Usable rule gate",
    ruleSource.includes(
      "isUsableRule"
    )
  ],

  [
    "No OpenAI dependency",
    !ruleSource.includes(
      "OpenAI"
    )
  ],

  [
    "No tax submission",
    !ruleSource.includes(
      "submitReturn"
    )
  ]
];

for (
  const [name, passed]
  of assertions
) {
  console.log(
    (passed ? "PASS " : "FAIL ") +
    name
  );

  if (!passed) {
    stop(
      "Governance assertion failed: " +
      name
    );
  }
}

/*
============================================================
STEP 1 — TYPESCRIPT
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
STEP 2 — M6.1
============================================================
*/

run(
  "STEP 2 - M6.1 AUTHORITY REGISTRY",
  [
    "test",
    "--",
    "src/tests/taxAuthoritySourceRegistry.test.ts",
    "--run"
  ]
);

/*
============================================================
STEP 3 — M6.2
============================================================
*/

run(
  "STEP 3 - M6.2 TAX RULE REGISTRY",
  [
    "test",
    "--",
    "src/tests/taxRuleRegistry.test.ts",
    "--run"
  ]
);

/*
============================================================
STEP 4 — INTELLIGENCE CORE
============================================================
*/

run(
  "STEP 4 - INTELLIGENCE CORE",
  [
    "test",
    "--",
    "src/tests/intelligenceCoreKnowledgeRegistry.test.ts",
    "src/tests/intelligenceCoreRuleEngine.test.ts",
    "src/tests/intelligenceCoreEvidencePackage.test.ts",
    "src/tests/intelligenceCoreHumanReviewBridge.test.ts",
    "src/tests/intelligenceCoreAIReasoningGateway.test.ts",
    "src/tests/intelligenceCoreDecisionApprovalOrchestrator.test.ts",
    "src/tests/intelligenceCoreDecisionTraceLedger.test.ts",
    "src/tests/intelligenceCoreGovernanceBoundary.test.ts",
    "--run"
  ]
);

/*
============================================================
STEP 5 — LIVE AUTHORITY
============================================================
*/

run(
  "STEP 5 - LIVE WORKFLOW AUTHORITY",
  [
    "test",
    "--",
    "src/tests/liveWorkflowUiAuthority.test.ts",
    "src/tests/liveWorkflowGateAuthority.test.ts",
    "src/tests/serverStageGateOrchestrator.test.ts",
    "src/tests/liveAppRoutingAuthority.test.ts",
    "--run"
  ]
);

/*
============================================================
STEP 6 — STAGES 01-03
============================================================
*/

run(
  "STEP 6A - STAGE 01",
  [
    "test",
    "--",
    "src/tests/stageOneOnboarding.test.ts",
    "--run"
  ]
);

run(
  "STEP 6B - STAGE 02",
  [
    "test",
    "--",
    "src/tests/stageTwoCollection.test.ts",
    "src/tests/stageTwoSprintTwoSecurity.test.ts",
    "src/tests/stageTwoSprintThreeIntelligence.test.ts",
    "src/tests/stageTwoSprintFourOperations.test.ts",
    "--run"
  ]
);

run(
  "STEP 6C - STAGE 03",
  [
    "test",
    "--",
    "src/tests/stageThreeValidationFoundation.test.ts",
    "src/tests/stageThreeSprintOne.test.ts",
    "src/tests/stageThreeSprintTwo.test.ts",
    "src/tests/stageThreeSprintThree.test.ts",
    "--run"
  ]
);

/*
============================================================
STEP 7 — FULL ACTIVE REGRESSION

This catches other functioning regressions instead of
pretending unknown defects are fixed.
============================================================
*/

run(
  "STEP 7 - FULL ACTIVE REGRESSION",
  [
    "test",
    "--",
    "--run"
  ]
);

/*
============================================================
STEP 8 — PRODUCTION BUILD
============================================================
*/

run(
  "STEP 8 - PRODUCTION BUILD",
  [
    "run",
    "build"
  ]
);

/*
============================================================
STEP 9 — FINAL TYPESCRIPT
============================================================
*/

run(
  "STEP 9 - FINAL TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
FINAL
============================================================
*/

banner("TAXGUARD M6.2 VERIFIED PASS");

console.log("");
console.log("PRESERVED");
console.log("---------------------------------------------");
console.log("M1    LIVE Routing              FROZEN / PASS");
console.log("M2    Stage 01 ONBOARD          FROZEN / PASS");
console.log("M3    Stage 02 COLLECT          FROZEN / PASS");
console.log("M4    Stage 03 VALIDATE         FROZEN / PASS");
console.log("M5    Firestore Workflow        FROZEN / PASS");
console.log("M5.2  Gate Bridge               FROZEN / PASS");
console.log("M5.3  Server Gate Layer         FROZEN / PASS");
console.log("M5.4  LIVE Authority            FROZEN / PASS");
console.log("M5.5  LIVE App Routing          FROZEN / PASS");
console.log("M6.1  Authority Registry        FROZEN / PASS");

console.log("");
console.log("M6.2 TAX RULE REGISTRY");
console.log("---------------------------------------------");
console.log("Tax Rule Schema                 PASS");
console.log("Rule Registry                   PASS");
console.log("Tax-year applicability          PASS");
console.log("Jurisdiction controls           PASS");
console.log("Authority-source binding        PASS");
console.log("Evidence requirements           PASS");
console.log("Fact requirements               PASS");
console.log("Rule dependencies               PASS");
console.log("Execution classification        PASS");
console.log("Risk classification             PASS");
console.log("Professional review boundary    PASS");
console.log("Human verification              PASS");
console.log("Rule supersession               PASS");
console.log("Verified-rule lookup            PASS");

console.log("");
console.log("GOVERNANCE");
console.log("---------------------------------------------");
console.log("AI-created verified rules       BLOCKED");
console.log("Unverified authority use        BLOCKED");
console.log("Wrong-tax-year authority        BLOCKED");
console.log("Unverified dependencies         BLOCKED");
console.log("Direct verified registration    BLOCKED");
console.log("Rule self-dependency            BLOCKED");
console.log("Historical supersession         PRESERVED");
console.log("External tax submission         DISABLED");
console.log("OpenAI API credits used         NONE");

console.log("");
console.log("VALIDATION");
console.log("---------------------------------------------");
console.log("TypeScript                      PASS");
console.log("M6.1 Registry                   PASS");
console.log("M6.2 Registry                   PASS");
console.log("Intelligence Core               PASS");
console.log("LIVE Workflow Authority         PASS");
console.log("Stage 01                        PASS");
console.log("Stage 02                        PASS");
console.log("Stage 03                        PASS");
console.log("Full Active Regression          PASS");
console.log("Production Build                PASS");
console.log("Final TypeScript                PASS");

console.log("");
console.log("============================================================");
console.log(" M6.2 COMPLETE - FREEZE CHECKPOINT");
console.log("============================================================");

console.log("");
console.log("NEXT:");
console.log("M6.3 - FEDERAL 1040 KNOWLEDGE PACK");
console.log("");
console.log("Then:");
console.log("M6.4 - Applicability / Retrieval Engine");
console.log("M6.5 - Evidence + Citation Binding");
console.log("M6.6 - Conflict / Supersession Detection");
console.log("M6.7 - AI Knowledge Boundary");
console.log("M6.8 - Human Review + Audit Integration");
console.log("M6.9 - M6 Final Regression + Freeze");
console.log("");
