import fs from 'node:fs';
import {assertRecoveryInvocation} from './recovery-invocation-guard';
import {exportDatabase,restoreDatabase,compareWithManifest} from '../backup/logical-backup.mjs';
import {schemaFingerprint} from './schema-fingerprint';
import {BillingError,BillingStore} from '../../src/server/taxguard/billing/billingStore';
assertRecoveryInvocation(process.argv,process.env);
for(const file of ['.env','.env.local','.env.development','.env.development.local'])if(fs.existsSync(file))throw new Error('RECOVERY_ENV_FILE_REFUSED');
const {startDatabase,pgRpc}=await import('../../src/tests-db/harness');
const source=await startDatabase({durable:true});let target:Awaited<ReturnType<typeof startDatabase>>|undefined;
try{target=await startDatabase({durable:true});
 await source.pool.query("INSERT INTO taxguard_tenants(id,name) VALUES('recoveryA','Synthetic A'),('recoveryB','Synthetic B');INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('recoveryA','clientA','ownerA','Synthetic A'),('recoveryB','clientB','ownerB','Synthetic B');INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('recoveryA','ownerA','client','active','clientA'),('recoveryB','ownerB','client','active','clientB');");
 await source.pool.query("INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('recoveryA','managerA','practice_manager','active'),('recoveryA','approverA','admin','active')");
 const billingSource=new BillingStore(pgRpc(source.pool));
 await billingSource.upsertService('recoveryA','managerA',{serviceCode:'RECOVERY-1',name:'Synthetic recovery service',category:'INDIVIDUAL_TAX',billingMethod:'FLAT_FEE',baseFee:'125.50'});
 const {invoiceId}=await billingSource.createInvoice('recoveryA','clientA','managerA','recovery-invoice-1',{dueDate:'2026-12-31'});
 const line=await billingSource.addLine('recoveryA','clientA','managerA',invoiceId,{serviceCode:'RECOVERY-1',quantity:'2'});
 const submitted=await billingSource.transition('recoveryA','clientA','managerA',invoiceId,'submit',line.rowVersion);
 await billingSource.transition('recoveryA','clientA','approverA',invoiceId,'approve',submitted.rowVersion);
 await source.pool.query("SELECT taxguard_security_record('recoveryA',NULL,gen_random_uuid(),'AUTH_FAILURE','warning')");
 const producer=await source.connect(),destination=await target.connect();
 try{const start=performance.now(),backup=await exportDatabase(producer),exportMs=Math.round(performance.now()-start),restoreStart=performance.now();
  await restoreDatabase(destination,backup,{disposable:true});const restoreMs=Math.round(performance.now()-restoreStart);
  if((await compareWithManifest(destination,backup.manifest)).length)throw new Error('RECOVERY_ROW_MISMATCH');
  if((await schemaFingerprint(destination)).sha256!==(await schemaFingerprint(producer)).sha256)throw new Error('RECOVERY_SCHEMA_MISMATCH');
  await destination.end();
  await target.restart();
  const recovered=await target.connect();
  try {
   if((await compareWithManifest(recovered,backup.manifest)).length)throw new Error('RECOVERY_RESTART_ROW_MISMATCH');
   if((await schemaFingerprint(recovered)).sha256!==(await schemaFingerprint(producer)).sha256)throw new Error('RECOVERY_RESTART_SCHEMA_MISMATCH');
   const billing=new BillingStore(pgRpc(recovered)),invoices=await billing.list('recoveryA','clientA','ownerA');
   if(invoices.length!==1||invoices[0].invoiceId!==invoiceId||invoices[0].total!=='251.00'||invoices[0].status!=='ISSUED'||Object.hasOwn(invoices[0],'preparedBy'))throw new Error('RECOVERY_BILLING_PROJECTION_FAILED');
   let denied=false;
   try{await billing.list('recoveryB','clientB','ownerA');}catch(error){if(error instanceof BillingError&&error.code==='BILLING_ACCESS_DENIED')denied=true;else throw error;}if(!denied)throw new Error('RECOVERY_TENANT_ISOLATION_FAILED');
   const audit=await recovered.query("SELECT metadata FROM taxguard_audit_log WHERE tenant_id='recoveryA' AND metadata->>'category'='SECURITY'");
   if(!audit.rowCount)throw new Error('RECOVERY_SECURITY_AUDIT_MISSING');
   let immutable=false;
   try{await recovered.query("DELETE FROM taxguard_audit_log WHERE tenant_id='recoveryA' AND metadata->>'category'='SECURITY'");}catch(error:any){if(error.message==='SECURITY_EVENT_IMMUTABLE')immutable=true;else throw error;}if(!immutable)throw new Error('RECOVERY_SECURITY_AUDIT_MUTABLE');
   console.log(JSON.stringify({status:'LOGICAL_ROW_ROUNDTRIP_PASS',syntheticOnly:true,loopbackOnly:true,exportMs,restoreMs,tables:Object.keys(backup.manifest.tables).length,rows:Object.values(backup.manifest.tables).reduce((sum:number,item:any)=>sum+item.rows,0),schemaAndTenantIsolation:'PASS',restartPersistence:'PASS',billingProjection:'PASS',securityAuditImmutability:'PASS',archiveRetained:false,physicalUtilityRehearsal:'NOT_RUN_BY_THIS_COMMAND'}));
  }finally{await recovered.end();}
 }finally{try{await producer.end();}finally{await destination.end();}}
}finally{try{await source.stop();}finally{await target?.stop();}}
