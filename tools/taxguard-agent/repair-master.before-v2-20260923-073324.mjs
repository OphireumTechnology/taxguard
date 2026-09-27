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

MASTER TAXGUARD STABILIZATION GOAL:

Perform one coordinated repair of the TaxGuard authentication,
LIVE/DEMO isolation, session restoration, permanent client identity,
and canonical client routing architecture.

This is a targeted stabilization pass, NOT a redesign.

============================================================
A. LIVE AUTHENTICATION
============================================================

1. LIVE clients authenticate through Firebase Authentication.

2. Firebase Authentication is identity proof only.

3. TaxGuard application identity MUST be restored/provisioned through:

   Firebase Auth
       -> Firebase ID token
       -> /api/auth/firebase-session
       -> verified server session
       -> TaxGuard currentUser

4. Never construct a LIVE TaxGuard application identity from
   untrusted browser-provided profile information.

5. Firebase onAuthStateChanged must not fabricate application users.

6. Remove LIVE fallback identities including:

   Michael Perotti
   m.perotti@example.com
   678-205-9486
   Perotti Capital Holdings LLC

7. Firebase callbacks must not overwrite an already established
   TaxGuard server identity.

8. On browser reload with an authenticated Firebase user,
   restore the TaxGuard server session safely.

9. On Firebase sign-out, clear LIVE identity and taxpayer state.

============================================================
B. LIVE REGISTRATION
============================================================

10. LIVE public registration must use Firebase registration.

11. After successful Firebase registration obtain a verified ID token.

12. Provision/restore the TaxGuard workspace through firebase-session.

13. Remove LIVE fallback to legacy Express registration.

14. Do not allow public registration to choose privileged roles.

15. Preserve existing email verification behavior where compatible.

============================================================
C. PERMANENT CLIENT ID
============================================================

16. Preserve server-side permanent Client ID allocation.

17. Firebase UID and permanent TaxGuard Client ID are different
    identifiers and must not be silently conflated.

18. Never allocate permanent Client IDs in the browser.

19. Never allocate a second permanent Client ID for an existing
    provisioned Firebase account.

20. Preserve existing permanent Client ID returned by the server.

============================================================
D. DEMO / LIVE ISOLATION
============================================================

21. Preserve artest2026 demonstration login.

22. Demo fixtures remain available only to the demo environment.

23. LIVE clients must never receive another taxpayer's demo identity,
    notifications, documents, appointments, invoices, engagements,
    messages, onboarding data or dashboard data.

24. Empty LIVE datasets are valid.

25. Never replace empty LIVE datasets with demo fixtures.

26. Route names alone must not determine whether an authenticated
    client is LIVE or DEMO.

27. Authentication/session authority determines environment.

28. Do not delete DemoAuthService or the existing demo application.

============================================================
E. ROUTING
============================================================

29. Preserve ONE canonical client login:

    /#/client/login

30. Preserve ONE canonical client registration:

    /#/client/register

31. Correct routing logic that incorrectly classifies the canonical
    LIVE client login/register pages as demo routes.

32. Ensure stage_one_onboard remains a valid navigable route.

33. Preserve existing staff/reviewer/admin demo routing unless a
    minimal change is absolutely required for client isolation.

============================================================
F. SESSION SECURITY
============================================================

34. Server must verify Firebase ID tokens before establishing a LIVE
    TaxGuard session.

35. Do not trust caller-supplied email/name as authentication proof.

36. Repair or disable any authentication endpoint that creates an
    authenticated session solely from caller-supplied identity data.

37. Preserve existing lockout, password, role and authorization
    controls.

38. Do not create authentication bypasses.

39. Do not hardcode LIVE sessions.

40. Do not weaken authorization.

============================================================
G. STATE SAFETY
============================================================

41. LIVE login must clear stale taxpayer state before loading the
    authenticated taxpayer.

42. Logout must clear taxpayer-specific state.

43. Demo state must not survive into a LIVE client workspace.

44. Do not introduce default client IDs such as client_1 into LIVE
    authenticated flows.

45. Do not introduce synthetic engagement IDs into LIVE flows.

============================================================
H. TAXGUARD WORKFLOW PRESERVATION
============================================================

46. Preserve Stage 01.

47. Preserve Stage 02.

48. Preserve Stage 03.

49. Preserve TG-CORE-001 through TG-CORE-008 Intelligence Core.

50. Do not silently mark AI-proposed tax information as verified.

51. Do not weaken human-review requirements.

52. External tax submission MUST remain disabled.

============================================================
I. CHANGE DISCIPLINE
============================================================

53. Modify ONLY files in ALLOWED_FILES.

54. Use minimal targeted replacements.

55. Do not perform broad formatting.

56. Do not rewrite unrelated components.

57. Do not delete existing features merely because they are unused.

58. Do not modify Firebase credentials.

59. Do not read or modify .env files.

60. Do not generate shell commands.

61. Do not perform git operations.

62. Do not deploy anything.

63. Do not create test clients.

64. Do not reset passwords.

65. Do not enable external tax transmission.

66. Preserve existing working behavior whenever it does not violate
    these invariants.

67. Prefer fail-closed behavior for LIVE client data.

68. If an issue cannot be repaired safely within the allowed files,
    leave it unchanged and mention it in the summary rather than
    implementing a speculative workaround.

PHASE 1 GOAL:
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

const totalPatchCharacters = proposal.edits.reduce(
  (total, edit) =>
    total +
    String(edit?.oldText || "").length +
    String(edit?.newText || "").length,
  0
);

if (totalPatchCharacters > 150000) {
  fail(
    `Proposed patch is too large (${totalPatchCharacters} characters).`
  );
}

if (proposal.edits.length === 0) {
  console.log("No Phase 1 changes were proposed.");
  process.exit(0);
}

if (proposal.edits.length > 60) {
  fail(
    `Proposal contains ${proposal.edits.length} edits. Master repair limit is 60.`
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

