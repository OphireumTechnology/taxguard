// Explicit operator command: local packages/cache only; no global install, admin, dotenv or live target.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.cache/playwright') };
const steps = [
  // Explicit .cmd avoids PowerShell resolving npm to its execution-policy-controlled .ps1 shim.
  ['npm.cmd install --save-dev @playwright/test --ignore-scripts --no-audit --no-fund --cache .cache/npm --fetch-retries=0 --fetch-timeout=15000', 'npm', ['install', '--save-dev', '@playwright/test', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', '.cache/npm', '--fetch-retries=0', '--fetch-timeout=15000']],
  ['node node_modules/@playwright/test/cli.js install chromium', 'node', ['node_modules/@playwright/test/cli.js', 'install', 'chromium']],
  ['npm.cmd run qa:fixture:build', 'npm', ['run', 'qa:fixture:build']],
  ['npm.cmd run qa:browser', 'npm', ['run', 'qa:browser']],
];
if (process.argv.slice(2).some(arg => arg !== '--plan')) { console.error('Only --plan is supported.'); process.exit(2); }
if (process.argv.includes('--plan')) console.log(JSON.stringify({ steps: steps.map(step => step[0]), browserCache: env.PLAYWRIGHT_BROWSERS_PATH, scope: 'LOCAL_SYNTHETIC_SHARED_SHELL_ONLY' }, null, 2));
else {
  for (const [windowsCommand, command, args] of steps) {
    const result = process.platform === 'win32'
      ? spawnSync('powershell.exe', ['-NoProfile', '-Command', windowsCommand], { cwd: root, env, stdio: 'inherit', windowsHide: true })
      : spawnSync(command, args, { cwd: root, env, stdio: 'inherit' });
    if (result.status !== 0 || result.error) {
      console.error('LOCAL_BROWSER_SETUP_BLOCKED: step failed; no automatic retry or release authorization.');
      process.exit(result.status || 1);
    }
  }
}
