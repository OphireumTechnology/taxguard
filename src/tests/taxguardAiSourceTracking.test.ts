import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Block 107: The Knowledge Engine's reviewed source is tracked; its documents, databases, models, reports and logs never are. This asks Git itself, so a change to the ignore
// rules that would let one of these in fails here. A file is added to the allowlist in .gitignore only after review.
const ignored = (path: string) => spawnSync('git', ['check-ignore', '--no-index', '-q', path]).status === 0;
const tracked = () => execFileSync('git', ['ls-files', 'local-ai'], { encoding: 'utf8' }).split('\n').filter(Boolean);

describe('TaxGuard AI Knowledge Engine source tracking', () => {
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
    expect(files.length).toBe(39);
    for (const file of files) expect(ignored(file), file).toBe(false);
    expect(files).toContain('local-ai/rag/autonomous/scripts/evaluate_knowledge.py');
    expect(files).toContain('local-ai/rag/autonomous/scripts/compare_retrieval.py');
    expect(files).toContain('local-ai/rag/autonomous/config/research_source_registry.json');
    expect(files).toContain('local-ai/rag/autonomous/tests/test_compare_retrieval.py');
    expect(files).toContain('local-ai/rag/autonomous/tests/mutate_compare_retrieval.py');
    expect(files).toContain('local-ai/rag/autonomous/config/retrieval_heldout_set.json');
    expect(files).toContain('local-ai/rag/autonomous/config/policy.example.json');
  });

  it('tracks no document, database, model, log or live identity file', () => {
    for (const file of tracked()) {
      expect(file, file).toMatch(/^local-ai\/rag\/autonomous\/(scripts|tests)\/[a-z_]+\.py$|^local-ai\/rag\/autonomous\/config\/[a-z_.]+\.json$|^local-ai\/powershell\/[A-Za-z.-]+\.ps1$/);
      expect(file, file).not.toMatch(/\.(pdf|sqlite3?|db|gguf|log|jsonl|txt)$|identity|credential|secret|policy\.json$/i);
    }
  });

  it('keeps the runtime name out of ordinary PowerShell output, and leaves it in the restricted diagnostics', () => {
    const commands = tracked().filter(file => file.startsWith('local-ai/powershell/'));
    expect(commands.map(file => file.split('/').pop())).toEqual(expect.arrayContaining(['Start-TaxGuardAI.ps1', 'Stop-TaxGuardAI.ps1', 'Get-TaxGuardAIStatus.ps1', 'Get-TaxGuardAIModels.ps1', 'Test-TaxGuardAI.ps1', 'Get-TaxGuardAIKnowledge.ps1', 'Invoke-TaxGuardAIEvaluation.ps1', 'Get-TaxGuardAITasks.ps1', 'Get-TaxGuardAIDiagnostics.ps1']));
    for (const file of commands) {
      const text = readFileSync(file, 'utf8');
      const output = text.split('\n').filter(line => /Write-TaxGuardLine|Write-Host/.test(line) && !/^\s*function/.test(line));
      for (const line of output) expect(line, file).not.toMatch(/ollama|qwen|alibaba|ophir(?!eum)|11434/i);
      expect(text, file).not.toMatch(/Enable-ScheduledTask|Register-ScheduledTask|ollama\s+rm|Remove-Item/i);
    }
    expect(readFileSync('local-ai/powershell/Get-TaxGuardAIDiagnostics.ps1', 'utf8')).toContain('Ollama Inc., MIT License');
  });
});
