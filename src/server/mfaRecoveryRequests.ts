import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import { AuthorityError, safeId } from './taxguard/authority.repository';
import { requireStaffAdministrator } from './staffAccessPolicy';
export type MfaRecoveryReason = 'lost_authenticator' | 'compromised_factor' | 'device_replacement';
export interface MfaRecoveryRequest { requestId: string; targetUid: string; status: 'pending_approval' | 'approved'; resumed: boolean; jobId?: string; resetAvailability: 'unavailable' }
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const invalid = () => new AuthorityError('MFA_RECOVERY_INPUT_INVALID',400);
const unavailable = () => new AuthorityError('MFA_RECOVERY_STORE_UNAVAILABLE',503);
function proof(actor: User, tenant: string, verifiedApplicationToken: string) {
  requireStaffAdministrator(actor,tenant);
  if (typeof verifiedApplicationToken !== 'string' || !/^tg_live_[a-f0-9]{64}$/.test(verifiedApplicationToken)) throw invalid();
  return createHash('sha256').update(verifiedApplicationToken).digest('hex');
}
function requestInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) throw invalid();
  const values: Record<string,unknown> = {};
  const keys=Reflect.ownKeys(input);const allowed=['requestId','targetUid','reasonCategory','reason'];
  if (keys.length!==allowed.length || keys.some(key=>typeof key!=='string' || !allowed.includes(key))) throw invalid();
  for(const key of allowed) {const descriptor=Object.getOwnPropertyDescriptor(input,key);if(!descriptor || !Object.hasOwn(descriptor,'value')) throw invalid();values[key]=descriptor.value;}
  if (!uuid(values.requestId) || typeof values.targetUid!=='string' || typeof values.reasonCategory!=='string' || !['lost_authenticator','compromised_factor','device_replacement'].includes(values.reasonCategory) ||
    typeof values.reason!=='string' || /[\x00-\x1f\x7f-\x9f]/.test(values.reason)) throw invalid();
  safeId(values.targetUid);const reason=values.reason.trim();if(!reason || Array.from(reason).length>1000) throw invalid();
  return { requestId:values.requestId,targetUid:values.targetUid,reasonCategory:values.reasonCategory as MfaRecoveryReason,reason };
}
async function rpc(client: SupabaseClient, name: string, args: Record<string,unknown>) {
  let response;try{response=await client.rpc(name,args);}catch{throw unavailable();}
  if(response?.error) {
    const {code,message}=response.error;
    if(code==='55P03') throw new AuthorityError('MFA_RECOVERY_BUSY',409);
    if(code==='P0001') {
      if(message==='MFA_RECOVERY_INPUT_INVALID') throw invalid();
      if(message==='MFA_RECOVERY_NOT_FOUND') throw new AuthorityError(message,404);
      if(['MFA_RECOVERY_REQUEST_CONFLICT','MFA_RECOVERY_STATE_CONFLICT','MFA_RECOVERY_ALREADY_OUTSTANDING'].includes(message)) throw new AuthorityError(message,409);
      if(['INDEPENDENT_ACTOR_REQUIRED','INDEPENDENT_APPROVER_REQUIRED','MFA_RECOVERY_DENIED','STAFF_TARGET_DENIED','STAFF_ADMIN_REQUIRED','STAFF_IDENTITY_INCONSISTENT','STAFF_MFA_REENROLLMENT_REQUIRED','STAFF_FRESH_SIGN_IN_REQUIRED','STAFF_RECENT_SIGN_IN_REQUIRED'].includes(message)) throw new AuthorityError(message,403);
    }
    throw unavailable();
  }
  return response?.data;
}
function decode(data: unknown, requestId: string, actor: User, targetUid?: string): MfaRecoveryRequest {
  if(!data || typeof data!=='object' || Array.isArray(data)) throw unavailable();const row=data as Record<string,unknown>;
  if(row.requestId!==requestId || typeof row.targetUid!=='string' || row.targetUid===actor.id || (targetUid!==undefined && row.targetUid!==targetUid) ||
    !['pending_approval','approved'].includes(row.status as string) || typeof row.resumed!=='boolean') throw unavailable();
  try{safeId(row.targetUid);}catch{throw unavailable();}
  if(row.status==='approved' ? row.jobId!==requestId : Object.hasOwn(row,'jobId')) throw unavailable();
  if(targetUid!==undefined && row.status==='approved' && !row.resumed) throw unavailable();
  if(targetUid===undefined && row.status!=='approved') throw unavailable();
  return {requestId,targetUid:row.targetUid,status:row.status as MfaRecoveryRequest['status'],resumed:row.resumed,
    ...(row.status==='approved'?{jobId:requestId}:{}),resetAvailability:'unavailable'};
}
/** Actor and application bearer come from verified durable server authentication; never body role/proof. */
export async function requestMfaRecovery(client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string, input: unknown): Promise<MfaRecoveryRequest> {
  const hash=proof(actor,tenant,verifiedApplicationToken);const value=requestInput(input);
  if(value.targetUid===actor.id) throw new AuthorityError('INDEPENDENT_ACTOR_REQUIRED',403);
  const result=await rpc(client,'taxguard_request_mfa_recovery',{p_tenant:tenant,p_actor:actor.id,p_uid:value.targetUid,p_request_id:value.requestId,p_reason_category:value.reasonCategory,p_reason:value.reason,p_actor_session_hash:hash});
  return decode(result,value.requestId,actor,value.targetUid);
}
/** Approval suspends access and queues work only. It cannot delete a factor or clear the reenrollment gate. */
export async function approveMfaRecovery(client: SupabaseClient, tenant: string, actor: User, verifiedApplicationToken: string, requestId: string): Promise<MfaRecoveryRequest> {
  const hash=proof(actor,tenant,verifiedApplicationToken);if(!uuid(requestId)) throw invalid();
  return decode(await rpc(client,'taxguard_approve_mfa_recovery',{p_tenant:tenant,p_actor:actor.id,p_request_id:requestId,p_actor_session_hash:hash}),requestId,actor);
}
