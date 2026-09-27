import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REPORT = path.join(ROOT, "TAXGUARD_FULL_DEVELOPMENT_STATUS.md");

function run(title, command, args) {
  console.log("\n============================================================");
  console.log(" " + title);
  console.log("============================================================\n");

  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: process.env
  });

  if ((result.status ?? 1) !== 0) {
    console.error("\nFAILED: " + title);
    process.exit(result.status ?? 1);
  }

  console.log("\nPASS: " + title);
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function requireFiles(title, files) {
  console.log("\n[" + title + "]");

  const missing = files.filter(file => !exists(file));

  for (const file of files) {
    console.log(
      (exists(file) ? "PASS " : "MISS ") + file
    );
  }

  if (missing.length) {
    console.error("\nMissing required architecture files:");
    for (const file of missing) console.error(" - " + file);
    process.exit(1);
  }
}

console.log(`
============================================================
 TAXGUARD FULL DEVELOPMENT VALIDATION
============================================================

POLICY
------
M1 LIVE Routing              PRESERVE
M2 Stage 01 ONBOARD          PRESERVE
M3 Stage 02 COLLECT          VALIDATE
M4 Stage 03 VALIDATE         VALIDATE
Intelligence Core            VALIDATE
Knowledge / Rules            VALIDATE
Governance                   VALIDATE
Security                     VALIDATE
Production Build             VALIDATE

OpenAI API                   DISABLED
AutoFix V1                   DISABLED
Client 006 creation          DISABLED
External tax submission      DISABLED
Demo -> LIVE fallback        PROHIBITED

No source code is automatically rewritten by this runner.
============================================================
`);

/*
 * ----------------------------------------------------------
 * ARCHITECTURE CHECK
 * ----------------------------------------------------------
 */

requireFiles("M1/M2 FOUNDATION", [
  "src/App.tsx",
  "src/context/AppContext.tsx",
  "src/firebase/config.ts",
  "src/firebase/auth.ts",
  "src/server/firebase-admin.ts",
  "src/server/routes/auth.routes.ts",
  "src/services/stageOneOnboardingService.ts"
]);

requireFiles("M3 STAGE 02 COLLECT", [
  "src/components/collection/StageTwoCollectionWorkspace.tsx",
  "src/components/collection/StageTwoExitGateView.tsx",
  "src/components/collection/StageTwoMissingDocumentsView.tsx",
  "src/components/collection/StageTwoDocumentRequestsView.tsx",
  "src/components/collection/StageTwoExceptionsView.tsx",
  "src/services/stageTwoCollectionService.ts",
  "src/services/stageTwoCollectionOperationsService.ts",
  "src/services/stageTwoDocumentIntelligenceService.ts",
  "src/services/stageTwoIntakeSecurityService.ts"
]);

requireFiles("M4 STAGE 03 VALIDATE", [
  "src/components/validation/StageThreeValidationWorkspace.tsx",
  "src/services/stageThreeValidationService.ts"
]);

requireFiles("INTELLIGENCE CORE", [
  "src/taxguard/intelligence/ai/AIReasoningGateway.ts",
  "src/taxguard/intelligence/review/HumanReviewBridge.ts",
  "src/taxguard/intelligence/decisions/DecisionApprovalOrchestrator.ts",
  "src/taxguard/intelligence/governance/IntelligenceGovernanceBoundary.ts"
]);

/*
 * ----------------------------------------------------------
 * STATIC SAFETY ASSERTIONS
 * ----------------------------------------------------------
 */

console.log("\n============================================================");
console.log(" LIVE WORKSPACE SAFETY");
console.log("============================================================\n");

const app = fs.readFileSync(
  path.join(ROOT, "src", "App.tsx"),
  "utf8"
);

const stage2 = fs.readFileSync(
  path.join(
    ROOT,
    "src",
    "components",
    "collection",
    "StageTwoCollectionWorkspace.tsx"
  ),
  "utf8"
);

const stage2Ops = fs.readFileSync(
  path.join(
    ROOT,
    "src",
    "services",
    "stageTwoCollectionOperationsService.ts"
  ),
  "utf8"
);

const safetyChecks = [
  [
    "App uses StageTwoCollectionWorkspace",
    app.includes("StageTwoCollectionWorkspace")
  ],
  [
    "Stage 01 hard gate enforced",
    app.includes("StageOneOnboardingService.hasPassedHardExitGate")
  ],
  [
    "LIVE permanent Client ID supplied to Stage 02",
    app.includes("clientId={permanentClientId}") ||
    app.includes("clientId={currentUser?.clientId}")
  ],
  [
    "Stage 02 has Stage 03 workspace",
    stage2.includes("StageThreeValidationWorkspace")
  ],
  [
    "Stage 02 has hard exit gate",
    stage2.includes("StageTwoExitGateView")
  ],
  [
    "Stage 02 gate can mark Stage 03 eligible",
    stage2Ops.includes("stageThreeStatus: 'ELIGIBLE'")
  ],
  [
    "Stage 02 gate requires completeness",
    stage2Ops.includes("if (!completeness.isComplete)")
  ],
  [
    "Stage 02 gate requires professional certification",
    stage2Ops.includes("certificationStatement")
  ]
];

let safetyFailed = false;

for (const [name, passed] of safetyChecks) {
  console.log(
    (passed ? "PASS" : "FAIL") + "  " + name
  );

  if (!passed) safetyFailed = true;
}

if (safetyFailed) {
  console.error(`
============================================================
 DEVELOPMENT STOPPED
============================================================

One or more LIVE workflow safety assertions failed.

No automated bypass will be applied.

The failing architecture must be repaired before continuing.
`);
  process.exit(1);
}

/*
 * ----------------------------------------------------------
 * TYPESCRIPT
 * ----------------------------------------------------------
 */

run(
  "TYPESCRIPT",
  "npm.cmd",
  ["run", "typecheck"]
);

/*
 * ----------------------------------------------------------
 * STAGE 02
 * ----------------------------------------------------------
 */

run(
  "M3 STAGE 02 COLLECTION TESTS",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/stageTwoCollection.test.ts",
    "src/tests/stageTwoSprintTwoSecurity.test.ts",
    "src/tests/stageTwoSprintThreeIntelligence.test.ts",
    "src/tests/stageTwoSprintFourOperations.test.ts",
    "--run"
  ]
);

/*
 * ----------------------------------------------------------
 * STAGE 03
 * ----------------------------------------------------------
 */

run(
  "M4 STAGE 03 VALIDATION TESTS",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/stageThreeValidationFoundation.test.ts",
    "src/tests/stageThreeSprintOne.test.ts",
    "src/tests/stageThreeSprintTwo.test.ts",
    "src/tests/stageThreeSprintThree.test.ts",
    "--run"
  ]
);

/*
 * ----------------------------------------------------------
 * FULL REGRESSION
 * ----------------------------------------------------------
 */

run(
  "FULL TAXGUARD TEST SUITE",
  "npm.cmd",
  ["test", "--", "--run"]
);

/*
 * ----------------------------------------------------------
 * PRODUCTION BUILD
 * ----------------------------------------------------------
 */

run(
  "PRODUCTION BUILD",
  "npm.cmd",
  ["run", "build"]
);

/*
 * ----------------------------------------------------------
 * FINAL TYPESCRIPT
 * ----------------------------------------------------------
 */

run(
  "FINAL TYPESCRIPT CHECK",
  "npm.cmd",
  ["run", "typecheck"]
);

/*
 * ----------------------------------------------------------
 * REPORT
 * ----------------------------------------------------------
 */

const report = `# TaxGuard Full Development Validation

Generated: ${new Date().toISOString()}

## Baseline

- M1 LIVE Routing: PASS / preserved
- M2 Stage 01 ONBOARD: PASS / preserved
- M3 Stage 02 COLLECT: PASS by automated validation
- M4 Stage 03 VALIDATE: PASS by automated validation

## Architecture

LIVE workflow:

Firebase Authentication
→ permanent TaxGuard Client ID
→ Stage 01 ONBOARD
→ Stage 01 hard exit gate
→ Stage 02 COLLECT
→ secure document intake
→ document intelligence
→ missing-document management
→ exceptions
→ human review
→ deterministic completeness
→ Stage 02 hard exit gate
→ Stage 03 VALIDATE eligibility

## Governance

- AI output remains proposed until governed validation/review.
- Stage 02 cannot be silently marked complete.
- Stage 03 eligibility requires the Stage 02 hard gate.
- Permanent Client ID is not generated by this runner.
- DEMO fallback was not introduced.
- External tax filing/submission was not enabled.
- No OpenAI API credits were used by this runner.

## Automated Validation

- TypeScript: PASS
- Stage 02 tests: PASS
- Stage 03 tests: PASS
- Full regression suite: PASS
- Production build: PASS
- Final TypeScript: PASS

## Important Production Work Remaining

Passing software tests does not by itself certify the platform for production tax preparation.

Remaining production-hardening areas include:

1. Persistent LIVE workflow state in server-authoritative storage.
2. Removal/isolation of remaining demo-oriented services from LIVE components.
3. Production document storage and malware scanning.
4. Production OCR/document-intelligence provider integration.
5. Tax-year-versioned authoritative knowledge sources.
6. Federal and state calculation-engine validation.
7. Human reviewer authorization and maker-checker enforcement.
8. Immutable production audit storage.
9. Security/privacy/compliance validation.
10. Controlled production deployment and operational monitoring.
`;

fs.writeFileSync(REPORT, report, "utf8");

console.log(`
============================================================
 TAXGUARD DEVELOPMENT VALIDATION PASSED
============================================================

M1 LIVE ROUTING                 PASS
M2 STAGE 01 ONBOARD            PASS
M3 STAGE 02 COLLECT            PASS
M4 STAGE 03 VALIDATE           PASS
INTELLIGENCE ARCHITECTURE      PRESENT
LIVE SAFETY ASSERTIONS         PASS
TYPESCRIPT                     PASS
STAGE 02 TESTS                 PASS
STAGE 03 TESTS                 PASS
FULL TEST SUITE                PASS
PRODUCTION BUILD               PASS
FINAL TYPESCRIPT               PASS

OPENAI API CREDITS USED        NONE
AUTOFIX USED                   NO
CLIENT 006 CREATED             NO
EXTERNAL SUBMISSION ENABLED    NO

Report:
TAXGUARD_FULL_DEVELOPMENT_STATUS.md

============================================================
 NEXT GATE: LIVE END-TO-END RUNTIME TEST
============================================================
`);


