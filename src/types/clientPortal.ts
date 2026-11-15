export type ClientPortalTab =
  | 'overview'
  | 'documents'
  | 'collection'
  | 'requests'
  | 'accounting'
  | 'tax_return'
  | 'tax_strategies'
  | 'appointments'
  | 'messages'
  | 'billing'
  | 'notifications'
  | 'profile'
  | 'security'
  | 'legal'
  | string;

export type TaxWorkspaceTab =
  | 'overview'
  | 'documents'
  | 'collection'
  | 'bookkeeping'
  | 'tax_return'
  | 'review'
  | 'signing'
  | 'filing'
  | 'archive'
  | string;

export type ProfileSecurityTab =
  | 'profile'
  | 'security'
  | 'mfa'
  | 'notifications'
  | 'sessions'
  | string;
