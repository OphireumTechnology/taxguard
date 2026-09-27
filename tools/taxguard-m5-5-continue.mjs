import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

function stop(message) {
  console.error("");
  console.error("============================================================");
  console.error(" TAXGUARD M5.5 CONTINUATION STOPPED");
  console.error("============================================================");
  console.error(message);
  process.exit(1);
}

function run(label, command, args) {
  console.log("");
  console.log("============================================================");
  console.log(" " + label);
  console.log("============================================================");

  const r = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  });

  if (r.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

const appFile =
  path.join(ROOT, "src", "App.tsx");

const routerFile =
  path.join(
    ROOT,
    "src",
    "components",
    "workflow",
    "LiveClientWorkflowRouter.tsx"
  );

if (!fs.existsSync(appFile)) {
  stop("src/App.tsx missing.");
}

if (!fs.existsSync(routerFile)) {
  stop("LiveClientWorkflowRouter.tsx missing.");
}

console.log("");
console.log("============================================================");
console.log(" TAXGUARD M5.5 CONTINUE FROM CURRENT CHECKPOINT");
console.log("============================================================");
console.log("");
console.log("No rollback.");
console.log("No repository scan.");
console.log("No OpenAI API.");
console.log("No AutoFix.");
console.log("No Client 006.");
console.log("");

/*
============================================================
1. APP PROP REPAIR — IDEMPOTENT
============================================================
*/

let app =
  fs.readFileSync(appFile, "utf8");

const oldProp =
  "selectedTaxYear={liveTaxYear}";

const correctProp =
  "taxYear={liveTaxYear}";

const oldCount =
  app.split(oldProp).length - 1;

const correctCount =
  app.split(correctProp).length - 1;

if (oldCount > 0) {

  app =
    app.replaceAll(
      oldProp,
      correctProp
    );

  fs.writeFileSync(
    appFile,
    app,
    "utf8"
  );

  console.log(
    "PASS: Converted " +
    oldCount +
    " router prop(s) to taxYear."
  );

} else if (correctCount >= 2) {

  console.log(
    "PASS: App.tsx router props already repaired."
  );

} else {

  stop(
    "App.tsx does not contain the expected LIVE router props."
  );
}

/*
============================================================
2. STAGE ONE IMPORT REPAIR — IDEMPOTENT
============================================================
*/

let router =
  fs.readFileSync(routerFile, "utf8");

const wrongImport =
  "from './onboarding/StageOneIdentityWizard';";

const correctImport =
  "from '../onboarding/StageOneIdentityWizard';";

if (router.includes(wrongImport)) {

  router =
    router.replace(
      wrongImport,
      correctImport
    );

  fs.writeFileSync(
    routerFile,
    router,
    "utf8"
  );

  console.log(
    "PASS: StageOneIdentityWizard import repaired."
  );

} else if (
  router.includes(correctImport)
) {

  console.log(
    "PASS: StageOneIdentityWizard import already repaired."
  );

} else {

  stop(
    "StageOneIdentityWizard import cannot be verified."
  );
}

/*
============================================================
3. STATIC AUTHORITY CHECK
============================================================
*/

app =
  fs.readFileSync(appFile, "utf8");

router =
  fs.readFileSync(routerFile, "utf8");

const checks = [
  [
    "LIVE router connected",
    app.includes(
      "LiveClientWorkflowRouter"
    )
  ],

  [
    "Correct taxYear prop",
    app.includes(
      "taxYear={liveTaxYear}"
    )
  ],

  [
    "Old selectedTaxYear prop removed",
    !app.includes(
      "selectedTaxYear={liveTaxYear}"
    )
  ],

  [
    "StageOne import resolved",
    router.includes(
      "../onboarding/StageOneIdentityWizard"
    )
  ],

  [
    "Server workflow authority",
    router.includes(
      "useLiveWorkflowAuthority"
    )
  ],

  [
    "Stage 01 server routing",
    router.includes(
      "activeStage === 1"
    )
  ],

  [
    "Stage 02 server routing",
    router.includes(
      "activeStage === 2"
    )
  ],

  [
    "Stage 03 server routing",
    router.includes(
      "activeStage === 3"
    )
  ],

  [
    "Stage 03 eligibility",
    router.includes(
      "eligibility.stage3"
    )
  ],

  [
    "Browser workflow writes absent",
    !router.includes(
      "localStorage.setItem"
    )
  ]
];

console.log("");
console.log("STATIC CHECKS");
console.log("-------------");

for (const [name, ok] of checks) {

  console.log(
    (ok ? "PASS " : "FAIL ") + name
  );

  if (!ok) {
    stop(
      "Static assertion failed: " + name
    );
  }
}

/*
============================================================
4. COMPILATION
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  "npm.cmd",
  ["run", "typecheck"]
);

/*
============================================================
5. LIVE AUTHORITY
============================================================
*/

run(
  "STEP 2 - LIVE WORKFLOW AUTHORITY",
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

/*
============================================================
6. STAGES
============================================================
*/

run(
  "STEP 3 - STAGE 01",
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/stageOneOnboarding.test.ts",
    "--run"
  ]
);

run(
  "STEP 4 - STAGE 02",
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
  "STEP 5 - STAGE 03",
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
============================================================
7. INTELLIGENCE CORE
============================================================
*/

run(
  "STEP 6 - INTELLIGENCE CORE",
  "npm.cmd",
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
8. SECURITY
============================================================
*/

run(
  "STEP 7 - SECURITY + INTEGRATION",
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

/*
============================================================
9. COMPLETE ACTIVE REGRESSION
============================================================
*/

run(
  "STEP 8 - FULL ACTIVE REGRESSION",
  "npm.cmd",
  [
    "test",
    "--",
    "--run"
  ]
);

/*
============================================================
10. PRODUCTION BUILD
============================================================
*/

run(
  "STEP 9 - PRODUCTION BUILD",
  "npm.cmd",
  [
    "run",
    "build"
  ]
);

/*
============================================================
11. FINAL COMPILER CHECK
============================================================
*/

run(
  "STEP 10 - FINAL TYPESCRIPT",
  "npm.cmd",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
FINAL — ONLY REACHED IF EVERYTHING ABOVE PASSES
============================================================
*/

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
console.log("LIVE workflow authority         SERVER");
console.log("Stage 01                        SERVER CONTROLLED");
console.log("Stage 02                        SERVER CONTROLLED");
console.log("Stage 03                        SERVER CONTROLLED");
console.log("Permanent Client ID             ENFORCED");
console.log("Stage 02 -> Stage 03 bypass     BLOCKED");
console.log("Browser workflow completion     BLOCKED");
console.log("DEMO -> LIVE fallback           BLOCKED");
console.log("External submission             DISABLED");
console.log("");
console.log("TypeScript                      PASS");
console.log("Authority tests                 PASS");
console.log("Stage regressions               PASS");
console.log("Intelligence Core               PASS");
console.log("Security / integration          PASS");
console.log("Full active regression          PASS");
console.log("Production build                PASS");
console.log("Final TypeScript                PASS");
console.log("OpenAI API credits              NONE");
console.log("");
console.log("M1 THROUGH M5.5 FROZEN.");
console.log("");
console.log("NEXT: M6");
console.log("KNOWLEDGE REGISTRY + RULE ENGINE PRODUCTION INTEGRATION");
console.log("");
