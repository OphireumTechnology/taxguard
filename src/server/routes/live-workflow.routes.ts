import { Router } from 'express';

import { authenticateToken } from '../auth';

import { LiveWorkflowRepository } from '../taxguard/liveWorkflow.repository';
import { LiveWorkflowGateService } from '../taxguard/liveWorkflowGate.service';

import {
  TaxGuardWorkflowStage
} from '../taxguard/liveWorkflow.types';

const router = Router();

function getTaxYear(value: unknown): number | null {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 2000 ||
    parsed > 2200
  ) {
    return null;
  }

  return parsed;
}

function getPermanentClientId(
  req: any
): string | null {

  const clientId =
    typeof req.user?.clientId === 'string'
      ? req.user.clientId.trim()
      : '';

  return clientId || null;
}

function assertLiveClient(req: any): {
  clientId: string;
  actorUserId: string;
  actorRole: string;
} {

  if (!req.user) {
    throw new Error('Authentication required.');
  }

  const clientId = getPermanentClientId(req);

  if (!clientId) {
    throw new Error(
      'Permanent TaxGuard Client ID required.'
    );
  }

  /*
   * DEMO identities are never accepted by this route.
   */

  if (clientId === 'cli_perotti') {
    throw new Error(
      'DEMO identity cannot access LIVE workflow.'
    );
  }

  return {
    clientId,

    actorUserId:
      String(req.user.id || req.user.uid || 'unknown'),

    actorRole:
      String(req.user.role || 'client')
  };
}

/*
 * GET authoritative workflow state.
 */

router.get(
  '/state',
  authenticateToken,
  async (req: any, res) => {

    try {

      const identity = assertLiveClient(req);

      const taxYear = getTaxYear(req.query.taxYear);

      if (!taxYear) {
        return res.status(400).json({
          error: 'Valid taxYear is required.'
        });
      }

      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate'
      );

      const workflow =
        await LiveWorkflowRepository.getOrCreateCase(
          identity.clientId,
          taxYear,
          identity.actorUserId,
          identity.actorRole
        );

      return res.json({
        environment: 'live',
        clientId: identity.clientId,
        workflow
      });

    } catch (error) {

      return res.status(403).json({
        error:
          error instanceof Error
            ? error.message
            : 'LIVE workflow access denied.'
      });
    }
  }
);

/*
 * POST authoritative stage transition.
 *
 * IMPORTANT:
 * This endpoint controls persistence and sequence only.
 *
 * Stage-specific services still determine whether their
 * hard-gate requirements are actually satisfied.
 */

router.post(
  '/complete-stage',
  authenticateToken,
  async (req: any, res) => {

    try {

      const identity = assertLiveClient(req);

      const taxYear = getTaxYear(req.body?.taxYear);

      const stage =
        Number(req.body?.stage) as TaxGuardWorkflowStage;

      const expectedRevision =
        Number(req.body?.expectedRevision);

      if (!taxYear) {
        return res.status(400).json({
          error: 'Valid taxYear is required.'
        });
      }

      if (![1, 2, 3].includes(stage)) {
        return res.status(400).json({
          error: 'Stage must be 1, 2, or 3.'
        });
      }

      if (!Number.isInteger(expectedRevision)) {
        return res.status(400).json({
          error: 'expectedRevision is required.'
        });
      }

      /*
       * M5 deliberately rejects direct browser completion.
       *
       * The existing Stage 01/02/03 hard-gate services must
       * later call the repository after their own validation.
       *
       * This prevents this new API from becoming a bypass.
       */

      return res.status(409).json({
        error:
          'Direct stage completion is disabled. ' +
          'Use the stage-specific TaxGuard hard gate.',
        code: 'STAGE_GATE_REQUIRED'
      });

    } catch (error) {

      return res.status(403).json({
        error:
          error instanceof Error
            ? error.message
            : 'LIVE workflow access denied.'
      });
    }
  }
);


/*
 * READ-ONLY authoritative stage eligibility.
 *
 * The browser may ask what it is allowed to display.
 * It cannot advance the workflow here.
 */
router.get(
  '/eligibility',
  authenticateToken,
  async (req: any, res) => {

    try {

      const identity = assertLiveClient(req);

      const taxYear = getTaxYear(req.query.taxYear);

      if (!taxYear) {
        return res.status(400).json({
          error: 'Valid taxYear is required.'
        });
      }

      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate'
      );

      const workflow =
        await LiveWorkflowRepository.getOrCreateCase(
          identity.clientId,
          taxYear,
          identity.actorUserId,
          identity.actorRole
        );

      return res.json({
        clientId: identity.clientId,
        taxYear,

        revision: workflow.revision,
        activeStage: workflow.activeStage,

        eligibility: {
          stage1: true,

          stage2:
            workflow.stage1.status === 'COMPLETED',

          stage3:
            workflow.stage1.status === 'COMPLETED' &&
            workflow.stage2.status === 'COMPLETED'
        },

        status: {
          stage1: workflow.stage1.status,
          stage2: workflow.stage2.status,
          stage3: workflow.stage3.status
        },

        externalSubmissionEnabled: false
      });

    } catch (error) {

      return res.status(403).json({
        error:
          error instanceof Error
            ? error.message
            : 'Workflow eligibility denied.'
      });
    }
  }
);

export default router;
