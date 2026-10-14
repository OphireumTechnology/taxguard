import { createHash } from 'node:crypto';
export interface SchemaQuery { query(sql:string):Promise<{rows:any[]}> }
/** Schema-only drift probe for disposable local harnesses. No row data, credentials or URLs. */
export async function schemaFingerprint(db:SchemaQuery){
 const groups:Record<string,unknown>={};
 const queries:Record<string,string>={
  columns:`SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`,
  constraints:`SELECT c.conrelid::regclass::text relation,c.conname,c.convalidated,pg_get_constraintdef(c.oid,true) definition FROM pg_constraint c WHERE c.connamespace='public'::regnamespace ORDER BY relation,c.conname`,
  functions:`SELECT p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition,p.prosecdef,p.proconfig,p.proacl IS NULL acl_default,ARRAY(SELECT unnest(p.proacl)::text ORDER BY 1) acl FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY signature`,
  tables:`SELECT relname,relkind,relrowsecurity,relforcerowsecurity,relacl IS NULL acl_default,ARRAY(SELECT unnest(relacl)::text ORDER BY 1) acl FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','S','v') ORDER BY relname`,
  indexes:`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`,
  policies:`SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`,
  defaultPrivileges:`SELECT defaclrole::regrole::text owner,defaclobjtype,ARRAY(SELECT unnest(defaclacl)::text ORDER BY 1) acl FROM pg_default_acl WHERE defaclnamespace='public'::regnamespace ORDER BY owner,defaclobjtype`,
  triggers:`SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) definition,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
 };
 for(const [name,sql] of Object.entries(queries))groups[name]=(await db.query(sql)).rows;
 return {sha256:createHash('sha256').update(JSON.stringify(groups)).digest('hex'),groups};
}
