import express from 'express';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { createSession } from '../server/auth';
import { taxFormsRouter } from '../server/routes/taxForms.routes';
import { CORE_RETURN_CATEGORIES, FEDERAL_FORMS } from '../taxForms/federalForms';
import { STATE_JURISDICTIONS, applicabilityFor } from '../taxForms/stateJurisdictions';
import { LIBRARY_GROUPS, libraryCatalog, queryFederalForms, queryStates } from '../taxForms/registry';
import { capabilitiesFor, readinessLabel, referenceOnlyCapabilities } from '../taxForms/capabilities';
import { CATALOG_TAX_YEARS, READINESS_LADDER } from '../taxForms/types';
import { PREPARATION_PIPELINE } from '../taxForms/preparationPipeline';

const session = vi.hoisted(() => ({ user: { id: 'u', role: 'accountant', status: 'active', tenantId: 't' } as any }));
vi.mock('../context/AppContext', () => ({ useApp: () => ({ currentUser: session.user, authLifecycleState: 'AUTHENTICATED', setCurrentPage: vi.fn() }) }));
import { TaxFormsLibrary } from '../components/taxForms/TaxFormsLibrary';

const numbers = new Set(FEDERAL_FORMS.map(f => f.formNumber));

describe('eight mandatory federal return categories', () => {
  it('are all present with their primary forms in the catalog', () => {
    expect(CORE_RETURN_CATEGORIES.map(c => c.id)).toEqual(['individual-1040', 'estates-trusts-1041', 'partnerships-1065', 'c-corporations-1120', 's-corporations-1120s', 'nonprofits-990', 'estate-tax-706', 'gift-tax-709']);
    for (const c of CORE_RETURN_CATEGORIES) for (const id of c.primaryFormIds) {
      const f = FEDERAL_FORMS.find(x => x.id === id);
      expect(f, id).toBeDefined();
      expect(f!.groups).toContain(c.id);
    }
  });
});

describe('every explicitly listed federal form', () => {
  const required = [
    '1040', '1040-SR', '1040-X', 'Schedule 1 (Form 1040)', 'Schedule 2 (Form 1040)', 'Schedule 3 (Form 1040)', 'Schedule A (Form 1040)', 'Schedule B (Form 1040)',
    'Schedule C (Form 1040)', 'Schedule D (Form 1040)', 'Schedule E (Form 1040)', 'Schedule F (Form 1040)', 'Schedule SE (Form 1040)',
    '2441', 'Schedule 8812 (Form 1040)', '8863', '8889', '8962', '8949', '4797', '4562', '6251',
    '1065', '1120', '1120-S', 'Schedule K-1 (Form 1041)', 'Schedule K-1 (Form 1065)', 'Schedule K-1 (Form 1120-S)',
    '1041', '990', '990-EZ', '990-N', '990-PF', '706', '709', '941', '940', 'W-2', 'W-3',
    '1099-NEC', '1099-MISC', '1099-INT', '1099-DIV', '1099-K', '1040-ES', '1120-W', '4868', '7004',
    '1116', '2555', '5471', '8938', '8865', '2848', '8821', '8879',
  ];
  it.each(required)('%s is cataloged', n => expect(numbers.has(n)).toBe(true));
  it('ids are unique and every form has an official IRS source page', () => {
    expect(new Set(FEDERAL_FORMS.map(f => f.id)).size).toBe(FEDERAL_FORMS.length);
    for (const f of FEDERAL_FORMS) expect(f.officialSourceUrl).toMatch(/^https:\/\/www\.irs\.gov\//);
  });
  it('library navigation has the sixteen required groups', () => {
    expect(LIBRARY_GROUPS.map(g => g.label)).toEqual([
      'Individual Tax Returns — 1040', 'Estates and Trusts — 1041', 'Partnerships — 1065', 'C Corporations — 1120', 'S Corporations — 1120-S',
      'Nonprofits — 990', 'Estate Tax — 706', 'Gift Tax — 709', 'Payroll and Employment', 'Information Returns', 'International Tax',
      'Credits, Deductions, and Supporting Schedules', 'Extensions and Amendments', 'Federal Authorizations', 'State and Local Taxes', 'Tax Forms Search and Reference',
    ]);
  });
});

describe('50 states and Washington, D.C.', () => {
  const names = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'Washington, D.C.'];
  it('covers exactly the 51 jurisdictions, each with every tax category', () => {
    expect(STATE_JURISDICTIONS.map(s => s.name).sort()).toEqual([...names].sort());
    expect(new Set(STATE_JURISDICTIONS.map(s => s.code)).size).toBe(51);
    for (const s of STATE_JURISDICTIONS) expect(Object.keys(s.categories)).toHaveLength(15);
  });
  it('does not catalog an individual income tax return for states without a general income tax', () => {
    for (const code of ['AK', 'FL', 'NV', 'NH', 'SD', 'TN', 'TX', 'WA', 'WY']) {
      const s = STATE_JURISDICTIONS.find(x => x.code === code)!;
      for (const y of CATALOG_TAX_YEARS) expect(applicabilityFor(s, 'individual-income', y), `${code} ${y}`).not.toBe('applies');
      expect(applicabilityFor(s, 'employer-withholding', 2025)).toBe('does-not-apply');
    }
  });
  it('lists no state form numbers and marks every jurisdiction unverified', () => {
    for (const s of STATE_JURISDICTIONS) {
      expect(JSON.stringify(s)).not.toMatch(/formNumber/);
      expect(s.verification.status).toBe('unverified');
      expect(s.agencyUrl).toMatch(/^https:\/\//);
    }
  });
  it('keeps federal Forms 706 / 709 separate from state estate, inheritance and gift taxes', () => {
    for (const id of ['F-706', 'F-709']) expect(FEDERAL_FORMS.find(f => f.id === id)!.jurisdiction).toBe('FEDERAL');
    const gift = queryStates({ category: 'gift-tax', onlyApplicable: true, taxYear: 2025 }).map(s => s.code);
    expect(gift).toEqual(['CT']);
    const estate = queryStates({ category: 'estate-tax', onlyApplicable: true, taxYear: 2025 }).map(s => s.code).sort();
    expect(estate).toEqual(['CT', 'DC', 'HI', 'IL', 'MA', 'MD', 'ME', 'MN', 'NY', 'OR', 'RI', 'VT', 'WA']);
  });
});

describe('tax-year versioning and filtering', () => {
  it('every federal form covers the catalog years with a per-year version entry', () => {
    for (const f of FEDERAL_FORMS) {
      expect(f.taxYears).toEqual([...CATALOG_TAX_YEARS]);
      expect(f.versionHistory.map(v => v.taxYear)).toEqual([...CATALOG_TAX_YEARS]);
      expect(f.versionHistory.every(v => v.revision === null)).toBe(true); // revisions are not claimed as verified
    }
  });
  it('applies year-specific state rules', () => {
    const nh = STATE_JURISDICTIONS.find(s => s.code === 'NH')!;
    expect(applicabilityFor(nh, 'individual-income', 2024)).toBe('limited');
    expect(applicabilityFor(nh, 'individual-income', 2025)).toBe('does-not-apply');
    const ia = STATE_JURISDICTIONS.find(s => s.code === 'IA')!;
    expect(applicabilityFor(ia, 'inheritance-tax', 2024)).toBe('applies');
    expect(applicabilityFor(ia, 'inheritance-tax', 2025)).toBe('does-not-apply');
    expect(queryStates({ category: 'inheritance-tax', onlyApplicable: true, taxYear: 2024 }).map(s => s.code)).toContain('IA');
    expect(queryStates({ category: 'inheritance-tax', onlyApplicable: true, taxYear: 2025 }).map(s => s.code)).not.toContain('IA');
  });
  it('filters and searches federal forms by group, text and readiness', () => {
    expect(queryFederalForms({ group: 'payroll-employment' }).map(f => f.formNumber).sort()).toEqual(['940', '941', 'W-2', 'W-3']);
    expect(queryFederalForms({ text: 'schedule k-1' }).map(f => f.id).sort()).toEqual(['F-1041', 'F-1065', 'F-1120-S', 'F-K1-1041', 'F-K1-1065', 'F-K1-1120S']);
    expect(queryFederalForms({ text: 'premium tax' }).map(f => f.formNumber)).toEqual(['8962']);
    expect(queryFederalForms({ readiness: 'Cataloged / Reference Only' }).map(f => f.id).sort()).toEqual(['F-1040-SR', 'F-1120-W', 'F-K1-1041', 'F-K2K3-1065']);
    expect(queryFederalForms({ group: 'search-reference' })).toHaveLength(FEDERAL_FORMS.length);
    expect(queryStates({ text: 'oregon' }).map(s => s.code)).toEqual(['OR']);
  });
});

describe('capability and filing-readiness labels', () => {
  const verified = { status: 'verified' as const, method: 'test', checkedOn: '2026-10-12' };
  it('climbs the ladder only through consecutive available capabilities', () => {
    const caps = referenceOnlyCapabilities();
    expect(readinessLabel({ ...verified, status: 'unverified' }, caps)).toBe('Cataloged / Reference Only');
    expect(readinessLabel(verified, caps)).toBe('Official Source Verified');
    const some = { ...caps, dataEntry: { status: 'available' as const, note: '' }, calculation: { status: 'available' as const, note: '' } };
    expect(readinessLabel(verified, some)).toBe('Calculation Supported');
    const gap = { ...caps, dataEntry: { status: 'available' as const, note: '' }, efile: { status: 'available' as const, note: '' } };
    expect(readinessLabel(verified, gap)).toBe('Data Entry Supported');
    const prototype = { ...caps, dataEntry: { status: 'prototype' as const, note: '' } };
    expect(readinessLabel(verified, prototype)).toBe('Official Source Verified');
  });
  it('fabricates no preparation, PDF or filing availability anywhere', () => {
    for (const f of libraryCatalog().federalForms) {
      expect(['Cataloged / Reference Only', 'Official Source Verified']).toContain(f.readiness);
      for (const k of ['pdf', 'efile', 'filingReady', 'reviewReady'] as const) expect(f.capabilities[k].status, `${f.id} ${k}`).not.toBe('available');
      expect(Object.values(f.capabilities).some(c => c.status === 'available'), f.id).toBe(false);
    }
    expect(capabilitiesFor('F-1040').calculation.status).toBe('prototype');
    expect(libraryCatalog().federalForms.find(f => f.id === 'F-1040')!.preparation).toBe('Prototype only');
    expect(libraryCatalog().federalForms.find(f => f.id === 'F-706')!.preparation).toBe('Blocked / Not Implemented');
    expect(PREPARATION_PIPELINE.find(p => p.id === 'efile')!.status).toBe('blocked');
    expect(PREPARATION_PIPELINE.find(p => p.id === 'pdf')!.status).toBe('not_implemented');
    expect(READINESS_LADDER[READINESS_LADDER.length - 1]).toBe('Filing Ready');
  });
});

describe('server authorization (read-only reference API)', () => {
  let server: Server, origin: string;
  const users = {
    accountant: { id: 'tf-acct', role: 'accountant', status: 'active', tenantId: 'tf-t', email: 'a@example.invalid' },
    superAdmin: { id: 'tf-sa', role: 'super_admin', status: 'active', tenantId: 'tf-t', email: 's@example.invalid' },
    client: { id: 'tf-client', role: 'client', status: 'active', tenantId: 'tf-t', clientId: 'tf-client', email: 'c@example.invalid' },
    recruiter: { id: 'tf-rec', role: 'recruiter', status: 'active', tenantId: 'tf-t', email: 'r@example.invalid' },
  };
  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'test');
    for (const u of Object.values(users)) db.users.set(u.id, u as any);
    const app = express(); app.use(express.json()); app.use('/api/tax-forms', taxFormsRouter);
    server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    for (const u of Object.values(users)) db.users.delete(u.id);
    vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()));
  });
  const get = (path: string, user?: keyof typeof users, method = 'GET') => fetch(`${origin}/api/tax-forms${path}`, {
    method, headers: user ? { authorization: `Bearer ${createSession(users[user].id, users[user].role)}`, 'content-type': 'application/json' } : {},
    body: method === 'GET' ? undefined : '{}',
  });
  it('rejects unauthenticated, client and recruiter requests', async () => {
    expect((await get('/')).status).toBe(401);
    expect((await get('/', 'client')).status).toBe(403);
    expect((await get('/', 'recruiter')).status).toBe(403);
  });
  it('serves the catalog to practice staff and, read-only, to the super administrator', async () => {
    for (const u of ['accountant', 'superAdmin'] as const) {
      const r = await get('/', u);
      expect(r.status).toBe(200);
      const body = await r.json();
      expect(body.federalForms).toHaveLength(FEDERAL_FORMS.length);
      expect(body.states).toHaveLength(51);
      expect(JSON.stringify(body)).not.toMatch(/tenantId|clientId|tf-t/);
    }
    expect((await get('/forms/F-1040', 'accountant')).status).toBe(200);
    expect((await get('/forms/NOPE', 'accountant')).status).toBe(404);
  });
  it('has no write endpoints for any role', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      expect((await get('/', 'superAdmin', method)).status).toBe(404);
      expect((await get('/forms/F-1040', 'accountant', method)).status).toBe(404);
    }
  });
});

describe('library interface', () => {
  afterEach(() => { session.user = { ...session.user, role: 'accountant' }; });
  it('renders navigation, disclaimer and honest statuses for practice staff', () => {
    const html = renderToStaticMarkup(<TaxFormsLibrary catalog={libraryCatalog()} />);
    for (const g of LIBRARY_GROUPS) expect(html).toContain(g.label.replace('&', '&amp;'));
    expect(html).toContain('does not mean TaxGuard can prepare');
    expect(html).toContain('Official Source Verified');
    expect(html).toContain('Prototype only');
    expect(html).not.toMatch(/Filing Ready<\/span>|E-File Integration Available<\/span>/);
  });
  it('refuses clients and offers no preparation or filing actions to a super administrator', () => {
    session.user = { ...session.user, role: 'client' };
    expect(renderToStaticMarkup(<TaxFormsLibrary catalog={libraryCatalog()} />)).toContain('role="alert"');
    session.user = { ...session.user, role: 'super_admin' };
    const html = renderToStaticMarkup(<TaxFormsLibrary catalog={libraryCatalog()} />);
    expect(html).not.toContain('role="alert"');
    const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
    expect(buttons.filter(b => /prepare|e-?file|submit|generate pdf|transmit/i.test(b))).toEqual([]);
  });
});
