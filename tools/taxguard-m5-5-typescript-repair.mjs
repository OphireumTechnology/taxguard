import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

function stop(message) {
  console.error("");
  console.error("============================================================");
  console.error(" TAXGUARD M5.5 REPAIR STOPPED");
  console.error("============================================================");
  console.error(message);
  process.exit(1);
}

function run(label, command, args) {
  console.log("");
  console.log("============================================================");
  console.log(" " + label);
  console.log("============================================================");

  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  });

  if (result.status !== 0) {
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
  stop("src/App.tsx not found.");
}

if (!fs.existsSync(routerFile)) {
  stop("LiveClientWorkflowRouter.tsx not found.");
}

/*
============================================================
 BACKUP ONLY THE TWO FILES BEING REPAIRED
============================================================
*/

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    "backups",
    "m5-5-typescript-repair-" + stamp
  );

fs.mkdirSync(
  path.join(backupDir, "src", "components", "workflow"),
  { recursive: true }
);

fs.copyFileSync(
  appFile,
  path.join(backupDir, "src", "App.tsx")
);

fs.copyFileSync(
  routerFile,
  path.join(
    backupDir,
    "src",
    "components",
    "workflow",
    "LiveClientWorkflowRouter.tsx"
  )
);

console.log("");
console.log("============================================================");
console.log(" TAXGUARD M5.5 TYPESCRIPT REPAIR");
console.log("============================================================");
console.log("");
console.log("Repairing exactly the 3 reported compiler errors.");
console.log("No repository scan.");
console.log("No OpenAI API.");
console.log("No workflow gate bypass.");
console.log("No Client 006.");
console.log("");

/*
============================================================
 FIX 1 + 2
 App.tsx PROP NAME

Router interface expects:
    taxYear

Current App.tsx sends:
    selectedTaxYear
============================================================
*/

let app =
  fs.readFileSync(appFile, "utf8");

const badProp =
  "selectedTaxYear={liveTaxYear}";

const badPropCount =
  app.split(badProp).length - 1;

if (badPropCount !== 2) {
  stop(
    "Expected exactly 2 selectedTaxYear={liveTaxYear} " +
    "router props but found " +
    badPropCount +
    ". No guessed modification applied."
  );
}

app =
  app.replaceAll(
    badProp,
    "taxYear={liveTaxYear}"
  );

fs.writeFileSync(
  appFile,
  app,
  "utf8"
);

console.log(
  "PASS: Fixed 2 App.tsx router prop mismatches."
);

/*
============================================================
 FIX 3
 ROUTER IMPORT PATH

Current router:
src/components/workflow/LiveClientWorkflowRouter.tsx

StageOne:
src/components/onboarding/StageOneIdentityWizard.tsx

Correct relative path:
../onboarding/StageOneIdentityWizard
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

  console.log(
    "PASS: Fixed StageOneIdentityWizard relative import."
  );

} else if (
  router.includes(correctImport)
) {

  console.log(
    "PASS: StageOneIdentityWizard import already correct."
  );

} else {

  stop(
    "StageOneIdentityWizard import differs from the " +
    "reported compiler error. No guessed modification applied."
  );
}

fs.writeFileSync(
  routerFile,
  router,
  "utf8"
);

/*
============================================================
 STATIC CHECK
============================================================
*/

const repairedApp =
  fs.readFileSync(appFile, "utf8");

const repairedRouter =
  fs.readFileSync(routerFile, "utf8");

if (
  repairedApp.includes(
    "selectedTaxYear={liveTaxYear}"
  )
) {
  stop(
    "Old selectedTaxYear router prop still exists."
  );
}

if (
  !repairedApp.includes(
    "taxYear={liveTaxYear}"
  )
) {
  stop(
    "Correct taxYear router prop was not installed."
  );
}

if (
  !repairedRouter.includes(
    "../onboarding/StageOneIdentityWizard"
  )
) {
  stop(
    "Correct StageOneIdentityWizard import not installed."
  );
}

console.log("");
console.log("PASS: Static repair assertions.");
console.log("Backup: " + backupDir);

/*
============================================================
 VALIDATION
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  "npm.cmd",
  ["run", "typecheck"]
);

run(
  "STEP 2 - LIVE AUTHORITY TESTS",
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

run(
  "STEP 6 - SECURITY + INTEGRATION",
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
  "STEP 7 - FULL ACTIVE REGRESSION",
  "npm.cmd",
  [
    "test",
    "--",
    "--run"
  ]
);

run(
  "STEP 8 - PRODUCTION BUILD",
  "npm.cmd",
  [
    "run",
    "build"
  ]
);

run(
  "STEP 9 - FINAL TYPESCRIPT",
  "npm.cmd",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
 ONLY PRINT PASS AFTER EVERYTHING ABOVE PASSES
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
console.log("Stage 01 routing                SERVER");
console.log("Stage 02 eligibility            SERVER");
console.log("Stage 03 eligibility            SERVER");
console.log("Permanent Client ID             ENFORCED");
console.log("Browser completion              BLOCKED");
console.log("DEMO -> LIVE fallback           BLOCKED");
console.log("External submission             DISABLED");
console.log("Full active regression          PASS");
console.log("Production build                PASS");
console.log("Final TypeScript                PASS");
console.log("OpenAI API credits              NONE");
console.log("");
console.log("M1-M5.5 ARE NOW FROZEN.");
console.log("");
console.log("NEXT DEVELOPMENT: M6");
console.log("KNOWLEDGE REGISTRY + RULE ENGINE PRODUCTION INTEGRATION");
console.log("");
