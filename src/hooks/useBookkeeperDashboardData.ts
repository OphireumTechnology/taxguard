import {useEffect,useState} from 'react';
import {api,getStoredToken} from '../services/api';
import type {User} from '../types';
import type {BookkeeperSnapshot} from '../types/bookkeeperDashboard';
export function useBookkeeperDashboardData(user:User|null,auth:string,client:string,year:string,period:string,refresh:number) {
  const allowed=auth==='AUTHENTICATED' && user?.status==='active' && user.role==='bookkeeper' && Boolean(user.tenantId);
  const key=[user?.id,user?.tenantId,user?.role,user?.status,auth,getStoredToken(),JSON.stringify(user?.authorizedClientIds),client,year,period,refresh].join(':');
  const eligible=allowed && !!client && /^\d{4}$/.test(year) && Number(year)>=2022;
  const [state,setState]=useState<{key:string;status:'loading'|'ready'|'error';data:BookkeeperSnapshot|null}>({key:'',status:'loading',data:null});
  useEffect(()=>{
    if(!eligible){setState({key:'',status:'loading',data:null});return;}
    const controller=new AbortController();setState({key,status:'loading',data:null});
    api.bookkeeper.getDashboard(client,Number(year),period||undefined,controller.signal).then(data=>{
      if(controller.signal.aborted)return;
      if(data.scope.tenantId!==user!.tenantId || data.scope.clientId!==client || data.scope.taxYear!==Number(year) || (data.scope.periodId||'')!==period)throw new Error('Scope mismatch');
      setState({key,status:'ready',data});
    }).catch(()=>{if(!controller.signal.aborted)setState({key,status:'error',data:null});});
    return ()=>controller.abort();
  },[key,eligible]);
  return {allowed,eligible,status:state.key===key?state.status:'loading',data:eligible && state.key===key?state.data:null};
}

export function useBookkeeperClientGrants(user:User|null,auth:string) {
  const key=[user?.id,user?.tenantId,user?.role,user?.status,auth,getStoredToken(),JSON.stringify(user?.authorizedClientIds)].join(':');
  const [state,setState]=useState<{key:string;clients:string[];error:boolean}>({key:'',clients:[],error:false});
  const allowed=auth==='AUTHENTICATED' && user?.status==='active' && user?.role==='bookkeeper' && Boolean(user.tenantId);
  useEffect(()=>{if(!allowed){setState({key:'',clients:[],error:false});return;}const controller=new AbortController();setState({key,clients:[],error:false});api.bookkeeper.getClients(controller.signal).then(result=>{if(controller.signal.aborted)return;if(result.tenantId!==user!.tenantId)throw new Error('Scope mismatch');setState({key,clients:result.clientIds,error:false});}).catch(()=>{if(!controller.signal.aborted)setState({key,clients:[],error:true});});return ()=>controller.abort();},[key,allowed]);
  return allowed&&state.key===key?state:{key,clients:[],error:false};
}
