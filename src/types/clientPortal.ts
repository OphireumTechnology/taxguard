export type ClientPortalTab =
  | 'dashboard'
  | 'overview'
  | 'tax_workspace'
  | 'tax_return'
  | 'documents'
  | 'vault'
  | 'collection'
  | 'accounting'
  | 'billing'
  | 'messages'
  | 'requests'
  | 'appointments'
  | 'notifications'
  | 'strategies'
  | 'profile'
  | 'security'
  | 'profile_security'
  | string;

export type TaxWorkspaceTab =
  | 'overview'
  | 'onboarding'
  | 'collection'
  | 'validation'
  | 'accounting'
  | 'return'
  | 'signatures'
  | 'archive'
  | string;

export type ProfileSecurityTab =
  | 'profile'
  | 'security'
  | 'mfa'
  | 'sessions'
  | 'notifications'
  | 'amendments'
  | string;
