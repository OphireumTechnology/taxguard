"""Breaks Step 120's rules one at a time in a temporary copy and confirms the tests notice. Touches no real file, database or model."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
SOURCE = SCRIPTS / "evaluate_knowledge.py"
MUTATIONS = {
    "hash not compared": ('if _sha256_file(path) != document["sha256"]:', 'if False:'),
    "approval state not checked": ('if record["approval_status"] != "NOT_APPROVED" or document["review_status"] != "PENDING_REVIEW":', 'if False:'),
    "acquisition record not required": ('if not record:\n        return {"status": "FAIL", "code": "NOT_IN_ACQUISITION_RECORD"}', 'if not record:\n        return {"status": "PASS"}'),
    "injection not rechecked": ('("INJECTION_PATTERN", INJECTION), ', ''),
    "execute exception made broad": (r'execute\s+this(?!\s+(?:form|consent)\b)', r'execute\s+this(?!\s+\w)'),
    "execute pattern removed": (r'execute\s+this(?!\s+(?:form|consent)\b)|', ''),
    "scripts counted as links": ('ORDINARY_PDF_ACTIONS = frozenset({"/GoTo", "/URI"})', 'ORDINARY_PDF_ACTIONS = frozenset({"/GoTo", "/URI", "/JavaScript", "/JS", "/EmbeddedFile", "/OpenAction"})'),
    "incomplete scan counted as links": ('if found <= ORDINARY_PDF_ACTIONS and not incomplete:', 'if found <= ORDINARY_PDF_ACTIONS:'),
    "unreadable record ignored": ('other.append("UNREADABLE_RECORD")', 'pass'),
    "invisible characters ignored": (', ("INVISIBLE_CHARACTERS", INVISIBLE)', ''),
    "disagreement not reported": ('elif file_year and file_year != stated:', 'elif False:'),
    "suggestion written as fact": ('result.update(status="REVIEW", code="TAX_YEAR_UNKNOWN", suggestion_for_reviewer=file_year)', 'result.update(status="PASS", stated=file_year)'),
    "future tax year accepted": ('if stated != "UNKNOWN" and int(stated) > year:', 'if False:'),
    "old tax year accepted": ('if stated != "UNKNOWN" and int(stated) < year - 1:', 'if False:'),
    "future revision accepted": ('if (vyear, month) > (today.year, today.month):', 'if False:'),
    "missing metadata accepted": ('return {"status": "FAIL" if missing else "PASS",', 'return {"status": "PASS",'),
    "suspicious text not held": ('if reasons or checks["suspicious"]["status"] != "PASS":', 'if reasons:'),
    "integrity failure not held": ('for name in ("source_integrity", "metadata"):', 'for name in ():'),
    "ocr pages ignored": ('if completeness["ocr_pages"] or completeness["low_text_pages"]:\n        reasons', 'if False:\n        reasons'),
    "approval recommended": ('"NEEDS_CORRECTION_BEFORE_REVIEW" if reasons else "RECOMMEND_FOR_HUMAN_REVIEW"', '"NEEDS_CORRECTION_BEFORE_REVIEW" if reasons else "APPROVED"'),
    "no human review item": ('add(4, "DOCUMENT_REVIEW",', 'None and add(4, "DOCUMENT_REVIEW",'),
    "schema accepts approval label": ("recommendation TEXT NOT NULL CHECK(recommendation IN ('RECOMMEND_FOR_HUMAN_REVIEW','NEEDS_CORRECTION_BEFORE_REVIEW','HOLD'))", "recommendation TEXT NOT NULL"),
    "schema accepts approved flag": ("approved INTEGER NOT NULL DEFAULT 0 CHECK(approved = 0)", "approved INTEGER NOT NULL DEFAULT 0"),
    "queue can be approved": ("status TEXT NOT NULL CHECK(status = 'AWAITING_HUMAN_REVIEW')", "status TEXT NOT NULL"),
    "queue editable": ("CREATE TRIGGER IF NOT EXISTS queue_append_only BEFORE UPDATE ON review_queue BEGIN SELECT RAISE(ABORT, 'this database cannot change a queue item'); END;", ""),
    "queue deletable": ("CREATE TRIGGER IF NOT EXISTS queue_no_delete BEFORE DELETE ON review_queue BEGIN SELECT RAISE(ABORT, 'this database cannot change a queue item'); END;", ""),
    "pipeline opened writable": ('sqlite3.connect(f"file:{Path(path).as_posix()}?mode=ro", uri=True)', 'sqlite3.connect(path)'),
    "digest ignores chunks": ('for row in pipeline.execute("SELECT chunk_id, content_hash, review_status FROM chunks ORDER BY chunk_id"):', 'for row in []:'),
    "bad test items kept": ('if found else invalid.append(', 'if True else invalid.append('),
    "held chunks searchable": ('AND c.embedding_hold IS NULL WHERE', 'WHERE'),
    "right document counted as right passage": ('and evidence in normalize(rows[i]["text"]).lower()), None)', '), None)'),
    "consistency always passes": ('"PASS" if scores and lowest >= MIN_CONSISTENCY else "FAIL"', '"PASS"'),
    "stored shape not checked": ('if bad_shape:', 'if False:'),
    "same document compared": ('if other <= index or rows[index]["document_id"] == rows[other]["document_id"]:', 'if other <= index:'),
    "same facts reported": ('if a and b and a != b and len(found) < limit:', 'if a and b and len(found) < limit:'),
    "candidates unbounded": ('if a and b and a != b and len(found) < limit:', 'if a and b and a != b:'),
    "invented citations accepted": ('"correct": bool(cited) and not invented and not declined and supported is not False}', '"correct": bool(cited) and not declined and supported is not False}'),
    "wrong passage citation accepted": ('"correct": bool(cited) and not invented and not declined and supported is not False}', '"correct": bool(cited) and not invented and not declined}'),
    "uncited answer accepted": ('"correct": bool(cited) and not invented and not declined and supported is not False}', '"correct": not invented and not declined and supported is not False}'),
    "out of scope answer accepted": ('"correct": declined and not cited,', '"correct": True,'),
    "traces not counted": ('trace = bool(re.search(r"</?think", text, re.I))', 'trace = False'),
    "document text not delimited": ('<source>\\n{text}\\n</source>', '{text}'),
}
original = SOURCE.read_text(encoding="utf-8")
baseline = subprocess.run([sys.executable, "-m", "unittest", "tests/test_evaluate_knowledge.py"], cwd=HERE.parent, capture_output=True, text=True)
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
        for helper in ("verify_research_candidates.py", "acquire_verified_documents.py", "process_knowledge.py"):
            shutil.copy(SCRIPTS / helper, root / "scripts")
        shutil.copy(HERE.parent / "config/retrieval_evaluation_set.json", root / "config")
        (root / "scripts" / SOURCE.name).write_text(original.replace(old, new), encoding="utf-8")
        shutil.copy(HERE / "test_evaluate_knowledge.py", root / "tests")
        run = subprocess.run([sys.executable, "-m", "unittest", "tests/test_evaluate_knowledge.py"], cwd=root, capture_output=True, text=True)
    caught = run.returncode != 0
    print("caught  " if caught else "SURVIVED", name)
    if not caught:
        survived.append(name)
print(f"{len(MUTATIONS) - len(survived)}/{len(MUTATIONS)} caught")
sys.exit(1 if survived else 0)
