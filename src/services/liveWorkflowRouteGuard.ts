import {
  LiveWorkflowAuthoritySnapshot
} from './liveWorkflowAuthority';

export type LiveWorkflowRouteDecision =
  | {
      allowed: true;
      stage: 1 | 2 | 3;
    }
  | {
      allowed: false;
      redirectStage: 1 | 2 | 3;
      reason: string;
    };

export function guardLiveWorkflowStage(
  snapshot: LiveWorkflowAuthoritySnapshot,
  requestedStage: 1 | 2 | 3
): LiveWorkflowRouteDecision {

  /*
   * FAIL CLOSED.
   *
   * Until server authority is hydrated, later stages
   * cannot be opened.
   */

  if (
    snapshot.status !== 'ready' ||
    !snapshot.workflow ||
    !snapshot.eligibility
  ) {

    return {
      allowed: false,
      redirectStage: 1,
      reason:
        'Authoritative LIVE workflow state is not available.'
    };
  }

  const eligibility =
    snapshot.eligibility.eligibility;

  if (requestedStage === 1) {

    return {
      allowed: true,
      stage: 1
    };
  }

  if (
    requestedStage === 2 &&
    eligibility.stage2
  ) {

    return {
      allowed: true,
      stage: 2
    };
  }

  if (
    requestedStage === 3 &&
    eligibility.stage3
  ) {

    return {
      allowed: true,
      stage: 3
    };
  }

  /*
   * Determine highest server-authorized stage.
   */

  if (eligibility.stage3) {

    return {
      allowed: false,
      redirectStage: 3,
      reason:
        'Requested LIVE stage is not server-authorized.'
    };
  }

  if (eligibility.stage2) {

    return {
      allowed: false,
      redirectStage: 2,
      reason:
        'Stage 03 remains locked by the server.'
    };
  }

  return {
    allowed: false,
    redirectStage: 1,
    reason:
      'Stage 02 remains locked by the server.'
  };
}
