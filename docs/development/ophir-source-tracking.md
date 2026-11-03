# OPHIR source in Git

OPHIR runs from `local-ai/rag` in `D:\\TaxGuard\\Development\\123`. Its reviewed source is tracked here so it has history and a backup. Everything it produces or
downloads stays on the machine.

## Tracked

An explicit allowlist in `.gitignore`, enforced by `src/tests/ophirSourceTracking.test.ts`:

- Steps 116 to 120: `research_discovery.py`, `verify_research_candidates.py`, `acquire_verified_documents.py`, `process_knowledge.py`, `evaluate_knowledge.py`, and `compare_retrieval.py`, which compares retrieval methods.
- Their tests and mutation runners.
- Configuration: the curriculum, owner candidate decisions, the two retrieval question sets, and `policy.example.json`, a template of the live `policy.json` without its local path.

## Never tracked

Model weights, the Ollama runtime, downloaded and quarantined documents, SQLite databases, reports, logs, reviews, reviewer and administrator identity files, `.venv`, and the live `policy.json`.

## Not yet reviewed

The other scripts in `autonomous/scripts`, including `admin_authorization.py`, `reviewer_authorization.py` and the earlier staging scripts, are not tracked. They have no version history until someone reviews them.

## Running the tests

From `local-ai/rag/autonomous`, using the environment that has `numpy`, `pypdf` and `rank-bm25`:

```bash
python -m unittest discover -s tests -p "test_*.py"
```

These do not run in the TaxGuard test matrix, which has no Python environment. The opt-in live checks need the local model.

## Status

Staging only. Tracking this code activates nothing: no scheduler, no agent, no model change and no approval.
