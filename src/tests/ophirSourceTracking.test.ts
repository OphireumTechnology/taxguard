import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Block 107: OPHIR's reviewed source is tracked; its documents, databases, models, reports and logs never are. This asks Git itself, so a change to the ignore
// rules that would let one of these in fails here. A file is added to the allowlist in .gitignore only after review.
const ignored = (path: string) => spawnSync('git', ['check-ignore', '--no-index', '-q', path]).status === 0;
const tracked = () => execFileSync('git', ['ls-files', 'local-ai'], { encoding: 'utf8' }).split('\n').filter(Boolean);

describe('OPHIR source tracking', () => {
  it.each([
    'local-ai/models/blobs/sha256-abc', 'local-ai/models/manifests/x', 'local-ai/logs/serve.log', 'local-ai/config/OphirModelfile', 'local-ai/config/OphirModelfile.v2', 'local-ai/ollama/ollama.exe',
    'local-ai/rag/.venv/Scripts/python.exe', 'local-ai/rag/online/quarantine/IRS_P4557_abc.pdf', 'local-ai/rag/incoming/IRS_Publication_17.pdf', 'local-ai/rag/processed/IRS_Publication_17.txt', 'local-ai/rag/backups/x.py', 'local-ai/rag/approved/x.json',
    'local-ai/rag/autonomous/state/ophir_semantic_memory.sqlite3', 'local-ai/rag/autonomous/state/knowledge_pipeline.sqlite3', 'local-ai/rag/autonomous/state/acquisition.sqlite3', 'local-ai/rag/autonomous/state/admin_identity.json', 'local-ai/rag/autonomous/state/reviewer_identity.json',
    'local-ai/rag/autonomous/state/approval_audit.jsonl', 'local-ai/rag/autonomous/reports/knowledge_evaluation_latest.json', 'local-ai/rag/autonomous/reviews/irs_publication_17_review.json', 'local-ai/rag/autonomous/staging/x.jsonl',
    'local-ai/rag/autonomous/config/policy.json', 'local-ai/rag/autonomous/config/sources.json', 'local-ai/rag/autonomous/scripts/admin_authorization.py', 'local-ai/rag/autonomous/scripts/new_unreviewed.py', 'local-ai/rag/autonomous/tests/new_unreviewed.py',
    'local-ai/rag/autonomous/scripts/x.sqlite3', 'local-ai/rag/autonomous/config/secrets.json', 'local-ai/anything-new.bin',
  ])('keeps %s out of Git', path => { expect(ignored(path), path).toBe(true); });

  it('tracks exactly the reviewed source', () => {
    const files = tracked();
    expect(files.length).toBe(29);
    for (const file of files) expect(ignored(file), file).toBe(false);
    expect(files).toContain('local-ai/rag/autonomous/scripts/evaluate_knowledge.py');
    expect(files).toContain('local-ai/rag/autonomous/scripts/compare_retrieval.py');
    expect(files).toContain('local-ai/rag/autonomous/tests/test_compare_retrieval.py');
    expect(files).toContain('local-ai/rag/autonomous/tests/mutate_compare_retrieval.py');
    expect(files).toContain('local-ai/rag/autonomous/config/retrieval_heldout_set.json');
    expect(files).toContain('local-ai/rag/autonomous/config/policy.example.json');
  });

  it('tracks no document, database, model, log or live identity file', () => {
    for (const file of tracked()) {
      expect(file, file).toMatch(/^local-ai\/rag\/autonomous\/(scripts|tests)\/[a-z_]+\.py$|^local-ai\/rag\/autonomous\/config\/[a-z_.]+\.json$/);
      expect(file, file).not.toMatch(/\.(pdf|sqlite3?|db|gguf|log|jsonl|txt)$|identity|credential|secret|policy\.json$/i);
    }
  });
});
