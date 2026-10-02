import {
  describe,
  expect,
  it
} from 'vitest';

import {
  evaluateStageOneServerGate
} from '../server/taxguard/stageOneServerGate';

import {
  evaluateStageTwoServerGate
} from '../server/taxguard/stageTwoServerGate';

import {
  evaluateStageThreeServerGate
} from '../server/taxguard/stageThreeServerGate';

import {
  ServerStageGateOrchestrator
} from '../server/taxguard/serverStageGateOrchestrator';

describe(
  'TaxGuard M5.3 server stage gates',
  () => {

    it(
      'passes Stage 01 only when every requirement and hard gate pass',
      () => {

        const result =
          evaluateStageOneServerGate({
            hardExitGatePassed: true,
            identityComplete: true,
            taxProfileComplete: true,
            consentComplete: true,
            reviewComplete: true
          });

        expect(result.passed).toBe(true);
        expect(result.stage).toBe(1);
      }
    );

    it(
      'blocks incomplete Stage 01',
      () => {

        const result =
          evaluateStageOneServerGate({
            hardExitGatePassed: false,
            identityComplete: true,
            taxProfileComplete: false,
            consentComplete: true,
            reviewComplete: true
          });

        expect(result.passed).toBe(false);

        expect(
          result.evidence.blockingReasons.length
        ).toBeGreaterThan(0);
      }
    );

    it(
      'requires deterministic Stage 02 completeness',
      () => {

        const result =
          evaluateStageTwoServerGate({
            completenessPassed: false,
            unresolvedBlockingExceptions: 0,
            reconciliationPassed: true,
            professionalCertificationPassed: true,
            hardExitGatePassed: true
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'blocks Stage 02 unresolved exceptions',
      () => {

        const result =
          evaluateStageTwoServerGate({
            completenessPassed: true,
            unresolvedBlockingExceptions: 1,
            reconciliationPassed: true,
            professionalCertificationPassed: true,
            hardExitGatePassed: true
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'requires Stage 02 professional certification',
      () => {

        const result =
          evaluateStageTwoServerGate({
            completenessPassed: true,
            unresolvedBlockingExceptions: 0,
            reconciliationPassed: true,
            professionalCertificationPassed: false,
            hardExitGatePassed: true
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'allows fully satisfied Stage 02 gate',
      () => {

        const result =
          evaluateStageTwoServerGate({
            completenessPassed: true,
            unresolvedBlockingExceptions: 0,
            reconciliationPassed: true,
            professionalCertificationPassed: true,
            hardExitGatePassed: true
          });

        expect(result.passed).toBe(true);
      }
    );

    it(
      'blocks AI-only Stage 03 decisions',
      () => {

        const result =
          evaluateStageThreeServerGate({
            validationComplete: true,
            provenanceComplete: true,
            unresolvedBlockingExceptions: 0,
            humanReviewRequired: false,
            humanReviewApproved: false,
            hardExitGatePassed: true,
            aiOnlyDecision: true
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'requires human approval when Stage 03 review is required',
      () => {

        const result =
          evaluateStageThreeServerGate({
            validationComplete: true,
            provenanceComplete: true,
            unresolvedBlockingExceptions: 0,
            humanReviewRequired: true,
            humanReviewApproved: false,
            hardExitGatePassed: true,
            aiOnlyDecision: false
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'allows Stage 03 after validation provenance and required review',
      () => {

        const result =
          evaluateStageThreeServerGate({
            validationComplete: true,
            provenanceComplete: true,
            unresolvedBlockingExceptions: 0,
            humanReviewRequired: true,
            humanReviewApproved: true,
            hardExitGatePassed: true,
            aiOnlyDecision: false
          });

        expect(result.passed).toBe(true);
      }
    );

    it(
      'exposes commitScopedStage methods for all 18 lifecycle stages',
      () => {
        expect(typeof ServerStageGateOrchestrator.commitScopedStageOne).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageTwo).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageThree).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageFour).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageFive).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageSix).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageSeven).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageEight).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageNine).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageTen).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageEleven).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageTwelve).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageThirteen).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageFourteen).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageFifteen).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageSixteen).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageSeventeen).toBe('function');
        expect(typeof ServerStageGateOrchestrator.commitScopedStageEighteen).toBe('function');
      }
    );

    it(
      'enforces stage unlocking prerequisites for downstream stages',
      () => {
        expect(ServerStageGateOrchestrator.isStageFourUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
        expect(ServerStageGateOrchestrator.isStageFourUnlocked({ requirementsMet: false, status: 'IN_PROGRESS' })).toBe(false);
        expect(ServerStageGateOrchestrator.isStageTenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
        expect(ServerStageGateOrchestrator.isStageTenUnlocked({ requirementsMet: true, status: 'PENDING' })).toBe(false);
        expect(ServerStageGateOrchestrator.isStageEighteenUnlocked({ requirementsMet: true, status: 'COMPLETE' })).toBe(true);
      }
    );
  }
);
