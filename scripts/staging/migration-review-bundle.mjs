import fs from 'node:fs';
import path from 'node:path';
import {buildMigrationManifest,canonicalTextHash} from './migration-manifest.mjs';
/** Offline review namespace, not an application schedule or approved CLI version ledger. */
export function reviewVersion(index){
 if(!Number.isInteger(index)||index<1||index>9999)throw new Error('REVIEW_VERSION_INVALID');
 return new Date(Date.UTC(2026,9,16,0,0,index)).toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
}
export function assertReviewDigest(entry,sql){if(canonicalTextHash(sql)!==entry.sha256)throw new Error('REVIEW_SOURCE_DIGEST_MISMATCH');}
export function buildReviewBundle(){
 const manifest=buildMigrationManifest();
 if(fs.readFileSync('docs/development/staging-migration-manifest.json','utf8').replace(/\r\n/g,'\n')!==JSON.stringify(manifest,null,2)+'\n')throw new Error('CANONICAL_MANIFEST_STALE');
 let proposal=0;
 const entries=manifest.entries.map(entry=>{
  const sql=fs.readFileSync(entry.file,'utf8');assertReviewDigest(entry,sql);
  const version=entry.kind==='core'?entry.version:reviewVersion(++proposal);
  return {file:`${version}_${entry.kind==='core'?'':'review_'}${path.basename(entry.file).slice(15)}`,source:entry.file,sourceSha256:entry.sha256,version,sql};
 });
 if(new Set(entries.map(e=>e.file)).size!==entries.length||entries.map(e=>e.file).join('\n')!==entries.map(e=>e.file).sort().join('\n'))throw new Error('REVIEW_ORDER_INVALID');
 const packetId=canonicalTextHash(JSON.stringify(entries.map(({sql,...entry})=>entry)));
 return {schemaVersion:1,authority:'REVIEW_ONLY',executionAllowed:false,supabaseCliValidated:false,externalApplicationStatus:'NOT_APPLIED',executionPlanSha256:manifest.executionPlanSha256,packetId,outputDirectory:'qa/migration-review/'+packetId,
  note:'Core versions preserved; proposed files mapped to a reserved valid review namespace. Owner approves final versions and bundle before any external application. Source SQL content is copied without rewriting history.',entries};
}
if(process.argv[1]?.replace(/\\/g,'/').endsWith('/migration-review-bundle.mjs')){
 if(process.argv.slice(2).some(arg=>arg!=='--write'))throw new Error('REVIEW_ARGUMENTS_REFUSED');
 const bundle=buildReviewBundle(),mapping={...bundle,entries:bundle.entries.map(({sql,...entry})=>entry)};
 const target='docs/development/staging-migration-review.json',text=JSON.stringify(mapping,null,2)+'\n';
 if(process.argv.includes('--write')){
  const root=path.resolve(bundle.outputDirectory);if(!root.startsWith(path.resolve('qa/migration-review')+path.sep))throw new Error('REVIEW_OUTPUT_PATH_DENIED');
  fs.mkdirSync(root,{recursive:true});
  const expected=new Set(bundle.entries.map(entry=>entry.file));if(fs.readdirSync(root).some(name=>name.endsWith('.sql')&&!expected.has(name)))throw new Error('REVIEW_OUTPUT_UNEXPECTED_SQL');
  for(const entry of bundle.entries){const file=path.resolve(root,entry.file);if(path.dirname(file)!==root)throw new Error('REVIEW_OUTPUT_PATH_DENIED');fs.writeFileSync(file,entry.sql);}
  fs.writeFileSync(target,text);
 }else if(fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==text)throw new Error('REVIEW_MAPPING_STALE');
 console.log(JSON.stringify({files:bundle.entries.length,authority:'REVIEW_ONLY',externalApplication:false,supabaseCliValidated:false}));
}
