import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

function banner(text) {
  console.log("");
  console.log("============================================================");
  console.log(" " + text);
  console.log("============================================================");
}

function fail(message) {
  banner("TAXGUARD MASTER BUILD STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("Frozen milestones remain preserved.");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(command, args, label) {
  banner(label);

  const result = spawnSync(
    command,
    args,
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true
    }
  );

  if (result.status !== 0) {
    fail(label + " failed.");
  }

  console.log("PASS: " + label);
}

function exists(relative) {
  return fs.existsSync(
    path.join(ROOT, relative)
  );
}

/*
============================================================
MASTER BASELINE
============================================================
*/

banner("TAXGUARD REMAINING DEVELOPMENT CONTROLLER");

console.log("FROZEN BASELINE");
console.log("---------------------------------------------");
console.log("M1-M5.5                        FROZEN / PASS");
console.log("M6.1 Authority Registry        FROZEN / PASS");
console.log("M6.2 Tax Rule Registry         FROZEN / PASS");
console.log("M6.3 Federal 1040 Pack         FROZEN / PASS");
console.log("M6.4 Applicability Engine      FROZEN / PASS");
console.log("M6.5 Evidence + Citation       FROZEN / PASS");

console.log("");
console.log("REMAINING DEVELOPMENT");
console.log("---------------------------------------------");
console.log("M6.6 Conflict + Supersession");
console.log("M6.7 AI Knowledge Boundary");
console.log("M6.8 Human Review + Audit");
console.log("M6.9 M6 Final Freeze");
console.log("M7   Deterministic Calculation Engine");
console.log("M8   Federal 1040 Preparation Engine");
console.log("M9   Exception + Human Review Engine");
console.log("M10  Decision Provenance");
console.log("M11  Remaining Workflow Stages");
console.log("M12  State Tax Architecture");
console.log("M13  Business Return Architecture");
console.log("M14  Production Document Intelligence");
console.log("M15  Production Hardening + Deployment");

console.log("");
console.log("GLOBAL SAFETY");
console.log("---------------------------------------------");
console.log("External filing                 DISABLED");
console.log("Browser workflow completion     BLOCKED");
console.log("DEMO -> LIVE fallback           BLOCKED");
console.log("AI final tax authority          BLOCKED");
console.log("AI silent repair                BLOCKED");
console.log("Unverified tax authority        BLOCKED");
console.log("Unvalidated evidence            BLOCKED");
console.log("OpenAI paid controller          DISABLED");
console.log("AutoFix V1                      DISABLED");
console.log("Old broad repository scans      DISABLED");

/*
============================================================
VERIFY FROZEN ARCHITECTURE EXISTS
============================================================
*/

const required = [
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts",
  "src/taxguard/knowledge/TaxRuleRegistry.ts",
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts",
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts",
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts"
];

for (const relative of required) {
  if (!exists(relative)) {
    fail(
      "Frozen architecture missing: " +
      relative
    );
  }
}

console.log("");
console.log("PASS: M6.1-M6.5 architecture present.");

/*
============================================================
BASELINE VALIDATION

Before beginning another milestone, prove that the current
frozen checkpoint still compiles and passes.
============================================================
*/

run(
  "npm.cmd",
  ["run", "typecheck"],
  "BASELINE TYPESCRIPT"
);

run(
  "npm.cmd",
  ["test", "--", "--run"],
  "BASELINE FULL ACTIVE REGRESSION"
);

run(
  "npm.cmd",
  ["run", "build"],
  "BASELINE PRODUCTION BUILD"
);

/*
============================================================
DISCOVER NEXT BUILD SCRIPT

The controller deliberately does NOT invent implementations.
Only a reviewed milestone builder may execute.
============================================================
*/

const milestones = [
  {
    id: "M6.6",
    script: "tools/taxguard-m6-6-build.mjs"
  },
  {
    id: "M6.7",
    script: "tools/taxguard-m6-7-build.mjs"
  },
  {
    id: "M6.8",
    script: "tools/taxguard-m6-8-build.mjs"
  },
  {
    id: "M6.9",
    script: "tools/taxguard-m6-9-build.mjs"
  },
  {
    id: "M7",
    script: "tools/taxguard-m7-build.mjs"
  },
  {
    id: "M8",
    script: "tools/taxguard-m8-build.mjs"
  },
  {
    id: "M9",
    script: "tools/taxguard-m9-build.mjs"
  },
  {
    id: "M10",
    script: "tools/taxguard-m10-build.mjs"
  },
  {
    id: "M11",
    script: "tools/taxguard-m11-build.mjs"
  },
  {
    id: "M12",
    script: "tools/taxguard-m12-build.mjs"
  },
  {
    id: "M13",
    script: "tools/taxguard-m13-build.mjs"
  },
  {
    id: "M14",
    script: "tools/taxguard-m14-build.mjs"
  },
  {
    id: "M15",
    script: "tools/taxguard-m15-build.mjs"
  }
];

const available =
  milestones.filter(
    milestone =>
      exists(milestone.script)
  );

if (available.length === 0) {
  banner("BASELINE VERIFIED - READY FOR M6.6");

  console.log("");
  console.log("Current system is healthy.");
  console.log("");
  console.log("No unreviewed future builder was executed.");
  console.log("This prevents a giant blind rewrite of TaxGuard.");
  console.log("");
  console.log("NEXT IMPLEMENTATION:");
  console.log("M6.6 - Conflict + Supersession Detection");
  console.log("");

  process.exit(0);
}

/*
============================================================
EXECUTE REVIEWED BUILDERS SEQUENTIALLY

If builders exist later, this controller can execute them
one at a time and stop immediately after any failure.
============================================================
*/

for (const milestone of available) {

  banner(
    "EXECUTING " +
    milestone.id
  );

  run(
    "node",
    [
      path.join(
        ROOT,
        milestone.script
      )
    ],
    milestone.id + " BUILD"
  );

  /*
  ==========================================================
  POST-MILESTONE SYSTEM VALIDATION
  ==========================================================
  */

  run(
    "npm.cmd",
    ["run", "typecheck"],
    milestone.id +
      " POST-BUILD TYPESCRIPT"
  );

  run(
    "npm.cmd",
    ["test", "--", "--run"],
    milestone.id +
      " FULL ACTIVE REGRESSION"
  );

  run(
    "npm.cmd",
    ["run", "build"],
    milestone.id +
      " PRODUCTION BUILD"
  );

  run(
    "npm.cmd",
    ["run", "typecheck"],
    milestone.id +
      " FINAL TYPESCRIPT"
  );
}

banner("AVAILABLE REMAINING BUILDERS VERIFIED");

console.log("");
console.log(
  "All currently implemented milestone builders completed."
);

console.log(
  "No later unimplemented milestone was fabricated."
);
