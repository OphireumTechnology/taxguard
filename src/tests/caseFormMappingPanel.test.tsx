import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { formProblems, formProblemText, TaxEngineRequestError, taxEngineMessage, taxEngineService } from '../services/taxEngineService';
import { CaseFormMappingPanel, mappingBadge } from '../components/workspace/CaseFormMappingPanel';
import { practiceManagerRequestAllowed } from '../server/practiceManagerAccess';

// Block 67 browser client and panel. The server rules are covered on PostgreSQL in taxFormMapping.db.test.ts and the
// interactive journey in browser suite 07.
const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const ID = '0123abcd-0000-4000-8000-000000000001';

describe('form mapping in the browser client', () => {
  it('relays each request to its scoped route and sends only the rule when mapping', async () => {
    await taxEngineService.formRules(2025);
    await taxEngineService.caseFormMappings('case/1');
    await taxEngineService.mapForm('case-1', ID);
    await taxEngineService.formMapping(ID);
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      ['/form-rules?taxYear=2025', 'GET', undefined],
      ['/cases/case%2F1/form-mappings', 'GET', undefined],
      ['/cases/case-1/form-mappings', 'POST', { ruleId: ID }],
      [`/form-mappings/${ID}`, 'GET', undefined],
    ]);
  });

  it('shows stale before current, and explains a refused mapping line by line', () => {
    expect(mappingBadge({ status: 'CURRENT', stale: [{ reason: 'SOURCE_CHANGED', line: '1a' }] })).toBe('STALE');
    expect(mappingBadge({ status: 'CURRENT', stale: [] })).toBe('CURRENT');
    expect(mappingBadge({ status: 'SUPERSEDED', stale: [] })).toBe('SUPERSEDED');
    expect(formProblemText({ reason: 'AMBIGUOUS_SOURCE', schedule: 'MAIN', line: '1a', field: 'f1_wages', candidates: 2 }))
      .toBe('line 1a (f1_wages): more than one approved conclusion could fill this line');
    expect(formProblemText({ reason: 'MAPPING_RULE_SUPERSEDED' })).toBe('a newer mapping rule was approved for this form');
    expect(formProblems('not json')).toEqual([]);
    const detail = JSON.stringify([{ schedule: 'MAIN', line: '16', field: 'f1_tax', reason: 'SOURCE_STALE', conclusionId: ID }]);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_FORM_MAPPING_REFUSED', detail)))
      .toBe('Mapping refused: nothing was written. line 16 (f1_tax): the conclusion is stale.');
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_FORM_MAPPING_PREPARER_REQUIRED'))).toBe("Only the case's preparer can map the case to a form.");
  });

  it('renders the mapping form with its live region, focusable heading and the reason a mapping may be refused', () => {
    const html = renderToStaticMarkup(<CaseFormMappingPanel caseId="case-1" taxYear={2025} returnFamily="1040" />);
    expect(html).toContain('<h4 id="case-form-mapping-heading" tabindex="-1">Form mapping</h4>');
    expect(html).toContain('<div role="status" aria-label="Form mapping result"></div>');
    expect(html).toContain('No approved rule for 1040 2025');
    expect(html).toMatch(/<button disabled="" aria-describedby="case-form-mapping-hint">Map to form<\/button>/);
    expect(html).toContain('Loading form mappings…');
  });

  it('lets practice managers read mappings and draft rules, but not map or approve', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
    for (const path of ['/api/tax-engine/form-rules', `/api/tax-engine/form-rules/${ID}`, '/api/tax-engine/cases/c1/form-mappings', `/api/tax-engine/form-mappings/${ID}`])
      expect(practiceManagerRequestAllowed('practice_manager', 'GET', path), path).toBe(true);
    for (const path of ['/api/tax-engine/form-rules', `/api/tax-engine/form-rules/${ID}/submit`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(true);
    for (const path of ['/api/tax-engine/cases/c1/form-mappings', `/api/tax-engine/form-rules/${ID}/approve`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(false);
  });
});
