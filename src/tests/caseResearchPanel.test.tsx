import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { AUTHORITY_LABELS, TaxEngineRequestError, taxEngineMessage, taxEngineService } from '../services/taxEngineService';
import { CaseResearchPanel } from '../components/workspace/CaseResearchPanel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('tax research browser client and panel', () => {
  it('relays research requests to the case-scoped routes with the memo version', async () => {
    await taxEngineService.caseResearch('case/1');
    await taxEngineService.citeResearch('m-1', { authorityLevel: 'AI_INFERENCE', note: 'Synthetic note' });
    await taxEngineService.reviewResearch('m-1', 'approve', 'Synthetic independent review', 3);
    const [[listUrl], [citeUrl, cite], [reviewUrl, review]] = transport.mock.calls;
    expect(listUrl).toBe('http://127.0.0.1:3000/api/tax-engine/cases/case%2F1/research');
    expect(citeUrl).toBe('http://127.0.0.1:3000/api/tax-engine/research/m-1/citations');
    expect(JSON.parse(cite.body)).toEqual({ authorityLevel: 'AI_INFERENCE', note: 'Synthetic note' });
    expect(reviewUrl).toBe('http://127.0.0.1:3000/api/tax-engine/research/m-1/approve');
    expect(JSON.parse(review.body)).toEqual({ note: 'Synthetic independent review', version: 3 });
  });
  it('labels AI inference as not tax authority and explains the refusals', () => {
    expect(AUTHORITY_LABELS.AI_INFERENCE).toBe('AI inference — not tax authority');
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'RESEARCH_AUTHORITY_REQUIRED'))).toMatch(/AI inference and secondary support are not enough/);
    expect(taxEngineMessage(new TaxEngineRequestError(404, 'RESEARCH_MEMO_NOT_FOUND'))).toMatch(/live assignment/);
  });
  it('states that research never feeds a return', () => {
    const html = renderToStaticMarkup(<CaseResearchPanel caseId="case-1" taxYear={2025} />);
    expect(html).toContain('Tax research');
    expect(html).toContain('return use: BLOCKED');
    expect(html).toContain('Open research memo');
  });
});
