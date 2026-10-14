import type { PracticeRpcClient } from './practice/practiceStore';
import { TaxQuestionnaireEngine,type TaxQuestionnaireAnswers } from './taxQuestionnaire';
export class CollectionError extends Error { constructor(public readonly code:string,public readonly status=400){super(code);} }
export class CollectionStore {
 constructor(private readonly client:PracticeRpcClient){}
 private async call(name:string,args:Record<string,unknown>){
  try{const r=await this.client.rpc(name,args);if(r.error){if(r.error.code==='P0001'&&/^[A-Z_]+$/.test(r.error.message||''))throw new CollectionError(r.error.message!,/CONFLICT|SCOPE_REQUIRED/.test(r.error.message!)?409:/DENIED|NOT_FOUND|STAFF_REQUIRED/.test(r.error.message!)?403:400);throw new CollectionError('COLLECTION_UNAVAILABLE',503);}return r.data;}
  catch(e){if(e instanceof CollectionError)throw e;throw new CollectionError('COLLECTION_UNAVAILABLE',503);}
 }
 get(tenant:string,client:string,actor:string,year:number,engagement?:string){return this.call('taxguard_collection_get',{p_tenant:tenant,p_client:client,p_actor:actor,p_year:year,p_engagement:engagement??null});}
 save(tenant:string,client:string,actor:string,year:number,input:{engagementId?:string;revision:number;requestId:string;answers:TaxQuestionnaireAnswers}){
  const a=input.answers;if(!a||typeof a!=='object'||Array.isArray(a)||Object.entries(a).some(([key,value])=>key.startsWith('has')&&typeof value!=='boolean')||typeof a.stateOfResidency!=='string'||!/^[A-Z]{2}$/.test(a.stateOfResidency))throw new CollectionError('COLLECTION_INPUT_INVALID');
  const requirements=TaxQuestionnaireEngine.generateRequirementsFromQuestionnaire(tenant,client,year,a).map(({updatedAt,...r})=>r);
  return this.call('taxguard_collection_save',{p_tenant:tenant,p_client:client,p_actor:actor,p_year:year,p_engagement:input.engagementId??null,p_revision:input.revision,p_request:input.requestId,p_answers:a,p_requirements:requirements});
 }
 claim(tenant:string,client:string,actor:string,year:number,input:{engagementId?:string;revision:number;code:string;reason:string}){
  return this.call('taxguard_collection_claim',{p_tenant:tenant,p_client:client,p_actor:actor,p_year:year,p_engagement:input.engagementId??null,p_revision:input.revision,p_code:input.code,p_reason:input.reason});
 }
 requests(tenant:string,client:string,actor:string,year:number,action:'LIST'|'CREATE'|'RESPOND'|'RESOLVE',input:Record<string,unknown>={},engagement?:string){
  return this.call('taxguard_collection_request_operation',{p_tenant:tenant,p_client:client,p_actor:actor,p_year:year,p_engagement:engagement??null,p_action:action,p_input:input});
 }
}
