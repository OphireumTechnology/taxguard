import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientServiceCase } from '../types/clientServiceDashboard';

const harness = vi.hoisted(() => ({ state: undefined as any, deps: undefined as unknown[] | undefined,
  cleanup: undefined as (() => void) | undefined, conversation: vi.fn(), request: vi.fn(), search: vi.fn(),
}));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    if (harness.state === undefined) harness.state = initial;
    return [harness.state, (next: unknown) => { harness.state = next; }];
  },
  useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
    if (!harness.deps || deps.some((value, i) => !Object.is(value, harness.deps![i]))) {
      harness.cleanup?.(); harness.deps = deps; harness.cleanup = effect();
    }
  },
}));
vi.mock('../services/api', () => ({ getStoredToken: () => 'unused', api: { clientService: {
  conversation: harness.conversation, requestDetail: harness.request, search: harness.search,
} } }));
import { useClientServiceDetail, useClientServiceSearch } from '../hooks/useClientServiceDashboardData';

const selected = { id: 'case-a', clientId: 'client-a', engagementId: 'engagement-a', taxYear: 2024 } as ClientServiceCase;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => {
  harness.cleanup?.(); harness.state = undefined; harness.deps = undefined; harness.cleanup = undefined;
  harness.conversation.mockReset(); harness.request.mockReset(); harness.search.mockReset();
  harness.conversation.mockResolvedValue({ tenantId: 'tenant-a', caseKey: selected.id, threadId: 'content-a', messages: [] });
  harness.request.mockResolvedValue({ tenantId: 'tenant-a', caseKey: selected.id, requestId: 'content-a', title: 'Authorized instructions', status: 'OPEN' });
  harness.search.mockResolvedValue({ tenantId: 'tenant-a', matches: [selected] });
});
afterEach(() => { harness.cleanup?.(); vi.useRealTimers(); });

describe.each(['conversation', 'request'] as const)('selected %s isolation', kind => {
  const reads = () => kind === 'conversation' ? harness.conversation : harness.request;
  const render = (tenant: string | undefined = 'tenant-a', row: ClientServiceCase | undefined = selected, id = 'content-a', session = 'session-a') =>
    useClientServiceDetail(tenant, session, row, kind, id, 0);
  it.each(['tenant', 'selection', 'content'])('clears cache across missing %s and refreshes on recovery', async missing => {
    render(); await settle(); expect(render().data).not.toBeNull();
    // Use explicit undefined directly for missing selection because render defaults apply.
    const denied = useClientServiceDetail(missing === 'tenant' ? undefined : 'tenant-a', 'session-a', missing === 'selection' ? undefined : selected, kind, missing === 'content' ? '' : 'content-a', 0);
    expect(denied.data).toBeNull(); expect(reads().mock.calls[0][3].aborted).toBe(true);
    expect(render().data).toBeNull(); expect(reads()).toHaveBeenCalledTimes(2);
    await settle(); expect(render().data).not.toBeNull();
  });
  it('invalidates same-ID data when client or engagement association changes', async () => {
    render(); await settle();
    expect(render('tenant-a', { ...selected, engagementId: 'engagement-b' }).data).toBeNull();
    await settle(); expect(render('tenant-a', { ...selected, clientId: 'client-b', engagementId: 'engagement-b' }).data).toBeNull();
    expect(reads()).toHaveBeenCalledTimes(3);
  });
  it.each(['success', 'failure'])('suppresses late old-session %s', async outcome => {
    let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
    reads().mockImplementationOnce(() => new Promise((yes, no) => { resolve = yes; reject = no; }));
    render(); render('tenant-a', selected, '', 'session-b');
    if (outcome === 'success') resolve({ tenantId: 'tenant-a', caseKey: selected.id, threadId: 'content-a', requestId: 'content-a' });
    else reject(new Error('old session'));
    await settle(); expect(render('tenant-a', selected, '', 'session-b').data).toBeNull();
    expect(render('tenant-a', selected, 'content-a', 'session-b').data).toBeNull();
  });
  it('rejects a response with a different selected content identity', async () => {
    reads().mockResolvedValue({ tenantId: 'tenant-a', caseKey: selected.id, threadId: 'other', requestId: 'other' });
    render(); await settle(); expect(render().status).toBe('error'); expect(render().data).toBeNull();
  });
});

describe('client service search isolation', () => {
  const render = (allowed = true, tenant: string | undefined = 'tenant-a', year = '2024', query = 'client', session = 'session-a') =>
    useClientServiceSearch(allowed, tenant, session, query, year, 0);
  const searchNow = async () => { await vi.advanceTimersByTimeAsync(250); await settle(); };
  beforeEach(() => vi.useFakeTimers());
  it('clears matches on access denial and requires a fresh debounced read on recovery', async () => {
    render(); await searchNow(); expect(render().matches).toEqual([selected]);
    expect(render(false).matches).toEqual([]); expect(harness.search.mock.calls[0][2].aborted).toBe(true);
    expect(render().matches).toEqual([]); await searchNow(); expect(render().matches).toEqual([selected]);
    expect(harness.search).toHaveBeenCalledTimes(2);
  });
  it.each(['bad', '2021', '2201', '2024.0'])('does not send a search for invalid year %s', async year => {
    expect(render(true, 'tenant-a', year).valid).toBe(false);
    await searchNow(); expect(harness.search).not.toHaveBeenCalled();
  });
  it('requires tenant context and cancels a pending debounce when access is denied', async () => {
    expect(useClientServiceSearch(true, undefined, 'session-a', 'client', '2024', 0).valid).toBe(false);
    render(); render(false); await searchNow(); expect(harness.search).not.toHaveBeenCalled();
  });
  it('rejects cross-year search responses', async () => {
    harness.search.mockResolvedValue({ tenantId: 'tenant-a', matches: [{ ...selected, taxYear: 2023 }] });
    render(); await searchNow(); expect(render().status).toBe('error'); expect(render().matches).toEqual([]);
  });
  it('does not reuse a query after it becomes too short', async () => {
    render(); await searchNow(); render(true, 'tenant-a', '2024', 'x');
    expect(render().matches).toEqual([]); await searchNow(); expect(harness.search).toHaveBeenCalledTimes(2);
  });
});
