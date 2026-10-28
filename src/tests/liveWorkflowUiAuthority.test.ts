import {
  describe,
  expect,
  it
} from 'vitest';

import fs from 'node:fs';
import path from 'node:path';

import {
  guardLiveWorkflowStage
} from '../services/liveWorkflowRouteGuard';

import {
  LiveWorkflowAuthoritySnapshot
} from '../services/liveWorkflowAuthority';

const ROOT = process.cwd();

function source(relative: string): string {

  return fs.readFileSync(
    path.join(ROOT, relative),
    'utf8'
  );
}

function readySnapshot(
  stage2: boolean,
  stage3: boolean,
  activeStage: 1 | 2 | 3
): LiveWorkflowAuthoritySnapshot {

  return {
    status: 'ready',

    taxYear: 2025,

    error: null,

    workflow: {
      clientId: '005',
      taxYear: 2025,

      environment: 'live',

      revision: 7,
      activeStage,

      stage1: {
        stage: 1,
        status:
          stage2
            ? 'COMPLETED'
            : 'IN_PROGRESS'
      },

      stage2: {
        stage: 2,
        status:
          stage3
            ? 'COMPLETED'
            : stage2
              ? 'IN_PROGRESS'
              : 'LOCKED'
      },

      stage3: {
        stage: 3,
        status:
          stage3
            ? 'IN_PROGRESS'
            : 'LOCKED'
      },

      externalSubmissionEnabled: false,

      createdAt:
        '2026-01-01T00:00:00.000Z',

      updatedAt:
        '2026-01-01T00:00:00.000Z'
    },

    eligibility: {
      clientId: '005',
      taxYear: 2025,

      revision: 7,
      activeStage,

      eligibility: {
        stage1: true,
        stage2,
        stage3
      },

      status: {
        stage1:
          stage2
            ? 'COMPLETED'
            : 'IN_PROGRESS',

        stage2:
          stage3
            ? 'COMPLETED'
            : stage2
              ? 'IN_PROGRESS'
              : 'LOCKED',

        stage3:
          stage3
            ? 'IN_PROGRESS'
            : 'LOCKED'
      },

      externalSubmissionEnabled: false
    }
  };
}

describe(
  'TaxGuard M5.4 LIVE UI authority',
  () => {

    it(
      'fails closed before server hydration',
      () => {

        const snapshot:
          LiveWorkflowAuthoritySnapshot = {

          status: 'loading',
          taxYear: 2025,
          workflow: null,
          eligibility: null,
          error: null
        };

        const decision =
          guardLiveWorkflowStage(
            snapshot,
            3
          );

        expect(decision.allowed)
          .toBe(false);
      }
    );

    it(
      'blocks Stage 02 until server eligibility allows it',
      () => {

        const decision =
          guardLiveWorkflowStage(
            readySnapshot(
              false,
              false,
              1
            ),
            2
          );

        expect(decision.allowed)
          .toBe(false);

        if (decision.allowed === false) {
          expect(
            decision.redirectStage
          ).toBe(1);
        }
      }
    );

    it(
      'allows Stage 02 after server eligibility',
      () => {

        const decision =
          guardLiveWorkflowStage(
            readySnapshot(
              true,
              false,
              2
            ),
            2
          );

        expect(decision.allowed)
          .toBe(true);
      }
    );

    it(
      'blocks Stage 03 until server eligibility allows it',
      () => {

        const decision =
          guardLiveWorkflowStage(
            readySnapshot(
              true,
              false,
              2
            ),
            3
          );

        expect(decision.allowed)
          .toBe(false);

        if (decision.allowed === false) {
          expect(
            decision.redirectStage
          ).toBe(2);
        }
      }
    );

    it(
      'allows Stage 03 only from server eligibility',
      () => {

        const decision =
          guardLiveWorkflowStage(
            readySnapshot(
              true,
              true,
              3
            ),
            3
          );

        expect(decision.allowed)
          .toBe(true);
      }
    );

    it(
      'does not persist workflow authority to localStorage',
      () => {

        const authority = source(
          'src/services/liveWorkflowAuthority.ts'
        );

        expect(authority)
          .not.toContain(
            'localStorage.setItem'
          );
      }
    );

    it(
      'keeps direct browser completion blocked',
      () => {

        const route = source(
          'src/server/routes/live-workflow.routes.ts'
        );

        expect(route)
          .toContain(
            'STAGE_GATE_REQUIRED'
          );
      }
    );

    it(
      'keeps permanent Client ID server-derived',
      () => {

        const route = source(
          'src/server/routes/live-workflow.routes.ts'
        );

        expect(route)
          .toContain(
            'req.user?.clientId'
          );

        expect(route)
          .not.toContain(
            'req.body?.clientId'
          );

        expect(route)
          .not.toContain(
            'req.query.clientId'
          );
      }
    );

    it(
      'keeps external submission disabled',
      () => {

        const route = source(
          'src/server/routes/live-workflow.routes.ts'
        );

        expect(route)
          .toContain(
            'externalSubmissionEnabled: false'
          );
      }
    );
  }
);
