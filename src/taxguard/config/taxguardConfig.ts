/**
 * TaxGuard AI – Verified Tax and Accounting Operations
 * Powered by Ophireum AI Technology
 * A/R Tax Services, LLC Platform Configuration
 */

export interface TaxGuardFeatureFlags {
  AI_DOCUMENT_INTELLIGENCE_ENABLED: boolean;
  AI_TAX_RESEARCH_ENABLED: boolean;
  AI_PLANNING_ENABLED: boolean;
  AI_RETURN_PREPARATION_ENABLED: boolean;
  AI_RESOLUTION_ENABLED: boolean;
  AI_VOICE_ENABLED: boolean;
  DEMO_MODE_ENABLED: boolean;
}

export const TAXGUARD_FEATURE_FLAGS: TaxGuardFeatureFlags = {
  AI_DOCUMENT_INTELLIGENCE_ENABLED: true,
  AI_TAX_RESEARCH_ENABLED: true,
  AI_PLANNING_ENABLED: true,
  AI_RETURN_PREPARATION_ENABLED: true,
  AI_RESOLUTION_ENABLED: true,
  AI_VOICE_ENABLED: true,
  DEMO_MODE_ENABLED: true
};

export interface TaxGuardFeatureConfig {
  enabled: boolean;
  moduleName: string;
  poweredBy: string;
  firmName: string;
  firmLocation: string;
  version: string;
  malwareScanningConfigured: boolean;
  emergencyAiKillSwitch: boolean;
  defaultConfidenceThreshold: number; // e.g. 0.85
  materialRiskApprovalRequired: boolean;
  makerCheckerEnforced: boolean;
  qrVerificationBaseUrl: string;
  flags: TaxGuardFeatureFlags;
}

export const TAXGUARD_CONFIG: TaxGuardFeatureConfig = {
  enabled: typeof process !== 'undefined' && process.env?.TAXGUARD_AI_ENABLED !== undefined 
    ? process.env.TAXGUARD_AI_ENABLED === 'true' 
    : true,
  moduleName: 'TaxGuard AI – Verified Tax and Accounting Operations',
  poweredBy: 'Powered by Ophireum AI Technology',
  firmName: 'A/R Tax Services, LLC',
  firmLocation: 'Columbia, South Carolina, USA',
  version: '2.4.0-enterprise',
  // In demo / preview without external ClamAV/VirusTotal cloud credentials, honestly state Not Configured
  malwareScanningConfigured: false,
  emergencyAiKillSwitch: false,
  defaultConfidenceThreshold: 0.85,
  materialRiskApprovalRequired: true,
  makerCheckerEnforced: true,
  qrVerificationBaseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://artaxservices.com',
  flags: TAXGUARD_FEATURE_FLAGS
};

export const TAXGUARD_ROLES = [
  'client',
  'accountant',
  'preparer',
  'reviewer',
  'cpa',
  'admin',
  'compliance_officer',
  'auditor'
] as const;

export type TaxGuardRole = typeof TAXGUARD_ROLES[number];

export const TAXGUARD_PERMISSIONS: Record<TaxGuardRole, {
  canUploadOwnDocs: boolean;
  canViewAllClients: boolean;
  canApproveExtraction: boolean;
  canModifyClassifications: boolean;
  canApproveMaterialConclusions: boolean;
  canSignAsClient: boolean;
  canReleaseFinalPackage: boolean;
  canModifyAuditLogs: boolean; // Must ALWAYS be false for all roles
  canAccessAdminSettings: boolean;
  canTriggerAiEmergencyDisable: boolean;
}> = {
  client: {
    canUploadOwnDocs: true,
    canViewAllClients: false,
    canApproveExtraction: false, // Can correct/verify own input, but cannot certify professional extraction
    canModifyClassifications: false,
    canApproveMaterialConclusions: false,
    canSignAsClient: true,
    canReleaseFinalPackage: false,
    canModifyAuditLogs: false,
    canAccessAdminSettings: false,
    canTriggerAiEmergencyDisable: false
  },
  preparer: {
    canUploadOwnDocs: true,
    canViewAllClients: true,
    canApproveExtraction: true,
    canModifyClassifications: true,
    canApproveMaterialConclusions: false, // Maker cannot checker
    canSignAsClient: false,
    canReleaseFinalPackage: false,
    canModifyAuditLogs: false,
    canAccessAdminSettings: false,
    canTriggerAiEmergencyDisable: false
  },
  accountant: {
    canUploadOwnDocs: true,
    canViewAllClients: true,
    canApproveExtraction: true,
    canModifyClassifications: true,
    canApproveMaterialConclusions: true,
    canSignAsClient: false,
    canReleaseFinalPackage: false,
    canModifyAuditLogs: false,
    canAccessAdminSettings: false,
    canTriggerAiEmergencyDisable: false
  },
  reviewer: {
    canUploadOwnDocs: true,
    canViewAllClients: true,
    canApproveExtraction: true,
    canModifyClassifications: true,
    canApproveMaterialConclusions: true,
    canSignAsClient: false,
    canReleaseFinalPackage: true,
    canModifyAuditLogs: false,
    canAccessAdminSettings: false,
    canTriggerAiEmergencyDisable: false
  },
  cpa: {
    canUploadOwnDocs: true,
    canViewAllClients: true,
    canApproveExtraction: true,
    canModifyClassifications: true,
    canApproveMaterialConclusions: true,
    canSignAsClient: false,
    canReleaseFinalPackage: true,
    canModifyAuditLogs: false,
    canAccessAdminSettings: true,
    canTriggerAiEmergencyDisable: true
  },
  admin: {
    canUploadOwnDocs: true,
    canViewAllClients: true,
    canApproveExtraction: true,
    canModifyClassifications: true,
    canApproveMaterialConclusions: true,
    canSignAsClient: false,
    canReleaseFinalPackage: true,
    canModifyAuditLogs: false, // Even admin cannot tamper with append-only audit trail
    canAccessAdminSettings: true,
    canTriggerAiEmergencyDisable: true
  },
  compliance_officer: {
    canUploadOwnDocs: false,
    canViewAllClients: true,
    canApproveExtraction: false,
    canModifyClassifications: false,
    canApproveMaterialConclusions: false,
    canSignAsClient: false,
    canReleaseFinalPackage: false,
    canModifyAuditLogs: false,
    canAccessAdminSettings: true,
    canTriggerAiEmergencyDisable: true
  },
  auditor: {
    canUploadOwnDocs: false,
    canViewAllClients: true,
    canApproveExtraction: false,
    canModifyClassifications: false,
    canApproveMaterialConclusions: false,
    canSignAsClient: false,
    canReleaseFinalPackage: false,
    canModifyAuditLogs: false,
    canAccessAdminSettings: false,
    canTriggerAiEmergencyDisable: false
  }
};
