import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../context/AppContext', () => ({ useApp: () => ({}) }));
import { isLiveClientUser } from '../components/portal/StageOneIdentityWizard';

// Block 104: the demonstration environment selector and the browser-held dossier of the Stage 01 wizard are never offered
// to a signed-in client role. Synthetic identities only.
describe('Stage 01 live client boundary', () => {
  it.each([
    ['client', 'client@example.test'],
    ['prospective_client', 'prospect@example.test'],
    ['client', undefined],
    ['prospective_client', null],
  ])('treats role %s with e-mail %s as live', (role, email) => {
    expect(isLiveClientUser({ role, email })).toBe(true);
  });

  it('only the demonstration account of a client role is not live', () => {
    expect(isLiveClientUser({ role: 'client', email: 'ARTEST2026' })).toBe(false);
    expect(isLiveClientUser({ role: 'prospective_client', email: 'artest2026' })).toBe(false);
  });

  it.each(['accountant', 'admin', undefined])('role %s is not a live client', role => {
    expect(isLiveClientUser({ role, email: 'staff@example.test' })).toBe(false);
  });
  it('no user is not a live client', () => { expect(isLiveClientUser(null)).toBe(false); });

  it('the wizard holds no fabricated consent evidence', () => {
    const src = fs.readFileSync('src/components/portal/StageOneIdentityWizard.tsx', 'utf8');
    for (const fabricated of ['handleAutofillCompliant', '192.168.1.42', '2025.1-IRC7216', 'signerFullName: \'Eleanor Vance\'']) expect(src).not.toContain(fabricated);
  });
});
