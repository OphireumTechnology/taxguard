import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {buildReviewBundle,assertReviewDigest,reviewVersion} from '../../scripts/staging/migration-review-bundle.mjs';
it('maps the full canonical DAG to valid unique review filenames without granting execution',()=>{
 const bundle=buildReviewBundle();expect(bundle).toMatchObject({authority:'REVIEW_ONLY',executionAllowed:false,supabaseCliValidated:false,externalApplicationStatus:'NOT_APPLIED'});
 // Every file of the canonical execution plan, no more and no fewer (the plan grows with reviewed proposals).
 const plan=JSON.parse(readFileSync('docs/development/migration-execution-order.json','utf8')).entries;
 expect(bundle.entries).toHaveLength(plan.length);
 expect(plan.length).toBeGreaterThanOrEqual(61);
 for(const entry of bundle.entries){const v=entry.version;expect(new Date(`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}T${v.slice(8,10)}:${v.slice(10,12)}:${v.slice(12,14)}Z`).toISOString()).toBeTruthy();assertReviewDigest({sha256:entry.sourceSha256},entry.sql);}
});
it('rejects altered source digests and invalid version positions',()=>{
 expect(()=>assertReviewDigest({sha256:'0'.repeat(64)},'synthetic')).toThrow('REVIEW_SOURCE_DIGEST_MISMATCH');
 for(const value of [0,-1,1.5,10000])expect(()=>reviewVersion(value)).toThrow('REVIEW_VERSION_INVALID');
});
