export type ProfileSecurityTab = 'security' | 'audit_activity' | 'mfa' | 'profile' | 'evidence';

export interface ClientProfileData {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxYear?: number;
  [key: string]: unknown;
}
