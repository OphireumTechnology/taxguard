import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import type { StaffRecoveryRecord, StaffRecoveryPage } from '../types/staffRecovery';
import { requireStaffAdministrator } from './staffAccessPolicy';
import { AuthorityError } from './taxguard/authority.repository';
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
type Position = { createdAt: string; id: string };
const invalid = () => new AuthorityError('STAFF_RECOVERY_INPUT_INVALID', 400);
const unavailable = () => new AuthorityError('STAFF_RECOVERY_STORE_UNAVAILABLE', 503);
function identifier(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value); }
function text(value: unknown, max = 255): value is string { return typeof value === 'string' && value.length <= max && !/[\x00-\x1f\x7f]/.test(value); }
function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] &&
    hour <= 23 && minute <= 59 && second <= 59 &&
    (parts[7] === undefined || (Number(parts[7]) <= 23 && Number(parts[8]) <= 59)) && Number.isFinite(Date.parse(value));
}
function micros(value: string): bigint {
  const fraction = /\.(\d+)(?:Z|[+-])/.exec(value)?.[1] || '';
  return BigInt(Date.parse(value)) * 1000n + BigInt(fraction.padEnd(6, '0').slice(3));
}
function compare(a: Position, b: Position): number {
  const x = micros(a.createdAt), y = micros(b.createdAt);
  return x === y ? (a.id === b.id ? 0 : a.id > b.id ? 1 : -1) : x > y ? 1 : -1;
}

function queryInput(query: unknown, tenant: string) {
 if (!query || typeof query !== 'object' || Array.isArray(query) || ![Object.prototype,null].includes(Object.getPrototypeOf(query))) throw invalid();
 const input: Record<string,unknown>={};
 for(const key of Reflect.ownKeys(query)) { if(typeof key!=='string' || !['limit','status','cursor'].includes(key)) throw invalid();const d=Object.getOwnPropertyDescriptor(query,key);if(!d || !Object.hasOwn(d,'value')) throw invalid();input[key]=d.value; }
 const limit=input.limit===undefined?25:typeof input.limit==='string' && /^[1-9]\d*$/.test(input.limit)?Number(input.limit):input.limit;
 const status=input.status===undefined?'all':input.status;
 if(typeof limit!=='number' || !Number.isInteger(limit) || limit<1 || limit>50 || !['all','pending_approval','approved'].includes(status as string)) throw invalid();
 let after: Position|null=null;
 if(input.cursor!==undefined) {
  if(typeof input.cursor!=='string' || input.cursor.length>2048 || !/^[A-Za-z0-9_-]+$/.test(input.cursor)) throw invalid();
  try {const b=Buffer.from(input.cursor,'base64url');if(b.toString('base64url')!==input.cursor) throw invalid();const c=JSON.parse(b.toString('utf8'));
   if(!c || c.v!==1 || c.tenant!==tenant || c.kind!=='recoveries' || c.status!==status || !timestamp(c.createdAt) || !uuid(c.id)) throw invalid();after={createdAt:c.createdAt,id:c.id};
  }catch{throw invalid();}
 }
 return {limit,status,after};
}
function record(row: Record<string,unknown>,actor:User): StaffRecoveryRecord {
 if(!uuid(row.requestId) || !identifier(row.targetUid) || !identifier(row.makerUid) || row.targetUid===row.makerUid ||
  !(row.targetName===null || text(row.targetName)) || !(row.targetRole===null || (text(row.targetRole,128) && !!row.targetRole)) ||
  !['lost_authenticator','compromised_factor','device_replacement'].includes(row.reasonCategory as string) || typeof row.reason!=='string' || !row.reason.trim() || row.reason!==row.reason.trim() || Array.from(row.reason).length>1000 || /[\x00-\x1f\x7f-\x9f]/.test(row.reason) ||
  !['pending_approval','approved'].includes(row.status as string) || !timestamp(row.createdAt) || typeof row.approveEligible!=='boolean') throw unavailable();
 if(row.status==='pending_approval' ? row.checkerUid!==null || row.approvedAt!==null || row.jobId!==null || row.jobStatus!==null :
  !identifier(row.checkerUid) || row.checkerUid===row.makerUid || row.checkerUid===row.targetUid || !timestamp(row.approvedAt) || row.jobId!==row.requestId || row.jobStatus!=='pending' || row.approveEligible) throw unavailable();
 return {requestId:row.requestId,targetUid:row.targetUid,targetName:row.targetName as string|null,targetRole:row.targetRole as string|null,makerUid:row.makerUid,checkerUid:row.checkerUid as string|null,reasonCategory:row.reasonCategory as StaffRecoveryRecord['reasonCategory'],reason:row.reason,status:row.status as StaffRecoveryRecord['status'],createdAt:row.createdAt,approvedAt:row.approvedAt as string|null,jobId:row.jobId as string|null,jobStatus:row.jobStatus as 'pending'|null,resetAvailability:'unavailable',actions:{approve:row.status==='pending_approval' && row.approveEligible && actor.id!==row.makerUid && actor.id!==row.targetUid}};
}
/** Bearer is supplied only by verified durable server authentication. Action flags are hints. */
export async function listStaffRecoveries(client:SupabaseClient,tenant:string,actor:User,verifiedApplicationToken:string,query:unknown={}):Promise<StaffRecoveryPage> {
 requireStaffAdministrator(actor,tenant);
 if(typeof verifiedApplicationToken!=='string' || !/^tg_live_[a-f0-9]{64}$/.test(verifiedApplicationToken)) throw invalid();
 const {limit,status,after}=queryInput(query,tenant);let response;
 try {response=await client.rpc('taxguard_list_mfa_recoveries',{p_tenant:tenant,p_actor:actor.id,p_actor_session_hash:createHash('sha256').update(verifiedApplicationToken).digest('hex'),p_status:status==='all'?null:status,p_page_size:limit+1,p_after_created:after?.createdAt??null,p_after_id:after?.id??null});}catch{throw unavailable();}
 if(response?.error) {if(response.error.code==='55P03') throw new AuthorityError('STAFF_RECOVERY_BUSY',409);if(response.error.code==='P0001') throw new AuthorityError(response.error.message==='STAFF_RECOVERY_INPUT_INVALID'?'STAFF_RECOVERY_INPUT_INVALID':'STAFF_RECOVERY_DENIED',response.error.message==='STAFF_RECOVERY_INPUT_INVALID'?400:403);throw unavailable();}
 if(!Array.isArray(response?.data) || response.data.length>limit+1) throw unavailable();let previous=after;
 const mapped=response.data.map((row:unknown)=>{if(!row || typeof row!=='object' || Array.isArray(row)) throw unavailable();const item=record(row as Record<string,unknown>,actor);if(status!=='all' && item.status!==status) throw unavailable();const pos={createdAt:item.createdAt,id:item.requestId};if(previous && compare(pos,previous)>=0) throw unavailable();previous=pos;return item;});
 const items=mapped.slice(0,limit),last=items.at(-1);return {items,nextCursor:mapped.length>limit && last?Buffer.from(JSON.stringify({v:1,tenant,kind:'recoveries',status,createdAt:last.createdAt,id:last.requestId})).toString('base64url'):null,source:'durable'};
}
