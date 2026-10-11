import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ mode: 'default', nulls: 0 }));
vi.mock('../context/AppContext', () => ({ useApp: () => ({ registrationState: fixture.mode === 'verify-error' ? 'EMAIL_VERIFICATION_REQUIRED' : 'IDLE', pendingVerificationEmail: 'synthetic@example.invalid' }) }));
vi.mock('../supabase/auth', () => ({ requestPasswordReset: vi.fn(), validateRegistrationInput: vi.fn() }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const state: typeof actual.useState = ((initial: any) => {
    let value = initial;
    if (fixture.mode === 'business' && initial === 'individual') value = 'llc';
    if (fixture.mode === 'forgot' && initial === false) value = true;
    if (fixture.mode === 'invitation' && initial === 'signin') value = 'accept_invitation';
    if (fixture.mode === 'invitation' && initial === null && ++fixture.nulls === 2) value = { email: 'synthetic@example.invalid', role: 'accountant' };
    if (['staff-error', 'verify-error'].includes(fixture.mode) && initial === null && ++fixture.nulls === 1) value = 'Synthetic authentication failure';
    return actual.useState(value);
  }) as typeof actual.useState;
  return { ...actual, useState: state };
});
import { ClientLoginPage, ClientRegisterPage, StaffLoginPage } from '../components/auth/AuthPages';
afterEach(() => { fixture.mode = 'default'; fixture.nulls = 0; });
function associations(html: string) {
  const labels = [...html.matchAll(/<label\b[^>]*for="([^"]+)"[^>]*>([^<]*)<\/label>/g)];
  const ids = [...html.matchAll(/<(?:input|select)\b[^>]*id="([^"]+)"/g)].map(match => match[1]);
  for (const label of labels) {
    expect(ids.filter(id => id === label[1])).toHaveLength(1);
    expect(label[2].trim()).not.toBe('');
  }
  expect(new Set(ids).size).toBe(ids.length);
  return labels.map(label => label[2]);
}
it('associates client sign-in labels with unique controls', () => {
  expect(associations(renderToStaticMarkup(<ClientLoginPage />))).toEqual(['Email Address', 'Password']);
});
it('associates password recovery email without changing submission authority', () => {
  fixture.mode = 'forgot';
  expect(associations(renderToStaticMarkup(<ClientLoginPage />))).toEqual(['Registered Account Email']);
});
it('associates registration controls including selectors and confirmation password', () => {
  const labels = associations(renderToStaticMarkup(<ClientRegisterPage />));
  expect(labels).toHaveLength(11);
  expect(labels).toEqual(expect.arrayContaining(['Email Address *', 'Mobile Telephone *', 'Client Classification', 'Preferred Channel', 'Time Zone', 'Confirm Password *']));
});
it('retains the business entity label/control association', () => {
  fixture.mode = 'business';
  const labels = associations(renderToStaticMarkup(<ClientRegisterPage />));
  expect(labels).toHaveLength(12); expect(labels).toContain('Entity / Business Legal Name *');
});
it('associates staff sign-in controls', () => {
  expect(associations(renderToStaticMarkup(<StaffLoginPage />))).toEqual(['Staff Work Email', 'Staff Security Token / Password']);
});
it('associates invitation and staff password controls without inventing invitation authority', () => {
  fixture.mode = 'invitation';
  const labels = associations(renderToStaticMarkup(<StaffLoginPage />));
  expect(labels).toEqual(['Administrative Invitation Token *', 'Set Staff Password *']);
});
it('keeps IDs unique across multiple simultaneously rendered authentication forms', () => {
  const html = renderToStaticMarkup(<><ClientLoginPage /><StaffLoginPage /><ClientRegisterPage /></>);
  expect(associations(html)).toHaveLength(15);
});
it('announces staff authentication failures as alerts', () => {
  fixture.mode = 'staff-error';
  const html = renderToStaticMarkup(<StaffLoginPage />);
  expect(html).toContain('role="alert"'); expect(html).toContain('Synthetic authentication failure');
});
it('announces email verification failures without claiming verified identity', () => {
  fixture.mode = 'verify-error';
  const html = renderToStaticMarkup(<ClientRegisterPage />);
  expect(html).toContain('Verify Your Email');
  expect(html).toContain('role="alert"'); expect(html).toContain('Synthetic authentication failure');
});
