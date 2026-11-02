"""Live Step 119 check against the real model: kill the embedding run outright, then resume it and run it again. Records the evidence.

  --after-kill  the run was already killed: skip the kill and test recovery from the state it left.
"""
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "state/knowledge_pipeline.sqlite3"
LOCK = ROOT / "state/knowledge_pipeline.lock"
COMMAND = [sys.executable, str(ROOT / "scripts/process_knowledge.py"), "--execute", "--stage", "embed"]
KILL_AT = 400


def counts():
    # Windows can hold a killed process's files for a moment, so a read right after a kill may briefly fail.
    for attempt in range(10):
        try:
            connection = sqlite3.connect(f"file:{DB.as_posix()}?mode=ro", uri=True)
            try:
                return {"embeddings": connection.execute("SELECT count(*) FROM embeddings").fetchone()[0], "integrity": connection.execute("PRAGMA integrity_check").fetchone()[0],
                        "committed_batches": connection.execute("SELECT count(*) FROM events WHERE outcome='BATCH_COMMITTED'").fetchone()[0], "held_or_failed": connection.execute("SELECT count(*) FROM events WHERE outcome='BATCH_FAILED'").fetchone()[0]}
            finally:
                connection.close()
        except sqlite3.OperationalError:
            if attempt == 9:
                raise
            time.sleep(1)


evidence = {}
if "--after-kill" in sys.argv:
    evidence["killed_in_an_earlier_process"] = True
else:
    evidence["before"] = counts()
    process = subprocess.Popen(COMMAND, stdout=subprocess.PIPE, text=True)
    deadline = time.time() + 300
    while time.time() < deadline and process.poll() is None and counts()["embeddings"] < KILL_AT:
        time.sleep(0.5)
    evidence["killed_while_running"] = process.poll() is None
    process.kill()
    process.communicate()
evidence["after_kill"] = counts()
evidence["lock_left_behind"] = LOCK.exists()
resumed = subprocess.run(COMMAND, capture_output=True, text=True)
evidence["resume_exit"], evidence["resume_output"] = resumed.returncode, resumed.stdout.strip()[-400:]
evidence["after_resume"] = counts()
again = subprocess.run(COMMAND, capture_output=True, text=True)
evidence["rerun_exit"], evidence["rerun_output"] = again.returncode, again.stdout.strip()[-400:]
evidence["after_rerun"] = counts()
evidence["no_new_work_on_rerun"] = evidence["after_rerun"]["embeddings"] == evidence["after_resume"]["embeddings"]
evidence["lock_after"] = LOCK.exists()
(ROOT / "reports/knowledge_interrupt_test_latest.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
print(json.dumps(evidence, indent=1))
