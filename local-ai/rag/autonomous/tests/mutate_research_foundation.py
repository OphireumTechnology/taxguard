"""Breaks the source registry's and tax-year rules one at a time in a temporary copy and confirms the tests notice. Touches no real file, database or model."""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent / "scripts"
TEST = "tests/test_research_foundation.py"
MUTATIONS = {
    "source_registry.py": {
        "approval not required": ('if source["status"] in ("ACTIVE", "APPROVED_NOT_ENABLED") and not source.get("owner_approved_on"):', 'if False:'),
        "expansion allowed": ('if registry.get("automatic_source_expansion") is not False:', 'if False:'),
        "licensed source may be open": ('if source["access"] == "LICENSE_REQUIRED" and source["status"] != "BLOCKED":', 'if False:'),
        "active source needs nothing": ('if source["status"] == "ACTIVE" and (source["access"] != "OPEN_PUBLIC" or not source["document_paths"] or not source["hosts"]):', 'if False:'),
        "inactive source may list paths": ('if source["status"] != "ACTIVE" and source["document_paths"]:', 'if False:'),
        "root path allowed": ('if not path.startswith("/") or not path.endswith("/") or len(path) < 3:', 'if False:'),
        "wildcard host allowed": ('if host != host.lower() or "*" in host or "/" in host or host.count(".") < 1:', 'if False:'),
        "plain http allowed": ('if parts.scheme != "https":', 'if False:'),
        "userinfo allowed": ('if parts.username or parts.password or port not in (None, 443):', 'if False:'),
        "traversal allowed": ('if ".." in path.split("/"):', 'if False:'),
        "encoded traversal missed": ('path = urllib.parse.unquote(parts.path)', 'path = parts.path'),
        "subdomain matches": ('if host in source["hosts"]:', 'if any(host.endswith(h) for h in source["hosts"]):'),
        "license ignored": ('if source["access"] == "LICENSE_REQUIRED":\n                return', 'if False:\n                return'),
        "proposed source fetchable": ('if source["status"] != "ACTIVE":\n                return', 'if False:\n                return'),
        "any path allowed": ('if not any(path.startswith(prefix) for prefix in source["document_paths"]):', 'if False:'),
        "unknown host allowed": ('return False, "HOST_NOT_IN_REGISTRY", None', 'return True, "ALLOWED", None'),
        "gap hidden": ('"named_missing": [d["source_id"] for d in documents if not d["staged"]]', '"named_missing": []'),
    },
    "tax_year_intelligence.py": {
        "any mention makes a form proposed": ('if not LEGAL_TYPES.search(document_type or ""):', 'if False:'),
        "revision treated as tax year": ('tax_year = classification.get("tax_year", UNKNOWN)', 'tax_year = classification.get("tax_year", UNKNOWN) if classification.get("tax_year", UNKNOWN) != UNKNOWN else classification.get("version", UNKNOWN)'),
        "newer document applies": ('return "APPLIES" if int(stated) == int(return_tax_year) else "DIFFERENT_TAX_YEAR"', 'return "APPLIES" if int(stated) >= int(return_tax_year) else "DIFFERENT_TAX_YEAR"'),
        "any year applies": ('return "APPLIES" if int(stated) == int(return_tax_year) else "DIFFERENT_TAX_YEAR"', 'return "APPLIES"'),
        "revision edition applies": ('return "REVIEW_REVISION_DATE_DOES_NOT_ESTABLISH_TAX_YEAR"', 'return "APPLIES"'),
        "unknown applies": ('return "REVIEW_TAX_YEAR_UNKNOWN"', 'return "APPLIES"'),
        "processing year guessed": ('"processing_year": processing or {"value": UNKNOWN}', '"processing_year": processing or {"value": str(int(tax_year) + 1) if tax_year != UNKNOWN else UNKNOWN}'),
        "currency claimed": ('"currency": "NOT_CHECKED_AGAINST_SOURCE"', '"currency": "CURRENT"'),
        "future revision missed": ('if revision and revision > (today.year, today.month):', 'if False:'),
        "old revision missed": ('if stated != UNKNOWN and revision and revision[0] < int(stated):', 'if False:'),
        "processing conflict missed": ('if stated != UNKNOWN and processing != UNKNOWN and int(processing) < int(stated):', 'if False:'),
        "year disagreement missed": ('if stated != UNKNOWN and companion["tax_year"] != UNKNOWN and stated != companion["tax_year"]:', 'if False:'),
        "revision disagreement missed": ('if revision and _year_month(companion["revision"]) and record["revision"] != companion["revision"]:', 'if False:'),
        "unknown counted as disagreement": ('if stated != UNKNOWN and companion["tax_year"] != UNKNOWN and stated != companion["tax_year"]:', 'if stated != companion["tax_year"]:'),
        "conflict auto resolved": ('"action": "FLAG_FOR_HUMAN_REVIEW"', '"action": "USE_NEWEST"'),
        "effective statements unbounded": ('if len(effective) < MAX_EFFECTIVE_STATEMENTS:', 'if True:'),
        "effective limit removed": ("Not the document's own effective date.", ''),
    },
}
baseline = subprocess.run([sys.executable, "-m", "unittest", TEST], cwd=HERE.parent, capture_output=True, text=True)
if baseline.returncode != 0:
    print("BASELINE FAILS: mutation results would mean nothing")
    sys.exit(2)
survived, total = [], 0
for filename, changes in MUTATIONS.items():
    original = (SCRIPTS / filename).read_text(encoding="utf-8")
    for name, (old, new) in changes.items():
        total += 1
        if original.count(old) < 1:
            print("NOT APPLICABLE", name)
            survived.append(name)
            continue
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for folder in ("scripts", "tests", "config"):
                (root / folder).mkdir()
            for helper in ("verify_research_candidates.py", "source_registry.py", "tax_year_intelligence.py"):
                shutil.copy(SCRIPTS / helper, root / "scripts")
            shutil.copy(HERE.parent / "config/research_source_registry.json", root / "config")
            (root / "scripts" / filename).write_text(original.replace(old, new), encoding="utf-8")
            shutil.copy(HERE / "test_research_foundation.py", root / "tests")
            run = subprocess.run([sys.executable, "-m", "unittest", TEST], cwd=root, capture_output=True, text=True)
        caught = run.returncode != 0
        print("caught  " if caught else "SURVIVED", name)
        if not caught:
            survived.append(name)
print(f"{total - len(survived)}/{total} caught")
sys.exit(1 if survived else 0)
