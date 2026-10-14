import fs from 'node:fs';
import {startDatabase,pgRpc} from '../../src/tests-db/harness';
import {exportDatabase,restoreDatabase,compareWithManifest} from '../backup/logical-backup.mjs';
import {schemaFingerprint} from './schema-fingerprint';
import {BillingStore} from '../../src/server/taxguard/billing/billingStore';
if(process.argv.length!==2)throw new Error('RECOVERY_TARGET_ARGUMENTS_REFUSED');
for(const file of ['.env','.env.local','.env.development','.env.development.local'])if(fs.existsSync(file))throw new Error('RECOVERY_ENV_FILE_REFUSED');
const source=await startDatabase({durable:true});let target:Awaited<ReturnType<typeof startDatabase>>|undefined;
try{target=await startDatabase({durable:true});
 await source.pool.query("INSERT INTO taxguard_tenants(id,name) VALUES('recoveryA','Synthetic A'),('recoveryB','Synthetic B');INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('recoveryA','clientA','ownerA','Synthetic A'),('recoveryB','clientB','ownerB','Synthetic B');INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('recoveryA','ownerA','client','active','clientA'),('recoveryB','ownerB','client','active','clientB');");
 const producer=await source.connect(),destination=await target.connect();
 try{const start=performance.now(),backup=await exportDatabase(producer),exportMs=Math.round(performance.now()-start),restoreStart=performance.now();
  await restoreDatabase(destination,backup,{disposable:true});const restoreMs=Math.round(performance.now()-restoreStart);
  if((await compareWithManifest(destination,backup.manifest)).length)throw new Error('RECOVERY_ROW_MISMATCH');
  if((await schemaFingerprint(destination)).sha256!==(await schemaFingerprint(producer)).sha256)throw new Error('RECOVERY_SCHEMA_MISMATCH');
  const billing=new BillingStore(pgRpc(destination));await billing.list('recoveryA','clientA','ownerA');let denied=false;
  try{await billing.list('recoveryB','clientB','ownerA');}catch{denied=true;}if(!denied)throw new Error('RECOVERY_TENANT_ISOLATION_FAILED');
  console.log(JSON.stringify({status:'LOGICAL_ROW_ROUNDTRIP_PASS',syntheticOnly:true,loopbackOnly:true,exportMs,restoreMs,tables:Object.keys(backup.manifest.tables).length,rows:Object.values(backup.manifest.tables).reduce((sum:number,item:any)=>sum+item.rows,0),schemaAndTenantIsolation:'PASS',archiveRetained:false,physicalUtilityRehearsal:'BLOCKED_TOOLING_REQUIRED'}));
 }finally{await producer.end();await destination.end();}
}finally{await source.stop();await target?.stop();}
