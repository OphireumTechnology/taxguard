import {AuthorityError,casePath,safeId} from './taxguard/authority.repository';
import type {ClientServiceSnapshot,ClientServiceCase} from '../types/clientServiceDashboard';
import type {ClientRequestService} from './taxguard/operations/clientRequest.service';
import type {ClientCommunicationService} from './taxguard/operations/clientCommunication.service';
import type {PracticeTask,PracticeDeadline} from './taxguard/operations/types';
export interface ClientServiceSources {database:any;requests:ClientRequestService;communications:ClientCommunicationService;tasks:PracticeTask[];deadlines:PracticeDeadline[]}
const validDate=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v)&&Number.isFinite(Date.parse(v));
export async function readClientService(s:ClientServiceSources,tenantId:string,uid:string,clientIds:string[],year?:number){
 safeId(tenantId);safeId(uid);clientIds.forEach(safeId);
 const nativeIds=new Map<string,string>();
 const cases:ClientServiceCase[]=await s.database.runTransaction(async(tx:any)=>{
  const member=(await tx.get(s.database.doc('taxguardTenants/'+tenantId+'/members/'+uid))).data();
  if(member?.role!=='operations'||member.status!=='active'||(member.tenantId&&member.tenantId!==tenantId))throw new AuthorityError('CLIENT_SERVICE_REQUIRED',403);
  const rows:ClientServiceCase[]=[];
  for(const clientId of new Set(clientIds)){
   const root='taxguardTenants/'+tenantId+'/clients/'+clientId;const client=(await tx.get(s.database.doc(root))).data();
   if(!client||(client.tenantId&&client.tenantId!==tenantId))continue;
   for(const e of (await tx.get(s.database.collection(root+'/engagements'))).docs){const engagement=e.data();if(engagement.clientId!==clientId||(engagement.tenantId&&engagement.tenantId!==tenantId))continue;
    for(const y of (await tx.get(s.database.collection(root+'/engagements/'+e.id+'/years'))).docs){const taxYear=Number(y.id);const c=y.data();if(!Number.isInteger(taxYear)||taxYear<2022||taxYear>2200||(year&&taxYear!==year)||c.tenantId!==tenantId||c.clientId!==clientId||c.engagementId!==e.id||c.taxYear!==taxYear||!Number.isInteger(c.activeStage)||c.activeStage<1||c.activeStage>18)continue;
     const id=casePath({tenantId,clientId,engagementId:e.id,taxYear});const documents:Record<string,number>=Object.create(null);
     for(const doc of (await tx.get(s.database.collection(id+'/documents'))).docs){const d=doc.data();if(d.tenantId===tenantId&&d.clientId===clientId&&d.engagementId===e.id&&d.taxYear===taxYear&&(!d.caseId||d.caseId==='case_'+taxYear||d.caseId===id)&&typeof d.status==='string')documents[d.status]=(documents[d.status]||0)+1;}
     rows.push({id,clientId,engagementId:e.id,taxYear,stage:c.activeStage,status:c.status||'Not recorded',documents});if(c.id==='case_'+taxYear)nativeIds.set(id,c.id);
    }
   }
  }
  return rows;
 });
 const match=(r:{tenantId:string;clientId?:string;engagementId?:string;caseId?:string})=>{
  if(r.tenantId!==tenantId||!r.clientId||!r.engagementId||!r.caseId)return undefined;
  const rows=cases.filter(c=>c.clientId===r.clientId&&c.engagementId===r.engagementId&&(r.caseId===c.id||r.caseId===nativeIds.get(c.id)));return rows.length===1?rows[0]:undefined;
 };
 const requests:ClientServiceSnapshot['requests']=[];const threads:ClientServiceSnapshot['threads']=[];
 for(const clientId of new Set(cases.map(c=>c.clientId))){
  for(const r of s.requests.queryRequests({tenantId,clientId,callerRole:'operations'})){const c=match(r);if(!c||r.assignedToClientId!==c.clientId)continue;requests.push({id:r.id,caseKey:c.id,type:r.requestType,status:r.status,priority:r.priority,createdAt:validDate(r.createdAt)?r.createdAt:undefined,dueDate:validDate(r.dueDate)?r.dueDate:undefined});}
  for(const t of s.communications.queryThreads({tenantId,clientId,callerRole:'operations'})){const c=match(t);if(!c)continue;
   const messages=s.communications.getThreadMessages(t.id,tenantId,'client',c.clientId,c.clientId).filter(m=>m.clientId===c.clientId&&m.tenantId===tenantId&&m.visibility==='CLIENT_VISIBLE');
   threads.push({id:t.id,caseKey:c.id,category:t.category,status:t.status,lastMessageAt:messages.filter(m=>validDate(m.createdAt)).map(m=>m.createdAt).sort().at(-1),messageCount:messages.length,unread:messages.filter(m=>m.senderRole==='client'&&m.isRead===false).length});
  }
 }
 const followUps:ClientServiceSnapshot['followUps']=[];
 for(const t of s.tasks){if(!t.engagementId||!Number.isInteger(t.taxYear)||t.tenantId!==tenantId)continue;const candidates=cases.filter(c=>c.clientId===t.clientId&&c.engagementId===t.engagementId&&c.taxYear===t.taxYear&&(!t.caseId||t.caseId===nativeIds.get(c.id)||t.caseId===c.id));if(candidates.length!==1)continue;const c=candidates[0];
  if(!['WAITING_ON_CLIENT','BLOCKED','COMPLETED'].includes(t.status))continue;
  // Generic bookkeeping/tax tasks are not operational follow-up obligations.
  if(!['CLIENT_FOLLOW_UP','DOCUMENT_FOLLOW_UP','QUESTIONNAIRE_FOLLOW_UP','APPOINTMENT_FOLLOW_UP','SIGNATURE_FOLLOW_UP'].includes(t.taskType))continue;
  followUps.push({id:t.id,caseKey:c.id,type:t.taskType,status:t.status,priority:t.priority,createdAt:validDate(t.createdAt)?t.createdAt:undefined,dueDate:validDate(t.dueDate)?t.dueDate:undefined,owner:t.assignedUserId===uid?uid:undefined});
 }
 const escalations:ClientServiceSnapshot['escalations']=[];
 for(const d of s.deadlines){if(d.tenantId!==tenantId||!d.clientId||!Number.isInteger(d.taxYear)||!d.caseId||!validDate(d.dueDate)||d.escalationLevel<=0||['MET','WAIVED'].includes(d.status))continue;const matches=cases.filter(c=>c.clientId===d.clientId&&c.taxYear===d.taxYear&&(d.caseId===c.id||d.caseId===nativeIds.get(c.id)));if(matches.length!==1)continue;escalations.push({id:d.id,caseKey:matches[0].id,category:d.category,status:d.status,level:d.escalationLevel,dueDate:d.dueDate,createdAt:validDate(d.createdAt)?d.createdAt:undefined});}
 const snapshot:ClientServiceSnapshot={tenantId,cases,requests,threads,followUps,escalations,capabilities:{appointments:false,mutations:false,sla:false,ai:false,privateDocuments:false}};
 return {snapshot,match};
}
export function readClientServiceConversation(s:ClientServiceSources,read:Awaited<ReturnType<typeof readClientService>>,tenantId:string,threadId:string,caseKey:string){
 const visible=read.snapshot.threads.find(t=>t.id===threadId&&t.caseKey===caseKey);if(!visible)throw new AuthorityError('CONVERSATION_ACCESS_DENIED',403);
 const c=read.snapshot.cases.find(c=>c.id===caseKey)!;const thread=s.communications.getThread(threadId,tenantId);if(!thread||read.match(thread)?.id!==caseKey)throw new AuthorityError('CONVERSATION_ACCESS_DENIED',403);
 return {tenantId,caseKey,threadId,messages:s.communications.getThreadMessages(threadId,tenantId,'client',c.clientId,c.clientId).filter(m=>m.tenantId===tenantId&&m.clientId===c.clientId&&m.visibility==='CLIENT_VISIBLE').map(m=>({id:m.id,role:m.senderRole,content:m.content,read:m.isRead,createdAt:m.createdAt}))};
}
export function readClientServiceRequest(s:ClientServiceSources,read:Awaited<ReturnType<typeof readClientService>>,tenantId:string,requestId:string,caseKey:string){
 const visible=read.snapshot.requests.find(r=>r.id===requestId&&r.caseKey===caseKey);const r=s.requests.getRequest(requestId);const c=read.snapshot.cases.find(c=>c.id===caseKey);if(!visible||!r||!c||r.assignedToClientId!==c.clientId||read.match(r)?.id!==caseKey)throw new AuthorityError('REQUEST_ACCESS_DENIED',403);return {tenantId,caseKey,requestId,title:r.title,description:r.description,status:r.status};
}
