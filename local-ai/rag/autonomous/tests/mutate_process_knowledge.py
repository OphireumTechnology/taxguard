"""Breaks Step 119's safety rules one at a time in a temporary copy and confirms the tests notice. Touches no real file or model."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
SOURCE = SCRIPTS / "process_knowledge.py"
MUTATIONS = {
    "acquisition state ignored": ('if (row.get("validation_status"), row.get("authenticity"), row.get("approval_status")) != REQUIRED_REGISTRY_STATE:', 'if False:'),
    "owner exclusion ignored": ('if url in (decisions or {}).get("exclude", {}):', 'if False:'),
    "language exclusion ignored": ('if (decisions or {}).get("exclude_language_variants") is True and', 'if False and'),
    "path traversal allowed": ('if not name or name != os.path.basename(name) or "/" in name or "\\\\" in name or ".." in name or not name.lower().endswith(".pdf"):', 'if False:'),
    "hash not checked": ('if _sha256_file(path) != row.get("sha256"):', 'if False:'),
    "size not checked": ('if path.stat().st_size > int(policy["max_document_bytes"]):', 'if False:'),
    "page limit not checked": ('if details["pages"] > MAX_PAGES:', 'if False:'),
    "time limit ignored": ('raise Refused("EXTRACTION_TIME_LIMIT")', 'return {}'),
    "memory limit not applied": ('_limit_child_memory(process, memory)', 'pass'),
    "blocking actions ignored": ('if declared & set(BLOCKING_ACTIONS):', 'if False:'),
    "no-text accepted": ('if not with_text:', 'if False:'),
    "retries unbounded": ('if prior and (prior[1] or prior[0] >= MAX_DOCUMENT_ATTEMPTS):', 'if False:'),
    "reprocessing allowed": ('if connection.execute("SELECT 1 FROM documents WHERE sha256=?", (row["sha256"],)).fetchone():', 'if False:'),
    "injection not held": ('hold = "POSSIBLE_PROMPT_INJECTION" if INJECTION.search(original) else', 'hold ='),
    "injection not reported": ('add("POSSIBLE_PROMPT_INJECTION", match.group(0)[:120])', 'pass'),
    "removal not checked": ('if +expected != Counter(_tokens(cleaned)):', 'if False:'),
    "tax year read from the whole page": ('[l for l in lines if l and not PRODUCTION_LINE.match(l)][:TITLE_LINES]', '[l for l in lines if l and not PRODUCTION_LINE.match(l)]'),
    "stamps read as title": ('return " ".join([l for l in lines if l and not PRODUCTION_LINE.match(l)][:TITLE_LINES])', 'return " ".join(lines[:TITLE_LINES])'),
    "one-word headers removed": ('and len(line.split()) >= 2 and len(line) >= 12}', '}'),
    "blank pages flagged": ('and not BLANK_PAGE.search(text):', ':'),
    "citation read as revision": ('match = re.fullmatch(r"(\\d{1,2})-(20\\d{2})", value)', 'match = None'),
    "injection matches mid-sentence": ('(?:^|[.!?:]\\s+)you\\s+are\\s+now', 'you\\s+are\\s+now'),
    "conflict resolved by guessing": ('return distinct[0] if len(distinct) == 1 else None', 'return distinct[0] if distinct else None'),
    "dimensions not checked": ('if not isinstance(vector, list) or len(vector) != dimensions:', 'if not isinstance(vector, list):'),
    "nonfinite accepted": ('if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in vector):', 'if False:'),
    "zero vectors accepted": ('if not any(vector):', 'if False:'),
    "remote endpoint allowed": ('if parts.scheme != "http" or parts.hostname not in ("127.0.0.1", "localhost", "::1"):', 'if False:'),
    "duplicates embedded": (' AND NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.content_hash=c.content_hash AND e.embedding_model=? AND e.model_digest=? AND e.text_prefix=?)', ' AND ?||?||? IS NOT NULL'),
    "embedding retries unbounded": ('if failures >= EMBED_RETRIES:', 'if False:'),
    "chunks can be approved": ("cleaned_content TEXT, content_hash TEXT NOT NULL, classification TEXT NOT NULL, embedding_hold TEXT, review_status TEXT NOT NULL CHECK(review_status = 'PENDING_REVIEW')", "cleaned_content TEXT, content_hash TEXT NOT NULL, classification TEXT NOT NULL, embedding_hold TEXT, review_status TEXT NOT NULL"),
    "chunks editable": ("CREATE TRIGGER IF NOT EXISTS chunks_immutable BEFORE UPDATE ON chunks BEGIN SELECT RAISE(ABORT, 'chunks are immutable'); END;", ""),
    "chunks deletable": ("CREATE TRIGGER IF NOT EXISTS chunks_no_delete BEFORE DELETE ON chunks BEGIN SELECT RAISE(ABORT, 'chunks are immutable'); END;", ""),
    "audit editable": ("CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;", ""),
    "protected change not noticed": ('if snapshot != before["protected"]:', 'if False:'),
    "enabled task not noticed": ('if sorted(tasks) != sorted(GUARDED_TASKS) or any(v != "Disabled" for v in tasks.values()):', 'if False:'),
    "model change not noticed": ('if digests.get(name) != digest:', 'if False:'),
    "test run does not defer": ('if load["test_processes"] is None or load["test_processes"] > 0:', 'if False:'),
    "low gpu does not defer": ('if load["gpu_free_mib"] is None or load["gpu_free_mib"] < MIN_FREE_GPU_MIB:', 'if False:'),
}
original = SOURCE.read_text(encoding="utf-8")
baseline = subprocess.run([sys.executable, "-m", "unittest", "tests/test_process_knowledge.py"], cwd=HERE.parent, capture_output=True, text=True)
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
        for helper in ("verify_research_candidates.py", "acquire_verified_documents.py"):
            shutil.copy(SCRIPTS / helper, root / "scripts")
        (root / "scripts" / SOURCE.name).write_text(original.replace(old, new), encoding="utf-8")
        shutil.copy(HERE / "test_process_knowledge.py", root / "tests")
        run = subprocess.run([sys.executable, "-m", "unittest", "tests/test_process_knowledge.py"], cwd=root, capture_output=True, text=True)
    caught = run.returncode != 0
    print("caught  " if caught else "SURVIVED", name)
    if not caught:
        survived.append(name)
print(f"{len(MUTATIONS) - len(survived)}/{len(MUTATIONS)} caught")
sys.exit(1 if survived else 0)
