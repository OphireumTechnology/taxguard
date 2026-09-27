import {
  Router
} from 'express';

import {
  authenticateToken
} from '../auth';

import {
  TaxGuardGeminiGateway,
  TaxGuardAiPolicy,
  TaxGuardAiAudit,
  type TaxGuardAiRequest
} from '../ai';

const router =
  Router();

function correlationId(): string {
  return (
    'AI-' +
    Date.now()
      .toString(36) +
    '-' +
    Math.random()
      .toString(36)
      .slice(2, 10)
  ).toUpperCase();
}

router.get(
  '/health',
  authenticateToken,
  (_req, res) => {
    res.status(200).json({
      service:
        'taxguard-ai',

      provider:
        'GOOGLE_GEMINI',

      configured:
        TaxGuardGeminiGateway
          .isConfigured(),

      model:
        TaxGuardGeminiGateway
          .model,

      governance: {
        isAiProposedOnly:
          true,

        requiresHumanReview:
          true,

        authorityVerified:
          false,

        externalSubmissionAllowed:
          false
      }
    });
  }
);

router.post(
  '/propose',
  authenticateToken,
  async (
    req,
    res
  ) => {
    const id =
      correlationId();

    /*
     * Authentication has already been
     * enforced by authenticateToken.
     *
     * M16 deliberately does not assume
     * a particular AuthenticatedRequest
     * property shape.
     */
    const actorId =
      'authenticated-taxguard-user';

    try {
      const request =
        req.body as
          TaxGuardAiRequest;

      TaxGuardAiPolicy
        .validate(
          request
        );

      TaxGuardAiAudit
        .record({
          eventType:
            'AI_REQUEST_ACCEPTED',

          actorId,

          correlationId:
            id
        });

      const proposal =
        await TaxGuardGeminiGateway
          .propose(
            request
          );

      TaxGuardAiAudit
        .record({
          eventType:
            'AI_PROPOSAL_CREATED',

          actorId,

          correlationId:
            id,

          provider:
            proposal.provider,

          model:
            proposal.model
        });

      res.status(200).json({
        correlationId:
          id,

        proposal
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'TAXGUARD_AI_UNKNOWN_FAILURE';

      const rejected =
        message ===
          'TAXGUARD_AI_REQUEST_REQUIRED' ||

        message ===
          'TAXGUARD_AI_TASK_REQUIRED' ||

        message ===
          'TAXGUARD_AI_TASK_TOO_LARGE' ||

        message ===
          'TAXGUARD_AI_CONTEXT_TOO_LARGE' ||

        message ===
          'TAXGUARD_AI_TOO_MUCH_EVIDENCE' ||

        message ===
          'TAXGUARD_AI_EVIDENCE_TOO_LARGE' ||

        message ===
          'TAXGUARD_AI_SECRET_MATERIAL_BLOCKED';

      TaxGuardAiAudit
        .record({
          eventType:
            rejected
              ? 'AI_REQUEST_REJECTED'
              : 'AI_PROVIDER_FAILURE',

          actorId,

          correlationId:
            id
        });

      const status =
        rejected
          ? 400
          : message ===
              'TAXGUARD_AI_NOT_CONFIGURED'
            ? 503
            : 502;

      res.status(status).json({
        error:
          message,

        correlationId:
          id,

        isAiProposedOnly:
          true,

        requiresHumanReview:
          true,

        externalSubmissionAllowed:
          false
      });
    }
  }
);

export default router;
