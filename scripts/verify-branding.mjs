import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = process.cwd();
const errors = [];
const checks = [];

const sha256 = (filePath) =>
  crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

const assertCheck = (condition, label, detail = '') => {
  if (condition) {
    checks.push(`PASS: ${label}${detail ? ` (${detail})` : ''}`);
  } else {
    errors.push(`FAIL: ${label}${detail ? ` (${detail})` : ''}`);
  }
};

// 1. Verify authoritative original image is stored byte-for-byte in public/branding/destria-logo-original.png
const suppliedSrc = path.join(root, 'public/assets/aistudio/DeStria_AI_Accounting_Emblem_579f8ed8.png');
const originalBranding = path.join(root, 'public/branding/destria-logo-original.png');
assertCheck(fs.existsSync(originalBranding), 'Original branding file exists');
if (fs.existsSync(suppliedSrc) && fs.existsSync(originalBranding)) {
  assertCheck(
    sha256(suppliedSrc) === sha256(originalBranding),
    'destria-logo-original.png matches supplied emblem byte-for-byte',
    sha256(originalBranding).slice(0, 12)
  );
}

// 2. Verify all optimized variants exist, are non-empty, and have expected dimensions
const expectedPngs = [
  { rel: 'public/branding/destria-logo-original.png', width: 1254, height: 1254 },
  { rel: 'public/branding/destria-logo-hero.png', width: 768, height: 768, alpha: true },
  { rel: 'public/branding/destria-logo-header.png', width: 256, height: 256, alpha: true },
  { rel: 'public/branding/destria-emblem-icon.png', width: 192, height: 192, alpha: true },
  { rel: 'public/branding/destria-favicon.png', width: 64, height: 64, alpha: true },
  { rel: 'public/favicon.png', width: 64, height: 64, alpha: true },
  { rel: 'public/apple-touch-icon.png', width: 180, height: 180, alpha: true },
];

for (const item of expectedPngs) {
  const full = path.join(root, item.rel);
  const exists = fs.existsSync(full);
  assertCheck(exists, `Asset exists: ${item.rel}`);
  if (exists) {
    const meta = await sharp(full).metadata();
    assertCheck(
      meta.width === item.width && meta.height === item.height,
      `Asset dimensions match: ${item.rel}`,
      `${meta.width}x${meta.height}`
    );
    if (item.alpha) {
      assertCheck(Boolean(meta.hasAlpha), `Asset has transparent circular exterior: ${item.rel}`);
    }
  }
}

const icoPath = path.join(root, 'public/favicon.ico');
assertCheck(fs.existsSync(icoPath), 'Root favicon.ico exists');
if (fs.existsSync(icoPath)) {
  const icoBuf = fs.readFileSync(icoPath);
  assertCheck(
    icoBuf.length > 100 && icoBuf.readUInt16LE(0) === 0 && icoBuf.readUInt16LE(2) === 1,
    'Root favicon.ico has valid ICO binary header',
    `${icoBuf.length} bytes, ${icoBuf.readUInt16LE(4)} entries`
  );
}

// 3. Verify centralized asset version and index.html cache invalidation
const assetsTs = fs.readFileSync(path.join(root, 'src/utils/assets.ts'), 'utf8');
const versionMatch = assetsTs.match(/BRAND_ASSET_VERSION\s*=\s*['"]([^'"]+)['"]/);
assertCheck(Boolean(versionMatch), 'BRAND_ASSET_VERSION is defined in src/utils/assets.ts', versionMatch?.[1] || '');
const version = versionMatch?.[1] || '';

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assertCheck(indexHtml.includes('https://destriataxservices.com/'), 'index.html references official website https://destriataxservices.com/');
assertCheck(indexHtml.includes(`/branding/destria-favicon.png?v=${version}`), 'index.html favicon uses cache-busting version');
assertCheck(indexHtml.includes(`/favicon.ico?v=${version}`), 'index.html shortcut icon uses cache-busting version');
assertCheck(indexHtml.includes(`/apple-touch-icon.png?v=${version}`), 'index.html apple-touch-icon uses cache-busting version');

// 4. Verify zero legacy active A/R logo asset paths or visible A/R TAX SERVICES labels remain in active source files
const legacyAssetPatterns = [
  /ar-logo-192\.png/i,
  /ar-tax-services-logo\.(png|webp)/i,
  /ar-tax-logo-monochrome/i,
  /official_ar_logo/i,
];

const walk = (dir) => {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else if (/\.(ts|tsx|html|css)$/.test(entry.name)) results.push(full);
  }
  return results;
};

const activeFiles = [
  ...walk(path.join(root, 'src')),
  path.join(root, 'index.html'),
  path.join(root, 'public/404.html'),
];

const legacyHits = [];
const visibleArHits = [];

for (const file of activeFiles) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');
  for (const pat of legacyAssetPatterns) {
    if (pat.test(content)) {
      legacyHits.push(`${rel} matches ${pat}`);
    }
  }
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
    if (/A\/R\s+TAX\s+SERVICES/i.test(line) || />A\/R</.test(line)) {
      visibleArHits.push(`${rel}:${idx + 1}: ${trimmed.slice(0, 100)}`);
    }
  });
}

assertCheck(legacyHits.length === 0, 'Zero active legacy A/R logo image references remain', legacyHits.join('; '));
assertCheck(visibleArHits.length === 0, 'Zero visible legacy A/R TAX SERVICES branding strings remain', visibleArHits.join('; '));

console.log(checks.join('\n'));
if (errors.length > 0) {
  console.error('\nBRANDING VERIFICATION FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`\nALL ${checks.length} BRANDING CHECKS PASSED.`);
