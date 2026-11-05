export type ClientPortalTab =
  | 'overview'
  | 'workspace'
  | 'client_intake'
  | 'required_documents'
  | 'document_center'
  | 'documents'
  | 'accounting_connections'
  | 'bookkeeping'
  | 'tax_returns'
  | 'tax_return'
  | 'invoices'
  | 'billing'
  | 'appointments'
  | 'messages'
  | 'requests'
  | 'tax_strategies'
  | 'security'
  | 'profile'
  | 'notifications'
  | 'archive'
  | 'settings'
  | 'help'
  | string;

export type TaxWorkspaceTab =
  | 'intake'
  | 'documents'
  | 'accounting'
  | 'return'
  | 'approvals'
  | 'filing'
  | string;

export type ProfileSecurityTab =
  | 'profile'
  | 'security'
  | 'mfa'
  | 'sessions'
  | 'preferences'
  | string;
