/**
 * Offline generator of a SYNTHETIC staging seed (SQL text). Connects to nothing and reads no
 * secrets: review the output, then apply it only to an approved, separate non-production
 * database, after the approved migrations. Every person uses an example.test address, every
 * identifier is generated, and nothing resembles a real taxpayer.
 *
 *   node scripts/staging/build-synthetic-seed.mjs --tenant tenantStaging > staging-seed.sql
 *
 * Staff user IDs are random UUIDs (the identity provider's admin MFA API requires UUIDs); their
 * provider accounts and authenticators are created separately in the staging project.
 */
import { randomUUID } from 'node:crypto';

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const tenant = arg('--tenant') || 'tenantStaging';
if (!/^[A-Za-z0-9_-]{3,64}$/.test(tenant)) { console.error('Invalid tenant identifier.'); process.exit(2); }
const q = v => `'${String(v).replace(/'/g, "''")}'`;
const staff = [['admin', 'Synthetic Administrator'], ['admin', 'Synthetic Second Administrator'], ['practice_manager', 'Synthetic Practice Manager'],
  ['accountant', 'Synthetic Accountant'], ['senior_reviewer', 'Synthetic Reviewer'], ['bookkeeper', 'Synthetic Bookkeeper']].map(([role, name]) => ({ uid: randomUUID(), role, name }));
const clients = [1, 2, 3].map(i => ({ clientId: `stgClient${i}`, owner: randomUUID(), name: `Synthetic Staging Client ${i}` }));
const lines = [
  '-- SYNTHETIC STAGING SEED. Generated ' + new Date().toISOString() + '. Not real people or taxpayers.',
  'BEGIN;',
  `INSERT INTO taxguard_tenants(id, name) VALUES (${q(tenant)}, 'Synthetic Staging Practice') ON CONFLICT DO NOTHING;`,
  ...staff.map(s => `INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES (${q(tenant)}, ${q(s.uid)}, ${q(s.role)}, 'active');`),
  ...staff.map(s => `INSERT INTO taxguard_identities(tenant_id, uid, user_data) VALUES (${q(tenant)}, ${q(s.uid)}, jsonb_build_object('id', ${q(s.uid)}, 'tenantId', ${q(tenant)}, 'role', ${q(s.role)}, 'status', 'active', 'email', ${q(s.uid + '@example.test')}, 'name', ${q(s.name)}, 'mfaEnabled', true, 'isVerified', true));`),
  ...clients.map(c => `INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES (${q(tenant)}, ${q(c.clientId)}, ${q(c.owner)}, ${q(c.name)});`),
  ...clients.map(c => `INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES (${q(tenant)}, ${q(c.owner)}, 'client', 'active', ${q(c.clientId)});`),
  'COMMIT;',
  '-- Staff (create provider accounts with these IDs and example.test addresses):',
  ...staff.map(s => `--   ${s.role.padEnd(16)} ${s.uid}`),
];
process.stdout.write(lines.join('\n') + '\n');
