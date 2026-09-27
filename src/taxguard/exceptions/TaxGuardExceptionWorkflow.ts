
import type {
  TaxGuardExceptionAssignment,
  TaxGuardExceptionEscalation,
  TaxGuardExceptionRecord,
  TaxGuardExceptionReopen,
  TaxGuardExceptionResolution,
  TaxGuardExceptionStatus,
  TaxGuardProfessionalRole
} from './TaxGuardExceptionProfessionalReview';

import {
  TaxGuardExceptionRegistry
} from './TaxGuardExceptionProfessionalReview';

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

function now(): string {
  return new Date()
    .toISOString();
}

function roleAllowed(
  record:
    TaxGuardExceptionRecord,

  role:
    TaxGuardProfessionalRole
): boolean {

  return record
    .requiredRoles
    .includes(role);
}

export class TaxGuardExceptionWorkflow {

  constructor(
    private readonly registry:
      TaxGuardExceptionRegistry
  ) {}

  assign(
    input:
      TaxGuardExceptionAssignment
  ):
    TaxGuardExceptionRecord {

    requireText(
      input.exceptionId,
      'TG_EXCEPTION_ID_REQUIRED'
    );

    requireText(
      input.assignedTo,
      'TG_EXCEPTION_ASSIGNEE_REQUIRED'
    );

    requireText(
      input.assignedBy,
      'TG_EXCEPTION_ASSIGNER_REQUIRED'
    );

    const current =
      this.registry.get(
        input.exceptionId
      );

    if (
      current.status ===
        'RESOLVED' ||
      current.status ===
        'CLOSED'
    ) {
      throw new Error(
        'TG_EXCEPTION_ASSIGNMENT_INVALID_STATUS'
      );
    }

    if (
      !roleAllowed(
        current,
        input.assignedRole
      )
    ) {
      throw new Error(
        'TG_EXCEPTION_UNAUTHORIZED_ROLE'
      );
    }

    return this.replace({
      ...current,

      status:
        'ASSIGNED',

      assignedTo:
        input.assignedTo,

      assignedRole:
        input.assignedRole,

      updatedAt:
        now()
    });
  }

  startReview(
    exceptionId:
      string,

    reviewerId:
      string,

    reviewerRole:
      TaxGuardProfessionalRole
  ):
    TaxGuardExceptionRecord {

    requireText(
      reviewerId,
      'TG_EXCEPTION_REVIEWER_REQUIRED'
    );

    const current =
      this.registry.get(
        exceptionId
      );

    if (
      current.status !==
        'ASSIGNED' &&
      current.status !==
        'REOPENED' &&
      current.status !==
        'ESCALATED'
    ) {
      throw new Error(
        'TG_EXCEPTION_REVIEW_INVALID_STATUS'
      );
    }

    if (
      current.assignedTo &&
      current.assignedTo !==
        reviewerId
    ) {
      throw new Error(
        'TG_EXCEPTION_ASSIGNEE_MISMATCH'
      );
    }

    if (
      !roleAllowed(
        current,
        reviewerRole
      )
    ) {
      throw new Error(
        'TG_EXCEPTION_UNAUTHORIZED_ROLE'
      );
    }

    return this.replace({
      ...current,

      status:
        'IN_REVIEW',

      assignedTo:
        reviewerId,

      assignedRole:
        reviewerRole,

      updatedAt:
        now()
    });
  }

  resolve(
    input:
      TaxGuardExceptionResolution
  ):
    TaxGuardExceptionRecord {

    requireText(
      input.resolvedBy,
      'TG_EXCEPTION_RESOLVER_REQUIRED'
    );

    requireText(
      input.resolutionNote,
      'TG_EXCEPTION_RESOLUTION_NOTE_REQUIRED'
    );

    const current =
      this.registry.get(
        input.exceptionId
      );

    if (
      current.status !==
        'IN_REVIEW' &&
      current.status !==
        'ASSIGNED' &&
      current.status !==
        'ESCALATED'
    ) {
      throw new Error(
        'TG_EXCEPTION_RESOLUTION_INVALID_STATUS'
      );
    }

    if (
      !roleAllowed(
        current,
        input.resolvedByRole
      )
    ) {
      throw new Error(
        'TG_EXCEPTION_UNAUTHORIZED_ROLE'
      );
    }

    if (
      current.assignedTo &&
      current.assignedTo !==
        input.resolvedBy
    ) {
      throw new Error(
        'TG_EXCEPTION_ASSIGNEE_MISMATCH'
      );
    }

    if (
      current
        .requiresProfessionalReview &&
      input.resolvedBy ===
        current.createdBy
    ) {
      throw new Error(
        'TG_EXCEPTION_MAKER_CHECKER_REQUIRED'
      );
    }

    if (
      current
        .requiresProfessionalReview &&
      ![
        'REVIEWER',
        'CPA',
        'EA'
      ].includes(
        input.resolvedByRole
      )
    ) {
      throw new Error(
        'TG_EXCEPTION_PROFESSIONAL_REVIEW_REQUIRED'
      );
    }

    const timestamp =
      now();

    return this.replace({
      ...current,

      status:
        'RESOLVED',

      resolvedBy:
        input.resolvedBy,

      resolvedAt:
        timestamp,

      disposition:
        input.disposition,

      resolutionNote:
        input.resolutionNote,

      blocksWorkflow:
        false,

      updatedAt:
        timestamp
    });
  }

  escalate(
    input:
      TaxGuardExceptionEscalation
  ):
    TaxGuardExceptionRecord {

    requireText(
      input.escalatedBy,
      'TG_EXCEPTION_ESCALATOR_REQUIRED'
    );

    requireText(
      input.reason,
      'TG_EXCEPTION_ESCALATION_REASON_REQUIRED'
    );

    const current =
      this.registry.get(
        input.exceptionId
      );

    if (
      current.status ===
        'RESOLVED' ||
      current.status ===
        'CLOSED'
    ) {
      throw new Error(
        'TG_EXCEPTION_ESCALATION_INVALID_STATUS'
      );
    }

    const roles:
  TaxGuardProfessionalRole[] = [
    ...new Set<TaxGuardProfessionalRole>([
      ...current.requiredRoles,
      'REVIEWER',
      'CPA',
      'EA'
    ])
  ];

    return this.replace({
      ...current,

      status:
        'ESCALATED',

      risk:
        current.risk ===
          'routine'
          ? 'material'
          : current.risk,

      requiredRoles:
        roles,

      escalationReason:
        input.reason,

      requiresProfessionalReview:
        true,

      blocksWorkflow:
        true,

      updatedAt:
        now()
    });
  }

  reopen(
    input:
      TaxGuardExceptionReopen
  ):
    TaxGuardExceptionRecord {

    requireText(
      input.reopenedBy,
      'TG_EXCEPTION_REOPENER_REQUIRED'
    );

    requireText(
      input.reason,
      'TG_EXCEPTION_REOPEN_REASON_REQUIRED'
    );

    const current =
      this.registry.get(
        input.exceptionId
      );

    if (
      current.status !==
        'RESOLVED' &&
      current.status !==
        'CLOSED'
    ) {
      throw new Error(
        'TG_EXCEPTION_REOPEN_INVALID_STATUS'
      );
    }

    return this.replace({
      ...current,

      status:
        'REOPENED',

      resolvedBy:
        undefined,

      resolvedAt:
        undefined,

      disposition:
        undefined,

      resolutionNote:
        undefined,

      escalationReason:
        input.reason,

      blocksWorkflow:
        true,

      updatedAt:
        now()
    });
  }

  close(
    exceptionId:
      string,

    closedBy:
      string
  ):
    TaxGuardExceptionRecord {

    requireText(
      closedBy,
      'TG_EXCEPTION_CLOSER_REQUIRED'
    );

    const current =
      this.registry.get(
        exceptionId
      );

    if (
      current.status !==
        'RESOLVED'
    ) {
      throw new Error(
        'TG_EXCEPTION_CLOSE_REQUIRES_RESOLUTION'
      );
    }

    return this.replace({
      ...current,

      status:
        'CLOSED',

      blocksWorkflow:
        false,

      updatedAt:
        now()
    });
  }

  private replace(
    record:
      TaxGuardExceptionRecord
  ):
    TaxGuardExceptionRecord {

    const mutableRegistry =
      this.registry as unknown as {
        records:
          Map<
            string,
            TaxGuardExceptionRecord
          >;

        auditEntries:
          Array<{
            auditId: string;
            exceptionId: string;
            action:
              | 'CREATED'
              | 'ASSIGNED'
              | 'REVIEW_STARTED'
              | 'RESOLVED'
              | 'REOPENED'
              | 'ESCALATED'
              | 'CLOSED';
            actorId: string;
            actorRole?:
              TaxGuardProfessionalRole;
            timestamp: string;
            reason?: string;
            priorStatus?:
              TaxGuardExceptionStatus;
            newStatus:
              TaxGuardExceptionStatus;
            immutable: true;
          }>;
      };

    const prior =
      mutableRegistry
        .records
        .get(
          record.exceptionId
        );

    if (!prior) {
      throw new Error(
        'TG_EXCEPTION_NOT_FOUND'
      );
    }

    mutableRegistry
      .records
      .set(
        record.exceptionId,
        {
          ...record,

          evidence:
            record.evidence.map(
              evidence => ({
                ...evidence
              })
            ),

          requiredRoles: [
            ...record.requiredRoles
          ]
        }
      );

    const action =
      this.auditAction(
        record.status
      );

    const actorId =
      record.resolvedBy ??
      record.assignedTo ??
      record.createdBy;

    mutableRegistry
      .auditEntries
      .push(
        Object.freeze({
          auditId:
            'TG-AUD-' +
            String(
              mutableRegistry
                .auditEntries
                .length + 1
            ).padStart(
              8,
              '0'
            ),

          exceptionId:
            record.exceptionId,

          action,

          actorId,

          actorRole:
            record.assignedRole,

          timestamp:
            now(),

          reason:
            record.resolutionNote ??
            record.escalationReason,

          priorStatus:
            prior.status,

          newStatus:
            record.status,

          immutable:
            true
        })
      );

    return this.registry.get(
      record.exceptionId
    );
  }

  private auditAction(
    status:
      TaxGuardExceptionStatus
  ):
    | 'CREATED'
    | 'ASSIGNED'
    | 'REVIEW_STARTED'
    | 'RESOLVED'
    | 'REOPENED'
    | 'ESCALATED'
    | 'CLOSED' {

    switch (status) {
      case 'ASSIGNED':
        return 'ASSIGNED';

      case 'IN_REVIEW':
        return 'REVIEW_STARTED';

      case 'RESOLVED':
        return 'RESOLVED';

      case 'REOPENED':
        return 'REOPENED';

      case 'ESCALATED':
        return 'ESCALATED';

      case 'CLOSED':
        return 'CLOSED';

      default:
        return 'CREATED';
    }
  }
}
