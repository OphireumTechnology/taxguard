
import {
  describe,
  expect,
  it
} from 'vitest';

import {
  TaxGuardExternalFilingGuard,
  TaxGuardReturnWorkflowEngine
} from '../taxguard/workflow/TaxGuardReturnWorkflow';

import {
  TaxGuardConsentRegistry,
  TaxGuardControlledWorkflowService,
  TaxGuardReturnVersionRegistry,
  TaxGuardSignatureRegistry,
  TaxGuardTaxpayerReviewRegistry,
  TaxGuardWorkflowReadinessGuard
} from '../taxguard/workflow/TaxGuardWorkflowControls';

import {
  TaxGuardAiWorkflowBoundary,
  TaxGuardExceptionWorkflowGate,
  TaxGuardFinalInternalApprovalRegistry,
  TaxGuardFinalWorkflowGate,
  TaxGuardProfessionalReviewRegistry
} from '../taxguard/workflow/TaxGuardWorkflowGovernance';

function context() {
  return {
    clientId:
      'CLIENT-M11-001',

    engagementId:
      'ENGAGEMENT-M11-001',

    taxYear:
      2025,

    correlationId:
      'CORRELATION-M11-001',

    returnId:
      'RETURN-M11-001'
  };
}

function createWorkflow() {

  const workflows =
    new TaxGuardReturnWorkflowEngine();

  const workflow =
    workflows.create({
      workflowId:
        'WORKFLOW-M11-001',

      context:
        context(),

      createdBy:
        'PREPARER-A',

      createdByRole:
        'PREPARER'
    });

  return {
    workflows,
    workflow
  };
}

function advanceToFinalInternalApproval(
  workflows:
    TaxGuardReturnWorkflowEngine
) {

  const controlled =
    new TaxGuardControlledWorkflowService(
      workflows
    );

  const steps = [
    {
      stage:
        'PREPARATION' as const,

      role:
        'PREPARER' as const
    },
    {
      stage:
        'EXCEPTION_REVIEW' as const,

      role:
        'REVIEWER' as const
    },
    {
      stage:
        'PROFESSIONAL_REVIEW' as const,

      role:
        'CPA' as const
    },
    {
      stage:
        'TAXPAYER_REVIEW' as const,

      role:
        'TAXPAYER' as const
    },
    {
      stage:
        'AUTHORIZATION_CONSENT' as const,

      role:
        'TAXPAYER' as const
    },
    {
      stage:
        'RETURN_VERSION_REVIEW' as const,

      role:
        'REVIEWER' as const
    },
    {
      stage:
        'SIGNATURE_CONSENT' as const,

      role:
        'TAXPAYER' as const
    },
    {
      stage:
        'READINESS_REVIEW' as const,

      role:
        'REVIEWER' as const
    }
  ];

  for (
    const [
      index,
      step
    ] of steps.entries()
  ) {
    controlled.advance(
      'WORKFLOW-M11-001',
      {
        expectedStage:
          step.stage,

        actorId:
          'ACTOR-' +
          String(index + 1),

        actorRole:
          step.role,

        allowedRoles: [
          step.role
        ],

        evidenceIds: [
          'EVIDENCE-' +
          String(index + 1)
        ],

        provenanceDecisionIds: [
          'PROVENANCE-' +
          String(index + 1)
        ]
      }
    );
  }

  return workflows.get(
    'WORKFLOW-M11-001'
  );
}

describe(
  'TaxGuard M11 Remaining Tax Workflow',
  () => {

    it(
      'M11.1 creates workflow at preparation stage',
      () => {

        const {
          workflow
        } =
          createWorkflow();

        expect(
          workflow.currentStage
        ).toBe(
          'PREPARATION'
        );

        expect(
          workflow.externalFilingEnabled
        ).toBe(false);
      }
    );

    it(
      'M11.2 advances workflow sequentially',
      () => {

        const {
          workflows
        } =
          createWorkflow();

        const controlled =
          new TaxGuardControlledWorkflowService(
            workflows
          );

        const updated =
          controlled.advance(
            'WORKFLOW-M11-001',
            {
              expectedStage:
                'PREPARATION',

              actorId:
                'PREPARER-A',

              actorRole:
                'PREPARER',

              allowedRoles: [
                'PREPARER'
              ]
            }
          );

        expect(
          updated.currentStage
        ).toBe(
          'EXCEPTION_REVIEW'
        );
      }
    );

    it(
      'M11.3 blocks unauthorized workflow role',
      () => {

        const {
          workflows
        } =
          createWorkflow();

        const controlled =
          new TaxGuardControlledWorkflowService(
            workflows
          );

        expect(
          () =>
            controlled.advance(
              'WORKFLOW-M11-001',
              {
                expectedStage:
                  'PREPARATION',

                actorId:
                  'TAXPAYER-A',

                actorRole:
                  'TAXPAYER',

                allowedRoles: [
                  'PREPARER'
                ]
              }
            )
        ).toThrow(
          'TG_WORKFLOW_ROLE_NOT_AUTHORIZED'
        );
      }
    );

    it(
      'M11.4 blocks unresolved exceptions',
      () => {

        expect(
          () =>
            TaxGuardExceptionWorkflowGate
              .assertClear({
                unresolvedExceptionIds: [
                  'EXCEPTION-1'
                ]
              })
        ).toThrow(
          'TG_WORKFLOW_EXCEPTION_GATE_BLOCKED'
        );
      }
    );

    it(
      'M11.5 records immutable return version',
      () => {

        const versions =
          new TaxGuardReturnVersionRegistry();

        const version =
          versions.create({
            versionId:
              'VERSION-1',

            context:
              context(),

            versionNumber:
              1,

            contentHash:
              'sha256-return-v1',

            preparedReturnId:
              'PREPARED-RETURN-1',

            createdBy:
              'PREPARER-A'
          });

        expect(
          version.locked
        ).toBe(true);

        expect(
          version.immutable
        ).toBe(true);
      }
    );

    it(
      'M11.6 records taxpayer acceptance for exact return version',
      () => {

        const reviews =
          new TaxGuardTaxpayerReviewRegistry();

        reviews.record({
          reviewId:
            'REVIEW-1',

          context:
            context(),

          returnVersionId:
            'VERSION-1',

          taxpayerId:
            'TAXPAYER-1',

          status:
            'ACCEPTED'
        });

        expect(
          reviews.acceptedForVersion(
            context(),
            'VERSION-1'
          )
        ).toBe(true);

        expect(
          reviews.acceptedForVersion(
            context(),
            'VERSION-2'
          )
        ).toBe(false);
      }
    );

    it(
      'M11.7 records explicit filing authorization consent',
      () => {

        const consents =
          new TaxGuardConsentRegistry();

        consents.record({
          consentId:
            'CONSENT-1',

          context:
            context(),

          consentType:
            'FILING_AUTHORIZATION',

          status:
            'GRANTED',

          taxpayerId:
            'TAXPAYER-1',

          returnVersionId:
            'VERSION-1',

          recordedBy:
            'TAXPAYER-1'
        });

        expect(
          consents.hasGrantedConsent(
            context(),
            'FILING_AUTHORIZATION',
            'VERSION-1'
          )
        ).toBe(true);
      }
    );

    it(
      'M11.8 binds signature to return version and consent',
      () => {

        const signatures =
          new TaxGuardSignatureRegistry();

        signatures.record({
          signatureId:
            'SIGNATURE-1',

          context:
            context(),

          taxpayerId:
            'TAXPAYER-1',

          returnVersionId:
            'VERSION-1',

          consentId:
            'CONSENT-SIGN-1',

          signatureMethod:
            'ELECTRONIC',

          recordedBy:
            'TAXPAYER-1'
        });

        expect(
          signatures.existsForVersion(
            context(),
            'VERSION-1'
          )
        ).toBe(true);
      }
    );

    it(
      'M11.9 enforces maker-checker professional review',
      () => {

        const approvals =
          new TaxGuardProfessionalReviewRegistry();

        expect(
          () =>
            approvals.approve({
              approvalId:
                'PROF-1',

              context:
                context(),

              returnVersionId:
                'VERSION-1',

              requestedBy:
                'CPA-A',

              approvedBy:
                'CPA-A',

              approvedByRole:
                'CPA',

              provenanceDecisionId:
                'DECISION-1'
            })
        ).toThrow(
          'TG_PROFESSIONAL_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M11.10 records independent professional approval',
      () => {

        const approvals =
          new TaxGuardProfessionalReviewRegistry();

        const approval =
          approvals.approve({
            approvalId:
              'PROF-2',

            context:
              context(),

            returnVersionId:
              'VERSION-1',

            requestedBy:
              'PREPARER-A',

            approvedBy:
              'EA-B',

            approvedByRole:
              'EA',

            provenanceDecisionId:
              'DECISION-1'
          });

        expect(
          approval.approvedBy
        ).toBe(
          'EA-B'
        );

        expect(
          approval.immutable
        ).toBe(true);
      }
    );

    it(
      'M11.11 fails readiness when required controls are missing',
      () => {

        const {
          workflow
        } =
          createWorkflow();

        const result =
          TaxGuardWorkflowReadinessGuard
            .evaluate({
              workflow,

              latestVersion: {
                versionId:
                  'VERSION-1',

                context:
                  context(),

                versionNumber:
                  1,

                contentHash:
                  'hash',

                preparedReturnId:
                  'PREPARED-1',

                createdBy:
                  'PREPARER-A',

                createdAt:
                  new Date()
                    .toISOString(),

                locked:
                  true,

                immutable:
                  true
              },

              taxpayerReviewAccepted:
                false,

              filingAuthorizationGranted:
                false,

              signatureConsentGranted:
                false,

              signatureExists:
                false,

              unresolvedExceptionIds: [
                'EXCEPTION-1'
              ],

              provenanceApproved:
                false,

              professionalReviewApproved:
                false
            });

        expect(
          result.ready
        ).toBe(false);

        expect(
          result.reasons
        ).toContain(
          'TAXPAYER_REVIEW_REQUIRED'
        );

        expect(
          result.reasons
        ).toContain(
          'UNRESOLVED_EXCEPTIONS'
        );
      }
    );

    it(
      'M11.12 permits readiness when all required controls pass',
      () => {

        const {
          workflow
        } =
          createWorkflow();

        const result =
          TaxGuardWorkflowReadinessGuard
            .evaluate({
              workflow,

              latestVersion: {
                versionId:
                  'VERSION-1',

                context:
                  context(),

                versionNumber:
                  1,

                contentHash:
                  'hash',

                preparedReturnId:
                  'PREPARED-1',

                createdBy:
                  'PREPARER-A',

                createdAt:
                  new Date()
                    .toISOString(),

                locked:
                  true,

                immutable:
                  true
              },

              taxpayerReviewAccepted:
                true,

              filingAuthorizationGranted:
                true,

              signatureConsentGranted:
                true,

              signatureExists:
                true,

              unresolvedExceptionIds: [],

              provenanceApproved:
                true,

              professionalReviewApproved:
                true
            });

        expect(
          result.ready
        ).toBe(true);
      }
    );

    it(
      'M11.13 requires final internal approval stage',
      () => {

        const {
          workflows
        } =
          createWorkflow();

        const workflow =
          advanceToFinalInternalApproval(
            workflows
          );

        expect(
          workflow.currentStage
        ).toBe(
          'FINAL_INTERNAL_APPROVAL'
        );

        const approvals =
          new TaxGuardProfessionalReviewRegistry();

        const approval =
          approvals.approve({
            approvalId:
              'PROF-FINAL',

            context:
              context(),

            returnVersionId:
              'VERSION-1',

            requestedBy:
              'PREPARER-A',

            approvedBy:
              'CPA-B',

            approvedByRole:
              'CPA',

            provenanceDecisionId:
              'DECISION-FINAL'
          });

        const result =
          TaxGuardFinalWorkflowGate
            .evaluate({
              workflow,

              returnVersionId:
                'VERSION-1',

              taxpayerReviewAccepted:
                true,

              filingAuthorizationGranted:
                true,

              signatureConsentGranted:
                true,

              signatureExists:
                true,

              unresolvedExceptionIds: [],

              provenanceApproved:
                true,

              professionalReviewApproved:
                true,

              professionalApproval:
                approval
            });

        expect(
          result.allowed
        ).toBe(true);
      }
    );

    it(
      'M11.14 enforces maker-checker final internal approval',
      () => {

        const professional =
          new TaxGuardProfessionalReviewRegistry();

        const professionalApproval =
          professional.approve({
            approvalId:
              'PROF-MAKER',

            context:
              context(),

            returnVersionId:
              'VERSION-1',

            requestedBy:
              'PREPARER-A',

            approvedBy:
              'CPA-B',

            approvedByRole:
              'CPA',

            provenanceDecisionId:
              'DECISION-1'
          });

        const finalApprovals =
          new TaxGuardFinalInternalApprovalRegistry();

        expect(
          () =>
            finalApprovals.approve({
              approvalId:
                'FINAL-1',

              context:
                context(),

              returnVersionId:
                'VERSION-1',

              professionalApproval,

              provenanceDecisionId:
                'DECISION-2',

              approvedBy:
                'CPA-B',

              approvedByRole:
                'CPA'
            })
        ).toThrow(
          'TG_FINAL_APPROVAL_MAKER_CHECKER_REQUIRED'
        );
      }
    );

    it(
      'M11.15 blocks AI final approval',
      () => {

        expect(
          () =>
            TaxGuardAiWorkflowBoundary
              .approveMaterialTaxDecision()
        ).toThrow(
          'TG_AI_FINAL_APPROVAL_BLOCKED'
        );
      }
    );

    it(
      'M11.16 keeps external tax filing disabled',
      () => {

        expect(
          () =>
            TaxGuardExternalFilingGuard
              .submit()
        ).toThrow(
          'TG_EXTERNAL_FILING_DISABLED'
        );
      }
    );
  }
);
