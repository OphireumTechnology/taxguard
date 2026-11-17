import {AuthorityError,casePath,safeId} from './taxguard/authority.repository';
import type {PracticeManagerSnapshot,PracticeManagerCase} from '../types/practiceManagerDashboard';
import type {PracticeTask,PracticeDeadline} from './taxguard/operations/types';
export async function projectPracticeManager(database:any,tenantId:string,uid:string,clientIds:string[],year:number|undefined,tasks:PracticeTask[],deadlines:PracticeDeadline[]):Promise<PracticeManagerSnapshot> {
 safeId(tenantId);safeId(uid);clientIds.forEach(safeId);
 return database.runTransaction(async(tx:any)=>{
  const member=(await tx.get(database.doc('taxguardTenants/'+tenantId+'/members/'+uid))).data();
  if(member?.role!=='practice_manager' || member.status!=='active' || (member.tenantId && member.tenantId!==tenantId))throw new AuthorityError('PRACTICE_MANAGER_REQUIRED',403);
  const cases:PracticeManagerCase[]=[];const staff=new Map<string,{id:string;role:string}>();
  for(const clientId of new Set(clientIds)) {
   const prefix='taxguardTenants/'+tenantId+'/clients/'+clientId;
   const client=(await tx.get(database.doc(prefix))).data();
   if(!client || (client.tenantId && client.tenantId!==tenantId))continue;
   const engagements=await tx.get(database.collection(prefix+'/engagements'));
   for(const engagement of engagements.docs){const e=engagement.data();if(e.clientId!==clientId || (e.tenantId && e.tenantId!==tenantId))continue;
    const years=await tx.get(database.collection(prefix+'/engagements/'+engagement.id+'/years'));
    for(const entry of years.docs){const y=Number(entry.id);if(!Number.isInteger(y)||y<2022||y>2200||(year && y!==year))continue;
     const c=entry.data();if(c.tenantId!==tenantId||c.clientId!==clientId||c.engagementId!==engagement.id||c.taxYear!==y||!Number.isInteger(c.activeStage)||c.activeStage<1||c.activeStage>18)continue;
     const scope={tenantId,clientId,engagementId:engagement.id,taxYear:y};const owners:string[]=[];
     for(const id of new Set([c.preparerUid,c.reviewerUid].filter(Boolean) as string[])){safeId(id);const assignment=(await tx.get(database.doc(casePath(scope)+'/assignments/'+id))).data();const expectedRole=id===c.preparerUid?'preparer':'reviewer';if(!assignment||assignment.uid!==id||assignment.active!==true||assignment.role!==expectedRole||!assignment.assignedAt||Date.parse(assignment.assignedAt)>Date.now()||!Number.isFinite(Date.parse(assignment.assignedAt)))continue;const m=(await tx.get(database.doc('taxguardTenants/'+tenantId+'/members/'+id))).data();if(m?.status==='active' && (expectedRole==='preparer'?['accountant','preparer']:['reviewer','senior_reviewer']).includes(m.role) && (!m.tenantId||m.tenantId===tenantId)){owners.push(id);staff.set(id,{id,role:m.role});}}
     const applicable=tasks.filter(t=>t.tenantId===tenantId&&t.clientId===clientId&&t.engagementId===engagement.id&&t.taxYear===y&&(!t.caseId||t.caseId===c.id));
     const due=e.taxYear===y||(Array.isArray(e.taxYears)&&e.taxYears.length===1&&e.taxYears[0]===y)?e.dueDate:e.dueDates?.[y];
     const validDate=(d:unknown):d is string=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(d)&&Number.isFinite(Date.parse(d));
     cases.push({id:casePath(scope),clientId,engagementId:engagement.id,taxYear:y,stage:c.activeStage,status:c.status||'Not recorded',updatedAt:validDate(c.updatedAt)?c.updatedAt:undefined,owners,waiting:applicable.some(t=>t.status==='WAITING_ON_CLIENT'),review:applicable.some(t=>t.status==='READY_FOR_REVIEW')||c.status==='IN_REVIEW',dueDates:[...(validDate(due)?[due]:[]),...applicable.filter(t=>!['COMPLETED','CANCELLED'].includes(t.status)&&validDate(t.dueDate)).map(t=>t.dueDate!)]});
    }
   }
  }
  const visibleDeadlines:PracticeManagerSnapshot['deadlines']=[];
  for(const d of deadlines){if(d.tenantId!==tenantId||!d.clientId||!Number.isInteger(d.taxYear)||!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(d.dueDate)||!Number.isFinite(Date.parse(d.dueDate)))continue;
   const matches=cases.filter(c=>c.clientId===d.clientId&&c.taxYear===d.taxYear&&(!d.caseId||d.caseId==='case_'+c.taxYear||d.caseId===c.id));
   // Do not assign a client/year-only deadline to an ambiguous engagement.
   if(matches.length!==1)continue;const c=matches[0];
   visibleDeadlines.push({id:d.id,caseId:c.id,clientId:c.clientId,taxYear:c.taxYear,dueDate:d.dueDate,category:d.category,authority:d.authorityType,status:d.status,escalation:d.escalationLevel,createdAt:Number.isFinite(Date.parse(d.createdAt))?d.createdAt:undefined});
   if(!['MET','WAIVED'].includes(d.status))c.dueDates.push(d.dueDate);
  }
  return {tenantId,cases,deadlines:visibleDeadlines,staff:[...staff.values()],capabilities:{managementMutations:false,capacity:false,slaPolicy:false,completionTrends:false,aiAnalysis:false}};
 });
}
