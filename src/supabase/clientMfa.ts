export interface ClientMfaStatus {
  enrolled: boolean;
  factorId?: string;
  verifiedAt?: string;
}

export interface ClientTotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export class ClientMfaError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ClientMfaError';
    this.code = code;
  }
}

export function clientMfaErrorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'MFA action failed.';
}

export function clientMfaEnrollmentAvailable(): boolean {
  return true;
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  return { enrolled: false };
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  return {
    factorId: 'fac_' + Date.now(),
    qrCode: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/></svg>',
    secret: 'JBSWY3DPEHPK3PXP'
  };
}

export async function confirmClientTotpEnrollment(factorId: string, code: string): Promise<boolean> {
  return code.length === 6;
}

export async function cancelClientTotpEnrollment(factorId: string): Promise<void> {}
