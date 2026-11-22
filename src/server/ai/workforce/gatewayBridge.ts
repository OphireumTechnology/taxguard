import type { AgentId, DataClassification, Json } from '../../../ai/types';
import { WorkforceError } from './contracts';

/**
 * Approved Server-Side LLM Gateway Bridge for TaxGuard's 61-Agent Workforce.
 *
 * Every LLM call (if an agent optionally invokes language synthesis in addition to deterministic
 * domain checks) MUST pass through this server-side bridge:
 * - Versioned prompt ID & version required
 * - Approved model configuration required
 * - Explicit data classification policy enforced (SYSTEM_SECRET and AUTHENTICATION_DATA refused)
 * - Token budget, cost budget, and timeout enforced
 * - Output validated against an explicit structural validator
 * - When no approved provider is configured or reachable, returns an explicit
 *   UNAVAILABLE_HUMAN_REVIEW_REQUIRED result instead of fabricating model output.
 */

export interface GovernedPromptConfig {
  readonly agent_id: AgentId;
  readonly prompt_id: string;
  readonly prompt_version: string;
  readonly model_id: string;
  readonly model_version: string;
  readonly data_classification_limit: Exclude<DataClassification, 'SYSTEM_SECRET' | 'AUTHENTICATION_DATA'>;
  readonly token_budget: number;
  readonly cost_budget_usd: number;
  readonly timeout_ms: number;
}

export interface GatewayTransport {
  readonly provider: string;
  invoke(request: {
    prompt_id: string;
    prompt_version: string;
    model_id: string;
    model_version: string;
    structured_input: Readonly<Record<string, Json>>;
    token_budget: number;
    timeout_ms: number;
  }, signal: AbortSignal): Promise<{
    raw_text: string;
    tokens_used: number;
    estimated_cost_usd: number;
  }>;
}

export type GatewayInvocationResult<T> =
  | {
      readonly status: 'OK';
      readonly data: T;
      readonly provider: string;
      readonly model_id: string;
      readonly prompt_id: string;
      readonly prompt_version: string;
      readonly tokens_used: number;
      readonly estimated_cost_usd: number;
    }
  | {
      readonly status: 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED';
      readonly reason_code:
        | 'AI_PROVIDER_NOT_CONFIGURED'
        | 'AI_PROVIDER_TIMEOUT'
        | 'AI_PROVIDER_BUDGET_EXCEEDED'
        | 'AI_PROVIDER_INVALID_OUTPUT'
        | 'AI_PROVIDER_UNAVAILABLE';
      readonly human_review_required: true;
    };

export async function invokeApprovedGateway<T>(params: {
  config: GovernedPromptConfig;
  requestedDataClasses: readonly DataClassification[];
  structuredInput: Readonly<Record<string, Json>>;
  validateOutput: (parsed: unknown) => T;
  transport: GatewayTransport | null;
}): Promise<GatewayInvocationResult<T>> {
  const { config, requestedDataClasses, structuredInput, validateOutput, transport } = params;

  if (
    !config.prompt_id ||
    !config.prompt_version ||
    !config.model_id ||
    !config.model_version ||
    !Number.isFinite(config.token_budget) ||
    config.token_budget <= 0 ||
    !Number.isFinite(config.cost_budget_usd) ||
    config.cost_budget_usd <= 0 ||
    !Number.isFinite(config.timeout_ms) ||
    config.timeout_ms <= 0 ||
    config.timeout_ms > 30_000
  ) {
    throw new WorkforceError('AI_GATEWAY_INVALID_CONFIG', 400);
  }

  for (const cls of requestedDataClasses) {
    if (cls === 'SYSTEM_SECRET' || cls === 'AUTHENTICATION_DATA') {
      throw new WorkforceError('AI_PROTECTED_DATA_DENIED', 403);
    }
  }

  if (!transport) {
    return {
      status: 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED',
      reason_code: 'AI_PROVIDER_NOT_CONFIGURED',
      human_review_required: true,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, config.timeout_ms);

  try {
    const response = await transport.invoke(
      {
        prompt_id: config.prompt_id,
        prompt_version: config.prompt_version,
        model_id: config.model_id,
        model_version: config.model_version,
        structured_input: structuredInput,
        token_budget: config.token_budget,
        timeout_ms: config.timeout_ms,
      },
      controller.signal,
    );

    if (
      !Number.isFinite(response.tokens_used) ||
      response.tokens_used > config.token_budget ||
      !Number.isFinite(response.estimated_cost_usd) ||
      response.estimated_cost_usd > config.cost_budget_usd
    ) {
      return {
        status: 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED',
        reason_code: 'AI_PROVIDER_BUDGET_EXCEEDED',
        human_review_required: true,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.raw_text);
      const validated = validateOutput(parsed);
      return {
        status: 'OK',
        data: validated,
        provider: transport.provider,
        model_id: config.model_id,
        prompt_id: config.prompt_id,
        prompt_version: config.prompt_version,
        tokens_used: response.tokens_used,
        estimated_cost_usd: response.estimated_cost_usd,
      };
    } catch {
      return {
        status: 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED',
        reason_code: 'AI_PROVIDER_INVALID_OUTPUT',
        human_review_required: true,
      };
    }
  } catch {
    return {
      status: 'UNAVAILABLE_HUMAN_REVIEW_REQUIRED',
      reason_code: timedOut ? 'AI_PROVIDER_TIMEOUT' : 'AI_PROVIDER_UNAVAILABLE',
      human_review_required: true,
    };
  } finally {
    clearTimeout(timer);
  }
}
