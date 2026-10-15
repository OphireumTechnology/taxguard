import React, { useEffect, useRef, useState } from 'react';
import type { User } from '../../types';
import type { StaffMemberRecord } from '../../types/staffAccess';
import type { StaffRecoveryQuery } from '../../types/staffRecovery';
import { api, getStoredToken } from '../../services/api';
import { staffSessionKey } from '../../hooks/useStaffAccessDirectory';
import { normalizeCancellationReason, normalizeRecoveryInput, RECOVERY_CATEGORIES, recoveryCanApprove, recoveryCanFollowUp, useStaffMfaRecovery, validateRecoveryFollowUp, validateRecoveryResult } from '../../hooks/useStaffMfaRecovery';
import type { RecoveryCategory, RecoveryFollowUp, RecoveryInput, RecoveryRow } from '../../hooks/useStaffMfaRecovery';
type RecoveryAction = 'approve' | RecoveryFollowUp;
const canAct = (row: RecoveryRow, kind: RecoveryAction, actorUid: string | undefined) => kind === 'approve' ? recoveryCanApprove(row, actorUid) : recoveryCanFollowUp(row, kind, actorUid);
const ACTION_LABEL: Record<RecoveryAction, string> = { approve: 'Review independent approval', complete: 'Review recovery completion', cancel: 'Cancel recovery request', retry: 'Re-queue failed reset' };
function resetDescription(row: RecoveryRow) {
  if (!row.jobId) return 'No reset job (not approved).';
  const attempts = row.jobAttempts ? ` after ${row.jobAttempts} attempt${row.jobAttempts === 1 ? '' : 's'}` : '';
  switch (row.jobStatus) {
    case 'pending': return row.resetAvailability === 'verified' ? 'Reset job queued.' : 'Reset job queued; factor reset is unavailable in this environment, so the member stays suspended.';
    case 'leased': return 'Reset in progress.';
    case 'reset_verified': return 'Factors removed and verified. Waiting for the staff member to sign in and enrol a new authenticator.';
    case 'enrollment_verified': return 'New authenticator verified. An independent administrator can complete recovery.';
    case 'completed': return 'Recovery completed; the staff member must sign in again.';
    case 'failed': return `Reset failed${attempts}${row.jobLastError ? ` (${row.jobLastError})` : ''}. The member stays suspended.`;
    default: return 'Reset state unavailable.';
  }
}
const inputClass = 'w-full rounded-lg border border-slate-500 bg-[#071A2E] px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-300';
const buttonClass = 'rounded-lg border border-slate-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 disabled:cursor-not-allowed';
const emptyForm = {targetUid:'',reasonCategory:'lost_authenticator' as RecoveryCategory,reason:''};
export function StaffMfaRecoveryPanel({user,authStatus,members=[],refresh=0}:{user:User|null;authStatus:string;members?:StaffMemberRecord[];refresh?:number}) {
  const directory = useStaffMfaRecovery(user,authStatus,refresh), key = directory.sessionKey;
  const latest = useRef(key); latest.current = key;
  const mounted = useRef(true), controllers = useRef(new Set<AbortController>()), busy = useRef(false);
  const prepared = useRef<{key:string;fingerprint:string;input:RecoveryInput}|null>(null);
  const [formState,setFormState] = useState({key,value:emptyForm});
  const form = formState.key===key?formState.value:emptyForm;
  const [actionState,setActionState] = useState<{key:string;row:RecoveryRow;kind?:RecoveryAction}|null>(null);
  const action = actionState?.key===key?actionState.row:null, actionKind: RecoveryAction = actionState?.kind ?? 'approve';
  const [notice,setNotice] = useState<{key:string;error:boolean;text:string}|null>(null);
  const [pending,setPending] = useState<string|null>(null);
  const heading = useRef<HTMLHeadingElement>(null), trigger = useRef<HTMLButtonElement|null>(null);
  const [cancelState,setCancelState] = useState({key,reason:''});
  const cancelReason = cancelState.key===key?cancelState.reason:'';
  const active = () => mounted.current && directory.allowed && latest.current===key && staffSessionKey(user,authStatus,getStoredToken())===key;
  useEffect(() => {
    mounted.current=true; busy.current=false; prepared.current=null;
    setFormState({key,value:emptyForm});setActionState(null);setNotice(null);setPending(null);
    return () => {mounted.current=false; controllers.current.forEach(c=>c.abort());controllers.current.clear();};
  },[key]);
  useEffect(() => {if(action) heading.current?.focus();},[key,actionState]);
  const change = (value:typeof emptyForm) => {if(active() && !busy.current) setFormState({key,value});};
  const cancel = () => {if(!active() || busy.current)return;setActionState(null);setCancelState({key,reason:''});if(trigger.current?.isConnected)trigger.current.focus();};
  const run = async (operation:(signal:AbortSignal)=>Promise<unknown>, success:(value:any)=>void) => {
    if(!active() || busy.current)return;
    const token=getStoredToken(), controller=new AbortController();controllers.current.add(controller);busy.current=true;setPending(key);setNotice(null);
    const current = () => active() && getStoredToken()===token && !controller.signal.aborted;
    try {const value=await operation(controller.signal);if(!current())return;success(value);directory.refresh();}
    catch(error) {if(current())setNotice({key,error:true,text:['STAFF_RECENT_SIGN_IN_REQUIRED','STAFF_FRESH_SIGN_IN_REQUIRED'].includes((error as any)?.code)
      ?'The server did not confirm this recovery action: this action needs a sign-in with MFA in the last 15 minutes. Sign out, sign in again, then retry.'
      :'The server did not confirm this recovery action. Refresh current requests before retrying. A request retry keeps its original request ID.'});}
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
        setNotice({key,error:false,text:value.status==='approved'?'The server confirmed this request was already approved. Factor reset remains unavailable; recovery is not complete.':'Recovery request recorded for independent approval. No factor reset has been completed.'});
      });
    } catch(error) {if(active())setNotice({key,error:true,text:(error as Error).message});}
  };
  const approve = (event:React.FormEvent) => {
    event.preventDefault();if(!active() || !action || busy.current)return;
    const row=directory.items.find(r=>r.requestId===action.requestId);
    if(!row || !canAct(row,actionKind,user?.id))return;
    if(actionKind==='approve') return void run(signal=>api.staffAccess.approveRecovery(row.requestId,signal),value=>{
      validateRecoveryResult(value,row.requestId,row.targetUid,'approved');setActionState(null);
      setNotice({key,error:false,text:'The server confirmed approval: staff access is suspended, sessions are revoked, and a reset job is queued. Factor reset is unavailable; recovery is not complete.'});
    });
    if(actionKind==='complete') return void run(signal=>api.staffAccess.completeRecovery(row.requestId,signal),value=>{
      validateRecoveryFollowUp(value,'complete',row);setActionState(null);
      setNotice({key,error:false,text:'The server confirmed recovery is complete: the member is active again and must sign in with the new authenticator.'});
    });
    if(actionKind==='retry') return void run(signal=>api.staffAccess.retryRecoveryReset(row.requestId,signal),value=>{
      validateRecoveryFollowUp(value,'retry',row);setActionState(null);
      setNotice({key,error:false,text:'The server re-queued the failed reset job. The member stays suspended until reset, re-enrolment and completion.'});
    });
    let reason:string;
    try {reason=normalizeCancellationReason(cancelReason);} catch(error) {setNotice({key,error:true,text:(error as Error).message});return;}
    void run(signal=>api.staffAccess.cancelRecovery(row.requestId,reason,signal),value=>{
      validateRecoveryFollowUp(value,'cancel',row);setActionState(null);setCancelState({key,reason:''});
      setNotice({key,error:false,text:'The server confirmed the recovery request was cancelled. Nothing was changed for the staff member.'});
    });
  };
  if(!directory.allowed)return <section><h3 className="text-lg font-bold text-white">Staff MFA recovery</h3><p role="status">An active administrator session is required to manage staff MFA recovery.</p></section>;
  const isPending=pending===key;
  const eligibleMembers=members.filter(member=>member.uid!==user?.id && !['client','super_admin','super_administrator'].includes(member.role));
  return <section aria-labelledby="staff-recovery-heading" className="space-y-4 rounded-xl border border-slate-600 bg-[#071A2E] p-4 text-sm text-slate-200">
    <header><h3 id="staff-recovery-heading" className="text-xl font-bold text-white">Staff MFA recovery</h3><p className="mt-2 text-amber-200">Approval suspends staff access, revokes sessions, and queues a reset job; it does not complete recovery. Factors are reset only where a reset provider is configured for this environment. Recovery completes only after the staff member enrols a new authenticator and an independent administrator confirms it.</p><p className="mt-1 text-slate-400">The server requires administrator authorization and fresh MFA verification. The requester, approver, and target must be independent people.</p></header>
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
      <p>Factor reset: {resetDescription(row)}</p>
      {(row.completedAt || row.cancelledAt) && <p className="text-xs text-slate-400">{row.completedAt && <>Completed: {row.completedAt}{row.completedBy && <> by {row.completedBy}</>}</>}{row.cancelledAt && <>Cancelled: {row.cancelledAt}</>}</p>}
      <div className="flex flex-wrap gap-2">{(['approve','complete','retry','cancel'] as RecoveryAction[]).filter(kind=>canAct(row,kind,user?.id)).map(kind=>
        <button key={kind} type="button" disabled={isPending} className={buttonClass+' text-amber-200'} aria-label={(kind==='approve'?'Review recovery approval for ':ACTION_LABEL[kind]+' for ')+row.targetUid} onClick={e=>{if(active()&&!busy.current){trigger.current=e.currentTarget;setCancelState({key,reason:''});setActionState({key,row,kind});}}}>{ACTION_LABEL[kind]}</button>)}</div>
    </li>)}</ul>}
    {action && <form aria-labelledby="staff-recovery-approval-title" role="region" onSubmit={approve} className="space-y-3 rounded-lg border border-amber-300 p-4">
      <h4 id="staff-recovery-approval-title" tabIndex={-1} ref={heading} className="font-bold text-amber-200">{{approve:'Confirm recovery approval',complete:'Confirm recovery completion',retry:'Confirm reset re-queue',cancel:'Confirm recovery cancellation'}[actionKind]} for {action.targetUid}</h4>
      <p>Current request state: {action.status.replaceAll('_',' ')}. Requested by: {action.makerUid}.</p><p>Category: {action.reasonCategory.replaceAll('_',' ')}. Recorded reason: {action.reason}</p>
      {actionKind==='approve' && <p>Approval suspends this staff member, revokes their sessions, and queues a factor-reset job. Recovery remains incomplete until re-enrolment is verified and an independent administrator completes it.</p>}
      {actionKind==='complete' && <p>Reset state: {resetDescription(action)} Completing reactivates the member, clears the re-enrolment requirement and invalidates every earlier sign-in; they must sign in again with the new authenticator. Confirm the person's identity through your firm's out-of-band procedure before completing.</p>}
      {actionKind==='retry' && <p>Reset state: {resetDescription(action)} Re-queuing schedules another factor-reset attempt. The member stays suspended.</p>}
      {actionKind==='cancel' && <label className="block">Cancellation reason (10 to 1,000 characters)<textarea required minLength={10} maxLength={1000} value={cancelReason} disabled={isPending} onChange={e=>{if(active()&&!busy.current)setCancelState({key,reason:e.target.value});}} className={inputClass} /></label>}
      <div className="flex flex-wrap gap-3"><button disabled={isPending || !directory.items.some(row=>row.requestId===action.requestId && canAct(row,actionKind,user?.id)) || (actionKind==='cancel' && cancelReason.trim().length<10)} className={buttonClass+' text-amber-200'}>{{approve:'Confirm suspension and queue reset',complete:'Complete recovery and reactivate',retry:'Re-queue reset job',cancel:'Cancel this recovery request'}[actionKind]}</button><button type="button" disabled={isPending} className={buttonClass} onClick={cancel}>{actionKind==='approve'?'Cancel recovery approval':'Go back without changes'}</button></div>
    </form>}
    <nav aria-label="Recovery request pagination" className="flex gap-3"><button type="button" disabled={!directory.query.cursor || directory.status==='loading'} className={buttonClass} onClick={()=>{if(active()){directory.firstPage();setActionState(null);}}}>First recovery page</button><button type="button" disabled={!directory.nextCursor || directory.status==='loading'} className={buttonClass} onClick={()=>{if(active()){directory.nextPage();setActionState(null);}}}>Next recovery page</button></nav>
  </section>;
}
