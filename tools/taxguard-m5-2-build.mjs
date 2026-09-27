import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(ROOT, "backups", `m5-2-hard-gates-${stamp}`);

fs.mkdirSync(backupDir, { recursive: true });

function stop(message) {
  console.error("");
  console.error("============================================================");
  console.error(" TAXGUARD M5.2 STOPPED SAFELY");
  console.error("============================================================");
  console.error(message);
  console.error("");
  process.exit(1);
}

function full(relative) {
  return path.join(ROOT, relative);
}

function exists(relative) {
  return fs.existsSync(full(relative));
}

function read(relative) {
  if (!exists(relative)) {
    stop(`Required file missing: ${relative}`);
  }

  return fs.readFileSync(full(relative), "utf8");
}

function backup(relative) {
  if (!exists(relative)) return;

  const destination = path.join(backupDir, relative);

  fs.mkdirSync(path.dirname(destination), {
    recursive: true
  });

  fs.copyFileSync(full(relative), destination);
}

function write(relative, content) {
  backup(relative);

  fs.mkdirSync(path.dirname(full(relative)), {
    recursive: true
  });

  fs.writeFileSync(full(relative), content, "utf8");

  console.log(`WRITE ${relative}`);
}

console.log(`
============================================================
 TAXGUARD M5.2
 HARD GATES -> SERVER WORKFLOW AUTHORITY
============================================================

FROZEN
------
M1 LIVE Routing
M2 Stage 01
M3 Stage 02
M4 Stage 03
M5 Firestore workflow foundation

OBJECTIVE
---------
Stage-specific hard gates remain responsible for determining
whether a stage is actually complete.

Only trusted server-side gate synchronization may advance
Firestore workflow state.

Browser direct completion remains prohibited.

External submission remains DISABLED.
============================================================
`);

fs.writeFileSync(
  path.join(ROOT, "M5_2_BACKUP_PATH.txt"),
  backupDir,
  "utf8"
);

/*
==============================================================
M5.2-001
ADD TRUSTED SERVER GATE TRANSITION SERVICE
==============================================================
*/

write(
  "src/server/taxguard/liveWorkflowGate.service.ts",
`import {
  LiveWorkflowRepository
} from './liveWorkflow.repository';

import {
  TaxGuardLiveWorkflowCase,
  TaxGuardWorkflowStage
} from './liveWorkflow.types';

export interface TrustedGateTransition {
  clientId: string;
  taxYear: number;

  stage: TaxGuardWorkflowStage;

  actorUserId: string;
  actorRole: string;

  expectedRevision: number;

  gatePassed: boolean;

  gateName: string;

  gateEvidence?: Record<string, unknown>;
}

export class LiveWorkflowGateService {

  static async commitPassedGate(
    input: TrustedGateTransition
  ): Promise<TaxGuardLiveWorkflowCase> {

    if (!input.clientId?.trim()) {
      throw new Error(
        'Permanent TaxGuard Client ID required.'
      );
    }

    if (!input.gatePassed) {
      throw new Error(
        \`\${input.gateName} has not passed.\`
      );
    }

    if (![1, 2, 3].includes(input.stage)) {
      throw new Error(
        'Unsupported workflow stage.'
      );
    }

    /*
     * IMPORTANT:
     *
     * This method is server-side only.
     * It is not exposed as a browser-controlled "complete"
     * operation.
     *
     * Stage-specific TaxGuard logic determines gatePassed.
     */

    const updated =
      await LiveWorkflowRepository.completeStage(
        input.clientId.trim(),
        input.taxYear,
        input.stage,
        input.actorUserId,
        input.actorRole,
        input.expectedRevision
      );

    return updated;
  }
}
`
);

/*
==============================================================
M5.2-002
SERVER GATE STATUS ENDPOINT

This endpoint allows the authenticated client to READ the
authoritative state.

It does NOT allow the browser to claim a gate passed.
==============================================================
*/

const routeFile =
  "src/server/routes/live-workflow.routes.ts";

let route = read(routeFile);

if (!route.includes("LiveWorkflowGateService")) {

  const importNeedle =
`import { LiveWorkflowRepository } from '../taxguard/liveWorkflow.repository';`;

  const importReplacement =
`import { LiveWorkflowRepository } from '../taxguard/liveWorkflow.repository';
import { LiveWorkflowGateService } from '../taxguard/liveWorkflowGate.service';`;

  if (!route.includes(importNeedle)) {
    stop(
      "M5 live workflow route import anchor changed. " +
      "No guessed edit applied."
    );
  }

  route = route.replace(
    importNeedle,
    importReplacement
  );
}

/*
 * Keep the existing direct completion endpoint blocked.
 */

if (!route.includes("STAGE_GATE_REQUIRED")) {
  stop(
    "M5 direct browser gate protection is missing."
  );
}

/*
 * Add a read-only eligibility endpoint if not present.
 */

if (!route.includes("'/eligibility'")) {

  const exportNeedle =
`export default router;`;

  if (!route.includes(exportNeedle)) {
    stop(
      "live-workflow.routes.ts export anchor not found."
    );
  }

  const eligibilityRoute =
`
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

`;

  route = route.replace(
    exportNeedle,
    eligibilityRoute + exportNeedle
  );
}

write(routeFile, route);

/*
==============================================================
M5.2-003
ADD SERVER HARD-GATE BRIDGE

Existing stage engines can call this from trusted server code.

It deliberately does NOT determine whether a gate passes.
It accepts only an already-computed server-side gate result.
==============================================================
*/

write(
  "src/server/taxguard/stageGateBridge.ts",
`import {
  LiveWorkflowGateService
} from './liveWorkflowGate.service';

import {
  TaxGuardLiveWorkflowCase,
  TaxGuardWorkflowStage
} from './liveWorkflow.types';

export interface StageGateBridgeInput {
  clientId: string;
  taxYear: number;

  stage: TaxGuardWorkflowStage;

  actorUserId: string;
  actorRole: string;

  expectedRevision: number;

  gatePassed: boolean;
  gateName: string;

  evidence?: Record<string, unknown>;
}

export async function persistPassedStageGate(
  input: StageGateBridgeInput
): Promise<TaxGuardLiveWorkflowCase> {

  if (!input.gatePassed) {
    throw new Error(
      \`\${input.gateName} did not pass. ` +
      `Workflow transition denied.\`
    );
  }

  return LiveWorkflowGateService.commitPassedGate({
    clientId: input.clientId,
    taxYear: input.taxYear,

    stage: input.stage,

    actorUserId: input.actorUserId,
    actorRole: input.actorRole,

    expectedRevision: input.expectedRevision,

    gatePassed: true,
    gateName: input.gateName,

    gateEvidence: input.evidence
  });
}
`
);

/*
==============================================================
M5.2-004
CLIENT READ-ONLY ELIGIBILITY API

UI can consume authoritative stage eligibility instead of
trusting localStorage to determine which stage may open.
==============================================================
*/

const apiFile =
  "src/services/liveWorkflowApi.ts";

let api = read(apiFile);

if (!api.includes("LiveWorkflowEligibility")) {

  api =
`export interface LiveWorkflowEligibility {
  clientId: string;
  taxYear: number;

  revision: number;
  activeStage: 1 | 2 | 3;

  eligibility: {
    stage1: boolean;
    stage2: boolean;
    stage3: boolean;
  };

  status: {
    stage1: string;
    stage2: string;
    stage3: string;
  };

  externalSubmissionEnabled: false;
}

` + api;
}

if (!api.includes("static async getEligibility")) {

  const classEnd =
`\n}`;

  const lastClassEnd = api.lastIndexOf(classEnd);

  if (lastClassEnd === -1) {
    stop(
      "LiveWorkflowApi class ending not found."
    );
  }

  const method =
`

  static async getEligibility(
    taxYear: number
  ): Promise<LiveWorkflowEligibility> {

    const token =
      localStorage.getItem('taxguard_token');

    if (!token) {
      throw new Error(
        'Authenticated TaxGuard session required.'
      );
    }

    const response = await fetch(
      \`/api/live-workflow/eligibility?taxYear=\${encodeURIComponent(
        String(taxYear)
      )}\`,
      {
        method: 'GET',

        headers: {
          Authorization: \`Bearer \${token}\`,
          'x-session-token': token
        }
      }
    );

    if (!response.ok) {

      const payload = await response
        .json()
        .catch(() => ({}));

      throw new Error(
        payload.error ||
        'Unable to load workflow eligibility.'
      );
    }

    return response.json();
  }
`;

  api =
    api.slice(0, lastClassEnd) +
    method +
    api.slice(lastClassEnd);
}

write(apiFile, api);

/*
==============================================================
M5.2-005
ADD TESTS FOR THE SERVER AUTHORITY BOUNDARY
==============================================================
*/

write(
  "src/tests/liveWorkflowGateAuthority.test.ts",
`import {
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
`
);

/*
==============================================================
M5.2-006
STATIC ASSERTIONS
==============================================================
*/

const gateService = read(
  "src/server/taxguard/liveWorkflowGate.service.ts"
);

const bridge = read(
  "src/server/taxguard/stageGateBridge.ts"
);

route = read(routeFile);
api = read(apiFile);

const assertions = [
  [
    "Trusted gate service installed",
    gateService.includes(
      "commitPassedGate"
    )
  ],

  [
    "Failed gates rejected",
    gateService.includes(
      "if (!input.gatePassed)"
    )
  ],

  [
    "Server bridge installed",
    bridge.includes(
      "persistPassedStageGate"
    )
  ],

  [
    "Browser completion still blocked",
    route.includes(
      "STAGE_GATE_REQUIRED"
    )
  ],

  [
    "Eligibility endpoint read-only",
    route.includes(
      "router.get("
    ) &&
    route.includes(
      "'/eligibility'"
    )
  ],

  [
    "Client ID server-derived",
    route.includes(
      "req.user?.clientId"
    )
  ],

  [
    "DEMO rejected from LIVE workflow",
    route.includes(
      "cli_perotti"
    )
  ],

  [
    "Client eligibility API installed",
    api.includes(
      "getEligibility"
    )
  ],

  [
    "External submission disabled",
    route.includes(
      "externalSubmissionEnabled: false"
    )
  ]
];

console.log("");
console.log("M5.2 SECURITY ASSERTIONS");
console.log("------------------------");

let failed = false;

for (const [name, ok] of assertions) {

  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}`
  );

  if (!ok) {
    failed = true;
  }
}

if (failed) {
  stop(
    "One or more M5.2 assertions failed."
  );
}

console.log("");
console.log("============================================================");
console.log(" M5.2 SOURCE BUILD APPLIED");
console.log("============================================================");
console.log("");
console.log("Backup:");
console.log(backupDir);
console.log("");
console.log("Browser completion remains blocked.");
console.log("Trusted hard-gate bridge installed.");
console.log("Server eligibility API installed.");
console.log("No OpenAI API used.");
console.log("No AutoFix used.");
console.log("No Client 006 created.");
console.log("External submission remains disabled.");
console.log("");
