"""Exports knowledge-pipeline counts for the AI Command Center. Reads databases and reports read-only and writes only reports/knowledge_status_latest.json.

Counts, labels and identifiers only: no document text, URL, file path, hash or identity leaves this script. It approves nothing and changes no record.

  python knowledge_status_export.py --execute
"""
import argparse
import json
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import source_registry

AUTONOMOUS = Path(__file__).resolve().parents[1]
STATE = AUTONOMOUS / "state"
REPORTS = AUTONOMOUS / "reports"
OUTPUT = REPORTS / "knowledge_status_latest.json"
DEFECTS = ("BROKEN_WORDS", "WORDS_RUN_TOGETHER", "UNREADABLE_CHARACTERS")


def read_only(path):
    connection = sqlite3.connect(f"file:{Path(path).as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def read_report(directory, name):
    path = Path(directory) / name
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def _one(connection, sql, *args):
    return connection.execute(sql, args).fetchone()[0]


def _status_counts(connection, table, column):
    return {r[0]: r[1] for r in connection.execute(f"SELECT {column}, count(*) FROM {table} GROUP BY 1")}


def registry_section(registry, staged):
    coverage = source_registry.coverage(registry, staged)
    states = Counter(s["status"] for s in registry["sources"])
    return {"registered": len(registry["sources"]), "active": states["ACTIVE"], "proposed": states["PROPOSED"], "blocked": states["BLOCKED"], "named_total": len(coverage["named_documents"]),
            "named_staged": sum(1 for d in coverage["named_documents"] if d["staged"]), "named_missing": coverage["named_missing"], "categories_without_documents": coverage["categories_without_staged_documents"]}


def comparison_section(report):
    if not report:
        return None
    def side(method):
        recall = report["retrieval"]["heldout"][method]["recall"]
        answers = report["answers_on_heldout"][method]
        return {"document_recall_at_1": recall["document"]["1"], "document_recall_at_3": recall["document"]["3"], "document_recall_at_5": recall["document"]["5"], "passage_recall_at_1": recall["passage"]["1"], "passage_recall_at_3": recall["passage"]["3"], "passage_recall_at_5": recall["passage"]["5"],
                "cited_evidence_passage": answers["cited_the_passage_with_evidence"], "answered_without_evidence": answers["evidence_missing_and_answered_anyway"], "invented_citations": answers["invented_citations"], "correctly_refused": answers["correctly_refused"], "search_median_ms": report["retrieval"]["heldout"][method]["search_latency"]["median_ms"]}
    return {"outcome": report["decision"]["outcome"], "questions": report["retrieval"]["heldout"]["vector_only"]["recall"]["cases"], "refusal_items": report["answers_on_heldout"]["vector_only"]["refusal_items"], "baseline": side("vector_only"), "improved": side("hybrid"), "generated_utc": report["generated_utc"]}


def build_status(state_dir, reports_dir, registry, tasks_enabled, now):
    state_dir, reports_dir = Path(state_dir), Path(reports_dir)
    acquisition = read_only(state_dir / "acquisition.sqlite3")
    pipeline = read_only(state_dir / "knowledge_pipeline.sqlite3")
    evaluation = read_only(state_dir / "knowledge_evaluation.sqlite3")
    memory = read_only(state_dir / "ophir_semantic_memory.sqlite3")
    try:
        staged = [r[0] for r in pipeline.execute("SELECT source_id FROM documents")]
        run = evaluation.execute("SELECT run_id FROM runs ORDER BY run_id DESC LIMIT 1").fetchone()
        run_id = run[0] if run else None
        recommendations = {r[0]: r[1] for r in evaluation.execute("SELECT recommendation, count(*) FROM document_evaluations WHERE run_id=? GROUP BY 1", (run_id,))}
        checks = [json.loads(r[0]) for r in evaluation.execute("SELECT checks FROM document_evaluations WHERE run_id=?", (run_id,))]
        queue = _one(evaluation, "SELECT count(*) FROM review_queue WHERE run_id=? AND status='AWAITING_HUMAN_REVIEW'", run_id)
        staging = _status_counts(pipeline, "chunks", "review_status")
        production = _status_counts(memory, "knowledge_chunks", "approval_status")
        findings = {r[0]: r[1] for r in pipeline.execute("SELECT kind, count(*) FROM findings GROUP BY 1")}
        verification = read_report(reports_dir, "research_verification_latest.json") or {}
        tax_year = read_report(reports_dir, "tax_year_coverage_latest.json")
        return {"schema_version": 1, "generated_utc": now.isoformat(), "mode": "STAGING_ONLY",
                "sources": registry_section(registry, staged),
                "discovery": {"candidates_checked": verification.get("input_candidate_count", 0), "verified": len(verification.get("verified", [])), "rejected": len(verification.get("rejected", []))},
                "quarantine": {"documents": _one(acquisition, "SELECT count(*) FROM acquired_documents"), "approved": _one(acquisition, "SELECT count(*) FROM acquired_documents WHERE approval_status<>'NOT_APPROVED'")},
                "extraction": {"documents": len(staged), "pages": _one(pipeline, "SELECT count(*) FROM pages"), "findings": sum(findings.values()), "defect_findings": sum(findings.get(k, 0) for k in DEFECTS)},
                "chunks": {"total": _one(pipeline, "SELECT count(*) FROM chunks"), "held_from_embedding": _one(pipeline, "SELECT count(*) FROM chunks WHERE embedding_hold IS NOT NULL"), "embeddings": _one(pipeline, "SELECT count(*) FROM embeddings")},
                "review": {"queue_awaiting": queue, "staging": {"pending": staging.get("PENDING_REVIEW", 0), "approved": staging.get("APPROVED", 0), "rejected": staging.get("REJECTED", 0)},
                           "production": {"pending": production.get("PENDING_REVIEW", 0), "approved": production.get("APPROVED", 0), "rejected": production.get("REJECTED", 0), "superseded": production.get("SUPERSEDED", 0)}},
                "evaluation": {"run_id": run_id, "recommend_for_human_review": recommendations.get("RECOMMEND_FOR_HUMAN_REVIEW", 0), "needs_correction": recommendations.get("NEEDS_CORRECTION_BEFORE_REVIEW", 0), "hold": recommendations.get("HOLD", 0)},
                "comparison": comparison_section(read_report(reports_dir, "retrieval_comparison_latest.json")),
                "tax_year": ({"tax_year_editions": tax_year["summary"]["by_kind"].get("TAX_YEAR_EDITION", 0), "revision_editions": tax_year["summary"]["by_kind"].get("REVISION_EDITION", 0), "dated_publications": tax_year["summary"]["by_kind"].get("DATED_PUBLICATION", 0), "undated": tax_year["summary"]["by_kind"].get("UNDATED", 0), "conflicts": len(tax_year["conflicts"])} if tax_year else None),
                "warnings": {"integrity_failures": sum(1 for c in checks if c["source_integrity"]["status"] != "PASS"), "suspicious_documents": sum(1 for c in checks if c["suspicious"]["status"] != "PASS"), "active_content_documents": sum(1 for c in checks if c.get("active_content", {}).get("status") == "REVIEW")},
                "scheduler": {"tasks_enabled": tasks_enabled}}
    finally:
        for connection in (acquisition, pipeline, evaluation, memory):
            connection.close()


def main(argv=None):
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--execute", action="store_true")
    options = arguments.parse_args(argv)
    if not options.execute:
        print("Use --execute. Reads databases read-only and writes one status file.")
        return 0
    from process_knowledge import scheduled_task_states
    from verify_research_candidates import write_atomic
    enabled = sum(1 for state in scheduled_task_states().values() if state != "Disabled")
    status = build_status(STATE, REPORTS, source_registry.load(), enabled, datetime.now(timezone.utc))
    write_atomic(OUTPUT, status)
    print(json.dumps({"status": "PASS", "documents": status["extraction"]["documents"], "chunks": status["chunks"]["total"], "embeddings": status["chunks"]["embeddings"], "production": status["review"]["production"], "tasks_enabled": enabled}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
