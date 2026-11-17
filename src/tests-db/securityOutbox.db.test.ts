import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { startDatabase, pgRpc, type TestDatabase } from './harness';
import { SecurityEventRecorder } from '../server/securityEventRecorder';

let db: TestDatabase;
beforeAll(async () => { db = await startDatabase({ durable: true }); await db.pool.query("INSERT INTO taxguard_tenants(id,name) VALUES('outboxA','Synthetic A'),('outboxB','Synthetic B'); INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('outboxA','outbox-admin','admin','active');"); });
afterAll(async () => { await db?.stop(); });
describe('security outbox real PostgreSQL with fsync enabled', () => {
  it('recovers acknowledged handoff after PostgreSQL and producer restart', async () => {
    const id = randomUUID(), producer = new SecurityEventRecorder(pgRpc(db.pool),'outboxA',100,'outbox');
    await producer.recordDurably({ eventType:'RBAC_ACCESS_DENIED', userId:'outbox-admin', severity:'warning' },id);
    await db.restart();
    expect((await db.pool.query('SELECT status FROM taxguard_security_outbox WHERE event_id=$1',[id])).rows[0].status).toBe('PENDING');
    const restarted = new SecurityEventRecorder(pgRpc(db.pool),'outboxA',100,'outbox');
    await restarted.dispatch();
    expect((await db.pool.query('SELECT count(*)::int n FROM taxguard_audit_log WHERE id=$1',[id])).rows[0].n).toBe(1);
  });
  it('allows multiple dispatcher sessions without duplicates and isolates tenants', async () => {
    const ids = Array.from({length:12},()=>randomUUID()), producer = new SecurityEventRecorder(pgRpc(db.pool),'outboxA',100,'outbox');
    await Promise.all(ids.map(id=>producer.recordDurably({eventType:'INVALID_CREDENTIALS',severity:'warning'},id)));
    const connections = await Promise.all(Array.from({length:4},()=>db.connect()));
    try {
      for (const c of connections) await c.query('SET ROLE service_role');
      await Promise.all(connections.map(c=>new SecurityEventRecorder(pgRpc(c),'outboxA',100,'outbox').dispatch(100)));
      expect((await db.pool.query('SELECT count(*)::int n FROM taxguard_audit_log WHERE id=ANY($1::uuid[])',[ids])).rows[0].n).toBe(12);
      const before = (await db.pool.query("SELECT count(*)::int n FROM taxguard_audit_log WHERE tenant_id='outboxB'")).rows[0].n;
      await new SecurityEventRecorder(pgRpc(db.pool),'outboxB',100,'outbox').dispatch();
      expect((await db.pool.query("SELECT count(*)::int n FROM taxguard_audit_log WHERE tenant_id='outboxB'")).rows[0].n).toBe(before);
    } finally { await Promise.all(connections.map(c=>c.end())); }
  });
  it('keeps acknowledged security handoff independent of a failed business transaction', async () => {
    const business = await db.connect(), id=randomUUID();
    try {
      await business.query('BEGIN');
      await business.query("UPDATE taxguard_tenants SET name='Uncommitted synthetic' WHERE id='outboxB'");
      await new SecurityEventRecorder(pgRpc(db.pool),'outboxA',100,'outbox').recordDurably({eventType:'INVALID_CREDENTIALS',severity:'warning'},id);
      await business.query('ROLLBACK');
      expect((await db.pool.query('SELECT status FROM taxguard_security_outbox WHERE event_id=$1',[id])).rows[0].status).toBe('PENDING');
    } finally { await business.end(); }
  });
});
