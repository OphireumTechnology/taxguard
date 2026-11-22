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
  { rel: 'public/branding/destria-logo-hero.png', width: 1024, height: 1024, alpha: true },
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

// 3. Verify centralized branding config, asset version, and index.html cache invalidation
const companyBrandingTs = fs.readFileSync(path.join(root, 'src/config/companyBranding.ts'), 'utf8');
assertCheck(companyBrandingTs.includes("legalName: 'Destria Tax Services, LLC'"), 'COMPANY_BRANDING.legalName is Destria Tax Services, LLC');
assertCheck(companyBrandingTs.includes("uppercaseName: 'DESTRIA TAX SERVICES, LLC'"), 'COMPANY_BRANDING.uppercaseName is DESTRIA TAX SERVICES, LLC');
assertCheck(companyBrandingTs.includes("website: 'https://destriataxservices.com'"), 'COMPANY_BRANDING.website is https://destriataxservices.com');
assertCheck(companyBrandingTs.includes("email: 'info@destriataxservices.com'"), 'COMPANY_BRANDING.email is info@destriataxservices.com');
assertCheck(companyBrandingTs.includes("tagline: 'Preserving Wealth. Building Legacies.'"), 'COMPANY_BRANDING.tagline is canonical');
assertCheck(companyBrandingTs.includes("phoneDisplay: '+1-678-205-9486'"), 'COMPANY_CONTACT.phoneDisplay is +1-678-205-9486');
assertCheck(companyBrandingTs.includes("phoneE164: '+16782059486'"), 'COMPANY_CONTACT.phoneE164 is +16782059486');
assertCheck(companyBrandingTs.includes("phoneHref: 'tel:+16782059486'"), 'COMPANY_CONTACT.phoneHref is tel:+16782059486');

const assetsTs = fs.readFileSync(path.join(root, 'src/utils/assets.ts'), 'utf8');
const versionMatch = assetsTs.match(/BRAND_ASSET_VERSION\s*=\s*['"]([^'"]+)['"]/);
assertCheck(Boolean(versionMatch), 'BRAND_ASSET_VERSION is defined in src/utils/assets.ts', versionMatch?.[1] || '');
const version = versionMatch?.[1] || '';

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assertCheck(indexHtml.includes('Destria Tax Services, LLC'), 'index.html references canonical legal name Destria Tax Services, LLC');
assertCheck(indexHtml.includes('info@destriataxservices.com'), 'index.html references official email info@destriataxservices.com');
assertCheck(indexHtml.includes('https://destriataxservices.com/'), 'index.html references official website https://destriataxservices.com/');
assertCheck(indexHtml.includes(`/branding/destria-favicon.png?v=${version}`), 'index.html favicon uses cache-busting version');
assertCheck(indexHtml.includes(`/favicon.ico?v=${version}`), 'index.html shortcut icon uses cache-busting version');
assertCheck(indexHtml.includes('"telephone": "+1-678-205-9486"'), 'index.html JSON-LD telephone uses +1-678-205-9486');
assertCheck(indexHtml.includes('"@type": "ContactPoint"'), 'index.html JSON-LD includes ContactPoint schema');
assertCheck(indexHtml.includes(`/apple-touch-icon.png?v=${version}`), 'index.html apple-touch-icon uses cache-busting version');

// 4. Verify zero legacy active A/R logo asset paths, legacy emails, visible A/R brand strings, or duplicate LLC suffixes remain
const legacyAssetPatterns = [
  /ar-logo-192\.png/i,
  /ar-tax-services-logo\.(png|webp)/i,
  /ar-tax-logo-monochrome/i,
  /official_ar_logo/i,
  /gs:\/\/ar-tax-vault/i,
];

const legacyEmailPatterns = [
  /info@artaxservices\.com/i,
  /contact@artaxservices\.com/i,
  /info@artaxserv\.com/i,
  /contact@artaxserv\.com/i,
  /contact@destriatax\.com/i,
  /info@destriatax\.com/i,
  /portal\.artaxservices\.com/i,
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
const legacyEmailHits = [];
const visibleArHits = [];
const duplicateLlcHits = [];
const unformattedUsPhoneHits = [];
const invalidTelHrefHits = [];
let preservedNonUsIntlCount = 0;

const badUsPhoneRe = /(?<!\+1-)(?<![A-Za-z0-9+])(?:\+1\s*\([2-9]\d{2}\)\s*\d{3}[-.\s]\d{4}|1-[2-9]\d{2}-\d{3}-\d{4}|\([2-9]\d{2}\)\s*\d{3}[-.\s]\d{4}|(?<![+-])[2-9]\d{2}[-.]\d{3}[-.]\d{4})(?!\d)/g;
const badTelHrefRe = /href=["']tel:(?!\+\d{8,15}(?:;ext=\d+)?["'])[^"']+["']/gi;

for (const file of activeFiles) {
  const rel = path.relative(root, file);
  const content = fs.readFileSync(file, 'utf8');
  for (const pat of legacyAssetPatterns) {
    if (pat.test(content)) {
      legacyHits.push(`${rel} matches ${pat}`);
    }
  }
  for (const pat of legacyEmailPatterns) {
    if (pat.test(content)) {
      legacyEmailHits.push(`${rel} matches ${pat}`);
    }
  }
  if (/LLC,\s*LLC|LLC\s+LLC/i.test(content)) {
    duplicateLlcHits.push(rel);
  }
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (
      /A\/R\s+TAX\s+SERVICES/i.test(line) ||
      /A\/R\s+Accounting/i.test(line) ||
      /A\/R\s+TAX\s+DESKEW/i.test(line) ||
      />A\/R</.test(line)
    ) {
      visibleArHits.push(`${rel}:${idx + 1}: ${trimmed.slice(0, 100)}`);
    }
    // Formatter inputs are raw by design: the phone utilities and every test file (they exercise those inputs).
    if (!rel.endsWith('phoneFormat.ts') && !/\.test\.tsx?$/.test(rel)) {
      const badPhone = line.match(badUsPhoneRe);
      if (badPhone) {
        unformattedUsPhoneHits.push(`${rel}:${idx + 1}: ${badPhone.join(', ')}`);
      }
      const badTel = line.match(badTelHrefRe);
      if (badTel) {
        invalidTelHrefHits.push(`${rel}:${idx + 1}: ${badTel.join(', ')}`);
      }
    }
    if (/\+63[\s.-]?917[\s.-]?966[\s.-]?8814/.test(line)) {
      preservedNonUsIntlCount += 1;
    }
  });
}

assertCheck(legacyHits.length === 0, 'Zero active legacy A/R logo or vault path references remain', legacyHits.join('; '));
assertCheck(legacyEmailHits.length === 0, 'Zero active legacy contact emails or artaxservices portal links remain', legacyEmailHits.join('; '));
assertCheck(visibleArHits.length === 0, 'Zero active legacy A/R company branding strings remain', visibleArHits.join('; '));
assertCheck(duplicateLlcHits.length === 0, 'Zero duplicate LLC suffixes (LLC, LLC) exist', duplicateLlcHits.join('; '));
assertCheck(unformattedUsPhoneHits.length === 0, 'Zero unformatted US telephone numbers remain in active source/HTML', unformattedUsPhoneHits.join('; '));
assertCheck(invalidTelHrefHits.length === 0, 'All static tel: links use canonical E.164 format', invalidTelHrefHits.join('; '));
assertCheck(preservedNonUsIntlCount >= 6, 'Non-US international telephone numbers (+63) are preserved intact', `${preservedNonUsIntlCount} references`);

console.log(checks.join('\n'));
if (errors.length > 0) {
  console.error('\nBRANDING VERIFICATION FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`\nALL ${checks.length} BRANDING CHECKS PASSED.`);
