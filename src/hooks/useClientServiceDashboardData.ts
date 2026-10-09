import {useEffect,useState} from 'react';
import {api,getStoredToken} from '../services/api';
import type {User} from '../types';
import type {ClientServiceSnapshot,ClientServiceConversation,ClientServiceRequestDetail,ClientServiceCase} from '../types/clientServiceDashboard';
export function useClientServiceDashboardData(user:User|null,auth:string,year:string,refresh:number){
 const allowed=auth==='AUTHENTICATED'&&user?.role==='operations'&&user.status==='active'&&Boolean(user.tenantId);
 const sessionKey=JSON.stringify([user?.id,user?.tenantId,user?.role,user?.status,auth,getStoredToken(),user?.authorizedClientIds]);const key=[sessionKey,year,refresh].join(':');
 const valid=year==='All'||(/^\d{4}$/.test(year)&&Number(year)>=2022&&Number(year)<=2200);
 const [state,setState]=useState<{key:string;status:'loading'|'ready'|'error';data:ClientServiceSnapshot|null}>({key:'',status:'loading',data:null});
 useEffect(()=>{if(!allowed||!valid){setState({key:'',status:'loading',data:null});return;}const controller=new AbortController();setState({key,status:'loading',data:null});api.clientService.getDashboard(year==='All'?undefined:Number(year),controller.signal).then(data=>{if(controller.signal.aborted)return;if(data.tenantId!==user!.tenantId||data.cases.some(c=>year!=='All'&&c.taxYear!==Number(year)))throw new Error('Scope mismatch');setState({key,status:'ready',data});}).catch(()=>{if(!controller.signal.aborted)setState({key,status:'error',data:null});});return ()=>controller.abort();},[key,allowed,valid]);
 return {allowed,sessionKey,scopeKey:key,status:!valid?'error':state.key===key?state.status:'loading',data:allowed&&valid&&state.key===key?state.data:null};
}
export function useClientServiceDetail(tenant:string|undefined,sessionKey:string,selected:ClientServiceCase|undefined,kind:'conversation'|'request',id:string,refresh:number){
 const key=JSON.stringify([sessionKey,tenant,selected?.id,selected?.clientId,selected?.engagementId,selected?.taxYear,kind,id,refresh]);
 const eligible=Boolean(tenant&&selected&&id);
 const [state,setState]=useState<{key:string;status:'loading'|'ready'|'error';data:ClientServiceConversation|ClientServiceRequestDetail|null}>({key:'',status:'loading',data:null});
 useEffect(()=>{if(!eligible){setState({key:'',status:'loading',data:null});return;}const controller=new AbortController();setState({key,status:'loading',data:null});const promise=kind==='conversation'?api.clientService.conversation(id,selected!.id,selected!.taxYear,controller.signal):api.clientService.requestDetail(id,selected!.id,selected!.taxYear,controller.signal);promise.then(data=>{if(controller.signal.aborted)return;if(data.tenantId!==tenant||data.caseKey!==selected!.id)throw new Error('Scope mismatch');if(kind==='conversation'?('threadId' in data?data.threadId!==id:true):('requestId' in data?data.requestId!==id:true))throw new Error('Identity mismatch');setState({key,status:'ready',data});}).catch(()=>{if(!controller.signal.aborted)setState({key,status:'error',data:null});});return ()=>controller.abort();},[key,eligible]);
 return {status:state.key===key?state.status:'loading',data:eligible&&state.key===key?state.data:null};
}
export function useClientServiceSearch(allowed:boolean,tenant:string|undefined,sessionKey:string,query:string,year:string,refresh:number){
 const key=JSON.stringify([sessionKey,tenant,query,year,refresh]);const valid=allowed&&Boolean(tenant)&&query.trim().length>=2&&query.length<=100&&(year==='All'||(/^\d{4}$/.test(year)&&Number(year)>=2022&&Number(year)<=2200));
 const [state,setState]=useState<{key:string;status:'loading'|'ready'|'error';matches:Omit<ClientServiceCase,'documents'>[]}>({key:'',status:'loading',matches:[]});
 useEffect(()=>{if(!valid){setState({key:'',status:'loading',matches:[]});return;}const controller=new AbortController();setState({key,status:'loading',matches:[]});const timer=setTimeout(()=>{api.clientService.search(query,year==='All'?undefined:Number(year),controller.signal).then(result=>{if(controller.signal.aborted)return;if(result.tenantId!==tenant||result.matches.some(c=>year!=='All'&&c.taxYear!==Number(year)))throw new Error('Scope mismatch');setState({key,status:'ready',matches:result.matches});}).catch(()=>{if(!controller.signal.aborted)setState({key,status:'error',matches:[]});});},250);return ()=>{clearTimeout(timer);controller.abort();};},[key,valid]);
 return {valid,status:state.key===key?state.status:'loading',matches:valid&&state.key===key?state.matches:[]};
}
