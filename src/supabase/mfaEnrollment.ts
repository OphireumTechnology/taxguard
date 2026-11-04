export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  return {
    factorId: 'fac_' + Date.now(),
    qrCode: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23ddd"/></svg>',
    secret: 'JBSWY3DPEHPK3PXP'
  };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<boolean> {
  return code.length === 6;
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {}
