import hashlib
import html.parser
import ipaddress
import json
import re
import socket
import ssl
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"D:\TaxGuard\Development\123\local-ai\rag")
CONFIG = ROOT / "autonomous/config/authoritative_research_curriculum.json"
REPORT = ROOT / "autonomous/reports/research_candidates_latest.json"

ALLOWED_HOSTS = {
    "www.irs.gov",
    "www.nist.gov",
    "nvlpubs.nist.gov",
    "home.treasury.gov",
    "www.ecfr.gov",
    "uscode.house.gov",
    "www.fasb.org",
}

MAX_HTML_BYTES = 1_000_000
MAX_LINKS_PER_PAGE = 200

KEYWORDS = (
    "tax", "income", "1040", "publication",
    "efile", "e-file", "security", "privacy",
    "accounting", "financial", "risk",
    "artificial intelligence", "nist",
    "audit", "compliance", "form", "instruction",
)

class LinkCollector(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.current = None
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "a":
            attributes = dict(attrs)
            self.current = attributes.get("href")
            self.text = []

    def handle_data(self, data):
        if self.current is not None:
            self.text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self.current:
            self.links.append((
                self.current,
                " ".join(self.text).strip()
            ))
            self.current = None
            self.text = []

def validate_url(url):
    parsed = urllib.parse.urlsplit(url)

    if (
        parsed.scheme != "https"
        or parsed.hostname not in ALLOWED_HOSTS
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port not in (None, 443)
    ):
        raise ValueError("URL outside authorized domains")

    return parsed

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def fetch_page(url):
    parsed = validate_url(url)

    # Resolve and reject non-public destinations.
    addresses = socket.getaddrinfo(
        parsed.hostname, 443, type=socket.SOCK_STREAM
    )

    if not addresses:
        raise ValueError("No DNS addresses")

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("Non-public DNS result")

    # Discovery only. No authentication, scripts, or forms.
    opener = urllib.request.build_opener(NoRedirect)

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "OPHIR-Research-Discovery/1.0",
            "Accept": "text/html",
        }
    )

    with opener.open(request, timeout=25) as response:
        if response.geturl() != url:
            raise ValueError("Redirect not permitted")

        content_type = response.headers.get(
            "Content-Type", ""
        ).lower()

        if "text/html" not in content_type:
            return None

        raw = response.read(MAX_HTML_BYTES + 1)

        if len(raw) > MAX_HTML_BYTES:
            raise ValueError("HTML size limit exceeded")

        charset = response.headers.get_content_charset()
        return raw.decode(charset or "utf-8", errors="replace")

def main():
    config = json.loads(
        CONFIG.read_text(encoding="utf-8-sig")
    )

    if config.get("mode") != "AUTONOMOUS_RESEARCH_STAGING_ONLY":
        raise ValueError("Unsafe research mode")

    policies = config["policies"]

    if (
        policies.get("prohibit_self_approval") is not True
        or policies.get("prohibit_production_changes") is not True
    ):
        raise ValueError("Required safety policy missing")

    if config["discovery_policy"].get(
        "allow_automatic_source_expansion"
    ) is not False:
        raise ValueError("Automatic source expansion prohibited")

    candidates = []
    errors = []
    inspected = 0
    seen = set()

    for domain in config["research_domains"]:
        for url in domain["official_urls"]:
            try:
                parsed = validate_url(url)

                # The approved starting points are inspected only
                # one level deep. No recursive web crawling.
                if parsed.path.lower().endswith(".pdf"):
                    continue

                page = fetch_page(url)

                if page is None:
                    continue

                inspected += 1
                collector = LinkCollector()
                collector.feed(page)

                for href, label in collector.links[:MAX_LINKS_PER_PAGE]:
                    absolute = urllib.parse.urljoin(url, href)
                    parts = urllib.parse.urlsplit(absolute)

                    # Normalize fragments only.
                    absolute = urllib.parse.urlunsplit((
                        parts.scheme, parts.netloc,
                        parts.path, parts.query, ""
                    ))

                    try:
                        validate_url(absolute)
                    except ValueError:
                        continue

                    description = (
                        label + " " + parts.path
                    ).lower()

                    if not any(
                        word in description
                        for word in KEYWORDS
                    ):
                        continue

                    if not parts.path.lower().endswith(".pdf"):
                        continue

                    key = (domain["id"], absolute)

                    if key in seen:
                        continue

                    seen.add(key)

                    candidates.append({
                        "research_domain": domain["id"],
                        "priority": domain["priority"],
                        "title": label[:200],
                        "url": absolute,
                        "discovered_from": url,
                        "status": "CANDIDATE_UNVERIFIED",
                        "approval": "NOT_APPROVED",
                    })

            except Exception as error:
                errors.append({
                    "research_domain": domain["id"],
                    "url": url,
                    "error": (
                        type(error).__name__ + ": " + str(error)
                    )[:300],
                })

    report = {
        "generated_utc": datetime.now(
            timezone.utc
        ).isoformat(),
        "mode": "STAGING_ONLY",
        "pages_inspected": inspected,
        "candidate_count": len(candidates),
        "candidates": candidates,
        "source_errors": errors,
        "automatic_downloads": False,
        "knowledge_approval": False,
        "production_modified": False,
    }

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8"
    )

    print("OPHIR STEP 116 — RESEARCH DISCOVERY")
    print("=" * 50)
    print("Official pages inspected:", inspected)
    print("Research candidates:", len(candidates))
    print("Source errors:", len(errors))
    print("Report:", REPORT)

    for candidate in candidates[:15]:
        print(
            candidate["research_domain"],
            candidate["title"][:75],
            candidate["url"]
        )

    if errors:
        print("SOURCE ERRORS:")
        for error in errors:
            print(error["url"], error["error"])

    print("NO AUTOMATIC DOWNLOAD OR APPROVAL")
    print("NO PRODUCTION MODIFICATIONS")

    if inspected == 0:
        raise SystemExit(
            "FAIL: No official HTML sources inspected"
        )

    print("OPHIR STEP 116 DISCOVERY COMPLETE")

if __name__ == "__main__":
    main()
