import { afterEach, describe, expect, it, vi } from 'vitest';
import { practiceManagerRequestAllowed } from '../server/practiceManagerAccess';

// Found by the browser E2E suite: without these entries the Practice Manager modules backed by the
// durable routers were refused by the global capability list. They open only while the
// development-only durable store is configured, endpoint by endpoint.
const configure = () => { vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', 'durable');
  vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-test-key'); };
afterEach(() => { vi.unstubAllEnvs(); });
const allowed = (method: string, path: string) => practiceManagerRequestAllowed('practice_manager', method, path);
const OPEN: Array<[string, string]> = [['GET', '/api/practice/clients'], ['GET', '/api/practice/clients/c1'], ['POST', '/api/practice/clients/c1/engagements'],
  ['POST', '/api/practice/clients/c1/engagements/e1/team'], ['POST', '/api/practice/clients/c1/team/a1/revoke'], ['GET', '/api/cases?role=reviewer'], ['GET', '/api/cases/?role=reviewer'], ['GET', '/api/cases/report'],
  ['POST', '/api/cases'], ['POST', '/api/cases/k1/advance'], ['GET', '/api/vault/review-queue'], ['POST', '/api/vault/clients/c1/documents/d1/versions/1/review'],
  ['GET', '/api/billing/catalog'], ['POST', '/api/billing/catalog'], ['POST', '/api/billing/clients/c1/invoices/i1/approve'], ['POST', '/api/billing/clients/c1/credits/r1/apply']];

describe('practice manager durable capability list', () => {
  it('keeps every durable endpoint closed when the durable store is not configured', () => {
    vi.stubEnv('TAXGUARD_PRACTICE_STORE', '');
    for (const [m, p] of OPEN) expect(allowed(m, p), `${m} ${p}`).toBe(false);
  });
  it('is closed in production even with the store variables present', () => {
    configure(); vi.stubEnv('NODE_ENV', 'production');
    for (const [m, p] of OPEN) expect(allowed(m, p), `${m} ${p}`).toBe(false);
  });
  it('refuses the protected production project', () => {
    configure(); vi.stubEnv('SUPABASE_URL', 'https://cvrlhixxczerytiocxid.supabase.co');
    for (const [m, p] of OPEN) expect(allowed(m, p), `${m} ${p}`).toBe(false);
  });
  it('opens the listed manager endpoints with the durable store configured', () => {
    configure();
    for (const [m, p] of OPEN) expect(allowed(m, p), `${m} ${p}`).toBe(true);
  });
  it('never opens the ledger, administration, card payment, method mismatches or traversal', () => {
    configure();
    for (const [m, p] of [['POST', '/api/bookkeeping/journal-entries'], ['GET', '/api/bookkeeping/work-queue'], ['POST', '/api/billing/clients/c1/invoices/i1/pay-sandbox'],
      ['POST', '/api/admin/users'], ['POST', '/api/efile/submit'], ['POST', '/api/book-to-tax/categories'], ['GET', '/api/practice/clients/c1/../../admin'],
      ['GET', '/api/practice/clients/c1/engagements'], ['POST', '/api/practice/clients'], ['DELETE', '/api/practice/clients/c1'], ['POST', '/api/cases/report'],
      ['POST', '/api/vault/clients/c1/documents/d1/versions/x/review'], ['GET', '/api/operations/assignments']] as Array<[string, string]>)
      expect(allowed(m, p), `${m} ${p}`).toBe(false);
    expect(practiceManagerRequestAllowed('accountant', 'POST', '/api/bookkeeping/journal-entries')).toBe(true);
  });
});
