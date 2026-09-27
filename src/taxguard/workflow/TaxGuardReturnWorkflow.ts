
export type TaxGuardWorkflowStage =
  | 'PREPARATION'
  | 'EXCEPTION_REVIEW'
  | 'PROFESSIONAL_REVIEW'
  | 'TAXPAYER_REVIEW'
  | 'AUTHORIZATION_CONSENT'
  | 'RETURN_VERSION_REVIEW'
  | 'SIGNATURE_CONSENT'
  | 'READINESS_REVIEW'
  | 'FINAL_INTERNAL_APPROVAL'
  | 'READY_FOR_EXTERNAL_FILING';

export type TaxGuardWorkflowStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'REQUIRES_REVIEW'
  | 'COMPLETED'
  | 'SUPERSEDED';

export type TaxGuardWorkflowRisk =
  | 'routine'
  | 'material'
  | 'critical';

export type TaxGuardWorkflowRole =
  | 'TAXPAYER'
  | 'PREPARER'
  | 'REVIEWER'
  | 'CPA'
  | 'EA'
  | 'SEC_OPS'
  | 'ADMIN';

export interface TaxGuardWorkflowContext {
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;
  returnId: string;
}

export interface TaxGuardWorkflowStageRecord {
  stage:
    TaxGuardWorkflowStage;

  status:
    TaxGuardWorkflowStatus;

  context:
    TaxGuardWorkflowContext;

  completedBy?: string;

  completedByRole?:
    TaxGuardWorkflowRole;

  completedAt?: string;

  evidenceIds:
    readonly string[];

  provenanceDecisionIds:
    readonly string[];

  exceptionIds:
    readonly string[];

  notes:
    readonly string[];

  immutable: true;
}

export interface TaxGuardWorkflowTransition {
  transitionId: string;

  context:
    TaxGuardWorkflowContext;

  fromStage:
    TaxGuardWorkflowStage;

  toStage:
    TaxGuardWorkflowStage;

  actorId: string;

  actorRole:
    TaxGuardWorkflowRole;

  occurredAt: string;

  immutable: true;
}

export interface TaxGuardReturnWorkflowRecord {
  workflowId: string;

  context:
    TaxGuardWorkflowContext;

  currentStage:
    TaxGuardWorkflowStage;

  stages:
    readonly TaxGuardWorkflowStageRecord[];

  transitions:
    readonly TaxGuardWorkflowTransition[];

  createdAt: string;

  updatedAt: string;

  externalFilingEnabled:
    false;

  immutable: true;
}

export const TAXGUARD_WORKFLOW_SEQUENCE:
  readonly TaxGuardWorkflowStage[] =
    Object.freeze([
      'PREPARATION',
      'EXCEPTION_REVIEW',
      'PROFESSIONAL_REVIEW',
      'TAXPAYER_REVIEW',
      'AUTHORIZATION_CONSENT',
      'RETURN_VERSION_REVIEW',
      'SIGNATURE_CONSENT',
      'READINESS_REVIEW',
      'FINAL_INTERNAL_APPROVAL',
      'READY_FOR_EXTERNAL_FILING'
    ]);

function now(): string {
  return new Date()
    .toISOString();
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
    TaxGuardWorkflowContext
):
  TaxGuardWorkflowContext {

  return {
    ...context
  };
}

function cloneStage(
  stage:
    TaxGuardWorkflowStageRecord
):
  TaxGuardWorkflowStageRecord {

  return {
    ...stage,

    context:
      cloneContext(
        stage.context
      ),

    evidenceIds: [
      ...stage.evidenceIds
    ],

    provenanceDecisionIds: [
      ...stage.provenanceDecisionIds
    ],

    exceptionIds: [
      ...stage.exceptionIds
    ],

    notes: [
      ...stage.notes
    ]
  };
}

function cloneTransition(
  transition:
    TaxGuardWorkflowTransition
):
  TaxGuardWorkflowTransition {

  return {
    ...transition,

    context:
      cloneContext(
        transition.context
      )
  };
}

function cloneWorkflow(
  workflow:
    TaxGuardReturnWorkflowRecord
):
  TaxGuardReturnWorkflowRecord {

  return {
    ...workflow,

    context:
      cloneContext(
        workflow.context
      ),

    stages:
      workflow.stages.map(
        cloneStage
      ),

    transitions:
      workflow.transitions.map(
        cloneTransition
      )
  };
}

export class TaxGuardReturnWorkflowEngine {

  private readonly workflows =
    new Map<
      string,
      TaxGuardReturnWorkflowRecord
    >();

  create(
    input: {
      workflowId: string;
      context: TaxGuardWorkflowContext;
      createdBy: string;
      createdByRole: TaxGuardWorkflowRole;
    }
  ):
    TaxGuardReturnWorkflowRecord {

    requireText(
      input.workflowId,
      'TG_WORKFLOW_ID_REQUIRED'
    );

    requireText(
      input.context.clientId,
      'TG_WORKFLOW_CLIENT_REQUIRED'
    );

    requireText(
      input.context.engagementId,
      'TG_WORKFLOW_ENGAGEMENT_REQUIRED'
    );

    requireText(
      input.context.correlationId,
      'TG_WORKFLOW_CORRELATION_REQUIRED'
    );

    requireText(
      input.context.returnId,
      'TG_WORKFLOW_RETURN_REQUIRED'
    );

    requireText(
      input.createdBy,
      'TG_WORKFLOW_CREATOR_REQUIRED'
    );

    if (
      !Number.isInteger(
        input.context.taxYear
      ) ||
      input.context.taxYear < 1900 ||
      input.context.taxYear > 2200
    ) {
      throw new Error(
        'TG_WORKFLOW_INVALID_TAX_YEAR'
      );
    }

    if (
      this.workflows.has(
        input.workflowId
      )
    ) {
      throw new Error(
        'TG_WORKFLOW_DUPLICATE_ID'
      );
    }

    const createdAt =
      now();

    const stages:
      TaxGuardWorkflowStageRecord[] =
        TAXGUARD_WORKFLOW_SEQUENCE.map(
          stage =>
            Object.freeze({
              stage,

              status:
                stage ===
                  'PREPARATION'
                  ? 'IN_PROGRESS'
                  : 'NOT_STARTED',

              context:
                cloneContext(
                  input.context
                ),

              evidenceIds: [],

              provenanceDecisionIds: [],

              exceptionIds: [],

              notes:
                stage ===
                  'PREPARATION'
                  ? [
                      'Workflow initialized.'
                    ]
                  : [],

              immutable:
                true
            })
        );

    const workflow:
      TaxGuardReturnWorkflowRecord =
        Object.freeze({
          workflowId:
            input.workflowId,

          context:
            cloneContext(
              input.context
            ),

          currentStage:
            'PREPARATION',

          stages,

          transitions: [],

          createdAt,

          updatedAt:
            createdAt,

          externalFilingEnabled:
            false,

          immutable:
            true
        });

    this.workflows.set(
      input.workflowId,
      workflow
    );

    return cloneWorkflow(
      workflow
    );
  }

  get(
    workflowId: string
  ):
    TaxGuardReturnWorkflowRecord {

    const workflow =
      this.workflows.get(
        workflowId
      );

    if (!workflow) {
      throw new Error(
        'TG_WORKFLOW_NOT_FOUND'
      );
    }

    return cloneWorkflow(
      workflow
    );
  }

  list():
    readonly TaxGuardReturnWorkflowRecord[] {

    return [
      ...this.workflows.values()
    ].map(
      cloneWorkflow
    );
  }

  completeCurrentStage(
    workflowId: string,

    input: {
      actorId: string;

      actorRole:
        TaxGuardWorkflowRole;

      evidenceIds?: readonly string[];

      provenanceDecisionIds?:
        readonly string[];

      exceptionIds?:
        readonly string[];

      notes?: readonly string[];
    }
  ):
    TaxGuardReturnWorkflowRecord {

    requireText(
      input.actorId,
      'TG_WORKFLOW_ACTOR_REQUIRED'
    );

    const current =
      this.requireInternal(
        workflowId
      );

    if (
      current.currentStage ===
        'READY_FOR_EXTERNAL_FILING'
    ) {
      throw new Error(
        'TG_EXTERNAL_FILING_DISABLED'
      );
    }

    const currentIndex =
      TAXGUARD_WORKFLOW_SEQUENCE
        .indexOf(
          current.currentStage
        );

    if (
      currentIndex < 0
    ) {
      throw new Error(
        'TG_WORKFLOW_INVALID_CURRENT_STAGE'
      );
    }

    const nextStage =
      TAXGUARD_WORKFLOW_SEQUENCE[
        currentIndex + 1
      ];

    if (!nextStage) {
      throw new Error(
        'TG_EXTERNAL_FILING_DISABLED'
      );
    }

    const completedAt =
      now();

    const stages =
      current.stages.map(
        stage => {

          if (
            stage.stage ===
              current.currentStage
          ) {
            return Object.freeze({
              ...stage,

              status:
                'COMPLETED' as const,

              completedBy:
                input.actorId,

              completedByRole:
                input.actorRole,

              completedAt,

              evidenceIds:
                unique(
                  input.evidenceIds ??
                  stage.evidenceIds
                ),

              provenanceDecisionIds:
                unique(
                  input
                    .provenanceDecisionIds ??
                  stage
                    .provenanceDecisionIds
                ),

              exceptionIds:
                unique(
                  input.exceptionIds ??
                  stage.exceptionIds
                ),

              notes:
                unique([
                  ...stage.notes,
                  ...(
                    input.notes ??
                    []
                  )
                ])
            });
          }

          if (
            stage.stage ===
              nextStage
          ) {
            return Object.freeze({
              ...stage,

              status:
                'IN_PROGRESS' as const
            });
          }

          return stage;
        }
      );

    const transition:
      TaxGuardWorkflowTransition =
        Object.freeze({
          transitionId:
            'TG-WF-TRANSITION-' +
            String(
              current.transitions
                .length + 1
            ).padStart(
              8,
              '0'
            ),

          context:
            cloneContext(
              current.context
            ),

          fromStage:
            current.currentStage,

          toStage:
            nextStage,

          actorId:
            input.actorId,

          actorRole:
            input.actorRole,

          occurredAt:
            completedAt,

          immutable:
            true
        });

    const updated:
      TaxGuardReturnWorkflowRecord =
        Object.freeze({
          ...current,

          currentStage:
            nextStage,

          stages,

          transitions: [
            ...current.transitions,
            transition
          ],

          updatedAt:
            completedAt
        });

    this.workflows.set(
      workflowId,
      updated
    );

    return cloneWorkflow(
      updated
    );
  }

  blockCurrentStage(
    workflowId: string,

    input: {
      actorId: string;
      reason: string;
      exceptionIds?: readonly string[];
    }
  ):
    TaxGuardReturnWorkflowRecord {

    requireText(
      input.actorId,
      'TG_WORKFLOW_ACTOR_REQUIRED'
    );

    requireText(
      input.reason,
      'TG_WORKFLOW_BLOCK_REASON_REQUIRED'
    );

    const current =
      this.requireInternal(
        workflowId
      );

    const stages =
      current.stages.map(
        stage =>
          stage.stage ===
            current.currentStage
            ? Object.freeze({
                ...stage,

                status:
                  'BLOCKED' as const,

                exceptionIds:
                  unique([
                    ...stage.exceptionIds,
                    ...(
                      input.exceptionIds ??
                      []
                    )
                  ]),

                notes:
                  unique([
                    ...stage.notes,
                    input.reason
                  ])
              })
            : stage
      );

    const updated:
      TaxGuardReturnWorkflowRecord =
        Object.freeze({
          ...current,

          stages,

          updatedAt:
            now()
        });

    this.workflows.set(
      workflowId,
      updated
    );

    return cloneWorkflow(
      updated
    );
  }

  reopenCurrentStage(
    workflowId: string,

    input: {
      actorId: string;
      actorRole: TaxGuardWorkflowRole;
      reason: string;
    }
  ):
    TaxGuardReturnWorkflowRecord {

    requireText(
      input.actorId,
      'TG_WORKFLOW_ACTOR_REQUIRED'
    );

    requireText(
      input.reason,
      'TG_WORKFLOW_REOPEN_REASON_REQUIRED'
    );

    const current =
      this.requireInternal(
        workflowId
      );

    const stages =
      current.stages.map(
        stage =>
          stage.stage ===
            current.currentStage
            ? Object.freeze({
                ...stage,

                status:
                  'IN_PROGRESS' as const,

                notes:
                  unique([
                    ...stage.notes,
                    input.reason
                  ])
              })
            : stage
      );

    const updated:
      TaxGuardReturnWorkflowRecord =
        Object.freeze({
          ...current,

          stages,

          updatedAt:
            now()
        });

    this.workflows.set(
      workflowId,
      updated
    );

    return cloneWorkflow(
      updated
    );
  }

  currentStage(
    workflowId: string
  ):
    TaxGuardWorkflowStageRecord {

    const workflow =
      this.requireInternal(
        workflowId
      );

    const stage =
      workflow.stages.find(
        item =>
          item.stage ===
            workflow.currentStage
      );

    if (!stage) {
      throw new Error(
        'TG_WORKFLOW_STAGE_NOT_FOUND'
      );
    }

    return cloneStage(
      stage
    );
  }

  private requireInternal(
    workflowId: string
  ):
    TaxGuardReturnWorkflowRecord {

    const workflow =
      this.workflows.get(
        workflowId
      );

    if (!workflow) {
      throw new Error(
        'TG_WORKFLOW_NOT_FOUND'
      );
    }

    return workflow;
  }
}

export class TaxGuardExternalFilingGuard {

  static assertDisabled():
    never {

    throw new Error(
      'TG_EXTERNAL_FILING_DISABLED'
    );
  }

  static submit():
    never {

    throw new Error(
      'TG_EXTERNAL_FILING_DISABLED'
    );
  }
}
