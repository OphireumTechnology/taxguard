import {
  beginClientTotpEnrollment,
  cancelClientTotpEnrollment,
  confirmClientTotpEnrollment,
  type ClientTotpEnrollment,
} from './clientMfa';

export type TotpEnrollment = ClientTotpEnrollment;

export async function beginTotpEnrollment(friendlyName = 'Staff Authenticator'): Promise<TotpEnrollment> {
  return beginClientTotpEnrollment(friendlyName);
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  return confirmClientTotpEnrollment(factorId, code);
}

export async function cancelTotpEnrollment(factorId: string): Promise<void> {
  return cancelClientTotpEnrollment(factorId);
}
