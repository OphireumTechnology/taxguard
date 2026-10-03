/**
 * A/R Tax Services, LLC - Consultation UX & Canonical Brand Design Tokens Test Suite
 *
 * Verifies:
 * 1. Canonical brand design tokens in tokens.ts and index.css
 * 2. Removal of large cream/white panels on client-facing consultation views
 * 3. Consultation page simplification (Introduction, Booking Method, Workflow)
 * 4. Appointment details panel terminology (Consultation type, Date, How would you like to meet?)
 * 5. Meeting modalities (Video Meeting, Phone Call, Office Visit)
 * 6. Available times panel (Available times, Choose a time that works for you.)
 * 7. Client-friendly empty availability state
 * 8. Friendly date presentation
 * 9. Primary call to action ("Confirm Appointment" / "Book Consultation")
 * 10. Removal of internal technical language ("Live Availability" instead of engine jargon)
 * 11. Branded UI controls (BrandedButton, BrandedSelect, BrandedInput, EmptyStateCard)
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CANONICAL_PALETTE, BRAND_COLORS, SEMANTIC_THEME } from '../theme/tokens';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('A/R Tax Services — Consultation UX & Canonical Brand Tokens Suite', () => {
  const consultationPageSource = readSource('src/components/public/BookConsultationPage.tsx');
  const liveCalendarSource = readSource('src/components/calendar/LiveCalendarModule.tsx');
  const indexCssSource = readSource('src/index.css');
  const brandedSelectSource = readSource('src/components/ui/BrandedSelect.tsx');
  const brandedInputSource = readSource('src/components/ui/BrandedInput.tsx');
  const brandedButtonSource = readSource('src/components/ui/BrandedButton.tsx');
  const emptyStateCardSource = readSource('src/components/ui/EmptyStateCard.tsx');

  // 1. Canonical Brand Palette
  describe('1. Canonical Brand Design Tokens', () => {
    it('defines pageBackground as #06182B', () => {
      expect(CANONICAL_PALETTE.pageBackground).toBe('#06182B');
    });

    it('defines deepestSurface as #071A2E', () => {
      expect(CANONICAL_PALETTE.deepestSurface).toBe('#071A2E');
    });

    it('defines primaryCard as #0D2745', () => {
      expect(CANONICAL_PALETTE.primaryCard).toBe('#0D2745');
    });

    it('defines secondarySurface as #102D4F', () => {
      expect(CANONICAL_PALETTE.secondarySurface).toBe('#102D4F');
    });

    it('defines interactiveSurface as #143657', () => {
      expect(CANONICAL_PALETTE.interactiveSurface).toBe('#143657');
    });

    it('defines primaryGold as #D4A843 and goldHover as #E1BB60', () => {
      expect(CANONICAL_PALETTE.primaryGold).toBe('#D4A843');
      expect(CANONICAL_PALETTE.goldHover).toBe('#E1BB60');
    });

    it('defines softGoldBg as rgba(212, 168, 67, 0.10)', () => {
      expect(CANONICAL_PALETTE.softGoldBg).toBe('rgba(212, 168, 67, 0.10)');
    });

    it('defines primaryText as #F8FAFC and secondaryText as #A9B7C8', () => {
      expect(CANONICAL_PALETTE.primaryText).toBe('#F8FAFC');
      expect(CANONICAL_PALETTE.secondaryText).toBe('#A9B7C8');
      expect(CANONICAL_PALETTE.mutedText).toBe('#7F91A6');
    });

    it('defines subtleBorder and goldBorder', () => {
      expect(CANONICAL_PALETTE.subtleBorder).toBe('rgba(148, 163, 184, 0.18)');
      expect(CANONICAL_PALETTE.goldBorder).toBe('rgba(212, 168, 67, 0.40)');
    });

    it('CSS custom properties in index.css declare canonical tokens', () => {
      expect(indexCssSource).toContain('--tg-bg: #06182B');
      expect(indexCssSource).toContain('--tg-deep: #071A2E');
      expect(indexCssSource).toContain('--tg-card: #0D2745');
      expect(indexCssSource).toContain('--tg-surface: #102D4F');
      expect(indexCssSource).toContain('--tg-interactive: #143657');
      expect(indexCssSource).toContain('--tg-gold: #D4A843');
      expect(indexCssSource).toContain('--tg-gold-hover: #E1BB60');
      expect(indexCssSource).toContain('--tg-text: #F8FAFC');
      expect(indexCssSource).toContain('--tg-text-secondary: #A9B7C8');
      expect(indexCssSource).toContain('--tg-text-muted: #7F91A6');
    });
  });

  // 2. Removal of Large White/Cream Panels
  describe('2. Branded Dark Surfaces for Consultation Workflow', () => {
    it('BookConsultationPage uses deep navy background #06182B', () => {
      expect(consultationPageSource).toContain('bg-[#06182B]');
      expect(consultationPageSource).not.toContain('bg-[#FBF8F1]');
    });

    it('LiveCalendarModule uses primary card #0D2745 and elevated surface #102D4F', () => {
      expect(liveCalendarSource).toContain('bg-[#0D2745]');
      expect(liveCalendarSource).toContain('bg-[#102D4F]');
      expect(liveCalendarSource).not.toContain('bg-[#FBF8F1]');
    });
  });

  // 3. Consultation Page Simplification
  describe('3. Three-Area Page Simplification', () => {
    it('contains clear Page Introduction with "Schedule a Consultation"', () => {
      expect(consultationPageSource).toContain('Schedule a Consultation');
      expect(consultationPageSource).toContain('Reserve a dedicated strategy session with our senior tax specialists.');
    });

    it('contains two-option compact segmented control for Booking Method', () => {
      expect(consultationPageSource).toContain('Schedule Online');
      expect(consultationPageSource).toContain('Express Intake');
    });

    it('supports switching between live_calendar and fast_form', () => {
      expect(consultationPageSource).toContain("setBookingMode('live_calendar')");
      expect(consultationPageSource).toContain("setBookingMode('fast_form')");
    });
  });

  // 4. Appointment Details Panel
  describe('4. Appointment Details Panel Terminology', () => {
    it('uses preferred "Consultation type" label', () => {
      expect(liveCalendarSource).toContain('Consultation type');
      expect(liveCalendarSource).not.toContain('SELECT CONSULTATION SERVICE');
    });

    it('uses preferred "Date" label', () => {
      expect(liveCalendarSource).toContain('Date');
      expect(liveCalendarSource).not.toContain('SELECT DATE');
    });

    it('uses preferred "How would you like to meet?" label', () => {
      expect(liveCalendarSource).toContain('How would you like to meet?');
      expect(liveCalendarSource).not.toContain('MEETING MODALITY');
    });

    it('uses preferred "What would you like to discuss? (optional)" label', () => {
      expect(liveCalendarSource).toContain('What would you like to discuss? (optional)');
      expect(liveCalendarSource).not.toContain('CONSULTATION AGENDA / NOTES (OPTIONAL)');
    });
  });

  // 5. Meeting Options
  describe('5. Selectable Meeting Methods', () => {
    it('presents Video Meeting, Phone Call, and Office Visit', () => {
      expect(liveCalendarSource).toContain('Video Meeting');
      expect(liveCalendarSource).toContain('Phone Call');
      expect(liveCalendarSource).toContain('Office Visit');
    });

    it('applies gold border and subtle gold tint on selected option with checkmark', () => {
      expect(liveCalendarSource).toContain('border-[rgba(212,168,67,0.80)] bg-[rgba(212,168,67,0.12)]');
      expect(liveCalendarSource).toContain('<Check className="w-4 h-4 text-[#D4A843] shrink-0" />');
    });
  });

  // 6. Available Times Panel
  describe('6. Available Times Presentation', () => {
    it('displays "Available times" header and "Choose a time that works for you."', () => {
      expect(liveCalendarSource).toContain('Available times');
      expect(liveCalendarSource).toContain('Choose a time that works for you');
    });

    it('renders selectable slot buttons with gold border and checkmark when selected', () => {
      expect(liveCalendarSource).toContain('border-[rgba(212,168,67,0.80)] bg-[rgba(212,168,67,0.14)]');
      expect(liveCalendarSource).toContain('<Check className="w-3.5 h-3.5 text-[#D4A843]" />');
    });
  });

  // 7. Empty Availability State
  describe('7. Client-Friendly Empty Availability State', () => {
    it('presents friendly "No times available on..." headline', () => {
      expect(liveCalendarSource).toContain('No times available on');
      expect(liveCalendarSource).not.toContain('All certified tax advisors are booked or in external sessions');
    });

    it('offers "Next available day" and "Choose another date" actions', () => {
      expect(liveCalendarSource).toContain('Next available day');
      expect(liveCalendarSource).toContain('Choose another date');
    });
  });

  // 8. Primary CTA
  describe('8. Primary Action Control', () => {
    it('uses "Confirm Appointment" or "Book Consultation" label instead of "Confirm & Synchronize Appointment"', () => {
      expect(liveCalendarSource).toContain('Confirm Appointment');
      expect(liveCalendarSource).not.toContain('Confirm & Synchronize Appointment');
    });

    it('disables confirmation button with helpful reason when no slot is selected', () => {
      expect(liveCalendarSource).toContain('Please select an available consultation slot above');
    });
  });

  // 9. Removal of Internal Technical Language
  describe('9. Removal of Technical Jargon', () => {
    it('uses "Live Availability" instead of "LIVE SYNCHRONIZED CALENDAR & AVAILABILITY ENGINE"', () => {
      expect(liveCalendarSource).toContain('Live Availability');
      expect(liveCalendarSource).not.toContain('LIVE SYNCHRONIZED CALENDAR & AVAILABILITY ENGINE');
    });

    it('replaces calendar infrastructure sync jargon with client-friendly text', () => {
      expect(liveCalendarSource).toContain('Choose an available time for your consultation.');
      expect(liveCalendarSource).not.toContain('automatic conflict protection');
    });
  });

  // 10. UI System Alignment
  describe('10. Standardized UI Components', () => {
    it('BrandedButton defaults to canonical gold primary and navy secondary', () => {
      expect(brandedButtonSource).toContain('bg-[#D4A843]');
      expect(brandedButtonSource).toContain('bg-[#102D4F]');
    });

    it('BrandedSelect defaults to dark variant', () => {
      expect(brandedSelectSource).toContain("variant = 'dark'");
    });

    it('BrandedInput defaults to dark variant with canonical colors', () => {
      expect(brandedInputSource).toContain("variant = 'dark'");
      expect(brandedInputSource).toContain('bg-[#102D4F]');
    });

    it('EmptyStateCard defaults to dark variant', () => {
      expect(emptyStateCardSource).toContain("variant = 'dark'");
    });
  });

  // 11. Hero Background & Cinematic Presentation
  describe('11. Hero Background & Cinematic Presentation', () => {
    it('uses photographic background in consultation hero', () => {
      expect(consultationPageSource).toContain('/images/consultation/consultation-hero.webp');
      expect(consultationPageSource).toContain("backgroundPosition: 'center'");
      expect(consultationPageSource).toContain("backgroundSize: 'cover'");
      expect(consultationPageSource).toContain("backgroundRepeat: 'no-repeat'");
    });

    it('applies readability overlays to preserve text contrast', () => {
      expect(consultationPageSource).toContain('linear-gradient(90deg, rgba(6,24,43,0.96) 0%');
    });

    it('contains eyebrow "PRIVATE TAX & ADVISORY SERVICES" and restrained gold divider', () => {
      expect(consultationPageSource).toContain('PRIVATE TAX & ADVISORY SERVICES');
      expect(consultationPageSource).toContain('w-16 h-1 bg-[#D4A843] rounded-full');
    });

    it('eliminates border-b line artifact on hero section to seamlessly transition into trust strip', () => {
      expect(consultationPageSource).not.toMatch(/<section[^>]*border-b[^>]*style=\{\{\s*backgroundImage/i);
    });

    it('ensures vignette seamlessly merges to deep navy #071A2E trust strip background', () => {
      expect(consultationPageSource).toContain('to-[#071A2E] pointer-events-none');
    });
  });

  // 12. Trust Strip & Governance
  describe('12. Trust Strip & Professional Restraint', () => {
    it('renders the 4 trust items', () => {
      expect(consultationPageSource).toContain('Expert Guidance');
      expect(consultationPageSource).toContain('Secure Process');
      expect(consultationPageSource).toContain('Personalized Service');
      expect(consultationPageSource).toContain('Clear Next Steps');
    });

    it('ensures no conflicting border-top on trust strip and no cream dividers', () => {
      expect(consultationPageSource).not.toMatch(/<section[^>]*border-t[^>]*>\s*<div[^>]*>\s*<div[^>]*>\s*<div[^>]*>\s*<ShieldCheck/);
      expect(consultationPageSource).not.toContain('border-[#FBF8F1]');
      expect(consultationPageSource).not.toContain('border-white');
    });

    it('avoids unverified marketing claims like IRS Certified or CPA Certified', () => {
      expect(consultationPageSource).not.toContain('IRS Certified');
      expect(consultationPageSource).not.toContain('CPA Certified');
      expect(consultationPageSource).not.toContain('§7216 Certified');
    });
  });

  // 13. Canonical Route & Client Assistance
  describe('13. Route and Disabled CTA Assistance', () => {
    it('provides clear explanation when no slot is selected', () => {
      expect(liveCalendarSource).toContain('Select an available time to continue.');
    });

    it('Express Intake preserves confidential intake badge and clear fields', () => {
      expect(consultationPageSource).toContain('Confidential intake session.');
      expect(consultationPageSource).toContain('Book Consultation');
    });
  });
});
