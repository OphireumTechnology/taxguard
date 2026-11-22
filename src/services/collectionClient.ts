import { api,getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';
/** A client claim never waives a requirement or succeeds from local-only state. */
export async function submitWaiverClaim(clientId:string,taxYear:number,requirementId:string,reason:string,engagementId?:string){
 const token=getStoredToken();if(!token)throw new Error('AUTH_REQUIRED');
 const record=await api.clientDashboard.read<any>('questionnaire',clientId,taxYear,undefined,engagementId);
 if(getStoredToken()!==token)throw new Error('SESSION_CHANGED');
 if(record?.clientId!==clientId || record.taxYear!==taxYear || !record.engagementId || !Number.isInteger(record.questionnaire?.version))throw new Error('COLLECTION_SCOPE_REQUIRED');
 const matches=(record.requirements||[]).filter((r:any)=>typeof r.requirementCode==='string'&&(r.id===requirementId||requirementId.endsWith('-'+r.requirementCode)));
 if(matches.length!==1)throw new Error('COLLECTION_REQUIREMENT_NOT_FOUND');
 const response=await fetch(apiEndpoint(`/api/stage-two-three/requirements/${taxYear}/${encodeURIComponent(matches[0].requirementCode)}/not-applicable`),
  {method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({clientId,engagementId:record.engagementId,revision:record.questionnaire.version,reason})});
 const data=await response.json().catch(()=>null);
 if(getStoredToken()!==token)throw new Error('SESSION_CHANGED');
 if(!response.ok)throw new Error(typeof data?.code==='string'?data.code:'COLLECTION_CLAIM_FAILED');
 if(data?.success!==true||data.requiresProfessionalReview!==true||data.status!=='CLAIM_PENDING')throw new Error('COLLECTION_RESPONSE_INVALID');
 return data;
}
