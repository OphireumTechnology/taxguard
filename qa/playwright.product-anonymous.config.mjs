import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { requireAnonymousProductMode } from './product-browser/boundary.mjs';
const mode = requireAnonymousProductMode(process.env.TAXGUARD_LOCAL_PRODUCT_QA);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.join(root, 'qa/acceptance-results', `product-anonymous-${randomUUID()}`);
export default defineConfig({
  testDir: path.join(root, 'qa/product-browser'), testMatch: '**/*.spec.mjs',
  workers: 1, retries: 0, fullyParallel: false, timeout: 30000,
  outputDir: path.join(evidence, 'artifacts'),
  reporter: [['list'], ['json', { outputFile: path.join(evidence, 'results.json') }]],
  use: { baseURL: mode.origin, browserName: 'chromium', serviceWorkers: 'block',
    acceptDownloads: false, ignoreHTTPSErrors: false, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [390, 768, 1280].map(width => ({ name: `product-anonymous-${width}`, use: { viewport: { width, height: 900 } } })),
  // No webServer: operator must provide the reviewed synthetic real application, never the shell fixture.
});
