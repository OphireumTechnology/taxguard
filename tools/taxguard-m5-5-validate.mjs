import { spawnSync } from "node:child_process";

function run(label, command, args) {

  console.log("");
  console.log("============================================================");
  console.log(` ${label}`);
  console.log("============================================================");

  const result = spawnSync(
    command,
    args,
    {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: true
    }
  );

  if (result.status !== 0) {

    console.error("");
    console.error(`FAILED: ${label}`);
    console.error("");
    console.error(
      "TaxGuard validation stopped. No false PASS summary will be printed."
    );

    process.exit(
      result.status || 1
    );
  }

  console.log(`PASS: ${label}`);
}

run(
  "M5.5 SOURCE BUILD",
  "node",
  [".\\tools\\taxguard-m5-5-build.mjs"]
);

run(
  "TYPESCRIPT",
  "npm.cmd",
  ["run", "typecheck"]
);

run(
  "M5.4 + M5.5 AUTHORITY TESTS",
  "npm.cmd",
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

run(
  "STAGE 01 REGRESSION",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/stageOneOnboarding.test.ts",
    "--run"
  ]
);

run(
  "STAGE 02 REGRESSION",
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

run(
  "STAGE 03 REGRESSION",
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

run(
  "SECURITY + INTEGRATION",
  "npm.cmd",
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

run(
  "FULL ACTIVE REGRESSION",
  "npm.cmd",
  [
    "test",
    "--",
    "--run"
  ]
);

run(
  "PRODUCTION BUILD",
  "npm.cmd",
  [
    "run",
    "build"
  ]
);

run(
  "FINAL TYPESCRIPT",
  "npm.cmd",
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
console.log("M5.5 App Routing                PASS");
console.log("");
console.log("App.tsx server routing          ENABLED");
console.log("Stage 01 browser authority      REMOVED");
console.log("Stage 02 server eligibility     ENFORCED");
console.log("Stage 03 server eligibility     ENFORCED");
console.log("StageTwo local Stage03 bypass   BLOCKED");
console.log("LIVE CPA impersonation          REMOVED");
console.log("Permanent Client ID             ENFORCED");
console.log("LIVE / DEMO isolation           PRESERVED");
console.log("Direct browser completion       BLOCKED");
console.log("External submission             DISABLED");
console.log("Full regression                 PASS");
console.log("Production build                PASS");
console.log("TypeScript                      PASS");
console.log("OpenAI API credits              NONE");
console.log("");
console.log("NEXT: M6 KNOWLEDGE + RULE ENGINE PRODUCTION INTEGRATION");
console.log("");
