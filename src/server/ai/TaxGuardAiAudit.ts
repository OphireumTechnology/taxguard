export type TaxGuardAiAuditEventType =
  | 'AI_REQUEST_ACCEPTED'
  | 'AI_REQUEST_REJECTED'
  | 'AI_PROPOSAL_CREATED'
  | 'AI_PROVIDER_FAILURE';

export interface TaxGuardAiAuditEntry {
  eventType:
    TaxGuardAiAuditEventType;

  actorId: string;

  correlationId: string;

  timestamp: string;

  provider?:
    'GOOGLE_GEMINI';

  model?: string;

  isAiProposedOnly: true;

  externalSubmissionAllowed: false;
}

export class TaxGuardAiAudit {
  private static readonly entries:
    TaxGuardAiAuditEntry[] = [];

  static record(
    entry:
      Omit<
        TaxGuardAiAuditEntry,
        | 'timestamp'
        | 'isAiProposedOnly'
        | 'externalSubmissionAllowed'
      >
  ): TaxGuardAiAuditEntry {
    const complete:
      TaxGuardAiAuditEntry = {
        ...entry,

        timestamp:
          new Date()
            .toISOString(),

        isAiProposedOnly:
          true,

        externalSubmissionAllowed:
          false
      };

    this.entries.push(
      Object.freeze({
        ...complete
      })
    );

    return {
      ...complete
    };
  }

  static listForTests():
    readonly TaxGuardAiAuditEntry[] {
    return this.entries.map(
      entry => ({
        ...entry
      })
    );
  }

  static clearForTests(): void {
    this.entries.length = 0;
  }
}
