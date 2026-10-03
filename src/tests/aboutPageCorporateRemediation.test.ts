import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('About Page Corporate Image Remediation Suite', () => {
  const root = process.cwd();
  const aboutPageSourcePath = path.join(root, 'src/components/public/AboutPage.tsx');
  const aboutPageSource = fs.readFileSync(aboutPageSourcePath, 'utf8');

  // 1. Asset verification
  describe('1. Production Corporate Assets', () => {
    it('contains optimized tax advisory office WebP and JPG assets', () => {
      const webpPath = path.join(root, 'public/images/about/about-tax-advisory-office.webp');
      const jpgPath = path.join(root, 'public/images/about/about-tax-advisory-office.jpg');
      expect(fs.existsSync(webpPath)).toBe(true);
      expect(fs.existsSync(jpgPath)).toBe(true);

      const webpSize = fs.statSync(webpPath).size;
      expect(webpSize).toBeGreaterThan(10 * 1024); // at least 10KB
      expect(webpSize).toBeLessThan(500 * 1024); // under 500KB optimized
    });

    it('contains optimized client advisory WebP and JPG assets', () => {
      const webpPath = path.join(root, 'public/images/about/about-client-advisory.webp');
      const jpgPath = path.join(root, 'public/images/about/about-client-advisory.jpg');
      expect(fs.existsSync(webpPath)).toBe(true);
      expect(fs.existsSync(jpgPath)).toBe(true);

      const webpSize = fs.statSync(webpPath).size;
      expect(webpSize).toBeGreaterThan(10 * 1024);
      expect(webpSize).toBeLessThan(500 * 1024);
    });

    it('ensures old unrelated forest/moss skyline image is removed', () => {
      const oldWebp = path.join(root, 'public/images/columbia-sc-skyline.webp');
      const oldJpg = path.join(root, 'public/images/columbia-sc-skyline.jpg');
      expect(fs.existsSync(oldWebp)).toBe(false);
      expect(fs.existsSync(oldJpg)).toBe(false);
    });
  });

  // 2. Component Implementation & Content Integrity
  describe('2. AboutPage Component Presentation', () => {
    it('uses new corporate tax advisory assets in the split hero', () => {
      expect(aboutPageSource).toContain('aboutTaxAdvisoryOfficeWebp');
      expect(aboutPageSource).toContain('aboutTaxAdvisoryOfficeJpg');
    });

    it('provides accessible and descriptive alt text', () => {
      expect(aboutPageSource).toContain('alt="A/R Tax Services professional tax and accounting advisory workspace"');
    });

    it('enforces 16:9 aspect ratio and object-cover to prevent layout shift', () => {
      expect(aboutPageSource).toContain('aspect-[16/9]');
      expect(aboutPageSource).toContain('object-cover');
      expect(aboutPageSource).toContain('width={1280}');
      expect(aboutPageSource).toContain('height={720}');
    });

    it('removes meaningless "Established" decorative badge and simplifies location treatment', () => {
      expect(aboutPageSource).not.toMatch(/<span[^>]*>\s*Established\s*<\/span>/i);
      expect(aboutPageSource).toContain('Columbia, South Carolina Headquarters');
    });

    it('preserves approved hero headline and value proposition', () => {
      expect(aboutPageSource).toContain('About A/R Tax Services, LLC');
      expect(aboutPageSource).toContain('Your Trusted Partner in Tax and Financial Solutions');
      expect(aboutPageSource).toContain('Delivering client-focused tax preparation');
    });

    it('preserves executive founder portrait component', () => {
      expect(aboutPageSource).toContain('<FounderPortrait');
    });

    it('uses client advisory corporate image in strategic partnerships section', () => {
      expect(aboutPageSource).toContain('aboutClientAdvisoryJpg');
      expect(aboutPageSource).toContain('aboutClientAdvisoryWebp');
      expect(aboutPageSource).toContain('EditorialSplitImage');
    });
  });
});
