import {useEffect,useState} from 'react';
import {api,getStoredToken} from '../services/api';
import type {User} from '../types';
import type {PracticeManagerSnapshot} from '../types/practiceManagerDashboard';
export function usePracticeManagerDashboardData(user:User|null,auth:string,year:string,refresh:number){
 const allowed=auth==='AUTHENTICATED'&&user?.role==='practice_manager'&&user.status==='active'&&Boolean(user.tenantId);
 const key=JSON.stringify([user?.id,user?.tenantId,user?.role,auth,user?.status,getStoredToken(),user?.authorizedClientIds,year,refresh]);
 const valid=year==='All'||(/^\d{4}$/.test(year)&&Number(year)>=2022&&Number(year)<=2200);
 const [state,setState]=useState<{key:string;status:'loading'|'ready'|'error';data:PracticeManagerSnapshot|null}>({key:'',status:'loading',data:null});
 useEffect(()=>{if(!allowed||!valid){setState({key:'',status:'loading',data:null});return;}const controller=new AbortController();setState({key,status:'loading',data:null});api.practiceManager.getDashboard(year==='All'?undefined:Number(year),controller.signal).then(data=>{if(controller.signal.aborted)return;if(data.tenantId!==user!.tenantId||data.cases.some(c=>year!=='All'&&c.taxYear!==Number(year)))throw new Error('Scope mismatch');setState({key,status:'ready',data});}).catch(()=>{if(!controller.signal.aborted)setState({key,status:'error',data:null});});return ()=>controller.abort();},[key,allowed,valid]);
 return {allowed,status:!valid?'error':state.key===key?state.status:'loading',data:allowed&&valid&&state.key===key?state.data:null};
}
