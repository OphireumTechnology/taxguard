import { useEffect, useRef, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import type { User } from '../types';
import type { StaffDirectoryPage, StaffDirectoryQuery, StaffMemberRecord, StaffInvitationRecord } from '../types/staffAccess';

export type StaffDirectoryStatus = 'loading' | 'ready' | 'empty' | 'unavailable' | 'error';
export function staffSessionKey(user: User | null, auth: string, token: string | null) {
  return JSON.stringify([user?.id, user?.tenantId, user?.clientId, user?.role, user?.status, auth, token]);
}
export function canManageStaff(user: User | null, auth: string, token: string | null) {
  return auth === 'AUTHENTICATED' && user?.status === 'active' && ['admin', 'administrator', 'super_admin', 'super_administrator'].includes(user.role) && Boolean(user.tenantId && token);
}
export function parseStaffDirectory<T extends StaffMemberRecord | StaffInvitationRecord>(page: StaffDirectoryPage<T>, kind: 'members' | 'invitations'): StaffDirectoryPage<T> {
  const identifier = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
  const text = (value: unknown, max = 255) => typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
  const timestamp = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  const nullableId = (value: unknown) => value === null || identifier(value);
  const nullableTime = (value: unknown) => value === null || timestamp(value);
  if (!page || page.source !== 'durable' || !Array.isArray(page.items) || page.items.length > 50 || !(page.nextCursor === null || (typeof page.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(page.nextCursor)))) throw new Error('Invalid staff directory');
  const ids = new Set<string>();
  const items = page.items.map((raw): T => {
    const row = raw as any;
    const id = kind === 'members' ? row?.uid : row?.id;
    const actionNames = kind === 'members' ? ['approve', 'suspend', 'deactivate', 'reactivate'] : ['revoke'];
    if (!row || !identifier(id) || ids.has(id) || !text(row.email) || !text(row.role, 128) || !row.role || !text(row.status,128) || !row.status || !timestamp(row.createdAt) || !row.actions || actionNames.some(action => typeof row.actions[action] !== 'boolean')) throw new Error('Invalid staff directory row');
    ids.add(id);
    if (kind === 'members') {
      if (!text(row.name) || !nullableId(row.invitedBy) || !nullableId(row.approvedBy) || !nullableTime(row.approvedAt) || !nullableId(row.statusChangedBy) || !nullableTime(row.statusChangedAt) || typeof row.mfaReenrollmentRequired !== 'boolean') throw new Error('Invalid member provenance');
      return {uid: row.uid, name: row.name, email: row.email, role: row.role, status: row.status, createdAt: row.createdAt, invitedBy: row.invitedBy, approvedBy: row.approvedBy, approvedAt: row.approvedAt, statusChangedBy: row.statusChangedBy, statusChangedAt: row.statusChangedAt, mfaReenrollmentRequired: row.mfaReenrollmentRequired, actions: {approve: row.actions.approve, suspend: row.actions.suspend, deactivate: row.actions.deactivate, reactivate: row.actions.reactivate}} as T;
    }
    if (!text(row.legalFirstName,128) || !text(row.legalLastName,128) || !timestamp(row.expiresAt) || !['pending','accepted','revoked'].includes(row.status) || !identifier(row.invitedBy) || !nullableId(row.acceptedUid) || !nullableTime(row.acceptedAt) || !nullableId(row.revokedBy) || !nullableTime(row.revokedAt)) throw new Error('Invalid invitation provenance');
    return {id: row.id, email: row.email, role: row.role, legalFirstName: row.legalFirstName, legalLastName: row.legalLastName, status: row.status, createdAt: row.createdAt, expiresAt: row.expiresAt, invitedBy: row.invitedBy, acceptedUid: row.acceptedUid, acceptedAt: row.acceptedAt, revokedBy: row.revokedBy, revokedAt: row.revokedAt, actions: {revoke: row.actions.revoke}} as T;
  });
  return {items, nextCursor: page.nextCursor, source: 'durable'};
}
export function useStaffAccessDirectory(user: User | null, authStatus: string, refresh = 0) {
  const token = getStoredToken();
  const sessionKey = staffSessionKey(user, authStatus, token);
  const allowed = canManageStaff(user, authStatus, token);
  const latest = useRef(sessionKey); latest.current = sessionKey;
  const [kind, setKind] = useState<'members' | 'invitations'>('members');
  const [query, setQuery] = useState<StaffDirectoryQuery>({ limit: 25 });
  const [version, setVersion] = useState(0);
  const queryKey = JSON.stringify([sessionKey, kind, query, refresh, version]);
  const [state, setState] = useState<{key: string; status: StaffDirectoryStatus; items: (StaffMemberRecord | StaffInvitationRecord)[]; nextCursor: string | null}>({key: '', status: 'loading', items: [], nextCursor: null});
  useEffect(() => { setQuery({limit: 25}); }, [sessionKey]);
  useEffect(() => {
    if (!allowed) { setState({key: queryKey, status: 'unavailable', items: [], nextCursor: null}); return; }
    const controller = new AbortController();
    setState({key: queryKey, status: 'loading', items: [], nextCursor: null});
    const request = kind === 'members' ? api.staffAccess.members(query, controller.signal) : api.staffAccess.invitations(query, controller.signal);
    request.then(result => {
      if (controller.signal.aborted || latest.current !== sessionKey || getStoredToken() !== token) return;
      const page = parseStaffDirectory(result as StaffDirectoryPage<StaffMemberRecord | StaffInvitationRecord>, kind);
      setState({key: queryKey, status: page.items.length ? 'ready' : 'empty', items: page.items, nextCursor: page.nextCursor});
    }).catch(error => {
      if (controller.signal.aborted || latest.current !== sessionKey || getStoredToken() !== token) return;
      setState({key: queryKey, status: [403, 503].includes(error?.status) ? 'unavailable' : 'error', items: [], nextCursor: null});
    });
    return () => controller.abort();
  }, [queryKey, allowed]);
  const current = allowed && state.key === queryKey;
  return {allowed, sessionKey, kind, query, status: !allowed ? 'unavailable' as const : current ? state.status : 'loading' as const,
    items: current ? state.items : [], nextCursor: current ? state.nextCursor : null,
    setKind: (value: 'members' | 'invitations') => {setKind(value); setQuery({limit: 25});},
    setStatus: (status: string) => setQuery({limit: query.limit ?? 25, ...(status ? {status} : {})}),
    setLimit: (limit: number) => setQuery({limit: Math.max(1, Math.min(50, Math.floor(limit))), status: query.status}),
    nextPage: () => {if (current && state.nextCursor) setQuery({...query, cursor: state.nextCursor});},
    firstPage: () => setQuery({...query, cursor: undefined}),
    refresh: () => setVersion(value => value + 1)};
}
