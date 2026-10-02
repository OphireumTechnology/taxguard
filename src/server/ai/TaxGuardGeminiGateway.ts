import { TaxGuardAiPolicy } from './TaxGuardAiPolicy';

export type TaxGuardAiRisk =
  | 'routine'
  | 'material'
  | 'critical';

export interface TaxGuardAiRequest {
  task: string;
  context?: string;
  evidence?: readonly string[];
  riskLevel?: TaxGuardAiRisk;
}

export interface TaxGuardAiProposal {
  provider: 'GOOGLE_GEMINI';

  model: string;

  proposal: string;

  isAiProposedOnly: true;

  requiresHumanReview: true;

  authorityVerified: false;

  externalSubmissionAllowed: false;

  riskLevel: TaxGuardAiRisk;

  generatedAt: string;
}

function required(
  value: string | undefined,
  code: string
): string {
  const normalized =
    value?.trim() ?? '';

  if (!normalized) {
    throw new Error(code);
  }

  return normalized;
}

function sanitizeText(
  value: string
): string {
  return value
    .replace(
      /\b\d{3}-\d{2}-\d{4}\b/g,
      '[REDACTED_SSN]'
    )
    .replace(
      /\b(?:\d[ -]*?){13,19}\b/g,
      '[REDACTED_PAYMENT_NUMBER]'
    )
    .replace(
      /-----BEGIN[\s\S]*?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/gi,
      '[REDACTED_PRIVATE_KEY]'
    )
    .replace(
      /\bBearer\s+[A-Za-z0-9._~-]+/gi,
      '[REDACTED_BEARER_TOKEN]'
    );
}

function buildPrompt(
  request: TaxGuardAiRequest
): string {
  const task =
    sanitizeText(
      required(
        request.task,
        'TAXGUARD_AI_TASK_REQUIRED'
      )
    );

  const context =
    sanitizeText(
      request.context ?? ''
    );

  const evidence =
    (request.evidence ?? [])
      .map(sanitizeText)
      .filter(Boolean)
      .map(
        (item, index) =>
          '[' +
          (index + 1) +
          '] ' +
          item
      )
      .join('\n');

  return [
    'You are the TaxGuard AI assistance layer.',
    '',
    'MANDATORY TAXGUARD GOVERNANCE:',
    '- AI output is a proposal only.',
    '- Never claim a tax position is approved.',
    '- Never claim authority is verified unless TaxGuard supplies verified authority.',
    '- Never invent statutes, regulations, forms, facts, evidence, citations, calculations, taxpayer data, or filing status.',
    '- Never silently repair missing facts.',
    '- Explicitly identify uncertainty and missing information.',
    '- Material tax decisions require authorized human review.',
    '- External tax filing is disabled.',
    '- Deterministic TaxGuard calculation engines remain authoritative for tax calculations.',
    '- Human review and TaxGuard governance remain authoritative.',
    '',
    'TASK:',
    task,
    '',
    context
      ? 'CONTEXT:\n' + context
      : 'CONTEXT:\nNo additional context supplied.',
    '',
    evidence
      ? 'EVIDENCE:\n' + evidence
      : 'EVIDENCE:\nNo evidence supplied.',
    '',
    'OUTPUT REQUIREMENTS:',
    '- Be concise and professional.',
    '- Identify assumptions.',
    '- Identify missing information.',
    '- Identify material uncertainties.',
    '- Identify any required human review.',
    '- Do not state that the proposal is approved.',
    '- Do not authorize filing.'
  ].join('\n');
}

function extractText(
  response: unknown
): string {
  const candidate =
    response as {
      text?: string | (() => string);
    };

  if (
    typeof candidate.text ===
    'string'
  ) {
    return candidate.text.trim();
  }

  if (
    typeof candidate.text ===
    'function'
  ) {
    return candidate.text().trim();
  }

  throw new Error(
    'TAXGUARD_AI_EMPTY_RESPONSE'
  );
}

export class TaxGuardGeminiGateway {
  static readonly model = 'gemini-2.5-flash';

  static isConfigured(): boolean {
    return false;
  }

  static async propose(
    request: TaxGuardAiRequest
  ): Promise<TaxGuardAiProposal> {
    TaxGuardAiPolicy.validate(request);
    throw new Error('TAXGUARD_AI_NOT_CONFIGURED');
  }
}
