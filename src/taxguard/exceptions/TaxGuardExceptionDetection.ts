
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
    'CPA',
    'EA',
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
