import {it,expect} from 'vitest';
import {contentMatchesType,SupabaseVaultStorage} from '../server/taxguard/documents/vaultIntegrations';
it('validates the complete bounded CSV rather than only its initial sample',()=>{
 const prefix=Buffer.from('name,value\n'+('synthetic,1\n'.repeat(1000)));
 expect(contentMatchesType('text/csv',prefix)).toBe(true);
 for(const tail of [Buffer.from([0]),Buffer.from([0xc3,0x28]),Buffer.from('\n=synthetic,1')])expect(contentMatchesType('text/csv',Buffer.concat([prefix,tail]))).toBe(false);
});
it('rechecks private storage before each operation and refuses a changed bucket',async()=>{
 let publicBucket=false,signed=0;const store=new SupabaseVaultStorage({storage:{getBucket:async()=>({data:{public:publicBucket},error:null}),from:()=>({upload:async()=>({error:null}),createSignedUrl:async()=>{signed++;return {data:{signedUrl:'https://storage.invalid/synthetic'},error:null};}})}} as any);
 await store.put('synthetic',Buffer.from('x'),'text/csv');publicBucket=true;
 await expect(store.signedUrl('synthetic',60)).rejects.toThrow('VAULT_BUCKET_NOT_PRIVATE');expect(signed).toBe(0);
});
