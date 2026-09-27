import {
  describe,
  expect,
  it
} from 'vitest';

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function source(relative: string): string {
  return fs.readFileSync(
    path.join(root, relative),
    'utf8'
  );
}

describe(
  'TaxGuard M5.2 server workflow authority',
  () => {

    it(
      'keeps direct browser completion blocked',
      () => {

        const route = source(
          'src/server/routes/live-workflow.routes.ts'
        );

        expect(route).toContain(
          'STAGE_GATE_REQUIRED'
        );
      }
    );

    it(
      'derives LIVE client identity from authenticated server user',
      () => {

        const route = source(
          'src/server/routes/live-workflow.routes.ts'
        );

        expect(route).toContain(
          'req.user?.clientId'
        );

        expect(route).not.toContain(
          'req.body?.clientId'
        );

        expect(route).not.toContain(
          'req.query.clientId'
        );
      }
    );

    it(
      'rejects DEMO identity from LIVE workflow',
      () => {

        const route = source(
          'src/server/routes/live-workflow.routes.ts'
        );

        expect(route).toContain(
          "clientId === 'cli_perotti'"
        );
      }
    );

    it(
      'exposes only read-only eligibility to browser',
      () => {

        const route = source(
          'src/server/routes/live-workflow.routes.ts'
        );

        expect(route).toContain(
          "'/eligibility'"
        );

        expect(route).toContain(
          'externalSubmissionEnabled: false'
        );
      }
    );

    it(
      'requires a passed trusted gate before persistence',
      () => {

        const bridge = source(
          'src/server/taxguard/stageGateBridge.ts'
        );

        expect(bridge).toContain(
          'if (!input.gatePassed)'
        );

        expect(bridge).toContain(
          'Workflow transition denied'
        );
      }
    );

    it(
      'keeps workflow sequence server-side',
      () => {

        const repository = source(
          'src/server/taxguard/liveWorkflow.repository.ts'
        );

        expect(repository).toContain(
          'Stage 01 must be completed first.'
        );

        expect(repository).toContain(
          'Stages 01 and 02 must be completed first.'
        );
      }
    );

    it(
      'keeps external submission disabled',
      () => {

        const repository = source(
          'src/server/taxguard/liveWorkflow.repository.ts'
        );

        expect(repository).toContain(
          'externalSubmissionEnabled: false'
        );
      }
    );
  }
);
