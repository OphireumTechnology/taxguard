/////JavaScipt - Ophireum Multimedia Productions


import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function write(rel, content) {
  const target = path.join(ROOT, rel);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true }
  );

  fs.writeFileSync(
    target,
    content,
    'utf8'
  );

  console.log(
    'WROTE ' + rel
  );
}

write(
  'src/taxguard/exceptions/TaxGuardExceptionProfessionalReview.ts',
  String.raw`
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
`
);

/////JavaScipt - Ophireum Multimedia Productions


write(
  'src/taxguard/exceptions/TaxGuardExceptionWorkflow.ts',
  String.raw`
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
      TaxGuardProfessionalRole[] =
        [
          ...new Set<TaxGuardProfessionalRole>([
            ...current
              .requiredRoles,

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
`
);

/////// M9 Part 3 of 4 — Detectors, Routing and Hard Workflow Gate


write(
  'src/taxguard/exceptions/TaxGuardExceptionDetection.ts',
  String.raw`
import type {
  TaxGuardExceptionContext,
  TaxGuardExceptionRecord,
  TaxGuardProfessionalRole
} from './TaxGuardExceptionProfessionalReview';

import {
  TaxGuardExceptionRegistry
} from './TaxGuardExceptionProfessionalReview';

export interface TaxGuardMissingInformationInput {
  exceptionId: string;
  context: TaxGuardExceptionContext;
  factPath: string;
  createdBy: string;
  sourceModule: string;
  sourceRecordId?: string;
}

export interface TaxGuardLowConfidenceInput {
  exceptionId: string;
  context: TaxGuardExceptionContext;
  fieldName: string;
  confidence: number;
  minimumConfidence: number;
  createdBy: string;
  sourceModule: string;
  sourceRecordId?: string;
  evidenceId?: string;
}

export interface TaxGuardConflictingDataInput {
  exceptionId: string;
  context: TaxGuardExceptionContext;
  factPath: string;
  leftValue: string;
  rightValue: string;
  createdBy: string;
  sourceModule: string;
  sourceRecordId?: string;
  evidenceIds?: readonly string[];
}

export class TaxGuardExceptionDetectionEngine {

  constructor(
    private readonly registry:
      TaxGuardExceptionRegistry
  ) {}

  missingInformation(
    input:
      TaxGuardMissingInformationInput
  ):
    TaxGuardExceptionRecord {

    if (!input.factPath.trim()) {
      throw new Error(
        'TG_EXCEPTION_FACT_PATH_REQUIRED'
      );
    }

    return this.registry.create({
      exceptionId:
        input.exceptionId,

      type:
        'MISSING_INFORMATION',

      risk:
        'material',

      context:
        input.context,

      title:
        'Missing required information',

      description:
        'Required validated information is missing for ' +
        input.factPath +
        '.',

      sourceModule:
        input.sourceModule,

      sourceRecordId:
        input.sourceRecordId,

      requiredRoles: [
        'PREPARER',
        'REVIEWER'
      ],

      createdBy:
        input.createdBy,

      requiresProfessionalReview:
        true,

      blocksWorkflow:
        true
    });
  }

  lowConfidence(
    input:
      TaxGuardLowConfidenceInput
  ):
    TaxGuardExceptionRecord | null {

    if (
      !Number.isFinite(
        input.confidence
      ) ||
      !Number.isFinite(
        input.minimumConfidence
      ) ||
      input.confidence < 0 ||
      input.confidence > 1 ||
      input.minimumConfidence < 0 ||
      input.minimumConfidence > 1
    ) {
      throw new Error(
        'TG_EXCEPTION_INVALID_CONFIDENCE'
      );
    }

    if (
      input.confidence >=
        input.minimumConfidence
    ) {
      return null;
    }

    return this.registry.create({
      exceptionId:
        input.exceptionId,

      type:
        'LOW_CONFIDENCE',

      risk:
        'material',

      context:
        input.context,

      title:
        'Low-confidence extracted value',

      description:
        'Field ' +
        input.fieldName +
        ' has confidence ' +
        String(
          input.confidence
        ) +
        ', below required threshold ' +
        String(
          input.minimumConfidence
        ) +
        '.',

      sourceModule:
        input.sourceModule,

      sourceRecordId:
        input.sourceRecordId,

      evidence:
        input.evidenceId
          ? [
              {
                evidenceId:
                  input.evidenceId,

                description:
                  'Evidence associated with low-confidence extraction.'
              }
            ]
          : [],

      requiredRoles: [
        'PREPARER',
        'REVIEWER'
      ],

      createdBy:
        input.createdBy,

      requiresProfessionalReview:
        true,

      blocksWorkflow:
        true
    });
  }

  conflictingData(
    input:
      TaxGuardConflictingDataInput
  ):
    TaxGuardExceptionRecord | null {

    if (!input.factPath.trim()) {
      throw new Error(
        'TG_EXCEPTION_FACT_PATH_REQUIRED'
      );
    }

    if (
      input.leftValue ===
      input.rightValue
    ) {
      return null;
    }

    return this.registry.create({
      exceptionId:
        input.exceptionId,

      type:
        'CONFLICTING_DATA',

      risk:
        'material',

      context:
        input.context,

      title:
        'Conflicting validated data',

      description:
        'Conflicting values were detected for ' +
        input.factPath +
        '.',

      sourceModule:
        input.sourceModule,

      sourceRecordId:
        input.sourceRecordId,

      evidence:
        (
          input.evidenceIds ??
          []
        ).map(
          evidenceId => ({
            evidenceId,

            factPath:
              input.factPath,

            description:
              'Evidence participating in conflicting-data review.'
          })
        ),

      requiredRoles: [
        'REVIEWER',
        'CPA',
        'EA'
      ],

      createdBy:
        input.createdBy,

      requiresProfessionalReview:
        true,

      blocksWorkflow:
        true
    });
  }
}

export interface TaxGuardReviewRoute {
  exceptionId: string;
  eligibleRoles:
    readonly TaxGuardProfessionalRole[];
  professionalReviewRequired:
    boolean;
  blocksWorkflow:
    boolean;
}

export class TaxGuardProfessionalReviewRouter {

  static route(
    record:
      TaxGuardExceptionRecord
  ):
    TaxGuardReviewRoute {

    let eligibleRoles:
      TaxGuardProfessionalRole[] =
        [
          ...record.requiredRoles
        ];

    if (
      record.risk ===
        'critical'
    ) {
     eligibleRoles = [
        ...new Set<TaxGuardProfessionalRole>([
          ...eligibleRoles,
          'CPA',
          'EA',
          'ADMIN'
        ])
      ];
    }

    if (
      record.type ===
        'SECURITY_EXCEPTION'
    ) {
      eligibleRoles = [
        ...new Set<TaxGuardProfessionalRole>([
          ...eligibleRoles,
          'SEC_OPS',
          'ADMIN'
        ])
      ];
    }

    return {
      exceptionId:
        record.exceptionId,

      eligibleRoles,

      professionalReviewRequired:
        record
          .requiresProfessionalReview,

      blocksWorkflow:
        record.blocksWorkflow
    };
  }
}

export interface TaxGuardWorkflowGateResult {
  allowed: boolean;
  blockingExceptionIds:
    readonly string[];
  reasons:
    readonly string[];
}

export class TaxGuardExceptionWorkflowGate {

  static evaluate(
    registry:
      TaxGuardExceptionRegistry
  ):
    TaxGuardWorkflowGateResult {

    const blocking =
      registry.listBlocking();

    if (
      blocking.length === 0
    ) {
      return {
        allowed:
          true,

        blockingExceptionIds:
          [],

        reasons:
          []
      };
    }

    return {
      allowed:
        false,

      blockingExceptionIds:
        blocking.map(
          record =>
            record.exceptionId
        ),

      reasons:
        blocking.map(
          record =>
            record.type +
            ':' +
            record.exceptionId
        )
    };
  }

  static assertAllowed(
    registry:
      TaxGuardExceptionRegistry
  ):
    true {

    const result =
      this.evaluate(
        registry
      );

    if (!result.allowed) {
      throw new Error(
        'TG_EXCEPTION_WORKFLOW_BLOCKED:' +
        result
          .blockingExceptionIds
          .join(',')
      );
    }

    return true;
  }
}
`
);

write(
  'src/taxguard/exceptions/index.ts',
  String.raw`
export * from './TaxGuardExceptionProfessionalReview';
export * from './TaxGuardExceptionWorkflow';
export * from './TaxGuardExceptionDetection';
`
);


/////////

write(
  'src/tests/taxGuardExceptionProfessionalReview.test.ts',
  String.raw`
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardExceptionRegistry
} from '../taxguard/exceptions/TaxGuardExceptionProfessionalReview';

import {
  TaxGuardExceptionWorkflow
} from '../taxguard/exceptions/TaxGuardExceptionWorkflow';

import {
  TaxGuardExceptionDetectionEngine,
  TaxGuardExceptionWorkflowGate,
  TaxGuardProfessionalReviewRouter
} from '../taxguard/exceptions/TaxGuardExceptionDetection';

function context() {
  return {
    clientId:
      'CLIENT-M9-001',

    engagementId:
      'ENGAGEMENT-M9-001',

    taxYear:
      2025,

    correlationId:
      'CORRELATION-M9-001'
  };
}

describe(
  'TaxGuard M9 Exceptions and Professional Review',
  () => {

    it(
      'M9.1 creates a blocking missing-information exception',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        const detector =
          new TaxGuardExceptionDetectionEngine(
            registry
          );

        const record =
          detector.missingInformation({
            exceptionId:
              'EX-MISSING-1',

            context:
              context(),

            factPath:
              'taxpayer.w2.wages',

            createdBy:
              'PREPARER-A',

            sourceModule:
              'STAGE_03_VALIDATE'
          });

        expect(
          record.type
        ).toBe(
          'MISSING_INFORMATION'
        );

        expect(
          record.status
        ).toBe(
          'OPEN'
        );

        expect(
          record.blocksWorkflow
        ).toBe(true);

        expect(
          record
            .requiresProfessionalReview
        ).toBe(true);
      }
    );

    it(
      'M9.2 creates low-confidence exception below threshold',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        const detector =
          new TaxGuardExceptionDetectionEngine(
            registry
          );

        const record =
          detector.lowConfidence({
            exceptionId:
              'EX-CONFIDENCE-1',

            context:
              context(),

            fieldName:
              'W2 Box 1',

            confidence:
              0.72,

            minimumConfidence:
              0.90,

            createdBy:
              'PREPARER-A',

            sourceModule:
              'DOCUMENT_INTELLIGENCE',

            evidenceId:
              'EVIDENCE-W2-1'
          });

        expect(
          record
        ).not.toBeNull();

        expect(
          record?.type
        ).toBe(
          'LOW_CONFIDENCE'
        );

        expect(
          record?.blocksWorkflow
        ).toBe(true);
      }
    );

    it(
      'M9.3 does not create exception when confidence meets threshold',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        const detector =
          new TaxGuardExceptionDetectionEngine(
            registry
          );

        const record =
          detector.lowConfidence({
            exceptionId:
              'EX-CONFIDENCE-2',

            context:
              context(),

            fieldName:
              'W2 Box 1',

            confidence:
              0.98,

            minimumConfidence:
              0.90,

            createdBy:
              'PREPARER-A',

            sourceModule:
              'DOCUMENT_INTELLIGENCE'
          });

        expect(
          record
        ).toBeNull();

        expect(
          registry.list()
        ).toHaveLength(0);
      }
    );

    it(
      'M9.4 detects conflicting data',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        const detector =
          new TaxGuardExceptionDetectionEngine(
            registry
          );

        const record =
          detector.conflictingData({
            exceptionId:
              'EX-CONFLICT-1',

            context:
              context(),

            factPath:
              'taxpayer.w2.wages',

            leftValue:
              '50000.00',

            rightValue:
              '51000.00',

            createdBy:
              'PREPARER-A',

            sourceModule:
              'VALIDATION_ENGINE',

            evidenceIds: [
              'EVIDENCE-1',
              'EVIDENCE-2'
            ]
          });

        expect(
          record
        ).not.toBeNull();

        expect(
          record?.type
        ).toBe(
          'CONFLICTING_DATA'
        );

        expect(
          record?.requiredRoles
        ).toContain(
          'REVIEWER'
        );
      }
    );

    it(
      'M9.5 prevents unauthorized role assignment',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        registry.create({
          exceptionId:
            'EX-ROLE-1',

          type:
            'PROFESSIONAL_REVIEW_REQUIRED',

          risk:
            'material',

          context:
            context(),

          title:
            'Professional review',

          description:
            'Professional review required.',

          sourceModule:
            'PREPARATION',

          requiredRoles: [
            'REVIEWER',
            'CPA',
            'EA'
          ],

          createdBy:
            'PREPARER-A',

          requiresProfessionalReview:
            true,

          blocksWorkflow:
            true
        });

        const workflow =
          new TaxGuardExceptionWorkflow(
            registry
          );

        expect(
          () =>
            workflow.assign({
              exceptionId:
                'EX-ROLE-1',

              assignedTo:
                'PREPARER-B',

              assignedRole:
                'PREPARER',

              assignedBy:
                'ADMIN-A'
            })
        ).toThrow(
          'TG_EXCEPTION_UNAUTHORIZED_ROLE'
        );
      }
    );

    it(
      'M9.6 enforces maker-checker separation',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        registry.create({
          exceptionId:
            'EX-MAKER-1',

          type:
            'PROFESSIONAL_REVIEW_REQUIRED',

          risk:
            'material',

          context:
            context(),

          title:
            'Material review',

          description:
            'Material tax decision requires review.',

          sourceModule:
            'PREPARATION',

          requiredRoles: [
            'REVIEWER',
            'CPA',
            'EA'
          ],

          createdBy:
            'REVIEWER-A',

          requiresProfessionalReview:
            true,

          blocksWorkflow:
            true
        });

        const workflow =
          new TaxGuardExceptionWorkflow(
            registry
          );

        workflow.assign({
          exceptionId:
            'EX-MAKER-1',

          assignedTo:
            'REVIEWER-A',

          assignedRole:
            'REVIEWER',

          assignedBy:
            'ADMIN-A'
        });

        workflow.startReview(
          'EX-MAKER-1',
          'REVIEWER-A',
          'REVIEWER'
        );

        expect(
          () =>
            workflow.resolve({
              exceptionId:
                'EX-MAKER-1',

              resolvedBy:
                'REVIEWER-A',

              resolvedByRole:
                'REVIEWER',

              disposition:
                'PROFESSIONAL_APPROVED',

              resolutionNote:
                'Attempted self-approval.'
            })
        ).toThrow(
          'TG_EXCEPTION_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M9.7 allows independent professional resolution',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        registry.create({
          exceptionId:
            'EX-RESOLVE-1',

          type:
            'PROFESSIONAL_REVIEW_REQUIRED',

          risk:
            'material',

          context:
            context(),

          title:
            'Independent review',

          description:
            'Independent professional approval required.',

          sourceModule:
            'PREPARATION',

          requiredRoles: [
            'REVIEWER',
            'CPA',
            'EA'
          ],

          createdBy:
            'PREPARER-A',

          requiresProfessionalReview:
            true,

          blocksWorkflow:
            true
        });

        const workflow =
          new TaxGuardExceptionWorkflow(
            registry
          );

        workflow.assign({
          exceptionId:
            'EX-RESOLVE-1',

          assignedTo:
            'REVIEWER-B',

          assignedRole:
            'REVIEWER',

          assignedBy:
            'ADMIN-A'
        });

        workflow.startReview(
          'EX-RESOLVE-1',
          'REVIEWER-B',
          'REVIEWER'
        );

        const resolved =
          workflow.resolve({
            exceptionId:
              'EX-RESOLVE-1',

            resolvedBy:
              'REVIEWER-B',

            resolvedByRole:
              'REVIEWER',

            disposition:
              'PROFESSIONAL_APPROVED',

            resolutionNote:
              'Evidence and tax treatment reviewed.'
          });

        expect(
          resolved.status
        ).toBe(
          'RESOLVED'
        );

        expect(
          resolved.blocksWorkflow
        ).toBe(false);
      }
    );

    it(
      'M9.8 blocks workflow while blocking exception remains open',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        const detector =
          new TaxGuardExceptionDetectionEngine(
            registry
          );

        detector.missingInformation({
          exceptionId:
            'EX-GATE-1',

          context:
            context(),

          factPath:
            'taxpayer.filingStatus',

          createdBy:
            'PREPARER-A',

          sourceModule:
            'VALIDATION'
        });

        const result =
          TaxGuardExceptionWorkflowGate
            .evaluate(
              registry
            );

        expect(
          result.allowed
        ).toBe(false);

        expect(
          result
            .blockingExceptionIds
        ).toContain(
          'EX-GATE-1'
        );
      }
    );

    it(
      'M9.9 permits workflow after independent resolution',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        registry.create({
          exceptionId:
            'EX-GATE-2',

          type:
            'PROFESSIONAL_REVIEW_REQUIRED',

          risk:
            'material',

          context:
            context(),

          title:
            'Review required',

          description:
            'Review before progression.',

          sourceModule:
            'PREPARATION',

          requiredRoles: [
            'REVIEWER'
          ],

          createdBy:
            'PREPARER-A',

          requiresProfessionalReview:
            true,

          blocksWorkflow:
            true
        });

        const workflow =
          new TaxGuardExceptionWorkflow(
            registry
          );

        workflow.assign({
          exceptionId:
            'EX-GATE-2',

          assignedTo:
            'REVIEWER-B',

          assignedRole:
            'REVIEWER',

          assignedBy:
            'ADMIN-A'
        });

        workflow.startReview(
          'EX-GATE-2',
          'REVIEWER-B',
          'REVIEWER'
        );

        workflow.resolve({
          exceptionId:
            'EX-GATE-2',

          resolvedBy:
            'REVIEWER-B',

          resolvedByRole:
            'REVIEWER',

          disposition:
            'PROFESSIONAL_APPROVED',

          resolutionNote:
            'Approved after independent review.'
        });

        expect(
          TaxGuardExceptionWorkflowGate
            .evaluate(
              registry
            )
            .allowed
        ).toBe(true);
      }
    );

    it(
      'M9.10 escalates exception and requires professional review',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        registry.create({
          exceptionId:
            'EX-ESCALATE-1',

          type:
            'OTHER',

          risk:
            'routine',

          context:
            context(),

          title:
            'Routine exception',

          description:
            'Routine exception requiring escalation test.',

          sourceModule:
            'OPERATIONS',

          createdBy:
            'PREPARER-A',

          blocksWorkflow:
            false
        });

        const workflow =
          new TaxGuardExceptionWorkflow(
            registry
          );

        const escalated =
          workflow.escalate({
            exceptionId:
              'EX-ESCALATE-1',

            escalatedBy:
              'PREPARER-A',

            reason:
              'Material tax impact discovered.'
          });

        expect(
          escalated.status
        ).toBe(
          'ESCALATED'
        );

        expect(
          escalated.risk
        ).toBe(
          'material'
        );

        expect(
          escalated
            .requiresProfessionalReview
        ).toBe(true);

        expect(
          escalated.blocksWorkflow
        ).toBe(true);
      }
    );

    it(
      'M9.11 reopens a resolved exception and restores hard gate',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        registry.create({
          exceptionId:
            'EX-REOPEN-1',

          type:
            'PROFESSIONAL_REVIEW_REQUIRED',

          risk:
            'material',

          context:
            context(),

          title:
            'Review',

          description:
            'Review and reopen test.',

          sourceModule:
            'PREPARATION',

          requiredRoles: [
            'REVIEWER'
          ],

          createdBy:
            'PREPARER-A',

          requiresProfessionalReview:
            true,

          blocksWorkflow:
            true
        });

        const workflow =
          new TaxGuardExceptionWorkflow(
            registry
          );

        workflow.assign({
          exceptionId:
            'EX-REOPEN-1',

          assignedTo:
            'REVIEWER-B',

          assignedRole:
            'REVIEWER',

          assignedBy:
            'ADMIN-A'
        });

        workflow.resolve({
          exceptionId:
            'EX-REOPEN-1',

          resolvedBy:
            'REVIEWER-B',

          resolvedByRole:
            'REVIEWER',

          disposition:
            'PROFESSIONAL_APPROVED',

          resolutionNote:
            'Initially resolved.'
        });

        const reopened =
          workflow.reopen({
            exceptionId:
              'EX-REOPEN-1',

            reopenedBy:
              'REVIEWER-C',

            reason:
              'New conflicting evidence received.'
          });

        expect(
          reopened.status
        ).toBe(
          'REOPENED'
        );

        expect(
          reopened.blocksWorkflow
        ).toBe(true);

        expect(
          TaxGuardExceptionWorkflowGate
            .evaluate(
              registry
            )
            .allowed
        ).toBe(false);
      }
    );

    it(
      'M9.12 preserves exception audit history',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        registry.create({
          exceptionId:
            'EX-AUDIT-1',

          type:
            'OTHER',

          risk:
            'routine',

          context:
            context(),

          title:
            'Audit test',

          description:
            'Audit history test.',

          sourceModule:
            'OPERATIONS',

          requiredRoles: [
            'PREPARER'
          ],

          createdBy:
            'PREPARER-A',

          blocksWorkflow:
            false
        });

        const workflow =
          new TaxGuardExceptionWorkflow(
            registry
          );

        workflow.assign({
          exceptionId:
            'EX-AUDIT-1',

          assignedTo:
            'PREPARER-B',

          assignedRole:
            'PREPARER',

          assignedBy:
            'ADMIN-A'
        });

        const history =
          registry.auditHistory(
            'EX-AUDIT-1'
          );

        expect(
          history.length
        ).toBeGreaterThanOrEqual(
          2
        );

        expect(
          history[0].action
        ).toBe(
          'CREATED'
        );

        expect(
          history.every(
            entry =>
              entry.immutable ===
              true
          )
        ).toBe(true);
      }
    );

    it(
      'M9.13 routes critical exceptions to senior authorized roles',
      () => {

        const registry =
          new TaxGuardExceptionRegistry();

        const record =
          registry.create({
            exceptionId:
              'EX-CRITICAL-1',

            type:
              'CALCULATION_EXCEPTION',

            risk:
              'critical',

            context:
              context(),

            title:
              'Critical calculation exception',

            description:
              'Critical calculation review required.',

            sourceModule:
              'CALCULATION_ENGINE',

            requiredRoles: [
              'REVIEWER'
            ],

            createdBy:
              'PREPARER-A',

            requiresProfessionalReview:
              true,

            blocksWorkflow:
              true
          });

        const route =
          TaxGuardProfessionalReviewRouter
            .route(
              record
            );

        expect(
          route.eligibleRoles
        ).toContain(
          'CPA'
        );

        expect(
          route.eligibleRoles
        ).toContain(
          'EA'
        );

        expect(
          route.eligibleRoles
        ).toContain(
          'ADMIN'
        );
      }
    );
  }
);
`
);

console.log('');
console.log(
  '=============================================='
);

console.log(
  'TaxGuard M9 source generated successfully.'
);

console.log(
  '=============================================='
);

console.log(
  'Created:'
);

console.log(
  'src/taxguard/exceptions/TaxGuardExceptionProfessionalReview.ts'
);

console.log(
  'src/taxguard/exceptions/TaxGuardExceptionWorkflow.ts'
);

console.log(
  'src/taxguard/exceptions/TaxGuardExceptionDetection.ts'
);

console.log(
  'src/taxguard/exceptions/index.ts'
);

console.log(
  'src/tests/taxGuardExceptionProfessionalReview.test.ts'
);

console.log('');
console.log(
  'M1-M8 source was not modified.'
);

console.log(
  'External tax filing remains DISABLED.'
);



