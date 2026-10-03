import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { INITIAL_TAX_STRATEGIES, STRATEGY_CATEGORIES_MAP } from '../data/taxStrategiesData';

describe('Tax Strategies Page Corporate Image Remediation Suite', () => {
  const root = process.cwd();
  const taxStrategiesPagePath = path.join(root, 'src/components/public/TaxStrategiesPage.tsx');
  const taxStrategiesPageSource = fs.readFileSync(taxStrategiesPagePath, 'utf8');
  const assetsSourcePath = path.join(root, 'src/utils/assets.ts');
  const assetsSource = fs.readFileSync(assetsSourcePath, 'utf8');

  describe('1. Production Corporate Tax Strategy Assets', () => {
    it('contains optimized tax strategy workspace WebP and JPG assets', () => {
      const webpPath = path.join(root, 'public/images/tax-strategies/tax-strategy-workspace.webp');
      const jpgPath = path.join(root, 'public/images/tax-strategies/tax-strategy-workspace.jpg');
      expect(fs.existsSync(webpPath)).toBe(true);
      expect(fs.existsSync(jpgPath)).toBe(true);

      const webpSize = fs.statSync(webpPath).size;
      const jpgSize = fs.statSync(jpgPath).size;
      expect(webpSize).toBeGreaterThan(10 * 1024);
      expect(webpSize).toBeLessThan(500 * 1024);
      expect(jpgSize).toBeGreaterThan(10 * 1024);
      expect(jpgSize).toBeLessThan(500 * 1024);
    });

    it('registers taxStrategyWorkspaceWebp and taxStrategyWorkspaceJpg in BRAND_ASSETS', () => {
      expect(assetsSource).toContain('taxStrategyWorkspaceWebp');
      expect(assetsSource).toContain('taxStrategyWorkspaceJpg');
      expect(assetsSource).toContain('images/tax-strategies/tax-strategy-workspace.webp');
      expect(assetsSource).toContain('images/tax-strategies/tax-strategy-workspace.jpg');
    });
  });

  describe('2. TaxStrategiesPage Hero Image & Canonical Design System', () => {
    it('replaces generic smartphone calculator hero image with corporate tax strategy workspace assets', () => {
      expect(taxStrategiesPageSource).toContain('taxStrategyWorkspaceWebp');
      expect(taxStrategiesPageSource).toContain('taxStrategyWorkspaceJpg');
      expect(taxStrategiesPageSource).not.toContain('taxAdvisoryPlanningJpg');
      expect(taxStrategiesPageSource).not.toContain('taxAdvisoryPlanningWebp');
    });

    it('provides accessible and descriptive alt text for the tax strategy workspace hero', () => {
      expect(taxStrategiesPageSource).toContain(
        'alt="A/R Tax Services professional tax strategy and financial analysis workspace"'
      );
    });

    it('enforces 16:9 aspect ratio, explicit dimensions, and object-cover to prevent layout shift', () => {
      expect(taxStrategiesPageSource).toContain('aspect-[16/9]');
      expect(taxStrategiesPageSource).toContain('object-cover');
      expect(taxStrategiesPageSource).toContain('width={1280}');
      expect(taxStrategiesPageSource).toContain('height={720}');
      expect(taxStrategiesPageSource).toContain('referrerPolicy="no-referrer"');
    });

    it('applies canonical A/R Tax Services navy and gold color tokens', () => {
      expect(taxStrategiesPageSource).toContain('bg-[#06182B]');
      expect(taxStrategiesPageSource).toContain('bg-[#0D2745]');
      expect(taxStrategiesPageSource).toContain('bg-[#102D4F]');
      expect(taxStrategiesPageSource).toContain('#D4A843');
      expect(taxStrategiesPageSource).toContain('#E1BB60');
      expect(taxStrategiesPageSource).toContain('#F8FAFC');
      expect(taxStrategiesPageSource).toContain('#A9B7C8');
      expect(taxStrategiesPageSource).toContain('rgba(148,163,184,0.18)');
    });

    it('preserves authoritative page headline, Circular 230 statutory notice, and all 16 tax strategy categories', () => {
      expect(taxStrategiesPageSource).toContain('Comprehensive Tax Strategy Center');
      expect(taxStrategiesPageSource).toContain(
        'Statutory Notice &amp; Professional Review Requirement (IRS Circular 230)'
      );
      expect(Object.keys(STRATEGY_CATEGORIES_MAP).length).toBe(16);
      expect(INITIAL_TAX_STRATEGIES.length).toBe(16);
    });
  });
});
