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
  ['POST', '/api/cases'], ['POST', '/api/cases/k1/advance'], ['POST', '/api/cases/k1/team'], ['GET', '/api/tax-engine/rule-sets/r1/coverage'], ['GET', '/api/tax-engine/cases/k1/research'], ['POST', '/api/tax-engine/cases/k1/research'],
  ['POST', '/api/tax-engine/research/m1/citations'], ['POST', '/api/tax-engine/research/m1/submit'], ['GET', '/api/tax-engine/cases/k1/diagnostics'], ['POST', '/api/tax-engine/cases/k1/diagnostics/run'], ['POST', '/api/tax-engine/diagnostics/d1/acknowledge'], ['GET', '/api/tax-engine/cases/k1/risk'], ['POST', '/api/tax-engine/cases/k1/risk'], ['GET', '/api/vault/review-queue'], ['POST', '/api/vault/clients/c1/documents/d1/versions/1/review'],
  ['GET', '/api/billing/catalog'], ['POST', '/api/billing/catalog'], ['POST', '/api/billing/clients/c1/invoices/i1/approve'], ['POST', '/api/billing/clients/c1/credits/r1/apply'],
  ['GET', '/api/communications/inbox'], ['GET', '/api/communications/clients/c1/threads'], ['GET', '/api/communications/clients/c1/threads/thr_1'],
  ['POST', '/api/communications/clients/c1/threads'], ['POST', '/api/communications/clients/c1/threads/thr_1/messages'], ['POST', '/api/communications/clients/c1/threads/thr_1/status'],
  ['GET', '/api/scheduling/schedule?from=a&to=b'], ['GET', '/api/scheduling/clients/c1/appointments'], ['POST', '/api/scheduling/clients/c1/appointments'],
  ['POST', '/api/scheduling/clients/c1/appointments/apt_1/reschedule'], ['POST', '/api/scheduling/clients/c1/appointments/apt_1/status'],
  ['GET', '/api/legal-matters/clients/c1/matters'], ['POST', '/api/legal-matters/clients/c1/matters/lgl_1/status'], ['POST', '/api/legal-matters/clients/c1/matters/lgl_1/documents'],
  ['GET', '/api/consultations/requests'], ['POST', '/api/consultations/requests/csr_1/decision'], ['POST', '/api/consultations/requests/csr_1/convert'],
  ['GET', '/api/client-portal/clients/c1/engagements'], ['GET', '/api/reassignment/queue'], ['POST', '/api/reassignment/queue/rar_1/review'],
  ['GET', '/api/stage-one/queue'], ['GET', '/api/stage-one/clients/c1'], ['POST', '/api/stage-one/clients/c1/decision']];

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
      ['POST', '/api/admin/users'], ['POST', '/api/efile/submit'], ['POST', '/api/book-to-tax/categories'], ['POST', '/api/tax-engine/research/m1/approve'], ['POST', '/api/tax-engine/research/m1/reject'], ['POST', '/api/tax-engine/cases/k1/diagnostics'], ['GET', '/api/tax-engine/cases/k1/diagnostics/run'], ['POST', '/api/tax-engine/diagnostics/d1/acknowledge/x'], ['GET', '/api/practice/clients/c1/../../admin'],
      ['GET', '/api/practice/clients/c1/engagements'], ['POST', '/api/practice/clients'], ['DELETE', '/api/practice/clients/c1'], ['POST', '/api/cases/report'],
      ['POST', '/api/vault/clients/c1/documents/d1/versions/x/review'], ['GET', '/api/operations/assignments'],
      ['POST', '/api/communications/inbox'], ['GET', '/api/communications/clients/c1/threads/thr_1/messages'], ['POST', '/api/communications/clients/c1/threads/thr_1/delete'],
      ['GET', '/api/audit-center/events'], ['POST', '/api/scheduling/schedule'], ['POST', '/api/scheduling/clients/c1/appointments/apt_1/delete'], ['POST', '/api/legal-matters/clients/c1/matters/lgl_1/sign'],
      ['POST', '/api/reassignment/clients/c1/requests'], ['POST', '/api/consultations/requests'], ['POST', '/api/public/consultation-requests'],
      // Stage 01: managers review and decide; they never edit or submit a client's onboarding.
      ['POST', '/api/stage-one/me'], ['POST', '/api/stage-one/me/submit'], ['POST', '/api/stage-one/queue'], ['GET', '/api/stage-one/clients/c1/decision'],
      ['POST', '/api/stage-one/clients/c1/../../me/submit']] as Array<[string, string]>)
      expect(allowed(m, p), `${m} ${p}`).toBe(false);
    expect(practiceManagerRequestAllowed('accountant', 'POST', '/api/bookkeeping/journal-entries')).toBe(true);
  });
});
