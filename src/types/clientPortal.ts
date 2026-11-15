export type ClientPortalTab =
  | 'overview'
  | 'workspace'
  | 'client_intake'
  | 'required_documents'
  | 'document_center'
  | 'documents'
  | 'accounting_connections'
  | 'tax_return'
  | 'requests'
  | 'messages'
  | 'appointments'
  | 'billing'
  | 'invoices'
  | 'profile'
  | 'security'
  | 'notifications'
  | 'tax_strategies'
  | 'legal'
  | 'archive'
  | string;

export type TaxWorkspaceTab =
  | 'checklist'
  | 'upload'
  | 'vault'
  | 'questionnaire'
  | 'accounting'
  | 'return'
  | 'approvals'
  | string;

export type ProfileSecurityTab =
  | 'taxpayer_profile'
  | 'business_entity'
  | 'dependents_reps'
  | 'privacy_consent'
  | 'mfa_credentials'
  | 'audit_activity'
  | string;
