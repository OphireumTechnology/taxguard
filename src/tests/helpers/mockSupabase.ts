import { vi } from 'vitest';
import { formatTaxGuardClientId } from '../../server/client-id.service';

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
/**
 * Synthetic staff access token after a completed Supabase MFA challenge (claim aal = 'aal2').
 * Unsigned and only accepted by this mock's getUser; real tokens are verified by Supabase Auth.
 */
export const STAFF_AAL2_TOKEN = [b64url({ alg: 'none', typ: 'JWT' }), b64url({ sub: 'sb_staff_001', aal: 'aal2', amr: [{ method: 'totp' }] }), 'synthetic'].join('.');
const SYNTHETIC_STAFF_FACTORS = [{ id: 'synthetic-totp-factor', factor_type: 'totp', status: 'verified' }];

export function createMockSupabaseClient() {
  const store = {
    identities: new Map<string, any>(),
    members: new Map<string, any>(),
    clients: new Map<string, any>(),
    sessions: new Map<string, any>(),
    sequence: { current_sequence: 100, last_issued_client_id: '100' },
    audit: [] as any[],
    documents: new Map<string, any>(),
    assignments: [] as any[],
    invitations: [] as any[]
  };

  const client: any = {
    rpc: mockAtomicClientIdentityRpc(store),
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'valid_sb_token') {
          return {
            data: {
              user: {
                id: 'sb_user_001',
                email: 'client@example.com',
                user_metadata: { full_name: 'Jane Doe' },
                email_confirmed_at: new Date().toISOString(),
                last_sign_in_at: new Date().toISOString()
              }
            },
            error: null
          };
        }
        if (token === 'valid_sb_token_b') {
          return {
            data: {
              user: {
                id: 'sb_user_002',
                email: 'client-b@example.com',
                user_metadata: { full_name: 'Client B' },
                email_confirmed_at: new Date().toISOString(),
                last_sign_in_at: new Date().toISOString()
              }
            },
            error: null
          };
        }
        if (token === 'seed_email_token') {
          return {
            data: {
              user: {
                id: 'sb_seed_auth_user',
                email: 'm.perotti@example.com',
                user_metadata: { full_name: 'Seed Email Identity' },
                email_confirmed_at: new Date().toISOString(),
                last_sign_in_at: new Date().toISOString()
              }
            },
            error: null
          };
        }
        // 'valid_staff_token' = password sign-in only (AAL1); STAFF_AAL2_TOKEN = MFA completed.
        if (token === 'valid_staff_token' || token === STAFF_AAL2_TOKEN) {
          return {
            data: {
              user: {
                id: 'sb_staff_001',
                email: 'staff@example.com',
                user_metadata: { full_name: 'Assigned Staff' },
                email_confirmed_at: new Date().toISOString(),
                last_sign_in_at: new Date().toISOString(),
                factors: SYNTHETIC_STAFF_FACTORS
              }
            },
            error: null
          };
        }
        if (token === 'no_email_token') {
          return { data: { user: { id: 'sb_user_002', email: '' } }, error: null };
        }
        return { data: { user: null }, error: { message: 'Invalid JWT' } };
      })
    },
    storage: {
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(async (path: string, _buffer: Buffer) => {
          return { data: { path }, error: null };
        }),
        createSignedUrl: vi.fn(async (path: string, _expiresIn: number) => {
          return { data: { signedUrl: `https://storage.supabase.co/${bucket}/${path}?token=signed` }, error: null };
        })
      }))
    },
    from: vi.fn((table: string) => {
      let filterCol = '';
      let filterVal: any = null;
      let filterCol2 = '';
      let filterVal2: any = null;
      const filters: Array<[string, any]> = [];

      let pendingUpdates: any = null;

      const builder: any = {
        select: vi.fn(() => builder),
        limit: vi.fn(async () => ({ data: store.invitations.filter(row => filters.every(([column, value]) => row[column] === value)).slice(0, 1), error: null })),
        eq: vi.fn((col: string, val: any) => {
          filters.push([col, val]);
          if (!filterCol) {
            filterCol = col;
            filterVal = val;
          } else {
            filterCol2 = col;
            filterVal2 = val;
          }
          if (pendingUpdates && table === 'taxguard_sessions') {
            const s = store.sessions.get(val);
            if (s) Object.assign(s, pendingUpdates);
          }
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === 'taxguard_identities') {
            return { data: store.identities.get(filterVal) || null, error: null };
          }
          if (table === 'taxguard_members') {
            const member = Array.from(store.members.values()).find(
              m => m.tenant_id === filterVal && m.uid === filterVal2
            );
            return { data: member || null, error: null };
          }
          if (table === 'taxguard_clients') {
            const client = Array.from(store.clients.values()).find(
              row => row.tenant_id === filterVal && row.owner_uid === filterVal2
            );
            return { data: client || null, error: null };
          }
          if (table === 'taxguard_client_id_sequence') {
            return { data: store.sequence, error: null };
          }
          if (table === 'taxguard_sessions') {
            return { data: store.sessions.get(filterVal) || null, error: null };
          }
          return { data: null, error: null };
        }),
        insert: vi.fn(async (row: any) => {
          if (table === 'taxguard_identities') store.identities.set(row.uid, row);
          if (table === 'taxguard_members') store.members.set(`${row.tenant_id}_${row.uid}`, row);
          if (table === 'taxguard_clients') store.clients.set(row.client_id, row);
          if (table === 'taxguard_sessions') store.sessions.set(row.session_token_hash, row);
          if (table === 'taxguard_audit_log') store.audit.push(row);
          if (table === 'taxguard_documents') store.documents.set(row.document_id, row);
          return { data: row, error: null };
        }),
        upsert: vi.fn(async (row: any) => {
          if (table === 'taxguard_client_id_sequence') {
            store.sequence = row;
          }
          return { data: row, error: null };
        }),
        update: vi.fn((updates: any) => {
          pendingUpdates = updates;
          if (filterVal && table === 'taxguard_sessions') {
            const s = store.sessions.get(filterVal);
            if (s) Object.assign(s, updates);
          }
          return builder;
        }),
        then: (resolve: any, reject?: any) => {
          if (table === 'taxguard_staff_assignments') {
            const data = store.assignments.filter(row =>
              filters.every(([column, value]) => {
                const key = column as keyof typeof row;
                return row[key] === value;
              })
            );
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
      };
      return builder;
    })
  };

  return { client, store };
}

/** Synthetic transaction-shaped RPC; real atomicity is exercised by the SQL proposal tests. */
export function mockAtomicClientIdentityRpc(store: {
  identities: Map<string, any>; members: Map<string, any>; clients: Map<string, any>;
  sequence: { current_sequence: number; last_issued_client_id: string }; audit: any[]; invitations?: any[]; sessions?: Map<string, any>;
}) {
  return vi.fn(async (name: string, input: Record<string, any>) => {
    if (name === 'taxguard_update_client_profile') {
      const identity = store.identities.get(input.p_uid);
      const member = Array.from(store.members.values()).find(row => row.tenant_id === input.p_tenant && row.uid === input.p_uid);
      const owned = Array.from(store.clients.values()).find(row => row.tenant_id === input.p_tenant && row.owner_uid === input.p_uid);
      if (!identity || identity.tenant_id !== input.p_tenant || !member || member.role !== 'client' || member.status !== 'active' || !owned || owned.status !== 'active' || identity.user_data.clientId !== owned.client_id || member.client_id !== owned.client_id) return { data: null, error: { code: 'P0001', message: 'CLIENT_PROFILE_DENIED' } };
      const updated = { ...identity.user_data, phone: identity.user_data.phone ?? '', companyName: identity.user_data.companyName ?? '', ...input.p_patch, updatedAt: new Date().toISOString() };
      identity.user_data = updated; if ('phone' in input.p_patch) owned.phone = input.p_patch.phone; if ('companyName' in input.p_patch) owned.company_name = input.p_patch.companyName;
      store.audit.push({ tenant_id: input.p_tenant, actor_uid: input.p_uid, action: 'CLIENT_PROFILE_UPDATED' });
      return { data: { user: structuredClone(updated) }, error: null };
    }
    if (name === 'taxguard_create_session') {
      const identity = store.identities.get(input.p_uid);
      const member = Array.from(store.members.values()).find(row => row.tenant_id === input.p_tenant && row.uid === input.p_uid);
      if (!store.sessions || !identity || identity.tenant_id !== input.p_tenant || !member || member.status !== 'active' || identity.user_data.status !== 'active' || identity.user_data.id !== input.p_uid || identity.user_data.role !== member.role ||
        (identity.user_data.tenantId !== undefined && identity.user_data.tenantId !== input.p_tenant)) return { data: null, error: { code: 'P0001', message: 'SESSION_AUTHORITY_DENIED' } };
      if (!['client','prospective_client'].includes(member.role)) {
        if (!input.p_verified_factor_count) return { data: null, error: { code: 'P0001', message: 'STAFF_MFA_ENROLLMENT_REQUIRED' } };
        if (input.p_aal !== 'aal2') return { data: null, error: { code: 'P0001', message: 'STAFF_MFA_REQUIRED' } };
        if (member.mfa_reenrollment_required) return { data: null, error: { code: 'P0001', message: 'STAFF_MFA_REENROLLMENT_REQUIRED' } };
        if (member.status_changed_at && input.p_auth_time * 1000 <= Date.parse(member.status_changed_at)) return { data: null, error: { code: 'P0001', message: 'STAFF_FRESH_SIGN_IN_REQUIRED' } };
      }
      if (store.sessions.has(input.p_token_hash)) return { data: null, error: { code: 'P0001', message: 'SESSION_TOKEN_CONFLICT' } };
      store.sessions.set(input.p_token_hash, { session_token_hash: input.p_token_hash, uid: input.p_uid, tenant_id: input.p_tenant, auth_time: input.p_auth_time, expires_at: input.p_expires_at, aal: input.p_aal, revoked: false });
      store.audit.push({ tenant_id: input.p_tenant, actor_uid: input.p_uid, actor_role: member.role, action: 'SESSION_CREATED' });
      return { data: { created: true }, error: null };
    }
    if (name === 'taxguard_revoke_session') {
      const row = store.sessions?.get(input.p_token_hash);
      if (!row || row.tenant_id !== input.p_tenant || row.revoked) return { data: { revoked: false }, error: null };
      row.revoked = true; store.audit.push({ tenant_id: input.p_tenant, actor_uid: row.uid, action: 'SESSION_REVOKED' });
      return { data: { revoked: true }, error: null };
    }
    if (name !== 'taxguard_provision_client_identity') return { data: null, error: { code: '42883', message: 'Synthetic RPC missing' } };
    const { p_tenant: tenant, p_uid: uid, p_email: email, p_name: displayName } = input;
    const existing = store.identities.get(uid);
    const member = Array.from(store.members.values()).find(row => row.tenant_id === tenant && row.uid === uid);
    const owned = Array.from(store.clients.values()).find(row => row.tenant_id === tenant && row.owner_uid === uid);
    if (existing || member || owned) {
      if (!existing || !member || !owned || existing.tenant_id !== tenant || member.role !== 'client' || member.status !== 'active' || member.client_id !== owned.client_id || existing.user_data.clientId !== owned.client_id) {
        return { data: null, error: { code: 'P0001', message: 'CLIENT_IDENTITY_CONFLICT' } };
      }
      return { data: { user: structuredClone(existing.user_data), clientId: owned.client_id, resumed: true }, error: null };
    }
    if (store.invitations?.some(row => row.tenant_id === tenant && row.email === email)) return { data: null, error: { code: 'P0001', message: 'CLIENT_INVITATION_EXISTS' } };
    const sequence = store.sequence.current_sequence + 1;
    const clientId = formatTaxGuardClientId(sequence);
    const user = { id: uid, tenantId: tenant, email, name: displayName, role: 'client', status: 'active', clientId, isVerified: true, onboardingStatus: 'NOT_STARTED', onboardingCompletedAt: null, createdAt: new Date().toISOString() };
    store.sequence = { current_sequence: sequence, last_issued_client_id: clientId };
    store.identities.set(uid, { uid, tenant_id: tenant, user_data: user, created_at: user.createdAt });
    store.members.set(tenant + '_' + uid, { tenant_id: tenant, uid, role: 'client', status: 'active', client_id: clientId });
    store.clients.set(clientId, { tenant_id: tenant, client_id: clientId, owner_uid: uid, name: displayName, email, status: 'active' });
    store.audit.push({ tenant_id: tenant, actor_uid: uid, actor_role: 'client', action: 'CLIENT_IDENTITY_PROVISIONED' });
    return { data: { user: structuredClone(user), clientId, resumed: false }, error: null };
  });
}
