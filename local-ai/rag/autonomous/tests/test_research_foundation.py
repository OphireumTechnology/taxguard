import copy
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import source_registry as s
import tax_year_intelligence as t
from verify_research_candidates import SOURCES

REAL = s.load()


def source(**changes):
    return {"id": "X", "publisher": "P", "category": "C", "authority_class": "A", "hosts": ["docs.example.gov"], "document_paths": ["/docs/"], "status": "ACTIVE", "access": "OPEN_PUBLIC", "owner_approved_on": "2026-11-03", "notes": "", **changes}


def registry(*sources):
    return {"automatic_source_expansion": False, "sources": list(sources) or [source()], "named_documents": []}


class Validation(unittest.TestCase):
    def assertRefused(self, code, value):
        with self.assertRaises(s.RegistryError) as caught:
            s.validate(value)
        self.assertIn(code, str(caught.exception))

    def test_the_real_registry_is_valid(self):
        self.assertEqual(s.validate(copy.deepcopy(REAL))["automatic_source_expansion"], False)

    def test_refuses_anything_that_could_widen_access(self):
        self.assertRefused("AUTOMATIC_EXPANSION", {**registry(), "automatic_source_expansion": True})
        self.assertRefused("LICENSED_SOURCE_NOT_BLOCKED", registry(source(access="LICENSE_REQUIRED")))
        self.assertRefused("ACTIVE_SOURCE_INCOMPLETE", registry(source(access="ACCESS_TERMS_UNVERIFIED")))
        self.assertRefused("ACTIVE_SOURCE_INCOMPLETE", registry(source(document_paths=[])))
        self.assertRefused("INACTIVE_SOURCE_HAS_PATHS", registry(source(status="PROPOSED", access="ACCESS_TERMS_UNVERIFIED")))
        self.assertRefused("BROAD_DOCUMENT_PATH", registry(source(document_paths=["/"])))
        self.assertRefused("BAD_HOST", registry(source(hosts=["*.example.gov"])))
        self.assertRefused("BAD_HOST", registry(source(hosts=["Docs.Example.gov"])))
        self.assertRefused("UNKNOWN_STATE", registry(source(status="APPROVED")))
        self.assertRefused("NO_OWNER_APPROVAL", registry(source(owner_approved_on=None)))
        self.assertRefused("NO_OWNER_APPROVAL", registry(source(status="APPROVED_NOT_ENABLED", access="ACCESS_TERMS_UNVERIFIED", document_paths=[], owner_approved_on=None)))
        self.assertRefused("INACTIVE_SOURCE_HAS_PATHS", registry(source(status="APPROVED_NOT_ENABLED", access="ACCESS_TERMS_UNVERIFIED")))
        self.assertRefused("DUPLICATE_SOURCE", registry(source(), source(hosts=["other.example.gov"])))
        self.assertRefused("HOST_LISTED_TWICE", registry(source(), source(id="Y")))

    def test_the_real_registry_blocks_licensed_accounting_standards(self):
        by_id = {x["id"]: x for x in REAL["sources"]}
        for name in ("FASB", "AICPA"):
            self.assertEqual((by_id[name]["status"], by_id[name]["access"]), ("BLOCKED", "LICENSE_REQUIRED"))

    def test_active_sources_never_exceed_what_the_verifier_already_allows(self):
        for item in REAL["sources"]:
            if item["status"] != "ACTIVE":
                continue
            for host in item["hosts"]:
                self.assertIn(host, SOURCES)
                self.assertLessEqual(set(item["document_paths"]), set(SOURCES[host]["document_paths"]), host)

    def test_only_owner_approved_sources_are_active(self):
        self.assertEqual(sorted(x["id"] for x in REAL["sources"] if x["status"] == "ACTIVE"), ["IRS", "NIST_PUBS", "NIST_SITE", "TREASURY"])
        self.assertEqual(sorted(x["id"] for x in REAL["sources"] if x["status"] == "APPROVED_NOT_ENABLED"), ["ECFR", "NIST_CSRC", "SEC"])
        self.assertEqual(sorted(x["id"] for x in REAL["sources"] if x["status"] == "PROPOSED"), ["US_CODE", "US_TAX_COURT"])

    def test_ranking_is_not_claimed(self):
        self.assertIn("not a ranking", REAL["authority_class_note"])
        self.assertFalse(any("rank" in x for x in REAL["sources"]))


class FetchDecision(unittest.TestCase):
    def decide(self, url):
        return s.fetch_decision(url, REAL)[:2]

    def test_allowed(self):
        self.assertEqual(self.decide("https://www.irs.gov/pub/irs-pdf/p17.pdf"), (True, "ALLOWED"))
        self.assertEqual(self.decide("https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf"), (True, "ALLOWED"))
        self.assertEqual(self.decide("https://home.treasury.gov/system/files/131/x.pdf"), (True, "ALLOWED"))

    def test_refused_with_a_reason(self):
        for url, code in (("http://www.irs.gov/pub/irs-pdf/p17.pdf", "NOT_HTTPS"), ("https://www.irs.gov/newsroom", "PATH_NOT_ALLOWED"), ("https://irs.gov/pub/irs-pdf/p17.pdf", "HOST_NOT_IN_REGISTRY"),
                          ("https://www.irs.gov.evil.example/pub/irs-pdf/p17.pdf", "HOST_NOT_IN_REGISTRY"), ("https://evil.www.irs.gov/pub/irs-pdf/p17.pdf", "HOST_NOT_IN_REGISTRY"), ("https://user@www.irs.gov/pub/irs-pdf/p17.pdf", "UNUSUAL_URL_AUTHORITY"),
                          ("https://www.irs.gov:8443/pub/irs-pdf/p17.pdf", "UNUSUAL_URL_AUTHORITY"), ("https://www.irs.gov/pub/irs-pdf/../../secret", "PATH_TRAVERSAL"), ("https://www.irs.gov/pub/irs-pdf/%2e%2e/%2e%2e/secret", "PATH_TRAVERSAL"),
                          ("https://www.fasb.org/page/x", "LICENSE_REQUIRED"), ("https://www.sec.gov/files/x.pdf", "SOURCE_NOT_ACTIVE"), ("https://www.ecfr.gov/current/title-26", "SOURCE_NOT_ACTIVE"), ("https://www.ustaxcourt.gov/x.pdf", "SOURCE_NOT_ACTIVE"), ("https://home.treasury.gov/news/press-releases/x", "PATH_NOT_ALLOWED"), ("https://uscode.house.gov/x.pdf", "SOURCE_NOT_ACTIVE"),
                          ("https://[bad/x", "MALFORMED_URL"), ("https://www.irs.gov:notaport/pub/irs-pdf/x.pdf", "MALFORMED_URL"), ("ftp://www.irs.gov/pub/irs-pdf/p17.pdf", "NOT_HTTPS"), ("", "NOT_HTTPS")):
            self.assertEqual(self.decide(url), (False, code), url)

    def test_coverage_reports_gaps_without_filling_them(self):
        out = s.coverage(REAL, ["IRS_P1345", "IRS_P4164", "IRS_P4557", "NIST_NIST_AI_100_1"])
        self.assertEqual(out["named_missing"], ["IRS_P17", "IRS_P1075", "NIST_NIST_AI_600_1"])
        self.assertIn("ACCOUNTING", out["categories_without_staged_documents"])
        self.assertNotIn("AI_GOVERNANCE_AND_SECURITY", out["categories_without_staged_documents"])


def record(source_id="IRS_FX", tax_year="UNKNOWN", version="UNKNOWN", publication="UNKNOWN", document_type="FORM", pages=(), title="T", evidence=None):
    return t.document_record(source_id, title, {"tax_year": tax_year, "version": version, "publication_date": publication, "document_type": document_type, "evidence": evidence or {}}, list(pages))


NOW = datetime(2026, 11, 3, tzinfo=timezone.utc)


class TaxYear(unittest.TestCase):
    def test_kinds_are_kept_apart(self):
        self.assertEqual(record(tax_year="2025").get("kind"), "TAX_YEAR_EDITION")
        self.assertEqual(record(version="2024-03").get("kind"), "REVISION_EDITION")
        self.assertEqual(record(publication="January 2023").get("kind"), "DATED_PUBLICATION")
        self.assertEqual(record().get("kind"), "UNDATED")

    def test_a_revision_date_is_not_turned_into_a_tax_year(self):
        out = record(version="2024-03")
        self.assertEqual(out["tax_year"], "UNKNOWN")
        self.assertEqual(out["revision"], "2024-03")

    def test_processing_year_comes_only_from_evidence(self):
        self.assertEqual(record(tax_year="2025")["processing_year"], {"value": "UNKNOWN"})
        found = record(pages=[(3, "Publication for Processing  Year 2026 only")])["processing_year"]
        self.assertEqual((found["value"], found["page"]), ("2026", 3))

    def test_the_first_evidence_wins_and_is_quoted(self):
        self.assertEqual(record(pages=[(1, "processing year 2026"), (2, "processing year 2025")])["processing_year"]["value"], "2026")

    def test_effective_statements_are_quotes_with_a_stated_limit(self):
        out = record(pages=[(4, "This change is effective for tax periods beginning after December 31, 2025. Other text.")])
        self.assertEqual(out["effective_statements"][0]["page"], 4)
        self.assertIn("2025", out["effective_statements"][0]["quote"])
        self.assertIn("Not the document's own effective date", out["effective_note"])
        self.assertEqual(record(pages=[(1, "effective communication with clients")])["effective_statements"], [])

    def test_effective_statements_are_bounded(self):
        text = " ".join(f"Effective on January 1, {y}." for y in range(2010, 2024))
        self.assertEqual(len(record(pages=[(1, text)])["effective_statements"]), t.MAX_EFFECTIVE_STATEMENTS)

    def test_legal_status_applies_only_to_regulations(self):
        self.assertEqual(t.legal_status("FORM", "Discusses proposed regulations"), "NOT_APPLICABLE")
        self.assertEqual(t.legal_status("REGULATION", "Proposed rule on X"), "PROPOSED")
        self.assertEqual(t.legal_status("REGULATION", "Temporary regulations"), "TEMPORARY")
        self.assertEqual(t.legal_status("REGULATION", "Final regulations"), "FINAL")
        self.assertEqual(t.legal_status("REGULATION", "Regulations on X"), "UNKNOWN")
        self.assertEqual(t.legal_status("REGULATION", "Unproposed finality"), "UNKNOWN")

    def test_currency_is_never_claimed(self):
        self.assertEqual(record(tax_year="2025")["currency"], "NOT_CHECKED_AGAINST_SOURCE")


class Applicability(unittest.TestCase):
    def test_only_a_stated_matching_year_applies(self):
        self.assertEqual(t.applicability(record(tax_year="2025"), 2025), "APPLIES")
        self.assertEqual(t.applicability(record(tax_year="2025"), "2025"), "APPLIES")

    def test_the_newest_document_is_not_assumed_to_apply(self):
        self.assertEqual(t.applicability(record(tax_year="2026"), 2025), "DIFFERENT_TAX_YEAR")
        self.assertEqual(t.applicability(record(tax_year="2024"), 2025), "DIFFERENT_TAX_YEAR")

    def test_a_revision_date_goes_to_a_person(self):
        self.assertEqual(t.applicability(record(version="2025-12"), 2025), "REVIEW_REVISION_DATE_DOES_NOT_ESTABLISH_TAX_YEAR")

    def test_unknown_goes_to_a_person(self):
        self.assertEqual(t.applicability(record(), 2025), "REVIEW_TAX_YEAR_UNKNOWN")
        self.assertEqual(t.applicability(record(publication="January 2023"), 2025), "REVIEW_TAX_YEAR_UNKNOWN")


class Conflicts(unittest.TestCase):
    def codes(self, *records):
        return [c["code"] for c in t.find_conflicts(list(records), NOW)]

    def test_a_clean_set_has_none(self):
        self.assertEqual(self.codes(record("IRS_F941", tax_year="2026", version="2026-03"), record("IRS_I941", tax_year="2026", version="2026-03"), record("IRS_P1", version="2026-11")), [])

    def test_future_revision(self):
        self.assertEqual(self.codes(record(version="2026-12")), ["REVISION_DATED_AFTER_TODAY"])

    def test_revision_older_than_tax_year(self):
        self.assertEqual(self.codes(record(tax_year="2026", version="2025-12")), ["REVISION_OLDER_THAN_TAX_YEAR"])
        self.assertEqual(self.codes(record(tax_year="2025", version="2026-05")), [])

    def test_processing_year_before_tax_year(self):
        self.assertEqual(self.codes(record(tax_year="2026", pages=[(1, "Processing Year 2025")])), ["PROCESSING_YEAR_BEFORE_TAX_YEAR"])
        self.assertEqual(self.codes(record(tax_year="2025", pages=[(1, "Processing Year 2026")])), [])

    def test_form_and_instructions_are_compared(self):
        self.assertEqual(self.codes(record("IRS_F9", tax_year="2025"), record("IRS_I9", tax_year="2026")), ["FORM_AND_INSTRUCTIONS_DIFFER_ON_TAX_YEAR"])
        self.assertEqual(self.codes(record("IRS_F9", version="2025-01"), record("IRS_I9", version="2025-06")), ["FORM_AND_INSTRUCTIONS_DIFFER_ON_REVISION"])

    def test_unknown_values_are_not_conflicts(self):
        self.assertEqual(self.codes(record("IRS_F9", tax_year="2025"), record("IRS_I9")), [])

    def test_a_conflict_is_flagged_and_nothing_is_chosen(self):
        conflict = t.find_conflicts([record(version="2026-12")], NOW)[0]
        self.assertEqual(conflict["action"], "FLAG_FOR_HUMAN_REVIEW")
        self.assertFalse({"selected", "winner", "resolved"} & set(conflict))

    def test_summary_counts(self):
        records = [record("IRS_A", tax_year="2025"), record("IRS_B", version="2024-03"), record("IRS_C")]
        out = t.summarize(records, [])
        self.assertEqual(out["by_kind"], {"TAX_YEAR_EDITION": 1, "REVISION_EDITION": 1, "UNDATED": 1})
        self.assertEqual(out["undated"], ["IRS_C"])


if __name__ == "__main__":
    unittest.main()
