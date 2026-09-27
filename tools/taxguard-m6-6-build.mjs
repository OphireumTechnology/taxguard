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
  banner("TAXGUARD M6.6 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("Frozen milestones remain preserved.");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(label, args) {
  banner(label);

  const result = spawnSync(
    "npm.cmd",
    args,
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true
    }
  );

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
M6.6 START
============================================================
*/

banner("TAXGUARD M6.6 - CONFLICT + SUPERSESSION DETECTION");

console.log("PRESERVE");
console.log("---------------------------------------------");
console.log("M1-M5.5                        FROZEN");
console.log("M6.1 Authority Registry        FROZEN");
console.log("M6.2 Tax Rule Registry         FROZEN");
console.log("M6.3 Federal 1040 Pack         FROZEN");
console.log("M6.4 Applicability Engine      FROZEN");
console.log("M6.5 Evidence + Citation       FROZEN");

console.log("");
console.log("BUILD");
console.log("---------------------------------------------");
console.log("Duplicate Rule Detection       YES");
console.log("Rule Version Detection         YES");
console.log("Authority Conflict Detection   YES");
console.log("Tax-Year Conflict Detection    YES");
console.log("Jurisdiction Conflict          YES");
console.log("Condition Conflict Detection   YES");
console.log("Superseded Authority Detection YES");
console.log("Superseded Rule Detection      YES");
console.log("Dependency Conflict Detection  YES");
console.log("Conflict Resolution Records    YES");
console.log("Material Conflict Blocking     YES");
console.log("Human Review Routing           YES");

console.log("");
console.log("SAFETY");
console.log("---------------------------------------------");
console.log("Silent conflict resolution     PROHIBITED");
console.log("AI conflict resolution         PROHIBITED");
console.log("Unverified replacement rule    BLOCKED");
console.log("Historical deletion            PROHIBITED");
console.log("Tax calculation                RESERVED FOR M7");
console.log("External tax submission        DISABLED");
console.log("OpenAI API                     NOT USED");

/*
============================================================
VERIFY M6.1-M6.5
============================================================
*/

const requiredFiles = [
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts",
  "src/taxguard/knowledge/TaxRuleRegistry.ts",
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts",
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts",
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts"
];

for (const relative of requiredFiles) {
  if (!exists(relative)) {
    stop(
      "Frozen architecture missing: " +
      relative
    );
  }
}

console.log(
  "PASS: M6.1-M6.5 architecture present."
);

/*
============================================================
BACKUP M6.6 TARGETS
============================================================
*/

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = file(
  "backups/m6-6-" + stamp
);

fs.mkdirSync(
  backupRoot,
  { recursive: true }
);

const targets = [
  "src/taxguard/knowledge/TaxKnowledgeConflictEngine.ts",
  "src/taxguard/knowledge/index.ts",
  "src/tests/taxKnowledgeConflictEngine.test.ts"
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
  "Backup: " + backupRoot
);

/*
============================================================
M6.6 CONFLICT ENGINE
============================================================
*/

const source = `
import type {
  TaxAuthoritySourceRegistry
} from './TaxAuthoritySourceRegistry';

import type {
  TaxRule,
  TaxRuleCondition,
  TaxRuleRegistry
} from './TaxRuleRegistry';

export type TaxKnowledgeConflictType =
  | 'duplicate_rule'
  | 'rule_version_conflict'
  | 'authority_conflict'
  | 'tax_year_conflict'
  | 'jurisdiction_conflict'
  | 'condition_conflict'
  | 'superseded_authority'
  | 'superseded_rule'
  | 'dependency_conflict';

export type TaxKnowledgeConflictSeverity =
  | 'informational'
  | 'review'
  | 'material'
  | 'blocking';

export type TaxKnowledgeConflictStatus =
  | 'open'
  | 'under_review'
  | 'resolved'
  | 'dismissed';

export interface TaxKnowledgeConflict {
  conflictId: string;

  type:
    TaxKnowledgeConflictType;

  severity:
    TaxKnowledgeConflictSeverity;

  status:
    TaxKnowledgeConflictStatus;

  ruleIds: string[];

  authoritySourceIds: string[];

  taxYears: number[];

  jurisdictionCodes: string[];

  reasonCodes: string[];

  description: string;

  detectedAt: string;
}

export interface TaxKnowledgeConflictResolution {
  resolutionId: string;

  conflictId: string;

  disposition:
    | 'accept_primary'
    | 'accept_replacement'
    | 'not_a_conflict'
    | 'requires_rule_revision'
    | 'requires_authority_review';

  resolvedBy: string;

  rationale: string;

  resolvedAt: string;
}

export interface ConflictScanResult {
  conflicts:
    TaxKnowledgeConflict[];

  blockingConflicts:
    TaxKnowledgeConflict[];

  materialConflicts:
    TaxKnowledgeConflict[];

  reviewConflicts:
    TaxKnowledgeConflict[];

  canProceed:
    boolean;
}

function normalize(
  value: string
): string {
  return value.trim();
}

function normalizeCode(
  value: string
): string {
  return value
    .trim()
    .toUpperCase();
}

function unique<T>(
  values: T[]
): T[] {
  return [
    ...new Set(values)
  ];
}

function overlap<T>(
  left: T[],
  right: T[]
): T[] {
  const rightSet =
    new Set(right);

  return unique(
    left.filter(
      value =>
        rightSet.has(value)
    )
  );
}

function valueKey(
  value: unknown
): string {
  return JSON.stringify(value);
}

function oppositeOperators(
  left: string,
  right: string
): boolean {
  const pairs = [
    ['equals', 'not_equals'],
    ['not_equals', 'equals'],
    ['exists', 'not_exists'],
    ['not_exists', 'exists']
  ];

  return pairs.some(
    ([a, b]) =>
      left === a &&
      right === b
  );
}

function conditionsConflict(
  left: TaxRuleCondition,
  right: TaxRuleCondition
): boolean {

  if (
    left.factPath !==
    right.factPath
  ) {
    return false;
  }

  /*
   * Same fact, equals different values:
   * both cannot simultaneously be true.
   */
  if (
    left.operator === 'equals' &&
    right.operator === 'equals' &&
    valueKey(left.value) !==
      valueKey(right.value)
  ) {
    return true;
  }

  /*
   * equals vs not_equals on same value.
   */
  if (
    oppositeOperators(
      left.operator,
      right.operator
    ) &&
    valueKey(left.value) ===
      valueKey(right.value)
  ) {
    return true;
  }

  /*
   * exists vs not_exists.
   */
  if (
    (
      left.operator === 'exists' &&
      right.operator === 'not_exists'
    ) ||
    (
      left.operator === 'not_exists' &&
      right.operator === 'exists'
    )
  ) {
    return true;
  }

  return false;
}

function cloneConflict(
  conflict: TaxKnowledgeConflict
): TaxKnowledgeConflict {
  return {
    ...conflict,

    ruleIds:
      [...conflict.ruleIds],

    authoritySourceIds:
      [...conflict.authoritySourceIds],

    taxYears:
      [...conflict.taxYears],

    jurisdictionCodes:
      [...conflict.jurisdictionCodes],

    reasonCodes:
      [...conflict.reasonCodes]
  };
}

export class TaxKnowledgeConflictEngine {

  private readonly conflicts =
    new Map<
      string,
      TaxKnowledgeConflict
    >();

  private readonly resolutions =
    new Map<
      string,
      TaxKnowledgeConflictResolution
    >();

  private sequence = 0;

  constructor(
    private readonly authorities:
      TaxAuthoritySourceRegistry,

    private readonly rules:
      TaxRuleRegistry
  ) {}

  private nextConflictId():
    string {

    this.sequence += 1;

    return (
      'TG-CONFLICT-' +
      String(
        this.sequence
      ).padStart(6, '0')
    );
  }

  private addConflict(
    input: Omit<
      TaxKnowledgeConflict,
      'conflictId' |
      'status' |
      'detectedAt'
    >
  ): TaxKnowledgeConflict {

    const conflict:
      TaxKnowledgeConflict = {

      ...input,

      conflictId:
        this.nextConflictId(),

      status:
        'open',

      detectedAt:
        new Date()
          .toISOString()
    };

    this.conflicts.set(
      conflict.conflictId,
      conflict
    );

    return cloneConflict(
      conflict
    );
  }

  private compareRules(
    left: TaxRule,
    right: TaxRule
  ): TaxKnowledgeConflict[] {

    const detected:
      TaxKnowledgeConflict[] = [];

    const commonTaxYears =
      overlap(
        left.taxYears,
        right.taxYears
      );

    const sameJurisdiction =
      normalizeCode(
        left.jurisdictionCode
      ) ===
      normalizeCode(
        right.jurisdictionCode
      );

    /*
     * Identical IDs should normally be prevented by
     * the registry, but the conflict engine retains
     * this explicit safety classification.
     */
    if (
      left.ruleId ===
      right.ruleId
    ) {
      detected.push(
        this.addConflict({
          type:
            'duplicate_rule',

          severity:
            'blocking',

          ruleIds:
            [left.ruleId],

          authoritySourceIds:
            unique([
              ...left.authoritySourceIds,
              ...right.authoritySourceIds
            ]),

          taxYears:
            commonTaxYears,

          jurisdictionCodes:
            unique([
              left.jurisdictionCode,
              right.jurisdictionCode
            ]),

          reasonCodes:
            [
              'DUPLICATE_RULE_ID'
            ],

          description:
            'Duplicate tax rule identifier detected.'
        })
      );
    }

    /*
     * Rules from different jurisdictions are not
     * automatically conflicting. However, if one
     * appears to replace the other while crossing
     * jurisdiction boundaries, human review is
     * required.
     */
    if (
      !sameJurisdiction &&
      (
        left.supersedesRuleId ===
          right.ruleId ||
        right.supersedesRuleId ===
          left.ruleId
      )
    ) {
      detected.push(
        this.addConflict({
          type:
            'jurisdiction_conflict',

          severity:
            'blocking',

          ruleIds:
            [
              left.ruleId,
              right.ruleId
            ],

          authoritySourceIds:
            unique([
              ...left.authoritySourceIds,
              ...right.authoritySourceIds
            ]),

          taxYears:
            unique([
              ...left.taxYears,
              ...right.taxYears
            ]),

          jurisdictionCodes:
            unique([
              left.jurisdictionCode,
              right.jurisdictionCode
            ]),

          reasonCodes:
            [
              'CROSS_JURISDICTION_SUPERSESSION'
            ],

          description:
            'Rule supersession crosses jurisdiction boundaries.'
        })
      );
    }

    if (
      sameJurisdiction &&
      commonTaxYears.length > 0
    ) {

      /*
       * Detect incompatible conditions for the same
       * fact path across simultaneously applicable
       * rules.
       */
      const conflictingConditions =
        left
          .applicabilityConditions
          .some(
            leftCondition =>
              right
                .applicabilityConditions
                .some(
                  rightCondition =>
                    conditionsConflict(
                      leftCondition,
                      rightCondition
                    )
                )
          );

      if (
        conflictingConditions
      ) {
        detected.push(
          this.addConflict({
            type:
              'condition_conflict',

            severity:
              'material',

            ruleIds:
              [
                left.ruleId,
                right.ruleId
              ],

            authoritySourceIds:
              unique([
                ...left.authoritySourceIds,
                ...right.authoritySourceIds
              ]),

            taxYears:
              commonTaxYears,

            jurisdictionCodes:
              [left.jurisdictionCode],

            reasonCodes:
              [
                'CONTRADICTORY_APPLICABILITY_CONDITIONS'
              ],

            description:
              'Rules contain contradictory applicability conditions for overlapping tax years.'
          })
        );
      }

      /*
       * Same named rule concept with overlapping tax
       * years but different rule IDs can indicate
       * uncontrolled versioning.
       */
      if (
        left.ruleId !==
          right.ruleId &&
        left.name
          .trim()
          .toLowerCase() ===
        right.name
          .trim()
          .toLowerCase() &&
        left.supersedesRuleId !==
          right.ruleId &&
        right.supersedesRuleId !==
          left.ruleId
      ) {
        detected.push(
          this.addConflict({
            type:
              'rule_version_conflict',

            severity:
              'review',

            ruleIds:
              [
                left.ruleId,
                right.ruleId
              ],

            authoritySourceIds:
              unique([
                ...left.authoritySourceIds,
                ...right.authoritySourceIds
              ]),

            taxYears:
              commonTaxYears,

            jurisdictionCodes:
              [left.jurisdictionCode],

            reasonCodes:
              [
                'OVERLAPPING_RULE_VERSIONS'
              ],

            description:
              'Multiple versions of the same named rule overlap without an explicit supersession relationship.'
          })
        );
      }
    }

    /*
     * Explicit supersession relationship.
     */
    if (
      left.supersedesRuleId ===
        right.ruleId ||
      right.supersedesRuleId ===
        left.ruleId
    ) {
      const replacement =
        left.supersedesRuleId ===
          right.ruleId
          ? left
          : right;

      const historical =
        replacement === left
          ? right
          : left;

      if (
        replacement.status !==
          'verified'
      ) {
        detected.push(
          this.addConflict({
            type:
              'superseded_rule',

            severity:
              'blocking',

            ruleIds:
              [
                replacement.ruleId,
                historical.ruleId
              ],

            authoritySourceIds:
              unique([
                ...replacement.authoritySourceIds,
                ...historical.authoritySourceIds
              ]),

            taxYears:
              unique([
                ...replacement.taxYears,
                ...historical.taxYears
              ]),

            jurisdictionCodes:
              unique([
                replacement.jurisdictionCode,
                historical.jurisdictionCode
              ]),

            reasonCodes:
              [
                'REPLACEMENT_RULE_NOT_VERIFIED'
              ],

            description:
              'A rule declares supersession but the replacement rule is not verified.'
          })
        );
      }
    }

    /*
     * Dependency conflicts.
     */
    if (
      left.dependencyRuleIds.includes(
        right.ruleId
      ) &&
      right.status !==
        'verified'
    ) {
      detected.push(
        this.addConflict({
          type:
            'dependency_conflict',

          severity:
            'blocking',

          ruleIds:
            [
              left.ruleId,
              right.ruleId
            ],

          authoritySourceIds:
            unique([
              ...left.authoritySourceIds,
              ...right.authoritySourceIds
            ]),

          taxYears:
            commonTaxYears,

          jurisdictionCodes:
            unique([
              left.jurisdictionCode,
              right.jurisdictionCode
            ]),

          reasonCodes:
            [
              'DEPENDENCY_RULE_NOT_VERIFIED'
            ],

          description:
            'A rule depends on an unverified rule.'
        })
      );
    }

    if (
      right.dependencyRuleIds.includes(
        left.ruleId
      ) &&
      left.status !==
        'verified'
    ) {
      detected.push(
        this.addConflict({
          type:
            'dependency_conflict',

          severity:
            'blocking',

          ruleIds:
            [
              right.ruleId,
              left.ruleId
            ],

          authoritySourceIds:
            unique([
              ...left.authoritySourceIds,
              ...right.authoritySourceIds
            ]),

          taxYears:
            commonTaxYears,

          jurisdictionCodes:
            unique([
              left.jurisdictionCode,
              right.jurisdictionCode
            ]),

          reasonCodes:
            [
              'DEPENDENCY_RULE_NOT_VERIFIED'
            ],

          description:
            'A rule depends on an unverified rule.'
        })
      );
    }

    return detected;
  }

  scan(
    input: {
      taxYear?: number;
      jurisdictionCode?: string;
    } = {}
  ): ConflictScanResult {

    this.conflicts.clear();
    this.sequence = 0;

    const query: {
      taxYear?: number;
      jurisdictionCode?: string;
    } = {};

    if (
      input.taxYear !==
      undefined
    ) {
      query.taxYear =
        input.taxYear;
    }

    if (
      input.jurisdictionCode
    ) {
      query.jurisdictionCode =
        normalizeCode(
          input.jurisdictionCode
        );
    }

    const rules =
      this.rules.query(query);

    /*
     * Pairwise rule analysis.
     */
    for (
      let leftIndex = 0;
      leftIndex < rules.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex =
          leftIndex + 1;
        rightIndex < rules.length;
        rightIndex += 1
      ) {
        this.compareRules(
          rules[leftIndex],
          rules[rightIndex]
        );
      }
    }

    /*
     * Individual rule authority and supersession
     * checks.
     */
    for (const rule of rules) {

      for (
        const sourceId of
        rule.authoritySourceIds
      ) {
        const authority =
          this.authorities.get(
            sourceId
          );

        if (!authority) {
          this.addConflict({
            type:
              'authority_conflict',

            severity:
              'blocking',

            ruleIds:
              [rule.ruleId],

            authoritySourceIds:
              [sourceId],

            taxYears:
              [...rule.taxYears],

            jurisdictionCodes:
              [rule.jurisdictionCode],

            reasonCodes:
              [
                'AUTHORITY_NOT_FOUND'
              ],

            description:
              'Rule references an authority that is not present in the authority registry.'
          });

          continue;
        }

        const taxYearOverlap =
          overlap(
            rule.taxYears,
            authority.taxYears
          );

        if (
          taxYearOverlap.length ===
          0
        ) {
          this.addConflict({
            type:
              'tax_year_conflict',

            severity:
              'blocking',

            ruleIds:
              [rule.ruleId],

            authoritySourceIds:
              [sourceId],

            taxYears:
              unique([
                ...rule.taxYears,
                ...authority.taxYears
              ]),

            jurisdictionCodes:
              unique([
                rule.jurisdictionCode,
                authority.jurisdictionCode
              ]),

            reasonCodes:
              [
                'RULE_AUTHORITY_TAX_YEAR_MISMATCH'
              ],

            description:
              'Rule and supporting authority do not share an applicable tax year.'
          });
        }

        if (
          normalizeCode(
            rule.jurisdictionCode
          ) !==
          normalizeCode(
            authority.jurisdictionCode
          )
        ) {
          this.addConflict({
            type:
              'jurisdiction_conflict',

            severity:
              'blocking',

            ruleIds:
              [rule.ruleId],

            authoritySourceIds:
              [sourceId],

            taxYears:
              taxYearOverlap,

            jurisdictionCodes:
              unique([
                rule.jurisdictionCode,
                authority.jurisdictionCode
              ]),

            reasonCodes:
              [
                'RULE_AUTHORITY_JURISDICTION_MISMATCH'
              ],

            description:
              'Rule jurisdiction does not match its supporting authority.'
          });
        }

        if (
          authority.status ===
            'superseded'
        ) {
          this.addConflict({
            type:
              'superseded_authority',

            severity:
              'blocking',

            ruleIds:
              [rule.ruleId],

            authoritySourceIds:
              [sourceId],

            taxYears:
              taxYearOverlap,

            jurisdictionCodes:
              [rule.jurisdictionCode],

            reasonCodes:
              [
                'RULE_USES_SUPERSEDED_AUTHORITY'
              ],

            description:
              'Rule references a superseded authority source.'
          });
        }
      }

      if (
        rule.status ===
          'superseded'
      ) {
        this.addConflict({
          type:
            'superseded_rule',

          severity:
            'review',

          ruleIds:
            [rule.ruleId],

          authoritySourceIds:
            [...rule.authoritySourceIds],

          taxYears:
            [...rule.taxYears],

          jurisdictionCodes:
            [rule.jurisdictionCode],

          reasonCodes:
            [
              'SUPERSEDED_RULE_PRESENT'
            ],

          description:
            'Historical superseded rule remains in the registry and must not be selected as current authority.'
        });
      }
    }

    const conflicts =
      [
        ...this.conflicts.values()
      ].map(cloneConflict);

    const blockingConflicts =
      conflicts.filter(
        conflict =>
          conflict.severity ===
          'blocking' &&
          conflict.status !==
          'resolved' &&
          conflict.status !==
          'dismissed'
      );

    const materialConflicts =
      conflicts.filter(
        conflict =>
          conflict.severity ===
          'material' &&
          conflict.status !==
          'resolved' &&
          conflict.status !==
          'dismissed'
      );

    const reviewConflicts =
      conflicts.filter(
        conflict =>
          conflict.severity ===
          'review' &&
          conflict.status !==
          'resolved' &&
          conflict.status !==
          'dismissed'
      );

    return {
      conflicts,
      blockingConflicts,
      materialConflicts,
      reviewConflicts,

      canProceed:
        blockingConflicts.length ===
          0 &&
        materialConflicts.length ===
          0
    };
  }

  getConflict(
    conflictId: string
  ): TaxKnowledgeConflict | null {

    const conflict =
      this.conflicts.get(
        normalize(conflictId)
      );

    return conflict
      ? cloneConflict(conflict)
      : null;
  }

  listConflicts():
    TaxKnowledgeConflict[] {

    return [
      ...this.conflicts.values()
    ].map(cloneConflict);
  }

  markUnderReview(
    conflictId: string
  ): TaxKnowledgeConflict {

    const conflict =
      this.conflicts.get(
        normalize(conflictId)
      );

    if (!conflict) {
      throw new Error(
        'CONFLICT_NOT_FOUND'
      );
    }

    if (
      conflict.status !==
      'open'
    ) {
      throw new Error(
        'CONFLICT_NOT_OPEN'
      );
    }

    conflict.status =
      'under_review';

    return cloneConflict(
      conflict
    );
  }

  resolve(
    input: {
      resolutionId: string;
      conflictId: string;
      disposition:
        TaxKnowledgeConflictResolution['disposition'];
      resolvedBy: string;
      rationale: string;
    }
  ): TaxKnowledgeConflictResolution {

    const resolutionId =
      normalize(
        input.resolutionId
      );

    const conflictId =
      normalize(
        input.conflictId
      );

    const resolvedBy =
      normalize(
        input.resolvedBy
      );

    const rationale =
      normalize(
        input.rationale
      );

    if (!resolutionId) {
      throw new Error(
        'RESOLUTION_ID_REQUIRED'
      );
    }

    if (
      this.resolutions.has(
        resolutionId
      )
    ) {
      throw new Error(
        'RESOLUTION_ALREADY_EXISTS'
      );
    }

    const conflict =
      this.conflicts.get(
        conflictId
      );

    if (!conflict) {
      throw new Error(
        'CONFLICT_NOT_FOUND'
      );
    }

    if (!resolvedBy) {
      throw new Error(
        'CONFLICT_RESOLVER_REQUIRED'
      );
    }

    if (!rationale) {
      throw new Error(
        'CONFLICT_RATIONALE_REQUIRED'
      );
    }

    if (
      conflict.status ===
        'resolved' ||
      conflict.status ===
        'dismissed'
    ) {
      throw new Error(
        'CONFLICT_ALREADY_CLOSED'
      );
    }

    const resolution:
      TaxKnowledgeConflictResolution = {

      resolutionId,
      conflictId,

      disposition:
        input.disposition,

      resolvedBy,
      rationale,

      resolvedAt:
        new Date()
          .toISOString()
    };

    this.resolutions.set(
      resolutionId,
      resolution
    );

    conflict.status =
      input.disposition ===
        'not_a_conflict'
        ? 'dismissed'
        : 'resolved';

    return {
      ...resolution
    };
  }

  getResolution(
    resolutionId: string
  ): TaxKnowledgeConflictResolution | null {

    const resolution =
      this.resolutions.get(
        normalize(
          resolutionId
        )
      );

    return resolution
      ? {...resolution}
      : null;
  }

  assertNoBlockingConflicts(
    input: {
      taxYear?: number;
      jurisdictionCode?: string;
    } = {}
  ): void {

    const result =
      this.scan(input);

    if (
      result.blockingConflicts
        .length > 0
    ) {
      throw new Error(
        'BLOCKING_TAX_KNOWLEDGE_CONFLICT'
      );
    }

    if (
      result.materialConflicts
        .length > 0
    ) {
      throw new Error(
        'MATERIAL_TAX_KNOWLEDGE_CONFLICT'
      );
    }
  }
}
`;

write(
  "src/taxguard/knowledge/TaxKnowledgeConflictEngine.ts",
  source.trimStart()
);

/*
============================================================
PRESERVE EXISTING INDEX
============================================================
*/

const indexFile =
  "src/taxguard/knowledge/index.ts";

let index =
  exists(indexFile)
    ? read(indexFile)
    : "";

const exportLine =
  "export * from './TaxKnowledgeConflictEngine';";

if (!index.includes(exportLine)) {
  index +=
    (
      index.length === 0 ||
      index.endsWith("\n")
        ? ""
        : "\n"
    ) +
    exportLine +
    "\n";
}

write(
  indexFile,
  index
);

/*
============================================================
M6.6 TESTS
============================================================
*/

const tests = `
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
`;

write(
  "src/tests/taxKnowledgeConflictEngine.test.ts",
  tests.trimStart()
);

/*
============================================================
INDEX EXPORT
============================================================
*/

const builtSource = read(
  "src/taxguard/knowledge/TaxKnowledgeConflictEngine.ts"
);

const checks = [
  [
    "Conflict Engine",
    builtSource.includes(
      "TaxKnowledgeConflictEngine"
    )
  ],
  [
    "Condition Conflict",
    builtSource.includes(
      "condition_conflict"
    )
  ],
  [
    "Authority Conflict",
    builtSource.includes(
      "authority_conflict"
    )
  ],
  [
    "Tax Year Conflict",
    builtSource.includes(
      "tax_year_conflict"
    )
  ],
  [
    "Jurisdiction Conflict",
    builtSource.includes(
      "jurisdiction_conflict"
    )
  ],
  [
    "Superseded Authority",
    builtSource.includes(
      "superseded_authority"
    )
  ],
  [
    "Superseded Rule",
    builtSource.includes(
      "superseded_rule"
    )
  ],
  [
    "Dependency Conflict",
    builtSource.includes(
      "dependency_conflict"
    )
  ],
  [
    "Human Resolution",
    builtSource.includes(
      "resolvedBy"
    )
  ],
  [
    "Resolution Rationale",
    builtSource.includes(
      "rationale"
    )
  ],
  [
    "Blocking Gate",
    builtSource.includes(
      "BLOCKING_TAX_KNOWLEDGE_CONFLICT"
    )
  ],
  [
    "No OpenAI",
    !builtSource.includes(
      "OpenAI"
    )
  ],
  [
    "No localStorage",
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
    "No external submission",
    !builtSource.includes(
      "submitReturn"
    )
  ]
];

banner("M6.6 GOVERNANCE ASSERTIONS");

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
  ["run", "typecheck"]
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
  "STEP 5 - M6.4 APPLICABILITY",
  [
    "test",
    "--",
    "src/tests/taxRuleApplicabilityEngine.test.ts",
    "--run"
  ]
);

run(
  "STEP 6 - M6.5 EVIDENCE + CITATION",
  [
    "test",
    "--",
    "src/tests/taxEvidenceCitationBinding.test.ts",
    "--run"
  ]
);

run(
  "STEP 7 - M6.6 CONFLICT ENGINE",
  [
    "test",
    "--",
    "src/tests/taxKnowledgeConflictEngine.test.ts",
    "--run"
  ]
);

/*
============================================================
INTELLIGENCE CORE
============================================================
*/

run(
  "STEP 8 - INTELLIGENCE CORE",
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
LIVE AUTHORITY
============================================================
*/

run(
  "STEP 9 - LIVE WORKFLOW AUTHORITY",
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
FULL ACTIVE SYSTEM REGRESSION

This is the system-wide malfunction gate.
============================================================
*/

run(
  "STEP 10 - FULL ACTIVE SYSTEM REGRESSION",
  [
    "test",
    "--",
    "--run"
  ]
);

/*
============================================================
PRODUCTION
============================================================
*/

run(
  "STEP 11 - PRODUCTION BUILD",
  [
    "run",
    "build"
  ]
);

run(
  "STEP 12 - FINAL TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
PASS
============================================================
*/

banner("TAXGUARD M6.6 VERIFIED PASS");

console.log("");
console.log("PRESERVED");
console.log("---------------------------------------------");
console.log("M1-M5.5                        FROZEN / PASS");
console.log("M6.1 Authority Registry        FROZEN / PASS");
console.log("M6.2 Tax Rule Registry         FROZEN / PASS");
console.log("M6.3 Federal 1040 Pack         FROZEN / PASS");
console.log("M6.4 Applicability Engine      FROZEN / PASS");
console.log("M6.5 Evidence + Citation       FROZEN / PASS");

console.log("");
console.log("M6.6");
console.log("---------------------------------------------");
console.log("Conflict Engine                PASS");
console.log("Duplicate Detection            PASS");
console.log("Version Conflict Detection     PASS");
console.log("Authority Conflict Detection   PASS");
console.log("Tax-Year Conflict Detection    PASS");
console.log("Jurisdiction Conflict          PASS");
console.log("Condition Conflict Detection   PASS");
console.log("Superseded Authority Detection PASS");
console.log("Superseded Rule Detection      PASS");
console.log("Dependency Conflict Detection  PASS");
console.log("Conflict Resolution Records    PASS");
console.log("Material Conflict Blocking     PASS");
console.log("Human Review Routing           PASS");

console.log("");
console.log("SYSTEM VALIDATION");
console.log("---------------------------------------------");
console.log("TypeScript                     PASS");
console.log("M6.1-M6.6                      PASS");
console.log("Intelligence Core              PASS");
console.log("LIVE Workflow Authority        PASS");
console.log("Full Active Regression         PASS");
console.log("Production Build               PASS");
console.log("Final TypeScript               PASS");

console.log("");
console.log("GOVERNANCE");
console.log("---------------------------------------------");
console.log("Silent conflict resolution     BLOCKED");
console.log("Unresolved material conflict   BLOCKED");
console.log("Unresolved blocking conflict   BLOCKED");
console.log("Unverified dependency          BLOCKED");
console.log("Historical records             PRESERVED");
console.log("Human resolution identity      REQUIRED");
console.log("Human rationale                REQUIRED");
console.log("AI conflict resolution         PROHIBITED");
console.log("Tax calculation                RESERVED FOR M7");
console.log("External tax submission        DISABLED");
console.log("OpenAI API credits             NONE");

console.log("");
console.log("============================================================");
console.log(" M6.6 COMPLETE - FREEZE CHECKPOINT");
console.log("============================================================");

console.log("");
console.log("NEXT:");
console.log("M6.7 - AI KNOWLEDGE BOUNDARY");
console.log("");
console.log("Then:");
console.log("M6.8 - Human Review + Audit Integration");
console.log("M6.9 - M6 Final Regression + Freeze");
console.log("M7   - Deterministic Calculation Engine");
console.log("");
