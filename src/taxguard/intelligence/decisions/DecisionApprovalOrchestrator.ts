import {
  StageThreeValidationService,
  type HumanValidationQueueItem,
} from '../../../services/stageThreeValidationService';

/**
 * TG-CORE-006 — Decision & Approval Orchestrator
 *
 * Purpose:
 * Coordinates authorized human decisions produced from the TaxGuard
 * Intelligence Core with the existing Stage 03 validation/review authority.
 *
 * HARD GOVERNANCE INVARIANTS
 *
 * 1. AI output is advisory and PROPOSED ONLY.
 * 2. AI may never approve, resolve, waive, certify, or clear a gate.
 * 3. Human identity is mandatory.
 * 4. Written justification is mandatory.
 * 5. Maker-checker separation is mandatory.
 * 6. StageThreeValidationService remains the authoritative review authority.
 * 7. This orchestrator must never mutate Stage 03 queue state directly.
 * 8. This orchestrator must never manufacture a cleared validation state.
 * 9. Certification and exit-gate clearance remain separate downstream actions.
 */

export type DecisionAction =
  NonNullable<HumanValidationQueueItem['disposition']>['action'];

export type DecisionActorRole =
  | 'cpa'
  | 'ea'
  | 'tax_attorney'
  | 'reviewer'
  | 'accountant'
  | 'admin'
  | string;

export interface DecisionApprovalRequest {
  clientId: string;
  taxYear: number;
  queueItemId: string;

  actor: string;
  actorRole: DecisionActorRole;

  action: DecisionAction;
  justification: string;

  correctedValue?: unknown;

  /**
   * Must never be true for an executable human decision.
   *
   * If the originating decision is still an AI proposal, the request must
   * remain in the human-review workflow and cannot be executed as approval.
   */
  isAiProposedOnly?: boolean;

  /**
   * Optional traceability metadata.
   * These fields do not grant authority.
   */
  correlationId?: string;
  evidencePackageId?: string;
  aiProposalId?: string;
}

export interface DecisionApprovalResult {
  clientId: string;
  taxYear: number;
  queueItemId: string;

  action: DecisionAction;
  actor: string;
  actorRole: DecisionActorRole;

  status: HumanValidationQueueItem['status'];
  blockingStatus: boolean;

  executedByHuman: true;
  aiAuthorityGranted: false;

  requiresCertification: boolean;
  requiresExitGateEvaluation: boolean;

  resolutionAt?: string;
  resolutionRationale?: string;

  correlationId?: string;
  evidencePackageId?: string;
  aiProposalId?: string;

  reviewItem: HumanValidationQueueItem;
}

/**
 * Actions which represent a completed human disposition.
 *
 * Note:
 * StageThreeValidationService is still authoritative for the actual
 * resulting queue status.
 */
const TERMINAL_RESOLUTION_ACTIONS: ReadonlySet<DecisionAction> = new Set([
  'ACCEPT_SOURCE',
  'ACCEPT_CORRECTION',
  'REJECT_SOURCE',
  'RESOLVE_CONFLICT',
  'WAIVE_EXCEPTION',
  'CORRECT_VALUE',
  'MARK_NOT_APPLICABLE',
]);

/**
 * Actions which intentionally return work to another participant or
 * continue the review lifecycle.
 */
const CONTINUATION_ACTIONS: ReadonlySet<DecisionAction> = new Set([
  'REQUEST_CORRECTION',
  'REQUEST_CLIENT_INFORMATION',
  'REOPEN_REVIEW',
  'REQUEST_EVIDENCE',
  'ESCALATE',
]);

const ALL_ACTIONS: ReadonlySet<DecisionAction> = new Set([
  ...TERMINAL_RESOLUTION_ACTIONS,
  ...CONTINUATION_ACTIONS,
]);

export class DecisionApprovalOrchestrator {
  /**
   * Execute an authorized human disposition through the existing
   * Stage 03 review authority.
   *
   * This method deliberately delegates the actual state transition to
   * StageThreeValidationService.recordReviewDisposition().
   */
  public static execute(
    request: DecisionApprovalRequest,
  ): DecisionApprovalResult {
    this.validateRequest(request);

    const reviewItem =
      StageThreeValidationService.recordReviewDisposition({
        clientId: request.clientId,
        taxYear: request.taxYear,
        queueItemId: request.queueItemId,
        actor: request.actor.trim(),
        actorRole: request.actorRole,
        action: request.action,
        justification: request.justification.trim(),
        correctedValue: request.correctedValue,

        // Explicitly forward the governance marker.
        // Stage 03 rejects the request if this is true.
        isAiProposedOnly: request.isAiProposedOnly,
      });

    const isTerminal =
      reviewItem.status === 'RESOLVED' ||
      reviewItem.status === 'WAIVED';

    return {
      clientId: request.clientId,
      taxYear: request.taxYear,
      queueItemId: reviewItem.queueItemId,

      action: request.action,
      actor: request.actor.trim(),
      actorRole: request.actorRole,

      status: reviewItem.status,
      blockingStatus: reviewItem.blockingStatus ?? false,

      executedByHuman: true,
      aiAuthorityGranted: false,

      /**
       * A resolved review item may become eligible for professional
       * certification, but this orchestrator NEVER performs certification.
       */
      requiresCertification: isTerminal,

      /**
       * Exit-gate evaluation is downstream of professional certification.
       * This flag is informational only and does not clear the gate.
       */
      requiresExitGateEvaluation: isTerminal,

      resolutionAt: reviewItem.resolutionAt,
      resolutionRationale: reviewItem.resolutionRationale,

      correlationId: request.correlationId,
      evidencePackageId: request.evidencePackageId,
      aiProposalId: request.aiProposalId,

      reviewItem,
    };
  }

  /**
   * Alias with a domain-specific name for callers that prefer
   * "approveDecision" terminology.
   *
   * It does NOT bypass human review and does NOT certify Stage 03.
   */
  public static approveDecision(
    request: DecisionApprovalRequest,
  ): DecisionApprovalResult {
    return this.execute(request);
  }

  /**
   * Determine whether an action is a recognized Stage 03 disposition.
   */
  public static isSupportedAction(
    action: string,
  ): action is DecisionAction {
    return ALL_ACTIONS.has(action as DecisionAction);
  }

  /**
   * Returns whether the requested action ordinarily represents a completed
   * human disposition.
   *
   * StageThreeValidationService remains authoritative for actual state.
   */
  public static isTerminalResolutionAction(
    action: DecisionAction,
  ): boolean {
    return TERMINAL_RESOLUTION_ACTIONS.has(action);
  }

  /**
   * Returns whether the action continues/reopens/routes the review lifecycle.
   */
  public static isContinuationAction(
    action: DecisionAction,
  ): boolean {
    return CONTINUATION_ACTIONS.has(action);
  }

  private static validateRequest(
    request: DecisionApprovalRequest,
  ): void {
    if (!request) {
      throw new Error('Decision approval request is required.');
    }

    if (!request.clientId || !request.clientId.trim()) {
      throw new Error('clientId is required.');
    }

    if (
      !Number.isInteger(request.taxYear) ||
      request.taxYear < 1900 ||
      request.taxYear > 2200
    ) {
      throw new Error('A valid taxYear is required.');
    }

    if (!request.queueItemId || !request.queueItemId.trim()) {
      throw new Error('queueItemId is required.');
    }

    if (!request.actor || !request.actor.trim()) {
      throw new Error(
        'Authenticated human actor identity is required.',
      );
    }

    if (!request.actorRole || !request.actorRole.trim()) {
      throw new Error('actorRole is required.');
    }

    if (!request.justification || !request.justification.trim()) {
      throw new Error(
        'A written justification is required for a decision.',
      );
    }

    if (!this.isSupportedAction(request.action)) {
      throw new Error(
        `Unsupported Stage 03 decision action: ${String(
          request.action,
        )}.`,
      );
    }

    /**
     * Defense in depth.
     *
     * StageThreeValidationService independently performs this check.
     * Keeping it here prevents an AI-originated proposal from even reaching
     * the authoritative disposition boundary.
     */
    if (request.isAiProposedOnly === true) {
      throw new Error(
        'AI output remains PROPOSED ONLY and cannot approve, resolve, waive, certify, or clear a TaxGuard decision.',
      );
    }

    const actor = request.actor.trim().toLowerCase();
    const role = request.actorRole.trim().toLowerCase();

    if (
      actor.includes('ai') ||
      role === 'ai_model' ||
      role === 'ai'
    ) {
      throw new Error(
        'AI identities are not authorized decision approvers.',
      );
    }
  }
}