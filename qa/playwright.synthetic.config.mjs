// Operator-only browser preparation; no dotenv, credential loading or production target.
import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.join(root, 'qa/acceptance-results', `browser-${randomUUID()}`);
export default defineConfig({
  testDir: path.join(root, 'qa/browser'), testMatch: '**/*.spec.mjs',
  workers: 1, fullyParallel: false, retries: 0, timeout: 30000,
  outputDir: path.join(evidence, 'artifacts'),
  reporter: [['list'], ['json', { outputFile: path.join(evidence, 'results.json') }]],
  use: { baseURL: 'http://127.0.0.1:4179', browserName: 'chromium',
    serviceWorkers: 'block', acceptDownloads: false, ignoreHTTPSErrors: false,
    screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [390, 768, 1280].map(width => ({ name: `synthetic-${width}`, use: { viewport: { width, height: 900 } } })),
  webServer: { command: 'node scripts/serve-synthetic-shell.mjs', cwd: root,
    url: 'http://127.0.0.1:4179', reuseExistingServer: false, timeout: 10000 },
});
