import { afterEach, describe, expect, it, vi } from 'vitest';
import { GovernanceError } from '../server/ai/governance/contracts';
import { ProviderNotSentError, type ProviderRequest } from '../server/ai/gateway/contracts';
import { COUNTS_REVIEW_SCHEMA } from '../server/ai/gateway/structuredOutput';
import { localEndpoint, LocalOllamaProviderAdapter, processorOf, readLocalRuntimeStatus } from '../server/ai/gateway/LocalOllamaProviderAdapter';

// The local inference adapter with an injected transport. Nothing here reaches a runtime; the live checks are opt-in in
// localOllamaLive.test.ts. Synthetic values only.
const request: ProviderRequest = { model: 'synthetic-model:1', instructions: 'Synthetic instructions.', schema: COUNTS_REVIEW_SCHEMA as any,
  input: { purpose: 'IDENTIFY_REVIEW_QUESTIONS' as any, taxYear: 2025, evidenceCount: 2 }, max_output_tokens: 64 };
const reply = (over: Record<string, unknown> = {}, status = 200) => new Response(JSON.stringify({ done: true, done_reason: 'stop', prompt_eval_count: 11, eval_count: 7,
  message: { role: 'assistant', content: '{"status":"ADVISORY"}' }, ...over }), { status });
const adapter = (fetchImpl: any, maxConcurrent?: number) => new LocalOllamaProviderAdapter({ fetchImpl, maxConcurrent });
const signal = () => new AbortController().signal;
const code = async (work: Promise<unknown>) => work.then(() => 'NO_ERROR', e => e?.code ?? e?.message);
afterEach(() => { vi.unstubAllEnvs(); });

describe('local endpoint boundary', () => {
  it.each(['http://127.0.0.1:11434', 'http://localhost:11434', 'http://[::1]:11434'])('accepts loopback %s', e => { expect(localEndpoint(e)).toBe(e); });
  it.each(['https://api.example.com', 'http://192.168.1.10:11434', 'http://0.0.0.0:11434', 'http://127.0.0.1.example.com:11434', 'https://127.0.0.1:11434',
    'http://user:secret@127.0.0.1:11434', 'http://127.0.0.1:11434/proxy', 'http://127.0.0.1:11434/?to=elsewhere', 'not a url'])('refuses %s', e => {
    expect(() => localEndpoint(e)).toThrowError(GovernanceError);
  });
  it('defaults to the private local endpoint', () => { expect(localEndpoint()).toBe('http://127.0.0.1:11434'); });
});

describe('local provider adapter', () => {
  it('sends only the governed request, with no tools, refusing redirects', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => reply());
    const out = await adapter(fetchImpl).invoke(request, signal());
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(['format', 'messages', 'model', 'options', 'stream', 'think']);
    expect(body).toMatchObject({ model: 'synthetic-model:1', stream: false, format: COUNTS_REVIEW_SCHEMA, options: { temperature: 0, num_predict: 64 } });
    expect(body.messages).toEqual([{ role: 'system', content: 'Synthetic instructions.' }, { role: 'user', content: JSON.stringify(request.input) }]);
    expect(out).toEqual({ status: 'completed', text: '{"status":"ADVISORY"}', usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 } });
  });

  it('never accepts a reply that asks for a tool, or one cut short', async () => {
    const tool = await adapter(async () => reply({ message: { content: '{}', tool_calls: [{ function: { name: 'approve_return' } }] } })).invoke(request, signal());
    expect(tool.status).toBe('incomplete');
    expect((await adapter(async () => reply({ done_reason: 'length' })).invoke(request, signal())).status).toBe('incomplete');
    expect((await adapter(async () => reply({ done: false })).invoke(request, signal())).status).toBe('incomplete');
  });

  it('reports unknown usage rather than inventing it', async () => {
    expect((await adapter(async () => reply({ prompt_eval_count: undefined })).invoke(request, signal())).usage).toBeNull();
    expect((await adapter(async () => reply({ eval_count: -1 })).invoke(request, signal())).usage).toBeNull();
  });

  it('a refused connection is conclusively not sent; any other failure is not, and nothing else is called', async () => {
    const refused = vi.fn(async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); });
    await expect(adapter(refused).invoke(request, signal())).rejects.toBeInstanceOf(ProviderNotSentError);
    expect(refused).toHaveBeenCalledTimes(1); // no second endpoint, no cloud fallback
    const reset = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }); };
    expect(await code(adapter(reset).invoke(request, signal()))).toBe('AI_PROVIDER_FAILURE');
    expect(await code(adapter(async () => reply({}, 404)).invoke(request, signal()))).toBe('AI_PROVIDER_FAILURE');
    expect(await code(adapter(async () => new Response('not json')).invoke(request, signal()))).toBe('AI_PROVIDER_FAILURE');
  });

  it('passes cancellation to the transport', async () => {
    const abort = new AbortController();
    const hanging = (_u: string, init: RequestInit) => new Promise<Response>((_r, reject) => { init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))); });
    const pending = code(adapter(hanging).invoke(request, abort.signal));
    abort.abort();
    expect(await pending).toBe('AI_PROVIDER_FAILURE');
  });

  it('sends nothing past the concurrency limit, and frees the slot afterwards', async () => {
    let release!: (r: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>(r => { release = r; }));
    const a = adapter(fetchImpl);
    const first = a.invoke(request, signal());
    await expect(a.invoke(request, signal())).rejects.toBeInstanceOf(ProviderNotSentError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    release(reply()); await first;
    const second = a.invoke(request, signal());
    release(reply());
    expect((await second).status).toBe('completed');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refuses an invalid concurrency limit', () => {
    for (const n of [0, -1, 1.5, 9]) expect(() => adapter(async () => reply(), n)).toThrowError(GovernanceError);
  });

  it('has no dispatch outside tests', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const fetchImpl = vi.fn(async () => reply());
    expect(await code(adapter(fetchImpl).invoke(request, signal()))).toBe('AI_DISPATCH_UNAVAILABLE');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('local runtime status', () => {
  const answers: Record<string, unknown> = { '/api/version': { version: '0.0-synthetic' }, '/api/tags': { models: [{ name: 'm:1', size: 100 }, { size: 5 }] },
    '/api/ps': { models: [{ name: 'm:1', size: 100, size_vram: 100 }] } };
  const local = async (url: string) => new Response(JSON.stringify(answers[new URL(url).pathname]));

  it('reports only what the runtime reports', async () => {
    expect(await readLocalRuntimeStatus({ fetchImpl: local as any })).toEqual({ status: 'AVAILABLE', endpoint: 'http://127.0.0.1:11434', version: '0.0-synthetic',
      models: [{ name: 'm:1', sizeBytes: 100 }], loaded: [{ name: 'm:1', sizeBytes: 100, vramBytes: 100, processor: 'GPU' }] });
  });
  it('is unavailable, with no figures, when the runtime does not answer', async () => {
    const down = async () => { throw new TypeError('fetch failed'); };
    expect(await readLocalRuntimeStatus({ fetchImpl: down as any })).toEqual({ status: 'UNAVAILABLE', endpoint: 'http://127.0.0.1:11434' });
    expect(await readLocalRuntimeStatus({ fetchImpl: (async () => new Response('', { status: 500 })) as any })).toMatchObject({ status: 'UNAVAILABLE' });
  });
  it('refuses a non-local endpoint before any request', async () => {
    const fetchImpl = vi.fn();
    await expect(readLocalRuntimeStatus({ endpoint: 'https://api.example.com', fetchImpl: fetchImpl as any })).rejects.toBeInstanceOf(GovernanceError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('states where a model runs only from reported figures', () => {
    expect([processorOf(100, 100), processorOf(100, 0), processorOf(100, 40), processorOf(null, 40), processorOf(100, null)]).toEqual(['GPU', 'CPU', 'MIXED', 'UNKNOWN', 'UNKNOWN']);
  });
});
