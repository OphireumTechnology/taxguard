import type {
  TaxGuardAiRequest
} from './TaxGuardGeminiGateway';

const BLOCKED_PATTERNS:
  readonly RegExp[] = [
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
      !request.task ||
      !request.task.trim()
    ) {
      throw new Error(
        'TAXGUARD_AI_TASK_REQUIRED'
      );
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
