import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import { AuthorityError, safeId } from './taxguard/authority.repository';
const unavailable = () => new AuthorityError('CLIENT_PROFILE_STORE_UNAVAILABLE',503);
const input = () => new AuthorityError('CLIENT_PROFILE_INPUT_INVALID',400);
const limits = { phone:64, companyName:255 } as const;
const statuses = ['not_started','in_progress','submitted','approved','completed','NOT_STARTED','IN_PROGRESS','COMPLETED'];
function text(value: unknown,max:number): value is string { return typeof value==='string' && Array.from(value).length<=max && !/[\x00-\x1f\x7f-\x9f]/.test(value); }
function time(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const [year,month,day,hour,minute,second] = parts.slice(1,7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31,leap ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month-1] && hour <= 23 && minute <= 59 && second <= 59 &&
    (parts[7] === undefined || (Number(parts[7]) <= 23 && Number(parts[8]) <= 59)) && Number.isFinite(Date.parse(value));
}
/** Tenant and UID must come from server configuration and verified session proof. No cache or repair. */
export async function updateClientProfile(client:SupabaseClient,tenantId:string,uid:string,patch:unknown):Promise<User> {
  safeId(tenantId); safeId(uid);
  if (!patch || typeof patch!=='object' || Array.isArray(patch) || ![Object.prototype,null].includes(Object.getPrototypeOf(patch))) throw input();
  const keys=Reflect.ownKeys(patch);
  if (!keys.length || keys.some(key=>typeof key!=='string' || !Object.hasOwn(limits,key))) throw input();
  const clean:Record<string,string>={};
  for(const key of keys as (keyof typeof limits)[]) {
    const descriptor=Object.getOwnPropertyDescriptor(patch,key);
    if(!descriptor || !Object.hasOwn(descriptor,'value') || !text(descriptor.value,limits[key])) throw input();
    clean[key]=descriptor.value;
  }
  let response;
  try { response=await client.rpc('taxguard_update_client_profile',{p_tenant:tenantId,p_uid:uid,p_patch:clean}); } catch { throw unavailable(); }
  if(response?.error) {
    if(response.error.code==='P0001' && response.error.message==='CLIENT_PROFILE_INPUT_INVALID') throw input();
    if(response.error.code==='P0001' && response.error.message==='CLIENT_PROFILE_DENIED') throw new AuthorityError('CLIENT_PROFILE_DENIED',403);
    throw unavailable();
  }
  const row=response?.data?.user;
  if(!row || typeof row!=='object' || Array.isArray(row) || row.id!==uid || row.tenantId!==tenantId || row.role!=='client' || row.status!=='active' || row.isVerified!==true ||
    !text(row.name,255) || !row.name.length || !text(row.email,255) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ||
    typeof row.clientId!=='string' || !/^[A-Z0-9]{3,9}$/.test(row.clientId) || /^0+$/.test(row.clientId) ||
    !statuses.includes(row.onboardingStatus) || !(row.onboardingCompletedAt===null || time(row.onboardingCompletedAt)) ||
    !time(row.createdAt) || !time(row.updatedAt) || !text(row.phone,64) || !text(row.companyName,255) ||
    Object.entries(clean).some(([key,value])=>row[key]!==value)) throw unavailable();
  return {id:uid,tenantId,email:row.email,name:row.name,role:'client',status:'active',isVerified:true,clientId:row.clientId,
    phone:row.phone,companyName:row.companyName,onboardingStatus:row.onboardingStatus,onboardingCompletedAt:row.onboardingCompletedAt,createdAt:row.createdAt,updatedAt:row.updatedAt};
}
