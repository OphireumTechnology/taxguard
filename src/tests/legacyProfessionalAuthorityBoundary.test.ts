import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { requireMakerChecker, requirePractitionerAuthority } from '../server/auth';
import { db } from '../server/db';
beforeEach(() => { vi.stubEnv('NODE_ENV', 'test'); vi.spyOn(db, 'logSecurityEvent').mockImplementation(() => undefined as never); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function invoke(handler: any, role = 'reviewer', patch = {}) {
  const req = { user: { id: 'reviewer', role, status: 'active', credentials: ['CPA'], ...patch }, body: { preparerId: 'other' }, query: {}, ip: '127.0.0.1' };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() }; const next = vi.fn();
  handler(req, res, next); return { req, res, next };
}
it.each(['client', 'bookkeeper', 'accountant', 'operations', 'practice_manager', 'reviewer', 'senior_reviewer', 'admin', 'unknown'])('does not invent practitioner approval from %s or claimed credentials', role => {
  const result = invoke(requirePractitionerAuthority, role);
  expect(result.res.status).toHaveBeenCalledWith(403); expect(result.next).not.toHaveBeenCalled();
});
it('requires authentication before practitioner or maker-checker evaluation', () => {
  for (const handler of [requirePractitionerAuthority, requireMakerChecker(() => 'other')]) {
    const result = invoke(handler, 'reviewer', { id: undefined });
    expect(result.next).not.toHaveBeenCalled();
    // Missing user is distinct from malformed user; both never authorize.
    handler({ user: undefined } as any, result.res as any, result.next);
    expect(result.res.status).toHaveBeenCalledWith(401);
  }
});
it('does not trust caller-supplied preparer IDs without a server resolver', () => {
  const result = invoke(requireMakerChecker()); expect(result.res.json).toHaveBeenCalledWith({ code: 'MAKER_CHECKER_CONTEXT_REQUIRED' }); expect(result.next).not.toHaveBeenCalled();
});
it.each(['client', 'bookkeeper', 'operations', 'practice_manager', 'unknown'])('refuses %s maker-checker role even with server-resolved preparer', role => {
  const result = invoke(requireMakerChecker(() => 'other'), role); expect(result.next).not.toHaveBeenCalled(); expect(result.res.status).toHaveBeenCalledWith(403);
});
it('refuses missing context, dependency failure and inactive reviewer', () => {
  for (const handler of [requireMakerChecker(() => undefined), requireMakerChecker(() => { throw new Error('private'); })]) expect(invoke(handler).next).not.toHaveBeenCalled();
  expect(invoke(requireMakerChecker(() => 'other'), 'reviewer', { status: 'suspended' }).next).not.toHaveBeenCalled();
});
it('refuses self review', () => expect(invoke(requireMakerChecker(() => 'reviewer')).next).not.toHaveBeenCalled());
it('preserves synthetic independent reviewer behavior without certifying professional credentials', () => {
  expect(invoke(requireMakerChecker(() => 'other')).next).toHaveBeenCalledOnce();
});
it('refuses legacy maker-checker in production even for independent reviewer', () => {
  vi.stubEnv('NODE_ENV', 'production'); const result = invoke(requireMakerChecker(() => 'other'));
  expect(result.res.json).toHaveBeenCalledWith({ code: 'DURABLE_MAKER_CHECKER_REQUIRED' }); expect(result.next).not.toHaveBeenCalled();
});
