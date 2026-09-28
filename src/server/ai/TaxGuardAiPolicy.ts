import type {
  TaxGuardAiRequest
} from './TaxGuardGeminiGateway';

const BLOCKED_PATTERNS:
  readonly RegExp[] = [
    /\b(?:\d{3}[- ]\d{2}[- ]\d{4}|\d{2}-\d{7}|\d{9,19})\b/,
    /\b(?:ssn|tin|ein|bank|routing|account\s*number|auth(?:entication)?\s*token|access[_ -]?token|secret)\s*[:=]/i,
    /\bsk-[a-z0-9_-]{8,}/i,
    /-----BEGIN[\s\S]*PRIVATE KEY-----/i,

    /\bpassword\s*[:=]/i,

    /\bapi[_ -]?key\s*[:=]/i,

    /\bbearer\s+[a-z0-9._~-]+/i,

    /\bx-session-token\s*[:=]/i
  ];

function combined(
  request: TaxGuardAiRequest
): string {
  return [
    request.task,
    request.context ?? '',
    ...(request.evidence ?? [])
  ].join('\n');
}

export class TaxGuardAiPolicy {
  static validate(
    request: TaxGuardAiRequest
  ): void {
    if (
      !request ||
      typeof request !==
        'object'
    ) {
      throw new Error(
        'TAXGUARD_AI_REQUEST_REQUIRED'
      );
    }

    if (
      typeof request.task !== 'string' ||
      !request.task.trim()
    ) {
      throw new Error(
        'TAXGUARD_AI_TASK_REQUIRED'
      );
    }

    if ((request.context !== undefined && typeof request.context !== 'string') ||
        (request.evidence !== undefined && (!Array.isArray(request.evidence) || request.evidence.some(v => typeof v !== 'string'))) ||
        (request.riskLevel !== undefined && !['routine', 'material', 'critical'].includes(request.riskLevel))) {
      throw new Error('TAXGUARD_AI_INVALID_REQUEST');
    }

    if (
      request.task.length >
      12000
    ) {
      throw new Error(
        'TAXGUARD_AI_TASK_TOO_LARGE'
      );
    }

    if (
      request.context &&
      request.context.length >
        50000
    ) {
      throw new Error(
        'TAXGUARD_AI_CONTEXT_TOO_LARGE'
      );
    }

    if (
      (request.evidence?.length ?? 0) >
      50
    ) {
      throw new Error(
        'TAXGUARD_AI_TOO_MUCH_EVIDENCE'
      );
    }

    for (
      const evidence
      of request.evidence ?? []
    ) {
      if (
        evidence.length >
        20000
      ) {
        throw new Error(
          'TAXGUARD_AI_EVIDENCE_TOO_LARGE'
        );
      }
    }

    const payload =
      combined(request);

    if (payload.length > 64000) throw new Error('TAXGUARD_AI_PAYLOAD_TOO_LARGE');

    for (
      const pattern
      of BLOCKED_PATTERNS
    ) {
      if (
        pattern.test(
          payload
        )
      ) {
        throw new Error(
          'TAXGUARD_AI_SECRET_MATERIAL_BLOCKED'
        );
      }
    }
  }
}
