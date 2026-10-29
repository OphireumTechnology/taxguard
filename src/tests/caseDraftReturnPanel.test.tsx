import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { returnProblems, returnProblemText, TaxEngineRequestError, taxEngineMessage, taxEngineService, verificationText } from '../services/taxEngineService';
import { actionNotice, CaseDraftReturnPanel, returnBadge } from '../components/workspace/CaseDraftReturnPanel';
import { practiceManagerRequestAllowed } from '../server/practiceManagerAccess';

// Block 68 browser client and panel. The server rules are covered on PostgreSQL in taxReturnPreparation.db.test.ts.
const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const ID = '0123abcd-0000-4000-8000-000000000001';

describe('draft returns in the browser client', () => {
  it('relays each request to its scoped route and sends only the template, or only a note', async () => {
    await taxEngineService.returnTemplates(2025);
    await taxEngineService.caseReturns('case/1');
    await taxEngineService.prepareReturn('case-1', ID);
    await taxEngineService.returnVersion(ID);
    await taxEngineService.transitionReturn(ID, 'submit');
    await taxEngineService.transitionReturn(ID, 'return', 'Synthetic: correct line 1a');
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      ['/return-templates?taxYear=2025', 'GET', undefined],
      ['/cases/case%2F1/returns', 'GET', undefined],
      ['/cases/case-1/returns', 'POST', { templateRuleId: ID }],
      [`/returns/${ID}`, 'GET', undefined],
      [`/returns/${ID}/submit`, 'POST', {}],
      [`/returns/${ID}/return`, 'POST', { note: 'Synthetic: correct line 1a' }],
    ]);
  });

  it('shows stale before any status, and explains a refused preparation form by form', () => {
    expect(returnBadge({ status: 'APPROVED', stale: [{ reason: 'RETURN_MAPPING_CHANGED', formId: 'SYN-1040' }] })).toBe('STALE');
    expect(returnBadge({ status: 'SUBMITTED', stale: [] })).toBe('SUBMITTED');
    expect(returnBadge({ status: 'SUPERSEDED', stale: [{ reason: 'RETURN_MAPPING_STALE' }] })).toBe('SUPERSEDED');
    expect(returnProblemText({ reason: 'RETURN_FORM_MISSING', formId: 'SYN-1040', formVersion: '2025.0' })).toBe('SYN-1040 2025.0: no current form mapping');
    expect(returnProblemText({ reason: 'RETURN_BLOCKING_DIAGNOSTICS', blocking: 2 })).toBe('the case has blocking diagnostics (2)');
    expect(returnProblemText({ reason: 'RETURN_TEMPLATE_REJECTED' })).toBe('the return template is rejected');
    expect(returnProblems('not json')).toEqual([]);
    const detail = JSON.stringify([{ formId: 'SYN-1040', formVersion: '2025.0', reason: 'RETURN_MAPPING_STALE', mappingId: ID }]);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_PREPARATION_REFUSED', detail)))
      .toBe('Preparation refused: nothing was written. SYN-1040 2025.0: the form mapping is stale; map the form again.');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_STALE', detail)))
      .toBe('Refused: this version is stale. SYN-1040 2025.0: the form mapping is stale; map the form again. Prepare the return again.');
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_RETURN_REVIEWER_REQUIRED'))).toBe("Only the case's independent reviewer can approve or return the draft return.");
  });

  it('announces a confirmed action only over refreshed server data, and says so when the refresh failed', () => {
    expect(actionNotice('Version 1 of SYN-1040-RETURN: approved.', null)).toEqual({ error: false, text: 'Version 1 of SYN-1040-RETURN: approved.' });
    expect(actionNotice('Version 1 of SYN-1040-RETURN: approved.', 'The tax rules service did not confirm this action.')).toEqual({ error: true,
      text: 'Version 1 of SYN-1040-RETURN: approved. The list below could not be refreshed, so it may not show this yet: The tax rules service did not confirm this action. Use Refresh draft returns.' });
  });

  it('describes a calculation verification, and why approval waits for one (Block 69)', () => {
    expect(verificationText({ result: 'VERIFIED', findings: [], runs: [{ runId: ID, ruleSetId: ID, recordedOutputSha256: 'a', recomputedOutputSha256: 'a' }] }))
      .toBe('verified: 1 calculation run recalculated with identical results');
    expect(verificationText({ result: 'DISCREPANCY', runs: [], findings: [{ runId: ID, reason: 'RECALCULATION_MISMATCH' }, { formId: 'SYN-1040', line: '1a', reason: 'VALUE_SOURCE_MISMATCH' }] }))
      .toBe('discrepancy: run 0123abcd: recalculating the run gives a different result; SYN-1040 line 1a: the value differs from the sum of the sources it cites');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_VERIFICATION_REQUIRED', 'NONE'))).toBe('Approval refused: verify the calculations of this version first.');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RETURN_VERIFICATION_REQUIRED', 'DISCREPANCY')))
      .toBe('Approval refused: the latest calculation verification of this version found a discrepancy. Return it to the preparer.');
  });

  it('renders the preparation form with its live region, focusable heading and the reason preparation may be refused', () => {
    const html = renderToStaticMarkup(<CaseDraftReturnPanel caseId="case-1" taxYear={2025} returnFamily="1040" />);
    expect(html).toContain('<h4 id="case-draft-return-heading" tabindex="-1">Draft return</h4>');
    expect(html).toContain('<div role="status" aria-label="Draft return result"></div>');
    expect(html).toContain('No approved template for 1040 2025');
    expect(html).toMatch(/<button disabled="" aria-describedby="case-draft-return-hint">Prepare draft return<\/button>/);
    expect(html).toContain('Final professional authorization is a separate step (Stage 10). Return use: BLOCKED.');
  });

  it('lets practice managers read returns and draft templates, but not prepare, submit or approve', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
    for (const path of ['/api/tax-engine/return-templates', `/api/tax-engine/return-templates/${ID}`, '/api/tax-engine/cases/c1/returns',
      '/api/tax-engine/cases/c1/returns/stage-facts', `/api/tax-engine/returns/${ID}`])
      expect(practiceManagerRequestAllowed('practice_manager', 'GET', path), path).toBe(true);
    for (const path of ['/api/tax-engine/return-templates', `/api/tax-engine/return-templates/${ID}/submit`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(true);
    for (const path of [`/api/tax-engine/return-templates/${ID}/approve`, '/api/tax-engine/cases/c1/returns', `/api/tax-engine/returns/${ID}/submit`,
      `/api/tax-engine/returns/${ID}/approve`, `/api/tax-engine/returns/${ID}/return`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(false);
  });
});
