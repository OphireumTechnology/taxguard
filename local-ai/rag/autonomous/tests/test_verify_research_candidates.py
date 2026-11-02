import email.message
import io
import json
import sqlite3
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import verify_research_candidates as v

PAGE = "https://www.irs.gov/forms-instructions"
CURRICULUM = {"research_domains": [
    {"id": "FEDERAL_TAX", "priority": "P0", "official_urls": [PAGE], "topics": ["Tax forms and instructions", "Individual income tax"]},
    {"id": "TAX_PREPARATION", "priority": "P0", "official_urls": [PAGE], "topics": ["Form 1040"]},
    {"id": "AI_GOVERNANCE", "priority": "P1", "official_urls": ["https://www.nist.gov/itl/ai-risk-management-framework", "https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"], "topics": ["AI risk management"]},
]}
GOOD = "https://www.irs.gov/pub/irs-pdf/f1040.pdf"
PDF_OK = {"outcome": "OK", "http_status": 200, "content_type": "application/pdf", "content_length": 10, "last_modified": None, "etag": None}


def candidate(url=GOOD, domain="FEDERAL_TAX", title="Form 1040 PDF", source=PAGE):
    return {"research_domain": domain, "priority": "P0", "title": title, "url": url, "discovered_from": source, "status": "CANDIDATE_UNVERIFIED", "approval": "NOT_APPROVED"}


def run(*candidates, probe=lambda url: dict(PDF_OK), versions=None):
    return v.verify({"candidates": list(candidates)}, CURRICULUM, versions or {}, probe)


class UrlPolicy(unittest.TestCase):
    def test_accepts_and_lowercases_authorized_host(self):
        self.assertEqual(v.normalize_url("https://WWW.IRS.GOV/pub/irs-pdf/f1040.pdf#page=2"), (GOOD, None))

    def test_refuses_unauthorized_or_deceptive_urls(self):
        cases = {
            "http://www.irs.gov/pub/irs-pdf/f1040.pdf": "NOT_HTTPS",
            "ftp://www.irs.gov/x.pdf": "NOT_HTTPS",
            "https://irs.gov.evil.example/pub/irs-pdf/f1040.pdf": "HOST_NOT_AUTHORIZED",
            "https://www.irs.gov.evil.example/f1040.pdf": "HOST_NOT_AUTHORIZED",
            "https://evil.example/www.irs.gov/f1040.pdf": "HOST_NOT_AUTHORIZED",
            "https://irs.gov/pub/irs-pdf/f1040.pdf": "HOST_NOT_AUTHORIZED",
            "https://127.0.0.1/f1040.pdf": "HOST_NOT_AUTHORIZED",
            "https://169.254.169.254/latest/meta-data": "HOST_NOT_AUTHORIZED",
            "https://[::1]/f1040.pdf": "HOST_NOT_AUTHORIZED",
            "https://www.irs.gov@evil.example/f1040.pdf": "URL_HAS_CREDENTIALS",
            "https://user:pw@www.irs.gov/f1040.pdf": "URL_HAS_CREDENTIALS",
            "https://www.irs.gov:8443/pub/irs-pdf/f1040.pdf": "PORT_NOT_ALLOWED",
            "https://www.irs.gov/pub/irs-pdf/f1040.pdf?x=1": "QUERY_NOT_ALLOWED",
            "https://www.irs.gov/pub/%2e%2e/secret.pdf": "ENCODED_PATH_NOT_ALLOWED",
            "https://www.irs.gov/pub/irs-pdf/../../x.pdf": "PATH_NOT_CANONICAL",
            "https://www.irs.gov//pub/irs-pdf/f1040.pdf": "PATH_NOT_CANONICAL",
            "https://www.irs.gov\\@evil.example/x.pdf": "URL_MALFORMED",
            " https://www.irs.gov/pub/irs-pdf/f1040.pdf": "URL_MALFORMED",
            "https://www.irs.gov/pub/irs-pdf/f 1040.pdf": "URL_MALFORMED",
            "": "URL_MALFORMED",
            None: "URL_MALFORMED",
        }
        for url, reason in cases.items():
            with self.subTest(url=url):
                self.assertEqual(v.normalize_url(url), (None, reason))

    def test_rejects_non_pdf_and_paths_outside_a_hosts_document_area(self):
        results, rejected = run(candidate("https://www.irs.gov/pub/irs-pdf/page.html"), candidate("https://www.irs.gov/uploads/f1040.pdf"), candidate("https://www.fasb.org/x.pdf"))
        self.assertEqual(results, [])
        self.assertEqual([r["reason"] for r in rejected], ["NOT_A_PDF_URL", "PATH_NOT_AUTHORIZED_FOR_HOST", "PATH_NOT_AUTHORIZED_FOR_HOST"])

    def test_a_candidate_cannot_add_a_host(self):
        _, rejected = run(candidate("https://new-source.example/doc.pdf"))
        self.assertEqual(rejected[0]["reason"], "HOST_NOT_AUTHORIZED")
        self.assertNotIn("new-source.example", v.SOURCES)


class Verification(unittest.TestCase):
    def test_duplicates_merge_across_domains_and_url_forms(self):
        results, rejected = run(candidate(), candidate(domain="TAX_PREPARATION"), candidate("https://WWW.IRS.GOV/pub/irs-pdf/f1040.pdf#x"))
        self.assertEqual((len(results), rejected), (1, []))
        self.assertEqual(results[0]["candidate_indexes"], [0, 1, 2])
        self.assertEqual(results[0]["research_domains"], ["FEDERAL_TAX", "TAX_PREPARATION"])

    def test_eligible_is_never_authentic_approved_or_dated(self):
        row = run(candidate())[0][0]
        self.assertEqual(row["disposition"], "ELIGIBLE_FOR_ACQUISITION")
        p = row["provenance"]
        self.assertEqual((p["authenticity"], p["approval_status"], p["sha256"], p["retrieval_timestamp"]), ("NOT_ESTABLISHED", "NOT_APPROVED", None, None))
        self.assertEqual((p["tax_year"], p["publication_date"], p["effective_date"], p["document_version"]), ("UNKNOWN", "UNKNOWN", "UNKNOWN", "UNKNOWN"))

    def test_tax_year_is_never_guessed_from_a_title_or_url(self):
        self.assertEqual(v.tax_year_status(GOOD)["tax_year"], "UNKNOWN")
        prior = v.tax_year_status("https://www.irs.gov/pub/irs-prior/f1040--2023.pdf")
        self.assertEqual((prior["tax_year"], prior["url_revision_year"]), ("UNKNOWN", 2023))
        self.assertEqual(run(candidate(title="2025 Form 1040 PDF"))[0][0]["provenance"]["tax_year"], "UNKNOWN")

    def test_each_problem_routes_to_a_person(self):
        cases = [
            (candidate("https://www.irs.gov/pub/irs-pdf/fw7sp.pdf", title="Form W-7 (SP) PDF"), "LANGUAGE_VARIANT_NEEDS_DECISION"),
            (candidate("https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.jpn.pdf", "AI_GOVERNANCE", "AI risk management framework", "https://www.nist.gov/itl/ai-risk-management-framework"), "LANGUAGE_VARIANT_NEEDS_DECISION"),
            (candidate(title="Unrelated postal thing", url="https://www.irs.gov/pub/irs-pdf/p9999.pdf"), "RELEVANCE_NOT_ESTABLISHED"),
            (candidate(source="https://evil.example/page"), "DISCOVERED_FROM_NOT_AN_APPROVED_PAGE"),
            (candidate(domain="MADE_UP"), "RESEARCH_DOMAIN_NOT_IN_CURRICULUM"),
        ]
        for item, reason in cases:
            with self.subTest(reason=reason):
                row = run(item)[0][0]
                self.assertEqual(row["disposition"], "NEEDS_REVIEW")
                self.assertIn(reason, row["reasons"])

    def test_conflicting_titles_for_one_url_need_review(self):
        row = run(candidate(), candidate(title="Form 1040 changed"))[0][0]
        self.assertIn("CONFLICTING_TITLES", row["reasons"])

    def test_no_probe_means_nothing_is_eligible(self):
        row = run(candidate(), probe=None)[0][0]
        self.assertEqual((row["disposition"], row["reasons"]), ("NEEDS_REVIEW", ["PROBE_NOT_RUN"]))

    def test_every_probe_outcome_other_than_a_pdf_blocks_eligibility(self):
        for outcome, reason in (({"outcome": "ACCESS_REFUSED", "http_status": 403}, "PROBE_ACCESS_REFUSED"), ({"outcome": "REDIRECT_NOT_FOLLOWED", "http_status": 302}, "PROBE_REDIRECT_NOT_FOLLOWED"),
                                ({"outcome": "UNREACHABLE"}, "PROBE_UNREACHABLE"), ({"outcome": "DNS_REFUSED"}, "PROBE_DNS_REFUSED"), ({"outcome": "HTTP_ERROR", "http_status": 500}, "PROBE_HTTP_ERROR"),
                                ({**PDF_OK, "content_type": "text/html"}, "PROBE_CONTENT_TYPE_NOT_PDF")):
            with self.subTest(reason=reason):
                row = run(candidate(), probe=lambda url, o=outcome: o)[0][0]
                self.assertEqual(row["disposition"], "NEEDS_REVIEW")
                self.assertIn(reason, row["reasons"])

    def test_probes_each_unique_url_once_and_pauses_between_them(self):
        calls, pauses = [], []
        v.verify({"candidates": [candidate(), candidate(domain="TAX_PREPARATION"), candidate("https://www.irs.gov/pub/irs-pdf/i1040gi.pdf", title="Instructions for Form 1040")]},
                 CURRICULUM, {}, lambda url: calls.append(url) or dict(PDF_OK), pause=1.0, sleep=pauses.append)
        self.assertEqual(len(calls), 2)
        self.assertEqual(pauses, [1.0])

    def test_existing_versions_are_carried_through(self):
        recorded = {GOOD: [{"database": "learning_staging.sqlite3", "sha256": "a" * 64}]}
        self.assertEqual(run(candidate(), versions=recorded)[0][0]["existing_versions"], recorded[GOOD])


class OwnerDecisions(unittest.TestCase):
    DECISIONS = {"exclude_language_variants": True, "exclude": {"https://www.irs.gov/pub/irs-pdf/p5594.pdf": "x"}, "accept_relevance": {"https://www.irs.gov/pub/irs-pdf/p1220.pdf": "x"},
                 "allow_get_after_head_failure": {GOOD: "x"}}

    def verify(self, item, probe=lambda url: dict(PDF_OK), decisions=DECISIONS):
        return v.verify({"candidates": [item]}, CURRICULUM, {}, probe, decisions=decisions)

    def test_exclusions(self):
        self.assertEqual(self.verify(candidate("https://www.irs.gov/pub/irs-pdf/p5594.pdf", title="Publication 5594 postal"))[0][0]["disposition"], "EXCLUDED_BY_OWNER")
        self.assertEqual(self.verify(candidate("https://www.irs.gov/pub/irs-pdf/fw7sp.pdf", title="Form W-7 (SP) PDF"))[0][0]["disposition"], "EXCLUDED_BY_OWNER")

    def test_relevance_decision_clears_only_relevance(self):
        url = "https://www.irs.gov/pub/irs-pdf/p1220.pdf"
        self.assertEqual(self.verify(candidate(url, title="Publication 1220 specifications"))[0][0]["disposition"], "ELIGIBLE_FOR_ACQUISITION")
        row = self.verify(candidate(url, title="Publication 1220 specifications"), probe=lambda u: {"outcome": "ACCESS_REFUSED", "http_status": 403})[0][0]
        self.assertEqual(row["disposition"], "NEEDS_REVIEW")

    def test_head_decision_covers_404_and_405_only(self):
        self.assertEqual(self.verify(candidate(), probe=lambda u: {"outcome": "HTTP_ERROR", "http_status": 404})[0][0]["disposition"], "ELIGIBLE_FOR_ACQUISITION")
        for outcome in ({"outcome": "HTTP_ERROR", "http_status": 500}, {"outcome": "ACCESS_REFUSED", "http_status": 403}, {"outcome": "REDIRECT_NOT_FOLLOWED", "http_status": 302}, {"outcome": "DNS_REFUSED"}):
            self.assertEqual(self.verify(candidate(), probe=lambda u, o=outcome: o)[0][0]["disposition"], "NEEDS_REVIEW", outcome)

    def test_a_decision_cannot_admit_an_unauthorized_url(self):
        bad = "https://evil.example/f1040.pdf"
        results, rejected = self.verify(candidate(bad), decisions={"accept_relevance": {bad: "x"}, "allow_get_after_head_failure": {bad: "x"}})
        self.assertEqual((results, rejected[0]["reason"]), ([], "HOST_NOT_AUTHORIZED"))

    def test_no_decisions_file_changes_nothing(self):
        self.assertEqual(self.verify(candidate("https://www.irs.gov/pub/irs-pdf/fw7sp.pdf", title="Form W-7 (SP) PDF"), decisions=None)[0][0]["disposition"], "NEEDS_REVIEW")

    def test_curriculum_pdf_seeds_become_candidates(self):
        seeds = v.seed_candidates(CURRICULUM)
        self.assertEqual([s["url"] for s in seeds], ["https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"])
        self.assertEqual(run(*seeds)[0][0]["disposition"], "ELIGIBLE_FOR_ACQUISITION")


class Probe(unittest.TestCase):
    class Opener:
        def __init__(self, error):
            self.error, self.calls = error, 0

        def open(self, request, timeout=0):
            self.calls += 1
            self.request = request
            raise self.error

    def error(self, code, location=None):
        headers = email.message.Message()
        if location:
            headers["Location"] = location
        return urllib.error.HTTPError(GOOD, code, "x", headers, io.BytesIO())

    def test_private_dns_stops_before_any_request(self):
        opener = self.Opener(AssertionError("must not connect"))
        def rebinding(host):
            raise ValueError("non-public address")
        self.assertEqual(v.probe_url(GOOD, resolver=rebinding, opener=opener), {"outcome": "DNS_REFUSED"})
        self.assertEqual(opener.calls, 0)

    def test_real_resolver_refuses_loopback(self):
        with self.assertRaises(ValueError):
            v._public_addresses("localhost")

    def test_refusal_is_recorded_once_and_never_retried(self):
        for code in (401, 403, 451):
            opener = self.Opener(self.error(code))
            self.assertEqual(v.probe_url(GOOD, resolver=lambda h: None, opener=opener)["outcome"], "ACCESS_REFUSED")
            self.assertEqual(opener.calls, 1)

    def test_redirect_is_recorded_not_followed(self):
        opener = self.Opener(self.error(302, "https://evil.example/x.pdf"))
        out = v.probe_url(GOOD, resolver=lambda h: None, opener=opener)
        self.assertEqual((out["outcome"], out["redirect_location"], opener.calls), ("REDIRECT_NOT_FOLLOWED", "https://evil.example/x.pdf", 1))

    def test_uses_head_and_an_honest_user_agent(self):
        opener = self.Opener(self.error(500))
        v.probe_url(GOOD, resolver=lambda h: None, opener=opener)
        self.assertEqual(opener.request.get_method(), "HEAD")
        self.assertIn("OPHIR", opener.request.get_header("User-agent"))

    def test_network_failure_is_unreachable_not_success(self):
        out = v.probe_url(GOOD, resolver=lambda h: None, opener=self.Opener(OSError("offline")))
        self.assertEqual(out, {"outcome": "UNREACHABLE", "error_type": "OSError"})


class ReportSafety(unittest.TestCase):
    def report(self, **over):
        rows, rejected = run(candidate(), candidate("http://bad.example/x.pdf"))
        base = {"input_candidate_count": 2, "verified": rows, "rejected": rejected, "automatic_downloads": False, "documents_downloaded_flag": False, "knowledge_approval": False,
                "production_modified": False, "protected_hashes_before": {"a": "1"}, "protected_hashes_after": {"a": "1"}}
        return {**base, **over}

    def test_a_clean_report_passes(self):
        self.assertEqual(v.safety_failures(self.report()), [])

    def test_flags_changed_state_and_lost_candidates_and_set_flags(self):
        self.assertIn("protected_state_changed", v.safety_failures(self.report(protected_hashes_after={"a": "2"})))
        self.assertIn("candidates_not_all_accounted_for", v.safety_failures(self.report(input_candidate_count=3)))
        self.assertIn("knowledge_approval", v.safety_failures(self.report(knowledge_approval=True)))
        self.assertIn("automatic_downloads", v.safety_failures(self.report(automatic_downloads=True)))

    def test_flags_an_overstated_or_unearned_row(self):
        for field, value in (("approval_status", "APPROVED"), ("authenticity", "VERIFIED"), ("sha256", "a" * 64)):
            report = self.report()
            report["verified"][0]["provenance"][field] = value
            self.assertTrue(any(f.startswith("provenance_overstated") for f in v.safety_failures(report)), field)
        report = self.report()
        report["verified"][0]["probe"] = {"outcome": "ACCESS_REFUSED"}
        self.assertTrue(any(f.startswith("eligible_without_passing") for f in v.safety_failures(report)))


class Storage(unittest.TestCase):
    def test_atomic_write_keeps_the_old_report_when_it_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            v.write_atomic(path, {"a": 1})
            with self.assertRaises(TypeError):
                v.write_atomic(path, {"bad": object()})
            self.assertEqual(json.loads(path.read_text()), {"a": 1})
            self.assertEqual([p.name for p in Path(directory).iterdir()], ["report.json"])

    def test_existing_versions_read_only_and_reports_a_bad_database(self):
        with tempfile.TemporaryDirectory() as directory:
            connection = sqlite3.connect(Path(directory) / "learning_staging.sqlite3")
            connection.execute("CREATE TABLE discovered_documents(source_url TEXT, sha256 TEXT)")
            connection.execute("INSERT INTO discovered_documents VALUES(?,?)", (GOOD, "a" * 64))
            connection.commit(); connection.close()
            versions, problems = v.existing_versions(directory)
            self.assertEqual(versions[GOOD], [{"database": "learning_staging.sqlite3", "sha256": "a" * 64}])
            self.assertEqual([p["database"] for p in problems], ["ophir_semantic_memory.sqlite3"])


class Coverage(unittest.TestCase):
    def test_reports_required_documents_and_skipped_pdf_seeds(self):
        rows, _ = run(candidate())
        out = v.coverage(CURRICULUM, rows, {"https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf": []}, [{"url": "https://www.fasb.org/", "research_domain": "ACCOUNTING", "error": "HTTPError: HTTP Error 403: Forbidden"}])
        states = {g["document"]: g["state"] for g in out["required_documents_not_listed"]}
        self.assertEqual(states["Publication 4557"], "NOT_A_CANDIDATE")
        self.assertEqual(states["NIST AI 600-1"], "ALREADY_IN_STAGING")
        self.assertNotIn("Form 1040", states)
        self.assertEqual(out["pdf_seed_urls_skipped_by_discovery"], ["https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"])
        self.assertEqual(out["known_access_restrictions"][0]["handling"], "ACCESS_REFUSED_NOT_BYPASSED")


if __name__ == "__main__":
    unittest.main()
