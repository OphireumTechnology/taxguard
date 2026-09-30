import fs from "node:fs";
import { execSync } from "node:child_process";

const file =
  "src/tests/taxHumanReviewAuditIntegration.test.ts";

console.log("");
console.log("==============================================");
console.log(" TAXGUARD M6.8 TARGETED TYPESCRIPT REPAIR");
console.log("==============================================");

if (!fs.existsSync(file)) {
  console.error("ERROR: M6.8 test file not found.");
  process.exit(1);
}

let source =
  fs.readFileSync(file, "utf8");

const before = source;

// Repair only the malformed class-to-any assignments.
// Example:
//
// const service =
//   TaxHumanReviewAuditIntegration
//     as any;
//
// becomes:
//
// const service =
//   (TaxHumanReviewAuditIntegration as any);
//

source = source.replace(
  /const service\s*=\s*TaxHumanReviewAuditIntegration\s*as any\s*;/g,
  `const service =
          (TaxHumanReviewAuditIntegration as any);`
);

if (source === before) {
  console.log(
    "No malformed 'const service = ... as any' assignments found."
  );
} else {
  fs.writeFileSync(
    file,
    source,
    "utf8"
  );

  console.log("PASS: repaired M6.8 test syntax");
}

function run(label, command) {
  console.log("");
  console.log("==============================================");
  console.log(` ${label}`);
  console.log("==============================================");

  try {
    execSync(command, {
      stdio: "inherit",
      env: process.env
    });

    console.log(`PASS: ${label}`);
  } catch {
    console.error("");
    console.error(`FAILED: ${label}`);
    console.error(
      "Stopped. Do not rerun old M6.8 build."
    );
    process.exit(1);
  }
}

run(
  "STEP 1 - TYPESCRIPT",
  "npm.cmd run typecheck"
);

run(
  "STEP 2 - M6.8 TARGETED TEST",
  "npm.cmd test -- src/tests/taxHumanReviewAuditIntegration.test.ts --run"
);

run(
  "STEP 3 - HUMAN REVIEW BRIDGE",
  "npm.cmd test -- src/tests/intelligenceCoreHumanReviewBridge.test.ts --run"
);

run(
  "STEP 4 - DECISION APPROVAL ORCHESTRATOR",
  "npm.cmd test -- src/tests/intelligenceCoreDecisionApprovalOrchestrator.test.ts --run"
);

run(
  "STEP 5 - DECISION TRACE LEDGER",
  "npm.cmd test -- src/tests/intelligenceCoreDecisionTraceLedger.test.ts --run"
);

run(
  "STEP 6 - GOVERNANCE BOUNDARY",
  "npm.cmd test -- src/tests/intelligenceCoreGovernanceBoundary.test.ts --run"
);

run(
  "STEP 7 - M6.7 AI KNOWLEDGE BOUNDARY",
  "npm.cmd test -- src/tests/taxAIKnowledgeBoundary.test.ts --run"
);

run(
  "STEP 8 - M6.6 CONFLICT ENGINE",
  "npm.cmd test -- src/tests/taxKnowledgeConflictEngine.test.ts --run"
);

run(
  "STEP 9 - M6.5 EVIDENCE + CITATION",
  "npm.cmd test -- src/tests/taxEvidenceCitationBinding.test.ts --run"
);

run(
  "STEP 10 - FULL ACTIVE REGRESSION",
  "npm.cmd test -- --run"
);

run(
  "STEP 11 - PRODUCTION BUILD",
  "npm.cmd run build"
);

run(
  "STEP 12 - FINAL TYPESCRIPT",
  "npm.cmd run typecheck"
);

console.log("");
console.log("==============================================");
console.log(" TAXGUARD M6.8 VERIFIED PASS");
console.log("==============================================");
console.log("");
console.log("M1-M5.5                     FROZEN / PASS");
console.log("M6.1 Authority Registry     FROZEN / PASS");
console.log("M6.2 Rule Registry          FROZEN / PASS");
console.log("M6.3 Federal 1040 Pack      FROZEN / PASS");
console.log("M6.4 Applicability Engine   FROZEN / PASS");
console.log("M6.5 Evidence + Citation    FROZEN / PASS");
console.log("M6.6 Conflict Engine        FROZEN / PASS");
console.log("M6.7 AI Boundary            FROZEN / PASS");
console.log("M6.8 Human Review + Audit   PASS");
console.log("");
console.log("AI self approval            BLOCKED");
console.log("Independent approval path   BLOCKED");
console.log("External submission         DISABLED");
console.log("");
console.log("NEXT: M6.9 FINAL REGRESSION + FREEZE");
