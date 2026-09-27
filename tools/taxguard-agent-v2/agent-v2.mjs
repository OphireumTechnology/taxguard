import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const AGENT = process.cwd();
const ROOT = path.resolve(AGENT, "..", "..");

const POLICY = JSON.parse(
  fs.readFileSync(path.join(AGENT, "config", "policy.json"), "utf8")
);

const ARCHITECTURE = JSON.parse(
  fs.readFileSync(path.join(AGENT, "config", "architecture.json"), "utf8")
);

const EXCLUDED = [
  "node_modules",
  "dist",
  "backups",
  ".git",
  ".env",
  "firebase-admin",
  "service-account",
  "serviceaccount"
];

const EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json"
]);

function excluded(file) {
  const normalized = file.toLowerCase().replaceAll("\\", "/");

  return EXCLUDED.some(x =>
    normalized.includes(x.toLowerCase())
  );
}

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (excluded(full)) continue;

    if (entry.isDirectory()) {
      walk(full, output);
      continue;
    }

    if (!EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    output.push(full);
  }

  return output;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll("\\", "/");
}

function hash(text) {
  return crypto
    .createHash("sha256")
    .update(text, "utf8")
    .digest("hex")
    .slice(0, 16);
}

const args = process.argv.slice(2);
const query = args.join(" ").trim();

if (!query) {
  console.log(`
Usage:

node .\\agent-v2.mjs "describe the problem"

Example:

node .\\agent-v2.mjs "artest2026 demo login invalid credentials"
`);
  process.exit(0);
}

console.log(`
============================================================
 TAXGUARD DEVELOPMENT AGENT V2
 LOCAL-FIRST / ZERO-API DISCOVERY
============================================================

Task:
${query}

Policy:
  Local search first
  Maximum AI files: ${POLICY.maxFilesPerAiRequest}
  Maximum context characters: ${POLICY.maxContextCharacters}
  Maximum API calls per task: ${POLICY.maxApiCallsPerTask}

OpenAI API calls during this operation:
  0
============================================================
`);

const terms = query
  .toLowerCase()
  .split(/[^a-z0-9_@.-]+/)
  .filter(x => x.length >= 3);

const specialTerms = [
  "artest2026",
  "demoauthservice",
  "login",
  "firebase",
  "firebase-session",
  "client/login"
];

const searchTerms = [...new Set([...terms, ...specialTerms])];

const files = walk(path.join(ROOT, "src"));

const matches = [];

for (const file of files) {
  let content;

  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }

  const lower = content.toLowerCase();

  let score = 0;
  const found = [];

  for (const term of searchTerms) {
    if (lower.includes(term)) {
      score++;
      found.push(term);
    }
  }

  if (score > 0) {
    matches.push({
      file,
      relative: relative(file),
      content,
      score,
      found
    });
  }
}

matches.sort((a, b) => b.score - a.score);

const selected = matches.slice(
  0,
  POLICY.maxFilesPerAiRequest
);

console.log("Top locally discovered files:\n");

selected.forEach((item, index) => {
  console.log(
    `${index + 1}. ${item.relative}`
  );
  console.log(
    `   score=${item.score} matches=${item.found.join(", ")}`
  );
});

const contextParts = [];

for (const item of selected) {
  const lines = item.content.split(/\r?\n/);

  const interesting = new Set();

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();

    if (
      searchTerms.some(term =>
        lower.includes(term)
      )
    ) {
      for (
        let j = Math.max(0, i - 15);
        j <= Math.min(lines.length - 1, i + 25);
        j++
      ) {
        interesting.add(j);
      }
    }
  }

  const sorted = [...interesting].sort((a, b) => a - b);

  let snippet = "";

  for (const lineNumber of sorted) {
    snippet +=
      `${String(lineNumber + 1).padStart(5)} | ` +
      `${lines[lineNumber]}\n`;
  }

  contextParts.push(`
============================================================
FILE: ${item.relative}
HASH: ${hash(item.content)}
============================================================
${snippet}
`);
}

let context = contextParts.join("\n");

if (context.length > POLICY.maxContextCharacters) {
  context = context.slice(
    0,
    POLICY.maxContextCharacters
  );

  context +=
    "\n\n[CONTEXT TRUNCATED BY TAXGUARD TOKEN BUDGET]\n";
}

const taskId = crypto
  .createHash("sha256")
  .update(query + context)
  .digest("hex")
  .slice(0, 16);

const report = {
  taskId,
  createdAt: new Date().toISOString(),
  query,
  apiCalls: 0,
  selectedFiles: selected.map(x => x.relative),
  contextCharacters: context.length,
  policy: {
    maxFiles: POLICY.maxFilesPerAiRequest,
    maxContextCharacters: POLICY.maxContextCharacters,
    maxApiCalls: POLICY.maxApiCallsPerTask
  }
};

const cacheDir = path.join(
  AGENT,
  "cache",
  "tasks"
);

fs.mkdirSync(cacheDir, {
  recursive: true
});

fs.writeFileSync(
  path.join(cacheDir, `${taskId}.json`),
  JSON.stringify(report, null, 2),
  "utf8"
);

const contextFile = path.join(
  cacheDir,
  `${taskId}-context.txt`
);

fs.writeFileSync(
  contextFile,
  `
TAXGUARD LOCAL CONTEXT PACKAGE

TASK:
${query}

ARCHITECTURE:
${JSON.stringify(ARCHITECTURE, null, 2)}

RELEVANT SOURCE:
${context}
`,
  "utf8"
);

console.log(`
============================================================
 LOCAL ANALYSIS COMPLETE
============================================================

Task ID:
${taskId}

Files selected:
${selected.length}

Context characters:
${context.length}

OpenAI API calls:
0

Context package:
${contextFile}

The repository was NOT sent to OpenAI.
No TaxGuard source file was modified.
============================================================
`);
