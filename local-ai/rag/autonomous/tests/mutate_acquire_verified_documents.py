"""Breaks the acquisition pipeline's safety rules one at a time in a temporary copy and confirms the tests notice."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
SOURCE = SCRIPTS / "acquire_verified_documents.py"
MUTATIONS = {
    "licensed hosts allowed": ('if parts.hostname not in ACQUISITION_HOSTS:', 'if False:'),
    "private dns allowed": ('if not address.is_global:', 'if False:'),
    "private peer allowed": ('if not ipaddress.ip_address(sock.getpeername()[0].split("%")[0]).is_global:', 'if False:'),
    "unverified tls allowed": ('if self._verified_context.verify_mode != ssl.CERT_REQUIRED or not self._verified_context.check_hostname:', 'if False:'),
    "unpinned connection": ('socket.create_connection((self._pinned_address, 443), self.timeout)', 'socket.create_connection((self.host, 443), self.timeout)'),
    "redirects not revalidated": ('current = authorized_url(urllib.parse.urljoin(current, location))', 'current = urllib.parse.urljoin(current, location)'),
    "unlimited redirects": ('if not location or hops > MAX_REDIRECTS:', 'if not location:'),
    "403 treated as temporary": ('raise Refused("ACCESS_REFUSED", status)', 'raise Temporary("ACCESS_REFUSED", status)'),
    "html accepted": ('if content_type != "application/pdf":', 'if False:'),
    "compressed accepted": ('if headers.get("content-encoding", "identity").strip().lower() != "identity":', 'if False:'),
    "no streamed size limit": ('if size > limit:', 'if False:'),
    "no declared size limit": ('if declared is not None and (not declared.isdigit() or int(declared) > limit):', 'if False:'),
    "truncation accepted": ('if declared is not None and int(declared) != size:', 'if False:'),
    "no time limit": ('if clock() > deadline:', 'if False:'),
    "no pdf signature check": ('if not data.startswith(b"%PDF-"):', 'if False:'),
    "no trailer check": ('if b"%%EOF" not in data[-4096:]:', 'if False:'),
    "encrypted accepted": ('if encrypted:\n        raise Refused("PDF_ENCRYPTED")', 'if False:\n        raise Refused("PDF_ENCRYPTED")'),
    "conflict overwritten": ('if _sha256_file(destination) != digest:\n                raise Refused("QUARANTINE_FILE_CONFLICT")', 'if False:\n                raise Refused("QUARANTINE_FILE_CONFLICT")'),
    "staging duplicates copied": ('if digest in staged.get(url, ()):', 'if False:'),
    "same hash stored again": ('if known:', 'if False:'),
    "no validators sent": ('conditional["If-None-Match"] = latest[1]', 'pass'),
    "registry allows approval": ("CHECK(approval_status = 'NOT_APPROVED')", ""),
    "registry allows authenticity": ("CHECK(authenticity = 'NOT_ESTABLISHED')", ""),
    "audit editable": ("CREATE TRIGGER IF NOT EXISTS acquisition_events_no_update BEFORE UPDATE ON acquisition_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;", ""),
    "audit deletable": ("CREATE TRIGGER IF NOT EXISTS acquisition_events_no_delete BEFORE DELETE ON acquisition_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;", ""),
    "non-eligible rows taken": ('if row.get("disposition") != "ELIGIBLE_FOR_ACQUISITION":', 'if False:'),
    "report urls trusted": ('items.append({**row, "url": authorized_url(row.get("url"))})', 'items.append({**row, "url": row.get("url")})'),
    "failing report accepted": ('if verification.get("status") != "PASS" or', 'if False or'),
    "overlapping runs": ('raise Refused("ANOTHER_RUN_ACTIVE")', 'handle = os.open(str(self.path) + ".x", os.O_CREAT | os.O_WRONLY)'),
    "live owner's lock taken over": ('if owner is not None and not process_alive(owner):', 'if owner is not None:'),
    "dead owner's lock blocks restart": ('if owner is not None and not process_alive(owner):', 'if False:'),
    "offline keeps going": ('if failures >= OFFLINE_AFTER_FAILURES:', 'if False:'),
    "state change not noticed": ('if report["protected_hashes_before"] != report["protected_hashes_after"]:', 'if False:'),
    "budget overflow refused": ('if error.code == "SIZE_LIMIT_EXCEEDED" and run_budget is not None and run_budget < limit:', 'if False:'),
}
original = SOURCE.read_text(encoding="utf-8")
baseline = subprocess.run([sys.executable, "-m", "unittest", "tests/test_acquire_verified_documents.py"], cwd=HERE.parent, capture_output=True, text=True)
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
        shutil.copy(SCRIPTS / "verify_research_candidates.py", root / "scripts")
        (root / "scripts" / SOURCE.name).write_text(original.replace(old, new), encoding="utf-8")
        shutil.copy(HERE / "test_acquire_verified_documents.py", root / "tests")
        run = subprocess.run([sys.executable, "-m", "unittest", "tests/test_acquire_verified_documents.py"], cwd=root, capture_output=True, text=True)
    caught = run.returncode != 0
    print("caught  " if caught else "SURVIVED", name)
    if not caught:
        survived.append(name)
print(f"{len(MUTATIONS) - len(survived)}/{len(MUTATIONS)} caught")
sys.exit(1 if survived else 0)
