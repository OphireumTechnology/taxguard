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
  }
);
