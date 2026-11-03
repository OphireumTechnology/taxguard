"""Breaks the SEC adapter's rules one at a time in a temporary copy and confirms the tests notice. Touches no real file and makes no request."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
SOURCE = SCRIPTS / "sec_source_adapter.py"
TEST = "tests/test_sec_source_adapter.py"
MUTATIONS = {
    "403 retried": ('if error.code == 403:', 'if False:'),
    "403 allows later calls": ('self.stopped = "ACCESS_DENIED_403"\n', 'pass\n'),
    "later calls not refused": ('if self.stopped:\n            raise SecAccessStop(self.stopped)\n        problems', 'problems'),
    "activation not checked": ('if problems:\n            raise SecAccessStop(problems[0])', 'if False:\n            raise SecAccessStop(problems[0])'),
    "enabled text accepted": ('if config.get("enabled") is not True:', 'if not config.get("enabled"):'),
    "organization not required": ('if not str(config.get("organization") or "").strip():', 'if False:'),
    "personal address accepted": ('if domain in PERSONAL_DOMAINS:', 'if False:'),
    "placeholder accepted": ('if domain.endswith(RESERVED_SUFFIXES) or any(domain == d or domain.endswith("." + d) for d in RESERVED_DOMAINS):', 'if False:'),
    "look-alike treated as a placeholder": ('any(domain == d or domain.endswith("." + d) for d in RESERVED_DOMAINS)', 'domain.endswith(RESERVED_DOMAINS)'),
    "contact not checked": ('problem = contact_problem(config.get("contact_email"))', 'problem = None'),
    "any text counts as a date": ('if not re.fullmatch(r"\\d{4}-\\d{2}-\\d{2}", str(config.get(field) or "")):', 'if not config.get(field):'),
    "owner activation skipped": (', ("owner_activation_on", "OWNER_HAS_NOT_ACTIVATED")', ''),
    "guidance check skipped": ('("guidance_verified_on", "OFFICIAL_GUIDANCE_NOT_VERIFIED"), ', ''),
    "registry ignored": ('if not source or source["status"] != "ACTIVE" or source["access"] != "OPEN_PUBLIC" or not source["document_paths"]:', 'if False:'),
    "registry path ignored": ('if not allowed or source != SOURCE_ID:', 'if False:'),
    "no wait between requests": ('if wait > 0:', 'if False:'),
    "budget ignored": ('if self.requests >= MAX_REQUESTS_PER_RUN:', 'if False:'),
    "contact not sent": ('return f"{self.config[\'organization\'].strip()} TaxGuardAI-Research {self.config[\'contact_email\'].strip()}"', 'return "Mozilla/5.0"'),
    "retry guidance ignored": ('self.sleep(int(retry_after))', 'pass'),
    "long retry accepted": ('or int(retry_after) > MAX_RETRY_AFTER_SECONDS ', ''),
    "missing retry guidance retried": ('if not retry_after.isdigit() or', 'if retry_after and not retry_after.isdigit() or'),
    "retries unbounded": ('or attempt == MAX_RETRIES:', 'or False:'),
    "size limit removed": ('if len(body) > MAX_BYTES:', 'if False:'),
    "marked approved": ('"approval_status": "NOT_APPROVED"', '"approval_status": "APPROVED"'),
    "not staged": ('"stage": "STAGING_QUARANTINE"', '"stage": "PRODUCTION"'),
}
original = SOURCE.read_text(encoding="utf-8")
baseline = subprocess.run([sys.executable, "-m", "unittest", TEST], cwd=HERE.parent, capture_output=True, text=True)
if baseline.returncode != 0:
    print("BASELINE FAILS: mutation results would mean nothing")
    print(baseline.stderr[-800:])
    sys.exit(2)
survived = []
for name, (old, new) in MUTATIONS.items():
    if original.count(old) < 1:
        print("NOT APPLICABLE", name)
        survived.append(name)
        continue
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        for folder in ("scripts", "tests", "config"):
            (root / folder).mkdir()
        shutil.copy(SCRIPTS / "source_registry.py", root / "scripts")
        for config in ("research_source_registry.json", "sec_source.example.json"):
            shutil.copy(HERE.parent / "config" / config, root / "config")
        (root / "scripts" / SOURCE.name).write_text(original.replace(old, new), encoding="utf-8")
        shutil.copy(HERE / "test_sec_source_adapter.py", root / "tests")
        run = subprocess.run([sys.executable, "-m", "unittest", TEST], cwd=root, capture_output=True, text=True)
    caught = run.returncode != 0
    print("caught  " if caught else "SURVIVED", name)
    if not caught:
        survived.append(name)
print(f"{len(MUTATIONS) - len(survived)}/{len(MUTATIONS)} caught")
sys.exit(1 if survived else 0)
