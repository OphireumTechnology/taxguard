import fs from 'node:fs';
import { expect, it } from 'vitest';
import { assessLocalBrowserPrerequisites as assess } from '../../scripts/local-browser-prerequisites.mjs';
const html = fs.readFileSync('qa/synthetic-shell/index.html', 'utf8');
it('distinguishes present prerequisites from actual browser or release acceptance', () => {
  expect(assess(true, html)).toEqual({ status: 'PREREQUISITES_PRESENT_ONLY', blockers: [], browserAcceptance: 'NOT VERIFIED', releaseAuthorized: false });
});
it('records both missing dependency and missing artifact without launching anything', () => {
  expect(assess(false, undefined).blockers).toEqual(['PLAYWRIGHT_PACKAGE_MISSING', 'SYNTHETIC_ARTIFACT_MISSING']);
});
it.each([undefined, false, 'true', 1])('does not accept unverified package flag %j', value => expect(assess(value, html).status).toBe('BLOCKED'));
it.each([html.replace("connect-src 'none'", "connect-src *"), html.replace("form-action 'none'", "form-action *"), '<html>Production</html>', 'x'.repeat(1048577)])('refuses unbounded or incorrectly isolated artifact', candidate => {
  expect(assess(true, candidate).blockers).toContain('SYNTHETIC_ARTIFACT_POLICY_INVALID');
});
