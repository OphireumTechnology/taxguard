"""Step 121: SEC source adapter, built and left disabled. Nothing runs it, and it makes no request until every activation condition below is met.

SEC.gov's published rules ask automated tools to declare who they are, with a company name and admin contact email in the user agent, and to stay under a maximum request rate. This adapter identifies
itself that way and stays far below that rate. It treats 403 as a refusal to respect, never a problem to work around: it stops, and it does not retry, change its identity or change its address.
Activation needs an organization-controlled contact confirmed as monitored, official guidance confirmed by a person, the owner's activation and the registry entry being ACTIVE.
Anything acquired goes to staging as NOT_APPROVED with its provenance. Nothing here approves knowledge.
"""
import hashlib
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

CONFIG_TEMPLATE = Path(__file__).resolve().parents[1] / "config/sec_source.example.json"
SOURCE_ID = "SEC"
# One request a second is well under the 10 a second SEC.gov publishes as its maximum. Not a limit to tune upward.
MIN_INTERVAL_SECONDS = 1.0
MAX_REQUESTS_PER_RUN = 100
MAX_RETRY_AFTER_SECONDS = 600
MAX_RETRIES = 2
MAX_BYTES = 50 * 1024 * 1024
EMAIL = re.compile(r"^[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$", re.I)
PERSONAL_DOMAINS = frozenset("gmail.com googlemail.com yahoo.com ymail.com outlook.com hotmail.com live.com msn.com icloud.com me.com aol.com proton.me protonmail.com gmx.com mail.com zoho.com".split())
RESERVED_SUFFIXES = (".example", ".test", ".invalid", ".localhost")
RESERVED_DOMAINS = ("example.com", "example.org", "example.net")


class SecAccessStop(Exception):
    """Refused or stopped. The code says why. There is no override."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


def contact_problem(contact):
    """Only an organization-controlled mailbox is accepted. This checks the form; a person confirms it is authorized and monitored."""
    match = EMAIL.match(contact or "")
    if not match:
        return "CONTACT_MISSING_OR_INVALID"
    domain = match.group(1).lower()
    if domain in PERSONAL_DOMAINS:
        return "CONTACT_IS_A_PERSONAL_ADDRESS"
    if domain.endswith(RESERVED_SUFFIXES) or any(domain == d or domain.endswith("." + d) for d in RESERVED_DOMAINS):
        return "CONTACT_IS_A_PLACEHOLDER"
    return None


def activation_problems(config, registry):
    """Every reason the adapter may not run. It runs only when this is empty."""
    problems = []
    if config.get("enabled") is not True:
        problems.append("ADAPTER_DISABLED")
    if not str(config.get("organization") or "").strip():
        problems.append("ORGANIZATION_MISSING")
    problem = contact_problem(config.get("contact_email"))
    if problem:
        problems.append(problem)
    for field, code in (("guidance_verified_on", "OFFICIAL_GUIDANCE_NOT_VERIFIED"), ("contact_verified_on", "CONTACT_NOT_VERIFIED_AS_MONITORED"), ("owner_activation_on", "OWNER_HAS_NOT_ACTIVATED")):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(config.get(field) or "")):
            problems.append(code)
    source = next((s for s in registry["sources"] if s["id"] == SOURCE_ID), None)
    if not source or source["status"] != "ACTIVE" or source["access"] != "OPEN_PUBLIC" or not source["document_paths"]:
        problems.append("REGISTRY_ENTRY_NOT_ACTIVE")
    return problems


def load_config(path=CONFIG_TEMPLATE):
    return json.loads(Path(path).read_text(encoding="utf-8"))


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


class SecClient:
    def __init__(self, config, registry, fetch_decision, opener=None, clock=time.monotonic, sleep=time.sleep, now=lambda: datetime.now(timezone.utc)):
        self.config, self.registry, self.fetch_decision = config, registry, fetch_decision
        self.opener = opener or urllib.request.build_opener(_NoRedirect)
        self.clock, self.sleep, self.now = clock, sleep, now
        self.stopped = None
        self.requests = 0
        self.last = None

    @property
    def user_agent(self):
        return f"{self.config['organization'].strip()} TaxGuardAI-Research {self.config['contact_email'].strip()}"

    def _send(self, url):
        if self.requests >= MAX_REQUESTS_PER_RUN:
            self.stopped = "REQUEST_BUDGET_REACHED"
            raise SecAccessStop(self.stopped)
        if self.last is not None:
            wait = MIN_INTERVAL_SECONDS - (self.clock() - self.last)
            if wait > 0:
                self.sleep(wait)
        self.requests += 1
        self.last = self.clock()
        request = urllib.request.Request(url, headers={"User-Agent": self.user_agent, "Host": "www.sec.gov"})
        return self.opener.open(request, timeout=60)

    def get(self, url):
        """Returns the body and its provenance, or raises SecAccessStop. After a stop, every later call is refused without a request."""
        if self.stopped:
            raise SecAccessStop(self.stopped)
        problems = activation_problems(self.config, self.registry)
        if problems:
            raise SecAccessStop(problems[0])
        allowed, code, source = self.fetch_decision(url, self.registry)
        if not allowed or source != SOURCE_ID:
            raise SecAccessStop(code if not allowed else "NOT_AN_SEC_SOURCE")
        for attempt in range(MAX_RETRIES + 1):
            try:
                with self._send(url) as response:
                    if response.status != 200:
                        self.stopped = f"UNEXPECTED_STATUS_{response.status}"
                        raise SecAccessStop(self.stopped)
                    body = response.read(MAX_BYTES + 1)
                if len(body) > MAX_BYTES:
                    raise SecAccessStop("DOCUMENT_TOO_LARGE")
                return body, {"source_id": SOURCE_ID, "publisher": "U.S. Securities and Exchange Commission", "source_url": url, "retrieved_utc": self.now().isoformat(), "sha256": hashlib.sha256(body).hexdigest(), "approval_status": "NOT_APPROVED", "stage": "STAGING_QUARANTINE"}
            except urllib.error.HTTPError as error:
                if error.code == 403:
                    self.stopped = "ACCESS_DENIED_403"
                    raise SecAccessStop(self.stopped) from None
                if error.code not in (429, 503):
                    self.stopped = f"UNEXPECTED_STATUS_{error.code}"
                    raise SecAccessStop(self.stopped) from None
                retry_after = str(error.headers.get("Retry-After") or "").strip() if error.headers else ""
                if not retry_after.isdigit() or int(retry_after) > MAX_RETRY_AFTER_SECONDS or attempt == MAX_RETRIES:
                    self.stopped = f"BACK_OFF_REQUIRED_{error.code}"
                    raise SecAccessStop(self.stopped) from None
                self.sleep(int(retry_after))
            except urllib.error.URLError:
                self.stopped = "NETWORK_FAILURE"
                raise SecAccessStop(self.stopped) from None
        self.stopped = "RETRIES_EXHAUSTED"
        raise SecAccessStop(self.stopped)
