
import type {
  TaxGuardStateCode,
  TaxGuardStateContext,
  TaxGuardStateRulePack
} from './StateTaxArchitecture';

export type TaxGuardStateFactValue =
  | string
  | number
  | boolean;

export interface TaxGuardStateValidatedFact {
  factId: string;
  context: TaxGuardStateContext;
  factPath: string;
  value: TaxGuardStateFactValue;
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  validatedBy: string;
  validatedAt: string;
  validated: true;
  aiProposedOnly: false;
  immutable: true;
}

export interface TaxGuardFederalDependency {
  dependencyId: string;
  context: TaxGuardStateContext;
  federalCalculationId: string;
  federalFactPath: string;
  value: string;
  evidenceIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  verified: true;
  immutable: true;
}

export interface TaxGuardStateCalculationInput {
  inputId: string;
  factPath: string;
  value: string;
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  validated: true;
}

export interface TaxGuardStateCalculationDefinition {
  calculationDefinitionId: string;
  stateCode: TaxGuardStateCode;
  taxYear: number;
  calculationType: string;
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  requiredFactPaths: readonly string[];
  requiredFederalDependencyIds: readonly string[];
  requiresProfessionalReview: boolean;
  verifiedBy: string;
  verifiedAt: string;
  verified: true;
  immutable: true;
}

export interface TaxGuardStateCalculationTraceEntry {
  traceId: string;
  sequence: number;
  operation:
    | 'INPUT'
    | 'FEDERAL_DEPENDENCY'
    | 'ADD'
    | 'SUBTRACT'
    | 'MULTIPLY'
    | 'RESULT';
  sourceIds: readonly string[];
  value: string;
  immutable: true;
}

export interface TaxGuardStateCalculationResult {
  calculationId: string;
  context: TaxGuardStateContext;
  calculationDefinitionId: string;
  calculationType: string;
  value: string;
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  evidenceIds: readonly string[];
  sourceDocumentIds: readonly string[];
  federalDependencyIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  trace: readonly TaxGuardStateCalculationTraceEntry[];
  requiresHumanReview: boolean;
  reviewReasons: readonly string[];
  deterministic: true;
  aiCalculated: false;
  immutable: true;
}

function requireText(
  value: string,
  errorCode: string
): string {
  const normalized =
    value.trim();

  if (!normalized) {
    throw new Error(
      errorCode
    );
  }

  return normalized;
}

function validateTaxYear(
  taxYear: number
): void {
  if (
    !Number.isInteger(
      taxYear
    ) ||
    taxYear < 1900 ||
    taxYear > 2200
  ) {
    throw new Error(
      'TG_STATE_CALC_INVALID_TAX_YEAR'
    );
  }
}

function unique(
  values: readonly string[]
): string[] {
  return [
    ...new Set(
      values
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean)
    )
  ];
}

function cloneContext(
  context:
    TaxGuardStateContext
): TaxGuardStateContext {
  return {
    ...context
  };
}

function sameContext(
  left:
    TaxGuardStateContext,
  right:
    TaxGuardStateContext
): boolean {
  return (
    left.clientId ===
      right.clientId &&
    left.engagementId ===
      right.engagementId &&
    left.taxYear ===
      right.taxYear &&
    left.correlationId ===
      right.correlationId &&
    left.stateCode ===
      right.stateCode
  );
}

function parseDecimal(
  value: string
): number {
  const normalized =
    value.trim();

  if (
    !/^-?\d+(?:\.\d+)?$/
      .test(normalized)
  ) {
    throw new Error(
      'TG_STATE_CALC_INVALID_DECIMAL'
    );
  }

  const parsed =
    Number(normalized);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    throw new Error(
      'TG_STATE_CALC_INVALID_DECIMAL'
    );
  }

  return parsed;
}

function normalizeDecimal(
  value: number
): string {
  if (
    !Number.isFinite(
      value
    )
  ) {
    throw new Error(
      'TG_STATE_CALC_NON_FINITE_RESULT'
    );
  }

  return value.toFixed(2);
}

export class TaxGuardStateValidatedFactRegistry {

  private readonly facts =
    new Map<
      string,
      TaxGuardStateValidatedFact
    >();

  register(
    input: {
      factId: string;
      context: TaxGuardStateContext;
      factPath: string;
      value: TaxGuardStateFactValue;
      evidenceIds: readonly string[];
      sourceDocumentIds: readonly string[];
      validatedBy: string;
    }
  ): TaxGuardStateValidatedFact {

    requireText(
      input.factId,
      'TG_STATE_FACT_ID_REQUIRED'
    );

    requireText(
      input.factPath,
      'TG_STATE_FACT_PATH_REQUIRED'
    );

    requireText(
      input.validatedBy,
      'TG_STATE_FACT_VALIDATOR_REQUIRED'
    );

    validateTaxYear(
      input.context.taxYear
    );

    if (
      input.evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_FACT_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.sourceDocumentIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FACT_SOURCE_REQUIRED'
      );
    }

    if (
      this.facts.has(
        input.factId
      )
    ) {
      throw new Error(
        'TG_STATE_FACT_DUPLICATE'
      );
    }

    const record:
      TaxGuardStateValidatedFact =
        Object.freeze({
          factId:
            input.factId,

          context:
            cloneContext(
              input.context
            ),

          factPath:
            input.factPath,

          value:
            input.value,

          evidenceIds:
            unique(
              input.evidenceIds
            ),

          sourceDocumentIds:
            unique(
              input.sourceDocumentIds
            ),

          validatedBy:
            input.validatedBy,

          validatedAt:
            new Date()
              .toISOString(),

          validated:
            true,

          aiProposedOnly:
            false,

          immutable:
            true
        });

    this.facts.set(
      record.factId,
      record
    );

    return this.clone(
      record
    );
  }

  get(
    factId: string
  ): TaxGuardStateValidatedFact {
    const fact =
      this.facts.get(
        factId
      );

    if (!fact) {
      throw new Error(
        'TG_STATE_FACT_NOT_FOUND'
      );
    }

    return this.clone(
      fact
    );
  }

  findByPath(
    context:
      TaxGuardStateContext,
    factPath: string
  ): TaxGuardStateValidatedFact {
    const fact =
      [
        ...this.facts.values()
      ].find(
        item =>
          sameContext(
            item.context,
            context
          ) &&
          item.factPath ===
            factPath
      );

    if (!fact) {
      throw new Error(
        'TG_STATE_REQUIRED_FACT_NOT_FOUND'
      );
    }

    return this.clone(
      fact
    );
  }

  private clone(
    fact:
      TaxGuardStateValidatedFact
  ): TaxGuardStateValidatedFact {
    return {
      ...fact,
      context: {
        ...fact.context
      },
      evidenceIds: [
        ...fact.evidenceIds
      ],
      sourceDocumentIds: [
        ...fact.sourceDocumentIds
      ]
    };
  }
}

export class TaxGuardFederalDependencyRegistry {

  private readonly dependencies =
    new Map<
      string,
      TaxGuardFederalDependency
    >();

  registerVerified(
    input: {
      dependencyId: string;
      context: TaxGuardStateContext;
      federalCalculationId: string;
      federalFactPath: string;
      value: string;
      evidenceIds: readonly string[];
      provenanceDecisionIds:
        readonly string[];
    }
  ): TaxGuardFederalDependency {

    requireText(
      input.dependencyId,
      'TG_STATE_FEDERAL_DEPENDENCY_ID_REQUIRED'
    );

    requireText(
      input.federalCalculationId,
      'TG_STATE_FEDERAL_CALCULATION_REQUIRED'
    );

    requireText(
      input.federalFactPath,
      'TG_STATE_FEDERAL_FACT_PATH_REQUIRED'
    );

    parseDecimal(
      input.value
    );

    if (
      input.evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_FEDERAL_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FEDERAL_PROVENANCE_REQUIRED'
      );
    }

    if (
      this.dependencies.has(
        input.dependencyId
      )
    ) {
      throw new Error(
        'TG_STATE_FEDERAL_DEPENDENCY_DUPLICATE'
      );
    }

    const record:
      TaxGuardFederalDependency =
        Object.freeze({
          dependencyId:
            input.dependencyId,

          context:
            cloneContext(
              input.context
            ),

          federalCalculationId:
            input.federalCalculationId,

          federalFactPath:
            input.federalFactPath,

          value:
            input.value,

          evidenceIds:
            unique(
              input.evidenceIds
            ),

          provenanceDecisionIds:
            unique(
              input.provenanceDecisionIds
            ),

          verified:
            true,

          immutable:
            true
        });

    this.dependencies.set(
      record.dependencyId,
      record
    );

    return this.clone(
      record
    );
  }

  get(
    dependencyId: string
  ): TaxGuardFederalDependency {
    const record =
      this.dependencies.get(
        dependencyId
      );

    if (!record) {
      throw new Error(
        'TG_STATE_FEDERAL_DEPENDENCY_NOT_FOUND'
      );
    }

    return this.clone(
      record
    );
  }

  private clone(
    record:
      TaxGuardFederalDependency
  ): TaxGuardFederalDependency {
    return {
      ...record,
      context: {
        ...record.context
      },
      evidenceIds: [
        ...record.evidenceIds
      ],
      provenanceDecisionIds: [
        ...record.provenanceDecisionIds
      ]
    };
  }
}

export class TaxGuardStateCalculationDefinitionRegistry {

  private readonly definitions =
    new Map<
      string,
      TaxGuardStateCalculationDefinition
    >();

  registerVerified(
    input: {
      calculationDefinitionId: string;
      stateCode: TaxGuardStateCode;
      taxYear: number;
      calculationType: string;
      rulePack: TaxGuardStateRulePack;
      requiredFactPaths?: readonly string[];
      requiredFederalDependencyIds?:
        readonly string[];
      requiresProfessionalReview?:
        boolean;
      verifiedBy: string;
    }
  ): TaxGuardStateCalculationDefinition {

    requireText(
      input.calculationDefinitionId,
      'TG_STATE_CALC_DEFINITION_ID_REQUIRED'
    );

    requireText(
      input.calculationType,
      'TG_STATE_CALC_TYPE_REQUIRED'
    );

    requireText(
      input.verifiedBy,
      'TG_STATE_CALC_VERIFIER_REQUIRED'
    );

    validateTaxYear(
      input.taxYear
    );

    if (
      input.rulePack.status !==
        'VERIFIED'
    ) {
      throw new Error(
        'TG_STATE_CALC_RULE_PACK_NOT_VERIFIED'
      );
    }

    if (
      input.rulePack.stateCode !==
        input.stateCode ||
      input.rulePack.taxYear !==
        input.taxYear
    ) {
      throw new Error(
        'TG_STATE_CALC_RULE_PACK_MISMATCH'
      );
    }

    if (
      input.rulePack.ruleIds
        .length === 0 ||
      input.rulePack.authorityIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_CALC_VERIFIED_RULES_REQUIRED'
      );
    }

    if (
      this.definitions.has(
        input.calculationDefinitionId
      )
    ) {
      throw new Error(
        'TG_STATE_CALC_DEFINITION_DUPLICATE'
      );
    }

    const record:
      TaxGuardStateCalculationDefinition =
        Object.freeze({
          calculationDefinitionId:
            input.calculationDefinitionId,

          stateCode:
            input.stateCode,

          taxYear:
            input.taxYear,

          calculationType:
            input.calculationType,

          ruleIds: [
            ...input.rulePack.ruleIds
          ],

          authorityIds: [
            ...input.rulePack.authorityIds
          ],

          requiredFactPaths:
            unique(
              input.requiredFactPaths ??
              []
            ),

          requiredFederalDependencyIds:
            unique(
              input
                .requiredFederalDependencyIds ??
              []
            ),

          requiresProfessionalReview:
            input
              .requiresProfessionalReview ??
            false,

          verifiedBy:
            input.verifiedBy,

          verifiedAt:
            new Date()
              .toISOString(),

          verified:
            true,

          immutable:
            true
        });

    this.definitions.set(
      record.calculationDefinitionId,
      record
    );

    return this.clone(
      record
    );
  }

  getVerified(
    calculationDefinitionId:
      string
  ): TaxGuardStateCalculationDefinition {
    const record =
      this.definitions.get(
        calculationDefinitionId
      );

    if (!record) {
      throw new Error(
        'TG_STATE_CALC_DEFINITION_NOT_FOUND'
      );
    }

    if (!record.verified) {
      throw new Error(
        'TG_STATE_CALC_DEFINITION_NOT_VERIFIED'
      );
    }

    return this.clone(
      record
    );
  }

  private clone(
    record:
      TaxGuardStateCalculationDefinition
  ): TaxGuardStateCalculationDefinition {
    return {
      ...record,
      ruleIds: [
        ...record.ruleIds
      ],
      authorityIds: [
        ...record.authorityIds
      ],
      requiredFactPaths: [
        ...record.requiredFactPaths
      ],
      requiredFederalDependencyIds: [
        ...record
          .requiredFederalDependencyIds
      ]
    };
  }
}

export class TaxGuardStateCalculationEngine {

  calculate(
    input: {
      calculationId: string;
      context: TaxGuardStateContext;
      definition:
        TaxGuardStateCalculationDefinition;
      stateInputs:
        readonly TaxGuardStateCalculationInput[];
      federalDependencies:
        readonly TaxGuardFederalDependency[];
      provenanceDecisionIds:
        readonly string[];
    }
  ): TaxGuardStateCalculationResult {

    requireText(
      input.calculationId,
      'TG_STATE_CALC_ID_REQUIRED'
    );

    validateTaxYear(
      input.context.taxYear
    );

    if (
      !input.definition.verified
    ) {
      throw new Error(
        'TG_STATE_CALC_DEFINITION_NOT_VERIFIED'
      );
    }

    if (
      input.definition.stateCode !==
        input.context.stateCode ||
      input.definition.taxYear !==
        input.context.taxYear
    ) {
      throw new Error(
        'TG_STATE_CALC_CONTEXT_MISMATCH'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_CALC_PROVENANCE_REQUIRED'
      );
    }

    const factPaths =
      new Set(
        input.stateInputs.map(
          item =>
            item.factPath
        )
      );

    for (
      const requiredFactPath
      of input.definition
        .requiredFactPaths
    ) {
      if (
        !factPaths.has(
          requiredFactPath
        )
      ) {
        throw new Error(
          'TG_STATE_CALC_REQUIRED_FACT_MISSING:' +
          requiredFactPath
        );
      }
    }

    const dependencyIds =
      new Set(
        input.federalDependencies
          .map(
            dependency =>
              dependency.dependencyId
          )
      );

    for (
      const requiredDependencyId
      of input.definition
        .requiredFederalDependencyIds
    ) {
      if (
        !dependencyIds.has(
          requiredDependencyId
        )
      ) {
        throw new Error(
          'TG_STATE_CALC_FEDERAL_DEPENDENCY_MISSING:' +
          requiredDependencyId
        );
      }
    }

    for (
      const stateInput
      of input.stateInputs
    ) {
      if (
        !stateInput.validated
      ) {
        throw new Error(
          'TG_STATE_CALC_UNVALIDATED_INPUT'
        );
      }

      if (
        stateInput.evidenceIds
          .length === 0
      ) {
        throw new Error(
          'TG_STATE_CALC_INPUT_EVIDENCE_REQUIRED'
        );
      }

      if (
        stateInput.sourceDocumentIds
          .length === 0
      ) {
        throw new Error(
          'TG_STATE_CALC_INPUT_SOURCE_REQUIRED'
        );
      }

      parseDecimal(
        stateInput.value
      );
    }

    for (
      const dependency
      of input.federalDependencies
    ) {
      if (
        !sameContext(
          dependency.context,
          input.context
        )
      ) {
        throw new Error(
          'TG_STATE_CALC_FEDERAL_CONTEXT_MISMATCH'
        );
      }

      if (!dependency.verified) {
        throw new Error(
          'TG_STATE_CALC_FEDERAL_NOT_VERIFIED'
        );
      }

      parseDecimal(
        dependency.value
      );
    }

    /*
     * M12 deliberately does not encode state-specific
     * tax formulas here.
     *
     * This architecture only provides a deterministic
     * execution boundary. A verified, tax-year-specific
     * calculation definition/rule pack must ultimately
     * provide the statutory operation.
     *
     * For the M12 foundation, validated numeric state
     * inputs and verified federal dependencies are
     * aggregated deterministically so the provenance,
     * gating, reconciliation and form architecture can
     * be exercised without inventing state law.
     */

    let total = 0;

    const trace:
      TaxGuardStateCalculationTraceEntry[] =
        [];

    let sequence = 1;

    for (
      const stateInput
      of input.stateInputs
    ) {
      const value =
        parseDecimal(
          stateInput.value
        );

      total += value;

      trace.push(
        Object.freeze({
          traceId:
            input.calculationId +
            '-TRACE-' +
            sequence,

          sequence,

          operation:
            'INPUT',

          sourceIds: [
            stateInput.inputId
          ],

          value:
            normalizeDecimal(
              value
            ),

          immutable:
            true
        })
      );

      sequence += 1;
    }

    for (
      const dependency
      of input.federalDependencies
    ) {
      const value =
        parseDecimal(
          dependency.value
        );

      total += value;

      trace.push(
        Object.freeze({
          traceId:
            input.calculationId +
            '-TRACE-' +
            sequence,

          sequence,

          operation:
            'FEDERAL_DEPENDENCY',

          sourceIds: [
            dependency.dependencyId,
            dependency
              .federalCalculationId
          ],

          value:
            normalizeDecimal(
              value
            ),

          immutable:
            true
        })
      );

      sequence += 1;
    }

    trace.push(
      Object.freeze({
        traceId:
          input.calculationId +
          '-TRACE-' +
          sequence,

        sequence,

        operation:
          'RESULT',

        sourceIds: [
          ...input.stateInputs.map(
            item =>
              item.inputId
          ),
          ...input.federalDependencies
            .map(
              item =>
                item.dependencyId
            )
        ],

        value:
          normalizeDecimal(
            total
          ),

        immutable:
          true
      })
    );

    const evidenceIds =
      unique([
        ...input.stateInputs
          .flatMap(
            item =>
              item.evidenceIds
          ),
        ...input.federalDependencies
          .flatMap(
            item =>
              item.evidenceIds
          )
      ]);

    const sourceDocumentIds =
      unique(
        input.stateInputs
          .flatMap(
            item =>
              item.sourceDocumentIds
          )
      );

    const reviewReasons =
      input.definition
        .requiresProfessionalReview
        ? [
            'STATE_CALCULATION_PROFESSIONAL_REVIEW_REQUIRED'
          ]
        : [];

    return Object.freeze({
      calculationId:
        input.calculationId,

      context:
        cloneContext(
          input.context
        ),

      calculationDefinitionId:
        input.definition
          .calculationDefinitionId,

      calculationType:
        input.definition
          .calculationType,

      value:
        normalizeDecimal(
          total
        ),

      ruleIds: [
        ...input.definition
          .ruleIds
      ],

      authorityIds: [
        ...input.definition
          .authorityIds
      ],

      evidenceIds,

      sourceDocumentIds,

      federalDependencyIds:
        input.federalDependencies
          .map(
            item =>
              item.dependencyId
          ),

      provenanceDecisionIds:
        unique(
          input.provenanceDecisionIds
        ),

      trace,

      requiresHumanReview:
        input.definition
          .requiresProfessionalReview,

      reviewReasons,

      deterministic:
        true,

      aiCalculated:
        false,

      immutable:
        true
    });
  }
}

export class TaxGuardStateCalculationBoundary {

  static aiCalculateFinalLiability():
    never {
    throw new Error(
      'TG_STATE_AI_FINAL_CALCULATION_BLOCKED'
    );
  }

  static guessMissingFact():
    never {
    throw new Error(
      'TG_STATE_MISSING_FACT_GUESS_BLOCKED'
    );
  }

  static guessMissingAuthority():
    never {
    throw new Error(
      'TG_STATE_MISSING_AUTHORITY_GUESS_BLOCKED'
    );
  }
}
