import json
import os
import sqlite3
import ssl
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import acquire_verified_documents as a

URL = "https://www.irs.gov/pub/irs-pdf/p4557.pdf"
OTHER = "https://www.irs.gov/pub/irs-pdf/f1040.pdf"
LIMIT = 1_000_000


def make_pdf(text="synthetic"):
    """A small, real, readable PDF. Synthetic content only."""
    import io
    from pypdf import PdfWriter
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    writer.add_metadata({"/Title": text})
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


PDF = make_pdf()


def reader(body):
    position = {"at": 0}
    def read(n):
        chunk = body[position["at"]:position["at"] + n]
        position["at"] += n
        return chunk
    return read


def server(status=200, body=PDF, headers=None, calls=None):
    base = {"content-type": "application/pdf", "content-length": str(len(body))} if status == 200 else {}
    def opener(url, conditional):
        if calls is not None:
            calls.append((url, dict(conditional)))
        return status, {**base, **(headers or {})}, reader(body), lambda: None
    return opener


def row(url=URL, **over):
    return {"url": url, "disposition": "ELIGIBLE_FOR_ACQUISITION", "title": "Synthetic", "research_domains": ["DATA_SECURITY"], "provenance": {"document_title": "Synthetic"}, **over}


class Base(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.quarantine = self.root / "quarantine"
        self.quarantine.mkdir()
        self.registry = a.open_registry(self.root / "acquisition.sqlite3")

    def tearDown(self):
        self.registry.close()
        self.directory.cleanup()

    def one(self, opener, item=None, staged=None, limit=LIMIT):
        return a.acquire_one(item or row(), self.registry, self.quarantine, staged or {}, limit, "run", opener)

    def files(self):
        return sorted(p.name for p in self.quarantine.iterdir())

    def events(self):
        return [r[0] for r in self.registry.execute("SELECT outcome FROM acquisition_events ORDER BY id")]


class UrlRules(unittest.TestCase):
    def test_refuses_everything_outside_acquisition_hosts(self):
        for url in ("https://www.fasb.org/x.pdf", "https://www.ecfr.gov/x.pdf", "https://evil.example/x.pdf", "http://www.irs.gov/pub/irs-pdf/x.pdf", "https://www.irs.gov/other/x.pdf",
                    "https://www.irs.gov/pub/irs-pdf/x.html", "https://127.0.0.1/x.pdf", "https://www.irs.gov:8443/pub/irs-pdf/x.pdf"):
            with self.subTest(url=url), self.assertRaises(a.Refused):
                a.authorized_url(url)

    def test_private_dns_answer_is_refused_even_alongside_a_public_one(self):
        for private in ("127.0.0.1", "10.0.0.5", "192.168.1.1", "169.254.169.254", "::1", "fe80::1"):
            answers = [(0, 0, 0, "", ("8.8.8.8", 443)), (0, 0, 0, "", (private, 443))]
            with self.subTest(private=private), self.assertRaises(a.Refused) as caught:
                a.public_addresses("www.irs.gov", getaddrinfo=lambda *x, **k: answers)
            self.assertEqual(caught.exception.code, "NON_PUBLIC_ADDRESS")

    def test_dns_failure_is_temporary(self):
        def offline(*x, **k):
            raise OSError("offline")
        with self.assertRaises(a.Temporary):
            a.public_addresses("www.irs.gov", getaddrinfo=offline)

    def test_connection_connects_to_the_checked_address_with_verified_tls(self):
        fake_socket = mock.Mock()
        fake_socket.getpeername.return_value = ("8.8.8.8", 443)
        context = ssl.create_default_context()
        context.wrap_socket = mock.Mock(return_value=mock.Mock())
        with mock.patch("socket.create_connection", return_value=fake_socket) as connect:
            connection = a.PinnedHTTPSConnection("www.irs.gov", "8.8.8.8", 5, context=context)
            connection.connect()
        connect.assert_called_once_with(("8.8.8.8", 443), 5)
        context.wrap_socket.assert_called_once_with(fake_socket, server_hostname="www.irs.gov")

    def test_connection_refuses_a_private_peer_and_closes_it(self):
        fake_socket = mock.Mock()
        fake_socket.getpeername.return_value = ("10.0.0.1", 443)
        with mock.patch("socket.create_connection", return_value=fake_socket), self.assertRaises(a.Refused):
            a.PinnedHTTPSConnection("www.irs.gov", "8.8.8.8", 5).connect()
        fake_socket.close.assert_called_once()

    def test_unverified_tls_cannot_be_configured(self):
        context = ssl._create_unverified_context()
        with self.assertRaises(a.Refused) as caught:
            a.PinnedHTTPSConnection("www.irs.gov", "8.8.8.8", 5, context=context)
        self.assertEqual(caught.exception.code, "CERTIFICATE_VERIFICATION_REQUIRED")

    def test_default_tls_requires_certificates_and_host_names(self):
        connection = a.PinnedHTTPSConnection("www.irs.gov", "8.8.8.8", 5)
        self.assertEqual(connection._verified_context.verify_mode, ssl.CERT_REQUIRED)
        self.assertTrue(connection._verified_context.check_hostname)


class Plan(unittest.TestCase):
    def report(self, *rows, **over):
        return {"step": 117, "status": "PASS", "knowledge_approval": False, "verified": list(rows), **over}

    def test_takes_only_eligible_rows(self):
        items = a.plan(self.report(row(), row(OTHER, disposition="NEEDS_REVIEW"), row(OTHER, disposition="EXCLUDED_BY_OWNER")))
        self.assertEqual([i["url"] for i in items], [URL])

    def test_refuses_a_failing_or_foreign_report(self):
        for report in (self.report(status="FAIL"), self.report(step=116), self.report(knowledge_approval=True), {}):
            with self.assertRaises(a.Refused):
                a.plan(report)

    def test_rechecks_urls_instead_of_trusting_the_report(self):
        with self.assertRaises(a.Refused):
            a.plan(self.report(row("https://evil.example/x.pdf")))


class Downloads(Base):
    def test_valid_pdf_is_quarantined_with_provenance_and_never_approved(self):
        out = self.one(server(headers={"etag": '"e1"', "last-modified": "Fri, 02 Jan 2026 15:10:38 GMT"}))
        self.assertEqual(out["outcome"], "QUARANTINED")
        self.assertEqual(self.files(), [out["file"]])
        self.assertEqual(a._sha256_file(self.quarantine / out["file"]), out["sha256"])
        stored = self.registry.execute("SELECT approval_status,authenticity,tax_year,publication_date,effective_date,source_organization,server_etag FROM acquired_documents").fetchone()
        self.assertEqual(stored, ("NOT_APPROVED", "NOT_ESTABLISHED", "UNKNOWN", "UNKNOWN", "UNKNOWN", "Internal Revenue Service", '"e1"'))

    def test_invalid_documents_leave_nothing_behind(self):
        cases = {
            "not a pdf": (server(body=b"<html>not a pdf</html>" + b"x" * 50), "PDF_SIGNATURE_INVALID"),
            "no trailer": (server(body=b"%PDF-1.7 truncated with no trailer"), "PDF_TRAILER_MISSING"),
            "garbage pdf": (server(body=b"%PDF-1.7\ngarbage\n%%EOF"), None),
            "html content type": (server(headers={"content-type": "text/html"}), "CONTENT_TYPE_NOT_PDF"),
            "compressed": (server(headers={"content-encoding": "gzip"}), "CONTENT_ENCODING_NOT_ALLOWED"),
        }
        for name, (opener, code) in cases.items():
            with self.subTest(name):
                out = self.one(opener)
                self.assertEqual(out["outcome"], "REFUSED")
                if code:
                    self.assertEqual(out["code"], code)
                self.assertEqual(self.files(), [])
        self.assertEqual(self.registry.execute("SELECT count(*) FROM acquired_documents").fetchone()[0], 0)

    def test_encrypted_and_empty_pdfs_are_refused(self):
        import io
        from pypdf import PdfWriter
        writer = PdfWriter(); writer.add_blank_page(width=10, height=10); writer.encrypt("synthetic")
        locked = io.BytesIO(); writer.write(locked)
        self.assertEqual(self.one(server(body=locked.getvalue()))["code"], "PDF_ENCRYPTED")
        empty = io.BytesIO(); PdfWriter().write(empty)
        self.assertEqual(self.one(server(body=empty.getvalue()))["code"], "PDF_HAS_NO_PAGES")
        self.assertEqual(self.files(), [])

    def test_active_content_is_recorded_not_run(self):
        import io
        from pypdf import PdfWriter
        writer = PdfWriter(); writer.add_blank_page(width=10, height=10); writer.add_js("// synthetic, never run")
        scripted = io.BytesIO(); writer.write(scripted)
        path = self.quarantine / "x.bin"
        path.write_bytes(scripted.getvalue())
        markers = a.inspect_pdf(path)["active_content_markers"]
        self.assertIn("/JavaScript", markers)
        out = self.one(server(body=scripted.getvalue()))
        self.assertEqual(out["outcome"], "QUARANTINED")
        stored = self.registry.execute("SELECT active_content_markers, approval_status FROM acquired_documents").fetchone()
        self.assertIn("/JavaScript", json.loads(stored[0]))
        self.assertEqual(stored[1], "NOT_APPROVED")
        path.write_bytes(PDF)
        self.assertEqual(a.inspect_pdf(path)["active_content_markers"], [])

    def test_size_limits(self):
        big = PDF + b"x" * 100
        self.assertEqual(self.one(server(body=big), limit=10)["code"], "SIZE_LIMIT_EXCEEDED")
        self.assertEqual(self.one(server(body=big, headers={"content-length": "bad"}))["code"], "SIZE_LIMIT_EXCEEDED")
        def undeclared(url, conditional):
            return 200, {"content-type": "application/pdf"}, reader(big), lambda: None
        self.assertEqual(self.one(undeclared, limit=10)["code"], "SIZE_LIMIT_EXCEEDED")
        self.assertEqual(self.files(), [])

    def test_truncated_download_is_retried_later_and_stores_nothing(self):
        out = self.one(server(headers={"content-length": str(len(PDF) + 5)}))
        self.assertEqual((out["outcome"], out["code"]), ("RETRY_LATER", "TRUNCATED_DOWNLOAD"))
        self.assertEqual(self.files(), [])

    def test_slow_source_hits_the_time_limit(self):
        times = iter([0, a.PER_DOCUMENT_SECONDS + 1, a.PER_DOCUMENT_SECONDS + 2])
        with self.assertRaises(a.Temporary) as caught:
            a.fetch_to_temp(URL, self.quarantine, LIMIT, opener=server(), clock=lambda: next(times))
        self.assertEqual(caught.exception.code, "DOWNLOAD_TIME_LIMIT")
        self.assertEqual(self.files(), [])

    def test_access_refusals_are_recorded_and_never_retried(self):
        for status in (401, 403, 407, 451):
            calls = []
            out = self.one(server(status=status, calls=calls))
            self.assertEqual((out["outcome"], out["code"], len(calls)), ("REFUSED", "ACCESS_REFUSED", 1))

    def test_server_failures_are_temporary(self):
        for status in (429, 500, 503):
            self.assertEqual(self.one(server(status=status))["outcome"], "RETRY_LATER")
        self.assertEqual(self.one(server(status=404))["code"], "HTTP_STATUS")

    def test_redirect_rules(self):
        def chain(*targets):
            steps = iter(targets)
            def opener(url, conditional):
                target = next(steps, None)
                if target is None:
                    return 200, {"content-type": "application/pdf", "content-length": str(len(PDF))}, reader(PDF), lambda: None
                return 302, {"location": target}, reader(b""), lambda: None
            return opener
        self.assertEqual(self.one(chain(OTHER))["outcome"], "QUARANTINED")
        for target, code in (("https://evil.example/x.pdf", "HOST_NOT_AUTHORIZED"), ("http://www.irs.gov/pub/irs-pdf/x.pdf", "NOT_HTTPS"), ("https://www.fasb.org/x.pdf", "HOST_NOT_AUTHORIZED_FOR_ACQUISITION"), ("https://127.0.0.1/x.pdf", "HOST_NOT_AUTHORIZED")):
            with self.subTest(target):
                self.assertEqual(self.one(chain(target), row(OTHER))["code"], code)
        self.assertEqual(self.one(chain(OTHER, OTHER, OTHER), row("https://www.irs.gov/pub/irs-pdf/iw9.pdf"))["code"], "REDIRECT_LIMIT")


class Idempotence(Base):
    def test_second_run_sends_validator_and_keeps_one_file(self):
        self.one(server(headers={"etag": '"v1"'}))
        calls = []
        out = self.one(server(status=304, calls=calls))
        self.assertEqual((out["outcome"], out["code"], calls[0][1]), ("UNCHANGED", "NOT_MODIFIED", {"If-None-Match": '"v1"'}))
        self.assertEqual(len(self.files()), 1)

    def test_same_hash_is_not_stored_twice(self):
        first = self.one(server())
        self.assertEqual((self.one(server())["code"], self.files()), ("SAME_HASH", [first["file"]]))

    def test_new_hash_is_a_new_version_and_the_old_one_stays(self):
        first = self.one(server())
        second = self.one(server(body=make_pdf("changed")))
        self.assertEqual(second["outcome"], "NEW_VERSION")
        self.assertEqual(self.files(), sorted([first["file"], second["file"]]))

    def test_same_content_at_another_url_is_flagged(self):
        self.one(server())
        out = self.one(server(), row(OTHER))
        self.assertEqual((out["outcome"], out["same_as"]), ("DUPLICATE_CONTENT", URL))
        self.assertEqual(len(self.files()), 1)

    def test_document_already_in_staging_is_not_copied(self):
        digest = __import__("hashlib").sha256(PDF).hexdigest()
        self.assertEqual(self.one(server(), staged={URL: {digest}})["outcome"], "ALREADY_IN_STAGING")
        self.assertEqual(self.files(), [])


class Recovery(Base):
    def test_crash_after_file_write_recovers_without_a_second_file(self):
        first = self.one(server())
        self.registry.execute("DROP TABLE acquired_documents")
        self.registry.executescript(a.SCHEMA)
        out = self.one(server())
        self.assertEqual((out["outcome"], self.files()), ("QUARANTINED", [first["file"]]))

    def test_conflicting_quarantine_file_is_never_overwritten(self):
        digest = __import__("hashlib").sha256(PDF).hexdigest()
        name = a.source_id_for(URL) + "_" + digest[:16] + ".pdf"
        (self.quarantine / name).write_bytes(b"tampered")
        self.assertEqual(self.one(server())["code"], "QUARANTINE_FILE_CONFLICT")
        self.assertEqual((self.quarantine / name).read_bytes(), b"tampered")
        self.assertEqual(self.files(), [name])

    def test_stale_temporaries_are_removed_and_others_kept(self):
        (self.quarantine / (a.TEMP_PREFIX + "abc.tmp")).write_bytes(b"x")
        (self.quarantine / "keep.pdf").write_bytes(b"x")
        self.assertEqual(a.remove_stale_temporaries(self.quarantine), 1)
        self.assertEqual(self.files(), ["keep.pdf"])

    def test_tampered_or_missing_quarantine_files_are_detected(self):
        out = self.one(server())
        self.assertEqual(a.check_registered_files(self.registry, self.quarantine), [])
        (self.quarantine / out["file"]).write_bytes(b"tampered")
        self.assertEqual(a.check_registered_files(self.registry, self.quarantine)[0]["problem"], "HASH_MISMATCH")
        (self.quarantine / out["file"]).unlink()
        self.assertEqual(a.check_registered_files(self.registry, self.quarantine)[0]["problem"], "MISSING")

    def test_offline_run_stops_early_defers_the_rest_and_stores_nothing(self):
        calls = []
        def offline(url, conditional):
            calls.append(url)
            raise a.Temporary("DNS_UNAVAILABLE", "offline")
        items = [row(f"https://www.irs.gov/pub/irs-pdf/f{i}.pdf") for i in range(6)]
        results, total = a.acquire_all(items, self.registry, self.quarantine, {}, LIMIT, LIMIT, 50, "run", offline, pause=0)
        self.assertEqual(len(calls), a.OFFLINE_AFTER_FAILURES)
        self.assertEqual([r["outcome"] for r in results], ["RETRY_LATER"] * 3 + ["DEFERRED"] * 3)
        self.assertEqual((total, self.files()), (0, []))

    def test_run_limits_defer_rather_than_exceed(self):
        items = [row(URL), row(OTHER)]
        results, _ = a.acquire_all(items, self.registry, self.quarantine, {}, LIMIT, LIMIT, 1, "run", server(), pause=0)
        self.assertEqual((results[1]["outcome"], results[1]["code"]), ("DEFERRED", "DOCUMENT_LIMIT"))
        two = make_pdf("two")
        results, _ = a.acquire_all([row(OTHER), row("https://www.irs.gov/pub/irs-pdf/iw9.pdf")], self.registry, self.quarantine, {}, LIMIT, len(two), 50, "run2", server(body=two), pause=0)
        self.assertEqual((results[1]["outcome"], results[1]["code"]), ("DEFERRED", "RUN_BYTE_LIMIT"))

    def test_a_document_too_big_only_for_the_remaining_budget_is_deferred_not_refused(self):
        results, total = a.acquire_all([row(URL)], self.registry, self.quarantine, {}, LIMIT, len(PDF) - 1, 50, "run", server(), pause=0)
        self.assertEqual((results[0]["outcome"], results[0]["code"], total, self.files()), ("DEFERRED", "RUN_BYTE_LIMIT", 0, []))
        self.assertEqual(self.events(), ["DEFERRED"])
        results, _ = a.acquire_all([row(URL)], self.registry, self.quarantine, {}, 10, LIMIT, 50, "run", server(), pause=0)
        self.assertEqual((results[0]["outcome"], results[0]["code"]), ("REFUSED", "SIZE_LIMIT_EXCEEDED"))

    def test_pause_between_requests(self):
        pauses = []
        a.acquire_all([row(URL), row(OTHER)], self.registry, self.quarantine, {}, LIMIT, LIMIT, 50, "run", server(), pause=2.0, sleep=pauses.append)
        self.assertEqual(pauses, [2.0])


class Lock(Base):
    def test_no_overlapping_runs(self):
        path = self.root / "a.lock"
        with a.RunLock(path):
            with self.assertRaises(a.Refused) as caught:
                with a.RunLock(path):
                    pass
            self.assertEqual(caught.exception.code, "ANOTHER_RUN_ACTIVE")
        self.assertFalse(path.exists())

    def test_a_killed_runs_lock_is_taken_over_but_a_live_owner_keeps_it(self):
        path = self.root / "a.lock"
        import subprocess
        finished = subprocess.run([sys.executable, "-c", "import os; print(os.getpid())"], capture_output=True, text=True)
        path.write_text(json.dumps({"pid": int(finished.stdout)}))
        with a.RunLock(path):
            self.assertTrue(path.exists())
        path.write_text(json.dumps({"pid": os.getpid()}))
        with self.assertRaises(a.Refused):
            with a.RunLock(path):
                pass
        self.assertTrue(path.exists())

    def test_process_alive(self):
        self.assertTrue(a.process_alive(os.getpid()))
        self.assertFalse(a.process_alive(-1))
        self.assertFalse(a.process_alive("x"))

    def test_abandoned_lock_expires(self):
        path = self.root / "a.lock"
        path.write_text("{}")
        old = time.time() - a.STALE_LOCK_SECONDS - 10
        os.utime(path, (old, old))
        with a.RunLock(path):
            pass


class Governance(Base):
    def test_registry_cannot_hold_approved_or_authenticated_documents(self):
        self.one(server())
        for column, value in (("approval_status", "APPROVED"), ("authenticity", "VERIFIED"), ("validation_status", "ACCEPTED")):
            with self.subTest(column), self.assertRaises(sqlite3.IntegrityError):
                self.registry.execute(f"UPDATE acquired_documents SET {column}=?", (value,))
        self.registry.rollback()

    def test_audit_events_are_append_only_and_every_outcome_is_recorded(self):
        self.one(server())
        self.one(server(status=403))
        self.one(server(status=503))
        self.assertEqual(self.events(), ["QUARANTINED", "REFUSED", "RETRY_LATER"])
        for statement in ("UPDATE acquisition_events SET outcome='X'", "DELETE FROM acquisition_events"):
            with self.subTest(statement), self.assertRaises(sqlite3.IntegrityError):
                self.registry.execute(statement)
        self.registry.rollback()

    def report(self, **over):
        return {"knowledge_approval": False, "production_modified": False, "embeddings_generated": False, "extraction_performed": False, "scheduler_changed": False,
                "protected_hashes_before": {"a": "1"}, "protected_hashes_after": {"a": "1"}, "integrity_problems": [], "registry_not_approved_violations": 0, **over}

    def test_safety_check_flags_every_violation(self):
        self.assertEqual(a.safety_failures(self.report()), [])
        for over, expected in (({"protected_hashes_after": {"a": "2"}}, "protected_state_changed"), ({"knowledge_approval": True}, "knowledge_approval"), ({"production_modified": True}, "production_modified"),
                               ({"integrity_problems": [{}]}, "quarantine_integrity"), ({"registry_not_approved_violations": 1}, "registry_approval_state")):
            self.assertIn(expected, a.safety_failures(self.report(**over)))


if __name__ == "__main__":
    unittest.main()
