import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { conclusionBadge, staleReason, TaxEngineRequestError, taxEngineMessage, taxEngineService, unresolvedSource } from '../services/taxEngineService';
import { CaseConclusionsPanel } from '../components/workspace/CaseConclusionsPanel';
import { practiceManagerRequestAllowed } from '../server/practiceManagerAccess';

// Block 66 browser client and panel. The server rules are covered on PostgreSQL in taxConclusions.db.test.ts and the
// interactive journey in browser suite 07.
const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const ID = '0123abcd-0000-4000-8000-000000000001';

describe('tax conclusions in the browser client', () => {
  it('relays every conclusion request to its scoped route', async () => {
    await taxEngineService.caseConclusions('case/1');
    await taxEngineService.proposeConclusion('case-1', { type: 'DEDUCTION', statement: 'Synthetic deduction statement', amount: '10.00', links: [{ type: 'EVIDENCE', ref: 'document:d1' }] });
    await taxEngineService.reviseConclusion(ID, { links: [{ type: 'EVIDENCE', ref: 'document:d2' }] });
    await taxEngineService.submitConclusion(ID);
    await taxEngineService.reviewConclusion(ID, 'return', 'Synthetic return note');
    await taxEngineService.traceConclusion(ID);
    await taxEngineService.conclusionReadiness('case-1');
    expect(transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined])).toEqual([
      ['/cases/case%2F1/conclusions', 'GET', undefined],
      ['/cases/case-1/conclusions', 'POST', { type: 'DEDUCTION', statement: 'Synthetic deduction statement', amount: '10.00', links: [{ type: 'EVIDENCE', ref: 'document:d1' }] }],
      [`/conclusions/${ID}/revise`, 'POST', { links: [{ type: 'EVIDENCE', ref: 'document:d2' }] }],
      [`/conclusions/${ID}/submit`, 'POST', undefined],
      [`/conclusions/${ID}/return`, 'POST', { note: 'Synthetic return note' }],
      [`/conclusions/${ID}/trace`, 'GET', undefined],
      ['/cases/case-1/conclusions/readiness', 'GET', undefined],
    ]);
  });

  it('shows stale before any review state, and explains refusals and stale reasons', () => {
    const stale = [{ type: 'EVIDENCE' as const, ref: 'document:d1', reason: 'SOURCE_CHANGED' }];
    expect(conclusionBadge({ status: 'APPROVED', stale })).toBe('STALE');
    expect(conclusionBadge({ status: 'APPROVED', stale: [] })).toBe('APPROVED');
    expect(conclusionBadge({ status: 'READY_FOR_REVIEW', stale: [] })).toBe('REVIEW REQUIRED');
    expect(conclusionBadge({ status: 'RETURNED', stale: [] })).toBe('BLOCKED');
    expect(conclusionBadge({ status: 'SUPERSEDED', stale })).toBe('SUPERSEDED');
    expect(staleReason('SOURCE_CHANGED')).toBe('the source changed after it was linked');
    expect(staleReason('DOCUMENT_SUPERSEDED')).toBe('a newer version of the document replaced it');
    expect(unresolvedSource('EVIDENCE|extraction:x|NOT_DECIDED')).toEqual({ type: 'EVIDENCE', ref: 'extraction:x', reason: 'NOT_DECIDED' });
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_CONCLUSION_SOURCE_UNRESOLVED', 'EVIDENCE|extraction:x|NOT_DECIDED')))
      .toBe('Refused: a cited source does not resolve for this case (evidence extraction:x: the extracted value is not decided yet).');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_CONCLUSION_STALE', '[]'))).toMatch(/^Refused: a source changed after it was linked\./);
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_CONCLUSION_REVIEWER_REQUIRED'))).toBe("Only the case's independent reviewer can decide on a conclusion.");
  });

  it('renders the proposal form and a loading state before any data arrives', () => {
    const html = renderToStaticMarkup(<CaseConclusionsPanel caseId="case-1" />);
    for (const text of ['Tax conclusions', 'Propose a conclusion', 'Verified evidence (extraction:&lt;id&gt; or document:&lt;id&gt;)', 'Loading conclusions…'])
      expect(html).toContain(text);
  });

  it('keeps its live regions mounted and explains why saving is disabled (accessibility review, Block 66)', () => {
    const html = renderToStaticMarkup(<CaseConclusionsPanel caseId="case-1" />);
    // Announced regions exist before any text arrives, so later changes are read out.
    expect(html).toContain('<div role="status" aria-label="Conclusion readiness"></div>');
    expect(html).toContain('<div role="status" aria-label="Conclusion action result"></div>');
    expect(html).toContain('<h4 id="case-conclusions-heading" tabindex="-1">Tax conclusions</h4>');
    expect(html).toMatch(/<p id="case-conclusion-save-hint">A statement of at least 10 characters and at least one verified evidence reference are required\.<\/p><button disabled="" aria-describedby="case-conclusion-save-hint">Propose conclusion<\/button>/);
    expect(html).not.toContain('aria-label="Conclusion status"'); // a name on <strong> would hide the status word itself
  });

  it('lets practice managers read conclusions, traces and readiness, and nothing more', () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key');
    for (const path of ['/api/tax-engine/cases/c1/conclusions', '/api/tax-engine/cases/c1/conclusions/readiness', '/api/tax-engine/cases/c1/evidence-trace', `/api/tax-engine/conclusions/${ID}/trace`])
      expect(practiceManagerRequestAllowed('practice_manager', 'GET', path), path).toBe(true);
    for (const path of ['/api/tax-engine/cases/c1/conclusions', `/api/tax-engine/conclusions/${ID}/approve`, `/api/tax-engine/conclusions/${ID}/submit`])
      expect(practiceManagerRequestAllowed('practice_manager', 'POST', path), path).toBe(false);
  });
});
