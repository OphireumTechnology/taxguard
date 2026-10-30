import { ClientDashboardModule } from './dashboard/ClientDashboardModule';
import { TaxQuestionnaireModal } from '../collection/TaxQuestionnaireModal';
import { ClientDashboardOverview } from './dashboard/ClientDashboardOverview';
import { ClientDashboardNavigation } from './dashboard/ClientDashboardNavigation';
import { useClientDashboardData } from '../../hooks/useClientDashboardData';
import { scopedWorkflow, validClientScope } from './dashboard/clientDashboardModel';
import { DashboardApplicationShell } from '../layout/DashboardApplicationShell';
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
import { StageOneIdentityWizard } from './StageOneIdentityWizard';
import { TaxGuardDiscrepanciesView } from '../../taxguard/views/TaxGuardDiscrepanciesView';
import { ClientAuditUnavailable, recordedMfaSetting } from './views/ClientSecurityPanel';
import { ProfileSecurityView } from './views/ProfileSecurityView';
import { ClientProfileView } from './views/ClientProfileView';
import { ClientDocumentVaultPanel } from '../documents/ClientDocumentVaultPanel';
import {DurableClientCollectionWorkspace} from '../collection/DurableClientCollectionWorkspace';
import { ClientInvoicesPanel } from '../billing/ClientInvoicesPanel';
import { ClientDocumentRequestsPanel } from '../documents/ClientDocumentRequestsPanel';
import { ClientStatusSummary } from './ClientStatusSummary';
import { useLiveWorkflowAuthority } from '../../hooks/useLiveWorkflowAuthority';
import { ClientStageReadUnavailable, unavailableClientStage } from './views/stages/ClientStageReadUnavailable';
import { StageFourRecordView } from './views/stages/StageFourRecordView';
import { StageFiveReconcileView } from './views/stages/StageFiveReconcileView';
import { StageSixReviewView } from './views/stages/StageSixReviewView';
import { StageSevenReportView } from './views/stages/StageSevenReportView';
import { StageEightPlanView } from './views/stages/StageEightPlanView';
import { TaxStageStatusView } from './views/stages/TaxStageStatusView';
import { ClientCaseStageView } from './views/stages/ClientCaseStageView';
import { ClientConsultationHistoryPanel } from './dashboard/ClientConsultationHistoryPanel';
import { ClientSignaturePackagesPanel } from './dashboard/ClientSignaturePackagesPanel';
import { ClientNotificationsPanel } from './dashboard/ClientNotificationsPanel';
import { ClientNotificationPreferencesPanel } from './dashboard/ClientNotificationPreferencesPanel';
import { BLOCKED_STAGES } from '../../taxguard/stageCapabilities';
import { AppointmentsPanel } from '../appointments/AppointmentsPanel';
import { ClientSearchModal } from './dashboard/ClientSearchModal';
import { NotificationCenterDropdown } from './dashboard/NotificationCenterDropdown';
import { getStoredToken } from '../../services/api';
import { useClientPanelSession } from '../../hooks/useClientPanelSession';

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

/** Views that may be restored from the URL hash (#nav=<view>). Anything else is ignored. */
export const RESTORABLE_CLIENT_VIEWS = new Set(['home', 'tax_return', 'documents', 'questionnaire', 'requests', 'messages', 'notifications', 'appointments', 'billing', 'records',
  'advisor', 'legal', 'settings', 'profile', 'security', 'activity', 'help', 'exceptions', 'stage_01', 'stage_02',
  ...Array.from({ length: 16 }, (_, i) => 'stage_' + String(i + 3).padStart(2, '0'))]);
export function navFromHash(hash: string): string | null {
  const m = /^#nav=([a-z0-9_]{1,32})$/.exec(hash.toLowerCase());
  return m && RESTORABLE_CLIENT_VIEWS.has(m[1]) ? m[1] : null;
}

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
  const { currentUser, logout, notifications, authLifecycleState } = useApp();
  // Re-render dashboard reads too when storage or an in-tab session mutation changes the token.
  useClientPanelSession(clientId);
  const [dashboardRefresh, setDashboardRefresh] = useState(0);
  const dashboardData = useClientDashboardData(currentUser, authLifecycleState, clientId, selectedTaxYear, dashboardRefresh);
  const dashboardScope = { userId: currentUser?.id || "", tenantId: currentUser?.tenantId || "", clientId, taxYear: selectedTaxYear };

  // Authoritative workflow authority
  const hookAuthority = useLiveWorkflowAuthority(selectedTaxYear);
  const rawAuthority = propAuthority || hookAuthority;
  const verifiedWorkflow = scopedWorkflow(rawAuthority?.workflow, dashboardScope);
  const authority = verifiedWorkflow ? rawAuthority : null;

  // Active navigation selection with URL hash sync
  const [activeNavId, setActiveNavId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      // Exact view saved by handleSelectNav, so a refresh reopens the same view.
      const saved = navFromHash(hash);
      if (saved) return saved;
      if (pathname === '/portal/documents') return 'documents';
      if (pathname === '/portal/collection') return 'questionnaire';
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
    if (initialNav) {
      return initialNav;
    }
    return 'home';
  });

  // Sync activeNavId if initialNav prop changes and is not home
  useEffect(() => {
    if (initialNav && initialNav !== activeNavId && initialNav !== 'home') {
      setActiveNavId(initialNav);
    }
  }, [initialNav]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const anchor = window.location.hash.slice(1);
      if (anchor && document.getElementById(anchor)) return;
      const pathname = window.location.pathname.toLowerCase().replace(/\/+$/, '');
      const saved = navFromHash(window.location.hash);
      if (saved) { setActiveNavId(saved); setSelectedLockedStage(null); return; }
      if (pathname === '/portal/documents') setActiveNavId('documents');
      else if (pathname === '/portal/collection') setActiveNavId('questionnaire');
      else if (pathname === '/portal/requests') setActiveNavId('requests');
      else if (pathname === '/portal/appointments') setActiveNavId('appointments');
      else if (pathname === '/portal/profile') setActiveNavId('profile');
      else if (pathname === '/portal/dashboard') setActiveNavId('home');
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); window.removeEventListener('hashchange', handlePopState); };
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


  const getSimplifiedStepStatus = (step: SimplifiedJourneyStep): 'completed' | 'active' | 'locked' => {
    const activeStage = authority?.workflow?.activeStage;
    if (!activeStage) return "locked";
    if (step.stageNumbers.every((n) => n < activeStage)) return 'completed';
    if (step.stageNumbers.includes(activeStage as StageNumber)) return 'active';
    return 'locked';
  };

  const handleSimplifiedStepClick = (step: SimplifiedJourneyStep) => {
    const activeStage = authority?.workflow?.activeStage;
    if (!activeStage) return "locked";
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

  const clientName = currentUser?.name || "Client";

  // Determine stage status authoritatively from workflow persistence
  const getStageStatus = (stageNum: StageNumber): 'completed' | 'active' | 'locked' => {
    const activeStage = authority?.workflow?.activeStage;
    if (!activeStage) return "locked";
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
    // One history entry per view, so browser Back / Forward move between portal views.
    if (typeof window !== 'undefined' && navFromHash('#nav=' + navId) && window.location.hash.toLowerCase() !== '#nav=' + navId) {
      window.history.pushState(window.history.state, '', window.location.pathname + window.location.search + '#nav=' + navId);
    }
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
    if (status === 'locked' && !unavailableClientStage(`stage_${stg.shortLabel}`)) {
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

  // Primary client navigation; advanced workflow retains existing hard gates.
  const renderSidebarContent = (isMobile = false) => (
    <ClientDashboardNavigation
      active={activeNavId}
      collapsed={!isMobile && sidebarCollapsed}
      onToggle={isMobile ? undefined : toggleSidebar}
      onNavigate={handleSelectNav}
      detailedWorkflow={WORKFLOW_STAGES.map(stage => { const status = BLOCKED_STAGES.includes(stage.number) ? 'not available' : getStageStatus(stage.number); return <button type="button" key={stage.number} onClick={() => handleStageClick(stage)} aria-label={'Stage ' + stage.shortLabel + ' ' + stage.name + ': ' + status}>{stage.shortLabel} {stage.name} · {status}</button>; })}
    />
  );

  // Main Workspace Content based on context isolation
  const renderMainWorkspace = () => {
    // Stages 04-08 read the practice's durable case (contract C3), which reports locked stages itself.
    if (activeNavId.startsWith("stage_") && !BLOCKED_STAGES.includes(Number(activeNavId.slice(6))) && !unavailableClientStage(activeNavId) && getStageStatus(Number(activeNavId.slice(6)) as StageNumber) === "locked" && !selectedLockedStage) return <div className="p-6" role="status">This stage is not available in the verified client tax-year workflow.</div>;
    if (["tax_return", "messages", "legal", "advisor", "requests", "exceptions", "billing", "records", "archive"].includes(activeNavId)) return <ClientDashboardModule key={clientId + ":" + selectedTaxYear + ":" + activeNavId} module={activeNavId === "exceptions" ? "requests" : activeNavId === "archive" ? "records" : activeNavId} user={currentUser!} data={dashboardData} taxYear={selectedTaxYear} onRefresh={() => setDashboardRefresh(value => value + 1)} onBack={() => handleSelectNav("home")} onSelectYear={year => { onTaxYearChange?.(year); handleSelectNav("documents"); }} />;

    // 1. LOCKED STAGE: canonical explanation for blocked stages; otherwise the real active stage.
    if (selectedLockedStage) {
      if (BLOCKED_STAGES.includes(selectedLockedStage.number)) {
        return <TaxStageStatusView key={'locked:' + selectedLockedStage.number} stage={selectedLockedStage.number} selectedTaxYear={selectedTaxYear} onNavigate={target => handleSelectNav(target)} />;
      }
      const activeStage = authority?.workflow?.activeStage as number | undefined;
      const active = WORKFLOW_STAGES.find(s => s.number === activeStage);
      return (
        <section aria-labelledby="locked-stage-heading" className="max-w-3xl mx-auto py-8 px-4">
          <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 space-y-4 text-sm text-slate-200">
            <Lock aria-hidden="true" className="w-8 h-8 text-amber-400" />
            <h2 id="locked-stage-heading" className="text-xl font-bold text-white">Stage {selectedLockedStage.shortLabel}: {selectedLockedStage.name} is not available yet</h2>
            <p role="status">{active
              ? <>Your workflow is at Stage {active.shortLabel} ({active.name}). Stages open one at a time after the current stage is completed and confirmed.</>
              : <>Your tax-year workflow status has not been reported by the server, so no stage can be opened. Refresh, or contact your advisor.</>}</p>
            {active && (
              <button type="button" onClick={() => handleSelectNav(active.number === 1 ? 'stage_01' : active.number === 2 ? 'stage_02' : 'stage_' + active.shortLabel)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#071A2E] bg-[#D4A843] hover:bg-[#E1BB60] inline-flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                <span>Go to Stage {active.shortLabel} ({active.name})</span>
                <ArrowRight aria-hidden="true" className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>
      );
    }

    // 2. CLIENT DASHBOARD HOME (Overview & Action-Oriented Step-by-Step Experience)
    if (activeNavId === 'home') {
      return (
        <ClientDashboardOverview
          key={clientId + ":" + selectedTaxYear}
          user={currentUser!}
          scope={dashboardScope}
          data={dashboardData}
          workflow={verifiedWorkflow}
          onNavigate={(target) => target === "questionnaire" ? setShowQuestionnaireModal(true) : handleSelectNav(target)}
          onRefresh={() => { setDashboardRefresh(value => value + 1); onServerWorkflowRefresh?.(); }}
          onSelectYear={year => onTaxYearChange?.(year)}
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
{getStageStatus(1) === 'completed'
                  ? <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded">✓ Completed</span>
                  : <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/40 rounded">In progress</span>}
                <span className="text-xs text-slate-400 font-mono">Stage 01 of 18</span>
              </div>
              <h2 className="text-lg font-bold text-white">Stage 01 (Onboard) Dossier &mdash; Read-Only Review</h2>
              <p className="text-xs text-slate-300">
                {getStageStatus(1) === 'completed' ? 'Your onboarding details and consent status are recorded.' : 'Onboarding is not complete yet.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {getStageStatus(1) === 'completed' && <button
                type="button"
                onClick={() => handleSelectNav('stage_02')}
                className="px-4 py-2 rounded-lg text-xs font-bold text-[#071A2E] bg-[#D4A843] hover:bg-[#E1BB60] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Continue to Stage 02</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>}
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
    if (activeNavId === 'stage_02' || activeNavId === 'checklist' || activeNavId === 'upload') {
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

          {/* Durable Stage 02 collection (proposals 053/054 and the vault): server-recorded drafts,
              requirements, applicability claims, practice requests and uploads. The former browser-local
              workspace (localStorage records) is no longer shown to clients. */}
          <DurableClientCollectionWorkspace clientId={clientId} taxYear={selectedTaxYear} />
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

          <ClientStatusSummary clientId={clientId} />
          <ClientDocumentRequestsPanel clientId={clientId} />
          <ClientDocumentVaultPanel clientId={clientId} />
          <ClientInvoicesPanel clientId={clientId} />
          {/* The legacy in-memory document list (/api/documents) is no longer shown: the durable vault above is authoritative. */}
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
          <DurableClientCollectionWorkspace clientId={clientId} taxYear={selectedTaxYear}/>
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
              Request appointments with your advisory team and see confirmed meeting details. Times are shown in each appointment's time zone.
            </p>
          </div>

          <AppointmentsPanel mode={{ kind: "client", clientId }} />
          <ClientConsultationHistoryPanel clientId={clientId} />
        </div>
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
              Availability of authorized recorded client audit events.
            </p>
          </div>

          <ClientAuditUnavailable />
        </div>
      );
    }

    // 13. PROFILE
    if (activeNavId === 'profile') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <ClientProfileView
            currentUser={currentUser}
            authLifecycleState={authLifecycleState}
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

          <ProfileSecurityView currentUser={currentUser} authLifecycleState={authLifecycleState} initialTab="privacy_consent" />
        </div>
      );
    }

    // 15. SETTINGS
    if (activeNavId === 'notifications') {
      return <><ClientNotificationsPanel key={clientId} clientId={clientId} onOpenRequests={() => handleSelectNav('documents')} /><ClientNotificationPreferencesPanel key={'prefs-' + clientId} clientId={clientId} /></>;
    }

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
                  <div className="font-semibold text-white">Notifications</div>
                  <div className="text-[11px] text-slate-400">Practice notices appear under Notifications in this portal. E-mail and text delivery are not offered.</div>
                </div>
                <button type="button" onClick={() => handleSelectNav('notifications')} className="text-[#D4A843] font-bold underline">Open notifications</button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#071A2E] border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Two-Factor Authentication</div>
                  <div className="text-[11px] text-slate-400">SMS / Authenticator app login verification</div>
                </div>
                <span className="text-slate-300 font-bold">{recordedMfaSetting(currentUser)}</span>
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
                <div className="text-slate-400">Direct Inquiries: <a href="mailto:info@artaxservices.com">info@artaxservices.com</a> &bull; <a href="tel:678-205-9486">678-205-9486</a></div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Stages 04-08: the server's recorded case state for the engagement year (contract C3).
    if (unavailableClientStage(activeNavId)) {
      const stage = unavailableClientStage(activeNavId)!.number;
      return <ClientCaseStageView key={clientId + ':' + selectedTaxYear + ':' + stage} clientId={clientId} stage={stage} taxYear={selectedTaxYear} onNavigate={target => handleSelectNav(target)} />;
    }

    // 17. STAGES 03 THROUGH 18
    if (activeNavId === 'stage_03') {
      return (
        // Stage 03 validation is performed and attested by practice staff; the client answers
        // clarification requests in the durable Stage 02 collection workspace.
        <TaxStageStatusView stage={3} selectedTaxYear={selectedTaxYear} workflowStatus={getStageStatus(3)} onNavigate={target => handleSelectNav(target === 'documents' ? 'stage_02' : target)} />
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
    // Stages 09-18: one truthful view driven by the canonical stage capabilities (server policy 026).
    // No figures, signatures, filing or acknowledgements are shown; blocked stages explain why.
    const STAGE_ALIASES: Record<string, number> = { tax_prep: 9, approval: 10, signature: 11, filing: 12, completed: 15 };
    const lateStage = STAGE_ALIASES[activeNavId] ?? (/^stage_(09|1[0-8])$/.test(activeNavId) ? Number(activeNavId.slice(6)) : 0);
    if (lateStage) {
      const view = (
        <TaxStageStatusView
          key={clientId + ':' + selectedTaxYear + ':' + lateStage}
          stage={lateStage}
          selectedTaxYear={selectedTaxYear}
          workflowStatus={getStageStatus(lateStage as StageNumber)}
          onNavigate={target => handleSelectNav(target)}
        />
      );
      // Stage 11: the server's record of a return released to this client for signature (status only).
      return lateStage === 11 ? <div className="space-y-4">{view}<ClientSignaturePackagesPanel clientId={clientId} taxYear={selectedTaxYear} /></div> : view;
    }

    // Default Fallback: Client Dashboard Home
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Select a module from the left navigation.</p>
      </div>
    );
  };

  if (!validClientScope(currentUser, clientId, selectedTaxYear, authLifecycleState)) {
    return <div role="status" className="p-6">An authorized client session and matching tax-year context are required.</div>;
  }

  return (
    <DashboardApplicationShell
      workspace="client"
      id="authenticated-client-dashboard"
      title="Client Tax Center"
      navigation={renderSidebarContent(false)}
      mobileNavigation={renderSidebarContent(true)}
      navigationCollapsed={sidebarCollapsed}
      mobileOpen={mobileDrawerOpen}
      onMobileOpenChange={setMobileDrawerOpen}
      onSearch={() => setSearchModalOpen(true)}
      onProfile={() => handleSelectNav("profile")}
      notifications={<NotificationCenterDropdown notifications={notifications.map(notification => ({ ...notification, targetNav: "updates" }))} onNavigateToTab={() => handleSelectNav("home")} />}
      headerTools={(<div className="flex items-center gap-1.5 bg-[#06182B] border border-slate-700/60 px-2.5 py-1 rounded-lg">
            <Calendar className="w-3 h-3 text-[#D4A843]" />
            <select
              value={selectedTaxYear}
              onChange={(e) => onTaxYearChange?.(Number(e.target.value))}
              className="bg-transparent font-mono text-xs font-bold text-[#D4A843] cursor-pointer outline-none"
              aria-label="Select tax year"
            >
              {Array.from(new Set([selectedTaxYear, ...(dashboardData.documents.data || []).map(doc => doc.taxYear), ...(dashboardData.engagements.data || []).map(record => record.taxYear)])).sort((a, b) => b - a).map(year => <option key={year} value={year} className="bg-[#071A2E] text-slate-200">TY {year}</option>)}
            </select>
          </div>)}
    >
      <main className="flex-1 overflow-y-auto bg-[#06182B]" id="main-workspace-content">
        {renderMainWorkspace()}
      </main>
      {/* Client Search Modal */}
      <ClientSearchModal
        isOpen={searchModalOpen}
        clientId={clientId}
        currentTaxYear={selectedTaxYear}
        key={clientId + ":" + selectedTaxYear}
        availableYears={Array.from(new Set([...(dashboardData.documents.data || []).map(doc => doc.taxYear), ...(dashboardData.engagements.data || []).map(record => record.taxYear)]))}
        availableDocuments={(dashboardData.documents.data || []).filter(doc => doc.taxYear === selectedTaxYear).map(doc => ({ id: doc.id, name: doc.fileName, category: doc.category, taxYear: doc.taxYear }))}
        availableRequests={(dashboardData.requests.data || []).map(request => ({ id: request.id, subject: request.title || request.subject || "Information Request", status: request.status, taxYear: request.taxYear }))}
        availableMessages={(dashboardData.messages.data || []).map(message => ({ id: message.id, content: message.content, sender: message.senderName, timestamp: message.createdAt || message.timestamp || "" }))}
        onClose={() => setSearchModalOpen(false)}
        onNavigateToResult={(target, yr) => {
          if (yr && yr !== selectedTaxYear) onTaxYearChange?.(yr);
          handleSelectNav(target);
        }}
      />

      {/* Guided Questionnaire Modal */}
      {showQuestionnaireModal && (
        <TaxQuestionnaireModal
          key={clientId + ':' + selectedTaxYear}
          isOpen={showQuestionnaireModal}
          onClose={() => {
            setShowQuestionnaireModal(false);
            setDashboardRefresh(value => value + 1);
            onServerWorkflowRefresh?.();
          }}
          clientId={clientId}
          taxYear={selectedTaxYear}
          onSaved={() => {
            setShowQuestionnaireModal(false);
            setDashboardRefresh(value => value + 1);
            onServerWorkflowRefresh?.();
          }}
        />
      )}
    </DashboardApplicationShell>
  );
};
export default AuthenticatedClientDashboard;
