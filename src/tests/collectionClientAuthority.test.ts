import { afterEach,expect,it,vi } from 'vitest';
import { api,setStoredToken,clearStoredToken } from '../services/api';
import { submitWaiverClaim } from '../services/collectionClient';
const record={clientId:'synthetic',taxYear:2025,engagementId:'syntheticEng',questionnaire:{version:2},requirements:[{id:'REQ-synthetic-W2-WAGE',requirementCode:'W2-WAGE'}]};
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();clearStoredToken();});
it('submits only authenticated scope/revision-bound claims and requires server acknowledgement',async()=>{
 setStoredToken('synthetic-token');vi.spyOn(api.clientDashboard,'read').mockResolvedValue(record);
 const fetcher=vi.fn(async(_url:any,options:any)=>{expect(options.headers.Authorization).toBe('Bearer synthetic-token');expect(JSON.parse(options.body)).toMatchObject({clientId:'synthetic',engagementId:'syntheticEng',revision:2});return new Response(JSON.stringify({success:true,requiresProfessionalReview:true,status:'CLAIM_PENDING'}));});vi.stubGlobal('fetch',fetcher);
 expect(await submitWaiverClaim('synthetic',2025,'REQ-synthetic-W2-WAGE','Synthetic reason')).toMatchObject({status:'CLAIM_PENDING'});expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not send a claim after logout during the scoped read',async()=>{
 setStoredToken('synthetic-token');vi.spyOn(api.clientDashboard,'read').mockImplementation(async()=>{clearStoredToken();return record as any;});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 await expect(submitWaiverClaim('synthetic',2025,'REQ-synthetic-W2-WAGE','Synthetic reason')).rejects.toThrow('SESSION_CHANGED');expect(fetcher).not.toHaveBeenCalled();
});
it('refuses unavailable persistence and forged waiver approval instead of reporting local success',async()=>{
 setStoredToken('synthetic-token');vi.spyOn(api.clientDashboard,'read').mockResolvedValue(record);
 vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('synthetic outage');}));await expect(submitWaiverClaim('synthetic',2025,'REQ-synthetic-W2-WAGE','Synthetic reason')).rejects.toThrow();
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({success:true,requiresProfessionalReview:false,status:'APPROVED'}))));
 await expect(submitWaiverClaim('synthetic',2025,'REQ-synthetic-W2-WAGE','Synthetic reason')).rejects.toThrow('COLLECTION_RESPONSE_INVALID');
});
