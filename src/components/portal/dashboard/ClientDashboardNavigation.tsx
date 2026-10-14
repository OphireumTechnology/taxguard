import React from 'react';
import { Archive, Bell, Calendar, ChevronLeft, ChevronRight, CreditCard, FileQuestion, FileText, LayoutDashboard, MessageSquare, Scale, Settings, ShieldCheck, Users } from 'lucide-react';
import './clientDashboard.css';

export const CLIENT_NAV_ITEMS = [
  { id: 'home', label: 'Dashboard', Icon: LayoutDashboard }, { id: 'tax_return', label: 'My Tax Returns', Icon: FileText },
  { id: 'documents', label: 'Documents', Icon: FileText }, { id: 'questionnaire', label: 'Questionnaire', Icon: FileQuestion },
  { id: 'requests', label: 'Requests', Icon: FileQuestion }, { id: 'messages', label: 'Messages', Icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'appointments', label: 'Appointments', Icon: Calendar }, { id: 'billing', label: 'Invoices', Icon: CreditCard },
  { id: 'records', label: 'My Records', Icon: Archive }, { id: 'advisor', label: 'My Advisor', Icon: Users }, { id: 'legal', label: 'Legal Coordination', Icon: Scale },
  { id: 'settings', label: 'Settings', Icon: Settings },
] as const;

export function ClientDashboardNavigation({ active, collapsed, onToggle, onNavigate, detailedWorkflow }: { active: string; collapsed: boolean; onToggle?: () => void; onNavigate: (id: string) => void; detailedWorkflow?: React.ReactNode }) {
  return <nav aria-label="Client portal" className={`tg-client-navigation ${collapsed ? 'tg-client-nav-collapsed' : ''}`}>
    <div className="tg-client-nav-heading">{!collapsed && <strong>Client Dashboard</strong>}{onToggle && <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? <ChevronRight size={17} aria-hidden="true" /> : <ChevronLeft size={17} aria-hidden="true" />}</button>}</div>
    <div className="tg-client-nav-items">{CLIENT_NAV_ITEMS.map(({ id, label, Icon }) => <button type="button" key={id} onClick={() => onNavigate(id)} title={label} aria-label={label} aria-current={active === id ? 'page' : undefined}><Icon size={17} aria-hidden="true" />{!collapsed && <span>{label}</span>}</button>)}</div>
    {!collapsed && <><div className="tg-client-nav-help"><strong>Need Help?</strong><p>Message your advisor or schedule an appointment.</p><button type="button" onClick={() => onNavigate('messages')}>Send Message</button><button type="button" onClick={() => onNavigate('appointments')}>Schedule Appointment</button></div>
      <details><summary>Workflow (18 Stages)</summary>{detailedWorkflow}</details><details><summary>Case &amp; Compliance</summary><button type="button" onClick={() => onNavigate('activity')}>Activity</button><button type="button" onClick={() => onNavigate('exceptions')}>Requests & Exceptions</button></details><details><summary>Account &amp; Security</summary><button type="button" onClick={() => onNavigate('profile')}>Profile</button><button type="button" onClick={() => onNavigate('security')}><ShieldCheck size={14} aria-hidden="true" /> Security & Consent</button><button type="button" onClick={() => onNavigate('help')}>Help &amp; contact</button></details></>}
  </nav>;
}
