import { describe, it, expect } from 'vitest';
import { BRAND_ASSETS } from '../src/utils/assets';
import { AI_BRAND } from '../src/config/aiBranding';

describe('Brand Identity & Asset Verification', () => {
  it('points authoritative destriaLogo to the verified circular PNG asset', () => {
    expect(BRAND_ASSETS.destriaLogo).toBe('/branding/destria-logo-original.png');
    expect(BRAND_ASSETS.destriaLogoHeader).toBe('/branding/destria-logo-header.png');
    expect(BRAND_ASSETS.destriaEmblem).toBe('/branding/destria-emblem-icon.png');
    expect(BRAND_ASSETS.destriaFavicon).toBe('/branding/destria-favicon.png');
  });

  it('verifies AI branding reflects DESTRIA TAX SERVICES LLC', () => {
    expect(AI_BRAND.operator).toBe('DESTRIA TAX SERVICES LLC');
    expect(AI_BRAND.assistant).toContain('Destria');
    expect(AI_BRAND.model).toContain('Destria');
    expect(AI_BRAND.privateNetwork).toContain('DESTRIA');
  });
});
