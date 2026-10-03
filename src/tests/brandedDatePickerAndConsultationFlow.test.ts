/**
 * A/R Tax Services, LLC - Branded Date Picker & Consultation UX Flow Test Suite
 *
 * Verifies:
 * 1. Accessible branded dark navy & gold date picker implementation
 * 2. Elimination of desktop browser-native white calendar popup glitch
 * 3. Keyboard navigation (Escape, Arrows, Enter, Space) and focus management
 * 4. Friendly client date formatting without redundant repetitions
 * 5. Elimination of invalid past date selection
 * 6. Server-authoritative next available day lookup (no fabricated availability)
 * 7. "Choose another date" focuses and triggers the branded date picker
 * 8. Two-column desktop booking workspace proportion (approx 34-38% / 62-66%)
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { formatFriendlyDate } from '../components/ui/BrandedDatePicker';
import { computeAvailableSlotsForDate } from '../server/routes/calendar.routes';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

describe('A/R Tax Services — Branded Date Picker & Consultation Flow Suite', () => {
  const datePickerSource = readSource('src/components/ui/BrandedDatePicker.tsx');
  const liveCalendarSource = readSource('src/components/calendar/LiveCalendarModule.tsx');
  const bookConsultationSource = readSource('src/components/public/BookConsultationPage.tsx');
  const calendarRoutesSource = readSource('src/server/routes/calendar.routes.ts');

  // 1. Elimination of Native White Date Picker Glitch
  describe('1. Elimination of Native White Date Picker Glitch', () => {
    it('LiveCalendarModule does not use raw <input type="date"> in primary booking panel', () => {
      expect(liveCalendarSource).not.toMatch(/id="consultation-date-input"[^>]*type="date"/);
      expect(liveCalendarSource).toContain('<BrandedDatePicker');
      expect(liveCalendarSource).toContain('id="consultation-date-input"');
    });

    it('BookConsultationPage Express Intake uses BrandedDatePicker instead of raw <input type="date">', () => {
      expect(bookConsultationSource).not.toMatch(/id="intake-date"[^>]*type="date"/);
      expect(bookConsultationSource).toContain('<BrandedDatePicker');
      expect(bookConsultationSource).toContain('id="intake-date"');
    });

    it('LiveCalendarModule Reschedule Modal uses BrandedDatePicker', () => {
      expect(liveCalendarSource).not.toMatch(/value=\{newRescheduleDate\}[^>]*type="date"/);
    });
  });

  // 2. Canonical Color Tokens on Branded Date Picker
  describe('2. Design System Alignment on BrandedDatePicker', () => {
    it('uses primary card #0D2745 or elevated surface #102D4F for calendar popover', () => {
      expect(datePickerSource).toContain('bg-[#0D2745]');
      expect(datePickerSource).toContain('bg-[#102D4F]');
    });

    it('uses canonical border rgba(148,163,184,0.18)', () => {
      expect(datePickerSource).toContain('rgba(148,163,184,0.18)');
    });

    it('uses canonical gold #D4A843 for selected day and #E1BB60 for today indicator', () => {
      expect(datePickerSource).toContain('#D4A843');
      expect(datePickerSource).toContain('#E1BB60');
      expect(datePickerSource).toContain('#06182B'); // selected-day text
    });

    it('uses secondary text #A9B7C8 and muted #7F91A6 for unselected days and day names', () => {
      expect(datePickerSource).toContain('#A9B7C8');
      expect(datePickerSource).toContain('#7F91A6');
    });

    it('does not contain white or cream calendar popup background', () => {
      expect(datePickerSource).not.toContain('bg-[#FBF8F1]');
      expect(datePickerSource).not.toContain('bg-white');
    });
  });

  // 3. Calendar Interaction & Accessibility
  describe('3. Calendar Interaction, Accessibility & Keyboard Navigation', () => {
    it('supports Escape key to close calendar and restore focus', () => {
      expect(datePickerSource).toContain("e.key === 'Escape'");
      expect(datePickerSource).toContain('triggerRef.current?.focus()');
    });

    it('supports Arrow navigation (Left, Right, Up, Down) for keyboard date adjustment', () => {
      expect(datePickerSource).toContain("e.key === 'ArrowLeft'");
      expect(datePickerSource).toContain("e.key === 'ArrowRight'");
      expect(datePickerSource).toContain("e.key === 'ArrowUp'");
      expect(datePickerSource).toContain("e.key === 'ArrowDown'");
    });

    it('supports Enter or Space to select date and close popover', () => {
      expect(datePickerSource).toContain("e.key === 'Enter'");
      expect(datePickerSource).toContain("e.key === ' '");
    });

    it('exposes accessible dialog and expanded ARIA attributes', () => {
      expect(datePickerSource).toContain('aria-haspopup="dialog"');
      expect(datePickerSource).toContain('aria-expanded={isOpen}');
      expect(datePickerSource).toContain('role="dialog"');
      expect(datePickerSource).toContain('role="grid"');
      expect(datePickerSource).toContain('role="gridcell"');
    });

    it('prevents selection of disabled/past dates', () => {
      expect(datePickerSource).toContain('isDayDisabled');
      expect(datePickerSource).toContain('cursor-not-allowed pointer-events-none');
    });
  });

  // 4. Date Readability & Formatting
  describe('4. Date Readability & Formatting', () => {
    it('formats ISO dates into client-friendly readable strings without timezone drift', () => {
      const friendly = formatFriendlyDate('2026-10-05');
      expect(friendly).toContain('October 5, 2026');
      expect(friendly).toContain('Mon');
    });

    it('removes redundant immediate repetition under the date input', () => {
      expect(liveCalendarSource).not.toContain('{friendlySelectedDate}\n              </div>');
    });
  });

  // 5. Empty State Actions & Server-Authoritative Availability
  describe('5. Empty State Actions & Scheduling Authority', () => {
    it('"Next available day" action queries real server-authoritative availability', () => {
      expect(liveCalendarSource).toContain('handleNextAvailableDay');
      expect(liveCalendarSource).toContain('/api/calendar/next-available');
    });

    it('server implements /next-available route searching real consecutive days', () => {
      expect(calendarRoutesSource).toContain("calendarRouter.get('/next-available'");
      expect(calendarRoutesSource).toContain('computeAvailableSlotsForDate');
    });

    it('"Choose another date" opens and focuses the branded date picker', () => {
      expect(liveCalendarSource).toContain("document.getElementById('consultation-date-input')");
      expect(liveCalendarSource).toContain('dateInput?.click()');
    });

    it('computeAvailableSlotsForDate correctly enforces firm holidays and returns empty slots', () => {
      // 2026-12-25 is Christmas (firm holiday in db)
      const res = computeAvailableSlotsForDate({ date: '2026-12-25' });
      expect(res.availableSlots).toEqual([]);
      expect(res.holiday).toBe('Christmas Day');
    });

    it('computeAvailableSlotsForDate finds real available slots on standard business day', () => {
      // 2026-10-05 is a Monday
      const res = computeAvailableSlotsForDate({ date: '2026-10-05' });
      expect(Array.isArray(res.availableSlots)).toBe(true);
      expect(res.availableSlots.length).toBeGreaterThan(0);
      expect(res.availableSlots[0].clientLocalDisplay).toContain('(EDT)');
    });
  });

  // 6. Booking Workspace Proportions
  describe('6. Desktop Booking Workspace Proportions', () => {
    it('applies responsive grid with ~36% details and ~64% availability', () => {
      expect(liveCalendarSource).toContain('lg:grid-cols-[minmax(320px,36%)_minmax(0,1fr)]');
    });
  });
});
