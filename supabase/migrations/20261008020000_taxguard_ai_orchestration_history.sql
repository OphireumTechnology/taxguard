-- AI-3 coordination/test execution metadata only. No provider or authoritative action activation.
BEGIN;
CREATE TABLE ai_orchestration_roots (
 root_id uuid PRIMARY KEY,
 tenant_id varchar(128) NOT NULL REFERENCES taxguard_tenants(id), actor_uid varchar(128) NOT NULL,
 request_key text NOT NULL CHECK(request_key ~ '^[a-f0-9]{64}$'), input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 case_record_id uuid NOT NULL REFERENCES taxguard_cases(id), client_id varchar(64) NOT NULL,
 tax_case_id varchar(128) NOT NULL, tax_year integer NOT NULL, workflow_version text NOT NULL DEFAULT 'LEGACY_18_V1' CHECK(workflow_version='LEGACY_18_V1'),
 workflow_stage integer NOT NULL CHECK(workflow_stage BETWEEN 1 AND 18),
 coordinator_decision_id uuid NOT NULL UNIQUE REFERENCES ai_governance_decisions(decision_id),
 human_review_required boolean NOT NULL DEFAULT true CHECK(human_review_required),
 action_executed boolean NOT NULL DEFAULT false CHECK(NOT action_executed),
 execution_boundary text NOT NULL DEFAULT 'DISABLED_OR_ISOLATED_TEST' CHECK(execution_boundary='DISABLED_OR_ISOLATED_TEST'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(root_id,tenant_id,actor_uid), UNIQUE(tenant_id,actor_uid,request_key),
 FOREIGN KEY(tenant_id,actor_uid) REFERENCES taxguard_members(tenant_id,uid)
);
CREATE TABLE ai_orchestration_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), root_id uuid NOT NULL,
 tenant_id varchar(128) NOT NULL, actor_uid varchar(128) NOT NULL,
 operation_id uuid, agent_id text NOT NULL REFERENCES ai_agents(agent_id), attempt integer NOT NULL CHECK(attempt BETWEEN 0 AND 2),
 purpose text CHECK(purpose IN ('IDENTIFY_REVIEW_QUESTIONS','REVIEW_EVIDENCE_COMPLETENESS')),
 status text NOT NULL CHECK(status IN ('PLANNED','AUTHORIZED','RUNNING','RESULT_RECORDED','DENIED','FAILED','TIMED_OUT','CANCELLED','RETRY_REQUIRED','COMPLETED','UNAVAILABLE')),
 decision_id uuid REFERENCES ai_governance_decisions(decision_id),
 reason_code text NOT NULL CHECK(reason_code ~ '^AI_[A-Z_]+$'), output_hash text CHECK(output_hash ~ '^[a-f0-9]{64}$'),
 human_review_required boolean NOT NULL DEFAULT true CHECK(human_review_required),
 action_executed boolean NOT NULL DEFAULT false CHECK(NOT action_executed),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(root_id,tenant_id,actor_uid) REFERENCES ai_orchestration_roots(root_id,tenant_id,actor_uid),
 CHECK((operation_id IS NULL AND agent_id='A00' AND attempt=0 AND purpose IS NULL AND status IN ('PLANNED','COMPLETED','FAILED')) OR
       (operation_id IS NOT NULL AND agent_id<>'A00' AND purpose IS NOT NULL AND status NOT IN ('PLANNED','COMPLETED'))),
 CHECK(status NOT IN ('AUTHORIZED','RUNNING','RESULT_RECORDED') OR decision_id IS NOT NULL),
 CHECK((status='RESULT_RECORDED')=(output_hash IS NOT NULL))
);
CREATE UNIQUE INDEX ai_orchestration_attempt_start ON ai_orchestration_events(operation_id,attempt) WHERE status='RUNNING';
CREATE UNIQUE INDEX ai_orchestration_operation_result ON ai_orchestration_events(operation_id) WHERE status='RESULT_RECORDED';
CREATE UNIQUE INDEX ai_orchestration_root_terminal ON ai_orchestration_events(root_id) WHERE operation_id IS NULL AND status IN ('COMPLETED','FAILED');
CREATE INDEX ai_orchestration_scope_history ON ai_orchestration_roots(tenant_id,case_record_id,created_at);
CREATE INDEX ai_orchestration_root_history ON ai_orchestration_events(root_id,created_at);

CREATE FUNCTION ai_validate_orchestration_decision() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE d ai_governance_decisions%ROWTYPE; r ai_orchestration_roots%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='ai_orchestration_roots' THEN
   SELECT * INTO d FROM ai_governance_decisions WHERE decision_id=NEW.coordinator_decision_id;
   IF d.agent_id IS DISTINCT FROM 'A00' OR d.tenant_id IS DISTINCT FROM NEW.tenant_id OR d.actor_uid IS DISTINCT FROM NEW.actor_uid OR
     d.case_record_id IS DISTINCT FROM NEW.case_record_id OR d.outcome NOT IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED') OR
     (d.policy_snapshot->'stage_permission'->>'stage') IS DISTINCT FROM NEW.workflow_stage::text THEN
     RAISE EXCEPTION 'invalid coordinator decision';
   END IF;
 ELSE
   SELECT * INTO r FROM ai_orchestration_roots WHERE root_id=NEW.root_id;
   IF EXISTS(SELECT 1 FROM ai_orchestration_events WHERE root_id=NEW.root_id AND operation_id IS NULL AND status IN ('COMPLETED','FAILED')) THEN
     RAISE EXCEPTION 'terminal orchestration history';
   END IF;
   IF NEW.operation_id IS NOT NULL AND EXISTS(SELECT 1 FROM ai_orchestration_events WHERE operation_id=NEW.operation_id AND
       (root_id<>NEW.root_id OR agent_id<>NEW.agent_id OR purpose<>NEW.purpose)) THEN
     RAISE EXCEPTION 'operation identity conflict';
   END IF;
   IF NEW.decision_id IS NOT NULL THEN
     SELECT * INTO d FROM ai_governance_decisions WHERE decision_id=NEW.decision_id;
     IF d.agent_id IS DISTINCT FROM NEW.agent_id OR d.tenant_id IS DISTINCT FROM NEW.tenant_id OR d.actor_uid IS DISTINCT FROM NEW.actor_uid OR
       d.case_record_id IS DISTINCT FROM r.case_record_id OR d.outcome NOT IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED') THEN
       RAISE EXCEPTION 'invalid child decision';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ai_orchestration_roots_scope BEFORE INSERT ON ai_orchestration_roots FOR EACH ROW EXECUTE FUNCTION ai_validate_case_scope();
CREATE TRIGGER ai_orchestration_roots_decision BEFORE INSERT ON ai_orchestration_roots FOR EACH ROW EXECUTE FUNCTION ai_validate_orchestration_decision();
CREATE TRIGGER ai_orchestration_events_decision BEFORE INSERT ON ai_orchestration_events FOR EACH ROW EXECUTE FUNCTION ai_validate_orchestration_decision();
CREATE TRIGGER ai_orchestration_roots_immutable BEFORE UPDATE OR DELETE ON ai_orchestration_roots FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
CREATE TRIGGER ai_orchestration_events_immutable BEFORE UPDATE OR DELETE ON ai_orchestration_events FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation();
ALTER TABLE ai_orchestration_roots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_orchestration_roots FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_orchestration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_orchestration_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ai_orchestration_roots,ai_orchestration_events FROM PUBLIC,anon,authenticated;
COMMIT;
