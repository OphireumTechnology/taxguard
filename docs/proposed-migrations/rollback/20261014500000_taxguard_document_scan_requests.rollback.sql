-- ROLLBACK for proposal 050 (document scan requests). REVIEW ONLY; development and rehearsal use.
-- Rehearsed on disposable local PostgreSQL by src/tests-db/backupRestore.db.test.ts. Never run against
-- a hosted project without an approved change record. Generated from the files it restores.

-- Documents keep their status: open requests stop being answerable and documents stay SCAN_PENDING.
DROP FUNCTION IF EXISTS public.taxguard_doc_scan_backlog(text);
DROP FUNCTION IF EXISTS public.taxguard_doc_scan_complete(text, uuid, text, text);
DROP FUNCTION IF EXISTS public.taxguard_doc_scan_request(text, text, text, integer, text, integer);
DROP TABLE IF EXISTS public.taxguard_doc_scan_requests;
