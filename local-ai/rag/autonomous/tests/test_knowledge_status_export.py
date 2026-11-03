import hashlib
import json
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import knowledge_status_export as k
import source_registry

NOW = datetime(2026, 11, 3, tzinfo=timezone.utc)
SECRET_TEXT = "SSN 123-45-6789 private document body"


def build(directory):
    state = Path(directory) / "state"
    reports = Path(directory) / "reports"
    state.mkdir()
    reports.mkdir()
    acquisition = sqlite3.connect(state / "acquisition.sqlite3")
    acquisition.executescript("CREATE TABLE acquired_documents(approval_status TEXT, file_name TEXT); INSERT INTO acquired_documents VALUES('NOT_APPROVED','/private/path/a.pdf'),('NOT_APPROVED','b.pdf');")
    acquisition.commit()
    acquisition.close()
    pipeline = sqlite3.connect(state / "knowledge_pipeline.sqlite3")
    pipeline.executescript(f"""CREATE TABLE documents(source_id TEXT); INSERT INTO documents VALUES('IRS_P1345'),('NIST_NIST_AI_100_1');
        CREATE TABLE pages(t TEXT); INSERT INTO pages VALUES('{SECRET_TEXT}'),('x'),('y');
        CREATE TABLE findings(kind TEXT); INSERT INTO findings VALUES('BROKEN_WORDS'),('WORDS_RUN_TOGETHER'),('UNCERTAIN_TABLE_EXTRACTION');
        CREATE TABLE chunks(review_status TEXT, embedding_hold TEXT, original_content TEXT); INSERT INTO chunks VALUES('PENDING_REVIEW',NULL,'{SECRET_TEXT}'),('PENDING_REVIEW','HOLD','z');
        CREATE TABLE embeddings(content_hash TEXT); INSERT INTO embeddings VALUES('h');""")
    pipeline.commit()
    pipeline.close()
    evaluation = sqlite3.connect(state / "knowledge_evaluation.sqlite3")
    evaluation.executescript("""CREATE TABLE runs(run_id TEXT); INSERT INTO runs VALUES('20261102T170315Z'),('20261103T025825Z');
        CREATE TABLE document_evaluations(run_id TEXT, recommendation TEXT, checks TEXT);
        CREATE TABLE review_queue(run_id TEXT, status TEXT); INSERT INTO review_queue VALUES('20261102T170315Z','AWAITING_HUMAN_REVIEW'),('20261103T025825Z','AWAITING_HUMAN_REVIEW'),('20261103T025825Z','AWAITING_HUMAN_REVIEW');""")
    checks = [{"source_integrity": {"status": "PASS"}, "suspicious": {"status": "REVIEW"}, "active_content": {"status": "REVIEW"}}, {"source_integrity": {"status": "FAIL"}, "suspicious": {"status": "PASS"}, "active_content": {"status": "PASS"}}]
    evaluation.executemany("INSERT INTO document_evaluations VALUES('20261103T025825Z',?,?)", [("HOLD", json.dumps(checks[0])), ("RECOMMEND_FOR_HUMAN_REVIEW", json.dumps(checks[1]))])
    evaluation.execute("INSERT INTO document_evaluations VALUES('20261102T170315Z','HOLD',?)", (json.dumps(checks[0]),))
    evaluation.commit()
    evaluation.close()
    memory = sqlite3.connect(state / "ophir_semantic_memory.sqlite3")
    memory.executescript("CREATE TABLE knowledge_chunks(approval_status TEXT); INSERT INTO knowledge_chunks VALUES('PENDING_REVIEW'),('PENDING_REVIEW'),('APPROVED'),('REJECTED');")
    memory.commit()
    memory.close()
    return state, reports


class Export(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.state, self.reports = build(self.directory.name)
        self.registry = source_registry.load()

    def tearDown(self):
        self.directory.cleanup()

    def status(self, enabled=0):
        return k.build_status(self.state, self.reports, self.registry, enabled, NOW)

    def test_counts_come_from_the_databases(self):
        out = self.status()
        self.assertEqual(out["quarantine"], {"documents": 2, "approved": 0})
        self.assertEqual(out["extraction"], {"documents": 2, "pages": 3, "findings": 3, "defect_findings": 2})
        self.assertEqual(out["chunks"], {"total": 2, "held_from_embedding": 1, "embeddings": 1})
        self.assertEqual(out["review"]["staging"], {"pending": 2, "approved": 0, "rejected": 0})
        self.assertEqual(out["review"]["production"], {"pending": 2, "approved": 1, "rejected": 1, "superseded": 0})

    def test_evaluation_uses_only_the_latest_run(self):
        out = self.status()
        self.assertEqual(out["evaluation"], {"run_id": "20261103T025825Z", "recommend_for_human_review": 1, "needs_correction": 0, "hold": 1})
        self.assertEqual(out["review"]["queue_awaiting"], 2)
        self.assertEqual(out["warnings"], {"integrity_failures": 1, "suspicious_documents": 1, "active_content_documents": 1})

    def test_an_enabled_task_is_reported_never_hidden(self):
        self.assertEqual(self.status(2)["scheduler"], {"tasks_enabled": 2})

    def test_absent_reports_are_null_not_zero(self):
        out = self.status()
        self.assertIsNone(out["comparison"])
        self.assertIsNone(out["tax_year"])

    def test_source_coverage_reports_gaps(self):
        out = self.status()["sources"]
        self.assertEqual((out["active"], out["approved_not_enabled"], out["proposed"]), (4, 3, 2))
        self.assertIn("IRS_P17", out["named_missing"])
        self.assertNotIn("IRS_P1345", out["named_missing"])

    def test_no_text_path_or_identity_can_leave(self):
        serialized = json.dumps(self.status())
        for forbidden in ("123-45-6789", "private", "/private/path", ".pdf", ".sqlite3", "D:\\\\", "https://"):
            self.assertNotIn(forbidden, serialized)

    def test_nothing_is_written_to_the_databases(self):
        path = self.state / "knowledge_pipeline.sqlite3"
        before = hashlib.sha256(path.read_bytes()).hexdigest()
        self.status()
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), before)

    def test_databases_open_read_only(self):
        connection = k.read_only(self.state / "knowledge_pipeline.sqlite3")
        with self.assertRaises(sqlite3.OperationalError):
            connection.execute("DELETE FROM documents")
        connection.close()

    def test_comparison_summary_keeps_both_sides_and_the_decision(self):
        side = {"recall": {"cases": 21, "document": {"1": 8, "3": 13, "5": 15}, "passage": {"1": 1, "3": 5, "5": 6}}, "search_latency": {"median_ms": 1.16}}
        answers = {"cited_the_passage_with_evidence": 9, "evidence_missing_and_answered_anyway": 8, "invented_citations": 0, "correctly_refused": 9, "refusal_items": 10}
        out = k.comparison_section({"generated_utc": "t", "decision": {"outcome": "RETAIN_BASELINE"}, "retrieval": {"heldout": {"vector_only": side, "hybrid": side}}, "answers_on_heldout": {"vector_only": answers, "hybrid": answers}})
        self.assertEqual((out["outcome"], out["questions"], out["baseline"]["passage_recall_at_5"], out["improved"]["correctly_refused"]), ("RETAIN_BASELINE", 21, 6, 9))


if __name__ == "__main__":
    unittest.main()
