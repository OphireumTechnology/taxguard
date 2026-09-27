import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  "backups",
  `m5-4-firestore-ui-authority-${stamp}`
);

fs.mkdirSync(backupDir, { recursive: true });

function stop(message) {
  console.error("");
  console.error("============================================================");
  console.error(" TAXGUARD M5.4 STOPPED SAFELY");
  console.error("============================================================");
  console.error(message);
  console.error("");
  process.exit(1);
}

function abs(relative) {
  return path.join(ROOT, relative);
}

function exists(relative) {
  return fs.existsSync(abs(relative));
}

function read(relative) {
  if (!exists(relative)) {
    stop(`Required file missing: ${relative}`);
  }

  return fs.readFileSync(abs(relative), "utf8");
}

function backup(relative) {
  if (!exists(relative)) return;

  const destination = path.join(
    backupDir,
    relative
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true }
  );

  fs.copyFileSync(
    abs(relative),
    destination
  );
}

function write(relative, content) {
  backup(relative);

  fs.mkdirSync(
    path.dirname(abs(relative)),
    { recursive: true }
  );

  fs.writeFileSync(
    abs(relative),
    content,
    "utf8"
  );

  console.log(`WRITE ${relative}`);
}

console.log(`
============================================================
 TAXGUARD M5.4
 FIRESTORE-AUTHORITATIVE LIVE UI
============================================================

FROZEN / PRESERVE
-----------------
M1 LIVE Routing
M2 Stage 01 ONBOARD
M3 Stage 02 COLLECT
M4 Stage 03 VALIDATE
M5 Firestore Workflow
M5.2 Gate Bridge
M5.3 Server Gate Layer

OBJECTIVE
---------
LIVE workflow authority:

Firebase Authentication
        |
TaxGuard Server Session
        |
Permanent Client ID
        |
Firestore Workflow State
        |
Authenticated Workflow API
        |
React UI

Browser workflow flags are NOT authority.

DEMO remains isolated.

External submission remains DISABLED.

============================================================
`);

fs.writeFileSync(
  path.join(ROOT, "M5_4_BACKUP_PATH.txt"),
  backupDir,
  "utf8"
);

/*
==============================================================
M5.4-001
LIVE WORKFLOW AUTHORITY STORE

This is UI state hydrated from the server.

It does NOT persist workflow authority to localStorage.
==============================================================
*/

write(
  "src/services/liveWorkflowAuthority.ts",
`import {
  LiveWorkflowApi,
  LiveWorkflowEligibility,
  LiveWorkflowState
} from './liveWorkflowApi';

export type LiveWorkflowAuthorityStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

export interface LiveWorkflowAuthoritySnapshot {
  status: LiveWorkflowAuthorityStatus;

  taxYear: number | null;

  workflow: LiveWorkflowState | null;

  eligibility: LiveWorkflowEligibility | null;

  error: string | null;
}

type Listener =
  (snapshot: LiveWorkflowAuthoritySnapshot) => void;

let snapshot: LiveWorkflowAuthoritySnapshot = {
  status: 'idle',
  taxYear: null,
  workflow: null,
  eligibility: null,
  error: null
};

const listeners = new Set<Listener>();

function publish(): void {
  for (const listener of listeners) {
    listener(snapshot);
  }
}

function update(
  patch: Partial<LiveWorkflowAuthoritySnapshot>
): void {

  snapshot = {
    ...snapshot,
    ...patch
  };

  publish();
}

export class LiveWorkflowAuthority {

  static getSnapshot():
    LiveWorkflowAuthoritySnapshot {

    return snapshot;
  }

  static subscribe(
    listener: Listener
  ): () => void {

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  static async hydrate(
    taxYear: number
  ): Promise<LiveWorkflowAuthoritySnapshot> {

    update({
      status: 'loading',
      taxYear,
      error: null
    });

    try {

      /*
       * Both resources are read from authenticated
       * server APIs.
       *
       * No browser workflow-completion flag is read.
       */

      const [
        workflow,
        eligibility
      ] = await Promise.all([
        LiveWorkflowApi.getState(taxYear),
        LiveWorkflowApi.getEligibility(taxYear)
      ]);

      if (
        workflow.clientId !==
        eligibility.clientId
      ) {
        throw new Error(
          'LIVE workflow identity mismatch.'
        );
      }

      if (
        workflow.taxYear !==
        eligibility.taxYear
      ) {
        throw new Error(
          'LIVE workflow tax-year mismatch.'
        );
      }

      if (
        workflow.revision !==
        eligibility.revision
      ) {
        /*
         * Fail closed instead of trusting stale UI state.
         */
        throw new Error(
          'LIVE workflow revision changed. Refresh required.'
        );
      }

      update({
        status: 'ready',
        taxYear,
        workflow,
        eligibility,
        error: null
      });

      return snapshot;

    } catch (error) {

      update({
        status: 'error',

        workflow: null,
        eligibility: null,

        error:
          error instanceof Error
            ? error.message
            : 'Unable to hydrate LIVE workflow.'
      });

      throw error;
    }
  }

  static clear(): void {

    /*
     * Memory-only cleanup.
     *
     * No authoritative LIVE workflow state is written
     * to browser storage.
     */

    snapshot = {
      status: 'idle',
      taxYear: null,
      workflow: null,
      eligibility: null,
      error: null
    };

    publish();
  }

  static canEnterStage(
    stage: 1 | 2 | 3
  ): boolean {

    if (
      snapshot.status !== 'ready' ||
      !snapshot.eligibility
    ) {
      return false;
    }

    if (stage === 1) {
      return snapshot.eligibility
        .eligibility.stage1;
    }

    if (stage === 2) {
      return snapshot.eligibility
        .eligibility.stage2;
    }

    return snapshot.eligibility
      .eligibility.stage3;
  }

  static getActiveStage():
    1 | 2 | 3 | null {

    if (
      snapshot.status !== 'ready' ||
      !snapshot.workflow
    ) {
      return null;
    }

    return snapshot.workflow.activeStage;
  }
}
`
);

/*
==============================================================
M5.4-002
REACT HOOK

LIVE React components can now consume server state without
using localStorage workflow flags.
==============================================================
*/

write(
  "src/hooks/useLiveWorkflowAuthority.ts",
`import {
  useCallback,
  useEffect,
  useState
} from 'react';

import {
  LiveWorkflowAuthority,
  LiveWorkflowAuthoritySnapshot
} from '../services/liveWorkflowAuthority';

export function useLiveWorkflowAuthority(
  taxYear: number | null
) {

  const [
    state,
    setState
  ] = useState<LiveWorkflowAuthoritySnapshot>(
    LiveWorkflowAuthority.getSnapshot()
  );

  useEffect(() => {

    return LiveWorkflowAuthority.subscribe(
      setState
    );

  }, []);

  useEffect(() => {

    if (!taxYear) {
      return;
    }

    LiveWorkflowAuthority
      .hydrate(taxYear)
      .catch(() => {
        /*
         * Error is stored by authority service.
         *
         * Fail closed:
         * no stage becomes eligible.
         */
      });

  }, [taxYear]);

  const refresh =
    useCallback(async () => {

      if (!taxYear) {
        return null;
      }

      return LiveWorkflowAuthority
        .hydrate(taxYear);

    }, [taxYear]);

  return {
    ...state,

    refresh,

    canEnterStage:
      (stage: 1 | 2 | 3) =>
        LiveWorkflowAuthority
          .canEnterStage(stage),

    activeStage:
      LiveWorkflowAuthority
        .getActiveStage()
  };
}
`
);

/*
==============================================================
M5.4-003
LIVE WORKFLOW ROUTE GUARD

Routing decisions are based only on hydrated server
eligibility.

No localStorage workflow flag is accepted.
==============================================================
*/

write(
  "src/services/liveWorkflowRouteGuard.ts",
`import {
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
`
);

/*
==============================================================
M5.4-004
SERVER WORKFLOW STATE CONSISTENCY

Eligibility and state must come from the same authoritative
workflow record.

No client supplied stage completion.
==============================================================
*/

const routeFile =
  "src/server/routes/live-workflow.routes.ts";

let route = read(routeFile);

if (!route.includes("STAGE_GATE_REQUIRED")) {
  stop(
    "M5/M5.2 browser-completion protection is missing."
  );
}

if (!route.includes("'/eligibility'")) {
  stop(
    "M5.2 eligibility endpoint is missing."
  );
}

if (!route.includes("req.user?.clientId")) {
  stop(
    "Server-derived permanent Client ID protection missing."
  );
}

/*
 * Add no-store response protection to workflow reads.
 */

if (!route.includes("Cache-Control")) {

  const stateNeedle =
`      const workflow =
        await LiveWorkflowRepository.getOrCreateCase(`;

  const stateReplacement =
`      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate'
      );

      const workflow =
        await LiveWorkflowRepository.getOrCreateCase(`;

  const firstIndex =
    route.indexOf(stateNeedle);

  if (firstIndex === -1) {
    stop(
      "LIVE workflow state anchor changed. No guessed edit applied."
    );
  }

  route =
    route.slice(0, firstIndex) +
    route.slice(firstIndex)
      .replace(
        stateNeedle,
        stateReplacement
      );

  /*
   * Eligibility endpoint has another identical repository call.
   * Protect it too.
   */

  const eligibilityMarker =
    "router.get(\n  '/eligibility'";

  const eligibilityIndex =
    route.indexOf(eligibilityMarker);

  if (eligibilityIndex !== -1) {

    const before =
      route.slice(0, eligibilityIndex);

    let after =
      route.slice(eligibilityIndex);

    if (
      !after.includes(
        "'Cache-Control'"
      )
    ) {

      after = after.replace(
        stateNeedle,
        stateReplacement
      );

      route = before + after;
    }
  }

  write(
    routeFile,
    route
  );
}

/*
==============================================================
M5.4-005
ADD SERVER AUTHORITY TESTS
==============================================================
*/

write(
  "src/tests/liveWorkflowUiAuthority.test.ts",
`import {
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

        if (!decision.allowed) {
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

        if (!decision.allowed) {
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
`
);

/*
==============================================================
M5.4-006
STATIC SECURITY ASSERTIONS
==============================================================
*/

const authority = read(
  "src/services/liveWorkflowAuthority.ts"
);

const hook = read(
  "src/hooks/useLiveWorkflowAuthority.ts"
);

const guard = read(
  "src/services/liveWorkflowRouteGuard.ts"
);

route = read(routeFile);

const assertions = [
  [
    "LIVE authority service installed",
    authority.includes(
      "class LiveWorkflowAuthority"
    )
  ],

  [
    "Workflow state comes from server",
    authority.includes(
      "LiveWorkflowApi.getState"
    )
  ],

  [
    "Eligibility comes from server",
    authority.includes(
      "LiveWorkflowApi.getEligibility"
    )
  ],

  [
    "Workflow authority not written to localStorage",
    !authority.includes(
      "localStorage.setItem"
    )
  ],

  [
    "LIVE React hook installed",
    hook.includes(
      "useLiveWorkflowAuthority"
    )
  ],

  [
    "LIVE route guard installed",
    guard.includes(
      "guardLiveWorkflowStage"
    )
  ],

  [
    "Route guard fails closed",
    guard.includes(
      "Authoritative LIVE workflow state is not available"
    )
  ],

  [
    "Stage 02 uses server eligibility",
    guard.includes(
      "eligibility.stage2"
    )
  ],

  [
    "Stage 03 uses server eligibility",
    guard.includes(
      "eligibility.stage3"
    )
  ],

  [
    "Direct browser completion remains blocked",
    route.includes(
      "STAGE_GATE_REQUIRED"
    )
  ],

  [
    "Permanent Client ID remains server-derived",
    route.includes(
      "req.user?.clientId"
    )
  ],

  [
    "External submission remains disabled",
    route.includes(
      "externalSubmissionEnabled: false"
    )
  ]
];

console.log("");
console.log("M5.4 SECURITY ASSERTIONS");
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
    "One or more M5.4 assertions failed."
  );
}

console.log("");
console.log("============================================================");
console.log(" M5.4 SOURCE FOUNDATION APPLIED");
console.log("============================================================");
console.log("");
console.log("Backup:");
console.log(backupDir);
console.log("");
console.log("LIVE workflow authority service installed.");
console.log("Server eligibility route guard installed.");
console.log("LIVE React hydration hook installed.");
console.log("Browser workflow flags are not authority.");
console.log("Direct browser completion remains blocked.");
console.log("DEMO architecture was not modified.");
console.log("External submission remains disabled.");
console.log("No OpenAI API used.");
console.log("No AutoFix used.");
console.log("No Client 006 created.");
console.log("");
