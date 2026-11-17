import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { OnboardingStore } from '../server/taxguard/onboarding/onboardingStore';

// Client onboarding re-checks authority after waiting on the per-client lock (proposal 20261019090000). Written by
// Codex in the Phase 14 continuation worktree (uncommitted, 2026-10-19). Its four further cases specified an unbuilt
// design (guarded entry points, draft-save audit) and stay with the preserved Codex package. Synthetic data only.

const tenant = 'onboardingWaitFixture';
let db: TestDatabase;
const clients = new Map<string, string>();
const fields = { taxpayerType: 'individual', legalName: 'Synthetic Wait Person', street: '1 Synthetic Road', city: 'Columbia', state: 'SC', postalCode: '29201', tinType: 'SSN', tinLast4: '4321' };
beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id,name) VALUES ($1,'Synthetic lock wait practice');`, [tenant]);
  await db.pool.query(`INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES ($1,'wait-manager','practice_manager','active');`, [tenant]);
  // Test fixture consent only: never approved legal wording or a hosted consent change.
  await db.pool.query(`INSERT INTO taxguard_onb_consent_versions(tenant_id,version,consent_text,approved_by,approved_at,status)
    VALUES ($1,'SYNTHETIC-WAIT-1',repeat('Synthetic fixture only; not legal consent. ',3),'Synthetic fixture',now(),'APPROVED')`, [tenant]);
  for (const operation of ['save', 'submit', 'decide']) {
    const result = await pgRpc(db.pool).rpc('taxguard_provision_client_identity', { p_tenant: tenant, p_uid: `wait-${operation}`, p_email: `wait-${operation}@example.test`, p_name: 'Synthetic Wait Client' });
    expect(result.error).toBeNull();
    clients.set(operation, result.data.clientId);
    if (operation !== 'save') {
      const store = new OnboardingStore(pgRpc(db.pool));
      await store.save(tenant, result.data.clientId, `wait-${operation}`, 0, fields);
      if (operation === 'decide') await store.submit(tenant, result.data.clientId, 'wait-decide', 1, 'SYNTHETIC-WAIT-1', 'Synthetic Signer');
    }
  }
}, 240_000);
afterAll(async () => { await db?.stop(); });

async function suspendDuringWait(client: string, actor: string, operation: (store: OnboardingStore) => Promise<unknown>) {
  const holder = await db.connect(), writer = await db.connect();
  let pending: Promise<any> | undefined;
  let holding = false;
  try {
    await holder.query('BEGIN');
    holding = true;
    await holder.query("SELECT pg_advisory_xact_lock(hashtext('taxguard:onboarding:' || $1 || ':' || $2))", [tenant, client]);
    await writer.query("SET statement_timeout='10s'");
    const pid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    pending = operation(new OnboardingStore(pgRpc(writer))).then(value => ({ value }), error => ({ error }));
    let waiting = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      waiting = (await db.pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='advisory') AS waiting", [pid])).rows[0].waiting;
      if (waiting) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(waiting, 'observe the actual advisory lock wait before suspending authority').toBe(true);
    await db.pool.query("UPDATE taxguard_members SET status='suspended' WHERE tenant_id=$1 AND uid=$2", [tenant, actor]);
    await holder.query('ROLLBACK');
    holding = false;
    return await pending;
  } finally {
    if (holding) await holder.query('ROLLBACK');
    await pending;
    await writer.end();
    await holder.end();
  }
}

describe('onboarding authorization after database waits', () => {
  it.each(['save', 'submit', 'decide'])('refuses %s when the actor was suspended while waiting', async operation => {
    const client = clients.get(operation)!;
    const before = (await db.pool.query("SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id=$1 AND metadata->>'clientId'=$2", [tenant, client])).rows[0].n;
    const actor = operation === 'decide' ? 'wait-manager' : `wait-${operation}`;
    const result = await suspendDuringWait(client, actor, store => operation === 'save'
      ? store.save(tenant, client, actor, 0, { legalName: 'Suspended writer must not persist' })
      : operation === 'submit' ? store.submit(tenant, client, actor, 1, 'SYNTHETIC-WAIT-1', 'Synthetic Signer')
        : store.decide(tenant, client, actor, 2, 'request_changes', { clientReason: 'Suspended reviewer must not decide' }));
    expect(result.error).toMatchObject({ status: 403, code: operation === 'decide' ? 'PRACTICE_ACCESS_DENIED' : 'ONBOARDING_CLIENT_REQUIRED' });
    const rows = (await db.pool.query('SELECT status,revision FROM taxguard_client_onboarding WHERE tenant_id=$1 AND client_id=$2', [tenant, client])).rows;
    expect(rows).toEqual(operation === 'save' ? [] : [{ status: operation === 'submit' ? 'DRAFT' : 'SUBMITTED', revision: operation === 'submit' ? 1 : 2 }]);
    expect((await db.pool.query("SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id=$1 AND metadata->>'clientId'=$2", [tenant, client])).rows[0].n).toBe(before);
    expect((await db.pool.query('SELECT count(*)::int AS n FROM taxguard_client_notifications WHERE tenant_id=$1 AND client_id=$2', [tenant, client])).rows[0].n).toBe(0);
  });
});
