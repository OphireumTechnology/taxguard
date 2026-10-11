import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { assessLocalBrowserPrerequisites } from './local-browser-prerequisites.mjs';
if (process.argv.length > 2) { console.error('FIXED_LOCAL_BROWSER_CONFIGURATION_REQUIRED'); process.exit(2); }
const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const cli = path.join(root, 'node_modules/@playwright/test/cli.js');
const artifact = path.join(root, 'qa/synthetic-shell/artifacts/index.html');
function boundedArtifact() {
  if (!fs.existsSync(artifact)) return undefined;
  const resolved = fs.realpathSync(artifact);
  if (!resolved.startsWith(root + path.sep) || fs.statSync(resolved).size > 1048576) return 'INVALID';
  return fs.readFileSync(resolved, 'utf8');
}
const assessment = assessLocalBrowserPrerequisites(fs.existsSync(cli), boundedArtifact());
if (assessment.status === 'BLOCKED') { console.error(JSON.stringify(assessment)); process.exitCode = 2; }
else if (!fs.realpathSync(cli).startsWith(root + path.sep)) { console.error('WORKSPACE_PACKAGE_REQUIRED'); process.exitCode = 2; }
else {
  const child = spawn(process.execPath, [cli, 'test', '--config', 'qa/playwright.synthetic.config.mjs'], {
    cwd: root, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.cache/playwright') },
  });
  child.once('error', () => { console.error('BROWSER_EXECUTION_UNAVAILABLE'); process.exitCode = 1; });
  child.once('close', code => { process.exitCode = code === 0 ? 0 : code || 1; });
}
