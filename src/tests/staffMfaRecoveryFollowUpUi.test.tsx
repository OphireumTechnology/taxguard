import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
const h=vi.hoisted(()=>({states:[] as any[],refs:[] as any[],effects:[] as any[],si:0,ri:0,ei:0,token:'session-a',directory:{} as any,complete:vi.fn(),retry:vi.fn(),cancel:vi.fn(),approve:vi.fn(),
  key:'p',email:'staff@example.invalid'}));
vi.mock('react',async original=>{const actual=await original<any>();return {...actual,useId:()=>'synthetic',useState:(initial:any)=>{const i=h.si++;if(!(i in h.states))h.states[i]=initial;return [h.states[i],(v:any)=>h.states[i]=typeof v==='function'?v(h.states[i]):v];},useRef:(initial:any)=>{const i=h.ri++;return h.refs[i]??(h.refs[i]={current:initial});},useEffect:(effect:any,deps:any[]=[])=>{const i=h.ei++,old=h.effects[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n])))h.effects[i]={effect,deps,cleanup:old?.cleanup};}};});
vi.mock('../hooks/useStaffMfaRecovery',async original=>({...await original<any>(),useStaffMfaRecovery:()=>h.directory}));
vi.mock('../services/api',()=>({getStoredToken:()=>h.token,api:{staffAccess:{completeRecovery:h.complete,retryRecoveryReset:h.retry,cancelRecovery:h.cancel,approveRecovery:h.approve,requestRecovery:vi.fn()}}}));
vi.mock('../services/providerIdentityBoundary',()=>({useProviderIdentityBoundary:()=>({key:h.key,uid:'synthetic-'+h.key,email:h.email,current:()=>({key:h.key,email:h.email}),capture:()=>h.key,isCurrent:(key:string)=>key===h.key})}));
vi.mock('../context/providerOnlyIdentityFlow',()=>({beginProviderOnlyIdentityFlow:()=>()=>{}}));
vi.mock('../supabase/mfaEnrollment',()=>({beginTotpEnrollment:vi.fn(),confirmTotpEnrollment:vi.fn(),cancelTotpEnrollment:vi.fn()}));
import { StaffMfaRecoveryPanel } from '../components/admin/StaffMfaRecoveryPanel';
import { StaffMfaRecoveryEnrollmentFlow } from '../components/auth/StaffMfaRecoveryEnrollmentFlow';
import { StaffInvitationFlowError } from '../services/staffInvitationApi';

const user={id:'admin-a',tenantId:'tenant-a',role:'admin',status:'active'} as User;
const id='11111111-1111-4111-8111-111111111111';
const approved={requestId:id,targetUid:'staff-a',targetName:'Synthetic Staff',targetRole:'accountant',makerUid:'admin-b',checkerUid:'admin-c',reasonCategory:'lost_authenticator',reason:'Synthetic reason',
  status:'approved',createdAt:'2026-01-01T00:00:00Z',approvedAt:'2026-01-01T00:01:00Z',jobId:id,jobStatus:'enrollment_verified',jobAttempts:1,jobLastError:null,completedAt:null,completedBy:null,cancelledAt:null,
  resetAvailability:'verified',actions:{approve:false,complete:true,cancel:false,retry:false}};
const key=()=>JSON.stringify([user.id,user.tenantId,user.clientId,user.role,user.status,'AUTHENTICATED',h.token]);
const render=()=>{h.si=h.ri=h.ei=0;return StaffMfaRecoveryPanel({user,authStatus:'AUTHENTICATED'});};
function find(tree:any,p:(node:any)=>boolean):any{if(!tree||typeof tree!=='object')return;if(p(tree))return tree;for(const child of React.Children.toArray(tree.props?.children)){const m=find(child,p);if(m)return m;}}
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const label=(prefix:string)=>(n:any)=>typeof n.props?.['aria-label']==='string'&&n.props['aria-label'].startsWith(prefix);
function open(prefix:string){find(render(),label(prefix)).props.onClick({currentTarget:{isConnected:true,focus:vi.fn()}});return render();}
const confirm=(tree:any)=>find(tree,n=>n.type==='form'&&n.props.role==='region').props.onSubmit({preventDefault(){}});
beforeEach(()=>{h.states=[];h.refs=[];h.effects=[];h.token='session-a';for(const f of [h.complete,h.retry,h.cancel,h.approve])f.mockReset();
  h.directory={allowed:true,sessionKey:key(),query:{limit:25},status:'ready',items:[approved],nextCursor:null,refresh:vi.fn(),setStatus:vi.fn(),setLimit:vi.fn(),firstPage:vi.fn(),nextPage:vi.fn()};});

describe('administrator recovery follow-up actions', () => {
  it('offers only actions the server hints and the state allow, never for the target themselves', () => {
    let html=renderToStaticMarkup(render());
    expect(html).toContain('Review recovery completion');expect(html).not.toContain('Re-queue failed reset');expect(html).not.toContain('Cancel recovery request');
    expect(html).toContain('New authenticator verified');
    h.directory.items=[{...approved,targetUid:user.id}];expect(find(render(),label('Review recovery completion'))).toBeUndefined();
    h.directory.items=[{...approved,actions:{...approved.actions,complete:false}}];expect(find(render(),label('Review recovery completion'))).toBeUndefined();
    h.directory.items=[{...approved,jobStatus:'failed',jobLastError:'PROVIDER_TIMEOUT',actions:{...approved.actions,complete:true,retry:true}}];
    html=renderToStaticMarkup(render());expect(html).toContain('Re-queue failed reset');expect(html).not.toContain('Review recovery completion');expect(html).toContain('PROVIDER_TIMEOUT');
  });
  it('completes only after confirmation and reports reactivation only on a confirmed result', async () => {
    const tree=open('Review recovery completion');
    expect(renderToStaticMarkup(tree)).toContain('out-of-band');expect(h.complete).not.toHaveBeenCalled();
    h.complete.mockResolvedValueOnce({requestId:id,targetUid:'staff-a',status:'completed',resumed:false});
    confirm(tree);await settle();
    expect(h.complete).toHaveBeenCalledWith(id,expect.any(AbortSignal));
    expect(renderToStaticMarkup(render())).toContain('recovery is complete');expect(h.directory.refresh).toHaveBeenCalledOnce();
  });
  it('does not claim completion when the result does not match the row', async () => {
    const tree=open('Review recovery completion');
    h.complete.mockResolvedValueOnce({requestId:id,targetUid:'someone-else',status:'completed',resumed:false});
    confirm(tree);await settle();
    const html=renderToStaticMarkup(render());expect(html).toContain('server did not confirm');expect(html).not.toContain('recovery is complete');
  });
  it('tells the administrator to sign in again when a recent MFA sign-in is required', async () => {
    const tree=open('Review recovery completion');
    h.complete.mockRejectedValueOnce(Object.assign(new Error('x'),{code:'STAFF_RECENT_SIGN_IN_REQUIRED',status:403}));
    confirm(tree);await settle();
    expect(renderToStaticMarkup(render())).toContain('last 15 minutes');
  });
  it('re-queues a failed reset job', async () => {
    h.directory.items=[{...approved,jobStatus:'failed',actions:{...approved.actions,complete:false,retry:true}}];
    const tree=open('Re-queue failed reset');
    h.retry.mockResolvedValueOnce({jobId:id,status:'pending'});confirm(tree);await settle();
    expect(h.retry).toHaveBeenCalledWith(id,expect.any(AbortSignal));expect(renderToStaticMarkup(render())).toContain('re-queued');
  });
  it('requires a recorded reason before cancelling a pending request', async () => {
    h.directory.items=[{...approved,status:'pending_approval',checkerUid:null,approvedAt:null,jobId:null,jobStatus:null,jobAttempts:null,resetAvailability:'unavailable',actions:{approve:false,complete:false,cancel:true,retry:false}}];
    let tree=open('Cancel recovery request');
    expect(find(tree,n=>n.type==='button'&&n.props.children==='Cancel this recovery request').props.disabled).toBe(true);
    confirm(tree);await settle();expect(h.cancel).not.toHaveBeenCalled();
    find(tree,n=>n.type==='textarea'&&n.props.minLength===10).props.onChange({target:{value:'Requested for the wrong colleague'}});
    tree=render();h.cancel.mockResolvedValueOnce({requestId:id,targetUid:'staff-a',status:'cancelled'});confirm(tree);await settle();
    expect(h.cancel).toHaveBeenCalledWith(id,'Requested for the wrong colleague',expect.any(AbortSignal));
    expect(renderToStaticMarkup(render())).toContain('was cancelled');
  });
  it('drops a late completion result after the session token changes', async () => {
    const tree=open('Review recovery completion');let resolve!:(v:any)=>void;h.complete.mockImplementationOnce(()=>new Promise(yes=>resolve=yes));
    confirm(tree);h.token='session-b';resolve({requestId:id,targetUid:'staff-a',status:'completed',resumed:false});await settle();
    expect(h.directory.refresh).not.toHaveBeenCalled();
  });
});

function flowApi(overrides:Record<string,any>={}){return {authenticate:vi.fn().mockResolvedValue({emailVerificationRequired:false}),lookup:vi.fn(),mfaState:vi.fn().mockResolvedValue({kind:'ready'}),challenge:vi.fn().mockResolvedValue(undefined),
  accept:vi.fn(),signOut:vi.fn().mockResolvedValue(undefined),submitRecoveryEnrollment:vi.fn().mockResolvedValue({status:'enrollment_verified'}),...overrides} as any;}
function renderFlow(api:any){h.si=h.ri=h.ei=0;return StaffMfaRecoveryEnrollmentFlow({onCancel:vi.fn(),api});}
function mountFlow(api:any){renderFlow(api);h.effects.forEach(e=>{if(e&&!e.ran){e.ran=true;e.cleanup=e.effect();}});return renderFlow(api);}
function signIn(api:any){let tree=mountFlow(api);find(tree,n=>n.type==='input'&&n.props.type==='email').props.onChange({target:{value:h.email}});tree=renderFlow(api);
  find(tree,n=>n.type==='input'&&n.props.type==='password').props.onChange({target:{value:'synthetic-password'}});tree=renderFlow(api);find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});}

describe('staff re-enrolment after an administrator reset', () => {
  beforeEach(()=>{h.key='p';h.email='staff@example.invalid';});
  it('signs in with the provider, then asks for a new authenticator before any server proof', async () => {
    const api=flowApi({mfaState:vi.fn().mockResolvedValue({kind:'enroll'})});signIn(api);await settle();
    expect(api.authenticate).toHaveBeenCalledWith('signin',h.email,'synthetic-password');
    expect(renderToStaticMarkup(renderFlow(api))).toContain('Start authenticator setup');
    expect(api.submitRecoveryEnrollment).not.toHaveBeenCalled();
  });
  it('verifies the new authenticator code, records the proof, signs out and never claims reactivation', async () => {
    const api=flowApi({mfaState:vi.fn().mockResolvedValueOnce({kind:'challenge',factorId:'synthetic-new'}).mockResolvedValue({kind:'ready'})});
    signIn(api);await settle();let tree=renderFlow(api);
    find(tree,n=>n.type==='input'&&n.props.autoComplete==='one-time-code').props.onChange({target:{value:'12a3456'}});tree=renderFlow(api);
    find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();
    expect(api.challenge).toHaveBeenCalledWith('synthetic-new','123456');expect(api.submitRecoveryEnrollment).toHaveBeenCalledOnce();expect(api.signOut).toHaveBeenCalled();
    const html=renderToStaticMarkup(renderFlow(api));expect(html).toContain('independent administrator must now complete');expect(html).not.toContain('synthetic-password');
  });
  it('re-checks the authenticator assurance level immediately before sending the proof', async () => {
    const api=flowApi({mfaState:vi.fn().mockResolvedValueOnce({kind:'ready'}).mockResolvedValue({kind:'challenge',factorId:'synthetic-new'})});
    signIn(api);await settle();find(renderFlow(api),n=>n.type==='button'&&n.props.children==='Record new authenticator').props.onClick();await settle();
    expect(api.submitRecoveryEnrollment).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(renderFlow(api))).toContain('Code from your new authenticator');
  });
  it('shows the server explanation and stays incomplete when the proof is refused', async () => {
    const api=flowApi({submitRecoveryEnrollment:vi.fn().mockRejectedValue(new StaffInvitationFlowError('verification','Your administrator has not finished resetting your authenticator yet. Try again later.'))});
    signIn(api);await settle();find(renderFlow(api),n=>n.type==='button'&&n.props.children==='Record new authenticator').props.onClick();await settle();
    const html=renderToStaticMarkup(renderFlow(api));expect(html).toContain('not finished resetting');expect(html).not.toContain('independent administrator must now complete');
  });
  it('ignores a sign-in that resolves to a different provider identity', async () => {
    const api=flowApi();h.email='other@example.invalid';let tree=mountFlow(api);
    find(tree,n=>n.type==='input'&&n.props.type==='email').props.onChange({target:{value:'staff@example.invalid'}});tree=renderFlow(api);
    find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});await settle();
    expect(api.mfaState).not.toHaveBeenCalled();expect(api.submitRecoveryEnrollment).not.toHaveBeenCalled();
  });
});
