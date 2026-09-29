import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setSupabaseAdmin } from '../server/supabase';
import { createProductionApp } from '../server/productionApp';
import {
  validateRegistrationInput,
  validatePasswordStrength,
  validateEmailFormat,
  sanitizeAuthErrorMessage,
  registerWithEmail,
  loginWithEmail,
  resendVerificationEmail
} from '../supabase/auth';
import { supabase } from '../supabase/config';
import { provisionOrResolveClientOnboarding } from '../server/taxguard/clientOnboardingProvisioner';

function createMockSupabaseBackend() {
  const store = {
    identities: new Map<string, any>(),
    members: new Map<string, any>(),
    clients: new Map<string, any>(),
    sessions: new Map<string, any>(),
    sequence: { current_sequence: 500, last_issued_client_id: '500' },
    audit: [] as any[],
    documents: new Map<string, any>()
  };

  const client: any = {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'valid_new_client_jwt') {
          return {
            data: {
              user: {
                id: 'sb_uid_new_client_01',
                email: 'eleanor.vance@example.com',
                user_metadata: {
                  full_name: 'Eleanor Marie Vance',
                  phone: '678-205-9486',
                  company_name: 'Vance Advisory LLC',
                  role: 'admin' // Forged metadata role — server must ignore and assign client
                },
                last_sign_in_at: new Date().toISOString()
              }
            },
            error: null
          };
        }
        if (token === 'valid_second_client_jwt') {
          return {
            data: {
              user: {
                id: 'sb_uid_new_client_02',
                email: 'arthur.pendleton@example.com',
                user_metadata: {
                  full_name: 'Arthur Pendleton'
                },
                last_sign_in_at: new Date().toISOString()
              }
            },
            error: null
          };
        }
        return { data: { user: null }, error: { message: 'Invalid JWT token' } };
      })
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

describe('Post-Registration Client Routing, Session Establishment & Stage 01 Provisioning', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseBackend>;
  let server: Server;
  let origin: string;

  beforeEach(async () => {
    mockSupabase = createMockSupabaseBackend();
    setSupabaseAdmin(mockSupabase.client);
    vi.stubEnv('SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key');
    vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
    vi.stubEnv('NODE_ENV', 'production');

    server = createServer(createProductionApp());
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    setSupabaseAdmin(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  describe('1. Registration Form Validation & Controlled Error Sanitizing', () => {
    it('validates email format, password complexity, confirm password match, and terms acceptance', () => {
      expect(validateEmailFormat('invalid-email').valid).toBe(false);
      expect(validateEmailFormat('eleanor@example.com').valid).toBe(true);

      expect(validatePasswordStrength('short1A').valid).toBe(false);
      expect(validatePasswordStrength('alllowercase123').valid).toBe(false);
      expect(validatePasswordStrength('ALLUPPERCASE123').valid).toBe(false);
      expect(validatePasswordStrength('NoNumbersPassword').valid).toBe(false);
      expect(validatePasswordStrength('StrongPass123!').valid).toBe(true);

      const mismatch = validateRegistrationInput({
        firstName: 'Eleanor',
        lastName: 'Vance',
        email: 'eleanor@example.com',
        phone: '678-205-9486',
        password: 'StrongPass123!',
        confirmPassword: 'DifferentPass123!',
        requireConfirmPassword: true,
        acceptedTerms: true,
        requireTerms: true
      });
      expect(mismatch.valid).toBe(false);
      expect(mismatch.code).toBe('VALIDATION_FAILED');

      const missingTerms = validateRegistrationInput({
        firstName: 'Eleanor',
        lastName: 'Vance',
        email: 'eleanor@example.com',
        phone: '678-205-9486',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
        requireConfirmPassword: true,
        acceptedTerms: false,
        requireTerms: true
      });
      expect(missingTerms.valid).toBe(false);
      expect(missingTerms.code).toBe('VALIDATION_FAILED');

      const validInput = validateRegistrationInput({
        firstName: 'Eleanor',
        lastName: 'Vance',
        email: 'eleanor@example.com',
        phone: '678-205-9486',
        password: 'StrongPass123!',
        confirmPassword: 'StrongPass123!',
        requireConfirmPassword: true,
        acceptedTerms: true,
        requireTerms: true,
        category: 'llc',
        company: 'Vance Global LLC'
      });
      expect(validInput.valid).toBe(true);
    });

    it('sanitizes raw SQL / Supabase internal errors into controlled error codes', () => {
      const dup = sanitizeAuthErrorMessage(
        new Error('duplicate key value violates unique constraint "users_email_key"'),
        'REGISTRATION_FAILED'
      );
      expect(dup.code).toBe('REGISTRATION_FAILED');
      expect(dup.message).not.toContain('users_email_key');

      const unconfirmed = sanitizeAuthErrorMessage(
        new Error('Email not confirmed'),
        'INVALID_CREDENTIALS'
      );
      expect(unconfirmed.code).toBe('EMAIL_VERIFICATION_REQUIRED');

      const invalidCreds = sanitizeAuthErrorMessage(
        new Error('Invalid login credentials'),
        'INVALID_CREDENTIALS'
      );
      expect(invalidCreds.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('2. Supabase Registration Flows (Immediate Session vs Email Verification Required)', () => {
    it('CASE A: returns SESSION_READY when Supabase signUp returns an active session immediately', async () => {
      vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
        data: {
          user: {
            id: 'sb_uid_new_client_01',
            email: 'eleanor.vance@example.com',
            identities: [{ id: 'id_1' }],
            confirmed_at: new Date().toISOString()
          } as any,
          session: {
            access_token: 'valid_new_client_jwt',
            expires_at: Math.floor(Date.now() / 1000) + 3600
          } as any
        },
        error: null
      });

      const result = await registerWithEmail(
        'Eleanor Marie Vance',
        'Eleanor.Vance@example.com',
        'StrongPass123!',
        '678-205-9486',
        'Vance Advisory LLC'
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('SESSION_READY');
      expect(result.emailVerificationRequired).toBe(false);
      expect(result.accessToken).toBe('valid_new_client_jwt');
      expect(result.user?.role).toBe('client');
    });

    it('CASE B: returns EMAIL_VERIFICATION_REQUIRED when Supabase creates user without session', async () => {
      vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
        data: {
          user: {
            id: 'sb_uid_unverified_01',
            email: 'pending@example.com',
            identities: [{ id: 'id_2' }],
            confirmed_at: null
          } as any,
          session: null
        },
        error: null
      });

      const result = await registerWithEmail(
        'Pending Client',
        'pending@example.com',
        'StrongPass123!',
        '678-205-9486'
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(result.emailVerificationRequired).toBe(true);
      expect(result.code).toBe('EMAIL_VERIFICATION_REQUIRED');
      expect(result.accessToken).toBeUndefined();
    });

    it('detects obfuscated duplicate registration (empty identities array) and returns REGISTRATION_FAILED', async () => {
      vi.spyOn(supabase.auth, 'signUp').mockResolvedValueOnce({
        data: {
          user: {
            id: 'sb_uid_dup',
            email: 'existing@example.com',
            identities: []
          } as any,
          session: null
        },
        error: null
      });

      const result = await registerWithEmail(
        'Existing User',
        'existing@example.com',
        'StrongPass123!'
      );

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.code).toBe('REGISTRATION_FAILED');
      expect(result.duplicateRegistration).toBe(true);
    });
  });

  describe('3. Server Session Establishment & Idempotent First-Time Client Provisioning', () => {
    it('establishes server session via POST /api/auth/supabase-session, ignores browser-spoofed role/tenant/clientId, and provisions Stage 01 hierarchy', async () => {
      const response = await fetch(`${origin}/api/auth/supabase-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://artaxserv.com'
        },
        body: JSON.stringify({
          accessToken: 'valid_new_client_jwt',
          name: 'Eleanor Marie Vance',
          phone: '678-205-9486',
          companyName: 'Vance Advisory LLC',
          clientType: 'business',
          // Spoofed fields that MUST be ignored by the server:
          role: 'admin',
          tenantId: 'spoofed_tenant',
          clientId: '999999',
          engagementId: 'spoofed_eng',
          caseId: 'spoofed_case'
        })
      });

      expect(response.status).toBe(200);
      const body = await response.json();

      // Verify server-authoritative token & role
      expect(body.token).toMatch(/^tg_live_[a-f0-9]{64}$/);
      expect(body.user.role).toBe('client');
      expect(body.user.id).toBe('sb_uid_new_client_01');
      expect(body.clientId).toBe('501'); // Allocated from sequence (500 -> 501), NOT 999999
      expect(body.tenantId).toBe('tenantA'); // Resolved from server authority, NOT spoofed_tenant

      // Verify provisioned hierarchy
      expect(body.engagementId).toBe('eng_2025_501');
      expect(body.taxYear).toBe(2025);
      expect(body.caseId).toBe('case_2025_501');
      expect(body.activeStage).toBe(1);
      expect(body.resumed).toBe(false);

      // Verify canonical Stage 01 initialization states
      expect(body.stageStates).toEqual({
        STAGE_01_IDENTITY: 'IN_PROGRESS',
        STAGE_02_DOCUMENTS: 'LOCKED',
        STAGE_03_EXTRACTION: 'LOCKED',
        STAGE_04_PREPARATION: 'LOCKED',
        STAGE_05_REVIEW: 'LOCKED',
        STAGE_06_APPROVAL: 'LOCKED',
        STAGE_07_FILING: 'LOCKED'
      });

      // Verify Repeat / Callback invocation is idempotent and resumes the existing case
      const secondResponse = await fetch(`${origin}/api/auth/supabase-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://artaxserv.com'
        },
        body: JSON.stringify({
          accessToken: 'valid_new_client_jwt',
          name: 'Eleanor Marie Vance'
        })
      });

      expect(secondResponse.status).toBe(200);
      const secondBody = await secondResponse.json();
      expect(secondBody.clientId).toBe('501'); // No duplicate clientId allocated
      expect(secondBody.engagementId).toBe('eng_2025_501');
      expect(secondBody.caseId).toBe('case_2025_501');
      expect(secondBody.resumed).toBe(true);
    });

    it('serves scoped Stage 01 workflow state in production and allows Stage 01 save & completion', async () => {
      const sessionRes = await fetch(`${origin}/api/auth/supabase-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://artaxserv.com'
        },
        body: JSON.stringify({
          accessToken: 'valid_second_client_jwt',
          name: 'Arthur Pendleton',
          clientType: 'individual'
        })
      });
      expect(sessionRes.status).toBe(200);
      const sessionData = await sessionRes.json();
      const serverToken = sessionData.token;

      // 1. Fetch workflow state via production-authorized scoped endpoint
      const workflowRes = await fetch(
        `${origin}/api/case-authority/client-onboarding/workflow?taxYear=2025`,
        {
          headers: {
            Authorization: `Bearer ${serverToken}`,
            Origin: 'https://artaxserv.com'
          }
        }
      );
      expect(workflowRes.status).toBe(200);
      const workflowPayload = await workflowRes.json();
      expect(workflowPayload.workflow.clientId).toBe(sessionData.clientId);
      expect(workflowPayload.workflow.stage1.status).toBe('IN_PROGRESS');
      expect(workflowPayload.eligibility.eligibility.stage1).toBe(true);
      expect(workflowPayload.eligibility.eligibility.stage2).toBe(false);

      // 2. Save & complete Stage 01 identity intake
      const stage1Res = await fetch(
        `${origin}/api/case-authority/client-onboarding/stage-1`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serverToken}`,
            Origin: 'https://artaxserv.com'
          },
          body: JSON.stringify({
            taxYear: 2025,
            completeStage: true,
            payload: {
              taxpayerFullName: 'Arthur Pendleton',
              filingStatus: 'single',
              residencyState: 'SC',
              phone: '803-555-0199',
              occupation: 'Executive Consultant',
              identityAttested: true
            }
          })
        }
      );
      expect(stage1Res.status).toBe(200);
      const stage1Body = await stage1Res.json();
      expect(stage1Body.workflow.stage1.status).toBe('COMPLETED');
      expect(stage1Body.workflow.stage2.status).toBe('IN_PROGRESS');
      expect(stage1Body.eligibility.eligibility.stage2).toBe(true);
    });
  });
});
