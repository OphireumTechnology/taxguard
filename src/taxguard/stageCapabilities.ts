/**
 * Canonical 18-stage tax case capabilities as the platform supports them TODAY (Phase 12B).
 * `evidence` and `dependency` mirror the server policy taxguard_case_stage_policy (proposal 026);
 * src/tests/stageCapabilities.test.ts fails if they drift. Every sentence here must stay true: it
 * describes what the software and the firm's staff do, never an uncommissioned integration.
 */
export type StageEvidence = 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED';
export type StageDependency = 'VERIFIED_TAX_ENGINE_REQUIRED' | 'E_SIGNATURE_INTEGRATION_REQUIRED' | 'FILING_NOT_AUTHORIZED' | 'UPSTREAM_STAGES_BLOCKED';

export interface StageCapability {
  stage: number;
  name: string;
  evidence: StageEvidence;
  /** Reviewer attestation checklist (HUMAN_ATTESTED stages), as recorded by the server. */
  checklist?: string[];
  dependency?: StageDependency;
  /** What the stage is for, in plain language. */
  purpose: string;
  /** Who is responsible when the stage is available. */
  responsibility: string;
  /** Plain-language reason the stage cannot proceed (blocked stages only). */
  blockedReason?: string;
  /** What a client can safely do now. */
  clientGuidance: string;
}

const UPSTREAM = 'This stage follows return preparation, approval, signature and filing, none of which is available in TaxGuard yet.';

export const STAGE_CAPABILITIES: readonly StageCapability[] = Object.freeze([
  { stage: 1, name: 'Onboard', evidence: 'SYSTEM_VERIFIED', purpose: 'Confirm your identity and engagement details.', responsibility: 'You complete onboarding; the system records verified details.', clientGuidance: 'Complete or review your onboarding details.' },
  { stage: 2, name: 'Collect', evidence: 'HUMAN_ATTESTED', checklist: ['documents_received_or_waived', 'documents_in_private_storage'], purpose: 'Gather the documents and answers needed for the tax year.', responsibility: 'You upload documents and answer requests; your case reviewer confirms collection.', clientGuidance: 'Upload requested documents and reply to open requests.' },
  { stage: 3, name: 'Validate', evidence: 'HUMAN_ATTESTED', checklist: ['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved'], purpose: 'Check documents for completeness and record discrepancies.', responsibility: 'Practice staff review documents; the case reviewer attests.', clientGuidance: 'Reply to any clarification requests from your advisor.' },
  { stage: 4, name: 'Record', evidence: 'SYSTEM_VERIFIED', purpose: 'Record accounting entries from validated information.', responsibility: 'Practice staff record entries under maker-checker controls.', clientGuidance: 'No action is needed unless your advisor asks a question.' },
  { stage: 5, name: 'Reconcile', evidence: 'SYSTEM_VERIFIED', purpose: 'Reconcile recorded balances to source statements.', responsibility: 'Practice staff reconcile; differences are recorded for review.', clientGuidance: 'No action is needed unless your advisor asks a question.' },
  { stage: 6, name: 'Review', evidence: 'HUMAN_ATTESTED', checklist: ['workpapers_reviewed', 'no_unresolved_blocking_exceptions'], purpose: 'Independent review of workpapers.', responsibility: 'A reviewer other than the preparer attests.', clientGuidance: 'No action is needed unless your advisor asks a question.' },
  { stage: 7, name: 'Report', evidence: 'HUMAN_ATTESTED', checklist: ['reports_reviewed_for_release'], purpose: 'Prepare reviewed reports for release.', responsibility: 'The case reviewer approves release.', clientGuidance: 'Released reports appear in your documents.' },
  { stage: 8, name: 'Plan', evidence: 'HUMAN_ATTESTED', checklist: ['planning_considerations_documented'], purpose: 'Document planning considerations for the return.', responsibility: 'Your advisor documents planning considerations; the reviewer attests.', clientGuidance: 'Discuss planning questions with your advisor through secure messages.' },
  { stage: 9, name: 'Prepare Taxes', evidence: 'BLOCKED', dependency: 'VERIFIED_TAX_ENGINE_REQUIRED', purpose: 'Prepare the federal and state returns.', responsibility: 'Practice professionals, once a verified tax engine is approved.', blockedReason: 'TaxGuard does not prepare or calculate tax returns yet. A verified tax engine with approved rules is required first.', clientGuidance: 'Your advisor will contact you about return preparation outside this portal.' },
  { stage: 10, name: 'Approve', evidence: 'BLOCKED', dependency: 'UPSTREAM_STAGES_BLOCKED', purpose: 'Professional and taxpayer approval of the prepared return.', responsibility: 'A licensed professional and the taxpayer.', blockedReason: 'There is no prepared return to approve in TaxGuard.', clientGuidance: 'No approval is requested through this portal.' },
  { stage: 11, name: 'Sign', evidence: 'BLOCKED', dependency: 'E_SIGNATURE_INTEGRATION_REQUIRED', purpose: 'Taxpayer signature authorization for electronic filing.', responsibility: 'The taxpayer, through a commissioned e-signature provider.', blockedReason: 'No e-signature provider is connected. TaxGuard does not collect signatures.', clientGuidance: 'Do not sign tax documents in response to messages claiming to come from this portal.' },
  { stage: 12, name: 'File', evidence: 'BLOCKED', dependency: 'FILING_NOT_AUTHORIZED', purpose: 'Electronic filing with tax authorities.', responsibility: 'An authorized electronic return originator.', blockedReason: 'Electronic filing is not authorized or connected. TaxGuard has not filed any return.', clientGuidance: 'Filing status is not available here.' },
  { stage: 13, name: 'Government Feedback', evidence: 'BLOCKED', dependency: 'UPSTREAM_STAGES_BLOCKED', purpose: 'Track acceptance or rejection from tax authorities.', responsibility: 'Practice staff.', blockedReason: UPSTREAM, clientGuidance: 'No acknowledgements are tracked here.' },
  { stage: 14, name: 'Resolve', evidence: 'BLOCKED', dependency: 'UPSTREAM_STAGES_BLOCKED', purpose: 'Respond to notices and correspondence from tax authorities.', responsibility: 'Practice professionals.', blockedReason: UPSTREAM, clientGuidance: 'If you receive a notice, tell your advisor through secure messages.' },
  { stage: 15, name: 'Monitor', evidence: 'BLOCKED', dependency: 'UPSTREAM_STAGES_BLOCKED', purpose: 'Post-filing monitoring and deadlines.', responsibility: 'Practice staff.', blockedReason: UPSTREAM, clientGuidance: 'Monitoring and reminders are not provided by this portal.' },
  { stage: 16, name: 'Archive', evidence: 'BLOCKED', dependency: 'UPSTREAM_STAGES_BLOCKED', purpose: 'Retain the final return package and evidence.', responsibility: 'Practice staff.', blockedReason: 'There is no filed return package to archive. Your uploaded documents remain available under Documents.', clientGuidance: 'Your uploaded documents are listed under Documents.' },
  { stage: 17, name: 'Renew', evidence: 'BLOCKED', dependency: 'UPSTREAM_STAGES_BLOCKED', purpose: 'Start the next tax-year engagement.', responsibility: 'Your advisor, through a new engagement.', blockedReason: 'Renewal requires a new engagement recorded by the practice.', clientGuidance: 'Ask your advisor about next year\'s engagement through secure messages.' },
  { stage: 18, name: 'Repeat', evidence: 'BLOCKED', dependency: 'UPSTREAM_STAGES_BLOCKED', purpose: 'Carry forward information to the next cycle.', responsibility: 'Practice staff.', blockedReason: UPSTREAM, clientGuidance: 'Prior-year information is not carried forward automatically.' },
] as StageCapability[]);

export const stageCapability = (stage: number): StageCapability | undefined => STAGE_CAPABILITIES.find(s => s.stage === stage);
/** Stages the client portal must always present as unavailable. */
export const BLOCKED_STAGES = STAGE_CAPABILITIES.filter(s => s.evidence === 'BLOCKED').map(s => s.stage);
