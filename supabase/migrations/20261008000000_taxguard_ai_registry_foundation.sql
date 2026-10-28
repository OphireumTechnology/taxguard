-- Gate AI-1: schema and inert registry only. No provider, orchestration or tax writes.
-- Reviewed migration; execute only in a separately authorized environment.
BEGIN;
CREATE DOMAIN ai_registry_status AS text CHECK (VALUE IN ('DRAFT','ACTIVE','RESTRICTED','DISABLED','OFFLINE','RETIRED'));
CREATE DOMAIN ai_risk AS text CHECK (VALUE IN ('LOW','MATERIAL','HIGH','CRITICAL'));
CREATE DOMAIN ai_permission_state AS text CHECK (VALUE IN ('ALLOW','DENY','CONDITIONAL'));
CREATE DOMAIN ai_action AS text CHECK (VALUE IN ('READ','CREATE','UPDATE','DELETE','EXECUTE','APPROVE','EXPORT','TRANSMIT'));
CREATE DOMAIN ai_data_class AS text CHECK (VALUE IN ('PUBLIC','INTERNAL','CLIENT_PII','TAX_DATA','FINANCIAL_DATA','DOCUMENT_CONTENT','AUTHENTICATION_DATA','AUDIT_DATA','SYSTEM_SECRET'));
CREATE DOMAIN ai_run_status AS text CHECK (VALUE IN ('QUEUED','RUNNING','PROPOSED','VERIFYING','REVIEW_REQUIRED','APPROVED','REJECTED','FAILED','CANCELLED'));

CREATE TABLE ai_agents (
 agent_id text PRIMARY KEY CHECK (agent_id ~ '^A(0[0-9]|[1-5][0-9]|60)$'),
 agent_name text NOT NULL CHECK (length(btrim(agent_name)) > 0),
 category text NOT NULL CHECK (category IN ('SUPERVISOR','CLIENT_SERVICES','DOCUMENT_INTELLIGENCE','ACCOUNTING','TAX_INTELLIGENCE','RISK_QC','SIGN_FILE_RESOLVE','PRACTICE_OPERATIONS','GOVERNANCE_SECURITY_PLATFORM')),
 description text NOT NULL, version text NOT NULL DEFAULT '1.0.0',
 status ai_registry_status NOT NULL DEFAULT 'DRAFT', risk_class ai_risk NOT NULL DEFAULT 'MATERIAL',
 default_model text, default_model_version text, prompt_id text, prompt_version text,
 schema_version text NOT NULL DEFAULT '1',
 confidence_threshold numeric NOT NULL DEFAULT 1 CHECK (confidence_threshold BETWEEN 0 AND 1),
 human_review_threshold numeric NOT NULL DEFAULT 1 CHECK (human_review_threshold BETWEEN 0 AND 1),
 maximum_execution_time integer NOT NULL DEFAULT 30 CHECK (maximum_execution_time BETWEEN 1 AND 3600),
 maximum_retries integer NOT NULL DEFAULT 0 CHECK (maximum_retries BETWEEN 0 AND 5),
 token_budget integer NOT NULL DEFAULT 0 CHECK (token_budget >= 0),
 cost_budget numeric(18,8) NOT NULL DEFAULT 0 CHECK (cost_budget >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((default_model IS NULL) = (default_model_version IS NULL)),
 CHECK ((prompt_id IS NULL) = (prompt_version IS NULL)),
 CHECK (category = CASE
 WHEN agent_id='A00' THEN 'SUPERVISOR' WHEN agent_id<='A04' THEN 'CLIENT_SERVICES'
 WHEN agent_id<='A11' THEN 'DOCUMENT_INTELLIGENCE' WHEN agent_id<='A16' THEN 'ACCOUNTING'
 WHEN agent_id<='A31' THEN 'TAX_INTELLIGENCE' WHEN agent_id<='A35' THEN 'RISK_QC'
 WHEN agent_id<='A42' THEN 'SIGN_FILE_RESOLVE' WHEN agent_id<='A50' THEN 'PRACTICE_OPERATIONS'
 ELSE 'GOVERNANCE_SECURITY_PLATFORM' END)
);
CREATE TABLE ai_models (
 model_id text NOT NULL CHECK (length(btrim(model_id)) > 0), model_version text NOT NULL CHECK (length(btrim(model_version)) > 0),
 provider text NOT NULL CHECK (length(btrim(provider)) > 0), status ai_registry_status NOT NULL DEFAULT 'DRAFT',
 approved_use_cases text[] NOT NULL DEFAULT '{}', prohibited_use_cases text[] NOT NULL DEFAULT '{}',
 data_classification_limit ai_data_class NOT NULL DEFAULT 'PUBLIC' CHECK (data_classification_limit NOT IN ('SYSTEM_SECRET','AUTHENTICATION_DATA')),
 token_limit integer NOT NULL DEFAULT 0 CHECK (token_limit >= 0), cost_limit numeric(18,8) NOT NULL DEFAULT 0 CHECK (cost_limit >= 0),
 fallback_model text, fallback_model_version text, effective_date timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(model_id,model_version), UNIQUE(model_id,model_version,provider),
 CHECK ((fallback_model IS NULL) = (fallback_model_version IS NULL)),
 CHECK (fallback_model IS NULL OR (fallback_model,fallback_model_version) <> (model_id,model_version)),
 FOREIGN KEY(fallback_model,fallback_model_version) REFERENCES ai_models(model_id,model_version)
);
CREATE TABLE ai_prompts (
 prompt_id text NOT NULL CHECK (length(btrim(prompt_id)) > 0), agent_id text NOT NULL REFERENCES ai_agents(agent_id),
 version text NOT NULL CHECK (length(btrim(version)) > 0), status ai_registry_status NOT NULL DEFAULT 'DRAFT',
 system_instructions text NOT NULL CHECK (length(btrim(system_instructions)) > 0),
 required_inputs jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(required_inputs)='array'),
 expected_output_schema jsonb NOT NULL CHECK (jsonb_typeof(expected_output_schema)='object' AND coalesce(expected_output_schema->>'type','')='object'),
 risk_class ai_risk NOT NULL DEFAULT 'MATERIAL', effective_date timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(agent_id,prompt_id,version)
);
CREATE TABLE ai_agent_versions (
 agent_id text NOT NULL REFERENCES ai_agents(agent_id), version text NOT NULL CHECK (length(btrim(version)) > 0),
 status ai_registry_status NOT NULL DEFAULT 'DRAFT', risk_class ai_risk NOT NULL DEFAULT 'MATERIAL',
 default_model text, default_model_version text, prompt_id text, prompt_version text, schema_version text NOT NULL,
 confidence_threshold numeric NOT NULL DEFAULT 1 CHECK (confidence_threshold BETWEEN 0 AND 1),
 human_review_threshold numeric NOT NULL DEFAULT 1 CHECK (human_review_threshold BETWEEN 0 AND 1),
 maximum_execution_time integer NOT NULL DEFAULT 30 CHECK (maximum_execution_time BETWEEN 1 AND 3600),
 maximum_retries integer NOT NULL DEFAULT 0 CHECK (maximum_retries BETWEEN 0 AND 5),
 token_budget integer NOT NULL DEFAULT 0 CHECK (token_budget >= 0), cost_budget numeric(18,8) NOT NULL DEFAULT 0 CHECK (cost_budget >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(agent_id,version),
 CHECK ((default_model IS NULL) = (default_model_version IS NULL)), CHECK ((prompt_id IS NULL) = (prompt_version IS NULL)),
 FOREIGN KEY(default_model,default_model_version) REFERENCES ai_models(model_id,model_version),
 FOREIGN KEY(agent_id,prompt_id,prompt_version) REFERENCES ai_prompts(agent_id,prompt_id,version)
);
ALTER TABLE ai_agents ADD FOREIGN KEY(agent_id,version) REFERENCES ai_agent_versions(agent_id,version) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE ai_agents ADD FOREIGN KEY(default_model,default_model_version) REFERENCES ai_models(model_id,model_version);
ALTER TABLE ai_agents ADD FOREIGN KEY(agent_id,prompt_id,prompt_version) REFERENCES ai_prompts(agent_id,prompt_id,version);
CREATE TABLE ai_tools (
 tool_id text PRIMARY KEY CHECK (tool_id ~ '^[a-z_]+[.][a-z_]+$'), name text NOT NULL, description text NOT NULL,
 risk_class ai_risk NOT NULL DEFAULT 'MATERIAL', status ai_registry_status NOT NULL DEFAULT 'DRAFT',
 requires_human_approval boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_agent_permissions (
 agent_id text NOT NULL REFERENCES ai_agents(agent_id), resource text NOT NULL CHECK (resource ~ '^[a-z_]+[.][a-z_]+$'),
 action ai_action NOT NULL, permission_state ai_permission_state NOT NULL DEFAULT 'DENY',
 conditions jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(conditions)='object'), risk_level ai_risk NOT NULL DEFAULT 'MATERIAL',
 human_approval_required boolean NOT NULL DEFAULT true, PRIMARY KEY(agent_id,resource,action),
 CHECK (permission_state <> 'CONDITIONAL' OR conditions <> '{}'::jsonb)
);
CREATE TABLE ai_data_classifications (data_classification ai_data_class PRIMARY KEY, description text NOT NULL);
CREATE TABLE ai_agent_data_permissions (
 agent_id text NOT NULL REFERENCES ai_agents(agent_id), data_classification ai_data_class NOT NULL REFERENCES ai_data_classifications(data_classification),
 permission_state ai_permission_state NOT NULL DEFAULT 'DENY', conditions jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(conditions)='object'),
 PRIMARY KEY(agent_id,data_classification), CHECK (data_classification NOT IN ('SYSTEM_SECRET','AUTHENTICATION_DATA') OR permission_state='DENY'),
 CHECK (permission_state <> 'CONDITIONAL' OR conditions <> '{}'::jsonb)
);
-- Vocabulary metadata only; does not introduce a workflow engine or renumber legacy stages.
CREATE TABLE ai_workflow_stages (workflow_version text NOT NULL CHECK(workflow_version='LEGACY_18_V1'), stage integer NOT NULL CHECK(stage BETWEEN 1 AND 18), name text NOT NULL, PRIMARY KEY(workflow_version,stage));
CREATE TABLE ai_stage_permissions (
 agent_id text NOT NULL REFERENCES ai_agents(agent_id), workflow_version text NOT NULL DEFAULT 'LEGACY_18_V1', stage integer NOT NULL,
 permission_state ai_permission_state NOT NULL DEFAULT 'DENY', conditions jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(conditions)='object'),
 PRIMARY KEY(agent_id,workflow_version,stage), FOREIGN KEY(workflow_version,stage) REFERENCES ai_workflow_stages(workflow_version,stage),
 CHECK(permission_state<>'CONDITIONAL' OR conditions<>'{}'::jsonb)
);
CREATE TABLE ai_human_approval_policies (
 policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id varchar(128) NOT NULL REFERENCES taxguard_tenants(id),
 agent_id text NOT NULL REFERENCES ai_agents(agent_id), action ai_action NOT NULL, risk_level ai_risk NOT NULL DEFAULT 'MATERIAL',
 confidence_below numeric CHECK(confidence_below BETWEEN 0 AND 1), workflow_version text, workflow_stage integer,
 data_classification ai_data_class REFERENCES ai_data_classifications(data_classification),
 materiality text NOT NULL CHECK(materiality IN ('ROUTINE','MATERIAL','CRITICAL')), financial_threshold numeric(18,2) CHECK(financial_threshold>=0),
 required_roles text[] NOT NULL DEFAULT ARRAY['PREPARER','REVIEWER','CPA_EA'], separation_required boolean NOT NULL DEFAULT true CHECK(separation_required),
 status ai_registry_status NOT NULL DEFAULT 'DRAFT', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(required_roles=ARRAY['PREPARER','REVIEWER','CPA_EA']), CHECK((workflow_version IS NULL)=(workflow_stage IS NULL)),
 FOREIGN KEY(workflow_version,workflow_stage) REFERENCES ai_workflow_stages(workflow_version,stage), UNIQUE(policy_id,tenant_id,agent_id)
);
CREATE TABLE ai_runs (
 run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), agent_id text NOT NULL, agent_version text NOT NULL,
 model_id text NOT NULL, model_provider text NOT NULL, model_version text NOT NULL, prompt_id text NOT NULL, prompt_version text NOT NULL,
 tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL, tax_case_id varchar(128) NOT NULL, case_record_id uuid NOT NULL REFERENCES taxguard_cases(id),
 tax_year integer NOT NULL CHECK(tax_year BETWEEN 2000 AND 2200), workflow_version text NOT NULL DEFAULT 'LEGACY_18_V1', workflow_stage integer NOT NULL,
 request_id text NOT NULL CHECK(length(btrim(request_id))>0), requested_by varchar(128) NOT NULL,
 input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'), output_hash text CHECK(output_hash ~ '^[a-f0-9]{64}$'),
 confidence numeric CHECK(confidence BETWEEN 0 AND 1), risk_level ai_risk NOT NULL DEFAULT 'MATERIAL', proposed_action jsonb,
 human_review_required boolean NOT NULL DEFAULT true CHECK(human_review_required), reviewer varchar(128), review_decision text CHECK(review_decision IN ('APPROVED','REJECTED','RETURNED')),
 execution_time integer CHECK(execution_time>=0), token_usage integer NOT NULL DEFAULT 0 CHECK(token_usage>=0), estimated_cost numeric(18,8) NOT NULL DEFAULT 0 CHECK(estimated_cost>=0),
 status ai_run_status NOT NULL DEFAULT 'QUEUED', created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz,
 audit_event_id uuid REFERENCES taxguard_audit_log(id),
 FOREIGN KEY(agent_id,agent_version) REFERENCES ai_agent_versions(agent_id,version),
 FOREIGN KEY(model_id,model_version,model_provider) REFERENCES ai_models(model_id,model_version,provider),
 FOREIGN KEY(agent_id,prompt_id,prompt_version) REFERENCES ai_prompts(agent_id,prompt_id,version),
 FOREIGN KEY(tenant_id,client_id) REFERENCES taxguard_clients(tenant_id,client_id),
 FOREIGN KEY(tenant_id,requested_by) REFERENCES taxguard_members(tenant_id,uid), FOREIGN KEY(tenant_id,reviewer) REFERENCES taxguard_members(tenant_id,uid),
 FOREIGN KEY(workflow_version,workflow_stage) REFERENCES ai_workflow_stages(workflow_version,stage),
 UNIQUE(run_id,tenant_id,client_id,tax_case_id,tax_year), UNIQUE(tenant_id,request_id),
 CHECK(reviewer IS NULL OR reviewer<>requested_by),
 CHECK(started_at IS NULL OR started_at>=created_at), CHECK(completed_at IS NULL OR completed_at>=created_at)
);
CREATE TABLE ai_evidence_sources (
 source_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL, tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL, case_record_id uuid NOT NULL REFERENCES taxguard_cases(id),
 evidence_type text NOT NULL CHECK(evidence_type IN ('DOCUMENT','AUTHORITY','CALCULATION','RULE')),
 document_record_id uuid REFERENCES taxguard_documents(id), document_version integer CHECK(document_version>0),
 source_reference text NOT NULL CHECK(length(btrim(source_reference))>0), source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((evidence_type='DOCUMENT')=(document_record_id IS NOT NULL)), CHECK((document_record_id IS NULL)=(document_version IS NULL)),
 UNIQUE(source_id,tenant_id,client_id,tax_case_id,tax_year)
);
CREATE TABLE ai_run_evidence (
 evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL, tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL, tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL, source_id uuid NOT NULL,
 page integer CHECK(page>0), field text, extracted_value jsonb, extracted_value_hash text CHECK(extracted_value_hash ~ '^[a-f0-9]{64}$'),
 authority text, calculation text, rule text, timestamp timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(run_id,tenant_id,client_id,tax_case_id,tax_year) REFERENCES ai_runs(run_id,tenant_id,client_id,tax_case_id,tax_year),
 FOREIGN KEY(source_id,tenant_id,client_id,tax_case_id,tax_year) REFERENCES ai_evidence_sources(source_id,tenant_id,client_id,tax_case_id,tax_year),
 CHECK(extracted_value IS NULL OR extracted_value_hash IS NOT NULL), UNIQUE(evidence_id,run_id)
);
CREATE TABLE ai_proposals (
 proposal_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL, tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL, tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL,
 status text NOT NULL DEFAULT 'PROPOSED' CHECK(status IN ('PROPOSED','REVIEW_REQUIRED','APPROVED','REJECTED')),
 structured_output jsonb NOT NULL CHECK(jsonb_typeof(structured_output)='object'), output_hash text NOT NULL CHECK(output_hash ~ '^[a-f0-9]{64}$'),
 is_ai_proposed_only boolean NOT NULL DEFAULT true CHECK(is_ai_proposed_only), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(run_id,tenant_id,client_id,tax_case_id,tax_year) REFERENCES ai_runs(run_id,tenant_id,client_id,tax_case_id,tax_year), UNIQUE(proposal_id,run_id)
);
CREATE TABLE ai_verifications (
 verification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL, proposal_id uuid NOT NULL, tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL, tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL,
 verifier_agent_id text NOT NULL, verifier_agent_version text NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('PASS','REVIEW_REQUIRED','EVIDENCE_REQUIRED','BLOCKED','ESCALATE')),
 findings jsonb NOT NULL CHECK(jsonb_typeof(findings)='array'), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(run_id,tenant_id,client_id,tax_case_id,tax_year) REFERENCES ai_runs(run_id,tenant_id,client_id,tax_case_id,tax_year), FOREIGN KEY(proposal_id,run_id) REFERENCES ai_proposals(proposal_id,run_id),
 FOREIGN KEY(verifier_agent_id,verifier_agent_version) REFERENCES ai_agent_versions(agent_id,version), UNIQUE(verification_id,run_id)
);
CREATE TABLE ai_verification_evidence (verification_id uuid NOT NULL, evidence_id uuid NOT NULL, run_id uuid NOT NULL, PRIMARY KEY(verification_id,evidence_id), FOREIGN KEY(verification_id,run_id) REFERENCES ai_verifications(verification_id,run_id), FOREIGN KEY(evidence_id,run_id) REFERENCES ai_run_evidence(evidence_id,run_id));
CREATE TABLE ai_human_reviews (
 review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL, proposal_id uuid NOT NULL, tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL, tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL,
 reviewer_user_id varchar(128) NOT NULL, reviewer_role text NOT NULL CHECK(reviewer_role IN ('reviewer','senior_reviewer','cpa','ea')),
 decision text NOT NULL CHECK(decision IN ('PENDING','APPROVED','REJECTED','RETURNED')), reason text,
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 FOREIGN KEY(run_id,tenant_id,client_id,tax_case_id,tax_year) REFERENCES ai_runs(run_id,tenant_id,client_id,tax_case_id,tax_year), FOREIGN KEY(proposal_id,run_id) REFERENCES ai_proposals(proposal_id,run_id),
 FOREIGN KEY(tenant_id,reviewer_user_id) REFERENCES taxguard_members(tenant_id,uid),
 CHECK(decision='PENDING' OR (completed_at IS NOT NULL AND reason IS NOT NULL AND length(btrim(reason))>=10)),
 CHECK(completed_at IS NULL OR completed_at>=created_at), UNIQUE(review_id,proposal_id,run_id)
);
CREATE TABLE ai_authoritative_actions (
 action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL, proposal_id uuid NOT NULL, review_id uuid NOT NULL, tenant_id varchar(128) NOT NULL, client_id varchar(64) NOT NULL, tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL,
 action ai_action NOT NULL, action_service text NOT NULL CHECK(length(btrim(action_service))>0),
 status text NOT NULL DEFAULT 'BLOCKED' CHECK(status IN ('BLOCKED','AUTHORIZED','EXECUTED','FAILED')),
 authorized_by varchar(128) NOT NULL, audit_event_id uuid NOT NULL REFERENCES taxguard_audit_log(id),
 created_at timestamptz NOT NULL DEFAULT now(), executed_at timestamptz, result_hash text CHECK(result_hash ~ '^[a-f0-9]{64}$'),
 FOREIGN KEY(run_id,tenant_id,client_id,tax_case_id,tax_year) REFERENCES ai_runs(run_id,tenant_id,client_id,tax_case_id,tax_year), FOREIGN KEY(review_id,proposal_id,run_id) REFERENCES ai_human_reviews(review_id,proposal_id,run_id),
 FOREIGN KEY(tenant_id,authorized_by) REFERENCES taxguard_members(tenant_id,uid), CHECK(status<>'EXECUTED' OR (executed_at IS NOT NULL AND result_hash IS NOT NULL))
);
CREATE TABLE ai_security_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id varchar(128) NOT NULL REFERENCES taxguard_tenants(id),
 client_id varchar(64), tax_case_id varchar(128), tax_year integer, case_record_id uuid REFERENCES taxguard_cases(id),
 run_id uuid REFERENCES ai_runs(run_id), agent_id text REFERENCES ai_agents(agent_id),
 event_type text NOT NULL CHECK(event_type IN ('AUTHORIZATION_DENIAL','PERMISSION_VIOLATION','CROSS_CLIENT_ATTEMPT','CROSS_TENANT_ATTEMPT','TOOL_DENIAL','POLICY_VIOLATION','PROMPT_INJECTION','KILL_SWITCH','MODEL_VIOLATION','HUMAN_APPROVAL_VIOLATION')),
 actor_uid varchar(128), severity ai_risk NOT NULL DEFAULT 'MATERIAL', details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,actor_uid) REFERENCES taxguard_members(tenant_id,uid),
 CHECK((client_id IS NULL AND tax_case_id IS NULL AND tax_year IS NULL AND case_record_id IS NULL) OR (client_id IS NOT NULL AND tax_case_id IS NOT NULL AND tax_year IS NOT NULL AND case_record_id IS NOT NULL))
);
CREATE TABLE ai_policy_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id varchar(128) NOT NULL REFERENCES taxguard_tenants(id),
 client_id varchar(64), tax_case_id varchar(128), tax_year integer, case_record_id uuid REFERENCES taxguard_cases(id),
 run_id uuid REFERENCES ai_runs(run_id), agent_id text REFERENCES ai_agents(agent_id),
 event_type text NOT NULL CHECK(event_type IN ('AUTHORIZATION_DENIAL','PERMISSION_VIOLATION','CROSS_CLIENT_ATTEMPT','CROSS_TENANT_ATTEMPT','TOOL_DENIAL','POLICY_VIOLATION','PROMPT_INJECTION','KILL_SWITCH','MODEL_VIOLATION','HUMAN_APPROVAL_VIOLATION')),
 actor_uid varchar(128), severity ai_risk NOT NULL DEFAULT 'MATERIAL', details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,actor_uid) REFERENCES taxguard_members(tenant_id,uid),
 CHECK((client_id IS NULL AND tax_case_id IS NULL AND tax_year IS NULL AND case_record_id IS NULL) OR (client_id IS NOT NULL AND tax_case_id IS NOT NULL AND tax_year IS NOT NULL AND case_record_id IS NOT NULL))
);
CREATE TABLE ai_kill_switches (
 switch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id varchar(128) NOT NULL REFERENCES taxguard_tenants(id),
 scope text NOT NULL CHECK(scope IN ('GLOBAL','AGENT','MODEL','TOOL','WORKFLOW')), target text NOT NULL,
 agent_id text REFERENCES ai_agents(agent_id), model_id text, model_version text, tool_id text REFERENCES ai_tools(tool_id), workflow_version text, workflow_stage integer,
 enabled boolean NOT NULL DEFAULT true, reason text NOT NULL CHECK(length(btrim(reason))>=10),
 activated_by varchar(128) NOT NULL, activated_at timestamptz NOT NULL DEFAULT now(), deactivated_by varchar(128), deactivated_at timestamptz,
 FOREIGN KEY(tenant_id,activated_by) REFERENCES taxguard_members(tenant_id,uid), FOREIGN KEY(tenant_id,deactivated_by) REFERENCES taxguard_members(tenant_id,uid),
 FOREIGN KEY(model_id,model_version) REFERENCES ai_models(model_id,model_version), FOREIGN KEY(workflow_version,workflow_stage) REFERENCES ai_workflow_stages(workflow_version,stage),
 UNIQUE(tenant_id,scope,target),
 CHECK((scope='GLOBAL' AND target='GLOBAL' AND agent_id IS NULL AND model_id IS NULL AND model_version IS NULL AND tool_id IS NULL AND workflow_version IS NULL AND workflow_stage IS NULL)
 OR (scope='AGENT' AND agent_id IS NOT NULL AND target=agent_id AND model_id IS NULL AND model_version IS NULL AND tool_id IS NULL AND workflow_version IS NULL AND workflow_stage IS NULL)
 OR (scope='MODEL' AND model_id IS NOT NULL AND model_version IS NOT NULL AND target=model_id||'@'||model_version AND agent_id IS NULL AND tool_id IS NULL AND workflow_version IS NULL AND workflow_stage IS NULL)
 OR (scope='TOOL' AND tool_id IS NOT NULL AND target=tool_id AND agent_id IS NULL AND model_id IS NULL AND model_version IS NULL AND workflow_version IS NULL AND workflow_stage IS NULL)
 OR (scope='WORKFLOW' AND workflow_version IS NOT NULL AND workflow_stage IS NOT NULL AND target=workflow_version||':'||workflow_stage::text AND agent_id IS NULL AND model_id IS NULL AND model_version IS NULL AND tool_id IS NULL)),
 CHECK((enabled AND deactivated_by IS NULL AND deactivated_at IS NULL) OR (NOT enabled AND deactivated_by IS NOT NULL AND deactivated_at IS NOT NULL AND deactivated_at>=activated_at))
);

-- Integrity functions are security-invoker and never perform authoritative tax writes.
CREATE FUNCTION ai_validate_case_scope() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE c taxguard_cases; d taxguard_documents; r ai_runs;
BEGIN
 IF NEW.case_record_id IS NOT NULL THEN
 SELECT * INTO c FROM taxguard_cases WHERE id=NEW.case_record_id;
 IF NOT FOUND OR (NEW.tenant_id,NEW.client_id,NEW.tax_case_id,NEW.tax_year) IS DISTINCT FROM (c.tenant_id,c.client_id,c.case_id,c.tax_year) THEN RAISE EXCEPTION 'AI_CASE_SCOPE_MISMATCH'; END IF;
 END IF;
 IF TG_TABLE_NAME='ai_runs' THEN
 IF NEW.audit_event_id IS NOT NULL THEN
 IF NOT EXISTS(SELECT 1 FROM taxguard_audit_log WHERE id=NEW.audit_event_id AND tenant_id=NEW.tenant_id AND case_id=NEW.tax_case_id) THEN RAISE EXCEPTION 'AI_AUDIT_SCOPE_MISMATCH'; END IF;
 END IF; END IF;
 IF TG_TABLE_NAME='ai_evidence_sources' THEN
 IF NEW.document_record_id IS NOT NULL THEN
 SELECT * INTO d FROM taxguard_documents WHERE id=NEW.document_record_id;
 IF NOT FOUND OR (d.tenant_id,d.client_id,d.case_id,d.tax_year,d.version) IS DISTINCT FROM (NEW.tenant_id,NEW.client_id,NEW.tax_case_id,NEW.tax_year,NEW.document_version) THEN RAISE EXCEPTION 'AI_DOCUMENT_SCOPE_MISMATCH'; END IF;
 END IF; END IF;
 IF TG_TABLE_NAME IN ('ai_security_events','ai_policy_events') THEN
 IF NEW.run_id IS NOT NULL THEN
 SELECT * INTO r FROM ai_runs WHERE run_id=NEW.run_id;
 IF NOT FOUND OR (NEW.tenant_id,NEW.client_id,NEW.tax_case_id,NEW.tax_year) IS DISTINCT FROM (r.tenant_id,r.client_id,r.tax_case_id,r.tax_year) THEN RAISE EXCEPTION 'AI_EVENT_SCOPE_MISMATCH'; END IF;
 END IF; END IF;
 RETURN NEW; END $$;
CREATE FUNCTION ai_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$ BEGIN RAISE EXCEPTION 'AI_IMMUTABLE_HISTORY'; END $$;
CREATE FUNCTION ai_validate_review() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r ai_runs; c taxguard_cases; m taxguard_members;
BEGIN
 SELECT * INTO r FROM ai_runs WHERE run_id=NEW.run_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'AI_REVIEW_RUN_REQUIRED'; END IF;
 SELECT * INTO c FROM taxguard_cases WHERE id=r.case_record_id;
 SELECT * INTO m FROM taxguard_members WHERE tenant_id=NEW.tenant_id AND uid=NEW.reviewer_user_id;
 IF NOT FOUND OR m.status<>'active' OR m.role<>NEW.reviewer_role OR NEW.reviewer_user_id IN (r.requested_by,c.preparer_uid) OR NEW.reviewer_user_id<>c.reviewer_uid THEN RAISE EXCEPTION 'AI_INDEPENDENT_REVIEWER_REQUIRED'; END IF;
 IF NEW.decision='APPROVED' AND (m.credential_verified IS DISTINCT FROM true OR coalesce(m.credential_type,'') NOT IN ('CPA','EA','ATTORNEY') OR m.credential_expires_at IS NULL OR m.credential_expires_at<=now()) THEN RAISE EXCEPTION 'AI_REVIEW_CREDENTIAL_REQUIRED'; END IF;
 RETURN NEW; END $$;
CREATE FUNCTION ai_validate_action_record() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.status IN ('AUTHORIZED','EXECUTED') AND NOT EXISTS(SELECT 1 FROM ai_human_reviews WHERE review_id=NEW.review_id AND proposal_id=NEW.proposal_id AND run_id=NEW.run_id AND decision='APPROVED' AND reviewer_user_id=NEW.authorized_by) THEN RAISE EXCEPTION 'AI_ACTION_APPROVAL_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM taxguard_audit_log WHERE id=NEW.audit_event_id AND tenant_id=NEW.tenant_id AND case_id=NEW.tax_case_id) THEN RAISE EXCEPTION 'AI_ACTION_AUDIT_REQUIRED'; END IF;
 RETURN NEW; END $$;
CREATE FUNCTION ai_protect_registry_version() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='ai_agents' THEN
   IF TG_OP='DELETE' THEN RAISE EXCEPTION 'AI_AGENT_ID_IMMUTABLE'; END IF;
   IF NEW.agent_id<>OLD.agent_id THEN RAISE EXCEPTION 'AI_AGENT_ID_IMMUTABLE'; END IF;
 ELSIF TG_TABLE_NAME='ai_prompts' THEN
   IF EXISTS(SELECT 1 FROM ai_runs WHERE agent_id=OLD.agent_id AND prompt_id=OLD.prompt_id AND prompt_version=OLD.version) THEN RAISE EXCEPTION 'AI_PROMPT_VERSION_IN_USE'; END IF;
 ELSIF TG_TABLE_NAME='ai_agent_versions' THEN
   IF EXISTS(SELECT 1 FROM ai_runs WHERE agent_id=OLD.agent_id AND agent_version=OLD.version) THEN RAISE EXCEPTION 'AI_AGENT_VERSION_IN_USE'; END IF;
 ELSIF TG_TABLE_NAME='ai_models' THEN
   IF EXISTS(SELECT 1 FROM ai_runs WHERE model_id=OLD.model_id AND model_version=OLD.model_version) THEN RAISE EXCEPTION 'AI_MODEL_VERSION_IN_USE'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $$;
CREATE FUNCTION ai_protect_run_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'AI_RUN_DELETE_DENIED'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','output_hash','confidence','proposed_action','reviewer','review_decision','execution_time','token_usage','estimated_cost','started_at','completed_at','audit_event_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','output_hash','confidence','proposed_action','reviewer','review_decision','execution_time','token_usage','estimated_cost','started_at','completed_at','audit_event_id']) THEN RAISE EXCEPTION 'AI_RUN_IDENTITY_IMMUTABLE'; END IF;
 IF OLD.status IN ('APPROVED','REJECTED','FAILED','CANCELLED') THEN RAISE EXCEPTION 'AI_TERMINAL_RUN_IMMUTABLE'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER ai_runs_scope BEFORE INSERT OR UPDATE ON ai_runs FOR EACH ROW EXECUTE FUNCTION ai_validate_case_scope();
CREATE TRIGGER ai_evidence_sources_scope BEFORE INSERT OR UPDATE ON ai_evidence_sources FOR EACH ROW EXECUTE FUNCTION ai_validate_case_scope();
CREATE TRIGGER ai_security_events_scope BEFORE INSERT OR UPDATE ON ai_security_events FOR EACH ROW EXECUTE FUNCTION ai_validate_case_scope();
CREATE TRIGGER ai_policy_events_scope BEFORE INSERT OR UPDATE ON ai_policy_events FOR EACH ROW EXECUTE FUNCTION ai_validate_case_scope();
CREATE TRIGGER ai_agents_version_guard BEFORE UPDATE OR DELETE ON ai_agents FOR EACH ROW EXECUTE FUNCTION ai_protect_registry_version();
CREATE TRIGGER ai_agent_versions_version_guard BEFORE UPDATE OR DELETE ON ai_agent_versions FOR EACH ROW EXECUTE FUNCTION ai_protect_registry_version();
CREATE TRIGGER ai_prompts_version_guard BEFORE UPDATE OR DELETE ON ai_prompts FOR EACH ROW EXECUTE FUNCTION ai_protect_registry_version();
CREATE TRIGGER ai_models_version_guard BEFORE UPDATE OR DELETE ON ai_models FOR EACH ROW EXECUTE FUNCTION ai_protect_registry_version();
CREATE TRIGGER ai_evidence_sources_immutable BEFORE UPDATE OR DELETE ON ai_evidence_sources FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_run_evidence_immutable BEFORE UPDATE OR DELETE ON ai_run_evidence FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_proposals_immutable BEFORE UPDATE OR DELETE ON ai_proposals FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_verifications_immutable BEFORE UPDATE OR DELETE ON ai_verifications FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_human_reviews_immutable BEFORE UPDATE OR DELETE ON ai_human_reviews FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_authoritative_actions_immutable BEFORE UPDATE OR DELETE ON ai_authoritative_actions FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_security_events_immutable BEFORE UPDATE OR DELETE ON ai_security_events FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_policy_events_immutable BEFORE UPDATE OR DELETE ON ai_policy_events FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_verification_evidence_immutable BEFORE UPDATE OR DELETE ON ai_verification_evidence FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_runs_identity BEFORE UPDATE OR DELETE ON ai_runs FOR EACH ROW EXECUTE FUNCTION ai_protect_run_identity();
CREATE TRIGGER ai_reviews_guard BEFORE INSERT ON ai_human_reviews FOR EACH ROW EXECUTE FUNCTION ai_validate_review();
CREATE TRIGGER ai_actions_guard BEFORE INSERT ON ai_authoritative_actions FOR EACH ROW EXECUTE FUNCTION ai_validate_action_record();
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_agents FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_versions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_agent_versions FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_models FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_models FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompts FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_prompts FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tools FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_tools FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_permissions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_agent_permissions FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_data_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_data_classifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_data_classifications FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_agent_data_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_data_permissions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_agent_data_permissions FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_workflow_stages FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_workflow_stages FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_stage_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_stage_permissions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_stage_permissions FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_human_approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_human_approval_policies FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_human_approval_policies FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_runs FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_evidence_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_evidence_sources FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_evidence_sources FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_run_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_run_evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_run_evidence FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_proposals FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_proposals FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_verifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_verifications FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_human_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_human_reviews FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_human_reviews FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_authoritative_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_authoritative_actions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_authoritative_actions FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_security_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_security_events FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_policy_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_policy_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_policy_events FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_kill_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_kill_switches FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_kill_switches FROM PUBLIC, anon, authenticated;
-- No permissive end-user policies: backend authorization is implemented in later gates.
ALTER TABLE ai_verification_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_verification_evidence FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_verification_evidence FROM PUBLIC, anon, authenticated;
CREATE INDEX ai_runs_scope_status ON ai_runs(tenant_id,client_id,tax_case_id,tax_year,status,created_at);
CREATE INDEX ai_runs_agent_time ON ai_runs(agent_id,created_at);
CREATE INDEX ai_reviews_pending ON ai_human_reviews(tenant_id,decision,created_at);
CREATE INDEX ai_evidence_run ON ai_run_evidence(run_id);
CREATE INDEX ai_proposals_run ON ai_proposals(run_id);
CREATE INDEX ai_verifications_run ON ai_verifications(run_id);
CREATE INDEX ai_actions_run ON ai_authoritative_actions(run_id);
CREATE INDEX ai_security_scope_time ON ai_security_events(tenant_id,created_at);
CREATE INDEX ai_policy_scope_time ON ai_policy_events(tenant_id,created_at);
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A00','Supervisor / Orchestrator','SUPERVISOR','Supervisor registry identity; orchestration is not activated.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A01','CLIENT SERVICES 01','CLIENT_SERVICES','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A02','CLIENT SERVICES 02','CLIENT_SERVICES','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A03','CLIENT SERVICES 03','CLIENT_SERVICES','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A04','CLIENT SERVICES 04','CLIENT_SERVICES','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A05','Document Intake','DOCUMENT_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A06','Document Classification','DOCUMENT_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A07','OCR / Extraction','DOCUMENT_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A08','Extraction Validation','DOCUMENT_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A09','DOCUMENT INTELLIGENCE 09','DOCUMENT_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A10','Duplicate / Fraud Check','DOCUMENT_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A11','Evidence','DOCUMENT_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A12','ACCOUNTING 12','ACCOUNTING','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A13','ACCOUNTING 13','ACCOUNTING','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A14','ACCOUNTING 14','ACCOUNTING','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A15','ACCOUNTING 15','ACCOUNTING','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A16','ACCOUNTING 16','ACCOUNTING','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A17','TAX INTELLIGENCE 17','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A18','Federal Tax Analysis','TAX_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A19','State Tax Analysis','TAX_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A20','TAX INTELLIGENCE 20','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A21','TAX INTELLIGENCE 21','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A22','TAX INTELLIGENCE 22','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A23','TAX INTELLIGENCE 23','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A24','TAX INTELLIGENCE 24','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A25','TAX INTELLIGENCE 25','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A26','TAX INTELLIGENCE 26','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A27','TAX INTELLIGENCE 27','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A28','Calculation Verification','TAX_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A29','TAX INTELLIGENCE 29','TAX_INTELLIGENCE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A30','Form Mapping','TAX_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A31','Diagnostics','TAX_INTELLIGENCE','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A32','RISK QC 32','RISK_QC','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A33','RISK QC 33','RISK_QC','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A34','Reviewer Support','RISK_QC','Directive identifies this capability. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A35','RISK QC 35','RISK_QC','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A36','SIGN FILE RESOLVE 36','SIGN_FILE_RESOLVE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A37','SIGN FILE RESOLVE 37','SIGN_FILE_RESOLVE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A38','SIGN FILE RESOLVE 38','SIGN_FILE_RESOLVE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A39','SIGN FILE RESOLVE 39','SIGN_FILE_RESOLVE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A40','SIGN FILE RESOLVE 40','SIGN_FILE_RESOLVE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A41','SIGN FILE RESOLVE 41','SIGN_FILE_RESOLVE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A42','SIGN FILE RESOLVE 42','SIGN_FILE_RESOLVE','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A43','PRACTICE OPERATIONS 43','PRACTICE_OPERATIONS','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A44','PRACTICE OPERATIONS 44','PRACTICE_OPERATIONS','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A45','PRACTICE OPERATIONS 45','PRACTICE_OPERATIONS','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A46','PRACTICE OPERATIONS 46','PRACTICE_OPERATIONS','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A47','PRACTICE OPERATIONS 47','PRACTICE_OPERATIONS','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A48','PRACTICE OPERATIONS 48','PRACTICE_OPERATIONS','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A49','PRACTICE OPERATIONS 49','PRACTICE_OPERATIONS','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A50','PRACTICE OPERATIONS 50','PRACTICE_OPERATIONS','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A51','GOVERNANCE SECURITY PLATFORM 51','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A52','GOVERNANCE SECURITY PLATFORM 52','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A53','GOVERNANCE SECURITY PLATFORM 53','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A54','GOVERNANCE SECURITY PLATFORM 54','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A55','GOVERNANCE SECURITY PLATFORM 55','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A56','GOVERNANCE SECURITY PLATFORM 56','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A57','GOVERNANCE SECURITY PLATFORM 57','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A58','GOVERNANCE SECURITY PLATFORM 58','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A59','GOVERNANCE SECURITY PLATFORM 59','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agents(agent_id,agent_name,category,description) VALUES('A60','GOVERNANCE SECURITY PLATFORM 60','GOVERNANCE_SECURITY_PLATFORM','Exact specialized name requires the missing approved architecture mapping. DRAFT metadata only; no execution authority.');
INSERT INTO ai_agent_versions(agent_id,version,schema_version) SELECT agent_id,version,schema_version FROM ai_agents;
INSERT INTO ai_data_classifications VALUES('PUBLIC','PUBLIC governed classification');
INSERT INTO ai_data_classifications VALUES('INTERNAL','INTERNAL governed classification');
INSERT INTO ai_data_classifications VALUES('CLIENT_PII','CLIENT_PII governed classification');
INSERT INTO ai_data_classifications VALUES('TAX_DATA','TAX_DATA governed classification');
INSERT INTO ai_data_classifications VALUES('FINANCIAL_DATA','FINANCIAL_DATA governed classification');
INSERT INTO ai_data_classifications VALUES('DOCUMENT_CONTENT','DOCUMENT_CONTENT governed classification');
INSERT INTO ai_data_classifications VALUES('AUTHENTICATION_DATA','AUTHENTICATION_DATA governed classification');
INSERT INTO ai_data_classifications VALUES('AUDIT_DATA','AUDIT_DATA governed classification');
INSERT INTO ai_data_classifications VALUES('SYSTEM_SECRET','SYSTEM_SECRET governed classification');
INSERT INTO ai_tools(tool_id,name,description) VALUES('database.read','database.read','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('document.read','document.read','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('ocr.extract','ocr.extract','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('tax_authority.search','tax_authority.search','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('calculation.execute','calculation.execute','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('workflow.read','workflow.read','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('workflow.propose','workflow.propose','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('message.draft','message.draft','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('calendar.read','calendar.read','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('billing.read','billing.read','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_tools(tool_id,name,description) VALUES('filing.prepare','filing.prepare','DRAFT capability definition; no executable handler or grants in AI-1');
INSERT INTO ai_agent_permissions(agent_id,resource,action) SELECT a.agent_id,t.tool_id,x.action::ai_action FROM ai_agents a CROSS JOIN ai_tools t CROSS JOIN unnest(ARRAY['READ','CREATE','UPDATE','DELETE','EXECUTE','APPROVE','EXPORT','TRANSMIT']) AS x(action);
INSERT INTO ai_agent_data_permissions(agent_id,data_classification) SELECT agent_id,data_classification FROM ai_agents CROSS JOIN ai_data_classifications;
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',1,'Onboard');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',2,'Collect');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',3,'Validate');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',4,'Record');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',5,'Reconcile');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',6,'Review');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',7,'Report');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',8,'Plan');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',9,'Prepare Taxes');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',10,'Approve');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',11,'Sign');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',12,'File');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',13,'Government Feedback');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',14,'Resolve');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',15,'Monitor');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',16,'Archive');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',17,'Renew');
INSERT INTO ai_workflow_stages VALUES('LEGACY_18_V1',18,'Repeat');
INSERT INTO ai_stage_permissions(agent_id,workflow_version,stage) SELECT agent_id,workflow_version,stage FROM ai_agents CROSS JOIN ai_workflow_stages;
COMMIT;
