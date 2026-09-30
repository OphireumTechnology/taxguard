import { vi } from 'vitest';

export function createMockSupabaseClient() {
  const store = {
    identities: new Map<string, any>(),
    members: new Map<string, any>(),
    clients: new Map<string, any>(),
    sessions: new Map<string, any>(),
    sequence: { current_sequence: 100, last_issued_client_id: '100' },
    audit: [] as any[],
    documents: new Map<string, any>()
  };

  const client: any = {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'valid_sb_token') {
          return {
            data: {
              user: {
                id: 'sb_user_001',
                email: 'client@example.com',
                user_metadata: { full_name: 'Jane Doe' },
                last_sign_in_at: new Date().toISOString()
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

      let pendingUpdates: any = null;

      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: any) => {
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
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
      };
      return builder;
    })
  };

  return { client, store };
}
