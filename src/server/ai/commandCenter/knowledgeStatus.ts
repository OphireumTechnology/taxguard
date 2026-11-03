import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * The knowledge pipeline's status for the AI Command Center. The local databases never reach the browser: the pipeline
 * exports counts to one file, and this module rebuilds that file field by field. Anything unexpected makes the whole
 * status UNAVAILABLE, so no partial or unverified figure is ever shown, and unknown fields are dropped rather than passed on.
 */
const MAX_BYTES = 256 * 1024;
const DEFAULT_FILE = path.join('local-ai', 'rag', 'autonomous', 'reports', 'knowledge_status_latest.json');
const ID = /^[A-Z0-9_]{1,64}$/;
const RUN_ID = /^\d{8}T\d{6}Z$/;
const OUTCOMES = ['RETAIN_BASELINE', 'HELD_OUT_IMPROVEMENT_CONFIRMED'] as const;

class Invalid extends Error {}
const fail = (): never => { throw new Invalid(); };
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail();
const count = (value: unknown): number => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : fail();
const measure = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fail();
const timestamp = (value: unknown): string => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fail();
const ids = (value: unknown): string[] => Array.isArray(value) && value.length <= 64 && value.every(v => typeof v === 'string' && ID.test(v)) ? value as string[] : fail();
const counts = <K extends string>(value: unknown, keys: readonly K[]): Record<K, number> => {
  const source = object(value);
  return Object.fromEntries(keys.map(key => [key, count(source[key])])) as Record<K, number>;
};

const COMPARISON_SIDE = ['document_recall_at_1', 'document_recall_at_3', 'document_recall_at_5', 'passage_recall_at_1', 'passage_recall_at_3', 'passage_recall_at_5', 'cited_evidence_passage', 'answered_without_evidence', 'invented_citations', 'correctly_refused'] as const;
const side = (value: unknown) => {
  const source = object(value);
  return { ...counts(source, COMPARISON_SIDE), search_median_ms: measure(source.search_median_ms) };
};

export function parseKnowledgeStatus(raw: unknown) {
  const source = object(raw);
  if (source.schema_version !== 1 || source.mode !== 'STAGING_ONLY') fail();
  const sources = object(source.sources);
  const review = object(source.review);
  const evaluation = object(source.evaluation);
  const comparison = source.comparison === null ? null : object(source.comparison);
  const outcome = comparison?.outcome;
  if (comparison && !OUTCOMES.includes(outcome as typeof OUTCOMES[number])) fail();
  const runId = evaluation.run_id === null ? null : typeof evaluation.run_id === 'string' && RUN_ID.test(evaluation.run_id) ? evaluation.run_id : fail();
  return {
    generated_utc: timestamp(source.generated_utc),
    sources: { ...counts(sources, ['registered', 'active', 'proposed', 'blocked', 'named_total', 'named_staged']), named_missing: ids(sources.named_missing), categories_without_documents: ids(sources.categories_without_documents) },
    discovery: counts(source.discovery, ['candidates_checked', 'verified', 'rejected']),
    quarantine: counts(source.quarantine, ['documents', 'approved']),
    extraction: counts(source.extraction, ['documents', 'pages', 'findings', 'defect_findings']),
    chunks: counts(source.chunks, ['total', 'held_from_embedding', 'embeddings']),
    review: { queue_awaiting: count(review.queue_awaiting), staging: counts(review.staging, ['pending', 'approved', 'rejected']), production: counts(review.production, ['pending', 'approved', 'rejected', 'superseded']) },
    evaluation: { run_id: runId, ...counts(evaluation, ['recommend_for_human_review', 'needs_correction', 'hold']) },
    comparison: comparison && { outcome: outcome as typeof OUTCOMES[number], ...counts(comparison, ['questions', 'refusal_items']), baseline: side(comparison.baseline), improved: side(comparison.improved), generated_utc: timestamp(comparison.generated_utc) },
    tax_year: source.tax_year === null ? null : counts(source.tax_year, ['tax_year_editions', 'revision_editions', 'dated_publications', 'undated', 'conflicts']),
    warnings: counts(source.warnings, ['integrity_failures', 'suspicious_documents', 'active_content_documents']),
    scheduler: counts(source.scheduler, ['tasks_enabled']),
  };
}

export type KnowledgeStatus = ReturnType<typeof parseKnowledgeStatus>;
export type KnowledgeStatusResult = { status: 'AVAILABLE'; snapshot: KnowledgeStatus } | { status: 'UNAVAILABLE'; code: 'KNOWLEDGE_STATUS_NOT_FOUND' | 'KNOWLEDGE_STATUS_INVALID' };

/** Reads the exported status. The path comes from the server's environment only, never from a request. */
export async function readKnowledgeStatus(file: string = process.env.AI_KNOWLEDGE_STATUS_FILE || path.resolve(process.cwd(), DEFAULT_FILE)): Promise<KnowledgeStatusResult> {
  let text: string;
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return { status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' };
    if (stat.size > MAX_BYTES) return { status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_INVALID' };
    text = await fs.readFile(file, 'utf8');
  } catch { return { status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_NOT_FOUND' }; }
  try { return { status: 'AVAILABLE', snapshot: parseKnowledgeStatus(JSON.parse(text)) }; }
  catch { return { status: 'UNAVAILABLE', code: 'KNOWLEDGE_STATUS_INVALID' }; }
}
