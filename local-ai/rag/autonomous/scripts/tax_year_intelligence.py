"""Step 121.04: tells apart tax year, processing year, revision, effective statements and legal status for each staged document. Staging only; approves nothing and changes no record.

Every value comes with evidence or stays UNKNOWN. The newest document is never assumed to apply, and a conflict is flagged for a person, never settled here.
Reads the pipeline database read-only and writes only reports/tax_year_coverage_latest.json.

  python tax_year_intelligence.py --report
"""
import argparse
import json
import re
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import source_registry

AUTONOMOUS = Path(__file__).resolve().parents[1]
PIPELINE = AUTONOMOUS / "state/knowledge_pipeline.sqlite3"
REPORT = AUTONOMOUS / "reports/tax_year_coverage_latest.json"

UNKNOWN = "UNKNOWN"
PROCESSING_YEAR = re.compile(r"\bProcessing\s+Year\s+(20\d{2})\b", re.I)
EFFECTIVE = re.compile(r"\beffective\s+(?:for\s+(?:tax\s+)?(?:periods|years|payments|wages)\s+(?:beginning\s+)?(?:after|on\s+or\s+after|in)|on\s+or\s+after|beginning|for|on|date:?)\s[^.;]{0,50}?\b(?:19|20)\d{2}\b", re.I)
MAX_EFFECTIVE_STATEMENTS = 5
LEGAL_TYPES = re.compile(r"REGULATION|RULE|NOTICE_OF", re.I)


def legal_status(document_type, title):
    """Applies only to a regulation. A form that merely mentions proposed regulations is not itself proposed."""
    if not LEGAL_TYPES.search(document_type or ""):
        return "NOT_APPLICABLE"
    text = (title or "").lower()
    for word, status in (("proposed", "PROPOSED"), ("temporary", "TEMPORARY"), ("final", "FINAL")):
        if re.search(rf"\b{word}\b", text):
            return status
    return UNKNOWN


def edition_kind(tax_year, revision, publication_date):
    if tax_year != UNKNOWN:
        return "TAX_YEAR_EDITION"
    if revision != UNKNOWN:
        return "REVISION_EDITION"
    if publication_date != UNKNOWN:
        return "DATED_PUBLICATION"
    return "UNDATED"


def document_record(source_id, title, classification, pages):
    """pages: (page number, text) in order."""
    tax_year = classification.get("tax_year", UNKNOWN)
    revision = classification.get("version", UNKNOWN)
    publication = classification.get("publication_date", UNKNOWN)
    processing, effective = None, []
    for number, text in pages:
        flat = " ".join((text or "").split())
        if processing is None:
            match = PROCESSING_YEAR.search(flat)
            if match:
                processing = {"value": match.group(1), "page": number, "quote": match.group(0)}
        for match in EFFECTIVE.finditer(flat):
            if len(effective) < MAX_EFFECTIVE_STATEMENTS:
                effective.append({"page": number, "quote": match.group(0)[:120]})
    return {"source_id": source_id, "title": title, "document_type": classification.get("document_type", UNKNOWN), "kind": edition_kind(tax_year, revision, publication), "tax_year": tax_year, "tax_year_evidence": (classification.get("evidence") or {}).get("tax_year", []),
            "processing_year": processing or {"value": UNKNOWN}, "revision": revision, "publication_date": publication, "effective_statements": effective, "effective_note": "Statements found in the text, often about one provision. Not the document's own effective date.",
            "legal_status": legal_status(classification.get("document_type"), title), "currency": "NOT_CHECKED_AGAINST_SOURCE"}


def applicability(record, return_tax_year):
    """Whether a document can be used for a return. Only a stated matching tax year says yes; everything else needs a person."""
    stated = record["tax_year"]
    if stated != UNKNOWN:
        return "APPLIES" if int(stated) == int(return_tax_year) else "DIFFERENT_TAX_YEAR"
    if record["kind"] == "REVISION_EDITION":
        return "REVIEW_REVISION_DATE_DOES_NOT_ESTABLISH_TAX_YEAR"
    return "REVIEW_TAX_YEAR_UNKNOWN"


def _year_month(value):
    match = re.fullmatch(r"(20\d{2})-(\d{2})", value or "")
    return (int(match.group(1)), int(match.group(2))) if match else None


def _companion(source_id):
    """IRS_F941 pairs with IRS_I941."""
    match = re.fullmatch(r"IRS_F(\w+)", source_id)
    return f"IRS_I{match.group(1)}" if match else None


def find_conflicts(records, today):
    """Each conflict goes to review. Nothing here picks a winner."""
    conflicts = []
    def flag(code, documents, detail):
        conflicts.append({"code": code, "documents": documents, "detail": detail, "action": "FLAG_FOR_HUMAN_REVIEW"})
    by_id = {r["source_id"]: r for r in records}
    for record in records:
        revision = _year_month(record["revision"])
        if revision and revision > (today.year, today.month):
            flag("REVISION_DATED_AFTER_TODAY", [record["source_id"]], f"Revision {record['revision']} is later than {today:%Y-%m}.")
        stated = record["tax_year"]
        if stated != UNKNOWN and revision and revision[0] < int(stated):
            flag("REVISION_OLDER_THAN_TAX_YEAR", [record["source_id"]], f"Tax year {stated} with revision {record['revision']}.")
        processing = record["processing_year"]["value"]
        if stated != UNKNOWN and processing != UNKNOWN and int(processing) < int(stated):
            flag("PROCESSING_YEAR_BEFORE_TAX_YEAR", [record["source_id"]], f"Tax year {stated} with processing year {processing}.")
        companion = by_id.get(_companion(record["source_id"]))
        if companion:
            if stated != UNKNOWN and companion["tax_year"] != UNKNOWN and stated != companion["tax_year"]:
                flag("FORM_AND_INSTRUCTIONS_DIFFER_ON_TAX_YEAR", [record["source_id"], companion["source_id"]], f"{stated} and {companion['tax_year']}.")
            if revision and _year_month(companion["revision"]) and record["revision"] != companion["revision"]:
                flag("FORM_AND_INSTRUCTIONS_DIFFER_ON_REVISION", [record["source_id"], companion["source_id"]], f"{record['revision']} and {companion['revision']}.")
    return conflicts


def summarize(records, conflicts):
    years = Counter(r["tax_year"] for r in records)
    return {"documents": len(records), "by_kind": dict(Counter(r["kind"] for r in records)), "tax_years": dict(years), "processing_years": dict(Counter(r["processing_year"]["value"] for r in records)), "undated": [r["source_id"] for r in records if r["kind"] == "UNDATED"],
            "with_effective_statements": sum(1 for r in records if r["effective_statements"]), "conflicts_by_code": dict(Counter(c["code"] for c in conflicts))}


def main(argv=None):
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--report", action="store_true")
    options = arguments.parse_args(argv)
    if not options.report:
        print("Use --report. Reads staged documents read-only and writes one report.")
        return 0
    from verify_research_candidates import write_atomic
    pipeline = sqlite3.connect(f"file:{PIPELINE.as_posix()}?mode=ro", uri=True)
    pipeline.row_factory = sqlite3.Row
    try:
        records = []
        for row in pipeline.execute("SELECT document_id, source_id, document_title, classification FROM documents ORDER BY source_id").fetchall():
            pages = [(p["page_number"], p["text"]) for p in pipeline.execute("SELECT page_number, COALESCE(cleaned_text, original_text) AS text FROM pages WHERE document_id=? ORDER BY page_number", (row["document_id"],))]
            records.append(document_record(row["source_id"], row["document_title"], json.loads(row["classification"]), pages))
    finally:
        pipeline.close()
    today = datetime.now(timezone.utc)
    conflicts = find_conflicts(records, today)
    report = {"step": "121.04", "generated_utc": today.isoformat(), "mode": "STAGING_ONLY", "summary": summarize(records, conflicts), "conflicts": conflicts, "records": records, "source_coverage": source_registry.coverage(source_registry.load(), [r["source_id"] for r in records]),
              "limit": "Pattern rules over staged text. Not validated by a tax professional. Whether a newer edition exists was not checked.", "knowledge_approval": False, "production_modified": False}
    write_atomic(REPORT, report)
    print(json.dumps({"status": "PASS", **report["summary"], "named_missing": report["source_coverage"]["named_missing"], "categories_without_staged_documents": report["source_coverage"]["categories_without_staged_documents"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
