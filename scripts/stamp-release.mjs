#!/usr/bin/env node
/**
 * Release stamping for the static production build (run after `vite build`, before upload).
 *
 * 1. Cache invalidation: Vite content-hashes the bundled JS/CSS, but files served from public/ (logos, favicons,
 *    touch icons) keep their paths. Their URLs carry `?v=<BRAND_ASSET_VERSION>` (src/utils/assets.ts). This step
 *    appends the release commit to that token in every built HTML/JS/CSS file, so every release gets new asset URLs
 *    and browsers cannot keep showing outdated branding, even when nobody bumped the token by hand.
 * 2. Deployment record: writes dist/version.json with the exact commit, ref and workflow run.
 * 3. Custom domain: writes dist/CNAME and verifies it.
 *
 * Usage: node scripts/stamp-release.mjs --commit <40-hex sha> [--domain destriataxservices.com] [--dist dist]
 * Exits non-zero (and the workflow fails before deployment) on any inconsistency.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const fail = message => { console.error(`::error::${message}`); process.exit(1); };

const commit = String(args.commit || '').trim();
const domain = String(args.domain || 'destriataxservices.com').trim();
const dist = path.resolve(String(args.dist || 'dist'));
if (!/^[0-9a-f]{40}$/.test(commit)) fail('A full 40-character lowercase commit SHA is required (--commit).');
if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) fail(`Invalid custom domain: ${domain}`);
if (!fs.existsSync(path.join(dist, 'index.html'))) fail(`Missing ${path.join(dist, 'index.html')}; run the build first.`);

const assetsSource = fs.readFileSync('src/utils/assets.ts', 'utf8');
const tokenMatch = assetsSource.match(/export const BRAND_ASSET_VERSION = '([A-Za-z0-9._-]+)';/);
if (!tokenMatch) fail('BRAND_ASSET_VERSION was not found in src/utils/assets.ts.');
const token = tokenMatch[1];
const short = commit.slice(0, 12);
const stamped = `${token}-${short}`;

const files = [];
const walk = dir => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(html|js|css)$/.test(entry.name)) files.push(full);
  }
};
walk(dist);

// The token is matched only where it ends (not followed by another version character), so an already stamped value
// is never stamped again. It appears as `?v=<token>` in HTML and as the quoted constant in the JS bundle
// (resolveAssetUrl appends it at runtime).
const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const exact = new RegExp(`(\\?v=|["'])${escaped}(?![A-Za-z0-9._-])`, 'g');
let replaced = 0;
let indexReplaced = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const occurrences = (text.match(exact) || []).length;
  if (!occurrences) continue;
  fs.writeFileSync(file, text.replace(exact, (_whole, prefix) => `${prefix}${stamped}`));
  replaced += occurrences;
  if (path.basename(file) === 'index.html' && path.dirname(file) === dist) indexReplaced += occurrences;
}
if (indexReplaced < 3) fail(`Expected the favicon, shortcut icon and touch icon URLs in index.html to be versioned; stamped ${indexReplaced}.`);
const unstamped = new RegExp(`(\\?v=|["'])${escaped}(?![A-Za-z0-9._-])`);
for (const file of files) {
  if (unstamped.test(fs.readFileSync(file, 'utf8'))) fail(`Unstamped asset version left in ${path.relative(dist, file)}.`);
}

fs.writeFileSync(path.join(dist, 'CNAME'), `${domain}\n`);
if (fs.readFileSync(path.join(dist, 'CNAME'), 'utf8') !== `${domain}\n`) fail('CNAME verification failed.');

const record = {
  application: 'TaxGuard AI by DESTRIA TAX SERVICES LLC',
  commit,
  shortCommit: short,
  ref: process.env.GITHUB_REF || null,
  repository: process.env.GITHUB_REPOSITORY || null,
  workflowRun: process.env.GITHUB_RUN_ID ? { id: process.env.GITHUB_RUN_ID, attempt: process.env.GITHUB_RUN_ATTEMPT || '1' } : null,
  builtAt: new Date().toISOString(),
  brandAssetVersion: stamped,
  customDomain: domain,
};
fs.writeFileSync(path.join(dist, 'version.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(`Stamped ${replaced} asset version references (${indexReplaced} in index.html) as ${stamped}; CNAME ${domain}; version.json for ${commit}.`);
