import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { CommunicationStore } from '../server/taxguard/communications/communicationStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

// Real PostgreSQL: proposal 039 messaging under concurrency, with every migration and proposal
// applied in name order. Synthetic tenant, client, staff and messages only.
let db: TestDatabase;
const T = 'tenantDbMsg', C = 'dbMsgClient';
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES('${T}','Synthetic messaging tenant'),('tenantDbMsgOther','Other synthetic tenant') ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','db-msg-client','Synthetic DB Client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','db-msg-mgr','practice_manager','active',NULL),('${T}','db-msg-acct','accountant','active',NULL),
      ('${T}','db-msg-client','client','active','${C}'),('tenantDbMsgOther','db-msg-foreign','practice_manager','active',NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const eng = (await practice.createEngagement(T, C, 'db-msg-mgr', 'db-msg-eng', { title: 'Synthetic 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'db-msg-mgr', eng, 'active', 1);
  await practice.assign(T, C, 'db-msg-mgr', 'db-msg-asg', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'db-msg-acct', reason: 'Synthetic staffing' });
}, 240000);
afterAll(async () => { await db?.stop(); });

describe('messaging on a real PostgreSQL server', () => {
  it('records exactly one thread and one message when the same send is retried concurrently', async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () =>
      new CommunicationStore(pgRpc(db.pool)).createThread(T, C, 'db-msg-client', 'db-msg-same-key', { subject: 'Synthetic concurrent', body: 'Same text' })));
    const ok = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled').map(r => r.value);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok.map(v => v.thread.threadId)).size).toBe(1);
    // Losers of the insert race fail closed (unavailable / conflict); none creates a duplicate.
    for (const r of results) if (r.status === 'rejected') expect((r.reason as any).code).toMatch(/^(COMM_STORE_UNAVAILABLE|IDEMPOTENCY_KEY_REUSED)$/);
    const counts = (await db.pool.query(`SELECT (SELECT count(*) FROM taxguard_communication_threads WHERE tenant_id = $1)::int AS threads,
      (SELECT count(*) FROM taxguard_communication_messages WHERE tenant_id = $1)::int AS messages`, [T])).rows[0];
    expect(counts).toEqual({ threads: 1, messages: 1 });
    // A later retry is answered as a replay.
    expect((await new CommunicationStore(pgRpc(db.pool)).createThread(T, C, 'db-msg-client', 'db-msg-same-key', { subject: 'Synthetic concurrent', body: 'Same text' })).message.replayed).toBe(true);
  });
  it('accepts concurrent distinct replies in one thread, in a stable order, and keeps them across a new connection', async () => {
    const store = new CommunicationStore(pgRpc(db.pool));
    const [thread] = await store.threads(T, C, 'db-msg-acct');
    await Promise.all(Array.from({ length: 6 }, (_, i) => store.post(T, C, i % 2 ? 'db-msg-acct' : 'db-msg-client', thread.threadId, `db-msg-reply-${i}`, `Synthetic reply ${i}`)));
    const fresh = new CommunicationStore(pgRpc(db.pool));
    const view = await fresh.messages(T, C, 'db-msg-mgr', thread.threadId);
    expect(view.messages).toHaveLength(7);
    const times = view.messages.map((m: any) => Date.parse(m.createdAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
  it('refuses another tenant and keeps message rows immutable', async () => {
    const store = new CommunicationStore(pgRpc(db.pool));
    await expect(store.threads(T, C, 'db-msg-foreign')).rejects.toMatchObject({ status: 403 });
    await expect(db.pool.query(`UPDATE taxguard_communication_messages SET content = 'x' WHERE tenant_id = $1`, [T])).rejects.toThrow(/COMM_MESSAGE_IMMUTABLE/);
  });
});
