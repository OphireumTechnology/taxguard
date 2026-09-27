import fs from "node:fs";
import { execSync } from "node:child_process";

const integration =
  "src/taxguard/knowledge/TaxHumanReviewAuditIntegration.ts";

const test =
  "src/tests/taxHumanReviewAuditIntegration.test.ts";

function banner(text) {
  console.log("");
  console.log("============================================================");
  console.log(" " + text);
  console.log("============================================================");
}

function fail(message) {
  banner("M6.8 REPAIR STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("M1-M6.7 remain preserved.");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(label, command) {
  banner(label);

  try {
    execSync(command, {
      stdio: "inherit",
      env: process.env
    });

    console.log("PASS: " + label);
  } catch {
    fail(label + " failed.");
  }
}

if (!fs.existsSync(integration)) {
  fail("Missing " + integration);
}

if (!fs.existsSync(test)) {
  fail("Missing " + test);
}

/*
============================================================
BACKUP ONLY THE TWO M6.8 FILES
============================================================
*/

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  "backups/m6-8-type-repair-" +
  stamp;

fs.mkdirSync(
  backupDir,
  { recursive: true }
);

fs.copyFileSync(
  integration,
  backupDir +
    "/TaxHumanReviewAuditIntegration.ts"
);

fs.copyFileSync(
  test,
  backupDir +
    "/taxHumanReviewAuditIntegration.test.ts"
);

console.log(
  "Backup: " + backupDir
);

/*
============================================================
FIX 1
Use the ACTUAL HumanReviewBridge parameter type.

Do not duplicate or weaken HumanReviewAssignedRole.
============================================================
*/

let source =
  fs.readFileSync(
    integration,
    "utf8"
  );

const oldAssignedRole =
  `assignedRole?: string;`;

const newAssignedRole =
  `assignedRole?:
    Parameters<
      typeof HumanReviewBridge.submit
    >[0]['assignedRole'];`;

if (
  source.includes(oldAssignedRole)
) {
  source =
    source.replace(
      oldAssignedRole,
      newAssignedRole
    );

  console.log(
    "PASS: assignedRole now derives from HumanReviewBridge contract"
  );
}
else if (
  source.includes(
    "typeof HumanReviewBridge.submit"
  )
) {
  console.log(
    "PASS: assignedRole already uses HumanReviewBridge contract"
  );
}
else {
  fail(
    "Expected assignedRole declaration not found. No guessed replacement made."
  );
}

fs.writeFileSync(
  integration,
  source,
  "utf8"
);

/*
============================================================
FIX 2
The negative test intentionally creates an invalid
EvidencePackage with requiresHumanReview:false.

Production EvidencePackage correctly requires literal true.

Keep production contract strict and make ONLY the negative
test explicitly acknowledge that it is testing malformed
runtime input.
============================================================
*/

let tests =
  fs.readFileSync(
    test,
    "utf8"
  );

const oldNegative =
  `evidencePackage:
                noReview,`;

const newNegative =
  `evidencePackage:
                noReview as unknown as EvidencePackage,`;

if (
  tests.includes(oldNegative)
) {
  tests =
    tests.replace(
      oldNegative,
      newNegative
    );

  console.log(
    "PASS: negative malformed-package test explicitly isolated"
  );
}
else if (
  tests.includes(
    "noReview as unknown as EvidencePackage"
  )
) {
  console.log(
    "PASS: malformed-package test already isolated"
  );
}
else {
  fail(
    "Expected noReview negative fixture not found. No broad replacement made."
  );
}

fs.writeFileSync(
  test,
  tests,
  "utf8"
);

/*
============================================================
STATIC SAFETY CHECK
============================================================
*/

source =
  fs.readFileSync(
    integration,
    "utf8"
  );

if (
  !source.includes(
    "HumanReviewBridge.submit"
  )
) {
  fail(
    "HumanReviewBridge authority is missing."
  );
}

if (
  !source.includes(
    "StageThreeValidationService"
  )
) {
  fail(
    "Stage 03 authority is missing."
  );
}

if (
  !source.includes(
    "M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER"
  )
) {
  fail(
    "AI reviewer protection is missing."
  );
}

console.log(
  "PASS: HumanReviewBridge preserved"
);

console.log(
  "PASS: Stage 03 authority preserved"
);

console.log(
  "PASS: AI reviewer block preserved"
);

/*
============================================================
VALIDATE TYPES FIRST
============================================================
*/

run(
  "STEP 1 - TYPESCRIPT",
  "npm.cmd run typecheck"
);

/*
============================================================
M6.8
============================================================
*/

run(
  "STEP 2 - M6.8 HUMAN REVIEW + AUDIT",
  "npm.cmd test -- src/tests/taxHumanReviewAuditIntegration.test.ts --run"
);

run(
  "STEP 3 - HUMAN REVIEW BRIDGE",
  "npm.cmd test -- src/tests/intelligenceCoreHumanReviewBridge.test.ts --run"
);

run(
  "STEP 4 - APPROVAL ORCHESTRATOR",
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

/*
============================================================
M6 REGRESSION
============================================================
*/

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
  "STEP 10 - M6.4 APPLICABILITY",
  "npm.cmd test -- src/tests/taxRuleApplicabilityEngine.test.ts --run"
);

run(
  "STEP 11 - M6.3 FEDERAL 1040 PACK",
  "npm.cmd test -- src/tests/federal1040KnowledgePack2025.test.ts --run"
);

run(
  "STEP 12 - M6.2 RULE REGISTRY",
  "npm.cmd test -- src/tests/taxRuleRegistry.test.ts --run"
);

run(
  "STEP 13 - M6.1 AUTHORITY REGISTRY",
  "npm.cmd test -- src/tests/taxAuthoritySourceRegistry.test.ts --run"
);

/*
============================================================
FULL TAXGUARD REGRESSION
============================================================
*/

run(
  "STEP 14 - FULL ACTIVE SYSTEM REGRESSION",
  "npm.cmd test -- --run"
);

run(
  "STEP 15 - PRODUCTION BUILD",
  "npm.cmd run build"
);

run(
  "STEP 16 - FINAL TYPESCRIPT",
  "npm.cmd run typecheck"
);

/*
============================================================
M6.8 FREEZE
============================================================
*/

banner("TAXGUARD M6.8 VERIFIED PASS");

console.log(`
PRESERVED
---------------------------------------------
M1-M5.5                         FROZEN / PASS
M6.1 Authority Registry         FROZEN / PASS
M6.2 Tax Rule Registry          FROZEN / PASS
M6.3 Federal 1040 Pack          FROZEN / PASS
M6.4 Applicability Engine       FROZEN / PASS
M6.5 Evidence + Citation        FROZEN / PASS
M6.6 Conflict Engine            FROZEN / PASS
M6.7 AI Knowledge Boundary      FROZEN / PASS

M6.8
---------------------------------------------
Human Review Integration        PASS
HumanReviewBridge Contract      PASS
Stage 03 Review Authority       PASS
Evidence Package Routing        PASS
Decision Trace Integration      PASS
Human Actor Attribution         PASS
Reviewer Role Enforcement       PASS
Professional Review Boundary    PASS
Maker-Checker Boundary          PASS
AI Reviewer Block               PASS
Fail-Closed Governance          PASS

SYSTEM VALIDATION
---------------------------------------------
TypeScript                      PASS
M6.1-M6.8                       PASS
Human Review Bridge             PASS
Approval Orchestrator           PASS
Decision Trace Ledger           PASS
Governance Boundary             PASS
Full Active Regression          PASS
Production Build                PASS
Final TypeScript                PASS

SECURITY / GOVERNANCE
---------------------------------------------
AI self approval                BLOCKED
AI professional certification   BLOCKED
AI-created verified facts       BLOCKED
AI-created verified rules       BLOCKED
AI-created authority            BLOCKED
Independent approval path       BLOCKED
Unverified evidence             BLOCKED
Maker-checker controls          PRESERVED
Human review authority          PRESERVED
Tax calculation                 RESERVED FOR M7
Browser workflow authority      BLOCKED
External tax submission         DISABLED
OpenAI API credits              NONE

============================================================
 M6.8 COMPLETE - FREEZE CHECKPOINT
============================================================

NEXT:
M6.9 - M6 FINAL REGRESSION + FREEZE

THEN:
M7 - DETERMINISTIC CALCULATION ENGINE
`);

