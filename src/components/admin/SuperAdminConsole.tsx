/**
 * Super Administrator Console.
 *
 * - Reached only with a real, server-issued super administrator session (password + TOTP locally,
 *   Supabase in production). The role is never taken from the browser.
 * - The dashboard selector renders the application's real dashboard components. Other roles'
 *   dashboards are shown in inspection mode: layout only, no data for that role is requested,
 *   the session role is unchanged and every server route keeps its own permission checks.
 * - Each view switch is recorded server-side in the audit log.
 */
import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../services/api';
import type { AuditLog, User } from '../../types';
import { DASHBOARD_DIRECTORY, DashboardDirectoryEntry, SUPER_ADMIN_CONSOLE_PATH, findDashboard } from '../../config/superAdminDashboards';
import { DashboardInspectionProvider, canInspectDashboards } from '../layout/dashboardInspection';
import { useAdminProviderReadiness } from '../../hooks/useAdminProviderReadiness';
import { PageLoadingFallback } from '../common/PageLoadingFallback';
import { AuditCenterPanel } from './AuditCenterPanel';

const AccountantWorkspace = lazy(() => import('../workspace/AccountantWorkspace').then(m => ({ default: m.AccountantWorkspace })));
const ReviewerWorkspace = lazy(() => import('../workspace/ReviewerWorkspace').then(m => ({ default: m.ReviewerWorkspace })));
const BookkeeperDashboard = lazy(() => import('../workspace/BookkeeperDashboard').then(m => ({ default: m.BookkeeperDashboard })));
const PracticeManagerDashboard = lazy(() => import('../workspace/PracticeManagerDashboard').then(m => ({ default: m.PracticeManagerDashboard })));
const ClientServiceDashboard = lazy(() => import('../workspace/ClientServiceDashboard').then(m => ({ default: m.ClientServiceDashboard })));
const PracticeAdminWorkspace = lazy(() => import('./PracticeAdminWorkspace').then(m => ({ default: m.PracticeAdminWorkspace })));
const AiControlCenterPanel = lazy(() => import('./AiControlCenterPanel').then(m => ({ default: m.AiControlCenterPanel })));
const AiEmergencyStopPanel = lazy(() => import('./AiEmergencyStopPanel').then(m => ({ default: m.AiEmergencyStopPanel })));

const STORAGE_KEY = 'taxguard_super_admin_dashboard';
const LIVE_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  accountant: AccountantWorkspace,
  reviewer: ReviewerWorkspace,
  bookkeeper: BookkeeperDashboard,
  practice_manager: PracticeManagerDashboard,
  client_service: ClientServiceDashboard,
};

const MODE_LABEL: Record<DashboardDirectoryEntry['mode'], string> = {
  console: 'Your console',
  live: 'Inspection (layout only)',
  admin_live: 'Authorized, live data',
  restricted: 'Restricted: owner session only',
  not_built: 'Not implemented',
};

export function initialDashboardSelection(search: string, stored: string | null): string {
  const fromUrl = new URLSearchParams(search).get('dashboard');
  if (findDashboard(fromUrl)) return fromUrl as string;
  if (findDashboard(stored)) return stored as string;
  return 'super_admin';
}

function readStored(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStored(id: string) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* per-viewer convenience only */ }
}

export function SuperAdminConsole() {
  const { currentUser, authLifecycleState, logout } = useApp();
  const permitted = canInspectDashboards(currentUser, authLifecycleState);
  const [dashboard, setDashboard] = useState(() =>
    initialDashboardSelection(typeof window !== 'undefined' ? window.location.search : '', readStored()));
  const [auditState, setAuditState] = useState<'pending' | 'recorded' | 'failed'>('pending');
  const entry = findDashboard(dashboard) ?? DASHBOARD_DIRECTORY[0];

  const select = useCallback((id: string) => {
    if (!findDashboard(id)) return;
    setDashboard(id);
    writeStored(id);
    try { window.history.replaceState({ page: 'super_admin_console' }, '', `${SUPER_ADMIN_CONSOLE_PATH}?dashboard=${encodeURIComponent(id)}`); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!permitted) return;
    let live = true;
    setAuditState('pending');
    try { window.history.replaceState({ page: 'super_admin_console' }, '', `${SUPER_ADMIN_CONSOLE_PATH}?dashboard=${encodeURIComponent(dashboard)}`); } catch { /* ignore */ }
    api.superAdmin.recordDashboardView(dashboard)
      .then(() => { if (live) setAuditState('recorded'); })
      .catch(() => { if (live) setAuditState('failed'); });
    return () => { live = false; };
  }, [dashboard, permitted]);

  if (!permitted) {
    return <p role="alert" className="max-w-xl mx-auto my-16 text-sm text-red-200">Super administrator access is required. This console is not available to your role.</p>;
  }

  const LiveComponent = entry.mode === 'live' ? LIVE_COMPONENTS[entry.id] : undefined;

  return (
    <div className="min-h-screen bg-[#06182B] text-slate-100" data-testid="super-admin-console">
      <header className="sticky top-0 z-40 bg-[#071A2E] border-b border-[#D4A843]/40 px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[220px]">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#D4A843]">TaxGuard AI · Super Administrator</p>
          <p className="text-xs text-slate-300">
            Signed in as <strong className="text-white">{currentUser?.email}</strong> · role <code>{currentUser?.role}</code> (unchanged by view selection)
          </p>
        </div>
        <label className="text-xs flex items-center gap-2">
          <span className="font-semibold">Dashboard</span>
          <select
            aria-label="Select dashboard"
            value={entry.id}
            onChange={e => select(e.target.value)}
            className="bg-[#0D2745] border border-slate-600 rounded-lg px-2 py-1.5 text-white"
          >
            {DASHBOARD_DIRECTORY.map((d, i) => (
              <option key={d.id} value={d.id}>{i === 0 ? d.label : `${i}. ${d.label}`}</option>
            ))}
          </select>
        </label>
        <span className="text-[10px] text-slate-400" role="status" aria-live="polite">
          {auditState === 'recorded' ? 'View recorded in audit log' : auditState === 'failed' ? 'Audit record failed' : 'Recording view…'}
        </span>
        <button type="button" onClick={() => void logout()} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold">
          Sign out
        </button>
      </header>

      {entry.mode !== 'console' && (
        <div role="note" data-testid="inspection-banner" className="px-4 py-2 bg-amber-950/80 border-b border-amber-500/40 text-amber-100 text-xs">
          <strong>{MODE_LABEL[entry.mode]}: {entry.label}.</strong>{' '}
          {entry.mode === 'live'
            ? 'You are viewing this dashboard as a super administrator. No data for this role is loaded, your role and permissions are unchanged, and actions remain subject to server checks. Interactive work requires a real account with this role.'
            : entry.mode === 'admin_live'
              ? 'You are authorized for this dashboard; it shows real administrative data for your tenant.'
              : entry.status}
        </div>
      )}

      <main>
        {entry.mode === 'console' && <SuperAdminOverview onOpen={select} />}
        {entry.mode === 'admin_live' && (
          <Suspense fallback={<PageLoadingFallback />}><PracticeAdminWorkspace /></Suspense>
        )}
        {LiveComponent && (
          <DashboardInspectionProvider dashboard={entry.id}>
            <Suspense fallback={<PageLoadingFallback />}><LiveComponent /></Suspense>
          </DashboardInspectionProvider>
        )}
        {(entry.mode === 'restricted' || entry.mode === 'not_built') && (
          <section className="max-w-3xl mx-auto my-10 p-6 rounded-2xl bg-[#0D2745] border border-slate-700 space-y-3" data-testid="dashboard-unavailable">
            <h1 className="text-xl font-bold text-white">{entry.label} dashboard</h1>
            <p className="text-sm text-slate-300">{entry.status}</p>
            {entry.mode === 'restricted' && (
              <p className="text-xs text-slate-400">
                To inspect it, sign in as a synthetic client account in a separate browser profile. Administrators are not given a client&apos;s view of taxpayer records.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

type Load<T> = { status: 'loading' | 'ready' | 'error'; data: T | null };

function useLoad<T>(loader: () => Promise<T>, deps: unknown[]): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: 'loading', data: null });
  useEffect(() => {
    let live = true;
    setState({ status: 'loading', data: null });
    loader().then(data => { if (live) setState({ status: 'ready', data }); }).catch(() => { if (live) setState({ status: 'error', data: null }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function Card({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="p-4 rounded-2xl bg-[#0D2745] border border-slate-700 space-y-2 text-xs" data-testid={testId}>
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Unavailable({ what }: { what: string }) {
  return <p role="alert" className="text-red-200">{what} could not be loaded. No substitute data is shown.</p>;
}

const STAFF_ROLES = new Set(['accountant', 'reviewer', 'senior_reviewer', 'bookkeeper', 'practice_manager', 'operations', 'recruiter', 'admin', 'super_admin', 'administrator', 'super_administrator', 'compliance_officer', 'cpa']);

function SuperAdminOverview({ onOpen }: { onOpen: (id: string) => void }) {
  const { currentUser, authLifecycleState } = useApp();
  const [refresh, setRefresh] = useState(0);
  const [aiPanel, setAiPanel] = useState<'none' | 'control' | 'stop'>('none');
  const [auditOpen, setAuditOpen] = useState(false);
  const session = useLoad(() => api.superAdmin.getSession(), [refresh]);
  const health = useLoad(() => api.admin.getSystemHealth(), [refresh]);
  const readiness = useAdminProviderReadiness(currentUser, authLifecycleState, refresh);


  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Super Administrator Dashboard</h1>
          <p className="text-xs text-slate-400">Real data from this TaxGuard server for your tenant. Taxpayer records are not listed here.</p>
        </div>
        <button type="button" onClick={() => setRefresh(n => n + 1)} className="px-3 py-1.5 rounded-lg bg-[#D4A843] text-[#071A2E] text-xs font-bold">Refresh</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="1. System overview" testId="sa-system-overview">
          {health.status === 'loading' ? <p role="status">Loading…</p> : health.status === 'error' ? <Unavailable what="System health" /> : (
            <dl className="grid grid-cols-2 gap-1">
              <dt>Server status</dt><dd>{health.data!.healthStatus}</dd>
              <dt>Server time</dt><dd>{health.data!.serverTimestamp}</dd>
            </dl>
          )}
          {session.data?.session && (
            <p className="text-slate-400">Session expires {session.data.session.expiresAt} (idle {session.data.session.idleTimeoutMinutes} min; absolute limit {session.data.session.absoluteExpiresAt}). Second factor: {session.data.secondFactor}.</p>
          )}
        </Card>

        <Card title="2. Tenant management" testId="sa-tenant">
          <p>Tenant: <code>{currentUser?.tenantId}</code></p>
          <p className="text-slate-400">This account administers one tenant. Creating or suspending tenants is not implemented (durable multi-tenant store, E01). Every administrative API is scoped to this tenant on the server.</p>
        </Card>

        <Card title="3. Staff and user management" testId="sa-staff">
          <p>The authoritative staff directory — membership status, roles, invitations, MFA recovery, sessions, suspension and reactivation with recent sign-in and independent approval — is in the Administrator dashboard (Practice Staff &amp; Roles).</p>
          <button type="button" className="underline text-[#D4A843]" onClick={() => onOpen('administrator')}>Manage staff in the Administrator dashboard</button>
        </Card>

        <Card title="4. Roles and permissions" testId="sa-roles">
          <ul className="list-disc pl-4 space-y-1 text-slate-300">
            <li>Roles are assigned by the server; the browser cannot choose a role.</li>
            <li>Super administrator = administrator permissions plus this console. No universal override: preparer, reviewer, client and maker-checker controls still apply.</li>
            <li>Dashboard inspection never changes your role; impersonation is disabled by policy.</li>
            <li>Final role model (billing, security, executive) is pending owner decision H06.</li>
          </ul>
        </Card>

        <Card title="5. Dashboard access directory" testId="sa-directory">
          <ol className="space-y-1">
            {DASHBOARD_DIRECTORY.slice(1).map((d, i) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span>{i + 1}. {d.label} <span className="text-slate-400">({MODE_LABEL[d.mode]})</span></span>
                <button type="button" className="underline text-[#D4A843]" onClick={() => onOpen(d.id)} aria-label={`Open ${d.label} dashboard`}>Open</button>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="6. Security and audit" testId="sa-security">
          <p>Recorded security events (sessions, staff access and MFA, sign-in, AI governance) are shown below from the durable audit log. Events the server only held in memory are not authoritative and are not shown.</p>
          <button type="button" className="underline text-[#D4A843]" onClick={() => setAuditOpen(o => !o)}>{auditOpen ? 'Close' : 'Open'} security events</button>
        </Card>

        <Card title="7. Workflow oversight" testId="sa-workflow">
          <p>The 18-stage workflow is server-authoritative (LEGACY_18_V1). Stage labels are pending owner decision H10.</p>
          <button type="button" className="underline text-[#D4A843]" onClick={() => onOpen('practice_manager')}>Inspect the Practice Manager dashboard</button>
        </Card>

        <Card title="8. AI Control Center" testId="sa-ai">
          <p>AI governance runs against the durable governance store. Your role is a governance operator; the server checks membership on every call.</p>
          <div className="flex gap-3">
            <button type="button" className="underline text-[#D4A843]" onClick={() => setAiPanel(aiPanel === 'control' ? 'none' : 'control')}>{aiPanel === 'control' ? 'Close' : 'Open'} AI Control Center</button>
            <button type="button" className="underline text-red-300" onClick={() => setAiPanel(aiPanel === 'stop' ? 'none' : 'stop')}>{aiPanel === 'stop' ? 'Close' : 'Open'} AI emergency stop</button>
          </div>
        </Card>

        <Card title="9. Integration status" testId="sa-integrations">
          {readiness.status === 'loading' ? <p role="status">Loading…</p> : readiness.status === 'error' ? <Unavailable what="Provider readiness" /> : (
            <ul className="space-y-1">{readiness.providers.map(p => <li key={p.provider}><code>{p.provider}</code>: {p.status}</li>)}</ul>
          )}
          <p className="text-slate-400">Reported configuration only. Filing, e-signature, payments and accounting sync are not commissioned.</p>
        </Card>

        <Card title="10. Operational health and errors" testId="sa-operations">
          <p>Failed-login keys tracked by this server process (not persisted): {health.data ? health.data.metrics.failedLoginAttemptsTracked : '…'}</p>
          <p className="text-slate-400">Durable security events are in the security events view (section 6).</p>
        </Card>
      </div>

      {auditOpen && <section className="p-4 rounded-2xl bg-[#0D2745] border border-slate-700"><AuditCenterPanel securityOnly /></section>}
      {aiPanel !== 'none' && (
        <section className="p-4 rounded-2xl bg-[#0D2745] border border-slate-700">
          <Suspense fallback={<PageLoadingFallback />}>{aiPanel === 'control' ? <AiControlCenterPanel /> : <AiEmergencyStopPanel />}</Suspense>
        </section>
      )}
    </div>
  );
}
