"""OPHIR Step 120b: does hybrid retrieval improve on embeddings alone, measured fairly? Staging only; approves nothing.

The earlier question set has been seen, so it is reported as tuning data. The held-out set was written and hashed before any hybrid result existed, and is the
measure that counts. The parameters and the decision rule below are fixed before running and are not to be changed after seeing held-out results; a change means a new held-out set.
Reads the pipeline database read-only and writes only reports/retrieval_comparison_latest.json.

  python compare_retrieval.py --execute
"""
import argparse
import json
import math
import re
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from rank_bm25 import BM25Okapi

sys.path.insert(0, str(Path(__file__).resolve().parent))
from acquire_verified_documents import Refused
from evaluate_knowledge import PIPELINE, TOP_K, build_prompt, load_vectors, normalize, ollama_answer, ollama_embed, pipeline_digest, read_only, retrieval_metrics, score_answer, score_case, validate_cases
from process_knowledge import GUARDED_MODELS, assert_guards, competing_workload, model_digests, protected_snapshot, scheduled_task_states, workload_reason
from verify_research_candidates import write_atomic

AUTONOMOUS = Path(__file__).resolve().parents[1]
TUNING_SET = AUTONOMOUS / "config/retrieval_evaluation_set.json"
HELDOUT_SET = AUTONOMOUS / "config/retrieval_heldout_set.json"
FIRST_EVALUATION = AUTONOMOUS.parent / "backups/evaluation_v1/knowledge_evaluation_20261102T170315Z.json"
REPORT = AUTONOMOUS / "reports/retrieval_comparison_latest.json"

RRF_K = 60
CANDIDATES = 50
NAMED_DOCUMENT_BONUS = 0.02
ANSWER_PASSAGES = 4
METHODS = ("vector_only", "hybrid")
TOKEN = re.compile(r"[a-z0-9][a-z0-9.\-]*")
STOP = frozenset("a an and are as at be by can do does for from how i in is it of on or should so that the their to what when where which who with you your my me".split())
# A document the question names outright: "Form 941", "Schedule 3", "Publication 4557".
NAMED = re.compile(r"\b(form|schedule|publication|pub\.?)\s+([a-z]{0,2}-?\d[\w-]*|\d[\w-]*)", re.I)


def tokens(text):
    return [t.strip(".-") for t in TOKEN.findall((text or "").lower()) if t.strip(".-") and t.strip(".-") not in STOP]


class HybridIndex:
    def __init__(self, rows, matrix, titles):
        self.rows, self.matrix = rows, matrix
        self.titles = titles
        self.bm25 = BM25Okapi([tokens(r["text"]) for r in rows]) if rows else None

    def _named_documents(self, question):
        wanted = {normalize(m.group(2)).lower() for m in NAMED.finditer(question)}
        if not wanted:
            return set()
        hits = set()
        for document, title in self.titles.items():
            words = set(tokens(title))
            if wanted & words:
                hits.add(document)
        return hits

    def vector_only(self, query_vector, k=TOP_K):
        vector = np.asarray(query_vector, dtype=np.float32)
        scores = self.matrix @ (vector / np.linalg.norm(vector))
        order = np.argsort(-scores, kind="stable")[:k]
        return [(int(i), float(scores[i])) for i in order]

    def hybrid(self, question, query_vector, k=TOP_K):
        """Reciprocal rank fusion of embeddings and keywords, with a small fixed bonus for a document the question names."""
        vector = np.asarray(query_vector, dtype=np.float32)
        dense = self.matrix @ (vector / np.linalg.norm(vector))
        sparse = np.asarray(self.bm25.get_scores(tokens(question)))
        fused = {}
        for ranking in (np.argsort(-dense, kind="stable")[:CANDIDATES], np.argsort(-sparse, kind="stable")[:CANDIDATES]):
            for rank, index in enumerate(ranking, start=1):
                fused[int(index)] = fused.get(int(index), 0.0) + 1.0 / (RRF_K + rank)
        named = self._named_documents(question)
        if named:
            for index in fused:
                if self.rows[index]["document_id"] in named:
                    fused[index] += NAMED_DOCUMENT_BONUS
        order = sorted(fused, key=lambda i: (-fused[i], i))[:k]
        return [(i, round(fused[i], 6)) for i in order]

    def ranked(self, method, question, query_vector, k=TOP_K):
        return self.hybrid(question, query_vector, k) if method == "hybrid" else self.vector_only(query_vector, k)


def validate_refusals(items, pipeline):
    """A refusal item counts only if its answer really is absent, so a passable test cannot be mistaken for a refusal."""
    corpus = [normalize(r[0]).lower() for r in pipeline.execute("SELECT COALESCE(cleaned_text, original_text) FROM pages")]
    valid, invalid = [], []
    for item in items:
        found = [t for t in item["absent_terms"] if any(t.lower() in page for page in corpus)]
        (invalid.append({"id": item["id"], "reason": "TERM_PRESENT_IN_CORPUS", "terms": found}) if found else valid.append(item))
    return valid, invalid


def recall_counts(scored):
    """Hits at 1, 3 and 5 as plain counts, so a small set is not dressed up as a percentage."""
    return {"cases": len(scored), **{key: {str(k): sum(1 for s in scored if s[f"{key}_rank"] and s[f"{key}_rank"] <= k) for k in (1, 3, 5)} for key in ("document", "passage")}}


def latency_summary(values):
    return {"queries": len(values), "median_ms": round(statistics.median(values), 2), "max_ms": round(max(values), 2)} if values else None


def run_set(cases, index, source_of, vector_of, method):
    """Every method gets the same stored query vector, so the timing covers only the search itself."""
    scored, timings = [], []
    for case in cases:
        vector = vector_of(case["question"])
        started = time.perf_counter()
        ranked = index.ranked(method, case["question"], vector)
        timings.append((time.perf_counter() - started) * 1000)
        scored.append(score_case(case, ranked, index.rows, source_of))
    return {"recall": recall_counts(scored), "metrics": retrieval_metrics(scored), "search_latency": latency_summary(timings), "results": scored}


def sign_test(wins, losses):
    """Exact two-sided sign test. Reported as a number only; with this few questions a large p-value shows little either way."""
    total = wins + losses
    if not total:
        return None
    return round(min(1.0, 2 * sum(math.comb(total, i) for i in range(min(wins, losses) + 1)) / 2 ** total), 4)


def paired_changes(baseline, improved):
    """Question by question: a passage rank that moved, with a result not found ranked below every found one."""
    base = {s["id"]: s for s in baseline}
    worst = TOP_K + 1
    changes = []
    for item in improved:
        before = base[item["id"]]
        changes.append({"id": item["id"], "source": item["source"], "passage_rank": [before["passage_rank"], item["passage_rank"]], "document_rank": [before["document_rank"], item["document_rank"]],
                        "passage_change": (before["passage_rank"] or worst) - (item["passage_rank"] or worst), "document_change": (before["document_rank"] or worst) - (item["document_rank"] or worst)})
    better = [c["id"] for c in changes if c["passage_change"] > 0]
    worse = [c["id"] for c in changes if c["passage_change"] < 0]
    return {"questions": changes, "passage_improved": better, "passage_regressed": worse, "document_regressed": [c["id"] for c in changes if c["document_change"] < 0],
            "sign_test_on_passage_rank_p": sign_test(len(better), len(worse)), "note": "Small sample, one document set. Not evidence of statistical significance unless the p-value and the sample support it."}


def decide(retrieval, answers):
    """Fixed before results. Hybrid is kept only if the held-out set shows it finding more of the right passages and no safety or citation measure gets worse."""
    base, new = retrieval["vector_only"]["recall"], retrieval["hybrid"]["recall"]
    a, b = answers["vector_only"], answers["hybrid"]
    worse = [name for name, bad in (("document_recall_at_5", new["document"]["5"] < base["document"]["5"]), ("passage_recall_at_5", new["passage"]["5"] < base["passage"]["5"]),
                                    ("citations_of_the_evidence_passage", b["cited_the_passage_with_evidence"] < a["cited_the_passage_with_evidence"]), ("refusals", b["correctly_refused"] < a["correctly_refused"]),
                                    ("invented_citations", b["invented_citations"] > a["invented_citations"]), ("answered_without_evidence", b["evidence_missing_and_answered_anyway"] > a["evidence_missing_and_answered_anyway"]),
                                    ("reasoning_traces", b["reasoning_traces"] > a["reasoning_traces"])) if bad]
    better = [k for k in ("1", "5") if new["passage"][k] > base["passage"][k]]
    if worse:
        return {"outcome": "RETAIN_BASELINE", "reason": "A measure got worse", "worse": worse, "better": better}
    if not better:
        return {"outcome": "RETAIN_BASELINE", "reason": "No held-out improvement in finding the right passage", "worse": [], "better": []}
    return {"outcome": "HELD_OUT_IMPROVEMENT_CONFIRMED", "reason": "More passages found on the held-out set and no measure got worse", "worse": [], "better": better}


def run_answers(cases, refusals, index, embedder, answerer, method="hybrid"):
    answers, refused = [], []
    def passages_for(question):
        vector = embedder([question])[0]
        return [(index.rows[i]["page_number"], index.rows[i]["text"]) for i, _ in index.ranked(method, question, vector, ANSWER_PASSAGES)]
    for case in cases:
        passages = passages_for(case["question"])
        reply, reason = answerer(build_prompt(case["question"], passages))
        target = normalize(case["evidence"]).lower()
        retrieved = any(target in normalize(p).lower() for _, p in passages)
        answers.append({"id": case["id"], "finish": reason, "evidence_retrieved": retrieved, **score_answer(reply, passages, case["evidence"]), "reply": reply[:400]})
    for item in refusals:
        passages = passages_for(item["question"])
        reply, reason = answerer(build_prompt(item["question"], passages))
        refused.append({"id": item["id"], "question": item["question"], "finish": reason, **score_answer(reply, passages, out_of_scope=True), "reply": reply[:300]})
    with_evidence = [a for a in answers if a["evidence_retrieved"]]
    without = [a for a in answers if not a["evidence_retrieved"]]
    return {"answerable": len(answers), "evidence_was_retrieved": len(with_evidence), "cited_the_passage_with_evidence": sum(1 for a in with_evidence if a["cites_passage_with_evidence"]),
            "evidence_missing_and_declined": sum(1 for a in without if a["declined"]), "evidence_missing_and_answered_anyway": sum(1 for a in without if not a["declined"]), "invented_citations": sum(len(a["invented_citations"]) for a in answers),
            "refusal_items": len(refused), "correctly_refused": sum(1 for r in refused if r["correct"]), "reasoning_traces": sum(1 for x in answers + refused if x["trace"]), "answers": answers, "refusals": refused,
            "limit": "Mechanical checks of citations and refusals. None of this establishes that an answer is correct tax guidance."}


def matches_first_evaluation(baseline_metrics, first_report):
    """The baseline here must reproduce the locked first evaluation on the same questions, or the comparison is not against what it claims."""
    keys = ("document_hit_at_1", "document_hit_at_5", "passage_hit_at_1", "passage_hit_at_5")
    first = first_report["retrieval"]["metrics"]["overall"]
    return {"same": all(baseline_metrics[k] == first[k] for k in keys), "first_evaluation": {k: first[k] for k in keys}, "this_run": {k: baseline_metrics[k] for k in keys}}


def main(argv=None):
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--execute", action="store_true")
    options = arguments.parse_args(argv)
    if not options.execute:
        print("Use --execute. This embeds questions and runs the local model.")
        return 0
    load = competing_workload()
    if workload_reason(load):
        print(json.dumps({"status": "DEFERRED", "code": workload_reason(load), "workload": load}))
        return 3
    digests = model_digests()
    before = {"protected": protected_snapshot(), "models": {m: digests.get(m) for m in GUARDED_MODELS}}
    assert_guards(before, before["protected"], scheduled_task_states(), digests)
    pipeline = read_only(PIPELINE)
    try:
        digest = pipeline_digest(pipeline)
        rows, matrix = load_vectors(pipeline)
        source_of = {r["document_id"]: r["source_id"] for r in pipeline.execute("SELECT document_id, source_id FROM documents")}
        titles = {r["document_id"]: r["document_title"] + " " + r["source_id"].replace("_", " ") for r in pipeline.execute("SELECT document_id, document_title, source_id FROM documents")}
        tuning, heldout = json.loads(TUNING_SET.read_text(encoding="utf-8")), json.loads(HELDOUT_SET.read_text(encoding="utf-8"))
        tuning_cases, tuning_invalid = validate_cases(tuning["cases"], pipeline)
        held_cases, held_invalid = validate_cases(heldout["cases"], pipeline)
        refusals, refusal_invalid = validate_refusals(heldout["refusal"], pipeline)
        index = HybridIndex(rows, matrix, titles)
        vectors, embed_times = {}, []
        def vector_of(question):
            if question not in vectors:
                started = time.perf_counter()
                vectors[question] = ollama_embed([question])[0]
                embed_times.append((time.perf_counter() - started) * 1000)
            return vectors[question]
        results = {label: {method: run_set(cases, index, source_of, vector_of, method) for method in METHODS} for label, cases in (("tuning_seen_before", tuning_cases), ("heldout", held_cases))}
        answers = {method: run_answers(held_cases, refusals, index, lambda texts: [vector_of(t) for t in texts], ollama_answer, method) for method in METHODS}
        digest_after = pipeline_digest(pipeline)
    finally:
        pipeline.close()
    after = protected_snapshot()
    final_digests, final_tasks = model_digests(), scheduled_task_states()
    assert_guards(before, after, final_tasks, final_digests)
    if digest != digest_after:
        raise SystemExit(json.dumps({"status": "SAFETY_STOP", "code": "PIPELINE_CHANGED"}))
    paired = {label: paired_changes(sets["vector_only"]["results"], sets["hybrid"]["results"]) for label, sets in results.items()}
    decision = decide(results["heldout"], answers)
    reproduced = matches_first_evaluation(results["tuning_seen_before"]["vector_only"]["metrics"]["overall"], json.loads(FIRST_EVALUATION.read_text(encoding="utf-8")))
    report = {"step": "120b", "generated_utc": datetime.now(timezone.utc).isoformat(), "mode": "STAGING_ONLY", "parameters": {"rrf_k": RRF_K, "candidates": CANDIDATES, "named_document_bonus": NAMED_DOCUMENT_BONUS, "top_k": TOP_K, "answer_passages": ANSWER_PASSAGES},
              "invalid_items": {"tuning": tuning_invalid, "heldout": held_invalid, "refusal": refusal_invalid}, "baseline_reproduces_first_evaluation": reproduced, "retrieval": results, "paired": paired, "answers_on_heldout": answers, "decision": decision, "embedding_latency": latency_summary(embed_times),
              "evaluated_pipeline_digest": digest, "protected_unchanged": before["protected"] == after, "model_digests_unchanged": all(final_digests.get(m) == d for m, d in before["models"].items()), "scheduled_tasks": final_tasks, "knowledge_approval": False, "production_modified": False, "status": "PASS"}
    write_atomic(REPORT, report)
    print(json.dumps({"status": "PASS", "decision": decision, "baseline_reproduces_first_evaluation": reproduced["same"], "invalid": report["invalid_items"]}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Refused as error:
        print(json.dumps({"status": "REFUSED", "code": error.code}))
        sys.exit(2)
