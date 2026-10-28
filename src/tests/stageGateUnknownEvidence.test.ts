import { describe, expect, it } from 'vitest';
import { evaluateStageThreeServerGate } from '../server/taxguard/stageThreeServerGate';
import { evaluateStageFourServerGate } from '../server/taxguard/stageFourServerGate';
import { evaluateStageFiveServerGate } from '../server/taxguard/stageFiveServerGate';
import { evaluateStageSixServerGate } from '../server/taxguard/stageSixServerGate';
import { evaluateStageSevenServerGate } from '../server/taxguard/stageSevenServerGate';
import { evaluateStageNineServerGate } from '../server/taxguard/stageNineServerGate';
import { evaluateStageTenServerGate } from '../server/taxguard/stageTenServerGate';
import { evaluateStageThirteenServerGate } from '../server/taxguard/stageThirteenServerGate';
import { evaluateStageFourteenServerGate } from '../server/taxguard/stageFourteenServerGate';
import { evaluateStageFifteenServerGate } from '../server/taxguard/stageFifteenServerGate';
import type { StageGateDecision } from '../server/taxguard/stageGate.types';

const gates: [number, (input: any) => StageGateDecision, Record<string, unknown>, string[]][] = [
  [4, evaluateStageFourServerGate, { stageThreeComplete: true, validatedEvidenceRecorded: true, provenanceComplete: true, professionalReviewComplete: true }, ['unresolvedBlockingExceptions', 'unresolvedDuplicateConflicts']],
  [5, evaluateStageFiveServerGate, { stageFourComplete: true, reconciliationsExecuted: true, variancesResolved: true, professionalReviewComplete: true }, ['unresolvedBlockingExceptions']],
  [6, evaluateStageSixServerGate, { stageFiveComplete: true, reviewQueueCleared: true, makerCheckerSatisfied: true, workpapersComplete: true }, ['unresolvedBlockingExceptions']],
  [7, evaluateStageSevenServerGate, { stageSixComplete: true, requiredReportsGenerated: true, reportsCurrent: true }, ['unresolvedBlockingExceptions']],
  [9, evaluateStageNineServerGate, { stageEightComplete: true, authoritativeDataCurrent: true, deterministicCalculationsComplete: true, draftReturnGenerated: true, preparerReviewComplete: true, provenanceComplete: true }, ['unresolvedBlockingDiagnostics']],
  [10, evaluateStageTenServerGate, { stageNineComplete: true, returnApproved: true, makerCheckerVerified: true, reviewerCredentialVerified: true }, ['unresolvedBlockingDiagnostics', 'unresolvedMaterialExceptions']],
  [13, evaluateStageThirteenServerGate, { stageTwelveComplete: true, feedbackReceived: true, feedbackProcessed: true }, ['unresolvedGovernmentNotices']],
  [14, evaluateStageFourteenServerGate, { stageThirteenComplete: true, rejectionsOrNoticesResolved: true, professionalReviewComplete: true }, ['openResolutionIssues']],
  [15, evaluateStageFifteenServerGate, { stageFourteenComplete: true, monitoringItemsCurrent: true, followUpsCompleted: true }, ['unresolvedDeadlines']],
];
describe.each(gates)('stage %i refuses unknown exception evidence', (stage, evaluate, flags, counts) => {
  const valid = () => ({ ...flags, hardExitGatePassed: true, ...Object.fromEntries(counts.map(key => [key, 0])) });
  it('preserves the existing explicitly cleared gate without executing any transition', () => {
    expect(evaluate(valid())).toMatchObject({ stage, passed: true });
  });
  it.each([undefined, null, false, '', '0', NaN, Infinity, -1, 0.1, 1])('denies missing/malformed/nonzero count %s despite every approval flag', value => {
    for (const key of counts) expect(evaluate({ ...valid(), [key]: value }).passed).toBe(false);
  });
  it('records missing counts as unknown rather than fabricating zero', () => {
    const decision = evaluate({ ...flags, hardExitGatePassed: true });
    expect(decision.passed).toBe(false);
    if (stage !== 10) for (const key of counts) expect(decision.evidence.metadata?.[key]).toBeNull();
  });
});
describe('stage 03 requires an explicit review policy flag', () => {
  const valid = { validationComplete: true, provenanceComplete: true, unresolvedBlockingExceptions: 0, humanReviewRequired: true, humanReviewApproved: true, hardExitGatePassed: true };
  it.each([undefined, null, false, 'false', '', 0])('does not treat malformed required-review policy %s as a waiver', value => {
    if (value === false) expect(evaluateStageThreeServerGate({ ...valid, humanReviewRequired: value }).passed).toBe(true);
    else expect(evaluateStageThreeServerGate({ ...valid, humanReviewRequired: value } as any).passed).toBe(false);
  });
  it.each(['false', 'true', 0, null, true])('rejects invalid or AI-only decision indicator %s', value => {
    expect(evaluateStageThreeServerGate({ ...valid, aiOnlyDecision: value } as any).passed).toBe(false);
  });
});
