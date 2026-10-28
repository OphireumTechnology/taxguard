export interface TotpEnrollment {
  id: string;
  totpSecret?: string;
  qrCode?: string;
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  return { id: 'mock_factor', totpSecret: 'MOCKSECRET', qrCode: '' };
}

export async function cancelTotpEnrollment(): Promise<void> {}

export async function confirmTotpEnrollment(_id: string, _code: string): Promise<void> {}
