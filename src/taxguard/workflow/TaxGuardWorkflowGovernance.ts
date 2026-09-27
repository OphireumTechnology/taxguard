
import type {
  TaxGuardReturnWorkflowRecord,
  TaxGuardWorkflowContext,
  TaxGuardWorkflowRole
} from './TaxGuardReturnWorkflow';

import {
  TaxGuardReturnWorkflowEngine
} from './TaxGuardReturnWorkflow';

import {
  TaxGuardWorkflowReadinessGuard
} from './TaxGuardWorkflowControls';

export interface TaxGuardExceptionGateInput {
  unresolvedExceptionIds:
    readonly string[];
}

export interface TaxGuardProfessionalReviewApproval {
  approvalId: string;

  context:
    TaxGuardWorkflowContext;

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

export interface TaxGuardFinalInternalApproval {
  approvalId: string;

  context:
    TaxGuardWorkflowContext;

  returnVersionId: string;

  professionalApprovalId: string;

  provenanceDecisionId: string;

  approvedBy: string;

  approvedByRole:
    | 'REVIEWER'
    | 'CPA'
    | 'EA';

  approvedAt: string;

  externalSubmissionAuthorized:
    false;

  immutable: true;
}

export interface TaxGuardWorkflowGovernanceResult {
  allowed: boolean;

  reasons:
    readonly string[];
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

function cloneContext(
  context:
    TaxGuardWorkflowContext
):
  TaxGuardWorkflowContext {

  return {
    ...context
  };
}

function sameContext(
  left:
    TaxGuardWorkflowContext,

  right:
    TaxGuardWorkflowContext
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
    left.returnId ===
      right.returnId
  );
}

export class TaxGuardExceptionWorkflowGate {

  static evaluate(
    input:
      TaxGuardExceptionGateInput
  ):
    TaxGuardWorkflowGovernanceResult {

    if (
      input.unresolvedExceptionIds
        .length > 0
    ) {
      return {
        allowed:
          false,

        reasons: [
          'UNRESOLVED_EXCEPTIONS'
        ]
      };
    }

    return {
      allowed:
        true,

      reasons: []
    };
  }

  static assertClear(
    input:
      TaxGuardExceptionGateInput
  ):
    true {

    const result =
      this.evaluate(
        input
      );

    if (!result.allowed) {
      throw new Error(
        'TG_WORKFLOW_EXCEPTION_GATE_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardProfessionalReviewRegistry {

  private readonly approvals =
    new Map<
      string,
      TaxGuardProfessionalReviewApproval
    >();

  approve(
    input: {
      approvalId: string;

      context:
        TaxGuardWorkflowContext;

      returnVersionId: string;

      requestedBy: string;

      approvedBy: string;

      approvedByRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';

      provenanceDecisionId: string;
    }
  ):
    TaxGuardProfessionalReviewApproval {

    requireText(
      input.approvalId,
      'TG_PROFESSIONAL_APPROVAL_ID_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_PROFESSIONAL_RETURN_VERSION_REQUIRED'
    );

    requireText(
      input.requestedBy,
      'TG_PROFESSIONAL_REQUESTER_REQUIRED'
    );

    requireText(
      input.approvedBy,
      'TG_PROFESSIONAL_APPROVER_REQUIRED'
    );

    requireText(
      input.provenanceDecisionId,
      'TG_PROFESSIONAL_PROVENANCE_REQUIRED'
    );

    if (
      input.requestedBy ===
        input.approvedBy
    ) {
      throw new Error(
        'TG_PROFESSIONAL_MAKER_CHECKER_REQUIRED'
      );
    }

    if (
      this.approvals.has(
        input.approvalId
      )
    ) {
      throw new Error(
        'TG_PROFESSIONAL_APPROVAL_DUPLICATE'
      );
    }

    const approval:
      TaxGuardProfessionalReviewApproval =
        Object.freeze({
          approvalId:
            input.approvalId,

          context:
            cloneContext(
              input.context
            ),

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
  ):
    TaxGuardProfessionalReviewApproval {

    const approval =
      this.approvals.get(
        approvalId
      );

    if (!approval) {
      throw new Error(
        'TG_PROFESSIONAL_APPROVAL_NOT_FOUND'
      );
    }

    return {
      ...approval,

      context: {
        ...approval.context
      }
    };
  }

  approvedForVersion(
    context:
      TaxGuardWorkflowContext,

    returnVersionId: string
  ):
    boolean {

    return [
      ...this.approvals.values()
    ].some(
      approval =>
        sameContext(
          approval.context,
          context
        ) &&
        approval.returnVersionId ===
          returnVersionId
    );
  }
}

export class TaxGuardFinalInternalApprovalRegistry {

  private readonly approvals =
    new Map<
      string,
      TaxGuardFinalInternalApproval
    >();

  approve(
    input: {
      approvalId: string;

      context:
        TaxGuardWorkflowContext;

      returnVersionId: string;

      professionalApproval:
        TaxGuardProfessionalReviewApproval;

      provenanceDecisionId: string;

      approvedBy: string;

      approvedByRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';
    }
  ):
    TaxGuardFinalInternalApproval {

    requireText(
      input.approvalId,
      'TG_FINAL_APPROVAL_ID_REQUIRED'
    );

    requireText(
      input.returnVersionId,
      'TG_FINAL_RETURN_VERSION_REQUIRED'
    );

    requireText(
      input.provenanceDecisionId,
      'TG_FINAL_PROVENANCE_REQUIRED'
    );

    requireText(
      input.approvedBy,
      'TG_FINAL_APPROVER_REQUIRED'
    );

    if (
      this.approvals.has(
        input.approvalId
      )
    ) {
      throw new Error(
        'TG_FINAL_APPROVAL_DUPLICATE'
      );
    }

    if (
      !sameContext(
        input.context,
        input.professionalApproval
          .context
      )
    ) {
      throw new Error(
        'TG_FINAL_APPROVAL_CONTEXT_MISMATCH'
      );
    }

    if (
      input.professionalApproval
        .returnVersionId !==
      input.returnVersionId
    ) {
      throw new Error(
        'TG_FINAL_APPROVAL_VERSION_MISMATCH'
      );
    }

    if (
      input.professionalApproval
        .approvedBy ===
      input.approvedBy
    ) {
      throw new Error(
        'TG_FINAL_APPROVAL_MAKER_CHECKER_REQUIRED'
      );
    }

    const approval:
      TaxGuardFinalInternalApproval =
        Object.freeze({
          approvalId:
            input.approvalId,

          context:
            cloneContext(
              input.context
            ),

          returnVersionId:
            input.returnVersionId,

          professionalApprovalId:
            input.professionalApproval
              .approvalId,

          provenanceDecisionId:
            input.provenanceDecisionId,

          approvedBy:
            input.approvedBy,

          approvedByRole:
            input.approvedByRole,

          approvedAt:
            new Date()
              .toISOString(),

          externalSubmissionAuthorized:
            false,

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
  ):
    TaxGuardFinalInternalApproval {

    const approval =
      this.approvals.get(
        approvalId
      );

    if (!approval) {
      throw new Error(
        'TG_FINAL_APPROVAL_NOT_FOUND'
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

export class TaxGuardFinalWorkflowGate {

  static evaluate(
    input: {
      workflow:
        TaxGuardReturnWorkflowRecord;

      returnVersionId: string;

      taxpayerReviewAccepted:
        boolean;

      filingAuthorizationGranted:
        boolean;

      signatureConsentGranted:
        boolean;

      signatureExists:
        boolean;

      unresolvedExceptionIds:
        readonly string[];

      provenanceApproved:
        boolean;

      professionalReviewApproved:
        boolean;

      professionalApproval?:
        TaxGuardProfessionalReviewApproval;
    }
  ):
    TaxGuardWorkflowGovernanceResult {

    const reasons:
      string[] = [];

    const readiness =
      TaxGuardWorkflowReadinessGuard
        .evaluate({
          workflow:
            input.workflow,

          latestVersion: {
            versionId:
              input.returnVersionId,

            context:
              input.workflow.context,

            versionNumber:
              1,

            contentHash:
              'workflow-gate',

            preparedReturnId:
              input.workflow.context
                .returnId,

            createdBy:
              'WORKFLOW_GATE',

            createdAt:
              input.workflow.updatedAt,

            locked:
              true,

            immutable:
              true
          },

          taxpayerReviewAccepted:
            input.taxpayerReviewAccepted,

          filingAuthorizationGranted:
            input.filingAuthorizationGranted,

          signatureConsentGranted:
            input.signatureConsentGranted,

          signatureExists:
            input.signatureExists,

          unresolvedExceptionIds:
            input.unresolvedExceptionIds,

          provenanceApproved:
            input.provenanceApproved,

          professionalReviewApproved:
            input.professionalReviewApproved
        });

    reasons.push(
      ...readiness.reasons
    );

    if (
      input.workflow.currentStage !==
        'FINAL_INTERNAL_APPROVAL'
    ) {
      reasons.push(
        'FINAL_INTERNAL_APPROVAL_STAGE_REQUIRED'
      );
    }

    if (
      !input.professionalApproval
    ) {
      reasons.push(
        'PROFESSIONAL_APPROVAL_RECORD_REQUIRED'
      );
    } else {

      if (
        !sameContext(
          input.workflow.context,
          input.professionalApproval
            .context
        )
      ) {
        reasons.push(
          'PROFESSIONAL_APPROVAL_CONTEXT_MISMATCH'
        );
      }

      if (
        input.professionalApproval
          .returnVersionId !==
        input.returnVersionId
      ) {
        reasons.push(
          'PROFESSIONAL_APPROVAL_VERSION_MISMATCH'
        );
      }
    }

    return {
      allowed:
        reasons.length === 0,

      reasons: [
        ...new Set(
          reasons
        )
      ]
    };
  }

  static assertAllowed(
    input: Parameters<
      typeof TaxGuardFinalWorkflowGate.evaluate
    >[0]
  ):
    true {

    const result =
      this.evaluate(
        input
      );

    if (!result.allowed) {
      throw new Error(
        'TG_FINAL_WORKFLOW_GATE_BLOCKED:' +
        result.reasons.join(',')
      );
    }

    return true;
  }
}

export class TaxGuardWorkflowCompletionService {

  constructor(
    private readonly workflows:
      TaxGuardReturnWorkflowEngine
  ) {}

  completeFinalInternalApproval(
    workflowId: string,

    input: {
      actorId: string;

      actorRole:
        | 'REVIEWER'
        | 'CPA'
        | 'EA';

      returnVersionId: string;

      taxpayerReviewAccepted:
        boolean;

      filingAuthorizationGranted:
        boolean;

      signatureConsentGranted:
        boolean;

      signatureExists:
        boolean;

      unresolvedExceptionIds:
        readonly string[];

      provenanceApproved:
        boolean;

      professionalReviewApproved:
        boolean;

      professionalApproval:
        TaxGuardProfessionalReviewApproval;

      provenanceDecisionId: string;
    }
  ):
    TaxGuardReturnWorkflowRecord {

    const workflow =
      this.workflows.get(
        workflowId
      );

    TaxGuardFinalWorkflowGate
      .assertAllowed({
        workflow,

        returnVersionId:
          input.returnVersionId,

        taxpayerReviewAccepted:
          input.taxpayerReviewAccepted,

        filingAuthorizationGranted:
          input.filingAuthorizationGranted,

        signatureConsentGranted:
          input.signatureConsentGranted,

        signatureExists:
          input.signatureExists,

        unresolvedExceptionIds:
          input.unresolvedExceptionIds,

        provenanceApproved:
          input.provenanceApproved,

        professionalReviewApproved:
          input.professionalReviewApproved,

        professionalApproval:
          input.professionalApproval
      });

    return this.workflows
      .completeCurrentStage(
        workflowId,
        {
          actorId:
            input.actorId,

          actorRole:
            input.actorRole,

          provenanceDecisionIds: [
            input.provenanceDecisionId
          ],

          notes: [
            'Final internal approval completed. External filing remains disabled.'
          ]
        }
      );
  }
}

export class TaxGuardAiWorkflowBoundary {

  static assertHumanApproval(
    actorId: string,
    actorRole: TaxGuardWorkflowRole
  ):
    true {

    requireText(
      actorId,
      'TG_AI_BOUNDARY_ACTOR_REQUIRED'
    );

    if (
      ![
        'PREPARER',
        'REVIEWER',
        'CPA',
        'EA',
        'SEC_OPS',
        'ADMIN',
        'TAXPAYER'
      ].includes(
        actorRole
      )
    ) {
      throw new Error(
        'TG_AI_FINAL_APPROVAL_BLOCKED'
      );
    }

    return true;
  }

  static approveMaterialTaxDecision():
    never {

    throw new Error(
      'TG_AI_FINAL_APPROVAL_BLOCKED'
    );
  }
}
