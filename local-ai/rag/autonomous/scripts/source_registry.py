"""Step 121.02: the controlled research source registry. Decides whether a URL may be fetched and reports coverage. It fetches nothing and approves nothing.

A source can be fetched only when it is ACTIVE, OPEN_PUBLIC and has document paths. Hosts match exactly; a look-alike or subdomain is refused.
"""
import json
import urllib.parse
from pathlib import Path

REGISTRY = Path(__file__).resolve().parents[1] / "config/research_source_registry.json"
STATUSES = {"ACTIVE", "PROPOSED", "BLOCKED"}
ACCESS = {"OPEN_PUBLIC", "ACCESS_TERMS_UNVERIFIED", "LICENSE_REQUIRED"}


class RegistryError(ValueError):
    pass


def validate(registry):
    """A registry that could let something through by mistake is refused outright, not partly used."""
    if registry.get("automatic_source_expansion") is not False:
        raise RegistryError("AUTOMATIC_EXPANSION_MUST_BE_OFF")
    seen, hosts = set(), set()
    for source in registry["sources"]:
        name = source["id"]
        if name in seen:
            raise RegistryError(f"DUPLICATE_SOURCE:{name}")
        seen.add(name)
        if source["status"] not in STATUSES or source["access"] not in ACCESS:
            raise RegistryError(f"UNKNOWN_STATE:{name}")
        if source["access"] == "LICENSE_REQUIRED" and source["status"] != "BLOCKED":
            raise RegistryError(f"LICENSED_SOURCE_NOT_BLOCKED:{name}")
        if source["status"] == "ACTIVE" and (source["access"] != "OPEN_PUBLIC" or not source["document_paths"] or not source["hosts"]):
            raise RegistryError(f"ACTIVE_SOURCE_INCOMPLETE:{name}")
        if source["status"] != "ACTIVE" and source["document_paths"]:
            raise RegistryError(f"INACTIVE_SOURCE_HAS_PATHS:{name}")
        for path in source["document_paths"]:
            if not path.startswith("/") or not path.endswith("/") or len(path) < 3:
                raise RegistryError(f"BROAD_DOCUMENT_PATH:{name}")
        for host in source["hosts"]:
            if host != host.lower() or "*" in host or "/" in host or host.count(".") < 1:
                raise RegistryError(f"BAD_HOST:{name}")
            if host in hosts:
                raise RegistryError(f"HOST_LISTED_TWICE:{host}")
            hosts.add(host)
    return registry


def load(path=REGISTRY):
    return validate(json.loads(Path(path).read_text(encoding="utf-8")))


def fetch_decision(url, registry):
    """Returns (allowed, code, source id). Unknown means refused."""
    try:
        parts = urllib.parse.urlsplit(url)
        port = parts.port
    except ValueError:
        return False, "MALFORMED_URL", None
    if parts.scheme != "https":
        return False, "NOT_HTTPS", None
    if parts.username or parts.password or port not in (None, 443):
        return False, "UNUSUAL_URL_AUTHORITY", None
    host = (parts.hostname or "").lower()
    path = urllib.parse.unquote(parts.path)
    if ".." in path.split("/"):
        return False, "PATH_TRAVERSAL", None
    for source in registry["sources"]:
        if host in source["hosts"]:
            if source["access"] == "LICENSE_REQUIRED":
                return False, "LICENSE_REQUIRED", source["id"]
            if source["status"] != "ACTIVE":
                return False, "SOURCE_NOT_ACTIVE", source["id"]
            if not any(path.startswith(prefix) for prefix in source["document_paths"]):
                return False, "PATH_NOT_ALLOWED", source["id"]
            return True, "ALLOWED", source["id"]
    return False, "HOST_NOT_IN_REGISTRY", None


def coverage(registry, staged_source_ids):
    """What the staged corpus holds against what the directive names. A gap is reported; it is not filled by guessing."""
    staged = set(staged_source_ids)
    documents = [{"source_id": d["source_id"], "title": d["title"], "staged": d["source_id"] in staged} for d in registry["named_documents"]]
    prefixes = {"IRS": "IRS_", "NIST_PUBS": "NIST_"}
    sources = []
    for source in registry["sources"]:
        prefix = prefixes.get(source["id"])
        sources.append({"id": source["id"], "category": source["category"], "status": source["status"], "access": source["access"], "staged_documents": sum(1 for s in staged if prefix and s.startswith(prefix))})
    return {"named_documents": documents, "named_missing": [d["source_id"] for d in documents if not d["staged"]], "sources": sources,
            "categories_without_staged_documents": sorted({s["category"] for s in sources} - {s["category"] for s in sources if s["staged_documents"]})}
