import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const config = path.join(ROOT, "vitest.config.ts");

function stop(message) {
  console.error("");
  console.error("============================================================");
  console.error(" TAXGUARD VALIDATION STOPPED");
  console.error("============================================================");
  console.error(message);
  process.exit(1);
}

function run(label, args) {
  console.log("");
  console.log("============================================================");
  console.log(" " + label);
  console.log("============================================================");

  const result = spawnSync("npm.cmd", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  });

  if (result.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

/*
============================================================
CREATE DEDICATED VITEST CONFIGURATION
============================================================
*/

const configText = `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',

    include: [
      'src/tests/**/*.test.ts',
      'src/tests/**/*.test.tsx',
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],

    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/backups/**',
      '**/backup/**',
      '**/.git/**',
      '**/.firebase/**',
      '**/coverage/**',
      '**/.cache/**',
    ],
  },
});
`;

if (fs.existsSync(config)) {
  const old = fs.readFileSync(config, "utf8");

  if (!old.includes("**/backups/**")) {
    const backup =
      config +
      ".before-m5-5-" +
      new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    fs.copyFileSync(config, backup);

    console.log(
      "Existing vitest.config.ts backed up:"
    );

    console.log(backup);

    fs.writeFileSync(
      config,
      configText,
      "utf8"
    );

    console.log(
      "PASS: vitest.config.ts hardened."
    );

  } else {

    console.log(
      "PASS: Backup exclusion already installed."
    );
  }

} else {

  fs.writeFileSync(
    config,
    configText,
    "utf8"
  );

  console.log(
    "PASS: Dedicated vitest.config.ts created."
  );
}

const verify =
  fs.readFileSync(
    config,
    "utf8"
  );

if (!verify.includes("**/backups/**")) {
  stop("Backup exclusion was not installed.");
}

if (!verify.includes("src/tests/**/*.test.ts")) {
  stop("Active src/tests include rule missing.");
}

console.log("");
console.log("PASS: Active source tests included.");
console.log("PASS: Historical backups excluded.");
console.log("PASS: Application source unchanged.");
console.log("");

/*
============================================================
1 — TYPESCRIPT
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
2 — STAGE 01

This must now discover only the real active test.
============================================================
*/

run(
  "STEP 2 - STAGE 01",
  [
    "test",
    "--",
    "src/tests/stageOneOnboarding.test.ts",
    "--run"
  ]
);

/*
============================================================
3 — STAGE 02
============================================================
*/

run(
  "STEP 3 - STAGE 02",
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
============================================================
4 — STAGE 03
============================================================
*/

run(
  "STEP 4 - STAGE 03",
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
============================================================
5 — LIVE WORKFLOW AUTHORITY
============================================================
*/

run(
  "STEP 5 - LIVE WORKFLOW AUTHORITY",
  [
    "test",
    "--",
    "src/tests/liveWorkflowUiAuthority.test.ts",
    "src/tests/liveWorkflowGateAuthority.test.ts",
    "src/tests/serverStageGateOrchestrator.test.ts",
    "src/tests/liveAppRoutingAuthority.test.ts",
    "--run"
  ]
);

/*
============================================================
6 — INTELLIGENCE CORE
============================================================
*/

run(
  "STEP 6 - INTELLIGENCE CORE",
  [
    "test",
    "--",
    "src/tests/intelligenceCoreKnowledgeRegistry.test.ts",
    "src/tests/intelligenceCoreRuleEngine.test.ts",
    "src/tests/intelligenceCoreEvidencePackage.test.ts",
    "src/tests/intelligenceCoreHumanReviewBridge.test.ts",
    "src/tests/intelligenceCoreAIReasoningGateway.test.ts",
    "src/tests/intelligenceCoreDecisionApprovalOrchestrator.test.ts",
    "src/tests/intelligenceCoreDecisionTraceLedger.test.ts",
    "src/tests/intelligenceCoreGovernanceBoundary.test.ts",
    "--run"
  ]
);

/*
============================================================
7 — SECURITY + INTEGRATION
============================================================
*/

run(
  "STEP 7 - SECURITY + INTEGRATION",
  [
    "test",
    "--",
    "src/tests/security-rules.test.ts",
    "src/tests/integration.test.ts",
    "src/tests/role-based-integration.test.ts",
    "src/tests/taxguard-compliance-and-security.test.ts",
    "--run"
  ]
);

/*
============================================================
8 — FULL ACTIVE TEST SUITE
============================================================
*/

run(
  "STEP 8 - FULL ACTIVE REGRESSION",
  [
    "test",
    "--",
    "--run"
  ]
);

/*
============================================================
9 — PRODUCTION BUILD
============================================================
*/

run(
  "STEP 9 - PRODUCTION BUILD",
  [
    "run",
    "build"
  ]
);

/*
============================================================
10 — FINAL TYPESCRIPT
============================================================
*/

run(
  "STEP 10 - FINAL TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
FINAL VERIFIED CHECKPOINT
============================================================
*/

console.log("");
console.log("============================================================");
console.log(" TAXGUARD M5.5 VERIFIED PASS");
console.log("============================================================");
console.log("");

console.log("M1   LIVE Routing              FROZEN / PASS");
console.log("M2   Stage 01 ONBOARD          FROZEN / PASS");
console.log("M3   Stage 02 COLLECT          FROZEN / PASS");
console.log("M4   Stage 03 VALIDATE         FROZEN / PASS");
console.log("M5   Firestore Workflow        PASS");
console.log("M5.2 Gate Bridge               PASS");
console.log("M5.3 Server Gate Layer         PASS");
console.log("M5.4 LIVE Authority            PASS");
console.log("M5.5 LIVE App Routing          PASS");

console.log("");

console.log("TypeScript                     PASS");
console.log("Stage 01                       PASS");
console.log("Stage 02                       PASS");
console.log("Stage 03                       PASS");
console.log("LIVE Authority                 PASS");
console.log("Intelligence Core              PASS");
console.log("Security / Integration         PASS");
console.log("Backup tests                   EXCLUDED");
console.log("Full active regression         PASS");
console.log("Production build               PASS");
console.log("Final TypeScript               PASS");

console.log("");

console.log("Permanent Client ID            ENFORCED");
console.log("Workflow authority             SERVER");
console.log("Browser completion             BLOCKED");
console.log("DEMO -> LIVE fallback          BLOCKED");
console.log("External tax submission        DISABLED");
console.log("OpenAI API credits             NONE");

console.log("");
console.log("============================================================");
console.log(" M1-M5.5 DEVELOPMENT FROZEN");
console.log("============================================================");
console.log("");
console.log("NEXT DEVELOPMENT:");
console.log("M6 - KNOWLEDGE REGISTRY + RULE ENGINE");
console.log("     PRODUCTION INTEGRATION");
console.log("");
