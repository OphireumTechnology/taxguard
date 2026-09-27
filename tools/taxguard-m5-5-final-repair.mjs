import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

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

  const r = spawnSync(
    command,
    args,
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true
    }
  );

  if (r.status !== 0) {
    stop(label + " failed.");
  }

  console.log("PASS: " + label);
}

if (!fs.existsSync(appFile)) {
  stop("src/App.tsx missing.");
}

if (!fs.existsSync(routerFile)) {
  stop("LiveClientWorkflowRouter.tsx missing.");
}

/*
============================================================
BACKUP
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
    "m5-5-interface-repair-" + stamp
  );

fs.mkdirSync(
  path.join(
    backupDir,
    "src",
    "components",
    "workflow"
  ),
  { recursive: true }
);

fs.copyFileSync(
  appFile,
  path.join(
    backupDir,
    "src",
    "App.tsx"
  )
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
console.log(" TAXGUARD M5.5 INTERFACE + IMPORT REPAIR");
console.log("============================================================");
console.log("");
console.log("No rollback.");
console.log("No repository scan.");
console.log("No OpenAI API.");
console.log("No AutoFix.");
console.log("No Client 006.");
console.log("");

let app =
  fs.readFileSync(
    appFile,
    "utf8"
  );

let router =
  fs.readFileSync(
    routerFile,
    "utf8"
  );

/*
============================================================
1. REPAIR ROUTER TAX-YEAR CONTRACT
============================================================

App.tsx currently supplies:

taxYear={liveTaxYear}
onTaxYearChange={setLiveTaxYear}

The router must support both.
============================================================
*/

if (
  !router.includes(
    "onTaxYearChange?: (year: number) => void;"
  )
) {

  const marker =
    "taxYear: number;";

  if (!router.includes(marker)) {
    stop(
      "Router taxYear property not found."
    );
  }

  router =
    router.replace(
      marker,
      `taxYear: number;
  onTaxYearChange?: (year: number) => void;`
    );

  console.log(
    "PASS: Added onTaxYearChange router contract."
  );

} else {

  console.log(
    "PASS: onTaxYearChange contract already exists."
  );
}

/*
============================================================
2. ADD PROP TO ROUTER DESTRUCTURING
============================================================
*/

if (
  !router.includes(
    "onTaxYearChange: externalTaxYearChange"
  )
) {

  const destructureMarker =
    "taxYear,";

  if (!router.includes(destructureMarker)) {
    stop(
      "Router taxYear destructuring anchor not found."
    );
  }

  router =
    router.replace(
      destructureMarker,
      `taxYear,
  onTaxYearChange: externalTaxYearChange,`
    );

  console.log(
    "PASS: Added external tax-year handler."
  );

} else {

  console.log(
    "PASS: External tax-year handler already connected."
  );
}

/*
============================================================
3. SYNCHRONIZE INTERNAL + EXTERNAL TAX YEAR
============================================================
*/

const setterOld =
  "setSelectedTaxYear";

const controlledHandler =
`const handleTaxYearChange =
    (year: number) => {
      setSelectedTaxYear(year);
      externalTaxYearChange?.(year);
    };`;

if (
  !router.includes(
    "const handleTaxYearChange"
  )
) {

  const statePattern =
    /const\s+\[\s*selectedTaxYear,\s*setSelectedTaxYear\s*\]\s*=\s*useState\(taxYear\);/;

  if (!statePattern.test(router)) {
    stop(
      "Router selectedTaxYear state anchor not found."
    );
  }

  router =
    router.replace(
      statePattern,
      match =>
        match +
        "\n\n  " +
        controlledHandler.replace(/\n/g, "\n  ")
    );

  console.log(
    "PASS: Controlled tax-year synchronization installed."
  );

} else {

  console.log(
    "PASS: Controlled tax-year synchronization already installed."
  );
}

/*
Replace only JSX callback props inside the router.
*/

router =
  router.replace(
    /onTaxYearChange=\{setSelectedTaxYear\}/g,
    "onTaxYearChange={handleTaxYearChange}"
  );

console.log(
  "PASS: Child tax-year callbacks hardened."
);

/*
============================================================
4. RESOLVE STAGE ONE COMPONENT FROM CURRENT APP SOURCE
============================================================
*/

const badStageOneImports = [
  "from './onboarding/StageOneIdentityWizard';",
  "from '../onboarding/StageOneIdentityWizard';"
];

for (const bad of badStageOneImports) {
  router =
    router.replace(
      new RegExp(
        `import\\s*\\{\\s*StageOneIdentityWizard\\s*\\}\\s*${bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "g"
      ),
      ""
    );
}

/*
Look at current App.tsx imports only.
This is NOT a repository scan.
*/

const lazyStageOne =
  app.match(
    /const\s+StageOneIdentityWizard\s*=\s*lazy\(\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)/
  );

const normalStageOne =
  app.match(
    /import\s+\{\s*StageOneIdentityWizard\s*\}\s+from\s+['"]([^'"]+)['"]/
  );

let stageOneSource = null;

if (lazyStageOne) {
  stageOneSource = lazyStageOne[1];
}

if (!stageOneSource && normalStageOne) {
  stageOneSource = normalStageOne[1];
}

/*
If App.tsx no longer imports StageOne because M5.5 removed it,
check the historically established project locations directly.
This checks a small fixed list only.
*/

const candidates = [
  path.join(
    ROOT,
    "src",
    "components",
    "onboarding",
    "StageOneIdentityWizard.tsx"
  ),

  path.join(
    ROOT,
    "src",
    "components",
    "portal",
    "StageOneIdentityWizard.tsx"
  ),

  path.join(
    ROOT,
    "src",
    "components",
    "StageOneIdentityWizard.tsx"
  )
];

let stageOneAbsolute = null;

for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    stageOneAbsolute = candidate;
    break;
  }
}

/*
Convert the discovered source into a router-relative import.
*/

if (!stageOneAbsolute && stageOneSource) {

  const appDir =
    path.dirname(appFile);

  let resolved =
    path.resolve(
      appDir,
      stageOneSource
    );

  const possibilities = [
    resolved,
    resolved + ".tsx",
    resolved + ".ts",
    path.join(resolved, "index.tsx"),
    path.join(resolved, "index.ts")
  ];

  for (const candidate of possibilities) {
    if (fs.existsSync(candidate)) {
      stageOneAbsolute = candidate;
      break;
    }
  }
}

if (!stageOneAbsolute) {

  stop(
    "StageOneIdentityWizard implementation could not be resolved " +
    "from App.tsx or the established StageOne locations."
  );
}

let relativeStageOne =
  path.relative(
    path.dirname(routerFile),
    stageOneAbsolute
  )
  .replace(/\\/g, "/")
  .replace(/\.(tsx|ts)$/, "");

if (!relativeStageOne.startsWith(".")) {
  relativeStageOne =
    "./" + relativeStageOne;
}

/*
Remove any remaining StageOne import before adding canonical one.
*/

router =
  router.replace(
    /import\s+\{\s*StageOneIdentityWizard\s*\}\s+from\s+['"][^'"]+['"];\s*/g,
    ""
  );

router =
  `import { StageOneIdentityWizard } from '${relativeStageOne}';\n` +
  router;

console.log(
  "PASS: StageOneIdentityWizard resolved to " +
  relativeStageOne
);

/*
============================================================
5. WRITE REPAIRED ROUTER
============================================================
*/

fs.writeFileSync(
  routerFile,
  router,
  "utf8"
);

/*
============================================================
6. STATIC CHECKS
============================================================
*/

router =
  fs.readFileSync(
    routerFile,
    "utf8"
  );

const checks = [
  [
    "taxYear contract",
    router.includes(
      "taxYear: number;"
    )
  ],

  [
    "onTaxYearChange contract",
    router.includes(
      "onTaxYearChange?: (year: number) => void;"
    )
  ],

  [
    "controlled tax year",
    router.includes(
      "handleTaxYearChange"
    )
  ],

  [
    "StageOne implementation resolved",
    fs.existsSync(stageOneAbsolute)
  ],

  [
    "server authority preserved",
    router.includes(
      "useLiveWorkflowAuthority"
    )
  ],

  [
    "Stage 01 routing preserved",
    router.includes(
      "activeStage === 1"
    )
  ],

  [
    "Stage 02 routing preserved",
    router.includes(
      "activeStage === 2"
    )
  ],

  [
    "Stage 03 routing preserved",
    router.includes(
      "activeStage === 3"
    )
  ],

  [
    "browser completion absent",
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
    (ok ? "PASS " : "FAIL ") +
    name
  );

  if (!ok) {
    stop(
      "Static check failed: " +
      name
    );
  }
}

console.log("");
console.log(
  "Backup: " + backupDir
);

/*
============================================================
7. TYPESCRIPT FIRST
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  "npm.cmd",
  [
    "run",
    "typecheck"
  ]
);

/*
============================================================
8. AUTHORITY TESTS
============================================================
*/

run(
  "STEP 2 - LIVE AUTHORITY",
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
9. STAGE REGRESSIONS
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
10. FULL REGRESSION
============================================================
*/

run(
  "STEP 6 - FULL ACTIVE REGRESSION",
  "npm.cmd",
  [
    "test",
    "--",
    "--run"
  ]
);

/*
============================================================
11. PRODUCTION BUILD
============================================================
*/

run(
  "STEP 7 - PRODUCTION BUILD",
  "npm.cmd",
  [
    "run",
    "build"
  ]
);

/*
============================================================
12. FINAL TYPESCRIPT
============================================================
*/

run(
  "STEP 8 - FINAL TYPESCRIPT",
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
console.log("TypeScript                      PASS");
console.log("Authority tests                 PASS");
console.log("Stage regressions               PASS");
console.log("Full regression                 PASS");
console.log("Production build                PASS");
console.log("Final TypeScript                PASS");
console.log("External submission             DISABLED");
console.log("OpenAI API credits              NONE");
console.log("");
console.log("M1 THROUGH M5.5 FROZEN.");
console.log("");
console.log("NEXT: M6");
console.log("KNOWLEDGE REGISTRY + RULE ENGINE PRODUCTION INTEGRATION");
console.log("");
