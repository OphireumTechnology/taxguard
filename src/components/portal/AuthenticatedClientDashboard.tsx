import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  FolderLock,
  FileText,
  Calendar,
  Building2,
  Lock,
  UserCheck,
  Check,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  History,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  LayoutDashboard,
  Shield,
  Layers,
  Inbox,
  Eye,
  RefreshCw,
  Bell,
  DollarSign,
  Scale,
  Send,
  FileCheck,
  RotateCcw,
  Archive,
  TrendingUp,
  PenTool,
  Activity
} from 'lucide-react';
import { StageOneOnboardingService } from '../../services/stageOneOnboardingService';
import { useApp } from '../../context/AppContext';
import { CANONICAL_STAGE_LABELS, StageNumber } from '../../server/taxguard/persistence.types';
import { StageTwoCollectionWorkspace } from '../collection/StageTwoCollectionWorkspace';
import { StageThreeValidationWorkspace } from '../validation/StageThreeValidationWorkspace';
import { TaxReturnView } from './views/TaxReturnView';
import { ApprovalsView } from './views/ApprovalsView';
import { DeliverablesView } from './views/DeliverablesView';
import { StageOneIdentityWizard } from './StageOneIdentityWizard';
import { TaxGuardDiscrepanciesView } from '../../taxguard/views/TaxGuardDiscrepanciesView';
import { MessagesView } from './views/MessagesView';
import { AuditActivityView } from './views/AuditActivityView';
import { ProfileSecurityView } from './views/ProfileSecurityView';
import { ClientProfileView } from './views/ClientProfileView';
import { StepByStepTaxPreparationHome } from './views/StepByStepTaxPreparationHome';
import { MyDocumentsClientVault } from './views/MyDocumentsClientVault';
import { GuidedTaxQuestionnaireModal } from './views/GuidedTaxQuestionnaireModal';
import { useLiveWorkflowAuthority } from '../../hooks/useLiveWorkflowAuthority';
import { StageFourRecordView } from './views/stages/StageFourRecordView';
import { StageFiveReconcileView } from './views/stages/StageFiveReconcileView';
import { StageSixReviewView } from './views/stages/StageSixReviewView';
import { StageSevenReportView } from './views/stages/StageSevenReportView';
import { StageEightPlanView } from './views/stages/StageEightPlanView';
import { StageNinePrepareView } from './views/stages/StageNinePrepareView';
import { StageTenApproveView } from './views/stages/StageTenApproveView';
import { StageElevenSignView } from './views/stages/StageElevenSignView';
import { StageTwelveFileView } from './views/stages/StageTwelveFileView';
import { StageThirteenFeedbackView } from './views/stages/StageThirteenFeedbackView';
import { StageFourteenResolveView } from './views/stages/StageFourteenResolveView';
import { StageFifteenMonitorView } from './views/stages/StageFifteenMonitorView';
import { StageSixteenArchiveView } from './views/stages/StageSixteenArchiveView';
import { StageSeventeenRenewView } from './views/stages/StageSeventeenRenewView';
import { StageEighteenRepeatView } from './views/stages/StageEighteenRepeatView';

interface WorkflowStageItem {
  number: StageNumber;
  shortLabel: string;
  name: string;
}

export interface SimplifiedJourneyStep {
  id: string;
  stepNumber: number;
  label: string;
  description: string;
  stageNumbers: StageNumber[];
  defaultNavId: string;
}

export const SIMPLIFIED_JOURNEY_STEPS: SimplifiedJourneyStep[] = [
  {
    id: 'step_1_getting_started',
    stepNumber: 1,
    label: 'Getting Started',
    description: 'Onboarding & Identity',
    stageNumbers: [1],
    defaultNavId: 'stage_01',
  },
  {
    id: 'step_2_documents',
    stepNumber: 2,
    label: 'Documents',
    description: 'Intake & Validation',
    stageNumbers: [2, 3],
    defaultNavId: 'stage_02',
  },
  {
    id: 'step_3_review',
    stepNumber: 3,
    label: 'Review',
    description: 'Records, Reconcile & Review',
    stageNumbers: [4, 5, 6, 7, 8],
    defaultNavId: 'stage_04',
  },
  {
    id: 'step_4_tax_prep',
    stepNumber: 4,
    label: 'Tax Preparation',
    description: 'Form 1040 & State Calculations',
    stageNumbers: [9],
    defaultNavId: 'stage_09',
  },
  {
    id: 'step_5_approval_sign',
    stepNumber: 5,
    label: 'Approval & Signature',
    description: 'CPA Review & Form 8879 E-Sign',
    stageNumbers: [10, 11],
    defaultNavId: 'stage_10',
  },
  {
    id: 'step_6_filing',
    stepNumber: 6,
    label: 'Filing',
    description: 'IRS Transmission & Acknowledgments',
    stageNumbers: [12, 13, 14],
    defaultNavId: 'stage_12',
  },
  {
    id: 'step_7_completed',
    stepNumber: 7,
    label: 'Completed',
    description: 'Monitoring, Vault & Multi-Year',
    stageNumbers: [15, 16, 17, 18],
    defaultNavId: 'stage_15',
  }
];

const WORKFLOW_STAGES: WorkflowStageItem[] = [
  { number: 1, shortLabel: '01', name: 'Onboard' },
  { number: 2, shortLabel: '02', name: 'Collect' },
  { number: 3, shortLabel: '03', name: 'Validate' },
  { number: 4, shortLabel: '04', name: 'Record' },
  { number: 5, shortLabel: '05', name: 'Reconcile' },
  { number: 6, shortLabel: '06', name: 'Review' },
  { number: 7, shortLabel: '07', name: 'Report' },
  { number: 8, shortLabel: '08', name: 'Plan' },
  { number: 9, shortLabel: '09', name: 'Prepare Taxes' },
  { number: 10, shortLabel: '10', name: 'Approve' },
  { number: 11, shortLabel: '11', name: 'Sign' },
  { number: 12, shortLabel: '12', name: 'File' },
  { number: 13, shortLabel: '13', name: 'Government Feedback' },
  { number: 14, shortLabel: '14', name: 'Resolve' },
  { number: 15, shortLabel: '15', name: 'Monitor' },
  { number: 16, shortLabel: '16', name: 'Archive' },
  { number: 17, shortLabel: '17', name: 'Renew' },
  { number: 18, shortLabel: '18', name: 'Repeat' },
];

export interface AuthenticatedClientDashboardProps {
  clientId: string;
  selectedTaxYear: number;
  onTaxYearChange?: (year: number) => void;
  onEnterStageTwo?: () => void;
  onReviewStageOne?: () => void;
  initialNav?: string;
  authority?: any;
  onServerWorkflowRefresh?: () => void;
}

export const AuthenticatedClientDashboard: React.FC<AuthenticatedClientDashboardProps> = ({
  clientId,
  selectedTaxYear,
  onTaxYearChange,
  onEnterStageTwo,
  onReviewStageOne,
  initialNav = 'home',
  authority: propAuthority,
  onServerWorkflowRefresh
}) => {
  const { currentUser, logout, notifications } = useApp();

  // Authoritative workflow authority
  const hookAuthority = useLiveWorkflowAuthority(selectedTaxYear);
  const authority = propAuthority || hookAuthority;

  // Active navigation selection with URL hash sync
  const [activeNavId, setActiveNavId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (pathname === '/portal/documents') {
        return 'documents';
      }
      if (pathname === '/portal/requests') {
        return 'exceptions';
      }
      if (pathname === '/portal/appointments') {
        return 'messages';
      }
      if (pathname === '/portal/profile') {
        return 'profile';
      }
      if (pathname === '/portal/dashboard') {
        return 'home';
      }
      if (hash.includes('collect') || hash.includes('stage2') || hash.includes('workspace')) {
        return 'stage_02';
      }
      if (hash.includes('onboard') || hash.includes('stage1')) {
        return 'stage_01';
      }
      if (hash.includes('document')) {
        return 'documents';
      }
      if (hash.includes('exception')) {
        return 'exceptions';
      }
      if (hash.includes('message')) {
        return 'messages';
      }
      if (hash.includes('audit') || hash.includes('activity')) {
        return 'activity';
      }
      if (hash.includes('profile')) {
        return 'profile';
      }
      if (hash.includes('security')) {
        return 'security';
      }
    }
    // RETURNING CLIENT ROUTING:
    // When a client logs in with Stage 01 = COMPLETED:
    // Determine Current Active Stage:
    // If Stage 02 is active, automatically present Stage 02 COLLECT / DOCUMENT INTAKE.
    // If the client has legitimately progressed beyond Stage 02, route to current authorized stage.
    if (initialNav === 'home' || !initialNav) {
      const activeStage = propAuthority?.workflow?.activeStage ?? 2;
      if (activeStage === 2) {
        return 'stage_02';
      }
      if (activeStage > 2) {
        return `stage_${String(activeStage).padStart(2, '0')}`;
      }
    }
    return initialNav;
  });

  // Ensure returning client is automatically routed to current active stage (e.g. Stage 02 Collect)
  // unless they explicitly navigated to /portal/dashboard
  useEffect(() => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase().replace(/\/+$/, '') : '';
    if (activeNavId === 'home' && pathname !== '/portal/dashboard') {
      const activeStage = authority?.workflow?.activeStage ?? 2;
      if (activeStage === 2) {
        setActiveNavId('stage_02');
      } else if (activeStage > 2) {
        setActiveNavId(`stage_${String(activeStage).padStart(2, '0')}`);
      }
    }
  }, [authority?.workflow?.activeStage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      if (pathname === '/portal/documents') setActiveNavId('documents');
      else if (pathname === '/portal/requests') setActiveNavId('exceptions');
      else if (pathname === '/portal/appointments') setActiveNavId('messages');
      else if (pathname === '/portal/profile') setActiveNavId('profile');
      else if (pathname === '/portal/dashboard') setActiveNavId('home');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Collapsible sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('taxguard_client_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [selectedLockedStage, setSelectedLockedStage] = useState<WorkflowStageItem | null>(null);
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState<boolean>(false);
  const [viewDetailedWorkflow, setViewDetailedWorkflow] = useState<boolean>(false);

  const getSimplifiedStepStatus = (step: SimplifiedJourneyStep): 'completed' | 'active' | 'locked' => {
    const activeStage = authority?.workflow?.activeStage ?? 2;
    if (step.stageNumbers.every((n) => n < activeStage)) return 'completed';
    if (step.stageNumbers.includes(activeStage as StageNumber)) return 'active';
    return 'locked';
  };

  const handleSimplifiedStepClick = (step: SimplifiedJourneyStep) => {
    const activeStage = authority?.workflow?.activeStage ?? 2;
    const status = getSimplifiedStepStatus(step);
    if (status === 'locked') {
      const firstLockedStage = WORKFLOW_STAGES.find((s) => s.number === step.stageNumbers[0]);
      if (firstLockedStage) setSelectedLockedStage(firstLockedStage);
      return;
    }
    if (step.stageNumbers.includes(activeStage as StageNumber)) {
      if (activeStage === 2) handleSelectNav('stage_02');
      else handleSelectNav(`stage_${String(activeStage).padStart(2, '0')}`);
    } else {
      handleSelectNav(step.defaultNavId);
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('taxguard_client_sidebar_collapsed', String(next));
      }
      return next;
    });
  };

  // Authoritative Client Dossier & Identity
  const dossier = StageOneOnboardingService.getDossier(clientId);
  const clientName =
    dossier?.legalName ||
    (currentUser?.name && currentUser.name !== 'Client Taxpayer' ? currentUser.name : null) ||
    'Valued Client';
  const taxpayerType = dossier?.taxpayerType === 'entity' ? 'Entity / Business' : 'Individual / Family';
  const signerName =
    dossier?.engagementConsent?.signerFullName ||
    dossier?.authorizedRep?.fullName ||
    currentUser?.name ||
    'Valued Client';

  // Determine stage status authoritatively from workflow persistence
  const getStageStatus = (stageNum: StageNumber): 'completed' | 'active' | 'locked' => {
    const activeStage = authority?.workflow?.activeStage ?? 2;

    if (stageNum === 1) {
      if (authority?.workflow?.stage1?.status === 'COMPLETED' || activeStage >= 2) {
        return 'completed';
      }
      return 'active';
    }

    if (stageNum < activeStage) {
      return 'completed';
    }

    if (stageNum === activeStage) {
      return 'active';
    }

    return 'locked';
  };

  const handleSelectNav = (navId: string) => {
    setActiveNavId(navId);
    setSelectedLockedStage(null);
    setMobileDrawerOpen(false);

    if (navId === 'stage_02') {
      onEnterStageTwo?.();
    } else if (navId === 'stage_01') {
      onReviewStageOne?.();
    }
  };

  const handleStageClick = (stg: WorkflowStageItem) => {
    const status = getStageStatus(stg.number);
    if (status === 'locked') {
      setSelectedLockedStage(stg);
      setActiveNavId(`stage_${stg.shortLabel}`);
      setMobileDrawerOpen(false);
      return;
    }

    if (stg.number === 1) {
      handleSelectNav('stage_01');
    } else if (stg.number === 2) {
      handleSelectNav('stage_02');
    } else {
      handleSelectNav(`stage_${stg.shortLabel}`);
    }
  };

  const handleSignOut = () => {
    logout();
  };

  // Render Left Navigation Sidebar Content
  const renderSidebarContent = (isMobile: boolean = false) => {
    const isCollapsed = !isMobile && sidebarCollapsed;

    return (
      <div className="flex flex-col h-full bg-[#071A2E] text-slate-200 border-r border-slate-700/60 select-none">
        {/* Brand & Client Workspace Header */}
        <div className="p-4 border-b border-slate-700/60 flex items-center justify-between bg-[#06182B]">
          {!isCollapsed ? (
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
                A/R Tax Services, LLC
              </div>
              <div className="text-sm font-bold text-white truncate flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-[#D4A843] shrink-0" />
                <span>Client Dashboard</span>
              </div>
            </div>
          ) : (
            <div className="text-xs font-black text-[#D7AC4A] mx-auto tracking-widest">A/R</div>
          )}

          {!isMobile && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg border border-[#1A365D] hover:bg-[#0A2544] text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            </button>
          )}

          {isMobile && (
            <button
              onClick={() => setMobileDrawerOpen(false)}
              className="p-1 rounded-lg border border-[#1A365D] hover:bg-[#0A2544] text-slate-300"
              aria-label="Close navigation drawer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Modules */}
        <nav className="flex-1 p-2 space-y-4 overflow-y-auto" aria-label="TaxGuard Portal Navigation">
          {/* Section 1: Dashboard Home */}
          <div>
            {!isCollapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Overview
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="Overview" />
            )}

            <button
              type="button"
              onClick={() => handleSelectNav('home')}
              title={isCollapsed ? 'Client Dashboard Home' : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium text-left transition-colors rounded-lg cursor-pointer ${
                activeNavId === 'home'
                  ? 'bg-[#0A2544] text-[#E8C66A] border-l-4 border-l-[#C99A32] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#0A2544]/60 border-l-4 border-l-transparent'
              }`}
            >
              <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeNavId === 'home' ? 'text-[#D7AC4A]' : 'text-slate-400'}`} />
              {!isCollapsed && <span className="truncate">Client Dashboard</span>}
            </button>
          </div>

          {/* Section 2: WORKFLOW (Simplified 7-Step Journey or Detailed 18 Stages) */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#D7AC4A] font-bold">
                <span>{viewDetailedWorkflow ? 'Workflow (18 Stages)' : 'Tax Journey (7 Steps)'}</span>
                <button
                  type="button"
                  onClick={() => setViewDetailedWorkflow((v) => !v)}
                  className="text-slate-400 hover:text-white text-[9px] lowercase font-normal underline cursor-pointer"
                >
                  {viewDetailedWorkflow ? 'show 7 steps' : 'view 18 stages'}
                </button>
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="Workflow" />
            )}

            {!viewDetailedWorkflow ? (
              <div className="space-y-0.5">
                {SIMPLIFIED_JOURNEY_STEPS.map((step) => {
                  const status = getSimplifiedStepStatus(step);
                  const isNavActive = step.stageNumbers.some(
                    (num) => activeNavId === `stage_${String(num).padStart(2, '0')}` || (num === 2 && activeNavId === 'stage_02')
                  );

                  return (
                    <div key={step.id} className="relative group">
                      <button
                        type="button"
                        onClick={() => handleSimplifiedStepClick(step)}
                        title={isCollapsed ? `${step.label} (${status.toUpperCase()})` : undefined}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-all rounded-md cursor-pointer ${
                          isNavActive
                            ? 'bg-[#0A2544] text-white border-l-4 border-l-[#C99A32] font-bold shadow-sm ring-1 ring-[#C99A32]/40'
                            : status === 'completed'
                            ? 'text-emerald-300 hover:text-white hover:bg-[#072418]/60 border-l-4 border-l-transparent'
                            : status === 'active'
                            ? 'text-[#E8C66A] hover:text-white hover:bg-[#0A2544]/50 border-l-4 border-l-transparent font-semibold'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-[#071626]/50 border-l-4 border-l-transparent opacity-80'
                        }`}
                      >
                        {status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : status === 'active' ? (
                          <span className="w-2 h-2 rounded-full bg-[#E2BD67] animate-pulse shrink-0 ring-2 ring-[#D4A843]/50" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}

                        {!isCollapsed ? (
                          <>
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">{step.stepNumber}.</span>
                            <span className="truncate text-[11px]">{step.label}</span>
                            <span className="ml-auto text-[10px] font-mono shrink-0">
                              {status === 'completed' && <span className="text-emerald-400 font-bold">✓</span>}
                              {status === 'active' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#D4A843]/20 text-[#E2BD67] border border-[#D4A843]/40 font-bold">
                                  ACTIVE
                                </span>
                              )}
                              {status === 'locked' && <span className="text-slate-600">🔒</span>}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-[11px] font-bold ml-1">{step.stepNumber}</span>
                        )}
                      </button>

                      {isCollapsed && (
                        <div className="hidden group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-[#020D1A] text-white text-[11px] font-medium rounded-md shadow-2xl border border-[#1A365D] z-50 whitespace-nowrap pointer-events-none items-center gap-1.5">
                          <span className="font-mono font-bold text-[#D7AC4A]">Step {step.stepNumber}</span>
                          <span>{step.label}</span>
                          <span
                            className={`text-[10px] uppercase font-mono px-1 rounded ${
                              status === 'completed'
                                ? 'bg-emerald-950 text-emerald-300'
                                : status === 'active'
                                ? 'bg-blue-950 text-blue-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!isCollapsed && (
                  <div className="pt-1.5 px-2">
                    <button
                      type="button"
                      onClick={() => setViewDetailedWorkflow(true)}
                      className="text-[10px] text-[#D4A843] hover:underline font-mono flex items-center gap-1 cursor-pointer w-full text-left"
                    >
                      <span>&rarr; View Detailed 18 Stages</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-0.5">
                {WORKFLOW_STAGES.map((stg) => {
                  const status = getStageStatus(stg.number);
                  const isNavActive = activeNavId === `stage_${stg.shortLabel}` || (stg.number === 2 && activeNavId === 'stage_02');

                  return (
                    <div key={stg.number} className="relative group">
                      <button
                        type="button"
                        onClick={() => handleStageClick(stg)}
                        title={isCollapsed ? `${stg.shortLabel} ${stg.name} (${status.toUpperCase()})` : undefined}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-all rounded-md cursor-pointer ${
                          isNavActive
                            ? 'bg-[#0A2544] text-white border-l-4 border-l-[#C99A32] font-bold shadow-sm ring-1 ring-[#C99A32]/40'
                            : status === 'completed'
                            ? 'text-emerald-300 hover:text-white hover:bg-[#072418]/60 border-l-4 border-l-transparent'
                            : status === 'active'
                            ? 'text-[#E8C66A] hover:text-white hover:bg-[#0A2544]/50 border-l-4 border-l-transparent font-semibold'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-[#071626]/50 border-l-4 border-l-transparent opacity-80'
                        }`}
                      >
                        {status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : status === 'active' ? (
                          <span className="w-2 h-2 rounded-full bg-[#E2BD67] animate-pulse shrink-0 ring-2 ring-[#D4A843]/50" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}

                        {!isCollapsed ? (
                          <>
                            <span className="font-mono text-[11px] text-slate-400 shrink-0">{stg.shortLabel}</span>
                            <span className="truncate text-[11px]">{stg.name}</span>
                            <span className="ml-auto text-[10px] font-mono shrink-0">
                              {status === 'completed' && <span className="text-emerald-400 font-bold">✓</span>}
                              {status === 'active' && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#D4A843]/20 text-[#E2BD67] border border-[#D4A843]/40 font-bold">
                                  ACTIVE
                                </span>
                              )}
                              {status === 'locked' && <span className="text-slate-600">🔒</span>}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-[11px] font-bold ml-1">{stg.shortLabel}</span>
                        )}
                      </button>

                      {isCollapsed && (
                        <div className="hidden group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-[#020D1A] text-white text-[11px] font-medium rounded-md shadow-2xl border border-[#1A365D] z-50 whitespace-nowrap pointer-events-none items-center gap-1.5">
                          <span className="font-mono font-bold text-[#D7AC4A]">{stg.shortLabel}</span>
                          <span>{stg.name}</span>
                          <span
                            className={`text-[10px] uppercase font-mono px-1 rounded ${
                              status === 'completed'
                                ? 'bg-emerald-950 text-emerald-300'
                                : status === 'active'
                                ? 'bg-blue-950 text-blue-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {!isCollapsed && (
                  <div className="pt-1.5 px-2">
                    <button
                      type="button"
                      onClick={() => setViewDetailedWorkflow(false)}
                      className="text-[10px] text-slate-400 hover:text-white font-mono flex items-center gap-1 cursor-pointer w-full text-left"
                    >
                      <span>&larr; Switch to Simplified 7 Steps</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: CASE */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Case &amp; Compliance
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="Case" />
            )}

            <div className="space-y-0.5">
              {[
                { id: 'documents', label: 'Documents', icon: FolderLock },
                { id: 'exceptions', label: 'Exceptions', icon: AlertTriangle },
                { id: 'messages', label: 'Messages', icon: MessageSquare },
                { id: 'activity', label: 'Activity / Audit', icon: History }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNavId === item.id;
                return (
                  <div key={item.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-left transition-colors rounded-lg cursor-pointer ${
                        isActive
                          ? 'bg-[#0A2544] text-[#E8C66A] border-l-4 border-l-[#C99A32] font-semibold shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-[#0A2544]/60 border-l-4 border-l-transparent'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#D7AC4A]' : 'text-slate-400'}`} />
                      {!isCollapsed && <span className="truncate text-[11px]">{item.label}</span>}
                    </button>
                    {isCollapsed && (
                      <div className="hidden group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-[#020D1A] text-white text-[11px] font-medium rounded-md shadow-2xl border border-[#1A365D] z-50 whitespace-nowrap pointer-events-none">
                        <span>{item.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4: ACCOUNT */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Account &amp; Security
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="Account" />
            )}

            <div className="space-y-0.5">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'security', label: 'Security & Consents', icon: ShieldCheck }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNavId === item.id;
                return (
                  <div key={item.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-left transition-colors rounded-lg cursor-pointer ${
                        isActive
                          ? 'bg-[#0A2544] text-[#E8C66A] border-l-4 border-l-[#C99A32] font-semibold shadow-sm'
                          : 'text-slate-300 hover:text-white hover:bg-[#0A2544]/60 border-l-4 border-l-transparent'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#D7AC4A]' : 'text-slate-400'}`} />
                      {!isCollapsed && <span className="truncate text-[11px]">{item.label}</span>}
                    </button>
                    {isCollapsed && (
                      <div className="hidden group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-[#020D1A] text-white text-[11px] font-medium rounded-md shadow-2xl border border-[#1A365D] z-50 whitespace-nowrap pointer-events-none">
                        <span>{item.label}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="relative group pt-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  title={isCollapsed ? 'Sign Out' : undefined}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:text-red-100 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  {!isCollapsed && <span className="truncate text-[11px]">Sign Out</span>}
                </button>
                {isCollapsed && (
                  <div className="hidden group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-[#020D1A] text-red-300 text-[11px] font-medium rounded-md shadow-2xl border border-red-900/50 z-50 whitespace-nowrap pointer-events-none">
                    <span>Sign Out</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Footer info in sidebar */}
        {!isCollapsed && (
          <div className="p-3 border-t border-[#1A365D] bg-[#020D1A] text-[10px] text-slate-400 font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span>Client:</span>
              <span className="text-slate-200 font-bold">{clientId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Gate Status:</span>
              <span className="text-emerald-400 font-semibold">Stage 02 Active</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main Workspace Content based on context isolation
  const renderMainWorkspace = () => {
    // 1. STAGE LOCKED NOTICE
    if (selectedLockedStage) {
      return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
          <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-600/40">
                <span>STAGE LOCKED BY TAXGUARD HARD GATE</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {CANONICAL_STAGE_LABELS[selectedLockedStage.number] || `Stage ${selectedLockedStage.shortLabel} — ${selectedLockedStage.name}`} is Locked
              </h2>
              <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
                Complete <strong>Stage 02 Collect</strong> before Stage {selectedLockedStage.shortLabel} ({selectedLockedStage.name}) becomes available.
              </p>
            </div>

            <div className="p-4 bg-[#071A2E] border border-[rgba(148,163,184,0.18)] rounded-xl text-left max-w-lg mx-auto text-xs text-slate-300 space-y-2 font-mono">
              <div className="text-[#D4A843] font-bold uppercase tracking-wider text-[10px]">Authoritative Hard Gate Policy</div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Stage 01 Onboard: Cleared &amp; Certified</span>
              </div>
              <div className="flex items-start gap-2 text-blue-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse mt-1 shrink-0" />
                <span>Stage 02 Collect: In Progress (Active Client Workspace)</span>
              </div>
              <div className="flex items-start gap-2 text-slate-500">
                <span>🔒</span>
                <span>Stage {selectedLockedStage.shortLabel}: Locked until all required documents &amp; intake checklists clear CPA verification</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSelectNav('stage_02')}
                className="px-6 py-3 rounded-xl text-sm font-bold text-[#071A2E] bg-[#D4A843] hover:bg-[#E1BB60] transition-all inline-flex items-center gap-2 shadow-xl cursor-pointer"
              >
                <span>Go to Active Stage 02 (Collect) Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2. CLIENT DASHBOARD HOME (Overview & Action-Oriented Step-by-Step Experience)
    if (activeNavId === 'home') {
      return (
        <StepByStepTaxPreparationHome
          clientId={clientId}
          clientName={clientName}
          selectedTaxYear={selectedTaxYear}
          userEmail={currentUser?.email}
          onNavigateToStageTwo={() => handleSelectNav('stage_02')}
          onNavigateToVault={() => handleSelectNav('documents')}
          onOpenQuestionnaire={() => setShowQuestionnaireModal(true)}
          onSelectRequirementForUpload={() => handleSelectNav('stage_02')}
          authority={authority}
          onNavigateToTab={(tab) => handleSelectNav(tab)}
          onNavigateToDetailedWorkflow={() => {
            setViewDetailedWorkflow(true);
            setSidebarCollapsed(false);
          }}
        />
      );
    }

    // 3. STAGE 01 ONBOARD (Read / Review Mode)
    if (activeNavId === 'stage_01') {
      return (
        <div className="space-y-4">
          <div className="max-w-7xl mx-auto px-4 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-4 rounded-xl">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded">
                  ✓ COMPLETED &bull; HARD EXIT GATE PASSED
                </span>
                <span className="text-xs text-slate-400 font-mono">Stage 01 of 18</span>
              </div>
              <h2 className="text-lg font-bold text-white">Stage 01 (Onboard) Dossier &mdash; Read-Only Review</h2>
              <p className="text-xs text-slate-300">
                Your statutory onboarding dossier and IRC § 7216 consent status are recorded and locked.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectNav('stage_02')}
                className="px-4 py-2 rounded-lg text-xs font-bold text-[#071A2E] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue to Stage 02</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <StageOneIdentityWizard
            initialClientId={clientId}
            taxYear={selectedTaxYear}
            authoritativeActiveStage={authority?.workflow?.activeStage || 2}
            onExitGatePassed={onServerWorkflowRefresh}
            onNavigateToDashboard={() => handleSelectNav('home')}
          />
        </div>
      );
    }

    // 4. STAGE 02 COLLECT (Active Production Workspace)
    if (activeNavId === 'stage_02') {
      return (
        <div className="space-y-4">
          <div className="max-w-7xl mx-auto px-4 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E2BD67] animate-pulse" />
              <span className="text-xs font-mono font-bold text-white bg-[#0D2745] border border-[rgba(148,163,184,0.18)] px-3 py-1 rounded-md">
                Active Stage: Stage 02 &mdash; Collect
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectNav('home')}
              className="text-xs text-slate-400 hover:text-white hover:underline cursor-pointer"
            >
              &larr; Return to Dashboard Home
            </button>
          </div>

          <StageTwoCollectionWorkspace
            clientId={clientId}
            selectedTaxYear={selectedTaxYear}
            onTaxYearChange={onTaxYearChange}
            userRole={currentUser?.role === 'accountant' || currentUser?.role === 'reviewer' || currentUser?.role === 'admin' || currentUser?.role === 'super_admin' ? 'STAFF' : 'CLIENT'}
            serverStageThreeEligible={authority?.eligibility?.eligibility?.stage3 === true}
            onServerWorkflowRefresh={onServerWorkflowRefresh}
          />
        </div>
      );
    }

    // 5. DOCUMENTS MANAGEMENT (Context: Documents)
    if (activeNavId === 'documents') {
      return (
        <div className="space-y-4">
          <div className="max-w-7xl mx-auto px-4 pt-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderLock className="w-5 h-5 text-[#D4A843]" />
                <span>Secure Document Management &amp; Vault</span>
              </h2>
              <p className="text-xs text-slate-400">
                Encrypted storage, document category routing, and SHA-256 tamper-evident integrity tracking.
              </p>
            </div>
          </div>

          <StageTwoCollectionWorkspace
            clientId={clientId}
            selectedTaxYear={selectedTaxYear}
            onTaxYearChange={onTaxYearChange}
            initialSubTab="vault"
            userRole={currentUser?.role === 'accountant' || currentUser?.role === 'reviewer' || currentUser?.role === 'admin' || currentUser?.role === 'super_admin' ? 'STAFF' : 'CLIENT'}
            serverStageThreeEligible={authority?.eligibility?.eligibility?.stage3 === true}
            onServerWorkflowRefresh={onServerWorkflowRefresh}
          />
        </div>
      );
    }

    // 6. EXCEPTIONS CENTER (Context: Exceptions)
    if (activeNavId === 'exceptions') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>TaxGuard Exceptions &amp; Discrepancy Center</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Automated diagnostic checks, variance analysis, and client explanation resolution workflow.
            </p>
          </div>

          <TaxGuardDiscrepanciesView userRole="client" />
        </div>
      );
    }

    // 7. MESSAGES (Context: Messages)
    if (activeNavId === 'messages') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#D4A843]" />
              <span>Secure Advisory Messages &amp; RFIs</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Direct, encrypted communication with Elena Rostova, CPA and your dedicated A/R Tax Services engagement team.
            </p>
          </div>

          <MessagesView onOpenUpload={() => handleSelectNav('stage_02')} />
        </div>
      );
    }

    // 8. ACTIVITY / AUDIT (Context: Activity)
    if (activeNavId === 'activity') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-[#D4A843]" />
              <span>Compliance Audit Trail &amp; System Provenance</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Tamper-evident event logs verifying IRC § 7216 consent, document hashing, and stage transitions.
            </p>
          </div>

          <AuditActivityView />
        </div>
      );
    }

    // 9. PROFILE (Context: Authoritative Client Profile)
    if (activeNavId === 'profile') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <ClientProfileView
            currentUser={currentUser}
            onNavigateToDocuments={() => handleSelectNav('documents')}
            onNavigateToStageTwo={() => handleSelectNav('stage_02')}
          />
        </div>
      );
    }

    // 10. SECURITY & CONSENTS (Context: Security)
    if (activeNavId === 'security') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Security, Credentials &amp; Statutory Consents</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              IRC § 7216 confidentiality agreements, session monitoring, and data encryption policies.
            </p>
          </div>

          <ProfileSecurityView currentUser={currentUser} initialTab="privacy_consent" />
        </div>
      );
    }

    // 11. STAGE 03: VALIDATE
    if (activeNavId === 'stage_03') {
      return (
        <StageThreeValidationWorkspace
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onTaxYearChange={onTaxYearChange}
          userRole={currentUser?.role === 'accountant' || currentUser?.role === 'reviewer' || currentUser?.role === 'admin' ? 'accountant' : 'client'}
          onNavigateToStageTwo={() => handleSelectNav('stage_02')}
        />
      );
    }

    // 12. STAGE 04: RECORD
    if (activeNavId === 'stage_04') {
      return (
        <StageFourRecordView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageTwo={() => handleSelectNav('stage_02')}
          onNavigateToStageFive={() => handleSelectNav('stage_05')}
        />
      );
    }

    // 13. STAGE 05: RECONCILE
    if (activeNavId === 'stage_05') {
      return (
        <StageFiveReconcileView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageFour={() => handleSelectNav('stage_04')}
          onNavigateToStageSix={() => handleSelectNav('stage_06')}
        />
      );
    }

    // 14. STAGE 06: REVIEW
    if (activeNavId === 'stage_06') {
      return (
        <StageSixReviewView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageSeven={() => handleSelectNav('stage_07')}
        />
      );
    }

    // 15. STAGE 07: REPORT
    if (activeNavId === 'stage_07') {
      return (
        <StageSevenReportView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageEight={() => handleSelectNav('stage_08')}
        />
      );
    }

    // 16. STAGE 08: PLAN
    if (activeNavId === 'stage_08') {
      return (
        <StageEightPlanView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }

    // 17. STAGE 09: PREPARE TAXES
    if (activeNavId === 'stage_09') {
      return (
        <StageNinePrepareView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageTen={() => handleSelectNav('stage_10')}
        />
      );
    }

    // 18. STAGE 10: APPROVE
    if (activeNavId === 'stage_10') {
      return (
        <StageTenApproveView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          clientName={clientName}
          onNavigateToStageEleven={() => handleSelectNav('stage_11')}
          onServerWorkflowRefresh={onServerWorkflowRefresh}
        />
      );
    }

    // 19. STAGE 11: SIGN
    if (activeNavId === 'stage_11') {
      return (
        <StageElevenSignView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          clientName={clientName}
          userEmail={currentUser?.email}
        />
      );
    }

    // 20. STAGE 12: FILE
    if (activeNavId === 'stage_12') {
      return (
        <StageTwelveFileView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }

    // 21. STAGE 13: GOVERNMENT FEEDBACK
    if (activeNavId === 'stage_13') {
      return (
        <StageThirteenFeedbackView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }

    // 22. STAGE 14: RESOLVE
    if (activeNavId === 'stage_14') {
      return (
        <StageFourteenResolveView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }

    // 23. STAGE 15: MONITOR
    if (activeNavId === 'stage_15') {
      return (
        <StageFifteenMonitorView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }

    // 24. STAGE 16: ARCHIVE
    if (activeNavId === 'stage_16') {
      return (
        <StageSixteenArchiveView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageSeventeen={() => handleSelectNav('stage_17')}
        />
      );
    }

    // 25. STAGE 17: RENEW
    if (activeNavId === 'stage_17') {
      return (
        <StageSeventeenRenewView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          clientName={clientName}
          onCommissionNewTaxYear={(year) => {
            onTaxYearChange?.(year);
            handleSelectNav('stage_01');
          }}
        />
      );
    }

    // 26. STAGE 18: REPEAT
    if (activeNavId === 'stage_18') {
      return (
        <StageEighteenRepeatView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          clientName={clientName}
          onNavigateToYear={(year) => onTaxYearChange?.(year)}
          onNavigateToVault={() => handleSelectNav('documents')}
        />
      );
    }

    // Default Fallback: Client Dashboard Home
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Select a module from the left navigation.</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#06182B] text-slate-100 flex flex-col font-sans" id="authenticated-client-dashboard">
      {/* ========================================================================= */}
      {/* 1. TOP BAR */}
      {/* ========================================================================= */}
      <header className="h-14 bg-[#071A2E] border-b border-slate-700/60 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-md">
        {/* Left: Mobile Toggle & Brand / Active Context */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden p-1.5 rounded-lg border border-slate-700/60 hover:bg-[#0D2745] text-slate-300"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
              A/R Tax Services
            </span>
            <span className="text-slate-500 hidden sm:inline">&bull;</span>
            <span className="text-xs text-[#D4A843] font-mono font-semibold">
              TaxGuard Client Portal
            </span>
          </div>
        </div>

        {/* Right: Client ID, Tax Year, Compliance Badge, Profile & Sign Out */}
        <div className="flex items-center gap-3">
          {/* Tax Year Selector */}
          <div className="flex items-center gap-1.5 bg-[#06182B] border border-slate-700/60 px-2.5 py-1 rounded-lg">
            <Calendar className="w-3 h-3 text-[#D4A843]" />
            <select
              value={selectedTaxYear}
              onChange={(e) => onTaxYearChange?.(Number(e.target.value))}
              className="bg-transparent font-mono text-xs font-bold text-[#D4A843] cursor-pointer outline-none"
              aria-label="Select tax year"
            >
              <option value={2026} className="bg-[#071A2E] text-slate-200">TY 2026 (Planning)</option>
              <option value={2025} className="bg-[#071A2E] text-slate-200">TY 2025 (Active Filing)</option>
              <option value={2024} className="bg-[#071A2E] text-slate-200">TY 2024 (Prior Year)</option>
            </select>
          </div>

          {/* Compliance Badge */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>IRC § 7216 Consent Protected</span>
          </div>

          {/* User & Sign Out */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-700/60">
            <button
              type="button"
              onClick={() => handleSelectNav('profile')}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2 py-1 rounded-lg hover:bg-[#0D2745] transition-colors cursor-pointer"
              title="View Profile"
            >
              <User className="w-3.5 h-3.5 text-[#D4A843]" />
              <span className="hidden sm:inline font-medium truncate max-w-[120px]">{clientName}</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-[#0D2745] transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign out of client portal"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. BODY LAYOUT: LEFT SIDEBAR + MAIN WORKSPACE */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Collapsible Left Sidebar */}
        <aside
          className={`hidden md:flex flex-col shrink-0 transition-all duration-200 z-20 ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {renderSidebarContent(false)}
        </aside>

        {/* Mobile Slide-Over Navigation Drawer */}
        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileDrawerOpen(false)}
              aria-hidden="true"
            />
            <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10">
              {renderSidebarContent(true)}
            </div>
          </div>
        )}

        {/* Main Workspace Area with Context Isolation */}
        <main className="flex-1 overflow-y-auto bg-[#06182B]" id="main-workspace-content">
          {renderMainWorkspace()}
        </main>
      </div>
    </div>
  );
};
