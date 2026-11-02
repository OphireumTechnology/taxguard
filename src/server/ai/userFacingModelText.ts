/**
 * The last check on model text before an ordinary user can see it. Deterministic and outside the model: a model's own
 * instructions are not relied on.
 *  - Reasoning traces are removed. An unfinished trace means the visible answer cannot be separated from it, so nothing shows.
 *  - A reply that claims Ophireum Technology created the third-party weights is false and is never shown to anyone.
 *  - A reply that names upstream technology, an internal endpoint, a path or a credential is withheld from an ordinary user.
 *    It is withheld rather than rewritten: replacing a vendor's name in a sentence could turn a true statement into a false
 *    one. The neutral notice below claims nothing, and authorized administrators keep the provenance record.
 */
export const WITHHELD_NOTICE = 'Ophir AI could not show this response. Technical details about this service are available from your administrator.';
export type TextAudience = 'USER' | 'ADMINISTRATOR';
export type WithheldReason = 'REASONING_UNFINISHED' | 'FALSE_PROVENANCE' | 'UPSTREAM_REFERENCE' | 'INTERNAL_DETAIL';
export interface FilteredModelText { text: string; withheld: WithheldReason | null; reasoningRemoved: boolean }

const REASONING_BLOCK = /<(think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const REASONING_OPEN = /<\/?(think|thinking|reasoning)\b[^>]*>/i;
const UPSTREAM = /\b(qwen\d*|ollama|llamacpp|llama|alibaba|openai|chatgpt|gpt-\d[\w.-]*|gemini|anthropic|claude|mistral|deepseek)\b/i;
const INTERNAL = /(127\.0\.0\.1|localhost|\[::1\])(:\d+)?|\blocal-ai[\\/]|\b[A-Za-z]:[\\/][\w .\\/-]+|\bBearer\s+[\w.-]{8,}|\bsk-[\w-]{12,}|\beyJ[\w-]{10,}\.[\w-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY|\b(SUPABASE_[A-Z_]*|OLLAMA_[A-Z_]+|[A-Z_]*API_KEY)\b/;
const OPERATOR = /\bOphireum(\s+Technology)?\b/i;
const AUTHORED = /\b(develop|develops|developed|create|creates|created|build|builds|built|train|trains|trained|invent|invented|own|owns|owned)\b/i;
const NEGATED = /\b(not|never|no|didn't|doesn't|neither)\b/i;
const WEIGHTS = /\b(weights?|underlying model|base model|model weights|inference engine)\b/i;

/** A sentence that says the operator authored or owns the weights, without denying it. */
function claimsAuthorship(text: string) {
  return text.split(/(?<=[.!?])\s+|\n+/).some(s => OPERATOR.test(s) && AUTHORED.test(s) && WEIGHTS.test(s) && !NEGATED.test(s));
}

export function filterModelText(raw: unknown, audience: TextAudience): FilteredModelText {
  const input = typeof raw === 'string' ? raw : '';
  const stripped = input.replace(REASONING_BLOCK, '');
  const reasoningRemoved = stripped !== input;
  const withhold = (withheld: WithheldReason): FilteredModelText => ({ text: WITHHELD_NOTICE, withheld, reasoningRemoved });
  if (REASONING_OPEN.test(stripped)) return withhold('REASONING_UNFINISHED');
  const text = stripped.trim();
  if (claimsAuthorship(text)) return withhold('FALSE_PROVENANCE');
  if (audience === 'USER') {
    if (INTERNAL.test(text)) return withhold('INTERNAL_DETAIL');
    if (UPSTREAM.test(text)) return withhold('UPSTREAM_REFERENCE');
  }
  return { text, withheld: null, reasoningRemoved };
}
