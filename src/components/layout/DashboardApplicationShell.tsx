import React, { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle, LogOut, Menu, Search, ShieldCheck, User, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NotificationBell } from '../common/NotificationBell';
import { DASHBOARD_THEME } from '../../theme/tokens';
import { canRenderDashboardShell, DASHBOARD_EXPERIENCES, DashboardWorkspace } from './dashboardAccess';
import './dashboardShell.css';

const dashboardVariables = Object.fromEntries(
  Object.entries(DASHBOARD_THEME)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => [`--dashboard-${key}`, value]),
) as React.CSSProperties;

interface DashboardApplicationShellProps {
  workspace: DashboardWorkspace;
  title?: string;
  navigation: React.ReactNode;
  mobileNavigation?: React.ReactNode;
  navigationCollapsed?: boolean;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  onSearch?: () => void;
  onProfile?: () => void;
  notifications?: React.ReactNode;
  headerTools?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}

/** Shared live chrome only. Never loads demo data or changes identity/permissions. */
export function DashboardApplicationShell(props: DashboardApplicationShellProps) {
  const { currentUser, authLifecycleState } = useApp();
  // Remount navigation references, dialogs and focus state across authority changes.
  // No access token is stored in the key or imported into the synthetic fixture.
  const sessionKey = JSON.stringify([authLifecycleState, props.workspace, currentUser?.id,
    currentUser?.tenantId, currentUser?.clientId, currentUser?.role, currentUser?.status,
    currentUser?.lastLoginAt, currentUser?.updatedAt, [...(currentUser?.authorizedClientIds ?? [])].sort()]);
  return <DashboardShellSession key={sessionKey} {...props} />;
}

function DashboardShellSession({
  workspace, title = DASHBOARD_EXPERIENCES[workspace], navigation, mobileNavigation,
  navigationCollapsed = false, mobileOpen, onMobileOpenChange, onSearch, onProfile,
  notifications, headerTools, id, children,
}: DashboardApplicationShellProps) {
  const { currentUser, authLifecycleState, logout } = useApp();
  const [localMobileOpen, setLocalMobileOpen] = useState(false);
  const [panel, setPanel] = useState<'search' | 'profile' | 'help' | null>(null);
  const [query, setQuery] = useState('');
  const [links, setLinks] = useState<Array<{ label: string; button: HTMLButtonElement }>>([]);
  const navRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentId = useId();
  const drawerId = useId();
  const isMobileOpen = mobileOpen ?? localMobileOpen;
  const setMobileOpen = onMobileOpenChange ?? setLocalMobileOpen;
  const allowed = canRenderDashboardShell(currentUser, authLifecycleState, workspace);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (panel && !dialog?.open) dialog?.showModal();
    if (!panel && dialog?.open) dialog.close();
  }, [panel]);

  useEffect(() => {
    if (!isMobileOpen || !allowed) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select, input, [tabindex="0"]') ?? []);
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [isMobileOpen, allowed, setMobileOpen]);

  if (!allowed) return <div className="tg-access-message" role="status">An authorized active session is required for this workspace.</div>;

  const openSearch = () => {
    if (onSearch) { onSearch(); return; }
    setLinks(Array.from(navRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      .map(button => ({ label: button.textContent?.trim() || button.title, button }))
      .filter(item => item.label));
    setQuery('');
    setPanel('search');
  };

  return (
    <div className="tg-dashboard-shell" id={id} style={dashboardVariables}>
      <a inert={isMobileOpen} className="tg-skip-link" href={`#${contentId}`}>Skip to workspace</a>
      <header inert={isMobileOpen} className="tg-shell-header">
        <button ref={menuRef} className="tg-shell-icon tg-mobile-menu" aria-label="Open navigation" aria-expanded={isMobileOpen} aria-controls={drawerId} onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
        <div className="tg-shell-brand"><ShieldCheck size={34} aria-hidden="true" /><div><strong>TAXGUARD <span>AI</span></strong><small>A/R TAX SERVICES, LLC</small></div></div>
        <div className="tg-shell-heading"><span>{title}</span><small>{DASHBOARD_EXPERIENCES[workspace]}</small></div>
        <button className="tg-shell-search" onClick={openSearch} aria-label={onSearch ? 'Search documents, messages, tax years' : 'Search authorized workspace navigation'}><Search size={16} /><span>{onSearch ? 'Search documents, messages, tax years...' : 'Search workspace navigation...'}</span></button>
        <div className="tg-shell-tools">{headerTools}{notifications ?? <NotificationBell size="sm" />}
          <button className="tg-shell-icon" onClick={() => setPanel('help')} aria-label="Help and support"><HelpCircle size={19} /></button>
          <button className="tg-shell-profile" onClick={onProfile ?? (() => setPanel('profile'))} aria-label="View profile"><span className="tg-avatar">{currentUser?.name?.charAt(0).toUpperCase() || <User size={16} />}</span><span className="tg-profile-name">{currentUser?.name}</span></button>
          <button className="tg-shell-icon" onClick={() => void logout()} aria-label="Sign Out" title="Sign Out"><LogOut size={18} /></button>
        </div>
      </header>
      <div inert={isMobileOpen} className="tg-shell-body">
        <nav ref={navRef} className={`tg-shell-navigation ${navigationCollapsed ? 'tg-navigation-collapsed' : ''}`} aria-label={`${DASHBOARD_EXPERIENCES[workspace]} navigation`}>{navigation}</nav>
        <div className="tg-shell-content" id={contentId} tabIndex={-1}>{children}</div>
      </div>
      {isMobileOpen && <div className="tg-drawer-backdrop" onClick={() => setMobileOpen(false)}>
        <div ref={drawerRef} id={drawerId} className="tg-shell-drawer" role="dialog" aria-modal="true" aria-label="Workspace navigation" onClick={event => event.stopPropagation()}>
          <button className="tg-shell-icon tg-drawer-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={20} /></button>
          <nav aria-label="Mobile workspace navigation" onClick={event => { if ((event.target as HTMLElement).closest('button') && !(event.target as HTMLElement).closest('button')?.hasAttribute('aria-expanded')) setMobileOpen(false); }}>{mobileNavigation ?? navigation}</nav>
        </div>
      </div>}
      <dialog ref={dialogRef} className="tg-shell-dialog" onCancel={() => setPanel(null)} onClose={() => setPanel(null)} aria-labelledby={`${contentId}-panel-title`}>
        <div className="tg-dialog-title"><h2 id={`${contentId}-panel-title`}>{panel === 'search' ? 'Search workspace navigation' : panel === 'profile' ? 'Your profile' : 'Help & Support'}</h2><button className="tg-shell-icon" onClick={() => setPanel(null)} aria-label="Close dialog"><X size={18} /></button></div>
        {panel === 'search' && <><label htmlFor={`${contentId}-search`}>Find an authorized module</label><input id={`${contentId}-search`} autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Documents, requests, bookkeeping..." /><div className="tg-search-results">{links.filter(link => link.label.toLowerCase().includes(query.toLowerCase())).map((link, index) => <button key={index} onClick={() => { link.button.click(); setPanel(null); }}>{link.label}</button>)}{!links.some(link => link.label.toLowerCase().includes(query.toLowerCase())) && <p>No matching modules.</p>}</div></>}
        {panel === 'profile' && <><p><strong>{currentUser?.name}</strong></p><p>{currentUser?.email}</p><p>Session role: {currentUser?.role}</p><p>Role access is managed by your firm administrator.</p></>}
        {panel === 'help' && <><p>Contact A/R Tax Services for help with your workspace.</p><a href="tel:678-205-9486">Call 678-205-9486</a><p>Send tax documents through your private document workspace.</p></>}
      </dialog>
    </div>
  );
}
