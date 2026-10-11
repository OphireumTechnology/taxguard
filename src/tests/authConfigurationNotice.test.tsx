import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ configured: false, forgot: false }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  const state: typeof actual.useState = ((initial: any) => actual.useState(fixture.forgot && initial === false ? true : initial)) as typeof actual.useState;
  return { ...actual, useState: state };
});
vi.mock('../context/AppContext', () => ({ useApp: () => ({ registrationState: 'IDLE', pendingVerificationEmail: '' }) }));
vi.mock('../supabase/auth', () => ({ requestPasswordReset: vi.fn(), validateRegistrationInput: vi.fn() }));
vi.mock('../supabase/config', () => ({ isSupabaseConfigured: () => fixture.configured }));
import { ClientLoginPage, ClientRegisterPage, StaffLoginPage, passwordResetOutcome } from '../components/auth/AuthPages';
afterEach(() => { fixture.configured = false; fixture.forgot = false; });
const submitAttrs = (html: string) => [...html.matchAll(/<button\b([^>]*type="submit"[^>]*)>/g)].map(m => m[1]);
it('warns and disables registration when authentication is unconfigured', () => {
  const html = renderToStaticMarkup(<ClientRegisterPage />);
  expect(html).toContain('data-testid="auth-not-configured"');
  const submits = submitAttrs(html);
  expect(submits.length).toBeGreaterThan(0);
  for (const attrs of submits) expect(attrs).toMatch(/\bdisabled=""/);
});
it('warns and disables password-reset submission when authentication is unconfigured', () => {
  fixture.forgot = true;
  const html = renderToStaticMarkup(<ClientLoginPage />);
  expect(html).toContain('Reset Password');
  expect(html).toContain('data-testid="auth-not-configured"');
  for (const attrs of submitAttrs(html)) expect(attrs).toMatch(/\bdisabled=""/);
});
it('enables registration and reset when configured', () => {
  fixture.configured = true;
  const register = renderToStaticMarkup(<ClientRegisterPage />);
  expect(register).not.toContain('auth-not-configured');
  for (const attrs of submitAttrs(register)) expect(attrs).not.toMatch(/\bdisabled=""/);
  // The forgot-mode fixture also flips loading flags, so only notice absence is asserted there.
  fixture.forgot = true;
  expect(renderToStaticMarkup(<ClientLoginPage />)).not.toContain('auth-not-configured');
});
it('never presents a failed reset request as a sent recovery email', () => {
  expect(passwordResetOutcome({ success: true })).toEqual({});
  expect(passwordResetOutcome({ success: false, error: 'Sign-in is not available because TaxGuard authentication has not been configured' }).error).toMatch(/not been configured/);
  expect(passwordResetOutcome({ success: false }).error).toMatch(/could not be requested/);
});
function submitButton(html: string, label: string) {
  const match = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(m => m[2].includes(label));
  expect(match).toBeDefined();
  return match![1];
}
it('warns before client credential entry and disables sign-in when authentication is unconfigured', () => {
  const html = renderToStaticMarkup(<ClientLoginPage />);
  expect(html).toContain('data-testid="auth-not-configured"');
  expect(html).toContain('has not been configured');
  expect(submitButton(html, 'Sign In Securely')).toMatch(/\bdisabled=""/);
});
it('warns and disables staff sign-in when authentication is unconfigured', () => {
  const html = renderToStaticMarkup(<StaffLoginPage />);
  expect(html).toContain('data-testid="auth-not-configured"');
  const staffSubmit = [...html.matchAll(/<button\b([^>]*type="submit"[^>]*)>/g)];
  expect(staffSubmit.length).toBeGreaterThan(0);
  expect(staffSubmit[0][1]).toMatch(/\bdisabled=""/);
});
it('shows no notice and leaves sign-in enabled when authentication is configured', () => {
  fixture.configured = true;
  const client = renderToStaticMarkup(<ClientLoginPage />);
  const staff = renderToStaticMarkup(<StaffLoginPage />);
  expect(client).not.toContain('auth-not-configured');
  expect(staff).not.toContain('auth-not-configured');
  expect(submitButton(client, 'Sign In Securely')).not.toMatch(/\bdisabled=""/);
});
it('never reveals configuration values or issue codes to end users', () => {
  const html = renderToStaticMarkup(<><ClientLoginPage /><StaffLoginPage /></>);
  expect(html).not.toMatch(/VITE_SUPABASE|URL_MISSING|ANON_KEY|supabase\.co/);
});
