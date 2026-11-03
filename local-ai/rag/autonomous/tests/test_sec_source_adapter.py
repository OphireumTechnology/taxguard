import io
import sys
import unittest
import urllib.error
from datetime import datetime, timezone
from email.message import Message
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import sec_source_adapter as s
import source_registry

REAL = source_registry.load()
URL = "https://www.sec.gov/files/guide.pdf"


def active_registry():
    return {"automatic_source_expansion": False, "named_documents": [], "sources": [{"id": "SEC", "publisher": "P", "category": "ACCOUNTING", "authority_class": "A", "hosts": ["www.sec.gov"], "document_paths": ["/files/"], "status": "ACTIVE", "access": "OPEN_PUBLIC", "owner_approved_on": "2026-11-03", "notes": ""}]}


def ready(**changes):
    return {"enabled": True, "organization": "Ophireum Technology", "contact_email": "research@ophireum-example.org", "guidance_verified_on": "2026-12-01", "contact_verified_on": "2026-12-01", "owner_activation_on": "2026-12-01", **changes}


class Response(io.BytesIO):
    status = 200


def http_error(code, retry_after=None):
    headers = Message()
    if retry_after is not None:
        headers["Retry-After"] = retry_after
    return urllib.error.HTTPError(URL, code, "x", headers, None)


class Opener:
    def __init__(self, *results):
        self.results, self.requests = list(results), []

    def open(self, request, timeout=None):
        self.requests.append(request)
        result = self.results.pop(0) if self.results else Response(b"body")
        if isinstance(result, Exception):
            raise result
        return result


class Clock:
    def __init__(self):
        self.now, self.slept = 0.0, []

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.slept.append(seconds)
        self.now += seconds


def client(*results, config=None, registry=None):
    clock = Clock()
    opener = Opener(*results)
    return s.SecClient(config or ready(), registry or active_registry(), source_registry.fetch_decision, opener=opener, clock=clock, sleep=clock.sleep, now=lambda: datetime(2026, 12, 1, tzinfo=timezone.utc)), opener, clock


class StaysDisabled(unittest.TestCase):
    def test_the_shipped_settings_and_registry_cannot_run(self):
        problems = s.activation_problems(s.load_config(), REAL)
        for code in ("ADAPTER_DISABLED", "CONTACT_MISSING_OR_INVALID", "OFFICIAL_GUIDANCE_NOT_VERIFIED", "CONTACT_NOT_VERIFIED_AS_MONITORED", "OWNER_HAS_NOT_ACTIVATED", "REGISTRY_ENTRY_NOT_ACTIVE"):
            self.assertIn(code, problems)

    def test_the_shipped_registry_keeps_sec_off(self):
        sec = next(x for x in REAL["sources"] if x["id"] == "SEC")
        self.assertEqual((sec["status"], sec["document_paths"]), ("APPROVED_NOT_ENABLED", []))
        self.assertIn("REGISTRY_ENTRY_NOT_ACTIVE", s.activation_problems(ready(), REAL))

    def test_no_request_is_made_while_disabled(self):
        c, opener, _ = client(config=s.load_config(), registry=REAL)
        with self.assertRaises(s.SecAccessStop):
            c.get(URL)
        self.assertEqual(opener.requests, [])

    def test_every_condition_is_required(self):
        for field, code in (("enabled", "ADAPTER_DISABLED"), ("organization", "ORGANIZATION_MISSING"), ("guidance_verified_on", "OFFICIAL_GUIDANCE_NOT_VERIFIED"), ("contact_verified_on", "CONTACT_NOT_VERIFIED_AS_MONITORED"), ("owner_activation_on", "OWNER_HAS_NOT_ACTIVATED")):
            c, opener, _ = client(config=ready(**{field: ""}))
            with self.assertRaises(s.SecAccessStop) as caught:
                c.get(URL)
            self.assertEqual(caught.exception.code, code)
            self.assertEqual(opener.requests, [])

    def test_a_date_must_be_a_date(self):
        self.assertIn("OWNER_HAS_NOT_ACTIVATED", s.activation_problems(ready(owner_activation_on="yes"), active_registry()))
        self.assertIn("ADAPTER_DISABLED", s.activation_problems(ready(enabled="true"), active_registry()))

    def test_fully_ready_has_no_problems(self):
        self.assertEqual(s.activation_problems(ready(), active_registry()), [])


class Contact(unittest.TestCase):
    def test_refuses_personal_placeholder_and_malformed_addresses(self):
        for address, code in (("someone@gmail.com", "CONTACT_IS_A_PERSONAL_ADDRESS"), ("Someone@GMAIL.com", "CONTACT_IS_A_PERSONAL_ADDRESS"), ("a@outlook.com", "CONTACT_IS_A_PERSONAL_ADDRESS"), ("a@proton.me", "CONTACT_IS_A_PERSONAL_ADDRESS"), ("admin@example.com", "CONTACT_IS_A_PLACEHOLDER"), ("admin@mail.example.org", "CONTACT_IS_A_PLACEHOLDER"), ("a@company.test", "CONTACT_IS_A_PLACEHOLDER"), ("", "CONTACT_MISSING_OR_INVALID"), (None, "CONTACT_MISSING_OR_INVALID"), ("not an email", "CONTACT_MISSING_OR_INVALID"), ("a@b", "CONTACT_MISSING_OR_INVALID")):
            self.assertEqual(s.contact_problem(address), code, address)

    def test_accepts_an_organization_mailbox(self):
        self.assertIsNone(s.contact_problem("research@ophireum-example.org"))


class Requests(unittest.TestCase):
    def test_identifies_itself_with_organization_and_contact(self):
        c, opener, _ = client()
        c.get(URL)
        self.assertEqual(opener.requests[0].get_header("User-agent"), "Ophireum Technology TaxGuardAI-Research research@ophireum-example.org")

    def test_returns_provenance_and_stays_unapproved(self):
        c, _, _ = client(Response(b"abc"))
        body, provenance = c.get(URL)
        self.assertEqual(body, b"abc")
        self.assertEqual((provenance["approval_status"], provenance["stage"], provenance["source_url"]), ("NOT_APPROVED", "STAGING_QUARANTINE", URL))
        self.assertEqual(provenance["sha256"], "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")

    def test_waits_between_requests(self):
        c, _, clock = client()
        c.get(URL)
        c.get(URL)
        self.assertEqual(clock.slept, [s.MIN_INTERVAL_SECONDS])
        self.assertGreaterEqual(s.MIN_INTERVAL_SECONDS, 0.1)

    def test_stops_at_the_request_budget(self):
        c, opener, _ = client()
        c.requests = s.MAX_REQUESTS_PER_RUN
        with self.assertRaises(s.SecAccessStop) as caught:
            c.get(URL)
        self.assertEqual((caught.exception.code, opener.requests), ("REQUEST_BUDGET_REACHED", []))

    def test_refuses_paths_and_hosts_the_registry_does_not_allow(self):
        for url, code in (("https://www.sec.gov/other/x.pdf", "PATH_NOT_ALLOWED"), ("http://www.sec.gov/files/x.pdf", "NOT_HTTPS"), ("https://sec.gov.evil.example/files/x.pdf", "HOST_NOT_IN_REGISTRY")):
            c, opener, _ = client()
            with self.assertRaises(s.SecAccessStop) as caught:
                c.get(url)
            self.assertEqual((caught.exception.code, opener.requests), (code, []))

    def test_a_response_too_large_is_refused(self):
        c, _, _ = client(Response(b"x" * (s.MAX_BYTES + 1)))
        with self.assertRaises(s.SecAccessStop) as caught:
            c.get(URL)
        self.assertEqual(caught.exception.code, "DOCUMENT_TOO_LARGE")


class Refusals(unittest.TestCase):
    def test_403_stops_at_once_and_is_never_retried(self):
        c, opener, clock = client(http_error(403), Response(b"would be a bypass"))
        with self.assertRaises(s.SecAccessStop) as caught:
            c.get(URL)
        self.assertEqual(caught.exception.code, "ACCESS_DENIED_403")
        self.assertEqual((len(opener.requests), clock.slept), (1, []))

    def test_after_403_every_later_call_is_refused_without_a_request(self):
        c, opener, _ = client(http_error(403))
        with self.assertRaises(s.SecAccessStop):
            c.get(URL)
        with self.assertRaises(s.SecAccessStop) as caught:
            c.get("https://www.sec.gov/files/other.pdf")
        self.assertEqual((caught.exception.code, len(opener.requests)), ("ACCESS_DENIED_403", 1))

    def test_identity_never_changes_across_attempts(self):
        c, opener, _ = client(http_error(429, "5"), Response(b"ok"))
        c.get(URL)
        self.assertEqual(len({r.get_header("User-agent") for r in opener.requests}), 1)

    def test_retry_guidance_is_followed(self):
        for code in (429, 503):
            c, opener, clock = client(http_error(code, "30"), Response(b"ok"))
            self.assertEqual(c.get(URL)[0], b"ok")
            self.assertIn(30, clock.slept)
            self.assertEqual(len(opener.requests), 2)

    def test_without_usable_retry_guidance_it_stops(self):
        for retry_after in (None, "soon", str(s.MAX_RETRY_AFTER_SECONDS + 1)):
            c, opener, _ = client(http_error(429, retry_after))
            with self.assertRaises(s.SecAccessStop) as caught:
                c.get(URL)
            self.assertEqual((caught.exception.code, len(opener.requests)), ("BACK_OFF_REQUIRED_429", 1))

    def test_retries_are_bounded(self):
        c, opener, _ = client(*[http_error(429, "1") for _ in range(10)])
        with self.assertRaises(s.SecAccessStop) as caught:
            c.get(URL)
        self.assertEqual((caught.exception.code, len(opener.requests)), ("BACK_OFF_REQUIRED_429", s.MAX_RETRIES + 1))

    def test_other_statuses_and_network_failures_stop(self):
        for error, code in ((http_error(404), "UNEXPECTED_STATUS_404"), (http_error(302), "UNEXPECTED_STATUS_302"), (urllib.error.URLError("x"), "NETWORK_FAILURE")):
            c, _, _ = client(error)
            with self.assertRaises(s.SecAccessStop) as caught:
                c.get(URL)
            self.assertEqual(caught.exception.code, code)


class NotWiredIn(unittest.TestCase):
    def test_nothing_else_imports_the_adapter(self):
        scripts = Path(s.__file__).resolve().parent
        for path in scripts.glob("*.py"):
            if path.name != "sec_source_adapter.py":
                self.assertNotIn("sec_source_adapter", path.read_text(encoding="utf-8", errors="replace"), path.name)


if __name__ == "__main__":
    unittest.main()
