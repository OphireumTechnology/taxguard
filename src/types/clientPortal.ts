export type ClientPortalTab =
  | 'overview'
  | 'dashboard'
  | 'documents'
  | 'tax_return'
  | 'accounting'
  | 'billing'
  | 'messages'
  | 'requests'
  | 'appointments'
  | 'notifications'
  | 'strategies'
  | 'profile'
  | 'security'
  | string;

export type TaxWorkspaceTab =
  | 'overview'
  | 'documents'
  | 'checklist'
  | 'questionnaire'
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
  | string;
