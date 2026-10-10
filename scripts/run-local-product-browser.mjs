import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { requireAnonymousProductMode } from '../qa/product-browser/boundary.mjs';
if (process.argv.length > 2) { console.error('FIXED_PRODUCT_QA_CONFIGURATION_REQUIRED'); process.exit(2); }
try { requireAnonymousProductMode(process.env.TAXGUARD_LOCAL_PRODUCT_QA); }
catch { console.error('PRODUCT_ANONYMOUS_QA_DISABLED'); process.exit(2); }
const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const cli = path.join(root, 'node_modules/@playwright/test/cli.js');
if (!fs.existsSync(cli) || !fs.realpathSync(cli).startsWith(root + path.sep)) {
  console.error('WORKSPACE_PLAYWRIGHT_REQUIRED'); process.exit(2);
}
const child = spawn(process.execPath, [cli, 'test', '--config', 'qa/playwright.product-anonymous.config.mjs'], {
  cwd: root, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.cache/playwright') },
});
child.once('error', () => { console.error('PRODUCT_BROWSER_EXECUTION_UNAVAILABLE'); process.exitCode = 1; });
child.once('close', code => { process.exitCode = code === 0 ? 0 : code || 1; });
