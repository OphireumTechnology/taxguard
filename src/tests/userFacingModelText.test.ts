import { describe, expect, it } from 'vitest';
import { filterModelText, WITHHELD_NOTICE } from '../server/ai/userFacingModelText';
import { LocalOllamaProviderAdapter } from '../server/ai/gateway/LocalOllamaProviderAdapter';
import { COUNTS_REVIEW_SCHEMA } from '../server/ai/gateway/structuredOutput';

// Deterministic response filtering outside the model. Synthetic text only.
const user = (text: unknown) => filterModelText(text, 'USER');
const admin = (text: unknown) => filterModelText(text, 'ADMINISTRATOR');

describe('reasoning traces', () => {
  it.each(['<think>private plan</think>Hello.', '<THINK>\nplan\n</THINK>\nHello.', '<thinking>a</thinking>Hello.', '<reasoning type="x">a</reasoning>Hello.', '<think>a</think><think>b</think>Hello.'])('removes %j', raw => {
    expect(user(raw)).toEqual({ text: 'Hello.', withheld: null, reasoningRemoved: true });
  });
  it.each(['<think>never finished', 'Hello.<think>rest', 'Hello.</think>', '</think>Hello.'])('shows nothing from an unfinished trace: %j', raw => {
    const out = user(raw);
    expect(out).toMatchObject({ text: WITHHELD_NOTICE, withheld: 'REASONING_UNFINISHED' });
    expect(out.text).not.toMatch(/never finished|rest|Hello/);
  });
  it('an unfinished trace is withheld from administrators too', () => { expect(admin('<think>x').withheld).toBe('REASONING_UNFINISHED'); });
  it('leaves ordinary text alone, including words near the tag names', () => {
    expect(user('I think the W-2 is missing. Reasoning: two forms were uploaded.')).toEqual({ text: 'I think the W-2 is missing. Reasoning: two forms were uploaded.', withheld: null, reasoningRemoved: false });
  });
});

describe('false provenance', () => {
  it.each(['The underlying model weights were developed by Ophireum Technology.', 'Ophireum Technology created the model weights.', 'Ophireum built the underlying model.', 'Ophireum Technology owns the weights outright.'])('is never shown to anyone: %s', text => {
    expect(user(text).withheld).toBe('FALSE_PROVENANCE');
    expect(admin(text)).toMatchObject({ withheld: 'FALSE_PROVENANCE', text: WITHHELD_NOTICE });
  });
  it('a truthful statement reaches an administrator in full', () => {
    const text = 'Ophireum Technology did not create the underlying model weights. They are Qwen3 8B by the Qwen team at Alibaba Cloud, under the Apache License 2.0.';
    expect(admin(text)).toEqual({ text, withheld: null, reasoningRemoved: false });
  });
  it('does not flag the operator doing what it does do', () => {
    expect(user('Ophireum Technology operates Ophir AI.').withheld).toBeNull();
    expect(user('I am Ophir AI, powered by Ophir Model, operated by Ophireum Technology.').withheld).toBeNull();
    expect(user('Ophireum Technology created this appointment reminder.').withheld).toBeNull();
  });
});

describe('ordinary users', () => {
  it.each(['This runs on Qwen3 8B.', 'I use qwen3:8b.', 'Powered by Ollama.', 'The weights come from Alibaba Cloud.', 'Built on llama.cpp and llama models.', 'Similar to ChatGPT.', 'Google Gemini said so.', 'gpt-4o answered.'])('withholds an upstream reference: %s', text => {
    expect(user(text)).toMatchObject({ text: WITHHELD_NOTICE, withheld: 'UPSTREAM_REFERENCE' });
  });
  it.each(['Connect to http://127.0.0.1:11434/api/chat', 'localhost:11434 is up', 'Files are in D:\\TaxGuard\\Development\\123\\local-ai\\models', 'see local-ai/config/OphirModelfile', 'Use Bearer abcdef123456789', 'key sk-abcdefghijklmnop', 'OLLAMA_HOST is set', 'the SUPABASE_SERVICE_ROLE_KEY value', '-----BEGIN RSA PRIVATE KEY-----'])('withholds an internal detail: %s', text => {
    expect(user(text)).toMatchObject({ text: WITHHELD_NOTICE, withheld: 'INTERNAL_DETAIL' });
  });
  it('the notice itself is branded, names nothing upstream and claims no authorship', () => {
    expect(WITHHELD_NOTICE).toContain('Ophir AI');
    expect(user(WITHHELD_NOTICE).withheld).toBeNull();
  });
  it('does not rewrite a vendor name into a false statement', () => {
    expect(user('The weights are Qwen3 8B.').text).not.toContain('Ophir Model');
  });
  it('ordinary tax text passes unchanged', () => {
    for (const text of ['Please upload your W-2 by the end of the month.', 'Form 1099-NEC reports nonemployee compensation.', 'Schedule C line 31 shows net profit.'])
      expect(user(text)).toEqual({ text, withheld: null, reasoningRemoved: false });
  });
  it('a non-string reply becomes empty text', () => { expect(user(undefined)).toEqual({ text: '', withheld: null, reasoningRemoved: false }); });
});

describe('local adapter', () => {
  const request = { model: 'synthetic:1', instructions: 'x', schema: COUNTS_REVIEW_SCHEMA as any, input: { purpose: 'IDENTIFY_REVIEW_QUESTIONS' as any, taxYear: 2025, evidenceCount: 1 }, max_output_tokens: 8 };
  const invoke = (message: Record<string, unknown>) => new LocalOllamaProviderAdapter({ fetchImpl: (async () => new Response(JSON.stringify({ done: true, done_reason: 'stop', prompt_eval_count: 1, eval_count: 1, message }))) as any }).invoke(request, new AbortController().signal);
  it('asks for reasoning off, and never passes the reasoning field on', async () => {
    let body: any;
    await new LocalOllamaProviderAdapter({ fetchImpl: (async (_u: string, init: RequestInit) => { body = JSON.parse(init.body as string); return new Response(JSON.stringify({ done: true, done_reason: 'stop', message: { content: '{}' } })); }) as any }).invoke(request, new AbortController().signal);
    expect(body.think).toBe(false);
    const out = await invoke({ content: '{"a":1}', thinking: 'secret reasoning' });
    expect(JSON.stringify(out)).not.toContain('secret reasoning');
  });
  it('removes a reasoning block that arrives inside the content', async () => {
    expect(await invoke({ content: '<think>secret</think>{"a":1}' })).toMatchObject({ status: 'completed', text: '{"a":1}' });
  });
  it('does not accept a reply with an unfinished trace', async () => {
    const out = await invoke({ content: '<think>secret never closed' });
    expect(out.status).toBe('incomplete');
    expect(out.text).not.toContain('secret');
  });
});
