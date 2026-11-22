import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatPhoneDisplay, INTAKE_PHONE_PATTERN, isIntakeStorablePhone } from '../utils/phoneFormat';

// The international phone input (Google AI Studio 07be161) formats what visitors type. Public intake tables store the
// phone under a strict database rule; this keeps the browser check and that rule identical, and shows which formatted
// values the database accepts. Synthetic numbers only.
describe('intake telephone contract', () => {
  it('the browser pattern is exactly the database rule of both intake tables', () => {
    for (const proposal of ['20261014430000_taxguard_consultation_requests.sql', '20261016050000_taxguard_contact_intake.sql']) {
      const sql = fs.readFileSync(`docs/proposed-migrations/${proposal}`, 'utf8');
      expect(sql, proposal).toContain("phone ~ '^[0-9+() .-]{7,32}$'");
    }
    expect(INTAKE_PHONE_PATTERN.source).toBe('^[0-9+() .-]{7,32}$');
  });
  it.each([
    ['6782059486', 'US', '+1-678-205-9486'],
    ['+44 20 7946 0958', 'GB', '+44 20 7946 0958'],
    ['020 7946 0958', 'GB', '+44 20 7946 0958'],
    ['+4915123456789', 'DE', '+49 1512 3456789'],
    ['+81 3-1234-5678', 'JP', '+81 3 1234 5678'],
    ['+52 55 1234 5678', 'MX', '+52 55 1234 5678'],
  ] as const)('%s (%s) is formatted as %s without a forced +1 and can be stored', (raw, country, expected) => {
    const display = formatPhoneDisplay(raw, country);
    expect(display).toBe(expected);
    expect(isIntakeStorablePhone(display)).toBe(true);
  });
  it('a formatted extension cannot be stored, so the consultation form asks for it in the message instead', () => {
    for (const raw of ['+1 678 205 9486 ext 12', '678-205-9486 x12']) {
      const display = formatPhoneDisplay(raw, 'US');
      expect(display).toBe('+1-678-205-9486 ext. 12');
      expect(isIntakeStorablePhone(display)).toBe(false);
    }
    const form = fs.readFileSync('src/components/public/ConsultationRequestForm.tsx', 'utf8');
    expect(form).toContain("if (f.phone.trim() && !isIntakeStorablePhone(f.phone)) { setState({ status: 'error', text: consultationErrorText('CONSULTATION_PHONE_FORMAT') }); return; }");
  });
});
