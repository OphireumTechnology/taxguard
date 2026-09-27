import { describe, it, expect } from 'vitest';
import { sanitizeFileName } from '../src/firebase/storage';

describe('Business Logic & Validation Suite', () => {

  describe('File Name Sanitization & Storage Security', () => {
    it('strips dangerous path traversal characters from document names', () => {
      const malicious = '../../etc/passwd';
      const clean = sanitizeFileName(malicious);
      expect(clean).not.toContain('/');
      expect(clean).toBe('.._.._etc_passwd');
    });

    it('preserves valid extensions and filenames', () => {
      const normal = '2025_Form_1040_Final.pdf';
      expect(sanitizeFileName(normal)).toBe('2025_Form_1040_Final.pdf');
    });

    it('truncates oversized file names to 150 characters', () => {
      const longName = 'a'.repeat(250) + '.pdf';
      const clean = sanitizeFileName(longName);
      expect(clean.length).toBeLessThanOrEqual(150);
    });
  });

  describe('Timezone-Aware Consultation Scheduling Logic', () => {
    const isSlotConflicting = (
      existingStartIso: string,
      existingDurationMinutes: number,
      newStartIso: string,
      newDurationMinutes: number
    ): boolean => {
      const startA = new Date(existingStartIso).getTime();
      const endA = startA + existingDurationMinutes * 60 * 1000;
      const startB = new Date(newStartIso).getTime();
      const endB = startB + newDurationMinutes * 60 * 1000;

      // Overlap condition: StartA < EndB and EndA > StartB
      return startA < endB && endA > startB;
    };

    it('detects direct collision on identical appointment times', () => {
      const existingTime = '2026-09-15T14:00:00.000Z';
      const isConflict = isSlotConflicting(existingTime, 60, existingTime, 60);
      expect(isConflict).toBe(true);
    });

    it('detects partial overlap when consultation starts 30 minutes in', () => {
      const existingTime = '2026-09-15T14:00:00.000Z'; // 2:00 PM - 3:00 PM
      const newTime = '2026-09-15T14:30:00.000Z';      // 2:30 PM - 3:30 PM
      const isConflict = isSlotConflicting(existingTime, 60, newTime, 60);
      expect(isConflict).toBe(true);
    });

    it('allows back-to-back consultations without collision', () => {
      const existingTime = '2026-09-15T14:00:00.000Z'; // 2:00 PM - 3:00 PM
      const newTime = '2026-09-15T15:00:00.000Z';      // 3:00 PM - 4:00 PM
      const isConflict = isSlotConflicting(existingTime, 60, newTime, 60);
      expect(isConflict).toBe(false);
    });

    it('formats times accurately in America/New_York (EST/EDT)', () => {
      const utcDate = new Date('2026-09-15T14:00:00.000Z');
      const formatted = utcDate.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      });
      // 14:00 UTC in September (EDT = UTC-4) is 10:00 AM
      expect(formatted).toBe('10:00 AM');
    });
  });
});
