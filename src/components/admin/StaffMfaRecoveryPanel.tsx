import React, { useEffect, useRef, useState } from 'react';
import type { User } from '../../types';
import type { StaffMemberRecord } from '../../types/staffAccess';
import type { StaffRecoveryQuery } from '../../types/staffRecovery';
import { api, getStoredToken } from '../../services/api';
import { staffSessionKey } from '../../hooks/useStaffAccessDirectory';
import { normalizeRecoveryInput, RECOVERY_CATEGORIES, recoveryCanApprove, useStaffMfaRecovery, validateRecoveryResult } from '../../hooks/useStaffMfaRecovery';
import type { RecoveryCategory, RecoveryInput, RecoveryRow } from '../../hooks/useStaffMfaRecovery';
const inputClass = 'w-full rounded-lg border border-slate-500 bg-[#071A2E] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-300';
const buttonClass = 'rounded-lg border border-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 disabled:cursor-not-allowed';
const emptyForm = {targetUid:'',reasonCategory:'lost_authenticator' as RecoveryCategory,reason:''};
type Operation = 'complete'|'cancel'|'retry';
type HistoryItem = {action:string;actorUid:string;actorRole:string|null;at:string;details:Record<string,unknown>};
/** Plain-language reset state from the server's job status. Never claims more than the server confirmed. */
export function recoveryResetText(row: RecoveryRow): string {
  switch (row.jobStatus) {
    case null: return row.status==='cancelled' ? 'Not started (request cancelled)' : 'Not started (awaiting independent approval)';
    case 'pending': return row.jobAttempts ? `Queued for retry after attempt ${row.jobAttempts}${row.jobLastError ? ' ('+row.jobLastError+')' : ''}` : 'Queued';
    case 'leased': return 'In progress on the server';
    case 'reset_verified': return 'Verified: every previous authenticator was removed. Waiting for the staff member to enrol a new one.';
    case 'enrollment_verified': return 'New authenticator verified. Waiting for an independent administrator to reactivate.';
    case 'completed': return 'Recovery completed and access reactivated.';
    case 'failed': return `Failed${row.jobLastError ? ' ('+row.jobLastError+')' : ''}. The staff member stays suspended until a retry succeeds.`;
  }
  return 'Unknown';
}
const ERROR_TEXT: Record<string,string> = {
  STAFF_RECENT_SIGN_IN_REQUIRED: 'This action needs an MFA sign-in from the last 15 minutes. Sign out, sign in again with your authenticator, then retry.',
  STAFF_FRESH_SIGN_IN_REQUIRED: 'Your sign-in predates a change to your account. Sign in again with your authenticator.',
  INDEPENDENT_APPROVER_REQUIRED: 'A different administrator must perform this step.', INDEPENDENT_ACTOR_REQUIRED: 'A different administrator must perform this step.',
  MFA_RECOVERY_STATE_CONFLICT: 'The request changed since it was loaded. Refresh recovery requests.', MFA_RECOVERY_NOT_READY_FOR_COMPLETION: 'The new authenticator has not been verified yet.',
  MFA_RECOVERY_ALREADY_OUTSTANDING: 'This staff member already has an open recovery request.', MFA_RECOVERY_BUSY: 'Another change is in progress. Retry in a moment.',
  MFA_RECOVERY_INPUT_INVALID: 'Check the request details (a cancellation reason needs at least 10 characters).', STAFF_ADMIN_REQUIRED: 'An active administrator session with MFA is required.',
};
export const recoveryErrorText = (error: unknown) => ERROR_TEXT[(error as {code?: string})?.code ?? ''] ?? 'The server did not confirm this recovery action. Refresh current requests before retrying. A request retry keeps its original request ID.';
export function StaffMfaRecoveryPanel({user,authStatus,members=[],refresh=0}:{user:User|null;authStatus:string;members?:StaffMemberRecord[];refresh?:number}) {
  const directory = useStaffMfaRecovery(user,authStatus,refresh), key = directory.sessionKey;
  const latest = useRef(key); latest.current = key;
  const mounted = useRef(true), controllers = useRef(new Set<AbortController>()), busy = useRef(false);
  const prepared = useRef<{key:string;fingerprint:string;input:RecoveryInput}|null>(null);
  const [formState,setFormState] = useState({key,value:emptyForm});
  const form = formState.key===key?formState.value:emptyForm;
  const [actionState,setActionState] = useState<{key:string;row:RecoveryRow}|null>(null);
  const action = actionState?.key===key?actionState.row:null;
  const [notice,setNotice] = useState<{key:string;error:boolean;text:string}|null>(null);
  const [pending,setPending] = useState<string|null>(null);
  const [opState,setOpState] = useState<{key:string;kind:Operation;row:RecoveryRow;reason:string}|null>(null);
  const op = opState?.key===key?opState:null;
  const [historyState,setHistoryState] = useState<{key:string;requestId:string;status:'loading'|'ready'|'error';items:HistoryItem[]}|null>(null);
  const history = historyState?.key===key?historyState:null;
  const heading = useRef<HTMLHeadingElement>(null), trigger = useRef<HTMLButtonElement|null>(null);
  const active = () => mounted.current && directory.allowed && latest.current===key && staffSessionKey(user,authStatus,getStoredToken())===key;
  useEffect(() => {
    mounted.current=true; busy.current=false; prepared.current=null;
    setFormState({key,value:emptyForm});setActionState(null);setNotice(null);setPending(null);
    return () => {mounted.current=false; controllers.current.forEach(c=>c.abort());controllers.current.clear();};
  },[key]);
  useEffect(() => {if(action) heading.current?.focus();},[key,actionState]);
  const change = (value:typeof emptyForm) => {if(active() && !busy.current) setFormState({key,value});};
  const cancel = () => {if(!active() || busy.current)return;setActionState(null);if(trigger.current?.isConnected)trigger.current.focus();};
  const run = async (operation:(signal:AbortSignal)=>Promise<unknown>, success:(value:any)=>void) => {
    if(!active() || busy.current)return;
    const token=getStoredToken(), controller=new AbortController();controllers.current.add(controller);busy.current=true;setPending(key);setNotice(null);
    const current = () => active() && getStoredToken()===token && !controller.signal.aborted;
    try {const value=await operation(controller.signal);if(!current())return;success(value);directory.refresh();}
    catch (error) {if(current())setNotice({key,error:true,text:recoveryErrorText(error)});}
    finally {controllers.current.delete(controller);if(current()){busy.current=false;setPending(null);}}
  };
  const request = (event:React.FormEvent) => {
    event.preventDefault();if(!active() || busy.current)return;
    try {
      const fingerprint=JSON.stringify([form.targetUid.trim(),form.reasonCategory,form.reason.trim()]);
      const requestId=prepared.current?.key===key && prepared.current.fingerprint===fingerprint ? prepared.current.input.requestId : globalThis.crypto.randomUUID();
      const input=normalizeRecoveryInput({...form,requestId});
      if(input.targetUid===user?.id)throw new Error('An independent administrator must request recovery for your account.');
      prepared.current={key,fingerprint,input};
      void run(signal=>api.staffAccess.requestRecovery(input,signal),value=>{
        validateRecoveryResult(value,input.requestId,input.targetUid,value?.status==='approved'?'approved':'pending_approval');
        prepared.current=null;setFormState({key,value:emptyForm});
        setNotice({key,error:false,text:value.status==='approved'?'The server confirmed this request was already approved. The factor reset runs on the server; recovery is not complete.':'Recovery request recorded for independent approval. Nothing changes for the staff member until another administrator approves.'});
      });
    } catch(error) {if(active())setNotice({key,error:true,text:(error as Error).message});}
  };
  const approve = (event:React.FormEvent) => {
    event.preventDefault();if(!active() || !action || busy.current)return;
    const row=directory.items.find(r=>r.requestId===action.requestId);
    if(!row || !recoveryCanApprove(row,user?.id))return;
    void run(signal=>api.staffAccess.approveRecovery(row.requestId,signal),value=>{
      validateRecoveryResult(value,row.requestId,row.targetUid,'approved');setActionState(null);
      setNotice({key,error:false,text:'The server confirmed approval: staff access is suspended, sessions are revoked, and a factor reset is queued; recovery is not complete until re-enrolment and independent reactivation.'});
    });
  };
  const operate = (event:React.FormEvent) => {
    event.preventDefault();if(!active() || !op || busy.current)return;
    const row=directory.items.find(r=>r.requestId===op.row.requestId);
    if(!row || !row.actions[op.kind])return;
    const kind=op.kind, reason=op.reason.trim();
    if(kind==='cancel' && reason.length<10){setNotice({key,error:true,text:'A cancellation reason needs at least 10 characters.'});return;}
    void run(signal=>kind==='complete'?api.staffAccess.completeRecovery(row.requestId,signal):kind==='cancel'?api.staffAccess.cancelRecovery(row.requestId,reason,signal):api.staffAccess.retryRecovery(row.requestId,signal),value=>{
      const ok=kind==='complete'?value?.status==='completed':kind==='cancel'?value?.status==='cancelled':value?.status==='pending';
      if(!ok)throw new Error('Unconfirmed recovery action');
      setOpState(null);
      setNotice({key,error:false,text:kind==='complete'?'The server confirmed reactivation. The staff member must now sign in again with their new authenticator.':kind==='cancel'?'The recovery request was cancelled.':'The failed reset was queued again.'});
    });
  };
  const loadHistory = (row:RecoveryRow) => {
    if(!active())return;
    if(history?.requestId===row.requestId){setHistoryState(null);return;}
    const controller=new AbortController();controllers.current.add(controller);
    setHistoryState({key,requestId:row.requestId,status:'loading',items:[]});
    api.staffAccess.recoveryHistory(row.requestId,controller.signal).then(value=>{
      if(!active() || controller.signal.aborted)return;
      if(!value || value.requestId!==row.requestId || !Array.isArray(value.items))throw new Error('Invalid history');
      setHistoryState({key,requestId:row.requestId,status:'ready',items:value.items});
    }).catch(()=>{if(active())setHistoryState({key,requestId:row.requestId,status:'error',items:[]});}).finally(()=>controllers.current.delete(controller));
  };
  if(!directory.allowed)return <section><h3 className="text-lg font-bold text-white">Staff MFA recovery</h3><p role="status">An active administrator session is required to manage staff MFA recovery.</p></section>;
  const isPending=pending===key;
  const eligibleMembers=members.filter(member=>member.uid!==user?.id && !['client','super_admin','super_administrator'].includes(member.role));
  return <section aria-labelledby="staff-recovery-heading" className="space-y-4 rounded-xl border border-slate-600 bg-[#071A2E] p-4 text-sm text-slate-200">
    <header><h3 id="staff-recovery-heading" className="text-xl font-bold text-white">Staff MFA recovery</h3><p className="mt-2 text-amber-200">Recovery: request → independent approval (staff suspended, sessions revoked) → server removes every previous authenticator → the staff member enrols a new one → an administrator other than the staff member reactivates.</p><p className="mt-1 text-slate-400">Every change needs an MFA sign-in from the last 15 minutes. The requester and approver must be different people, and nobody may act on their own recovery.</p></header>
    <form aria-label="Request staff MFA recovery" onSubmit={request} className="space-y-3">
      <h4 className="font-bold text-amber-200">Request recovery</h4>
      <label className="block">Target staff UID<input required maxLength={128} autoComplete="off" list="staff-recovery-targets" value={form.targetUid} disabled={isPending} onChange={e=>change({...form,targetUid:e.target.value})} className={inputClass} /></label>
      <datalist id="staff-recovery-targets">{eligibleMembers.map(member=><option key={member.uid} value={member.uid}>{member.name} ({member.role})</option>)}</datalist>
      <p className="text-slate-400">Enter the exact staff UID from the authoritative membership record. Suggestions cover only the currently displayed directory page.</p>
      <label className="block">Recovery category<select value={form.reasonCategory} disabled={isPending} onChange={e=>change({...form,reasonCategory:e.target.value as RecoveryCategory})} className={inputClass}>{RECOVERY_CATEGORIES.map(category=><option key={category} value={category}>{category.replaceAll('_',' ')}</option>)}</select></label>
      <label className="block">Recorded reason (required)<textarea required maxLength={1000} value={form.reason} disabled={isPending} onChange={e=>change({...form,reason:e.target.value})} className={inputClass} /></label>
      <p className="text-slate-400">Do not include passwords, recovery codes, or MFA secrets in the recorded reason.</p>
      <button disabled={isPending || !form.targetUid.trim() || !form.reason.trim()} className={buttonClass+' bg-amber-300 font-bold text-[#071A2E]'}>{isPending?'Waiting for server…':'Request independent approval'}</button>
    </form>
    {notice?.key===key && <p role={notice.error?'alert':'status'} className={notice.error?'text-red-300':'text-emerald-300'}>{notice.text}</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label>Recovery status<select value={directory.query.status??''} className={inputClass} onChange={e=>{if(active()){directory.setStatus(e.target.value as StaffRecoveryQuery['status']);setActionState(null);}}}><option value="">All statuses</option><option value="pending_approval">Pending approval</option><option value="approved">Approved</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
      <label>Recovery rows per page<select value={directory.query.limit??25} className={inputClass} onChange={e=>{if(active()){directory.setLimit(Number(e.target.value));setActionState(null);}}}><option value={25}>25</option><option value={50}>50</option></select></label>
      <button type="button" className={buttonClass} onClick={()=>{if(active()){directory.refresh();setActionState(null);}}}>Refresh recovery requests</button>
    </div>
    {directory.status==='loading' && <p role="status">Loading recovery requests…</p>}
    {directory.status==='empty' && <p role="status">No recovery requests match this filter.</p>}
    {directory.status==='unavailable' && <p role="alert">Recovery requests are unavailable for this session. Refresh or sign in again with MFA.</p>}
    {directory.status==='error' && <p role="alert">Recovery requests could not be loaded. Refresh recovery requests to retry.</p>}
    {directory.status==='ready' && <ul className="space-y-3">{directory.items.map(row=><li key={row.requestId} className="space-y-2 rounded-lg border border-slate-600 p-3 break-words">
      <h4 className="font-bold text-white">{row.targetName??'Staff member'} — {row.targetUid}</h4>
      <p>Role: {row.targetRole??'Unavailable'} · Status: {row.status.replaceAll('_',' ')}</p><p>Category: {row.reasonCategory.replaceAll('_',' ')}</p><p className="whitespace-pre-wrap">Recorded reason: {row.reason}</p>
      <p className="text-xs text-slate-400">Request: {row.requestId}<br/>Requested by: {row.makerUid} · Created: {row.createdAt}<br/>Approved by: {row.checkerUid??'Not approved'}{row.approvedAt && <> · Approved: {row.approvedAt}</>}</p>
      <p>Factor reset: {recoveryResetText(row)}</p>
      {row.completedAt && <p className="text-xs text-slate-400">Reactivated by: {row.completedBy} · {row.completedAt}</p>}
      {row.cancelledAt && <p className="text-xs text-slate-400">Cancelled: {row.cancelledAt}</p>}
      {recoveryCanApprove(row,user?.id) && <button type="button" disabled={isPending} className={buttonClass+' text-amber-200'} aria-label={'Review recovery approval for '+row.targetUid} onClick={e=>{if(active()&&!busy.current){trigger.current=e.currentTarget;setActionState({key,row});}}}>Review independent approval</button>}
      <div className="flex flex-wrap gap-2">
        {(['complete','retry','cancel'] as Operation[]).filter(kind=>row.actions[kind] && row.targetUid!==user?.id).map(kind=><button key={kind} type="button" disabled={isPending} className={buttonClass+' text-amber-200'}
          aria-label={(kind==='complete'?'Review reactivation for ':kind==='retry'?'Review reset retry for ':'Review cancellation for ')+row.targetUid}
          onClick={()=>{if(active()&&!busy.current)setOpState({key,kind,row,reason:''});}}>{kind==='complete'?'Review reactivation':kind==='retry'?'Review reset retry':'Review cancellation'}</button>)}
        <button type="button" className={buttonClass} aria-expanded={history?.requestId===row.requestId} aria-label={'Audit history for '+row.targetUid} onClick={()=>loadHistory(row)}>{history?.requestId===row.requestId?'Hide audit history':'Show audit history'}</button>
      </div>
      {history?.requestId===row.requestId && <div aria-label={'Audit history for request '+row.requestId}>
        {history.status==='loading' && <p role="status">Loading audit history…</p>}
        {history.status==='error' && <p role="alert">Audit history could not be loaded.</p>}
        {history.status==='ready' && (history.items.length===0 ? <p>No audit entries.</p> : <ol className="list-decimal pl-5 text-xs">{history.items.map((h,i)=><li key={i}>{h.at} · {h.action.replace(/^STAFF_MFA_/,'').replaceAll('_',' ').toLowerCase()} · {h.actorUid}{h.actorRole?' ('+h.actorRole+')':''}{Object.keys(h.details||{}).length?' · '+Object.entries(h.details).map(([k,v])=>k+': '+String(v)).join(', '):''}</li>)}</ol>)}
      </div>}
    </li>)}</ul>}
    {action && <form aria-labelledby="staff-recovery-approval-title" role="region" onSubmit={approve} className="space-y-3 rounded-lg border border-amber-300 p-4">
      <h4 id="staff-recovery-approval-title" tabIndex={-1} ref={heading} className="font-bold text-amber-200">Confirm recovery approval for {action.targetUid}</h4>
      <p>Current request state: {action.status.replaceAll('_',' ')}. Requested by: {action.makerUid}.</p><p>Category: {action.reasonCategory.replaceAll('_',' ')}. Recorded reason: {action.reason}</p>
      <p>Approval suspends this staff member, revokes their sessions, and queues a factor reset on the server. Recovery completes only after they enrol a new authenticator and an administrator reactivates them.</p>
      <div className="flex flex-wrap gap-3"><button disabled={isPending || !directory.items.some(row=>row.requestId===action.requestId && recoveryCanApprove(row,user?.id))} className={buttonClass+' text-amber-200'}>Confirm suspension and queue reset</button><button type="button" disabled={isPending} className={buttonClass} onClick={cancel}>Cancel recovery approval</button></div>
    </form>}
    {op && <form aria-labelledby="staff-recovery-operation-title" role="region" onSubmit={operate} className="space-y-3 rounded-lg border border-amber-300 p-4">
      <h4 id="staff-recovery-operation-title" className="font-bold text-amber-200">{op.kind==='complete'?'Confirm reactivation for ':op.kind==='retry'?'Confirm reset retry for ':'Confirm cancellation for '}{op.row.targetUid}</h4>
      <p>{op.kind==='complete'?'The server has verified a newly enrolled authenticator. Reactivation clears the MFA gate, restores access and invalidates every earlier sign-in; the staff member then signs in again.'
        :op.kind==='retry'?'The previous reset attempt failed. A retry asks the server to remove the previous authenticators again; the staff member stays suspended until it succeeds.'
        :'Cancelling closes this request before approval. Nothing changes for the staff member.'}</p>
      {op.kind==='cancel' && <label className="block">Cancellation reason (recorded, at least 10 characters)<textarea required minLength={10} maxLength={1000} value={op.reason} onChange={e=>{if(active())setOpState({...op,reason:e.target.value});}} className={inputClass} /></label>}
      <div className="flex flex-wrap gap-3"><button disabled={isPending} className={buttonClass+' text-amber-200'}>{op.kind==='complete'?'Confirm reactivation':op.kind==='retry'?'Confirm reset retry':'Confirm cancellation'}</button>
        <button type="button" disabled={isPending} className={buttonClass} onClick={()=>{if(active()&&!busy.current)setOpState(null);}}>Back</button></div>
    </form>}
    <nav aria-label="Recovery request pagination" className="flex gap-3"><button type="button" disabled={!directory.query.cursor || directory.status==='loading'} className={buttonClass} onClick={()=>{if(active()){directory.firstPage();setActionState(null);}}}>First recovery page</button><button type="button" disabled={!directory.nextCursor || directory.status==='loading'} className={buttonClass} onClick={()=>{if(active()){directory.nextPage();setActionState(null);}}}>Next recovery page</button></nav>
  </section>;
}
