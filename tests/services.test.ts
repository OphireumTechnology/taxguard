/**
 * Browser service clients against their real server contracts.
 *
 * The previous version of this file asserted behaviour of offline stubs (demo records returned with no server,
 * `idem_`-style keys, a `getCollectionStatus` that always reported completion). Those stubs were replaced by the
 * durable clients, which call the API with the signed-in session. Each test below keeps the purpose of the test it
 * replaces and checks the client against the contract it actually implements: the exact request it sends, that it
 * refuses to call without a session, that a response arriving after a session change is discarded, and that server
 * refusals keep their codes. `fetch` is stubbed with synthetic responses; no network is used and no data is real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearStoredToken, setStoredToken } from '../src/services/api';
import { bookkeepingService, BookkeepingRequestError } from '../src/services/bookkeepingService';
import { bookToTaxApi, bookToTaxMessage, centsText, newB2tKey, BookToTaxRequestError } from '../src/services/bookToTaxService';
import { jobService, jobActions, jobMessage, JobRequestError, JOB_STATUSES } from '../src/services/jobService';
import { clientPortalContracts, portalErrorMessage, PortalContractError } from '../src/services/clientPortalContracts';
import { submitWaiverClaim } from '../src/services/collectionClient';
import * as collectionClientModule from '../src/services/collectionClient';
import * as billingModule from '../src/services/billingApiService';
import { billingApi, billingMessage, newBillingKey, BillingRequestError } from '../src/services/billingApiService';

const TOKEN = 'synthetic-session-token';
type Call = { url: string; method: string; headers: Record<string, string>; body: any };
let calls: Call[] = [];

/** Stubs fetch with a handler that sees each request and returns a synthetic JSON response. */
function serve(handler: (call: Call) => { status?: number; body?: unknown; onSend?: () => void }) {
  vi.stubGlobal('fetch', vi.fn(async (input: string, init: RequestInit = {}) => {
    const call: Call = { url: String(input), method: init.method || 'GET', headers: { ...(init.headers as Record<string, string> || {}) },
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const { status = 200, body = {}, onSend } = handler(call);
    onSend?.();
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }));
}
const pathOf = (url: string) => new URL(url, 'http://synthetic.invalid').pathname;
const queryOf = (url: string) => Object.fromEntries(new URL(url, 'http://synthetic.invalid').searchParams);
const UUID_SUFFIX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeEach(() => { calls = []; setStoredToken(TOKEN); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('Bookkeeping Service Module', () => {
  it('generates unique idempotency keys with proper prefix', () => {
    const keys = new Set(Array.from({ length: 50 }, () => bookkeepingService.newIdempotencyKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(new RegExp('^ui-' + UUID_SUFFIX.source));
  });

  it('fetches chart of accounts with active accounts and correct balances', async () => {
    const accounts = [{ id: 'acct-1', accountNumber: '1010', accountName: 'Operating Cash', accountType: 'ASSET', isActive: true, balance: 0 }];
    serve(() => ({ body: { accounts } }));
    const res = await bookkeepingService.getChartOfAccounts('client_1', 2025);
    expect(res.accounts).toEqual(accounts);
    expect(pathOf(calls[0].url)).toBe('/api/bookkeeping/chart-of-accounts');
    expect(queryOf(calls[0].url)).toEqual({ clientId: 'client_1', taxYear: '2025' });
    expect(calls[0].headers.Authorization).toBe('Bearer ' + TOKEN);
    // A refusal is not turned into an empty chart.
    serve(() => ({ status: 403, body: { code: 'LEDGER_ACCESS_DENIED' } }));
    await expect(bookkeepingService.getChartOfAccounts('client_1', 2025)).rejects.toThrow('Failed to load chart of accounts');
  });

  it('loads work queue with categorizations and periods', async () => {
    const queue = { periods: [{ id: 'p1', periodName: '2025-Q1', status: 'OPEN' }], uncategorized: [{ id: 't1' }] };
    serve(() => ({ body: queue }));
    expect(await bookkeepingService.getWorkQueue('client_1', 2025)).toEqual(queue);
    expect(pathOf(calls[0].url)).toBe('/api/bookkeeping/work-queue');
    expect(queryOf(calls[0].url)).toEqual({ clientId: 'client_1', taxYear: '2025' });
    expect(calls[0].headers.Authorization).toBe('Bearer ' + TOKEN);
    serve(() => ({ status: 503, body: { code: 'LEDGER_STORE_UNAVAILABLE' } }));
    await expect(bookkeepingService.getWorkQueue('client_1', 2025)).rejects.toMatchObject({ status: 503, code: 'LEDGER_STORE_UNAVAILABLE' });
  });

  it('provides balanced trial balance records', async () => {
    // The client reports the server's totals unchanged; it computes no balance of its own.
    const unbalanced = { trialBalance: { isBalanced: false, totalDebit: 100, totalCredit: 90, rows: [] } };
    serve(() => ({ body: unbalanced }));
    const tb = await bookkeepingService.getTrialBalance('client_1', 2025);
    expect(tb).toEqual(unbalanced);
    expect(pathOf(calls[0].url)).toBe('/api/bookkeeping/trial-balance');
    expect(queryOf(calls[0].url)).toMatchObject({ clientId: 'client_1', taxYear: '2025' });
  });

  it('handles period lifecycle operations cleanly', async () => {
    serve(call => ({ body: { period: { id: 'period-3', periodName: call.body.periodName ?? '2025-Q3', status: call.body.status ?? 'OPEN' } } }));
    const opened = await bookkeepingService.openPeriod('client_1', 2025, '2025-Q3', '2025-07-01', '2025-09-30');
    expect(opened.period).toMatchObject({ periodName: '2025-Q3', status: 'OPEN' });
    await bookkeepingService.closePeriod('client_1', 2025, 'period-3', 'SOFT_CLOSED');
    await bookkeepingService.reopenPeriod('client_1', 2025, 'period-3', 'Prior period adjustment justification');
    expect(calls.map(c => [c.method, pathOf(c.url)])).toEqual([
      ['POST', '/api/bookkeeping/periods'], ['POST', '/api/bookkeeping/periods/period-3/close'], ['POST', '/api/bookkeeping/periods/period-3/reopen']]);
    expect(calls[0].body).toEqual({ clientId: 'client_1', taxYear: 2025, periodName: '2025-Q3', startDate: '2025-07-01', endDate: '2025-09-30' });
    expect(calls[1].body).toEqual({ clientId: 'client_1', taxYear: 2025, status: 'SOFT_CLOSED' });
    expect(calls[2].body).toEqual({ clientId: 'client_1', taxYear: 2025, reason: 'Prior period adjustment justification' });
    // A server refusal (for example unapproved entries in the period) keeps its code.
    serve(() => ({ status: 409, body: { code: 'PERIOD_HAS_UNAPPROVED_ENTRIES', error: 'Period has unapproved entries.' } }));
    await expect(bookkeepingService.closePeriod('client_1', 2025, 'period-3', 'HARD_CLOSED'))
      .rejects.toMatchObject({ status: 409, code: 'PERIOD_HAS_UNAPPROVED_ENTRIES', message: 'Period has unapproved entries.' });
  });

  it('instantiates BookkeepingRequestError with status and code', async () => {
    const err = new BookkeepingRequestError('Maker-checker violation', 403, 'MAKER_CHECKER_VIOLATION');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BookkeepingRequestError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('MAKER_CHECKER_VIOLATION');
    // The same error is what a maker-checker refusal from the server produces.
    serve(() => ({ status: 403, body: { code: 'MAKER_CHECKER_VIOLATION', error: 'A different reviewer must approve this entry.' } }));
    const thrown = await bookkeepingService.approveJournalEntry('client_1', 2025, 'je-1', 4).catch(e => e);
    expect(thrown).toBeInstanceOf(BookkeepingRequestError);
    expect(thrown).toMatchObject({ status: 403, code: 'MAKER_CHECKER_VIOLATION' });
    expect(calls[0].body).toEqual({ clientId: 'client_1', taxYear: 2025, version: 4 });
  });
});

describe('Book-to-Tax Service Module', () => {
  it('formats cents values into localized currency strings', () => {
    expect(centsText(1540000)).toBe('$15,400.00');
    expect(centsText(-250000)).toBe('-$2,500.00');
    expect(centsText(0)).toBe('$0.00');
  });

  it('generates unique b2t idempotency keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newB2tKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(new RegExp('^b2t-' + UUID_SUFFIX.source));
  });

  it('loads return family categories for tax classification', async () => {
    const items = [{ categoryCode: 'EXP_MEALS', label: 'Business Meals (50%)' }];
    serve(() => ({ body: { items } }));
    expect(await bookToTaxApi.categories('1120S')).toEqual({ items });
    expect([calls[0].method, pathOf(calls[0].url)]).toEqual(['GET', '/api/book-to-tax/categories/1120S']);
    expect(calls[0].headers.Authorization).toBe('Bearer ' + TOKEN);
    // Without a session nothing is requested.
    clearStoredToken(); calls = [];
    await expect(bookToTaxApi.categories('1120S')).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });
    expect(calls).toEqual([]);
  });

  it('loads overview with approved mapping sets and workpaper reconciliation', async () => {
    const overview = { mappingSets: [{ setId: 's1', status: 'APPROVED' }], adjustments: [], workpapers: [{ workpaperId: 'w1', reconciled: false, unmappedAccounts: 2 }] };
    serve(() => ({ body: overview }));
    expect(await bookToTaxApi.overview('client 1', 2025, '1120S')).toEqual(overview);
    expect(pathOf(calls[0].url)).toBe('/api/book-to-tax/clients/client%201/2025/1120S');
    // Refusals keep their code and map to the reviewed message; a response after a session change is discarded.
    serve(() => ({ status: 409, body: { code: 'WORKPAPER_NOT_RECONCILED' } }));
    const refusal = await bookToTaxApi.reviewWorkpaper('client_1', 'w1', true).catch(e => e);
    expect(refusal).toBeInstanceOf(BookToTaxRequestError);
    expect(bookToTaxMessage(refusal)).toBe('Map every account with activity before approving the workpaper.');
    serve(() => ({ body: overview, onSend: () => setStoredToken('synthetic-other-session') }));
    await expect(bookToTaxApi.overview('client_1', 2025, '1120S')).rejects.toMatchObject({ status: 409, code: 'SESSION_CHANGED' });
  });
});

describe('Durable Job Queue Service Module', () => {
  it('correctly maps job actions according to lifecycle status', () => {
    // As taxguard_job_retry / taxguard_job_cancel enforce them (proposal 20261019240000): retry only from FAILED or
    // DEAD_LETTER; cancel from any status except COMPLETED (a CANCELLED job has nothing left to cancel).
    const expected: Record<string, { retry: boolean; cancel: boolean }> = {
      PENDING: { retry: false, cancel: true }, CLAIMED: { retry: false, cancel: true }, RUNNING: { retry: false, cancel: true },
      RETRY_SCHEDULED: { retry: false, cancel: true }, COMPLETED: { retry: false, cancel: false }, FAILED: { retry: true, cancel: true },
      DEAD_LETTER: { retry: true, cancel: true }, CANCELLED: { retry: false, cancel: false },
    };
    expect([...JOB_STATUSES].sort()).toEqual(Object.keys(expected).sort());
    for (const status of JOB_STATUSES) expect(jobActions(status), status).toEqual(expected[status]);
  });

  it('lists recorded jobs with filtering support', async () => {
    const jobs = [{ id: 'job-1', jobType: 'OCR_EXTRACTION', status: 'FAILED' }];
    serve(() => ({ body: { total: 1, jobs } }));
    expect(await jobService.list({ status: 'FAILED', clientId: 'client_1', limit: 25 })).toEqual({ total: 1, jobs });
    expect(pathOf(calls[0].url)).toBe('/api/jobs');
    expect(queryOf(calls[0].url)).toEqual({ status: 'FAILED', clientId: 'client_1', limit: '25' });
    expect(calls[0].headers.Authorization).toBe('Bearer ' + TOKEN);
    await jobService.list();
    expect(calls[1].url.endsWith('/api/jobs')).toBe(true);
    // Scope refusals keep their code and reviewed message.
    serve(() => ({ status: 403, body: { code: 'JOB_SCOPE_REQUIRED' } }));
    const refusal = await jobService.list().catch(e => e);
    expect(refusal).toBeInstanceOf(JobRequestError);
    expect(jobMessage(refusal)).toBe('Listing every job of the practice is for administrators only.');
  });
});

describe('Client Portal Contracts Module', () => {
  it('retrieves active client engagements for specified tax year', async () => {
    const items = [{ engagementId: 'eng_2025_01', title: 'Synthetic 2025 return', type: 'INDIVIDUAL', engagementStatus: 'ACTIVE', taxYear: 2025, yearStatus: 'OPEN', caseStatus: 'ACTIVE', activeStage: 4 }];
    serve(() => ({ body: { items } }));
    expect(await clientPortalContracts.engagements('client_1')).toEqual({ items });
    expect(pathOf(calls[0].url)).toBe('/api/client-portal/clients/client_1/engagements');
    expect(calls[0].headers.Authorization).toBe('Bearer ' + TOKEN);
    clearStoredToken(); calls = [];
    await expect(clientPortalContracts.engagements('client_1')).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });
    expect(calls).toEqual([]);
  });

  it('returns structured case stages and system checks', async () => {
    const stages = { engagementId: 'eng_2025_01', taxYear: 2025, caseExists: true, caseStatus: 'ACTIVE', activeStage: 4, updatedAt: '2026-01-01T00:00:00Z',
      activeStagePolicy: { evidence: 'SYSTEM_VERIFIED', checklist: ['Synthetic check'] }, activeStageChecks: { syntheticCheck: false },
      stages: Array.from({ length: 8 }, (_, i) => ({ stage: i + 1, status: i < 3 ? 'COMPLETED' : i === 3 ? 'IN_PROGRESS' : 'LOCKED', completedAt: null })),
      evidence: { verifiedDocuments: 0, documentsInReview: 0, documentsNeedingAction: 0, openDocumentRequests: 0 },
      team: { preparerAssigned: true, reviewerAssigned: false, independentReview: false } };
    serve(() => ({ body: stages }));
    expect(await clientPortalContracts.caseStages('client_1', 'eng_2025_01', 2025)).toEqual(stages);
    expect(pathOf(calls[0].url)).toBe('/api/client-portal/clients/client_1/case-stages');
    expect(queryOf(calls[0].url)).toEqual({ engagementId: 'eng_2025_01', taxYear: '2025' });
    // The browser never infers progression: a response outside the contract is refused, not displayed.
    for (const invalid of [{ ...stages, stages: [{ stage: 19, status: 'COMPLETED' }] }, { ...stages, activeStage: 'four' }, { caseExists: true }]) {
      serve(() => ({ body: invalid }));
      await expect(clientPortalContracts.caseStages('client_1', 'eng_2025_01', 2025)).rejects.toMatchObject({ status: 502, code: 'INVALID_PORTAL_RESPONSE' });
    }
    serve(() => ({ body: { engagementId: 'eng_2025_01', taxYear: 2025, caseExists: false } }));
    expect(await clientPortalContracts.caseStages('client_1', 'eng_2025_01', 2025)).toEqual({ engagementId: 'eng_2025_01', taxYear: 2025, caseExists: false });
  });

  it('formats portal error messages gracefully', () => {
    // Internal error text is never shown to the client; only reviewed messages are.
    expect(portalErrorMessage(new Error('Network request failed'))).toBe('The portal could not load this information. Try again.');
    expect(portalErrorMessage(null)).toBe('The portal could not load this information. Try again.');
    expect(portalErrorMessage(new PortalContractError(401, 'AUTH_REQUIRED'))).toBe('Your session has ended or changed. Sign in again.');
    expect(portalErrorMessage(new PortalContractError(409, 'SESSION_CHANGED'))).toBe('Your session has ended or changed. Sign in again.');
    expect(portalErrorMessage(new PortalContractError(403, 'PORTAL_ACCESS_DENIED'))).toBe('This information is not available for your account.');
    expect(portalErrorMessage(new PortalContractError(404, 'NOT_FOUND'))).toBe('This information is not available for your account.');
    expect(portalErrorMessage(new PortalContractError(503, 'PORTAL_STORE_UNAVAILABLE'))).toBe('This information is not enabled in this environment.');
  });
});

describe('Document Collection Client Module', () => {
  const record = { clientId: 'client_1', taxYear: 2025, engagementId: 'eng_2025_01', questionnaire: { version: 3 },
    requirements: [{ id: 'req_1099_div', requirementCode: '1099_DIV' }] };
  const reason = 'Taxpayer does not hold dividend brokerage accounts in 2025';

  it('exposes collection client status and submission hooks', async () => {
    // There is no local collection status: the module exposes only the server-backed waiver claim, and a claim
    // without a session fails before any request.
    expect(Object.keys(collectionClientModule)).toEqual(['submitWaiverClaim']);
    clearStoredToken();
    serve(() => ({ body: {} }));
    await expect(submitWaiverClaim('client_1', 2025, 'req_1099_div', reason)).rejects.toThrow('AUTH_REQUIRED');
    expect(calls).toEqual([]);
  });

  it('handles waiver claim submissions cleanly', async () => {
    const accepted = { success: true, requiresProfessionalReview: true, status: 'CLAIM_PENDING', claimId: 'claim-1' };
    serve(call => (call.method === 'GET' ? { body: record } : { body: accepted }));
    expect(await submitWaiverClaim('client_1', 2025, 'req_1099_div', reason)).toEqual(accepted);
    const post = calls.find(c => c.method === 'POST')!;
    expect(pathOf(post.url)).toBe('/api/stage-two-three/requirements/2025/1099_DIV/not-applicable');
    expect(post.headers.Authorization).toBe('Bearer ' + TOKEN);
    expect(post.body).toEqual({ clientId: 'client_1', engagementId: 'eng_2025_01', revision: 3, reason });
    // A claim is never a waiver: a response that does not leave it pending professional review is refused.
    serve(call => (call.method === 'GET' ? { body: record } : { body: { success: true, status: 'WAIVED' } }));
    await expect(submitWaiverClaim('client_1', 2025, 'req_1099_div', reason)).rejects.toThrow('COLLECTION_RESPONSE_INVALID');
    // An unknown requirement, or a record of another client, is refused before anything is posted.
    calls = [];
    serve(call => (call.method === 'GET' ? { body: record } : { body: accepted }));
    await expect(submitWaiverClaim('client_1', 2025, 'req_unknown', reason)).rejects.toThrow('COLLECTION_REQUIREMENT_NOT_FOUND');
    serve(call => (call.method === 'GET' ? { body: { ...record, clientId: 'client_2' } } : { body: accepted }));
    await expect(submitWaiverClaim('client_1', 2025, 'req_1099_div', reason)).rejects.toThrow('COLLECTION_SCOPE_REQUIRED');
    expect(calls.filter(c => c.method === 'POST')).toEqual([]);
  });
});

describe('Billing API Service Module', () => {
  it('generates unique billing transaction keys', () => {
    const keys = new Set(Array.from({ length: 50 }, () => newBillingKey()));
    expect(keys.size).toBe(50);
    for (const key of keys) expect(key).toMatch(new RegExp('^bill-' + UUID_SUFFIX.source));
  });

  it('retrieves client invoices and accounts receivable aging', async () => {
    // The billing client is `billingApi`; there is no separate offline `billingApiService` export.
    expect('billingApiService' in billingModule).toBe(false);
    const clients = [{ clientId: 'c1', clientName: 'Synthetic Client', totalDue: '100.00', current: '100.00', days1to30: '0.00', days31to60: '0.00', days61to90: '0.00', over90: '0.00', openInvoices: 1 }];
    serve(() => ({ body: { asOf: '2026-01-31', pendingApproval: 0, clients } }));
    expect((await billingApi.aging('2026-01-31')).clients).toEqual(clients);
    expect(pathOf(calls[0].url)).toBe('/api/billing/ar-aging');
    expect(queryOf(calls[0].url)).toEqual({ asOf: '2026-01-31' });

    // Invoices are read page by page until the server's cursor ends.
    calls = [];
    serve(call => (queryOf(call.url).cursor
      ? { body: { items: [{ invoiceId: 'inv-2', invoiceNumber: 'INV-0002' }], nextCursor: null } }
      : { body: { items: [{ invoiceId: 'inv-1', invoiceNumber: 'INV-0001' }], nextCursor: 'page-2' } }));
    expect((await billingApi.invoices('c1')).items.map(i => i.invoiceNumber)).toEqual(['INV-0001', 'INV-0002']);
    expect(calls.map(c => pathOf(c.url))).toEqual(['/api/billing/clients/c1/invoice-pages', '/api/billing/clients/c1/invoice-pages']);
    expect(queryOf(calls[1].url)).toEqual({ limit: '100', cursor: 'page-2' });
    // A repeated invoice across pages is refused, not shown twice.
    serve(() => ({ body: { items: [{ invoiceId: 'inv-1' }], nextCursor: 'again' } }));
    await expect(billingApi.invoices('c1')).rejects.toMatchObject({ status: 503, code: 'BILLING_RESPONSE_INVALID' });
    // Refusals keep their code; a missing session sends nothing.
    serve(() => ({ status: 403, body: { code: 'BILLING_ACCESS_DENIED' } }));
    const refusal = await billingApi.aging().catch(e => e);
    expect(refusal).toBeInstanceOf(BillingRequestError);
    expect(billingMessage(refusal)).toBe('You are not authorized for this billing record.');
    clearStoredToken(); calls = [];
    await expect(billingApi.aging()).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });
    expect(calls).toEqual([]);
  });
});
