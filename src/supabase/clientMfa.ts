export interface ClientMfaStatus {
  state: 'READY' | 'UNAVAILABLE' | 'NO_PROVIDER_SESSION' | 'ERROR';
  verifiedFactors: number;
  currentLevel: string;
}

export interface ClientTotpEnrollment {
  id: string;
  totpSecret?: string;
  qrCode?: string;
}

export class ClientMfaError extends Error {}

export function clientMfaErrorText(err: unknown): string {
  return err instanceof Error ? err.message : 'MFA error occurred.';
}

export function clientMfaEnrollmentAvailable(): boolean {
  return false;
}

export async function readClientMfaStatus(): Promise<ClientMfaStatus> {
  return {
    state: 'UNAVAILABLE',
    verifiedFactors: 0,
    currentLevel: 'aal1',
  };
}

export async function beginClientTotpEnrollment(): Promise<ClientTotpEnrollment> {
  throw new ClientMfaError('MFA enrollment unavailable.');
}

export async function cancelClientTotpEnrollment(): Promise<void> {}

export async function confirmClientTotpEnrollment(_id: string, _code: string): Promise<void> {}
