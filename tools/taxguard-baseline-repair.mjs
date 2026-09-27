import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, "vite.config.ts");

function fail(message) {
  console.error("");
  console.error("STOP: " + message);
  process.exit(1);
}

console.log("");
console.log("============================================================");
console.log(" TAXGUARD BASELINE REPAIR");
console.log(" Based on established project history");
console.log("============================================================");
console.log("");

if (!fs.existsSync(CONFIG)) {
  fail("vite.config.ts not found.");
}

/*
 * ----------------------------------------------------------
 * BACKUP ONLY THE FILE WE ARE CHANGING
 * ----------------------------------------------------------
 */

const backupDir = path.join(ROOT, "backups", "config-checkpoints");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backup = path.join(
  backupDir,
  `vite.config.before-baseline-repair-${stamp}.ts`
);

const original = fs.readFileSync(CONFIG, "utf8");
fs.writeFileSync(backup, original, "utf8");

console.log("PASS Configuration backup created");
console.log("     " + backup);

/*
 * ----------------------------------------------------------
 * KNOWN ROOT CAUSE
 *
 * Old backup directories must never be discovered as active
 * Vitest test suites.
 * ----------------------------------------------------------
 */

let source = original;

const backupPatterns = [
  "**/backups/**",
  "**/*.backup.*",
  "**/*.before-*",
  "**/*.bak"
];

const alreadyProtected =
  backupPatterns.every(pattern => source.includes(pattern));

if (alreadyProtected) {

  console.log("");
  console.log("PASS Vitest backup exclusions already installed.");

} else {

  const testStart = source.search(/\btest\s*:\s*\{/);

  if (testStart === -1) {
    fail(
      "Existing Vite/Vitest test block was not found. " +
      "No guessed configuration will be written."
    );
  }

  const openBrace = source.indexOf("{", testStart);

  let depth = 0;
  let closeBrace = -1;

  for (let i = openBrace; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;

    if (depth === 0) {
      closeBrace = i;
      break;
    }
  }

  if (closeBrace === -1) {
    fail("Could not safely identify the Vitest test block.");
  }

  let testBlock = source.slice(testStart, closeBrace + 1);

  const excludeMatch =
    testBlock.match(/exclude\s*:\s*\[([\s\S]*?)\]/);

  if (excludeMatch) {

    let existing = excludeMatch[1];

    for (const pattern of backupPatterns) {
      if (!existing.includes(pattern)) {
        existing += `\n      '${pattern}',`;
      }
    }

    const replacement =
      `exclude: [${existing}\n    ]`;

    testBlock =
      testBlock.slice(0, excludeMatch.index) +
      replacement +
      testBlock.slice(
        excludeMatch.index + excludeMatch[0].length
      );

  } else {

    const insertion = `
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/backups/**',
      '**/*.backup.*',
      '**/*.before-*',
      '**/*.bak'
    ],`;

    testBlock =
      testBlock.replace(
        /\btest\s*:\s*\{/,
        "test: {" + insertion
      );
  }

  source =
    source.slice(0, testStart) +
    testBlock +
    source.slice(closeBrace + 1);

  /*
   * Verify BEFORE writing.
   */

  for (const pattern of backupPatterns) {
    if (!source.includes(pattern)) {
      fail("Could not install exclusion: " + pattern);
    }
  }

  fs.writeFileSync(CONFIG, source, "utf8");

  console.log("");
  console.log("PASS Permanent Vitest backup exclusions installed.");
}

/*
 * ----------------------------------------------------------
 * VERIFY M3 ARCHITECTURE WITHOUT SCANNING THE REPOSITORY
 * ----------------------------------------------------------
 */

const APP = path.join(ROOT, "src", "App.tsx");

if (!fs.existsSync(APP)) {
  fail("src/App.tsx not found.");
}

const app = fs.readFileSync(APP, "utf8");

const m3Checks = [
  [
    "StageTwoCollectionWorkspace imported",
    app.includes("StageTwoCollectionWorkspace")
  ],
  [
    "Stage 01 hard gate preserved",
    app.includes(
      "StageOneOnboardingService.hasPassedHardExitGate"
    )
  ],
  [
    "Permanent LIVE Client ID required",
    app.includes("permanentClientId")
  ],
  [
    "Permanent Client ID passed to Stage 02",
    app.includes("clientId={permanentClientId}")
  ],
  [
    "LIVE tax year passed to Stage 02",
    app.includes("selectedTaxYear={liveTaxYear}")
  ]
];

console.log("");
console.log("M3 ROUTING CHECK");
console.log("----------------");

let m3Failed = false;

for (const [name, passed] of m3Checks) {
  console.log(
    `${passed ? "PASS" : "FAIL"} ${name}`
  );

  if (!passed) m3Failed = true;
}

if (m3Failed) {
  fail(
    "M3 routing does not match the established checkpoint. " +
    "No automatic bypass was applied."
  );
}

/*
 * ----------------------------------------------------------
 * VERIFY STAGE 02 -> STAGE 03 GATE
 * ----------------------------------------------------------
 */

const OPS = path.join(
  ROOT,
  "src",
  "services",
  "stageTwoCollectionOperationsService.ts"
);

if (!fs.existsSync(OPS)) {
  fail("Stage Two operations service not found.");
}

const ops = fs.readFileSync(OPS, "utf8");

const gateChecks = [
  [
    "Stage 02 completeness enforced",
    ops.includes("if (!completeness.isComplete)")
  ],
  [
    "Stage 03 eligibility controlled by gate",
    ops.includes("stageThreeStatus: 'ELIGIBLE'")
  ],
  [
    "Professional certification preserved",
    ops.includes("certificationStatement")
  ]
];

console.log("");
console.log("STAGE 02 HARD GATE CHECK");
console.log("------------------------");

let gateFailed = false;

for (const [name, passed] of gateChecks) {
  console.log(
    `${passed ? "PASS" : "FAIL"} ${name}`
  );

  if (!passed) gateFailed = true;
}

if (gateFailed) {
  fail(
    "Stage 02 hard-gate architecture differs from established baseline."
  );
}

console.log("");
console.log("============================================================");
console.log(" SOURCE ARCHITECTURE CHECK PASS");
console.log("============================================================");
console.log("");
console.log("No broad repository scan performed.");
console.log("No OpenAI API used.");
console.log("No AutoFix used.");
console.log("No Client 006 created.");
console.log("No external submission enabled.");
console.log("");
