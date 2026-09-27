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
