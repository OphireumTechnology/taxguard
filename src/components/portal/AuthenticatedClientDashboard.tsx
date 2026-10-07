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
  Activity,
  Search,
  HelpCircle,
  FileQuestion,
  CreditCard,
  Settings
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
import { BillingView } from './views/BillingView';
import { RequestsView } from './views/RequestsView';
import { LiveCalendarModule } from '../calendar/LiveCalendarModule';
import { ClientSearchModal } from './dashboard/ClientSearchModal';
import { NotificationCenterDropdown } from './dashboard/NotificationCenterDropdown';
import { TaxYearsArchiveSection } from './dashboard/TaxYearsArchiveSection';
import { getStoredToken } from '../../services/api';

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

export const WORKFLOW_STAGES: WorkflowStageItem[] = [
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
      if (pathname === '/portal/documents') return 'documents';
      if (pathname === '/portal/requests') return 'requests';
      if (pathname === '/portal/appointments') return 'appointments';
      if (pathname === '/portal/profile') return 'profile';
      if (pathname === '/portal/dashboard') return 'home';
      if (hash.includes('collect') || hash.includes('stage2') || hash.includes('workspace')) return 'stage_02';
      if (hash.includes('onboard') || hash.includes('stage1')) return 'stage_01';
      if (hash.includes('document')) return 'documents';
      if (hash.includes('request') || hash.includes('exception')) return 'requests';
      if (hash.includes('message')) return 'messages';
      if (hash.includes('appointment')) return 'appointments';
      if (hash.includes('billing') || hash.includes('payment')) return 'billing';
      if (hash.includes('archive') || hash.includes('records')) return 'archive';
      if (hash.includes('audit') || hash.includes('activity')) return 'activity';
      if (hash.includes('profile')) return 'profile';
      if (hash.includes('security')) return 'security';
      if (hash.includes('questionnaire')) return 'questionnaire';
    }
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

  // Ensure returning client is automatically routed to current active stage
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
      else if (pathname === '/portal/requests') setActiveNavId('requests');
      else if (pathname === '/portal/appointments') setActiveNavId('appointments');
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
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [helpModalOpen, setHelpModalOpen] = useState<boolean>(false);

  // Data for client search & requests
  const [invoices, setInvoices] = useState<any[]>([]);
  const [advisorRequests, setAdvisorRequests] = useState<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchPortalData = async () => {
      try {
        const token = getStoredToken();
        const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        const [invRes, reqRes] = await Promise.all([
          fetch(`/api/payments/invoices?clientId=${clientId}`, { headers }).catch(() => null),
          fetch(`/api/accounting/document-requests?clientId=${clientId}`, { headers }).catch(() => null)
        ]);
        if (isMounted) {
          if (invRes && invRes.ok) {
            const data = await invRes.json();
            if (Array.isArray(data.invoices)) setInvoices(data.invoices);
          }
          if (reqRes && reqRes.ok) {
            const data = await reqRes.json();
            if (Array.isArray(data.requests)) {
              setAdvisorRequests(data.requests.map((r: any) => ({
                id: r.id,
                date: r.requestedAt || new Date().toISOString(),
                title: r.subject || r.title || 'Information Request',
                description: r.description || r.reason || '',
                status: r.status === 'resolved' || r.status === 'answered' ? 'answered' : 'pending',
                dueDate: r.dueDate,
                assignedAdvisor: 'Elena Rostova, CPA'
              })));
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    };
    fetchPortalData();
    return () => { isMounted = false; };
  }, [clientId, selectedTaxYear]);

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

  // Determine stage status authoritatively from workflow persistence
  const getStageStatus = (stageNum: StageNumber): 'completed' | 'active' | 'locked' => {
    const activeStage = authority?.workflow?.activeStage ?? 2;
    if (stageNum === 1) {
      if (authority?.workflow?.stage1?.status === 'COMPLETED' || activeStage >= 2) {
        return 'completed';
      }
      return 'active';
    }
    if (stageNum < activeStage) return 'completed';
    if (stageNum === activeStage) return 'active';
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

  // Render Left Navigation Sidebar Content (Sections 4 & 6)
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

        {/* Navigation Modules (Sections 4, 6) */}
        <nav className="flex-1 p-2 space-y-3 overflow-y-auto" aria-label="TaxGuard Portal Navigation">
          {/* SECTION 1: OVERVIEW */}
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
              title={isCollapsed ? 'Client Dashboard' : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-left transition-colors rounded-lg cursor-pointer ${
                activeNavId === 'home'
                  ? 'bg-[#0A2544] text-[#E8C66A] border-l-4 border-l-[#C99A32] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#0A2544]/60 border-l-4 border-l-transparent'
              }`}
            >
              <LayoutDashboard className={`w-3.5 h-3.5 shrink-0 ${activeNavId === 'home' ? 'text-[#D7AC4A]' : 'text-slate-400'}`} />
              {!isCollapsed && <span className="truncate">Client Dashboard</span>}
            </button>
          </div>

          {/* SECTION 2: TAX RETURN (Simplified 7-Step Journey & Navigation) */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#D7AC4A] font-bold">
                <span>{viewDetailedWorkflow ? 'Workflow (18 Stages)' : 'Tax Return'}</span>
                <button
                  type="button"
                  onClick={() => setViewDetailedWorkflow((v) => !v)}
                  className="text-slate-400 hover:text-white text-[9px] lowercase font-normal underline cursor-pointer"
                >
                  {viewDetailedWorkflow ? 'show 7 steps' : 'view 18 stages'}
                </button>
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="Tax Return" />
            )}

            {!viewDetailedWorkflow ? (
              <div className="space-y-0.5">
                {/* 7 Simplified Client Steps */}
                {SIMPLIFIED_JOURNEY_STEPS.map((step) => {
                  const status = getSimplifiedStepStatus(step);
                  const isNavActive = step.stageNumbers.some(
                    (num) => activeNavId === `stage_${String(num).padStart(2, '0')}` || (num === 2 && (activeNavId === 'stage_02' || activeNavId === 'documents'))
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
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Sub-item: Tax Questionnaire */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectNav('questionnaire')}
                    className={`w-full flex items-center gap-2 px-2.5 py-1 text-xs text-left transition-all rounded-md cursor-pointer ${
                      activeNavId === 'questionnaire'
                        ? 'bg-[#0A2544] text-[#E8C66A] font-semibold border-l-4 border-l-[#C99A32]'
                        : 'text-slate-400 hover:text-white border-l-4 border-l-transparent'
                    }`}
                  >
                    <FileQuestion className="w-3.5 h-3.5 text-[#D4A843] shrink-0" />
                    {!isCollapsed && <span className="truncate text-[11px]">Questionnaire</span>}
                  </button>
                </div>
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
                    </div>
                  );
                })}

                {!isCollapsed && (
                  <div className="pt-1 px-2">
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

          {/* SECTION 3: COMMUNICATION */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Communication
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="Communication" />
            )}

            <div className="space-y-0.5">
              {[
                { id: 'requests', label: 'Requests', icon: AlertCircle, badge: advisorRequests.filter(r => r.status === 'pending').length },
                { id: 'messages', label: 'Messages', icon: MessageSquare },
                { id: 'appointments', label: 'Appointments', icon: Calendar }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNavId === item.id || (item.id === 'requests' && activeNavId === 'exceptions');
                return (
                  <button
                    key={item.id}
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
                    {!isCollapsed && (
                      <>
                        <span className="truncate text-[11px]">{item.label}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className="ml-auto px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40">
                            {item.badge}
                          </span>
                        ) : null}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: FINANCIAL */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Financial
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="Financial" />
            )}

            <button
              type="button"
              onClick={() => handleSelectNav('billing')}
              title={isCollapsed ? 'Payments / Billing' : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-left transition-colors rounded-lg cursor-pointer ${
                activeNavId === 'billing'
                  ? 'bg-[#0A2544] text-[#E8C66A] border-l-4 border-l-[#C99A32] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#0A2544]/60 border-l-4 border-l-transparent'
              }`}
            >
              <CreditCard className={`w-3.5 h-3.5 shrink-0 ${activeNavId === 'billing' ? 'text-[#D7AC4A]' : 'text-slate-400'}`} />
              {!isCollapsed && <span className="truncate text-[11px]">Payments / Billing</span>}
            </button>
          </div>

          {/* SECTION 5: RECORDS & CASE */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Case &amp; Compliance
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="Records" />
            )}

            <div className="space-y-0.5">
              {[
                { id: 'documents', label: 'My Records / Vault', icon: FolderLock },
                { id: 'archive', label: 'Tax-Year Archive', icon: Archive },
                { id: 'activity', label: 'Activity / Audit', icon: History }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNavId === item.id;
                return (
                  <button
                    key={item.id}
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
                );
              })}
            </div>
          </div>

          {/* SECTION 6: ACCOUNT & SECURITY */}
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
                { id: 'security', label: 'Security & Consents', icon: ShieldCheck },
                { id: 'settings', label: 'Settings', icon: Settings },
                { id: 'help', label: 'Help & Support', icon: HelpCircle }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeNavId === item.id;
                return (
                  <button
                    key={item.id}
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
                );
              })}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  title={isCollapsed ? 'Sign Out' : undefined}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:text-red-100 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0 text-red-400" />
                  {!isCollapsed && <span className="truncate text-[11px]">Sign Out</span>}
                </button>
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
    // 1. STAGE LOCKED BY TAXGUARD HARD GATE
    if (selectedLockedStage) {
      return (
        <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
          <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-400 shadow-inner">
              <Lock className="w-8 h-8 text-amber-400" />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono font-bold tracking-widest uppercase text-amber-400">
                STAGE LOCKED BY TAXGUARD HARD GATE
              </div>
              <h2 className="text-xl font-bold text-white">
                Stage {selectedLockedStage.shortLabel}: {selectedLockedStage.name} is Currently Locked
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
          onTaxYearChange={onTaxYearChange}
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
                Your statutory onboarding dossier and IRC § 7216 Consent status are recorded and locked.
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
    if (activeNavId === 'stage_02' || activeNavId === 'checklist') {
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

    // 5. DOCUMENTS MANAGEMENT (Context: Documents Vault)
    if (activeNavId === 'documents' || activeNavId === 'my_records') {
      return (
        <div className="space-y-4 max-w-7xl mx-auto py-6 px-4">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderLock className="w-5 h-5 text-[#D4A843]" />
                <span>Secure Document Management &amp; Vault</span>
              </h2>
              <p className="text-xs text-slate-400">
                Encrypted storage, document category routing, and SHA-256 tamper-evident integrity tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSelectNav('stage_02')}
              className="px-3 py-1.5 rounded-lg bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold"
            >
              Upload New Documents &rarr;
            </button>
          </div>

          <MyDocumentsClientVault
            clientId={clientId}
            selectedTaxYear={selectedTaxYear}
            onNavigateToUpload={() => handleSelectNav('stage_02')}
          />
        </div>
      );
    }

    // 6. QUESTIONNAIRE WORKSPACE
    if (activeNavId === 'questionnaire') {
      return (
        <div className="max-w-5xl mx-auto py-6 px-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileQuestion className="w-5 h-5 text-[#D4A843]" />
                <span>Comprehensive Tax Questionnaire &mdash; Tax Year {selectedTaxYear}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Update your household, income sources, deductions, and state facts to recompute requirements.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSelectNav('home')}
              className="text-xs text-slate-400 hover:text-white"
            >
              &larr; Back to Dashboard
            </button>
          </div>

          <div className="rounded-2xl bg-[#0D2745] border border-slate-700/80 p-6">
            <button
              type="button"
              onClick={() => setShowQuestionnaireModal(true)}
              className="w-full py-4 px-6 rounded-xl bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] font-bold text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Guided Tax Discovery Questionnaire</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      );
    }

    // 7. REQUESTS & EXCEPTIONS
    if (activeNavId === 'requests' || activeNavId === 'exceptions') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <RequestsView
            requests={advisorRequests}
            onRespond={(reqId, text) => {
              setAdvisorRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'answered' } : r));
            }}
          />
        </div>
      );
    }

    // 8. MESSAGES
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

    // 9. APPOINTMENTS
    if (activeNavId === 'appointments') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <div className="border-b border-[rgba(148,163,184,0.18)] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#D4A843]" />
              <span>Consultation Schedule &amp; Client Calendar</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Schedule live video consultations with your tax advisory team. External calendars fail-closed if unconfigured.
            </p>
          </div>

          <LiveCalendarModule
            embedded={true}
          />
        </div>
      );
    }

    // 10. BILLING & PAYMENTS
    if (activeNavId === 'billing') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <BillingView invoices={invoices} />
        </div>
      );
    }

    // 11. ARCHIVE & MULTI-YEAR RECORDS
    if (activeNavId === 'archive') {
      return (
        <StageSixteenArchiveView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageSeventeen={() => handleSelectNav('stage_17')}
        />
      );
    }

    // 12. ACTIVITY / AUDIT
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

    // 13. PROFILE
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

    // 14. SECURITY & CONSENTS
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

    // 15. SETTINGS
    if (activeNavId === 'settings') {
      return (
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
          <div className="rounded-2xl bg-[#0D2745] border border-slate-700/80 p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#D4A843]" />
              <span>Client Portal Settings &amp; Preferences</span>
            </h2>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#071A2E] border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Email Notifications</div>
                  <div className="text-[11px] text-slate-400">Receive alerts when documents are verified or requests issued</div>
                </div>
                <span className="text-emerald-400 font-bold">Enabled</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#071A2E] border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Two-Factor Authentication</div>
                  <div className="text-[11px] text-slate-400">SMS / Authenticator app login verification</div>
                </div>
                <span className="text-emerald-400 font-bold">Active</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#071A2E] border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Tax Year Scope</div>
                  <div className="text-[11px] text-slate-400">Default workspace tax year</div>
                </div>
                <span className="text-[#D4A843] font-mono font-bold">{selectedTaxYear}</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 16. HELP & SUPPORT
    if (activeNavId === 'help') {
      return (
        <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
          <div className="rounded-2xl bg-[#0D2745] border border-slate-700/80 p-6 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#D4A843]" />
              <span>TaxGuard Help &amp; Advisory Support</span>
            </h2>
            <p className="text-xs text-slate-300">
              Need assistance with document uploads, questionnaires, or clarification requests?
            </p>
            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-[#071A2E] border border-slate-800 space-y-1">
                <div className="font-bold text-white">A/R Tax Services, LLC</div>
                <div className="text-slate-300">Columbia, South Carolina, USA</div>
                <div className="text-slate-400">Direct Inquiries: info@artaxservices.com &bull; (843) 555-0199</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 17. STAGES 03 THROUGH 18
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
    if (activeNavId === 'stage_06' || activeNavId === 'review') {
      return (
        <StageSixReviewView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageSeven={() => handleSelectNav('stage_07')}
        />
      );
    }
    if (activeNavId === 'stage_07') {
      return (
        <StageSevenReportView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageEight={() => handleSelectNav('stage_08')}
        />
      );
    }
    if (activeNavId === 'stage_08') {
      return (
        <StageEightPlanView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }
    if (activeNavId === 'stage_09' || activeNavId === 'tax_prep') {
      return (
        <StageNinePrepareView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageTen={() => handleSelectNav('stage_10')}
        />
      );
    }
    if (activeNavId === 'stage_10' || activeNavId === 'approval') {
      return (
        <StageTenApproveView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onNavigateToStageEleven={() => handleSelectNav('stage_11')}
        />
      );
    }
    if (activeNavId === 'stage_11' || activeNavId === 'signature') {
      return (
        <StageElevenSignView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }
    if (activeNavId === 'stage_12' || activeNavId === 'filing') {
      return (
        <StageTwelveFileView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }
    if (activeNavId === 'stage_13') {
      return (
        <StageThirteenFeedbackView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }
    if (activeNavId === 'stage_14') {
      return (
        <StageFourteenResolveView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }
    if (activeNavId === 'stage_15' || activeNavId === 'completed') {
      return (
        <StageFifteenMonitorView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }
    if (activeNavId === 'stage_17') {
      return (
        <StageSeventeenRenewView
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
        />
      );
    }
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
      {/* 1. TOP BAR (Section 5: Header) */}
      {/* ========================================================================= */}
      <header className="h-14 bg-[#071A2E] border-b border-slate-700/60 px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-md">
        {/* Left: Mobile Toggle & Brand */}
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

        {/* Center: Global Authorized Client Search */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#06182B] border border-slate-700/60 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#D4A843]" />
            <span className="truncate">Search documents, messages, tax years...</span>
          </button>
        </div>

        {/* Right: Tax Year, Notifications, Search Icon (Mobile), Profile & Sign Out */}
        <div className="flex items-center gap-3">
          {/* Mobile search button */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-[#0D2745]"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Tax Year Selector (Multi-year 2022+) */}
          <div className="flex items-center gap-1.5 bg-[#06182B] border border-slate-700/60 px-2.5 py-1 rounded-lg">
            <Calendar className="w-3 h-3 text-[#D4A843]" />
            <select
              value={selectedTaxYear}
              onChange={(e) => onTaxYearChange?.(Number(e.target.value))}
              className="bg-transparent font-mono text-xs font-bold text-[#D4A843] cursor-pointer outline-none"
              aria-label="Select tax year"
            >
              <option value={2026} className="bg-[#071A2E] text-slate-200">TY 2026</option>
              <option value={2025} className="bg-[#071A2E] text-slate-200">TY 2025</option>
              <option value={2024} className="bg-[#071A2E] text-slate-200">TY 2024</option>
              <option value={2023} className="bg-[#071A2E] text-slate-200">TY 2023</option>
              <option value={2022} className="bg-[#071A2E] text-slate-200">TY 2022</option>
            </select>
          </div>

          {/* Notification Center */}
          <NotificationCenterDropdown onNavigateToTab={(tab) => handleSelectNav(tab)} />

          {/* Compliance Badge */}
          <div className="hidden xl:flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>IRC § 7216 Protected</span>
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

      {/* Client Search Modal */}
      <ClientSearchModal
        isOpen={searchModalOpen}
        clientId={clientId}
        currentTaxYear={selectedTaxYear}
        onClose={() => setSearchModalOpen(false)}
        onNavigateToResult={(target, yr) => {
          if (yr && yr !== selectedTaxYear) onTaxYearChange?.(yr);
          handleSelectNav(target);
        }}
      />

      {/* Guided Questionnaire Modal */}
      {showQuestionnaireModal && (
        <GuidedTaxQuestionnaireModal
          isOpen={showQuestionnaireModal}
          onClose={() => {
            setShowQuestionnaireModal(false);
            onServerWorkflowRefresh?.();
          }}
          clientId={clientId}
          selectedTaxYear={selectedTaxYear}
          onAnswersSaved={() => {
            setShowQuestionnaireModal(false);
            onServerWorkflowRefresh?.();
          }}
        />
      )}
    </div>
  );
};
export default AuthenticatedClientDashboard;
