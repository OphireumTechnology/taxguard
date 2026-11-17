-- AI-5 bounded metadata read admission only. No handler activation, tax writes or production commissioning.
BEGIN;
CREATE TABLE ai_capability_admissions (
 invocation_id uuid PRIMARY KEY,
 tenant_id varchar(128) NOT NULL REFERENCES taxguard_tenants(id), actor_uid varchar(128) NOT NULL,
 case_record_id uuid NOT NULL REFERENCES taxguard_cases(id), client_id varchar(64) NOT NULL,
 tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL,
 root_id uuid NOT NULL, operation_id uuid NOT NULL,
 agent_id text NOT NULL, agent_version text NOT NULL,
 capability_id text NOT NULL REFERENCES ai_tools(tool_id) CHECK(capability_id IN ('workflow.read','document.read')),
 capability_version text NOT NULL CHECK(capability_version='1'), action ai_action NOT NULL DEFAULT 'READ' CHECK(action='READ'),
 workflow_version text NOT NULL DEFAULT 'LEGACY_18_V1' CHECK(workflow_version='LEGACY_18_V1'), workflow_stage integer NOT NULL,
 decision_id uuid NOT NULL REFERENCES ai_governance_decisions(decision_id),
 run_id uuid REFERENCES ai_runs(run_id), attempt_id uuid REFERENCES ai_gateway_attempts(attempt_id),
 binding_hash text NOT NULL CHECK(binding_hash ~ '^[a-f0-9]{64}$'), definition_hash text NOT NULL CHECK(definition_hash ~ '^[a-f0-9]{64}$'),
 input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'), input_schema_hash text NOT NULL CHECK(input_schema_hash ~ '^[a-f0-9]{64}$'),
 output_schema_hash text NOT NULL CHECK(output_schema_hash ~ '^[a-f0-9]{64}$'), evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[a-f0-9]{64}$'),
 human_review_required boolean NOT NULL DEFAULT true CHECK(human_review_required),
 authoritative_mutation boolean NOT NULL DEFAULT false CHECK(NOT authoritative_mutation),
 provider_export_allowed boolean NOT NULL DEFAULT false CHECK(NOT provider_export_allowed),
 execution_boundary text NOT NULL DEFAULT 'ISOLATED_TEST_ONLY' CHECK(execution_boundary='ISOLATED_TEST_ONLY'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(invocation_id,tenant_id,actor_uid), UNIQUE(tenant_id,actor_uid,operation_id,capability_id),
 FOREIGN KEY(tenant_id,actor_uid) REFERENCES taxguard_members(tenant_id,uid),
 FOREIGN KEY(root_id,tenant_id,actor_uid) REFERENCES ai_orchestration_roots(root_id,tenant_id,actor_uid),
 FOREIGN KEY(agent_id,agent_version) REFERENCES ai_agent_versions(agent_id,version),
 FOREIGN KEY(workflow_version,workflow_stage) REFERENCES ai_workflow_stages(workflow_version,stage),
 CHECK((run_id IS NULL)=(attempt_id IS NULL))
);
CREATE TABLE ai_capability_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invocation_id uuid NOT NULL,
 tenant_id varchar(128) NOT NULL, actor_uid varchar(128) NOT NULL,
 status text NOT NULL CHECK(status IN ('ADMITTED','EXECUTING','EXECUTED','DENIED','FAILED','TIMED_OUT','CANCELLED','DISCARDED')),
 reason_code text NOT NULL CHECK(reason_code ~ '^AI_[A-Z_]+$'), handler_invoked boolean NOT NULL,
 output_hash text CHECK(output_hash ~ '^[a-f0-9]{64}$'), decision_id uuid NOT NULL REFERENCES ai_governance_decisions(decision_id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(invocation_id,tenant_id,actor_uid) REFERENCES ai_capability_admissions(invocation_id,tenant_id,actor_uid),
 CHECK((status='EXECUTED')=(output_hash IS NOT NULL)),
 CHECK(status NOT IN ('ADMITTED','EXECUTING','DENIED') OR NOT handler_invoked),
 CHECK(status NOT IN ('EXECUTED','DISCARDED') OR handler_invoked)
);
CREATE UNIQUE INDEX ai_capability_event_once ON ai_capability_events(invocation_id,status) WHERE status IN ('ADMITTED','EXECUTING','EXECUTED');
CREATE UNIQUE INDEX ai_capability_failure_once ON ai_capability_events(invocation_id) WHERE status IN ('DENIED','FAILED','TIMED_OUT','CANCELLED','DISCARDED');
CREATE INDEX ai_capability_scope_history ON ai_capability_admissions(tenant_id,case_record_id,created_at);
CREATE INDEX ai_capability_event_history ON ai_capability_events(invocation_id,created_at);

CREATE FUNCTION ai_validate_capability_history() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE a ai_capability_admissions%ROWTYPE; d ai_governance_decisions%ROWTYPE; r ai_orchestration_roots%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='ai_capability_admissions' THEN
   SELECT * INTO r FROM ai_orchestration_roots WHERE root_id=NEW.root_id;
   IF r.case_record_id IS DISTINCT FROM NEW.case_record_id OR r.tenant_id IS DISTINCT FROM NEW.tenant_id OR r.actor_uid IS DISTINCT FROM NEW.actor_uid OR
      r.client_id IS DISTINCT FROM NEW.client_id OR r.tax_case_id IS DISTINCT FROM NEW.tax_case_id OR r.tax_year IS DISTINCT FROM NEW.tax_year OR r.workflow_stage IS DISTINCT FROM NEW.workflow_stage THEN
     RAISE EXCEPTION 'invalid capability root';
   END IF;
   IF NOT EXISTS(SELECT 1 FROM ai_orchestration_events WHERE root_id=NEW.root_id AND operation_id=NEW.operation_id AND agent_id=NEW.agent_id AND status='RUNNING') OR
      EXISTS(SELECT 1 FROM ai_orchestration_events WHERE root_id=NEW.root_id AND ((operation_id IS NULL AND status IN ('COMPLETED','FAILED')) OR (operation_id=NEW.operation_id AND status IN ('FAILED','DENIED','TIMED_OUT','CANCELLED','RESULT_RECORDED')))) THEN
     RAISE EXCEPTION 'invalid capability operation';
   END IF;
   SELECT * INTO d FROM ai_governance_decisions WHERE decision_id=NEW.decision_id;
   IF d.agent_id IS DISTINCT FROM NEW.agent_id OR d.tenant_id IS DISTINCT FROM NEW.tenant_id OR d.actor_uid IS DISTINCT FROM NEW.actor_uid OR
      d.case_record_id IS DISTINCT FROM NEW.case_record_id OR d.outcome NOT IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED') OR
      (d.policy_snapshot->'stage_permission'->>'stage') IS DISTINCT FROM NEW.workflow_stage::text OR
      NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.policy_snapshot->'tools') t WHERE t->>'tool_id'=NEW.capability_id AND t->>'status'='ACTIVE') OR
      NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.policy_snapshot->'permissions') p WHERE p->>'resource'=NEW.capability_id AND p->>'action'='READ' AND p->>'permission_state' IN ('ALLOW','CONDITIONAL')) THEN
     RAISE EXCEPTION 'invalid capability decision';
   END IF;
   IF NEW.run_id IS NULL AND EXISTS(SELECT 1 FROM ai_gateway_admissions WHERE operation_id=NEW.operation_id) THEN RAISE EXCEPTION 'missing capability gateway correlation'; END IF;
   IF NEW.run_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ai_gateway_admissions g JOIN ai_gateway_outcomes o ON o.run_id=g.run_id
      WHERE g.run_id=NEW.run_id AND o.attempt_id=NEW.attempt_id AND o.status='ACCEPTED' AND o.terminal AND g.root_id=NEW.root_id AND g.operation_id=NEW.operation_id AND g.tenant_id=NEW.tenant_id AND g.actor_uid=NEW.actor_uid) THEN
     RAISE EXCEPTION 'invalid capability gateway correlation';
   END IF;
 ELSE
   SELECT * INTO a FROM ai_capability_admissions WHERE invocation_id=NEW.invocation_id;
   SELECT * INTO d FROM ai_governance_decisions WHERE decision_id=NEW.decision_id;
   IF a.invocation_id IS NULL OR d.tenant_id IS DISTINCT FROM a.tenant_id OR d.actor_uid IS DISTINCT FROM a.actor_uid OR d.case_record_id IS DISTINCT FROM a.case_record_id OR d.agent_id IS DISTINCT FROM a.agent_id OR d.outcome NOT IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED') OR
      (d.policy_snapshot->'stage_permission'->>'stage') IS DISTINCT FROM a.workflow_stage::text OR
      NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d.policy_snapshot->'tools') t WHERE t->>'tool_id'=a.capability_id AND t->>'status'='ACTIVE') THEN
     RAISE EXCEPTION 'invalid capability event decision';
   END IF;
   IF EXISTS(SELECT 1 FROM ai_capability_events WHERE invocation_id=NEW.invocation_id AND status IN ('DENIED','FAILED','TIMED_OUT','CANCELLED','DISCARDED')) THEN
     RAISE EXCEPTION 'terminal capability history';
   END IF;
   IF NEW.status='ADMITTED' AND EXISTS(SELECT 1 FROM ai_capability_events WHERE invocation_id=NEW.invocation_id) THEN RAISE EXCEPTION 'invalid admission order'; END IF;
   IF NEW.status<>'ADMITTED' AND NOT EXISTS(SELECT 1 FROM ai_capability_events WHERE invocation_id=NEW.invocation_id AND status='ADMITTED') THEN RAISE EXCEPTION 'missing admission'; END IF;
   IF NEW.handler_invoked AND NOT EXISTS(SELECT 1 FROM ai_capability_events WHERE invocation_id=NEW.invocation_id AND status='EXECUTING') THEN RAISE EXCEPTION 'missing execution admission'; END IF;
   IF EXISTS(SELECT 1 FROM ai_capability_events WHERE invocation_id=NEW.invocation_id AND status='EXECUTED') AND NEW.status NOT IN ('DISCARDED','CANCELLED','TIMED_OUT') THEN RAISE EXCEPTION 'completed capability history'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ai_capability_admissions_scope BEFORE INSERT ON ai_capability_admissions FOR EACH ROW EXECUTE FUNCTION ai_validate_case_scope();
CREATE TRIGGER ai_capability_admissions_validate BEFORE INSERT ON ai_capability_admissions FOR EACH ROW EXECUTE FUNCTION ai_validate_capability_history();
CREATE TRIGGER ai_capability_events_validate BEFORE INSERT ON ai_capability_events FOR EACH ROW EXECUTE FUNCTION ai_validate_capability_history();
CREATE TRIGGER ai_capability_admissions_immutable BEFORE UPDATE OR DELETE ON ai_capability_admissions FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_capability_events_immutable BEFORE UPDATE OR DELETE ON ai_capability_events FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
ALTER TABLE ai_capability_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_capability_admissions FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_capability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_capability_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_capability_admissions,ai_capability_events FROM PUBLIC,anon,authenticated;
COMMIT;
