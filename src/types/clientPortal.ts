export type ClientPortalTab =
  | 'overview'
  | 'dashboard'
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
  | 'client_intake'
  | 'required_documents'
  | 'document_center'
  | 'accounting_connections'
  | 'tax_strategies'
  | 'tax_return'
  | 'reports'
  | string;

export type ProfileSecurityTab =
  | 'profile'
  | 'security'
  | 'mfa'
  | 'notifications'
  | 'sessions'
  | 'audit'
  | string;
