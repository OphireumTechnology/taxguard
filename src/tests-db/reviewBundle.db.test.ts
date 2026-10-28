import {it,expect} from 'vitest';
import {startDatabase} from './harness';
import {schemaFingerprint} from '../../scripts/staging/schema-fingerprint';
it('composes the valid-filename review packet on a fresh disposable server with identical schema',async()=>{
 const source=await startDatabase();let review:Awaited<ReturnType<typeof startDatabase>>|undefined;
 try{review=await startDatabase({reviewBundle:true});expect((await schemaFingerprint(review.pool)).sha256).toBe((await schemaFingerprint(source.pool)).sha256);
  expect((await review.pool.query("SELECT host(inet_server_addr()) address")).rows[0].address).toBe('127.0.0.1');
 }finally{await source.stop();await review?.stop();}
},120000);
