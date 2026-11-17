import {
  StageGateDecision
} from './stageGate.types';

export interface StageOneGateSnapshot {
  hardExitGatePassed?: boolean;

  identityComplete?: boolean;
  taxProfileComplete?: boolean;
  consentComplete?: boolean;
  reviewComplete?: boolean;

  tinValid?: boolean;
  addressComplete?: boolean;
  representativeComplete?: boolean;
  supportingDocumentsComplete?: boolean;
  duplicateResolutionComplete?: boolean;

  dossier?: any;
  blockingReasons?: string[];
}

export function evaluateStageOneServerGate(
  snapshot: StageOneGateSnapshot
): StageGateDecision {
  const dossier = snapshot.dossier;

  // Determine checks with fallback to dossier if provided
  const tinValid =
    snapshot.tinValid !== undefined
      ? snapshot.tinValid === true
      : dossier
        ? Boolean(dossier.tinLast4 && dossier.tinLast4 !== '0000' && String(dossier.tinLast4).length === 4)
        : true;

  const identityComplete =
    snapshot.identityComplete !== undefined
      ? snapshot.identityComplete === true
      : dossier
        ? Boolean((dossier.legalName || dossier.taxpayerFullName) && (dossier.taxpayerType || dossier.filingStatus))
        : false;

  const taxProfileComplete =
    snapshot.taxProfileComplete !== undefined
      ? snapshot.taxProfileComplete === true
      : dossier
        ? Boolean(dossier.taxpayerType || dossier.filingStatus)
        : false;

  const addressComplete =
    snapshot.addressComplete !== undefined
      ? snapshot.addressComplete === true
      : dossier
        ? Boolean(dossier.residentialOrPrincipalAddress?.street && dossier.residentialOrPrincipalAddress?.city && dossier.residentialOrPrincipalAddress?.zip)
        : true;

  const representativeComplete =
    snapshot.representativeComplete !== undefined
      ? snapshot.representativeComplete === true
      : dossier
        ? Boolean(dossier.taxpayerType === 'individual' || dossier.filingStatus || (dossier.authorizedRep?.fullName && dossier.authorizedRep?.title))
        : true;

  const supportingDocumentsComplete =
    snapshot.supportingDocumentsComplete !== undefined
      ? snapshot.supportingDocumentsComplete === true
      : dossier
        ? Boolean(dossier.supportingDocs && Array.isArray(dossier.supportingDocs) && dossier.supportingDocs.some((d: any) => d.verified === true))
        : true;

  const duplicateResolutionComplete =
    snapshot.duplicateResolutionComplete !== undefined
      ? snapshot.duplicateResolutionComplete === true
      : dossier
        ? Boolean(dossier.duplicateCheck?.status === 'CLEARED' || dossier.duplicateCheck?.reviewDecision === 'override_approved')
        : true;

  const consentComplete =
    snapshot.consentComplete !== undefined
      ? snapshot.consentComplete === true
      : dossier
        ? Boolean(dossier.engagementConsent?.irc7216ConsentAccepted === true &&
                  dossier.engagementConsent?.signerFullName?.trim().length >= 3 &&
                  dossier.engagementConsent?.signedAt)
        : false;

  const reviewComplete = snapshot.reviewComplete === true;
  const hardExitGatePassed = snapshot.hardExitGatePassed === true;

  const checks = {
    identityComplete,
    taxProfileComplete,
    tinValid,
    addressComplete,
    representativeComplete,
    supportingDocumentsComplete,
    duplicateResolutionComplete,
    consentComplete,
    reviewComplete,
    existingHardExitGatePassed: hardExitGatePassed
  };

  const blockingReasons = [
    ...(snapshot.blockingReasons || [])
  ];

  if (!checks.identityComplete) blockingReasons.push('Stage 01 requirement failed: identityComplete');
  if (!checks.taxProfileComplete) blockingReasons.push('Stage 01 requirement failed: taxProfileComplete');
  if (!checks.tinValid) blockingReasons.push('Stage 01 requirement failed: tinValid');
  if (!checks.addressComplete) blockingReasons.push('Stage 01 requirement failed: addressComplete');
  if (!checks.representativeComplete) blockingReasons.push('Stage 01 requirement failed: representativeComplete');
  if (!checks.supportingDocumentsComplete) blockingReasons.push('Stage 01 requirement failed: supportingDocumentsComplete');
  if (!checks.duplicateResolutionComplete) blockingReasons.push('Stage 01 requirement failed: duplicateResolutionComplete');
  if (!checks.consentComplete) blockingReasons.push('Stage 01 requirement failed: consentComplete');
  if (!checks.reviewComplete) blockingReasons.push('Stage 01 requirement failed: reviewComplete');
  if (!checks.existingHardExitGatePassed) blockingReasons.push('Stage 01 requirement failed: existingHardExitGatePassed');

  return {
    stage: 1,
    passed:
      Object.values(checks).every(Boolean) &&
      blockingReasons.length === 0,
    gateName: 'STAGE_01_HARD_EXIT_GATE',
    evidence: {
      source: 'StageOneOnboardingService',
      evaluatedAt: new Date().toISOString(),
      checks,
      blockingReasons
    }
  };
}
