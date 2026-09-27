import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "vite.config.ts");

if (!fs.existsSync(configPath)) {
  console.error("STOP: vite.config.ts not found.");
  process.exit(1);
}

const original = fs.readFileSync(configPath, "utf8");

const backupDir = path.join(root, "backups", "vitest-config");
fs.mkdirSync(backupDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(
  backupDir,
  `vite.config.${stamp}.ts`
);

fs.writeFileSync(backupPath, original, "utf8");

let source = original;

if (source.includes("'**/backups/**'") || source.includes('"**/backups/**"')) {
  console.log("PASS: backups/** is already excluded from Vitest.");
  process.exit(0);
}

const testMatch = source.match(/test\s*:\s*\{[\s\S]*?\n\s*\}/);

if (!testMatch) {
  console.error("STOP: Existing Vitest test configuration was not found.");
  console.error("vite.config.ts was NOT modified.");
  process.exit(1);
}

const testBlock = testMatch[0];

let newBlock;

if (/exclude\s*:/.test(testBlock)) {
  newBlock = testBlock.replace(
    /exclude\s*:\s*\[/,
    "exclude: [\n      '**/backups/**',"
  );
} else {
  newBlock = testBlock.replace(
    /test\s*:\s*\{/,
    `test: {
    exclude: [
      '**/backups/**',
      '**/node_modules/**',
      '**/dist/**'
    ],`
  );
}

source = source.replace(testBlock, newBlock);

fs.writeFileSync(configPath, source, "utf8");

console.log("");
console.log("==============================================");
console.log(" VITEST BACKUP EXCLUSION INSTALLED");
console.log("==============================================");
console.log("");
console.log("Excluded:");
console.log("  **/backups/**");
console.log("");
console.log("Application source code was NOT modified.");
console.log("TaxGuard workflow was NOT modified.");
console.log("Backup:");
console.log(backupPath);
