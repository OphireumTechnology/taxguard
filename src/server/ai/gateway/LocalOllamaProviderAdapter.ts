import { GovernanceError } from '../governance/contracts';
import type { ProviderAdapter, ProviderRequest, ProviderResponse } from './contracts';
import { ProviderNotSentError } from './contracts';
import { filterModelText } from '../userFacingModelText';

/**
 * Local inference through an Ollama runtime on this machine. The endpoint must be plain HTTP on a loopback address and
 * redirects are refused, so a request cannot leave the machine. There is no fallback: when the runtime is unavailable the
 * call fails, and nothing is sent to any other provider. No tools are offered to the model, and a reply that asks for one
 * is not accepted. Like the other adapters this has no live dispatch: GovernedAIGateway refuses transport outside tests
 * until the owner commissions it, and invoke() refuses on its own as well.
 */
export const LOCAL_OLLAMA_DEFAULT_ENDPOINT = 'http://127.0.0.1:11434';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

export function localEndpoint(endpoint: string = LOCAL_OLLAMA_DEFAULT_ENDPOINT): string {
  let url: URL;
  try { url = new URL(endpoint); } catch { throw new GovernanceError('AI_LOCAL_ENDPOINT_REFUSED'); }
  if (url.protocol !== 'http:' || !LOOPBACK.has(url.hostname) || url.username || url.password || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash)
    throw new GovernanceError('AI_LOCAL_ENDPOINT_REFUSED');
  return url.origin;
}

type Fetch = typeof fetch;
export interface LocalOllamaOptions { endpoint?: string; maxConcurrent?: number; fetchImpl?: Fetch }

/** Connection failures where the runtime conclusively received nothing. */
const NOT_SENT_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EADDRNOTAVAIL', 'EHOSTUNREACH']);
const notSent = (error: unknown) => {
  const cause = (error as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause?.code === 'string' && NOT_SENT_CODES.has(cause.code);
};
const count = (value: unknown): number | null => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null;

export class LocalOllamaProviderAdapter implements ProviderAdapter {
  readonly provider = 'LOCAL_OLLAMA';
  private readonly endpoint: string;
  private readonly maxConcurrent: number;
  private readonly fetchImpl: Fetch;
  private active = 0;

  constructor(options: LocalOllamaOptions = {}) {
    this.endpoint = localEndpoint(options.endpoint);
    this.maxConcurrent = options.maxConcurrent ?? 1;
    if (!Number.isInteger(this.maxConcurrent) || this.maxConcurrent < 1 || this.maxConcurrent > 8) throw new GovernanceError('AI_LOCAL_CONCURRENCY_INVALID');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async invoke(request: Readonly<ProviderRequest>, signal: AbortSignal): Promise<ProviderResponse> {
    if (process.env.NODE_ENV !== 'test') throw new GovernanceError('AI_DISPATCH_UNAVAILABLE', 503);
    // At the limit nothing is sent, so the gateway may account for it as not sent and apply its bounded retry.
    if (this.active >= this.maxConcurrent) throw new ProviderNotSentError();
    this.active++;
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(this.endpoint + '/api/chat', { method: 'POST', redirect: 'error', signal, headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model: request.model, stream: false, think: false, format: request.schema,
            options: { temperature: 0, num_predict: request.max_output_tokens },
            messages: [{ role: 'system', content: request.instructions }, { role: 'user', content: JSON.stringify(request.input) }] }) });
      } catch (error) {
        if (notSent(error)) throw new ProviderNotSentError();
        throw new GovernanceError('AI_PROVIDER_FAILURE', 503);
      }
      if (!response.ok) throw new GovernanceError('AI_PROVIDER_FAILURE', 503);
      let body: any;
      try { body = await response.json(); } catch { throw new GovernanceError('AI_PROVIDER_FAILURE', 503); }
      // Reasoning is requested off above; a trace that still arrives in the content is removed, and the separate reasoning
      // field is never read. Anything the filter withholds does not count as an answer.
      const filtered = filterModelText(body?.message?.content, 'ADMINISTRATOR');
      const text = filtered.withheld ? '' : filtered.text;
      const toolCalls = Array.isArray(body?.message?.tool_calls) && body.message.tool_calls.length > 0;
      const input = count(body?.prompt_eval_count), output = count(body?.eval_count);
      return { status: body?.done === true && body?.done_reason === 'stop' && !toolCalls && !filtered.withheld ? 'completed' : 'incomplete', text,
        usage: input === null || output === null ? null : { input_tokens: input, output_tokens: output, total_tokens: input + output } };
    } finally { this.active--; }
  }
}

export interface LocalModel { name: string; sizeBytes: number | null }
export interface LoadedModel extends LocalModel { vramBytes: number | null; processor: 'GPU' | 'CPU' | 'MIXED' | 'UNKNOWN' }
export type LocalRuntimeStatus =
  | { status: 'UNAVAILABLE'; endpoint: string }
  | { status: 'AVAILABLE'; endpoint: string; version: string | null; models: LocalModel[]; loaded: LoadedModel[] };

/** Where a loaded model runs, from what the runtime reports. Nothing is assumed when it reports nothing. */
export function processorOf(sizeBytes: number | null, vramBytes: number | null): LoadedModel['processor'] {
  if (sizeBytes === null || vramBytes === null || sizeBytes === 0) return 'UNKNOWN';
  return vramBytes >= sizeBytes ? 'GPU' : vramBytes === 0 ? 'CPU' : 'MIXED';
}

/** Reads the runtime's own version, installed models and loaded models. Read-only; no prompt or client data is involved. */
export async function readLocalRuntimeStatus(options: Pick<LocalOllamaOptions, 'endpoint' | 'fetchImpl'> & { timeoutMs?: number } = {}): Promise<LocalRuntimeStatus> {
  const endpoint = localEndpoint(options.endpoint), get = options.fetchImpl ?? fetch;
  const read = async (path: string) => {
    const response = await get(endpoint + path, { redirect: 'error', signal: AbortSignal.timeout(options.timeoutMs ?? 2000) });
    if (!response.ok) throw new Error('unavailable');
    return await response.json() as any;
  };
  try {
    const [version, tags, ps] = await Promise.all([read('/api/version'), read('/api/tags'), read('/api/ps')]);
    const models = (Array.isArray(tags?.models) ? tags.models : []).filter((m: any) => typeof m?.name === 'string').map((m: any) => ({ name: m.name as string, sizeBytes: count(m.size) }));
    const loaded = (Array.isArray(ps?.models) ? ps.models : []).filter((m: any) => typeof m?.name === 'string').map((m: any) => {
      const sizeBytes = count(m.size), vramBytes = count(m.size_vram);
      return { name: m.name as string, sizeBytes, vramBytes, processor: processorOf(sizeBytes, vramBytes) };
    });
    return { status: 'AVAILABLE', endpoint, version: typeof version?.version === 'string' ? version.version : null, models, loaded };
  } catch { return { status: 'UNAVAILABLE', endpoint }; }
}
