import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { BRAND_ASSETS, BRAND_ASSET_VERSION } from '../src/utils/assets';
import { AI_BRAND } from '../src/config/aiBranding';

describe('Brand Identity & Asset Verification', () => {
  // Branding v3 (Google AI Studio, 75775a1): the header logo is the displayed logo; the supplied original emblem stays
  // available. Every branding URL carries the cache-busting version, which the release stamps with the commit.
  it('points the brand assets at the current DESTRIA files, each with the cache-busting version', () => {
    const v = `?v=${BRAND_ASSET_VERSION}`;
    expect(BRAND_ASSET_VERSION).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(BRAND_ASSETS.destriaLogo).toBe(`/branding/destria-logo-header.png${v}`);
    expect(BRAND_ASSETS.destriaLogoHero).toBe(`/branding/destria-logo-hero.png${v}`);
    expect(BRAND_ASSETS.destriaLogoOriginal).toBe(`/branding/destria-logo-original.png${v}`);
    expect(BRAND_ASSETS.destriaEmblem).toBe(`/branding/destria-emblem-icon.png${v}`);
    expect(BRAND_ASSETS.destriaFavicon).toBe(`/branding/destria-favicon.png${v}`);
    expect(BRAND_ASSETS.appleTouchIcon).toBe(`/apple-touch-icon.png${v}`);
  });

  it('every referenced brand file exists in public/', () => {
    for (const key of ['destriaLogo', 'destriaLogoHero', 'destriaLogoOriginal', 'destriaEmblem', 'destriaFavicon', 'appleTouchIcon'] as const) {
      const file = 'public' + BRAND_ASSETS[key].split('?')[0];
      expect(fs.existsSync(file), file).toBe(true);
    }
  });

  it('verifies AI branding reflects DESTRIA TAX SERVICES LLC', () => {
    expect(AI_BRAND.operator).toBe('DESTRIA TAX SERVICES LLC');
    expect(AI_BRAND.assistant).toContain('Destria');
    expect(AI_BRAND.model).toContain('Destria');
    expect(AI_BRAND.privateNetwork).toContain('DESTRIA');
  });
});
