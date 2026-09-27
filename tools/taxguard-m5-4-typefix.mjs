import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const file = path.join(
  ROOT,
  "src/tests/liveWorkflowUiAuthority.test.ts"
);

if (!fs.existsSync(file)) {
  console.error(
    "ERROR: liveWorkflowUiAuthority.test.ts not found."
  );
  process.exit(1);
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backup =
  `${file}.before-m5-4-typefix-${stamp}.bak`;

fs.copyFileSync(file, backup);

let source =
  fs.readFileSync(file, "utf8");

/*
 * TypeScript is not narrowing the union sufficiently from:
 *
 *   if (!decision.allowed)
 *
 * Change those test guards to an explicit discriminant comparison:
 *
 *   if (decision.allowed === false)
 *
 * Runtime behavior is unchanged.
 */

const oldPattern =
  /if\s*\(\s*!decision\.allowed\s*\)\s*\{/g;

const matches =
  source.match(oldPattern);

if (!matches || matches.length !== 2) {

  console.error("");
  console.error(
    "M5.4 TYPE FIX STOPPED SAFELY"
  );

  console.error(
    `Expected exactly 2 narrowing guards; found ${
      matches ? matches.length : 0
    }.`
  );

  console.error(
    "No guessed source modification was applied."
  );

  process.exit(1);
}

source = source.replace(
  oldPattern,
  "if (decision.allowed === false) {"
);

fs.writeFileSync(
  file,
  source,
  "utf8"
);

console.log("");
console.log(
  "PASS M5.4 TypeScript discriminated-union repair"
);

console.log(
  "Changed exactly 2 test narrowing guards."
);

console.log(
  "Production source behavior was not changed."
);

console.log(
  `Backup: ${backup}`
);
console.log("");
