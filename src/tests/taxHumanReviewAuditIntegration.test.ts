import {
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  TaxHumanReviewAuditIntegration
} from '../taxguard/knowledge/TaxHumanReviewAuditIntegration';

import {
  HumanReviewBridge
} from '../taxguard/intelligence/review/HumanReviewBridge';

import {
  DecisionTraceLedger
} from '../taxguard/intelligence/trace/DecisionTraceLedger';

import {
  StageThreeValidationService
} from '../services/stageThreeValidationService';

import type {
  EvidencePackage
} from '../taxguard/intelligence/types';

describe(
  'M6.8 Human Review + Audit Integration',
  () => {

    const packageFixture:
      EvidencePackage = {

      evidencePackageId:
        'M6-8-EVP-001',

      clientId:
        'M6-8-CLIENT-001',

      engagementId:
        'M6-8-ENG-001',

      taxYear:
        2025,

      knowledgeSourceIds:
        ['M6-8-KS-001'],

      ruleEvaluationIds:
        ['M6-8-RULE-EVAL-001'],

      findingIds:
        ['M6-8-FINDING-001'],

      aiProposalIds:
        ['M6-8-AI-PROP-001'],

      requiresHumanReview:
        true,

      createdAt:
        '2026-09-23T00:00:00.000Z',

      correlationId:
        'M6-8-CORR-001'
    };

    beforeEach(() => {
      vi.restoreAllMocks();

      DecisionTraceLedger
        .clearAll();
    });

    it(
      'routes evidence through the existing HumanReviewBridge',
      () => {

        const submit =
          vi.spyOn(
            HumanReviewBridge,
            'submit'
          )
          .mockReturnValue({
            queueItemId:
              'M6-8-HRQ-001',

            evidencePackageId:
              packageFixture
                .evidencePackageId,

            requiresHumanReview:
              true,

            clientId:
              packageFixture.clientId,

            engagementId:
              packageFixture
                .engagementId,

            taxYear:
              packageFixture.taxYear
          } as ReturnType<
            typeof HumanReviewBridge.submit
          >);

        const result =
          TaxHumanReviewAuditIntegration
            .routeToHumanReview({
              evidencePackage:
                packageFixture,

              actorId:
                'reviewer-001',

              actorRole:
                'reviewer'
            });

        expect(submit)
          .toHaveBeenCalledTimes(1);

        expect(result.queueItemId)
          .toBe(
            'M6-8-HRQ-001'
          );

        expect(
          result
            .hasDecisionAuthority
        ).toBe(false);
      }
    );

    it(
      'creates a HUMAN_REVIEW decision trace',
      () => {

        vi.spyOn(
          HumanReviewBridge,
          'submit'
        )
        .mockReturnValue({
          queueItemId:
            'M6-8-HRQ-002',

          evidencePackageId:
            packageFixture
              .evidencePackageId,

          requiresHumanReview:
            true,

          clientId:
            packageFixture.clientId,

          engagementId:
            packageFixture
              .engagementId,

          taxYear:
            packageFixture.taxYear
        } as ReturnType<
          typeof HumanReviewBridge.submit
        >);

        const result =
          TaxHumanReviewAuditIntegration
            .routeToHumanReview({
              evidencePackage:
                packageFixture,

              actorId:
                'reviewer-001',

              actorRole:
                'reviewer',

              traceId:
                'M6-8-TRACE-001'
            });

        const trace =
          DecisionTraceLedger
            .getById(
              result.traceId
            );

        expect(trace)
          .not
          .toBeNull();

        expect(trace?.stage)
          .toBe(
            'HUMAN_REVIEW'
          );

        expect(
          trace
            ?.evidencePackageIds
        ).toContain(
          packageFixture
            .evidencePackageId
        );

        expect(
          trace?.correlationId
        ).toBe(
          packageFixture
            .correlationId
        );
      }
    );

    it(
      'blocks AI identity from acting as human reviewer',
      () => {

        expect(() =>
          TaxHumanReviewAuditIntegration
            .routeToHumanReview({
              evidencePackage:
                packageFixture,

              actorId:
                'ai-model-001',

              actorRole:
                'ai_model'
            })
        ).toThrow(
          'M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER'
        );
      }
    );

    it(
      'fails closed when human review is not required',
      () => {

        const noReview = {
          ...packageFixture,

          requiresHumanReview:
            false
        };

        expect(() =>
          TaxHumanReviewAuditIntegration
            .routeToHumanReview({
              evidencePackage:
                noReview as unknown as EvidencePackage,

              actorId:
                'reviewer-001',

              actorRole:
                'reviewer'
            })
        ).toThrow(
          'M6_8_HUMAN_REVIEW_NOT_REQUIRED'
        );
      }
    );

    it(
      'delegates review disposition to authoritative Stage 03 service',
      () => {

        const spy =
          vi.spyOn(
            StageThreeValidationService,
            'recordReviewDisposition'
          )
          .mockReturnValue(
            {} as ReturnType<
              typeof StageThreeValidationService
                .recordReviewDisposition
            >
          );

        TaxHumanReviewAuditIntegration
          .recordReviewDisposition({
            clientId:
              'M6-8-CLIENT-001',

            taxYear:
              2025,

            queueItemId:
              'M6-8-HRQ-001',

            actor:
              'reviewer-001',

            actorRole:
              'cpa',

            action:
              'RESOLVE_CONFLICT',

            justification:
              'Human-reviewed evidence and authority.'
          });

        expect(spy)
          .toHaveBeenCalledTimes(1);
      }
    );

    it(
      'does not allow AI review disposition',
      () => {

        expect(() =>
          TaxHumanReviewAuditIntegration
            .recordReviewDisposition({
              clientId:
                'M6-8-CLIENT-001',

              taxYear:
                2025,

              queueItemId:
                'M6-8-HRQ-001',

              actor:
                'ai-model-001',

              actorRole:
                'ai_model',

              action:
                'RESOLVE_CONFLICT',

              justification:
                'AI attempted disposition.'
            })
        ).toThrow(
          'M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER'
        );
      }
    );

    it(
      'preserves Stage 03 professional certification authority',
      () => {

        expect(
          typeof StageThreeValidationService
            .certifyValidation
        ).toBe('function');

        expect(
          typeof TaxHumanReviewAuditIntegration
            .certifyProfessionalReview
        ).toBe('function');
      }
    );

    it(
      'does not expose AI self approval',
      () => {

        const service =
          (TaxHumanReviewAuditIntegration as any);

        expect(
          service.approveByAI
        ).toBeUndefined();

        expect(
          service.autoApprove
        ).toBeUndefined();

        expect(
          service.selfApprove
        ).toBeUndefined();
      }
    );

    it(
      'does not expose independent filing authority',
      () => {

        const service =
          (TaxHumanReviewAuditIntegration as any);

        expect(
          service.fileReturn
        ).toBeUndefined();

        expect(
          service.submitReturn
        ).toBeUndefined();

        expect(
          service.transmitReturn
        ).toBeUndefined();
      }
    );

    it(
      'does not expose tax calculation mutation',
      () => {

        const service =
          (TaxHumanReviewAuditIntegration as any);

        expect(
          service.modifyTaxCalculation
        ).toBeUndefined();

        expect(
          service.overrideCalculation
        ).toBeUndefined();

        expect(
          service.changeTaxResult
        ).toBeUndefined();
      }
    );

    it(
      'records authorized human decision trace without granting authority to ledger',
      () => {

        const trace =
          TaxHumanReviewAuditIntegration
            .appendAuthorizedDecisionTrace({
              traceId:
                'M6-8-AUTH-TRACE-001',

              clientId:
                'M6-8-CLIENT-001',

              engagementId:
                'M6-8-ENG-001',

              taxYear:
                2025,

              actorId:
                'cpa-reviewer-001',

              actorRole:
                'cpa',

              summary:
                'Professional human decision recorded.',

              correlationId:
                'M6-8-CORR-001',

              evidencePackageIds:
                ['M6-8-EVP-001'],

              knowledgeSourceIds:
                ['M6-8-KS-001'],

              ruleEvaluationIds:
                ['M6-8-RULE-EVAL-001']
            });

        expect(trace.stage)
          .toBe(
            'AUTHORIZED_DECISION'
          );

        expect(
          trace.hasDecisionAuthority
        ).toBe(false);
      }
    );

    it(
      'requires evidence package provenance for authorized decision trace',
      () => {

        expect(() =>
          TaxHumanReviewAuditIntegration
            .appendAuthorizedDecisionTrace({
              traceId:
                'M6-8-AUTH-TRACE-002',

              clientId:
                'M6-8-CLIENT-001',

              engagementId:
                'M6-8-ENG-001',

              taxYear:
                2025,

              actorId:
                'cpa-reviewer-001',

              actorRole:
                'cpa',

              summary:
                'Decision attempt without evidence.',

              correlationId:
                'M6-8-CORR-002',

              evidencePackageIds:
                []
            })
        ).toThrow(
          'M6_8_DECISION_EVIDENCE_REQUIRED'
        );
      }
    );
  }
);
