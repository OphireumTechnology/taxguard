import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import type { TransactionalSql } from '../server/ai/governance/SqlGovernanceStore';
import type { SessionAuthority } from '../server/ai/governance/contracts';

/**
 * Disposable PostgreSQL (PGlite) with every repository migration applied and two synthetic tenants.
 * No production database, credentials or taxpayer data. ACTIVE registry state exists only here.
 */
export const CASE_A = '11111111-1111-4111-8111-111111111111';
export const CASE_B = '44444444-4444-4444-8444-444444444444';
export const DOC_A = '22222222-2222-4222-8222-222222222222';
export const EVIDENCE_A = '33333333-3333-4333-8333-333333333333';
const hash = 'a'.repeat(64);

export const fixtureIdentities: Record<string, { uid: string; tenant_id: string }> = {
  valid: { uid: 'preparer', tenant_id: 'tenantA' },
  reviewer: { uid: 'reviewer', tenant_id: 'tenantA' },
  admin: { uid: 'admin', tenant_id: 'tenantA' },
  compliance: { uid: 'compliance', tenant_id: 'tenantA' },
  suspended: { uid: 'suspended-admin', tenant_id: 'tenantA' },
  ghost: { uid: 'not-a-member', tenant_id: 'tenantA' },
  adminB: { uid: 'adminB', tenant_id: 'tenantB' },
  preparerB: { uid: 'preparerB', tenant_id: 'tenantB' },
};
export const fixtureAuthority: SessionAuthority = { verify: async token => fixtureIdentities[token] ?? null };

export async function createGovernanceFixture() {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$; CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;`);
  for (const name of fs.readdirSync(path.resolve('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync(path.resolve('supabase/migrations', name), 'utf8').replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";/gi, ''));
  await pg.exec(`INSERT INTO taxguard_tenants(id,name)VALUES('tenantA','Test A'),('tenantB','Test B');
  INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid)VALUES('tenantA','clientA','owner'),('tenantB','clientB','ownerB');
  INSERT INTO taxguard_members(tenant_id,uid,role,status,credential_verified,credential_type,credential_expires_at)VALUES
   ('tenantA','preparer','accountant','active',false,null,null),('tenantA','reviewer','reviewer','active',true,'CPA','2099-01-01'),
   ('tenantA','admin','administrator','active',false,null,null),('tenantA','compliance','compliance_officer','active',false,null,null),
   ('tenantA','suspended-admin','administrator','suspended',false,null,null),
   ('tenantB','adminB','administrator','active',false,null,null),('tenantB','preparerB','accountant','active',false,null,null);
  INSERT INTO taxguard_cases(id,case_id,tenant_id,client_id,engagement_id,tax_year,active_stage,client_uid,preparer_uid,reviewer_uid,created_by,updated_by)VALUES
   ('${CASE_A}','caseA','tenantA','clientA','engA',2025,3,'owner','preparer','reviewer','preparer','preparer'),
   ('${CASE_B}','caseB','tenantB','clientB','engB',2025,3,'ownerB','preparerB','adminB','preparerB','preparerB');
  INSERT INTO taxguard_case_assignments(case_id,tenant_id,uid,role)VALUES('caseA','tenantA','preparer','preparer'),('caseA','tenantA','reviewer','reviewer');
  INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,engagement_id,tax_year,role,user_id,assigned_by)VALUES('prep','tenantA','clientA','engA',2025,'preparer','preparer','test'),('rev','tenantA','clientA','engA',2025,'reviewer','reviewer','test');
  INSERT INTO taxguard_documents(id,document_id,tenant_id,client_id,engagement_id,tax_year,case_id,hash,mime_type,created_by,status,quarantine_status)VALUES('${DOC_A}','docA','tenantA','clientA','engA',2025,'caseA','${hash}','application/pdf','preparer','RELEASED','CLEAN');
  INSERT INTO ai_evidence_sources(source_id,tenant_id,client_id,tax_case_id,tax_year,case_record_id,evidence_type,document_record_id,document_version,source_reference,source_hash)VALUES('${EVIDENCE_A}','tenantA','clientA','caseA',2025,'${CASE_A}','DOCUMENT','${DOC_A}',1,'private source','${hash}');
  INSERT INTO ai_models(model_id,model_version,provider,effective_date,approved_use_cases)VALUES('isolated-model','1','TEST',now(),ARRAY['IDENTIFY_REVIEW_QUESTIONS']);
  INSERT INTO ai_prompts(agent_id,prompt_id,version,system_instructions,expected_output_schema,effective_date)VALUES('A34','isolated-prompt','1','Synthetic tests only','{"type":"object"}',now());
  INSERT INTO ai_human_approval_policies(tenant_id,agent_id,action,materiality)VALUES('tenantA','A34','READ','MATERIAL');`);
  const db: TransactionalSql = { transaction: callback => pg.transaction(async tx => callback({ query: async (sql, params) => { const result = await tx.query(sql, params); return { rows: JSON.parse(JSON.stringify(result.rows)) }; } })) };
  /** Activates A34 inside the disposable database only, for governed-assessment tests. */
  const activateA34 = () => pg.exec(`UPDATE ai_agents SET status='ACTIVE',risk_class='LOW',default_model='isolated-model',default_model_version='1',prompt_id='isolated-prompt',prompt_version='1' WHERE agent_id='A34';
  UPDATE ai_agent_versions SET status='ACTIVE',risk_class='LOW',default_model='isolated-model',default_model_version='1',prompt_id='isolated-prompt',prompt_version='1',token_budget=10000,cost_budget=1,confidence_threshold=0.8,human_review_threshold=0.5 WHERE agent_id='A34';
  UPDATE ai_models SET status='ACTIVE',data_classification_limit='INTERNAL',token_limit=10000,cost_limit=1,approved_use_cases=ARRAY['IDENTIFY_REVIEW_QUESTIONS'],prohibited_use_cases='{}',effective_date=now() WHERE model_id='isolated-model';
  UPDATE ai_prompts SET status='ACTIVE',risk_class='LOW',effective_date=now() WHERE agent_id='A34';
  UPDATE ai_tools SET status='ACTIVE',risk_class='LOW',requires_human_approval=false;
  INSERT INTO ai_agent_permissions(agent_id,resource,action) SELECT 'A34',tool_id,x.action::ai_action FROM ai_tools CROSS JOIN unnest(ARRAY['READ','CREATE','UPDATE','DELETE','EXECUTE','APPROVE','EXPORT','TRANSMIT'])x(action) ON CONFLICT DO NOTHING;
  UPDATE ai_agent_permissions SET permission_state='ALLOW',conditions='{}',risk_level='LOW',human_approval_required=false WHERE agent_id='A34';
  UPDATE ai_agent_data_permissions SET permission_state='ALLOW',conditions='{}' WHERE agent_id='A34' AND data_classification IN ('PUBLIC','INTERNAL');
  UPDATE ai_stage_permissions SET permission_state='ALLOW',conditions='{}' WHERE agent_id='A34';
  UPDATE ai_human_approval_policies SET status='ACTIVE' WHERE agent_id='A34';`);
  return { pg, db, activateA34 };
}
