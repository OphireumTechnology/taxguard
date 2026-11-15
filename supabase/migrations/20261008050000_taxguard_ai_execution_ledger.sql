-- AI-6: immutable correlated histories and recovery evidence. No redispatch or production activation.
BEGIN;
CREATE TABLE ai_execution_links (
 link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), decision_id uuid NOT NULL UNIQUE REFERENCES ai_governance_decisions(decision_id),
 root_id uuid NOT NULL, operation_id uuid NOT NULL, tenant_id varchar(128) NOT NULL, actor_uid varchar(128) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(root_id,tenant_id,actor_uid) REFERENCES ai_orchestration_roots(root_id,tenant_id,actor_uid)
);
CREATE TABLE ai_run_transitions (
 sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 transition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES ai_runs(run_id), tenant_id varchar(128) NOT NULL,
 previous_status ai_run_status, status ai_run_status NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ai_execution_recovery (
 recovery_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES ai_runs(run_id), tenant_id varchar(128) NOT NULL,
 actor_uid varchar(128) NOT NULL, lease_owner uuid NOT NULL, fence bigint NOT NULL CHECK(fence>0),
 status text NOT NULL CHECK(status IN ('CLAIMED','EXPIRED','REVIEW_REQUIRED','RELEASED')),
 expires_at timestamptz NOT NULL, reason_code text NOT NULL CHECK(reason_code ~ '^AI_[A-Z_]+$'),
 created_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(tenant_id,actor_uid) REFERENCES taxguard_members(tenant_id,uid),
 UNIQUE(run_id,fence,status), CHECK(expires_at>=created_at OR status='EXPIRED')
);
CREATE TABLE ai_usage_reconciliations (
 reconciliation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES ai_runs(run_id), tenant_id varchar(128) NOT NULL,
 actor_uid varchar(128) NOT NULL, attempt_id uuid NOT NULL REFERENCES ai_gateway_attempts(attempt_id),
 input_tokens integer NOT NULL CHECK(input_tokens>=0), output_tokens integer NOT NULL CHECK(output_tokens>=0),
 total_tokens integer NOT NULL CHECK(total_tokens=input_tokens+output_tokens), cost_nanos bigint NOT NULL CHECK(cost_nanos>=0),
 authority_reference text NOT NULL CHECK(length(btrim(authority_reference))>=10), evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id), FOREIGN KEY(tenant_id,actor_uid) REFERENCES taxguard_members(tenant_id,uid)
);
CREATE FUNCTION ai_validate_execution_record() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r ai_runs%ROWTYPE; d ai_governance_decisions%ROWTYPE; root ai_orchestration_roots%ROWTYPE; p ai_execution_recovery%ROWTYPE; a ai_gateway_admissions%ROWTYPE; price ai_model_pricing%ROWTYPE; previous ai_run_transitions%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='ai_execution_links' THEN
   SELECT * INTO d FROM ai_governance_decisions WHERE decision_id=NEW.decision_id;
   SELECT * INTO root FROM ai_orchestration_roots WHERE root_id=NEW.root_id;
   IF d.tenant_id IS DISTINCT FROM NEW.tenant_id OR d.actor_uid IS DISTINCT FROM NEW.actor_uid OR d.case_record_id IS DISTINCT FROM root.case_record_id OR
      d.outcome NOT IN ('ADVISORY_ALLOWED','REVIEW_REQUIRED') OR
      NOT EXISTS(SELECT 1 FROM ai_orchestration_events WHERE root_id=NEW.root_id AND operation_id=NEW.operation_id AND status='RUNNING' AND (agent_id=d.agent_id OR d.agent_id='A00')) THEN
     RAISE EXCEPTION 'invalid execution link';
   END IF;
 ELSE
   SELECT * INTO r FROM ai_runs WHERE run_id=NEW.run_id;
   IF r.run_id IS NULL OR r.tenant_id IS DISTINCT FROM NEW.tenant_id THEN RAISE EXCEPTION 'invalid execution scope'; END IF;
   IF TG_TABLE_NAME<>'ai_run_transitions' THEN
     IF NEW.actor_uid IS DISTINCT FROM r.requested_by THEN RAISE EXCEPTION 'invalid execution actor'; END IF;
   END IF;
   IF TG_TABLE_NAME='ai_run_transitions' THEN
     IF NEW.status IS DISTINCT FROM r.status THEN RAISE EXCEPTION 'invalid run transition projection'; END IF;
     SELECT * INTO previous FROM ai_run_transitions WHERE run_id=NEW.run_id ORDER BY sequence DESC LIMIT 1;
     IF (previous.transition_id IS NULL AND NEW.previous_status IS NOT NULL) OR (previous.transition_id IS NOT NULL AND (NEW.previous_status IS DISTINCT FROM previous.status OR NEW.status=previous.status)) THEN RAISE EXCEPTION 'invalid transition predecessor'; END IF;
   ELSIF TG_TABLE_NAME='ai_execution_recovery' THEN
     SELECT * INTO p FROM ai_execution_recovery WHERE run_id=NEW.run_id ORDER BY fence DESC,created_at DESC LIMIT 1;
     IF NEW.status='CLAIMED' THEN
       IF r.status NOT IN ('QUEUED','RUNNING','PROPOSED','VERIFYING','REVIEW_REQUIRED') OR (p.status='CLAIMED' AND p.expires_at>now()) OR NEW.fence<>coalesce(p.fence,0)+1 OR NEW.expires_at>now()+interval '5 minutes' THEN RAISE EXCEPTION 'invalid recovery claim'; END IF;
     ELSE
       IF p.status<>'CLAIMED' OR p.lease_owner IS DISTINCT FROM NEW.lease_owner OR p.fence IS DISTINCT FROM NEW.fence OR NEW.expires_at IS DISTINCT FROM p.expires_at OR (NEW.status='EXPIRED' AND p.expires_at>now()) OR (NEW.status<>'EXPIRED' AND p.expires_at<=now()) THEN RAISE EXCEPTION 'stale recovery fence'; END IF;
     END IF;
   ELSIF TG_TABLE_NAME='ai_usage_reconciliations' THEN
     SELECT * INTO a FROM ai_gateway_admissions WHERE run_id=NEW.run_id;
     SELECT * INTO price FROM ai_model_pricing WHERE pricing_id=a.pricing_id;
     IF NOT EXISTS(SELECT 1 FROM ai_gateway_outcomes WHERE run_id=NEW.run_id AND attempt_id=NEW.attempt_id AND terminal AND usage_state='UNKNOWN') OR
        NEW.cost_nanos IS DISTINCT FROM NEW.input_tokens::bigint*price.input_nanos_per_token+NEW.output_tokens::bigint*price.output_nanos_per_token THEN RAISE EXCEPTION 'invalid usage reconciliation'; END IF;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION ai_capture_run_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   IF NEW.status<>'QUEUED' THEN RAISE EXCEPTION 'new run must be queued'; END IF;
   INSERT INTO ai_run_transitions(run_id,tenant_id,status) VALUES(NEW.run_id,NEW.tenant_id,NEW.status);
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
   IF NOT ((OLD.status='QUEUED' AND NEW.status IN ('RUNNING','FAILED','CANCELLED')) OR
      (OLD.status='RUNNING' AND NEW.status IN ('PROPOSED','VERIFYING','REVIEW_REQUIRED','FAILED','CANCELLED')) OR
      (OLD.status='PROPOSED' AND NEW.status IN ('VERIFYING','REVIEW_REQUIRED','REJECTED','CANCELLED')) OR
      (OLD.status='VERIFYING' AND NEW.status IN ('REVIEW_REQUIRED','FAILED','REJECTED','CANCELLED')) OR
      (OLD.status='REVIEW_REQUIRED' AND NEW.status IN ('APPROVED','REJECTED','CANCELLED'))) THEN RAISE EXCEPTION 'invalid AI run transition'; END IF;
   IF NEW.status='APPROVED' AND NOT EXISTS(SELECT 1 FROM ai_human_reviews WHERE run_id=NEW.run_id AND decision='APPROVED' AND completed_at IS NOT NULL AND reviewer_user_id<>NEW.requested_by) THEN RAISE EXCEPTION 'human approval required'; END IF;
   INSERT INTO ai_run_transitions(run_id,tenant_id,previous_status,status) VALUES(NEW.run_id,NEW.tenant_id,OLD.status,NEW.status);
 END IF;
 RETURN NEW;
END $$;
-- Existing runs are snapshots, not invented intermediate transitions.
INSERT INTO ai_run_transitions(run_id,tenant_id,status,created_at) SELECT run_id,tenant_id,status,created_at FROM ai_runs;
CREATE TRIGGER ai_runs_capture_transition AFTER INSERT OR UPDATE ON ai_runs FOR EACH ROW EXECUTE FUNCTION ai_capture_run_transition();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['ai_execution_links','ai_run_transitions','ai_execution_recovery','ai_usage_reconciliations'] LOOP
   EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION ai_validate_execution_record()',t||'_validate',t);
   EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION ai_reject_history_mutation()',t||'_immutable',t);
   EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
CREATE INDEX ai_run_transition_history ON ai_run_transitions(tenant_id,run_id,created_at);
CREATE INDEX ai_recovery_pending ON ai_execution_recovery(tenant_id,run_id,fence DESC,created_at DESC);

-- A read model over original immutable records; no source history is replaced or rewritten.
CREATE VIEW ai_execution_history WITH(security_invoker=true) AS
 SELECT 'GOVERNANCE'::text AS source_type,d.decision_id AS source_id,d.tenant_id,d.actor_uid,d.case_record_id,coalesce(l.root_id,r.root_id,e.root_id) AS root_id,coalesce(l.operation_id,e.operation_id) AS operation_id,NULL::uuid AS run_id,d.outcome::text AS status,d.created_at
 FROM ai_governance_decisions d LEFT JOIN ai_execution_links l ON l.decision_id=d.decision_id
 LEFT JOIN ai_orchestration_roots r ON r.coordinator_decision_id=d.decision_id
 LEFT JOIN (SELECT decision_id,min(root_id::text)::uuid AS root_id,min(operation_id::text)::uuid AS operation_id FROM ai_orchestration_events WHERE decision_id IS NOT NULL AND operation_id IS NOT NULL GROUP BY decision_id HAVING count(DISTINCT(root_id,operation_id))=1) e ON e.decision_id=d.decision_id
 UNION ALL SELECT 'ROOT',r.root_id,r.tenant_id,r.actor_uid,r.case_record_id,r.root_id,NULL::uuid,NULL::uuid,'CREATED',r.created_at FROM ai_orchestration_roots r
 UNION ALL SELECT 'ORCHESTRATION',e.event_id,e.tenant_id,e.actor_uid,r.case_record_id,e.root_id,e.operation_id,NULL::uuid,e.status,e.created_at FROM ai_orchestration_events e JOIN ai_orchestration_roots r USING(root_id)
 UNION ALL SELECT 'GATEWAY_ADMISSION',g.run_id,g.tenant_id,g.actor_uid,r.case_record_id,g.root_id,g.operation_id,g.run_id,'ADMITTED',g.created_at FROM ai_gateway_admissions g JOIN ai_runs r USING(run_id)
 UNION ALL SELECT 'GATEWAY_ATTEMPT',e.attempt_id,e.tenant_id,e.actor_uid,r.case_record_id,g.root_id,g.operation_id,e.run_id,'ATTEMPT',e.created_at FROM ai_gateway_attempts e JOIN ai_gateway_admissions g USING(run_id) JOIN ai_runs r USING(run_id)
 UNION ALL SELECT 'GATEWAY_OUTCOME',e.outcome_id,g.tenant_id,g.actor_uid,r.case_record_id,g.root_id,g.operation_id,e.run_id,e.status,e.created_at FROM ai_gateway_outcomes e JOIN ai_gateway_admissions g USING(run_id) JOIN ai_runs r USING(run_id)
 UNION ALL SELECT 'CAPABILITY',e.event_id,e.tenant_id,e.actor_uid,a.case_record_id,a.root_id,a.operation_id,a.run_id,e.status,e.created_at FROM ai_capability_events e JOIN ai_capability_admissions a USING(invocation_id)
 UNION ALL SELECT 'RUN_EVIDENCE',e.evidence_id,e.tenant_id,r.requested_by,r.case_record_id,g.root_id,g.operation_id,e.run_id,'REFERENCED',e.timestamp FROM ai_run_evidence e JOIN ai_runs r USING(run_id) LEFT JOIN ai_gateway_admissions g USING(run_id)
 UNION ALL SELECT 'RUN_TRANSITION',e.transition_id,e.tenant_id,r.requested_by,r.case_record_id,g.root_id,g.operation_id,e.run_id,e.status::text,e.created_at FROM ai_run_transitions e JOIN ai_runs r USING(run_id) LEFT JOIN ai_gateway_admissions g USING(run_id)
 UNION ALL SELECT 'RECOVERY',e.recovery_id,e.tenant_id,e.actor_uid,r.case_record_id,g.root_id,g.operation_id,e.run_id,e.status,e.created_at FROM ai_execution_recovery e JOIN ai_runs r USING(run_id) LEFT JOIN ai_gateway_admissions g USING(run_id)
 UNION ALL SELECT 'USAGE_RECONCILIATION',e.reconciliation_id,e.tenant_id,e.actor_uid,r.case_record_id,g.root_id,g.operation_id,e.run_id,'KNOWN',e.created_at FROM ai_usage_reconciliations e JOIN ai_runs r USING(run_id) LEFT JOIN ai_gateway_admissions g USING(run_id);
REVOKE ALL ON ai_execution_history FROM PUBLIC,anon,authenticated;
CREATE VIEW ai_execution_correlated_history WITH(security_invoker=true) AS
 SELECT h.*,coalesce(d.decision_id,r.coordinator_decision_id,a.decision_id,o.decision_id,c.decision_id,g.decision_id,oe.decision_id) AS decision_id,
   coalesce(a.attempt_id,o.attempt_id) AS attempt_id,c.invocation_id
 FROM ai_execution_history h
 LEFT JOIN ai_governance_decisions d ON h.source_type='GOVERNANCE' AND d.decision_id=h.source_id
 LEFT JOIN ai_orchestration_roots r ON h.source_type='ROOT' AND r.root_id=h.source_id
 LEFT JOIN ai_orchestration_events oe ON h.source_type='ORCHESTRATION' AND oe.event_id=h.source_id
 LEFT JOIN ai_gateway_attempts a ON h.source_type='GATEWAY_ATTEMPT' AND a.attempt_id=h.source_id
 LEFT JOIN ai_gateway_outcomes o ON h.source_type='GATEWAY_OUTCOME' AND o.outcome_id=h.source_id
 LEFT JOIN ai_capability_events c ON h.source_type='CAPABILITY' AND c.event_id=h.source_id
 LEFT JOIN ai_gateway_admissions g ON h.source_type='GATEWAY_ADMISSION' AND g.run_id=h.source_id;
REVOKE ALL ON ai_execution_correlated_history FROM PUBLIC,anon,authenticated;
COMMIT;
