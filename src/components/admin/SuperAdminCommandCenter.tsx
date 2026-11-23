/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Secure Super Administrator Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  RefreshCw,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  X
} from 'lucide-react';
import { useApp, type PageRoute } from '../../context/AppContext';
import { api } from '../../services/api';
import {
  DASHBOARD_DIRECTORY,
  type DashboardDirectoryEntry,
  findDashboard
} from '../../config/superAdminDashboards';
import { useAdminProviderReadiness } from '../../hooks/useAdminProviderReadiness';
import { DashboardInspectionProvider, canInspectDashboards } from '../layout/dashboardInspection';
import { BrandLogo } from '../common/BrandLogo';
import { PageLoadingFallback } from '../common/PageLoadingFallback';
import { AdminAccessDeniedView } from './AdminAccessDeniedView';
import { StaffAccessManagementPanel } from './StaffAccessManagementPanel';
import { StaffSessionsPanel } from './StaffSessionsPanel';
import { AuditCenterPanel } from './AuditCenterPanel';
import { AdminOperationalPanel } from './AdminOperationalPanel';
import { AdminJobQueuePanel } from './AdminJobQueuePanel';
import { AdminWorkloadPanel } from './AdminWorkloadPanel';

const AiControlCenterPanel = lazy(() =>
  import('./AiControlCenterPanel').then((m) => ({ default: m.AiControlCenterPanel }))
);
const AiEmergencyStopPanel = lazy(() =>
  import('./AiEmergencyStopPanel').then((m) => ({ default: m.AiEmergencyStopPanel }))
);
const AccountantWorkspace = lazy(() =>
  import('../workspace/AccountantWorkspace').then((m) => ({ default: m.AccountantWorkspace }))
);
const ReviewerWorkspace = lazy(() =>
  import('../workspace/ReviewerWorkspace').then((m) => ({ default: m.ReviewerWorkspace }))
);
const BookkeeperDashboard = lazy(() =>
  import('../workspace/BookkeeperDashboard').then((m) => ({ default: m.BookkeeperDashboard }))
);
const PracticeManagerDashboard = lazy(() =>
  import('../workspace/PracticeManagerDashboard').then((m) => ({ default: m.PracticeManagerDashboard }))
);
const ClientServiceDashboard = lazy(() =>
  import('../workspace/ClientServiceDashboard').then((m) => ({ default: m.ClientServiceDashboard }))
);

export type AdminModuleId =
  | 'overview'
  | 'users'
  | 'security'
  | 'compliance'
  | 'ai_control'
  | 'settings'
  | 'audit'
  | 'readiness';

interface AdminModuleDef {
  id: AdminModuleId;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  route?: PageRoute;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_COMMAND_MODULES: readonly AdminModuleDef[] = [
  {
    id: 'overview',
    code: '01',
    label: 'Executive Overview',
    shortLabel: 'Overview',
    description: 'Server-verified system posture, session policy, and role dashboard inspection.',
    route: 'admin_command_center',
    icon: LayoutDashboard
  },
  {
    id: 'users',
    code: '02',
    label: 'Staff & Access Management',
    shortLabel: 'Staff & Access',
    description: 'Authoritative tenant staff directory, single-use invitations, and maker-checker approvals.',
    route: 'admin_users',
    icon: Users
  },
  {
    id: 'security',
    code: '03',
    label: 'Security Command Center',
    shortLabel: 'Security',
    description: 'Active durable sessions, MFA assurance monitoring, and security event telemetry.',
    route: 'admin_security',
    icon: ShieldCheck
  },
  {
    id: 'compliance',
    code: '04',
    label: 'Compliance Administration',
    shortLabel: 'Compliance',
    description: 'Retention policies, caseload governance, and least-privilege taxpayer isolation.',
    icon: ClipboardCheck
  },
  {
    id: 'ai_control',
    code: '05',
    label: 'AI Workforce Governance',
    shortLabel: 'AI Governance',
    description: '61-agent matrix (A00–A60), commissioning controls, and server-enforced emergency stop.',
    route: 'admin_ai_control',
    icon: Cpu
  },
  {
    id: 'settings',
    code: '06',
    label: 'System Configuration',
    shortLabel: 'Configuration',
    description: 'Approved tenant security configuration and step-up authorization governance.',
    route: 'admin_settings',
    icon: Settings
  },
  {
    id: 'audit',
    code: '07',
    label: 'Audit & Accountability',
    shortLabel: 'Audit Logs',
    description: 'Read-only, immutable tenant-scoped administrative and security audit records.',
    route: 'admin_audit',
    icon: FileCheck2
  },
  {
    id: 'readiness',
    code: '08',
    label: 'Deployment & Integration Readiness',
    shortLabel: 'Readiness',
    description: 'Factual provider configuration, health status, and durable job queue diagnostics.',
    icon: Server
  }
] as const;

const LIVE_INSPECTION_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  accountant: AccountantWorkspace,
  reviewer: ReviewerWorkspace,
  bookkeeper: BookkeeperDashboard,
  practice_manager: PracticeManagerDashboard,
  client_service: ClientServiceDashboard
};

const MODE_LABELS: Record<DashboardDirectoryEntry['mode'], string> = {
  console: 'Command Center',
  live: 'Layout Inspection Only',
  admin_live: 'Authorized Live Data',
  restricted: 'Restricted — Taxpayer Only',
  not_built: 'Not Implemented'
};

export function moduleForAdminPage(page: PageRoute): AdminModuleId {
  switch (page) {
    case 'admin_users':
      return 'users';
    case 'admin_security':
      return 'security';
    case 'admin_audit':
      return 'audit';
    case 'admin_ai_control':
      return 'ai_control';
    case 'admin_settings':
      return 'settings';
    default:
      return 'overview';
  }
}

type LoadState<T> = { status: 'loading' | 'ready' | 'error'; data: T | null };

function useServerLoad<T>(loader: () => Promise<T>, deps: unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading', data: null });
  useEffect(() => {
    let live = true;
    setState({ status: 'loading', data: null });
    loader()
      .then((data) => {
        if (live) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (live) setState({ status: 'error', data: null });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

interface SuperAdminCommandCenterProps {
  initialModule?: AdminModuleId;
}

/**
 * Centralized Super Administrator Command Center (/admin/dashboard and /admin/* sub-routes).
 *
 * Security & Governance Guarantees:
 * - Strictly requires a server-verified active Super Administrator session (`canInspectDashboards`).
 * - Never trusts browser state or URL to grant permissions; every embedded panel relies on server APIs.
 * - Audit records are strictly read-only; no alteration or deletion controls exist.
 * - Taxpayer records remain isolated; administrators cannot impersonate clients or inspect client tax files.
 */
export const SuperAdminCommandCenter: React.FC<SuperAdminCommandCenterProps> = ({
  initialModule
}) => {
  const { currentUser, authLifecycleState, currentPage, setCurrentPage, logout } = useApp();
  const permitted = canInspectDashboards(currentUser, authLifecycleState);

  const [activeModule, setActiveModule] = useState<AdminModuleId>(
    () => initialModule ?? moduleForAdminPage(currentPage)
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [auditRecordStatus, setAuditRecordStatus] = useState<'pending' | 'recorded' | 'unavailable'>('pending');
  const [inspectedDashboardId, setInspectedDashboardId] = useState<string | null>(null);
  const [aiSubtab, setAiSubtab] = useState<'control' | 'emergency_stop'>('control');
  const [configConfirmAck, setConfigConfirmAck] = useState(false);
  const [configReason, setConfigReason] = useState('');

  // Keep active module synchronized when route changes externally (browser back/forward or direct links)
  useEffect(() => {
    const mapped = moduleForAdminPage(currentPage);
    if (
      currentPage === 'admin_users' ||
      currentPage === 'admin_security' ||
      currentPage === 'admin_audit' ||
      currentPage === 'admin_ai_control' ||
      currentPage === 'admin_settings'
    ) {
      setActiveModule(mapped);
      setInspectedDashboardId(null);
    } else if (currentPage === 'admin_command_center' && activeModule !== 'compliance' && activeModule !== 'readiness') {
      setActiveModule('overview');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Record administrative view in server audit log whenever module or inspected layout changes
  useEffect(() => {
    if (!permitted) return;
    let live = true;
    setAuditRecordStatus('pending');
    const targetDashboardId =
      inspectedDashboardId && findDashboard(inspectedDashboardId)
        ? inspectedDashboardId
        : 'super_admin';
    api.superAdmin
      .recordDashboardView(targetDashboardId)
      .then(() => {
        if (live) setAuditRecordStatus('recorded');
      })
      .catch(() => {
        if (live) setAuditRecordStatus('unavailable');
      });
    return () => {
      live = false;
    };
  }, [activeModule, inspectedDashboardId, permitted]);

  const sessionState = useServerLoad(
    () => (permitted ? api.superAdmin.getSession() : Promise.reject(new Error('Unauthorized'))),
    [permitted, refreshTick]
  );
  const healthState = useServerLoad(
    () => (permitted ? api.admin.getSystemHealth() : Promise.reject(new Error('Unauthorized'))),
    [permitted, refreshTick]
  );
  const readiness = useAdminProviderReadiness(currentUser, authLifecycleState, refreshTick);

  const handleSelectModule = useCallback(
    (mod: AdminModuleDef) => {
      setActiveModule(mod.id);
      setInspectedDashboardId(null);
      setMobileNavOpen(false);
      if (mod.route && mod.route !== currentPage) {
        setCurrentPage(mod.route);
      } else if (!mod.route && currentPage !== 'admin_command_center') {
        setCurrentPage('admin_command_center');
      }
    },
    [currentPage, setCurrentPage]
  );

  // Defense-in-depth gate: never render any administrative UI without verified Super Administrator role
  if (!permitted) {
    return <AdminAccessDeniedView />;
  }

  const currentModuleDef =
    ADMIN_COMMAND_MODULES.find((m) => m.id === activeModule) ?? ADMIN_COMMAND_MODULES[0];
  const inspectedEntry = inspectedDashboardId ? findDashboard(inspectedDashboardId) : undefined;
  const InspectedComponent =
    inspectedEntry?.mode === 'live' ? LIVE_INSPECTION_COMPONENTS[inspectedEntry.id] : undefined;

  return (
    <div
      data-testid="super-admin-command-center"
      className="min-h-screen bg-[#061426] text-white flex flex-col"
    >
      {/* Executive Top Header Bar */}
      <header className="sticky top-0 z-40 border-b border-[#D4AF37]/25 bg-[#05101F]/95 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((open) => !open)}
              aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileNavOpen}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-[#0B1F36] text-white lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <BrandLogo variant="compact" size="sm" />

            <div className="hidden h-6 w-px bg-white/15 sm:block" aria-hidden="true" />

            <div className="hidden sm:flex flex-col min-w-0">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
                Super Administrator Command Center
              </span>
              <span className="truncate text-xs text-[#A8B8CC]">
                {currentUser?.email} · Role:{' '}
                <code className="font-mono text-white">{currentUser?.role}</code>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span
              role="status"
              aria-live="polite"
              data-testid="admin-audit-status"
              className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B1F36] px-2.5 py-1.5 font-mono text-[10px] text-[#A8B8CC]"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  auditRecordStatus === 'recorded'
                    ? 'bg-emerald-400'
                    : auditRecordStatus === 'unavailable'
                      ? 'bg-amber-400'
                      : 'bg-[#00C2D1]'
                }`}
                aria-hidden="true"
              />
              {auditRecordStatus === 'recorded'
                ? 'Audit View Recorded'
                : auditRecordStatus === 'unavailable'
                  ? 'Audit Endpoint Unreachable'
                  : 'Recording Audit View…'}
            </span>

            <button
              type="button"
              onClick={() => setRefreshTick((n) => n + 1)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-1.5 text-xs font-semibold text-[#E2EAF4] transition-colors hover:border-[#D4AF37]/45 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#D4AF37]" aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentPage('super_admin_console')}
              className="hidden xl:inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/15 bg-[#0B1F36] px-3 py-1.5 text-xs font-semibold text-[#CBD6E4] transition-colors hover:border-[#00C2D1]/45 hover:text-white"
            >
              <span>Classic Console</span>
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-950/35 px-3 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-950/65 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Workspace: Fixed Executive Sidebar + Active Module Canvas */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation (Desktop persistent + Mobile drawer) */}
        <aside
          aria-label="Super Administrator Modules"
          className={`${
            mobileNavOpen ? 'fixed inset-y-16 left-0 z-30 flex' : 'hidden'
          } w-72 shrink-0 flex-col justify-between border-r border-white/10 bg-[#07182D] lg:static lg:flex`}
        >
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#A8B8CC]">
              Governance Modules (01–08)
            </div>

            {ADMIN_COMMAND_MODULES.map((mod) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id && !inspectedDashboardId;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => handleSelectModule(mod)}
                  aria-current={isActive ? 'page' : undefined}
                  data-testid={`admin-nav-${mod.id}`}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                    isActive
                      ? 'bg-[#D4AF37] font-bold text-[#061426] shadow-sm'
                      : 'text-[#CBD6E4] hover:bg-[#0B1F36] hover:text-white'
                  }`}
                >
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      isActive ? 'text-[#061426]/80 font-bold' : 'text-[#00C2D1]'
                    }`}
                  >
                    {mod.code}
                  </span>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{mod.label}</span>
                </button>
              );
            })}

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#A8B8CC]">
                Linked Workspaces
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage('ai_command_center')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[#A8B8CC] hover:bg-[#0B1F36] hover:text-white"
              >
                <Bot className="h-4 w-4 shrink-0 text-[#00C2D1]" aria-hidden="true" />
                <span>Master AI Center (/admin/master/ai)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('super_admin_console')}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs text-[#A8B8CC] hover:bg-[#0B1F36] hover:text-white"
              >
                <Activity className="h-4 w-4 shrink-0 text-[#D4AF37]" aria-hidden="true" />
                <span>Staff Super Admin (/staff/super-admin)</span>
              </button>
            </div>
          </nav>

          {/* Sidebar Security Posture Footer */}
          <div className="border-t border-white/10 bg-[#05101F]/70 p-3.5 text-[11px] space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#D4AF37]">
              <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Least-Privilege Scope</span>
            </div>
            <p className="text-[#A8B8CC] leading-relaxed">
              Tenant: <code className="font-mono text-white">{currentUser?.tenantId || 'server-scoped'}</code>
            </p>
            <p className="text-[10px] text-[#8DA2BA]">
              Taxpayer dossiers and audit log mutation remain disabled for administrative accounts.
            </p>
          </div>
        </aside>

        {/* Active Module Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* Module Header */}
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#D4AF37] tabular-nums">
                  <span>Module {currentModuleDef.code}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-[#00C2D1]">Destria Governance</span>
                </div>
                <h1 className="font-serif text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  {inspectedEntry ? `${inspectedEntry.label} — Layout Inspection` : currentModuleDef.label}
                </h1>
                <p className="text-xs sm:text-sm text-[#A8B8CC]">
                  {inspectedEntry ? inspectedEntry.status : currentModuleDef.description}
                </p>
              </div>

              {inspectedEntry && (
                <button
                  type="button"
                  onClick={() => setInspectedDashboardId(null)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#D4AF37] px-3.5 py-2 text-xs font-bold text-[#061426] hover:bg-[#E5C562]"
                >
                  <span>Exit Layout Inspection</span>
                </button>
              )}
            </div>

            {/* Inspection Mode Banner & Embedded Layout */}
            {inspectedEntry ? (
              <div className="space-y-4">
                <div
                  role="note"
                  data-testid="admin-inspection-banner"
                  className="rounded-xl border border-amber-400/40 bg-amber-950/60 px-4 py-3 text-xs text-amber-100"
                >
                  <strong>{MODE_LABELS[inspectedEntry.mode]}: {inspectedEntry.label}.</strong>{' '}
                  {inspectedEntry.mode === 'live'
                    ? 'Layout inspection only. No taxpayer or role-scoped operational data is loaded, and your server-assigned role remains unchanged.'
                    : inspectedEntry.status}
                </div>

                {InspectedComponent ? (
                  <DashboardInspectionProvider dashboard={inspectedEntry.id}>
                    <Suspense fallback={<PageLoadingFallback />}>
                      <InspectedComponent />
                    </Suspense>
                  </DashboardInspectionProvider>
                ) : (
                  <section className="rounded-2xl border border-white/12 bg-[#0B1F36] p-6 space-y-2 text-sm text-[#CBD6E4]">
                    <h2 className="text-base font-bold text-white">{inspectedEntry.label}</h2>
                    <p>{inspectedEntry.status}</p>
                    {inspectedEntry.mode === 'restricted' && (
                      <p className="text-xs text-[#A8B8CC]">
                        Administrators are strictly prohibited from impersonating clients or opening
                        taxpayer accounts from this console.
                      </p>
                    )}
                  </section>
                )}
              </div>
            ) : (
              <>
                {/* 01 — Executive Overview */}
                {activeModule === 'overview' && (
                  <div className="space-y-6" data-testid="admin-module-overview">
                    {/* Top Server-Verified Posture Strip */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <section className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#A8B8CC]">
                            Server Health
                          </span>
                          <Activity className="h-4 w-4 text-[#00C2D1]" aria-hidden="true" />
                        </div>
                        {healthState.status === 'loading' ? (
                          <p role="status" className="text-xs text-[#A8B8CC]">Checking server health…</p>
                        ) : healthState.status === 'error' ? (
                          <p role="alert" className="text-xs text-amber-200">
                            System health endpoint unavailable. No substitute metrics shown.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-lg font-bold capitalize text-white">
                              {healthState.data?.healthStatus || 'Unknown'}
                            </p>
                            <p className="font-mono text-[11px] text-[#A8B8CC] tabular-nums">
                              Server UTC: {healthState.data?.serverTimestamp || '—'}
                            </p>
                          </div>
                        )}
                      </section>

                      <section className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#A8B8CC]">
                            Session &amp; MFA Assurance
                          </span>
                          <KeyRound className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
                        </div>
                        {sessionState.status === 'loading' ? (
                          <p role="status" className="text-xs text-[#A8B8CC]">Verifying session metadata…</p>
                        ) : sessionState.status === 'error' ? (
                          <p role="alert" className="text-xs text-amber-200">
                            Session telemetry unavailable from server.
                          </p>
                        ) : (
                          <div className="space-y-1 text-xs">
                            <p className="font-bold text-white">
                              Second Factor:{' '}
                              <span className="text-[#00C2D1]">
                                {sessionState.data?.secondFactor || 'Verified'}
                              </span>
                            </p>
                            {sessionState.data?.session && (
                              <p className="font-mono text-[11px] text-[#A8B8CC] tabular-nums">
                                Idle timeout: {sessionState.data.session.idleTimeoutMinutes} min
                              </p>
                            )}
                          </div>
                        )}
                      </section>

                      <section className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#A8B8CC]">
                            Provider Readiness
                          </span>
                          <Server className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
                        </div>
                        {readiness.status === 'loading' ? (
                          <p role="status" className="text-xs text-[#A8B8CC]">Loading provider registry…</p>
                        ) : readiness.status === 'error' ? (
                          <p role="alert" className="text-xs text-amber-200">
                            Provider report unavailable. No readiness is assumed.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-lg font-bold text-white tabular-nums">
                              {readiness.providers.length} Reported Provider(s)
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectModule(
                                  ADMIN_COMMAND_MODULES.find((m) => m.id === 'readiness')!
                                )
                              }
                              className="text-xs font-semibold text-[#D4AF37] hover:underline"
                            >
                              Inspect deployment readiness →
                            </button>
                          </div>
                        )}
                      </section>
                    </div>

                    {/* Quick Module Launchers */}
                    <section className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-bold text-white">
                          Centralized Administration Modules
                        </h2>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#A8B8CC]">
                          Server-Enforced RBAC
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {ADMIN_COMMAND_MODULES.slice(1).map((mod) => {
                          const Icon = mod.icon;
                          return (
                            <button
                              key={mod.id}
                              type="button"
                              onClick={() => handleSelectModule(mod)}
                              className="group rounded-xl border border-white/10 bg-[#061426]/85 p-4 text-left transition-colors hover:border-[#D4AF37]/45"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-mono text-[10px] font-bold text-[#00C2D1] tabular-nums">
                                  {mod.code}
                                </span>
                                <Icon className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
                              </div>
                              <div className="text-xs font-bold text-white group-hover:text-[#E6C96E]">
                                {mod.label}
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-[#A8B8CC]">
                                {mod.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    {/* Role Dashboard Inspection Directory + Least-Privilege Safeguards */}
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <section className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5 space-y-3">
                        <h2 className="text-sm font-bold text-white">
                          Role Workspace Inspection Directory
                        </h2>
                        <p className="text-xs text-[#A8B8CC]">
                          Inspect staff workspace layouts without assuming another user&apos;s role
                          or loading restricted taxpayer records. Every inspection is audit-logged.
                        </p>
                        <ul className="divide-y divide-white/10 text-xs">
                          {DASHBOARD_DIRECTORY.slice(1).map((entry) => (
                            <li
                              key={entry.id}
                              className="flex items-center justify-between gap-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-white">{entry.label}</div>
                                <div className="text-[11px] text-[#A8B8CC]">
                                  {MODE_LABELS[entry.mode]}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setInspectedDashboardId(entry.id)}
                                className="shrink-0 rounded-lg border border-white/15 bg-[#061426] px-2.5 py-1.5 text-[11px] font-semibold text-[#D4AF37] hover:border-[#D4AF37]/50"
                              >
                                Inspect
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section className="rounded-2xl border border-[#D4AF37]/25 bg-[#0B1F36] p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-[#D4AF37]" aria-hidden="true" />
                          <h2 className="text-sm font-bold text-white">
                            Mandatory Security &amp; Least-Privilege Safeguards
                          </h2>
                        </div>
                        <ul className="space-y-2.5 text-xs text-[#CBD6E4]">
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00C2D1]" aria-hidden="true" />
                            <span>
                              <strong className="text-white">No MFA Bypass:</strong> All Super
                              Administrator sessions require server-verified multifactor
                              authentication.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00C2D1]" aria-hidden="true" />
                            <span>
                              <strong className="text-white">Taxpayer Data Isolation:</strong>{' '}
                              Client tax dossiers and client impersonation remain strictly disabled.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00C2D1]" aria-hidden="true" />
                            <span>
                              <strong className="text-white">Immutable Audit Trails:</strong> Audit
                              records are read-only; no alteration or deletion actions exist in the
                              portal.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00C2D1]" aria-hidden="true" />
                            <span>
                              <strong className="text-white">Maker-Checker Governance:</strong>{' '}
                              High-risk staff status changes require mandatory reason codes, recent
                              sign-in, and server authorization.
                            </span>
                          </li>
                        </ul>
                      </section>
                    </div>
                  </div>
                )}

                {/* 02 — Staff & Access Management (/admin/users) */}
                {activeModule === 'users' && (
                  <div data-testid="admin-module-users" className="space-y-6">
                    <StaffAccessManagementPanel
                      user={currentUser}
                      authStatus={authLifecycleState}
                      refresh={refreshTick}
                    />
                  </div>
                )}

                {/* 03 — Security Command Center (/admin/security) */}
                {activeModule === 'security' && (
                  <div data-testid="admin-module-security" className="space-y-6">
                    <div className="rounded-2xl border border-[#D4AF37]/25 bg-[#0B1F36] p-5 space-y-2 text-xs">
                      <div className="flex items-center gap-2 font-bold text-[#E6C96E]">
                        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                        <span>Active Session Security &amp; Event Telemetry</span>
                      </div>
                      <p className="text-[#CBD6E4]">
                        Monitor active durable sessions, enforce MFA assurance levels, revoke
                        compromised sessions, and review server-recorded security events (including
                        rate-limited duplicate suppression metrics).
                      </p>
                    </div>

                    <StaffSessionsPanel
                      user={currentUser}
                      authStatus={authLifecycleState}
                      refresh={refreshTick}
                    />

                    <AuditCenterPanel securityOnly />
                  </div>
                )}

                {/* 04 — Compliance Administration */}
                {activeModule === 'compliance' && (
                  <div data-testid="admin-module-compliance" className="space-y-6">
                    <section className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5 space-y-3">
                      <h2 className="text-base font-bold text-white">
                        Taxpayer Isolation &amp; Compliance Boundary
                      </h2>
                      <p className="text-xs leading-relaxed text-[#CBD6E4]">
                        Under IRC §7216, GLBA Safeguards Rule, and TaxGuard&apos;s least-privilege
                        architecture, administrative oversight tracks compliance workflow queues and
                        retention readiness without exposing unredacted taxpayer filings or allowing
                        client impersonation.
                      </p>
                    </section>

                    <div className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5">
                      <AdminOperationalPanel
                        tab="retention"
                        status={readiness.status}
                        providers={readiness.providers}
                        onRefresh={() => setRefreshTick((n) => n + 1)}
                      />
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5">
                      <AdminWorkloadPanel />
                    </div>
                  </div>
                )}

                {/* 05 — AI Workforce Governance (/admin/ai-control) */}
                {activeModule === 'ai_control' && (
                  <div data-testid="admin-module-ai-control" className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/12 bg-[#0B1F36] p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setAiSubtab('control')}
                          className={`min-h-[38px] rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                            aiSubtab === 'control'
                              ? 'bg-[#D4AF37] text-[#061426]'
                              : 'border border-white/15 bg-[#061426] text-[#CBD6E4] hover:text-white'
                          }`}
                        >
                          AI Control Center &amp; 61-Agent Matrix
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiSubtab('emergency_stop')}
                          className={`min-h-[38px] rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                            aiSubtab === 'emergency_stop'
                              ? 'bg-rose-600 text-white'
                              : 'border border-rose-500/35 bg-rose-950/35 text-rose-200 hover:bg-rose-950/60'
                          }`}
                        >
                          AI Emergency Stop (Kill Switch)
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setCurrentPage('ai_command_center')}
                        className="text-xs font-semibold text-[#00C2D1] hover:underline"
                      >
                        Open Master AI Command Center (/admin/master/ai) →
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5">
                      <Suspense fallback={<PageLoadingFallback />}>
                        {aiSubtab === 'control' ? (
                          <AiControlCenterPanel initialView="registry" />
                        ) : (
                          <AiEmergencyStopPanel />
                        )}
                      </Suspense>
                    </div>
                  </div>
                )}

                {/* 06 — System Configuration (/admin/settings) */}
                {activeModule === 'settings' && (
                  <div data-testid="admin-module-settings" className="space-y-6">
                    <section className="rounded-2xl border border-white/12 bg-[#0B1F36] p-6 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-base font-bold text-white">
                          Server-Enforced Security &amp; Session Policy
                        </h2>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#D4AF37]">
                          Read-Only Policy View
                        </span>
                      </div>

                      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
                        <div className="rounded-xl border border-white/10 bg-[#061426]/85 p-4 space-y-1">
                          <dt className="font-mono text-[10px] uppercase text-[#A8B8CC]">
                            Authorized Tenant Scope
                          </dt>
                          <dd className="font-mono text-sm font-bold text-white">
                            {currentUser?.tenantId || 'Server-assigned tenant'}
                          </dd>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#061426]/85 p-4 space-y-1">
                          <dt className="font-mono text-[10px] uppercase text-[#A8B8CC]">
                            Privileged MFA Policy
                          </dt>
                          <dd className="text-sm font-bold text-[#00C2D1]">
                            Mandatory TOTP (AAL2 Enforced Server-Side)
                          </dd>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#061426]/85 p-4 space-y-1">
                          <dt className="font-mono text-[10px] uppercase text-[#A8B8CC]">
                            Privileged Idle Timeout
                          </dt>
                          <dd className="font-mono text-sm font-bold text-white tabular-nums">
                            {sessionState.data?.session?.idleTimeoutMinutes
                              ? `${sessionState.data.session.idleTimeoutMinutes} minutes`
                              : 'Enforced by server session policy'}
                          </dd>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-[#061426]/85 p-4 space-y-1">
                          <dt className="font-mono text-[10px] uppercase text-[#A8B8CC]">
                            Public Administrator Registration
                          </dt>
                          <dd className="text-sm font-bold text-emerald-300">
                            Disabled (Invitation + Approval Only)
                          </dd>
                        </div>
                      </dl>
                    </section>

                    <section className="rounded-2xl border border-[#D4AF37]/30 bg-[#0B1F36] p-6 space-y-4">
                      <div className="flex items-start gap-3">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]" aria-hidden="true" />
                        <div className="space-y-1">
                          <h2 className="text-base font-bold text-white">
                            High-Risk Configuration Governance Gate
                          </h2>
                          <p className="text-xs leading-relaxed text-[#CBD6E4]">
                            Production secrets, database schema migrations, multi-tenant creation,
                            and infrastructure deployment settings are intentionally excluded from
                            browser-based mutation. Approved high-risk configuration requests require
                            explicit confirmation, a mandatory audit reason, and server-side
                            re-authentication within 15 minutes.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 rounded-xl border border-white/10 bg-[#061426]/85 p-4 text-xs">
                        <label className="block space-y-1.5">
                          <span className="font-semibold text-white">
                            Change control justification (required for approved configuration requests)
                          </span>
                          <input
                            type="text"
                            maxLength={240}
                            value={configReason}
                            onChange={(e) => setConfigReason(e.target.value)}
                            placeholder="Document ticket reference and authorization reason..."
                            className="min-h-[40px] w-full rounded-lg border border-white/15 bg-[#0B1F36] px-3 py-2 text-white placeholder:text-[#7F94AD] focus:border-[#D4AF37] focus:outline-none"
                          />
                        </label>

                        <label className="flex items-start gap-2.5 text-[#CBD6E4]">
                          <input
                            type="checkbox"
                            checked={configConfirmAck}
                            onChange={(e) => setConfigConfirmAck(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I confirm that high-risk system configuration changes require owner
                            approval, recent MFA step-up verification, and immutable audit logging.
                          </span>
                        </label>

                        <p role="note" className="text-[11px] text-[#A8B8CC]">
                          No browser-side write endpoint is enabled for production secrets or
                          deployment infrastructure. Use the Staff &amp; Access or AI Emergency Stop
                          modules for server-authorized runtime controls.
                        </p>
                      </div>
                    </section>
                  </div>
                )}

                {/* 07 — Audit & Accountability (/admin/audit) */}
                {activeModule === 'audit' && (
                  <div data-testid="admin-module-audit" className="space-y-4">
                    <div className="rounded-xl border border-[#00C2D1]/30 bg-[#0B1F36] px-4 py-3 text-xs text-[#CBD6E4]">
                      <strong className="text-white">Immutable Audit Ledger:</strong> Administrative
                      and security events are strictly read-only. Deletion, editing, or suppression
                      of recorded audit entries is prohibited by architecture and policy.
                    </div>
                    <AuditCenterPanel />
                  </div>
                )}

                {/* 08 — Deployment & Integration Readiness */}
                {activeModule === 'readiness' && (
                  <div data-testid="admin-module-readiness" className="space-y-6">
                    <div className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5">
                      <AdminOperationalPanel
                        tab="providers"
                        status={readiness.status}
                        providers={readiness.providers}
                        onRefresh={() => setRefreshTick((n) => n + 1)}
                      />
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-[#0B1F36] p-5">
                      <AdminJobQueuePanel />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
