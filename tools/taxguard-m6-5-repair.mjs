import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const target = path.join(
  ROOT,
  "src/taxguard/knowledge/TaxEvidenceCitationBinding.ts"
);

if (!fs.existsSync(target)) {
  console.error(
    "STOP: TaxEvidenceCitationBinding.ts not found."
  );
  process.exit(1);
}

console.log("");
console.log("============================================================");
console.log(" TAXGUARD M6.5 TARGETED TYPESCRIPT REPAIR");
console.log("============================================================");

let source = fs.readFileSync(
  target,
  "utf8"
);

const oldName =
  "TaxAuthorityCitation";

const newName =
  "TaxEvidenceAuthorityCitation";

if (!source.includes(oldName)) {
  if (source.includes(newName)) {
    console.log(
      "PASS: Rename already applied."
    );
  } else {
    console.error(
      "STOP: Expected M6.5 citation type was not found."
    );
    process.exit(1);
  }
} else {
  /*
   * Rename only inside the M6.5 module.
   * M6.1 remains untouched.
   */
  source = source.replaceAll(
    oldName,
    newName
  );

  fs.writeFileSync(
    target,
    source,
    "utf8"
  );

  console.log(
    "FIXED: TaxAuthorityCitation -> TaxEvidenceAuthorityCitation"
  );
}

console.log(
  "PRESERVED: M6.1 TaxAuthoritySourceRegistry"
);
console.log(
  "PRESERVED: M6.2 TaxRuleRegistry"
);
console.log(
  "PRESERVED: M6.3 Federal 1040 Pack"
);
console.log(
  "PRESERVED: M6.4 Applicability Engine"
);

console.log("");
console.log("Running TypeScript verification...");

const result = spawnSync(
  "npm.cmd",
  [
    "run",
    "typecheck"
  ],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  }
);

if (result.status !== 0) {
  console.error("");
  console.error(
    "STOP: TypeScript still reports a concrete error."
  );
  console.error(
    "Do not rerun old milestone repair scripts."
  );
  process.exit(1);
}

console.log("");
console.log("============================================================");
console.log(" M6.5 TARGETED REPAIR PASS");
console.log("============================================================");
console.log("");
console.log("Now resuming the existing M6.5 build...");
console.log("");

const build = spawnSync(
  "node",
  [
    path.join(
      ROOT,
      "tools",
      "taxguard-m6-5-build.mjs"
    )
  ],
  {
    cwd: ROOT,
    stdio: "inherit",
    shell: true
  }
);

process.exit(
  build.status ?? 1
);
