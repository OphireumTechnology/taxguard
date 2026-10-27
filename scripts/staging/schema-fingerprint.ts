import { createHash } from 'node:crypto';
export interface SchemaQuery { query(sql:string):Promise<{rows:any[]}> }
/** Public-schema drift probe for disposable local harnesses. No row data, credentials or URLs.
 * Catalog ACLs are decoded to named grants (including PUBLIC and grant options); null ACLs
 * use PostgreSQL defaults. Effective checks also detect inherited/public/superuser access.
 * OIDs are lookup inputs only, never fingerprint values. C ordering avoids locale drift.
 * Role inventory is deliberately part of the fingerprint; compare like-for-like clusters.
 */
export async function schemaFingerprint(db:SchemaQuery){
 const groups:Record<string,unknown>={};
 const queries:Record<string,string>={
  schemaOwnership:`SELECT n.nspname AS schema_name,pg_catalog.pg_get_userbyid(n.nspowner) AS owner
    FROM pg_catalog.pg_namespace n WHERE n.nspname='public' ORDER BY n.nspname COLLATE "C"`,
  schemaGrants:`SELECT n.nspname AS schema_name,pg_catalog.pg_get_userbyid(a.grantor) AS grantor,
    CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END AS grantee,
    a.privilege_type AS privilege,a.is_grantable
    FROM pg_catalog.pg_namespace n
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a
    WHERE n.nspname='public'
    ORDER BY n.nspname COLLATE "C",pg_catalog.pg_get_userbyid(a.grantor) COLLATE "C",
      (CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_catalog.pg_get_userbyid(a.grantee) END) COLLATE "C",
      a.privilege_type COLLATE "C",a.is_grantable`,
  schemaPrivileges:`SELECT n.nspname AS schema_name,r.rolname AS role_name,
    pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE') AS usage,
    pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE') AS "create",
    pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE WITH GRANT OPTION') AS usage_grantable,
    pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE WITH GRANT OPTION') AS create_grantable
    FROM pg_catalog.pg_namespace n CROSS JOIN pg_catalog.pg_roles r
    WHERE n.nspname='public' ORDER BY n.nspname COLLATE "C",r.rolname COLLATE "C"`,
  columns:`SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`,
  constraints:`SELECT c.conrelid::regclass::text relation,c.conname,c.convalidated,pg_get_constraintdef(c.oid,true) definition FROM pg_constraint c WHERE c.connamespace='public'::regnamespace ORDER BY relation,c.conname`,
  functions:`SELECT p.oid::regprocedure::text signature,pg_catalog.pg_get_userbyid(p.proowner) AS owner,pg_get_functiondef(p.oid) definition,p.prosecdef,p.proconfig,p.proacl IS NULL acl_default,ARRAY(SELECT unnest(p.proacl)::text ORDER BY 1) acl FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY signature`,
  tables:`SELECT relname,relkind,pg_catalog.pg_get_userbyid(relowner) AS owner,relrowsecurity,relforcerowsecurity,relacl IS NULL acl_default,ARRAY(SELECT unnest(relacl)::text ORDER BY 1) acl FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p','S','v','m','f') ORDER BY relname`,
  indexes:`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname`,
  policies:`SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`,
  defaultPrivileges:`SELECT defaclrole::regrole::text owner,defaclobjtype,ARRAY(SELECT unnest(defaclacl)::text ORDER BY 1) acl FROM pg_default_acl WHERE defaclnamespace='public'::regnamespace ORDER BY owner,defaclobjtype`,
  triggers:`SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid,true) definition,t.tgenabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
 };
 for(const [name,sql] of Object.entries(queries))groups[name]=(await db.query(sql)).rows;
 return {sha256:createHash('sha256').update(JSON.stringify(groups)).digest('hex'),groups};
}
