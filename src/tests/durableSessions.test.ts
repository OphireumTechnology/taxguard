import { beforeEach, expect, it, vi } from 'vitest';
import { DurableSessions } from '../server/durableSessions';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
let db: TransactionalFirestore; let auth: any; let sessions: DurableSessions;
const decoded = { uid: 'uid1', email: 'user@example.com', auth_time: Math.floor(Date.now() / 1000) } as any;
beforeEach(() => {
  db = new TransactionalFirestore();
  auth = { getUser: vi.fn().mockResolvedValue({ email: 'user@example.com', displayName: 'Client', emailVerified: true, disabled: false, tokensValidAfterTime: '2020-01-01' }) };
  sessions = new DurableSessions(db as any, auth, 'tenantA');
});
it('provisions canonical identity and hashed session atomically', async () => {
  const result = await sessions.create(decoded);
  expect(result.user).toMatchObject({ id: 'uid1', clientId: '001', role: 'client' });
  expect([...db.records.keys()].some(key => key.includes(result.token))).toBe(false);
  expect(JSON.stringify([...db.records.values()])).not.toContain(result.token);
  expect(db.records.get('taxguardTenants/tenantA/clients/001').ownerUid).toBe('uid1');
  expect(await new DurableSessions(db as any, auth, 'tenantA').verify(result.token)).toEqual(result.user);
});
it('allocates a single identity under concurrent session creation', async () => {
  const results = await Promise.all([sessions.create(decoded), sessions.create(decoded)]);
  expect(results[0].user.clientId).toBe(results[1].user.clientId);
  expect(db.records.get('system/taxguard_client_id_sequence').currentSequence).toBe(1);
});
it('requires explicit migration for existing permanent identities', async () => {
  db.records.set('users/uid1', { role: 'client', clientId: '123' });
  await expect(sessions.create(decoded)).rejects.toThrow('IDENTITY_MIGRATION_REQUIRED');
  expect(db.records.has('taxguardIdentities/uid1')).toBe(false);
});
it('never trusts elevated public profile roles', async () => {
  db.records.set('users/uid1', { role: 'administrator' });
  await expect(sessions.create(decoded)).rejects.toThrow('IDENTITY_MIGRATION_REQUIRED');
});
it('rejects disabled Firebase identity', async () => {
  auth.getUser.mockResolvedValue({ email: decoded.email, disabled: true });
  await expect(sessions.create(decoded)).rejects.toThrow('IDENTITY_DENIED');
});
it('rejects inconsistent verified email', async () => {
  await expect(sessions.create({ ...decoded, email: 'other@example.com' })).rejects.toThrow('IDENTITY_DENIED');
});
it('has durable, idempotent logout', async () => {
  const { token } = await sessions.create(decoded);
  await sessions.revoke(token); await sessions.revoke(token);
  expect(await sessions.verify(token)).toBe(null);
  expect([...db.records.values()].filter(v => v.action === 'SESSION_REVOKED')).toHaveLength(1);
});
it('rejects another tenant session', async () => {
  const { token } = await sessions.create(decoded);
  expect(await new DurableSessions(db as any, auth, 'tenantB').verify(token)).toBe(null);
});
it('rejects expired sessions', async () => {
  const { token } = await sessions.create(decoded);
  const record = [...db.records.entries()].find(([key]) => key.startsWith('taxguardSessions/'))![1];
  record.expiresAt = 0;
  expect(await sessions.verify(token)).toBe(null);
});
it('honors Firebase password-reset/token revocation', async () => {
  const { token } = await sessions.create(decoded);
  auth.getUser.mockResolvedValue({ disabled: false, tokensValidAfterTime: new Date(Date.now() + 10000).toISOString() });
  expect(await sessions.verify(token)).toBe(null);
});
it('honors current stored membership suspension', async () => {
  const { token } = await sessions.create(decoded);
  db.records.get('taxguardTenants/tenantA/members/uid1').status = 'suspended';
  expect(await sessions.verify(token)).toBe(null);
});
it('rolls back allocation and identity on commit failure', async () => {
  db.failCommit = true;
  await expect(sessions.create(decoded)).rejects.toThrow('Commit unavailable');
  expect(db.records.size).toBe(0);
});
it('rejects legacy opaque development tokens', async () => {
  expect(await sessions.verify('legacy-token')).toBe(null);
  expect(auth.getUser).not.toHaveBeenCalled();
});
