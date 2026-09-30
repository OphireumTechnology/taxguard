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
  Bell
} from 'lucide-react';
import { StageOneOnboardingService } from '../../services/stageOneOnboardingService';
import { useApp } from '../../context/AppContext';
import { CANONICAL_STAGE_LABELS, StageNumber } from '../../server/taxguard/persistence.types';
import { StageTwoCollectionWorkspace } from '../collection/StageTwoCollectionWorkspace';
import { StageOneIdentityWizard } from './StageOneIdentityWizard';
import { TaxGuardDiscrepanciesView } from '../../taxguard/views/TaxGuardDiscrepanciesView';
import { MessagesView } from './views/MessagesView';
import { AuditActivityView } from './views/AuditActivityView';
import { ProfileSecurityView } from './views/ProfileSecurityView';
import { useLiveWorkflowAuthority } from '../../hooks/useLiveWorkflowAuthority';

interface WorkflowStageItem {
  number: StageNumber;
  shortLabel: string;
  name: string;
}

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
    return initialNav;
  });

  // Collapsible sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('taxguard_client_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [selectedLockedStage, setSelectedLockedStage] = useState<WorkflowStageItem | null>(null);

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
    'Michael James Carter';
  const taxpayerType = dossier?.taxpayerType === 'entity' ? 'Entity / Business' : 'Individual / Family';
  const signerName =
    dossier?.engagementConsent?.signerFullName ||
    dossier?.authorizedRep?.fullName ||
    currentUser?.name ||
    'Michael James Carter';

  // Determine stage status authoritatively from workflow persistence
  const getStageStatus = (stageNum: StageNumber): 'completed' | 'active' | 'locked' => {
    const activeStage = authority?.workflow?.activeStage ?? 2;

    if (stageNum === 1) {
      // Stage 01 is completed if server says completed or active stage > 1
      if (authority?.workflow?.stage1?.status === 'COMPLETED' || activeStage >= 2) {
        return 'completed';
      }
      return 'active';
    }

    if (stageNum === 2) {
      if (authority?.workflow?.stage2?.status === 'COMPLETED' || activeStage > 2) {
        return 'completed';
      }
      const stage2Eligible = authority?.eligibility?.eligibility?.stage2 ?? true;
      if (activeStage === 2 && stage2Eligible) {
        return 'active';
      }
      return 'locked';
    }

    if (stageNum === 3) {
      if (authority?.workflow?.stage3?.status === 'COMPLETED' || activeStage > 3) {
        return 'completed';
      }
      const stage3Eligible = authority?.eligibility?.eligibility?.stage3 === true;
      if (activeStage === 3 && stage3Eligible) {
        return 'active';
      }
      return 'locked';
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
    if (typeof window !== 'undefined') {
      window.location.hash = '#/client_login';
    }
  };

  // Render Left Navigation Sidebar Content
  const renderSidebarContent = (isMobile: boolean = false) => {
    const isCollapsed = !isMobile && sidebarCollapsed;

    return (
      <div className="flex flex-col h-full bg-[#031323] text-slate-200 border-r border-[#1A365D] select-none">
        {/* Brand & Client Workspace Header */}
        <div className="p-4 border-b border-[#1A365D] flex items-center justify-between bg-[#020D1A]">
          {!isCollapsed ? (
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#D7AC4A] font-bold">
                A/R Tax Services, LLC
              </div>
              <div className="text-sm font-bold text-white truncate flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-4 h-4 text-[#D7AC4A] shrink-0" />
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

          {/* Section 2: WORKFLOW (18 Stages) */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#D7AC4A] font-bold">
                <span>Workflow (18 Stages)</span>
                <span className="text-slate-400 text-[9px] lowercase font-normal">gate verified</span>
              </div>
            ) : (
              <div className="h-px bg-[#1A365D] my-1" title="18 Stages Workflow" />
            )}

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
                      {/* Left icon / status bullet */}
                      {status === 'completed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : status === 'active' ? (
                        <span className="w-2 h-2 rounded-full bg-[#E2BD67] animate-pulse shrink-0 ring-2 ring-[#C6A15B]/50" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}

                      {/* Expanded text */}
                      {!isCollapsed ? (
                        <>
                          <span className="font-mono text-[11px] text-slate-400 shrink-0">{stg.shortLabel}</span>
                          <span className="truncate text-[11px]">{stg.name}</span>
                          <span className="ml-auto text-[10px] font-mono shrink-0">
                            {status === 'completed' && <span className="text-emerald-400 font-bold">✓</span>}
                            {status === 'active' && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#C6A15B]/20 text-[#E2BD67] border border-[#C6A15B]/40 font-bold">
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

                    {/* Collapsed Tooltip */}
                    {isCollapsed && (
                      <div className="hidden group-hover:flex absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1 bg-[#020D1A] text-white text-[11px] font-medium rounded-md shadow-2xl border border-[#1A365D] z-50 whitespace-nowrap pointer-events-none items-center gap-1.5">
                        <span className="font-mono font-bold text-[#D7AC4A]">{stg.shortLabel}</span>
                        <span>{stg.name}</span>
                        <span className={`text-[10px] uppercase font-mono px-1 rounded ${
                          status === 'completed' ? 'bg-emerald-950 text-emerald-300' : status === 'active' ? 'bg-blue-950 text-blue-300' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {status}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
          <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] p-8 shadow-2xl text-center space-y-5">
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

            <div className="p-4 bg-[#07172B] border border-[#1E3A5F] rounded-xl text-left max-w-lg mx-auto text-xs text-slate-300 space-y-2 font-mono">
              <div className="text-[#C6A15B] font-bold uppercase tracking-wider text-[10px]">Authoritative Hard Gate Policy</div>
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
                className="px-6 py-3 rounded-xl text-sm font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all inline-flex items-center gap-2 shadow-xl cursor-pointer"
              >
                <span>Go to Active Stage 02 (Collect) Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 2. CLIENT DASHBOARD HOME (Overview & Essential Case Info)
    if (activeNavId === 'home') {
      return (
        <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
          {/* Header Case Information */}
          <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#C6A15B]/20 text-[#C6A15B] border border-[#C6A15B]/40">
                  TAXGUARD CLIENT DASHBOARD
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-900/40 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span>ACTIVE FILING CYCLE</span>
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <Building2 className="w-6 h-6 text-[#C6A15B]" />
                <span>{clientName}</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Client ID: <strong className="text-slate-200">{clientId}</strong> &bull; Tax Year: <strong className="text-[#E2BD67]">{selectedTaxYear}</strong> &bull; Filing Profile: <strong className="text-slate-200">{taxpayerType}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-[#07172B] border border-[#1E3A5F] px-4 py-2.5 rounded-xl text-right">
                <div className="text-[10px] font-mono uppercase text-slate-400">Statutory Consent</div>
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 justify-end mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>IRC § 7216 Certified</span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Focused Case Status Card */}
          <div className="rounded-2xl bg-gradient-to-br from-[#0B2545] via-[#0D2E57] to-[#081B33] border-2 border-blue-500/40 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-blue-400/20 pb-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#C6A15B] font-bold">
                  Current Stage
                </div>
                <div className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-0.5">
                  <span>02 — Collect</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-900/70 text-blue-200 border border-blue-400/40">
                    IN PROGRESS
                  </span>
                </div>
              </div>

              <div className="text-left md:text-right">
                <div className="text-[10px] font-mono uppercase text-slate-400">Overall Workflow Progress</div>
                <div className="text-sm font-bold text-slate-200 mt-0.5 flex items-center md:justify-end gap-2">
                  <span>Stage 2 of 18 (1 Completed)</span>
                  <span className="text-xs font-mono text-[#E2BD67]">5.5%</span>
                </div>
                {/* Progress bar */}
                <div className="w-48 h-2 bg-[#07172B] rounded-full overflow-hidden border border-[#1E3A5F] mt-1.5">
                  <div className="h-full bg-gradient-to-r from-emerald-500 via-[#C6A15B] to-blue-500" style={{ width: '5.5%' }} />
                </div>
              </div>
            </div>

            {/* Next Required Action & Blocking Items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#07172B]/80 border border-[#1E3A5F] p-4 rounded-xl space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-[#C6A15B] font-bold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#C6A15B]" />
                  <span>Next Required Action</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  Complete required document collection.
                </div>
                <p className="text-xs text-slate-300">
                  Upload all required tax documents, W-2s, 1099s, and prior-year workpapers into the secure encrypted vault.
                </p>
              </div>

              <div className="bg-[#07172B]/80 border border-[#1E3A5F] p-4 rounded-xl space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-amber-400 font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hard Gate Pre-Condition</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  Stage 03 Validate Gate Locked
                </div>
                <p className="text-xs text-slate-300">
                  All mandatory intake checklist items and identity proofs must pass automated checksums before Stage 03 unlocks.
                </p>
              </div>
            </div>

            {/* Single Primary Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-slate-300 font-mono">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Stage 01 Passed
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1 text-blue-300">
                  <FolderLock className="w-3.5 h-3.5" />
                  Vault Ready
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleSelectNav('stage_02')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl cursor-pointer"
              >
                <span>Continue Stage 02</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Support & Practice Team Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#0D2340] border border-[#1E3A5F] p-4 space-y-2">
              <div className="text-[10px] font-mono uppercase text-[#C6A15B] font-bold">Assigned Practice Reviewer</div>
              <div className="text-sm font-bold text-white">Elena Rostova, CPA</div>
              <div className="text-xs text-slate-400">
                Senior Preparer &amp; Reviewer &bull; A/R Tax Services, LLC (Columbia, SC)
              </div>
            </div>

            <div className="rounded-xl bg-[#0D2340] border border-[#1E3A5F] p-4 space-y-2">
              <div className="text-[10px] font-mono uppercase text-[#C6A15B] font-bold">Client Support &amp; Governance</div>
              <div className="text-sm font-bold text-white">Desmond Hinds, Founder &amp; CEO</div>
              <div className="text-xs text-slate-400">
                NIST AI RMF 1.0 Aligned &bull; IRC § 7216 &amp; Circular 230 Protected
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. STAGE 01 ONBOARD (Read / Review Mode)
    if (activeNavId === 'stage_01') {
      return (
        <div className="space-y-4">
          <div className="max-w-7xl mx-auto px-4 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0D2340] border border-[#1E3A5F] p-4 rounded-xl">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded">
                  ✓ COMPLETED &bull; HARD EXIT GATE PASSED
                </span>
                <span className="text-xs text-slate-400 font-mono">Stage 01 of 18</span>
              </div>
              <h2 className="text-lg font-bold text-white">Stage 01 (Onboard) Dossier &mdash; Read-Only Review</h2>
              <p className="text-xs text-slate-300">
                Your statutory onboarding dossier and IRC § 7216 consent are authoritatively certified and locked.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectNav('stage_02')}
                className="px-4 py-2 rounded-lg text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-colors flex items-center gap-1.5 cursor-pointer"
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
              <span className="text-xs font-mono font-bold text-white bg-[#0D2340] border border-[#1E3A5F] px-3 py-1 rounded-md">
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
                <FolderLock className="w-5 h-5 text-[#C6A15B]" />
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
          <div className="border-b border-[#1E3A5F] pb-4">
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
          <div className="border-b border-[#1E3A5F] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#C6A15B]" />
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
          <div className="border-b border-[#1E3A5F] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-[#C6A15B]" />
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

    // 9. PROFILE (Context: Profile)
    if (activeNavId === 'profile') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <div className="border-b border-[#1E3A5F] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-[#C6A15B]" />
              <span>Taxpayer Profile &amp; Organizational Structure</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Verified legal name, authorized representative designations, and tax contact records.
            </p>
          </div>

          <ProfileSecurityView currentUser={currentUser} initialTab="taxpayer_profile" />
        </div>
      );
    }

    // 10. SECURITY & CONSENTS (Context: Security)
    if (activeNavId === 'security') {
      return (
        <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
          <div className="border-b border-[#1E3A5F] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Security, Credentials &amp; Statutory Consents</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              IRC § 7216 confidentiality agreements, session monitoring, and data encryption policies.
            </p>
          </div>

          <ProfileSecurityView currentUser={currentUser} initialTab="statutory_consent" />
        </div>
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
    <div className="min-h-screen bg-[#07172B] text-slate-100 flex flex-col font-sans" id="authenticated-client-dashboard">
      {/* ========================================================================= */}
      {/* 1. TOP BAR */}
      {/* ========================================================================= */}
      <header className="h-14 bg-[#031323] border-b border-[#1A365D] px-4 flex items-center justify-between shrink-0 sticky top-0 z-30 shadow-md">
        {/* Left: Mobile Toggle & Brand / Active Context */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden p-1.5 rounded-lg border border-[#1A365D] hover:bg-[#0A2544] text-slate-300"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
              A/R Tax Services
            </span>
            <span className="text-slate-500 hidden sm:inline">&bull;</span>
            <span className="text-xs text-[#C6A15B] font-mono font-semibold">
              TaxGuard Client Portal
            </span>
          </div>
        </div>

        {/* Right: Client ID, Tax Year, Compliance Badge, Profile & Sign Out */}
        <div className="flex items-center gap-3">
          {/* Tax Year Selector */}
          <div className="flex items-center gap-1.5 bg-[#07172B] border border-[#1A365D] px-2.5 py-1 rounded-lg">
            <Calendar className="w-3 h-3 text-[#C6A15B]" />
            <select
              value={selectedTaxYear}
              onChange={(e) => onTaxYearChange?.(Number(e.target.value))}
              className="bg-transparent font-mono text-xs font-bold text-[#E2BD67] cursor-pointer outline-none"
              aria-label="Select tax year"
            >
              <option value={2026} className="bg-[#031323] text-slate-200">TY 2026 (Planning)</option>
              <option value={2025} className="bg-[#031323] text-slate-200">TY 2025 (Active Filing)</option>
              <option value={2024} className="bg-[#031323] text-slate-200">TY 2024 (Prior Year)</option>
            </select>
          </div>

          {/* Compliance Badge */}
          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>IRC § 7216 Certified</span>
          </div>

          {/* User & Sign Out */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#1A365D]">
            <button
              type="button"
              onClick={() => handleSelectNav('profile')}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-2 py-1 rounded-lg hover:bg-[#0A2544] transition-colors cursor-pointer"
              title="View Profile"
            >
              <User className="w-3.5 h-3.5 text-[#C6A15B]" />
              <span className="hidden sm:inline font-medium truncate max-w-[120px]">{clientName}</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-[#0A2544] transition-colors cursor-pointer"
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
        <main className="flex-1 overflow-y-auto bg-[#07172B]" id="main-workspace-content">
          {renderMainWorkspace()}
        </main>
      </div>
    </div>
  );
};
