BEGIN;
-- Extend metadata-only purpose vocabulary; no agent/permission activation or RLS change.
ALTER TABLE ai_orchestration_events DROP CONSTRAINT ai_orchestration_events_purpose_check;
ALTER TABLE ai_orchestration_events ADD CONSTRAINT ai_orchestration_events_purpose_check
 CHECK(purpose IN ('IDENTIFY_REVIEW_QUESTIONS','REVIEW_EVIDENCE_COMPLETENESS','DOCUMENT_DUPLICATE_CHECK'));
COMMIT;
