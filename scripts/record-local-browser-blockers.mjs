// Records observed prerequisite availability only. Never launches/builds a browser or certifies scenarios.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { unverifiedBrowserScenarios } from './synthetic-acceptance-plan.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = { recordedAt: new Date().toISOString(), scope: 'LOCAL_BROWSER_PREREQUISITES_ONLY',
  fixtureArtifactAvailable: fs.existsSync(path.join(root, 'qa/synthetic-shell/artifacts/index.html')),
  playwrightPackageAvailable: fs.existsSync(path.join(root, 'node_modules/@playwright/test')),
  historicalBuildBlocker: 'SANDBOX_SPAWN_EPERM_NOT_RETRIED', actualBrowserExecuted: false,
  scenarios: unverifiedBrowserScenarios(), releaseRecommendation: 'NO-GO' };
const directory = path.join(root, 'qa/acceptance-results');
fs.mkdirSync(directory, { recursive: true });
const target = path.join(directory, `browser-prerequisites-${randomUUID()}.json`);
fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ report: target, fixtureArtifactAvailable: report.fixtureArtifactAvailable,
  playwrightPackageAvailable: report.playwrightPackageAvailable, scenarios: report.scenarios.length, actualBrowserExecuted: false }));
