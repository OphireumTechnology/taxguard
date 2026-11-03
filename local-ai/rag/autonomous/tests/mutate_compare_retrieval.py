"""Breaks Step 120b's rules one at a time in a temporary copy and confirms the tests notice. Touches no real file, database or model."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
SOURCE = SCRIPTS / "compare_retrieval.py"
MUTATIONS = {
    "keywords ignored": ('np.argsort(-sparse, kind="stable")[:CANDIDATES]', 'np.argsort(-dense, kind="stable")[:0]'),
    "embeddings ignored": ('np.argsort(-dense, kind="stable")[:CANDIDATES], ', ''),
    "named document bonus dropped": ('fused[index] += NAMED_DOCUMENT_BONUS', 'pass'),
    "any named document matches": ('if wanted & words:', 'if True:'),
    "result count unbounded": ('order = sorted(fused, key=lambda i: (-fused[i], i))[:k]', 'order = sorted(fused, key=lambda i: (-fused[i], i))'),
    "refusal items never checked": ('(invalid.append({"id": item["id"], "reason": "TERM_PRESENT_IN_CORPUS", "terms": found}) if found else valid.append(item))', 'valid.append(item)'),
    "stop words kept": ('and t.strip(".-") not in STOP]', ']'),
    "answer anyway counted as declined": ('"evidence_missing_and_answered_anyway": sum(1 for a in without if not a["declined"])', '"evidence_missing_and_answered_anyway": 0'),
    "wrong citation counted": ('sum(1 for a in with_evidence if a["cites_passage_with_evidence"])', 'sum(1 for a in with_evidence if a["cited"])'),
    "invented citations hidden": ('"invented_citations": sum(len(a["invented_citations"]) for a in answers)', '"invented_citations": 0'),
    "refusal always correct": ('"correctly_refused": sum(1 for r in refused if r["correct"])', '"correctly_refused": len(refused)'),
    "traces hidden": ('"reasoning_traces": sum(1 for x in answers + refused if x["trace"])', '"reasoning_traces": 0'),
    "limit removed": ('None of this establishes that an answer is correct tax guidance.', ''),
    "methods not separated": ('return self.hybrid(question, query_vector, k) if method == "hybrid" else self.vector_only(query_vector, k)', 'return self.hybrid(question, query_vector, k)'),
    "regression recorded as improvement": ('worse = [c["id"] for c in changes if c["passage_change"] < 0]', 'worse = []'),
    "missing passage counted as found": ('(item["passage_rank"] or worst)', '(item["passage_rank"] or 0)'),
    "recall at three wrong": ('for k in (1, 3, 5)} for key', 'for k in (1, 5, 5)} for key'),
    "retrieval gain overrides safety": ('if worse:\n        return', 'if worse and not better:\n        return'),
    "no improvement still confirmed": ('if not better:\n        return', 'if False:\n        return'),
    "refusal loss ignored": ('("refusals", b["correctly_refused"] < a["correctly_refused"]),', ''),
    "citation loss ignored": ('("citations_of_the_evidence_passage", b["cited_the_passage_with_evidence"] < a["cited_the_passage_with_evidence"]), ', ''),
    "invented citations ignored in decision": ('("invented_citations", b["invented_citations"] > a["invented_citations"]), ', ''),
    "recall loss ignored": ('("passage_recall_at_5", new["passage"]["5"] < base["passage"]["5"])', '("passage_recall_at_5", False)'),
    "baseline reproduction always true": ('return {"same": all(baseline_metrics[k] == first[k] for k in keys),', 'return {"same": True,'),
    "sign test inexact": ('2 * sum(math.comb(total, i) for i in range(min(wins, losses) + 1)) / 2 ** total', '0.5'),
}
original = SOURCE.read_text(encoding="utf-8")
baseline = subprocess.run([sys.executable, "-m", "unittest", "tests/test_compare_retrieval.py"], cwd=HERE.parent, capture_output=True, text=True)
if baseline.returncode != 0:
    print("BASELINE FAILS: mutation results would mean nothing")
    sys.exit(2)
survived = []
for name, (old, new) in MUTATIONS.items():
    if original.count(old) < 1:
        print("NOT APPLICABLE", name)
        survived.append(name)
        continue
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        (root / "scripts").mkdir()
        (root / "tests").mkdir()
        (root / "config").mkdir()
        for helper in ("verify_research_candidates.py", "acquire_verified_documents.py", "process_knowledge.py", "evaluate_knowledge.py"):
            shutil.copy(SCRIPTS / helper, root / "scripts")
        for config in ("retrieval_evaluation_set.json", "retrieval_heldout_set.json"):
            shutil.copy(HERE.parent / "config" / config, root / "config")
        (root / "scripts" / SOURCE.name).write_text(original.replace(old, new), encoding="utf-8")
        shutil.copy(HERE / "test_compare_retrieval.py", root / "tests")
        run = subprocess.run([sys.executable, "-m", "unittest", "tests/test_compare_retrieval.py"], cwd=root, capture_output=True, text=True)
    caught = run.returncode != 0
    print("caught  " if caught else "SURVIVED", name)
    if not caught:
        survived.append(name)
print(f"{len(MUTATIONS) - len(survived)}/{len(MUTATIONS)} caught")
sys.exit(1 if survived else 0)
