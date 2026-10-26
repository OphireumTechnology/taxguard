import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { clearStoredToken, setStoredToken } from '../services/api';
import { dollarsToCents, RISK_REASON_LABELS, TaxEngineRequestError, taxEngineMessage, taxEngineService } from '../services/taxEngineService';
import { CaseReadinessPanel } from '../components/workspace/CaseReadinessPanel';

const transport = vi.fn();
beforeEach(() => { transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('case readiness and risk browser client and panel', () => {
  it('relays diagnostics and risk requests to the case-scoped routes, sending no AI confidence', async () => {
    await taxEngineService.caseDiagnostics('case/1');
    await taxEngineService.runDiagnostics('case-1');
    await taxEngineService.acknowledgeDiagnostic('d-1', 'Synthetic acknowledgement note');
    await taxEngineService.caseRisk('case-1');
    await taxEngineService.assessRisk('case-1', 12345, true);
    const calls = transport.mock.calls.map(([url, init]) => [url.replace('http://127.0.0.1:3000/api/tax-engine', ''), init.method, init.body ? JSON.parse(init.body) : undefined]);
    expect(calls).toEqual([
      ['/cases/case%2F1/diagnostics', 'GET', undefined],
      ['/cases/case-1/diagnostics/run', 'POST', {}],
      ['/diagnostics/d-1/acknowledge', 'POST', { note: 'Synthetic acknowledgement note' }],
      ['/cases/case-1/risk', 'GET', undefined],
      ['/cases/case-1/risk', 'POST', { amountCents: 12345, unsupportedPosition: true }],
    ]);
  });

  it('converts a stated dollar amount to integer cents and refuses anything else', () => {
    expect(dollarsToCents('1250')).toBe(125000);
    expect(dollarsToCents(' 12.5 ')).toBe(1250);
    expect(dollarsToCents('0.07')).toBe(7);
    expect(dollarsToCents('0')).toBe(0);
    for (const bad of ['', '-1', '1.234', '1e3', '1,000', '$5', 'abc', '12345678901234']) expect(dollarsToCents(bad), bad).toBeNull();
  });

  it('explains every risk reason and the refusals in plain language', () => {
    for (const code of ['DIAGNOSTICS_NOT_RUN', 'DIAGNOSTIC_BLOCKING', 'DIAGNOSTIC_ERRORS', 'NO_APPROVED_MATERIALITY_POLICY', 'AMOUNT_MATERIAL',
      'AI_CONFIDENCE_BELOW_POLICY', 'POLICY_REQUIRES_HUMAN_REVIEW', 'UNSUPPORTED_POSITION']) expect(RISK_REASON_LABELS[code], code).toMatch(/\.$/);
    expect(taxEngineMessage(new TaxEngineRequestError(409, 'DIAGNOSTIC_NOT_WAIVABLE'))).toMatch(/cannot be acknowledged/);
    expect(taxEngineMessage(new TaxEngineRequestError(403, 'DIAGNOSTIC_REVIEWER_REQUIRED'))).toMatch(/reviewer or a practice manager/);
    expect(taxEngineMessage(new TaxEngineRequestError(404, 'DIAGNOSTIC_NOT_FOUND'))).toMatch(/live assignment/);
    expect(taxEngineMessage(new TaxEngineRequestError(400, 'RISK_INPUT_INVALID'))).toMatch(/dollars and cents/);
  });

  it('states that readiness and risk never make a return usable, and offers no AI confidence input', () => {
    const html = renderToStaticMarkup(<CaseReadinessPanel caseId="case-1" taxYear={2025} />);
    expect(html).toContain('Readiness and risk');
    expect(html).toContain('return use: BLOCKED');
    expect(html).toContain('Record risk assessment');
    expect(html).not.toMatch(/confidence/i);
  });
});
