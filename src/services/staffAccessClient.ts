import type { StaffRecoveryQuery, StaffRecoveryPage, StaffRecoveryRequestInput, StaffRecoveryMutationResult } from '../types/staffRecovery';
import type { StaffDirectoryQuery, StaffDirectoryPage, StaffMemberRecord, StaffInvitationRecord, StaffInvitationIssueInput, StaffInvitationIssueResult, StaffMembershipAction } from '../types/staffAccess';
import type { DurableSessionList, SessionRevocationReason } from '../types/staffSessions';
import { isStaffIdentityDevelopmentConfigured } from '../supabase/config';
import { apiEndpoint } from '../config/apiEndpoint';

function staffDirectoryQuery(query: StaffDirectoryQuery | StaffRecoveryQuery): string {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.status !== undefined) params.set('status', query.status);
  if (query.cursor !== undefined) params.set('cursor', query.cursor);
  const suffix = params.toString(); return suffix ? '?' + suffix : '';
}

export function createStaffAccessClient(getToken: () => string | null) {
  async function staffAccessRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const deny = (code: string, status: number): never => { throw Object.assign(new Error('Staff management is unavailable for this session or environment.'), { code, status }); };
    const token = getToken();
    if (!token) return deny('AUTH_REQUIRED', 401);
    if (!isStaffIdentityDevelopmentConfigured()) return deny('STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE', 503);
    const url = apiEndpoint(endpoint);
    const target = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1');
    if (['api.artaxserv.com', 'artaxserv.com', 'www.artaxserv.com'].includes(target.hostname)) return deny('STAFF_ACCESS_DEVELOPMENT_UNAVAILABLE', 503);
    const response = await fetch(url, { ...options, cache: 'no-store', credentials: 'omit', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-session-token': token } });
    const data: unknown = await response.json().catch(() => undefined);
    if (getToken() !== token) return deny('SESSION_CHANGED', 401);
    if (!response.ok) {
      const error = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      throw Object.assign(new Error(typeof error.error === 'string' ? error.error : 'The staff service refused the request.'), { status: response.status, code: error.code });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return deny('INVALID_API_RESPONSE', 502);
    return data as T;
  }
  return {
    recoveries: (query: StaffRecoveryQuery = {}, signal?: AbortSignal) => staffAccessRequest<StaffRecoveryPage>('/api/staff-access/mfa-recoveries' + staffDirectoryQuery(query), { method: 'GET', signal }),
    requestRecovery: (input: StaffRecoveryRequestInput, signal?: AbortSignal) => staffAccessRequest<StaffRecoveryMutationResult>('/api/staff-access/mfa-recoveries', { method: 'POST', body: JSON.stringify(input), signal }),
    approveRecovery: (requestId: string, signal?: AbortSignal) => staffAccessRequest<StaffRecoveryMutationResult>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/approve', { method: 'POST', signal }),
    // Proposal 034/037: completion, cancellation, failed-reset re-queue and audit history.
    completeRecovery: (requestId: string, signal?: AbortSignal) => staffAccessRequest<{requestId: string; targetUid: string; status: 'completed'; resumed: boolean}>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/complete', { method: 'POST', signal }),
    cancelRecovery: (requestId: string, reason: string, signal?: AbortSignal) => staffAccessRequest<{requestId: string; targetUid: string; status: 'cancelled'}>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/cancel', { method: 'POST', body: JSON.stringify({reason}), signal }),
    retryRecovery: (requestId: string, signal?: AbortSignal) => staffAccessRequest<{jobId: string; status: 'pending'}>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/retry', { method: 'POST', signal }),
    recoveryHistory: (requestId: string, signal?: AbortSignal) => staffAccessRequest<{requestId: string; targetUid: string; items: Array<{action: string; actorUid: string; actorRole: string | null; at: string; details: Record<string, unknown>}>}>('/api/staff-access/mfa-recoveries/' + encodeURIComponent(requestId) + '/history', { method: 'GET', signal }),
    sessions: (signal?: AbortSignal) => staffAccessRequest<DurableSessionList>('/api/staff-access/sessions', { method: 'GET', signal }),
    securityEvents: (signal?: AbortSignal) => staffAccessRequest<{items: Array<{action: string; actorUid: string; actorRole: string | null; at: string; byAdministrator: boolean; details: Record<string, unknown>}>}>('/api/staff-access/sessions/events', { method: 'GET', signal }),
    revokeSession: (sessionId: string, signal?: AbortSignal) => staffAccessRequest<{revoked: boolean}>('/api/staff-access/sessions/' + encodeURIComponent(sessionId) + '/revoke', { method: 'POST', signal }),
    revokeOtherSessions: (signal?: AbortSignal) => staffAccessRequest<{revokedSessions: number}>('/api/staff-access/sessions/revoke-others', { method: 'POST', signal }),
    revokeMemberSessions: (uid: string, reasonCategory: SessionRevocationReason, signal?: AbortSignal) => staffAccessRequest<{revokedSessions: number}>('/api/staff-access/members/' + encodeURIComponent(uid) + '/sessions/revoke', { method: 'POST', body: JSON.stringify({reasonCategory}), signal }),
    members: (query: StaffDirectoryQuery = {}, signal?: AbortSignal) => staffAccessRequest<StaffDirectoryPage<StaffMemberRecord>>('/api/staff-access/members' + staffDirectoryQuery(query), { method: 'GET', signal }),
    invitations: (query: StaffDirectoryQuery = {}, signal?: AbortSignal) => staffAccessRequest<StaffDirectoryPage<StaffInvitationRecord>>('/api/staff-access/invitations' + staffDirectoryQuery(query), { method: 'GET', signal }),
    createInvitation: (input: StaffInvitationIssueInput, signal?: AbortSignal) => staffAccessRequest<StaffInvitationIssueResult>('/api/staff-access/invitations', { method: 'POST', body: JSON.stringify(input), signal }),
    revokeInvitation: (id: string, signal?: AbortSignal) => staffAccessRequest<{status: 'revoked'}>('/api/staff-access/invitations/' + encodeURIComponent(id) + '/revoke', { method: 'POST', signal }),
    approveMember: (uid: string, signal?: AbortSignal) => staffAccessRequest<{status: 'active'}>('/api/staff-access/members/' + encodeURIComponent(uid) + '/approve', { method: 'POST', signal }),
    changeMemberStatus: (uid: string, action: StaffMembershipAction, reason: string, signal?: AbortSignal) => staffAccessRequest<{status: string; revokedSessions: number}>('/api/staff-access/members/' + encodeURIComponent(uid) + '/status', { method: 'POST', body: JSON.stringify({action, reason}), signal }),
  };
}
