import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';

const fixture = vi.hoisted(() => ({ actor: null as any }));
vi.mock('../server/auth', async importOriginal => ({
  ...await importOriginal<typeof import('../server/auth')>(),
  authenticateToken: (req: any, res: any, next: any) => {
    if (!fixture.actor) return res.status(401).json({ error: 'AUTH_REQUIRED' });
    req.user = fixture.actor; next();
  },
}));
import { profileAmendmentRouter } from '../server/routes/profile-amendment.routes';
let server: Server, origin: string;
const clientId = 'profile-evidence-client';
beforeAll(async () => {
  const app = express(); app.use('/api/profile', profileAmendmentRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  db.users.delete(clientId); db.clientOnboarding.delete(clientId); db.authoritativeProfiles.delete(clientId);
  for (const id of ['profile-doc-own', 'profile-doc-other', 'profile-doc-unscoped']) db.documents.delete(id);
});
beforeEach(() => {
  fixture.actor = { id: clientId, clientId, tenantId: 'tenant-evidence', role: 'client', status: 'active', name: 'Synthetic Taxpayer', email: 'synthetic@example.test' };
  db.users.set(clientId, fixture.actor); db.clientOnboarding.delete(clientId); db.authoritativeProfiles.delete(clientId);
  for (const id of ['profile-doc-own', 'profile-doc-other', 'profile-doc-unscoped']) db.documents.delete(id);
});
const read = () => fetch(`${origin}/api/profile/authoritative`);
const setDossier = (dossier: any) => db.clientOnboarding.set(clientId, dossier);
const consent = { signerFullName: 'Synthetic Signer', signedAt: '2026-10-08T12:00:00Z', consentVersion: 'synthetic-v1', irc7216ConsentAccepted: true, electronicSignatureConsentAccepted: true, termsAndScopeAccepted: true, pricingScheduleAcknowledged: true };

describe('recorded profile evidence', () => {
  it('does not manufacture consent, certification, cleared identity or document evidence for a new account', async () => {
    const response = await read(); expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store'); const profile = await response.json();
    expect(profile.originalCertifiedRecord).toBeNull(); expect(profile.identity.status).toBe('NOT_VERIFIED');
    expect(profile.identity.verifiedAt).toBeNull(); expect(profile.identity.duplicateCheckStatus).toBe('NOT_RECORDED');
    expect(profile.engagement.taxYear).toBeNull(); expect(profile.engagement.engagementId).toBeNull();
    expect(profile.engagement.agreementAccepted).toBe(false); expect(profile.engagement.feeScheduleAccepted).toBe(false);
    expect(profile.consentCenter.irc7216ConsentAccepted).toBe(false); expect(profile.consentCenter.acceptedAt).toBeNull();
    expect(profile.consentCenter.signerFullName).toBe(''); expect(profile.consentCenter.consentVersion).toBeNull();
    for (const category of ['authorizationDocuments', 'onboardingDocuments', 'engagementDocuments']) expect(profile.myDocuments[category]).toEqual([]);
  });
  it('reports only the exact signed recorded flags and year without granting verification or broader privacy consent', async () => {
    setDossier({ taxYear: 2024, identityComplete: true, engagementConsent: consent, authorizedRep: { fullName: 'Synthetic Representative' } });
    const profile = await (await read()).json();
    expect(profile.consentCenter.irc7216ConsentAccepted).toBe(true); expect(profile.consentCenter.eSignConsentAccepted).toBe(true);
    expect(profile.consentCenter.privacyConsentAccepted).toBe(false); expect(profile.engagement.taxYear).toBe(2024);
    expect(profile.identity.status).toBe('RECORDED_COMPLETE'); expect(profile.identity.verifiedAt).toBeNull();
    expect(profile.representative.authorizationStatus).toBe('RECORDED'); expect(profile.representative.supportingDocuments).toEqual([]);
  });
  it.each(['missing signer', 'missing date', 'invalid date', 'string flag', 'explicit false'])('does not present accepted consent for %s', missing => {
    const record: any = { ...consent };
    if (missing === 'missing signer') delete record.signerFullName;
    if (missing === 'missing date') delete record.signedAt;
    if (missing === 'invalid date') record.signedAt = 'not-a-date';
    if (missing === 'string flag') record.irc7216ConsentAccepted = 'true';
    if (missing === 'explicit false') record.irc7216ConsentAccepted = false;
    setDossier({ engagementConsent: record });
    return read().then(response => response.json()).then(profile => expect(profile.consentCenter.irc7216ConsentAccepted).toBe(false));
  });
  it('does not treat registration electronic consent or completed onboarding as section 7216 consent', async () => {
    fixture.actor.onboardingStatus = 'COMPLETED'; fixture.actor.onboardingCompletedAt = '2026-10-08T11:00:00Z';
    setDossier({ engagementConsent: { electronicConsentAcknowledged: true, electronicSignatureName: 'Synthetic Signer', signatureTimestamp: consent.signedAt, policyVersion: 'synthetic-v2' } });
    const profile = await (await read()).json();
    expect(profile.consentCenter.irc7216ConsentAccepted).toBe(false); expect(profile.consentCenter.eSignConsentAccepted).toBe(true);
    expect(profile.consentCenter.consentVersion).toBe('synthetic-v2'); expect(profile.identity.status).toBe('NOT_VERIFIED');
  });
  it('preserves an explicit false instead of replacing it with an alternate-schema true', async () => {
    setDossier({ engagementConsent: { ...consent, electronicSignatureConsentAccepted: false, electronicConsentAcknowledged: true, termsAndScopeAccepted: false, engagementLetterAcknowledged: true } });
    const profile = await (await read()).json(); expect(profile.consentCenter.eSignConsentAccepted).toBe(false);
    expect(profile.engagement.agreementAccepted).toBe(false);
  });
  it('returns only supplied document references instead of generating substitutes', async () => {
    const document = { id: 'recorded-document', name: 'Synthetic recorded document', verified: false };
    setDossier({ authorizedRep: { fullName: 'Synthetic Representative', supportingDocs: [document] }, onboardingDocuments: [document], engagementDocuments: [document] });
    const profile = await (await read()).json();
    expect(profile.representative.supportingDocuments).toEqual([document]);
    for (const category of ['authorizationDocuments', 'onboardingDocuments', 'engagementDocuments']) expect(profile.myDocuments[category]).toEqual([document]);
  });
  it('retains the authentication and client isolation boundary', async () => {
    fixture.actor = null; expect((await read()).status).toBe(401);
    fixture.actor = { id: clientId, clientId, tenantId: 'tenant-evidence', role: 'client', status: 'active' };
    expect((await fetch(`${origin}/api/profile/authoritative?clientId=other-client`)).status).toBe(403);
  });
  it('does not infer tax classification, industry or formation state from a business account/address', async () => {
    fixture.actor.clientType = 'business'; setDossier({ residentialOrPrincipalAddress: { state: 'SC' } });
    const profile = await (await read()).json(); expect(profile.personal.entityClassification).toBeNull();
    expect(profile.personal.businessDetails).toMatchObject({ stateOfIncorporation: null, naicsCode: null, taxClassification: null });
    expect(profile.personal.tinType).toBeNull();
  });
  it('minimizes tax-document metadata and excludes wrong-tenant or unscoped records', async () => {
    const document = { id: 'profile-doc-own', clientId, tenantId: 'tenant-evidence', fileName: 'Synthetic tax record', category: 'prior_year_return', taxYear: 2024, status: 'uploaded', version: 1, uploadedAt: '2026-10-08T00:00:00Z', url: 'private-url', downloadUrl: 'private-download', reviewerNotes: 'private-notes', extractedData: [{ value: 'private-tax-fact' }] };
    db.documents.set(document.id, document as any);
    db.documents.set('profile-doc-other', { ...document, id: 'profile-doc-other', tenantId: 'tenant-other' } as any);
    db.documents.set('profile-doc-unscoped', { ...document, id: 'profile-doc-unscoped', tenantId: undefined } as any);
    const profile = await (await read()).json(); expect(profile.myDocuments.taxDocuments).toHaveLength(1);
    expect(profile.myDocuments.priorYearDocuments).toHaveLength(1); expect(JSON.stringify(profile.myDocuments)).not.toContain('private-');
  });
  it('does not infer Form 2848 from a general power-of-attorney flag or truthy strings', async () => {
    setDossier({ authorizedRep: { fullName: 'Synthetic Representative', hasPowerOfAttorney: true, hasForm8821: 'false' }, supportingDocs: { invalid: true } });
    const profile = await (await read()).json(); expect(profile.representative.hasForm2848).toBe(false);
    expect(profile.representative.hasForm8821).toBe(false); expect(profile.identity.documents).toEqual([]);
  });
});
