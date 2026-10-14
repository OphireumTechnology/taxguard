import React,{useEffect,useState} from 'react';
import {useApp} from '../../context/AppContext';
import {api,getStoredToken} from '../../services/api';
import {vaultService} from '../../services/vaultService';
import {submitWaiverClaim} from '../../services/collectionClient';
import {ClientDocumentVaultPanel} from '../documents/ClientDocumentVaultPanel';
import {TaxQuestionnaireModal} from './TaxQuestionnaireModal';
/** No browser checklist, demonstration facts or local workflow completion authority. */
export function DurableClientCollectionWorkspace({clientId,taxYear}:{clientId:string;taxYear:number}){
 const {currentUser,authLifecycleState}=useApp();const token=getStoredToken();
 const allowed=authLifecycleState==='AUTHENTICATED'&&!!token&&currentUser?.status==='active'&&['client','prospective_client'].includes(currentUser.role)&&currentUser.clientId===clientId&&!!currentUser.tenantId;
 const key=JSON.stringify([currentUser?.id,currentUser?.tenantId,clientId,taxYear,token,allowed]);
 const [targets,setTargets]=useState<{key:string;items:Array<{engagementId:string;title:string;taxYear:number}>}>({key:'',items:[]});
 const [engagement,setEngagement]=useState(''),[refresh,setRefresh]=useState(0),[modal,setModal]=useState(false),[notice,setNotice]=useState('');
 const [data,setData]=useState<{key:string;engagement:string;state:'loading'|'ready'|'error';value?:any;requests?:any[]}>({key:'',engagement:'',state:'loading'});
 useEffect(()=>{let active=true;setEngagement('');setModal(false);setNotice('');setTargets({key,items:[]});if(allowed)void vaultService.uploadTargets(clientId).then(result=>{if(!active)return;const items=result.items.filter(t=>t.taxYear===taxYear);setTargets({key,items});if(items.length===1)setEngagement(items[0].engagementId);}).catch(()=>{if(active)setData({key,engagement:'',state:'error'});});return()=>{active=false;};},[key]);
 useEffect(()=>{const controller=new AbortController();let active=true;setData({key,engagement,state:'loading'});
  if(allowed&&engagement)void Promise.all([api.clientDashboard.read<any>('questionnaire',clientId,taxYear,controller.signal,engagement),api.clientDashboard.read<any>('requests',clientId,taxYear,controller.signal,engagement)]).then(([value,requests])=>{
   if(value?.tenantId!==currentUser!.tenantId||value.clientId!==clientId||value.taxYear!==taxYear||value.engagementId!==engagement||requests?.tenantId!==currentUser!.tenantId||requests.clientId!==clientId||requests.taxYear!==taxYear||!Array.isArray(requests.requests))throw new Error('COLLECTION_SCOPE_REQUIRED');
   if(active)setData({key,engagement,state:'ready',value,requests:requests.requests});
  }).catch(()=>{if(active)setData({key,engagement,state:'error'});});return()=>{active=false;controller.abort();};},[key,engagement,refresh]);
 if(!allowed)return <p role="alert">Collection access requires your active client session.</p>;
 const current=data.key===key&&data.engagement===engagement?data:undefined;
 const claim=async(requirement:any)=>{const reason=window.prompt('Explain why this requirement may not apply. Your tax team must review the claim.');if(!reason)return;try{await submitWaiverClaim(clientId,taxYear,requirement.id,reason,engagement);if(getStoredToken()===token){setNotice('Claim recorded for professional review. The requirement remains open.');setRefresh(v=>v+1);}}catch{if(getStoredToken()===token)setNotice('The server did not confirm this claim. Refresh and retry.');}};
 const reply=async(request:any)=>{const message=window.prompt('Reply to this practice request:');if(!message)return;try{await api.clientDashboard.respond(taxYear,request.requestId,message,engagement);if(getStoredToken()===token){setNotice('Reply recorded.');setRefresh(v=>v+1);}}catch{if(getStoredToken()===token)setNotice('The server did not confirm this reply. Refresh and retry.');}};
 return <section className="space-y-4 p-4 text-slate-200" aria-label="Document collection">
  <h2>Document collection · {taxYear}</h2><p>Your questionnaire is a draft of client-reported facts. Your tax team must verify facts and requirements before advancing the case.</p>
  <label>Engagement <select value={engagement} onChange={e=>{setEngagement(e.target.value);setNotice('');}} className="bg-slate-800"><option value="">Select an engagement</option>{(targets.key===key?targets.items:[]).map(t=><option key={t.engagementId} value={t.engagementId}>{t.title}</option>)}</select></label>
  {!engagement&&<p role="status">Select an open engagement for this year. If none is available, contact your practice team.</p>}
  {notice&&<p role="status">{notice}</p>}
  {engagement&&(!current||current.state==='loading')&&<p role="status">Loading collection records…</p>}
  {current?.state==='error'&&<p role="alert">Collection records are unavailable. <button onClick={()=>setRefresh(v=>v+1)}>Retry</button></p>}
  {current?.state==='ready'&&<><button onClick={()=>setModal(true)}>{current.value.hasQuestionnaire?'Edit questionnaire draft':'Start questionnaire draft'}</button>
   <h3>Document requirements</h3>{!current.value.requirements?.length&&<p>No requirements recorded yet. Complete the questionnaire draft for professional review.</p>}
   <ul>{(current.value.requirements||[]).map((r:any)=><li key={r.requirementCode}>{r.title||r.requirementCode} · {r.status} <button onClick={()=>void claim(r)}>Request applicability review</button></li>)}</ul>
   <h3>Practice clarification requests</h3>{!current.requests?.length&&<p>No clarification requests.</p>}<ul>{current.requests?.map(r=><li key={r.requestId}>{r.title} · {r.status}<p>{r.message}</p>{r.clientResponse&&<p>Your reply: {r.clientResponse}</p>}{!['RESOLVED','CLOSED'].includes(r.status)&&<button onClick={()=>void reply(r)}>Reply</button>}</li>)}</ul>
  </>}
  <ClientDocumentVaultPanel key={key} clientId={clientId}/>
  {modal&&engagement&&<TaxQuestionnaireModal isOpen onClose={()=>setModal(false)} clientId={clientId} taxYear={taxYear} engagementId={engagement} onSaved={()=>{setModal(false);setRefresh(v=>v+1);}}/>}
 </section>;
}
