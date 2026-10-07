import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setSupabaseAdmin } from '../server/supabase';
import { createProductionApp } from '../server/productionApp';
import { db } from '../server/db';
import { SupabaseDurableSessions } from '../server/supabase-db';

function createMockSupabaseBackend() {
  const store = {
    identities: new Map<string, any>(),
    members: new Map<string, any>(),
    clients: new Map<string, any>(),
    sessions: new Map<string, any>(),
    sequence: { current_sequence: 700, last_issued_client_id: '700' },
    audit: [] as any[],
    documents: new Map<string, any>(),
    assignments: [] as any[]
  };

  const client: any = {
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === 'returning_client_jwt') {
          return {
            data: {
              user: {
                id: 'sb_uid_returning_01',
                email: 'sarah.jenkins@example.com',
                user_metadata: {
                  full_name: 'Sarah Elizabeth Jenkins',
                  phone: '803-555-4321',
                  company_name: 'Jenkins Architectural Design LLC'
                },
                last_sign_in_at: new Date().toISOString()
              }
            },
            error: null
          };
        }
        return { data: { user: null }, error: { message: 'Invalid token' } };
      })
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
          if (pendingUpdates && table === 'taxguard_identities') {
            const id = store.identities.get(val);
            if (id) Object.assign(id, pendingUpdates);
          }
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === 'taxguard_identities') {
            return { data: store.identities.get(filterVal) || null, error: null };
          }
          if (table === 'taxguard_members') {
            const member = Array.from(store.members.values()).find(
              (m: any) => m.tenant_id === filterVal && m.uid === filterVal2
            );
            return { data: member || null, error: null };
          }
          if (table === 'taxguard_clients') {
            const client = Array.from(store.clients.values()).find(
              (row: any) => row.tenant_id === filterVal && row.owner_uid === filterVal2
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
          if (filterVal && table === 'taxguard_identities') {
            const id = store.identities.get(filterVal);
            if (id) Object.assign(id, updates);
          }
          return builder;
        }),
        then: (resolve: any, reject?: any) => {
          if (table === 'taxguard_staff_assignments') {
            const data = store.assignments.filter(row =>
              filters.every(([column, value]) => row[column] === value)
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

describe('TaxGuard — One-Time Onboarding & Persistent Client Profile & Returning Client Routing', () => {
  let server: Server;
  let origin: string;
  let mockSupabase: ReturnType<typeof createMockSupabaseBackend>;

  beforeEach(async () => {
    mockSupabase = createMockSupabaseBackend();
    setSupabaseAdmin(mockSupabase.client);
    vi.stubEnv('SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key');
    vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
    vi.stubEnv('NODE_ENV', 'production');

    const app = createProductionApp();
    await new Promise<void>((resolve) => {
      server = createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as AddressInfo).port;
        origin = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    setSupabaseAdmin(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('proves one-time onboarding, persistent profile creation, returning client routing to Stage 02, and formal amendment control', async () => {
    // -------------------------------------------------------------
    // STEP 1: INITIAL CLIENT REGISTRATION & SESSION PROVISIONING
    // -------------------------------------------------------------
    const sessionRes = await fetch(`${origin}/api/auth/supabase-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://artaxserv.com'
      },
      body: JSON.stringify({
        accessToken: 'returning_client_jwt',
        name: 'Sarah Elizabeth Jenkins',
        clientType: 'business'
      })
    });

    expect(sessionRes.status).toBe(200);
    const sessionData = await sessionRes.json();
    const token = sessionData.token;
    const clientId = sessionData.clientId;
    expect(token).toMatch(/^tg_live_[a-f0-9]{64}$/);
    expect(clientId).toBe('701');
    expect(sessionData.activeStage).toBe(1);
    expect(sessionData.workflow.stage1.status).toBe('IN_PROGRESS');

    // -------------------------------------------------------------
    // STEP 2: SUBMIT & COMPLETE STAGE 01 ONBOARDING
    // -------------------------------------------------------------
    const stage1Submission = {
      taxYear: 2025,
      completeStage: true,
      payload: {
        legalName: 'Jenkins Architectural Design LLC',
        dbaName: 'Jenkins Design Group',
        taxpayerType: 'entity',
        entityClassification: 'llc',
        tinType: 'ein',
        maskedTIN: 'XX-XXX5432',
        tinLast4: '5432',
        dateOfBirth: '1982-11-24',
        residentialOrPrincipalAddress: {
          street: '400 Gervais Street',
          unit: 'Suite 300',
          city: 'Columbia',
          state: 'SC',
          zip: '29201',
          country: 'United States'
        },
        mailingAddress: {
          street: 'PO Box 8840',
          city: 'Columbia',
          state: 'SC',
          zip: '29202',
          country: 'United States'
        },
        mailingSameAsResidential: false,
        authorizedRep: {
          fullName: 'Sarah Elizabeth Jenkins',
          title: 'Managing Principal & AIA Architect',
          email: 'sarah.jenkins@example.com',
          phone: '803-555-4321',
          relationshipOrCapacity: 'Majority Member / Authorized Officer',
          hasPowerOfAttorney: true
        },
        supportingDocs: [
          {
            id: 'doc_formation_01',
            name: 'Articles_of_Organization_SC_Secretary_of_State.pdf',
            category: 'articles_of_org',
            sha256Hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
            uploadedAt: new Date().toISOString(),
            fileSize: '2.1MB',
            verified: true
          }
        ],
        duplicateCheck: {
          timestamp: new Date().toISOString(),
          status: 'CLEARED',
          matches: [],
          routedToReview: false
        },
        engagementConsent: {
          irc7216ConsentAccepted: true,
          termsAndScopeAccepted: true,
          pricingScheduleAcknowledged: true,
          electronicSignatureConsentAccepted: true,
          signerFullName: 'Sarah Elizabeth Jenkins',
          signedAt: new Date().toISOString(),
          ipAddress: '127.0.0.1',
          consentVersion: '2025.1-IRC7216'
        },
        hardExitGatePassed: true,
        identityComplete: true,
        taxProfileComplete: true,
        tinValid: true,
        addressComplete: true,
        representativeComplete: true,
        supportingDocumentsComplete: true,
        duplicateResolutionComplete: true,
        consentComplete: true,
        reviewComplete: true
      }
    };

    const completeRes = await fetch(`${origin}/api/case-authority/client-onboarding/stage-1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Origin: 'https://artaxserv.com'
      },
      body: JSON.stringify(stage1Submission)
    });

    expect(completeRes.status).toBe(200);
    const completeBody = await completeRes.json();
    expect(completeBody.workflow.stage1.status).toBe('COMPLETED');
    expect(completeBody.workflow.stage2.status).toBe('IN_PROGRESS');
    expect(completeBody.workflow.activeStage).toBe(2);
    expect(completeBody.eligibility.eligibility.stage1).toBe(true);
    expect(completeBody.eligibility.eligibility.stage2).toBe(true);

    // -------------------------------------------------------------
    // STEP 3: RETURNING CLIENT LOGIN (ONE-TIME ONBOARDING INVARIANT)
    // -------------------------------------------------------------
    // Simulate user logging out and logging back in
    const returningRes = await fetch(`${origin}/api/auth/supabase-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://artaxserv.com'
      },
      body: JSON.stringify({
        accessToken: 'returning_client_jwt',
        name: 'Sarah Elizabeth Jenkins'
      })
    });

    expect(returningRes.status).toBe(200);
    const returningBody = await returningRes.json();

    // Verify returning client is recognized as COMPLETED and resumed
    expect(returningBody.resumed).toBe(true);
    expect(returningBody.clientId).toBe(clientId);
    expect(returningBody.user.onboardingStatus).toBe('COMPLETED');
    expect(returningBody.workflow.stage1.status).toBe('COMPLETED');
    expect(returningBody.activeStage).toBe(2);
    expect(returningBody.eligibility.eligibility.stage2).toBe(true);
    expect(returningBody.stageStates.STAGE_01_IDENTITY).toBe('COMPLETED');
    expect(returningBody.stageStates.STAGE_02_DOCUMENTS).toBe('IN_PROGRESS');

    const returningToken = returningBody.token;

    // -------------------------------------------------------------
    // STEP 4: VERIFY COMPLETE AUTHORITATIVE PROFILE (ALL 7 SECTIONS)
    // -------------------------------------------------------------
    const profileRes = await fetch(`${origin}/api/profile/authoritative`, {
      headers: {
        Authorization: `Bearer ${returningToken}`,
        Origin: 'https://artaxserv.com'
      }
    });

    expect(profileRes.status).toBe(200);
    const profile = await profileRes.json();

    expect(profile.clientId).toBe(clientId);
    expect(profile.version).toBe(1);

    // Section 1: Personal / Entity Information
    expect(profile.personal).toBeDefined();
    expect(profile.personal.legalName).toBe('Jenkins Architectural Design LLC');
    expect(profile.personal.taxpayerType).toBe('entity');
    expect(profile.personal.entityClassification).toBe('llc');
    expect(profile.personal.maskedTIN).toBe('XX-XXX5432');
    expect(profile.personal.tinLast4).toBe('5432');
    expect(profile.personal.businessDetails).toBeDefined();
    expect(profile.personal.businessDetails.stateOfIncorporation).toBe('SC');

    // Section 2: Contact Information
    expect(profile.contact).toBeDefined();
    expect(profile.contact.email).toBe('sarah.jenkins@example.com');
    expect(profile.contact.residentialAddress.street).toBe('400 Gervais Street');
    expect(profile.contact.mailingAddress.street).toBe('PO Box 8840');
    expect(profile.contact.communicationPreferences).toBeDefined();

    // Section 3: Authorized Representative
    expect(profile.representative).toBeDefined();
    expect(profile.representative.name).toBe('Sarah Elizabeth Jenkins');
    expect(profile.representative.title).toBe('Managing Principal & AIA Architect');
    expect(profile.representative.authorizationStatus).toBe('ACTIVE');
    expect(profile.representative.hasPowerOfAttorney).toBe(true);

    // Section 4: Identity & Verification
    expect(profile.identity).toBeDefined();
    expect(profile.identity.status).toBe('VERIFIED');
    expect(profile.identity.duplicateCheckStatus).toBe('CLEARED');
    expect(profile.identity.documents.length).toBeGreaterThan(0);

    // Section 5: Engagement
    expect(profile.engagement).toBeDefined();
    expect(profile.engagement.taxYear).toBe(2025);
    expect(profile.engagement.agreementAccepted).toBe(true);
    expect(profile.engagement.feeScheduleAccepted).toBe(true);

    // Section 6: Consent Center
    expect(profile.consentCenter).toBeDefined();
    expect(profile.consentCenter.irc7216ConsentAccepted).toBe(true);
    expect(profile.consentCenter.eSignConsentAccepted).toBe(true);
    expect(profile.consentCenter.consentVersion).toBe('2025.1-IRC7216');

    // Section 7: My Documents
    expect(profile.myDocuments).toBeDefined();
    expect(profile.myDocuments.identityDocuments).toBeDefined();
    expect(profile.myDocuments.onboardingDocuments).toBeDefined();
    expect(profile.myDocuments.engagementDocuments).toBeDefined();

    // -------------------------------------------------------------
    // STEP 5: EDIT ORDINARY PROFILE FIELDS (DIRECT UPDATE)
    // -------------------------------------------------------------
    const ordinaryUpdateRes = await fetch(`${origin}/api/profile/ordinary`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${returningToken}`,
        Origin: 'https://artaxserv.com'
      },
      body: JSON.stringify({
        phone: '803-555-9988',
        mailingAddress: {
          street: '1200 Main Street',
          unit: 'Suite 500',
          city: 'Columbia',
          state: 'SC',
          zip: '29201',
          country: 'United States'
        },
        communicationPreferences: {
          email: true,
          sms: true,
          portal: true
        }
      })
    });

    expect(ordinaryUpdateRes.status).toBe(200);
    const ordinaryBody = await ordinaryUpdateRes.json();
    expect(ordinaryBody.success).toBe(true);
    expect(ordinaryBody.amendedFields.phone).toBe('803-555-9988');
    expect(ordinaryBody.amendedFields.communicationPreferences.sms).toBe(true);

    // -------------------------------------------------------------
    // STEP 6: DEFENSE-IN-DEPTH: DIRECT SENSITIVE EDITS MUST BE BLOCKED
    // -------------------------------------------------------------
    const directSensitiveEditRes = await fetch(`${origin}/api/profile/ordinary`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${returningToken}`,
        Origin: 'https://artaxserv.com'
      },
      body: JSON.stringify({
        legalName: 'Malicious Forged Name LLC',
        tin: '99-9999999'
      })
    });

    expect(directSensitiveEditRes.status).toBe(400);
    const sensitiveErrBody = await directSensitiveEditRes.json();
    expect(sensitiveErrBody.code).toBe('SENSITIVE_FIELD_REQUIRES_FORMAL_AMENDMENT');
    expect(sensitiveErrBody.prohibitedFields).toContain('legalName');

    // -------------------------------------------------------------
    // STEP 7: FORMAL AMENDMENT WORKFLOW WITH CPA REVIEW & AUDIT
    // -------------------------------------------------------------
    const amendmentRequestRes = await fetch(`${origin}/api/profile/amendments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${returningToken}`,
        Origin: 'https://artaxserv.com'
      },
      body: JSON.stringify({
        field: 'legalName',
        fieldLabel: 'Legal Taxpayer Name',
        previousValue: 'Jenkins Architectural Design LLC',
        proposedValue: 'Jenkins & Partners Architecture PLLC',
        reason: 'Partnership restructuring and conversion to PLLC approved by SC Secretary of State.',
        isSensitiveIdentityChange: true
      })
    });

    expect(amendmentRequestRes.status).toBe(201);
    const amendmentReqBody = await amendmentRequestRes.json();
    const amendmentId = amendmentReqBody.amendment.id;
    expect(amendmentReqBody.amendment.disposition).toBe('PENDING');
    expect(amendmentReqBody.amendment.field).toBe('legalName');
    expect(amendmentReqBody.amendment.proposedValue).toBe('Jenkins & Partners Architecture PLLC');

    // Reviewer approval via practice console route
    // Seed staff user for role check
    const reviewerUser = {
      id: 'sb_staff_reviewer_01',
      name: 'Elena Rostova, CPA',
      email: 'erostova@artaxservices.com',
      role: 'senior_reviewer',
      status: 'active',
      isVerified: true,
      createdAt: new Date().toISOString()
    } as any;
    db.users.set('sb_staff_reviewer_01', reviewerUser);
    const clientUser = db.users.get(sessionData.user.id);
    if (clientUser) clientUser.assignedReviewerId = reviewerUser.id;
    if (clientUser?.clientId) {
      db.clientAccountantAssignments.set(`${reviewerUser.id}:${clientUser.clientId}`, {
        id: `${reviewerUser.id}:${clientUser.clientId}`,
        accountantId: reviewerUser.id,
        clientId: clientUser.clientId,
        status: 'active'
      } as any);
      mockSupabase.store.assignments.push({
        tenant_id: 'tenantA',
        client_id: clientUser.clientId,
        user_id: reviewerUser.id,
        status: 'ACTIVE',
        effective_from: new Date(Date.now() - 60_000).toISOString(),
        effective_to: null
      });
    }
    mockSupabase.store.identities.set(reviewerUser.id, {
      uid: reviewerUser.id,
      tenant_id: 'tenantA',
      user_data: reviewerUser
    });
    mockSupabase.store.members.set(`tenantA_${reviewerUser.id}`, {
      tenant_id: 'tenantA',
      uid: reviewerUser.id,
      role: 'senior_reviewer',
      status: 'active'
    });

    const staffSessions = new SupabaseDurableSessions(undefined, 'tenantA');
    const staffSession = await staffSessions.create({
      uid: 'sb_staff_reviewer_01',
      email: 'erostova@artaxservices.com',
      displayName: 'Elena Rostova, CPA',
      authTime: Math.floor(Date.now() / 1000),
      metadata: {
        role: 'senior_reviewer',
        full_name: 'Elena Rostova, CPA'
      }
    });
    const staffToken = staffSession.token;

    const reviewRes = await fetch(`${origin}/api/profile/amendments/${amendmentId}/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
        Origin: 'https://artaxserv.com'
      },
      body: JSON.stringify({
        disposition: 'APPROVED',
        notes: 'SC Secretary of State Certificate of Conversion verified by CPA.'
      })
    });

    expect(reviewRes.status).toBe(200);
    const reviewBody = await reviewRes.json();
    expect(reviewBody.amendment.disposition).toBe('APPROVED');
    expect(reviewBody.amendment.resultingProfileVersion).toBe(2);

    // Verify authoritative profile reflects version 2 and the amended legal name
    const updatedProfileRes = await fetch(`${origin}/api/profile/authoritative`, {
      headers: {
        Authorization: `Bearer ${returningToken}`,
        Origin: 'https://artaxserv.com'
      }
    });

    expect(updatedProfileRes.status).toBe(200);
    const updatedProfile = await updatedProfileRes.json();
    expect(updatedProfile.version).toBe(2);
    expect(updatedProfile.personal.legalName).toBe('Jenkins & Partners Architecture PLLC');
    expect(updatedProfile.contact.phone).toBe('803-555-9988');
    expect(updatedProfile.amendments.length).toBeGreaterThan(0);
    expect(updatedProfile.amendments[0].disposition).toBe('APPROVED');
  });
});
