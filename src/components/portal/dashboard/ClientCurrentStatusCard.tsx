/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Prominent "YOUR CURRENT STATUS" Card
 *
 * Implements:
 * - Master Dashboard Architecture Current Status Card
 * - Plain-language explanation, client action required, staff action in progress, blocking issue, what happens next
 * - Preserves Critical Stage 02 Invariant:
 *   When missingCount = 0 but review remains:
 *   "ALL REQUESTED DOCUMENTS RECEIVED"
 *   "A/R TAX SERVICES IS REVIEWING YOUR DOCUMENTS"
 *   "NO ACTION NEEDED FROM YOU RIGHT NOW"
 */

import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  UploadCloud,
  FileCheck,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';

export interface ClientCurrentStatusCardProps {
  simplifiedStepNumber: number;
  simplifiedStepLabel: string;
  authoritativeStageNumber: number;
  authoritativeStageName: string;
  missingCount: number;
  totalRequirements: number;
  receivedCount: number;
  pendingRequestsCount: number;
  unreadMessagesCount: number;
  hasRejectedDocument?: boolean;
  rejectedDocumentName?: string;
  taxYear: number;
  onPrimaryAction: () => void;
  onOpenQuestionnaire?: () => void;
  onViewChecklist?: () => void;
  onNavigateToRequests?: () => void;
}

export const ClientCurrentStatusCard: React.FC<ClientCurrentStatusCardProps> = ({
  simplifiedStepNumber,
  simplifiedStepLabel,
  authoritativeStageNumber,
  authoritativeStageName,
  missingCount,
  totalRequirements,
  receivedCount,
  pendingRequestsCount,
  unreadMessagesCount,
  hasRejectedDocument = false,
  rejectedDocumentName,
  taxYear,
  onPrimaryAction,
  onOpenQuestionnaire,
  onViewChecklist,
  onNavigateToRequests
}) => {
  // Determine dynamic status state based on authoritative stage & counts
  let badgeText = 'IN PROGRESS';
  let badgeColor = 'bg-blue-950 text-blue-300 border-blue-500/40';
  let heading = 'DOCUMENTS NEEDED';
  let plainExplanation = `Please upload the ${missingCount} remaining document${missingCount > 1 ? 's' : ''}.`;
  let clientAction = `Upload the ${missingCount} required document${missingCount > 1 ? 's' : ''} to complete your intake file.`;
  let staffAction = 'A/R Tax Services intake team is monitoring document receipts.';
  let blockingIssue: string | null = null;
  let whatHappensNext = 'Once all requested documents are received, our CPA team performs technical review.';
  let primaryButtonText = 'Upload Missing Documents';
  let showPrimaryButton = true;
  let isNoActionNeeded = false;

  if (hasRejectedDocument) {
    badgeText = 'REPLACEMENT REQUIRED';
    badgeColor = 'bg-amber-950 text-amber-300 border-amber-500/40';
    heading = 'REPLACEMENT REQUIRED';
    plainExplanation = `Your ${rejectedDocumentName || 'document'} could not be accepted. Please upload a clear replacement.`;
    clientAction = 'Upload a replacement document with clear legibility and all pages included.';
    staffAction = 'Preparer awaiting replacement artifact to complete tax schedule tie-out.';
    blockingIssue = `Unreadable or incomplete submission: ${rejectedDocumentName || 'Document'}`;
    whatHappensNext = 'Our staff will re-inspect the replacement and continue your preparation.';
    primaryButtonText = 'Replace Rejected Document';
  } else if (pendingRequestsCount > 0) {
    badgeText = 'ACTION REQUIRED';
    badgeColor = 'bg-amber-950 text-amber-300 border-amber-500/40';
    heading = 'CLARIFICATION REQUEST OPEN';
    plainExplanation = `Your tax professional has issued ${pendingRequestsCount} clarification request${pendingRequestsCount > 1 ? 's' : ''}.`;
    clientAction = 'Respond to open CPA inquiries to avoid filing delays.';
    staffAction = 'Elena Rostova, CPA is waiting for your response before finalizing tax position.';
    blockingIssue = `${pendingRequestsCount} pending advisor inquiry requiring your response.`;
    whatHappensNext = 'Your response will be recorded directly into your case file.';
    primaryButtonText = 'Answer Request';
  } else if (authoritativeStageNumber === 1) {
    badgeText = 'GETTING STARTED';
    badgeColor = 'bg-[#0D2745] text-[#D4A843] border-[#D4A843]/40';
    heading = 'GETTING STARTED';
    plainExplanation = 'Please complete your onboarding identity and statutory consents.';
    clientAction = 'Confirm your personal details and sign IRC § 7216 consent.';
    staffAction = 'Compliance lead waiting for onboarding completion to provision tax workspace.';
    whatHappensNext = 'Upon completion, Stage 02 Document Collection will be unlocked immediately.';
    primaryButtonText = 'Complete Questionnaire';
  } else if (authoritativeStageNumber === 2 || authoritativeStageNumber === 3) {
    if (missingCount === 0 && totalRequirements > 0) {
      // CRITICAL STAGE 02 INVARIANT: missingCount = 0 but review remains
      badgeText = 'ALL DOCUMENTS RECEIVED';
      badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-500/40';
      heading = 'ALL REQUESTED DOCUMENTS RECEIVED';
      plainExplanation = 'A/R Tax Services is reviewing your documents.';
      clientAction = 'No action needed from you right now.';
      isNoActionNeeded = true;
      staffAction = 'Elena Rostova, CPA is reviewing extractions and verifying document requirements.';
      whatHappensNext = 'We will complete verification and proceed to formal tax preparation.';
      primaryButtonText = 'View Document Checklist';
      showPrimaryButton = true;
    } else if (missingCount > 0) {
      badgeText = 'DOCUMENTS NEEDED';
      badgeColor = 'bg-blue-950 text-blue-300 border-blue-500/40';
      heading = 'DOCUMENTS NEEDED';
      plainExplanation = `Please upload the ${missingCount} remaining document${missingCount > 1 ? 's' : ''}.`;
      clientAction = `Upload the ${missingCount} required document${missingCount > 1 ? 's' : ''} to complete your intake file.`;
      staffAction = 'Intake automation is waiting for your required document submissions.';
      whatHappensNext = 'All submitted documents are scanned, hashed with SHA-256, and sent to CPA review.';
      primaryButtonText = 'Upload Missing Documents';
    } else {
      // Total requirements 0 or new client
      badgeText = 'INTAKE READY';
      badgeColor = 'bg-[#0D2745] text-[#D4A843] border-[#D4A843]/40';
      heading = 'COMPLETE TAX QUESTIONNAIRE';
      plainExplanation = 'Answer our brief guided questions so we can generate your personalized document checklist.';
      clientAction = 'Answer questions regarding your employment, real estate, and investments.';
      staffAction = 'Awaiting questionnaire responses to generate statutory checklist.';
      whatHappensNext = 'A tailored checklist will appear based strictly on your individual facts.';
      primaryButtonText = 'Complete Questionnaire';
    }
  } else if (authoritativeStageNumber >= 4 && authoritativeStageNumber <= 8) {
    badgeText = 'TAX PREPARATION';
    badgeColor = 'bg-blue-950 text-blue-300 border-blue-500/40';
    heading = 'TAX PREPARATION IN PROGRESS';
    plainExplanation = 'Your tax professional is preparing your return.';
    clientAction = 'No action needed from you right now.';
    isNoActionNeeded = true;
    staffAction = 'Elena Rostova, CPA is reconciling source documents and compiling federal/state workpapers.';
    whatHappensNext = 'You will be notified once your draft Form 1040 is compiled for client review.';
    primaryButtonText = 'View Workpapers Status';
  } else if (authoritativeStageNumber === 9) {
    badgeText = 'FORM 1040 PREP';
    badgeColor = 'bg-blue-950 text-blue-300 border-blue-500/40';
    heading = 'TAX PREPARATION';
    plainExplanation = 'Your tax professional is preparing your return.';
    clientAction = 'No action needed from you right now.';
    isNoActionNeeded = true;
    staffAction = 'Elena Rostova, CPA is finalizing federal and state tax calculations.';
    whatHappensNext = 'Your completed draft will be routed to your portal for review and approval.';
    primaryButtonText = 'Check Return Status';
  } else if (authoritativeStageNumber === 10) {
    badgeText = 'APPROVAL REQUIRED';
    badgeColor = 'bg-amber-950 text-amber-300 border-amber-500/40';
    heading = 'APPROVAL REQUIRED';
    plainExplanation = 'Your return is ready for your review.';
    clientAction = 'Review your completed draft return and submit client approval.';
    staffAction = 'Preparer awaiting your formal approval before generating Form 8879 e-file package.';
    whatHappensNext = 'Upon approval, e-signature documents will be generated.';
    primaryButtonText = 'Review & Approve Return';
  } else if (authoritativeStageNumber === 11) {
    badgeText = 'SIGNATURE REQUIRED';
    badgeColor = 'bg-amber-950 text-amber-300 border-amber-500/40';
    heading = 'SIGNATURE REQUIRED';
    plainExplanation = 'Please review and sign the required authorization.';
    clientAction = 'Sign IRS Form 8879 and state e-file authorizations.';
    staffAction = 'Filing gateway awaiting signed Form 8879 before electronic submission.';
    whatHappensNext = 'Once signed, your return is submitted to the IRS and state taxing agencies.';
    primaryButtonText = 'Sign Required Forms';
  } else if (authoritativeStageNumber >= 12 && authoritativeStageNumber <= 14) {
    badgeText = 'FILING';
    badgeColor = 'bg-purple-950 text-purple-300 border-purple-500/40';
    heading = 'FILING IN PROGRESS';
    plainExplanation = 'Your return is being processed for filing.';
    clientAction = 'No action needed from you right now.';
    isNoActionNeeded = true;
    staffAction = 'Monitoring IRS Electronic Filing System transmitter queue and state acknowledgments.';
    whatHappensNext = 'Official agency transmission acceptance notices will be recorded into your vault.';
    primaryButtonText = 'View Filing Status';
  } else {
    // 15+ Completed
    badgeText = 'COMPLETED';
    badgeColor = 'bg-emerald-950 text-emerald-300 border-emerald-500/40';
    heading = 'COMPLETED';
    plainExplanation = 'Your return has completed the filing workflow.';
    clientAction = 'No action needed from you right now.';
    isNoActionNeeded = true;
    staffAction = 'Return permanently sealed in multi-year immutable archive.';
    whatHappensNext = 'You may download your complete tax package and receipts anytime from My Records.';
    primaryButtonText = 'Download Completed Return';
  }

  return (
    <section
      aria-label="Your Current Status"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl relative overflow-hidden"
    >
      {/* Top Banner with Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
            YOUR CURRENT STATUS
          </span>
          <span className="text-slate-500">&bull;</span>
          <span className="text-xs font-mono text-slate-300">
            Step {simplifiedStepNumber} of 7: <strong className="text-white">{simplifiedStepLabel}</strong>
          </span>
          <span className="text-slate-500">&bull;</span>
          <span className="text-xs font-mono text-slate-400">
            Authoritative: <strong className="text-slate-200">Stage {String(authoritativeStageNumber).padStart(2, '0')} ({authoritativeStageName})</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1.5 ${badgeColor}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span>{badgeText}</span>
          </span>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="pt-4 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Plain-Language Summary & Detailed Answers */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>{heading}</span>
            </h2>
            <p className="text-sm text-slate-200 mt-1 font-medium leading-relaxed">
              {plainExplanation}
            </p>
          </div>

          {/* Grid answering key status questions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
            {/* Client Action Required */}
            <div className={`p-3.5 rounded-xl border ${
              isNoActionNeeded
                ? 'bg-[#071A2E] border-slate-800'
                : 'bg-[#102D4F] border-[#D4A843]/40 ring-1 ring-[#D4A843]/20'
            }`}>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#D4A843] font-bold flex items-center gap-1.5">
                {isNoActionNeeded ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-[#D4A843]" />
                )}
                <span>What you need to do</span>
              </div>
              <p className={`mt-1.5 font-semibold ${isNoActionNeeded ? 'text-emerald-300' : 'text-white'}`}>
                {clientAction}
              </p>
            </div>

            {/* Staff Action In Progress */}
            <div className="p-3.5 rounded-xl bg-[#071A2E] border border-slate-800">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4A843]" />
                <span>What A/R Tax Services is doing</span>
              </div>
              <p className="mt-1.5 text-slate-300">
                {staffAction}
              </p>
            </div>

            {/* What Happens Next */}
            <div className="p-3.5 rounded-xl bg-[#071A2E] border border-slate-800 sm:col-span-2 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#D4A843] shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                  What happens next
                </span>
                <p className="text-slate-300 mt-0.5 leading-relaxed">
                  {whatHappensNext}
                </p>
              </div>
            </div>

            {/* Blocking issue if present */}
            {blockingIssue && (
              <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/40 text-red-200 sm:col-span-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-mono uppercase font-bold text-red-400 block">
                    Attention Required
                  </span>
                  <p className="text-xs mt-0.5">{blockingIssue}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Primary Action Button Card */}
        <div className="bg-[#071A2E] border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-inner">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Primary Next Action
            </div>
            <div className="mt-2 text-sm font-bold text-white">
              {isNoActionNeeded ? 'No Action Required' : primaryButtonText}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {isNoActionNeeded
                ? 'Your file is up to date. You can review your documents or check return progress.'
                : 'Click below to complete the primary action required for your return.'}
            </p>
          </div>

          <div className="space-y-2 pt-2">
            {showPrimaryButton && (
              <button
                type="button"
                onClick={onPrimaryAction}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                  isNoActionNeeded
                    ? 'bg-[#143657] hover:bg-[#102D4F] text-[#F8FAFC] border border-[rgba(148,163,184,0.18)]'
                    : 'bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] shadow-lg'
                }`}
              >
                <span>{primaryButtonText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {onViewChecklist && !isNoActionNeeded && (
              <button
                type="button"
                onClick={onViewChecklist}
                className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-[#0D2745] transition-colors cursor-pointer text-center"
              >
                View Document Checklist &rarr;
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
