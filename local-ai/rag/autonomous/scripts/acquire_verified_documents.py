"""OPHIR Step 118: controlled acquisition of verified documents into quarantine.

Fetches only documents Step 117 marked ELIGIBLE_FOR_ACQUISITION. Everything fetched is untrusted data: it is stored, hashed and
recorded, never opened as instructions, and never approved here. The registry cannot hold an approved document, and this script
writes to no knowledge, staging, extraction or embedding database.

  python acquire_verified_documents.py             plan only; no network and no writes
  python acquire_verified_documents.py --execute   fetch into quarantine
"""
import argparse
import ctypes
import hashlib
import http.client
import io
import ipaddress
import json
import os
import re
import socket
import sqlite3
import ssl
import sys
import tempfile
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from verify_research_candidates import PROTECTED, SOURCES, normalize_url, write_atomic

AUTONOMOUS = Path(__file__).resolve().parents[1]
VERIFICATION = AUTONOMOUS / "reports/research_verification_latest.json"
REPORT = AUTONOMOUS / "reports/acquisition_latest.json"
POLICY = AUTONOMOUS / "config/policy.json"
STATE = AUTONOMOUS / "state"
REGISTRY = STATE / "acquisition.sqlite3"
LOCK = STATE / "acquisition.lock"
QUARANTINE = AUTONOMOUS.parent / "online/quarantine"

# Narrower than verification: public-domain U.S. government PDF hosts only. FASB content is licensed and is never fetched here.
ACQUISITION_HOSTS = frozenset({"www.irs.gov", "nvlpubs.nist.gov"})
TEMP_PREFIX = ".ophir_acq_"
MAX_REDIRECTS = 2
PER_DOCUMENT_SECONDS = 180
REQUEST_TIMEOUT = 45
PAUSE_SECONDS = 2.0
OFFLINE_AFTER_FAILURES = 3
STALE_LOCK_SECONDS = 2 * 3600
USER_AGENT = "OPHIR-Research-Acquisition/1.0"
ACTIVE_CONTENT = (b"/JavaScript", b"/JS", b"/Launch", b"/EmbeddedFile", b"/OpenAction", b"/AA", b"/SubmitForm", b"/ImportData", b"/RichMedia", b"/XFA")


class Refused(Exception):
    """A rule stopped the document. `code` is safe to record; retrying the same run would not help."""
    def __init__(self, code, detail=None):
        super().__init__(code)
        self.code, self.detail = code, detail


class Temporary(Refused):
    """The source or network failed; a later run may succeed."""


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def authorized_url(raw):
    url, reason = normalize_url(raw)
    if reason:
        raise Refused(reason)
    parts = urllib.parse.urlsplit(url)
    if parts.hostname not in ACQUISITION_HOSTS:
        raise Refused("HOST_NOT_AUTHORIZED_FOR_ACQUISITION")
    if not parts.path.lower().endswith(".pdf") or not parts.path.startswith(SOURCES[parts.hostname]["document_paths"]):
        raise Refused("PATH_NOT_AUTHORIZED_FOR_HOST")
    return url


def public_addresses(host, port=443, getaddrinfo=socket.getaddrinfo):
    """Every address must be public: one private answer means the name cannot be trusted."""
    try:
        answers = getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except OSError as error:
        raise Temporary("DNS_UNAVAILABLE", type(error).__name__)
    addresses = []
    for answer in answers:
        address = ipaddress.ip_address(answer[4][0].split("%")[0])
        if not address.is_global:
            raise Refused("NON_PUBLIC_ADDRESS")
        if str(address) not in addresses:
            addresses.append(str(address))
    if not addresses:
        raise Temporary("DNS_UNAVAILABLE", "no addresses")
    return addresses


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    """Connects to the address already checked, so a second DNS answer cannot redirect it (DNS rebinding). The certificate is
    still verified against the host name, and the connected peer is checked again."""
    def __init__(self, host, address, timeout, context=None):
        self._pinned_address = address
        self._verified_context = context or ssl.create_default_context()
        if self._verified_context.verify_mode != ssl.CERT_REQUIRED or not self._verified_context.check_hostname:
            raise Refused("CERTIFICATE_VERIFICATION_REQUIRED")
        super().__init__(host, 443, timeout=timeout, context=self._verified_context)

    def connect(self):
        sock = socket.create_connection((self._pinned_address, 443), self.timeout)
        try:
            if not ipaddress.ip_address(sock.getpeername()[0].split("%")[0]).is_global:
                raise Refused("NON_PUBLIC_ADDRESS")
            self.sock = self._verified_context.wrap_socket(sock, server_hostname=self.host)
        except BaseException:
            sock.close()
            raise


def open_request(url, headers, resolve=public_addresses, connection_class=PinnedHTTPSConnection):
    """One GET, no redirect handling here. Returns (status, headers, read(n), close())."""
    parts = urllib.parse.urlsplit(url)
    address = resolve(parts.hostname)[0]
    connection = connection_class(parts.hostname, address, REQUEST_TIMEOUT)
    try:
        connection.request("GET", parts.path, headers={"User-Agent": USER_AGENT, "Accept": "application/pdf", "Accept-Encoding": "identity", "Connection": "close", **headers})
        response = connection.getresponse()
    except ssl.SSLCertVerificationError as error:
        connection.close()
        raise Refused("CERTIFICATE_INVALID", type(error).__name__)
    except (OSError, http.client.HTTPException) as error:
        connection.close()
        raise Temporary("CONNECTION_FAILED", type(error).__name__)
    return response.status, {k.lower(): v for k, v in response.getheaders()}, response.read, connection.close


def fetch_to_temp(url, directory, limit, conditional=None, opener=open_request, clock=time.monotonic):
    """Streams one document to a temporary file. Returns a result dict; the caller owns the temporary file."""
    deadline = clock() + PER_DOCUMENT_SECONDS
    current, hops = url, 0
    while True:
        status, headers, read, close = opener(current, conditional or {})
        try:
            if status in (301, 302, 303, 307, 308):
                hops += 1
                location = headers.get("location")
                if not location or hops > MAX_REDIRECTS:
                    raise Refused("REDIRECT_LIMIT" if location else "REDIRECT_WITHOUT_LOCATION")
                current = authorized_url(urllib.parse.urljoin(current, location))
                continue
            if status == 304:
                return {"not_modified": True, "final_url": current}
            if status in (401, 403, 407, 451):
                raise Refused("ACCESS_REFUSED", status)
            if status == 429 or status >= 500:
                raise Temporary("SOURCE_TEMPORARILY_UNAVAILABLE", status)
            if status != 200:
                raise Refused("HTTP_STATUS", status)
            content_type = headers.get("content-type", "").split(";")[0].strip().lower()
            if content_type != "application/pdf":
                raise Refused("CONTENT_TYPE_NOT_PDF", content_type[:80])
            if headers.get("content-encoding", "identity").strip().lower() != "identity":
                raise Refused("CONTENT_ENCODING_NOT_ALLOWED")
            declared = headers.get("content-length")
            if declared is not None and (not declared.isdigit() or int(declared) > limit):
                raise Refused("SIZE_LIMIT_EXCEEDED", declared[:20])
            digest, size = hashlib.sha256(), 0
            handle, temporary = tempfile.mkstemp(dir=directory, prefix=TEMP_PREFIX, suffix=".tmp")
            try:
                with os.fdopen(handle, "wb") as stream:
                    while True:
                        if clock() > deadline:
                            raise Temporary("DOWNLOAD_TIME_LIMIT")
                        try:
                            block = read(64 * 1024)
                        except (OSError, http.client.HTTPException) as error:
                            raise Temporary("CONNECTION_FAILED", type(error).__name__)
                        if not block:
                            break
                        size += len(block)
                        if size > limit:
                            raise Refused("SIZE_LIMIT_EXCEEDED", size)
                        digest.update(block)
                        stream.write(block)
                    stream.flush()
                    os.fsync(stream.fileno())
                if declared is not None and int(declared) != size:
                    raise Temporary("TRUNCATED_DOWNLOAD", size)
            except BaseException:
                if os.path.exists(temporary):
                    os.unlink(temporary)
                raise
            return {"not_modified": False, "final_url": current, "temporary": temporary, "sha256": digest.hexdigest(), "bytes": size,
                    "last_modified": headers.get("last-modified"), "etag": headers.get("etag")}
        finally:
            close()


def inspect_pdf(path, reader_class=None):
    """Structural checks only. The document is never rendered and nothing in it is followed or run."""
    with open(path, "rb") as stream:
        data = stream.read()
    if not data.startswith(b"%PDF-"):
        raise Refused("PDF_SIGNATURE_INVALID")
    if b"%%EOF" not in data[-4096:]:
        raise Refused("PDF_TRAILER_MISSING")
    if reader_class is None:
        from pypdf import PdfReader as reader_class
    try:
        reader = reader_class(io.BytesIO(data), strict=False)
        encrypted = reader.is_encrypted
        pages = len(reader.pages) if not encrypted else None
    except Exception as error:
        raise Refused("PDF_UNREADABLE", type(error).__name__)
    if encrypted:
        raise Refused("PDF_ENCRYPTED")
    if not pages:
        raise Refused("PDF_HAS_NO_PAGES")
    markers = sorted({m.decode() for m in ACTIVE_CONTENT if re.search(re.escape(m) + rb"(?![A-Za-z0-9])", data)})
    return {"pages": pages, "pdf_version": data[5:8].decode("ascii", "replace"), "active_content_markers": markers}


SCHEMA = """
CREATE TABLE IF NOT EXISTS acquired_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL, original_url TEXT NOT NULL, final_url TEXT NOT NULL, source_organization TEXT NOT NULL, document_title TEXT NOT NULL,
  research_categories TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256) = 64), file_name TEXT NOT NULL, bytes INTEGER NOT NULL CHECK(bytes > 0),
  pages INTEGER NOT NULL, pdf_version TEXT NOT NULL, active_content_markers TEXT NOT NULL, retrieved_utc TEXT NOT NULL, server_last_modified TEXT, server_etag TEXT,
  publication_date TEXT NOT NULL DEFAULT 'UNKNOWN', effective_date TEXT NOT NULL DEFAULT 'UNKNOWN', tax_year TEXT NOT NULL DEFAULT 'UNKNOWN',
  validation_status TEXT NOT NULL CHECK(validation_status = 'QUARANTINED_STRUCTURE_CHECKED'),
  authenticity TEXT NOT NULL CHECK(authenticity = 'NOT_ESTABLISHED'),
  approval_status TEXT NOT NULL CHECK(approval_status = 'NOT_APPROVED'),
  UNIQUE(original_url, sha256)
);
CREATE TABLE IF NOT EXISTS acquisition_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, at_utc TEXT NOT NULL, original_url TEXT NOT NULL, outcome TEXT NOT NULL, code TEXT, detail TEXT, sha256 TEXT, bytes INTEGER
);
CREATE TRIGGER IF NOT EXISTS acquisition_events_no_update BEFORE UPDATE ON acquisition_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS acquisition_events_no_delete BEFORE DELETE ON acquisition_events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
"""


def open_registry(path=REGISTRY):
    connection = sqlite3.connect(path)
    connection.executescript(SCHEMA)
    connection.commit()
    return connection


def source_id_for(url):
    stem = urllib.parse.urlsplit(url).path.rsplit("/", 1)[-1][:-4]
    prefix = "IRS" if urllib.parse.urlsplit(url).hostname == "www.irs.gov" else "NIST"
    return prefix + "_" + re.sub(r"[^A-Z0-9]+", "_", stem.upper()).strip("_")


def _sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def process_alive(pid):
    """True if the process exists. If that cannot be determined, assume it does, so two runs never overlap by mistake."""
    if not isinstance(pid, int) or pid <= 0:
        return False
    if os.name != "nt":
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return False
        except OSError:
            return True
        return True
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.GetExitCodeProcess.argtypes = (ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong))
    kernel.CloseHandle.argtypes = (ctypes.c_void_p,)
    handle = kernel.OpenProcess(0x1000, False, pid)  # query limited information
    if not handle:
        return ctypes.get_last_error() != 87  # 87: no such process
    try:
        code = ctypes.c_ulong()
        return not kernel.GetExitCodeProcess(handle, ctypes.byref(code)) or code.value == 259  # 259: still active
    finally:
        kernel.CloseHandle(handle)


class RunLock:
    def __init__(self, path=LOCK, stale_after=STALE_LOCK_SECONDS):
        self.path, self.stale_after, self.held = Path(path), stale_after, False

    def _abandoned(self):
        """A run killed outright leaves its lock behind. It may be taken over only if its owner has gone, or it has expired."""
        try:
            owner = json.loads(self.path.read_text()).get("pid")
        except (OSError, ValueError):
            owner = None
        if owner is not None and not process_alive(owner):
            return True
        return time.time() - self.path.stat().st_mtime > self.stale_after

    def __enter__(self):
        if self.path.exists() and self._abandoned():
            self.path.unlink()
        try:
            handle = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            raise Refused("ANOTHER_RUN_ACTIVE")
        with os.fdopen(handle, "w") as stream:
            stream.write(json.dumps({"pid": os.getpid(), "started_utc": utc_now()}))
        self.held = True
        return self

    def __exit__(self, *_):
        if self.held and self.path.exists():
            self.path.unlink()


def plan(verification):
    """Only eligible rows of a passing Step 117 report, each rechecked here rather than trusted."""
    if verification.get("status") != "PASS" or verification.get("step") != 117 or verification.get("knowledge_approval") is not False:
        raise Refused("VERIFICATION_REPORT_NOT_PASSING")
    items = []
    for row in verification.get("verified", []):
        if row.get("disposition") != "ELIGIBLE_FOR_ACQUISITION":
            continue
        items.append({**row, "url": authorized_url(row.get("url"))})
    return items


def staged_hashes(state=STATE):
    """url -> hashes already held by the existing staging pipeline. Read-only."""
    path = Path(state) / "learning_staging.sqlite3"
    if not path.exists():
        return {}
    connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        found = {}
        for url, digest in connection.execute("SELECT source_url, sha256 FROM discovered_documents"):
            found.setdefault(url, set()).add(digest)
        return found
    finally:
        connection.close()


def check_registered_files(registry, quarantine):
    problems = []
    for name, digest in registry.execute("SELECT file_name, sha256 FROM acquired_documents"):
        path = Path(quarantine) / name
        if not path.is_file():
            problems.append({"file": name, "problem": "MISSING"})
        elif _sha256_file(path) != digest:
            problems.append({"file": name, "problem": "HASH_MISMATCH"})
    return problems


def remove_stale_temporaries(quarantine):
    removed = 0
    for path in Path(quarantine).glob(TEMP_PREFIX + "*.tmp"):
        path.unlink()
        removed += 1
    return removed


def acquire_one(item, registry, quarantine, staged, limit, run_id, opener=open_request, run_budget=None):
    url = item["url"]
    record = lambda outcome, code=None, detail=None, digest=None, size=None: (registry.execute(
        "INSERT INTO acquisition_events(run_id,at_utc,original_url,outcome,code,detail,sha256,bytes) VALUES(?,?,?,?,?,?,?,?)",
        (run_id, utc_now(), url, outcome, code, None if detail is None else str(detail)[:200], digest, size)), registry.commit())
    latest = registry.execute("SELECT sha256, server_etag, server_last_modified FROM acquired_documents WHERE original_url=? ORDER BY id DESC LIMIT 1", (url,)).fetchone()
    conditional = {}
    if latest:
        if latest[1]:
            conditional["If-None-Match"] = latest[1]
        elif latest[2]:
            conditional["If-Modified-Since"] = latest[2]
    temporary = None
    try:
        result = fetch_to_temp(url, quarantine, limit if run_budget is None else min(limit, run_budget), conditional, opener)
        if result["not_modified"]:
            record("UNCHANGED", "NOT_MODIFIED", digest=latest[0])
            return {"url": url, "outcome": "UNCHANGED", "code": "NOT_MODIFIED", "sha256": latest[0]}
        temporary, digest, size = result["temporary"], result["sha256"], result["bytes"]
        if digest in staged.get(url, ()):
            record("ALREADY_IN_STAGING", digest=digest, size=size)
            return {"url": url, "outcome": "ALREADY_IN_STAGING", "sha256": digest, "bytes": size}
        known = registry.execute("SELECT file_name FROM acquired_documents WHERE sha256=? AND original_url=?", (digest, url)).fetchone()
        if known:
            record("UNCHANGED", "SAME_HASH", digest=digest, size=size)
            return {"url": url, "outcome": "UNCHANGED", "code": "SAME_HASH", "sha256": digest, "bytes": size}
        other = registry.execute("SELECT original_url FROM acquired_documents WHERE sha256=?", (digest,)).fetchone()
        if other:
            record("DUPLICATE_CONTENT", detail=other[0], digest=digest, size=size)
            return {"url": url, "outcome": "DUPLICATE_CONTENT", "same_as": other[0], "sha256": digest, "bytes": size}
        details = inspect_pdf(temporary)
        source_id = source_id_for(url)
        name = source_id + "_" + digest[:16] + ".pdf"
        destination = Path(quarantine) / name
        if destination.exists():
            if _sha256_file(destination) != digest:
                raise Refused("QUARANTINE_FILE_CONFLICT")
            os.unlink(temporary)  # An earlier run stored the file and stopped before recording it.
        else:
            os.replace(temporary, destination)
        temporary = None
        provenance = item.get("provenance", {})
        registry.execute("""INSERT INTO acquired_documents(source_id,original_url,final_url,source_organization,document_title,research_categories,sha256,file_name,bytes,pages,pdf_version,
            active_content_markers,retrieved_utc,server_last_modified,server_etag,validation_status,authenticity,approval_status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'QUARANTINED_STRUCTURE_CHECKED','NOT_ESTABLISHED','NOT_APPROVED')""",
            (source_id, url, result["final_url"], SOURCES[urllib.parse.urlsplit(url).hostname]["organization"], provenance.get("document_title") or item.get("title") or "", json.dumps(item.get("research_domains", [])),
             digest, name, size, details["pages"], details["pdf_version"], json.dumps(details["active_content_markers"]), utc_now(), result.get("last_modified"), result.get("etag")))
        outcome = "NEW_VERSION" if latest else "QUARANTINED"
        record(outcome, digest=digest, size=size)
        return {"url": url, "outcome": outcome, "sha256": digest, "bytes": size, "file": name, **details}
    except Temporary as error:
        record("RETRY_LATER", error.code, error.detail)
        return {"url": url, "outcome": "RETRY_LATER", "code": error.code, "detail": error.detail}
    except Refused as error:
        if error.code == "SIZE_LIMIT_EXCEEDED" and run_budget is not None and run_budget < limit:
            # Too big for what is left of this run, which says nothing about the document itself.
            record("DEFERRED", "RUN_BYTE_LIMIT", error.detail)
            return {"url": url, "outcome": "DEFERRED", "code": "RUN_BYTE_LIMIT"}
        record("REFUSED", error.code, error.detail)
        return {"url": url, "outcome": "REFUSED", "code": error.code, "detail": error.detail}
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def acquire_all(items, registry, quarantine, staged, limit, total_limit, max_documents, run_id, opener=open_request, pause=PAUSE_SECONDS, sleep=time.sleep):
    results, total, failures = [], 0, 0
    for index, item in enumerate(items):
        if index >= max_documents:
            results.append({"url": item["url"], "outcome": "DEFERRED", "code": "DOCUMENT_LIMIT"})
            continue
        if total >= total_limit:
            results.append({"url": item["url"], "outcome": "DEFERRED", "code": "RUN_BYTE_LIMIT"})
            continue
        if failures >= OFFLINE_AFTER_FAILURES:
            results.append({"url": item["url"], "outcome": "DEFERRED", "code": "SOURCES_UNREACHABLE"})
            continue
        if index and pause:
            sleep(pause)
        result = acquire_one(item, registry, quarantine, staged, limit, run_id, opener, total_limit - total)
        failures = failures + 1 if result.get("code") in ("DNS_UNAVAILABLE", "CONNECTION_FAILED") else 0
        total += result.get("bytes") or 0
        results.append(result)
    return results, total


def safety_failures(report):
    failures = []
    for flag in ("knowledge_approval", "production_modified", "embeddings_generated", "extraction_performed", "scheduler_changed"):
        if report.get(flag) is not False:
            failures.append(flag)
    if report["protected_hashes_before"] != report["protected_hashes_after"]:
        failures.append("protected_state_changed")
    if report["integrity_problems"]:
        failures.append("quarantine_integrity")
    if report["registry_not_approved_violations"]:
        failures.append("registry_approval_state")
    return failures


def main(argv=None):
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--execute", action="store_true")
    options = arguments.parse_args(argv)
    verification = json.loads(VERIFICATION.read_text(encoding="utf-8"))
    policy = json.loads(POLICY.read_text(encoding="utf-8-sig"))
    limit, total_limit, max_documents = int(policy["max_document_bytes"]), int(policy["max_total_download_bytes_per_run"]), int(policy["max_documents_per_run"])
    items = plan(verification)
    if not options.execute:
        print(json.dumps({"mode": "PLAN_ONLY", "eligible": len(items), "limits": {"document_bytes": limit, "run_bytes": total_limit, "documents": max_documents}, "urls": [i["url"] for i in items]}, indent=1))
        return 0
    QUARANTINE.mkdir(parents=True, exist_ok=True)
    before = {name: _sha256_file(STATE / name) for name in PROTECTED}
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    with RunLock():
        registry = open_registry()
        try:
            removed = remove_stale_temporaries(QUARANTINE)
            results, total = acquire_all(items, registry, QUARANTINE, staged_hashes(), limit, total_limit, max_documents, run_id)
            integrity = check_registered_files(registry, QUARANTINE)
            violations = registry.execute("SELECT count(*) FROM acquired_documents WHERE approval_status!='NOT_APPROVED' OR authenticity!='NOT_ESTABLISHED'").fetchone()[0]
            events = registry.execute("SELECT count(*) FROM acquisition_events WHERE run_id=?", (run_id,)).fetchone()[0]
        finally:
            registry.close()
    tally = {}
    for result in results:
        tally[result["outcome"]] = tally.get(result["outcome"], 0) + 1
    report = {"step": 118, "run_id": run_id, "generated_utc": utc_now(), "mode": "QUARANTINE_ONLY", "input": {"path": VERIFICATION.name, "sha256": _sha256_file(VERIFICATION)},
              "attempted": len(items), "outcomes": tally, "bytes_downloaded": total, "stale_temporaries_removed": removed, "audit_events_this_run": events, "results": results,
              "integrity_problems": integrity, "registry_not_approved_violations": violations, "knowledge_approval": False, "production_modified": False, "embeddings_generated": False,
              "extraction_performed": False, "scheduler_changed": False, "protected_hashes_before": before, "protected_hashes_after": {name: _sha256_file(STATE / name) for name in PROTECTED}}
    failures = safety_failures(report)
    report["safety_failures"] = failures
    report["status"] = "FAIL" if failures else "PASS"
    write_atomic(REPORT, report)
    print(json.dumps({"status": report["status"], "attempted": len(items), "outcomes": tally, "bytes": total, "safety_failures": failures}))
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Refused as error:
        print(json.dumps({"status": "REFUSED", "code": error.code}))
        sys.exit(2)
