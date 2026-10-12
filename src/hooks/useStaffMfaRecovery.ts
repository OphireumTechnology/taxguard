import { useEffect, useRef, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import type { User } from '../types';
import { canManageStaff, staffSessionKey } from './useStaffAccessDirectory';

import type { StaffRecoveryRecord, StaffRecoveryRequestInput, StaffRecoveryReasonCategory, StaffRecoveryQuery } from '../types/staffRecovery';
export type RecoveryCategory = StaffRecoveryReasonCategory;
export type RecoveryRow = StaffRecoveryRecord;
export type RecoveryInput = StaffRecoveryRequestInput;
export const RECOVERY_CATEGORIES: RecoveryCategory[] = ['lost_authenticator', 'compromised_factor', 'device_replacement'];
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !/[\x00-\x1f\x7f]/.test(v);
const time = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
export function normalizeRecoveryInput(input: RecoveryInput): RecoveryInput {
  const targetUid = input.targetUid.trim(), reason = input.reason.trim();
  if (!uuid(input.requestId) || !id(targetUid) || !RECOVERY_CATEGORIES.includes(input.reasonCategory) || !reason || reason.length > 1000 || /[\x00-\x1f\x7f-\x9f]/.test(reason)) throw new Error('Enter a staff UID, recovery category, and recorded reason (up to 1,000 characters).');
  return {requestId: input.requestId, targetUid, reasonCategory: input.reasonCategory, reason};
}
export function parseRecoveryPage(page: any): {items: RecoveryRow[]; nextCursor: string | null; source: 'durable'} {
  if (!page || page.source !== 'durable' || !Array.isArray(page.items) || page.items.length > 50 || !(page.nextCursor === null || typeof page.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(page.nextCursor))) throw new Error('Invalid recovery directory');
  const seen = new Set<string>();
  const items = page.items.map((r: any): RecoveryRow => {
    if (!r || !uuid(r.requestId) || seen.has(r.requestId) || !id(r.targetUid) || !id(r.makerUid) || !(r.checkerUid === null || id(r.checkerUid)) || !(r.targetName === null || text(r.targetName,255)) || !(r.targetRole === null || text(r.targetRole,128)) || !RECOVERY_CATEGORIES.includes(r.reasonCategory) || typeof r.reason !== 'string' || !r.reason.trim() || r.reason.length > 1000 || /[\x00-\x1f\x7f-\x9f]/.test(r.reason) || !['pending_approval','approved'].includes(r.status) || !time(r.createdAt) || !(r.approvedAt === null || time(r.approvedAt)) || !(r.jobId === null || uuid(r.jobId)) || !(r.jobStatus === null || r.jobStatus === 'pending') || r.resetAvailability !== 'unavailable' || typeof r.actions?.approve !== 'boolean') throw new Error('Invalid recovery row');
    if (r.status === 'pending_approval' && (r.checkerUid !== null || r.approvedAt !== null || r.jobId !== null || r.jobStatus !== null)) throw new Error('Invalid pending recovery');
    if (r.status === 'approved' && (!r.checkerUid || !r.approvedAt || !r.jobId || r.jobStatus !== 'pending' || r.jobId !== r.requestId || r.checkerUid === r.makerUid || r.checkerUid === r.targetUid || r.actions.approve)) throw new Error('Invalid approved recovery');
    seen.add(r.requestId);
    return {requestId:r.requestId,targetUid:r.targetUid,targetName:r.targetName,targetRole:r.targetRole,makerUid:r.makerUid,checkerUid:r.checkerUid,reasonCategory:r.reasonCategory,reason:r.reason,status:r.status,createdAt:r.createdAt,approvedAt:r.approvedAt,jobId:r.jobId,jobStatus:r.jobStatus,resetAvailability:'unavailable',actions:{approve:r.actions.approve}};
  });
  return {items,nextCursor:page.nextCursor,source:'durable'};
}
export function validateRecoveryResult(value: any, requestId: string, targetUid: string, status: 'pending_approval' | 'approved') {
  if (!value || value.requestId !== requestId || value.targetUid !== targetUid || value.status !== status || typeof value.resumed !== 'boolean' || value.resetAvailability !== 'unavailable' || (value.jobId !== undefined && !uuid(value.jobId)) || (status === 'approved' && (!uuid(value.jobId) || value.jobId !== requestId))) throw new Error('Unconfirmed recovery action');
}
export function recoveryCanApprove(row: RecoveryRow, actorUid: string | undefined) {
  return Boolean(actorUid && row.status === 'pending_approval' && row.actions.approve === true && row.makerUid !== actorUid && row.targetUid !== actorUid);
}
export function useStaffMfaRecovery(user: User | null, authStatus: string, refresh = 0) {
  const token = getStoredToken(), sessionKey = staffSessionKey(user,authStatus,token), allowed = canManageStaff(user,authStatus,token);
  const latest = useRef(sessionKey); latest.current = sessionKey;
  const [queryState,setQueryState] = useState<{key:string; value:StaffRecoveryQuery}>({key:sessionKey,value:{limit:25}});
  const query: StaffRecoveryQuery = queryState.key === sessionKey ? queryState.value : {limit:25};
  const [version,setVersion] = useState(0);
  const queryKey = JSON.stringify([sessionKey,query,refresh,version]);
  const [state,setState] = useState<{key:string;status:'loading'|'ready'|'empty'|'unavailable'|'error';items:RecoveryRow[];nextCursor:string|null}>({key:'',status:'loading',items:[],nextCursor:null});
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setState({key:queryKey,status:'loading',items:[],nextCursor:null});
    api.staffAccess.recoveries(query,controller.signal).then(value => {
      if (controller.signal.aborted || latest.current !== sessionKey || getStoredToken() !== token) return;
      const page = parseRecoveryPage(value);
      setState({key:queryKey,status:page.items.length ? 'ready':'empty',items:page.items,nextCursor:page.nextCursor});
    }).catch(error => {
      if (controller.signal.aborted || latest.current !== sessionKey || getStoredToken() !== token) return;
      setState({key:queryKey,status:[403,503].includes(error?.status)?'unavailable':'error',items:[],nextCursor:null});
    });
    return () => controller.abort();
  },[queryKey,allowed]);
  const current = allowed && state.key === queryKey;
  return {allowed,sessionKey,query,status:!allowed?'unavailable':current?state.status:'loading',items:current?state.items:[],nextCursor:current?state.nextCursor:null,
    setStatus:(status: StaffRecoveryQuery['status']) => {if (latest.current===sessionKey && getStoredToken()===token) setQueryState({key:sessionKey,value:{limit:query.limit ?? 25,...(status?{status}:{})}});},
    setLimit:(limit:number) => {if (latest.current===sessionKey && getStoredToken()===token) setQueryState({key:sessionKey,value:{limit:Math.min(50,Math.max(1,Math.floor(limit))),status:query.status}});},
    firstPage:() => {if (latest.current===sessionKey && getStoredToken()===token) setQueryState({key:sessionKey,value:{...query,cursor:undefined}});},
    nextPage:() => {if (current && state.nextCursor && latest.current===sessionKey && getStoredToken()===token) setQueryState({key:sessionKey,value:{...query,cursor:state.nextCursor}});},
    refresh:() => {if (latest.current===sessionKey && getStoredToken()===token) setVersion(v=>v+1);}};
}
