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
  | 'onboarding';

export type TaxWorkspaceTab =
  | 'intake'
  | 'documents'
  | 'books_records'
  | 'return_review'
  | 'filing_status'
  | 'business_closure'
  | 'accounting_connections'
  | 'tax_strategies'
  | 'reports'
  | 'collection';

export type ProfileSecurityTab =
  | 'taxpayer_profile'
  | 'business_entity'
  | 'dependents_reps'
  | 'storage_selection'
  | 'devices_sessions'
  | 'mfa_security'
  | 'privacy_consent'
  | 'data_export_closure'
  | 'audit_activity';
