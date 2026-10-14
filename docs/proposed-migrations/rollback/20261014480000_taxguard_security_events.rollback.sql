-- ROLLBACK for proposal 048 (durable security events). REVIEW ONLY; development and rehearsal use.
-- Rehearsed on disposable local PostgreSQL by src/tests-db/backupRestore.db.test.ts. Never run against
-- a hosted project without an approved change record. Generated from the files it restores.

-- Restore the 041 audit-center redaction. Recorded SECURITY_* audit rows are kept (append-only).
CREATE OR REPLACE FUNCTION public.taxguard_audit_center_redact(p_meta jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $$
  WITH kv AS (SELECT key, value FROM jsonb_each(CASE WHEN jsonb_typeof(p_meta) = 'object' THEN p_meta ELSE '{}'::jsonb END)),
  kept AS (SELECT key, value FROM kv WHERE key IN ('clientId','caseId','engagementId','appointmentId','threadId','messageId','requestId','jobId','documentId',
      'invoiceId','ruleSetId','sourceId','testId','uid','targetUid','sessionId','status','visibility','category','version','taxYear','stage','action','decision',
      'removedFactors','revokedSessions')
    AND ((jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[A-Za-z0-9_.:-]{1,128}$') OR jsonb_typeof(value) IN ('number','boolean')))
  SELECT jsonb_build_object('fields', COALESCE((SELECT jsonb_object_agg(key, value) FROM kept), '{}'::jsonb),
    'redactedFields', (SELECT count(*) FROM kv) - (SELECT count(*) FROM kept)) $$;

DROP FUNCTION IF EXISTS public.taxguard_security_event_summary(text, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.taxguard_security_event_record(text, text, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.taxguard_security_event_detail(jsonb);
DROP TABLE IF EXISTS public.taxguard_security_event_windows;
-- The server sink then records nothing (RPC failures are counted, requests are unaffected).
