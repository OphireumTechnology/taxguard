import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SupabaseDurableSessions } from '../server/supabase-db';
import { createMockSupabaseClient } from './helpers/mockSupabase';
import { db } from '../server/db';
let serial=0;const touched:string[]=[];
beforeEach(()=>{vi.stubEnv('NODE_ENV','test');vi.stubEnv('TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED','true');});
afterEach(()=>{vi.unstubAllEnvs();for(const uid of touched.splice(0))db.users.delete(uid);});
async function fixture(){const mock=createMockSupabaseClient();const uid='profile-session-'+ ++serial;touched.push(uid);const engine=new SupabaseDurableSessions(mock.client,'tenantA');const result=await engine.create({uid,email:uid+'@example.invalid',emailVerified:true,authTime:Math.floor(Date.now()/1000)});return {...mock,uid,engine,result};}
it.each([{role:'admin'},{tenantId:'tenantB'},{name:'Unapproved Name'},{clientId:'999'},{onboardingStatus:'COMPLETED'},{stageOneDossier:{forged:true}},{onboardingStep:2}])('refuses profile authority/workflow mutation %j without cache or storage changes',async patch=>{
  const {store,uid,engine}=await fixture();const original=structuredClone(store.identities.get(uid));const cache=structuredClone(db.users.get(uid));const audits=store.audit.length;
  await expect(engine.updateUser(uid,patch as any)).rejects.toMatchObject({code:'CLIENT_PROFILE_INPUT_INVALID',status:400});
  expect(store.identities.get(uid)).toEqual(original);expect(db.users.get(uid)).toEqual(cache);expect(store.audit).toHaveLength(audits);
});
it('publishes profile only after durable success and preserves onboarding progress',async()=>{
  const {store,uid,engine}=await fixture();store.identities.get(uid).user_data.onboardingStatus='IN_PROGRESS';
  const changed=await engine.updateUser(uid,{phone:'555-0100',companyName:'Synthetic Practice'});expect(changed).toMatchObject({id:uid,role:'client',onboardingStatus:'IN_PROGRESS',phone:'555-0100',companyName:'Synthetic Practice'});expect(db.users.get(uid)).toEqual(changed);
  const relogged=await engine.create({uid,email:uid+'@example.invalid',emailVerified:true,authTime:Math.floor(Date.now()/1000)});expect(relogged.user).toMatchObject({phone:'555-0100',companyName:'Synthetic Practice',onboardingStatus:'IN_PROGRESS'});
});
it('leaves cache untouched on profile storage failure',async()=>{
  const {client,store,uid,engine}=await fixture();const cache=structuredClone(db.users.get(uid));const original=client.rpc.getMockImplementation();
  client.rpc.mockImplementation((name:string,args:any)=>name==='taxguard_update_client_profile'?Promise.resolve({data:null,error:{code:'08006',message:'private'}}):original(name,args));
  await expect(engine.updateUser(uid,{phone:'555-9999'})).rejects.toMatchObject({code:'CLIENT_PROFILE_STORE_UNAVAILABLE',status:503});expect(db.users.get(uid)).toEqual(cache);expect(store.identities.get(uid).user_data.phone).toBeUndefined();
});
it('does not revoke another tenant token and idempotently revokes its own',async()=>{
  const {client,store,engine,result}=await fixture();await new SupabaseDurableSessions(client,'tenantB').revoke(result.token);expect(await engine.verify(result.token)).not.toBeNull();
  await engine.revoke(result.token);await engine.revoke(result.token);expect(await engine.verify(result.token)).toBeNull();expect(store.audit.filter(row=>row.action==='SESSION_REVOKED')).toHaveLength(1);
});
