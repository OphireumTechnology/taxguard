/**
 * Offline staging configuration check. Reads the variables named in
 * docs/development/staging.env.template — from the environment, or from a file given with
 * --config-file (parsed here, never loaded into the environment) — and runs
 * validateStagingEnvironment. Prints area states, field names and issue codes only — never values.
 * Connects to nothing; creates, resets or migrates nothing.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/staging/check-staging-config.ts [--config-file <path>]
 * Exit 0: no issues found by these checks (READY_FOR_OWNER_REVIEW — NOT a release authorization);
 * 1: issues; 2: the env file could not be read.
 */
import fs from 'node:fs';
import { parseEnvText, validateStagingEnvironment } from '../../src/server/config/stagingEnvironmentValidator';

const names = fs.readFileSync('docs/development/staging.env.template', 'utf8').split(/\r?\n/)
  .map(l => /^([A-Z0-9_]+)=/.exec(l)?.[1]).filter((n): n is string => Boolean(n));
// Not "--env-file": Node itself would load such a file into the process environment.
const fileArg = process.argv.indexOf('--config-file');
let source: Record<string, string | undefined> = process.env;
if (fileArg > 0) {
  try { source = parseEnvText(fs.readFileSync(process.argv[fileArg + 1], 'utf8')); }
  catch { console.log(JSON.stringify({ error: 'ENV_FILE_UNREADABLE' })); process.exit(2); }
}
// Only template names are considered, plus any VITE_ name (to catch secrets placed in the browser build).
const values = Object.fromEntries(Object.keys(source).filter(n => names.includes(n) || /^VITE_/.test(n)).map(n => [n, source[n]]).concat(names.filter(n => !(n in source)).map(n => [n, undefined])));
const result = validateStagingEnvironment(values);
console.log(JSON.stringify({ checkedFields: Object.keys(values).length, ...result }, null, 2));
process.exit(result.issues.length ? 1 : 0);
