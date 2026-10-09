import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProfileEvidenceSections } from '../components/portal/views/ProfileEvidenceSections';
const hook = vi.hoisted(() => ({ status: 'error', allowed: true, data: null as any }));
vi.mock('../hooks/useAuthoritativeClientProfile', () => ({ useAuthoritativeClientProfile: () => ({ ...hook, key: 'synthetic' }) }));
import { ClientProfileView } from '../components/portal/views/ClientProfileView';
describe('profile evidence display', () => {
  it.each(['representative', 'identity', 'engagement', 'consents', 'documents'])('does not fabricate positive evidence in empty %s records', section => {
    const html = renderToStaticMarkup(<ProfileEvidenceSections section={section} profile={{}}/>);
    expect(html).not.toContain('Granted'); expect(html).not.toContain('Executed &amp; Binding');
    expect(html).not.toContain('Government_Photo_ID'); expect(html).not.toContain('CAF Registered');
    expect(html).not.toContain('2025.1-IRC7216');
    expect(html).toMatch(/Not recorded|not recorded|No recorded|NOT_VERIFIED/);
  });
  it('renders recorded consent flags without claiming additional usage authority', () => {
    const html = renderToStaticMarkup(<ProfileEvidenceSections section="consents" profile={{ consentCenter: { irc7216ConsentAccepted: true, electronicSignatureConsentAccepted: false, consentVersion: 'synthetic-v1' } }}/>);
    expect(html).toContain('Recorded acceptance'); expect(html).toContain('Acceptance not recorded');
    expect(html).toContain('synthetic-v1'); expect(html).toContain('do not authorize additional data use');
  });
  it('renders supplied document names as text and preserves false verification flags', () => {
    const html = renderToStaticMarkup(<ProfileEvidenceSections section="documents" profile={{ myDocuments: { identityDocuments: [{ id: 'doc-a', name: '<script>untrusted</script>', verified: false }] } }}/>);
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).toContain('Not recorded as verified');
  });
  it('shows profile failure and retry without substituting local identity records', () => {
    const html = renderToStaticMarkup(<ClientProfileView currentUser={null} authLifecycleState="AUTHENTICATED"/>);
    expect(html).toContain('role="alert"'); expect(html).toContain('Retry profile');
    for (const example of ['1428 Palmetto', '1984-06-18', '9876', 'Identity Verified']) expect(html).not.toContain(example);
  });
});
