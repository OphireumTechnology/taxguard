"""TaxGuard AI Step 119: quarantined documents to staged, embedded knowledge. Staging only.

Reads the Step 118 acquisition database as its inventory and writes only state/knowledge_pipeline.sqlite3. It never writes the four
protected databases, never approves anything, and never changes a model. Downloaded documents are untrusted data: their text is
stored and embedded, and nothing in them is followed or run.

Tax year, processing year, publication date, effective date and version come only from text in the document, with the page and
quoted evidence recorded. Anything else stays UNKNOWN. Download and file dates are never used.

  python process_knowledge.py             plan only: gates every document, writes nothing
  python process_knowledge.py --execute   extract, classify, chunk and embed
  python process_knowledge.py --execute --stage extract
"""
import argparse
import ctypes
import hashlib
import json
import math
import os
import re
import sqlite3
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from acquire_verified_documents import RunLock, Refused, _sha256_file, inspect_pdf
from verify_research_candidates import LANGUAGE_VARIANT, PROTECTED, write_atomic

AUTONOMOUS = Path(__file__).resolve().parents[1]
STATE = AUTONOMOUS / "state"
ACQUISITION = STATE / "acquisition.sqlite3"
PIPELINE = STATE / "knowledge_pipeline.sqlite3"
LOCK = STATE / "knowledge_pipeline.lock"
QUARANTINE = (AUTONOMOUS.parent / "online/quarantine").resolve()
POLICY = AUTONOMOUS / "config/policy.json"
DECISIONS = AUTONOMOUS / "config/candidate_decisions.json"
REPORT = AUTONOMOUS / "reports/knowledge_processing_latest.json"
APPROVAL_FILES = (STATE / "approval_audit.jsonl", STATE / "admin_identity.json", STATE / "reviewer_identity.json")

PIPELINE_VERSION = "119.2"
MAX_PAGES = 500
MAX_CHARS = 5_000_000
CHUNK_CHARS = 1200
CHUNK_OVERLAP_LINES = 2
MIN_PAGE_CHARS = 50
EXTRACT_TIMEOUT_SECONDS = 300
EXTRACT_MEMORY_BYTES = 2 * 1024 ** 3
MAX_DOCUMENT_ATTEMPTS = 3
OLLAMA = "http://127.0.0.1:11434"
EMBED_MODEL = "nomic-embed-text:latest"
EMBED_PREFIX = "search_document: "
EMBED_DIMENSIONS = 768
EMBED_KEEP_ALIVE = "2m"
DEFAULT_BATCH = 8
BATCH_PAUSE_SECONDS = 0.25
EMBED_RETRIES = 3
MIN_FREE_GPU_MIB = 1500
WORKLOAD_CHECK_EVERY = 10
GUARDED_MODELS = ("taxguard-model:8b", "ophir-model:8b", "qwen3:8b", "taxguard-private:8b")
GUARDED_TASKS = ("TaxGuardAutonomousLearning", "TaxGuardStagingLearning", "OphirAutonomousLearning", "OphirStagingLearning")
REQUIRED_REGISTRY_STATE = ("QUARANTINED_STRUCTURE_CHECKED", "NOT_ESTABLISHED", "NOT_APPROVED")
BLOCKING_ACTIONS = ("/Launch", "/GoToE")

# A production stamp from the IRS typesetting system: several of these labels together on one line, never tax content.
PRODUCTION_LINE = re.compile(r"^\s*(Userid:\s*\S+.*(Schema:|Leadpct:|Fileid:).*|Userid:\s*\S+\s+Schema:\s*\S*|instrx|tipx|Leadpct:\s*\d+%.*|Fileid:\s*\S+.*|AH XSL/XML\s+Fileid:.*|Page \d+ of \d+\s+Fileid:.*"
                             r"|Page \d+ of \d+\s+\d{1,2}:\d{2} - \d{1,2}-[A-Z][a-z]{2}-\d{4}|The type and rule above prints on all proofs.*|Draft\s+Ok to Print\s*.*)$", re.I)
INJECTION = re.compile(r"ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?)|disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above)\s+\w+|"
                       r"\b(system|developer)\s+prompt\b|(?:^|[.!?:]\s+)you\s+are\s+now\s+(a|an|in)\b|<\|?(im_start|im_end|system)\|?>|\[/?INST\]|reveal\s+your\s+(instructions|prompt)|"
                       r"(do\s+not|don't)\s+tell\s+the\s+(user|reviewer)|new\s+instructions?\s*:", re.I | re.M)
SPACED_LETTERS = re.compile(r"\b(?:[A-Za-z] ){4,}[A-Za-z]\b")
GLUED_WORDS = re.compile(r"[a-z]{3,}[A-Z][a-z]{2,}")
TABLE_LEADERS = re.compile(r"(\. ?){5,}|(\d[\d,.]*\s+){4,}\d")
MONTHS = ("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
MONTH_NAME = "(?:" + "|".join(MONTHS) + ")"
BLANK_PAGE = re.compile(r"intentionally\s+left\s+blank", re.I)
TITLE_LINES = 15
# Read only from the title area at the top of page 1 (see title_area). Running text mentions other years in passing.
PROCESSING_YEAR = re.compile(r"\bProcessing\s+Year\s+(20\d{2})(?!\d)", re.I)
TAX_YEAR_PATTERNS = (re.compile(r"\bfor\s+use\s+in\s+preparing\s+(20\d{2})\s+returns?\b", re.I), re.compile(r"\bfor\s+tax\s+year\s+(20\d{2})(?!\d)", re.I),
                     re.compile(r"\b(20\d{2})\s+(?:General\s+)?Instructions?\b", re.I), re.compile(r"\b(20\d{2})\s+Tax\s+Table\b", re.I), re.compile(r"\b(20\d{2})\s+Form\s", re.I),
                     re.compile(r"\bForm\s*[\w-]+\s+(?:for\s+)?(20\d{2})(?!\d)", re.I), re.compile(r"\bSCHEDULE\s+\S+\s*\(Form\s*[\w-]+\)\s*(20\d{2})(?!\d)", re.I))
# "Rev. Proc. 2017" and "Rev. Rul. 2025" are citations, so only a month or a month number counts as a revision.
REVISION = (re.compile(r"\(Rev\.?\s*(" + MONTH_NAME + r"\s+20\d{2}|\d{1,2}-20\d{2})\)", re.I), re.compile(r"\bRev\.\s*(\d{1,2}-20\d{2})\b", re.I), re.compile(r"\((" + MONTH_NAME + r"\s+20\d{2})\)", re.I))
PUBLISHED = re.compile(r"\b(?:published|publication\s+date|issued|date\s+of\s+issue)\s*:?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+(?:\d{1,2},\s*)?20\d{2})\b", re.I)
COVER_DATE = re.compile(r"^\s*((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2})\s*$", re.I | re.M)
EFFECTIVE = re.compile(r"\beffective\s+(?:date\s*:?\s*|for\s+[a-z ]{0,40}?\s*(?:on\s+or\s+after\s+)?|on\s+|as\s+of\s+)((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*20\d{2})\b", re.I)


class SafetyStop(Exception):
    """A protected-state assertion failed. Processing stops at once."""


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def _sha256_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---- Registry and gates ---------------------------------------------------------------------------------------------------------
def read_inventory(path=ACQUISITION):
    connection = sqlite3.connect(f"file:{Path(path).as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in connection.execute("SELECT * FROM acquired_documents ORDER BY id")]
    finally:
        connection.close()


def gate_document(row, quarantine, policy, decisions, inspector=inspect_pdf):
    """Every check before a document's text is read. Refused(code) means it is blocked. Returns its inspection details."""
    if (row.get("validation_status"), row.get("authenticity"), row.get("approval_status")) != REQUIRED_REGISTRY_STATE:
        raise Refused("ACQUISITION_STATE_NOT_PROCESSABLE")
    url = row.get("original_url") or ""
    if url in (decisions or {}).get("exclude", {}):
        raise Refused("EXCLUDED_BY_OWNER")
    if (decisions or {}).get("exclude_language_variants") is True and (LANGUAGE_VARIANT.search(url) or LANGUAGE_VARIANT.search(row.get("document_title") or "")):
        raise Refused("NON_ENGLISH_EXCLUDED_BY_OWNER")
    name = row.get("file_name") or ""
    if not name or name != os.path.basename(name) or "/" in name or "\\" in name or ".." in name or not name.lower().endswith(".pdf"):
        raise Refused("PATH_OUTSIDE_QUARANTINE")
    root = Path(quarantine).resolve()
    candidate = root / name
    if candidate.is_symlink():
        raise Refused("PATH_OUTSIDE_QUARANTINE")
    path = candidate.resolve()
    if path.parent != root:
        raise Refused("PATH_OUTSIDE_QUARANTINE")
    if not path.is_file():
        raise Refused("FILE_MISSING")
    if path.stat().st_size > int(policy["max_document_bytes"]):
        raise Refused("SIZE_LIMIT_EXCEEDED")
    if _sha256_file(path) != row.get("sha256"):
        raise Refused("HASH_MISMATCH")
    details = inspector(path)
    if details["pages"] > MAX_PAGES:
        raise Refused("PAGE_LIMIT_EXCEEDED")
    return path, details


# ---- Extraction, in a separate limited process -------------------------------------------------------------------------------------
def extract_in_process(path):
    """Text and structure only. pypdf parses; nothing is rendered, and no action, script, attachment or link is followed."""
    from pypdf import PdfReader
    reader = PdfReader(str(path), strict=False)
    if reader.is_encrypted:
        raise ValueError("encrypted")
    pages, total = [], 0
    for number, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        total += len(text)
        if total > MAX_CHARS:
            raise ValueError("character limit")
        images = False
        try:
            objects = (page.get("/Resources") or {}).get_object().get("/XObject")
            if objects:
                images = any(o.get_object().get("/Subtype") == "/Image" for o in objects.get_object().values())
        except Exception:
            images = False
        pages.append({"page": number, "text": text, "has_images": bool(images)})
    return {"pages": pages, "signals": structural_signals(reader)}


def structural_signals(reader):
    """Actions and attachments the catalog declares. Review signals only: an empty list does not mean a document is safe."""
    found, incomplete = set(), False
    def actions_in(obj, depth=0):
        if depth > 6:
            return
        obj = obj.get_object() if hasattr(obj, "get_object") else obj
        if isinstance(obj, dict):
            kind = obj.get("/S")
            if kind:
                found.add(str(kind))
            for key in ("/A", "/AA", "/OpenAction", "/Next"):
                if key in obj:
                    found.add(key) if key in ("/AA", "/OpenAction") else None
                    actions_in(obj[key], depth + 1)
            if "/D" in obj and "/S" not in obj and depth:
                actions_in(obj["/D"], depth + 1)
        elif isinstance(obj, list):
            for item in obj[:50]:
                actions_in(item, depth + 1)
    try:
        root = reader.trailer["/Root"].get_object()
        actions_in(root)
        names = root.get("/Names")
        if names:
            names = names.get_object()
            for key in ("/JavaScript", "/EmbeddedFiles"):
                if key in names:
                    found.add(key)
        if "/AcroForm" in root and "/XFA" in root["/AcroForm"].get_object():
            found.add("/XFA")
        for page in reader.pages:
            actions_in(page.raw_get("/AA")) if "/AA" in page else None
            annotations = page.get("/Annots")
            if annotations:
                for annotation in annotations.get_object()[:500]:
                    actions_in(annotation)
    except Exception:
        incomplete = True
    return {"actions": sorted(found), "scan_incomplete": incomplete}


def _limit_child_memory(process, limit):
    """Windows job object: the child is killed if it exceeds the limit. Elsewhere only the time limit applies."""
    if os.name != "nt":
        return False
    class Basic(ctypes.Structure):
        _fields_ = [("PerProcessUserTimeLimit", ctypes.c_longlong), ("PerJobUserTimeLimit", ctypes.c_longlong), ("LimitFlags", ctypes.c_ulong), ("MinimumWorkingSetSize", ctypes.c_size_t),
                    ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", ctypes.c_ulong), ("Affinity", ctypes.c_size_t), ("PriorityClass", ctypes.c_ulong), ("SchedulingClass", ctypes.c_ulong)]
    class Counters(ctypes.Structure):
        _fields_ = [(n, ctypes.c_ulonglong) for n in ("a", "b", "c", "d", "e", "f")]
    class Extended(ctypes.Structure):
        _fields_ = [("Basic", Basic), ("Io", Counters), ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t), ("PeakProcess", ctypes.c_size_t), ("PeakJob", ctypes.c_size_t)]
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateJobObjectW.restype = ctypes.c_void_p
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.SetInformationJobObject.argtypes = (ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p, ctypes.c_ulong)
    kernel.AssignProcessToJobObject.argtypes = (ctypes.c_void_p, ctypes.c_void_p)
    job = kernel.CreateJobObjectW(None, None)
    info = Extended()
    info.Basic.LimitFlags = 0x100 | 0x2000 | 0x20  # process memory limit, kill on close, priority class
    info.Basic.PriorityClass = 0x4000  # below normal
    info.ProcessMemoryLimit = limit
    if not kernel.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)):
        return False
    handle = kernel.OpenProcess(0x1F0FFF, False, process.pid)
    return bool(handle and kernel.AssignProcessToJobObject(job, handle))


def extract_limited(path, timeout=EXTRACT_TIMEOUT_SECONDS, memory=EXTRACT_MEMORY_BYTES, command=None):
    """Runs extraction in a child process with a time limit, memory limit and low priority. Returns its JSON."""
    process = subprocess.Popen(command or [sys.executable, str(Path(__file__).resolve()), "--extract-one", str(path)], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    _limit_child_memory(process, memory)
    try:
        out, _ = process.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        process.kill()
        process.communicate()
        raise Refused("EXTRACTION_TIME_LIMIT")
    if process.returncode != 0:
        raise Refused("EXTRACTION_FAILED", process.returncode)
    try:
        return json.loads(out.decode("utf-8"))
    except ValueError:
        raise Refused("EXTRACTION_OUTPUT_INVALID")


# ---- Cleaning and findings ---------------------------------------------------------------------------------------------------------
def repeated_lines(pages):
    """Short lines on most pages of a document of four or more pages: running headers and footers."""
    if len(pages) < 4:
        return set()
    seen = Counter()
    for page in pages:
        for line in {" ".join(l.split()) for l in page["text"].splitlines()}:
            if 0 < len(line) <= 80:
                seen[line] += 1
    # One word is never treated as a header: on real pages these were table headings ("than") and callouts ("CAUTION", "TIP").
    return {line for line, count in seen.items() if count >= 0.6 * len(pages) and count >= 4 and len(line.split()) >= 2 and len(line) >= 12}


def _tokens(text):
    return text.split()


def clean_page(text, repeated):
    """Removes only whole production stamps and running headers, and lists every line it removed. Returns (cleaned, removed).
    If the words kept are not exactly the original words minus the removed lines, no cleaned text is offered."""
    kept, removed = [], []
    for line in text.splitlines():
        normalized = " ".join(line.split())
        if normalized and PRODUCTION_LINE.match(normalized):
            removed.append({"kind": "PRODUCTION_METADATA", "text": normalized})
        elif normalized and normalized in repeated:
            removed.append({"kind": "REPEATED_HEADER_FOOTER", "text": normalized})
        else:
            kept.append(normalized)
    cleaned = "\n".join(kept).strip()
    expected = Counter(_tokens(text))
    for item in removed:
        expected.subtract(_tokens(item["text"]))
    if +expected != Counter(_tokens(cleaned)):
        return None, removed
    return cleaned, removed


def page_findings(page, cleaned, removed):
    text = page["text"]
    findings = []
    add = lambda kind, detail=None: findings.append({"page": page["page"], "kind": kind, "detail": detail})
    stripped = "".join(text.split())
    if len(stripped) < MIN_PAGE_CHARS and not BLANK_PAGE.search(text):
        add("SCANNED_PAGE_NEEDS_OCR" if page.get("has_images") else "MISSING_OR_LOW_TEXT", len(stripped))
    broken = len(re.findall(r"[A-Za-z]-\s*\n\s*[a-z]", text)) + len(SPACED_LETTERS.findall(text))
    if broken:
        add("BROKEN_WORDS", broken)
    glued = len(GLUED_WORDS.findall(text))
    if glued >= 3:
        add("WORDS_RUN_TOGETHER", glued)
    if "�" in text or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", text):
        add("UNREADABLE_CHARACTERS")
    if len(TABLE_LEADERS.findall(text)) >= 3:
        add("UNCERTAIN_TABLE_EXTRACTION")
    kinds = Counter(item["kind"] for item in removed)
    for kind, count in kinds.items():
        add(kind, count)
    if cleaned is None:
        add("CLEANING_NOT_PROVEN_SAFE")
    for match in INJECTION.finditer(text):
        add("POSSIBLE_PROMPT_INJECTION", match.group(0)[:120])
    return findings


# ---- Classification ----------------------------------------------------------------------------------------------------------------
def title_area(pages):
    """The top of page 1 without production stamps, on one line."""
    lines = [" ".join(l.split()) for l in (pages[0]["text"].splitlines() if pages else [])]
    return " ".join([l for l in lines if l and not PRODUCTION_LINE.match(l)][:TITLE_LINES])


def normalize_revision(value):
    """March 2026 and 3-2026 are one revision: 2026-03."""
    match = re.fullmatch(r"(\d{1,2})-(20\d{2})", value)
    if match:
        return f"{match.group(2)}-{int(match.group(1)):02d}"
    match = re.fullmatch(r"([A-Za-z]+)\s+(20\d{2})", value)
    return f"{match.group(2)}-{MONTHS.index(match.group(1).title()) + 1:02d}" if match else value


def _one_value(values):
    distinct = sorted({v for v, _, _ in values})
    return distinct[0] if len(distinct) == 1 else None


def classify_text(pages, row):
    """Only what the document states. Conflicting statements stay UNKNOWN and are reported, never resolved by choosing one."""
    head = pages[:3]
    title = row.get("document_title") or ""
    findings, evidence = [], {}
    title_page = {"page": 1, "text": title_area(pages)}
    def collect(patterns, label, sources=head, normalize=lambda v: v):
        hits = []
        for page in sources:
            for pattern in patterns:
                for match in pattern.finditer(page["text"]):
                    value = next(g for g in match.groups() if g)
                    hits.append((normalize(" ".join(value.split())), page["page"], " ".join(match.group(0).split())[:120]))
        value = _one_value(hits)
        if hits:
            evidence[label] = [{"value": v, "page": p, "quote": q} for v, p, q in hits[:5]]
        if hits and value is None:
            findings.append({"page": hits[0][1], "kind": "CONFLICTING_" + label.upper(), "detail": sorted({h[0] for h in hits})[:5]})
        return value or "UNKNOWN"
    host = urllib.parse.urlsplit(row.get("original_url") or "").hostname
    lowered = title.lower()
    name = (row.get("file_name") or "").lower()
    if "instruction" in lowered:
        kind = "INSTRUCTIONS"
    elif lowered.startswith("publication") or "tax table" in lowered:
        kind = "PUBLICATION"
    elif lowered.startswith("form"):
        kind = "FORM"
    elif name.startswith("nist"):
        kind = "STANDARD_OR_FRAMEWORK"
    else:
        kind = "UNCLASSIFIED"
    published = collect((PUBLISHED,), "publication_date")
    if published == "UNKNOWN" and host == "nvlpubs.nist.gov":
        published = collect((COVER_DATE,), "cover_date")
    return {"research_domains": json.loads(row.get("research_categories") or "[]"), "document_type": kind, "issuing_authority": row.get("source_organization"),
            "jurisdiction": "US_FEDERAL" if host == "www.irs.gov" else "NOT_APPLICABLE" if host == "nvlpubs.nist.gov" else "UNKNOWN",
            "tax_year": collect(TAX_YEAR_PATTERNS, "tax_year", [title_page]), "processing_year": collect((PROCESSING_YEAR,), "processing_year", [title_page]), "publication_date": published,
            "effective_date": collect((EFFECTIVE,), "effective_date"), "version": collect(REVISION, "version", pages[:1], normalize_revision), "source_url": row.get("original_url"), "acquisition_sha256": row.get("sha256"),
            "evidence": evidence}, findings


# ---- Chunking ----------------------------------------------------------------------------------------------------------------------
def _split_long(line):
    if len(line) <= CHUNK_CHARS:
        return [line]
    parts, current = [], ""
    for word in line.split(" "):
        while len(word) > CHUNK_CHARS:
            if current:
                parts.append(current)
                current = ""
            parts.append(word[:CHUNK_CHARS])
            word = word[CHUNK_CHARS:]
        if current and len(current) + 1 + len(word) > CHUNK_CHARS:
            parts.append(current)
            current = word
        else:
            current = (current + " " + word) if current else word
    if current:
        parts.append(current)
    return parts


def chunk_page(text, repeated):
    """Deterministic line-based chunks of one page: the same text always gives the same chunks. Returns (original, cleaned) pairs."""
    lines = [piece for line in text.splitlines() for piece in _split_long(line)]
    chunks, current, size = [], [], 0
    for line in lines:
        if current and size + len(line) + 1 > CHUNK_CHARS:
            chunks.append(current)
            current = current[-CHUNK_OVERLAP_LINES:] if sum(len(l) + 1 for l in current[-CHUNK_OVERLAP_LINES:]) + len(line) + 1 <= CHUNK_CHARS else []
            size = sum(len(l) + 1 for l in current)
        current.append(line)
        size += len(line) + 1
    if current:
        chunks.append(current)
    out = []
    for group in chunks:
        original = "\n".join(group)
        if not original.strip():
            continue
        cleaned, _ = clean_page(original, repeated)
        out.append((original, cleaned))
    return out


# ---- Pipeline database -------------------------------------------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
  document_id TEXT PRIMARY KEY, source_id TEXT NOT NULL, sha256 TEXT NOT NULL UNIQUE, acquisition_id INTEGER NOT NULL, source_url TEXT NOT NULL, document_title TEXT NOT NULL, pipeline_version TEXT NOT NULL,
  pages INTEGER NOT NULL, pages_with_text INTEGER NOT NULL, classification TEXT NOT NULL, active_content TEXT NOT NULL, extraction_status TEXT NOT NULL CHECK(extraction_status IN ('EXTRACTED','EXTRACTED_WITH_FINDINGS')),
  review_status TEXT NOT NULL CHECK(review_status = 'PENDING_REVIEW'), created_utc TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pages (
  document_id TEXT NOT NULL REFERENCES documents(document_id), page_number INTEGER NOT NULL, original_text TEXT NOT NULL, cleaned_text TEXT, removed_lines TEXT NOT NULL, PRIMARY KEY(document_id, page_number));
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(document_id), source_sha256 TEXT NOT NULL, page_number INTEGER NOT NULL, chunk_sequence INTEGER NOT NULL, original_content TEXT NOT NULL,
  cleaned_content TEXT, content_hash TEXT NOT NULL, classification TEXT NOT NULL, embedding_hold TEXT, review_status TEXT NOT NULL CHECK(review_status = 'PENDING_REVIEW'), created_utc TEXT NOT NULL,
  UNIQUE(document_id, page_number, chunk_sequence));
CREATE INDEX IF NOT EXISTS chunks_content ON chunks(content_hash);
CREATE TABLE IF NOT EXISTS embeddings (
  content_hash TEXT NOT NULL, embedding_model TEXT NOT NULL, model_digest TEXT NOT NULL, text_prefix TEXT NOT NULL, dimensions INTEGER NOT NULL, vector BLOB NOT NULL, created_utc TEXT NOT NULL,
  PRIMARY KEY(content_hash, embedding_model, model_digest, text_prefix));
CREATE TABLE IF NOT EXISTS findings (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL, page_number INTEGER, kind TEXT NOT NULL, detail TEXT);
CREATE TABLE IF NOT EXISTS document_attempts (source_sha256 TEXT PRIMARY KEY, source_id TEXT NOT NULL, attempts INTEGER NOT NULL, last_code TEXT NOT NULL, last_utc TEXT NOT NULL, terminal INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, at_utc TEXT NOT NULL, stage TEXT NOT NULL, subject TEXT NOT NULL, outcome TEXT NOT NULL, detail TEXT);
CREATE TRIGGER IF NOT EXISTS chunks_immutable BEFORE UPDATE ON chunks BEGIN SELECT RAISE(ABORT, 'chunks are immutable'); END;
CREATE TRIGGER IF NOT EXISTS chunks_no_delete BEFORE DELETE ON chunks BEGIN SELECT RAISE(ABORT, 'chunks are immutable'); END;
CREATE TRIGGER IF NOT EXISTS pages_immutable BEFORE UPDATE ON pages BEGIN SELECT RAISE(ABORT, 'pages are immutable'); END;
CREATE TRIGGER IF NOT EXISTS pages_no_delete BEFORE DELETE ON pages BEGIN SELECT RAISE(ABORT, 'pages are immutable'); END;
CREATE TRIGGER IF NOT EXISTS documents_immutable BEFORE UPDATE ON documents BEGIN SELECT RAISE(ABORT, 'documents are immutable'); END;
CREATE TRIGGER IF NOT EXISTS documents_no_delete BEFORE DELETE ON documents BEGIN SELECT RAISE(ABORT, 'documents are immutable'); END;
CREATE TRIGGER IF NOT EXISTS embeddings_immutable BEFORE UPDATE ON embeddings BEGIN SELECT RAISE(ABORT, 'embeddings are immutable'); END;
CREATE TRIGGER IF NOT EXISTS events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
CREATE TRIGGER IF NOT EXISTS events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'audit events are append-only'); END;
"""


def open_pipeline(path=PIPELINE):
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    connection.executescript(SCHEMA)
    connection.commit()
    return connection


def log_event(connection, run_id, stage, subject, outcome, detail=None):
    connection.execute("INSERT INTO events(run_id,at_utc,stage,subject,outcome,detail) VALUES(?,?,?,?,?,?)", (run_id, utc_now(), stage, subject, outcome, None if detail is None else str(detail)[:300]))


def record_attempt(connection, row, code, terminal):
    connection.execute("""INSERT INTO document_attempts(source_sha256,source_id,attempts,last_code,last_utc,terminal) VALUES(?,?,1,?,?,?)
        ON CONFLICT(source_sha256) DO UPDATE SET attempts=attempts+1,last_code=excluded.last_code,last_utc=excluded.last_utc,terminal=excluded.terminal""", (row["sha256"], row["source_id"], code, utc_now(), int(terminal)))


TERMINAL_CODES = {"HASH_MISMATCH", "PATH_OUTSIDE_QUARANTINE", "EXCLUDED_BY_OWNER", "NON_ENGLISH_EXCLUDED_BY_OWNER", "ACQUISITION_STATE_NOT_PROCESSABLE", "PDF_ENCRYPTED", "PDF_SIGNATURE_INVALID", "PDF_TRAILER_MISSING",
                  "PDF_UNREADABLE", "PDF_HAS_NO_PAGES", "PAGE_LIMIT_EXCEEDED", "SIZE_LIMIT_EXCEEDED", "BLOCKING_ACTION_DECLARED", "NO_EXTRACTABLE_TEXT", "FILE_MISSING"}


def process_document(row, connection, quarantine, policy, decisions, run_id, extractor=extract_limited, inspector=inspect_pdf):
    """One document, one transaction: all of its pages, chunks and findings are stored, or none."""
    document_id = row["source_id"] + "_" + row["sha256"][:16]
    subject = row["source_id"]
    if connection.execute("SELECT 1 FROM documents WHERE sha256=?", (row["sha256"],)).fetchone():
        return {"source_id": subject, "outcome": "ALREADY_PROCESSED"}
    prior = connection.execute("SELECT attempts, terminal, last_code FROM document_attempts WHERE source_sha256=?", (row["sha256"],)).fetchone()
    if prior and (prior[1] or prior[0] >= MAX_DOCUMENT_ATTEMPTS):
        return {"source_id": subject, "outcome": "BLOCKED", "code": prior[2], "detail": "previous attempts recorded"}
    try:
        path, details = gate_document(row, quarantine, policy, decisions, inspector)
        extracted = extractor(path)
        declared = set(extracted.get("signals", {}).get("actions", []))
        if declared & set(BLOCKING_ACTIONS):
            raise Refused("BLOCKING_ACTION_DECLARED", sorted(declared & set(BLOCKING_ACTIONS)))
        pages = extracted["pages"]
        with_text = sum(1 for p in pages if p["text"].strip())
        if not with_text:
            raise Refused("NO_EXTRACTABLE_TEXT")
        repeated = repeated_lines(pages)
        classification, findings = classify_text(pages, row)
        stored_class = json.dumps(classification, sort_keys=True)
        page_rows, chunk_rows, seen = [], [], Counter()
        for page in pages:
            cleaned, removed = clean_page(page["text"], repeated)
            page_rows.append((document_id, page["page"], page["text"], cleaned, json.dumps(removed)))
            findings.extend(page_findings(page, cleaned, removed))
            for sequence, (original, chunk_cleaned) in enumerate(chunk_page(page["text"], repeated), start=1):
                basis = chunk_cleaned if chunk_cleaned else original
                content_hash = _sha256_text(" ".join(basis.split()))
                seen[content_hash] += 1
                hold = "POSSIBLE_PROMPT_INJECTION" if INJECTION.search(original) else "CLEANED_TEXT_NOT_AVAILABLE" if chunk_cleaned is None else "NO_CONTENT_AFTER_CLEANING" if not chunk_cleaned.strip() else None
                chunk_id = _sha256_text("|".join((row["sha256"], str(page["page"]), str(sequence), _sha256_text(original))))
                chunk_rows.append((chunk_id, document_id, row["sha256"], page["page"], sequence, original, chunk_cleaned, content_hash, stored_class, hold, "PENDING_REVIEW", utc_now()))
        findings.extend({"page": None, "kind": "DUPLICATE_CONTENT_WITHIN_DOCUMENT", "detail": count} for count in seen.values() if count > 1)
        markers = {"bytes": details["active_content_markers"], "structure": extracted.get("signals", {})}
        if markers["bytes"] or declared:
            findings.append({"page": None, "kind": "ACTIVE_CONTENT_SIGNAL", "detail": json.dumps(markers)[:280]})
        if extracted.get("signals", {}).get("scan_incomplete"):
            findings.append({"page": None, "kind": "ACTIVE_CONTENT_SCAN_INCOMPLETE", "detail": None})
        duplicate = connection.execute("SELECT document_id FROM documents WHERE source_url=? AND sha256!=?", (row["original_url"], row["sha256"])).fetchone()
        if duplicate:
            findings.append({"page": None, "kind": "SUPERSEDES_EARLIER_VERSION_CANDIDATE", "detail": duplicate[0]})
        status = "EXTRACTED_WITH_FINDINGS" if findings else "EXTRACTED"
        with connection:
            connection.execute("""INSERT INTO documents(document_id,source_id,sha256,acquisition_id,source_url,document_title,pipeline_version,pages,pages_with_text,classification,active_content,extraction_status,review_status,created_utc)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'PENDING_REVIEW',?)""", (document_id, subject, row["sha256"], row["id"], row["original_url"], row.get("document_title") or "", PIPELINE_VERSION, len(pages), with_text, stored_class, json.dumps(markers), status, utc_now()))
            connection.executemany("INSERT INTO pages(document_id,page_number,original_text,cleaned_text,removed_lines) VALUES(?,?,?,?,?)", page_rows)
            connection.executemany("""INSERT INTO chunks(chunk_id,document_id,source_sha256,page_number,chunk_sequence,original_content,cleaned_content,content_hash,classification,embedding_hold,review_status,created_utc)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""", chunk_rows)
            connection.executemany("INSERT INTO findings(document_id,page_number,kind,detail) VALUES(?,?,?,?)", [(document_id, f["page"], f["kind"], None if f["detail"] is None else str(f["detail"])) for f in findings])
            log_event(connection, run_id, "EXTRACT", subject, "EXTRACTED", json.dumps({"pages": len(pages), "chunks": len(chunk_rows)}))
        return {"source_id": subject, "outcome": "EXTRACTED", "pages": len(pages), "chunks": len(chunk_rows), "findings": len(findings)}
    except Refused as error:
        terminal = error.code in TERMINAL_CODES
        with connection:
            record_attempt(connection, row, error.code, terminal)
            log_event(connection, run_id, "EXTRACT", subject, "BLOCKED" if terminal else "RETRY_LATER", error.code)
        return {"source_id": subject, "outcome": "BLOCKED" if terminal else "RETRY_LATER", "code": error.code}
    except sqlite3.Error:
        raise
    except Exception as error:
        with connection:
            record_attempt(connection, row, "UNEXPECTED_" + type(error).__name__, False)
            log_event(connection, run_id, "EXTRACT", subject, "RETRY_LATER", type(error).__name__)
        return {"source_id": subject, "outcome": "RETRY_LATER", "code": "UNEXPECTED_" + type(error).__name__}


# ---- Embeddings ---------------------------------------------------------------------------------------------------------------------
def local_only(endpoint):
    parts = urllib.parse.urlsplit(endpoint)
    if parts.scheme != "http" or parts.hostname not in ("127.0.0.1", "localhost", "::1"):
        raise SafetyStop("EMBEDDING_ENDPOINT_NOT_LOCAL")
    return endpoint


def ollama_request(path, payload=None, timeout=180, endpoint=OLLAMA):
    request = urllib.request.Request(local_only(endpoint) + path, data=None if payload is None else json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="GET" if payload is None else "POST")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def model_digests():
    return {m["name"]: m.get("digest") for m in ollama_request("/api/tags", timeout=15).get("models", [])}


def embed_batch(texts, model=EMBED_MODEL):
    body = ollama_request("/api/embed", {"model": model, "input": [EMBED_PREFIX + t for t in texts], "keep_alive": EMBED_KEEP_ALIVE, "truncate": False})
    return body.get("embeddings")


def validate_vectors(vectors, expected_count, dimensions=EMBED_DIMENSIONS):
    if not isinstance(vectors, list) or len(vectors) != expected_count:
        raise Refused("EMBEDDING_COUNT_MISMATCH")
    for vector in vectors:
        if not isinstance(vector, list) or len(vector) != dimensions:
            raise Refused("EMBEDDING_DIMENSION_MISMATCH")
        if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in vector):
            raise Refused("EMBEDDING_NOT_FINITE")
        if not any(vector):
            raise Refused("EMBEDDING_ALL_ZERO")


def pending_chunks(connection, model, digest, document_id=None):
    query = """SELECT c.content_hash, COALESCE(c.cleaned_content, c.original_content), MIN(c.rowid), c.document_id FROM chunks c
        WHERE c.embedding_hold IS NULL AND NOT EXISTS (SELECT 1 FROM embeddings e WHERE e.content_hash=c.content_hash AND e.embedding_model=? AND e.model_digest=? AND e.text_prefix=?)"""
    arguments = [model, digest, EMBED_PREFIX]
    if document_id:
        query += " AND c.document_id=?"
        arguments.append(document_id)
    return connection.execute(query + " GROUP BY c.content_hash ORDER BY MIN(c.rowid)", arguments).fetchall()


def embed_pending(connection, run_id, model, digest, batch_size=DEFAULT_BATCH, embedder=embed_batch, sleep=time.sleep, pause=BATCH_PAUSE_SECONDS, between=None, max_batches=None):
    """Each batch commits on its own, so an interruption loses at most one batch and a restart continues from the next."""
    pending = pending_chunks(connection, model, digest)
    done, batches, failures = 0, 0, 0
    for start in range(0, len(pending), batch_size):
        if max_batches is not None and batches >= max_batches:
            break
        if between:
            between()
        batch = pending[start:start + batch_size]
        texts = [row[1] for row in batch]
        vectors, last = None, None
        for attempt in range(EMBED_RETRIES):
            try:
                vectors = embedder(texts)
                validate_vectors(vectors, len(texts))
                break
            except Refused as error:
                vectors, last = None, error.code
                break  # a bad vector will not improve by asking again
            except (OSError, urllib.error.URLError, ValueError) as error:
                vectors, last = None, type(error).__name__
                sleep(2 ** attempt)
        if vectors is None:
            failures += 1
            with connection:
                log_event(connection, run_id, "EMBED", batch[0][3], "BATCH_FAILED", last)
            if failures >= EMBED_RETRIES:
                return {"embedded": done, "batches": batches, "failed_batches": failures, "stopped": "EMBEDDING_SERVICE_FAILING"}
            continue
        now = utc_now()
        with connection:
            connection.executemany("INSERT OR IGNORE INTO embeddings(content_hash,embedding_model,model_digest,text_prefix,dimensions,vector,created_utc) VALUES(?,?,?,?,?,?,?)",
                                   [(row[0], model, digest, EMBED_PREFIX, len(vector), struct.pack(f"<{len(vector)}f", *vector), now) for row, vector in zip(batch, vectors)])
            log_event(connection, run_id, "EMBED", batch[0][3], "BATCH_COMMITTED", len(batch))
        done += len(batch)
        batches += 1
        if pause:
            sleep(pause)
    return {"embedded": done, "batches": batches, "failed_batches": failures, "stopped": None}


# ---- Protected state ----------------------------------------------------------------------------------------------------------------
def protected_snapshot(state=STATE, approval_files=APPROVAL_FILES):
    snapshot = {"hashes": {}, "integrity": {}, "approval_counts": {}, "approval_files": {}}
    for name in PROTECTED:
        path = Path(state) / name
        snapshot["hashes"][name] = _sha256_file(path)
        connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
        try:
            snapshot["integrity"][name] = connection.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            connection.close()
    connection = sqlite3.connect(f"file:{(Path(state) / 'taxguard_semantic_memory.sqlite3').as_posix()}?mode=ro", uri=True)
    try:
        for label, query in (("document_reviews", "SELECT count(*) FROM document_reviews"), ("review_evidence", "SELECT count(*) FROM review_evidence"),
                             ("approved_chunks", "SELECT count(*) FROM knowledge_chunks WHERE approval_status='APPROVED'")):
            snapshot["approval_counts"][label] = connection.execute(query).fetchone()[0]
    finally:
        connection.close()
    for path in approval_files:
        snapshot["approval_files"][Path(path).name] = _sha256_file(path) if Path(path).exists() else None
    return snapshot


def scheduled_task_states():
    command = "Get-ScheduledTask | Where-Object { $_.TaskName -in @('" + "','".join(GUARDED_TASKS) + "') } | ForEach-Object { $_.TaskName + '=' + $_.State }"
    out = subprocess.run(["powershell", "-NoProfile", "-Command", command], capture_output=True, text=True, timeout=60).stdout
    return dict(line.strip().split("=", 1) for line in out.splitlines() if "=" in line)


def assert_guards(before, snapshot, tasks, digests):
    """Raises SafetyStop if anything protected has changed."""
    if snapshot != before["protected"]:
        changed = [k for k in snapshot["hashes"] if snapshot["hashes"][k] != before["protected"]["hashes"].get(k)]
        raise SafetyStop("PROTECTED_STATE_CHANGED: " + (",".join(changed) or "approval records"))
    if any(v != "ok" for v in snapshot["integrity"].values()):
        raise SafetyStop("PROTECTED_DATABASE_INTEGRITY")
    if sorted(tasks) != sorted(GUARDED_TASKS) or any(v != "Disabled" for v in tasks.values()):
        raise SafetyStop("SCHEDULED_TASK_NOT_DISABLED")
    for name, digest in before["models"].items():
        if digests.get(name) != digest:
            raise SafetyStop("MODEL_CHANGED: " + name)


def competing_workload():
    """TaxGuard test runs or a browser test in progress, and the GPU memory left. Nothing here is stopped; this job just waits its turn."""
    command = ("@(Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node|postgres' -and $_.CommandLine -match 'vitest|run-e2e|e2e-server|embedded-postgres' }).Count")
    count = subprocess.run(["powershell", "-NoProfile", "-Command", command], capture_output=True, text=True, timeout=60).stdout.strip()
    try:
        free = int(subprocess.run(["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"], capture_output=True, text=True, timeout=30).stdout.split()[0])
    except (OSError, ValueError, IndexError):
        free = None
    return {"test_processes": int(count) if count.isdigit() else None, "gpu_free_mib": free}


def workload_reason(load):
    if load["test_processes"] is None or load["test_processes"] > 0:
        return "TAXGUARD_TESTS_RUNNING" if load["test_processes"] else "WORKLOAD_UNKNOWN"
    if load["gpu_free_mib"] is None or load["gpu_free_mib"] < MIN_FREE_GPU_MIB:
        return "GPU_MEMORY_LOW"
    return None


# ---- Reports ------------------------------------------------------------------------------------------------------------------------
def database_summary(connection, model=None, digest=None):
    one = lambda q, *a: connection.execute(q, a).fetchone()[0]
    classes = [json.loads(r[0]) for r in connection.execute("SELECT classification FROM documents")]
    known = lambda key: sum(1 for c in classes if c.get(key) not in ("UNKNOWN", None))
    summary = {"documents": len(classes), "pages": one("SELECT count(*) FROM pages"), "pages_with_text": one("SELECT COALESCE(sum(pages_with_text),0) FROM documents"), "chunks": one("SELECT count(*) FROM chunks"), "unique_chunk_content": one("SELECT count(DISTINCT content_hash) FROM chunks"),
               "chunks_held_from_embedding": dict(connection.execute("SELECT embedding_hold, count(*) FROM chunks WHERE embedding_hold IS NOT NULL GROUP BY 1").fetchall()), "embeddings": one("SELECT count(*) FROM embeddings"),
               "embedding_models": [{"model": m, "digest": d, "dimensions": n, "count": c} for m, d, n, c in connection.execute("SELECT embedding_model, model_digest, dimensions, count(*) FROM embeddings GROUP BY 1,2,3")],
               "classification_coverage": {k: known(k) for k in ("document_type", "issuing_authority", "jurisdiction", "tax_year", "processing_year", "publication_date", "effective_date", "version")},
               "document_types": dict(Counter(c.get("document_type") for c in classes)), "tax_years": dict(Counter(c.get("tax_year") for c in classes)), "processing_years": dict(Counter(c.get("processing_year") for c in classes)),
               "findings": dict(connection.execute("SELECT kind, count(*) FROM findings GROUP BY 1 ORDER BY 2 DESC").fetchall()), "not_pending_review": one("SELECT count(*) FROM chunks WHERE review_status!='PENDING_REVIEW'")}
    if model and digest:
        summary["chunks_awaiting_embedding"] = len(pending_chunks(connection, model, digest))
    return summary


def _load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def main(argv=None):
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--execute", action="store_true")
    arguments.add_argument("--stage", choices=("extract", "embed", "all"), default="all")
    arguments.add_argument("--batch-size", type=int, default=DEFAULT_BATCH)
    arguments.add_argument("--max-documents", type=int)
    arguments.add_argument("--max-batches", type=int)
    arguments.add_argument("--extract-one")
    options = arguments.parse_args(argv)
    if options.extract_one:
        sys.stdout.write(json.dumps(extract_in_process(options.extract_one)))
        return 0
    if not 1 <= options.batch_size <= 32:
        print(json.dumps({"status": "REFUSED", "code": "BATCH_SIZE_OUT_OF_RANGE"}))
        return 2
    inventory = read_inventory()
    policy, decisions = _load_json(POLICY), _load_json(DECISIONS)
    load = competing_workload()
    if not options.execute:
        plan = []
        for row in inventory:
            try:
                gate_document(row, QUARANTINE, policy, decisions)
                plan.append({"source_id": row["source_id"], "gate": "PASS"})
            except Refused as error:
                plan.append({"source_id": row["source_id"], "gate": "BLOCKED", "code": error.code})
        print(json.dumps({"mode": "PLAN_ONLY", "inventory": len(inventory), "gate_passed": sum(p["gate"] == "PASS" for p in plan), "blocked": [p for p in plan if p["gate"] != "PASS"], "workload": load, "would_defer_for": workload_reason(load)}, indent=1))
        return 0
    reason = workload_reason(load)
    if reason:
        print(json.dumps({"status": "DEFERRED", "code": reason, "workload": load}))
        return 3
    digests = model_digests()
    if EMBED_MODEL not in digests:
        print(json.dumps({"status": "REFUSED", "code": "EMBEDDING_MODEL_NOT_INSTALLED"}))
        return 2
    before = {"protected": protected_snapshot(), "models": {m: digests.get(m) for m in GUARDED_MODELS}}
    assert_guards(before, before["protected"], scheduled_task_states(), digests)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    results, embedded, status_code = [], {"embedded": 0, "batches": 0, "failed_batches": 0, "stopped": None}, None
    with RunLock(LOCK):
        connection = open_pipeline()
        try:
            try:
                if options.stage in ("extract", "all"):
                    for row in inventory[:options.max_documents] if options.max_documents else inventory:
                        results.append(process_document(row, connection, QUARANTINE, policy, decisions, run_id))
                        assert_guards(before, protected_snapshot(), {t: "Disabled" for t in GUARDED_TASKS}, digests)
                if options.stage in ("embed", "all"):
                    digest = digests[EMBED_MODEL]
                    checks = [0]
                    def between():
                        checks[0] += 1
                        if checks[0] % WORKLOAD_CHECK_EVERY == 0:
                            waiting = workload_reason(competing_workload())
                            if waiting:
                                raise Refused(waiting)
                    try:
                        embedded = embed_pending(connection, run_id, EMBED_MODEL, digest, options.batch_size, between=between, max_batches=options.max_batches)
                    except Refused as error:
                        embedded = {**embedded, "stopped": error.code}
            except KeyboardInterrupt:
                status_code = "INTERRUPTED_RESUMABLE"
            after = protected_snapshot()
            final_digests = model_digests()
            final_tasks = scheduled_task_states()
            assert_guards(before, after, final_tasks, final_digests)
            summary = database_summary(connection, EMBED_MODEL, digests[EMBED_MODEL])
        finally:
            connection.close()
    tally = Counter(r["outcome"] for r in results)
    report = {"step": 119, "run_id": run_id, "generated_utc": utc_now(), "mode": "STAGING_ONLY", "pipeline_version": PIPELINE_VERSION, "inventory": len(inventory), "this_run": dict(tally), "results": results, "embedding_run": embedded, "database": summary,
              "protected_before": before["protected"], "protected_after": after, "protected_unchanged": before["protected"] == after, "scheduled_tasks": final_tasks, "guarded_model_digests": before["models"], "model_digests_unchanged": all(final_digests.get(m) == d for m, d in before["models"].items()),
              "knowledge_approval": False, "production_modified": False, "model_weights_modified": False, "stop": status_code or embedded.get("stopped")}
    report["status"] = "INCOMPLETE" if report["stop"] else "PASS"
    write_atomic(REPORT, report)
    print(json.dumps({"status": report["status"], "this_run": dict(tally), "embedding_run": embedded, "documents": summary["documents"], "chunks": summary["chunks"], "embeddings": summary["embeddings"], "stop": report["stop"]}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SafetyStop as error:
        print(json.dumps({"status": "SAFETY_STOP", "code": str(error)}))
        sys.exit(4)
    except Refused as error:
        print(json.dumps({"status": "REFUSED", "code": error.code}))
        sys.exit(2)
