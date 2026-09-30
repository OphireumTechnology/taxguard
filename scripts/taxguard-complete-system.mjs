import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const results = [];

function run(name, command, args) {
  console.log("\n============================================================");
  console.log(name);
  console.log("============================================================");

  const result = spawnSync(command, args, {
    cwd: root,
    shell: true,
    encoding: "utf8",
    stdio: "pipe",
    env: process.env,
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  results.push({
    name,
    status: result.status ?? 1,
    stdout,
    stderr,
  });

  return result.status ?? 1;
}

function scanProductionAuthority() {
  const forbidden = [
    "DemoAuthService",
    "DemoAppRouter",
    "DemoVaultService",
    "demoDataStore",
    "INITIAL_DEMO_CLIENTS",
    "DEMO_ROLES",
    "eng_2025_summit",
  ];

  const ignored = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    ".taxguard-backups",
  ]);

  const violations = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;

      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (!/\.(ts|tsx)$/.test(entry.name)) continue;

      const normalized = full.replaceAll("\\", "/");

      if (
        normalized.includes("/src/tests/") ||
        normalized.includes("/src/demo/")
      ) {
        continue;
      }

      const text = fs.readFileSync(full, "utf8");
      const lines = text.split(/\r?\n/);

      lines.forEach((line, index) => {
        for (const token of forbidden) {
          if (line.includes(token)) {
            violations.push({
              file: path.relative(root, full),
              line: index + 1,
              token,
            });
          }
        }

        if (
          /from\s+['"][^'"]*\/demo\//.test(line) ||
          /from\s+['"]\.{1,2}\/demo\//.test(line)
        ) {
          violations.push({
            file: path.relative(root, full),
            line: index + 1,
            token: "production import from /demo/",
          });
        }
      });
    }
  }

  walk(path.join(root, "src"));

  console.log("\n============================================================");
  console.log("PRODUCTION AUTHORITY SCAN");
  console.log("============================================================");

  if (!violations.length) {
    console.log("PASS - no prohibited production authority found.");
    results.push({
      name: "Production authority scan",
      status: 0,
      stdout: "",
      stderr: "",
    });
    return;
  }

  for (const violation of violations) {
    console.log(
      `${violation.file}:${violation.line} -> ${violation.token}`
    );
  }

  results.push({
    name: "Production authority scan",
    status: 1,
    stdout: JSON.stringify(violations, null, 2),
    stderr: "",
  });
}

function scanSecrets() {
  const tracked = spawnSync("git", ["ls-files"], {
    cwd: root,
    shell: true,
    encoding: "utf8",
  });

  const files = (tracked.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean);

  const patterns = [
    {
      name: "OpenAI key",
      regex: /\bsk-[A-Za-z0-9_-]{20,}\b/,
    },
    {
      name: "Private key",
      regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    },
    {
      name: "OpenAI environment secret",
      regex: /OPENAI_API_KEY\s*=\s*.+/,
    },
    {
      name: "Google private key",
      regex: /"private_key"\s*:\s*"-----BEGIN/,
    },
  ];

  const findings = [];

  for (const relative of files) {
    const full = path.join(root, relative);

    if (!fs.existsSync(full)) continue;

    const normalizedRelative = relative.replaceAll("\\", "/");

    // Scan deployable application/configuration source.
    // Exclude security scanners, build tooling and synthetic tests because
    // they legitimately contain credential-pattern terminology.
    if (
      normalizedRelative.startsWith("tools/") ||
      normalizedRelative.startsWith("scripts/") ||
      normalizedRelative.startsWith("src/tests/") ||
      normalizedRelative.includes("/fixtures/") ||
      normalizedRelative.endsWith(".test.ts") ||
      normalizedRelative.endsWith(".test.tsx") ||
      normalizedRelative.endsWith(".spec.ts") ||
      normalizedRelative.endsWith(".spec.tsx") ||
      normalizedRelative === ".env.example"
    ) {
      continue;
    }

    if (
      relative === ".env.example" ||
      relative.endsWith(".example") ||
      relative.includes("/fixtures/") ||
      relative.includes("\\fixtures\\")
    ) {
      continue;
    }

    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;

    // file is verified

    if (
      normalizedRelative.includes("/tests/") ||
      normalizedRelative.endsWith(".test.ts") ||
      normalizedRelative.endsWith(".test.tsx") ||
      normalizedRelative.endsWith(".spec.ts") ||
      normalizedRelative.endsWith(".spec.tsx")
    ) {
      continue;
    }

    if (
      relative.includes("package-lock.json") ||
      relative.includes("node_modules/")
    ) {
      continue;
    }

    let text;

    try {
      text = fs.readFileSync(full, "utf8");
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          findings.push({
            file: relative,
            line: index + 1,
            type: pattern.name,
          });
        }
      }
    });
  }

  console.log("\n============================================================");
  console.log("SECRET SCAN");
  console.log("============================================================");

  if (!findings.length) {
    console.log("PASS - no targeted secrets detected.");
    results.push({
      name: "Secret scan",
      status: 0,
      stdout: "",
      stderr: "",
    });
    return;
  }

  for (const finding of findings) {
    console.log(
      `${finding.file}:${finding.line} -> ${finding.type}`
    );
  }

  results.push({
    name: "Secret scan",
    status: 1,
    stdout: JSON.stringify(findings, null, 2),
    stderr: "",
  });
}

console.log(`
============================================================
 TAXGUARD COMPLETE SYSTEM RELEASE GATE
============================================================
`);

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";

run(
  "1. TYPESCRIPT",
  npmBin,
  ["run", "typecheck"]
);

scanProductionAuthority();

run(
  "2. PRODUCTION AUTHORITY TESTS",
  npxBin,
  [
    "vitest",
    "run",
    "src/tests/liveProductionAuthority.test.ts",
    "src/tests/productionBoundary.test.ts",
  ]
);

run(
  "3. COMPLETE REGRESSION SUITE",
  npmBin,
  ["test", "--", "--run"]
);

run(
  "4. PRODUCTION BUILD",
  npmBin,
  ["run", "build"]
);

run(
  "5. GIT DIFF CHECK",
  "git",
  ["diff", "--check"]
);

scanSecrets();

const failed = results.filter((result) => result.status !== 0);

console.log(`
============================================================
 TAXGUARD COMPLETE SYSTEM RESULT
============================================================
`);

for (const result of results) {
  console.log(
    `${result.status === 0 ? "PASS" : "FAIL"}  ${result.name}`
  );
}

console.log("\nCurrent branch:");

spawnSync(
  "git",
  ["branch", "--show-current"],
  {
    cwd: root,
    shell: true,
    stdio: "inherit",
  }
);

console.log("\nWorking tree:");

spawnSync(
  "git",
  ["status", "--short"],
  {
    cwd: root,
    shell: true,
    stdio: "inherit",
  }
);

if (!failed.length) {
  console.log(`
============================================================
 TAXGUARD APPLICATION ENGINEERING GATES PASSED
============================================================

The repository is ready for final release review.

Do NOT automatically deploy external services.

External production infrastructure still requires separate
commissioning where applicable:
- document quarantine
- malware scanning
- production OCR
- Supabase production configuration
- IAM / Secret Manager
- IRS MeF
- state filing systems
- payment systems
- electronic signature systems
`);
} else {
  console.log(`
============================================================
 TAXGUARD HAS ${failed.length} BLOCKING GATE(S)
============================================================

The application has NOT been committed or deployed.

All failures from the entire repository are shown above in this
single run. Fix them together rather than one at a time.
`);
}

process.exitCode = failed.length ? 1 : 0;


