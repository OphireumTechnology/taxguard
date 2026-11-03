import { describe, expect, it } from 'vitest';
import { COUNTS_REVIEW_SCHEMA, validateStructuredOutput } from '../server/ai/gateway/structuredOutput';
import { LocalInferenceProviderAdapter, readLocalRuntimeStatus } from '../server/ai/gateway/LocalInferenceProviderAdapter';
import { LOCAL_MODEL_ID } from '../server/ai/localModelProvenance';

// Opt-in live checks against the local runtime on this machine: set TG_LOCAL_LLM=1. They are skipped in the standard matrix,
// which must not depend on a GPU or a running model. Counts-only synthetic input; no taxpayer data.
const request = { model: LOCAL_MODEL_ID, schema: COUNTS_REVIEW_SCHEMA as Record<string, unknown>, max_output_tokens: 200,
  instructions: 'You review whether synthetic evidence counts need human review. Answer only with the requested JSON object.',
  input: { purpose: 'IDENTIFY_REVIEW_QUESTIONS' as any, taxYear: 2025, evidenceCount: 2 } };

describe.skipIf(process.env.TG_LOCAL_LLM !== '1')('live local model', () => {
  it('the model is installed and reported by the runtime', async () => {
    const status = await readLocalRuntimeStatus();
    expect(status.status).toBe('AVAILABLE');
    if (status.status === 'AVAILABLE') expect(status.models.map(m => m.name)).toContain(LOCAL_MODEL_ID);
  });
  it('returns output that passes the gateway validator, with usage accounted', async () => {
    const out = await new LocalInferenceProviderAdapter().invoke(request, AbortSignal.timeout(120_000));
    expect(out.status).toBe('completed');
    expect(out.usage?.total_tokens).toBeGreaterThan(0);
    expect(validateStructuredOutput(out.text, request.schema)).toMatchObject({ status: 'ADVISORY', confidence: 'UNVERIFIED' });
  }, 130_000);
  it('runs on the GPU', async () => {
    const status = await readLocalRuntimeStatus();
    if (status.status !== 'AVAILABLE') throw new Error('runtime unavailable');
    expect(status.loaded.find(m => m.name === LOCAL_MODEL_ID)?.processor).toBe('GPU');
  });
  it('cancellation stops the request', async () => {
    const abort = new AbortController();
    const pending = new LocalInferenceProviderAdapter().invoke({ ...request, max_output_tokens: 2000 }, abort.signal);
    setTimeout(() => abort.abort(), 50);
    await expect(pending).rejects.toMatchObject({ code: 'AI_PROVIDER_FAILURE' });
  }, 30_000);
});
