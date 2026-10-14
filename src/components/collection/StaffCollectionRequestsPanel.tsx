import React,{useEffect,useRef,useState} from 'react';
import {api,getStoredToken} from '../../services/api';
import {useApp} from '../../context/AppContext';
export function StaffCollectionRequestsPanel({clientId,engagements}:{clientId:string;engagements:Array<{engagementId:string;title:string;status:string;taxYears:Array<{taxYear:number}>}>}){
 const {currentUser,authLifecycleState}=useApp(),token=getStoredToken();
 const allowed=authLifecycleState==='AUTHENTICATED'&&currentUser?.status==='active'&&!!currentUser.tenantId&&!!token&&['practice_manager','accountant','reviewer','senior_reviewer','admin','administrator','super_admin','super_administrator'].includes(currentUser.role);
 const [selection,setSelection]=useState(''),[refresh,setRefresh]=useState(0),[rows,setRows]=useState<{key:string;state:'loading'|'ready'|'error';items:any[]}>({key:'',state:'loading',items:[]});
 const [draft,setDraft]=useState({title:'',message:''}),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);const idem=useRef('collection-'+globalThis.crypto.randomUUID());
 const key=JSON.stringify([currentUser?.id,currentUser?.tenantId,clientId,selection,token,allowed]);const [engagementId,year]=selection.split('|'),taxYear=Number(year);
 useEffect(()=>{let active=true;const controller=new AbortController();setRows({key,state:'loading',items:[]});
  if(allowed&&engagementId&&Number.isInteger(taxYear))void api.clientDashboard.read<any>('requests',clientId,taxYear,controller.signal,engagementId).then(value=>{
   if(value?.tenantId!==currentUser!.tenantId||value.clientId!==clientId||value.taxYear!==taxYear||!Array.isArray(value.requests))throw new Error();if(active)setRows({key,state:'ready',items:value.requests});
  }).catch(()=>{if(active)setRows({key,state:'error',items:[]});});return()=>{active=false;controller.abort();};},[key,refresh]);
 if(!allowed)return <p role="alert">An active authorized staff session is required for collection requests.</p>;
 const current=rows.key===key?rows:undefined;
 const create=async(e:React.FormEvent)=>{e.preventDefault();if(busy||!engagementId)return;setBusy(true);setNotice('');try{await api.clientDashboard.createCollectionRequest(clientId,taxYear,engagementId,{...draft,requestType:'CLARIFICATION'},idem.current);if(getStoredToken()===token){idem.current='collection-'+globalThis.crypto.randomUUID();setDraft({title:'',message:''});setNotice('Clarification request recorded.');setRefresh(v=>v+1);}}catch{if(getStoredToken()===token)setNotice('The server did not confirm this request. Refresh or retry.');}finally{setBusy(false);}};
 const resolve=async(r:any)=>{try{await api.clientDashboard.resolveCollectionRequest(clientId,taxYear,engagementId,r.requestId,r.rowVersion);if(getStoredToken()===token){setNotice('Clarification request resolved.');setRefresh(v=>v+1);}}catch{if(getStoredToken()===token)setNotice('The request changed or resolution was not confirmed. Refresh and retry.');}};
 return <section aria-label="Client clarification requests"><h4>Client clarification requests</h4>
  <label>Collection engagement and year<select value={selection} onChange={e=>{setSelection(e.target.value);setNotice('');idem.current='collection-'+globalThis.crypto.randomUUID();}}><option value="">Select engagement and year</option>{engagements.filter(e=>e.status==='active').flatMap(e=>e.taxYears.map(y=><option key={e.engagementId+'|'+y.taxYear} value={e.engagementId+'|'+y.taxYear}>{e.title} ({y.taxYear})</option>))}</select></label>
  {notice&&<p role="status">{notice}</p>}{selection&&<><form onSubmit={create}><label>Clarification title<input required minLength={2} maxLength={255} value={draft.title} onChange={e=>{setDraft({...draft,title:e.target.value});idem.current='collection-'+globalThis.crypto.randomUUID();}}/></label><label>Clarification message<textarea required minLength={2} maxLength={4000} value={draft.message} onChange={e=>{setDraft({...draft,message:e.target.value});idem.current='collection-'+globalThis.crypto.randomUUID();}}/></label><button disabled={busy}>Create clarification request</button></form>
   {(!current||current.state==='loading')&&<p role="status">Loading clarification requests…</p>}{current?.state==='error'&&<p role="alert">Requests unavailable. <button onClick={()=>setRefresh(v=>v+1)}>Refresh requests</button></p>}
   {current?.state==='ready'&&<>{!current.items.length&&<p>No clarification requests.</p>}<ul>{current.items.map(r=><li key={r.requestId}>{r.title} · {r.status}<p>{r.message}</p>{r.clientResponse&&<p>Client reply: {r.clientResponse}</p>}{!['RESOLVED','CLOSED'].includes(r.status)&&<button onClick={()=>void resolve(r)}>Resolve clarification</button>}</li>)}</ul></>}
  </>}
 </section>;
}
