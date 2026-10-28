import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

// The book-to-tax approvals are redefined by later proposals (20261018070000 among them). The definition that applies
// is the last one in execution order, so the self-approval refusal must be present there, not only in proposal 029.
const manifest = JSON.parse(fs.readFileSync('docs/development/migration-execution-manifest.json', 'utf8'));
const files: string[] = [...manifest.files].sort((a: any, b: any) => a.order - b.order).map((f: any) => f.file);

function currentDefinition(fn: string): { file: string; body: string } {
  let found: { file: string; body: string } | null = null;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const starts = [...text.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\(/g)];
    starts.forEach((m, i) => {
      if (m[1] !== fn) return;
      const end = i + 1 < starts.length ? starts[i + 1].index! : text.length;
      found = { file, body: text.slice(m.index!, end) };
    });
  }
  if (!found) throw new Error(`no definition of ${fn}`);
  return found;
}

describe('book-to-tax maker-checker in the current definitions', () => {
  it.each([
    ['taxguard_b2t_review_set', 's.prepared_by = p_actor'],
    ['taxguard_b2t_review_adjustment', 'a.prepared_by = p_actor'],
    ['taxguard_b2t_review_workpaper', 'w.generated_by = p_actor'],
  ])('%s refuses the preparer as its own approver', (fn, condition) => {
    const { file, body } = currentDefinition(fn);
    expect(body, file).toContain(`IF ${condition} THEN RAISE EXCEPTION 'MAKER_CHECKER_VIOLATION'`);
    expect(body, file).toMatch(/taxguard_ledger_is_reviewer\(r\)[\s\S]*B2T_REVIEWER_REQUIRED/);
  });
});
