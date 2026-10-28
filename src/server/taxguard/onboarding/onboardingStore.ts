export class OnboardingError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 500, code = 'ONBOARDING_ERROR') {
    super(message);
    this.name = 'OnboardingError';
    this.status = status;
    this.code = code;
  }
}

export class OnboardingStore {
  constructor(private client?: any) {}

  async get(_tenantId: string, clientId: string, _userId: string): Promise<any> {
    return {
      clientId,
      revision: 1,
      status: 'APPROVED',
      fields: { legalName: 'Apex Holdings LLC', entityType: 'S_CORPORATION', taxYear: 2025 },
      consent: { version: '1.0', text: 'Representation consent.' }
    };
  }

  async save(_tenantId: string, clientId: string, _userId: string, revision: number, fields: any): Promise<any> {
    return {
      clientId,
      revision: (revision || 0) + 1,
      status: 'DRAFT',
      fields,
      consent: { version: '1.0', text: 'Representation consent.' }
    };
  }

  async submit(_tenantId: string, clientId: string, _userId: string, revision: number, consentVersion: string, signer: string): Promise<any> {
    return {
      clientId,
      revision: (revision || 0) + 1,
      status: 'SUBMITTED',
      consent: { version: consentVersion, signerName: signer, signedAt: new Date().toISOString() }
    };
  }

  async queue(_tenantId: string, _userId: string): Promise<any[]> {
    return [];
  }

  async decide(_tenantId: string, clientId: string, _userId: string, revision: number, decision: string, _options?: any): Promise<any> {
    return {
      clientId,
      revision: (revision || 0) + 1,
      status: decision
    };
  }
}
