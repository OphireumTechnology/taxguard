import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = path.resolve(process.cwd(), "../..");

if (!process.env.OPENAI_API_KEY) {
  console.error("");
  console.error("OPENAI_API_KEY is not configured.");
  console.error("Set it in your PowerShell environment before running this agent.");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const allowedFiles = [
  "src/context/AppContext.tsx",
  "src/components/portal/StageOneIdentityWizard.tsx",
  "src/services/stageOneOnboardingService.ts",
  "src/services/stageTwoCollectionService.ts",
  "src/server/routes/auth.routes.ts",
  "src/server/routes/onboarding.routes.ts",
  "src/services/api.ts"
];

function readSafe(relativePath) {
  const full = path.resolve(ROOT, relativePath);

  if (!full.startsWith(ROOT)) {
    throw new Error("Unsafe path rejected.");
  }

  if (!fs.existsSync(full)) {
    return `[FILE NOT FOUND: ${relativePath}]`;
  }

  return fs.readFileSync(full, "utf8");
}

function run(command, args = []) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      timeout: 120000
    });
  } catch (error) {
    return [
      error.stdout || "",
      error.stderr || "",
      `EXIT CODE: ${error.status ?? "unknown"}`
    ].join("\n");
  }
}

console.log("");
console.log("==============================================");
console.log(" TAXGUARD LOCAL DEVELOPMENT AGENT");
console.log(" READ-ONLY MODE");
console.log("==============================================");
console.log("");

const gitStatus = run("git", ["status", "--short"]);
const typecheck = run("npm.cmd", ["run", "typecheck"]);

let source = "";

for (const file of allowedFiles) {
  source += `\n\n===== ${file} =====\n`;
  source += readSafe(file);
}

const instructions = `
You are the TaxGuard engineering review agent.

This is a READ-ONLY review.

Architecture requirements:

1. Preserve Stage 01, Stage 02 and Stage 03.
2. Preserve the existing Intelligence Core.
3. Preserve demo account artest2026.
4. LIVE Firebase clients must never inherit demo taxpayers.
5. LIVE identity must use:
   - Firebase UID for authentication identity.
   - permanent Client ID for taxpayer/client identity.
   - TaxGuard server session for authorization.
6. LIVE missing records must produce an empty/new-client state.
7. Never fall back to:
   - cli_perotti
   - Michael Perotti
   - Perotti Capital Holdings
   - demoDataStore
   - random AR-CLT identifiers
8. Demo fixtures may remain inside the demo environment.
9. Do not weaken authentication.
10. Do not expose credentials.
11. Do not enable external tax submission.
12. AI-generated tax conclusions must remain proposed-only until applicable human/rule approval.
13. Do not recommend deleting working modules merely to simplify architecture.

Analyze the supplied source and return:

A. Critical defects
B. LIVE/demo isolation defects
C. Client-ID defects
D. Stage-gating defects
E. Persistence defects
F. Dashboard defects
G. AI/Intelligence-Core integration defects
H. Exact files requiring changes
I. Proposed repair sequence
J. Regression tests required

Do NOT output destructive shell commands.
Do NOT modify files.
`;

console.log("Sending TaxGuard source for engineering analysis...");
console.log("");

const response = await client.responses.create({
  model: "gpt-5.6-sol",
  reasoning: {
    effort: "high"
  },
  input: `
${instructions}

===== GIT STATUS =====
${gitStatus}

===== TYPESCRIPT CHECK =====
${typecheck}

===== SOURCE =====
${source}
`
});

const result =
  response.output_text ||
  "No textual analysis was returned.";

const reportPath = path.join(
  ROOT,
  `TAXGUARD_AGENT_REPORT_${Date.now()}.txt`
);

fs.writeFileSync(reportPath, result, "utf8");

console.log(result);

console.log("");
console.log("==============================================");
console.log(" REVIEW COMPLETE");
console.log("==============================================");
console.log("");
console.log(`Report: ${reportPath}`);
console.log("");
console.log("NO SOURCE FILES WERE MODIFIED.");
