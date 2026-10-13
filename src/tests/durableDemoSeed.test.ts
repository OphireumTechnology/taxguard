import { afterEach, describe, expect, it, vi } from 'vitest';

// A durable deployment must never present the in-memory demonstration records as operational data.
const load = async (store: string) => {
  vi.resetModules(); vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_PRACTICE_STORE', store);
  return (await import('../server/db')).db;
};
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('in-memory demonstration seed', () => {
  it('is absent when the durable practice store is configured; public catalog content remains', async () => {
    const db = await load('durable');
    for (const collection of [db.users, db.engagements, db.documents, db.appointments, db.invoices, db.messages, db.applicants, db.onboardingStates,
      db.journalEntries, db.bankReconciliations, db.bookkeepingTransactions, db.legalRecords, db.accountantProfiles])
      expect(collection.size).toBe(0);
    expect(db.auditLogs).toEqual([]);
    expect(db.servicePlans.size).toBeGreaterThan(0);
  });
  it('still loads for the local in-memory development mode', async () => {
    const db = await load('');
    expect(db.users.size).toBeGreaterThan(0);
    expect(db.engagements.size).toBeGreaterThan(0);
  });
});
