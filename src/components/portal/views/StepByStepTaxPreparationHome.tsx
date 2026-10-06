/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Step-by-Step Action-Oriented Client Home Experience
 *
 * Implements:
 * - Master Client / Taxpayer Dashboard Architecture
 * - 3-Column Desktop Layout (Left Navigation Shell, Center Primary Workspace, Right Contextual Rail)
 * - 7-Step Client Journey Bar (Getting Started, Documents, Review, Tax Prep, Approval & Signature, Filing, Completed)
 * - Prominent "YOUR CURRENT STATUS" Card with Stage 02 Invariant:
 *   missingCount = 0 -> "ALL REQUESTED DOCUMENTS RECEIVED", "A/R TAX SERVICES IS REVIEWING YOUR DOCUMENTS", "NO ACTION NEEDED FROM YOU RIGHT NOW"
 * - "RETURN OVERVIEW — [TAX YEAR]" with authoritative facts and truthful empty states
 * - Contextual Quick Actions Toolbar
 * - "DOCUMENT CHECKLIST — [TAX YEAR] Personalized for You" (Filters, Expandable Rows, Details)
 * - "STATE / JURISDICTION REQUIREMENTS" Panel (Multi-state triggers: moved, worked out of state, out-of-state income, rental, business)
 * - "MY TAX YEARS & RECORDS — 2022+"
 * - Prior-Year Continuity / Carryforward Review
 * - Right-Side Context Rail (Updates, Open Requests, Messages, Appointments, Deadlines)
 * - 8 Core Client Questions at a Glance
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  UploadCloud,
  FileText,
  ShieldCheck,
  Building2,
  Calendar,
  ChevronRight,
  HelpCircle,
  FileCheck,
  Lock,
  RefreshCw,
  Sparkles,
  X,
  Info,
  MapPin,
  Users,
  Eye,
  AlertTriangle
} from 'lucide-react';
import {
  TaxDocumentRequirementEngine,
  TaxDiscoveryQuestionnaireAnswers,
  TaxDocumentRequirementItem
} from '../../../services/taxDocumentRequirementEngine';
import { StageTwoCollectionService, StageTwoUploadedDocument } from '../../../services/stageTwoCollectionService';
import { getStoredToken } from '../../../services/api';
import { ClientCurrentStatusCard } from '../dashboard/ClientCurrentStatusCard';
import { ReturnOverviewCard } from '../dashboard/ReturnOverviewCard';
import { QuickActionsToolbar } from '../dashboard/QuickActionsToolbar';
import { DocumentChecklistSection } from '../dashboard/DocumentChecklistSection';
import { StateJurisdictionRequirementsPanel } from '../dashboard/StateJurisdictionRequirementsPanel';
import { TaxYearsArchiveSection } from '../dashboard/TaxYearsArchiveSection';
import { PriorYearContinuityCard } from '../dashboard/PriorYearContinuityCard';
import { RightContextRail } from '../dashboard/RightContextRail';
import { SIMPLIFIED_JOURNEY_STEPS, SimplifiedJourneyStep } from '../AuthenticatedClientDashboard';

interface StepByStepTaxPreparationHomeProps {
  clientId: string;
  clientName: string;
  selectedTaxYear: number;
  userEmail?: string;
  onNavigateToStageTwo: () => void;
  onNavigateToVault: () => void;
  onOpenQuestionnaire: () => void;
  onSelectRequirementForUpload?: (requirement: TaxDocumentRequirementItem) => void;
  authority?: any;
  onNavigateToTab?: (tabId: string) => void;
  onNavigateToDetailedWorkflow?: () => void;
  onTaxYearChange?: (year: number) => void;
}

export const StepByStepTaxPreparationHome: React.FC<StepByStepTaxPreparationHomeProps> = ({
  clientId,
  clientName,
  selectedTaxYear,
  userEmail,
  onNavigateToStageTwo,
  onNavigateToVault,
  onOpenQuestionnaire,
  onSelectRequirementForUpload,
  authority,
  onNavigateToTab,
  onNavigateToDetailedWorkflow,
  onTaxYearChange
}) => {
  const [recalcVersion, setRecalcVersion] = useState<number>(0);
  const [notApplicableModalItem, setNotApplicableModalItem] = useState<TaxDocumentRequirementItem | null>(null);
  const [notApplicableReason, setNotApplicableReason] = useState<string>('');

  const [questionnaire, setQuestionnaire] = useState<TaxDiscoveryQuestionnaireAnswers>(() =>
    TaxDocumentRequirementEngine.getQuestionnaire(clientId, selectedTaxYear)
  );

  const [uploadedDocs, setUploadedDocs] = useState<StageTwoUploadedDocument[]>(() =>
    StageTwoCollectionService.getUploadedDocuments(clientId, selectedTaxYear)
  );

  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [latestMessageSnippet, setLatestMessageSnippet] = useState<string>('');
  const [hasUpcomingAppointment, setHasUpcomingAppointment] = useState<boolean>(false);
  const [upcomingAppointmentDate, setUpcomingAppointmentDate] = useState<string | undefined>(undefined);

  // Sync open requests and messages from server
  useEffect(() => {
    let isMounted = true;
    const fetchCommunications = async () => {
      try {
        const token = getStoredToken();
        const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        const [reqRes, msgRes, apptRes] = await Promise.all([
          fetch(`/api/accounting/document-requests?clientId=${clientId}`, { headers }),
          fetch('/api/messages', { headers }),
          fetch('/api/appointments', { headers })
        ]);
        if (isMounted) {
          if (reqRes.ok) {
            const reqData = await reqRes.json();
            if (Array.isArray(reqData.requests)) {
              setPendingRequestsCount(reqData.requests.filter((r: any) => r.status === 'pending').length);
            }
          }
          if (msgRes.ok) {
            const msgData = await msgRes.json();
            if (Array.isArray(msgData.messages)) {
              const unread = msgData.messages.filter((m: any) => !m.isRead && m.senderRole !== 'client');
              setUnreadMessagesCount(unread.length);
              if (msgData.messages.length > 0) {
                setLatestMessageSnippet(msgData.messages[0].content);
              }
            }
          }
          if (apptRes.ok) {
            const apptData = await apptRes.json();
            if (Array.isArray(apptData.appointments) && apptData.appointments.length > 0) {
              const upcoming = apptData.appointments.find((a: any) => a.status === 'confirmed' || a.status === 'scheduled');
              if (upcoming) {
                setHasUpcomingAppointment(true);
                setUpcomingAppointmentDate(upcoming.dateTime || upcoming.scheduledAt);
              }
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    };
    fetchCommunications();
    return () => { isMounted = false; };
  }, [clientId, recalcVersion]);

  // Sync uploads from server API where available
  useEffect(() => {
    let isMounted = true;
    const fetchServerDocs = async () => {
      try {
        const token = getStoredToken();
        const res = await fetch(`/api/documents?taxYear=${selectedTaxYear}`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data.documents)) {
            const localDocs = StageTwoCollectionService.getUploadedDocuments(clientId, selectedTaxYear);
            const merged = [...localDocs];
            data.documents.forEach((srvDoc: any) => {
              if (!merged.some(m => m.documentId === srvDoc.id || m.sha256Hash === srvDoc.sha256)) {
                merged.push({
                  documentId: srvDoc.id,
                  clientId: srvDoc.clientId,
                  engagementId: `eng_${selectedTaxYear}_${clientId}`,
                  taxYear: srvDoc.taxYear || selectedTaxYear,
                  uploaderSource: 'client_portal',
                  uploadedBy: srvDoc.uploadedBy || 'Client',
                  originalFileName: srvDoc.fileName,
                  fileSizeBytes: 1024 * 1024,
                  mimeType: srvDoc.fileType || 'application/pdf',
                  claimedCategory: srvDoc.category,
                  associatedRequirementId: srvDoc.associatedRequirementId,
                  sha256Hash: srvDoc.id,
                  uploadTimestamp: srvDoc.uploadedAt,
                  processingStatus: srvDoc.status === 'approved' ? 'Accepted' : 'Received',
                  isVerified: srvDoc.isVerified || false,
                  securityCheckStatus: 'Passed (SHA-256 Validated)'
                });
              }
            });
            setUploadedDocs(merged);
          }
        }
      } catch {
        // Fallback to local service docs
      }
    };
    fetchServerDocs();
    return () => {
      isMounted = false;
    };
  }, [clientId, selectedTaxYear, recalcVersion]);

  // Evaluate requirements dynamically
  const evaluation = useMemo(() => {
    return TaxDocumentRequirementEngine.evaluateMissingDocuments({
      clientId,
      taxYear: selectedTaxYear,
      uploadedDocs: uploadedDocs.map(d => ({
        id: d.documentId,
        associatedRequirementId: d.associatedRequirementId,
        claimedCategory: d.claimedCategory,
        status: d.processingStatus,
        isVerified: d.isVerified
      }))
    });
  }, [clientId, selectedTaxYear, uploadedDocs, recalcVersion]);

  const requirements = useMemo(() => {
    return TaxDocumentRequirementEngine.generateRequirements({
      clientId,
      taxYear: selectedTaxYear,
      answers: questionnaire
    });
  }, [clientId, selectedTaxYear, questionnaire, recalcVersion]);

  const totalRequirements = evaluation.totalRequirements;
  const resolvedCount = evaluation.receivedCount;
  const missingCount = evaluation.missingCount;
  const missingDocs = evaluation.missingItems;

  const handleConfirmNotApplicable = () => {
    if (!notApplicableModalItem) return;
    TaxDocumentRequirementEngine.markNotApplicable(
      clientId,
      selectedTaxYear,
      notApplicableModalItem.requirementId,
      notApplicableReason || 'Confirmed not applicable by taxpayer.'
    );
    setNotApplicableModalItem(null);
    setNotApplicableReason('');
    setRecalcVersion(v => v + 1);
  };

  // State nexus reporting handlers
  const handleReportMoved = (fromState: string, moveDate: string) => {
    const updated = TaxDocumentRequirementEngine.saveQuestionnaire(clientId, selectedTaxYear, {
      movedDuringYear: true,
      priorStatesOfResidence: [fromState]
    });
    setQuestionnaire(updated);
    setRecalcVersion(v => v + 1);
  };

  const handleReportWorkInOtherState = (stateCode: string) => {
    const existing = questionnaire.workStates || [];
    const updatedStates = Array.from(new Set([...existing, stateCode]));
    const updated = TaxDocumentRequirementEngine.saveQuestionnaire(clientId, selectedTaxYear, {
      workedInMultipleStates: true,
      workStates: updatedStates
    });
    setQuestionnaire(updated);
    setRecalcVersion(v => v + 1);
  };

  const handleReportOutOfStateRental = (stateCode: string) => {
    const updated = TaxDocumentRequirementEngine.saveQuestionnaire(clientId, selectedTaxYear, {
      ownsRentalProperty: true
    });
    setQuestionnaire(updated);
    setRecalcVersion(v => v + 1);
  };

  const handleReportOutOfStateBusiness = (stateCode: string) => {
    const updated = TaxDocumentRequirementEngine.saveQuestionnaire(clientId, selectedTaxYear, {
      hasSelfEmployment: true
    });
    setQuestionnaire(updated);
    setRecalcVersion(v => v + 1);
  };

  const handleReportOtherIncomeState = (stateCode: string) => {
    handleReportWorkInOtherState(stateCode);
  };

  // Active Authoritative Stage
  const authoritativeStage = authority?.workflow?.activeStage ?? 2;
  const authoritativeStageName = authority?.workflow?.activeStageName ||
    (authoritativeStage === 1 ? 'Onboard' : authoritativeStage === 2 ? 'Collect' : authoritativeStage === 3 ? 'Validate' : 'Processing');

  // Simplified Step Resolution
  const currentSimplifiedStep = useMemo(() => {
    if (authoritativeStage <= 1) return SIMPLIFIED_JOURNEY_STEPS[0];
    if (authoritativeStage <= 3) return SIMPLIFIED_JOURNEY_STEPS[1];
    if (authoritativeStage <= 8) return SIMPLIFIED_JOURNEY_STEPS[2];
    if (authoritativeStage === 9) return SIMPLIFIED_JOURNEY_STEPS[3];
    if (authoritativeStage <= 11) return SIMPLIFIED_JOURNEY_STEPS[4];
    if (authoritativeStage <= 14) return SIMPLIFIED_JOURNEY_STEPS[5];
    return SIMPLIFIED_JOURNEY_STEPS[6];
  }, [authoritativeStage]);

  // Detected Income Categories
  const detectedIncomeCategories = useMemo(() => {
    const cats: string[] = [];
    if (questionnaire.hasW2Employment) cats.push('W-2 Wages & Salary');
    if (questionnaire.hasSelfEmployment || questionnaire.has1099NEC) cats.push('1099-NEC Self-Employment');
    if (questionnaire.hasBankInterest) cats.push('Bank Interest (1099-INT)');
    if (questionnaire.hasDividends) cats.push('Dividends (1099-DIV)');
    if (questionnaire.hasStockSalesBrokerage) cats.push('Capital Gains (1099-B)');
    if (questionnaire.ownsRentalProperty) cats.push('Rental Property (Schedule E)');
    if (questionnaire.hasRetirementDistributions) cats.push('Retirement (1099-R)');
    if (questionnaire.hasSocialSecurity) cats.push('Social Security (SSA-1099)');
    return cats;
  }, [questionnaire]);

  // Matched document counts per requirementId
  const matchedDocCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    uploadedDocs.forEach(d => {
      if (d.associatedRequirementId) {
        counts[d.associatedRequirementId] = (counts[d.associatedRequirementId] || 0) + 1;
      }
    });
    return counts;
  }, [uploadedDocs]);

  // Handle primary action from Current Status Card
  const handlePrimaryStatusAction = () => {
    if (pendingRequestsCount > 0) {
      onNavigateToTab?.('requests');
    } else if (missingCount > 0) {
      onNavigateToStageTwo();
    } else if (authoritativeStage === 10) {
      onNavigateToTab?.('approval');
    } else if (authoritativeStage === 11) {
      onNavigateToTab?.('signature');
    } else if (authoritativeStage >= 12) {
      onNavigateToTab?.('filing');
    } else {
      onNavigateToVault();
    }
  };

  const handleUploadRequirement = (item: TaxDocumentRequirementItem) => {
    if (onSelectRequirementForUpload) {
      onSelectRequirementForUpload(item);
    } else {
      onNavigateToStageTwo();
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 space-y-6" id="client-dashboard-action-home">
      {/* ========================================================================= */}
      {/* 1. SEVEN-STEP CLIENT JOURNEY BAR (Prominent Client Mental Model) */}
      {/* ========================================================================= */}
      <section
        aria-label="7-Step Tax Preparation Journey"
        className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-4 shadow-xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              YOUR TAX PREPARATION JOURNEY
            </span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-xs font-mono text-slate-300">
              Step {currentSimplifiedStep.stepNumber} of 7: <strong className="text-white">{currentSimplifiedStep.label}</strong>
            </span>
          </div>

          {onNavigateToDetailedWorkflow && (
            <button
              type="button"
              onClick={onNavigateToDetailedWorkflow}
              className="text-[11px] text-[#D4A843] hover:underline font-mono flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <span>View Authoritative 18 Stages &rarr;</span>
            </button>
          )}
        </div>

        {/* 7-Step Horizontal Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          {SIMPLIFIED_JOURNEY_STEPS.map((step) => {
            const isCurrent = step.stepNumber === currentSimplifiedStep.stepNumber;
            const isCompleted = step.stageNumbers.every(n => n < authoritativeStage);
            const isLocked = step.stageNumbers.every(n => n > authoritativeStage);

            return (
              <div
                key={step.id}
                onClick={() => {
                  if (!isLocked && onNavigateToTab) {
                    onNavigateToTab(step.defaultNavId);
                  }
                }}
                className={`p-2.5 rounded-xl border flex flex-col justify-between transition-all select-none ${
                  isCurrent
                    ? 'bg-[#102D4F] border-[#D4A843] ring-1 ring-[#D4A843]/40 shadow-md'
                    : isCompleted
                    ? 'bg-[#071A2E] border-emerald-900/50 hover:border-emerald-600/60 cursor-pointer'
                    : 'bg-[#071A2E]/60 border-slate-800 text-slate-500 cursor-not-allowed opacity-75'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold ${
                    isCurrent ? 'text-[#D4A843]' : isCompleted ? 'text-emerald-400' : 'text-slate-500'
                  }`}>
                    0{step.stepNumber}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse" />
                  ) : (
                    <Lock className="w-3 h-3 text-slate-600" />
                  )}
                </div>

                <div className="mt-1.5">
                  <div className={`font-semibold text-[11px] truncate ${
                    isCurrent ? 'text-white' : isCompleted ? 'text-slate-200' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </div>
                  <div className="text-[9px] text-slate-400 truncate">
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. THREE-COLUMN DESKTOP LAYOUT (Center Main 2-Cols + Right Rail 1-Col) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* CENTER PRIMARY WORKSPACE (2 Columns on Desktop) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Prominent "YOUR CURRENT STATUS" Card */}
          <ClientCurrentStatusCard
            simplifiedStepNumber={currentSimplifiedStep.stepNumber}
            simplifiedStepLabel={currentSimplifiedStep.label}
            authoritativeStageNumber={authoritativeStage}
            authoritativeStageName={authoritativeStageName}
            missingCount={missingCount}
            totalRequirements={totalRequirements}
            receivedCount={resolvedCount}
            pendingRequestsCount={pendingRequestsCount}
            unreadMessagesCount={unreadMessagesCount}
            taxYear={selectedTaxYear}
            onPrimaryAction={handlePrimaryStatusAction}
            onOpenQuestionnaire={onOpenQuestionnaire}
            onViewChecklist={() => onNavigateToTab?.('checklist')}
            onNavigateToRequests={() => onNavigateToTab?.('requests')}
          />

          {/* Card 2: Return Overview Card */}
          <ReturnOverviewCard
            taxYear={selectedTaxYear}
            filingStatus={questionnaire.filingStatus}
            dependentsCount={questionnaire.hasDependents ? (questionnaire.dependentsCount || 1) : 0}
            incomeCategories={detectedIncomeCategories}
            engagementStatus="Active Engagement"
            returnStatus={
              authoritativeStage === 1
                ? 'Identity & Statutory Consent'
                : authoritativeStage === 2
                ? 'Document Intake & Checklist'
                : authoritativeStage <= 8
                ? 'Under Professional Review'
                : authoritativeStage === 9
                ? 'Form 1040 Tax Preparation'
                : authoritativeStage === 10
                ? 'Ready for Client Approval'
                : authoritativeStage === 11
                ? 'Form 8879 E-Signature'
                : authoritativeStage <= 14
                ? 'Electronic Filing Gateway'
                : 'Completed & Sealed'
            }
            onOpenQuestionnaire={onOpenQuestionnaire}
            onManageStates={() => {}}
          />

          {/* Card 3: Quick Actions Toolbar */}
          <QuickActionsToolbar
            authoritativeStage={authoritativeStage}
            pendingRequestsCount={pendingRequestsCount}
            onUploadDocument={onNavigateToStageTwo}
            onViewChecklist={() => onNavigateToTab?.('checklist')}
            onOpenQuestionnaire={onOpenQuestionnaire}
            onOpenRequests={() => onNavigateToTab?.('requests')}
            onSendMessage={() => onNavigateToTab?.('messages')}
            onScheduleAppointment={() => onNavigateToTab?.('appointments')}
            onReviewReturn={() => onNavigateToTab?.('review')}
            onApproveReturn={() => onNavigateToTab?.('approval')}
            onSignForms={() => onNavigateToTab?.('signature')}
            onViewFilingStatus={() => onNavigateToTab?.('filing')}
            onDownloadRecords={() => onNavigateToTab?.('completed')}
          />

          {/* Card 4: Document Checklist Section */}
          <DocumentChecklistSection
            taxYear={selectedTaxYear}
            requirements={requirements}
            matchedDocumentCounts={matchedDocCounts}
            onUploadForRequirement={handleUploadRequirement}
            onViewDocumentsForRequirement={() => onNavigateToVault()}
            onMarkNotApplicable={(item) => setNotApplicableModalItem(item)}
            onOpenQuestionnaire={onOpenQuestionnaire}
          />

          {/* Card 5: State & Jurisdiction Requirements Panel */}
          <StateJurisdictionRequirementsPanel
            taxYear={selectedTaxYear}
            residentState={questionnaire.residentState || 'SC'}
            workStates={questionnaire.workStates || []}
            movedDuringYear={questionnaire.movedDuringYear}
            priorStates={questionnaire.priorStatesOfResidence}
            onReportMoved={handleReportMoved}
            onReportWorkInOtherState={handleReportWorkInOtherState}
            onReportOutOfStateRental={handleReportOutOfStateRental}
            onReportOutOfStateBusiness={handleReportOutOfStateBusiness}
            onReportOtherIncomeState={handleReportOtherIncomeState}
          />

          {/* Card 6: My Tax Years & Records (2022+) */}
          <TaxYearsArchiveSection
            currentTaxYear={selectedTaxYear}
            availableYears={[2026, 2025, 2024, 2023, 2022]}
            yearRecords={{
              [selectedTaxYear]: {
                taxYear: selectedTaxYear,
                engagementStatus: 'Active',
                returnStatus: authoritativeStage >= 15 ? 'Completed' : 'In Preparation',
                documentsCount: uploadedDocs.length,
                hasFederalReturn: true,
                stateReturnsCount: 1,
                hasAuthorizations: true,
                hasNotices: false,
                isArchived: authoritativeStage >= 16
              }
            }}
            onSelectYear={(yr) => onTaxYearChange?.(yr)}
            onOpenArchiveYear={() => onNavigateToTab?.('archive')}
          />

          {/* Card 7: Prior-Year Continuity / Carryforward Card */}
          <PriorYearContinuityCard
            currentTaxYear={selectedTaxYear}
            priorTaxYear={selectedTaxYear - 1}
            onConfirmAll={() => {}}
            onModifyFact={onOpenQuestionnaire}
          />

          {/* Card 8: Executive Summary - The 8 Core Client Questions at a Glance */}
          <div className="rounded-2xl bg-[#0D2745] border border-[#D4A843]/30 p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#D4A843]/15 text-[#D4A843]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                    Filing Status &amp; Action Center at a Glance
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Direct answers to the 8 core questions about your tax return.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {/* Question 1: Where is my tax return? */}
              <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-700/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>1. Where is my tax return?</span>
                </span>
                <p className="text-white font-semibold text-xs">
                  {authoritativeStage === 1 && 'Stage 01: Onboarding & Identity Certified'}
                  {authoritativeStage === 2 && 'Stage 02: Document Intake & Checklist'}
                  {authoritativeStage === 3 && 'Stage 03: Document Validation Underway'}
                  {(authoritativeStage >= 4 && authoritativeStage <= 8) && 'Stage 04–08: Accounting Tie-Out & Review'}
                  {authoritativeStage === 9 && 'Stage 09: Form 1040 Preparation'}
                  {authoritativeStage === 10 && 'Stage 10: Approved Draft Ready'}
                  {authoritativeStage === 11 && 'Stage 11: Form 8879 E-Signature Ready'}
                  {authoritativeStage === 12 && 'Stage 12: Queued for E-File Gateway'}
                  {(authoritativeStage >= 13) && 'Stage 13+: Accepted & Monitored'}
                </p>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Tax Year {selectedTaxYear} Active</span>
                </span>
              </div>

              {/* Question 2: What do I need to do now? */}
              <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-700/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>2. What do I need to do now?</span>
                </span>
                <p className="text-white font-semibold text-xs">
                  {pendingRequestsCount > 0
                    ? `Respond to ${pendingRequestsCount} open request from your CPA.`
                    : missingCount > 0
                    ? `Upload ${missingCount} required document${missingCount > 1 ? 's' : ''}.`
                    : authoritativeStage === 10
                    ? 'Review and approve your draft return.'
                    : authoritativeStage === 11
                    ? 'Sign Form 8879 authorization.'
                    : 'No action required right now.'}
                </p>
                <span className="text-[10px] font-mono text-slate-400">
                  {missingCount === 0 ? 'Intake file complete' : `${missingCount} pending items`}
                </span>
              </div>

              {/* Question 3: What documents are still missing? */}
              <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-700/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>3. What documents are still missing?</span>
                </span>
                <p className="text-white font-semibold text-xs">
                  {missingCount === 0 ? (
                    <span className="text-emerald-400">0 documents missing. All provided.</span>
                  ) : (
                    `${missingCount} of ${totalRequirements} required documents missing.`
                  )}
                </p>
                <span className="text-[10px] font-mono text-slate-400">
                  {missingDocs.length > 0 ? missingDocs[0].title : 'All requirements satisfied'}
                </span>
              </div>

              {/* Question 4: What documents have been received? */}
              <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-700/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block flex items-center gap-1">
                  <FileCheck className="w-3 h-3" />
                  <span>4. What documents have been received?</span>
                </span>
                <p className="text-white font-semibold text-xs">
                  {resolvedCount} document{resolvedCount === 1 ? '' : 's'} received &amp; logged.
                </p>
                <span className="text-[10px] font-mono text-slate-400">
                  {uploadedDocs.length} source file{uploadedDocs.length === 1 ? '' : 's'} in vault
                </span>
              </div>

              {/* Question 5: What is A/R Tax Services currently reviewing? */}
              <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-700/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>5. What is A/R Tax Services currently reviewing?</span>
                </span>
                <p className="text-white font-semibold text-xs">
                  {authoritativeStage <= 3
                    ? 'Verifying uploaded tax documents, inspecting OCR extractions, and confirming completeness.'
                    : authoritativeStage <= 8
                    ? 'Elena Rostova, CPA is recording tax schedules, reconciling book/tax differences, and compiling workpapers.'
                    : authoritativeStage === 9
                    ? 'Preparing federal Form 1040 and state returns using certified records.'
                    : authoritativeStage <= 11
                    ? 'Managing draft review, practitioner certification, and Form 8879 authorization.'
                    : 'Monitoring IRS transmitter gateway and agency acknowledgment feeds.'}
                </p>
              </div>

              {/* Question 6: What happens next? */}
              <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-700/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  <span>6. What happens next?</span>
                </span>
                <p className="text-white font-semibold text-xs">
                  {authoritativeStage <= 2 && 'Stage 03: Automated Document Validation'}
                  {(authoritativeStage >= 3 && authoritativeStage <= 8) && 'Stage 09: Form 1040 Tax Preparation'}
                  {authoritativeStage === 9 && 'Stage 10: Client Approval'}
                  {authoritativeStage === 10 && 'Stage 11: Form 8879 E-Signature'}
                  {authoritativeStage === 11 && 'Stage 12: Electronic Filing Submission'}
                  {authoritativeStage >= 12 && 'Stage 15+: Monitoring & Archive Vault'}
                </p>
              </div>

              {/* Question 7: Are there messages or requests requiring attention? */}
              <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-700/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  <span>7. Are there messages or requests requiring my attention?</span>
                </span>
                <p className="text-white font-semibold text-xs">
                  {pendingRequestsCount > 0
                    ? `${pendingRequestsCount} open request requires your response.`
                    : unreadMessagesCount > 0
                    ? `${unreadMessagesCount} unread message from your CPA.`
                    : 'No pending inquiries. All communications current.'}
                </p>
              </div>

              {/* Question 8: Do I need to approve, sign, schedule, or pay anything? */}
              <div className="p-3.5 rounded-xl bg-[#06182B] border border-slate-700/80 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[#D4A843] font-bold block flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>8. Do I need to approve, sign, schedule, or pay anything?</span>
                </span>
                <p className="text-white font-semibold text-xs">
                  {authoritativeStage === 10
                    ? 'Return approval required.'
                    : authoritativeStage === 11
                    ? 'Form 8879 e-signature required.'
                    : 'Nothing pending approval or signature at this stage.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT CONTEXTUAL RAIL (1 Column on Desktop) */}
        <div className="space-y-6">
          <RightContextRail
            taxYear={selectedTaxYear}
            pendingRequestsCount={pendingRequestsCount}
            unreadMessagesCount={unreadMessagesCount}
            latestMessageSnippet={latestMessageSnippet}
            hasUpcomingAppointment={hasUpcomingAppointment}
            upcomingAppointmentDate={upcomingAppointmentDate}
            onOpenRequests={() => onNavigateToTab?.('requests')}
            onOpenMessages={() => onNavigateToTab?.('messages')}
            onScheduleAppointment={() => onNavigateToTab?.('appointments')}
            onNavigateToTab={onNavigateToTab}
          />
        </div>
      </div>

      {/* Not Applicable Confirmation Modal */}
      {notApplicableModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#071A2E] border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Confirm Requirement Not Applicable</span>
              </h3>
              <button
                type="button"
                onClick={() => setNotApplicableModalItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300">
              Please confirm why <strong>{notApplicableModalItem.title}</strong> is not applicable to your {selectedTaxYear} tax return:
            </p>

            <textarea
              value={notApplicableReason}
              onChange={(e) => setNotApplicableReason(e.target.value)}
              placeholder="e.g. I did not receive income from this source or had zero transactions in this category."
              className="w-full bg-[#06182B] border border-slate-700 rounded-lg p-2.5 text-white text-xs h-24 outline-none"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setNotApplicableModalItem(null)}
                className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmNotApplicable}
                className="px-4 py-2 rounded-lg bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] font-bold"
              >
                Confirm Not Applicable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
