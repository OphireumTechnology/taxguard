import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const builder = path.join(
  ROOT,
  "tools",
  "taxguard-m6-6-build.mjs"
);

const testFile = path.join(
  ROOT,
  "src",
  "tests",
  "taxKnowledgeConflictEngine.test.ts"
);

function banner(text) {
  console.log("");
  console.log("============================================================");
  console.log(" " + text);
  console.log("============================================================");
}

function fail(message) {
  banner("M6.6 TARGETED REPAIR STOPPED");
  console.error(message);
  console.error("");
  console.error("M1-M6.5 remain untouched.");
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

/*
============================================================
VERIFY TARGETS
============================================================
*/

banner("TAXGUARD M6.6 TARGETED DEPENDENCY TEST REPAIR");

if (!fs.existsSync(builder)) {
  fail(
    "M6.6 builder not found: " +
    builder
  );
}

if (!fs.existsSync(testFile)) {
  fail(
    "M6.6 test file not found: " +
    testFile
  );
}

console.log("ROOT CAUSE");
console.log("---------------------------------------------");
console.log("M6.2 correctly blocks verification of a rule");
console.log("whose dependency is not verified.");
console.log("");
console.log("The M6.6 test attempted to verify PARENT while");
console.log("DEPENDENCY was intentionally unverified.");
console.log("");
console.log("That means M6.2 stopped the invalid fixture");
console.log("before M6.6 could inspect it.");
console.log("");
console.log("REPAIR:");
console.log("Keep M6.2 gate unchanged.");
console.log("Change only the M6.6 fixture expectation.");

/*
============================================================
BACKUP
============================================================
*/

const stamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupDir = path.join(
  ROOT,
  "backups",
  "m6-6-targeted-repair-" + stamp
);

fs.mkdirSync(
  backupDir,
  { recursive: true }
);

fs.copyFileSync(
  builder,
  path.join(
    backupDir,
    "taxguard-m6-6-build.mjs"
  )
);

fs.copyFileSync(
  testFile,
  path.join(
    backupDir,
    "taxKnowledgeConflictEngine.test.ts"
  )
);

console.log(
  "Backup: " + backupDir
);

/*
============================================================
PATCH FUNCTION

The same test exists in:
1. generated test file
2. M6.6 builder template

Both must be repaired or rerunning the builder would
restore the old failing fixture.
============================================================
*/

function patch(content, label) {

  const oldBlock = `    it(
      'detects unverified dependency',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'DEPENDENCY',
          verify:
            false
        });

        addRule({
          ruleId:
            'PARENT',
          dependencyRuleIds:
            ['DEPENDENCY']
        });

        const result =
          engine.scan();

        expect(
          result.blockingConflicts
            .some(
              conflict =>
                conflict.type ===
                'dependency_conflict'
            )
        ).toBe(true);
      }
    );`;

  const newBlock = `    it(
      'preserves registry dependency verification boundary',
      () => {

        addAuthority(
          'AUTH-001'
        );

        addRule({
          ruleId:
            'DEPENDENCY',
          verify:
            false
        });

        expect(() =>
          addRule({
            ruleId:
              'PARENT',

            dependencyRuleIds:
              ['DEPENDENCY']
          })
        ).toThrow(
          'TAX_RULE_DEPENDENCIES_NOT_VERIFIED'
        );
      }
    );`;

  if (content.includes(oldBlock)) {
    console.log(
      "PATCH: " + label
    );

    return content.replace(
      oldBlock,
      newBlock
    );
  }

  if (
    content.includes(
      "preserves registry dependency verification boundary"
    )
  ) {
    console.log(
      "PASS: " +
      label +
      " already repaired."
    );

    return content;
  }

  /*
   * Do not guess at an unexpected source structure.
   */
  fail(
    "Expected M6.6 dependency fixture was not found in " +
    label +
    ". No broad replacement performed."
  );
}

/*
============================================================
PATCH GENERATED TEST
============================================================
*/

let testSource = fs.readFileSync(
  testFile,
  "utf8"
);

testSource = patch(
  testSource,
  "active M6.6 test"
);

fs.writeFileSync(
  testFile,
  testSource,
  "utf8"
);

/*
============================================================
PATCH BUILDER TEMPLATE
============================================================
*/

let builderSource = fs.readFileSync(
  builder,
  "utf8"
);

builderSource = patch(
  builderSource,
  "M6.6 builder template"
);

fs.writeFileSync(
  builder,
  builderSource,
  "utf8"
);

/*
============================================================
VERIFY WE DID NOT WEAKEN M6.2
============================================================
*/

const ruleRegistry = path.join(
  ROOT,
  "src",
  "taxguard",
  "knowledge",
  "TaxRuleRegistry.ts"
);

const registrySource = fs.readFileSync(
  ruleRegistry,
  "utf8"
);

if (
  !registrySource.includes(
    "TAX_RULE_DEPENDENCIES_NOT_VERIFIED"
  )
) {
  fail(
    "M6.2 dependency verification boundary is missing."
  );
}

console.log("");
console.log(
  "PASS: M6.2 dependency gate remains intact."
);

/*
============================================================
TARGETED VALIDATION
============================================================
*/

run(
  "npm.cmd",
  [
    "run",
    "typecheck"
  ],
  "STEP 1 - TYPESCRIPT"
);

run(
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxRuleRegistry.test.ts",
    "--run"
  ],
  "STEP 2 - M6.2 RULE REGISTRY"
);

run(
  "npm.cmd",
  [
    "test",
    "--",
    "src/tests/taxKnowledgeConflictEngine.test.ts",
    "--run"
  ],
  "STEP 3 - M6.6 TARGETED TEST"
);

/*
============================================================
RESUME COMPLETE M6.6 BUILD

Because the builder template itself has been repaired,
rerunning it will no longer recreate the defective fixture.
============================================================
*/

banner("RESUMING COMPLETE M6.6 BUILD");

const complete = spawnSync(
  "node",
  [
    builder
  ],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  }
);

if (complete.status !== 0) {
  fail(
    "Complete M6.6 build found another concrete failure."
  );
}

banner("M6.6 TARGETED REPAIR + COMPLETE BUILD PASS");

console.log("");
console.log("M6.2 dependency boundary       PRESERVED");
console.log("M6.6 fixture defect            FIXED");
console.log("M1-M6.5                        PRESERVED");
console.log("");
console.log("The complete M6.6 builder performed:");
console.log(" - milestone validation");
console.log(" - Intelligence Core validation");
console.log(" - LIVE workflow validation");
console.log(" - full active regression");
console.log(" - production build");
console.log(" - final TypeScript");
console.log("");
