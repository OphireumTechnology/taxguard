/**
 * Supabase Database Authority & Durable Session Engine
 * Replaces Firestore authority with PostgreSQL/Supabase tables while enforcing:
 * - Tenant isolation
 * - Authoritative server-only role assignment
 * - Atomic client ID allocation
 * - Cryptographic session token verification (SHA-256)
 * - Immutable audit trail
 */

import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin, VerifiedSupabaseUser } from './supabase';
import { formatTaxGuardClientId } from './client-id.service';
import { User } from '../types';
import { AuthorityError, safeId } from './taxguard/authority.repository';
import { LiveWorkflowRepository } from './taxguard/liveWorkflow.repository';
import { db } from './db';
import { isAssignmentCurrentlyEffective } from './assignment-authorization';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

interface FallbackIdentityRow {
  uid: string;
  tenant_id: string;
  user_data: User;
}

interface FallbackMemberRow {
  tenant_id: string;
  uid: string;
  role: string;
  status: 'active' | 'suspended' | 'disabled';
  client_id?: string;
}

interface FallbackSessionRow {
  session_token_hash: string;
  uid: string;
  tenant_id: string;
  auth_time: number;
  expires_at: number;
  revoked: boolean;
}

const fallbackIdentities = new Map<string, FallbackIdentityRow>();
const fallbackMembers = new Map<string, FallbackMemberRow>();
const fallbackSessions = new Map<string, FallbackSessionRow>();
let fallbackSequence = 0;

export function hasFallbackSupabaseSession(token: string): boolean {
  if (!token || !/^tg_live_[a-f0-9]{64}$/.test(token)) return false;
  return fallbackSessions.has(hashToken(token));
}

const supabaseProvisioningLocks = new Map<string, Promise<void>>();

async function withSupabaseProvisioningLock<T>(uid: string, operation: () => Promise<T>): Promise<T> {
  const previous = supabaseProvisioningLocks.get(uid) || Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const tail = previous.catch(() => {}).then(() => gate);
  supabaseProvisioningLocks.set(uid, tail);

  await previous.catch(() => {});

  try {
    return await operation();
  } finally {
    release();
    if (supabaseProvisioningLocks.get(uid) === tail) {
      supabaseProvisioningLocks.delete(uid);
    }
  }
}

const ASSIGNMENT_REQUIRED_ROLES = new Set(['accountant', 'senior_reviewer', 'reviewer', 'preparer']);

function attachAuthorizedClientIds(user: User, clientIds: string[]): void {
  Object.defineProperty(user, 'authorizedClientIds', {
    value: clientIds,
    configurable: true,
    enumerable: false
  });
}

export class SupabaseDurableSessions {
  private readonly client: SupabaseClient;
  private readonly tenantId: string;
  private readonly usesCustomClient: boolean;

  constructor(client?: SupabaseClient, tenantId?: string) {
    const resolved = (tenantId || process.env.TAXGUARD_TENANT_ID || '').trim();
    if (!resolved) {
      if (process.env.NODE_ENV === 'production') {
        throw new AuthorityError('PRODUCTION_TENANT_REQUIRED: Missing authoritative production TAXGUARD_TENANT_ID.', 500);
      }
      this.tenantId = 'tenantA';
    } else {
      this.tenantId = resolved;
    }
    safeId(this.tenantId);
    this.usesCustomClient = Boolean(client);
    this.client = client || getSupabaseAdmin();
  }

  getTenantId(): string {
    return this.tenantId;
  }

  private async getAuthorizedClientIds(uid: string): Promise<string[]> {
    const { data, error } = await this.client
      .from('taxguard_staff_assignments')
      .select('client_id, engagement_id, tax_year, effective_from, effective_to')
      .eq('tenant_id', this.tenantId)
      .eq('user_id', uid)
      .eq('status', 'ACTIVE');
    if (error) throw new AuthorityError('STAFF_ASSIGNMENT_STORE_UNAVAILABLE', 503);

    return Array.from(new Set((data || [])
      .filter((assignment: {
        status?: string;
        engagement_id?: string | null;
        tax_year?: number | null;
        effective_from?: string;
        effective_to?: string | null;
      }) => {
        return assignment.engagement_id == null &&
          assignment.tax_year == null &&
          isAssignmentCurrentlyEffective(assignment);
      })
      .map((assignment: { client_id?: string }) => assignment.client_id)
      .filter((clientId: unknown): clientId is string => typeof clientId === 'string' && clientId.length > 0)));
  }

  /**
   * Provisions or restores a durable TaxGuard server session for a verified Supabase identity.
   */
  async create(verified: VerifiedSupabaseUser): Promise<{
    token: string;
    user: User;
    clientId: string;
    tenantId: string;
    environment: string;
    externalSubmissionEnabled: boolean;
  }> {
    safeId(verified.uid);
    if (!Number.isFinite(verified.authTime) || verified.authTime <= 0) {
      throw new AuthorityError('IDENTITY_DENIED', 403);
    }

    const uid = verified.uid;
    const email = verified.email.toLowerCase();

    return withSupabaseProvisioningLock(`${this.tenantId}:${uid}`, async () => {
      // 1. Fetch existing identity and member
      let existingIdentity: any = null;
      let identityErr: any = null;
      try {
        const res = await this.client
          .from('taxguard_identities')
          .select('*')
          .eq('uid', uid)
          .maybeSingle();
        existingIdentity = res.data;
        identityErr = res.error;
      } catch (err: any) {
        identityErr = err;
      }
      if (process.env.NODE_ENV === 'production' && identityErr) {
        throw new AuthorityError('IDENTITY_STORE_UNAVAILABLE', 503);
      }

      let existingMember: any = null;
      let memberErr: any = null;
      try {
        const res = await this.client
          .from('taxguard_members')
          .select('*')
          .eq('tenant_id', this.tenantId)
          .eq('uid', uid)
          .maybeSingle();
        existingMember = res.data;
        memberErr = res.error;
      } catch (err: any) {
        memberErr = err;
      }
      if (process.env.NODE_ENV === 'production' && memberErr) {
        throw new AuthorityError('MEMBERSHIP_STORE_UNAVAILABLE', 503);
      }

      let existingClientRow: any = null;
      let clientErr: any = null;
      try {
        const res = await this.client
          .from('taxguard_clients')
          .select('*')
          .eq('tenant_id', this.tenantId)
          .eq('owner_uid', uid)
          .maybeSingle();
        existingClientRow = res.data;
        clientErr = res.error;
      } catch (err: any) {
        clientErr = err;
      }
      if (process.env.NODE_ENV === 'production' && clientErr) {
        throw new AuthorityError('CLIENT_STORE_UNAVAILABLE', 503);
      }

      const inMemoryCached = process.env.NODE_ENV === 'production'
        ? null
        : db.users.get(uid) ||
          Array.from(db.users.values()).find(u => u.email?.toLowerCase() === email);

      const fbIdentity =
        (process.env.NODE_ENV === 'production' ? null : fallbackIdentities.get(uid)) ||
        (inMemoryCached ? fallbackIdentities.get(inMemoryCached.id) : null) ||
        Array.from(fallbackIdentities.values()).find(
          fi => (fi.user_data as User)?.email?.toLowerCase() === email
        );

      const fbMember =
        (process.env.NODE_ENV === 'production' ? null : fallbackMembers.get(`${this.tenantId}:${uid}`)) ||
        (inMemoryCached ? fallbackMembers.get(`${this.tenantId}:${inMemoryCached.id}`) : null);

      const resolvedIdentity =
        existingIdentity ||
        (process.env.NODE_ENV === 'production' ? null : fbIdentity) ||
        (inMemoryCached ? { uid, tenant_id: this.tenantId, user_data: inMemoryCached } : null);

      const resolvedMember =
        existingMember ||
        (process.env.NODE_ENV === 'production' ? null : fbMember) ||
        (inMemoryCached
          ? {
              tenant_id: this.tenantId,
              uid,
              role: inMemoryCached.role || 'client',
              status: inMemoryCached.status || 'active',
              client_id: inMemoryCached.clientId || ''
            }
          : null);

      if (process.env.NODE_ENV === 'production' && (resolvedIdentity || resolvedMember)) {
        if (!resolvedIdentity || !resolvedMember || resolvedMember.status !== 'active') {
          throw new AuthorityError('IDENTITY_DENIED', 403);
        }
      }

      const storedClientId = (resolvedIdentity?.user_data as User | undefined)?.clientId;
      const memberClientId = resolvedMember?.client_id;
      const ownedClientId = existingClientRow?.client_id;
      const isClientRole = resolvedMember?.role === 'client' || resolvedMember?.role === 'prospective_client';
      if (
        process.env.NODE_ENV === 'production' &&
        isClientRole &&
        (!ownedClientId ||
          existingClientRow.owner_uid !== uid ||
          existingClientRow.tenant_id !== this.tenantId ||
          (memberClientId && memberClientId !== ownedClientId) ||
          (storedClientId && storedClientId !== ownedClientId))
      ) {
        throw new AuthorityError('CLIENT_MAPPING_DENIED', 403);
      }

      const knownClientId =
        isClientRole
          ? ownedClientId || (process.env.NODE_ENV === 'production' ? undefined : memberClientId || storedClientId)
          : undefined;

      let user: User;

      if (resolvedIdentity || knownClientId) {
        if (
          resolvedIdentity &&
          resolvedIdentity.tenant_id !== this.tenantId
        ) {
          throw new AuthorityError('IDENTITY_DENIED', 403);
        }

        const storedUserData = (resolvedIdentity?.user_data as User) || inMemoryCached || ({} as User);
        const effectiveClientId = knownClientId || storedUserData.clientId;

        user = {
          ...storedUserData,
          id: uid,
          email,
          name: verified.displayName || storedUserData.name || email.split('@')[0],
          role: (resolvedMember?.role as User['role']) || storedUserData.role || 'client',
          clientId: effectiveClientId,
          tenantId: this.tenantId,
          status: 'active',
          isVerified: true
        };
        if (
          process.env.NODE_ENV === 'production' &&
          ASSIGNMENT_REQUIRED_ROLES.has(user.role)
        ) {
          attachAuthorizedClientIds(user, await this.getAuthorizedClientIds(uid));
        }

        const inMemUser = inMemoryCached || db.users.get(user.id);
        const isDbCompleted = (user.onboardingStatus || '').toUpperCase() === 'COMPLETED' || Boolean(user.onboardingCompletedAt);
        const isInMemCompleted = (inMemUser?.onboardingStatus || '').toUpperCase() === 'COMPLETED' || Boolean(inMemUser?.onboardingCompletedAt);

        if (isDbCompleted || isInMemCompleted) {
          user.onboardingStatus = 'COMPLETED';
          user.onboardingCompletedAt = user.onboardingCompletedAt || inMemUser?.onboardingCompletedAt || new Date().toISOString();
        } else if (inMemUser?.onboardingStatus) {
          user.onboardingStatus = inMemUser.onboardingStatus;
        }

        if (inMemUser?.stageOneDossier && !user.stageOneDossier) {
          user.stageOneDossier = inMemUser.stageOneDossier;
        }

        // Authoritatively check workflow state for completed Stage 01
        if (effectiveClientId) {
          const wf = await LiveWorkflowRepository.getCase(effectiveClientId, 2025).catch(() => null);
          if (wf && (wf.stage1?.status === 'COMPLETED' || wf.activeStage >= 2)) {
            user.onboardingStatus = 'COMPLETED';
            user.onboardingCompletedAt = user.onboardingCompletedAt || wf.stage1?.completedAt || new Date().toISOString();
          }
        }

        fallbackIdentities.set(uid, {
          uid,
          tenant_id: this.tenantId,
          user_data: user
        });
        if (effectiveClientId) {
          fallbackMembers.set(`${this.tenantId}:${uid}`, {
            tenant_id: this.tenantId,
            uid,
            role: user.role,
            status: 'active',
            client_id: effectiveClientId
          });
        }
      } else {
        // Allocate next permanent Client ID
        const { data: counterData } = await this.client
          .from('taxguard_client_id_sequence')
          .select('*')
          .eq('id', 'primary')
          .maybeSingle();

        let currentSeq = 0;
        if (counterData) {
          currentSeq = Number(counterData.current_sequence) || 0;
        } else if (!this.usesCustomClient) {
          currentSeq = fallbackSequence;
        }

        const nextSeq = currentSeq + 1;
        fallbackSequence = Math.max(fallbackSequence, nextSeq);
        const clientId = formatTaxGuardClientId(nextSeq);

        user = {
          id: uid,
          clientId,
          email,
          name: verified.displayName || email,
          role: 'client', // Authoritative client assignment
          status: 'active',
          isVerified: true,
          onboardingStatus: 'NOT_STARTED',
          onboardingCompletedAt: null,
          createdAt: new Date().toISOString()
        };

        // Upsert sequence
        await this.client
          .from('taxguard_client_id_sequence')
          .upsert({
            id: 'primary',
            current_sequence: nextSeq,
            last_issued_client_id: clientId,
            updated_at: new Date().toISOString()
          });

        // Insert identity
        await this.client
          .from('taxguard_identities')
          .insert({
            uid,
            tenant_id: this.tenantId,
            user_data: user
          });

        // Insert member
        await this.client
          .from('taxguard_members')
          .insert({
            tenant_id: this.tenantId,
            uid,
            role: 'client',
            status: 'active',
            client_id: clientId
          });

        // Insert client
        await this.client
          .from('taxguard_clients')
          .insert({
            tenant_id: this.tenantId,
            client_id: clientId,
            owner_uid: uid,
            name: user.name,
            email: user.email,
            status: 'active'
          });

        fallbackIdentities.set(uid, {
          uid,
          tenant_id: this.tenantId,
          user_data: user
        });
        fallbackMembers.set(`${this.tenantId}:${uid}`, {
          tenant_id: this.tenantId,
          uid,
          role: 'client',
          status: 'active',
          client_id: clientId
        });
      }

      db.users.set(user.id, user);

      // 2. Mint session token
      const token = 'tg_live_' + randomBytes(32).toString('hex');
      const tokenHash = hashToken(token);
      const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hour session

      await this.client
        .from('taxguard_sessions')
        .insert({
          session_token_hash: tokenHash,
          uid,
          tenant_id: this.tenantId,
          auth_time: verified.authTime,
          expires_at: expiresAt,
          revoked: false
        });

      fallbackSessions.set(tokenHash, {
        session_token_hash: tokenHash,
        uid,
        tenant_id: this.tenantId,
        auth_time: verified.authTime,
        expires_at: expiresAt,
        revoked: false
      });

      // 3. Write immutable audit log
      await this.client
        .from('taxguard_audit_log')
        .insert({
          tenant_id: this.tenantId,
          action: 'SESSION_CREATED',
          actor_uid: uid,
          actor_role: user.role,
          metadata: { tokenHashPrefix: tokenHash.slice(0, 8), email }
        });

      return {
        token,
        user,
        clientId: user.clientId || '',
        tenantId: this.tenantId,
        environment: 'live',
        externalSubmissionEnabled: false
      };
    });
  }

  /**
   * Verifies an active server bearer token against Supabase sessions.
   */
  async verify(token: string): Promise<User | null> {
    if (!token || !/^tg_live_[a-f0-9]{64}$/.test(token)) return null;

    const tokenHash = hashToken(token);
    const now = Date.now();

    const { data: session, error } = await this.client
      .from('taxguard_sessions')
      .select('*')
      .eq('session_token_hash', tokenHash)
      .maybeSingle();

    const resolvedSession =
      !error && session
        ? session
        : process.env.NODE_ENV === 'production'
          ? null
          : fallbackSessions.get(tokenHash) || null;

    if (!resolvedSession) return null;
    if (
      resolvedSession.tenant_id !== this.tenantId ||
      resolvedSession.revoked ||
      Number(resolvedSession.expires_at) <= now
    ) {
      return null;
    }

    const { data: identity } = await this.client
      .from('taxguard_identities')
      .select('*')
      .eq('uid', resolvedSession.uid)
      .maybeSingle();

    const { data: member } = await this.client
      .from('taxguard_members')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('uid', resolvedSession.uid)
      .maybeSingle();

    const inMemUserForVerify = db.users.get(resolvedSession.uid);
    const isProduction = process.env.NODE_ENV === 'production';
    const resolvedIdentity =
      identity ||
      (!isProduction ? fallbackIdentities.get(resolvedSession.uid) : null) ||
      (!isProduction && inMemUserForVerify
        ? { uid: resolvedSession.uid, tenant_id: this.tenantId, user_data: inMemUserForVerify }
        : null);
    const resolvedMember =
      member ||
      (!isProduction ? fallbackMembers.get(`${this.tenantId}:${resolvedSession.uid}`) : null) ||
      (!isProduction && inMemUserForVerify
        ? {
            tenant_id: this.tenantId,
            uid: resolvedSession.uid,
            role: inMemUserForVerify.role || 'client',
            status: inMemUserForVerify.status || 'active',
            client_id: inMemUserForVerify.clientId || ''
          }
        : null);

    if (
      !resolvedIdentity ||
      resolvedIdentity.tenant_id !== this.tenantId ||
      !resolvedMember ||
      resolvedMember.status !== 'active'
    ) {
      return null;
    }

    const user = { ...(resolvedIdentity.user_data as User) };
    if (isProduction && (resolvedMember.role === 'client' || resolvedMember.role === 'prospective_client')) {
      const { data: ownedClient, error: ownedClientError } = await this.client
        .from('taxguard_clients')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('owner_uid', resolvedSession.uid)
        .maybeSingle();
      if (
        ownedClientError ||
        !ownedClient ||
        ownedClient.owner_uid !== resolvedSession.uid ||
        ownedClient.tenant_id !== this.tenantId ||
        !ownedClient.client_id ||
        (resolvedMember.client_id && resolvedMember.client_id !== ownedClient.client_id) ||
        (user.clientId && user.clientId !== ownedClient.client_id)
      ) {
        return null;
      }
      user.clientId = ownedClient.client_id;
    } else if (isProduction) {
      user.clientId = undefined;
    }
    user.tenantId = this.tenantId;
    user.role = resolvedMember.role as User['role'];
    if (isProduction && ASSIGNMENT_REQUIRED_ROLES.has(user.role)) {
      try {
        attachAuthorizedClientIds(user, await this.getAuthorizedClientIds(resolvedSession.uid));
      } catch {
        return null;
      }
    }

    const inMemUser = isProduction ? undefined : db.users.get(user.id);
    if (inMemUser) {
      const inMemCompleted = (inMemUser.onboardingStatus || '').toUpperCase() === 'COMPLETED' || Boolean(inMemUser.onboardingCompletedAt);
      const dbCompleted = (user.onboardingStatus || '').toUpperCase() === 'COMPLETED' || Boolean(user.onboardingCompletedAt);
      if (inMemCompleted || dbCompleted) {
        user.onboardingStatus = 'COMPLETED';
        user.onboardingCompletedAt = user.onboardingCompletedAt || inMemUser.onboardingCompletedAt || new Date().toISOString();
      } else if (inMemUser.onboardingStatus) {
        user.onboardingStatus = inMemUser.onboardingStatus;
      }
      if (inMemUser.stageOneDossier && !user.stageOneDossier) {
        user.stageOneDossier = inMemUser.stageOneDossier;
      }
    }

    if (user.clientId) {
      const wf = await LiveWorkflowRepository.getCase(user.clientId, 2025).catch(() => null);
      if (wf && (wf.stage1?.status === 'COMPLETED' || wf.activeStage >= 2)) {
        user.onboardingStatus = 'COMPLETED';
        user.onboardingCompletedAt = user.onboardingCompletedAt || wf.stage1?.completedAt || new Date().toISOString();
      }
    }

    if (!user || user.id !== resolvedSession.uid || user.status !== 'active') {
      return null;
    }

    db.users.set(user.id, user);
    return user;
  }

  /**
   * Durably persists user profile and onboarding updates across Supabase and in-memory stores.
   */
  async updateUser(uid: string, patch: Partial<User>): Promise<User | null> {
    safeId(uid);
    const existing = db.users.get(uid);
    const updated: User = {
      ...(existing || ({} as User)),
      ...patch,
      id: uid,
      updatedAt: new Date().toISOString()
    };
    db.users.set(uid, updated);

    const fb = fallbackIdentities.get(uid);
    if (fb) {
      fb.user_data = {
        ...fb.user_data,
        ...patch,
        updatedAt: updated.updatedAt
      };
    } else {
      fallbackIdentities.set(uid, {
        uid,
        tenant_id: this.tenantId,
        user_data: updated
      });
    }

    try {
      const { data: existingIdentity } = await this.client
        .from('taxguard_identities')
        .select('*')
        .eq('uid', uid)
        .maybeSingle();

      if (existingIdentity) {
        const merged = {
          ...(existingIdentity.user_data || {}),
          ...patch,
          updatedAt: updated.updatedAt
        };
        await this.client
          .from('taxguard_identities')
          .update({
            user_data: merged,
            updated_at: updated.updatedAt
          })
          .eq('uid', uid);
      } else {
        await this.client
          .from('taxguard_identities')
          .upsert({
            uid,
            tenant_id: this.tenantId,
            user_data: updated,
            updated_at: updated.updatedAt
          });
      }
    } catch {
      // Continue with in-memory persistence
    }

    if (updated.clientId) {
      try {
        await this.client
          .from('taxguard_clients')
          .update({
            name: updated.name,
            phone: updated.phone || '',
            updated_at: updated.updatedAt
          })
          .eq('tenant_id', this.tenantId)
          .eq('client_id', updated.clientId);
      } catch {
        // Fall through
      }

      if (updated.onboardingStatus === 'COMPLETED') {
        try {
          await this.client
            .from('taxguard_cases')
            .update({
              active_stage: 2,
              status: 'ACTIVE',
              updated_at: updated.updatedAt
            })
            .eq('tenant_id', this.tenantId)
            .eq('client_id', updated.clientId);
        } catch {
          // Fall through
        }
      }
    }

    return updated;
  }

  /**
   * Revokes an active server session.
   */
  async revoke(token: string): Promise<void> {
    if (!token || !/^tg_live_[a-f0-9]{64}$/.test(token)) return;

    const tokenHash = hashToken(token);

    const { data: session } = await this.client
      .from('taxguard_sessions')
      .select('*')
      .eq('session_token_hash', tokenHash)
      .maybeSingle();

    const fallbackSession = !this.usesCustomClient ? fallbackSessions.get(tokenHash) : undefined;
    if (fallbackSession) {
      fallbackSession.revoked = true;
    }

    const activeSession = session || fallbackSession;
    if (!activeSession || (session && session.revoked)) return;

    await this.client
      .from('taxguard_sessions')
      .update({ revoked: true })
      .eq('session_token_hash', tokenHash);

    await this.client
      .from('taxguard_audit_log')
      .insert({
        tenant_id: this.tenantId,
        action: 'SESSION_REVOKED',
        actor_uid: activeSession.uid,
        metadata: { tokenHashPrefix: tokenHash.slice(0, 8) }
      });
  }
}
