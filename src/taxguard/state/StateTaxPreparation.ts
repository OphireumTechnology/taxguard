
import type {
  TaxGuardStateContext,
  TaxGuardStateReturnType,
  TaxGuardStateRulePack
} from './StateTaxArchitecture';

import type {
  TaxGuardStateCalculationResult
} from './StateTaxCalculation';

export interface TaxGuardStateFormLineBinding {
  bindingId: string;
  formId: string;
  lineId: string;
  calculationId: string;
  calculationType: string;
  value: string;
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  evidenceIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  immutable: true;
}

export interface TaxGuardStatePreparedReturn {
  preparedStateReturnId: string;
  context: TaxGuardStateContext;
  returnType: TaxGuardStateReturnType;
  rulePackId: string;
  formIds: readonly string[];
  lineBindings:
    readonly TaxGuardStateFormLineBinding[];
  calculationIds: readonly string[];
  ruleIds: readonly string[];
  authorityIds: readonly string[];
  evidenceIds: readonly string[];
  provenanceDecisionIds: readonly string[];
  requiresHumanReview: boolean;
  reviewReasons: readonly string[];
  assembledAt: string;
  deterministic: true;
  aiPrepared: false;
  externalFilingEnabled: false;
  immutable: true;
}

export interface TaxGuardStateReconciliationResult {
  valid: boolean;
  reasons: readonly string[];
}

export interface TaxGuardStateProfessionalApproval {
  approvalId: string;
  context: TaxGuardStateContext;
  preparedStateReturnId: string;
  returnVersionId: string;
  requestedBy: string;
  approvedBy: string;
  approvedByRole:
    | 'REVIEWER'
    | 'CPA'
    | 'EA';
  provenanceDecisionId: string;
  approvedAt: string;
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

export class TaxGuardStateFormMappingEngine {

  map(
    input: {
      bindingId: string;
      formId: string;
      lineId: string;
      calculation:
        TaxGuardStateCalculationResult;
    }
  ): TaxGuardStateFormLineBinding {

    requireText(
      input.bindingId,
      'TG_STATE_FORM_BINDING_ID_REQUIRED'
    );

    requireText(
      input.formId,
      'TG_STATE_FORM_ID_REQUIRED'
    );

    requireText(
      input.lineId,
      'TG_STATE_FORM_LINE_REQUIRED'
    );

    if (
      input.calculation.ruleIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FORM_RULE_REQUIRED'
      );
    }

    if (
      input.calculation.authorityIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FORM_AUTHORITY_REQUIRED'
      );
    }

    if (
      input.calculation.evidenceIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FORM_EVIDENCE_REQUIRED'
      );
    }

    if (
      input.calculation
        .provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_FORM_PROVENANCE_REQUIRED'
      );
    }

    return Object.freeze({
      bindingId:
        input.bindingId,

      formId:
        input.formId,

      lineId:
        input.lineId,

      calculationId:
        input.calculation
          .calculationId,

      calculationType:
        input.calculation
          .calculationType,

      value:
        input.calculation.value,

      ruleIds: [
        ...input.calculation
          .ruleIds
      ],

      authorityIds: [
        ...input.calculation
          .authorityIds
      ],

      evidenceIds: [
        ...input.calculation
          .evidenceIds
      ],

      provenanceDecisionIds: [
        ...input.calculation
          .provenanceDecisionIds
      ],

      immutable:
        true
    });
  }
}

export class TaxGuardStateReturnAssemblyEngine {

  assemble(
    input: {
      preparedStateReturnId: string;

      context:
        TaxGuardStateContext;

      returnType:
        TaxGuardStateReturnType;

      rulePack:
        TaxGuardStateRulePack;

      calculations:
        readonly TaxGuardStateCalculationResult[];

      lineBindings:
        readonly TaxGuardStateFormLineBinding[];

      provenanceDecisionIds:
        readonly string[];
    }
  ): TaxGuardStatePreparedReturn {

    requireText(
      input.preparedStateReturnId,
      'TG_STATE_PREPARED_RETURN_ID_REQUIRED'
    );

    if (
      input.rulePack.status !==
        'VERIFIED'
    ) {
      throw new Error(
        'TG_STATE_PREP_RULE_PACK_NOT_VERIFIED'
      );
    }

    if (
      input.rulePack.stateCode !==
        input.context.stateCode ||
      input.rulePack.taxYear !==
        input.context.taxYear
    ) {
      throw new Error(
        'TG_STATE_PREP_RULE_PACK_CONTEXT_MISMATCH'
      );
    }

    if (
      input.calculations.length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_CALCULATION_REQUIRED'
      );
    }

    if (
      input.lineBindings.length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_FORM_BINDING_REQUIRED'
      );
    }

    if (
      input.provenanceDecisionIds
        .length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_PROVENANCE_REQUIRED'
      );
    }

    for (
      const calculation
      of input.calculations
    ) {
      if (
        !sameContext(
          calculation.context,
          input.context
        )
      ) {
        throw new Error(
          'TG_STATE_PREP_CALCULATION_CONTEXT_MISMATCH'
        );
      }

      if (
        calculation.aiCalculated !==
          false ||
        calculation.deterministic !==
          true
      ) {
        throw new Error(
          'TG_STATE_PREP_INVALID_CALCULATION_BOUNDARY'
        );
      }
    }

    const calculationIds =
      new Set(
        input.calculations.map(
          calculation =>
            calculation.calculationId
        )
      );

    for (
      const binding
      of input.lineBindings
    ) {
      if (
        !calculationIds.has(
          binding.calculationId
        )
      ) {
        throw new Error(
          'TG_STATE_PREP_ORPHAN_FORM_BINDING'
        );
      }
    }

    const ruleIds =
      unique([
        ...input.rulePack.ruleIds,

        ...input.calculations
          .flatMap(
            calculation =>
              calculation.ruleIds
          )
      ]);

    const authorityIds =
      unique([
        ...input.rulePack.authorityIds,

        ...input.calculations
          .flatMap(
            calculation =>
              calculation.authorityIds
          )
      ]);

    if (
      ruleIds.length === 0 ||
      authorityIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_RULE_AUTHORITY_REQUIRED'
      );
    }

    const evidenceIds =
      unique(
        input.calculations
          .flatMap(
            calculation =>
              calculation.evidenceIds
          )
      );

    if (
      evidenceIds.length === 0
    ) {
      throw new Error(
        'TG_STATE_PREP_EVIDENCE_REQUIRED'
      );
    }

    const reviewReasons =
      unique(
        input.calculations
          .flatMap(
            calculation =>
              calculation.reviewReasons
          )
      );

    const requiresHumanReview =
      input.calculations.some(
        calculation =>
          calculation
            .requiresHumanReview
      );

    return Object.freeze({
      preparedStateReturnId:
        input.preparedStateReturnId,

      context:
        cloneContext(
          input.context
        ),

      returnType:
        input.returnType,

      rulePackId:
        input.rulePack.rulePackId,

      formIds:
        unique(
          input.lineBindings.map(
            binding =>
              binding.formId
          )
        ),

      lineBindings:
        input.lineBindings.map(
          binding => ({
            ...binding,
            ruleIds: [
              ...binding.ruleIds
            ],
            authorityIds: [
              ...binding.authorityIds
            ],
            evidenceIds: [
              ...binding.evidenceIds
            ],
            provenanceDecisionIds: [
              ...binding
                .provenanceDecisionIds
            ]
          })
        ),

      calculationIds: [
        ...calculationIds
      ],

      ruleIds,

      authorityIds,

      evidenceIds,

      provenanceDecisionIds:
        unique([
          ...input.provenanceDecisionIds,

          ...input.calculations
            .flatMap(
              calculation =>
                calculation
                  .provenanceDecisionIds
            )
        ]),

      requiresHumanReview,

      reviewReasons,

      assembledAt:
        new Date()
          .toISOString(),

      deterministic:
        true,

      aiPrepared:
        false,

      externalFilingEnabled:
        false,

      immutable:
        true
    });
  }
}

export class TaxGuardStateReconciliationGuard {

  static evaluate(
    input: {
      preparedReturn:
        TaxGuardStatePreparedReturn;

      calculations:
        readonly TaxGuardStateCalculationResult[];
    }
  ): TaxGuardStateReconciliationResult {

    const reasons:
      string[] = [];

    const calculations =
      new Map(
        input.calculations.map(
          calculation => [
            calculation.calculationId,
            calculation
          ]
        )
      );

    for (
      const expectedId
      of input.preparedReturn
        .calculationIds
    ) {
      if (
        !calculations.has(
          expectedId
        )
      ) {
        reasons.push(
          'STATE_CALCULATION_MISSING:' +
          expectedId
        );
      }
    }

    for (
      const binding
      of input.preparedReturn
        .lineBindings
    ) {
      const calculation =
        calculations.get(
          binding.calculationId
        );

      if (!calculation) {
        reasons.push(
          'STATE_FORM_BINDING_CALCULATION_MISSING:' +
          binding.bindingId
        );

        continue;
      }

      if (
        !sameContext(
          calculation.context,
          input.preparedReturn
            .context
        )
      ) {
        reasons.push(
          'STATE_RECONCILIATION_CONTEXT_MISMATCH:' +
          binding.bindingId
        );
      }

      if (
        calculation.value !==
          binding.value
      ) {
        reasons.push(
          'STATE_FORM_VALUE_MISMATCH:' +
          binding.bindingId
        );
      }

      if (
        calculation.calculationType !==
          binding.calculationType
      ) {
        reasons.push(
          'STATE_FORM_CALCULATION_TYPE_MISMATCH:' +
          binding.bindingId
        );
      }
    }

    return {
      valid:
        reasons.length === 0,

      reasons: [
        ...new Set(
          reasons
        )
      ]
    };
  }

  static assertValid(
    input: Parameters<
      typeof TaxGuardStateReconciliationGuard.evaluate
    >[0]
  ): true {

    const result =
      this.evaluate(
        input
      );

    if (!result.valid) {
      throw new Error(
        'TG_STATE_RECONCILIATION_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardStateProfessionalReviewRegistry {

  private readonly approvals =
    new Map<
      string,
      TaxGuardStateProfessionalApproval
    >();

  approve(
    input: {
      approvalId: string;

      context:
        TaxGuardStateContext;

      preparedStateReturn:
        TaxGuardStatePreparedReturn;

      returnVersionId: string;

      requestedBy: string;

      approvedBy: string;

      approvedByRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';

      provenanceDecisionId: string;
    }
  ): TaxGuardStateProfessionalApproval {

    requireText(
      input.approvalId,
      'TG_STATE_APPROVAL_ID_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_STATE_APPROVAL_VERSION_REQUIRED'
    );

    requireText(
      input.requestedBy,
      'TG_STATE_APPROVAL_REQUESTER_REQUIRED'
    );

    requireText(
      input.approvedBy,
      'TG_STATE_APPROVAL_APPROVER_REQUIRED'
    );

    requireText(
      input.provenanceDecisionId,
      'TG_STATE_APPROVAL_PROVENANCE_REQUIRED'
    );

    if (
      input.requestedBy ===
        input.approvedBy
    ) {
      throw new Error(
        'TG_STATE_APPROVAL_MAKER_CHECKER_REQUIRED'
      );
    }

    if (
      !sameContext(
        input.context,
        input.preparedStateReturn
          .context
      )
    ) {
      throw new Error(
        'TG_STATE_APPROVAL_CONTEXT_MISMATCH'
      );
    }

    if (
      this.approvals.has(
        input.approvalId
      )
    ) {
      throw new Error(
        'TG_STATE_APPROVAL_DUPLICATE'
      );
    }

    const approval:
      TaxGuardStateProfessionalApproval =
        Object.freeze({
          approvalId:
            input.approvalId,

          context:
            cloneContext(
              input.context
            ),

          preparedStateReturnId:
            input.preparedStateReturn
              .preparedStateReturnId,

          returnVersionId:
            input.returnVersionId,

          requestedBy:
            input.requestedBy,

          approvedBy:
            input.approvedBy,

          approvedByRole:
            input.approvedByRole,

          provenanceDecisionId:
            input.provenanceDecisionId,

          approvedAt:
            new Date()
              .toISOString(),

          immutable:
            true
        });

    this.approvals.set(
      approval.approvalId,
      approval
    );

    return {
      ...approval,
      context: {
        ...approval.context
      }
    };
  }

  get(
    approvalId: string
  ): TaxGuardStateProfessionalApproval {

    const approval =
      this.approvals.get(
        approvalId
      );

    if (!approval) {
      throw new Error(
        'TG_STATE_APPROVAL_NOT_FOUND'
      );
    }

    return {
      ...approval,
      context: {
        ...approval.context
      }
    };
  }
}

export class TaxGuardStateWorkflowGate {

  static assertReady(
    input: {
      jurisdictionVerified: boolean;
      rulePackVerified: boolean;
      reconciliationValid: boolean;
      unresolvedExceptionIds:
        readonly string[];
      provenanceApproved: boolean;
      professionalApprovalPresent: boolean;
    }
  ): true {

    const reasons:
      string[] = [];

    if (
      !input.jurisdictionVerified
    ) {
      reasons.push(
        'STATE_JURISDICTION_NOT_VERIFIED'
      );
    }

    if (
      !input.rulePackVerified
    ) {
      reasons.push(
        'STATE_RULE_PACK_NOT_VERIFIED'
      );
    }

    if (
      !input.reconciliationValid
    ) {
      reasons.push(
        'STATE_RECONCILIATION_REQUIRED'
      );
    }

    if (
      input.unresolvedExceptionIds
        .length > 0
    ) {
      reasons.push(
        'STATE_UNRESOLVED_EXCEPTIONS'
      );
    }

    if (
      !input.provenanceApproved
    ) {
      reasons.push(
        'STATE_PROVENANCE_APPROVAL_REQUIRED'
      );
    }

    if (
      !input.professionalApprovalPresent
    ) {
      reasons.push(
        'STATE_PROFESSIONAL_APPROVAL_REQUIRED'
      );
    }

    if (
      reasons.length > 0
    ) {
      throw new Error(
        'TG_STATE_WORKFLOW_GATE_BLOCKED:' +
        reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardStateExternalFilingGuard {

  static submit(): never {
    throw new Error(
      'TG_STATE_EXTERNAL_FILING_DISABLED'
    );
  }
}

export class TaxGuardStateAiPreparationBoundary {

  static prepareFinalReturn(): never {
    throw new Error(
      'TG_STATE_AI_FINAL_PREPARATION_BLOCKED'
    );
  }

  static approveMaterialDecision(): never {
    throw new Error(
      'TG_STATE_AI_FINAL_APPROVAL_BLOCKED'
    );
  }
}
