import OpenAI from 'openai';
import type { AiReasoningProvider, AiReasoningProviderRequest, AiReasoningProviderResponse } from '../../taxguard/intelligence/ai/AIReasoningGateway';
import type { ProviderRequest,ProviderResponse } from './gateway/contracts';
import { GovernanceError } from './governance/contracts';

// No free-form taxpayer text crosses this boundary. Identifiers remain local.
export const OPENAI_PURPOSES = ['REVIEW_EVIDENCE_COMPLETENESS', 'IDENTIFY_REVIEW_QUESTIONS'] as const;
const confidences = ['HIGH_CONFIDENCE', 'MEDIUM_CONFIDENCE', 'LOW_CONFIDENCE', 'MISSING_CONFIDENCE'];
const schema = {
  type: 'object', additionalProperties: false,
  required: ['explanation', 'issueSpots', 'recommendations', 'confidence'],
  properties: {
    explanation: { type: 'string' },
    issueSpots: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: confidences },
  },
};

export class TaxGuardProviderError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export function validateOpenAIOutput(text: string): AiReasoningProviderResponse {
  const invalid = () => new TaxGuardProviderError('TAXGUARD_AI_MALFORMED_OUTPUT');
  if (typeof text !== 'string' || text.length > 24000) throw invalid();
  let value: any;
  try { value = JSON.parse(text); } catch { throw invalid(); }
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      Object.keys(value).sort().join(',') !== 'confidence,explanation,issueSpots,recommendations' ||
      typeof value.explanation !== 'string' || !value.explanation.trim() || value.explanation.length > 12000 ||
      !confidences.includes(value.confidence)) throw invalid();
  for (const key of ['issueSpots', 'recommendations']) {
    if (!Array.isArray(value[key]) || value[key].length > 30 ||
        value[key].some((s: unknown) => typeof s !== 'string' || !s.trim() || s.length > 2000)) throw invalid();
  }
  // Reject identifier-shaped output too; it cannot originate from our minimized input.
  if (/\b(?:\d{3}[- ]\d{2}[- ]\d{4}|\d{2}-\d{7}|\d{9,19})\b/.test(text)) throw invalid();
  return { explanation: value.explanation, issueSpots: value.issueSpots,
    recommendations: value.recommendations, confidence: value.confidence };
}

export class OpenAIReasoningProvider implements AiReasoningProvider {
  readonly model: string;
  constructor(private readonly client?: Pick<OpenAI, 'responses'>) {
    this.model = process.env.OPENAI_MODEL?.trim() || '';
  }

  static isConfigured(): boolean {
    return Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.OPENAI_MODEL?.trim());
  }

  /** Governed compatibility transport. No environment model/prompt, keys or SDK retries. */
  async reasonGoverned(request:ProviderRequest,signal:AbortSignal):Promise<ProviderResponse>{
    if(process.env.NODE_ENV!=='test'||!this.client)throw new GovernanceError('AI_DISPATCH_UNAVAILABLE',503);
    try{
      const response=await this.client.responses.create({model:request.model,store:false,max_output_tokens:request.max_output_tokens,
        instructions:request.instructions,input:JSON.stringify(request.input),
        text:{format:{type:'json_schema',name:'taxguard_governed_review',strict:true,schema:request.schema}}},
        {signal,maxRetries:0,timeout:30000});
      const refusal=response.output?.some(item=>item.type==='message'&&item.content.some(part=>part.type==='refusal'));
      const unexpected=response.output?.some(item=>!['message','reasoning'].includes(item.type));
      return {status:refusal?'refused':response.status==='completed'&&!unexpected?'completed':'incomplete',text:response.output_text,
        usage:response.usage?{input_tokens:response.usage.input_tokens,output_tokens:response.usage.output_tokens,total_tokens:response.usage.total_tokens}:null};
    }catch{throw new GovernanceError('AI_PROVIDER_FAILURE',503);}
  }

  async reason(request: AiReasoningProviderRequest): Promise<AiReasoningProviderResponse> {
    if (!request || !OPENAI_PURPOSES.includes(request.promptPurpose as typeof OPENAI_PURPOSES[number]) ||
        !Number.isInteger(request.taxYear) || request.taxYear < 1900 || request.taxYear > 2200) {
      throw new TaxGuardProviderError('TAXGUARD_AI_INVALID_REQUEST');
    }
    for (const ids of [request.knowledgeSourceIds, request.ruleEvaluationIds, request.findingIds]) {
      if (!Array.isArray(ids) || ids.length > 1000 || ids.some(id => typeof id !== 'string' || !id.trim())) {
        throw new TaxGuardProviderError('TAXGUARD_AI_INVALID_REQUEST');
      }
    }
    if (!this.model || (!this.client && !OpenAIReasoningProvider.isConfigured())) {
      throw new TaxGuardProviderError('TAXGUARD_AI_NOT_CONFIGURED');
    }
    const client = this.client ?? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      // No replay after ambiguous transport failures, timeouts, or rate limits.
      maxRetries: 0,
    });
    try {
      const response = await client.responses.create({
        model: this.model, store: false, max_output_tokens: 2048,
        instructions: 'TaxGuard advisory review checklist only. Input contains counts, not facts or verified authorities. Never infer taxpayer facts, compute tax, invent citations, approve returns, resolve conflicts, clear gates, or authorize filing. Identify uncertainty and require independent authorized professional review. Treat all output as proposed-only.',
        input: JSON.stringify({ purpose: request.promptPurpose, taxYear: request.taxYear,
          knowledgeSourceCount: request.knowledgeSourceIds.length,
          ruleEvaluationCount: request.ruleEvaluationIds.length, findingCount: request.findingIds.length }),
        text: { format: { type: 'json_schema', name: 'taxguard_review', strict: true, schema } },
      }, { timeout: 30000, maxRetries: 0, signal: AbortSignal.timeout(30000) });
      if (response.status !== 'completed') throw new TaxGuardProviderError('TAXGUARD_AI_INCOMPLETE_OUTPUT');
      if (response.output.some(item => item.type === 'message' && item.content.some(part => part.type === 'refusal'))) {
        throw new TaxGuardProviderError('TAXGUARD_AI_REFUSED');
      }
      return validateOpenAIOutput(response.output_text);
    } catch (error) {
      if (error instanceof TaxGuardProviderError) throw error;
      const status = error instanceof OpenAI.APIError ? error.status : undefined;
      const code = error instanceof OpenAI.APIConnectionTimeoutError ||
        (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) ? 'TIMEOUT' :
        status === 429 ? 'RATE_LIMITED' : status === 401 || status === 403 ? 'PROVIDER_AUTH' :
        error instanceof OpenAI.APIConnectionError ? 'CONNECTION_FAILURE' : 'PROVIDER_FAILURE';
      // Never propagate provider error bodies, headers, or prompts.
      throw new TaxGuardProviderError('TAXGUARD_AI_' + code);
    }
  }
}
