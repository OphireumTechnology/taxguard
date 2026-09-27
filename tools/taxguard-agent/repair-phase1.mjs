import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import OpenAI from "openai";

const AGENT_DIR = process.cwd();
const ROOT = path.resolve(AGENT_DIR, "..", "..");

const ALLOWED_FILES = [
  "src/context/AppContext.tsx",
  "src/server/routes/auth.routes.ts",
  "src/services/api.ts",
  "src/firebase/auth.ts",
  "src/App.tsx"
];

const FORBIDDEN_PATTERNS = [
  ".env",
  "firebase-admin.json",
  "service-account",
  "serviceaccount",
  "node_modules",
  ".git",
  "dist",
  "backups"
];

function fail(message) {
  console.error(`\n[BLOCKED] ${message}`);
  process.exit(1);
}

function safePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");

  if (!ALLOWED_FILES.includes(normalized)) {
    fail(`File is outside Phase 1 allowlist: ${relativePath}`);
  }

  const lower = normalized.toLowerCase();

  for (const forbidden of FORBIDDEN_PATTERNS) {
    if (lower.includes(forbidden.toLowerCase())) {
      fail(`Forbidden path requested: ${relativePath}`);
    }
  }

  const absolute = path.resolve(ROOT, normalized);

  if (!absolute.startsWith(ROOT + path.sep)) {
    fail(`Path escapes repository: ${relativePath}`);
  }

  return absolute;
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);

  execFileSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: false
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

if (!process.env.OPENAI_API_KEY) {
  fail("OPENAI_API_KEY is not loaded.");
}

console.log(`
============================================================
 TAXGUARD PHASE 1 CONTROLLED REPAIR AGENT
============================================================

MODE:
  Proposal -> Approval -> Backup -> Apply -> Validate

ALLOWED:
${ALLOWED_FILES.map(f => `  - ${f}`).join("\n")}

BLOCKED:
  - arbitrary shell commands from AI
  - git push
  - deployment
  - database migrations
  - Firebase credential access
  - .env access
  - destructive repository cleanup
  - external tax submission
============================================================
`);

const source = {};

for (const relativePath of ALLOWED_FILES) {
  const absolute = safePath(relativePath);

  if (fs.existsSync(absolute)) {
    source[relativePath] = fs.readFileSync(absolute, "utf8");
  }
}

let gitStatus = "";

try {
  gitStatus = execFileSync(
    "git",
    ["status", "--short"],
    {
      cwd: ROOT,
      encoding: "utf8"
    }
  );
} catch {
  gitStatus = "Unable to obtain git status.";
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const instructions = `
You are the controlled Phase 1 repair engineer for TaxGuard.

You are NOT allowed to execute commands.

You may propose modifications ONLY to files included in the supplied
allowlist.

PHASE 1 GOAL:

Repair authentication and LIVE/DEMO isolation without rebuilding the
application.

Required invariants:

1. Preserve artest2026 demonstration environment.

2. LIVE users authenticate with Firebase.

3. After Firebase authentication, LIVE identity must be established
   through the TaxGuard server firebase-session endpoint.

4. Firebase onAuthStateChanged must NEVER fabricate taxpayer identity.

5. Remove Michael Perotti, m.perotti@example.com,
   678-205-9486 and Perotti Capital Holdings LLC as LIVE fallbacks.

6. Firebase auth callbacks must not overwrite a correctly provisioned
   TaxGuard LIVE server identity.

7. LIVE registration must NOT fall back to the legacy Express
   registration mechanism.

8. LIVE sign-out must clear LIVE taxpayer state.

9. Preserve permanent Client ID allocation and existing server-side
   provisioning.

10. Preserve Stage 01, Stage 02 and Stage 03.

11. Preserve the existing Intelligence Core.

12. Do not enable external tax submission.

13. Preserve demo fixtures for the demo environment.

14. Correct canonical client authentication routing only where necessary:
      /#/client/login
      /#/client/register

15. Do not perform broad refactors.

16. Do not rename unrelated components.

17. Do not remove existing security controls.

18. Do not weaken authentication.

19. Do not introduce hardcoded LIVE identities.

20. Do not introduce client-side Client ID allocation.

IMPORTANT:

Return ONLY valid JSON.

Schema:

{
  "summary": "short explanation",
  "risk": "low | medium | high",
  "edits": [
    {
      "path": "allowed/path",
      "oldText": "exact existing text",
      "newText": "replacement text",
      "reason": "why this change is required"
    }
  ]
}

Every oldText MUST match the supplied source exactly.

Use the smallest practical replacements.

Do not return Markdown.

Do not return commands.

Do not modify files outside the allowlist.
`;

const input = `
CURRENT GIT STATUS:

${gitStatus}

CURRENT ALLOWED SOURCE FILES:

${Object.entries(source)
  .map(([file, content]) =>
    `\n================ FILE: ${file} ================\n${content}`
  )
  .join("\n")}
`;

console.log("\nRequesting Phase 1 repair proposal from OpenAI...\n");

const response = await client.responses.create({
  model: "gpt-5.6-sol",
  reasoning: {
    effort: "high"
  },
  instructions,
  input
});

const raw = response.output_text?.trim();

if (!raw) {
  fail("OpenAI returned an empty repair proposal.");
}

let proposal;

try {
  proposal = JSON.parse(raw);
} catch {
  const report = path.join(
    ROOT,
    `TAXGUARD_PHASE1_INVALID_RESPONSE_${timestamp()}.txt`
  );

  fs.writeFileSync(report, raw, "utf8");

  fail(
    `OpenAI response was not valid JSON. Saved for review: ${report}`
  );
}

if (!Array.isArray(proposal.edits)) {
  fail("Repair proposal does not contain an edits array.");
}

if (proposal.edits.length === 0) {
  console.log("No Phase 1 changes were proposed.");
  process.exit(0);
}

if (proposal.edits.length > 20) {
  fail(
    `Proposal contains ${proposal.edits.length} edits. Phase 1 limit is 20.`
  );
}

console.log(`
============================================================
 PROPOSED PHASE 1 REPAIR
============================================================

Summary:
${proposal.summary || "No summary supplied"}

Risk:
${proposal.risk || "not specified"}

Edits:
`);

proposal.edits.forEach((edit, index) => {
  console.log(
    `${index + 1}. ${edit.path}\n   ${edit.reason || "No reason supplied"}`
  );
});

console.log(`
============================================================
 NO FILE HAS BEEN MODIFIED YET
============================================================
`);

process.stdout.write(
  'Type YES to apply these Phase 1 changes, or anything else to cancel: '
);

process.stdin.setEncoding("utf8");

process.stdin.once("data", async (answer) => {
  if (answer.trim() !== "YES") {
    console.log("\nCANCELLED. No source files were modified.");
    process.exit(0);
  }

  const backupDir = path.join(
    ROOT,
    "backups",
    `phase1-agent-${timestamp()}`
  );

  fs.mkdirSync(backupDir, { recursive: true });

  const originals = new Map();
  const touched = new Set();

  try {
    for (const edit of proposal.edits) {
      if (
        !edit ||
        typeof edit.path !== "string" ||
        typeof edit.oldText !== "string" ||
        typeof edit.newText !== "string"
      ) {
        throw new Error("Malformed edit proposal.");
      }

      const absolute = safePath(edit.path);

      if (!fs.existsSync(absolute)) {
        throw new Error(`Target file does not exist: ${edit.path}`);
      }

      if (!originals.has(edit.path)) {
        const original = fs.readFileSync(absolute, "utf8");

        originals.set(edit.path, original);

        const backupPath = path.join(
          backupDir,
          edit.path.replaceAll("/", "__")
        );

        fs.writeFileSync(backupPath, original, "utf8");
      }

      const current = fs.readFileSync(absolute, "utf8");

      const first = current.indexOf(edit.oldText);

      if (first === -1) {
        throw new Error(
          `oldText was not found in ${edit.path}.`
        );
      }

      const second = current.indexOf(
        edit.oldText,
        first + edit.oldText.length
      );

      if (second !== -1) {
        throw new Error(
          `oldText matched more than once in ${edit.path}.`
        );
      }

      const updated =
        current.slice(0, first) +
        edit.newText +
        current.slice(first + edit.oldText.length);

      fs.writeFileSync(absolute, updated, "utf8");

      touched.add(edit.path);
    }

    console.log(`
============================================================
 PATCH APPLIED
============================================================

Backup:
${backupDir}

Running mandatory validation...
`);

    run("npm.cmd", ["run", "typecheck"]);
    run("npm.cmd", ["test", "--", "--run"]);
    run("npm.cmd", ["run", "build"]);

    const diff = execFileSync(
      "git",
      ["diff", "--", ...Array.from(touched)],
      {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 20 * 1024 * 1024
      }
    );

    const reportPath = path.join(
      ROOT,
      `TAXGUARD_PHASE1_REPAIR_REPORT_${timestamp()}.txt`
    );

    const report = `
TAXGUARD PHASE 1 REPAIR REPORT

STATUS: VALIDATION PASSED

Summary:
${proposal.summary || ""}

Risk:
${proposal.risk || ""}

Touched files:
${Array.from(touched).join("\n")}

Backup:
${backupDir}

VALIDATION:
- TypeScript: PASS
- Full test suite: PASS
- Production build: PASS

NO GIT PUSH WAS PERFORMED.
NO DEPLOYMENT WAS PERFORMED.
NO FIREBASE CREDENTIAL WAS ACCESSED.
NO EXTERNAL TAX SUBMISSION WAS ENABLED.

================ GIT DIFF ================

${diff}
`;

    fs.writeFileSync(reportPath, report, "utf8");

    console.log(`
============================================================
 PHASE 1 REPAIR VALIDATED
============================================================

TypeScript: PASS
Tests:      PASS
Build:      PASS

Report:
${reportPath}

DO NOT GIT PUSH YET.
`);

    process.exit(0);

  } catch (error) {
    console.error("\nVALIDATION OR PATCH FAILURE:");
    console.error(error?.message || error);

    console.log("\nRestoring touched source files...");

    for (const [relativePath, original] of originals.entries()) {
      const absolute = safePath(relativePath);
      fs.writeFileSync(absolute, original, "utf8");
    }

    console.log(`
============================================================
 PHASE 1 ROLLED BACK
============================================================

The files modified during this repair attempt were restored
from the agent's local backup.

Backup:
${backupDir}

DO NOT GIT PUSH.
`);

    process.exit(1);
  }
});
