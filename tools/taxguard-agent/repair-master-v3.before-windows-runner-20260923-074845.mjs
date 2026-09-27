import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
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

const FORBIDDEN = [
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

function sha256(text) {
  return crypto
    .createHash("sha256")
    .update(text, "utf8")
    .digest("hex");
}

function safePath(relativePath) {
  const normalized = String(relativePath).replaceAll("\\", "/");

  if (!ALLOWED_FILES.includes(normalized)) {
    fail(`Outside V3 allowlist: ${normalized}`);
  }

  const lower = normalized.toLowerCase();

  for (const item of FORBIDDEN) {
    if (lower.includes(item.toLowerCase())) {
      fail(`Forbidden path: ${normalized}`);
    }
  }

  const absolute = path.resolve(ROOT, normalized);

  if (!absolute.startsWith(ROOT + path.sep)) {
    fail(`Repository escape blocked: ${normalized}`);
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

function stamp() {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-");
}

if (!process.env.OPENAI_API_KEY) {
  fail("OPENAI_API_KEY is not loaded.");
}

console.log(`
============================================================
 TAXGUARD MASTER REPAIR V3
============================================================

MODE:
  Inspect
    -> Generate complete candidate files
    -> Human approval
    -> SHA-256 verification
    -> Backup
    -> Atomic file replacement
    -> Typecheck
    -> Full tests
    -> Production build
    -> Rollback on failure

ALLOWED FILES:
${ALLOWED_FILES.map(f => `  - ${f}`).join("\n")}

BLOCKED:
  - arbitrary AI shell commands
  - files outside allowlist
  - Firebase credentials
  - .env files
  - git push
  - deployment
  - database migrations
  - destructive repository cleanup
  - password changes
  - test-client creation
  - external tax submission
============================================================
`);

const originals = {};
const hashes = {};

for (const relativePath of ALLOWED_FILES) {
  const absolute = safePath(relativePath);

  if (!fs.existsSync(absolute)) {
    fail(`Required file not found: ${relativePath}`);
  }

  const content = fs.readFileSync(absolute, "utf8");

  originals[relativePath] = content;
  hashes[relativePath] = sha256(content);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const instructions = `
You are performing a controlled stabilization repair of TaxGuard.

Return ONLY valid JSON.

You may modify ONLY the supplied files.

Return this schema:

{
  "summary": "concise description",
  "risk": "low | medium | high",
  "files": [
    {
      "path": "allowed file path",
      "originalSha256": "exact supplied SHA-256",
      "content": "COMPLETE resulting file contents",
      "reason": "why this file must change"
    }
  ]
}

Do not return unchanged files.

Do not return Markdown.

Do not return commands.

Do not access or request secrets.

Do not invent additional files.

============================================================
ARCHITECTURAL CONTRACT
============================================================

LIVE AUTHENTICATION

- LIVE public clients authenticate with Firebase.
- Firebase proves external identity.
- TaxGuard application identity must come from the verified
  /api/auth/firebase-session server bridge.
- Never fabricate LIVE TaxGuard identity in the browser.
- Remove Michael Perotti, m.perotti@example.com,
  678-205-9486 and Perotti Capital Holdings LLC as LIVE fallbacks.
- Firebase auth callbacks must not overwrite a server-provisioned
  TaxGuard currentUser.
- Authenticated Firebase reload must restore the TaxGuard session.
- Firebase sign-out must clear LIVE identity and taxpayer state.

LIVE REGISTRATION

- Firebase registration is mandatory for LIVE public clients.
- After Firebase registration obtain the Firebase ID token.
- Provision/restore through /api/auth/firebase-session.
- Do not fall back to legacy Express public registration.
- Public registration cannot choose privileged roles.

PERMANENT CLIENT ID

- Preserve server-side Client ID allocation.
- Firebase UID and permanent Client ID are distinct.
- Never allocate permanent Client IDs in the browser.
- Existing provisioned accounts must retain their existing Client ID.
- Do not allocate duplicate Client IDs.

DEMO

- Preserve artest2026 / artest2026.
- Preserve the existing demo environment and demo fixtures.
- Do not delete DemoAuthService.
- LIVE users must never receive demo taxpayer data.
- Empty LIVE datasets are valid.
- Never substitute demo data for missing LIVE data.
- Environment is determined by authentication/session authority,
  not merely route names.

ROUTING

- Canonical login is /#/client/login.
- Canonical registration is /#/client/register.
- Do not classify those canonical LIVE authentication pages as
  demo merely because the URL contains /login.
- Preserve stage_one_onboard as a valid route.
- Preserve staff/reviewer/admin demo routing unless a minimal
  client-isolation correction is necessary.

SERVER SECURITY

- Verify Firebase ID token server-side before LIVE session creation.
- Do not create authenticated sessions from caller-supplied
  email/name/profile data.
- Disable unsafe Google authentication behavior if it trusts
  caller-supplied profile information without provider-token
  verification.
- Preserve existing authentication and authorization controls.
- Fail closed.

STATE ISOLATION

- Clear stale taxpayer state before loading a LIVE client.
- Logout clears taxpayer-specific state.
- Demo state cannot leak into LIVE.
- Remove LIVE fallback client IDs such as client_1.
- Remove synthetic demo engagement IDs from LIVE messaging paths.

PRESERVE TAXGUARD

- Preserve Stage 01.
- Preserve Stage 02.
- Preserve Stage 03.
- Preserve TG-CORE-001 through TG-CORE-008.
- Do not weaken AI proposed-only governance.
- Do not weaken human review.
- External tax submission remains disabled.
- Do not perform broad redesigns.
- Do not delete unrelated functionality.
- Make the smallest coherent repair possible.

IMPORTANT:

The COMPLETE resulting file contents you return must compile as part
of the existing application.

Do not truncate files.

Do not use placeholders such as:
  "...existing code..."
  "// unchanged"
  "// rest of file"
  "<snip>"
or similar.

If a supplied file does not require modification, omit it.
`;

const sourcePackage = ALLOWED_FILES.map(file => `
============================================================
FILE: ${file}
SHA256: ${hashes[file]}
============================================================
${originals[file]}
`).join("\n");

console.log("\nGenerating V3 candidate files from current source...\n");

const response = await client.responses.create({
  model: "gpt-5.6-sol",
  reasoning: {
    effort: "high"
  },
  instructions,
  input: sourcePackage
});

const raw = response.output_text?.trim();

if (!raw) {
  fail("OpenAI returned an empty response.");
}

let proposal;

try {
  proposal = JSON.parse(raw);
} catch {
  const invalidPath = path.join(
    ROOT,
    `TAXGUARD_V3_INVALID_${stamp()}.txt`
  );

  fs.writeFileSync(invalidPath, raw, "utf8");

  fail(`Invalid JSON response saved to ${invalidPath}`);
}

if (!Array.isArray(proposal.files)) {
  fail("Proposal does not contain a files array.");
}

if (proposal.files.length === 0) {
  console.log("No source changes were proposed.");
  process.exit(0);
}

if (proposal.files.length > ALLOWED_FILES.length) {
  fail("Proposal contains too many files.");
}

const proposedPaths = new Set();

for (const candidate of proposal.files) {

  if (
    !candidate ||
    typeof candidate.path !== "string" ||
    typeof candidate.originalSha256 !== "string" ||
    typeof candidate.content !== "string"
  ) {
    fail("Malformed candidate file.");
  }

  safePath(candidate.path);

  if (proposedPaths.has(candidate.path)) {
    fail(`Duplicate candidate file: ${candidate.path}`);
  }

  proposedPaths.add(candidate.path);

  if (candidate.originalSha256 !== hashes[candidate.path]) {
    fail(`AI supplied incorrect original SHA-256 for ${candidate.path}`);
  }

  if (candidate.content.length < 100) {
    fail(`Candidate appears truncated: ${candidate.path}`);
  }

  const forbiddenPlaceholders = [
    "...existing code...",
    "// unchanged",
    "// rest of file",
    "<snip>"
  ];

  for (const placeholder of forbiddenPlaceholders) {
    if (candidate.content.includes(placeholder)) {
      fail(
        `Candidate contains truncation placeholder in ${candidate.path}`
      );
    }
  }
}

console.log(`
============================================================
 V3 PROPOSAL READY
============================================================

Summary:
${proposal.summary || "No summary supplied"}

Risk:
${proposal.risk || "not specified"}

Files proposed:
`);

for (const candidate of proposal.files) {
  console.log(`  - ${candidate.path}`);
  console.log(`    ${candidate.reason || ""}`);
}

console.log(`
NO TAXGUARD SOURCE FILE HAS BEEN MODIFIED.
`);

const rl = readline.createInterface({
  input,
  output
});

const answer = await rl.question(
  "Type YES to apply the V3 candidate files, or anything else to cancel: "
);

rl.close();

if (answer.trim() !== "YES") {
  console.log("\nCANCELLED. No TaxGuard source file was modified.");
  process.exit(0);
}

console.log(`
============================================================
 V3 PRE-WRITE VERIFICATION
============================================================
`);

for (const candidate of proposal.files) {
  const absolute = safePath(candidate.path);
  const current = fs.readFileSync(absolute, "utf8");
  const currentHash = sha256(current);

  if (currentHash !== hashes[candidate.path]) {
    fail(
      `SOURCE CHANGED AFTER ANALYSIS: ${candidate.path}. ` +
      `Nothing will be written.`
    );
  }
}

console.log("SHA-256 verification: PASS");

const backupDir = path.join(
  ROOT,
  "backups",
  `master-v3-${stamp()}`
);

fs.mkdirSync(backupDir, {
  recursive: true
});

const touched = [];

try {

  for (const candidate of proposal.files) {

    const absolute = safePath(candidate.path);

    const backupName =
      candidate.path.replaceAll("/", "__");

    fs.writeFileSync(
      path.join(backupDir, backupName),
      originals[candidate.path],
      "utf8"
    );
  }

  console.log(`Backup created: ${backupDir}`);

  for (const candidate of proposal.files) {

    const absolute = safePath(candidate.path);

    fs.writeFileSync(
      absolute,
      candidate.content,
      "utf8"
    );

    touched.push(candidate.path);
  }

  console.log(`
============================================================
 V3 FILES APPLIED
============================================================

Running mandatory validation...
`);

  run("npm.cmd", ["run", "typecheck"]);
  run("npm.cmd", ["test", "--", "--run"]);
  run("npm.cmd", ["run", "build"]);

  const diff = execFileSync(
    "git",
    ["diff", "--", ...touched],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 30 * 1024 * 1024
    }
  );

  const reportPath = path.join(
    ROOT,
    `TAXGUARD_MASTER_V3_REPORT_${stamp()}.txt`
  );

  const report = `
TAXGUARD MASTER REPAIR V3

STATUS: VALIDATION PASSED

Summary:
${proposal.summary || ""}

Risk:
${proposal.risk || ""}

Files changed:
${touched.join("\n")}

Backup:
${backupDir}

VALIDATION:
TypeScript: PASS
Full test suite: PASS
Production build: PASS

NO GIT PUSH PERFORMED.
NO DEPLOYMENT PERFORMED.
NO DATABASE MIGRATION PERFORMED.
NO FIREBASE CREDENTIAL ACCESSED.
NO EXTERNAL TAX SUBMISSION ENABLED.

============================================================
GIT DIFF
============================================================

${diff}
`;

  fs.writeFileSync(
    reportPath,
    report,
    "utf8"
  );

  console.log(`
============================================================
 TAXGUARD MASTER V3 VALIDATED
============================================================

TypeScript: PASS
Tests:      PASS
Build:      PASS

Backup:
${backupDir}

Report:
${reportPath}

DO NOT GIT PUSH YET.
`);

} catch (error) {

  console.error("");
  console.error("============================================================");
  console.error(" V3 VALIDATION FAILED");
  console.error("============================================================");
  console.error("");
  console.error(error?.message || error);

  console.log("\nRestoring exact original files...");

  for (const relativePath of touched) {

    const absolute = safePath(relativePath);

    fs.writeFileSync(
      absolute,
      originals[relativePath],
      "utf8"
    );
  }

  console.log(`
============================================================
 TAXGUARD MASTER V3 ROLLED BACK
============================================================

All V3-written TaxGuard files were restored.

Backup:
${backupDir}

DO NOT GIT PUSH.
`);

  process.exit(1);
}
