
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
