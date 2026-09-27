import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join(
  ROOT,
  "backups",
  `m5-3-stage-gates-${stamp}`
);

fs.mkdirSync(backupDir, { recursive: true });

function stop(message) {
  console.error("");
  console.error("============================================================");
  console.error(" TAXGUARD M5.3 STOPPED SAFELY");
  console.error("============================================================");
  console.error(message);
  console.error("");
  process.exit(1);
}

function absolute(relative) {
  return path.join(ROOT, relative);
}

function exists(relative) {
  return fs.existsSync(absolute(relative));
}

function read(relative) {
  if (!exists(relative)) {
    stop(`Required file missing: ${relative}`);
  }

  return fs.readFileSync(absolute(relative), "utf8");
}

function backup(relative) {
  if (!exists(relative)) return;

  const destination = path.join(backupDir, relative);

  fs.mkdirSync(path.dirname(destination), {
    recursive: true
  });

  fs.copyFileSync(
    absolute(relative),
    destination
  );
}

function write(relative, content) {
  backup(relative);

  fs.mkdirSync(
    path.dirname(absolute(relative)),
    { recursive: true }
  );

  fs.writeFileSync(
    absolute(relative),
    content,
    "utf8"
  );

  console.log(`WRITE ${relative}`);
}

console.log(`
============================================================
 TAXGUARD M5.3
 TRUSTED STAGE GATES -> FIRESTORE TRANSITIONS
============================================================

PRESERVE
--------
M1 LIVE Routing
M2 Stage 01
M3 Stage 02
M4 Stage 03
M5 Firestore workflow
M5.2 trusted gate bridge

BUILD
-----
Server Stage 01 gate adapter
Server Stage 02 gate adapter
Server Stage 03 gate adapter
Trusted transition coordinator
Server audit evidence
Replay/idempotency protection
Role restrictions
Sequential enforcement
Gate-specific evidence contracts

PROHIBITED
----------
Browser-controlled completion
Browser-supplied Client ID
DEMO -> LIVE fallback
Skipping stages
Fake completion
External tax submission

============================================================
`);

fs.writeFileSync(
  path.join(ROOT, "M5_3_BACKUP_PATH.txt"),
  backupDir,
  "utf8"
);

/*
==============================================================
M5.3-001
DEFINE SERVER GATE RESULT CONTRACTS
==============================================================
*/

write(
  "src/server/taxguard/stageGate.types.ts",
`import {
  TaxGuardWorkflowStage
} from './liveWorkflow.types';

export interface StageGateEvidence {
  source: string;

  evaluatedAt: string;

  checks: Record<string, boolean>;

  blockingReasons: string[];

  metadata?: Record<string, unknown>;
}

export interface StageGateDecision {
  stage: TaxGuardWorkflowStage;

  passed: boolean;

  gateName: string;

  evidence: StageGateEvidence;
}

export interface StageTransitionActor {
  userId: string;
  role: string;
}

export interface StageTransitionContext {
  clientId: string;
  taxYear: number;

  expectedRevision: number;

  actor: StageTransitionActor;
}
`
);

/*
==============================================================
M5.3-002
STAGE 01 SERVER GATE ADAPTER

M5.3 does not recreate the Stage 01 rules.

It accepts the authoritative Stage 01 gate result and refuses
to persist a transition unless that result explicitly passed.
==============================================================
*/

write(
  "src/server/taxguard/stageOneServerGate.ts",
`import {
  StageGateDecision
} from './stageGate.types';

export interface StageOneGateSnapshot {
  hardExitGatePassed: boolean;

  identityComplete: boolean;
  taxProfileComplete: boolean;
  consentComplete: boolean;
  reviewComplete: boolean;

  blockingReasons?: string[];
}

export function evaluateStageOneServerGate(
  snapshot: StageOneGateSnapshot
): StageGateDecision {

  const checks = {
    identityComplete:
      snapshot.identityComplete === true,

    taxProfileComplete:
      snapshot.taxProfileComplete === true,

    consentComplete:
      snapshot.consentComplete === true,

    reviewComplete:
      snapshot.reviewComplete === true,

    existingHardExitGatePassed:
      snapshot.hardExitGatePassed === true
  };

  const blockingReasons = [
    ...(snapshot.blockingReasons || [])
  ];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(
        \`Stage 01 requirement failed: \${name}\`
      );
    }
  }

  return {
    stage: 1,

    passed:
      Object.values(checks).every(Boolean) &&
      blockingReasons.length === 0,

    gateName: 'STAGE_01_HARD_EXIT_GATE',

    evidence: {
      source: 'StageOneOnboardingService',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons
    }
  };
}
`
);

/*
==============================================================
M5.3-003
STAGE 02 SERVER GATE ADAPTER

Preserve deterministic completeness + professional
certification requirements.
==============================================================
*/

write(
  "src/server/taxguard/stageTwoServerGate.ts",
`import {
  StageGateDecision
} from './stageGate.types';

export interface StageTwoGateSnapshot {
  completenessPassed: boolean;

  unresolvedBlockingExceptions: number;

  reconciliationPassed: boolean;

  professionalCertificationPassed: boolean;

  hardExitGatePassed: boolean;

  blockingReasons?: string[];
}

export function evaluateStageTwoServerGate(
  snapshot: StageTwoGateSnapshot
): StageGateDecision {

  const checks = {
    completenessPassed:
      snapshot.completenessPassed === true,

    noBlockingExceptions:
      snapshot.unresolvedBlockingExceptions === 0,

    reconciliationPassed:
      snapshot.reconciliationPassed === true,

    professionalCertificationPassed:
      snapshot.professionalCertificationPassed === true,

    existingHardExitGatePassed:
      snapshot.hardExitGatePassed === true
  };

  const blockingReasons = [
    ...(snapshot.blockingReasons || [])
  ];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(
        \`Stage 02 requirement failed: \${name}\`
      );
    }
  }

  return {
    stage: 2,

    passed:
      Object.values(checks).every(Boolean) &&
      blockingReasons.length === 0,

    gateName: 'STAGE_02_HARD_EXIT_GATE',

    evidence: {
      source:
        'StageTwoCollectionOperationsService',

      evaluatedAt:
        new Date().toISOString(),

      checks,
      blockingReasons,

      metadata: {
        unresolvedBlockingExceptions:
          snapshot.unresolvedBlockingExceptions
      }
    }
  };
}
`
);

/*
==============================================================
M5.3-004
STAGE 03 SERVER GATE ADAPTER

AI/model output alone can never satisfy this gate.
==============================================================
*/

write(
  "src/server/taxguard/stageThreeServerGate.ts",
`import {
  StageGateDecision
} from './stageGate.types';

export interface StageThreeGateSnapshot {
  validationComplete: boolean;

  provenanceComplete: boolean;

  unresolvedBlockingExceptions: number;

  humanReviewRequired: boolean;

  humanReviewApproved: boolean;

  hardExitGatePassed: boolean;

  aiOnlyDecision?: boolean;

  blockingReasons?: string[];
}

export function evaluateStageThreeServerGate(
  snapshot: StageThreeGateSnapshot
): StageGateDecision {

  const humanReviewSatisfied =
    snapshot.humanReviewRequired
      ? snapshot.humanReviewApproved === true
      : true;

  const checks = {
    validationComplete:
      snapshot.validationComplete === true,

    provenanceComplete:
      snapshot.provenanceComplete === true,

    noBlockingExceptions:
      snapshot.unresolvedBlockingExceptions === 0,

    humanReviewSatisfied,

    notAiOnly:
      snapshot.aiOnlyDecision !== true,

    existingHardExitGatePassed:
      snapshot.hardExitGatePassed === true
  };

  const blockingReasons = [
    ...(snapshot.blockingReasons || [])
  ];

  for (const [name, passed] of Object.entries(checks)) {
    if (!passed) {
      blockingReasons.push(
        \`Stage 03 requirement failed: \${name}\`
      );
    }
  }

  return {
    stage: 3,

    passed:
      Object.values(checks).every(Boolean) &&
      blockingReasons.length === 0,

    gateName: 'STAGE_03_HARD_EXIT_GATE',

    evidence: {
      source:
        'StageThreeValidationService',

      evaluatedAt:
        new Date().toISOString(),

      checks,
      blockingReasons,

      metadata: {
        unresolvedBlockingExceptions:
          snapshot.unresolvedBlockingExceptions,

        humanReviewRequired:
          snapshot.humanReviewRequired,

        humanReviewApproved:
          snapshot.humanReviewApproved,

        aiOnlyDecision:
          snapshot.aiOnlyDecision === true
      }
    }
  };
}
`
);

/*
==============================================================
M5.3-005
TRUSTED TRANSITION COORDINATOR

This is the only M5.3 component that connects a verified
gate decision to the M5.2 bridge.
==============================================================
*/

write(
  "src/server/taxguard/stageTransitionCoordinator.ts",
`import {
  persistPassedStageGate
} from './stageGateBridge';

import {
  TaxGuardLiveWorkflowCase
} from './liveWorkflow.types';

import {
  StageGateDecision,
  StageTransitionContext
} from './stageGate.types';

const ALLOWED_SERVER_GATE_ROLES =
  new Set([
    'client',
    'preparer',
    'reviewer',
    'admin'
  ]);

export class StageTransitionCoordinator {

  static async persistDecision(
    context: StageTransitionContext,
    decision: StageGateDecision
  ): Promise<TaxGuardLiveWorkflowCase> {

    if (!context.clientId?.trim()) {
      throw new Error(
        'Permanent TaxGuard Client ID required.'
      );
    }

    if (
      !ALLOWED_SERVER_GATE_ROLES.has(
        context.actor.role
      )
    ) {
      throw new Error(
        'Actor role is not authorized for workflow transitions.'
      );
    }

    if (!decision.passed) {
      throw new Error(
        \`\${decision.gateName} did not pass.\`
      );
    }

    if (
      decision.evidence.blockingReasons.length > 0
    ) {
      throw new Error(
        'Gate contains unresolved blocking reasons.'
      );
    }

    if (
      !Object.values(
        decision.evidence.checks
      ).every(Boolean)
    ) {
      throw new Error(
        'Gate evidence contains failed checks.'
      );
    }

    return persistPassedStageGate({
      clientId:
        context.clientId.trim(),

      taxYear:
        context.taxYear,

      stage:
        decision.stage,

      actorUserId:
        context.actor.userId,

      actorRole:
        context.actor.role,

      expectedRevision:
        context.expectedRevision,

      gatePassed:
        true,

      gateName:
        decision.gateName,

      evidence: {
        source:
          decision.evidence.source,

        evaluatedAt:
          decision.evidence.evaluatedAt,

        checks:
          decision.evidence.checks,

        metadata:
          decision.evidence.metadata || {}
      }
    });
  }
}
`
);

/*
==============================================================
M5.3-006
SERVER-INTERNAL STAGE GATE ORCHESTRATOR

No Express/browser route is added.

Existing server-side stage handlers can call these functions
after obtaining their actual hard-gate snapshots.
==============================================================
*/

write(
  "src/server/taxguard/serverStageGateOrchestrator.ts",
`import {
  StageTransitionCoordinator
} from './stageTransitionCoordinator';

import {
  StageTransitionContext
} from './stageGate.types';

import {
  StageOneGateSnapshot,
  evaluateStageOneServerGate
} from './stageOneServerGate';

import {
  StageTwoGateSnapshot,
  evaluateStageTwoServerGate
} from './stageTwoServerGate';

import {
  StageThreeGateSnapshot,
  evaluateStageThreeServerGate
} from './stageThreeServerGate';

export class ServerStageGateOrchestrator {

  static async commitStageOne(
    context: StageTransitionContext,
    snapshot: StageOneGateSnapshot
  ) {

    const decision =
      evaluateStageOneServerGate(snapshot);

    return StageTransitionCoordinator
      .persistDecision(
        context,
        decision
      );
  }

  static async commitStageTwo(
    context: StageTransitionContext,
    snapshot: StageTwoGateSnapshot
  ) {

    const decision =
      evaluateStageTwoServerGate(snapshot);

    return StageTransitionCoordinator
      .persistDecision(
        context,
        decision
      );
  }

  static async commitStageThree(
    context: StageTransitionContext,
    snapshot: StageThreeGateSnapshot
  ) {

    const decision =
      evaluateStageThreeServerGate(snapshot);

    return StageTransitionCoordinator
      .persistDecision(
        context,
        decision
      );
  }
}
`
);

/*
==============================================================
M5.3-007
ADD GATE EVIDENCE TO AUDIT METADATA

M5 repository already writes the durable audit event.
M5.3 passes gate evidence into the trusted bridge.

Patch the bridge so evidence is forwarded.
==============================================================
*/

const bridgeFile =
  "src/server/taxguard/stageGateBridge.ts";

let bridge = read(bridgeFile);

if (
  !bridge.includes(
    "gateEvidence: input.evidence"
  )
) {

  const needle =
`    gatePassed: true,
    gateName: input.gateName,`;

  const replacement =
`    gatePassed: true,
    gateName: input.gateName,
    gateEvidence: input.evidence,`;

  if (!bridge.includes(needle)) {
    stop(
      "M5.2 stageGateBridge source differs from expected checkpoint."
    );
  }

  bridge = bridge.replace(
    needle,
    replacement
  );

  write(
    bridgeFile,
    bridge
  );
}

/*
==============================================================
M5.3-008
MAKE REPOSITORY AUDIT RECEIVE GATE EVIDENCE

Extend completeStage with optional evidence.
==============================================================
*/

const repoFile =
  "src/server/taxguard/liveWorkflow.repository.ts";

let repo = read(repoFile);

const signatureOld =
`    actorRole: string,
    expectedRevision: number
  ): Promise<TaxGuardLiveWorkflowCase> {`;

const signatureNew =
`    actorRole: string,
    expectedRevision: number,
    gateEvidence?: Record<string, unknown>
  ): Promise<TaxGuardLiveWorkflowCase> {`;

if (
  repo.includes(signatureOld) &&
  !repo.includes(
    "gateEvidence?: Record<string, unknown>"
  )
) {

  repo = repo.replace(
    signatureOld,
    signatureNew
  );
}

const metadataOld =
`      metadata: {
        revision: updated.revision
      }`;

const metadataNew =
`      metadata: {
        revision: updated.revision,
        gateEvidence: gateEvidence || {}
      }`;

if (
  repo.includes(metadataOld) &&
  !repo.includes(
    "gateEvidence: gateEvidence || {}"
  )
) {

  repo = repo.replace(
    metadataOld,
    metadataNew
  );
}

write(
  repoFile,
  repo
);

/*
==============================================================
M5.3-009
FORWARD EVIDENCE FROM GATE SERVICE TO REPOSITORY
==============================================================
*/

const gateServiceFile =
  "src/server/taxguard/liveWorkflowGate.service.ts";

let gateService =
  read(gateServiceFile);

const callOld =
`        input.actorRole,
        input.expectedRevision
      );`;

const callNew =
`        input.actorRole,
        input.expectedRevision,
        input.gateEvidence
      );`;

if (
  gateService.includes(callOld)
) {

  gateService =
    gateService.replace(
      callOld,
      callNew
    );

  write(
    gateServiceFile,
    gateService
  );

} else if (
  !gateService.includes(
    "input.gateEvidence"
  )
) {

  stop(
    "M5.2 gate service call differs from expected checkpoint."
  );
}

/*
==============================================================
M5.3-010
TESTS
==============================================================
*/

write(
  "src/tests/serverStageGateOrchestrator.test.ts",
`import {
  describe,
  expect,
  it
} from 'vitest';

import {
  evaluateStageOneServerGate
} from '../server/taxguard/stageOneServerGate';

import {
  evaluateStageTwoServerGate
} from '../server/taxguard/stageTwoServerGate';

import {
  evaluateStageThreeServerGate
} from '../server/taxguard/stageThreeServerGate';

describe(
  'TaxGuard M5.3 server stage gates',
  () => {

    it(
      'passes Stage 01 only when every requirement and hard gate pass',
      () => {

        const result =
          evaluateStageOneServerGate({
            hardExitGatePassed: true,
            identityComplete: true,
            taxProfileComplete: true,
            consentComplete: true,
            reviewComplete: true
          });

        expect(result.passed).toBe(true);
        expect(result.stage).toBe(1);
      }
    );

    it(
      'blocks incomplete Stage 01',
      () => {

        const result =
          evaluateStageOneServerGate({
            hardExitGatePassed: false,
            identityComplete: true,
            taxProfileComplete: false,
            consentComplete: true,
            reviewComplete: true
          });

        expect(result.passed).toBe(false);

        expect(
          result.evidence.blockingReasons.length
        ).toBeGreaterThan(0);
      }
    );

    it(
      'requires deterministic Stage 02 completeness',
      () => {

        const result =
          evaluateStageTwoServerGate({
            completenessPassed: false,
            unresolvedBlockingExceptions: 0,
            reconciliationPassed: true,
            professionalCertificationPassed: true,
            hardExitGatePassed: true
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'blocks Stage 02 unresolved exceptions',
      () => {

        const result =
          evaluateStageTwoServerGate({
            completenessPassed: true,
            unresolvedBlockingExceptions: 1,
            reconciliationPassed: true,
            professionalCertificationPassed: true,
            hardExitGatePassed: true
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'requires Stage 02 professional certification',
      () => {

        const result =
          evaluateStageTwoServerGate({
            completenessPassed: true,
            unresolvedBlockingExceptions: 0,
            reconciliationPassed: true,
            professionalCertificationPassed: false,
            hardExitGatePassed: true
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'allows fully satisfied Stage 02 gate',
      () => {

        const result =
          evaluateStageTwoServerGate({
            completenessPassed: true,
            unresolvedBlockingExceptions: 0,
            reconciliationPassed: true,
            professionalCertificationPassed: true,
            hardExitGatePassed: true
          });

        expect(result.passed).toBe(true);
      }
    );

    it(
      'blocks AI-only Stage 03 decisions',
      () => {

        const result =
          evaluateStageThreeServerGate({
            validationComplete: true,
            provenanceComplete: true,
            unresolvedBlockingExceptions: 0,
            humanReviewRequired: false,
            humanReviewApproved: false,
            hardExitGatePassed: true,
            aiOnlyDecision: true
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'requires human approval when Stage 03 review is required',
      () => {

        const result =
          evaluateStageThreeServerGate({
            validationComplete: true,
            provenanceComplete: true,
            unresolvedBlockingExceptions: 0,
            humanReviewRequired: true,
            humanReviewApproved: false,
            hardExitGatePassed: true,
            aiOnlyDecision: false
          });

        expect(result.passed).toBe(false);
      }
    );

    it(
      'allows Stage 03 after validation provenance and required review',
      () => {

        const result =
          evaluateStageThreeServerGate({
            validationComplete: true,
            provenanceComplete: true,
            unresolvedBlockingExceptions: 0,
            humanReviewRequired: true,
            humanReviewApproved: true,
            hardExitGatePassed: true,
            aiOnlyDecision: false
          });

        expect(result.passed).toBe(true);
      }
    );
  }
);
`
);

/*
==============================================================
M5.3-011
STATIC SECURITY ASSERTIONS
==============================================================
*/

const orchestrator = read(
  "src/server/taxguard/serverStageGateOrchestrator.ts"
);

const coordinator = read(
  "src/server/taxguard/stageTransitionCoordinator.ts"
);

const stage1 = read(
  "src/server/taxguard/stageOneServerGate.ts"
);

const stage2 = read(
  "src/server/taxguard/stageTwoServerGate.ts"
);

const stage3 = read(
  "src/server/taxguard/stageThreeServerGate.ts"
);

repo = read(repoFile);

const assertions = [
  [
    "Stage 01 server gate installed",
    stage1.includes(
      "evaluateStageOneServerGate"
    )
  ],

  [
    "Stage 02 server gate installed",
    stage2.includes(
      "evaluateStageTwoServerGate"
    )
  ],

  [
    "Stage 02 professional certification required",
    stage2.includes(
      "professionalCertificationPassed"
    )
  ],

  [
    "Stage 02 blocking exceptions enforced",
    stage2.includes(
      "unresolvedBlockingExceptions === 0"
    )
  ],

  [
    "Stage 03 server gate installed",
    stage3.includes(
      "evaluateStageThreeServerGate"
    )
  ],

  [
    "Stage 03 AI-only completion prohibited",
    stage3.includes(
      "notAiOnly"
    )
  ],

  [
    "Stage 03 human review enforced",
    stage3.includes(
      "humanReviewSatisfied"
    )
  ],

  [
    "Trusted coordinator installed",
    coordinator.includes(
      "StageTransitionCoordinator"
    )
  ],

  [
    "Failed decisions cannot persist",
    coordinator.includes(
      "if (!decision.passed)"
    )
  ],

  [
    "Blocking reasons cannot persist",
    coordinator.includes(
      "unresolved blocking reasons"
    )
  ],

  [
    "Failed evidence checks cannot persist",
    coordinator.includes(
      "Gate evidence contains failed checks"
    )
  ],

  [
    "Stage orchestrator installed",
    orchestrator.includes(
      "commitStageOne"
    ) &&
    orchestrator.includes(
      "commitStageTwo"
    ) &&
    orchestrator.includes(
      "commitStageThree"
    )
  ],

  [
    "Gate evidence added to audit",
    repo.includes(
      "gateEvidence: gateEvidence || {}"
    )
  ],

  [
    "External submission still disabled",
    repo.includes(
      "externalSubmissionEnabled: false"
    )
  ]
];

console.log("");
console.log("M5.3 SECURITY ASSERTIONS");
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
    "One or more M5.3 security assertions failed."
  );
}

console.log("");
console.log("============================================================");
console.log(" M5.3 SOURCE BUILD APPLIED");
console.log("============================================================");
console.log("");
console.log("Backup:");
console.log(backupDir);
console.log("");
console.log("Stage 01 server gate installed.");
console.log("Stage 02 server gate installed.");
console.log("Stage 03 server gate installed.");
console.log("Trusted transition coordinator installed.");
console.log("Gate evidence added to server audit.");
console.log("Browser completion remains blocked.");
console.log("External submission remains disabled.");
console.log("No OpenAI API used.");
console.log("No AutoFix used.");
console.log("No Client 006 created.");
console.log("");
