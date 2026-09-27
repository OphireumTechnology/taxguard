import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(ROOT, "backups", `m5-server-authority-${stamp}`);

fs.mkdirSync(backupDir, { recursive: true });

function stop(message) {
  console.error("");
  console.error("============================================================");
  console.error(" M5 STOPPED SAFELY");
  console.error("============================================================");
  console.error(message);
  console.error("");
  process.exit(1);
}

function read(relative) {
  const file = path.join(ROOT, relative);

  if (!fs.existsSync(file)) {
    stop(`Required file missing: ${relative}`);
  }

  return fs.readFileSync(file, "utf8");
}

function backup(relative) {
  const source = path.join(ROOT, relative);

  if (!fs.existsSync(source)) return;

  const destination = path.join(backupDir, relative);

  fs.mkdirSync(path.dirname(destination), {
    recursive: true
  });

  fs.copyFileSync(source, destination);
}

function write(relative, content) {
  const file = path.join(ROOT, relative);

  backup(relative);

  fs.mkdirSync(path.dirname(file), {
    recursive: true
  });

  fs.writeFileSync(file, content, "utf8");

  console.log(`WRITE ${relative}`);
}

console.log(`
============================================================
 TAXGUARD M5
 SERVER-AUTHORITATIVE LIVE WORKFLOW FOUNDATION
============================================================

PRESERVE
--------
M1 LIVE Routing
M2 Stage 01 ONBOARD
M3 Stage 02 COLLECT
M4 Stage 03 VALIDATE
Permanent Client IDs
LIVE / DEMO isolation
Intelligence Core
Existing hard gates

BUILD
-----
Firestore-backed LIVE case state
Server-derived Client ID
Server-authoritative stage eligibility
Authenticated workflow API
Server audit events
Optimistic revision control
Fail-closed stage transitions

External submission remains DISABLED.
============================================================
`);

fs.writeFileSync(
  path.join(ROOT, "M5_BACKUP_PATH.txt"),
  backupDir,
  "utf8"
);

/*
==============================================================
M5-001
SERVER-AUTHORITATIVE WORKFLOW TYPES
==============================================================
*/

write(
  "src/server/taxguard/liveWorkflow.types.ts",
`export type TaxGuardWorkflowStage = 1 | 2 | 3;

export type TaxGuardWorkflowStageStatus =
  | 'LOCKED'
  | 'IN_PROGRESS'
  | 'READY_FOR_REVIEW'
  | 'COMPLETED';

export interface TaxGuardStageState {
  stage: TaxGuardWorkflowStage;
  status: TaxGuardWorkflowStageStatus;
  completedAt?: string;
  completedBy?: string;
}

export interface TaxGuardLiveWorkflowCase {
  clientId: string;
  taxYear: number;

  environment: 'live';

  revision: number;

  activeStage: TaxGuardWorkflowStage;

  stage1: TaxGuardStageState;
  stage2: TaxGuardStageState;
  stage3: TaxGuardStageState;

  externalSubmissionEnabled: false;

  createdAt: string;
  updatedAt: string;
}

export interface TaxGuardWorkflowAuditEvent {
  eventId: string;

  clientId: string;
  taxYear: number;

  actorUserId: string;
  actorRole: string;

  action: string;
  stage?: TaxGuardWorkflowStage;

  result: 'success' | 'error';

  serverTimestamp: string;

  metadata?: Record<string, unknown>;
}
`
);

/*
==============================================================
M5-002
FIRESTORE LIVE WORKFLOW REPOSITORY

No browser state is authoritative here.
Client ID comes from authenticated server identity.
==============================================================
*/

write(
  "src/server/taxguard/liveWorkflow.repository.ts",
`import { randomUUID } from 'node:crypto';

import {
  TaxGuardLiveWorkflowCase,
  TaxGuardWorkflowAuditEvent,
  TaxGuardWorkflowStage
} from './liveWorkflow.types';

import { getFirebaseAdminDb } from '../firebase-admin';

const CASE_COLLECTION = 'taxguard_live_cases';
const AUDIT_COLLECTION = 'taxguard_live_audit';

function nowIso(): string {
  return new Date().toISOString();
}

function caseDocumentId(
  clientId: string,
  taxYear: number
): string {
  return \`\${clientId}__\${taxYear}\`;
}

function assertClientId(clientId: string): void {
  if (!clientId || !clientId.trim()) {
    throw new Error(
      'Permanent TaxGuard Client ID is required.'
    );
  }
}

function assertTaxYear(taxYear: number): void {
  if (
    !Number.isInteger(taxYear) ||
    taxYear < 2000 ||
    taxYear > 2200
  ) {
    throw new Error('Invalid tax year.');
  }
}

export class LiveWorkflowRepository {

  static async getCase(
    clientId: string,
    taxYear: number
  ): Promise<TaxGuardLiveWorkflowCase | null> {

    assertClientId(clientId);
    assertTaxYear(taxYear);

    const db = getFirebaseAdminDb();

    const snapshot = await db
      .collection(CASE_COLLECTION)
      .doc(caseDocumentId(clientId, taxYear))
      .get();

    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() as TaxGuardLiveWorkflowCase;
  }

  static async getOrCreateCase(
    clientId: string,
    taxYear: number,
    actorUserId: string,
    actorRole: string
  ): Promise<TaxGuardLiveWorkflowCase> {

    assertClientId(clientId);
    assertTaxYear(taxYear);

    const db = getFirebaseAdminDb();

    const ref = db
      .collection(CASE_COLLECTION)
      .doc(caseDocumentId(clientId, taxYear));

    const result = await db.runTransaction(
      async transaction => {

        const snapshot = await transaction.get(ref);

        if (snapshot.exists) {
          return snapshot.data() as TaxGuardLiveWorkflowCase;
        }

        const timestamp = nowIso();

        const created: TaxGuardLiveWorkflowCase = {
          clientId,
          taxYear,

          environment: 'live',

          revision: 1,

          activeStage: 1,

          stage1: {
            stage: 1,
            status: 'IN_PROGRESS'
          },

          stage2: {
            stage: 2,
            status: 'LOCKED'
          },

          stage3: {
            stage: 3,
            status: 'LOCKED'
          },

          externalSubmissionEnabled: false,

          createdAt: timestamp,
          updatedAt: timestamp
        };

        transaction.create(ref, created);

        return created;
      }
    );

    await this.appendAudit({
      eventId: randomUUID(),

      clientId,
      taxYear,

      actorUserId,
      actorRole,

      action: 'LIVE_WORKFLOW_CASE_ENSURED',

      result: 'success',

      serverTimestamp: nowIso()
    });

    return result;
  }

  static async completeStage(
    clientId: string,
    taxYear: number,
    stage: TaxGuardWorkflowStage,
    actorUserId: string,
    actorRole: string,
    expectedRevision: number
  ): Promise<TaxGuardLiveWorkflowCase> {

    assertClientId(clientId);
    assertTaxYear(taxYear);

    const db = getFirebaseAdminDb();

    const ref = db
      .collection(CASE_COLLECTION)
      .doc(caseDocumentId(clientId, taxYear));

    const updated = await db.runTransaction(
      async transaction => {

        const snapshot = await transaction.get(ref);

        if (!snapshot.exists) {
          throw new Error(
            'LIVE workflow case does not exist.'
          );
        }

        const current =
          snapshot.data() as TaxGuardLiveWorkflowCase;

        if (current.clientId !== clientId) {
          throw new Error('Client identity mismatch.');
        }

        if (current.environment !== 'live') {
          throw new Error('LIVE workflow required.');
        }

        if (current.revision !== expectedRevision) {
          throw new Error(
            'Workflow revision conflict. Refresh and retry.'
          );
        }

        /*
         * Sequential gate enforcement.
         */

        if (stage === 1) {

          if (current.stage1.status === 'COMPLETED') {
            return current;
          }

          current.stage1 = {
            stage: 1,
            status: 'COMPLETED',
            completedAt: nowIso(),
            completedBy: actorUserId
          };

          current.stage2 = {
            stage: 2,
            status: 'IN_PROGRESS'
          };

          current.activeStage = 2;

        } else if (stage === 2) {

          if (current.stage1.status !== 'COMPLETED') {
            throw new Error(
              'Stage 01 must be completed first.'
            );
          }

          if (current.stage2.status === 'COMPLETED') {
            return current;
          }

          current.stage2 = {
            stage: 2,
            status: 'COMPLETED',
            completedAt: nowIso(),
            completedBy: actorUserId
          };

          current.stage3 = {
            stage: 3,
            status: 'IN_PROGRESS'
          };

          current.activeStage = 3;

        } else if (stage === 3) {

          if (
            current.stage1.status !== 'COMPLETED' ||
            current.stage2.status !== 'COMPLETED'
          ) {
            throw new Error(
              'Stages 01 and 02 must be completed first.'
            );
          }

          current.stage3 = {
            stage: 3,
            status: 'COMPLETED',
            completedAt: nowIso(),
            completedBy: actorUserId
          };

          /*
           * M5 intentionally stops here.
           * A later milestone owns Stage 04+.
           */

          current.activeStage = 3;
        }

        current.revision += 1;
        current.updatedAt = nowIso();

        transaction.set(ref, current);

        return current;
      }
    );

    await this.appendAudit({
      eventId: randomUUID(),

      clientId,
      taxYear,

      actorUserId,
      actorRole,

      action: \`STAGE_\${stage}_SERVER_COMPLETED\`,
      stage,

      result: 'success',

      serverTimestamp: nowIso(),

      metadata: {
        revision: updated.revision
      }
    });

    return updated;
  }

  static async appendAudit(
    event: TaxGuardWorkflowAuditEvent
  ): Promise<void> {

    const db = getFirebaseAdminDb();

    await db
      .collection(AUDIT_COLLECTION)
      .doc(event.eventId)
      .create(event);
  }
}
`
);

/*
==============================================================
M5-003
AUTHENTICATED LIVE WORKFLOW ROUTES

The request does NOT accept a clientId from the browser.
The permanent Client ID comes from req.user.
==============================================================
*/

write(
  "src/server/routes/live-workflow.routes.ts",
`import { Router } from 'express';

import { authenticateToken } from '../auth';

import { LiveWorkflowRepository } from '../taxguard/liveWorkflow.repository';

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

export default router;
`
);

/*
==============================================================
M5-004
CLIENT API SERVICE

READ-ONLY workflow authority at M5 foundation.
==============================================================
*/

write(
  "src/services/liveWorkflowApi.ts",
`export interface LiveWorkflowStageState {
  stage: 1 | 2 | 3;

  status:
    | 'LOCKED'
    | 'IN_PROGRESS'
    | 'READY_FOR_REVIEW'
    | 'COMPLETED';

  completedAt?: string;
  completedBy?: string;
}

export interface LiveWorkflowState {
  clientId: string;
  taxYear: number;

  environment: 'live';

  revision: number;

  activeStage: 1 | 2 | 3;

  stage1: LiveWorkflowStageState;
  stage2: LiveWorkflowStageState;
  stage3: LiveWorkflowStageState;

  externalSubmissionEnabled: false;

  createdAt: string;
  updatedAt: string;
}

export class LiveWorkflowApi {

  static async getState(
    taxYear: number
  ): Promise<LiveWorkflowState> {

    const token =
      localStorage.getItem('taxguard_token');

    if (!token) {
      throw new Error(
        'Authenticated TaxGuard session required.'
      );
    }

    const response = await fetch(
      \`/api/live-workflow/state?taxYear=\${encodeURIComponent(
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
        'Unable to load LIVE workflow state.'
      );
    }

    const payload = await response.json();

    return payload.workflow as LiveWorkflowState;
  }
}
`
);

/*
==============================================================
M5-005
REGISTER ROUTE

We inspect ONLY the known server entry candidates.
No repository scan.
==============================================================
*/

const candidates = [
  "src/server/index.ts",
  "src/server/server.ts",
  "src/server/app.ts"
];

let serverEntry = null;

for (const candidate of candidates) {

  const absolute = path.join(ROOT, candidate);

  if (fs.existsSync(absolute)) {
    const text = fs.readFileSync(absolute, "utf8");

    if (
      text.includes("auth.routes") ||
      text.includes("intake.routes") ||
      text.includes("documents.routes")
    ) {
      serverEntry = candidate;
      break;
    }
  }
}

if (!serverEntry) {
  stop(
    "Could not identify the current server route-registration file. " +
    "M5 source files were created, but route registration was NOT guessed."
  );
}

let server = read(serverEntry);

if (!server.includes("live-workflow.routes")) {

  const imports = [
    "auth.routes",
    "intake.routes",
    "documents.routes"
  ];

  let importAnchor = null;

  for (const marker of imports) {
    const lines = server.split(/\r?\n/);

    const index = lines.findIndex(
      line =>
        line.includes("import") &&
        line.includes(marker)
    );

    if (index !== -1) {
      importAnchor = {
        lines,
        index
      };
      break;
    }
  }

  if (!importAnchor) {
    stop(
      "Server import anchor not found. " +
      "Route registration will not be guessed."
    );
  }

  const { lines, index } = importAnchor;

  lines.splice(
    index + 1,
    0,
    "import liveWorkflowRoutes from './routes/live-workflow.routes';"
  );

  server = lines.join("\n");

  /*
   * Find the existing /api route registrations.
   */

  const routeLines = server.split("\n");

  const useIndex = routeLines.findIndex(
    line =>
      line.includes(".use(") &&
      line.includes("/api/")
  );

  if (useIndex === -1) {
    stop(
      "Server API registration anchor not found."
    );
  }

  routeLines.splice(
    useIndex,
    0,
    "app.use('/api/live-workflow', liveWorkflowRoutes);"
  );

  server = routeLines.join("\n");

  write(serverEntry, server);

  console.log(
    `PASS M5 route registered in ${serverEntry}`
  );

} else {

  console.log("INFO M5 route already registered");
}

/*
==============================================================
M5-006
STATIC SECURITY ASSERTIONS
==============================================================
*/

const route = read(
  "src/server/routes/live-workflow.routes.ts"
);

const repository = read(
  "src/server/taxguard/liveWorkflow.repository.ts"
);

const assertions = [
  [
    "Authenticated workflow route",
    route.includes("authenticateToken")
  ],

  [
    "Browser clientId ignored",
    !route.includes("req.body?.clientId") &&
    !route.includes("req.query.clientId")
  ],

  [
    "Permanent Client ID server-derived",
    route.includes("req.user?.clientId")
  ],

  [
    "DEMO denied from LIVE API",
    route.includes("cli_perotti")
  ],

  [
    "Direct browser stage completion blocked",
    route.includes("STAGE_GATE_REQUIRED")
  ],

  [
    "Firestore transaction used",
    repository.includes("runTransaction")
  ],

  [
    "Revision conflict enforced",
    repository.includes(
      "Workflow revision conflict"
    )
  ],

  [
    "Stage 01 required before Stage 02",
    repository.includes(
      "Stage 01 must be completed first."
    )
  ],

  [
    "Stage 01+02 required before Stage 03",
    repository.includes(
      "Stages 01 and 02 must be completed first."
    )
  ],

  [
    "External submission hard-disabled",
    repository.includes(
      "externalSubmissionEnabled: false"
    )
  ],

  [
    "Server audit collection present",
    repository.includes(
      "taxguard_live_audit"
    )
  ]
];

console.log("");
console.log("M5 SECURITY ASSERTIONS");
console.log("----------------------");

let failed = false;

for (const [name, ok] of assertions) {

  console.log(
    `${ok ? "PASS" : "FAIL"} ${name}`
  );

  if (!ok) failed = true;
}

if (failed) {
  stop("M5 security assertion failed.");
}

console.log("");
console.log("============================================================");
console.log(" M5 SOURCE FOUNDATION INSTALLED");
console.log("============================================================");
console.log("");
console.log("Backup:");
console.log(backupDir);
console.log("");
console.log("No OpenAI API used.");
console.log("No AutoFix used.");
console.log("No Client 006 created.");
console.log("External submission remains disabled.");
console.log("");
