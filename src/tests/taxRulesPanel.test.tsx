import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { isSha256, parseAssignments, TaxEngineRequestError, taxEngineMessage, taxEngineService } from '../services/taxEngineService';
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
  it('test runs and run reviews are server actions; the browser sends no results or outputs of its own', async () => {
    await taxEngineService.runTests('rs-1');
    expect(transport.mock.calls[0][0]).toBe('http://127.0.0.1:3000/api/tax-engine/rule-sets/rs-1/run-tests');
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({});
    await taxEngineService.reviewRun('run/1', 'approve', 'Synthetic inputs traced to evidence');
    expect(transport.mock.calls[1][0]).toBe('http://127.0.0.1:3000/api/tax-engine/runs/run%2F1/approve');
    expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual({ note: 'Synthetic inputs traced to evidence' });
    await taxEngineService.caseRuns('case/1');
    expect(transport.mock.calls[2][0]).toBe('http://127.0.0.1:3000/api/tax-engine/cases/case%2F1/runs');
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'TAX_CALC_REVIEWER_REQUIRED'))).toMatch(/independent reviewer/);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'TAX_CALC_ALREADY_REVIEWED'))).toMatch(/already been reviewed/);
  });
  it('authoring sends the definition and structured tests; removal names only the test', async () => {
    await taxEngineService.draftRuleSet({ returnFamily: 'SYN-1' });
    expect(transport.mock.calls[0][0]).toBe('http://127.0.0.1:3000/api/tax-engine/rule-sets');
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ definition: { returnFamily: 'SYN-1' } });
    const test = { name: 'Synthetic example', sourceId: 'ZZ-1', citation: 'Synthetic citation', inputs: [{ factPath: 'synthetic.income_a', value: '5000.00', evidenceIds: ['doc:1'] }],
      expected: { synthetic_base: '4000.00' } };
    await taxEngineService.addTest('rs-1', test);
    expect(transport.mock.calls[1][0]).toBe('http://127.0.0.1:3000/api/tax-engine/rule-sets/rs-1/tests');
    expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual(test);
    await taxEngineService.removeTest('rs-1', 't/1');
    expect(transport.mock.calls[2][0]).toBe('http://127.0.0.1:3000/api/tax-engine/rule-sets/rs-1/tests/t%2F1/remove');
  });
  it('parses "name = amount" lines and refuses malformed or repeated names', () => {
    expect(parseAssignments('synthetic.income_a = 5000.00\n\n synthetic_b=-12.5 ')).toEqual([['synthetic.income_a', '5000.00'], ['synthetic_b', '-12.5']]);
    for (const bad of ['', 'x = 1\nx = 2', 'x = abc', 'no equals sign', 'x = 1.23456']) expect(parseAssignments(bad), bad).toBeNull();
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
