import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { isSha256, TaxEngineRequestError, taxEngineMessage, taxEngineService } from '../services/taxEngineService';
import { TaxRulesPanel } from '../components/workspace/TaxRulesPanel';
import { MANAGER_MODULES } from '../components/workspace/practiceManagerModel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('tax rules client', () => {
  it('relays only the fields the server needs; it never sends an approval of its own', async () => {
    await taxEngineService.verifySource('IRS PUB/17', 'a'.repeat(64));
    let [url, options] = transport.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/tax-engine/sources/IRS%20PUB%2F17/verify');
    expect(JSON.parse(options.body)).toEqual({ documentSha256: 'a'.repeat(64) });
    await taxEngineService.transition('rs-1', 'reject', 'Synthetic rejection note');
    [url, options] = transport.mock.calls[1];
    expect(url).toBe('http://127.0.0.1:3000/api/tax-engine/rule-sets/rs-1/reject');
    expect(JSON.parse(options.body)).toEqual({ note: 'Synthetic rejection note' });
    await taxEngineService.transition('rs-1', 'submit');
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual({});
    await taxEngineService.ruleSets(2025);
    expect(transport.mock.calls[3][0]).toBe('http://127.0.0.1:3000/api/tax-engine/rule-sets?taxYear=2025');
  });
  it('carries the server code and detail on refusal', async () => {
    transport.mockImplementationOnce(async () => new Response(JSON.stringify({ code: 'TAX_SOURCE_NOT_VERIFIED', detail: 'ZZ-GUIDANCE-1' }), { status: 409 }));
    const error = await taxEngineService.transition('rs-1', 'submit').catch(e => e);
    expect(error).toBeInstanceOf(TaxEngineRequestError);
    expect(taxEngineMessage(error)).toBe('Submit refused: source ZZ-GUIDANCE-1 is not verified yet.');
  });
  it('explains maker-checker, reviewer-only and approval-gate refusals', () => {
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'MAKER_CHECKER_VIOLATION'))).toMatch(/different person/);
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_CONTENT_REVIEWER_REQUIRED'))).toMatch(/Only a reviewer/);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RULE_SET_TESTS_FAILING'))).toMatch(/failures/);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_RULE_SET_COVERAGE_INCOMPLETE'))).toMatch(/cover every output/);
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'SOMETHING_ELSE'))).toBe('Your role is not authorized for this action.');
    expect(taxEngineMessage(new Error('network'))).toMatch(/did not confirm/);
  });
  it('accepts only a 64-character lowercase hex document hash', () => {
    expect(isSha256('a'.repeat(64))).toBe(true);
    expect(isSha256('A'.repeat(64))).toBe(false);
    expect(isSha256('a'.repeat(63))).toBe(false);
  });
  it('is reachable from the practice manager navigation and renders its sections', () => {
    expect(MANAGER_MODULES).toContain('Tax Rules');
    const html = renderToStaticMarkup(<TaxRulesPanel />);
    for (const text of ['Tax Rules', 'Sources of law', 'Register a source', 'Rule sets', 'Loading sources']) expect(html).toContain(text);
  });
});
