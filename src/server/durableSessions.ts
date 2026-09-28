import { createHash, randomBytes } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import type { User } from '../types';
import { formatTaxGuardClientId } from './client-id.service';
import { AuthorityError, safeId } from './taxguard/authority.repository';

const sessionId = (token: string) => createHash('sha256').update(token).digest('hex');
export class DurableSessions {
  constructor(private readonly db: Firestore, private readonly auth: Auth, private readonly tenantId: string) {
    if (!db || !auth) throw new AuthorityError('AUTH_UNAVAILABLE', 503);
    safeId(tenantId);
  }
  async create(decoded: DecodedIdToken) {
    safeId(decoded.uid);
    if (!Number.isFinite(decoded.auth_time) || decoded.auth_time <= 0) throw new AuthorityError('IDENTITY_DENIED', 403);
    const account = await this.auth.getUser(decoded.uid);
    if (account.disabled || !account.email || account.email.toLowerCase() !== decoded.email?.toLowerCase()) throw new AuthorityError('IDENTITY_DENIED', 403);
    const token = 'tg_live_' + randomBytes(32).toString('hex');
    const id = sessionId(token);
    const result = await this.db.runTransaction(async tx => {
      const identityRef = this.db.doc(`taxguardIdentities/${decoded.uid}`);
      const memberRef = this.db.doc(`taxguardTenants/${this.tenantId}/members/${decoded.uid}`);
      const identity = (await tx.get(identityRef)).data();
      const member = (await tx.get(memberRef)).data();
      let user: User;
      if (identity) {
        if (identity.tenantId !== this.tenantId || !member || member.status !== 'active' || identity.user?.status !== 'active' ||
            identity.user?.id !== decoded.uid || identity.user?.role !== member.role ||
            (member.role === 'client' && member.clientId !== identity.user.clientId)) throw new AuthorityError('IDENTITY_DENIED', 403);
        user = identity.user;
      } else {
        // Never silently remap previously issued permanent IDs or staff identities.
        const legacy = (await tx.get(this.db.doc(`users/${decoded.uid}`))).data();
        if (legacy?.clientId || (legacy?.role && legacy.role !== 'client') || member) throw new AuthorityError('IDENTITY_MIGRATION_REQUIRED', 409);
        if (legacy?.status && legacy.status !== 'active') throw new AuthorityError('IDENTITY_DENIED', 403);
        const counterRef = this.db.doc('system/taxguard_client_id_sequence');
        const counter = (await tx.get(counterRef)).data();
        const current = counter?.currentSequence ?? 0;
        if (!Number.isSafeInteger(current) || current < 0) throw new AuthorityError('INVALID_CLIENT_SEQUENCE', 503);
        const next = current + 1;
        const clientId = formatTaxGuardClientId(next);
        user = { id: decoded.uid, clientId, email: account.email!, name: account.displayName || account.email!, role: 'client',
          status: 'active', isVerified: account.emailVerified, createdAt: new Date().toISOString() };
        tx.set(counterRef, { currentSequence: next, lastIssuedClientId: clientId }, { merge: true });
        tx.create(identityRef, { tenantId: this.tenantId, user });
        tx.create(memberRef, { role: 'client', status: 'active', clientId });
        tx.create(this.db.doc(`taxguardTenants/${this.tenantId}/clients/${clientId}`), { ownerUid: decoded.uid, clientId });
      }
      tx.create(this.db.doc(`taxguardSessions/${id}`), { uid: decoded.uid, tenantId: this.tenantId,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000, authTime: decoded.auth_time, revoked: false });
      tx.create(this.db.doc(`taxguardTenants/${this.tenantId}/authAudit/${id}`), { action: 'SESSION_CREATED', actorUid: decoded.uid, timestamp: new Date().toISOString() });
      return user;
    });
    return { token, user: result, clientId: result.clientId, environment: 'live', externalSubmissionEnabled: false };
  }
  async verify(token: string): Promise<User | null> {
    if (!/^tg_live_[a-f0-9]{64}$/.test(token)) return null;
    const session = (await this.db.doc(`taxguardSessions/${sessionId(token)}`).get()).data();
    if (!session || session.tenantId !== this.tenantId || session.revoked || !(session.expiresAt > Date.now()) || !Number.isFinite(session.authTime)) return null;
    const account = await this.auth.getUser(session.uid);
    if (account.disabled || session.authTime * 1000 < Date.parse(account.tokensValidAfterTime || '1970-01-01')) return null;
    const identity = (await this.db.doc(`taxguardIdentities/${session.uid}`).get()).data();
    const member = (await this.db.doc(`taxguardTenants/${this.tenantId}/members/${session.uid}`).get()).data();
    if (!identity || identity.tenantId !== this.tenantId || identity.user?.id !== session.uid || identity.user?.status !== 'active' ||
        !member || member.status !== 'active' || identity.user.role !== member.role ||
        (member.role === 'client' && member.clientId !== identity.user.clientId)) return null;
    return identity.user as User;
  }
  async revoke(token: string) {
    if (!/^tg_live_[a-f0-9]{64}$/.test(token)) return;
    const ref = this.db.doc(`taxguardSessions/${sessionId(token)}`);
    await this.db.runTransaction(async tx => {
      const session = (await tx.get(ref)).data();
      if (!session || session.tenantId !== this.tenantId || session.revoked) return;
      tx.update(ref, { revoked: true });
      tx.create(this.db.doc(`taxguardTenants/${this.tenantId}/authAudit/logout_${sessionId(token)}`), {
        action: 'SESSION_REVOKED', actorUid: session.uid, timestamp: new Date().toISOString(),
      });
    });
  }
}
