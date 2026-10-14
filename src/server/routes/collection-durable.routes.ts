import { Router,type RequestHandler } from 'express';
import { type AuthenticatedRequest } from '../auth';
import { getSupabaseAdmin } from '../supabase';
import { practiceStoreConfigured } from '../taxguard/practice/practiceStoreConfig';
import { CollectionError,CollectionStore } from '../taxguard/collectionStore';
export function createDurableCollectionRouter(deps:{store?:()=>CollectionStore;enabled?:()=>boolean}={}){
 const router=Router();const enabled=deps.enabled??practiceStoreConfigured;const store=()=>deps.store?.()??new CollectionStore(getSupabaseAdmin() as any);
 const run=(operation:(req:AuthenticatedRequest,client:string,year:number)=>Promise<any>):RequestHandler=>async(req,res,next)=>{
  const durable=enabled();if(!durable&&process.env.NODE_ENV==='test')return next();
  const request=req as AuthenticatedRequest,year=Number(req.params.taxYear),selection=req.method==='GET'?req.query.clientId:req.body?.clientId;
  if(!/^\d{4}$/.test(req.params.taxYear)||year<2000||year>2200)return res.status(400).json({code:'COLLECTION_INPUT_INVALID'});
  const user=request.user;
  if(!user?.tenantId||user.status!=='active')return res.status(403).json({code:'COLLECTION_ACCESS_DENIED'});
  const isClient=['client','prospective_client'].includes(user.role);
  const client=isClient?user.clientId:typeof selection==='string'?selection:undefined;
  if(!client||!['client','prospective_client','accountant','reviewer','senior_reviewer','practice_manager','admin','administrator','super_admin','super_administrator'].includes(user.role)
   ||(isClient&&selection!==undefined&&selection!==client))return res.status(403).json({code:'COLLECTION_ACCESS_DENIED'});
  res.setHeader('Cache-Control','no-store');
  if(!durable)return res.status(503).json({code:'COLLECTION_UNAVAILABLE'});
  try{return res.json(await operation(request,client,year));}catch(e){return res.status(e instanceof CollectionError?e.status:503).json({code:e instanceof CollectionError?e.code:'COLLECTION_UNAVAILABLE'});}
 };
 const eng=(v:unknown)=>typeof v==='string'?v:undefined;
 router.get('/questionnaire/:taxYear',run((r,c,y)=>store().get(r.user!.tenantId!,c,r.user!.id,y,eng(r.query.engagementId))));
 router.post('/questionnaire/:taxYear',run((r,c,y)=>store().save(r.user!.tenantId!,c,r.user!.id,y,{engagementId:eng(r.body?.engagementId),revision:r.body?.revision,requestId:r.get('Idempotency-Key')||'',answers:r.body?.answers})));
 router.get('/requirements/:taxYear',run(async(r,c,y)=>{const value=await store().get(r.user!.tenantId!,c,r.user!.id,y,eng(r.query.engagementId));return {tenantId:value.tenantId,clientId:value.clientId,taxYear:value.taxYear,engagementId:value.engagementId,requirements:value.requirements,waiverClaims:value.waiverClaims};}));
 router.post('/requirements/:taxYear/:reqCode/not-applicable',run((r,c,y)=>store().claim(r.user!.tenantId!,c,r.user!.id,y,{engagementId:eng(r.body?.engagementId),revision:r.body?.revision,code:r.params.reqCode,reason:r.body?.reason})));
 router.get('/requests/:taxYear',run((r,c,y)=>store().requests(r.user!.tenantId!,c,r.user!.id,y,'LIST',typeof r.query.after==='string'?{after:r.query.after}:{},eng(r.query.engagementId))));
 router.post('/requests/:taxYear',run((r,c,y)=>store().requests(r.user!.tenantId!,c,r.user!.id,y,'CREATE',{key:r.get('Idempotency-Key')||'',requestType:r.body?.requestType,title:r.body?.title,message:r.body?.message},eng(r.body?.engagementId))));
 router.post('/requests/:taxYear/:requestId/respond',run(async(r,c,y)=>({success:true,request:await store().requests(r.user!.tenantId!,c,r.user!.id,y,'RESPOND',{requestId:r.params.requestId,replyId:r.get('Idempotency-Key')||'',rowVersion:r.body?.rowVersion,message:r.body?.message},eng(r.body?.engagementId))})));
 router.post('/requests/:taxYear/:requestId/resolve',run((r,c,y)=>store().requests(r.user!.tenantId!,c,r.user!.id,y,'RESOLVE',{requestId:r.params.requestId,rowVersion:r.body?.rowVersion},eng(r.body?.engagementId))));
 return router;
}
