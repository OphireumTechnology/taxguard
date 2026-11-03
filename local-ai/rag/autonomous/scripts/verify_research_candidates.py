"""TaxGuard AI Step 117: verify research candidates. Downloads nothing, approves nothing and writes to no database.

Decides which discovered candidates may go on to controlled acquisition (Step 118). A URL that passes these checks is only
eligible to be fetched: authenticity stays NOT_ESTABLISHED, because nothing has been downloaded or hashed. Tax year, publication
date, effective date and version stay UNKNOWN unless the source states them; they are never guessed.

  python verify_research_candidates.py            with a metadata-only HEAD probe of each unique URL
  python verify_research_candidates.py --no-probe URL and curriculum checks only; nothing can become eligible
"""
import argparse
import hashlib
import ipaddress
import json
import os
import posixpath
import re
import socket
import sqlite3
import ssl
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

AUTONOMOUS = Path(__file__).resolve().parents[1]
CANDIDATES = AUTONOMOUS / "reports/research_candidates_latest.json"
CURRICULUM = AUTONOMOUS / "config/authoritative_research_curriculum.json"
REPORT = AUTONOMOUS / "reports/research_verification_latest.json"
DECISIONS = AUTONOMOUS / "config/candidate_decisions.json"
STATE = AUTONOMOUS / "state"
PROTECTED = ("taxguard_semantic_memory.sqlite3", "learning_staging.sqlite3", "learning_extraction.sqlite3", "learning_embeddings.sqlite3")

# Fixed here on purpose: discovery output can never add a host. Each host may serve documents only under these paths.
SOURCES = {
    "www.irs.gov": {"organization": "Internal Revenue Service", "document_paths": ("/pub/irs-pdf/", "/pub/irs-prior/", "/pub/irs-drop/", "/pub/irs-irbs/")},
    "www.nist.gov": {"organization": "National Institute of Standards and Technology", "document_paths": ("/system/files/documents/",)},
    "nvlpubs.nist.gov": {"organization": "National Institute of Standards and Technology", "document_paths": ("/nistpubs/",)},
    "home.treasury.gov": {"organization": "U.S. Department of the Treasury", "document_paths": ("/system/files/",)},
    "www.ecfr.gov": {"organization": "Electronic Code of Federal Regulations", "document_paths": ()},
    "uscode.house.gov": {"organization": "Office of the Law Revision Counsel, U.S. House of Representatives", "document_paths": ()},
    "www.fasb.org": {"organization": "Financial Accounting Standards Board", "document_paths": ()},
}

# Documents the curriculum names as required. A gap here is reported, never filled by guessing a URL.
REQUIRED_DOCUMENTS = {
    "https://www.irs.gov/pub/irs-pdf/f1040.pdf": "Form 1040",
    "https://www.irs.gov/pub/irs-pdf/i1040gi.pdf": "Instructions for Form 1040",
    "https://www.irs.gov/pub/irs-pdf/p1345.pdf": "Publication 1345",
    "https://www.irs.gov/pub/irs-pdf/p4163.pdf": "Publication 4163",
    "https://www.irs.gov/pub/irs-pdf/p4164.pdf": "Publication 4164",
    "https://www.irs.gov/pub/irs-pdf/p4557.pdf": "Publication 4557",
    "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf": "NIST AI RMF 1.0",
    "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf": "NIST AI 600-1",
}

# Curriculum topic to the words that show a document concerns it. No match means a person decides, not that it is irrelevant.
TOPIC_TERMS = {
    "Individual income tax": r"1040|individual",
    "Business taxation": r"\bform 941\b|\bss-4\b|employer|business",
    "Deductions and credits": r"deduction|credit|schedule 1-a|schedule 3",
    "Tax forms and instructions": r"\bform\b|\binstructions?\b",
    "Federal tax legislation": r"public law|legislation",
    "Treasury regulations": r"regulation|treasury",
    "Form 1040": r"1040",
    "Schedules and attachments": r"schedule",
    "W-2 and 1099": r"\bw-2\b|\b1099",
    "Tax calculations": r"tax table|computation|calculation",
    "Return validation": r"validation|assurance testing",
    "Preparer due diligence": r"due diligence|\b8867\b",
    "Publication 1345": r"publication 1345",
    "Publication 4163": r"publication 4163",
    "Publication 4164": r"publication 4164",
    "E-file authorization": r"e-file|\b8879\b",
    "Modernized e-File": r"modernized e-file",
    "Assurance testing": r"assurance testing",
    "AI risk management": r"\bai\b.*risk|risk management framework|\bai rmf\b",
    "Model evaluation": r"model evaluation",
    "Evidence-based reasoning": r"evidence",
    "Human oversight": r"human oversight",
    "Prompt injection defense": r"prompt injection",
    "Auditability": r"audit",
    "Taxpayer data protection": r"publication 4557|safeguarding",
    "Access controls": r"access control",
    "Encryption": r"encryption",
    "Incident response": r"incident",
    "Information security": r"security|cybersecurity",
    "Bookkeeping": r"bookkeeping",
    "General ledger": r"general ledger",
    "Reconciliation": r"reconciliation",
    "Financial statements": r"financial statement",
    "Accounting standards": r"accounting standard",
}
SEED_TITLES = {
    "https://www.irs.gov/pub/irs-pdf/p4557.pdf": "Publication 4557, Safeguarding Taxpayer Data",
    "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf": "NIST AI 600-1, AI Risk Management Framework: Generative AI Profile",
}
LANGUAGE_VARIANT = re.compile(r"(\.(ara|jpn|kor|chi|spa|por|fre|ger)\.pdf$)|(sp\.pdf$)|(\(sp\))", re.I)
IRS_CURRENT = "/pub/irs-pdf/"
IRS_PRIOR_YEAR = re.compile(r"^/pub/irs-prior/[^/]+--(\d{4})\.pdf$", re.I)


def _read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def _sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize_url(raw):
    """Returns (normalized_url, None) or (None, reason). Refuses anything that could mean a different host or path."""
    if not isinstance(raw, str) or not raw or raw != raw.strip() or any(ord(c) < 33 or ord(c) == 127 for c in raw) or "\\" in raw:
        return None, "URL_MALFORMED"
    try:
        parts = urllib.parse.urlsplit(raw)
        port = parts.port
        host = parts.hostname
    except ValueError:
        return None, "URL_MALFORMED"
    if parts.scheme.lower() != "https":
        return None, "NOT_HTTPS"
    if parts.username is not None or parts.password is not None:
        return None, "URL_HAS_CREDENTIALS"
    if port not in (None, 443):
        return None, "PORT_NOT_ALLOWED"
    if not host or host.lower() not in SOURCES:
        return None, "HOST_NOT_AUTHORIZED"
    if parts.query:
        return None, "QUERY_NOT_ALLOWED"
    path = parts.path
    if "%" in path:
        return None, "ENCODED_PATH_NOT_ALLOWED"
    if posixpath.normpath(path) != path or "//" in path:
        return None, "PATH_NOT_CANONICAL"
    return urllib.parse.urlunsplit(("https", host.lower(), path, "", "")), None


def document_type(url, title):
    name = posixpath.basename(urllib.parse.urlsplit(url).path).lower()
    text = (title or "").lower()
    if not name.endswith(".pdf"):
        return "NOT_PDF"
    if "instruction" in text or re.match(r"^i[a-z0-9]", name) and "instruction" in text:
        return "INSTRUCTIONS"
    if text.startswith("publication") or "tax table" in text or re.match(r"^p\d", name):
        return "PUBLICATION"
    if text.startswith("form") or re.match(r"^f[a-z0-9]", name):
        return "FORM"
    if "nist" in name:
        return "STANDARD_OR_FRAMEWORK"
    return "PDF_UNCLASSIFIED"


def tax_year_status(url):
    path = urllib.parse.urlsplit(url).path
    match = IRS_PRIOR_YEAR.match(path)
    if match:
        return {"tax_year": "UNKNOWN", "url_revision_year": int(match.group(1)), "ambiguity": "URL_STATES_REVISION_YEAR_NOT_TAX_YEAR"}
    if path.startswith(IRS_CURRENT):
        return {"tax_year": "UNKNOWN", "url_revision_year": None, "ambiguity": "CURRENT_REVISION_URL_CONTENT_CAN_CHANGE_WITHOUT_URL_CHANGE"}
    return {"tax_year": "NOT_APPLICABLE_OR_UNKNOWN", "url_revision_year": None, "ambiguity": "NO_TAX_YEAR_IN_URL"}


def matched_topics(title, url, domains):
    text = (title or "").lower() + " " + posixpath.basename(urllib.parse.urlsplit(url).path).lower()
    found = []
    for domain in domains:
        for topic in domain.get("topics", []):
            pattern = TOPIC_TERMS.get(topic)
            if pattern and re.search(pattern, text) and topic not in found:
                found.append(topic)
    return found


def _public_addresses(host):
    addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    if not addresses:
        raise ValueError("no addresses")
    for address in addresses:
        if not ipaddress.ip_address(address[4][0]).is_global:
            raise ValueError("non-public address")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def probe_url(url, resolver=_public_addresses, opener=None, timeout=20):
    """One HEAD request: certificate verified, no redirect followed, no body read. A refusal is recorded, never worked around."""
    try:
        resolver(urllib.parse.urlsplit(url).hostname)
    except Exception:
        return {"outcome": "DNS_REFUSED"}
    if opener is None:
        opener = urllib.request.build_opener(_NoRedirect, urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "TaxGuardAI-Research-Verification/1.0", "Accept": "application/pdf"})
    try:
        with opener.open(request, timeout=timeout) as response:
            headers = response.headers
            length = headers.get("Content-Length")
            return {"outcome": "OK", "http_status": response.status, "content_type": (headers.get("Content-Type") or "").split(";")[0].strip().lower(),
                    "content_length": int(length) if length and length.isdigit() else None, "last_modified": headers.get("Last-Modified"), "etag": headers.get("ETag")}
    except urllib.error.HTTPError as error:
        location = error.headers.get("Location") if 300 <= error.code < 400 else None
        return {"outcome": "REDIRECT_NOT_FOLLOWED" if location else "ACCESS_REFUSED" if error.code in (401, 403, 451) else "HTTP_ERROR", "http_status": error.code, "redirect_location": location}
    except Exception as error:
        return {"outcome": "UNREACHABLE", "error_type": type(error).__name__}


def existing_versions(state_dir=STATE):
    """url -> recorded hashes, read-only. An unreadable database is reported rather than treated as having no versions."""
    versions, problems = {}, []
    for database, table, url_column, hash_column in (("learning_staging.sqlite3", "discovered_documents", "source_url", "sha256"),
                                                     ("taxguard_semantic_memory.sqlite3", "knowledge_chunks", "source_url", "source_sha256")):
        path = Path(state_dir) / database
        try:
            connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
            try:
                for url, digest in connection.execute(f"SELECT DISTINCT {url_column}, {hash_column} FROM {table}"):
                    versions.setdefault(url, set()).add((database, digest))
            finally:
                connection.close()
        except sqlite3.Error as error:
            problems.append({"database": database, "error_type": type(error).__name__})
    return {url: [{"database": d, "sha256": h} for d, h in sorted(rows)] for url, rows in versions.items()}, problems


def _authorized_starts(curriculum):
    return {url for domain in curriculum["research_domains"] for url in domain.get("official_urls", [])}


def seed_candidates(curriculum):
    """Curriculum seed URLs that are themselves PDFs: discovery only follows links from HTML pages, so it can never list these."""
    seeds = []
    for domain in curriculum["research_domains"]:
        for url in domain.get("official_urls", []):
            if urllib.parse.urlsplit(url).path.lower().endswith(".pdf"):
                seeds.append({"research_domain": domain["id"], "priority": domain["priority"], "title": SEED_TITLES.get(url, posixpath.basename(url)), "url": url,
                              "discovered_from": url, "origin": "CURRICULUM_SEED", "status": "CANDIDATE_UNVERIFIED", "approval": "NOT_APPROVED"})
    return seeds


def apply_decisions(url, language, reasons, result_probe, decisions):
    """Returns (excluded, applied). A decision can clear a named reason only; it can never make a URL pass the host and path rules."""
    applied = []
    if not decisions:
        return False, applied
    if url in decisions.get("exclude", {}):
        return True, [{"decision": "EXCLUDE", "reason": decisions["exclude"][url]}]
    if language and decisions.get("exclude_language_variants") is True:
        return True, [{"decision": "EXCLUDE_LANGUAGE_VARIANT", "reason": "Owner: English editions only for now."}]
    if url in decisions.get("accept_relevance", {}) and "RELEVANCE_NOT_ESTABLISHED" in reasons:
        reasons.remove("RELEVANCE_NOT_ESTABLISHED")
        applied.append({"decision": "ACCEPT_RELEVANCE", "reason": decisions["accept_relevance"][url]})
    if url in decisions.get("allow_get_after_head_failure", {}) and "PROBE_HTTP_ERROR" in reasons and (result_probe or {}).get("http_status") in (404, 405):
        reasons.remove("PROBE_HTTP_ERROR")
        applied.append({"decision": "ALLOW_GET_AFTER_HEAD_FAILURE", "reason": decisions["allow_get_after_head_failure"][url]})
    return False, applied


def verify(candidates_report, curriculum, versions, probe=None, pause=0.0, sleep=time.sleep, decisions=None):
    domains = {d["id"]: d for d in curriculum["research_domains"]}
    starts = _authorized_starts(curriculum)
    groups, rejected = {}, []
    for index, candidate in enumerate(candidates_report.get("candidates", [])):
        url, reason = normalize_url(candidate.get("url"))
        if reason is None and not urllib.parse.urlsplit(url).path.lower().endswith(".pdf"):
            reason = "NOT_A_PDF_URL"
        if reason is None and not urllib.parse.urlsplit(url).path.startswith(SOURCES[urllib.parse.urlsplit(url).hostname]["document_paths"] or ("\0",)):
            reason = "PATH_NOT_AUTHORIZED_FOR_HOST"
        if reason:
            rejected.append({"candidate_index": index, "url": candidate.get("url"), "disposition": "REJECTED", "reason": reason})
            continue
        group = groups.setdefault(url, {"url": url, "candidate_indexes": [], "research_domains": [], "titles": [], "discovered_from": [], "priorities": []})
        group["candidate_indexes"].append(index)
        for key, value in (("research_domains", candidate.get("research_domain")), ("titles", candidate.get("title")), ("discovered_from", candidate.get("discovered_from")), ("priorities", candidate.get("priority"))):
            if value and value not in group[key]:
                group[key].append(value)

    results = []
    for number, (url, group) in enumerate(groups.items()):
        reasons = []
        title = group["titles"][0] if group["titles"] else ""
        if len(group["titles"]) > 1:
            reasons.append("CONFLICTING_TITLES")
        unknown_domains = [d for d in group["research_domains"] if d not in domains]
        if unknown_domains or not group["research_domains"]:
            reasons.append("RESEARCH_DOMAIN_NOT_IN_CURRICULUM")
        if not group["discovered_from"] or any(source not in starts for source in group["discovered_from"]):
            reasons.append("DISCOVERED_FROM_NOT_AN_APPROVED_PAGE")
        kind = document_type(url, title)
        if kind == "PDF_UNCLASSIFIED":
            reasons.append("DOCUMENT_TYPE_UNCLASSIFIED")
        language = bool(LANGUAGE_VARIANT.search(url) or LANGUAGE_VARIANT.search(title))
        if language:
            reasons.append("LANGUAGE_VARIANT_NEEDS_DECISION")
        topics = matched_topics(title, url, [domains[d] for d in group["research_domains"] if d in domains])
        if not topics:
            reasons.append("RELEVANCE_NOT_ESTABLISHED")
        result_probe = None
        if probe is None:
            reasons.append("PROBE_NOT_RUN")
        else:
            if number and pause:
                sleep(pause)
            result_probe = probe(url)
            if result_probe["outcome"] != "OK":
                reasons.append("PROBE_" + result_probe["outcome"])
            elif result_probe.get("content_type") != "application/pdf":
                reasons.append("PROBE_CONTENT_TYPE_NOT_PDF")
        host = urllib.parse.urlsplit(url).hostname
        excluded, applied = apply_decisions(url, language, reasons, result_probe, decisions)
        results.append({**group, "title": title, "document_type": kind, "language_variant": language, "matched_topics": topics, "owner_decisions": applied,
            "disposition": "EXCLUDED_BY_OWNER" if excluded else "NEEDS_REVIEW" if reasons else "ELIGIBLE_FOR_ACQUISITION", "reasons": reasons, "probe": result_probe, "existing_versions": versions.get(url, []),
            "provenance": {"source_organization": SOURCES[host]["organization"], "original_url": url, "document_title": title, "publication_date": "UNKNOWN", "effective_date": "UNKNOWN",
                           **tax_year_status(url), "retrieval_timestamp": None, "sha256": None, "document_version": "UNKNOWN",
                           "research_category": group["research_domains"], "validation_status": "URL_AND_METADATA_CHECKED_ONLY", "authenticity": "NOT_ESTABLISHED", "approval_status": "NOT_APPROVED"}})
    return results, rejected


def coverage(curriculum, results, versions, source_errors):
    listed = {r["url"] for r in results}
    gaps = [{"document": name, "url": url, "state": "ALREADY_IN_STAGING" if url in versions else "NOT_A_CANDIDATE"} for url, name in REQUIRED_DOCUMENTS.items() if url not in listed]
    domains = {}
    for domain in curriculum["research_domains"]:
        count = sum(1 for r in results if domain["id"] in r["research_domains"])
        domains[domain["id"]] = {"priority": domain["priority"], "unique_candidates": count}
    pdf_seeds = sorted(u for u in _authorized_starts(curriculum) if urllib.parse.urlsplit(u).path.lower().endswith(".pdf"))
    restrictions = []
    for item in source_errors:
        text = str(item.get("error", ""))
        restrictions.append({"url": item.get("url"), "research_domain": item.get("research_domain"), "recorded_error": text[:200],
                             "handling": "ACCESS_REFUSED_NOT_BYPASSED" if "403" in text else "REDIRECT_NOT_FOLLOWED_NOT_BYPASSED" if "302" in text else "RECORDED"})
    return {"required_documents_not_listed": gaps, "domains": domains, "pdf_seed_urls_skipped_by_discovery": pdf_seeds, "known_access_restrictions": restrictions}


def write_atomic(path, payload):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(dir=path.parent, prefix=path.name + ".", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(payload, stream, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    except BaseException:
        if os.path.exists(temporary):
            os.unlink(temporary)
        raise


def safety_failures(report):
    """Independent checks over the finished report. Any failure means Step 117 did not pass."""
    failures = []
    for flag in ("automatic_downloads", "knowledge_approval", "production_modified", "documents_downloaded_flag"):
        if report.get(flag) is not False:
            failures.append(flag)
    all_rows = report["verified"] + report["rejected"]
    if report["input_candidate_count"] != sum(len(r["candidate_indexes"]) for r in report["verified"]) + len(report["rejected"]):
        failures.append("candidates_not_all_accounted_for")
    for row in report["verified"]:
        p = row["provenance"]
        if p["approval_status"] != "NOT_APPROVED" or p["authenticity"] != "NOT_ESTABLISHED" or p["sha256"] is not None or p["retrieval_timestamp"] is not None:
            failures.append("provenance_overstated:" + row["url"])
        if row["disposition"] == "ELIGIBLE_FOR_ACQUISITION" and (row["reasons"] or not row["probe"] or (row["probe"]["outcome"] != "OK" and not any(d["decision"] == "ALLOW_GET_AFTER_HEAD_FAILURE" for d in row.get("owner_decisions", [])))):
            failures.append("eligible_without_passing:" + row["url"])
    if len({r["url"] for r in report["verified"]}) != len(report["verified"]):
        failures.append("duplicate_rows")
    if report["protected_hashes_before"] != report["protected_hashes_after"]:
        failures.append("protected_state_changed")
    if any(r["disposition"] not in ("ELIGIBLE_FOR_ACQUISITION", "NEEDS_REVIEW", "EXCLUDED_BY_OWNER", "REJECTED") for r in all_rows):
        failures.append("unknown_disposition")
    return failures


def main(argv=None):
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--no-probe", action="store_true")
    options = arguments.parse_args(argv)
    before = {name: _sha256(STATE / name) for name in PROTECTED}
    source = _read_json(CANDIDATES)
    curriculum = _read_json(CURRICULUM)
    versions, version_problems = existing_versions()
    decisions = _read_json(DECISIONS) if DECISIONS.exists() else None
    known = {c.get("url") for c in source.get("candidates", [])}
    seeds = [c for c in seed_candidates(curriculum) if c["url"] not in known]
    source = {**source, "candidates": list(source.get("candidates", [])) + seeds}
    results, rejected = verify(source, curriculum, versions, None if options.no_probe else probe_url, pause=1.0, decisions=decisions)
    count = lambda disposition: sum(1 for r in results if r["disposition"] == disposition)
    report = {
        "step": 117, "generated_utc": datetime.now(timezone.utc).isoformat(), "mode": "STAGING_ONLY",
        "input": {"path": CANDIDATES.name, "sha256": _sha256(CANDIDATES), "generated_utc": source.get("generated_utc")},
        "probe_run": not options.no_probe, "input_candidate_count": len(source.get("candidates", [])), "unique_urls": len(results),
        "duplicates_merged": len(source.get("candidates", [])) - len(rejected) - len(results),
        "summary": {"eligible_for_acquisition": count("ELIGIBLE_FOR_ACQUISITION"), "needs_review": count("NEEDS_REVIEW"), "excluded_by_owner": count("EXCLUDED_BY_OWNER"), "rejected": len(rejected)},
        "curriculum_seed_candidates_added": [c["url"] for c in seeds], "owner_decisions_applied": decisions is not None,
        "meaning_of_eligible": "May be fetched into quarantine by Step 118. Not authenticated, not reviewed and not approved.",
        "coverage": coverage(curriculum, results, versions, source.get("source_errors", [])), "existing_version_read_problems": version_problems,
        "verified": results, "rejected": rejected,
        "automatic_downloads": False, "documents_downloaded_flag": False, "knowledge_approval": False, "production_modified": False,
        "protected_hashes_before": before, "protected_hashes_after": {name: _sha256(STATE / name) for name in PROTECTED},
    }
    failures = safety_failures(report)
    report["safety_failures"] = failures
    report["status"] = "FAIL" if failures else "PASS"
    write_atomic(REPORT, report)
    print(json.dumps({"status": report["status"], "input_candidates": report["input_candidate_count"], "unique_urls": report["unique_urls"], "duplicates_merged": report["duplicates_merged"], **report["summary"], "safety_failures": failures}))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
