import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const viteFile = path.join(ROOT, "vite.config.ts");

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

  const r = spawnSync("npm.cmd", args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  });

  if (r.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

if (!fs.existsSync(viteFile)) {
  stop("vite.config.ts not found.");
}

console.log("");
console.log("============================================================");
console.log(" TAXGUARD M5.5 BACKUP-TEST EXCLUSION + CONTINUATION");
console.log("============================================================");
console.log("");
console.log("Active Stage 01 already passed 13/13.");
console.log("Failure came only from an archived backup test.");
console.log("No application workflow code will be modified.");
console.log("No backup will be deleted.");
console.log("No repository scan.");
console.log("No OpenAI API.");
console.log("");

let src = fs.readFileSync(viteFile, "utf8");

/*
 * Preserve vite.config.ts before modification.
 */
const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupDir = path.join(
  ROOT,
  "backups",
  "vitest-config-" + stamp
);

fs.mkdirSync(backupDir, { recursive: true });

fs.copyFileSync(
  viteFile,
  path.join(backupDir, "vite.config.ts")
);

/*
 * Vitest 4 no longer inherits all default exclusions once a custom
 * exclude list is supplied. Explicitly protect non-source trees.
 *
 * If an existing exclude array exists, append only missing entries.
 * Otherwise insert exclude into the existing test block.
 */

const required = [
  "**/node_modules/**",
  "**/dist/**",
  "**/backups/**",
  "**/backup/**",
  "**/.git/**",
  "**/.firebase/**",
  "**/coverage/**",
  "**/.cache/**"
];

const excludeMatch = src.match(
  /exclude\s*:\s*\[([\s\S]*?)\]/
);

if (excludeMatch) {
  let body = excludeMatch[1];

  for (const pattern of required) {
    if (
      !body.includes(`'${pattern}'`) &&
      !body.includes(`"${pattern}"`)
    ) {
      body += `\n      '${pattern}',`;
    }
  }

  src =
    src.slice(0, excludeMatch.index) +
    `exclude: [${body}\n    ]` +
    src.slice(
      excludeMatch.index +
      excludeMatch[0].length
    );

  console.log(
    "PASS: Existing Vitest exclusion list hardened."
  );

} else {

  const testBlock =
    src.match(/test\s*:\s*\{/);

  if (!testBlock) {
    stop(
      "vite.config.ts test block not found. " +
      "No guessed configuration rewrite performed."
    );
  }

  const insertion =
`test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/backups/**',
      '**/backup/**',
      '**/.git/**',
      '**/.firebase/**',
      '**/coverage/**',
      '**/.cache/**',
    ],`;

  src =
    src.slice(0, testBlock.index) +
    insertion +
    src.slice(
      testBlock.index +
      testBlock[0].length
    );

  console.log(
    "PASS: Vitest exclusion policy installed."
  );
}

fs.writeFileSync(viteFile, src, "utf8");

console.log("PASS: Backups remain preserved.");
console.log("Backup of vite.config.ts: " + backupDir);

/*
============================================================
VERIFY CONFIG COMPILES
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  ["run", "typecheck"]
);

/*
============================================================
RE-RUN STAGE 01

Expected:
only src/tests/stageOneOnboarding.test.ts
NO backups/... test suite
============================================================
*/

run(
  "STEP 2 - STAGE 01 CLEAN",
  [
    "test",
    "--",
    "src/tests/stageOneOnboarding.test.ts",
    "--run"
  ]
);

/*
============================================================
STAGE 02
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
STAGE 03
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
LIVE AUTHORITY
============================================================
*/

run(
  "STEP 5 - LIVE AUTHORITY",
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
INTELLIGENCE CORE
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
SECURITY + INTEGRATION
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
FULL ACTIVE REGRESSION

This is the important proof that backups are no longer discovered.
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
PRODUCTION BUILD
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
FINAL TYPESCRIPT
============================================================
*/

run(
  "STEP 10 - FINAL TYPESCRIPT",
  [
    "run",
    "typecheck"
  ]
);

console.log("");
console.log("============================================================");
console.log(" TAXGUARD M5.5 VERIFIED PASS");
console.log("============================================================");
console.log("");
console.log("M1 LIVE Routing                 FROZEN / PASS");
console.log("M2 Stage 01                     FROZEN / PASS");
console.log("M3 Stage 02                     FROZEN / PASS");
console.log("M4 Stage 03                     FROZEN / PASS");
console.log("M5 Firestore Workflow           PASS");
console.log("M5.2 Gate Bridge                PASS");
console.log("M5.3 Server Gate Layer          PASS");
console.log("M5.4 LIVE Authority             PASS");
console.log("M5.5 LIVE App Routing           PASS");
console.log("");
console.log("TypeScript                      PASS");
console.log("LIVE authority                  PASS");
console.log("Stage 01                        PASS");
console.log("Stage 02                        PASS");
console.log("Stage 03                        PASS");
console.log("Intelligence Core               PASS");
console.log("Security / integration          PASS");
console.log("Backup tests                    EXCLUDED");
console.log("Full active regression          PASS");
console.log("Production build                PASS");
console.log("Final TypeScript                PASS");
console.log("");
console.log("Permanent Client ID             ENFORCED");
console.log("Server workflow authority       ENFORCED");
console.log("Browser workflow completion     BLOCKED");
console.log("DEMO -> LIVE fallback           BLOCKED");
console.log("External tax submission         DISABLED");
console.log("OpenAI API credits used         NONE");
console.log("");
console.log("M1-M5.5 FROZEN.");
console.log("");
console.log("NEXT: M6");
console.log("KNOWLEDGE REGISTRY + RULE ENGINE PRODUCTION INTEGRATION");
console.log("");
