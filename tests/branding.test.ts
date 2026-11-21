import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BRAND_ASSETS, BRAND_ASSET_VERSION } from '../src/utils/assets';
import { AI_BRAND } from '../src/config/aiBranding';

describe('Brand Identity & Asset Verification', () => {
  it('uses versioned official PNG assets and retains the original artwork', () => {
    const variants = [
      [BRAND_ASSETS.destriaLogo, 'destria-logo-header.png'],
      [BRAND_ASSETS.destriaLogoOriginal, 'destria-logo-original.png'],
      [BRAND_ASSETS.destriaLogoHero, 'destria-logo-hero.png'],
      [BRAND_ASSETS.destriaEmblem, 'destria-emblem-icon.png'],
      [BRAND_ASSETS.destriaFavicon, 'destria-favicon.png'],
    ] as const;
    expect(BRAND_ASSET_VERSION).toMatch(/^\d{8}-emblem-v\d+$/);
    for (const [asset, filename] of variants) {
      const url = new URL(asset, 'https://destriataxservices.com');
      expect(url.origin).toBe('https://destriataxservices.com');
      expect(url.pathname).toBe('/branding/' + filename);
      expect(url.searchParams.get('v')).toBe(BRAND_ASSET_VERSION);
      const bytes = readFileSync(resolve(process.cwd(), 'public/branding', filename));
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBeGreaterThanOrEqual(64);
      expect(bytes.readUInt32BE(20)).toBeGreaterThanOrEqual(64);
    }
  });

  it('verifies AI branding reflects DESTRIA TAX SERVICES LLC', () => {
    expect(AI_BRAND.operator).toBe('DESTRIA TAX SERVICES LLC');
    expect(AI_BRAND.assistant).toContain('Destria');
    expect(AI_BRAND.model).toContain('Destria');
    expect(AI_BRAND.privateNetwork).toContain('DESTRIA');
  });
});
