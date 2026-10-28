import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { EVIDENCE_REASON_LABELS, evidenceText, TaxEngineRequestError, taxEngineMessage, taxEngineService, unresolvedCitations } from '../services/taxEngineService';
import { RunEvidence } from '../components/workspace/RunEvidence';
import { practiceManagerRequestAllowed } from '../server/practiceManagerAccess';

// Evidence lineage of calculation inputs (proposal 20261018190000) in the browser client. The interactive view is driven
// in browser suite 07; the server rules are covered on PostgreSQL in taxCalcInputLineage.db.test.ts.
const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ citations: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });
const SHA = 'abcdef0123456789'.repeat(4);

describe('calculation run evidence in the browser client', () => {
  it('reads lineage from the run-scoped route', async () => {
    await taxEngineService.runLineage('run/1');
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method])).toEqual([['/runs/run%2F1/lineage', 'GET']]);
  });

  it('describes resolved and unresolved evidence', () => {
    expect(evidenceText({ kind: 'DOCUMENT', documentId: 'doc-1', documentVersion: 2, documentSha256: SHA })).toBe('Reviewed document doc-1 v2 (sha256 abcdef012345…)');
    expect(evidenceText({ kind: 'EXTRACTION', fieldId: 'f', fieldKey: 'w2.box1_wages', decision: 'CORRECTED', decidedValue: '101.00', decidedBy: 'rev-1',
      documentId: 'doc-1', documentVersion: 1, documentSha256: SHA })).toBe('w2.box1_wages = 101.00, corrected by rev-1, from document doc-1 v1 (sha256 abcdef012345…)');
    expect(evidenceText({ unresolved: 'DOCUMENT_SUPERSEDED' })).toBe('Unresolved: a newer version of the document replaced it');
    expect(evidenceText({ unresolved: 'SOMETHING_NEW' })).toBe('Unresolved: SOMETHING_NEW');
  });

  it('explains a refusal per input and citation, for every reason the server gives', () => {
    for (const reason of ['NOT_FOUND', 'OUT_OF_SCOPE', 'NOT_DECIDED', 'VALUE_REJECTED', 'DOCUMENT_SUPERSEDED', 'DOCUMENT_NOT_REVIEWED', 'VALUE_MISMATCH', 'UNRECOGNISED_REFERENCE'])
      expect(EVIDENCE_REASON_LABELS[reason], reason).toBeTruthy();
    expect(unresolvedCitations('a.b|document:d1|NOT_FOUND,c.d|extraction:x|VALUE_MISMATCH')).toEqual([
      { factPath: 'a.b', ref: 'document:d1', reason: 'NOT_FOUND' }, { factPath: 'c.d', ref: 'extraction:x', reason: 'VALUE_MISMATCH' }]);
    expect(unresolvedCitations(undefined)).toEqual([]);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_CALC_EVIDENCE_UNRESOLVED', 'synthetic.income_a|doc:free|UNRECOGNISED_REFERENCE')))
      .toBe('Refused: every input must cite a reviewed document or a decided extracted value of this case. synthetic.income_a (doc:free): cite extraction:<field id> or document:<document id>');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_CALC_EVIDENCE_UNRESOLVED', 'no citations'))).toMatch(/No input cites evidence\.$/);
  });

  it('starts closed and fetches nothing until opened', () => {
    const html = renderToStaticMarkup(<RunEvidence runId="0123456789abcdef" refreshKey="COMPUTED" />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Show evidence for run 01234567');
    expect(transport).not.toHaveBeenCalled();
  });

  it('lets practice managers read lineage on the durable store, and nothing more', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
    try {
      expect(practiceManagerRequestAllowed('practice_manager', 'GET', '/api/tax-engine/runs/0123456789abcdef/lineage')).toBe(true);
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', '/api/tax-engine/runs/0123456789abcdef/lineage')).toBe(false);
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', '/api/tax-engine/runs/0123456789abcdef/approve')).toBe(false);
    } finally { vi.unstubAllEnvs(); }
  });
});
