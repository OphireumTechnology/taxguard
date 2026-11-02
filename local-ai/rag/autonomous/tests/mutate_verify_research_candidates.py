"""Breaks the verifier's safety rules one at a time in a temporary copy and confirms the tests notice. Touches no real file."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / "scripts" / "verify_research_candidates.py"
MUTATIONS = {
    "any https host allowed": ('if not host or host.lower() not in SOURCES:', 'if not host:'),
    "http allowed": ('if parts.scheme.lower() != "https":', 'if False:'),
    "credentials allowed": ('if parts.username is not None or parts.password is not None:', 'if False:'),
    "encoded paths allowed": ('if "%" in path:', 'if False:'),
    "no canonical path check": ('if posixpath.normpath(path) != path or "//" in path:', 'if False:'),
    "no per-host document paths": ('if reason is None and not urllib.parse.urlsplit(url).path.startswith(', 'if False and not urllib.parse.urlsplit(url).path.startswith('),
    "no probe still eligible": ('reasons.append("PROBE_NOT_RUN")', 'pass'),
    "refused probe still eligible": ('reasons.append("PROBE_" + result_probe["outcome"])', 'pass'),
    "html still eligible": ('reasons.append("PROBE_CONTENT_TYPE_NOT_PDF")', 'pass'),
    "language variant ignored": ('reasons.append("LANGUAGE_VARIANT_NEEDS_DECISION")', 'pass'),
    "relevance ignored": ('reasons.append("RELEVANCE_NOT_ESTABLISHED")', 'pass'),
    "any discovery page accepted": ('any(source not in starts for source in group["discovered_from"])', 'False'),
    "authenticity overstated": ('"authenticity": "NOT_ESTABLISHED"', '"authenticity": "VERIFIED"'),
    "approval overstated": ('"approval_status": "NOT_APPROVED"', '"approval_status": "APPROVED"'),
    "tax year guessed": ('return {"tax_year": "UNKNOWN", "url_revision_year": int(match.group(1))', 'return {"tax_year": int(match.group(1)), "url_revision_year": int(match.group(1))'),
    "dns check skipped": ('return {"outcome": "DNS_REFUSED"}', 'pass'),
    "any head failure allowed": ('and (result_probe or {}).get("http_status") in (404, 405)', ''),
    "language exclusion ignored": ('if language and decisions.get("exclude_language_variants") is True:', 'if False:'),
    "state change not noticed": ('if report["protected_hashes_before"] != report["protected_hashes_after"]:', 'if False:'),
    "lost candidates not noticed": ('if report["input_candidate_count"] != sum(', 'if False and report["input_candidate_count"] != sum('),
}
original = SOURCE.read_text(encoding="utf-8")
baseline = subprocess.run([sys.executable, "-m", "unittest", "tests/test_verify_research_candidates.py"], cwd=HERE.parent, capture_output=True, text=True)
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
        (root / "scripts" / SOURCE.name).write_text(original.replace(old, new), encoding="utf-8")
        shutil.copy(HERE / "test_verify_research_candidates.py", root / "tests")
        run = subprocess.run([sys.executable, "-m", "unittest", "tests/test_verify_research_candidates.py"], cwd=root, capture_output=True, text=True)
    caught = run.returncode != 0
    print("caught  " if caught else "SURVIVED", name)
    if not caught:
        survived.append(name)
print(f"{len(MUTATIONS) - len(survived)}/{len(MUTATIONS)} caught")
sys.exit(1 if survived else 0)
