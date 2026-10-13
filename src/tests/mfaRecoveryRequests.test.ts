import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { requestMfaRecovery, approveMfaRecovery } from '../server/mfaRecoveryRequests';
import { attachSessionAssuranceLevel } from '../server/staffMfa';
import type { User } from '../types';
const id='11111111-1111-4111-8111-111111111111',token='tg_live_'+'a'.repeat(64);
const input=(patch:Record<string,unknown>={})=>({requestId:id,targetUid:'staff-target',reasonCategory:'lost_authenticator',reason:' Synthetic device lost ',...patch});
function actor(patch:Record<string,unknown>={},aal:'aal1'|'aal2'='aal2'){const user={id:'maker',tenantId:'tenantA',role:'admin',status:'active',name:'Synthetic Admin',email:'maker@example.invalid',...patch} as User;attachSessionAssuranceLevel(user,aal);return user;}
const client=(data:unknown={requestId:id,targetUid:'staff-target',status:'pending_approval',resumed:false})=>({rpc:vi.fn(async(_name:string,_args:Record<string,unknown>)=>({data,error:null})),from:vi.fn(),auth:{admin:{mfa:{deleteFactor:vi.fn()}}}});
describe('MFA recovery foundation service',()=>{
  it('binds current app session hash and server actor; never sends raw bearer or calls provider',async()=>{
    const c=client();expect(await requestMfaRecovery(c as any,'tenantA',actor(),token,input())).toEqual({requestId:id,targetUid:'staff-target',status:'pending_approval',resumed:false,resetAvailability:'unavailable'});
    expect(c.rpc).toHaveBeenCalledExactlyOnceWith('taxguard_request_mfa_recovery',{p_tenant:'tenantA',p_actor:'maker',p_uid:'staff-target',p_request_id:id,p_reason_category:'lost_authenticator',p_reason:'Synthetic device lost',p_actor_session_hash:createHash('sha256').update(token).digest('hex')});
    expect(JSON.stringify(c.rpc.mock.calls)).not.toContain(token);expect(c.from).not.toHaveBeenCalled();expect(c.auth.admin.mfa.deleteFactor).not.toHaveBeenCalled();
  });
  it.each([{role:'client'},{role:'accountant'},{status:'suspended'},{tenantId:'tenantB'}])('refuses non-authoritative admin %j',async patch=>{
    const c=client();await expect(requestMfaRecovery(c as any,'tenantA',actor(patch),token,input())).rejects.toMatchObject({code:'STAFF_ADMIN_REQUIRED',status:403});expect(c.rpc).not.toHaveBeenCalled();
  });
  it('refuses AAL1 and missing durable bearer before transport',async()=>{
    const c=client();await expect(requestMfaRecovery(c as any,'tenantA',actor({},'aal1'),token,input())).rejects.toMatchObject({status:403});await expect(requestMfaRecovery(c as any,'tenantA',actor(),'provider-jwt',input())).rejects.toMatchObject({code:'MFA_RECOVERY_INPUT_INVALID'});expect(c.rpc).not.toHaveBeenCalled();
  });
  it.each([{requestId:'not-uuid'},{targetUid:'../target'},{reasonCategory:'override'},{reason:''},{reason:'A\nB'},{reason:'A\u0085B'},{reason:'x'.repeat(1001)},{factorId:'forged'},{role:'super_admin'},{reason:42}])('rejects invalid request %j without transport',async patch=>{
    const c=client();await expect(requestMfaRecovery(c as any,'tenantA',actor(),token,input(patch))).rejects.toMatchObject({status:400});expect(c.rpc).not.toHaveBeenCalled();
  });
  it('denies self-request before SQL and rejects unsafe accessors',async()=>{
    const c=client();await expect(requestMfaRecovery(c as any,'tenantA',actor(),token,input({targetUid:'maker'}))).rejects.toMatchObject({code:'INDEPENDENT_ACTOR_REQUIRED',status:403});
    const dangerous=input();const getter=vi.fn();Object.defineProperty(dangerous,'reason',{get:getter});await expect(requestMfaRecovery(c as any,'tenantA',actor(),token,dangerous)).rejects.toMatchObject({status:400});expect(getter).not.toHaveBeenCalled();expect(c.rpc).not.toHaveBeenCalled();
  });
  it('reports approved reset as unavailable and whitelists response without clearing a gate',async()=>{
    const c=client({requestId:id,targetUid:'staff-target',status:'approved',jobId:id,resumed:false,factorId:'secret',token:'secret',reenrollmentRequired:false});
    expect(await approveMfaRecovery(c as any,'tenantA',actor({id:'checker'}),token,id)).toEqual({requestId:id,targetUid:'staff-target',status:'approved',jobId:id,resumed:false,resetAvailability:'unavailable'});
    expect(c.rpc.mock.calls[0][0]).toBe('taxguard_approve_mfa_recovery');expect(c.from).not.toHaveBeenCalled();expect(c.auth.admin.mfa.deleteFactor).not.toHaveBeenCalled();
  });
  it('preserves exact retry flags for requests and approvals',async()=>{
    const data={requestId:id,targetUid:'staff-target',status:'approved',jobId:id,resumed:true};
    expect((await requestMfaRecovery(client(data) as any,'tenantA',actor(),token,input())).resumed).toBe(true);expect((await approveMfaRecovery(client(data) as any,'tenantA',actor({id:'checker'}),token,id)).resumed).toBe(true);
  });
  it.each([null,[],{}, {requestId:id,targetUid:'maker',status:'approved',jobId:id,resumed:false},{requestId:id,targetUid:'staff-target',status:'completed',jobId:id,resumed:false},{requestId:id,targetUid:'staff-target',status:'approved',jobId:'other',resumed:false},{requestId:id,targetUid:'other-target',status:'pending_approval',resumed:false},{requestId:id,targetUid:'staff-target',status:'pending_approval',jobId:id,resumed:false}])('fails closed on malformed request output %j',async data=>{
    await expect(requestMfaRecovery(client(data) as any,'tenantA',actor(),token,input())).rejects.toMatchObject({code:'MFA_RECOVERY_STORE_UNAVAILABLE',status:503});
  });
  it.each([['55P03','private lock detail','MFA_RECOVERY_BUSY',409],['P0001','MFA_RECOVERY_REQUEST_CONFLICT','MFA_RECOVERY_REQUEST_CONFLICT',409],['P0001','INDEPENDENT_APPROVER_REQUIRED','INDEPENDENT_APPROVER_REQUIRED',403],['P0001','STAFF_FRESH_SIGN_IN_REQUIRED','STAFF_FRESH_SIGN_IN_REQUIRED',403],['P0001','MFA_RECOVERY_NOT_FOUND','MFA_RECOVERY_NOT_FOUND',404],['P0001','private detail','MFA_RECOVERY_STORE_UNAVAILABLE',503],['08006','private detail','MFA_RECOVERY_STORE_UNAVAILABLE',503]])('sanitizes SQL result %s %s',async(code,message,expected,status)=>{
    const c={rpc:vi.fn(async()=>({data:null,error:{code,message}}))};await expect(approveMfaRecovery(c as any,'tenantA',actor({id:'checker'}),token,id)).rejects.toMatchObject({code:expected,status});
  });
  it('converts provider transport exceptions to unavailable without retry or factor action',async()=>{
    const c=client();c.rpc.mockRejectedValueOnce(Error('private'));await expect(requestMfaRecovery(c as any,'tenantA',actor(),token,input())).rejects.toMatchObject({code:'MFA_RECOVERY_STORE_UNAVAILABLE'});expect(c.rpc).toHaveBeenCalledTimes(1);expect(c.auth.admin.mfa.deleteFactor).not.toHaveBeenCalled();
  });
});
