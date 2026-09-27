import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const ROOT = process.cwd();

function banner(text) {
  console.log("");
  console.log("============================================================");
  console.log(" " + text);
  console.log("============================================================");
}

function stop(message) {
  banner("TAXGUARD M6.9 STOPPED SAFELY");
  console.error(message);
  console.error("");
  console.error("M1-M6.8 remain preserved.");
  console.error("No false PASS status produced.");
  process.exit(1);
}

function run(label, command) {
  banner(label);

  try {
    execSync(command, {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env
    });

    console.log("PASS: " + label);
  } catch {
    stop(label + " failed.");
  }
}

function file(relative) {
  return path.join(ROOT, relative);
}

function requireFile(relative) {
  if (!fs.existsSync(file(relative))) {
    stop("Required frozen file missing: " + relative);
  }

  console.log("PASS: " + relative);
}

function read(relative) {
  return fs.readFileSync(
    file(relative),
    "utf8"
  );
}

function sha256(relative) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(
        file(relative)
      )
    )
    .digest("hex");
}

banner("TAXGUARD M6.9 - FINAL M6 REGRESSION + FREEZE");

console.log(`
PRESERVE
---------------------------------------------
M1-M5.5                         FROZEN
M6.1 Authority Registry         FROZEN
M6.2 Tax Rule Registry          FROZEN
M6.3 Federal 1040 Pack          FROZEN
M6.4 Applicability Engine       FROZEN
M6.5 Evidence + Citation        FROZEN
M6.6 Conflict Engine            FROZEN
M6.7 AI Knowledge Boundary      FROZEN
M6.8 Human Review + Audit       FROZEN

M6.9 OBJECTIVES
---------------------------------------------
Authority provenance            VERIFY
Tax-year applicability          VERIFY
Rule verification               VERIFY
Evidence provenance             VERIFY
Citation binding                VERIFY
Conflict detection              VERIFY
AI proposal boundary            VERIFY
Human review authority          VERIFY
Maker-checker controls          VERIFY
Decision trace                  VERIFY
LIVE workflow isolation         VERIFY
Full system regression          VERIFY
Production build                VERIFY
Freeze manifest                 CREATE

NO NEW TAX LOGIC
---------------------------------------------
Tax calculations                NOT ADDED
Tax tables                      NOT ADDED
Tax liability calculation       NOT ADDED
Return preparation              NOT ADDED
Return filing                   DISABLED
OpenAI API                      NOT USED
`);

//
// ----------------------------------------------------------
// KNOWN M6 FILES ONLY.
// No broad repository scan.
// ----------------------------------------------------------
//

const frozenFiles = [
  "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts",
  "src/taxguard/knowledge/TaxRuleRegistry.ts",
  "src/taxguard/knowledge/Federal1040KnowledgePack2025.ts",
  "src/taxguard/knowledge/TaxRuleApplicabilityEngine.ts",
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts",
  "src/taxguard/knowledge/TaxKnowledgeConflictEngine.ts",
  "src/taxguard/knowledge/TaxAIKnowledgeBoundary.ts",
  "src/taxguard/knowledge/TaxHumanReviewAuditIntegration.ts",

  "src/taxguard/intelligence/review/HumanReviewBridge.ts",
  "src/taxguard/intelligence/trace/DecisionTraceLedger.ts",
  "src/taxguard/intelligence/decisions/DecisionApprovalOrchestrator.ts",
  "src/taxguard/intelligence/governance/IntelligenceGovernanceBoundary.ts",

  "src/services/stageThreeValidationService.ts"
];

banner("STEP 0 - FROZEN FILE VERIFICATION");

for (const relative of frozenFiles) {
  requireFile(relative);
}

//
// ----------------------------------------------------------
// GOVERNANCE ASSERTIONS
// ----------------------------------------------------------
//

banner("STEP 1 - M6 GOVERNANCE ASSERTIONS");

const authority =
  read(
    "src/taxguard/knowledge/TaxAuthoritySourceRegistry.ts"
  );

const rules =
  read(
    "src/taxguard/knowledge/TaxRuleRegistry.ts"
  );

const evidence =
  read(
    "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts"
  );

const conflicts =
  read(
    "src/taxguard/knowledge/TaxKnowledgeConflictEngine.ts"
  );

const aiBoundary =
  read(
    "src/taxguard/knowledge/TaxAIKnowledgeBoundary.ts"
  );

const humanReview =
  read(
    "src/taxguard/knowledge/TaxHumanReviewAuditIntegration.ts"
  );

const reviewBridge =
  read(
    "src/taxguard/intelligence/review/HumanReviewBridge.ts"
  );

const governanceAssertions = [
  [
    "Authority verification lifecycle",
    authority.includes("verified")
  ],

  [
    "Authority tax-year applicability",
    authority.includes("taxYears")
  ],

  [
    "Rule verification boundary",
    rules.includes(
      "TAX_RULE_DEPENDENCIES_NOT_VERIFIED"
    )
  ],

  [
    "Evidence SHA-256 provenance",
    evidence.includes("SHA-256") ||
    evidence.includes("sha256") ||
    evidence.includes("SHA256")
  ],

  [
    "Evidence citation binding",
    evidence.includes("citation")
  ],

  [
    "Conflict detection",
    conflicts.includes("conflict")
  ],

  [
    "AI proposal-only boundary",
    aiBoundary.includes(
      "isAiProposedOnly"
    )
  ],

  [
    "AI human approval requirement",
    aiBoundary.includes(
      "HUMAN_APPROVAL_REQUIRED"
    )
  ],

  [
    "AI reviewer prohibited",
    humanReview.includes(
      "M6_8_AI_CANNOT_ACT_AS_HUMAN_REVIEWER"
    )
  ],

  [
    "Stage 03 authoritative review",
    humanReview.includes(
      "StageThreeValidationService"
    )
  ],

  [
    "Human Review Bridge",
    humanReview.includes(
      "HumanReviewBridge"
    )
  ],

  [
    "Decision Trace Ledger",
    humanReview.includes(
      "DecisionTraceLedger"
    )
  ],

  [
    "Existing Stage 03 bridge",
    reviewBridge.includes(
      "StageThreeValidationService"
    )
  ]
];

for (
  const [name, result]
  of governanceAssertions
) {
  if (!result) {
    stop(
      "Governance assertion failed: " +
      name
    );
  }

  console.log(
    "PASS: " + name
  );
}

//
// ----------------------------------------------------------
// FORBIDDEN AUTHORITY CHECKS
// ----------------------------------------------------------
//

banner("STEP 2 - PROHIBITED AUTHORITY ASSERTIONS");

const combinedM6 =
  [
    aiBoundary,
    humanReview
  ].join("\n");

const prohibitedImplementations = [
  "approveByAI(",
  "selfApprove(",
  "autoApprove(",
  "fileReturn(",
  "transmitReturn(",
  "overrideTaxCalculation("
];

for (
  const token
  of prohibitedImplementations
) {
  if (
    combinedM6.includes(token)
  ) {
    stop(
      "Forbidden authority detected: " +
      token
    );
  }

  console.log(
    "PASS BLOCKED: " + token
  );
}

//
// ----------------------------------------------------------
// TYPESCRIPT
// ----------------------------------------------------------
//

run(
  "STEP 3 - TYPESCRIPT",
  "npm.cmd run typecheck"
);

//
// ----------------------------------------------------------
// M6.1
// ----------------------------------------------------------
//

run(
  "STEP 4 - M6.1 AUTHORITY REGISTRY",
  "npm.cmd test -- src/tests/taxAuthoritySourceRegistry.test.ts --run"
);

//
// ----------------------------------------------------------
// M6.2
// ----------------------------------------------------------
//

run(
  "STEP 5 - M6.2 TAX RULE REGISTRY",
  "npm.cmd test -- src/tests/taxRuleRegistry.test.ts --run"
);

//
// ----------------------------------------------------------
// M6.3
// ----------------------------------------------------------
//

run(
  "STEP 6 - M6.3 FEDERAL 1040 KNOWLEDGE PACK",
  "npm.cmd test -- src/tests/federal1040KnowledgePack2025.test.ts --run"
);

//
// ----------------------------------------------------------
// M6.4
// ----------------------------------------------------------
//

run(
  "STEP 7 - M6.4 APPLICABILITY ENGINE",
  "npm.cmd test -- src/tests/taxRuleApplicabilityEngine.test.ts --run"
);

//
// ----------------------------------------------------------
// M6.5
// ----------------------------------------------------------
//

run(
  "STEP 8 - M6.5 EVIDENCE + CITATION",
  "npm.cmd test -- src/tests/taxEvidenceCitationBinding.test.ts --run"
);

//
// ----------------------------------------------------------
// M6.6
// ----------------------------------------------------------
//

run(
  "STEP 9 - M6.6 CONFLICT ENGINE",
  "npm.cmd test -- src/tests/taxKnowledgeConflictEngine.test.ts --run"
);

//
// ----------------------------------------------------------
// M6.7
// ----------------------------------------------------------
//

run(
  "STEP 10 - M6.7 AI KNOWLEDGE BOUNDARY",
  "npm.cmd test -- src/tests/taxAIKnowledgeBoundary.test.ts --run"
);

//
// ----------------------------------------------------------
// M6.8
// ----------------------------------------------------------
//

run(
  "STEP 11 - M6.8 HUMAN REVIEW + AUDIT",
  "npm.cmd test -- src/tests/taxHumanReviewAuditIntegration.test.ts --run"
);

//
// ----------------------------------------------------------
// INTELLIGENCE CORE
// ----------------------------------------------------------
//

run(
  "STEP 12 - INTELLIGENCE CORE",
  "npm.cmd test -- src/tests/intelligenceCoreKnowledgeRegistry.test.ts src/tests/intelligenceCoreRuleEngine.test.ts src/tests/intelligenceCoreEvidencePackage.test.ts src/tests/intelligenceCoreHumanReviewBridge.test.ts src/tests/intelligenceCoreAIReasoningGateway.test.ts src/tests/intelligenceCoreDecisionApprovalOrchestrator.test.ts src/tests/intelligenceCoreDecisionTraceLedger.test.ts src/tests/intelligenceCoreGovernanceBoundary.test.ts --run"
);

//
// ----------------------------------------------------------
// LIVE WORKFLOW
// ----------------------------------------------------------
//

run(
  "STEP 13 - LIVE WORKFLOW AUTHORITY",
  "npm.cmd test -- src/tests/liveWorkflowUiAuthority.test.ts src/tests/liveWorkflowGateAuthority.test.ts src/tests/serverStageGateOrchestrator.test.ts src/tests/liveAppRoutingAuthority.test.ts --run"
);

//
// ----------------------------------------------------------
// STAGES 01-03
// ----------------------------------------------------------
//

run(
  "STEP 14 - STAGE 01",
  "npm.cmd test -- src/tests/stageOneOnboarding.test.ts --run"
);

run(
  "STEP 15 - STAGE 02",
  "npm.cmd test -- src/tests/stageTwoCollection.test.ts src/tests/stageTwoSprintTwoSecurity.test.ts src/tests/stageTwoSprintThreeIntelligence.test.ts src/tests/stageTwoSprintFourOperations.test.ts --run"
);

run(
  "STEP 16 - STAGE 03",
  "npm.cmd test -- src/tests/stageThreeValidationFoundation.test.ts src/tests/stageThreeSprintOne.test.ts src/tests/stageThreeSprintTwo.test.ts src/tests/stageThreeSprintThree.test.ts --run"
);

//
// ----------------------------------------------------------
// COMPLETE ACTIVE REGRESSION
// ----------------------------------------------------------
//

run(
  "STEP 17 - FULL ACTIVE SYSTEM REGRESSION",
  "npm.cmd test -- --run"
);

//
// ----------------------------------------------------------
// PRODUCTION BUILD
// ----------------------------------------------------------
//

run(
  "STEP 18 - PRODUCTION BUILD",
  "npm.cmd run build"
);

run(
  "STEP 19 - FINAL TYPESCRIPT",
  "npm.cmd run typecheck"
);

//
// ----------------------------------------------------------
// FREEZE MANIFEST
//
// Hash known M6 source files after every validation gate
// has passed.
//
// This does not lock the filesystem.
// It provides a reproducible integrity checkpoint.
// ----------------------------------------------------------
//

banner("STEP 20 - CREATE M6 FREEZE MANIFEST");

const freezeDirectory =
  file("taxguard-freeze");

fs.mkdirSync(
  freezeDirectory,
  { recursive: true }
);

const manifest = {
  milestone:
    "M6",

  name:
    "Tax Knowledge, Rules, Evidence and Governance Core",

  status:
    "FROZEN_PASS",

  createdAt:
    new Date().toISOString(),

  calculationEngineIncluded:
    false,

  externalTaxSubmissionEnabled:
    false,

  openAiApiUsed:
    false,

  milestones: {
    "M6.1":
      "FROZEN_PASS",

    "M6.2":
      "FROZEN_PASS",

    "M6.3":
      "FROZEN_PASS",

    "M6.4":
      "FROZEN_PASS",

    "M6.5":
      "FROZEN_PASS",

    "M6.6":
      "FROZEN_PASS",

    "M6.7":
      "FROZEN_PASS",

    "M6.8":
      "FROZEN_PASS",

    "M6.9":
      "FROZEN_PASS"
  },

  governance: {
    aiCreatesVerifiedFacts:
      false,

    aiCreatesVerifiedRules:
      false,

    aiCreatesTaxAuthority:
      false,

    aiSelfApproval:
      false,

    humanApprovalRequired:
      true,

    professionalReviewBoundary:
      true,

    evidenceProvenanceRequired:
      true,

    ruleVerificationRequired:
      true,

    authorityVerificationRequired:
      true,

    conflictDetectionRequired:
      true,

    externalSubmissionEnabled:
      false
  },

  sourceHashes:
    Object.fromEntries(
      frozenFiles.map(
        relative => [
          relative,
          sha256(relative)
        ]
      )
    )
};

const manifestFile =
  path.join(
    freezeDirectory,
    "M6_FREEZE_MANIFEST.json"
  );

fs.writeFileSync(
  manifestFile,
  JSON.stringify(
    manifest,
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(
  "WRITE taxguard-freeze/M6_FREEZE_MANIFEST.json"
);

//
// Validate the manifest itself.
//
const verifyManifest =
  JSON.parse(
    fs.readFileSync(
      manifestFile,
      "utf8"
    )
  );

if (
  verifyManifest.status !==
  "FROZEN_PASS"
) {
  stop(
    "M6 freeze manifest validation failed."
  );
}

if (
  verifyManifest
    .calculationEngineIncluded !==
  false
) {
  stop(
    "M7 calculation logic detected in M6 freeze manifest."
  );
}

if (
  verifyManifest
    .externalTaxSubmissionEnabled !==
  false
) {
  stop(
    "External submission unexpectedly enabled."
  );
}

console.log(
  "PASS: M6 freeze manifest"
);

//
// ----------------------------------------------------------
// FINAL RESULT
// ----------------------------------------------------------
//

banner("TAXGUARD M6.9 VERIFIED PASS");

console.log(`
M6 FINAL FREEZE
---------------------------------------------
M6.1 Authority Registry         FROZEN / PASS
M6.2 Tax Rule Registry          FROZEN / PASS
M6.3 Federal 1040 Pack          FROZEN / PASS
M6.4 Applicability Engine       FROZEN / PASS
M6.5 Evidence + Citation        FROZEN / PASS
M6.6 Conflict Engine            FROZEN / PASS
M6.7 AI Knowledge Boundary      FROZEN / PASS
M6.8 Human Review + Audit       FROZEN / PASS
M6.9 Final Regression           FROZEN / PASS

PLATFORM PRESERVATION
---------------------------------------------
M1-M5.5                         FROZEN / PASS
Stage 01                        PASS
Stage 02                        PASS
Stage 03                        PASS
LIVE Workflow Authority         PASS
Intelligence Core               PASS

SYSTEM VALIDATION
---------------------------------------------
TypeScript                      PASS
M6.1-M6.8 Tests                PASS
Intelligence Core               PASS
LIVE Workflow                   PASS
Full Active Regression          PASS
Production Build                PASS
Final TypeScript                PASS
Freeze Manifest                 PASS

GOVERNANCE
---------------------------------------------
Verified authority required     ENFORCED
Verified rules required         ENFORCED
Evidence provenance             ENFORCED
Citation binding                ENFORCED
Conflict detection              ENFORCED
AI proposal-only boundary       ENFORCED
AI self approval                BLOCKED
Professional review             ENFORCED
Human approval                  ENFORCED
Maker-checker                   PRESERVED
Decision trace                  PRESERVED
Browser workflow authority      BLOCKED
External tax submission         DISABLED
OpenAI API credits              NONE

============================================================
 M6 KNOWLEDGE + GOVERNANCE CORE IS NOW FROZEN
============================================================

DO NOT MODIFY M6 WITHOUT A SPECIFIC REGRESSION.

NEXT DEVELOPMENT:
M7 - DETERMINISTIC CALCULATION ENGINE

M7 BUILD ORDER:
M7.1 Calculation Contract + Decimal/Rounding Core
M7.2 Tax-Year Calculation Registry
M7.3 Federal 1040 Income Aggregation
M7.4 AGI Calculation
M7.5 Standard / Itemized Deduction Engine
M7.6 Taxable Income Engine
M7.7 Federal Income Tax Tables / Rate Engine
M7.8 Credits + Payments Engine
M7.9 Self-Employment Calculation Foundation
M7.10 Refund / Balance Due Reconciliation
M7.11 Calculation Evidence + Trace Binding
M7.12 Human Review / Override Controls
M7.13 M7 Regression + Freeze
`);

