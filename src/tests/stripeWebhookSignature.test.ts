import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { globalEngagementBillingService } from '../server/taxguard/operations/engagementBilling.service';
// Signature checks that a payment provider's webhook must pass before any event is applied: a bounded timestamp
// (replay window), any of several v1 signatures (secret rotation), and a constant-time comparison. Synthetic secret.
const secret='whsec_synthetic_signature_secret';
const sign=(payload:string,t:number,key=secret)=>createHmac('sha256',key).update(`${t}.${payload}`).digest('hex');
const now=()=>Math.floor(Date.now()/1000);
let n=0;
const event=()=>JSON.stringify({id:`evt_signature_${Date.now()}_${n++}`,type:'customer.updated',data:{object:{}}});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
describe('payment webhook signature verification',()=>{
  it('accepts a current, correctly signed event',async()=>{
    const p=event(),t=now();
    await expect(globalEngagementBillingService.handleStripeWebhook(p,`t=${t},v1=${sign(p,t)}`,secret)).resolves.toMatchObject({status:'PROCESSED'});
  });
  it.each([[-301,'stale'],[301,'future']])('refuses a correctly signed event whose timestamp is %i seconds away (%s)',async offset=>{
    const p=event(),t=now()+offset;
    await expect(globalEngagementBillingService.handleStripeWebhook(p,`t=${t},v1=${sign(p,t)}`,secret)).rejects.toThrow('STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE');
  });
  it('accepts the event when any one of several v1 signatures matches (secret rotation)',async()=>{
    const p=event(),t=now();
    const header=`t=${t},v1=${sign(p,t)},v1=${sign(p,t,'whsec_previous_rotated_secret')}`;
    await expect(globalEngagementBillingService.handleStripeWebhook(p,header,secret)).resolves.toMatchObject({status:'PROCESSED'});
  });
  it.each([['short','abcd'],['non-hex','z'.repeat(64)],['wrong','0'.repeat(64)]])('refuses a %s signature with the verification code',async(_k,sig)=>{
    const p=event(),t=now();
    await expect(globalEngagementBillingService.handleStripeWebhook(p,`t=${t},v1=${sig}`,secret)).rejects.toThrow('STRIPE_SIGNATURE_VERIFICATION_FAILED');
  });
  it('verifies the exact bytes received at the route, not a re-serialised body',async()=>{
    vi.stubEnv('NODE_ENV','test');vi.stubEnv('STRIPE_WEBHOOK_SECRET',secret);
    const { default: express } = await import('express');
    const { practiceOperationsRouter } = await import('../server/routes/practice-operations.routes');
    const app=express();
    // The same raw-body capture as server.ts.
    app.use(express.json({verify:(req:any,_res,buf)=>{req.rawBody=buf;}}));
    app.use('/api/operations',practiceOperationsRouter);
    const server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    try{
      // Provider payloads are not formatted like JSON.stringify output; the signature covers these exact bytes.
      const p=`{ "id": "evt_signature_raw_${Date.now()}", "type": "customer.updated", "data": { "object": {} } }`,t=now();
      const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/operations/payments/webhook`,
        {method:'POST',headers:{'Content-Type':'application/json','stripe-signature':`t=${t},v1=${sign(p,t)}`},body:p});
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({status:'PROCESSED'});
    }finally{await new Promise(resolve=>server.close(resolve));}
  });
  it('refuses at the route when no raw body was captured, instead of verifying a re-serialised body',async()=>{
    vi.stubEnv('NODE_ENV','test');vi.stubEnv('STRIPE_WEBHOOK_SECRET',secret);
    const { default: express } = await import('express');
    const { practiceOperationsRouter } = await import('../server/routes/practice-operations.routes');
    const handle=vi.spyOn(globalEngagementBillingService,'handleStripeWebhook');
    const app=express();app.use(express.json());app.use('/api/operations',practiceOperationsRouter);
    const server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    try{
      const p=event(),t=now();
      const response=await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/operations/payments/webhook`,
        {method:'POST',headers:{'Content-Type':'application/json','stripe-signature':`t=${t},v1=${sign(p,t)}`},body:p});
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({code:'WEBHOOK_RAW_BODY_REQUIRED'});
      expect(handle).not.toHaveBeenCalled();
    }finally{await new Promise(resolve=>server.close(resolve));}
  });
  it('refuses a non-numeric timestamp',async()=>{
    const p=event();
    await expect(globalEngagementBillingService.handleStripeWebhook(p,`t=soon,v1=${sign(p,0)}`,secret)).rejects.toThrow('INVALID_STRIPE_SIGNATURE_HEADER');
  });
});
