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
  banner("TAXGUARD M6.4 STOPPED SAFELY");
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

function file(relative) {
  return path.join(ROOT, relative);
}

function exists(relative) {
  return fs.existsSync(file(relative));
}

function read(relative) {
  return fs.readFileSync(file(relative), "utf8");
}

function write(relative, content) {
  const target = file(relative);

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

/*
============================================================
START
============================================================
*/

banner("TAXGUARD M6.4 - APPLICABILITY + RETRIEVAL ENGINE");

console.log("PRESERVE:");
console.log("M1-M5.5                         FROZEN");
console.log("M6.1 Authority Registry         FROZEN");
console.log("M6.2 Rule Registry              FROZEN");
console.log("M6.3 Federal 1040 Pack          FROZEN");

console.log("");
console.log("BUILD:");
console.log("Verified rule retrieval         YES");
console.log("Tax-year filtering              YES");
console.log("Jurisdiction filtering          YES");
console.log("Condition evaluation            YES");
console.log("Required-fact detection         YES");
console.log("Missing-fact detection          YES");
console.log("Evidence requirement output     YES");
console.log("Dependency validation           YES");
console.log("Professional-review routing     YES");
console.log("Fail-closed evaluation          YES");

console.log("");
console.log("PROHIBITED:");
console.log("AI-created tax facts            DISABLED");
console.log("AI-created tax rules            DISABLED");
console.log("Unverified rule execution       DISABLED");
console.log("Unknown operator guessing       DISABLED");
console.log("Missing-fact guessing           DISABLED");
console.log("Tax calculation                 RESERVED FOR M7");
console.log("External tax submission         DISABLED");
console.log("OpenAI API                      NOT USED");

/*
============================================================
VERIFY M6.1 - M6.3
============================================================
*/

const requiredFiles = [
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts",
  "src/taxguard/knowledge/TaxRuleRegistry.ts",
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts"
];

for (const required of requiredFiles) {
  if (!exists(required)) {
    stop(
      "Required frozen checkpoint missing: " +
      required
    );
  }
}

const authoritySource =
  read(
    "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts"
  );

const ruleSource =
  read(
    "src/taxguard/knowledge/TaxRuleRegistry.ts"
  );

const federalSource =
  read(
    "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts"
  );

for (const token of [
  "TaxAuthoritySourceRegistry",
  "isUsableAuthority",
  "getVerifiedForTaxYear"
]) {
  if (!authoritySource.includes(token)) {
    stop(
      "M6.1 checkpoint invalid: " +
      token
    );
  }
}

for (const token of [
  "TaxRuleRegistry",
  "TaxRuleCondition",
  "validateAuthority",
  "validateDependencies",
  "isUsableRule"
]) {
  if (!ruleSource.includes(token)) {
    stop(
      "M6.2 checkpoint invalid: " +
      token
    );
  }
}

for (const token of [
  "FEDERAL_1040_2025_PACK_ID",
  "FEDERAL_1040_2025_RULE_IDS",
  "installFederal1040KnowledgePack2025"
]) {
  if (!federalSource.includes(token)) {
    stop(
      "M6.3 checkpoint invalid: " +
      token
    );
  }
}

console.log("");
console.log("PASS: M6.1 checkpoint.");
console.log("PASS: M6.2 checkpoint.");
console.log("PASS: M6.3 checkpoint.");

/*
============================================================
BACKUP TARGET FILES ONLY
============================================================
*/

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot =
  file(
    "backups/m6-4-" +
    stamp
  );

fs.mkdirSync(
  backupRoot,
  { recursive: true }
);

const targets = [
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts",
  "src/taxguard/knowledge/index.ts",
  "src/tests/taxRuleApplicabilityEngine.test.ts"
];

for (const relative of targets) {
  if (!exists(relative)) {
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
    file(relative),
    destination
  );
}

console.log(
  "Backup: " +
  backupRoot
);

/*
============================================================
M6.4 ENGINE
============================================================
*/

const engineSource = `
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
`;

write(
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts",
  engineSource.trimStart()
);

/*
============================================================
EXPORT
============================================================
*/

const indexFile =
  "src/taxguard/knowledge/index.ts";

let index =
  exists(indexFile)
    ? read(indexFile)
    : "";

const exportLine =
  "export * from './TaxRuleApplicabilityEngine';";

if (!index.includes(exportLine)) {
  index +=
    (index.endsWith("\n") ||
    index.length === 0
      ? ""
      : "\n") +
    exportLine +
    "\n";
}

write(
  indexFile,
  index
);

/*
============================================================
TESTS
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
`;

write(
  "src/tests/taxRuleApplicabilityEngine.test.ts",
  testSource.trimStart()
);

/*
============================================================
STATIC GOVERNANCE ASSERTIONS
============================================================
*/

banner("M6.4 GOVERNANCE ASSERTIONS");

const builtSource =
  read(
    "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts"
  );

const checks = [
  [
    "Verified-rule gate",
    builtSource.includes(
      "isUsableRule"
    )
  ],

  [
    "Tax-year gate",
    builtSource.includes(
      "TAX_YEAR_MISMATCH"
    )
  ],

  [
    "Jurisdiction gate",
    builtSource.includes(
      "JURISDICTION_MISMATCH"
    )
  ],

  [
    "Missing fact detection",
    builtSource.includes(
      "REQUIRED_FACTS_MISSING"
    )
  ],

  [
    "Dependency gate",
    builtSource.includes(
      "DEPENDENCY_NOT_VERIFIED"
    )
  ],

  [
    "Professional review",
    builtSource.includes(
      "professionalReviewRules"
    )
  ],

  [
    "Evidence propagation",
    builtSource.includes(
      "requiredEvidence"
    )
  ],

  [
    "Fail closed",
    builtSource.includes(
      "blocked_unverified"
    )
  ],

  [
    "No OpenAI dependency",
    !builtSource.includes(
      "OpenAI"
    )
  ],

  [
    "No browser storage",
    !builtSource.includes(
      "localStorage"
    )
  ],

  [
    "No tax calculation",
    !builtSource.includes(
      "calculateTax"
    )
  ],

  [
    "No return transmission",
    !builtSource.includes(
      "submitReturn"
    )
  ]
];

for (const [name, ok] of checks) {
  console.log(
    (ok ? "PASS " : "FAIL ") +
    name
  );

  if (!ok) {
    stop(
      "Governance assertion failed: " +
      name
    );
  }
}

/*
============================================================
VALIDATION
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

run(
  "STEP 2 - M6.1 AUTHORITY REGISTRY",
  [
    "test",
    "--",
    "src/tests/taxAuthoritySourceRegistry.test.ts",
    "--run"
  ]
);

run(
  "STEP 3 - M6.2 RULE REGISTRY",
  [
    "test",
    "--",
    "src/tests/taxRuleRegistry.test.ts",
    "--run"
  ]
);

run(
  "STEP 4 - M6.3 FEDERAL 1040 PACK",
  [
    "test",
    "--",
    "src/tests/federal1040KnowledgePack2025.test.ts",
    "--run"
  ]
);

run(
  "STEP 5 - M6.4 APPLICABILITY ENGINE",
  [
    "test",
    "--",
    "src/tests/taxRuleApplicabilityEngine.test.ts",
    "--run"
  ]
);

run(
  "STEP 6 - INTELLIGENCE CORE",
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

run(
  "STEP 7 - LIVE WORKFLOW AUTHORITY",
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
FULL SYSTEM REGRESSION

This is the requested check for other malfunctioning
features. Any active regression stops the build here.
============================================================
*/

run(
  "STEP 8 - FULL ACTIVE SYSTEM REGRESSION",
  [
    "test",
    "--",
    "--run"
  ]
);

/*
============================================================
PRODUCTION BUILD
============================================================
*/

run(
  "STEP 9 - PRODUCTION BUILD",
  [
    "run",
    "build"
  ]
);

/*
============================================================
FINAL TYPESCRIPT
============================================================
*/

run(
  "STEP 10 - FINAL TYPESCRIPT",
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

banner("TAXGUARD M6.4 VERIFIED PASS");

console.log("");
console.log("PRESERVED");
console.log("---------------------------------------------");
console.log("M1-M5.5                        FROZEN / PASS");
console.log("M6.1 Authority Registry        FROZEN / PASS");
console.log("M6.2 Tax Rule Registry         FROZEN / PASS");
console.log("M6.3 Federal 1040 Pack         FROZEN / PASS");

console.log("");
console.log("M6.4");
console.log("---------------------------------------------");
console.log("Applicability Engine           PASS");
console.log("Verified Rule Retrieval        PASS");
console.log("Tax-Year Filtering             PASS");
console.log("Jurisdiction Filtering         PASS");
console.log("Condition Evaluation           PASS");
console.log("Required Fact Detection        PASS");
console.log("Missing Fact Detection         PASS");
console.log("Evidence Requirements          PASS");
console.log("Dependency Validation          PASS");
console.log("Professional Review Routing    PASS");
console.log("Fail-Closed Evaluation         PASS");

console.log("");
console.log("SYSTEM VALIDATION");
console.log("---------------------------------------------");
console.log("TypeScript                     PASS");
console.log("M6.1                           PASS");
console.log("M6.2                           PASS");
console.log("M6.3                           PASS");
console.log("M6.4                           PASS");
console.log("Intelligence Core              PASS");
console.log("LIVE Workflow Authority        PASS");
console.log("Full Active Regression         PASS");
console.log("Production Build               PASS");
console.log("Final TypeScript               PASS");

console.log("");
console.log("GOVERNANCE");
console.log("---------------------------------------------");
console.log("Unverified rule execution      BLOCKED");
console.log("Wrong tax year                 BLOCKED");
console.log("Wrong jurisdiction             BLOCKED");
console.log("Missing facts                  FAIL CLOSED");
console.log("Unverified dependencies        BLOCKED");
console.log("Professional review routing    PRESERVED");
console.log("AI-created facts               PROHIBITED");
console.log("AI-created verified rules      PROHIBITED");
console.log("Calculation execution          RESERVED FOR M7");
console.log("External tax submission        DISABLED");
console.log("OpenAI API credits             NONE");

console.log("");
console.log("============================================================");
console.log(" M6.4 COMPLETE - FREEZE CHECKPOINT");
console.log("============================================================");

console.log("");
console.log("NEXT:");
console.log("M6.5 - EVIDENCE + CITATION BINDING");
console.log("");
console.log("Then:");
console.log("M6.6 Conflict + Supersession Detection");
console.log("M6.7 AI Knowledge Boundary");
console.log("M6.8 Human Review + Audit Integration");
console.log("M6.9 M6 Final Regression + Freeze");
console.log("M7   Deterministic Calculation Engine");
console.log("");
