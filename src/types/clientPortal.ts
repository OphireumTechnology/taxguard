export type ClientPortalTab =
  | 'overview'
  | 'workspace'
  | 'client_intake'
  | 'required_documents'
  | 'document_center'
  | 'documents'
  | 'accounting_connections'
  | 'integrations'
  | 'tax_strategies'
  | 'tax_return'
  | 'reports'
  | 'approvals'
  | 'messages'
  | 'requests'
  | 'appointments'
  | 'calendar'
  | 'notifications'
  | 'billing'
  | 'profile_security'
  | 'onboarding'
  | string;

export type TaxWorkspaceTab =
  | 'intake'
  | 'documents'
  | 'accounting'
  | 'return'
  | 'reports'
  | 'advisory'
  | string;

export type ProfileSecurityTab =
  | 'profile'
  | 'security'
  | 'mfa'
  | 'sessions'
  | 'notifications'
  | 'preferences'
  | string;
