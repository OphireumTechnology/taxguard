
export type TaxGuardExceptionType =
  | 'MISSING_INFORMATION'
  | 'LOW_CONFIDENCE'
  | 'CONFLICTING_DATA'
  | 'MISSING_EVIDENCE'
  | 'RULE_CONFLICT'
  | 'CALCULATION_EXCEPTION'
  | 'PREPARATION_EXCEPTION'
  | 'PROFESSIONAL_REVIEW_REQUIRED'
  | 'SECURITY_EXCEPTION'
  | 'OTHER';

export type TaxGuardExceptionRisk =
  | 'routine'
  | 'material'
  | 'critical';

export type TaxGuardExceptionStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_REVIEW'
  | 'RESOLVED'
  | 'REOPENED'
  | 'ESCALATED'
  | 'CLOSED';

export type TaxGuardProfessionalRole =
  | 'PREPARER'
  | 'REVIEWER'
  | 'CPA'
  | 'EA'
  | 'SEC_OPS'
  | 'ADMIN';

export type TaxGuardExceptionDisposition =
  | 'INFORMATION_RECEIVED'
  | 'EVIDENCE_VERIFIED'
  | 'DATA_CORRECTED'
  | 'CONFLICT_RESOLVED'
  | 'PROFESSIONAL_APPROVED'
  | 'SECURITY_CLEARED'
  | 'NO_CHANGE_REQUIRED'
  | 'REJECTED';

export interface TaxGuardExceptionContext {
  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;
}

export interface TaxGuardExceptionEvidence {
  evidenceId: string;
  sourceDocumentId?: string;
  factPath?: string;
  description: string;
}

export interface TaxGuardExceptionRecord {
  exceptionId: string;

  type:
    TaxGuardExceptionType;

  risk:
    TaxGuardExceptionRisk;

  status:
    TaxGuardExceptionStatus;

  clientId: string;
  engagementId: string;
  taxYear: number;
  correlationId: string;

  title: string;
  description: string;

  sourceModule: string;
  sourceRecordId?: string;

  evidence:
    readonly TaxGuardExceptionEvidence[];

  requiredRoles:
    readonly TaxGuardProfessionalRole[];

  assignedTo?: string;
  assignedRole?: TaxGuardProfessionalRole;

  createdBy: string;
  createdAt: string;

  updatedAt: string;

  resolvedBy?: string;
  resolvedAt?: string;

  disposition?:
    TaxGuardExceptionDisposition;

  resolutionNote?: string;

  escalationReason?: string;

  requiresProfessionalReview:
    boolean;

  blocksWorkflow:
    boolean;

  immutableAuditRequired:
    true;
}

export interface TaxGuardExceptionCreateInput {
  exceptionId: string;

  type:
    TaxGuardExceptionType;

  risk:
    TaxGuardExceptionRisk;

  context:
    TaxGuardExceptionContext;

  title: string;
  description: string;

  sourceModule: string;
  sourceRecordId?: string;

  evidence?:
    readonly TaxGuardExceptionEvidence[];

  requiredRoles?:
    readonly TaxGuardProfessionalRole[];

  createdBy: string;

  requiresProfessionalReview?:
    boolean;

  blocksWorkflow?:
    boolean;
}

export interface TaxGuardExceptionAssignment {
  exceptionId: string;
  assignedTo: string;
  assignedRole:
    TaxGuardProfessionalRole;
  assignedBy: string;
}

export interface TaxGuardExceptionResolution {
  exceptionId: string;

  resolvedBy: string;

  resolvedByRole:
    TaxGuardProfessionalRole;

  disposition:
    TaxGuardExceptionDisposition;

  resolutionNote: string;
}

export interface TaxGuardExceptionEscalation {
  exceptionId: string;
  escalatedBy: string;
  reason: string;
}

export interface TaxGuardExceptionReopen {
  exceptionId: string;
  reopenedBy: string;
  reason: string;
}

export interface TaxGuardExceptionAuditEntry {
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

function now(): string {
  return new Date()
    .toISOString();
}

function uniqueRoles(
  roles:
    readonly TaxGuardProfessionalRole[]
):
  TaxGuardProfessionalRole[] {

  return [
    ...new Set(roles)
  ];
}

function cloneEvidence(
  evidence:
    readonly TaxGuardExceptionEvidence[]
):
  TaxGuardExceptionEvidence[] {

  return evidence.map(
    item => ({
      ...item
    })
  );
}

export class TaxGuardExceptionRegistry {

  private readonly records =
    new Map<
      string,
      TaxGuardExceptionRecord
    >();

  private readonly auditEntries:
    TaxGuardExceptionAuditEntry[] =
      [];

  create(
    input:
      TaxGuardExceptionCreateInput
  ):
    TaxGuardExceptionRecord {

    requireText(
      input.exceptionId,
      'TG_EXCEPTION_ID_REQUIRED'
    );

    requireText(
      input.context.clientId,
      'TG_EXCEPTION_CLIENT_REQUIRED'
    );

    requireText(
      input.context.engagementId,
      'TG_EXCEPTION_ENGAGEMENT_REQUIRED'
    );

    requireText(
      input.context.correlationId,
      'TG_EXCEPTION_CORRELATION_REQUIRED'
    );

    requireText(
      input.title,
      'TG_EXCEPTION_TITLE_REQUIRED'
    );

    requireText(
      input.description,
      'TG_EXCEPTION_DESCRIPTION_REQUIRED'
    );

    requireText(
      input.sourceModule,
      'TG_EXCEPTION_SOURCE_MODULE_REQUIRED'
    );

    requireText(
      input.createdBy,
      'TG_EXCEPTION_CREATOR_REQUIRED'
    );

    if (
      !Number.isInteger(
        input.context.taxYear
      ) ||
      input.context.taxYear < 1900 ||
      input.context.taxYear > 2200
    ) {
      throw new Error(
        'TG_EXCEPTION_INVALID_TAX_YEAR'
      );
    }

    if (
      this.records.has(
        input.exceptionId
      )
    ) {
      throw new Error(
        'TG_EXCEPTION_DUPLICATE_ID'
      );
    }

    const professionalReview =
      input
        .requiresProfessionalReview ??
      (
        input.risk === 'material' ||
        input.risk === 'critical' ||
        input.type ===
          'PROFESSIONAL_REVIEW_REQUIRED'
      );

    const blocksWorkflow =
      input.blocksWorkflow ??
      (
        input.risk === 'material' ||
        input.risk === 'critical' ||
        input.type ===
          'MISSING_INFORMATION' ||
        input.type ===
          'CONFLICTING_DATA' ||
        input.type ===
          'MISSING_EVIDENCE' ||
        input.type ===
          'RULE_CONFLICT' ||
        input.type ===
          'SECURITY_EXCEPTION'
      );

    const timestamp =
      now();

    const record:
      TaxGuardExceptionRecord = {
        exceptionId:
          input.exceptionId,

        type:
          input.type,

        risk:
          input.risk,

        status:
          'OPEN',

        clientId:
          input.context.clientId,

        engagementId:
          input.context.engagementId,

        taxYear:
          input.context.taxYear,

        correlationId:
          input.context.correlationId,

        title:
          input.title,

        description:
          input.description,

        sourceModule:
          input.sourceModule,

        sourceRecordId:
          input.sourceRecordId,

        evidence:
          cloneEvidence(
            input.evidence ?? []
          ),

        requiredRoles:
          uniqueRoles(
            input.requiredRoles ??
            (
              professionalReview
                ? [
                    'REVIEWER',
                    'CPA',
                    'EA'
                  ]
                : [
                    'PREPARER',
                    'REVIEWER'
                  ]
            )
          ),

        createdBy:
          input.createdBy,

        createdAt:
          timestamp,

        updatedAt:
          timestamp,

        requiresProfessionalReview:
          professionalReview,

        blocksWorkflow,

        immutableAuditRequired:
          true
      };

    this.records.set(
      record.exceptionId,
      record
    );

    this.appendAudit({
      exceptionId:
        record.exceptionId,

      action:
        'CREATED',

      actorId:
        input.createdBy,

      newStatus:
        'OPEN'
    });

    return this.cloneRecord(
      record
    );
  }

  get(
    exceptionId: string
  ):
    TaxGuardExceptionRecord {

    const record =
      this.records.get(
        exceptionId
      );

    if (!record) {
      throw new Error(
        'TG_EXCEPTION_NOT_FOUND'
      );
    }

    return this.cloneRecord(
      record
    );
  }

  list():
    readonly TaxGuardExceptionRecord[] {

    return [
      ...this.records.values()
    ].map(
      record =>
        this.cloneRecord(
          record
        )
    );
  }

  listOpen():
    readonly TaxGuardExceptionRecord[] {

    return this.list()
      .filter(
        record =>
          record.status !==
            'RESOLVED' &&
          record.status !==
            'CLOSED'
      );
  }

  listBlocking():
    readonly TaxGuardExceptionRecord[] {

    return this.listOpen()
      .filter(
        record =>
          record.blocksWorkflow
      );
  }

  auditHistory(
    exceptionId?: string
  ):
    readonly TaxGuardExceptionAuditEntry[] {

    return this.auditEntries
      .filter(
        entry =>
          !exceptionId ||
          entry.exceptionId ===
            exceptionId
      )
      .map(
        entry => ({
          ...entry
        })
      );
  }

  private appendAudit(
    input: {
      exceptionId: string;

      action:
        TaxGuardExceptionAuditEntry[
          'action'
        ];

      actorId: string;

      actorRole?:
        TaxGuardProfessionalRole;

      reason?: string;

      priorStatus?:
        TaxGuardExceptionStatus;

      newStatus:
        TaxGuardExceptionStatus;
    }
  ):
    void {

    const entry:
      TaxGuardExceptionAuditEntry = {
        auditId:
          'TG-AUD-' +
          String(
            this.auditEntries.length +
            1
          ).padStart(
            8,
            '0'
          ),

        exceptionId:
          input.exceptionId,

        action:
          input.action,

        actorId:
          input.actorId,

        actorRole:
          input.actorRole,

        timestamp:
          now(),

        reason:
          input.reason,

        priorStatus:
          input.priorStatus,

        newStatus:
          input.newStatus,

        immutable:
          true
      };

    this.auditEntries.push(
      Object.freeze({
        ...entry
      })
    );
  }

  private cloneRecord(
    record:
      TaxGuardExceptionRecord
  ):
    TaxGuardExceptionRecord {

    return {
      ...record,

      evidence:
        cloneEvidence(
          record.evidence
        ),

      requiredRoles: [
        ...record.requiredRoles
      ]
    };
  }
}
